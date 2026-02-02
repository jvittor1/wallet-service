import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseWalletDto } from './dto/response-wallet.dto';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createWalletDto: CreateWalletDto): Promise<ResponseWalletDto> {
    const wallet = await this.prisma.wallet.create({
      data: createWalletDto,
    });

    return {
      ...wallet,
      balance: wallet.balance.toNumber(),
    };
  }

  async findByUserId(userId: string): Promise<ResponseWalletDto> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Carteira não encontrada');
    }

    return {
      ...wallet,
      balance: wallet.balance.toNumber(),
    };
  }

  async findAll(): Promise<ResponseWalletDto[]> {
    const wallets = await this.prisma.wallet.findMany();
    return wallets.map((wallet) => ({
      ...wallet,
      balance: wallet.balance.toNumber(),
    }));
  }

  async findById(id: string): Promise<ResponseWalletDto> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return {
      ...wallet,
      balance: wallet.balance.toNumber(),
    };
  }

  async remove(id: string): Promise<void> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    await this.prisma.wallet.delete({
      where: { id },
    });
  }
}
