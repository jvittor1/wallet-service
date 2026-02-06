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
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
    for (const consumer of this.consumers.values()) {
      await consumer.disconnect();
    }
  }

  async send(topic: string, message: any) {
    await this.producer.send({
      topic,
      messages: [
        {
          key: message.id?.toString(),
          value: JSON.stringify(message),
        },
      ],
    });
  }

  async createConsumer(
    topic: string,
    groupId: string,
    callback: (message: any) => Promise<void>,
  ) {
    const consumerKey = `${topic}:${groupId}`;

    if (this.consumers.has(consumerKey)) {
      return;
    }

    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic });

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const value = message.value?.toString();
          if (value) {
            await callback(JSON.parse(value));
          }
        } catch (error) {
          console.error(`Error processing message from topic ${topic}:`, error);
        }
      },
    });

    this.consumers.set(consumerKey, consumer);
  }
}
