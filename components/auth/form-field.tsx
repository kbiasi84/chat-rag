import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FormFieldProps = {
  id: string;
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  autoFocus?: boolean;
  defaultValue?: string;
  minLength?: number;
  title?: string;
  className?: string;
  disabled?: boolean;
  labelClassName?: string;
  inputClassName?: string;
  children?: React.ReactNode;
};

export function FormField({
  id,
  name,
  label,
  type = 'text',
  placeholder,
  autoComplete,
  required = false,
  autoFocus = false,
  defaultValue,
  minLength,
  title,
  className,
  disabled = false,
  labelClassName,
  inputClassName,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1 w-full', className)}>
      <Label
        htmlFor={id}
        className={cn('text-dp-gray font-normal text-sm', labelClassName)}
      >
        {label}
      </Label>

      {children || (
        <input
          id={id}
          name={name}
          className={cn(
            'flex h-10 w-full rounded-md border border-dp-gray/20 bg-dp-black/70 px-3 py-2',
            'text-md md:text-sm text-dp-white',
            'placeholder:text-dp-gray/50',
            'focus:border-dp-orange focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            type === 'password' && 'text-dp-white',
            inputClassName,
          )}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          autoFocus={autoFocus}
          defaultValue={defaultValue}
          minLength={minLength}
          title={title}
          disabled={disabled}
        />
      )}
    </div>
  );
}
