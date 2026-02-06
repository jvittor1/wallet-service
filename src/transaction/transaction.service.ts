import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DepositWithdrawDto, TransferDto } from './dto/create-transaction.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransactionType } from '@prisma/client';
import { ResponseTransactionDto } from './dto/response-transaction.dto';
import { KafkaService } from 'src/kafka/kafka.service';
import { KAFKA_TOPICS } from 'src/kafka/kafka.config';

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private kafkaService: KafkaService,
  ) {}

  async findAll(): Promise<ResponseTransactionDto[]> {
    const transactions = await this.prisma.transaction.findMany();
    return transactions.map((transaction) => ({
      ...transaction,
      amount: transaction.amount.toNumber(),
    }));
  }

  async findById(id: string): Promise<ResponseTransactionDto> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return {
      ...transaction,
      amount: transaction.amount.toNumber(),
    };
  }

  async depositWithdraw(depositWithdrawDto: DepositWithdrawDto) {
    const { walletId, amount, type } = depositWithdrawDto;
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const account = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return await this.prisma.$transaction(async (prisma) => {
      let newBalance: number;

      if (type === TransactionType.DEPOSIT) {
        newBalance = account.balance.toNumber() + amount;
      } else if (type === TransactionType.WITHDRAW) {
        newBalance = account.balance.toNumber() - amount;
        if (newBalance < 0) {
          throw new BadRequestException('Insufficient balance');
        }
      } else {
        throw new BadRequestException('Invalid transaction type');
      }

      await prisma.wallet.update({
        where: { id: walletId },
        data: { balance: newBalance },
      });

      const createdTransaction = await prisma.transaction.create({
        data: {
          creditedAccountId: type === TransactionType.DEPOSIT ? walletId : null,
          debitedAccountId: type === TransactionType.WITHDRAW ? walletId : null,
          amount,
          type,
        },
      });

      await this.kafkaService.send(KAFKA_TOPICS.TRANSACTION_CREATED, {
        id: createdTransaction.id,
        type: createdTransaction.type,
        amount: createdTransaction.amount.toNumber(),
        createdAt: createdTransaction.createdAt,
      });

      return createdTransaction;
    });
  }

  async transfer(transferDto: TransferDto) {
    const { debitedAccountId, creditedAccountId, amount } = transferDto;
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (debitedAccountId === creditedAccountId) {
      throw new BadRequestException('Cannot transfer to the same account');
    }

    const debitedAccount = await this.prisma.wallet.findUnique({
      where: { id: debitedAccountId },
    });

    if (!debitedAccount) {
      throw new NotFoundException('Debited account not found');
    }

    const creditedAccount = await this.prisma.wallet.findUnique({
      where: { id: creditedAccountId },
    });

    if (!creditedAccount) {
      throw new NotFoundException('Credited account not found');
    }

    const newDebitedBalance = debitedAccount.balance.toNumber() - amount;
    if (newDebitedBalance < 0) {
      throw new BadRequestException('Insufficient balance');
    }

    return await this.prisma.$transaction(async (prisma) => {
      const newCreditedBalance = creditedAccount.balance.toNumber() + amount;

      await prisma.wallet.update({
        where: { id: debitedAccountId },
        data: { balance: newDebitedBalance },
      });

      await prisma.wallet.update({
        where: { id: creditedAccountId },
        data: { balance: newCreditedBalance },
      });

      const createdTransaction = await prisma.transaction.create({
        data: {
          debitedAccountId,
          creditedAccountId,
          amount,
          type: TransactionType.TRANSFER,
        },
      });

      await this.kafkaService.send(KAFKA_TOPICS.TRANSACTION_CREATED, {
        id: createdTransaction.id,
        type: createdTransaction.type,
        amount: createdTransaction.amount.toNumber(),
        createdAt: createdTransaction.createdAt,
      });

      return createdTransaction;
    });
  }
}
