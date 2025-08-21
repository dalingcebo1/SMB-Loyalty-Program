// src/components/form/Form.tsx
import React from 'react';
import { FormProvider, useForm, SubmitHandler, FieldValues, DefaultValues } from 'react-hook-form';

export interface FormProps<T extends FieldValues> {
  defaultValues: DefaultValues<T>;
  onSubmit: SubmitHandler<T>;
  children: React.ReactNode;
  className?: string;
}

export function Form<T extends FieldValues>({ defaultValues, onSubmit, children, className }: FormProps<T>) {
  // Casting defaultValues to satisfy react-hook-form types
  const methods = useForm<T>({ defaultValues: defaultValues as DefaultValues<T> });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className={className}>
        {children}
      </form>
    </FormProvider>
  );
}
