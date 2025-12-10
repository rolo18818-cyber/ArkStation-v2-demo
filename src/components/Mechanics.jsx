import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Mechanics({ theme: t }) {
  const [mechanics, setMechanics] = useState([])
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingMechanic, setEditingMechanic] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    user_id: '',
    hourly_rate: 65,
    daily_hours_goal: 8,
    active: true,
    specializations: '',
    phone: '',
    email: ''
  })

  useEffect(() => {
    loadMechanics()
    loadUsers()
  }, [])

  const loadMechanics = async () => {
    const { data } = await supabase.from('mechanics').select('*').order('name')
    if (data) setMechanics(data)
  }

  const loadUsers = async () => {
    const { data } = await supabase.from('users').select('id, first_name, last_name, role').order('first_name')
    if (data) setUsers(data)
  }

  const getMechanicName = (mechanic) => {
    if (!mechanic) return 'Unknown'
    if (mechanic.name) return mechanic.name
    if (mechanic.first_name) return `${mechanic.first_name} ${mechanic.last_name || ''}`.trim()
    return 'Unnamed'
  }

  const getLinkedUser = (userId) => users.find(u => u.id === userId)

  const openNewForm = () => {
    setEditingMechanic(null)
    setFormData({ name: '', user_id: '', hourly_rate: 65, daily_hours_goal: 8, active: true, specializations: '', phone: '', email: '' })
    setShowForm(true)
  }

  const openEditForm = (mechanic) => {
    setEditingMechanic(mechanic)
    setFormData({
      name: getMechanicName(mechanic),
      user_id: mechanic.user_id || '',
      hourly_rate: mechanic.hourly_rate || 65,
      daily_hours_goal: mechanic.daily_hours_goal || 8,
      active: mechanic.active ?? true,
      specializations: mechanic.specializations || '',
      phone: mechanic.phone || '',
      email: mechanic.email || ''
    })
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const saveData = {
      name: formData.name,
      user_id: formData.user_id || null,
      hourly_rate: parseFloat(formData.hourly_rate) || 65,
      daily_hours_goal: parseFloat(formData.daily_hours_goal) || 8,
      active: formData.active,
      specializations: formData.specializations,
      phone: formData.phone,
      email: formData.email
    }

    if (editingMechanic) {
      await supabase.from('mechanics').update(saveData).eq('id', editingMechanic.id)
    } else {
      await supabase.from('mechanics').insert([saveData])
    }

    setShowForm(false)
    loadMechanics()
  }

  const deleteMechanic = async (id) => {
    if (!confirm('Delete this mechanic?')) return
    // Unassign any work orders first
    await supabase.from('work_orders').update({ assigned_mechanic_id: null }).eq('assigned_mechanic_id', id)
    await supabase.from('mechanics').delete().eq('id', id)
    loadMechanics()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className={`text-3xl font-bold ${t.text}`}>🔧 Mechanics</h2>
          <p className={t.textSecondary}>Manage workshop mechanics</p>
        </div>
        <button onClick={openNewForm} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
          + Add Mechanic
        </button>
      </div>

      {/* Mechanics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mechanics.map(mechanic => {
          const linkedUser = getLinkedUser(mechanic.user_id)
          return (
            <div key={mechanic.id} className={`${t.surface} rounded-xl ${t.border} border overflow-hidden ${!mechanic.active ? 'opacity-50' : ''}`}>
              {/* Header */}
              <div className={`p-4 ${mechanic.active ? 'bg-green-600' : 'bg-gray-600'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-bold text-lg">{getMechanicName(mechanic)}</h3>
                    {linkedUser ? (
                      <div className="text-white/80 text-sm">✓ Linked to {linkedUser.first_name}</div>
                    ) : (
                      <div className="text-yellow-300 text-sm">⚠️ Not linked to user</div>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${mechanic.active ? 'bg-white/20 text-white' : 'bg-gray-500 text-white'}`}>
                    {mechanic.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="p-4 space-y-2">
                <div className="flex justify-between">
                  <span className={t.textSecondary}>Hourly Rate</span>
                  <span className={`font-bold ${t.text}`}>${mechanic.hourly_rate || 65}/hr</span>
                </div>
                <div className="flex justify-between">
                  <span className={t.textSecondary}>Daily Goal</span>
                  <span className={`font-bold ${t.text}`}>{mechanic.daily_hours_goal || 8}h</span>
                </div>
                {mechanic.phone && (
                  <div className="flex justify-between">
                    <span className={t.textSecondary}>Phone</span>
                    <span className={t.text}>{mechanic.phone}</span>
                  </div>
                )}
                {mechanic.specializations && (
                  <div className={`text-sm ${t.textSecondary} pt-2 border-t ${t.border}`}>
                    🔧 {mechanic.specializations}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className={`p-3 ${t.border} border-t flex gap-2`}>
                <button onClick={() => openEditForm(mechanic)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium">
                  Edit
                </button>
                <button onClick={() => deleteMechanic(mechanic.id)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm">
                  🗑️
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {mechanics.length === 0 && (
        <div className={`${t.surface} rounded-lg ${t.border} border p-12 text-center`}>
          <div className="text-4xl mb-2">🔧</div>
          <div className={t.text}>No mechanics yet</div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-xl shadow-2xl w-full max-w-md ${t.border} border`}>
            <div className={`p-4 ${t.border} border-b flex justify-between items-center`}>
              <h3 className={`text-xl font-bold ${t.text}`}>{editingMechanic ? 'Edit Mechanic' : 'Add Mechanic'}</h3>
              <button onClick={() => setShowForm(false)} className="text-red-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Name *</label>
                <input type="text" required value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Link to User Account</label>
                <select value={formData.user_id}
                  onChange={(e) => setFormData({...formData, user_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}>
                  <option value="">-- Not Linked --</option>
                  {users.filter(u => u.role === 'mechanic' || !mechanics.some(m => m.user_id === u.id && m.id !== editingMechanic?.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.role})</option>
                  ))}
                </select>
                <p className={`text-xs ${t.textSecondary} mt-1`}>Links this mechanic to a user for "My Jobs"</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Hourly Rate ($)</label>
                  <input type="number" step="1" value={formData.hourly_rate}
                    onChange={(e) => setFormData({...formData, hourly_rate: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Daily Hours Goal</label>
                  <input type="number" step="0.5" value={formData.daily_hours_goal}
                    onChange={(e) => setFormData({...formData, daily_hours_goal: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Specializations</label>
                <input type="text" value={formData.specializations}
                  onChange={(e) => setFormData({...formData, specializations: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  placeholder="e.g., Ducati, Harley" />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={formData.active}
                  onChange={(e) => setFormData({...formData, active: e.target.checked})}
                  className="w-5 h-5" />
                <label htmlFor="active" className={t.text}>Active</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)}
                  className={`flex-1 ${t.surface} ${t.text} ${t.border} border py-2 rounded-lg`}>Cancel</button>
                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold">
                  {editingMechanic ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
