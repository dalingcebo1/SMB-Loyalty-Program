// src/schemas/admin.ts
import * as z from 'zod';

/** Tenant form validation schema */
export const tenantSchema = z.object({
  id: z.string().optional(), // optional on edit
  name: z.string().nonempty('Name is required'),
  loyalty_type: z.string().nonempty('Loyalty type is required'),
  vertical_type: z.string().optional(),
  primary_domain: z.string().optional(),
  logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  theme_color: z.string().optional(),
  config: z.string().optional().refine((val) => {
    if (!val) return true;
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid JSON format'),
});

export type TenantForm = z.infer<typeof tenantSchema>;

/** User form validation schema */
export const userSchema = z.object({
  first_name: z.string().nonempty('First name is required'),
  last_name: z.string().nonempty('Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  role: z.string().nonempty('Role is required'),
});

export type UserForm = z.infer<typeof userSchema>;
