// Frontend/src/pages/Onboarding.tsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api  from '../api/api'

const Onboarding: React.FC = () => {
  const navigate = useNavigate()

  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string|null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await api.post<{token:string}>(
        '/loyalty/register',
        { name, phone, email }
      )
      // stash the JWT and go to Services
      localStorage.setItem('token', res.data.token)
      navigate('/services')
    } catch (err: any) {
      console.error(err)
      // show detailed server error if present
      const msg = err.response?.data?.detail || err.message
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Welcome to BlueOrange Loyalty</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>Name</label><br/>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Phone</label><br/>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Email (optional)</label><br/>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        {error && (
          <div style={{ color: 'red', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Registering…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

export default Onboarding
