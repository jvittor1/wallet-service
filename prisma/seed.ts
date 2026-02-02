import { PrismaClient, TransactionType, Prisma } from '@prisma/client';
import { hashPassword } from '../src/utils/hashed-password.util';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting database seeding...');

  await prisma.transaction.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await hashPassword('password123');

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: 'João Silva',
        email: 'joao@example.com',
        password: hashedPassword,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Maria Santos',
        email: 'maria@example.com',
        password: hashedPassword,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Pedro Costa',
        email: 'pedro@example.com',
        password: hashedPassword,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Ana Oliveira',
        email: 'ana@example.com',
        password: hashedPassword,
      },
    }),
    prisma.user.create({
      data: {
        name: 'Carlos Pereira',
        email: 'carlos@example.com',
        password: hashedPassword,
      },
    }),
  ]);

  const wallets = await Promise.all(
    users.map((user) =>
      prisma.wallet.create({
        data: {
          userId: user.id,
          balance: new Prisma.Decimal(0),
        },
      }),
    ),
  );

  // Deposits
  await Promise.all([
    prisma.transaction.create({
      data: {
        type: TransactionType.DEPOSIT,
        amount: new Prisma.Decimal(1000),
        creditedAccountId: wallets[0].id,
      },
    }),
    prisma.transaction.create({
      data: {
        type: TransactionType.DEPOSIT,
        amount: new Prisma.Decimal(500),
        creditedAccountId: wallets[1].id,
      },
    }),
    prisma.transaction.create({
      data: {
        type: TransactionType.DEPOSIT,
        amount: new Prisma.Decimal(750),
        creditedAccountId: wallets[2].id,
      },
    }),
    prisma.transaction.create({
      data: {
        type: TransactionType.DEPOSIT,
        amount: new Prisma.Decimal(2000),
        creditedAccountId: wallets[3].id,
      },
    }),
    prisma.transaction.create({
      data: {
        type: TransactionType.DEPOSIT,
        amount: new Prisma.Decimal(300),
        creditedAccountId: wallets[4].id,
      },
    }),
  ]);

  // Update balances after deposits
  await Promise.all([
    prisma.wallet.update({
      where: { id: wallets[0].id },
      data: { balance: new Prisma.Decimal(1000) },
    }),
    prisma.wallet.update({
      where: { id: wallets[1].id },
      data: { balance: new Prisma.Decimal(500) },
    }),
    prisma.wallet.update({
      where: { id: wallets[2].id },
      data: { balance: new Prisma.Decimal(750) },
    }),
    prisma.wallet.update({
      where: { id: wallets[3].id },
      data: { balance: new Prisma.Decimal(2000) },
    }),
    prisma.wallet.update({
      where: { id: wallets[4].id },
      data: { balance: new Prisma.Decimal(300) },
    }),
  ]);

  // Withdrawals
  await Promise.all([
    prisma.transaction.create({
      data: {
        type: TransactionType.WITHDRAW,
        amount: new Prisma.Decimal(100),
        debitedAccountId: wallets[0].id,
      },
    }),
    prisma.transaction.create({
      data: {
        type: TransactionType.WITHDRAW,
        amount: new Prisma.Decimal(50),
        debitedAccountId: wallets[1].id,
      },
    }),
  ]);

  // Transfers
  await Promise.all([
    prisma.transaction.create({
      data: {
        type: TransactionType.TRANSFER,
        amount: new Prisma.Decimal(200),
        debitedAccountId: wallets[0].id,
        creditedAccountId: wallets[1].id,
      },
    }),
    prisma.transaction.create({
      data: {
        type: TransactionType.TRANSFER,
        amount: new Prisma.Decimal(150),
        debitedAccountId: wallets[3].id,
        creditedAccountId: wallets[2].id,
      },
    }),
  ]);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
