import Form from 'next/form';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useState } from 'react';

export function FormularioRegistro({
  action,
  children,
  defaultEmail = '',
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
}) {
  const [whatsapp, setWhatsapp] = useState('');

  // Função para aplicar a máscara de telefone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Remove todos os caracteres não numéricos
    value = value.replace(/\D/g, '');

    // Aplica a máscara conforme o usuário digita
    if (value.length <= 11) {
      // Formato: (99) 99999-9999
      value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
      value = value.replace(/(\d)(\d{4})$/, '$1-$2');
    }

    setWhatsapp(value);
  };

  return (
    <Form action={action} className="flex flex-col gap-4 px-4 sm:px-16">
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="name"
          className="text-zinc-600 font-normal dark:text-zinc-400"
        >
          Nome completo
        </Label>

        <Input
          id="nome"
          name="nome"
          className="bg-muted text-md md:text-sm"
          type="text"
          placeholder="Digite seu nome completo"
          autoComplete="name"
          required
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="email"
          className="text-zinc-600 font-normal dark:text-zinc-400"
        >
          Email
        </Label>

        <Input
          id="email"
          name="email"
          className="bg-muted text-md md:text-sm"
          type="email"
          placeholder="usuario@email.com.br"
          autoComplete="email"
          required
          defaultValue={defaultEmail}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="whatsapp"
          className="text-zinc-600 font-normal dark:text-zinc-400"
        >
          WhatsApp
        </Label>

        <Input
          id="whatsapp"
          name="whatsapp"
          className="bg-muted text-md md:text-sm"
          type="tel"
          placeholder="(99) 99999-9999"
          autoComplete="tel"
          required
          value={whatsapp}
          onChange={handlePhoneChange}
          maxLength={15} // Limite para o formato (99) 99999-9999
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="atividade"
          className="text-zinc-600 font-normal dark:text-zinc-400"
        >
          Atividade
        </Label>

        <Select name="atividade" required>
          <SelectTrigger className="bg-muted text-md md:text-sm">
            <SelectValue placeholder="Selecione sua atividade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="professor">Professor</SelectItem>
            <SelectItem value="departamento Pessoal">
              Departamento Pessoal
            </SelectItem>
            <SelectItem value="estudante">Estudante</SelectItem>
            <SelectItem value="contador">Contador</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label
          htmlFor="senha"
          className="text-zinc-600 font-normal dark:text-zinc-400"
        >
          Senha
        </Label>

        <Input
          id="senha"
          name="senha"
          className="bg-muted text-md md:text-sm"
          type="senha"
          required
        />
      </div>

      {children}
    </Form>
  );
}
