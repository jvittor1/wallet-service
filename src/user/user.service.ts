import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ResponseUserDto } from './dto/response-user.dto';
import { hashPassword } from 'src/utils/hashed-password.util';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto): Promise<ResponseUserDto> {
    const hashedPassword = await hashPassword(createUserDto.password);

    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
      },
    });

    return {
      ...user,
    };
  }

  async findAll(): Promise<ResponseUserDto[]> {
    const users = await this.prisma.user.findMany();
    return users.map((user) => ({
      ...user,
    }));
  }

  async findOne(id: string): Promise<ResponseUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<ResponseUserDto> {
    const { password } = updateUserDto;

    if (password) {
      const hashedPassword = await hashPassword(password);
      updateUserDto.password = hashedPassword;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { ...updateUserDto },
    });

    return {
      ...user,
    };
  }

  async remove(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.user.delete({
      where: { id },
    });
  }
}
