# Integração Kafka + Email no Wallet Service

Este guia explica como implementar um sistema de mensageria com Kafka para enviar emails sempre que houver uma transação.

## 📋 Índice

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Dependências Necessárias](#dependências-necessárias)
3. [Configuração do Kafka](#configuração-do-kafka)
4. [Implementação Passo a Passo](#implementação-passo-a-passo)
5. [Templates de Email](#templates-de-email)
6. [Testes](#testes)
7. [Deploy e Monitoramento](#deploy-e-monitoramento)

---

## 🏗️ Visão Geral da Arquitetura

```mermaid
graph LR
    A[Transaction Service] -->|1. Cria transação| B[(PostgreSQL)]
    A -->|2. Publica evento| C[Kafka Topic: transactions]
    C -->|3. Consome evento| D[Email Consumer]
    D -->|4. Envia email| E[SMTP/SendGrid]
    D -->|5. Log status| F[(Logs/DB)]
```

### Fluxo de Eventos

1. **TransactionService** cria a transação no banco de dados
2. **KafkaProducer** publica um evento no tópico `transactions.created`
3. **EmailConsumer** escuta o tópico e processa eventos
4. **EmailService** envia o email usando NodeMailer ou SendGrid
5. O status é registrado para auditoria

---

## 📦 Dependências Necessárias

### 1. Instalar pacotes NPM

```bash
npm install --save kafkajs @nestjs/microservices nodemailer
npm install --save-dev @types/nodemailer
```

### 2. Adicionar variáveis de ambiente

```env
# .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wallet"
PORT=3000

# Kafka
KAFKA_BROKER=localhost:9092
KAFKA_CLIENT_ID=wallet-service
KAFKA_GROUP_ID=wallet-email-service

# Email (NodeMailer - Development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app

# Email (SendGrid - Production) - Opcional
SENDGRID_API_KEY=SG.xxxxx
```

### 3. Configurar Docker Compose

Adicione Kafka e Zookeeper ao seu `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: wallet
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1

volumes:
  postgres_data:
```

---

## 🔧 Implementação Passo a Passo

### Estrutura de Diretórios

```
src/
├── kafka/
│   ├── kafka.module.ts
│   ├── kafka.service.ts
│   └── kafka.config.ts
├── email/
│   ├── email.module.ts
│   ├── email.service.ts
│   ├── consumers/
│   │   └── transaction-email.consumer.ts
│   └── templates/
│       ├── deposit.template.ts
│       ├── withdraw.template.ts
│       └── transfer.template.ts
└── transaction/
    └── transaction.service.ts (modificar)
```

---

### **Passo 1: Configuração do Kafka**

#### `src/kafka/kafka.config.ts`

```typescript
export const KAFKA_CONFIG = {
  clientId: process.env.KAFKA_CLIENT_ID || 'wallet-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  groupId: process.env.KAFKA_GROUP_ID || 'wallet-email-service',
};

export const KAFKA_TOPICS = {
  TRANSACTION_CREATED: 'transactions.created',
};
```

#### `src/kafka/kafka.service.ts`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, Consumer } from 'kafkajs';
import { KAFKA_CONFIG } from './kafka.config';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();

  constructor() {
    this.kafka = new Kafka({
      clientId: KAFKA_CONFIG.clientId,
      brokers: KAFKA_CONFIG.brokers,
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
    console.log('✅ Kafka Producer conectado');
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
    for (const consumer of this.consumers.values()) {
      await consumer.disconnect();
    }
  }

  // Publicar mensagem
  async publish(topic: string, message: any) {
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: message.id || Date.now().toString(),
            value: JSON.stringify(message),
            timestamp: Date.now().toString(),
          },
        ],
      });
      console.log(`📤 Mensagem publicada no tópico: ${topic}`);
    } catch (error) {
      console.error('❌ Erro ao publicar mensagem:', error);
      throw error;
    }
  }

  // Criar consumer
  async createConsumer(groupId: string): Promise<Consumer> {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    this.consumers.set(groupId, consumer);
    return consumer;
  }
}
```

#### `src/kafka/kafka.module.ts`

```typescript
import { Module, Global } from '@nestjs/common';
import { KafkaService } from './kafka.service';

@Global()
@Module({
  providers: [KafkaService],
  exports: [KafkaService],
})
export class KafkaModule {}
```

---

### **Passo 2: Serviço de Email**

#### `src/email/email.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { TransactionType } from '@prisma/client';

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

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

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(payload: EmailPayload): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: `"Wallet Service" <${process.env.SMTP_USER}>`,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });
      console.log(`📧 Email enviado: ${info.messageId}`);
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error);
      throw error;
    }
  }

  async sendTransactionEmail(data: TransactionEmailData): Promise<void> {
    let subject: string;
    let html: string;

    switch (data.type) {
      case TransactionType.DEPOSIT:
        subject = '✅ Depósito Realizado com Sucesso';
        html = this.getDepositTemplate(data);
        break;
      case TransactionType.WITHDRAW:
        subject = '💰 Saque Realizado com Sucesso';
        html = this.getWithdrawTemplate(data);
        break;
      case TransactionType.TRANSFER:
        subject = '💸 Transferência Realizada com Sucesso';
        html = this.getTransferTemplate(data);
        break;
    }

    await this.sendEmail({
      to: data.userEmail,
      subject,
      html,
    });
  }

  private getDepositTemplate(data: TransactionEmailData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4CAF50;">Depósito Realizado ✅</h2>
        <p>Olá, <strong>${data.userName}</strong>!</p>
        <p>Seu depósito foi processado com sucesso.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>ID da Transação:</strong> ${data.transactionId}</p>
          <p><strong>Valor:</strong> R$ ${data.amount.toFixed(2)}</p>
          <p><strong>Novo Saldo:</strong> R$ ${data.walletBalance?.toFixed(2) || '---'}</p>
          <p><strong>Data:</strong> ${new Date(data.createdAt).toLocaleString('pt-BR')}</p>
        </div>
        
        <p style="color: #666; font-size: 12px;">
          Se você não reconhece esta transação, entre em contato conosco imediatamente.
        </p>
      </div>
    `;
  }

  private getWithdrawTemplate(data: TransactionEmailData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FF9800;">Saque Realizado 💰</h2>
        <p>Olá, <strong>${data.userName}</strong>!</p>
        <p>Seu saque foi processado com sucesso.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>ID da Transação:</strong> ${data.transactionId}</p>
          <p><strong>Valor:</strong> R$ ${data.amount.toFixed(2)}</p>
          <p><strong>Novo Saldo:</strong> R$ ${data.walletBalance?.toFixed(2) || '---'}</p>
          <p><strong>Data:</strong> ${new Date(data.createdAt).toLocaleString('pt-BR')}</p>
        </div>
        
        <p style="color: #666; font-size: 12px;">
          Se você não reconhece esta transação, entre em contato conosco imediatamente.
        </p>
      </div>
    `;
  }

  private getTransferTemplate(data: TransactionEmailData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2196F3;">Transferência Realizada 💸</h2>
        <p>Olá, <strong>${data.userName}</strong>!</p>
        <p>Sua transferência foi processada com sucesso.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>ID da Transação:</strong> ${data.transactionId}</p>
          <p><strong>Valor:</strong> R$ ${data.amount.toFixed(2)}</p>
          <p><strong>Destinatário:</strong> ${data.recipientName || 'Outro usuário'}</p>
          <p><strong>Novo Saldo:</strong> R$ ${data.walletBalance?.toFixed(2) || '---'}</p>
          <p><strong>Data:</strong> ${new Date(data.createdAt).toLocaleString('pt-BR')}</p>
        </div>
        
        <p style="color: #666; font-size: 12px;">
          Se você não reconhece esta transação, entre em contato conosco imediatamente.
        </p>
      </div>
    `;
  }
}
```

---

### **Passo 3: Consumer de Emails**

#### `src/email/consumers/transaction-email.consumer.ts`

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaService } from '../../kafka/kafka.service';
import { EmailService } from '../email.service';
import { KAFKA_CONFIG, KAFKA_TOPICS } from '../../kafka/kafka.config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TransactionEmailConsumer implements OnModuleInit {
  constructor(
    private kafkaService: KafkaService,
    private emailService: EmailService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const consumer = await this.kafkaService.createConsumer(
      `${KAFKA_CONFIG.groupId}-email`,
    );

    await consumer.subscribe({
      topic: KAFKA_TOPICS.TRANSACTION_CREATED,
      fromBeginning: false,
    });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const transactionEvent = JSON.parse(message.value.toString());
          console.log(`📨 Recebido evento: ${transactionEvent.id}`);

          await this.processTransactionEmail(transactionEvent);
        } catch (error) {
          console.error('❌ Erro ao processar mensagem:', error);
          // Aqui você pode implementar retry logic ou DLQ (Dead Letter Queue)
        }
      },
    });

    console.log('✅ Consumer de emails iniciado');
  }

  private async processTransactionEmail(transactionEvent: any) {
    // Buscar dados completos da transação
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionEvent.id },
      include: {
        debitedAccount: {
          include: { user: true },
        },
        creditedAccount: {
          include: { user: true },
        },
      },
    });

    if (!transaction) {
      console.error('❌ Transação não encontrada:', transactionEvent.id);
      return;
    }

    // Enviar email para o remetente (se aplicável)
    if (transaction.debitedAccount) {
      const debitedWallet = await this.prisma.wallet.findUnique({
        where: { id: transaction.debitedAccountId },
      });

      await this.emailService.sendTransactionEmail({
        transactionId: transaction.id,
        type: transaction.type,
        amount: transaction.amount.toNumber(),
        userEmail: transaction.debitedAccount.user.email,
        userName: transaction.debitedAccount.user.name,
        walletBalance: debitedWallet?.balance.toNumber(),
        recipientName: transaction.creditedAccount?.user.name,
        createdAt: transaction.createdAt,
      });
    }

    // Enviar email para o destinatário (se for transferência ou depósito)
    if (transaction.creditedAccount && transaction.type === 'TRANSFER') {
      const creditedWallet = await this.prisma.wallet.findUnique({
        where: { id: transaction.creditedAccountId },
      });

      await this.emailService.sendTransactionEmail({
        transactionId: transaction.id,
        type: 'DEPOSIT' as any, // Notificar como depósito para o destinatário
        amount: transaction.amount.toNumber(),
        userEmail: transaction.creditedAccount.user.email,
        userName: transaction.creditedAccount.user.name,
        walletBalance: creditedWallet?.balance.toNumber(),
        createdAt: transaction.createdAt,
      });
    }
  }
}
```

#### `src/email/email.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { TransactionEmailConsumer } from './consumers/transaction-email.consumer';
import { KafkaModule } from '../kafka/kafka.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [KafkaModule, PrismaModule],
  providers: [EmailService, TransactionEmailConsumer],
  exports: [EmailService],
})
export class EmailModule {}
```

---

### **Passo 4: Modificar TransactionService**

#### `src/transaction/transaction.service.ts` (adicionar evento Kafka)

```typescript
import { Injectable } from '@nestjs/common';
import { KafkaService } from '../kafka/kafka.service';
import { KAFKA_TOPICS } from '../kafka/kafka.config';
// ... outros imports

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private kafkaService: KafkaService, // ⬅️ Injetar KafkaService
  ) {}

  async depositWithdraw(depositWithdrawDto: DepositWithdrawDto) {
    // ... código existente ...

    const transaction = await this.prisma.$transaction(async (prisma) => {
      // ... lógica de transação existente ...
      
      const createdTransaction = await prisma.transaction.create({
        data: {
          creditedAccountId: type === TransactionType.DEPOSIT ? walletId : null,
          debitedAccountId: type === TransactionType.WITHDRAW ? walletId : null,
          amount,
          type,
        },
      });

      // ⬇️ PUBLICAR EVENTO NO KAFKA
      await this.kafkaService.publish(KAFKA_TOPICS.TRANSACTION_CREATED, {
        id: createdTransaction.id,
        type: createdTransaction.type,
        amount: createdTransaction.amount,
        timestamp: new Date().toISOString(),
      });

      return createdTransaction;
    });

    return transaction;
  }

  async transfer(transferDto: TransferDto) {
    // ... código existente ...

    const transaction = await this.prisma.$transaction(async (prisma) => {
      // ... lógica de transação existente ...

      const createdTransaction = await prisma.transaction.create({
        data: {
          debitedAccountId,
          creditedAccountId,
          amount,
          type: TransactionType.TRANSFER,
        },
      });

      // ⬇️ PUBLICAR EVENTO NO KAFKA
      await this.kafkaService.publish(KAFKA_TOPICS.TRANSACTION_CREATED, {
        id: createdTransaction.id,
        type: createdTransaction.type,
        amount: createdTransaction.amount,
        timestamp: new Date().toISOString(),
      });

      return createdTransaction;
    });

    return transaction;
  }
}
```

---

### **Passo 5: Atualizar App Module**

#### `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { KafkaModule } from './kafka/kafka.module';
import { EmailModule } from './email/email.module';
// ... outros imports

