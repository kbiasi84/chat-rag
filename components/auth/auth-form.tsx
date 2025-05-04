import Form from 'next/form';
import React from 'react';
import { cn } from '@/lib/utils';

type AuthFormProps = {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  className?: string;
};

export function AuthForm({ action, children, className }: AuthFormProps) {
  return (
    <Form
      action={action}
      className={cn('flex flex-col w-full max-w-xs mx-auto', className)}
    >
      {children}
    </Form>
  );
}
