// src/pages/AdminUserEdit.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/api';
import { toast } from 'react-toastify';
import PageLayout from '../components/PageLayout';

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
}

const AdminUserEdit: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [_user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', role: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    api.get<User>(`/users/${userId}`).then(res => {
      setUser(res.data);
      setForm(res.data);
    }).catch(() => {
      toast.error('Cannot load user');
      navigate('/admin/users');
    }).finally(() => setLoading(false));
  }, [userId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/users/${userId}`, form);
      toast.success('User updated');
      navigate('/admin/users');
    } catch {
      toast.error('Update failed');
    }
  };

  if (loading) return <PageLayout loading loadingText="Loading user…">{null}</PageLayout>;

  return (
    <PageLayout>
      <div className="max-w-lg mx-auto p-6 bg-white shadow rounded">
        <h1 className="text-xl font-bold mb-4">Edit User</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(['first_name','last_name','email','phone','role'] as const).map(key => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1 capitalize">{key.replace('_',' ')}</label>
              <input
                name={key}
                value={(form as any)[key]}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          ))}
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
          </div>
        </form>
      </div>
    </PageLayout>
  );
};

export default AdminUserEdit;
