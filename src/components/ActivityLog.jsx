import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ActivityLog({ theme: t }) {
  const [logs, setLogs] = useState([])
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    let query = supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filter !== 'all') {
      query = query.eq('entity_type', filter)
    }

    const { data } = await query
    if (data) setLogs(data)
  }

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true
    return (
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const getActionIcon = (action) => {
    if (action?.includes('create')) return '✨'
    if (action?.includes('update')) return '✏️'
    if (action?.includes('delete')) return '🗑️'
    if (action?.includes('complete')) return '✅'
    if (action?.includes('invoice')) return '💰'
    if (action?.includes('payment')) return '💳'
    return '📝'
  }

  return (
    <div>
      <h2 className={`text-3xl font-bold ${t.text} mb-8`}>📜 Activity Log</h2>

      <div className={`${t.surface} rounded-lg shadow-lg p-4 mb-6 ${t.border} border`}>
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="🔍 Search activity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`flex-1 px-4 py-2 ${t.input} rounded border`}
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={`px-4 py-2 ${t.input} rounded border`}>
            <option value="all">All Types</option>
            <option value="work_order">Work Orders</option>
            <option value="invoice">Invoices</option>
            <option value="customer">Customers</option>
            <option value="part">Parts</option>
            <option value="booking">Bookings</option>
          </select>
        </div>
      </div>

      <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
        <div className="divide-y divide-gray-700">
          {filteredLogs.map(log => (
            <div key={log.id} className={`p-4 ${t.surfaceHover}`}>
              <div className="flex items-start gap-4">
                <div className="text-3xl">{getActionIcon(log.action)}</div>
                <div className="flex-1">
                  <div className={`font-semibold ${t.text}`}>{log.action}</div>
                  <div className={`text-sm ${t.textSecondary} mt-1`}>
                    {log.user_email && <span>by {log.user_email}</span>}
                    {log.entity_type && <span className="ml-3">• {log.entity_type}</span>}
                    {log.entity_id && <span className="ml-3">• ID: {log.entity_id.slice(0, 8)}</span>}
                  </div>
                  {log.details && (
                    <div className={`text-xs ${t.textSecondary} mt-2 p-2 ${t.surface} ${t.border} border rounded font-mono`}>
                      {JSON.stringify(log.details, null, 2)}
                    </div>
                  )}
                </div>
                <div className={`text-xs ${t.textSecondary} text-right`}>
                  <div>{new Date(log.created_at).toLocaleDateString()}</div>
                  <div>{new Date(log.created_at).toLocaleTimeString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredLogs.length === 0 && (
          <div className={`text-center py-12 ${t.textSecondary}`}>
            No activity logs found
          </div>
        )}
      </div>
    </div>
  )
}