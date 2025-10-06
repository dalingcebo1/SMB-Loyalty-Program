// src/components/form/Form.tsx
import React from 'react';
import { FormProvider, useForm, SubmitHandler, FieldValues, DefaultValues, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';

export interface FormProps<T extends FieldValues> {
  defaultValues: DefaultValues<T>;
  onSubmit: SubmitHandler<T>;
  children: React.ReactNode;
  className?: string;
  /** Optional Zod schema for validation */
  schema?: ZodType<T>;
}

export function Form<T extends FieldValues>({ defaultValues, onSubmit, children, className, schema }: FormProps<T>) {
  // Setup react-hook-form with optional Zod resolver
  const resolver = schema ? (zodResolver(schema) as unknown as Resolver<T>) : undefined;
  const methods = useForm<T>({
    defaultValues,
    resolver,
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className={className}>
        {children}
      </form>
    </FormProvider>
  );
}
