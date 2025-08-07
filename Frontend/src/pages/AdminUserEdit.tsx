// src/pages/AdminUserEdit.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/api';
import { toast } from 'react-toastify';
import PageLayout from '../components/PageLayout';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
}

// Validation schema for user form
const userSchema = z.object({
  first_name: z.string().nonempty('First name is required'),
  last_name: z.string().nonempty('Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  role: z.string().nonempty('Role is required'),
});
type UserForm = z.infer<typeof userSchema>;

const AdminUserEdit: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
  });

  useEffect(() => {
    if (!userId) return;
    api.get<User>(`/users/${userId}`).then(res => {
      reset({
        first_name: res.data.first_name,
        last_name: res.data.last_name,
        email: res.data.email,
        phone: res.data.phone,
        role: res.data.role,
      });
    }).catch(() => {
      toast.error('Cannot load user');
      navigate('/admin/users');
    }).finally(() => setLoading(false));
  }, [userId]);

  // Form submission
  const onSubmit = handleSubmit(async data => {
    try {
      await api.patch(`/users/${userId}`, data);
      toast.success('User updated');
      navigate('/admin/users');
    } catch {
      toast.error('Update failed');
    }
  });


  if (loading) return <PageLayout loading loadingText="Loading user…">{null}</PageLayout>;

  return (
    <PageLayout>
      <div className="max-w-lg mx-auto p-6 bg-white shadow rounded">
        <h1 className="text-xl font-bold mb-4">Edit User</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">First Name</label>
            <input
              {...register('first_name')}
              className="w-full border px-3 py-2 rounded"
            />
            {errors.first_name && <p className="text-red-600 text-sm">{errors.first_name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Last Name</label>
            <input
              {...register('last_name')}
              className="w-full border px-3 py-2 rounded"
            />
            {errors.last_name && <p className="text-red-600 text-sm">{errors.last_name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              {...register('email')}
              className="w-full border px-3 py-2 rounded"
            />
            {errors.email && <p className="text-red-600 text-sm">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              {...register('phone')}
              className="w-full border px-3 py-2 rounded"
            />
            {errors.phone && <p className="text-red-600 text-sm">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <input
              {...register('role')}
              className="w-full border px-3 py-2 rounded"
            />
            {errors.role && <p className="text-red-600 text-sm">{errors.role.message}</p>}
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded">
              Save
            </button>
          </div>
        </form>
      </div>
    </PageLayout>
  );
};

export default AdminUserEdit;
