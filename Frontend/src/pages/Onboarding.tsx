import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Onboarding: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async () => {
    setLoading(true);
    const { data } = await axios.post(
      'http://localhost:8000/loyalty/register',
      { name, phone, email }
    );
    localStorage.setItem('loyalty_token', data.token);
    nav('/loyalty');
  };

  const valid = name && phone;

  return (
    <div style={{ padding: 20 }}>
      <h1>Welcome to BlueOrange Loyalty</h1>
      <p>Please enter your details to get started.</p>
      <input
        placeholder="Name"
        value={name}
        onChange={e => setName(e.target.value)}
      /><br/>
      <input
        placeholder="Phone"
        value={phone}
        onChange={e => setPhone(e.target.value)}
      /><br/>
      <input
        placeholder="Email (optional)"
        value={email}
        onChange={e => setEmail(e.target.value)}
      /><br/>
      <button disabled={!valid || loading} onClick={submit}>
        {loading ? 'Registering…' : 'Continue'}
      </button>
    </div>
  );
};

export default Onboarding;
