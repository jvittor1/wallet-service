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

## Pré-requisitos

- Node.js >= 18
- Docker e Docker Compose

## Como rodar

### Com Docker (recomendado)

```bash
docker-compose up
```

A API vai rodar em `http://localhost:3000`

### Sem Docker

```bash
npm install
npx prisma migrate dev
npm run start:dev
```

## Configuração

Crie um arquivo `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wallet"
PORT=3000
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
GET    /wallet/user/:userId - Buscar por ID do usuário
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
POST /transaction/transfer         - Transferência
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

```json
POST /transaction/transfer
{
  "amount": 75.00,
  "toUserId": "uuid-usuario-destino"
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
