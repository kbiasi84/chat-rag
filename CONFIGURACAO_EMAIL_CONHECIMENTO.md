# Configuração de Email para Solicitações de Conhecimento

## Visão Geral

Esta funcionalidade envia automaticamente um email para o administrador sempre que a IA responde que não possui conhecimento específico sobre uma pergunta do usuário.

## Configuração

### 1. Variáveis de Ambiente

Adicione a seguinte variável ao seu arquivo `.env`:

```env
# Email do administrador que receberá as notificações
EMAIL_ADMIN=seu-email-admin@exemplo.com
```

### 2. Variáveis Existentes Necessárias

Certifique-se de que as seguintes variáveis já estão configuradas:

```env
# Chave da API do Resend
RESEND_API_KEY=sua_chave_resend

# Email remetente (deve ser verificado no Resend)
EMAIL_FROM=noreply@seudominio.com

# URL da aplicação
NEXT_PUBLIC_APP_URL=https://seudominio.com
```

## Como Funciona

1. **Detecção Automática**: Quando a IA responde com a mensagem "Ainda não fui treinada com esse conhecimento específico para suporte", o sistema detecta automaticamente.

2. **Coleta de Dados**: O sistema coleta:

   - Pergunta do usuário
   - Email do usuário (se disponível)
   - ID do usuário
   - ID da sessão/chat
   - Data e hora da solicitação

3. **Envio de Email**: Um email detalhado é enviado para o administrador com:
   - Pergunta completa do usuário
   - Informações do usuário
   - Link direto para a base de conhecimento
   - Formatação profissional com destaque visual

## Exemplo de Email Recebido

O administrador receberá um email com:

- **Assunto**: "Solicitação de Inclusão na Base de Conhecimento - IA Jurídica"
- **Conteúdo**: Pergunta do usuário destacada, informações da sessão, e botão para acessar a base de conhecimento
- **Design**: Email responsivo e profissional com cores e ícones

## Benefícios

- **Melhoria Contínua**: Identifica lacunas na base de conhecimento
- **Resposta Rápida**: Permite adicionar conteúdo relevante rapidamente
- **Rastreamento**: Mantém histórico de perguntas não respondidas
- **Automação**: Processo completamente automatizado

## Tratamento de Erros

- Se `EMAIL_ADMIN` não estiver configurado, apenas um aviso será logado
- Erros de envio são logados mas não interrompem o funcionamento do chat
- O envio é feito de forma assíncrona para não afetar a performance

## Segurança

- Emails são enviados apenas para o endereço configurado em `EMAIL_ADMIN`
- Informações sensíveis do usuário são limitadas ao necessário
- Logs de erro não expõem dados pessoais

## Monitoramento

Para monitorar o funcionamento:

1. Verifique os logs do servidor para mensagens como:

   ```
   Email de solicitação de conhecimento enviado para pergunta: [pergunta]...
   ```

2. Em caso de erro:
   ```
   Erro ao enviar email de solicitação de conhecimento: [erro]
   ```

## Personalização

Para personalizar o template do email, edite o arquivo `lib/email-incluir-base.ts` na função `sendKnowledgeInclusionRequest`.
