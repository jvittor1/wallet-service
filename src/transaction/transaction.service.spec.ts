import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionType, Prisma } from '@prisma/client';

describe('TransactionService', () => {
  let service: TransactionService;
  let prisma: PrismaService;

  const mockPrismaService = {
    wallet: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('transfer', () => {
    it('should create a transfer successfully', async () => {
      const debitedWallet = {
        id: '1',
        balance: new Prisma.Decimal(500),
        userId: 'user1',
      };
      const creditedWallet = {
        id: '2',
        balance: new Prisma.Decimal(200),
        userId: 'user2',
      };
      const createdTransaction = {
        id: 'tx1',
        amount: new Prisma.Decimal(100),
        type: TransactionType.TRANSFER,
        debitedAccountId: '1',
        creditedAccountId: '2',
        createdAt: new Date(),
      };

      mockPrismaService.wallet.findUnique
        .mockResolvedValueOnce(debitedWallet)
        .mockResolvedValueOnce(creditedWallet);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });

      mockPrismaService.transaction.create.mockResolvedValue(
        createdTransaction,
      );

      const result = await service.transfer({
        debitedAccountId: '1',
        creditedAccountId: '2',
        amount: 100,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('tx1');
    });

    it('should throw an error when accounts are the same', async () => {
      await expect(
        service.transfer({
          debitedAccountId: '1',
          creditedAccountId: '1',
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw an error when debited account is not found', async () => {
      mockPrismaService.wallet.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.transfer({
          debitedAccountId: 'non-existent',
          creditedAccountId: '2',
          amount: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw an error when credited account is not found', async () => {
      const debitedWallet = {
        id: '1',
        balance: new Prisma.Decimal(500),
        userId: 'user1',
      };

      mockPrismaService.wallet.findUnique
        .mockResolvedValueOnce(debitedWallet)
        .mockResolvedValueOnce(null);

      await expect(
        service.transfer({
          debitedAccountId: '1',
          creditedAccountId: 'non-existent',
          amount: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw an error when balance is insufficient', async () => {
      const debitedWallet = {
        id: '1',
        balance: new Prisma.Decimal(50),
        userId: 'user1',
      };
      const creditedWallet = {
        id: '2',
        balance: new Prisma.Decimal(200),
        userId: 'user2',
      };

      mockPrismaService.wallet.findUnique
        .mockResolvedValueOnce(debitedWallet)
        .mockResolvedValueOnce(creditedWallet);

      await expect(
        service.transfer({
          debitedAccountId: '1',
          creditedAccountId: '2',
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('depositWithdraw', () => {
    it('should deposit successfully', async () => {
      const wallet = {
        id: '1',
        balance: new Prisma.Decimal(100),
        userId: 'user1',
      };
      const createdTransaction = {
        id: 'tx1',
        amount: new Prisma.Decimal(50),
        type: TransactionType.DEPOSIT,
        creditedAccountId: '1',
        debitedAccountId: null,
        createdAt: new Date(),
      };

      mockPrismaService.wallet.findUnique.mockResolvedValue(wallet);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.transaction.create.mockResolvedValue(
        createdTransaction,
      );

      const result = await service.depositWithdraw({
        walletId: '1',
        amount: 50,
        type: TransactionType.DEPOSIT,
      });

      expect(result).toBeDefined();
      expect(result.type).toBe(TransactionType.DEPOSIT);
    });

    it('should throw an error when depositing negative amount', async () => {
      await expect(
        service.depositWithdraw({
          walletId: '1',
          amount: -50,
          type: TransactionType.DEPOSIT,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should withdraw successfully', async () => {
      const wallet = {
        id: '1',
        balance: new Prisma.Decimal(100),
        userId: 'user1',
      };
      const createdTransaction = {
        id: 'tx1',
        amount: new Prisma.Decimal(50),
        type: TransactionType.WITHDRAW,
        creditedAccountId: null,
        debitedAccountId: '1',
        createdAt: new Date(),
      };

      mockPrismaService.wallet.findUnique.mockResolvedValue(wallet);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockPrismaService.transaction.create.mockResolvedValue(
        createdTransaction,
      );

      const result = await service.depositWithdraw({
        walletId: '1',
        amount: 50,
        type: TransactionType.WITHDRAW,
      });

      expect(result).toBeDefined();
      expect(result.type).toBe(TransactionType.WITHDRAW);
    });

    it('should throw an error when withdrawing with insufficient balance', async () => {
      const wallet = {
        id: '1',
        balance: new Prisma.Decimal(30),
        userId: 'user1',
      };

      mockPrismaService.wallet.findUnique.mockResolvedValue(wallet);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });

      await expect(
        service.depositWithdraw({
          walletId: '1',
          amount: 50,
          type: TransactionType.WITHDRAW,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw an error when wallet is not found', async () => {
      mockPrismaService.wallet.findUnique.mockResolvedValue(null);

      await expect(
        service.depositWithdraw({
          walletId: 'non-existent',
          amount: 50,
          type: TransactionType.DEPOSIT,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
