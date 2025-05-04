import { AuthForm } from './auth-form';
import { FormField } from './form-field';

type PasswordResetFormProps = {
  action: NonNullable<string | ((formData: FormData) => void | Promise<void>)>;
  children: React.ReactNode;
  token: string | null;
};

export function PasswordResetForm({
  action,
  children,
  token,
}: PasswordResetFormProps) {
  return (
    <AuthForm action={action} className="w-full">
      <input type="hidden" name="token" value={token || ''} />

      <FormField
        id="senha"
        name="senha"
        label="Nova Senha"
        type="password"
        placeholder="Digite sua nova senha"
        autoComplete="new-password"
        required
        autoFocus
        minLength={6}
        title="A senha deve ter pelo menos 6 caracteres"
        className="mb-4"
      />

      <FormField
        id="confirmarSenha"
        name="confirmarSenha"
        label="Confirmar Senha"
        type="password"
        placeholder="Confirme sua nova senha"
        autoComplete="new-password"
        required
        minLength={6}
        title="Digite a mesma senha novamente"
        className="mb-4"
      />

      {children}
    </AuthForm>
  );
}
