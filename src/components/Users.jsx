import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Users({ theme: t }) {
  const [users, setUsers] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'staff',
    active: true
  })

  const roles = [
    { value: 'owner', label: 'Owner', color: 'bg-purple-500' },
    { value: 'admin', label: 'Admin', color: 'bg-red-500' },
    { value: 'manager', label: 'Manager', color: 'bg-orange-500' },
    { value: 'mechanic', label: 'Mechanic', color: 'bg-blue-500' },
    { value: 'sales', label: 'Sales', color: 'bg-green-500' },
    { value: 'staff', label: 'Staff', color: 'bg-gray-500' }
  ]

  useEffect(() => {
    loadUsers()
    loadMechanics()
  }, [])

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('first_name')
    
    console.log('Users:', data, error)
    if (data) setUsers(data)
  }

  const loadMechanics = async () => {
    const { data } = await supabase
      .from('mechanics')
      .select('id, name, user_id')
    if (data) setMechanics(data)
  }

  const getLinkedMechanic = (userId) => {
    return mechanics.find(m => m.user_id === userId)
  }

  const getRoleBadge = (role) => {
    const r = roles.find(ro => ro.value === role) || roles[5]
    return <span className={`${r.color} text-white text-xs px-2 py-1 rounded-full`}>{r.label}</span>
  }

  const openNewForm = () => {
    setEditingUser(null)
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      role: 'staff',
      active: true
    })
    setShowForm(true)
  }

  const openEditForm = (user) => {
    setEditingUser(user)
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'staff',
      active: user.active ?? true
    })
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    let userId = editingUser?.id

    if (editingUser) {
      const { error } = await supabase
        .from('users')
        .update(formData)
        .eq('id', editingUser.id)
      if (error) {
        console.error('Update error:', error)
        alert('Error updating user: ' + error.message)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('users')
        .insert([formData])
        .select()
        .single()
      if (error) {
        console.error('Insert error:', error)
        alert('Error creating user: ' + error.message)
        return
      }
      userId = data.id
    }

    // AUTO-LINK: If role is mechanic, automatically create/link mechanic record
    if (formData.role === 'mechanic' && userId) {
      const fullName = `${formData.first_name} ${formData.last_name}`.trim()
      
      // Check if mechanic already exists
      const existingMechanic = mechanics.find(m => m.user_id === userId)
      
      if (!existingMechanic) {
        // Check by name
        const nameMatch = mechanics.find(m => 
          m.name?.toLowerCase() === fullName.toLowerCase()
        )
        
        if (nameMatch) {
          // Link existing mechanic to this user
          await supabase.from('mechanics').update({ user_id: userId }).eq('id', nameMatch.id)
        } else {
          // Create new mechanic
          await supabase.from('mechanics').insert([{
            name: fullName,
            user_id: userId,
            email: formData.email,
            phone: formData.phone,
            active: true,
            hourly_rate: 65,
            daily_hours_goal: 8
          }])
        }
        loadMechanics()
      }
    }

    setShowForm(false)
    setEditingUser(null)
    loadUsers()
  }

  const deleteUser = async (id) => {
    if (!confirm('Delete this user? This cannot be undone.')) return
    
    // Unlink from mechanic first
    await supabase.from('mechanics').update({ user_id: null }).eq('user_id', id)
    
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) {
      alert('Error deleting user: ' + error.message)
      return
    }
    loadUsers()
    loadMechanics()
  }

  const toggleActive = async (user) => {
    await supabase.from('users').update({ active: !user.active }).eq('id', user.id)
    loadUsers()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className={`text-3xl font-bold ${t.text}`}>👥 Users</h2>
          <p className={t.textSecondary}>Manage user accounts and permissions</p>
        </div>
        <button onClick={openNewForm}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
          + Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {['owner', 'manager', 'mechanic', 'staff'].map(role => {
          const count = users.filter(u => u.role === role).length
          const r = roles.find(ro => ro.value === role)
          return (
            <div key={role} className={`${t.surface} rounded-lg ${t.border} border p-4`}>
              <div className={`text-2xl font-bold ${t.text}`}>{count}</div>
              <div className={t.textSecondary}>{r.label}s</div>
            </div>
          )
        })}
      </div>

      {/* Users Table */}
      <div className={`${t.surface} rounded-lg ${t.border} border overflow-hidden`}>
        <table className="w-full">
          <thead>
            <tr className={`${t.border} border-b bg-gray-800`}>
              <th className={`text-left p-4 ${t.text}`}>Name</th>
              <th className={`text-left p-4 ${t.text}`}>Email</th>
              <th className={`text-left p-4 ${t.text}`}>Phone</th>
              <th className={`text-center p-4 ${t.text}`}>Role</th>
              <th className={`text-center p-4 ${t.text}`}>Status</th>
              <th className={`text-center p-4 ${t.text}`}>Linked Mechanic</th>
              <th className={`text-right p-4 ${t.text}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const linkedMechanic = getLinkedMechanic(user.id)
              return (
                <tr key={user.id} className={`${t.border} border-b ${!user.active ? 'opacity-50' : ''}`}>
                  <td className={`p-4 ${t.text} font-medium`}>
                    {user.first_name} {user.last_name}
                  </td>
                  <td className={`p-4 ${t.textSecondary}`}>{user.email}</td>
                  <td className={`p-4 ${t.textSecondary}`}>{user.phone || '-'}</td>
                  <td className={`p-4 text-center`}>{getRoleBadge(user.role)}</td>
                  <td className={`p-4 text-center`}>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.active ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                    }`}>
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className={`p-4 text-center`}>
                    {linkedMechanic ? (
                      <span className="text-green-500 text-sm">✓ {linkedMechanic.name}</span>
                    ) : user.role === 'mechanic' ? (
                      <span className="text-yellow-500 text-sm">⚠️ Not linked</span>
                    ) : (
                      <span className={`text-sm ${t.textSecondary}`}>-</span>
                    )}
                  </td>
                  <td className={`p-4 text-right`}>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEditForm(user)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                        Edit
                      </button>
                      <button onClick={() => toggleActive(user)}
                        className={`${user.active ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white px-3 py-1 rounded text-sm`}>
                        {user.active ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => deleteUser(user.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan="7" className={`p-8 text-center ${t.textSecondary}`}>
                  <div className="text-4xl mb-2">👥</div>
                  <div>No users yet</div>
                  <div className="text-sm">Add your first user to get started</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className={`mt-4 ${t.surface} rounded-lg ${t.border} border p-4`}>
        <h4 className={`font-bold ${t.text} mb-2`}>ℹ️ Auto-Linking</h4>
        <p className={`text-sm ${t.textSecondary}`}>
          When you create a user with the "Mechanic" role, they are automatically linked to a mechanic profile.
          This lets them see their assigned jobs in "My Jobs" and use the Time Clock.
        </p>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-md ${t.border} border`}>
            <div className={`${t.border} border-b p-4 flex justify-between items-center`}>
              <h3 className={`text-xl font-bold ${t.text}`}>
                {editingUser ? 'Edit User' : 'Add User'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-red-500 text-2xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>First Name *</label>
                  <input type="text" required value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Last Name *</label>
                  <input type="text" required value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Email</label>
                <input type="email" value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Phone</label>
                <input type="tel" value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Role *</label>
                <select value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}>
                  {roles.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                {formData.role === 'mechanic' && (
                  <p className={`text-xs text-green-500 mt-1`}>
                    ✓ Will auto-create/link mechanic profile
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={formData.active}
                  onChange={(e) => setFormData({...formData, active: e.target.checked})}
                  className="w-5 h-5" />
                <label htmlFor="active" className={t.text}>Active</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)}
                  className={`flex-1 ${t.surface} ${t.text} ${t.border} border py-2 rounded-lg`}>
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold">
                  {editingUser ? 'Update' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
