import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PhotoUploader from './PhotoUploader'
import DigitalSignature from './DigitalSignature'
import JobCard from './JobCard'

export default function WorkOrders({ theme: t, userRole }) {
  const [workOrders, setWorkOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [templates, setTemplates] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [photos, setPhotos] = useState([])
  const [signatures, setSignatures] = useState([])
  const [showPhotoUploader, setShowPhotoUploader] = useState(false)
  const [showSignature, setShowSignature] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showJobCard, setShowJobCard] = useState(false)
  const [jobCardOrderId, setJobCardOrderId] = useState(null)
  const [formData, setFormData] = useState({
    customer_id: '',
    vehicle_id: '',
    template_id: '',
    order_type: 'work_order',
    description: '',
    assigned_mechanic_id: '',
    scheduled_start: '',
    status: 'pending',
    mechanic_notes: ''
  })

  useEffect(() => {
    loadWorkOrders()
    loadCustomers()
    loadMechanics()
    loadTemplates()
  }, [])

  const loadWorkOrders = async () => {
    const { data } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers(first_name, last_name, phone),
        vehicles(make, model, registration, year),
        mechanics(first_name, last_name),
        job_templates(name)
      `)
      .order('created_at', { ascending: false })
    
    if (data) setWorkOrders(data)
  }

  const loadCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('last_name')
    if (data) setCustomers(data)
  }

  const loadMechanics = async () => {
    const { data } = await supabase.from('mechanics').select('*').eq('is_active', true).order('first_name')
    if (data) setMechanics(data)
  }

  const loadTemplates = async () => {
    const { data } = await supabase.from('job_templates').select('*').eq('is_active', true).order('name')
    if (data) setTemplates(data)
  }

  const loadCustomerVehicles = async (customerId) => {
    const { data } = await supabase.from('vehicles').select('*').eq('customer_id', customerId)
    if (data) setVehicles(data)
  }

  const handleCustomerChange = (customerId) => {
    setFormData({...formData, customer_id: customerId, vehicle_id: ''})
    loadCustomerVehicles(customerId)
  }

  const handleTemplateChange = (templateId) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setFormData({
        ...formData,
        template_id: templateId,
        description: template.description || formData.description
      })
    } else {
      setFormData({...formData, template_id: ''})
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const { data: jobData } = await supabase.rpc('generate_job_number')
    
    const { error } = await supabase
      .from('work_orders')
      .insert([{
        ...formData,
        job_number: jobData,
        status: 'pending'
      }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      const typeLabel = formData.order_type === 'quote' ? 'Quote' : 'Work Order'
      alert(`✓ ${typeLabel} created: ${jobData}`)
      setShowForm(false)
      setFormData({
        customer_id: '',
        vehicle_id: '',
        template_id: '',
        order_type: 'work_order',
        description: '',
        assigned_mechanic_id: '',
        scheduled_start: '',
        status: 'pending',
        mechanic_notes: ''
      })
      loadWorkOrders()
    }
  }

  const viewOrderDetails = async (order) => {
    setSelectedOrder(order)
    
    const { data: photoData } = await supabase
      .from('work_order_photos')
      .select('*')
      .eq('work_order_id', order.id)
      .order('uploaded_at', { ascending: false })
    setPhotos(photoData || [])

    const { data: sigData } = await supabase
      .from('work_order_signatures')
      .select('*')
      .eq('work_order_id', order.id)
      .order('signed_at', { ascending: false })
    setSignatures(sigData || [])

    setShowDetailModal(true)
  }

  const createInvoiceFromJob = async (workOrderId) => {
    if (!confirm('Create invoice from this completed job?')) return

    const { data: invoiceId, error } = await supabase.rpc('create_invoice_from_work_order', {
      p_work_order_id: workOrderId
    })

    if (error) {
      alert('Error creating invoice: ' + error.message)
    } else {
      alert('✓ Invoice created successfully!')
      await supabase.from('activity_log').insert([{
        user_email: 'current_user@email.com',
        action: 'Created invoice from work order',
        entity_type: 'invoice',
        entity_id: invoiceId
      }])
    }
  }

  const updateStatus = async (orderId, newStatus) => {
    await supabase.from('work_orders').update({ status: newStatus }).eq('id', orderId)
    loadWorkOrders()
    if (selectedOrder?.id === orderId) {
      setSelectedOrder({...selectedOrder, status: newStatus})
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500',
      in_progress: 'bg-blue-500',
      wait_parts: 'bg-orange-500',
      completed: 'bg-green-500',
      cancelled: 'bg-red-500'
    }
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[status]}`}>
      {status.toUpperCase().replace('_', ' ')}
    </span>
  }

  const getTypeBadge = (type) => {
    return type === 'quote' ? (
      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-500 text-white">QUOTE</span>
    ) : null
  }

  const filteredOrders = workOrders.filter(order => {
    const search = searchTerm.toLowerCase()
    return (
      order.job_number?.toLowerCase().includes(search) ||
      order.customers?.first_name?.toLowerCase().includes(search) ||
      order.customers?.last_name?.toLowerCase().includes(search) ||
      order.description?.toLowerCase().includes(search) ||
      order.vehicles?.registration?.toLowerCase().includes(search)
    )
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>🔧 Work Orders</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`${t.primary} ${t.primaryHover} ${t.primaryText} px-4 py-2 rounded-lg font-medium`}>
          {showForm ? 'Cancel' : '+ New Work Order'}
        </button>
      </div>

      <div className={`${t.surface} rounded-lg shadow-lg p-4 mb-6 ${t.border} border`}>
        <input
          type="text"
          placeholder="🔍 Search by job #, customer, description, rego..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full px-4 py-2 ${t.input} rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
      </div>

      {showForm && (
        <div className={`${t.surface} rounded-lg shadow-lg p-6 mb-6 ${t.border} border`}>
          <h3 className={`text-xl font-semibold mb-4 ${t.text}`}>New Work Order</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Customer *</label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} {c.company_name && `(${c.company_name})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Vehicle *</label>
                <select
                  required
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({...formData, vehicle_id: e.target.value})}
                  disabled={!formData.customer_id}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Select vehicle...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.year} {v.make} {v.model} ({v.registration})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Type *</label>
                <select
                  value={formData.order_type}
                  onChange={(e) => setFormData({...formData, order_type: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="work_order">Work Order</option>
                  <option value="quote">Quote Only</option>
                </select>
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Service Template (optional)</label>
                <select
                  value={formData.template_id}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">No template - custom job</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.estimated_duration_minutes}min, {t.default_labor_hours}hrs)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium ${t.text} mb-1`}>Description *</label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows="3"
                className={`w-full px-3 py-2 ${t.input} rounded border`}
                placeholder="Describe the work to be done..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Assign Mechanic</label>
                <select
                  value={formData.assigned_mechanic_id}
                  onChange={(e) => setFormData({...formData, assigned_mechanic_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Unassigned</option>
                  {mechanics.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Scheduled Start</label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_start}
                  onChange={(e) => setFormData({...formData, scheduled_start: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                />
              </div>
            </div>

            <button type="submit" className={`w-full ${t.primary} ${t.primaryHover} ${t.primaryText} py-2 rounded font-medium`}>
              Create {formData.order_type === 'quote' ? 'Quote' : 'Work Order'}
            </button>
          </form>
        </div>
      )}

      <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
        <table className="min-w-full">
          <thead className={`${t.surface} ${t.border} border-b`}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Job #</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Customer</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Vehicle</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Description</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${t.border}`}>
            {filteredOrders.map(order => (
              <tr key={order.id} className={t.surfaceHover}>
                <td className="px-6 py-4">
                  <div className={`text-sm font-bold ${t.text} font-mono`}>{order.job_number}</div>
                  {order.job_templates && (
                    <div className={`text-xs ${t.textSecondary}`}>📋 {order.job_templates.name}</div>
                  )}
                  {order.order_type === 'quote' && (
                    <div className="mt-1">{getTypeBadge(order.order_type)}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm ${t.text}`}>
                    {order.customers?.first_name} {order.customers?.last_name}
                  </div>
                  <div className={`text-xs ${t.textSecondary}`}>{order.customers?.phone}</div>
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm ${t.text}`}>
                    {order.vehicles?.year} {order.vehicles?.make} {order.vehicles?.model}
                  </div>
                  <div className={`text-xs ${t.textSecondary}`}>{order.vehicles?.registration}</div>
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm ${t.text} max-w-xs truncate`}>{order.description}</div>
                </td>
                <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-2">
                      <button
                        onClick={() => viewOrderDetails(order)}
                        className="text-blue-500 hover:text-blue-700 font-medium text-sm">
                        View
                      </button>
                      <button
                        onClick={() => {
                          setJobCardOrderId(order.id)
                          setShowJobCard(true)
                        }}
                        className="text-purple-500 hover:text-purple-700 font-medium text-sm">
                        📋 Card
                      </button>
                    </div>
                    {order.status === 'completed' && (
                      <button
                        onClick={() => createInvoiceFromJob(order.id)}
                        className="text-green-500 hover:text-green-700 font-medium text-sm">
                        💰 Invoice
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-6xl ${t.border} border-2 my-8`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <div>
                <h3 className={`text-2xl font-bold ${t.text}`}>{selectedOrder.job_number}</h3>
                <p className={`text-sm ${t.textSecondary} mt-1`}>
                  {selectedOrder.customers?.first_name} {selectedOrder.customers?.last_name} • 
                  {selectedOrder.vehicles?.year} {selectedOrder.vehicles?.make} {selectedOrder.vehicles?.model}
                </p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Status Controls */}
              <div className={`${t.surface} ${t.border} border rounded-lg p-4 mb-6`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-sm ${t.textSecondary}`}>Current Status:</div>
                    <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                  </div>
                  <div className="flex gap-2">
                    {selectedOrder.status === 'pending' && (
                      <button onClick={() => updateStatus(selectedOrder.id, 'in_progress')}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium">
                        Start Job
                      </button>
                    )}
                    {selectedOrder.status === 'in_progress' && (
                      <>
                        <button onClick={() => updateStatus(selectedOrder.id, 'wait_parts')}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded font-medium">
                          Wait Parts
                        </button>
                        <button onClick={() => updateStatus(selectedOrder.id, 'completed')}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium">
                          Complete
                        </button>
                      </>
                    )}
                    {selectedOrder.status === 'completed' && (
                      <button onClick={() => createInvoiceFromJob(selectedOrder.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium text-lg">
                        💰 Create Invoice
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Photos Section */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h4 className={`text-xl font-bold ${t.text}`}>📷 Photos ({photos.length})</h4>
                  <button
                    onClick={() => setShowPhotoUploader(!showPhotoUploader)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium">
                    {showPhotoUploader ? 'Hide' : '+ Upload Photo'}
                  </button>
                </div>

                {showPhotoUploader && (
                  <PhotoUploader
                    workOrderId={selectedOrder.id}
                    onUploadComplete={() => {
                      viewOrderDetails(selectedOrder)
                      setShowPhotoUploader(false)
                    }}
                    theme={t}
                  />
                )}

                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    {photos.map(photo => (
                      <div key={photo.id} className={`${t.surface} ${t.border} border rounded-lg overflow-hidden`}>
                        <img src={photo.photo_url} alt={photo.caption} className="w-full h-48 object-cover" />
                        <div className="p-2">
                          <div className={`text-xs ${t.text} font-semibold uppercase`}>{photo.photo_type}</div>
                          {photo.caption && <div className={`text-xs ${t.textSecondary}`}>{photo.caption}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Signatures Section */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h4 className={`text-xl font-bold ${t.text}`}>✍️ Signatures ({signatures.length})</h4>
                  <button
                    onClick={() => setShowSignature(!showSignature)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-medium">
                    {showSignature ? 'Hide' : '+ Get Signature'}
                  </button>
                </div>

                {showSignature && (
                  <DigitalSignature
                    workOrderId={selectedOrder.id}
                    signatureType="customer_completion"
                    onComplete={() => {
                      viewOrderDetails(selectedOrder)
                      setShowSignature(false)
                    }}
                    theme={t}
                  />
                )}

                {signatures.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {signatures.map(sig => (
                      <div key={sig.id} className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                        <div className={`text-sm font-semibold ${t.text} mb-2`}>
                          {sig.signature_type.replace('_', ' ').toUpperCase()}
                        </div>
                        <img src={sig.signature_data} alt="signature" className="border rounded mb-2" />
                        <div className={`text-xs ${t.textSecondary}`}>
                          Signed by: {sig.signed_by_name} • {new Date(sig.signed_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job Card Modal */}
      {showJobCard && jobCardOrderId && (
        <JobCard
          workOrderId={jobCardOrderId}
          onClose={() => {
            setShowJobCard(false)
            setJobCardOrderId(null)
          }}
          theme={t}
        />
      )}
    </div>
  )
}