@Module({
  imports: [
    KafkaModule,    // ⬅️ Adicionar
    EmailModule,    // ⬅️ Adicionar
    // ... outros módulos
  ],
})
export class AppModule {}
```

---

## 🧪 Testes

### Teste Manual

1. Inicie o ambiente:
```bash
docker-compose up -d
npm run start:dev
```

2. Crie uma transação:
```bash
curl -X POST http://localhost:3000/transaction/deposit-withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "walletId": "seu-wallet-id",
    "amount": 100,
    "type": "DEPOSIT"
  }'
```

3. Verifique os logs:
```
✅ Kafka Producer conectado
✅ Consumer de emails iniciado
📤 Mensagem publicada no tópico: transactions.created
📨 Recebido evento: transaction-id
📧 Email enviado: <message-id>
```

### Teste Unitário

```typescript
// src/email/email.service.spec.ts
describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('deve enviar email de depósito', async () => {
    const spy = jest.spyOn(service, 'sendEmail');
    
    await service.sendTransactionEmail({
      transactionId: 'test-id',
      type: 'DEPOSIT',
      amount: 100,
      userEmail: 'test@example.com',
      userName: 'Test User',
      createdAt: new Date(),
    });

    expect(spy).toHaveBeenCalled();
  });
});
```

---

## 🚀 Deploy e Monitoramento

### Variáveis de Ambiente - Production

```env
# Production - SendGrid
SENDGRID_API_KEY=SG.xxxxx

