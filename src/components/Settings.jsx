import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Settings({ theme: t, userRole }) {
  const [permissions, setPermissions] = useState([])
  const [users, setUsers] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [showAddUser, setShowAddUser] = useState(false)
  const [thresholds, setThresholds] = useState({
    minimum_weekly_bookings: 5000,
    maximum_expense_ratio: 0.70,
    minimum_profit_margin: 0.15,
    days_runway_warning: 30
  })
  const [newUser, setNewUser] = useState({
    email: '',
    first_name: '',
    last_name: '',
    role: 'mechanic',
    phone: '',
    hourly_rate: 100
  })

const isOwner = true

  useEffect(() => {
    if (isOwner) {
      loadPermissions()
      loadUsers()
      loadMechanics()
      loadThresholds()
    }
  }, [isOwner])

  const loadPermissions = async () => {
    const { data } = await supabase
      .from('role_permissions')
      .select('*')
      .order('role')
      .order('permission_key')
    
    if (data) setPermissions(data)
  }

  const loadUsers = async () => {
    const { data } = await supabase
      .from('shop_users')
      .select('*, mechanics(first_name, last_name)')
      .order('role')
      .order('last_name')
    
    if (data) setUsers(data)
  }

  const loadMechanics = async () => {
    const { data } = await supabase
      .from('mechanics')
      .select('*')
      .order('first_name')
    
    if (data) setMechanics(data)
  }

  const loadThresholds = async () => {
    const { data } = await supabase
      .from('business_settings')
      .select('setting_value')
      .eq('setting_key', 'cash_flow_thresholds')
      .single()
    
    if (data) {
      setThresholds(data.setting_value)
    }
  }

  const togglePermission = async (role, permissionKey, currentValue) => {
    const { error } = await supabase
      .from('role_permissions')
      .update({ 
        permission_value: !currentValue,
        updated_at: new Date().toISOString()
      })
      .eq('role', role)
      .eq('permission_key', permissionKey)

    if (error) {
      alert('Error updating permission: ' + error.message)
    } else {
      loadPermissions()
    }
  }

  const saveThresholds = async () => {
    const { error } = await supabase
      .from('business_settings')
      .update({ 
        setting_value: thresholds,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', 'cash_flow_thresholds')

    if (error) {
      alert('Error saving thresholds: ' + error.message)
    } else {
      alert('✓ Settings saved successfully!')
    }
  }

  const addUser = async (e) => {
    e.preventDefault()

    let mechanicId = null

    // If role is mechanic, create mechanic record FIRST
    if (newUser.role === 'mechanic') {
      const { data: mechanicData, error: mechanicError } = await supabase
        .from('mechanics')
        .insert([{
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          email: newUser.email,
          phone: newUser.phone || '',
          hourly_rate: parseFloat(newUser.hourly_rate) || 100.00,
          is_active: true
        }])
        .select()

      if (mechanicError) {
        alert('Error creating mechanic record: ' + mechanicError.message)
        console.error('Mechanic creation error:', mechanicError)
        return
      }
      
      if (!mechanicData || mechanicData.length === 0) {
        alert('Error: Mechanic record was not created')
        return
      }

      mechanicId = mechanicData[0].id
      console.log('Created mechanic with ID:', mechanicId)
    }

    // Create user account
    const { data: userData, error: userError } = await supabase
      .from('shop_users')
      .insert([{
        email: newUser.email.toLowerCase(),
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        role: newUser.role,
        mechanic_id: mechanicId,
        password_hash: 'temp123',
        is_active: true
      }])
      .select()

    if (userError) {
      alert('Error adding user: ' + userError.message)
      console.error('User creation error:', userError)
      // If user creation failed but mechanic was created, clean up
      if (mechanicId) {
        await supabase.from('mechanics').delete().eq('id', mechanicId)
      }
    } else {
      console.log('Created user:', userData)
      setShowAddUser(false)
      setNewUser({
        email: '',
        first_name: '',
        last_name: '',
        role: 'mechanic',
        phone: '',
        hourly_rate: 100
      })
      loadUsers()
      loadMechanics()
      alert('✓ User created successfully!' + (mechanicId ? '\n✓ Mechanic record created - will appear in dropdowns!' : ''))
    }
  }

  const toggleUserActive = async (userId, currentStatus) => {
    const { error } = await supabase
      .from('shop_users')
      .update({ is_active: !currentStatus })
      .eq('id', userId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      loadUsers()
    }
  }

  const deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? This cannot be undone.')) return

    const user = users.find(u => u.id === userId)
    
    // If user is a mechanic, also delete mechanic record
    if (user?.mechanic_id) {
      await supabase.from('mechanics').delete().eq('id', user.mechanic_id)
    }

    const { error } = await supabase
      .from('shop_users')
      .delete()
      .eq('id', userId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      loadUsers()
      loadMechanics()
    }
  }

  if (!isOwner) {
    return (
      <div className={`${t.surface} rounded-lg shadow-lg p-12 text-center ${t.border} border`}>
        <div className="text-6xl mb-4">🔒</div>
        <div className={`text-2xl font-bold ${t.text} mb-2`}>Access Denied</div>
        <div className={`${t.textSecondary}`}>Only owners can access settings</div>
      </div>
    )
  }

  const roles = ['owner', 'manager', 'mechanic', 'parts', 'front_desk']
  const permissionKeys = [
    { key: 'view_revenue', label: 'View Revenue' },
    { key: 'view_costs', label: 'View Costs' },
    { key: 'view_profit', label: 'View Profit' },
    { key: 'manage_users', label: 'Manage Users' },
    { key: 'manage_mechanics', label: 'Manage Mechanics' },
    { key: 'modify_schedule', label: 'Modify Schedule' },
    { key: 'view_reports', label: 'View Reports' },
    { key: 'manage_accounting', label: 'Manage Accounting' },
    { key: 'manage_customers', label: 'Manage Customers' },
    { key: 'manage_inventory', label: 'Manage Inventory' },
    { key: 'use_pos', label: 'Use POS' },
    { key: 'manage_work_orders', label: 'Manage Work Orders' },
    { key: 'view_customer_history', label: 'View Customer History' }
  ]

  const getPermission = (role, key) => {
    const perm = permissions.find(p => p.role === role && p.permission_key === key)
    return perm?.permission_value || false
  }

  return (
    <div>
      <h2 className={`text-3xl font-bold ${t.text} mb-8`}>⚙️ Settings & Permissions</h2>

      {/* Current Mechanics List */}
      <div className={`${t.surface} rounded-lg shadow-lg p-6 mb-6 ${t.border} border`}>
        <h3 className={`text-xl font-bold ${t.text} mb-4`}>Active Mechanics</h3>
        {mechanics.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {mechanics.map(m => (
              <div key={m.id} className={`${t.surface} ${t.border} border rounded p-3`}>
                <div className={`font-semibold ${t.text}`}>{m.first_name} {m.last_name}</div>
                <div className={`text-xs ${t.textSecondary}`}>${m.hourly_rate}/hr</div>
                <div className={`text-xs ${t.textSecondary} mt-1`}>{m.email}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-center py-6 ${t.textSecondary}`}>
            No mechanics in system. Add a mechanic user below.
          </div>
        )}
      </div>

      {/* Users Management */}
      <div className={`${t.surface} rounded-lg shadow-lg p-6 mb-6 ${t.border} border`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-xl font-bold ${t.text}`}>User Accounts</h3>
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className={`${t.primary} ${t.primaryHover} ${t.primaryText} px-4 py-2 rounded font-medium`}>
            {showAddUser ? 'Cancel' : '+ Add User'}
          </button>
        </div>

        {showAddUser && (
          <form onSubmit={addUser} className={`mb-6 p-4 ${t.surface} ${t.border} border rounded`}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>First Name *</label>
                <input
                  type="text"
                  required
                  value={newUser.first_name}
                  onChange={(e) => setNewUser({...newUser, first_name: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Last Name *</label>
                <input
                  type="text"
                  required
                  value={newUser.last_name}
                  onChange={(e) => setNewUser({...newUser, last_name: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Email *</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Role *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="manager">Manager</option>
                  <option value="mechanic">Mechanic</option>
                  <option value="parts">Parts</option>
                  <option value="front_desk">Front Desk</option>
                </select>
              </div>
              
              {newUser.role === 'mechanic' && (
                <>
                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-1`}>Phone</label>
                    <input
                      type="tel"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                      className={`w-full px-3 py-2 ${t.input} rounded border`}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-1`}>Hourly Rate ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newUser.hourly_rate}
                      onChange={(e) => setNewUser({...newUser, hourly_rate: e.target.value})}
                      className={`w-full px-3 py-2 ${t.input} rounded border`}
                      placeholder="100.00"
                    />
                  </div>
                </>
              )}
            </div>
            
            {newUser.role === 'mechanic' && (
              <div className={`${t.surface} ${t.border} border rounded p-3 mt-4 mb-3`}>
                <div className={`text-sm font-bold ${t.text} mb-2`}>🔧 Creating Mechanic User</div>
                <ul className={`text-xs ${t.textSecondary} space-y-1`}>
                  <li>✓ Creates login account</li>
                  <li>✓ Creates mechanic record for scheduling</li>
                  <li>✓ Will appear in all mechanic dropdowns immediately</li>
                  <li>✓ Can book labor hours and use mobile view</li>
                  <li>✓ Default password: "temp123"</li>
                </ul>
              </div>
            )}

            <button type="submit" className={`w-full ${t.primary} ${t.primaryHover} ${t.primaryText} py-2 rounded font-medium mt-2`}>
              Create {newUser.role === 'mechanic' ? 'Mechanic' : 'User'}
            </button>
          </form>
        )}

        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id} className={`flex justify-between items-center p-3 ${t.surface} ${t.border} border rounded`}>
              <div className="flex-1">
                <div className={`font-semibold ${t.text} flex items-center gap-2`}>
                  {user.first_name} {user.last_name}
                  {user.mechanic_id && (
                    <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded font-bold">
                      🔧 MECHANIC
                    </span>
                  )}
                </div>
                <div className={`text-sm ${t.textSecondary}`}>
                  {user.email} • {user.role.toUpperCase()}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleUserActive(user.id, user.is_active)}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    user.is_active 
                      ? 'bg-green-500 hover:bg-green-600 text-white' 
                      : 'bg-gray-500 hover:bg-gray-600 text-white'
                  }`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </button>
                {user.role !== 'owner' && (
                  <button
                    onClick={() => deleteUser(user.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className={`${t.surface} rounded-lg shadow-lg p-6 mb-6 ${t.border} border overflow-x-auto`}>
        <h3 className={`text-xl font-bold ${t.text} mb-4`}>Role Permissions</h3>
        <table className="min-w-full">
          <thead>
            <tr className={`${t.border} border-b`}>
              <th className={`px-4 py-2 text-left text-sm font-medium ${t.text}`}>Permission</th>
              {roles.map(role => (
                <th key={role} className={`px-4 py-2 text-center text-sm font-medium ${t.text} uppercase`}>
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissionKeys.map(perm => (
              <tr key={perm.key} className={`${t.border} border-b`}>
                <td className={`px-4 py-3 text-sm ${t.text}`}>{perm.label}</td>
                {roles.map(role => {
                  const hasPermission = getPermission(role, perm.key)
                  const isOwnerRole = role === 'owner'
                  return (
                    <td key={role} className="px-4 py-3 text-center">
                      <button
                        onClick={() => !isOwnerRole && togglePermission(role, perm.key, hasPermission)}
                        disabled={isOwnerRole}
                        className={`w-8 h-8 rounded transition-all ${
                          hasPermission 
                            ? 'bg-green-500 hover:bg-green-600' 
                            : 'bg-red-500 hover:bg-red-600'
                        } ${isOwnerRole ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <span className="text-white font-bold">
                          {hasPermission ? '✓' : '✗'}
                        </span>
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className={`text-xs ${t.textSecondary} mt-4`}>
          Owner permissions are always enabled and cannot be changed.
        </p>
      </div>

      {/* Business Thresholds */}
      <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
        <h3 className={`text-xl font-bold ${t.text} mb-4`}>💰 Cash Flow Alert Thresholds</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium ${t.text} mb-1`}>Minimum Weekly Bookings ($)</label>
            <input
              type="number"
              step="100"
              value={thresholds.minimum_weekly_bookings}
              onChange={(e) => setThresholds({...thresholds, minimum_weekly_bookings: parseFloat(e.target.value)})}
              className={`w-full px-3 py-2 ${t.input} rounded border`}
            />
            <p className={`text-xs ${t.textSecondary} mt-1`}>Alert if weekly bookings fall below this amount</p>
          </div>
          <div>
            <label className={`block text-sm font-medium ${t.text} mb-1`}>Maximum Expense Ratio (0-1)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={thresholds.maximum_expense_ratio}
              onChange={(e) => setThresholds({...thresholds, maximum_expense_ratio: parseFloat(e.target.value)})}
              className={`w-full px-3 py-2 ${t.input} rounded border`}
            />
            <p className={`text-xs ${t.textSecondary} mt-1`}>Alert if expenses exceed this ratio (0.70 = 70%)</p>
          </div>
          <div>
            <label className={`block text-sm font-medium ${t.text} mb-1`}>Minimum Profit Margin (0-1)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={thresholds.minimum_profit_margin}
              onChange={(e) => setThresholds({...thresholds, minimum_profit_margin: parseFloat(e.target.value)})}
              className={`w-full px-3 py-2 ${t.input} rounded border`}
            />
            <p className={`text-xs ${t.textSecondary} mt-1`}>Alert if profit margin falls below this (0.15 = 15%)</p>
          </div>
          <div>
            <label className={`block text-sm font-medium ${t.text} mb-1`}>Days Runway Warning</label>
            <input
              type="number"
              value={thresholds.days_runway_warning}
              onChange={(e) => setThresholds({...thresholds, days_runway_warning: parseInt(e.target.value)})}
              className={`w-full px-3 py-2 ${t.input} rounded border`}
            />
            <p className={`text-xs ${t.textSecondary} mt-1`}>Alert if cash runway falls below this many days</p>
          </div>
        </div>
        <button
          onClick={saveThresholds}
          className={`mt-6 w-full ${t.primary} ${t.primaryHover} ${t.primaryText} py-3 rounded font-bold`}>
          Save Threshold Settings
        </button>
      </div>
    </div>
  )
}