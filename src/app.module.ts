import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { TransactionModule } from './transaction/transaction.module';
import { WalletModule } from './wallet/wallet.module';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    TransactionModule,
    WalletModule,
    EmailModule,
  ],
})
export class AppModule {}
