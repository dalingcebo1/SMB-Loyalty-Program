// src/components/form/Form.tsx
import React from 'react';
import { FormProvider, useForm, SubmitHandler, FieldValues, DefaultValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';

export interface FormProps<T extends FieldValues> {
  defaultValues: DefaultValues<T>;
  onSubmit: SubmitHandler<T>;
  children: React.ReactNode;
  className?: string;
  /** Optional Zod schema for validation */
  schema?: ZodType<any, any>;
}

export function Form<T extends FieldValues>({ defaultValues, onSubmit, children, className, schema }: FormProps<T>) {
  // Setup react-hook-form with optional Zod resolver
  const methods = useForm<T>({
    defaultValues: defaultValues as DefaultValues<T>,
    resolver: schema ? zodResolver(schema) : undefined,
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className={className}>
        {children}
      </form>
    </FormProvider>
  );
}
