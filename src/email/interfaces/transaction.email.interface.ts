import { TransactionType } from '@prisma/client';

export interface TransactionEmailData {
  transactionId: string;
  type: TransactionType;
  amount: number;
  userEmail: string;
  userName: string;
  walletBalance?: number;
  recipientName?: string;
  createdAt: Date;
}
