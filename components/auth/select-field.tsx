import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Option = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  id: string;
  name: string;
  label: string;
  options: Option[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  labelClassName?: string;
  selectClassName?: string;
};

export function SelectField({
  id,
  name,
  label,
  options,
  placeholder = 'Selecione uma opção',
  required = false,
  className,
  labelClassName,
  selectClassName,
}: SelectFieldProps) {
  const [selectedValue, setSelectedValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn('flex flex-col gap-1 w-full', className)}>
      <Label
        htmlFor={id}
        className={cn('text-dp-gray font-normal text-sm', labelClassName)}
      >
        {label}
      </Label>

      <div className="relative">
        <button
          type="button"
          id={id}
          className={cn(
            'flex h-10 w-full rounded-md border border-dp-gray/20 bg-dp-black/70 px-3 py-2',
            'text-md md:text-sm text-left',
            'placeholder:text-dp-gray/50',
            'focus:border-dp-orange focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'justify-between items-center',
            selectedValue ? 'text-dp-white' : 'text-dp-gray/50',
            selectClassName,
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>
            {selectedValue
              ? options.find((opt) => opt.value === selectedValue)?.label
              : placeholder}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn('transition-transform', isOpen ? 'rotate-180' : '')}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-dp-black/95 border border-dp-gray/20 rounded-md py-1 shadow-lg">
            {options.map((option) => (
              <button
                type="button"
                key={option.value}
                className="w-full text-left px-3 py-2 hover:bg-dp-orange/10 cursor-pointer text-dp-white"
                onClick={() => {
                  setSelectedValue(option.value);
                  setIsOpen(false);

                  // Atualizar o valor oculto para o formulário
                  const hiddenInput = document.getElementById(
                    `${id}-hidden`,
                  ) as HTMLInputElement;
                  if (hiddenInput) {
                    hiddenInput.value = option.value;
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {/* Campo oculto para enviar o valor no formulário */}
        <input
          type="hidden"
          id={`${id}-hidden`}
          name={name}
          value={selectedValue}
          required={required}
        />
      </div>
    </div>
  );
}
