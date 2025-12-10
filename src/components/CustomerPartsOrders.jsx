import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function CustomerPartsOrders({ theme: t, currentUser }) {
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [filter, setFilter] = useState('active')
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    customer_id: '',
    vehicle_id: '',
    work_order_id: '',
    part_name: '',
    part_number: '',
    supplier: '',
    quantity: 1,
    cost_price: '',
    sell_price: '',
    status: 'ordered',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    deposit_paid: '',
    notes: ''
  })

  useEffect(() => {
    loadOrders()
    loadCustomers()
  }, [filter])

  const loadOrders = async () => {
    let query = supabase
      .from('customer_parts_orders')
      .select(`
        *,
        customers(first_name, last_name, phone),
        vehicles(year, make, model, registration)
      `)
      .order('created_at', { ascending: false })

    if (filter === 'active') {
      query = query.in('status', ['ordered', 'shipped', 'arrived'])
    } else if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    if (data) setOrders(data)
  }

  const loadCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('last_name')
    if (data) setCustomers(data)
  }

  const loadVehicles = async (customerId) => {
    if (!customerId) { setVehicles([]); return }
    const { data } = await supabase.from('vehicles').select('*').eq('customer_id', customerId)
    if (data) setVehicles(data)
  }

  const openForm = (order = null) => {
    if (order) {
      setEditingId(order.id)
      setFormData({
        customer_id: order.customer_id || '',
        vehicle_id: order.vehicle_id || '',
        work_order_id: order.work_order_id || '',
        part_name: order.part_name || '',
        part_number: order.part_number || '',
        supplier: order.supplier || '',
        quantity: order.quantity || 1,
        cost_price: order.cost_price || '',
        sell_price: order.sell_price || '',
        status: order.status || 'ordered',
        order_date: order.order_date || new Date().toISOString().split('T')[0],
        expected_date: order.expected_date || '',
        deposit_paid: order.deposit_paid || '',
        notes: order.notes || ''
      })
      if (order.customer_id) loadVehicles(order.customer_id)
    } else {
      setEditingId(null)
      setFormData({
        customer_id: '',
        vehicle_id: '',
        work_order_id: '',
        part_name: '',
        part_number: '',
        supplier: '',
        quantity: 1,
        cost_price: '',
        sell_price: '',
        status: 'ordered',
        order_date: new Date().toISOString().split('T')[0],
        expected_date: '',
        deposit_paid: '',
        notes: ''
      })
    }
    setShowForm(true)
  }

  const saveOrder = async () => {
    if (!formData.customer_id || !formData.part_name) {
      alert('Please fill in customer and part name')
      return
    }

    const saveData = {
      ...formData,
      quantity: parseInt(formData.quantity) || 1,
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
      sell_price: formData.sell_price ? parseFloat(formData.sell_price) : null,
      deposit_paid: formData.deposit_paid ? parseFloat(formData.deposit_paid) : 0,
      vehicle_id: formData.vehicle_id || null,
      work_order_id: formData.work_order_id || null,
      expected_date: formData.expected_date || null,
      created_by: currentUser?.id
    }

    if (editingId) {
      const { error } = await supabase.from('customer_parts_orders').update(saveData).eq('id', editingId)
      if (error) { alert('Error: ' + error.message); return }
      alert('✓ Order updated!')
    } else {
      const { error } = await supabase.from('customer_parts_orders').insert([saveData])
      if (error) { alert('Error: ' + error.message); return }
      alert('✓ Part order created!')
    }

    setShowForm(false)
    loadOrders()
  }

  const updateStatus = async (id, newStatus) => {
    const updates = { status: newStatus }
    if (newStatus === 'arrived') updates.arrived_date = new Date().toISOString().split('T')[0]
    if (newStatus === 'collected') updates.collected_date = new Date().toISOString().split('T')[0]
    
    await supabase.from('customer_parts_orders').update(updates).eq('id', id)
    loadOrders()
  }

  const deleteOrder = async (id) => {
    if (!confirm('Delete this order?')) return
    await supabase.from('customer_parts_orders').delete().eq('id', id)
    loadOrders()
  }

  const notifyCustomer = (order) => {
    // This would integrate with SMS/email in a real app
    alert(`📱 Notify ${order.customers?.first_name} at ${order.customers?.phone}\n\nYour part "${order.part_name}" has arrived and is ready for collection!`)
  }

  const getStatusColor = (status) => {
    const colors = {
      ordered: 'bg-yellow-500',
      shipped: 'bg-blue-500',
      arrived: 'bg-green-500',
      collected: 'bg-gray-500',
      cancelled: 'bg-red-500'
    }
    return colors[status] || 'bg-gray-500'
  }

  const filteredOrders = orders.filter(o => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      o.part_name?.toLowerCase().includes(search) ||
      o.part_number?.toLowerCase().includes(search) ||
      o.customers?.first_name?.toLowerCase().includes(search) ||
      o.customers?.last_name?.toLowerCase().includes(search) ||
      o.supplier?.toLowerCase().includes(search)
    )
  })

  const stats = {
    ordered: orders.filter(o => o.status === 'ordered').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    arrived: orders.filter(o => o.status === 'arrived').length,
    awaitingCollection: orders.filter(o => o.status === 'arrived').length
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>📦 Customer Parts Orders</h2>
        <button onClick={() => openForm()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold">
          + New Part Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border cursor-pointer ${filter === 'ordered' ? 'ring-2 ring-yellow-500' : ''}`} onClick={() => setFilter('ordered')}>
          <div className="text-3xl font-bold text-yellow-500">{stats.ordered}</div>
          <div className={t.textSecondary}>On Order</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border cursor-pointer ${filter === 'shipped' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setFilter('shipped')}>
          <div className="text-3xl font-bold text-blue-500">{stats.shipped}</div>
          <div className={t.textSecondary}>Shipped</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border cursor-pointer ${filter === 'arrived' ? 'ring-2 ring-green-500' : ''}`} onClick={() => setFilter('arrived')}>
          <div className="text-3xl font-bold text-green-500">{stats.arrived}</div>
          <div className={t.textSecondary}>Arrived</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-orange-500">{stats.awaitingCollection}</div>
          <div className={t.textSecondary}>Awaiting Collection</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search parts, customers, suppliers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`flex-1 px-4 py-2 ${t.input} rounded-lg border`}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`px-4 py-2 ${t.input} rounded-lg border`}>
          <option value="active">Active Orders</option>
          <option value="all">All Orders</option>
          <option value="ordered">On Order</option>
          <option value="shipped">Shipped</option>
          <option value="arrived">Arrived</option>
          <option value="collected">Collected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
        <table className="min-w-full">
          <thead className={`${t.border} border-b`}>
            <tr>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Customer</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Part</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Supplier</th>
              <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Qty</th>
              <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Price</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Expected</th>
              <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
              <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${t.border}`}>
            {filteredOrders.map(order => (
              <tr key={order.id} className={t.surfaceHover}>
                <td className="px-4 py-3">
                  <div className={`font-medium ${t.text}`}>
                    {order.customers?.first_name} {order.customers?.last_name}
                  </div>
                  <div className={`text-xs ${t.textSecondary}`}>{order.customers?.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <div className={`font-medium ${t.text}`}>{order.part_name}</div>
                  {order.part_number && <div className={`text-xs ${t.textSecondary}`}>{order.part_number}</div>}
                </td>
                <td className={`px-4 py-3 ${t.textSecondary}`}>{order.supplier || '-'}</td>
                <td className={`px-4 py-3 text-center ${t.text}`}>{order.quantity}</td>
                <td className={`px-4 py-3 text-right ${t.text}`}>
                  {order.sell_price ? `$${parseFloat(order.sell_price).toFixed(2)}` : '-'}
                  {order.deposit_paid > 0 && (
                    <div className="text-xs text-green-500">Dep: ${parseFloat(order.deposit_paid).toFixed(2)}</div>
                  )}
                </td>
                <td className={`px-4 py-3 ${t.textSecondary}`}>
                  {order.expected_date ? new Date(order.expected_date).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(order.status)} text-white`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-center flex-wrap">
                    {order.status === 'ordered' && (
                      <button onClick={() => updateStatus(order.id, 'shipped')} className="text-blue-500 hover:text-blue-400 text-xs px-2 py-1 bg-blue-500 bg-opacity-10 rounded">
                        📦 Shipped
                      </button>
                    )}
                    {order.status === 'shipped' && (
                      <button onClick={() => updateStatus(order.id, 'arrived')} className="text-green-500 hover:text-green-400 text-xs px-2 py-1 bg-green-500 bg-opacity-10 rounded">
                        ✓ Arrived
                      </button>
                    )}
                    {order.status === 'arrived' && (
                      <>
                        <button onClick={() => notifyCustomer(order)} className="text-purple-500 hover:text-purple-400 text-xs px-2 py-1 bg-purple-500 bg-opacity-10 rounded">
                          📱 Notify
                        </button>
                        <button onClick={() => updateStatus(order.id, 'collected')} className="text-green-500 hover:text-green-400 text-xs px-2 py-1 bg-green-500 bg-opacity-10 rounded">
                          ✓ Collected
                        </button>
                      </>
                    )}
                    <button onClick={() => openForm(order)} className="text-blue-500 hover:text-blue-400 text-xs px-2 py-1">
                      Edit
                    </button>
                    <button onClick={() => deleteOrder(order.id)} className="text-red-500 hover:text-red-400 text-xs px-2 py-1">
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredOrders.length === 0 && (
          <div className={`text-center py-12 ${t.textSecondary}`}>No orders found</div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border max-h-[90vh] overflow-y-auto`}>
            <div className={`${t.border} border-b p-4 flex justify-between items-center sticky top-0 ${t.surface}`}>
              <h3 className={`text-xl font-bold ${t.text}`}>
                {editingId ? 'Edit Part Order' : 'New Part Order'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-red-500 text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Customer *</label>
                  <select
                    value={formData.customer_id}
                    onChange={(e) => { setFormData({...formData, customer_id: e.target.value, vehicle_id: ''}); loadVehicles(e.target.value) }}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  >
                    <option value="">Select Customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Vehicle</label>
                  <select
                    value={formData.vehicle_id}
                    onChange={(e) => setFormData({...formData, vehicle_id: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                    disabled={!formData.customer_id}
                  >
                    <option value="">Select Vehicle...</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} ({v.registration})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Part Name *</label>
                  <input
                    type="text"
                    value={formData.part_name}
                    onChange={(e) => setFormData({...formData, part_name: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                    placeholder="e.g., Front brake pads"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Part Number</label>
                  <input
                    type="text"
                    value={formData.part_number}
                    onChange={(e) => setFormData({...formData, part_number: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                    placeholder="e.g., FA390HH"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Supplier</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                    placeholder="e.g., Moto National"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Cost Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({...formData, cost_price: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Sell Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.sell_price}
                    onChange={(e) => setFormData({...formData, sell_price: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Deposit Paid</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.deposit_paid}
                    onChange={(e) => setFormData({...formData, deposit_paid: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Order Date</label>
                  <input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({...formData, order_date: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Expected Date</label>
                  <input
                    type="date"
                    value={formData.expected_date}
                    onChange={(e) => setFormData({...formData, expected_date: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  >
                    <option value="ordered">Ordered</option>
                    <option value="shipped">Shipped</option>
                    <option value="arrived">Arrived</option>
                    <option value="collected">Collected</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows="2"
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={saveOrder} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">
                  💾 Save Order
                </button>
                <button onClick={() => setShowForm(false)} className={`flex-1 ${t.surface} ${t.text} ${t.border} border py-3 rounded-lg`}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
