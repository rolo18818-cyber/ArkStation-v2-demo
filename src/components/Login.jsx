import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login({ onLogin, theme: t }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // In production, you'd properly hash/verify passwords
      // For now, we'll do a simple check
      const { data: user, error: loginError } = await supabase
        .from('shop_users')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('is_active', true)
        .single()

      if (loginError || !user) {
        setError('Invalid email or password')
        setLoading(false)
        return
      }

      // TODO: Properly verify password hash in production
      // For demo purposes, accepting any password for now
      
      // Update last login
      await supabase
        .from('shop_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id)

      // Log activity
      await supabase
        .from('activity_log')
        .insert([{
          user_id: user.id,
          action: 'login',
          entity_type: 'auth',
          details: { email: user.email }
        }])

      // Store in localStorage
      localStorage.setItem('arkstation_user', JSON.stringify(user))
      
      onLogin(user)
    } catch (err) {
      console.error('Login error:', err)
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen ${t.bg} flex items-center justify-center px-4`}>
      <div className={`${t.surface} rounded-lg shadow-2xl p-8 w-full max-w-md ${t.border} border-2`}>
        <div className="text-center mb-8">
          <h1 className={`text-4xl font-bold ${t.text} mb-2`}>🏔️ Ark Station</h1>
          <p className={`${t.textSecondary}`}>Workshop Management System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${t.text} mb-1`}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-3 ${t.input} rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="admin@arkstation.com"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${t.text} mb-1`}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 ${t.input} rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="bg-red-500 text-white p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${
              loading
                ? 'bg-gray-500 cursor-not-allowed'
                : `${t.primary} ${t.primaryHover} ${t.primaryText}`
            }`}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className={`mt-6 text-center text-sm ${t.textSecondary}`}>
          <p className="mb-2">Demo Accounts:</p>
          <p>Owner: admin@arkstation.com</p>
          <p>Mechanic: mechanic@arkstation.com</p>
          <p>Parts: parts@arkstation.com</p>
        </div>
      </div>
    </div>
  )
}