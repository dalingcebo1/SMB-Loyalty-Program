import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../auth/AuthProvider';

const GoogleRedirectTest: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { socialLogin } = useAuth();

  const testGoogleRedirect = async () => {
    setLoading(true);
    setResult('Redirecting to Google...');
    
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
      });
      provider.addScope('email');
      provider.addScope('profile');
      
      console.log('Starting redirect to Google...');
      await signInWithRedirect(auth, provider);
      
    } catch (error: unknown) {
      console.error('Google redirect error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setResult(`❌ Redirect failed: ${errorMessage}`);
      setLoading(false);
    }
  };

  const checkRedirectResult = async () => {
    setLoading(true);
    try {
      console.log('Checking for redirect result...');
      const result = await getRedirectResult(auth);
      
      if (result) {
        console.log('Redirect result found:', result.user.email);
        const idToken = await result.user.getIdToken();
        setResult(`✅ Redirect Success! Email: ${result.user.email}, Token length: ${idToken.length}`);
      } else {
        setResult('No redirect result found. Try the redirect first.');
      }
    } catch (error: unknown) {
      console.error('Redirect result error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setResult(`❌ Redirect result failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const testFullSocialLogin = async () => {
    setLoading(true);
    try {
      // Initiate full social login (redirect); no user object returned
      await socialLogin();
      setResult('✅ Full social login initiated; redirecting...');
    } catch (error: unknown) {
      console.error('Full social login error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setResult(`❌ Full social login failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>Google OAuth Redirect Test</h2>
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Current URL:</strong> {window.location.href}</p>
        <p><strong>Auth Domain:</strong> {import.meta.env.VITE_FIREBASE_AUTH_DOMAIN}</p>
      </div>
      
      <div style={{ 
        padding: '15px', 
        backgroundColor: '#e7f3ff', 
        border: '1px solid #b3d7ff',
        borderRadius: '4px',
        marginBottom: '20px'
      }}>
        <h3>🔄 Alternative: Redirect Method</h3>
        <p>Instead of popups (which can be blocked), this uses redirects which are more reliable in codespace environments.</p>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button 
          onClick={testGoogleRedirect} 
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Redirecting...' : 'Test Google Redirect'}
        </button>
        
        <button 
          onClick={checkRedirectResult} 
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#34a853',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Check Redirect Result
        </button>
        
        <button 
          onClick={testFullSocialLogin} 
          disabled={loading}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#ea4335',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Test Full Social Login (Popup)
        </button>
      </div>
      
      {result && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: result.includes('✅') ? '#d4edda' : '#f8d7da',
          border: `1px solid ${result.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
          whiteSpace: 'pre-wrap'
        }}>
          {result}
        </div>
      )}
    </div>
  );
};

export default GoogleRedirectTest;
