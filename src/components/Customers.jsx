import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Customers({ theme: t }) {
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [search, setSearch] = useState('')
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    suburb: '',
    state: 'NSW',
    postcode: '',
    is_priority: false,
    notes: ''
  })

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('last_name')
    if (data) setCustomers(data)
  }

  const loadVehicles = async (customerId) => {
    const { data } = await supabase
      .from('vehicles')
      .select('*')
      .eq('customer_id', customerId)
    if (data) setVehicles(data)
  }

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer)
    loadVehicles(customer.id)
  }

  const openNewForm = () => {
    setEditingCustomer(null)
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      address: '',
      suburb: '',
      state: 'NSW',
      postcode: '',
      is_priority: false,
      notes: ''
    })
    setShowForm(true)
  }

  const openEditForm = (customer) => {
    setEditingCustomer(customer)
    setFormData({
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      suburb: customer.suburb || '',
      state: customer.state || 'NSW',
      postcode: customer.postcode || '',
      is_priority: customer.is_priority || false,
      notes: customer.notes || ''
    })
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (editingCustomer) {
      await supabase
        .from('customers')
        .update(formData)
        .eq('id', editingCustomer.id)
    } else {
      await supabase
        .from('customers')
        .insert([formData])
    }

    setShowForm(false)
    setEditingCustomer(null)
    loadCustomers()
  }

  const deleteCustomer = async (id) => {
    if (!confirm('Delete this customer? This cannot be undone.')) return

    await supabase.from('customers').delete().eq('id', id)
    if (selectedCustomer?.id === id) setSelectedCustomer(null)
    loadCustomers()
  }

  const filteredCustomers = customers.filter(c => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      c.first_name?.toLowerCase().includes(searchLower) ||
      c.last_name?.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower) ||
      c.phone?.includes(search)
    )
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>👥 Customers</h2>
        <button onClick={openNewForm}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
          + Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full px-4 py-2 ${t.input} rounded-lg border`}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Customer List */}
        <div className="col-span-2">
          <div className={`${t.surface} rounded-lg ${t.border} border overflow-hidden`}>
            <table className="min-w-full">
              <thead className={`${t.border} border-b`}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Name</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Phone</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Email</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${t.border}`}>
                {filteredCustomers.map(customer => (
                  <tr key={customer.id}
                    onClick={() => selectCustomer(customer)}
                    className={`${t.surfaceHover} cursor-pointer ${
                      selectedCustomer?.id === customer.id ? 'bg-blue-600 bg-opacity-20' : ''
                    }`}>
                    <td className="px-4 py-3">
                      <div className={`font-medium ${t.text}`}>
                        {customer.first_name} {customer.last_name}
                        {customer.is_priority && <span className="ml-2 text-yellow-500">⭐ VIP</span>}
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${t.text}`}>{customer.phone}</td>
                    <td className={`px-4 py-3 ${t.text}`}>{customer.email}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={(e) => { e.stopPropagation(); openEditForm(customer); }}
                        className="text-blue-500 hover:text-blue-400 font-medium">Edit</button>
                      <button onClick={(e) => { e.stopPropagation(); deleteCustomer(customer.id); }}
                        className="text-red-500 hover:text-red-400 font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCustomers.length === 0 && (
              <div className={`text-center py-12 ${t.textSecondary}`}>
                No customers found
              </div>
            )}
          </div>
        </div>

        {/* Customer Detail */}
        <div>
          {selectedCustomer ? (
            <div className={`${t.surface} rounded-lg ${t.border} border p-4`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className={`text-xl font-bold ${t.text}`}>
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </h3>
                  {selectedCustomer.is_priority && (
                    <span className="text-yellow-500 text-sm">⭐ VIP Customer</span>
                  )}
                </div>
                <button onClick={() => openEditForm(selectedCustomer)}
                  className="text-blue-500 hover:text-blue-400">Edit</button>
              </div>

              <div className="space-y-3">
                {selectedCustomer.phone && (
                  <div>
                    <div className={`text-xs ${t.textSecondary}`}>Phone</div>
                    <div className={t.text}>{selectedCustomer.phone}</div>
                  </div>
                )}
                {selectedCustomer.email && (
                  <div>
                    <div className={`text-xs ${t.textSecondary}`}>Email</div>
                    <div className={t.text}>{selectedCustomer.email}</div>
                  </div>
                )}
                {selectedCustomer.address && (
                  <div>
                    <div className={`text-xs ${t.textSecondary}`}>Address</div>
                    <div className={t.text}>
                      {selectedCustomer.address}<br />
                      {selectedCustomer.suburb} {selectedCustomer.state} {selectedCustomer.postcode}
                    </div>
                  </div>
                )}
                {selectedCustomer.notes && (
                  <div>
                    <div className={`text-xs ${t.textSecondary}`}>Notes</div>
                    <div className={t.text}>{selectedCustomer.notes}</div>
                  </div>
                )}
              </div>

              {/* Vehicles */}
              <div className="mt-6">
                <h4 className={`font-bold ${t.text} mb-2`}>Vehicles</h4>
                {vehicles.length > 0 ? (
                  <div className="space-y-2">
                    {vehicles.map(v => (
                      <div key={v.id} className={`${t.surfaceHover} rounded p-2`}>
                        <div className={`font-medium ${t.text}`}>{v.year} {v.make} {v.model}</div>
                        <div className={`text-sm ${t.textSecondary}`}>{v.registration}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={t.textSecondary}>No vehicles</div>
                )}
              </div>
            </div>
          ) : (
            <div className={`${t.surface} rounded-lg ${t.border} border p-8 text-center`}>
              <div className="text-4xl mb-2">👤</div>
              <div className={t.textSecondary}>Select a customer to view details</div>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-xl ${t.border} border`}>
            <div className={`${t.border} border-b p-4 flex justify-between items-center`}>
              <h3 className={`text-xl font-bold ${t.text}`}>
                {editingCustomer ? 'Edit Customer' : 'Add Customer'}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Phone</label>
                  <input type="tel" value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Email</label>
                  <input type="email" value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Address</label>
                <input type="text" value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Suburb</label>
                  <input type="text" value={formData.suburb}
                    onChange={(e) => setFormData({...formData, suburb: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>State</label>
                  <select value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}>
                    <option value="NSW">NSW</option>
                    <option value="VIC">VIC</option>
                    <option value="QLD">QLD</option>
                    <option value="WA">WA</option>
                    <option value="SA">SA</option>
                    <option value="TAS">TAS</option>
                    <option value="ACT">ACT</option>
                    <option value="NT">NT</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Postcode</label>
                  <input type="text" value={formData.postcode}
                    onChange={(e) => setFormData({...formData, postcode: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Notes</label>
                <textarea value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows="2" className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="vip" checked={formData.is_priority}
                  onChange={(e) => setFormData({...formData, is_priority: e.target.checked})}
                  className="w-5 h-5" />
                <label htmlFor="vip" className={t.text}>⭐ VIP Customer (priority service)</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)}
                  className={`flex-1 ${t.surface} ${t.text} ${t.border} border py-2 rounded-lg`}>
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold">
                  {editingCustomer ? 'Update Customer' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
