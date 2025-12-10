import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function EnhancedWorkOrder({ theme: t, job, onClose, onSave, currentUser }) {
  const [activeTab, setActiveTab] = useState('details')
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [inventoryParts, setInventoryParts] = useState([])
  const [jobParts, setJobParts] = useState([])
  const [jobLabor, setJobLabor] = useState([])
  const [checklist, setChecklist] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [jobId, setJobId] = useState(job?.id || null)
  const [tradeIn, setTradeIn] = useState({
    has_trade_in: false,
    trade_make: '',
    trade_model: '',
    trade_year: '',
    trade_rego: '',
    trade_odometer: '',
    trade_condition: 'good',
    trade_value_estimate: '',
    trade_notes: ''
  })

  // Get mechanic display name
  const getMechanicName = (mechanic) => {
    if (!mechanic) return 'Unknown'
    if (mechanic.name) return mechanic.name
    if (mechanic.first_name) return `${mechanic.first_name} ${mechanic.last_name || ''}`.trim()
    return 'Unnamed'
  }

  const [formData, setFormData] = useState({
    customer_id: '',
    vehicle_id: '',
    description: '',
    status: 'pending',
    priority: 'normal',
    assigned_mechanic_id: '',
    scheduled_start: '',
    promised_date: '',
    customer_waiting: false,
    internal_notes: '',
    customer_notes: '',
    mechanic_notes: '',
    work_completed: '',
    work_required: ''
  })

  useEffect(() => {
    loadData()
    if (job?.id) {
      setJobId(job.id)
      loadJobDetails(job.id)
    }
  }, [job])

  useEffect(() => {
    if (formData.customer_id) {
      loadCustomerVehicles(formData.customer_id)
    }
  }, [formData.customer_id])

  const loadData = async () => {
    const [customersRes, mechanicsRes, partsRes] = await Promise.all([
      supabase.from('customers').select('*').order('first_name'),
      supabase.from('mechanics').select('*').eq('active', true),
      supabase.from('parts').select('*').limit(100)
    ])
    if (customersRes.data) setCustomers(customersRes.data)
    if (mechanicsRes.data) setMechanics(mechanicsRes.data)
    if (partsRes.data) setInventoryParts(partsRes.data)
  }

  const loadCustomerVehicles = async (customerId) => {
    const { data } = await supabase.from('vehicles').select('*').eq('customer_id', customerId)
    if (data) setVehicles(data)
  }

  const loadJobDetails = async (id) => {
    const { data: jobData } = await supabase.from('work_orders').select('*').eq('id', id).single()
    if (jobData) {
      setFormData({
        customer_id: jobData.customer_id || '',
        vehicle_id: jobData.vehicle_id || '',
        description: jobData.description || '',
        status: jobData.status || 'pending',
        priority: jobData.priority || 'normal',
        assigned_mechanic_id: jobData.assigned_mechanic_id || '',
        scheduled_start: jobData.scheduled_start ? jobData.scheduled_start.slice(0, 16) : '',
        promised_date: jobData.promised_date || '',
        customer_waiting: jobData.customer_waiting || false,
        internal_notes: jobData.internal_notes || '',
        customer_notes: jobData.customer_notes || '',
        mechanic_notes: jobData.mechanic_notes || '',
        work_completed: jobData.work_completed || '',
        work_required: jobData.work_required || ''
      })
      if (jobData.customer_id) loadCustomerVehicles(jobData.customer_id)
    }

    // Load parts
    const { data: parts } = await supabase.from('work_order_parts').select('*').eq('work_order_id', id)
    if (parts) setJobParts(parts)

    // Load labor
    const { data: labor } = await supabase.from('work_order_labor').select('*').eq('work_order_id', id)
    if (labor) setJobLabor(labor)

    // Load checklist
    const { data: checklistData, error: checklistError } = await supabase.from('work_order_checklist').select('*').eq('work_order_id', id)
    if (checklistData) {
      // Sort client-side in case sort_order doesn't exist
      const sorted = [...checklistData].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      setChecklist(sorted)
    }
    if (checklistError) console.log('Checklist load error:', checklistError)
  }

  // Save job and return ID (for new jobs)
  const ensureJobSaved = async () => {
    if (jobId) return jobId

    const jobNumber = 'JOB-' + Date.now()
    const { data, error } = await supabase.from('work_orders').insert([{
      ...formData,
      job_number: jobNumber,
      created_at: new Date().toISOString()
    }]).select().single()

    if (data) {
      setJobId(data.id)
      return data.id
    }
    return null
  }

  const handleSave = async () => {
    let savedId = jobId

    if (jobId) {
      await supabase.from('work_orders').update(formData).eq('id', jobId)
    } else {
      const jobNumber = 'JOB-' + Date.now()
      const { data } = await supabase.from('work_orders').insert([{
        ...formData,
        job_number: jobNumber
      }]).select().single()
      if (data) savedId = data.id
    }

    if (onSave) onSave()
    if (onClose) onClose()
  }

  // AI ESTIMATES - More consistent with fixed logic
  const getAIEstimate = async (type) => {
    setAiLoading(true)
    setAiSuggestion(null)

    const vehicle = vehicles.find(v => v.id === formData.vehicle_id)
    const description = formData.description?.toLowerCase() || ''

    // Fixed estimates based on job type - NO RANDOMNESS
    let result = { hours: 1, explanation: '' }

    if (description.includes('first service') || description.includes('1st service') || description.includes('run in') || description.includes('run-in')) {
      result = { hours: 1.5, explanation: '1.5h - First service: oil change, filter, basic inspection, torque checks' }
    } else if (description.includes('major service') || description.includes('full service')) {
      result = { hours: 4, explanation: '4h - Major service: all fluids, filters, brakes, chain, full inspection' }
    } else if (description.includes('minor service') || description.includes('basic service')) {
      result = { hours: 2, explanation: '2h - Minor service: oil, filter, chain adjustment, safety check' }
    } else if (description.includes('tyre') || description.includes('tire')) {
      result = { hours: 1, explanation: '1h - Tyre change including balance and pressure check' }
    } else if (description.includes('brake')) {
      result = { hours: 2.5, explanation: '2.5h - Brake service: pads, fluid flush, inspection' }
    } else if (description.includes('chain') && description.includes('sprocket')) {
      result = { hours: 2, explanation: '2h - Chain and sprocket replacement' }
    } else if (description.includes('fork') || description.includes('suspension')) {
      result = { hours: 3, explanation: '3h - Suspension service: seals, oil, adjustment' }
    } else if (description.includes('diagnostic') || description.includes('fault')) {
      result = { hours: 1.5, explanation: '1.5h - Diagnostic and fault finding' }
    } else if (description.includes('clutch')) {
      result = { hours: 3, explanation: '3h - Clutch replacement/adjustment' }
    } else if (description.includes('valve') || description.includes('clearance')) {
      result = { hours: 3, explanation: '3h - Valve clearance check and adjustment' }
    } else if (description.includes('electrical') || description.includes('wiring')) {
      result = { hours: 2, explanation: '2h - Electrical diagnosis and repair' }
    } else if (description.includes('inspection') || description.includes('check')) {
      result = { hours: 1, explanation: '1h - General inspection and safety check' }
    } else {
      result = { hours: 2, explanation: '2h - Standard workshop time for general repair' }
    }

    setAiSuggestion(result)
    setAiLoading(false)
  }

  // AI Parts suggestion - CONSISTENT
  const getAIParts = async () => {
    setAiLoading(true)
    const description = formData.description?.toLowerCase() || ''
    const vehicle = vehicles.find(v => v.id === formData.vehicle_id)

    let parts = []

    if (description.includes('first service') || description.includes('1st service') || description.includes('run in')) {
      // ONLY oil and filter for first service
      parts = [
        { name: 'Engine Oil 10W-40 (1L)', quantity: 3, unit_price: 25 },
        { name: 'Oil Filter', quantity: 1, unit_price: 18 }
      ]
    } else if (description.includes('major service') || description.includes('full service')) {
      parts = [
        { name: 'Engine Oil 10W-40 (1L)', quantity: 4, unit_price: 25 },
        { name: 'Oil Filter', quantity: 1, unit_price: 18 },
        { name: 'Air Filter', quantity: 1, unit_price: 35 },
        { name: 'Spark Plug', quantity: 2, unit_price: 15 },
        { name: 'Brake Fluid DOT4 (500ml)', quantity: 1, unit_price: 22 },
        { name: 'Coolant (1L)', quantity: 1, unit_price: 18 }
      ]
    } else if (description.includes('minor service') || description.includes('basic service')) {
      parts = [
        { name: 'Engine Oil 10W-40 (1L)', quantity: 3, unit_price: 25 },
        { name: 'Oil Filter', quantity: 1, unit_price: 18 },
        { name: 'Air Filter', quantity: 1, unit_price: 35 }
      ]
    } else if (description.includes('brake')) {
      parts = [
        { name: 'Front Brake Pads', quantity: 1, unit_price: 65 },
        { name: 'Rear Brake Pads', quantity: 1, unit_price: 55 },
        { name: 'Brake Fluid DOT4 (500ml)', quantity: 1, unit_price: 22 }
      ]
    } else if (description.includes('chain') && description.includes('sprocket')) {
      parts = [
        { name: 'Chain Kit (Chain + Sprockets)', quantity: 1, unit_price: 250 }
      ]
    } else if (description.includes('tyre') || description.includes('tire')) {
      parts = [
        { name: 'Tyre - as quoted', quantity: 1, unit_price: 200 }
      ]
    }

    // Add parts to job
    if (parts.length > 0) {
      const savedJobId = await ensureJobSaved()
      if (savedJobId) {
        for (const part of parts) {
          await supabase.from('work_order_parts').insert([{
            work_order_id: savedJobId,
            name: part.name,
            quantity: part.quantity,
            unit_price: part.unit_price,
            cost_price: part.unit_price * 0.6
          }])
        }
        loadJobDetails(savedJobId)
      }
    }

    setAiLoading(false)
  }

  // AI Checklist - Pass/Fail format
  const getAIChecklist = async () => {
    setAiLoading(true)
    const description = formData.description?.toLowerCase() || ''

    let items = []

    if (description.includes('first service') || description.includes('1st service') || description.includes('run in')) {
      items = [
        { category: 'Engine', item_text: 'Oil level correct after change' },
        { category: 'Engine', item_text: 'Oil filter installed correctly' },
        { category: 'Engine', item_text: 'No oil leaks present' },
        { category: 'Fasteners', item_text: 'Engine bolts torqued to spec' },
        { category: 'Fasteners', item_text: 'Axle nuts torqued' },
        { category: 'Controls', item_text: 'Throttle operation smooth' },
        { category: 'Controls', item_text: 'Clutch lever adjustment' },
        { category: 'Controls', item_text: 'Brake lever feel' },
        { category: 'Electrical', item_text: 'All lights functioning' },
        { category: 'Electrical', item_text: 'Horn working' },
        { category: 'Chain', item_text: 'Chain tension correct' },
        { category: 'Chain', item_text: 'Chain lubrication' }
      ]
    } else if (description.includes('major service') || description.includes('full service')) {
      items = [
        { category: 'Engine', item_text: 'Oil and filter changed' },
        { category: 'Engine', item_text: 'Coolant level and condition' },
        { category: 'Engine', item_text: 'Air filter condition' },
        { category: 'Brakes', item_text: 'Front brake pad thickness' },
        { category: 'Brakes', item_text: 'Rear brake pad thickness' },
        { category: 'Brakes', item_text: 'Brake fluid level and condition' },
        { category: 'Brakes', item_text: 'Brake line condition' },
        { category: 'Suspension', item_text: 'Fork seal condition' },
        { category: 'Suspension', item_text: 'Rear shock operation' },
        { category: 'Chain', item_text: 'Chain wear measurement' },
        { category: 'Chain', item_text: 'Sprocket wear' },
        { category: 'Tyres', item_text: 'Front tyre tread depth' },
        { category: 'Tyres', item_text: 'Rear tyre tread depth' },
        { category: 'Tyres', item_text: 'Tyre pressures set' },
        { category: 'Electrical', item_text: 'Battery condition' },
        { category: 'Electrical', item_text: 'All lights working' },
        { category: 'Controls', item_text: 'Throttle cables' },
        { category: 'Controls', item_text: 'Clutch operation' }
      ]
    } else {
      items = [
        { category: 'General', item_text: 'Visual inspection complete' },
        { category: 'General', item_text: 'Test ride completed' },
        { category: 'Safety', item_text: 'Brakes tested' },
        { category: 'Safety', item_text: 'Lights checked' },
        { category: 'Safety', item_text: 'Controls functioning' }
      ]
    }

    // Save checklist items
    const savedJobId = await ensureJobSaved()
    if (savedJobId) {
      try {
        // Delete existing checklist first
        await supabase.from('work_order_checklist').delete().eq('work_order_id', savedJobId)
        
        for (let i = 0; i < items.length; i++) {
          const { error } = await supabase.from('work_order_checklist').insert([{
            work_order_id: savedJobId,
            item_text: items[i].item_text,
            category: items[i].category,
            sort_order: i,
            status: 'pending',
            fail_notes: ''
          }])
          if (error) {
            console.error('Checklist insert error:', error)
            // Try without sort_order
            await supabase.from('work_order_checklist').insert([{
              work_order_id: savedJobId,
              item_text: items[i].item_text,
              category: items[i].category,
              status: 'pending'
            }])
          }
        }
        loadJobDetails(savedJobId)
      } catch (err) {
        console.error('Error generating checklist:', err)
        alert('Error generating checklist: ' + err.message)
      }
    }

    setAiLoading(false)
  }

  // Update checklist item status
  const updateChecklistItem = async (itemId, status, notes = '') => {
    if (status === 'fail' && !notes.trim()) {
      alert('Please provide notes for failed items')
      return
    }

    await supabase.from('work_order_checklist').update({
      status: status,
      fail_notes: notes,
      completed_at: status !== 'pending' ? new Date().toISOString() : null,
      completed_by: currentUser?.id
    }).eq('id', itemId)

    setChecklist(checklist.map(item => 
      item.id === itemId ? { ...item, status, fail_notes: notes } : item
    ))
  }

  // Add part
  const addPart = async (partData) => {
    const savedJobId = await ensureJobSaved()
    if (!savedJobId) return

    await supabase.from('work_order_parts').insert([{
      work_order_id: savedJobId,
      ...partData
    }])
    loadJobDetails(savedJobId)
  }

  // Remove part
  const removePart = async (partId) => {
    await supabase.from('work_order_parts').delete().eq('id', partId)
    setJobParts(jobParts.filter(p => p.id !== partId))
  }

  // Add labor
  const addLabor = async (laborData) => {
    const savedJobId = await ensureJobSaved()
    if (!savedJobId) return

    await supabase.from('work_order_labor').insert([{
      work_order_id: savedJobId,
      ...laborData
    }])
    loadJobDetails(savedJobId)
  }

  // Calculate totals
  const partsTotal = jobParts.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0)
  const laborTotal = jobLabor.reduce((sum, l) => sum + (l.hours * l.rate), 0)
  const grandTotal = partsTotal + laborTotal

  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'parts', label: `Parts (${jobParts.length})` },
    { id: 'labor', label: 'Labor' },
    { id: 'checklist', label: `Checklist (${checklist.length})` },
    { id: 'tradein', label: 'Trade-In' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col ${t.border} border`}>
        {/* Header */}
        <div className={`${t.border} border-b p-4 flex justify-between items-center`}>
          <div>
            <h2 className={`text-2xl font-bold ${t.text}`}>
              {job?.job_number || 'New Work Order'}
            </h2>
            <div className={`text-sm ${t.textSecondary}`}>
              {job?.id ? 'Edit Job' : 'Create New Job'}
            </div>
          </div>
          <button onClick={onClose} className="text-red-500 hover:text-red-400 text-3xl font-bold">✕</button>
        </div>

        {/* Tabs */}
        <div className={`flex ${t.border} border-b`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : `${t.text} hover:bg-gray-700`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Customer *</label>
                  <select value={formData.customer_id}
                    onChange={(e) => setFormData({...formData, customer_id: e.target.value, vehicle_id: ''})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}>
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Vehicle</label>
                  <select value={formData.vehicle_id}
                    onChange={(e) => setFormData({...formData, vehicle_id: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}>
                    <option value="">Select Vehicle</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} - {v.registration}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Job Description *</label>
                <textarea value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  rows="3"
                  placeholder="e.g., First service, Major service, Tyre change..." />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Status</label>
                  <select value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_on_parts">Waiting on Parts</option>
                    <option value="completed">Completed</option>
                    <option value="invoiced">Invoiced</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Priority</label>
                  <select value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Assigned To</label>
                  <select value={formData.assigned_mechanic_id}
                    onChange={(e) => setFormData({...formData, assigned_mechanic_id: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}>
                    <option value="">Unassigned</option>
                    {mechanics.map(m => <option key={m.id} value={m.id}>{getMechanicName(m)}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Scheduled Start</label>
                  <input type="datetime-local" value={formData.scheduled_start}
                    onChange={(e) => setFormData({...formData, scheduled_start: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Promised Date</label>
                  <input type="date" value={formData.promised_date}
                    onChange={(e) => setFormData({...formData, promised_date: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="customerWaiting" checked={formData.customer_waiting}
                  onChange={(e) => setFormData({...formData, customer_waiting: e.target.checked})}
                  className="w-5 h-5" />
                <label htmlFor="customerWaiting" className={`${t.text} font-medium`}>
                  ⏳ Customer Waiting
                </label>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Customer Notes</label>
                <textarea value={formData.customer_notes}
                  onChange={(e) => setFormData({...formData, customer_notes: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  rows="2"
                  placeholder="Notes from customer..." />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Internal Notes</label>
                <textarea value={formData.internal_notes}
                  onChange={(e) => setFormData({...formData, internal_notes: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  rows="2"
                  placeholder="Internal workshop notes..." />
              </div>
            </div>
          )}

          {/* Parts Tab */}
          {activeTab === 'parts' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className={`text-lg font-bold ${t.text}`}>Parts</h3>
                <button onClick={getAIParts} disabled={aiLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  {aiLoading ? '⏳' : '🤖'} AI Suggest Parts
                </button>
              </div>

              {jobParts.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className={`${t.border} border-b`}>
                      <th className={`text-left py-2 ${t.text}`}>Part</th>
                      <th className={`text-center py-2 ${t.text}`}>Qty</th>
                      <th className={`text-right py-2 ${t.text}`}>Price</th>
                      <th className={`text-right py-2 ${t.text}`}>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobParts.map(part => (
                      <tr key={part.id} className={`${t.border} border-b`}>
                        <td className={`py-2 ${t.text}`}>{part.name}</td>
                        <td className={`text-center py-2 ${t.text}`}>{part.quantity}</td>
                        <td className={`text-right py-2 ${t.text}`}>${part.unit_price?.toFixed(2)}</td>
                        <td className={`text-right py-2 ${t.text}`}>${(part.quantity * part.unit_price).toFixed(2)}</td>
                        <td className="text-right py-2">
                          <button onClick={() => removePart(part.id)} className="text-red-500 hover:text-red-400">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="3" className={`text-right font-bold py-2 ${t.text}`}>Parts Total:</td>
                      <td className={`text-right font-bold py-2 ${t.text}`}>${partsTotal.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className={`text-center py-8 ${t.textSecondary}`}>
                  No parts added yet. Use AI Suggest or add manually.
                </div>
              )}

              {/* Add part form */}
              <div className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                <h4 className={`font-bold ${t.text} mb-3`}>Add Part</h4>
                <div className="grid grid-cols-4 gap-3">
                  <input type="text" placeholder="Part name" id="newPartName"
                    className={`px-3 py-2 ${t.input} rounded border`} />
                  <input type="number" placeholder="Qty" defaultValue="1" id="newPartQty"
                    className={`px-3 py-2 ${t.input} rounded border`} />
                  <input type="number" step="0.01" placeholder="Price" id="newPartPrice"
                    className={`px-3 py-2 ${t.input} rounded border`} />
                  <button onClick={() => {
                    const name = document.getElementById('newPartName').value
                    const qty = parseInt(document.getElementById('newPartQty').value) || 1
                    const price = parseFloat(document.getElementById('newPartPrice').value) || 0
                    if (name) {
                      addPart({ name, quantity: qty, unit_price: price, cost_price: price * 0.6 })
                      document.getElementById('newPartName').value = ''
                      document.getElementById('newPartQty').value = '1'
                      document.getElementById('newPartPrice').value = ''
                    }
                  }} className="bg-green-600 hover:bg-green-700 text-white rounded">
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Labor Tab */}
          {activeTab === 'labor' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className={`text-lg font-bold ${t.text}`}>Labor</h3>
                <button onClick={() => getAIEstimate('time')} disabled={aiLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  {aiLoading ? '⏳' : '🤖'} AI Estimate
                </button>
              </div>

              {aiSuggestion && (
                <div className="bg-purple-500 bg-opacity-20 rounded-lg p-4">
                  <div className={`font-bold ${t.text}`}>🤖 {aiSuggestion.hours}h - {aiSuggestion.explanation}</div>
                  <button onClick={() => {
                    addLabor({ description: formData.description, hours: aiSuggestion.hours, rate: 120 })
                    setAiSuggestion(null)
                  }} className="mt-2 bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded">
                    Apply
                  </button>
                </div>
              )}

              {jobLabor.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className={`${t.border} border-b`}>
                      <th className={`text-left py-2 ${t.text}`}>Description</th>
                      <th className={`text-center py-2 ${t.text}`}>Hours</th>
                      <th className={`text-right py-2 ${t.text}`}>Rate</th>
                      <th className={`text-right py-2 ${t.text}`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobLabor.map(labor => (
                      <tr key={labor.id} className={`${t.border} border-b`}>
                        <td className={`py-2 ${t.text}`}>{labor.description}</td>
                        <td className={`text-center py-2 ${t.text}`}>{labor.hours}h</td>
                        <td className={`text-right py-2 ${t.text}`}>${labor.rate}/hr</td>
                        <td className={`text-right py-2 ${t.text}`}>${(labor.hours * labor.rate).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="3" className={`text-right font-bold py-2 ${t.text}`}>Labor Total:</td>
                      <td className={`text-right font-bold py-2 ${t.text}`}>${laborTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className={`text-center py-8 ${t.textSecondary}`}>
                  No labor entries yet. Use AI Estimate or add manually.
                </div>
              )}

              {/* Add labor form */}
              <div className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                <h4 className={`font-bold ${t.text} mb-3`}>Add Labor</h4>
                <div className="grid grid-cols-4 gap-3">
                  <input type="text" placeholder="Description" id="newLaborDesc"
                    className={`px-3 py-2 ${t.input} rounded border col-span-2`} />
                  <input type="number" step="0.5" placeholder="Hours" id="newLaborHours"
                    className={`px-3 py-2 ${t.input} rounded border`} />
                  <button onClick={() => {
                    const desc = document.getElementById('newLaborDesc').value
                    const hours = parseFloat(document.getElementById('newLaborHours').value) || 1
                    if (desc) {
                      addLabor({ description: desc, hours, rate: 120 })
                      document.getElementById('newLaborDesc').value = ''
                      document.getElementById('newLaborHours').value = ''
                    }
                  }} className="bg-green-600 hover:bg-green-700 text-white rounded">
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Checklist Tab - PASS/FAIL */}
          {activeTab === 'checklist' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className={`text-lg font-bold ${t.text}`}>Inspection Checklist</h3>
                <button onClick={getAIChecklist} disabled={aiLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                  {aiLoading ? '⏳' : '🤖'} Generate Checklist
                </button>
              </div>

              {checklist.length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(checklist.reduce((acc, item) => {
                    const cat = item.category || 'General'
                    if (!acc[cat]) acc[cat] = []
                    acc[cat].push(item)
                    return acc
                  }, {})).map(([category, items]) => (
                    <div key={category} className={`${t.surface} ${t.border} border rounded-lg overflow-hidden`}>
                      <div className={`px-4 py-2 ${t.border} border-b bg-gray-800`}>
                        <h4 className={`font-bold ${t.text}`}>{category}</h4>
                      </div>
                      <div className="divide-y divide-gray-700">
                        {items.map(item => (
                          <ChecklistItem 
                            key={item.id} 
                            item={item} 
                            theme={t}
                            onUpdate={updateChecklistItem}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-center py-8 ${t.textSecondary}`}>
                  No checklist items. Click "Generate Checklist" to create one based on the job type.
                </div>
              )}
            </div>
          )}

          {/* Trade-In Tab */}
          {activeTab === 'tradein' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <input type="checkbox" id="hasTradeIn" checked={tradeIn.has_trade_in}
                  onChange={(e) => setTradeIn({...tradeIn, has_trade_in: e.target.checked})}
                  className="w-5 h-5" />
                <label htmlFor="hasTradeIn" className={`font-bold ${t.text}`}>
                  Customer has a trade-in vehicle
                </label>
              </div>

              {tradeIn.has_trade_in && (
                <div className="space-y-4">
                  <div className={`bg-yellow-500 bg-opacity-20 rounded-lg p-4`}>
                    <h4 className={`font-bold ${t.text} mb-3`}>🏍️ Trade-In Vehicle Details</h4>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className={`block text-sm ${t.text} mb-1`}>Make</label>
                        <input type="text" value={tradeIn.trade_make}
                          onChange={(e) => setTradeIn({...tradeIn, trade_make: e.target.value})}
                          className={`w-full px-3 py-2 ${t.input} rounded border`}
                          placeholder="e.g., Honda" />
                      </div>
                      <div>
                        <label className={`block text-sm ${t.text} mb-1`}>Model</label>
                        <input type="text" value={tradeIn.trade_model}
                          onChange={(e) => setTradeIn({...tradeIn, trade_model: e.target.value})}
                          className={`w-full px-3 py-2 ${t.input} rounded border`}
                          placeholder="e.g., CBR600RR" />
                      </div>
                      <div>
                        <label className={`block text-sm ${t.text} mb-1`}>Year</label>
                        <input type="text" value={tradeIn.trade_year}
                          onChange={(e) => setTradeIn({...tradeIn, trade_year: e.target.value})}
                          className={`w-full px-3 py-2 ${t.input} rounded border`}
                          placeholder="e.g., 2020" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className={`block text-sm ${t.text} mb-1`}>Registration</label>
                        <input type="text" value={tradeIn.trade_rego}
                          onChange={(e) => setTradeIn({...tradeIn, trade_rego: e.target.value})}
                          className={`w-full px-3 py-2 ${t.input} rounded border`}
                          placeholder="e.g., ABC123" />
                      </div>
                      <div>
                        <label className={`block text-sm ${t.text} mb-1`}>Odometer (km)</label>
                        <input type="text" value={tradeIn.trade_odometer}
                          onChange={(e) => setTradeIn({...tradeIn, trade_odometer: e.target.value})}
                          className={`w-full px-3 py-2 ${t.input} rounded border`}
                          placeholder="e.g., 25000" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className={`block text-sm ${t.text} mb-1`}>Condition</label>
                        <select value={tradeIn.trade_condition}
                          onChange={(e) => setTradeIn({...tradeIn, trade_condition: e.target.value})}
                          className={`w-full px-3 py-2 ${t.input} rounded border`}>
                          <option value="excellent">Excellent</option>
                          <option value="good">Good</option>
                          <option value="fair">Fair</option>
                          <option value="poor">Poor</option>
                        </select>
                      </div>
                      <div>
                        <label className={`block text-sm ${t.text} mb-1`}>Estimated Value ($)</label>
                        <input type="number" value={tradeIn.trade_value_estimate}
                          onChange={(e) => setTradeIn({...tradeIn, trade_value_estimate: e.target.value})}
                          className={`w-full px-3 py-2 ${t.input} rounded border`}
                          placeholder="e.g., 8500" />
                      </div>
                    </div>

                    <div>
                      <label className={`block text-sm ${t.text} mb-1`}>Trade-In Notes</label>
                      <textarea value={tradeIn.trade_notes}
                        onChange={(e) => setTradeIn({...tradeIn, trade_notes: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                        rows="3"
                        placeholder="Condition notes, damage, modifications, service history..." />
                    </div>
                  </div>

                  {/* Trade-in inspection checklist */}
                  <div className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                    <h4 className={`font-bold ${t.text} mb-3`}>📋 Trade-In Inspection</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        'Engine starts and runs',
                        'No unusual noises',
                        'Clutch operates correctly',
                        'Gears select properly',
                        'Brakes functional',
                        'Lights all working',
                        'No visible damage',
                        'No oil leaks',
                        'Chain/belt condition',
                        'Tyre condition',
                        'Service history available',
                        'Keys and documents present'
                      ].map((item, i) => (
                        <label key={i} className={`flex items-center gap-2 ${t.text}`}>
                          <input type="checkbox" className="w-4 h-4" />
                          {item}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!tradeIn.has_trade_in && (
                <div className={`text-center py-8 ${t.textSecondary}`}>
                  <div className="text-4xl mb-2">🏍️</div>
                  <div>No trade-in for this job</div>
                  <div className="text-sm">Check the box above if customer is trading in a vehicle</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`${t.border} border-t p-4 flex justify-between items-center`}>
          <div className={`text-xl font-bold ${t.text}`}>
            Total: ${grandTotal.toFixed(2)}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose}
              className={`px-6 py-2 ${t.surface} ${t.text} ${t.border} border rounded-lg`}>
              Cancel
            </button>
            <button onClick={handleSave}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold">
              💾 Save Work Order
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Checklist Item Component with Pass/Fail
function ChecklistItem({ item, theme: t, onUpdate }) {
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState(item.fail_notes || '')

  const handleStatusChange = (status) => {
    if (status === 'fail') {
      setShowNotes(true)
    } else {
      onUpdate(item.id, status, '')
      setShowNotes(false)
    }
  }

  const handleFailSubmit = () => {
    if (!notes.trim()) {
      alert('Please provide notes for failed items')
      return
    }
    onUpdate(item.id, 'fail', notes)
    setShowNotes(false)
  }

  return (
    <div className={`p-3 ${item.status === 'fail' ? 'bg-red-500 bg-opacity-10' : item.status === 'pass' ? 'bg-green-500 bg-opacity-10' : ''}`}>
      <div className="flex items-center justify-between">
        <span className={t.text}>{item.item_text}</span>
        <div className="flex gap-2">
          <button
            onClick={() => handleStatusChange('pass')}
            className={`px-3 py-1 rounded text-sm font-bold ${
              item.status === 'pass' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-600 text-gray-300 hover:bg-green-600 hover:text-white'
            }`}
          >
            ✓ Pass
          </button>
          <button
            onClick={() => handleStatusChange('fail')}
            className={`px-3 py-1 rounded text-sm font-bold ${
              item.status === 'fail' 
                ? 'bg-red-600 text-white' 
                : 'bg-gray-600 text-gray-300 hover:bg-red-600 hover:text-white'
            }`}
          >
            ✗ Fail
          </button>
        </div>
      </div>

      {/* Fail notes */}
      {(showNotes || item.status === 'fail') && (
        <div className="mt-2">
          {item.status === 'fail' && item.fail_notes ? (
            <div className={`text-sm text-red-400 bg-red-500 bg-opacity-20 rounded p-2`}>
              <strong>Issue:</strong> {item.fail_notes}
            </div>
          ) : showNotes && (
            <div className="flex gap-2">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe the issue (required)..."
                className={`flex-1 px-3 py-1 ${t.input} rounded border text-sm`}
                autoFocus
              />
              <button
                onClick={handleFailSubmit}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
              >
                Save
              </button>
              <button
                onClick={() => setShowNotes(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
