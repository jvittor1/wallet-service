import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailPayload } from './interfaces/email.payload.interface';
import { TransactionEmailData } from './interfaces/transaction.email.interface';
import { TransactionType } from '@prisma/client';
import { getDepositTemplate } from './templates/deposit.template';
import { getWithdrawTemplate } from './templates/withdraw.template';
import { getTransferTemplate } from './templates/transfer.template';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
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

      console.log('Email enviado com sucesso:', info.messageId);
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      throw error;
    }
  }

  async sendTransactionEmail(data: TransactionEmailData): Promise<void> {
    const template = this.getTemplate(data.type);
    const html = template(data);
    const payload: EmailPayload = {
      to: data.userEmail,
      subject: `Transação ${data.type}`,
      html,
    };
    await this.sendEmail(payload);
  }

  private getTemplate(
    type: TransactionType,
  ): (data: TransactionEmailData) => string {
    const templates = {
      [TransactionType.DEPOSIT]: getDepositTemplate,
      [TransactionType.WITHDRAW]: getWithdrawTemplate,
      [TransactionType.TRANSFER]: getTransferTemplate,
    };

    return templates[type];
  }
}
