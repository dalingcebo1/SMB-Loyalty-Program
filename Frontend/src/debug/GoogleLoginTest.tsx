import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';

const GoogleLoginTest: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testGoogleLogin = async () => {
    setLoading(true);
    setResult('');
    
    // Store original window.open
    const originalOpen = window.open;
    
    try {
      console.log('Current URL:', window.location.href);
      console.log('Auth domain from config:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
      
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
      });
      provider.addScope('email');
      provider.addScope('profile');
      
      console.log('Attempting Google sign-in...');
      
      // Add listeners to detect popup events
      window.open = function(...args) {
        console.log('Popup opened with args:', args);
        const popup = originalOpen.apply(this, args);
        if (popup) {
          // Check if popup closes unexpectedly
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              console.log('Popup was closed');
              clearInterval(checkClosed);
            }
          }, 1000);
        }
        return popup;
      };
      
      const firebaseResult = await signInWithPopup(auth, provider);
      
      console.log('Firebase sign-in successful:', firebaseResult.user);
      const idToken = await firebaseResult.user.getIdToken();
      
      setResult(`✅ Success! Got ID token (length: ${idToken.length})`);
      
    } catch (error: unknown) {
      console.error('Google sign-in error:', error);
      
      let errorMessage = '';
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string; message: string };
        errorMessage = `Error Code: ${firebaseError.code}\nMessage: ${firebaseError.message}`;
        
        // Additional debugging for popup-closed-by-user
        if (firebaseError.code === 'auth/popup-closed-by-user') {
          errorMessage += '\n\n🔍 Debugging Info:\n- This usually means the popup was closed before authentication completed\n- Check browser console for popup open/close events\n- Verify all domains are authorized in Firebase Console';
        }
      } else if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      } else {
        errorMessage = `Error: ${String(error)}`;
      }
      
      setResult(`❌ Failed: ${errorMessage}`);
    } finally {
      // Always restore original window.open
      window.open = originalOpen;
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>Google OAuth Debug</h2>
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Current URL:</strong> {window.location.href}</p>
        <p><strong>Auth Domain:</strong> {import.meta.env.VITE_FIREBASE_AUTH_DOMAIN}</p>
        <p><strong>Project ID:</strong> {import.meta.env.VITE_FIREBASE_PROJECT_ID}</p>
      </div>
      
      <div style={{ 
        padding: '15px', 
        backgroundColor: '#fff3cd', 
        border: '1px solid #ffeaa7',
        borderRadius: '4px',
        marginBottom: '20px'
      }}>
        <h3>🔍 Diagnosis: Popup Auto-Closing</h3>
        <p>If the popup closes automatically without user action, you need to authorize these domains in Firebase Console:</p>
        <ul>
          <li>✅ Current app: <code>{window.location.hostname}</code></li>
          <li>❌ Firebase auth domain: <code>{import.meta.env.VITE_FIREBASE_AUTH_DOMAIN}</code></li>
        </ul>
        <p><strong>Action:</strong> Go to Firebase Console → Authentication → Authorized domains</p>
      </div>
      
      <button 
        onClick={testGoogleLogin} 
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
        {loading ? 'Testing Google Sign-In...' : 'Test Google Sign-In'}
      </button>
      
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

export default GoogleLoginTest;
