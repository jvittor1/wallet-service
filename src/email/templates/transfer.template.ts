import { TransactionEmailData } from '../interfaces/transaction.email.interface';

export function getTransferTemplate(data: TransactionEmailData): string {
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
