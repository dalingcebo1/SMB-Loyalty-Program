import { useAuth } from '../auth/AuthProvider';
import { Navigate } from 'react-router-dom';

export function RequireDeveloper({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading…</div>;
  if (!user || (user.role !== 'developer' && user.role !== 'superadmin')) {
    return <Navigate to="/" replace />;
  }
  return children;
}
