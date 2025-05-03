import { createTransport } from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Configuração do cliente Amazon SES
const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Criar transportador do nodemailer usando Amazon SES
const transporter = createTransport({
  SES: { ses: sesClient, aws: { SendEmailCommand } },
});

/**
 * Envia um email de recuperação de senha usando o Amazon SES
 * @param email Email do destinatário
 * @param recoveryToken Token de recuperação
 */
export async function sendPasswordRecoveryEmail(
  email: string,
  recoveryToken: string,
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl}/reset-password?token=${recoveryToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@seudominio.com',
    to: email,
    subject: 'Recuperação de Senha',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Recuperação de Senha</h2>
        <p style="color: #666; line-height: 1.5;">Recebemos uma solicitação para redefinir sua senha. Se você não fez esta solicitação, por favor ignore este email.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #4a6cf7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Redefinir minha senha</a>
        </div>
        <p style="color: #666; line-height: 1.5;">Se o botão acima não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;"><a href="${resetUrl}" style="color: #4a6cf7; text-decoration: none;">${resetUrl}</a></p>
        <p style="color: #666; line-height: 1.5;">Este link expirará em 1 hora por motivos de segurança.</p>
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">Este é um email automático, por favor não responda.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email de recuperação enviado para: ${email}`);
  } catch (error) {
    console.error('Erro ao enviar email de recuperação:', error);
    throw new Error('Falha ao enviar email de recuperação');
  }
}
