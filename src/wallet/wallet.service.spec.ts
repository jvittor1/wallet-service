import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from 'src/prisma/prisma.service';

type DecimalLike = {
  toNumber: () => number;
};

// Mock PrismaService
const mockPrismaService = {
  wallet: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

describe('WalletService', () => {
  let service: WalletService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a wallet successfully', async () => {
      const userId = 'user-123';
      const mockBalance: DecimalLike = { toNumber: () => 0 };
      const mockWallet = {
        id: 'wallet-1',
        userId,
        balance: mockBalance,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.wallet.create.mockResolvedValue(mockWallet);

      const result = await service.create({ userId });

      expect(result).toEqual({
        id: 'wallet-1',
        userId,
        balance: 0,
        createdAt: mockWallet.createdAt,
        updatedAt: mockWallet.updatedAt,
      });
      expect(prisma.wallet.create).toHaveBeenCalledWith({
        data: { userId },
      });
      expect(prisma.wallet.create).toHaveBeenCalledTimes(1);
    });

    it('should throw an error when wallet already exists for user (unique constraint)', async () => {
      const userId = 'user-123';
      const prismaError = {
        code: 'P2002',
        meta: { target: ['userId'] },
        message: 'Unique constraint failed on the fields: (`userId`)',
      };

      prisma.wallet.create.mockRejectedValue(prismaError);

      await expect(service.create({ userId })).rejects.toMatchObject({
        code: 'P2002',
      });
      expect(prisma.wallet.create).toHaveBeenCalledWith({
        data: { userId },
      });
    });

    it('should throw an error when database operation fails', async () => {
      const userId = 'user-123';
      const databaseError = new Error('Database connection failed');

      prisma.wallet.create.mockRejectedValue(databaseError);

      await expect(service.create({ userId })).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
