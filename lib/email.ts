import { Resend } from 'resend';

// Log para verificar se a variável está sendo carregada (remover após teste)
console.log('URL da aplicação:', process.env.NEXT_PUBLIC_APP_URL);

// Validar variáveis de ambiente necessárias
if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY não está definida nas variáveis de ambiente');
}

if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error(
    'NEXT_PUBLIC_APP_URL não está definida nas variáveis de ambiente',
  );
}

if (!process.env.EMAIL_FROM) {
  throw new Error('EMAIL_FROM não está definida nas variáveis de ambiente');
}

// Inicializar o Resend com sua API key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Envia um email de recuperação de senha usando Resend
 * @param email Email do destinatário
 * @param recoveryToken Token de recuperação
 */
export async function sendPasswordRecoveryEmail(
  email: string,
  recoveryToken: string,
) {
  // Validar formato do email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Formato de email inválido');
  }

  // Validar token de recuperação
  if (!recoveryToken || recoveryToken.length < 10) {
    throw new Error('Token de recuperação inválido');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const resetUrl = `${appUrl}/reset-password?token=${recoveryToken}`;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM as string,
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
    });

    if (error) {
      console.error('Erro ao enviar email:', error);
      throw new Error(`Falha ao enviar email: ${error.message}`);
    }

    console.log(`Email de recuperação enviado com sucesso para: ${email}`);
    return { success: true, data };
  } catch (error) {
    console.error('Erro ao enviar email de recuperação:', error);
    throw new Error('Falha ao enviar email de recuperação');
  }
}
