import { Resend } from 'resend';

// Validar variáveis de ambiente necessárias
if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY não está definida nas variáveis de ambiente');
}

if (!process.env.EMAIL_FROM) {
  throw new Error('EMAIL_FROM não está definida nas variáveis de ambiente');
}

if (!process.env.EMAIL_ADMIN) {
  console.warn(
    'EMAIL_ADMIN não está definida - emails de solicitação de conhecimento não serão enviados',
  );
}

// Inicializar o Resend com sua API key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Interface para dados da solicitação de inclusão na base de conhecimento
 */
interface KnowledgeRequestData {
  userQuestion: string;
  userEmail?: string;
  userId?: string;
  timestamp: Date;
  sessionId?: string;
}

/**
 * Envia um email para o administrador quando a IA não encontra informações na base de conhecimento
 * @param requestData Dados da solicitação incluindo a pergunta do usuário
 */
export async function sendKnowledgeInclusionRequest(
  requestData: KnowledgeRequestData,
) {
  // Verificar se o email do admin está configurado
  if (!process.env.EMAIL_ADMIN) {
    console.warn(
      'EMAIL_ADMIN não configurado - não é possível enviar solicitação de conhecimento',
    );
    return {
      success: false,
      message: 'Email do administrador não configurado',
    };
  }

  // Validar dados obrigatórios
  if (
    !requestData.userQuestion ||
    requestData.userQuestion.trim().length === 0
  ) {
    throw new Error('Pergunta do usuário é obrigatória');
  }

  const { userQuestion, userEmail, userId, timestamp, sessionId } = requestData;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM as string,
      to: process.env.EMAIL_ADMIN as string,
      subject: 'Solicitação de Inclusão na Base de Conhecimento - IA Jurídica',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; background-color: #fafafa;">
          <div style="background-color: #4a6cf7; color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px;">
            <h2 style="margin: 0; text-align: center;">🤖 Solicitação de Treinamento da IA</h2>
            <p style="margin: 10px 0 0 0; text-align: center; opacity: 0.9;">Nova pergunta não encontrada na base de conhecimento</p>
          </div>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ff6b6b;">
            <h3 style="color: #333; margin-top: 0; display: flex; align-items: center;">
              <span style="background-color: #ff6b6b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 10px;">PERGUNTA</span>
              Questão do Usuário
            </h3>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #e9ecef;">
              <p style="color: #333; line-height: 1.6; margin: 0; font-size: 16px; white-space: pre-wrap;">${userQuestion}</p>
            </div>
          </div>

          <div style="background-color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #333; margin-top: 0; display: flex; align-items: center;">
              <span style="background-color: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 10px;">INFO</span>
              Detalhes da Solicitação
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555; width: 30%;">Data/Hora:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${timestamp.toLocaleString(
                  'pt-BR',
                  {
                    timeZone: 'America/Sao_Paulo',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  },
                )}</td>
              </tr>
              ${
                userEmail
                  ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Email do Usuário:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${userEmail}</td>
              </tr>
              `
                  : ''
              }
              ${
                userId
                  ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">ID do Usuário:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${userId}</td>
              </tr>
              `
                  : ''
              }
              ${
                sessionId
                  ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">ID da Sessão:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${sessionId}</td>
              </tr>
              `
                  : ''
              }
            </table>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h4 style="color: #856404; margin-top: 0; display: flex; align-items: center;">
              <span style="margin-right: 8px;">⚠️</span>
              Ação Necessária
            </h4>
            <p style="color: #856404; margin: 0; line-height: 1.5;">
              A IA não encontrou informações sobre esta pergunta na base de conhecimento atual. 
              Considere adicionar conteúdo relevante na seção de <strong>Base de Conhecimento</strong> 
              do painel administrativo para melhorar as respostas futuras.
            </p>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/base-conhecimento" 
               style="background-color: #4a6cf7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              📚 Acessar Base de Conhecimento
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            Este é um email automático gerado pelo sistema de IA Jurídica.<br>
            Para configurar estas notificações, acesse as configurações do sistema.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(
        'Erro ao enviar email de solicitação de conhecimento:',
        error,
      );
      throw new Error(`Falha ao enviar email: ${error.message}`);
    }

    console.log(
      `Email de solicitação de conhecimento enviado com sucesso para: ${process.env.EMAIL_ADMIN}`,
    );
    return { success: true, data };
  } catch (error) {
    console.error(
      'Erro ao enviar email de solicitação de conhecimento:',
      error,
    );
    throw new Error('Falha ao enviar email de solicitação de conhecimento');
  }
}

/**
 * Função auxiliar para criar dados de solicitação de conhecimento
 * @param userQuestion Pergunta do usuário
 * @param additionalData Dados adicionais opcionais
 */
export function createKnowledgeRequest(
  userQuestion: string,
  additionalData?: {
    userEmail?: string;
    userId?: string;
    sessionId?: string;
  },
): KnowledgeRequestData {
  return {
    userQuestion: userQuestion.trim(),
    userEmail: additionalData?.userEmail,
    userId: additionalData?.userId,
    sessionId: additionalData?.sessionId,
    timestamp: new Date(),
  };
}
