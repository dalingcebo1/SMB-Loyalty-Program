import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, getRedirectResult } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../auth/AuthProvider';

const GoogleLoginDebug: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { socialLogin } = useAuth();

  const addDebug = (message: string) => {
    console.log(message);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    const checkRedirectOnMount = async () => {
      try {
        addDebug('🔍 Checking for redirect result...');
        const result = await getRedirectResult(auth);
        if (result) {
          addDebug(`✅ Redirect result found! User: ${result.user.email}`);
          const token = await result.user.getIdToken();
          addDebug(`🎫 ID Token length: ${token.length}`);
          // Here you would normally call your backend
          addDebug('🚨 Would now call backend /auth/social-login endpoint');
        } else {
          addDebug('ℹ️ No redirect result found');
        }
      } catch (error) {
        addDebug(`❌ Redirect result error: ${error}`);
      }
    };

    addDebug('🔍 Component mounted, checking environment variables...');
    addDebug(`🔧 API Key: ${import.meta.env.VITE_FIREBASE_API_KEY ? 'Set' : 'Missing'}`);
    addDebug(`🔧 Auth Domain: ${import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'Missing'}`);
    addDebug(`🔧 Project ID: ${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'Missing'}`);
    addDebug(`🔧 Current URL: ${window.location.href}`);
    
    // Check for redirect result on mount
    checkRedirectOnMount();
  }, []);

  const testPopupLogin = async () => {
    setLoading(true);
    try {
      addDebug('🚀 Starting popup Google login...');
      
      // Test basic popup functionality first
      addDebug('🔍 Testing basic popup functionality...');
      const testPopup = window.open('', '_blank', 'width=500,height=600,scrollbars=yes,resizable=yes');
      if (testPopup) {
        addDebug('✅ Basic popup works - closing test popup');
        testPopup.close();
      } else {
        addDebug('❌ Popup blocked by browser - please allow popups for this site');
        setLoading(false);
        return;
      }
      
      addDebug('🔧 Configuring Google Auth Provider...');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      provider.addScope('email');
      provider.addScope('profile');
      
      addDebug('🔄 Attempting signInWithPopup...');
      const result = await signInWithPopup(auth, provider);
      addDebug(`✅ Popup login successful! User: ${result.user.email}`);
      
      const token = await result.user.getIdToken();
      addDebug(`🎫 ID Token received, length: ${token.length}`);
      
      // Test the backend call
      addDebug('🔄 Testing backend social-login endpoint...');
      const response = await fetch('/api/auth/social-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_token: token
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        addDebug(`✅ Backend response successful!`);
        addDebug(`📋 Response: ${JSON.stringify(data, null, 2)}`);
      } else {
        const errorText = await response.text();
        addDebug(`❌ Backend error: ${response.status} - ${errorText}`);
      }
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: string })?.code || 'unknown';
      addDebug(`❌ Popup login failed: ${errorCode} - ${errorMessage}`);
      
      // Additional debugging for common Firebase errors
      if (errorCode === 'auth/popup-blocked') {
        addDebug('🚨 SOLUTION: Allow popups for this site in your browser settings');
      } else if (errorCode === 'auth/popup-closed-by-user') {
        addDebug('🚨 SOLUTION: Complete the authentication in the popup window');
      } else if (errorCode === 'auth/unauthorized-domain') {
        addDebug('🚨 SOLUTION: Add this domain to Firebase Console → Authentication → Settings → Authorized domains');
      }
    } finally {
      setLoading(false);
    }
  };

  const testRedirectLogin = async () => {
    try {
      addDebug('🔄 Starting redirect Google login...');
      await socialLogin(); // Use existing method
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addDebug(`❌ Redirect login failed: ${errorMessage}`);
    }
  };

  const clearDebug = () => setDebugInfo([]);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🔧 Google Login Debug Tool</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={testPopupLogin} 
          disabled={loading}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            backgroundColor: '#4285f4', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Testing...' : 'Test Popup Login'}
        </button>
        
        <button 
          onClick={testRedirectLogin}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            backgroundColor: '#db4437', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Redirect Login
        </button>
        
        <button 
          onClick={clearDebug}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#666', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear Debug
        </button>
      </div>

      <div style={{ 
        backgroundColor: '#fff3cd', 
        padding: '15px', 
        border: '1px solid #ffeaa7',
        borderRadius: '4px',
        marginBottom: '20px'
      }}>
        <h3>🚨 Common Issues & Solutions:</h3>
        <ul style={{ margin: '0', paddingLeft: '20px' }}>
          <li><strong>Popup Blocked:</strong> Check browser address bar for popup blocker icon and allow popups</li>
          <li><strong>Nothing happens:</strong> Open browser console (F12) and check for errors</li>
          <li><strong>Domain not authorized:</strong> Add current domain to Firebase Console</li>
          <li><strong>Firebase config:</strong> Check environment variables are loaded correctly</li>
        </ul>
      </div>

      <div style={{ 
        backgroundColor: '#f5f5f5', 
        padding: '15px', 
        borderRadius: '4px',
        border: '1px solid #ddd',
        maxHeight: '500px',
        overflowY: 'auto'
      }}>
        <h3>Debug Log:</h3>
        {debugInfo.length === 0 ? (
          <p>No debug information yet...</p>
        ) : (
          debugInfo.map((info, index) => (
            <div key={index} style={{ marginBottom: '5px', fontSize: '12px' }}>
              {info}
            </div>
          ))
        )}
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '14px' }}>
        <h3>Instructions:</h3>
        <ul>
          <li><strong>Popup Login:</strong> Tests Google OAuth with popup (works in development)</li>
          <li><strong>Redirect Login:</strong> Tests Google OAuth with redirect (production-ready)</li>
          <li>Check console and network tabs for additional debugging info</li>
          <li>Ensure Firebase project has correct authorized domains configured</li>
        </ul>
      </div>
    </div>
  );
};

export default GoogleLoginDebug;
