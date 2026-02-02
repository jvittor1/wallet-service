import { TransactionType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class TransferDto {
  @IsString()
  @IsNotEmpty()
  debitedAccountId: string;

  @IsString()
  @IsNotEmpty()
  creditedAccountId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;
}

export class DepositWithdrawDto {
  @IsString()
  @IsNotEmpty()
  walletId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;
}
