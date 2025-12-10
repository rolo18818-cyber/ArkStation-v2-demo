import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function CustomerPortal({ theme: t }) {
  const [searchMode, setSearchMode] = useState('phone')
  const [searchValue, setSearchValue] = useState('')
  const [customer, setCustomer] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [invoices, setInvoices] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const searchCustomer = async () => {
    if (!searchValue.trim()) {
      setError('Please enter a search value')
      return
    }

    setLoading(true)
    setError('')
    setCustomer(null)

    let query = supabase.from('customers').select('*')
    
    if (searchMode === 'phone') {
      query = query.ilike('phone', `%${searchValue}%`)
    } else if (searchMode === 'email') {
      query = query.ilike('email', `%${searchValue}%`)
    } else if (searchMode === 'rego') {
      // Search by vehicle registration
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('customer_id')
        .ilike('registration', `%${searchValue}%`)
        .limit(1)
        .single()

      if (vehicleData) {
        query = query.eq('id', vehicleData.customer_id)
      } else {
        setError('No vehicle found with that registration')
        setLoading(false)
        return
      }
    }

    const { data, error: queryError } = await query.limit(1).single()

    if (queryError || !data) {
      setError('Customer not found. Please check your details.')
      setLoading(false)
      return
    }

    setCustomer(data)
    await loadCustomerData(data.id)
    setLoading(false)
  }

  const loadCustomerData = async (customerId) => {
    // Load vehicles
    const { data: vehicleData } = await supabase
      .from('vehicles')
      .select('*')
      .eq('customer_id', customerId)
      .order('year', { ascending: false })
    setVehicles(vehicleData || [])

    // Load work orders
    const { data: woData } = await supabase
      .from('work_orders')
      .select(`
        *,
        vehicles(year, make, model, registration),
        mechanics(first_name, last_name)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20)
    setWorkOrders(woData || [])

    // Load invoices
    const { data: invData } = await supabase
      .from('invoices')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20)
    setInvoices(invData || [])
  }

  const loadJobDetails = async (workOrderId) => {
    const { data: wo } = await supabase
      .from('work_orders')
      .select(`
        *,
        vehicles(year, make, model, registration),
        mechanics(first_name, last_name),
        work_order_labor(*),
        work_order_parts(*, parts(name, part_number))
      `)
      .eq('id', workOrderId)
      .single()

    setSelectedJob(wo)
  }

  const getStatusInfo = (status) => {
    const info = {
      pending: { color: 'bg-yellow-500', text: 'Waiting to Start', icon: '⏳', progress: 10 },
      in_progress: { color: 'bg-blue-500', text: 'In Progress', icon: '🔧', progress: 50 },
      waiting_on_parts: { color: 'bg-orange-500', text: 'Waiting on Parts', icon: '📦', progress: 40 },
      completed: { color: 'bg-green-500', text: 'Completed', icon: '✅', progress: 90 },
      invoiced: { color: 'bg-purple-500', text: 'Ready for Pickup', icon: '🎉', progress: 100 }
    }
    return info[status] || { color: 'bg-gray-500', text: status, icon: '❓', progress: 0 }
  }

  const logout = () => {
    setCustomer(null)
    setVehicles([])
    setWorkOrders([])
    setInvoices([])
    setSelectedJob(null)
    setSearchValue('')
  }

  // Login Screen
  if (!customer) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center p-4`}>
        <div className={`${t.surface} rounded-2xl shadow-2xl w-full max-w-md ${t.border} border-2 overflow-hidden`}>
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-center">
            <div className="text-5xl mb-3">🏍️</div>
            <h1 className="text-3xl font-bold text-white">Customer Portal</h1>
            <p className="text-blue-100 mt-2">Check your job status & history</p>
          </div>

          <div className="p-8">
            <div className="flex gap-2 mb-4">
              {[
                { id: 'phone', label: '📱 Phone' },
                { id: 'email', label: '📧 Email' },
                { id: 'rego', label: '🚗 Rego' }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setSearchMode(mode.id)}
                  className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${
                    searchMode === mode.id
                      ? 'bg-blue-600 text-white'
                      : `${t.surface} ${t.text} ${t.border} border`
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <input
              type={searchMode === 'email' ? 'email' : 'text'}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchCustomer()}
              placeholder={
                searchMode === 'phone' ? 'Enter your phone number...' :
                searchMode === 'email' ? 'Enter your email...' :
                'Enter your registration...'
              }
              className={`w-full px-4 py-3 ${t.input} rounded-lg border text-lg mb-4`}
            />

            {error && (
              <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <button
              onClick={searchCustomer}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-lg font-bold text-lg transition-all"
            >
              {loading ? '⏳ Searching...' : '🔍 Find My Jobs'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Job Detail View
  if (selectedJob) {
    const statusInfo = getStatusInfo(selectedJob.status)
    const laborTotal = selectedJob.work_order_labor?.reduce((sum, l) => sum + (l.amount || 0), 0) || 0
    const partsTotal = selectedJob.work_order_parts?.reduce((sum, p) => sum + (p.total_price || 0), 0) || 0

    return (
      <div className={`min-h-screen ${t.bg} p-4`}>
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setSelectedJob(null)}
            className={`${t.surface} ${t.text} px-4 py-2 rounded-lg mb-4 font-medium`}
          >
            ← Back to Jobs
          </button>

          <div className={`${t.surface} rounded-2xl shadow-xl ${t.border} border-2 overflow-hidden`}>
            {/* Header */}
            <div className={`${statusInfo.color} p-6 text-white`}>
              <div className="text-4xl mb-2">{statusInfo.icon}</div>
              <h2 className="text-2xl font-bold">{selectedJob.job_number}</h2>
              <p className="text-lg opacity-90">{statusInfo.text}</p>
            </div>

            {/* Progress Bar */}
            <div className="px-6 py-4 bg-black bg-opacity-20">
              <div className="flex justify-between text-sm text-white mb-2">
                <span>Progress</span>
                <span>{statusInfo.progress}%</span>
              </div>
              <div className="w-full h-3 bg-black bg-opacity-30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-500"
                  style={{ width: `${statusInfo.progress}%` }}
                />
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Vehicle */}
              <div className={`${t.surface} ${t.border} border rounded-xl p-4`}>
                <div className={`text-sm ${t.textSecondary}`}>Vehicle</div>
                <div className={`text-lg font-bold ${t.text}`}>
                  {selectedJob.vehicles?.year} {selectedJob.vehicles?.make} {selectedJob.vehicles?.model}
                </div>
                <div className={t.textSecondary}>{selectedJob.vehicles?.registration}</div>
              </div>

              {/* Description */}
              <div>
                <div className={`text-sm ${t.textSecondary} mb-1`}>Work Description</div>
                <div className={`${t.text}`}>{selectedJob.description || 'General service'}</div>
              </div>

              {/* Mechanic */}
              {selectedJob.mechanics && (
                <div>
                  <div className={`text-sm ${t.textSecondary} mb-1`}>Assigned Technician</div>
                  <div className={`${t.text} font-medium`}>
                    👨‍🔧 {selectedJob.mechanics.first_name} {selectedJob.mechanics.last_name}
                  </div>
                </div>
              )}

              {/* Work Done */}
              {selectedJob.work_order_labor?.length > 0 && (
                <div>
                  <div className={`text-sm ${t.textSecondary} mb-2`}>Work Performed</div>
                  <div className="space-y-2">
                    {selectedJob.work_order_labor.map((labor, idx) => (
                      <div key={idx} className={`${t.surface} ${t.border} border rounded-lg p-3 flex justify-between`}>
                        <span className={t.text}>{labor.description}</span>
                        <span className={`font-bold ${t.text}`}>${labor.amount?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parts Used */}
              {selectedJob.work_order_parts?.length > 0 && (
                <div>
                  <div className={`text-sm ${t.textSecondary} mb-2`}>Parts Used</div>
                  <div className="space-y-2">
                    {selectedJob.work_order_parts.map((part, idx) => (
                      <div key={idx} className={`${t.surface} ${t.border} border rounded-lg p-3 flex justify-between`}>
                        <span className={t.text}>{part.parts?.name} x{part.quantity}</span>
                        <span className={`font-bold ${t.text}`}>${part.total_price?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className={`${t.surface} ${t.border} border-2 rounded-xl p-4`}>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={t.textSecondary}>Labor</span>
                    <span className={t.text}>${laborTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={t.textSecondary}>Parts</span>
                    <span className={t.text}>${partsTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={t.textSecondary}>GST (10%)</span>
                    <span className={t.text}>${((laborTotal + partsTotal) * 0.1).toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between text-xl pt-2 border-t ${t.border}`}>
                    <span className={`font-bold ${t.text}`}>Estimated Total</span>
                    <span className="font-bold text-green-500">
                      ${((laborTotal + partsTotal) * 1.1).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Message */}
              <div className={`${statusInfo.color} bg-opacity-20 rounded-xl p-4 text-center`}>
                <div className="text-2xl mb-2">{statusInfo.icon}</div>
                <div className={`font-bold ${t.text}`}>
                  {selectedJob.status === 'invoiced' && "Your vehicle is ready for pickup! 🎉"}
                  {selectedJob.status === 'completed' && "Work is complete, invoice being prepared."}
                  {selectedJob.status === 'in_progress' && "Our team is working on your vehicle."}
                  {selectedJob.status === 'waiting_on_parts' && "Waiting for parts to arrive."}
                  {selectedJob.status === 'pending' && "Your job is in the queue."}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Dashboard View
  const activeJobs = workOrders.filter(wo => !['completed', 'invoiced'].includes(wo.status))
  const completedJobs = workOrders.filter(wo => ['completed', 'invoiced'].includes(wo.status))

  return (
    <div className={`min-h-screen ${t.bg} p-4`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className={`${t.surface} rounded-2xl p-6 mb-6 ${t.border} border`}>
          <div className="flex justify-between items-center">
            <div>
              <h1 className={`text-2xl font-bold ${t.text}`}>
                Welcome, {customer.first_name}! 👋
              </h1>
              <p className={t.textSecondary}>{customer.email || customer.phone}</p>
            </div>
            <button
              onClick={logout}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Active Jobs */}
        <div className="mb-6">
          <h2 className={`text-xl font-bold ${t.text} mb-4`}>🔧 Active Jobs ({activeJobs.length})</h2>
          {activeJobs.length > 0 ? (
            <div className="space-y-4">
              {activeJobs.map(wo => {
                const statusInfo = getStatusInfo(wo.status)
                return (
                  <div
                    key={wo.id}
                    onClick={() => loadJobDetails(wo.id)}
                    className={`${t.surface} rounded-xl p-4 ${t.border} border-2 cursor-pointer hover:border-blue-500 transition-all`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className={`text-lg font-bold ${t.text}`}>{wo.job_number}</div>
                        <div className={t.textSecondary}>
                          {wo.vehicles?.year} {wo.vehicles?.make} {wo.vehicles?.model}
                        </div>
                        <div className={`text-sm ${t.textSecondary}`}>{wo.vehicles?.registration}</div>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${statusInfo.color}`}>
                          {statusInfo.icon} {statusInfo.text}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${statusInfo.color} transition-all`}
                          style={{ width: `${statusInfo.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={`${t.surface} rounded-xl p-8 text-center ${t.border} border`}>
              <div className="text-4xl mb-2">✅</div>
              <div className={t.text}>No active jobs</div>
            </div>
          )}
        </div>

        {/* Vehicles */}
        <div className="mb-6">
          <h2 className={`text-xl font-bold ${t.text} mb-4`}>🏍️ Your Vehicles ({vehicles.length})</h2>
          <div className="grid grid-cols-2 gap-4">
            {vehicles.map(v => (
              <div key={v.id} className={`${t.surface} rounded-xl p-4 ${t.border} border`}>
                <div className={`text-lg font-bold ${t.text}`}>
                  {v.year} {v.make} {v.model}
                </div>
                <div className={t.textSecondary}>{v.registration}</div>
                <div className={`text-sm ${t.textSecondary} mt-2`}>
                  {v.odometer?.toLocaleString()} km
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent History */}
        <div>
          <h2 className={`text-xl font-bold ${t.text} mb-4`}>📋 Recent History</h2>
          <div className="space-y-3">
            {completedJobs.slice(0, 5).map(wo => (
              <div
                key={wo.id}
                onClick={() => loadJobDetails(wo.id)}
                className={`${t.surface} rounded-lg p-4 ${t.border} border cursor-pointer hover:border-blue-500`}
              >
                <div className="flex justify-between">
                  <div>
                    <div className={`font-bold ${t.text}`}>{wo.job_number}</div>
                    <div className={`text-sm ${t.textSecondary}`}>
                      {wo.vehicles?.year} {wo.vehicles?.make} {wo.vehicles?.model}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm ${t.textSecondary}`}>
                      {new Date(wo.created_at).toLocaleDateString()}
                    </div>
                    <span className="text-green-500 text-sm font-medium">Completed ✓</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
