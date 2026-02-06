# Wallet Service

API REST para gerenciamento de carteiras digitais com NestJS e PostgreSQL.

## O que faz

- CRUD de usuários com autenticação
- Sistema de carteiras (cada usuário tem uma)
- Transações: depósitos, saques e transferências entre usuários
- Histórico de transações

## Tecnologias

- NestJS + TypeScript
- Prisma ORM + PostgreSQL
- Argon2 para hash de senhas
- Docker para ambiente de desenvolvimento
- Jest para testes

## Sistema de Mensageria (Kafka)

O projeto utiliza **Apache Kafka** para processamento assíncrono de eventos, garantindo desacoplamento entre os serviços.

### Fluxo de Notificação de Transações

1. Quando uma transação (depósito, saque ou transferência) é criada com sucesso, o `TransactionService` publica um evento no tópico `transactions.created`.
2. O `TransactionEmailConsumer` (consumer) escuta este tópico.
3. Ao receber o evento, o consumidor busca os detalhes da transação e envia um email de notificação para os usuários envolvidos usando o `Nodemailer`.

**Infraestrutura:**

- **Zookeeper**: Gerenciamento do cluster Kafka.
- **Kafka Broker**: Servidor de mensagens.
- **Microservices**: A arquitetura permite que consumidores escalem independentemente da API principal.

## Pré-requisitos

- Node.js >= 18
- Docker e Docker Compose

## Como rodar

### Com Docker (recomendado)

```bash
docker-compose up --build
```

A API vai rodar em `http://localhost:3000`

### Sem Docker

```bash
npm install
npx prisma migrate dev
npm run start:dev
```

## Configuração

Crie um arquivo `.env` na raiz do projeto:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wallet"
PORT=3000

# Kafka Config
KAFKA_BROKER="localhost:9092"
KAFKA_CLIENT_ID="wallet-service"
KAFKA_GROUP_ID="wallet-consumer-group"

# Email Config (Gmail Example)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="seu-email@gmail.com"
SMTP_PASS="sua-senha-de-app"
```

## Endpoints

### Usuários

```
POST   /user          - Criar usuário
GET    /user          - Listar usuários
GET    /user/:id      - Buscar por ID
PATCH  /user/:id      - Atualizar
DELETE /user/:id      - Deletar
```

**Criar usuário:**

```json
POST /user
{
  "name": "João Silva",
  "email": "joao@email.com",
  "password": "senha123"
}
```

### Carteiras

```
POST   /wallet              - Criar carteira
GET    /wallet              - Listar carteiras
GET    /wallet/:id          - Buscar por ID
GET    /wallet/user/:userId - Buscar por ID do usuário (Para descobrir o ID da Wallet)
DELETE /wallet/:id          - Deletar
```

**Criar carteira:**

```json
POST /wallet
{
  "userId": "uuid-do-usuario"
}
```

### Transações

```
GET  /transaction                  - Listar transações
GET  /transaction/:id              - Buscar por ID
POST /transaction/deposit-withdraw - Depósito ou saque
POST /transaction/transfer         - Transferência entre carteiras
```

**Depósito:**

```json
POST /transaction/deposit-withdraw
{
  "walletId": "uuid-da-carteira",
  "amount": 100.50,
  "type": "DEPOSIT"
}
```

**Saque:**

```json
POST /transaction/deposit-withdraw
{
  "walletId": "uuid-da-carteira",
  "amount": 50.00,
  "type": "WITHDRAW"
}
```

**Transferência:**

> **Atenção:** Para transferências, utilize o ID da **Carteira** (Wallet), não o ID do Usuário.

```json
POST /transaction/transfer
{
  "debitedAccountId": "uuid-carteira-origem",
  "creditedAccountId": "uuid-carteira-destino",
  "amount": 75.00
}
```

## Testes

```bash
npm run test          # Testes unitários
npm run test:watch    # Modo watch
npm run test:cov      # Com cobertura
npm run test:e2e      # Testes E2E
```

## Modelo de dados

### User

- id (UUID)
- name
- email (unique)
- password (hashed)

### Wallet

- id (UUID)
- userId (unique)
- balance (Decimal)
- timestamps

### Transaction

- id (UUID)
- type (DEPOSIT | WITHDRAW | TRANSFER)
- debitedAccountId
- creditedAccountId
- amount (Decimal)
- timestamps
