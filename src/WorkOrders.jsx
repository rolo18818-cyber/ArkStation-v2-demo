import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function WorkOrders() {
  const [workOrders, setWorkOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    customer_id: '',
    vehicle_id: '',
    description: '',
    status: 'pending',
    mechanic_notes: '',
    estimated_cost: ''
  })

  useEffect(() => {
    loadWorkOrders()
    loadCustomers()
    loadVehicles()
  }, [])

  const loadWorkOrders = async () => {
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers (first_name, last_name),
        vehicles (make, model, year)
      `)
      .order('created_at', { ascending: false })
    
    if (data) setWorkOrders(data)
  }

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('last_name')
    
    if (data) setCustomers(data)
  }

  const loadVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('*')
    
    if (data) setVehicles(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const { data, error } = await supabase
      .from('work_orders')
      .insert([{
        ...formData,
        estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : null
      }])
    
    if (!error) {
      setShowForm(false)
      setFormData({
        customer_id: '',
        vehicle_id: '',
        description: '',
        status: 'pending',
        mechanic_notes: '',
        estimated_cost: ''
      })
      loadWorkOrders()
    }
  }

  const updateStatus = async (id, newStatus) => {
    const updates = { status: newStatus }
    if (newStatus === 'completed') {
      updates.completed_date = new Date().toISOString()
    }
    
    await supabase
      .from('work_orders')
      .update(updates)
      .eq('id', id)
    
    loadWorkOrders()
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Work Orders</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          {showForm ? 'Cancel' : '+ New Work Order'}
        </button>
      </div>

      {/* Add Work Order Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">New Work Order</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <select
                required
                value={formData.customer_id}
                onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
              <select
                value={formData.vehicle_id}
                onChange={(e) => setFormData({...formData, vehicle_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Vehicle (optional)</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="What needs to be done?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Cost</label>
              <input
                type="number"
                step="0.01"
                value={formData.estimated_cost}
                onChange={(e) => setFormData({...formData, estimated_cost: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Mechanic Notes</label>
              <textarea
                value={formData.mechanic_notes}
                onChange={(e) => setFormData({...formData, mechanic_notes: e.target.value})}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Create Work Order
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Work Orders List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {workOrders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {order.customers?.first_name} {order.customers?.last_name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {order.vehicles ? `${order.vehicles.year} ${order.vehicles.make} ${order.vehicles.model}` : '-'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{order.description}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {order.status !== 'completed' && (
                    <button
                      onClick={() => updateStatus(order.id, order.status === 'pending' ? 'in_progress' : 'completed')}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      {order.status === 'pending' ? 'Start' : 'Complete'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {workOrders.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No work orders yet. Create your first one above!
          </div>
        )}
      </div>
    </div>
  )
}

export default WorkOrders