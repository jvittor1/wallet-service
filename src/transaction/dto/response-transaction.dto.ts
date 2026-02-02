import { TransactionType } from '@prisma/client';

export class ResponseTransactionDto {
  id: string;
  amount: number;
  type: TransactionType;
  debitedAccountId: string | null;
  creditedAccountId: string | null;
}
