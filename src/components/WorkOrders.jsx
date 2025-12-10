import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import EnhancedWorkOrder from './EnhancedWorkOrder'

export default function WorkOrders({ theme: t, currentUser }) {
  const [workOrders, setWorkOrders] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [sortBy, setSortBy] = useState('priority')
  const [search, setSearch] = useState('')
  const [showEnhancedModal, setShowEnhancedModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)

  useEffect(() => {
    loadMechanics()
  }, [])

  useEffect(() => {
    loadWorkOrders()
  }, [filter, mechanics])

  const loadMechanics = async () => {
    const { data } = await supabase.from('mechanics').select('*')
    if (data) setMechanics(data)
  }

  const loadWorkOrders = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('work_orders')
        .select(`
          *,
          customers(id, first_name, last_name, phone, is_priority),
          vehicles(id, year, make, model, registration)
        `)
        .order('created_at', { ascending: false })

      if (filter === 'active') {
        query = query.in('status', ['pending', 'in_progress', 'waiting_on_parts'])
      } else if (filter === 'pending') {
        query = query.eq('status', 'pending')
      } else if (filter === 'in_progress') {
        query = query.eq('status', 'in_progress')
      } else if (filter === 'waiting_on_parts') {
        query = query.eq('status', 'waiting_on_parts')
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed')
      }

      const { data, error } = await query

      if (error) {
        console.error('Error loading work orders:', error)
        setWorkOrders([])
      } else if (data) {
        // Helper to get mechanic name from various column structures
        const getMechanicName = (m) => {
          if (!m) return null
          if (m.name) return m.name
          if (m.first_name) return `${m.first_name} ${m.last_name || ''}`.trim()
          return null
        }
        
        // Add mechanic names manually
        const withMechanics = data.map(job => {
          const mechanic = mechanics.find(m => m.id === job.assigned_mechanic_id)
          return {
            ...job,
            mechanic_name: getMechanicName(mechanic),
            priority_score: calculatePriorityScore(job)
          }
        })
        setWorkOrders(withMechanics)
      }
    } catch (err) {
      console.error('Failed to load work orders:', err)
      setWorkOrders([])
    }
    setLoading(false)
  }

  const calculatePriorityScore = (job) => {
    let score = 0
    if (job.status === 'in_progress') score += 50
    if (job.priority === 'urgent') score += 100
    if (job.priority === 'high') score += 60
    if (job.priority === 'normal') score += 20
    if (job.customer_waiting) score += 80
    if (job.customers?.is_priority) score += 40
    return score
  }

  const getSortedOrders = () => {
    let filtered = workOrders.filter(order => {
      if (!search) return true
      const searchLower = search.toLowerCase()
      return (
        order.job_number?.toLowerCase().includes(searchLower) ||
        order.customers?.first_name?.toLowerCase().includes(searchLower) ||
        order.customers?.last_name?.toLowerCase().includes(searchLower) ||
        order.vehicles?.registration?.toLowerCase().includes(searchLower) ||
        order.description?.toLowerCase().includes(searchLower)
      )
    })

    if (sortBy === 'priority') {
      filtered.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
    } else if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    }

    return filtered
  }

  const openNewJob = () => {
    setSelectedJob(null)
    setShowEnhancedModal(true)
  }

  const openEditJob = (job) => {
    setSelectedJob(job)
    setShowEnhancedModal(true)
  }

  const updateStatus = async (id, newStatus) => {
    const updates = { status: newStatus }
    if (newStatus === 'completed') {
      updates.completed_date = new Date().toISOString()
    }
    if (newStatus === 'in_progress') {
      const job = workOrders.find(w => w.id === id)
      if (!job?.started_at) {
        updates.started_at = new Date().toISOString()
      }
    }

    await supabase.from('work_orders').update(updates).eq('id', id)
    loadWorkOrders()
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500 text-white',
      in_progress: 'bg-blue-500 text-white',
      waiting_on_parts: 'bg-orange-500 text-white',
      completed: 'bg-green-500 text-white',
      cancelled: 'bg-red-500 text-white'
    }
    return styles[status] || 'bg-gray-500 text-white'
  }

  const getPriorityBadge = (priority) => {
    if (priority === 'urgent') return 'bg-red-600 text-white'
    if (priority === 'high') return 'bg-orange-500 text-white'
    return ''
  }

  const stats = {
    pending: workOrders.filter(w => w.status === 'pending').length,
    in_progress: workOrders.filter(w => w.status === 'in_progress').length,
    waiting: workOrders.filter(w => w.status === 'waiting_on_parts').length,
    urgent: workOrders.filter(w => w.priority === 'urgent' || w.customer_waiting).length
  }

  const sortedOrders = getSortedOrders()

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>🔧 Work Orders</h2>
        <button onClick={openNewJob} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
          + New Work Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border cursor-pointer hover:border-yellow-500 ${filter === 'pending' ? 'border-yellow-500 ring-2 ring-yellow-500' : ''}`}
          onClick={() => setFilter('pending')}>
          <div className="text-3xl font-bold text-yellow-500">{stats.pending}</div>
          <div className={t.textSecondary}>Pending</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border cursor-pointer hover:border-blue-500 ${filter === 'in_progress' ? 'border-blue-500 ring-2 ring-blue-500' : ''}`}
          onClick={() => setFilter('in_progress')}>
          <div className="text-3xl font-bold text-blue-500">{stats.in_progress}</div>
          <div className={t.textSecondary}>In Progress</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border cursor-pointer hover:border-orange-500 ${filter === 'waiting_on_parts' ? 'border-orange-500 ring-2 ring-orange-500' : ''}`}
          onClick={() => setFilter('waiting_on_parts')}>
          <div className="text-3xl font-bold text-orange-500">{stats.waiting}</div>
          <div className={t.textSecondary}>Waiting Parts</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border cursor-pointer hover:border-red-500`}
          onClick={() => setFilter('active')}>
          <div className="text-3xl font-bold text-red-500">{stats.urgent}</div>
          <div className={t.textSecondary}>Urgent / Waiting</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <input type="text" placeholder="Search job #, customer, rego..." value={search}
          onChange={(e) => setSearch(e.target.value)} className={`flex-1 px-4 py-2 ${t.input} rounded-lg border`} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`px-4 py-2 ${t.input} rounded-lg border`}>
          <option value="active">Active Jobs</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="waiting_on_parts">Waiting on Parts</option>
          <option value="completed">Completed</option>
          <option value="all">All Jobs</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`px-4 py-2 ${t.input} rounded-lg border`}>
          <option value="priority">Sort: Priority</option>
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
        </select>
      </div>

      {/* Table */}
      <div className={`${t.surface} rounded-lg overflow-hidden ${t.border} border`}>
        <table className="min-w-full">
          <thead className={`${t.border} border-b`}>
            <tr>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>#</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Job</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Customer</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Vehicle</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Description</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Mechanic</th>
              <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Priority</th>
              <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
              <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${t.border}`}>
            {sortedOrders.map((order, index) => (
              <tr key={order.id} className={`${t.surfaceHover} ${order.customer_waiting ? 'bg-purple-500 bg-opacity-10' : ''}`}>
                <td className={`px-4 py-3 ${t.textSecondary}`}>{index + 1}</td>
                <td className="px-4 py-3">
                  <div className={`font-medium ${t.text}`}>{order.job_number}</div>
                  <div className={`text-xs ${t.textSecondary}`}>{new Date(order.created_at).toLocaleDateString('en-AU')}</div>
                </td>
                <td className="px-4 py-3">
                  <div className={`font-medium ${t.text}`}>
                    {order.customers?.first_name} {order.customers?.last_name}
                    {order.customers?.is_priority && <span className="ml-1 text-yellow-500">⭐</span>}
                  </div>
                  <div className={`text-xs ${t.textSecondary}`}>{order.customers?.phone}</div>
                </td>
                <td className="px-4 py-3">
                  <div className={t.text}>{order.vehicles ? `${order.vehicles.year} ${order.vehicles.make} ${order.vehicles.model}` : '-'}</div>
                  <div className={`text-xs ${t.textSecondary}`}>{order.vehicles?.registration}</div>
                </td>
                <td className={`px-4 py-3 ${t.text} max-w-xs`}>
                  <div className="truncate">{order.description}</div>
                </td>
                <td className={`px-4 py-3 ${t.text}`}>{order.mechanic_name || '-'}</td>
                <td className="px-4 py-3 text-center">
                  {order.priority && order.priority !== 'normal' && (
                    <span className={`px-2 py-1 text-xs rounded-full ${getPriorityBadge(order.priority)}`}>{order.priority}</span>
                  )}
                  {order.customer_waiting && <span className="ml-1 px-2 py-1 text-xs rounded-full bg-purple-500 text-white">waiting</span>}
                  {(!order.priority || order.priority === 'normal') && !order.customer_waiting && '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(order.status)}`}>
                    {order.status?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => openEditJob(order)} className="text-blue-500 hover:text-blue-400 font-medium">Open</button>
                  {order.status === 'pending' && (
                    <button onClick={() => updateStatus(order.id, 'in_progress')} className="text-green-500 hover:text-green-400 font-medium">Start</button>
                  )}
                  {order.status === 'in_progress' && (
                    <button onClick={() => updateStatus(order.id, 'completed')} className="text-green-500 hover:text-green-400 font-medium">Complete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className={`text-center py-12 ${t.textSecondary}`}>Loading...</div>}
        {!loading && sortedOrders.length === 0 && (
          <div className={`text-center py-12 ${t.textSecondary}`}>
            No work orders found
            <div className="text-sm mt-2">Try changing the filter or create a new work order</div>
          </div>
        )}
      </div>

      {showEnhancedModal && (
        <EnhancedWorkOrder theme={t} job={selectedJob} onClose={() => setShowEnhancedModal(false)} onSave={loadWorkOrders} currentUser={currentUser} />
      )}
    </div>
  )
}
