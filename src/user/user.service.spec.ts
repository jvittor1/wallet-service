import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { hashPassword } from 'src/utils/hashed-password.util';
import { NotFoundException } from '@nestjs/common';

jest.mock('src/utils/hashed-password.util');

describe('UserService', () => {
  let service: UserService;
  let prismaService: PrismaService;

  // Mock do PrismaService
  const mockPrismaService = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);

    (hashPassword as jest.Mock).mockResolvedValue('hashedPassword');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('must create a user successfully', async () => {
      const dto = {
        name: 'João Silva',
        email: 'joao@example.com',
        password: 'senha123',
      };

      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: dto.name,
        email: dto.email,
        password: 'hashedPassword',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      mockPrismaService.user.create.mockResolvedValue(mockUser);

      const result = await service.create(dto);

      expect(result).toEqual(mockUser);
      expect(hashPassword).toHaveBeenCalledWith('senha123');
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          email: dto.email,
          password: 'hashedPassword',
        },
      });
    });

    it('must throw an error when email already exists (P2002)', async () => {
      const dto = {
        name: 'João Silva',
        email: 'joao@example.com',
        password: 'senha123',
      };

      const prismaError = new Error(
        'Unique constraint failed on the fields: (`email`)',
      );
      (prismaError as any).code = 'P2002';

      mockPrismaService.user.create.mockRejectedValue(prismaError);

      await expect(service.create(dto)).rejects.toThrow(
        'Unique constraint failed on the fields: (`email`)',
      );
    });
  });

  describe('findAll', () => {
    it('must return all users', async () => {
      const mockUsers = [
        {
          id: '1',
          name: 'User 1',
          email: 'user1@example.com',
          password: 'hash1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'User 2',
          email: 'user2@example.com',
          password: 'hash2',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(result).toEqual(mockUsers);
      expect(prismaService.user.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('must return a user by ID', async () => {
      const mockUser = {
        id: '1',
        name: 'User 1',
        email: 'user1@example.com',
        password: 'hash1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('1');

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('deve lançar NotFoundException quando usuário não existe', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('must update a user without changing the password', async () => {
      const updateDto = {
        name: 'João Updated',
        email: 'joao.updated@example.com',
      };

      const mockUpdatedUser = {
        id: '1',
        name: updateDto.name,
        email: updateDto.email,
        password: 'oldHash',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await service.update('1', updateDto);

      expect(result).toEqual(mockUpdatedUser);
      expect(hashPassword).not.toHaveBeenCalled();
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateDto,
      });
    });

    it('must update a user and hash the new password', async () => {
      const updateDto = {
        name: 'João Updated',
        password: 'newPassword123',
      };

      const mockUpdatedUser = {
        id: '1',
        name: updateDto.name,
        email: 'joao@example.com',
        password: 'hashedPassword',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

      const result = await service.update('1', updateDto);

      expect(result).toEqual(mockUpdatedUser);
      expect(hashPassword).toHaveBeenCalledWith('newPassword123');
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          name: updateDto.name,
          password: 'hashedPassword',
        },
      });
    });
  });

  describe('remove', () => {
    it('must remove a user successfully', async () => {
      const mockUser = {
        id: '1',
        name: 'User 1',
        email: 'user1@example.com',
        password: 'hash1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.delete.mockResolvedValue(mockUser);

      await service.remove('1');

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(prismaService.user.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('must throw NotFoundException when trying to remove a non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
      expect(prismaService.user.delete).not.toHaveBeenCalled();
    });
  });
});
