import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaService } from 'src/kafka/kafka.service';
import { EmailService } from '../email.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { KAFKA_CONFIG, KAFKA_TOPICS } from 'src/kafka/kafka.config';
import { TransactionType } from '@prisma/client';

interface TransactionCreatedEvent {
  id: string;
}

@Injectable()
export class TransactionEmailConsumer implements OnModuleInit {
  constructor(
    private readonly kafkaService: KafkaService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.kafkaService.createConsumer(
      KAFKA_TOPICS.TRANSACTION_CREATED,
      `${KAFKA_CONFIG.groupId}-email`,
      async (message) => {
        await this.handleTransaction(message);
      },
    );
  }

  private async handleTransaction(event: TransactionCreatedEvent) {
    let transaction: any = null;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    for (let i = 0; i < maxRetries; i++) {
      transaction = await this.prisma.transaction.findUnique({
        where: {
          id: event.id,
        },
        include: {
          debitedAccount: { include: { user: true } },
          creditedAccount: { include: { user: true } },
        },
      });

      if (transaction) {
        break;
      }

      console.log(
        `Transaction ${event.id} not found, retrying in ${retryDelay}ms... (${i + 1}/${maxRetries})`,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    if (!transaction) {
      console.error(
        `Transaction ${event.id} not found after ${maxRetries} retries`,
      );
      return;
    }

    if (transaction.debitedAccount) {
      await this.emailService.sendTransactionEmail({
        transactionId: transaction.id,
        type: transaction.type,
        amount: transaction.amount.toNumber(),
        userEmail: transaction.debitedAccount.user.email,
        userName: transaction.debitedAccount.user.name,
        walletBalance: transaction.debitedAccount.balance.toNumber(),
        recipientName: transaction.creditedAccount?.user.name,
        createdAt: transaction.createdAt,
      });
    }

    if (
      transaction.type === TransactionType.TRANSFER &&
      transaction.creditedAccount
    ) {
      await this.emailService.sendTransactionEmail({
        transactionId: transaction.id,
        type: TransactionType.DEPOSIT,
        amount: transaction.amount.toNumber(),
        userEmail: transaction.creditedAccount.user.email,
        userName: transaction.creditedAccount.user.name,
        walletBalance: transaction.creditedAccount.balance.toNumber(),
        recipientName: transaction.debitedAccount?.user.name,
        createdAt: transaction.createdAt,
      });
    }
  }
}
