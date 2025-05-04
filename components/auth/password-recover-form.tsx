import { AuthForm } from './auth-form';
import { FormField } from './form-field';

type PasswordRecoverFormProps = {
  action: NonNullable<string | ((formData: FormData) => void | Promise<void>)>;
  children: React.ReactNode;
  defaultEmail?: string;
};

export function PasswordRecoverForm({
  action,
  children,
  defaultEmail = '',
}: PasswordRecoverFormProps) {
  return (
    <AuthForm action={action} className="w-full">
      <FormField
        id="email"
        name="email"
        label="Email"
        type="email"
        placeholder="usuario@email.com.br"
        autoComplete="email"
        required
        autoFocus
        defaultValue={defaultEmail}
        title="Digite o email associado à sua conta"
        className="mb-4"
      />

      {children}
    </AuthForm>
  );
}
