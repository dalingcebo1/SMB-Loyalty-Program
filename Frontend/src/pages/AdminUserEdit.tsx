// src/pages/AdminUserEdit.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/api';
import { toast } from 'react-toastify';
import PageLayout from '../components/PageLayout';
import TextField from '../components/ui/TextField';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userSchema, UserForm } from '../schemas/admin';


// API user shape
interface ApiUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
}

const AdminUserEdit: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
  });

  useEffect(() => {
    if (!userId) return;
    api.get<ApiUser>(`/users/${userId}`)
      .then(res => {
        reset({
          first_name: res.data.first_name,
          last_name: res.data.last_name,
          email: res.data.email,
          phone: res.data.phone,
          role: res.data.role,
        });
      })
      .catch(() => {
        toast.error('Cannot load user');
        navigate('/admin/users');
      })
      .finally(() => setLoading(false));
  }, [userId, reset, navigate]);

  // Form submission
  const onSubmit = handleSubmit(async data => {
    try {
      await api.patch<ApiUser>(`/users/${userId}`, data);
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
          <TextField
            label="First Name"
            {...register('first_name')}
            error={errors.first_name?.message}
          />
          <TextField
            label="Last Name"
            {...register('last_name')}
            error={errors.last_name?.message}
          />
          <TextField
            label="Email"
            {...register('email')}
            error={errors.email?.message}
          />
          <TextField
            label="Phone"
            {...register('phone')}
            error={errors.phone?.message}
          />
          <TextField
            label="Role"
            {...register('role')}
            error={errors.role?.message}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </PageLayout>
  );
};

export default AdminUserEdit;
