import { AuthForm } from './auth-form';
import { FormField } from './form-field';
import { PhoneField } from './phone-field';
import { SelectField } from './select-field';

type RegisterFormProps = {
  action: NonNullable<string | ((formData: FormData) => void | Promise<void>)>;
  children: React.ReactNode;
  defaultEmail?: string;
};

export function RegisterForm({
  action,
  children,
  defaultEmail = '',
}: RegisterFormProps) {
  const activityOptions = [
    { value: 'professor', label: 'Professor' },
    { value: 'departamento Pessoal', label: 'Departamento Pessoal' },
    { value: 'estudante', label: 'Estudante' },
    { value: 'contador', label: 'Contador' },
  ];

  return (
    <AuthForm action={action} className="w-full">
      <FormField
        id="nome"
        name="nome"
        label="Nome completo"
        placeholder="Digite seu nome completo"
        autoComplete="name"
        required
        autoFocus
        minLength={2}
        title="Nome deve ter pelo menos 2 caracteres"
        className="mb-4"
      />

      <FormField
        id="email"
        name="email"
        label="Email"
        type="email"
        placeholder="usuario@email.com.br"
        autoComplete="email"
        required
        defaultValue={defaultEmail}
        title="Digite um email válido"
        className="mb-4"
      />

      <PhoneField
        id="whatsapp"
        name="whatsapp"
        label="WhatsApp"
        required
        className="mb-4"
      />

      <SelectField
        id="atividade"
        name="atividade"
        label="Atividade"
        options={activityOptions}
        placeholder="Selecione sua atividade"
        required
        className="mb-4"
      />

      <FormField
        id="senha"
        name="senha"
        label="Senha"
        type="password"
        required
        minLength={6}
        title="A senha deve ter pelo menos 6 caracteres"
        className="mb-4"
      />

      {children}
    </AuthForm>
  );
}

// Keep the old component name for backward compatibility
export const FormularioRegistro = RegisterForm;
