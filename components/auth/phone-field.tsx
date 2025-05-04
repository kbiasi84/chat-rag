import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type PhoneFieldProps = {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
  title?: string;
};

export function PhoneField({
  id,
  name,
  label,
  placeholder = '(99) 99999-9999',
  autoComplete = 'tel',
  required = false,
  className,
  labelClassName,
  inputClassName,
  title = 'WhatsApp deve estar no formato (99) 99999-9999',
}: PhoneFieldProps) {
  const [value, setValue] = useState('');

  // Função para aplicar a máscara de telefone a qualquer string
  const formatPhoneNumber = (input: string) => {
    // Remove todos os caracteres não numéricos
    let numericValue = input.replace(/\D/g, '');

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
    setValue(formattedValue);
  };

  // Detectar e corrigir preenchimento automático
  useEffect(() => {
    // Timer para verificar após o carregamento da página e possível autopreenchimento
    const timer = setTimeout(() => {
      const phoneInput = document.getElementById(id) as HTMLInputElement | null;

      if (phoneInput?.value && phoneInput.value !== value) {
        // O navegador preencheu automaticamente um valor diferente do estado
        const formattedValue = formatPhoneNumber(phoneInput.value);
        setValue(formattedValue);
      }
    }, 300); // tempo suficiente para o autopreenchimento ocorrer

    return () => clearTimeout(timer);
  }, [id, value]);

  return (
    <div className={cn('flex flex-col gap-1 w-full', className)}>
      <Label
        htmlFor={id}
        className={cn('text-dp-gray font-normal text-sm', labelClassName)}
      >
        {label}
      </Label>

      <input
        id={id}
        name={name}
        className={cn(
          'flex h-10 w-full rounded-md border border-dp-gray/20 bg-dp-black/70 px-3 py-2',
          'text-md md:text-sm text-dp-white',
          'placeholder:text-dp-gray/50',
          'focus:border-dp-orange focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          inputClassName,
        )}
        type="tel"
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={handlePhoneChange}
        onFocus={(e) => {
          // Se o valor não estiver no formato correto, limpar para forçar digitação manual
          if (
            e.target.value &&
            !e.target.value.match(/^\(\d{2}\) \d{5}-\d{4}$/)
          ) {
            const formattedValue = formatPhoneNumber(e.target.value);
            setValue(formattedValue);
          }
        }}
        maxLength={15} // Limite para o formato (99) 99999-9999
        title={title}
      />
    </div>
  );
}
