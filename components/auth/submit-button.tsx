'use client';

import { useFormStatus } from 'react-dom';

import { Loader } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function SubmitButton({
  children,
  isSuccessful,
  className,
}: {
  children: React.ReactNode;
  isSuccessful: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type={pending ? 'button' : 'submit'}
      aria-disabled={pending || isSuccessful}
      disabled={pending || isSuccessful}
      className={cn(
        'relative flex justify-center bg-dp-orange hover:bg-dp-orange/90 text-dp-white transition-colors',
        pending || isSuccessful ? 'opacity-80' : '',
        className,
      )}
    >
      {children}

      {(pending || isSuccessful) && (
        <span className="animate-spin absolute right-4">
          <Loader size={16} />
        </span>
      )}

      <output aria-live="polite" className="sr-only">
        {pending || isSuccessful ? 'Carregando' : 'Submit form'}
      </output>
    </Button>
  );
}
