import { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useSearchParams, useNavigate } from 'react-router-dom';
import SplashScreen from '../components/SplashScreen';

const AutoLogin: React.FC = () => {
  const { loginWithToken } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      loginWithToken(token)
        .then(() => navigate('/', { replace: true }))
        .catch(() => navigate('/login', { replace: true }));
    } else {
      navigate('/login', { replace: true });
    }
  }, [loginWithToken, navigate, searchParams]);

  return <SplashScreen />;
};

export default AutoLogin;
