import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function CommunicationLog({ theme: t, currentUser, customerId = null }) {
  const [logs, setLogs] = useState([])
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(customerId || '')
  const [filter, setFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    customer_id: '',
    communication_type: 'phone',
    direction: 'outbound',
    subject: '',
    notes: '',
    outcome: ''
  })

  useEffect(() => {
    loadCustomers()
    loadLogs()
  }, [selectedCustomer, filter])

  const loadCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('last_name')
    if (data) setCustomers(data)
  }

  const loadLogs = async () => {
    let query = supabase
      .from('communication_log')
      .select(`*, customers(first_name, last_name, phone, email), shop_users(first_name, last_name)`)
      .order('created_at', { ascending: false })
      .limit(100)

    if (selectedCustomer) {
      query = query.eq('customer_id', selectedCustomer)
    }

    if (filter !== 'all') {
      query = query.eq('communication_type', filter)
    }

    const { data } = await query
    if (data) setLogs(data)
  }

  const openAddModal = (customerId = '') => {
    setFormData({
      customer_id: customerId || selectedCustomer || '',
      communication_type: 'phone',
      direction: 'outbound',
      subject: '',
      notes: '',
      outcome: ''
    })
    setShowAddModal(true)
  }

  const saveLog = async () => {
    if (!formData.customer_id) {
      alert('Please select a customer')
      return
    }

    try {
      const { error } = await supabase.from('communication_log').insert([{
        ...formData,
        created_by: currentUser?.id
      }])

      if (error) throw error

      alert('✓ Communication logged!')
      setShowAddModal(false)
      loadLogs()
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  const deleteLog = async (logId) => {
    if (!confirm('Delete this log entry?')) return
    await supabase.from('communication_log').delete().eq('id', logId)
    loadLogs()
  }

  const getTypeIcon = (type) => {
    const icons = { phone: '📞', email: '📧', sms: '💬', in_person: '👤', note: '📝' }
    return icons[type] || '📝'
  }

  const getTypeColor = (type) => {
    const colors = { phone: 'bg-green-500', email: 'bg-blue-500', sms: 'bg-purple-500', in_person: 'bg-orange-500', note: 'bg-gray-500' }
    return colors[type] || 'bg-gray-500'
  }

  const stats = {
    total: logs.length,
    phone: logs.filter(l => l.communication_type === 'phone').length,
    email: logs.filter(l => l.communication_type === 'email').length,
    sms: logs.filter(l => l.communication_type === 'sms').length
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>📋 Communication Log</h2>
        <button onClick={() => openAddModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold">
          + Log Communication
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-blue-500">{stats.total}</div>
          <div className={t.textSecondary}>Total Logs</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-green-500">{stats.phone}</div>
          <div className={t.textSecondary}>📞 Phone Calls</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-blue-500">{stats.email}</div>
          <div className={t.textSecondary}>📧 Emails</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-purple-500">{stats.sms}</div>
          <div className={t.textSecondary}>💬 SMS</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
          className={`px-4 py-2 ${t.input} rounded-lg border flex-1`}
        >
          <option value="">All Customers</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
          ))}
        </select>
        <div className="flex gap-2">
          {['all', 'phone', 'email', 'sms', 'in_person'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium capitalize ${
                filter === f ? 'bg-blue-600 text-white' : `${t.surface} ${t.text} ${t.border} border`
              }`}
            >
              {f === 'all' ? 'All' : getTypeIcon(f)}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className={`${t.surface} rounded-lg ${t.border} border`}>
        <div className="divide-y divide-opacity-20" style={{ borderColor: 'inherit' }}>
          {logs.map(log => (
            <div key={log.id} className={`p-4 ${t.surfaceHover}`}>
              <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-full ${getTypeColor(log.communication_type)} flex items-center justify-center text-white text-xl flex-shrink-0`}>
                  {getTypeIcon(log.communication_type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className={`font-bold ${t.text}`}>
                        {log.customers?.first_name} {log.customers?.last_name}
                      </div>
                      <div className={`text-sm ${t.textSecondary}`}>
                        {log.direction === 'inbound' ? '← Incoming' : '→ Outgoing'} {log.communication_type}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm ${t.textSecondary}`}>
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                      <div className={`text-xs ${t.textSecondary}`}>
                        by {log.shop_users?.first_name || 'Unknown'}
                      </div>
                    </div>
                  </div>
                  {log.subject && (
                    <div className={`mt-2 font-medium ${t.text}`}>{log.subject}</div>
                  )}
                  {log.notes && (
                    <div className={`mt-1 ${t.textSecondary}`}>{log.notes}</div>
                  )}
                  {log.outcome && (
                    <div className={`mt-2 inline-block px-2 py-1 rounded text-xs ${t.surface} ${t.border} border`}>
                      Outcome: {log.outcome}
                    </div>
                  )}
                  <div className="mt-2">
                    <button
                      onClick={() => deleteLog(log.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <div className={`text-center py-12 ${t.textSecondary}`}>
              No communication logs found
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-lg ${t.border} border-2`}>
            <div className={`${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Log Communication</h3>
              <button onClick={() => setShowAddModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Customer *</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name} - {c.phone}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Type</label>
                  <select
                    value={formData.communication_type}
                    onChange={(e) => setFormData({ ...formData, communication_type: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  >
                    <option value="phone">📞 Phone Call</option>
                    <option value="email">📧 Email</option>
                    <option value="sms">💬 SMS</option>
                    <option value="in_person">👤 In Person</option>
                    <option value="note">📝 Note</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Direction</label>
                  <select
                    value={formData.direction}
                    onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  >
                    <option value="outbound">→ Outbound</option>
                    <option value="inbound">← Inbound</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Subject</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Brief subject..."
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="3"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Details of the communication..."
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Outcome</label>
                <select
                  value={formData.outcome}
                  onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                >
                  <option value="">Select outcome...</option>
                  <option value="appointment_booked">Appointment Booked</option>
                  <option value="quote_requested">Quote Requested</option>
                  <option value="information_provided">Information Provided</option>
                  <option value="callback_scheduled">Callback Scheduled</option>
                  <option value="no_answer">No Answer</option>
                  <option value="left_message">Left Message</option>
                  <option value="resolved">Issue Resolved</option>
                  <option value="escalated">Escalated</option>
                </select>
              </div>
              <button
                onClick={saveLog}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold"
              >
                ✓ Save Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
