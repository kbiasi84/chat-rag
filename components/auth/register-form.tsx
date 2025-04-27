import Form from 'next/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEffect, useState } from 'react';

type FormularioRegistroProps = {
  action: NonNullable<string | ((formData: FormData) => void | Promise<void>)>;
  children: React.ReactNode;
  defaultEmail?: string;
};

export function FormularioRegistro({
  action,
  children,
  defaultEmail = '',
}: FormularioRegistroProps) {
  const [whatsapp, setWhatsapp] = useState('');

  // Função para aplicar a máscara de telefone a qualquer string
  const formatPhoneNumber = (value: string) => {
    // Remove todos os caracteres não numéricos
    let numericValue = value.replace(/\D/g, '');

    // Limita a 11 dígitos (com DDD)
    if (numericValue.length > 11) {
      numericValue = numericValue.substring(0, 11);
    }

    // Aplica a máscara
    if (numericValue.length > 2) {
      numericValue = numericValue.replace(/^(\d{2})(\d)/g, '($1) $2');
    }
    if (numericValue.length > 7) {
      numericValue = numericValue.replace(/(\d)(\d{4})$/, '$1-$2');
    }

    return numericValue;
  };

  // Função para tratar mudanças no campo de telefone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedValue = formatPhoneNumber(e.target.value);
    setWhatsapp(formattedValue);
  };

  // Detectar e corrigir preenchimento automático
  useEffect(() => {
    // Timer para verificar após o carregamento da página e possível autopreenchimento
    const timer = setTimeout(() => {
      const whatsappInput = document.getElementById(
        'whatsapp',
      ) as HTMLInputElement | null;

      if (whatsappInput?.value && whatsappInput.value !== whatsapp) {
        // O navegador preencheu automaticamente um valor diferente do estado
        const formattedValue = formatPhoneNumber(whatsappInput.value);
        setWhatsapp(formattedValue);
      }
    }, 300); // tempo suficiente para o autopreenchimento ocorrer

    return () => clearTimeout(timer);
  }, [whatsapp]);

  return (
    <Form action={action} className="flex flex-col gap-4 px-4 sm:px-16">
      <div className="flex flex-col gap-2">
        <Label
          htmlFor="nome"
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
          minLength={2}
          title="Nome deve ter pelo menos 2 caracteres"
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
          title="Digite um email válido"
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
          onFocus={(e) => {
            // Se o valor não estiver no formato correto, limpar para forçar digitação manual
            if (
              e.target.value &&
              !e.target.value.match(/^\(\d{2}\) \d{5}-\d{4}$/)
            ) {
              const formattedValue = formatPhoneNumber(e.target.value);
              setWhatsapp(formattedValue);
            }
          }}
          maxLength={15} // Limite para o formato (99) 99999-9999
          title="WhatsApp deve estar no formato (99) 99999-9999"
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
          type="password"
          required
          minLength={6}
          title="A senha deve ter pelo menos 6 caracteres"
        />
      </div>

      {children}
    </Form>
  );
}
