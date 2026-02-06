import { TransactionEmailData } from '../interfaces/transaction.email.interface';

export function getWithdrawTemplate(data: TransactionEmailData): string {
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
