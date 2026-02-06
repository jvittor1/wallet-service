import { KafkaModule } from 'src/kafka/kafka.module';
import { EmailService } from './email.service';
import { TransactionEmailConsumer } from './consumer/transaction-email.consumer';
import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [KafkaModule, PrismaModule],
  providers: [EmailService, TransactionEmailConsumer],
  exports: [EmailService],
})
export class EmailModule {}