# Production - Kafka (Confluent Cloud / AWS MSK)
KAFKA_BROKER=pkc-xxxxx.us-east-1.aws.confluent.cloud:9092
KAFKA_SASL_USERNAME=xxxxx
KAFKA_SASL_PASSWORD=xxxxx
```

### Monitoramento

1. **Logs estruturados** - Adicione Winston ou Pino
2. **Métricas Kafka** - Use Kafka Manager ou Confluent Control Center
3. **Alertas** - Configure alertas para consumer lag
4. **Health Checks** - Adicione endpoint `/health` que verifica conexão Kafka

### Melhorias Futuras

- ✅ **Retry Logic** - Implementar retentativas com backoff exponencial
- ✅ **Dead Letter Queue** - Criar tópico para mensagens com falha
- ✅ **Rate Limiting** - Limitar envio de emails por minuto
- ✅ **Templates HTML** - Usar Handlebars ou EJS
- ✅ **Tracking** - Adicionar rastreamento de abertura de emails
- ✅ **Idempotência** - Garantir que emails não sejam enviados duplicados

---

## 🎯 Conclusão

Você agora tem uma arquitetura escalável com:
- ✅ Desacoplamento entre transações e emails
- ✅ Resiliência com Kafka
- ✅ Processamento assíncrono
- ✅ Fácil de escalar horizontalmente

**Próximos passos:**
1. Implementar os arquivos acima
2. Testar localmente com Docker
3. Adicionar testes automatizados
4. Configurar monitoramento
5. Deploy em produção

Qualquer dúvida é só chamar! 🚀
