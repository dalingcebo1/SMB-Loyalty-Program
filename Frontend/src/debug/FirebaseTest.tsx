import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const FirebaseTest: React.FC = () => {
  const [firebaseStatus, setFirebaseStatus] = useState<string>('Checking...');
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    // Test Firebase initialization
    try {
      if (auth) {
        setFirebaseStatus('✅ Firebase Auth initialized successfully');
        console.log('Firebase Auth:', auth);
        console.log('Firebase Config:', {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.substring(0, 10) + '...',
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        });
      } else {
        setFirebaseStatus('❌ Firebase Auth failed to initialize');
      }
    } catch (error) {
      setFirebaseStatus(`❌ Firebase Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const testGoogleSignIn = async () => {
    try {
      setTestResult('Testing Google Sign-In...');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      setTestResult(`✅ Google Sign-In successful! Token length: ${idToken.length}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = (error as { code?: string })?.code || 'unknown';
      setTestResult(`❌ Google Sign-In failed: ${errorCode} - ${errorMessage}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>Firebase Debug Test</h2>
      <div style={{ marginBottom: '10px' }}>
        <strong>Firebase Status:</strong> {firebaseStatus}
      </div>
      
      <h3>Environment Variables:</h3>
      <ul>
        <li>VITE_FIREBASE_API_KEY: {import.meta.env.VITE_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing'}</li>
        <li>VITE_FIREBASE_AUTH_DOMAIN: {import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '❌ Missing'}</li>
        <li>VITE_FIREBASE_PROJECT_ID: {import.meta.env.VITE_FIREBASE_PROJECT_ID || '❌ Missing'}</li>
      </ul>

      <button 
        onClick={testGoogleSignIn}
        style={{ 
          padding: '10px 20px', 
          backgroundColor: '#4285f4', 
          color: 'white', 
          border: 'none', 
          cursor: 'pointer',
          marginTop: '10px'
        }}
      >
        Test Google Sign-In
      </button>

      {testResult && (
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0' }}>
          <strong>Test Result:</strong> {testResult}
        </div>
      )}
    </div>
  );
};

export default FirebaseTest;
