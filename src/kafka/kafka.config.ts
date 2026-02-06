export const KAFKA_CONFIG = {
  clientId: process.env.KAFKA_CLIENT_ID || 'wallet-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  groupId: process.env.KAFKA_GROUP_ID || 'wallet-email-service',
};

export const KAFKA_TOPICS = {
  TRANSACTION_CREATED: 'transactions.created',
};