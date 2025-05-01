// src/pages/Login.tsx
import { useAuth } from '../auth/AuthProvider';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const { loginWithGoogle } = useAuth();
  const nav = useNavigate();
  return (
    <div className="flex flex-col gap-4 max-w-xs mx-auto pt-20">
      <h1 className="text-3xl font-semibold text-center">Log In</h1>
      <button className="btn" onClick={() => loginWithGoogle().then(()=>nav('/rewards'))}>
        <svg className="h-5 w-5 mr-2" /* google icon */ /> Continue with Google
      </button>
      {/* Apple button here */}
      <div className="divider">Or</div>
      {/* email/password form here */}
      <p className="text-sm text-center">
        Don’t have an account? <a href="/signup" className="link">Sign up</a>
      </p>
    </div>
  );
};
export default Login;
