import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function CustomerRequests({ theme: t, currentUser }) {
  const [requests, setRequests] = useState([])
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [filter, setFilter] = useState('pending')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [formData, setFormData] = useState({
    customer_id: '',
    vehicle_id: '',
    request_type: 'service',
    description: '',
    customer_notes: '',
    preferred_date: '',
    preferred_time: '',
    urgency: 'normal',
    estimated_hours: '',
    status: 'pending',
    source: 'phone' // phone, walk-in, online, email
  })

  useEffect(() => {
    loadRequests()
    loadCustomers()
  }, [filter])

  const loadRequests = async () => {
    let query = supabase
      .from('customer_requests')
      .select(`
        *,
        customers(first_name, last_name, phone, email, is_priority),
        vehicles(year, make, model, registration)
      `)
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    if (data) setRequests(data)
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

  const openForm = (request = null) => {
    if (request) {
      setEditingId(request.id)
      setFormData({
        customer_id: request.customer_id || '',
        vehicle_id: request.vehicle_id || '',
        request_type: request.request_type || 'service',
        description: request.description || '',
        customer_notes: request.customer_notes || '',
        preferred_date: request.preferred_date || '',
        preferred_time: request.preferred_time || '',
        urgency: request.urgency || 'normal',
        estimated_hours: request.estimated_hours || '',
        status: request.status || 'pending',
        source: request.source || 'phone'
      })
      if (request.customer_id) loadVehicles(request.customer_id)
    } else {
      setEditingId(null)
      setFormData({
        customer_id: '',
        vehicle_id: '',
        request_type: 'service',
        description: '',
        customer_notes: '',
        preferred_date: '',
        preferred_time: '',
        urgency: 'normal',
        estimated_hours: '',
        status: 'pending',
        source: 'phone'
      })
    }
    setShowForm(true)
  }

  const saveRequest = async () => {
    if (!formData.customer_id || !formData.description) {
      alert('Please fill in customer and description')
      return
    }

    const saveData = {
      ...formData,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
      vehicle_id: formData.vehicle_id || null,
      preferred_date: formData.preferred_date || null,
      created_by: currentUser?.id
    }

    if (editingId) {
      const { error } = await supabase.from('customer_requests').update(saveData).eq('id', editingId)
      if (error) { alert('Error: ' + error.message); return }
    } else {
      const { error } = await supabase.from('customer_requests').insert([saveData])
      if (error) { alert('Error: ' + error.message); return }
    }

    setShowForm(false)
    loadRequests()
  }

  const convertToWorkOrder = async (request) => {
    // Create work order from request
    const jobNum = `JOB-${Date.now().toString().slice(-6)}`
    
    const { data, error } = await supabase.from('work_orders').insert([{
      job_number: jobNum,
      customer_id: request.customer_id,
      vehicle_id: request.vehicle_id,
      description: request.description,
      customer_notes: request.customer_notes,
      estimated_hours: request.estimated_hours,
      priority: request.urgency === 'urgent' ? 'urgent' : request.urgency === 'high' ? 'high' : 'normal',
      status: 'pending',
      created_by: currentUser?.id
    }]).select()

    if (error) {
      alert('Error creating work order: ' + error.message)
      return
    }

    // Update request status
    await supabase.from('customer_requests').update({ 
      status: 'converted',
      work_order_id: data[0].id 
    }).eq('id', request.id)

    alert(`✓ Created ${jobNum}`)
    loadRequests()
  }

  const aiAnalyzeRequest = async () => {
    if (!formData.description) {
      alert('Enter a description first')
      return
    }
    setAiLoading(true)

    const vehicle = vehicles.find(v => v.id === formData.vehicle_id)
    
    try {
      const response = await fetch('http://localhost:3001/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: 'You are a motorcycle workshop service advisor. Analyze customer requests and provide estimates. Return ONLY valid JSON like {"estimatedHours": 2, "urgency": "normal", "requestType": "service", "enhancedDescription": "...", "recommendations": "..."}',
          messages: [{
            role: 'user',
            content: `Analyze this customer request:
${vehicle ? `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Vehicle: Not specified'}
Customer says: ${formData.description}
${formData.customer_notes ? `Additional notes: ${formData.customer_notes}` : ''}`
          }],
          max_tokens: 1000
        })
      })

      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        setFormData({
          ...formData,
          estimated_hours: result.estimatedHours?.toString() || formData.estimated_hours,
          urgency: result.urgency || formData.urgency,
          request_type: result.requestType || formData.request_type,
          description: result.enhancedDescription || formData.description
        })
        if (result.recommendations) {
          alert(`AI Recommendations:\n${result.recommendations}`)
        }
      }
    } catch (e) {
      console.error('AI Error:', e)
    }
    setAiLoading(false)
  }

  const updateStatus = async (id, status) => {
    await supabase.from('customer_requests').update({ status }).eq('id', id)
    loadRequests()
  }

  const getUrgencyColor = (urgency) => {
    const colors = { low: 'bg-gray-500', normal: 'bg-blue-500', high: 'bg-orange-500', urgent: 'bg-red-500' }
    return colors[urgency] || 'bg-gray-500'
  }

  const getStatusColor = (status) => {
    const colors = { pending: 'bg-yellow-500', confirmed: 'bg-blue-500', scheduled: 'bg-green-500', converted: 'bg-purple-500', cancelled: 'bg-red-500' }
    return colors[status] || 'bg-gray-500'
  }

  const stats = {
    pending: requests.filter(r => r.status === 'pending').length,
    confirmed: requests.filter(r => r.status === 'confirmed').length,
    urgent: requests.filter(r => r.urgency === 'urgent' || r.urgency === 'high').length
  }

  const requestTypes = [
    { value: 'service', label: 'Service' },
    { value: 'repair', label: 'Repair' },
    { value: 'warranty', label: 'Warranty Claim' },
    { value: 'quote', label: 'Quote Request' },
    { value: 'inspection', label: 'Inspection' },
    { value: 'pickup', label: 'Parts Pickup' },
    { value: 'other', label: 'Other' }
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>📞 Customer Requests</h2>
        <button onClick={() => openForm()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold">
          + New Request
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border cursor-pointer ${filter === 'pending' ? 'ring-2 ring-yellow-500' : ''}`} onClick={() => setFilter('pending')}>
          <div className="text-3xl font-bold text-yellow-500">{stats.pending}</div>
          <div className={t.textSecondary}>Pending</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border cursor-pointer ${filter === 'confirmed' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setFilter('confirmed')}>
          <div className="text-3xl font-bold text-blue-500">{stats.confirmed}</div>
          <div className={t.textSecondary}>Confirmed</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-red-500">{stats.urgent}</div>
          <div className={t.textSecondary}>Urgent/High Priority</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border cursor-pointer ${filter === 'all' ? 'ring-2 ring-gray-500' : ''}`} onClick={() => setFilter('all')}>
          <div className="text-3xl font-bold text-gray-400">{requests.length}</div>
          <div className={t.textSecondary}>All Requests</div>
        </div>
      </div>

      {/* Requests List */}
      <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
        <table className="min-w-full">
          <thead className={`${t.border} border-b`}>
            <tr>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Customer</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Vehicle</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Request</th>
              <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Type</th>
              <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Urgency</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Preferred</th>
              <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
              <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${t.border}`}>
            {requests.map(req => (
              <tr key={req.id} className={`${t.surfaceHover} ${req.urgency === 'urgent' ? 'bg-red-900 bg-opacity-20' : ''}`}>
                <td className="px-4 py-3">
                  <div className={`font-medium ${t.text}`}>
                    {req.customers?.first_name} {req.customers?.last_name}
                    {req.customers?.is_priority && ' ⭐'}
                  </div>
                  <div className={`text-xs ${t.textSecondary}`}>{req.customers?.phone}</div>
                </td>
                <td className="px-4 py-3">
                  {req.vehicles ? (
                    <>
                      <div className={t.text}>{req.vehicles.year} {req.vehicles.make} {req.vehicles.model}</div>
                      <div className={`text-xs ${t.textSecondary}`}>{req.vehicles.registration}</div>
                    </>
                  ) : <span className={t.textSecondary}>-</span>}
                </td>
                <td className={`px-4 py-3 ${t.text}`}>
                  <div className="max-w-xs truncate">{req.description}</div>
                  {req.customer_notes && <div className={`text-xs ${t.textSecondary} truncate`}>"{req.customer_notes}"</div>}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs ${t.textSecondary} capitalize`}>{req.request_type}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${getUrgencyColor(req.urgency)} text-white`}>
                    {req.urgency}
                  </span>
                </td>
                <td className={`px-4 py-3 ${t.textSecondary} text-sm`}>
                  {req.preferred_date && new Date(req.preferred_date).toLocaleDateString()}
                  {req.preferred_time && ` ${req.preferred_time}`}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${getStatusColor(req.status)} text-white`}>
                    {req.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-center flex-wrap">
                    {req.status === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(req.id, 'confirmed')} className="text-blue-500 hover:text-blue-400 text-xs px-2 py-1 bg-blue-500 bg-opacity-10 rounded">
                          ✓ Confirm
                        </button>
                        <button onClick={() => convertToWorkOrder(req)} className="text-green-500 hover:text-green-400 text-xs px-2 py-1 bg-green-500 bg-opacity-10 rounded">
                          📋 Create Job
                        </button>
                      </>
                    )}
                    {req.status === 'confirmed' && (
                      <button onClick={() => convertToWorkOrder(req)} className="text-green-500 hover:text-green-400 text-xs px-2 py-1 bg-green-500 bg-opacity-10 rounded">
                        📋 Create Job
                      </button>
                    )}
                    <button onClick={() => openForm(req)} className="text-blue-500 hover:text-blue-400 text-xs px-2 py-1">
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && (
          <div className={`text-center py-12 ${t.textSecondary}`}>No requests found</div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border max-h-[90vh] overflow-y-auto`}>
            <div className={`${t.border} border-b p-4 flex justify-between items-center sticky top-0 ${t.surface}`}>
              <h3 className={`text-xl font-bold ${t.text}`}>
                {editingId ? 'Edit Request' : 'New Customer Request'}
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
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name} {c.is_priority ? '⭐' : ''}</option>
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
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Request Type</label>
                  <select
                    value={formData.request_type}
                    onChange={(e) => setFormData({...formData, request_type: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  >
                    {requestTypes.map(rt => (
                      <option key={rt.value} value={rt.value}>{rt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({...formData, source: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  >
                    <option value="phone">📞 Phone</option>
                    <option value="walk-in">🚶 Walk-in</option>
                    <option value="online">🌐 Online</option>
                    <option value="email">📧 Email</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`text-sm font-medium ${t.text}`}>Description *</label>
                  <button onClick={aiAnalyzeRequest} disabled={aiLoading} className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded">
                    {aiLoading ? '...' : '🤖 AI Analyze'}
                  </button>
                </div>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  placeholder="What does the customer need? (e.g., General service, strange noise from engine...)"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Customer's Words (verbatim)</label>
                <textarea
                  value={formData.customer_notes}
                  onChange={(e) => setFormData({...formData, customer_notes: e.target.value})}
                  rows="2"
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  placeholder="What the customer said exactly..."
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Preferred Date</label>
                  <input
                    type="date"
                    value={formData.preferred_date}
                    onChange={(e) => setFormData({...formData, preferred_date: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Preferred Time</label>
                  <select
                    value={formData.preferred_time}
                    onChange={(e) => setFormData({...formData, preferred_time: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  >
                    <option value="">Any time</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="drop-off">Drop off</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Urgency</label>
                  <select
                    value={formData.urgency}
                    onChange={(e) => setFormData({...formData, urgency: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Est. Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.estimated_hours}
                    onChange={(e) => setFormData({...formData, estimated_hours: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={saveRequest} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">
                  💾 Save Request
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
