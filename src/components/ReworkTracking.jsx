import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ReworkTracking({ theme: t, currentUser }) {
  const [view, setView] = useState('overview') // overview, incidents, analytics, mechanics
  const [incidents, setIncidents] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [trends, setTrends] = useState([])
  const [highReworkMechanics, setHighReworkMechanics] = useState([])
  const [mechanicMetrics, setMechanicMetrics] = useState([])
  const [selectedIncident, setSelectedIncident] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [formData, setFormData] = useState({
    incident_date: new Date().toISOString().split('T')[0],
    discovery_method: 'quality_check',
    issue_category: 'incomplete_work',
    severity: 'moderate',
    is_warranty: false,
    is_chargeable: false,
    customer_notified: false
  })

  useEffect(() => {
    loadData()
  }, [dateRange])

  const loadData = async () => {
    await Promise.all([
      loadIncidents(),
      loadWorkOrders(),
      loadMechanics(),
      loadTrends(),
      loadHighReworkMechanics(),
      loadMechanicMetrics()
    ])
  }

  const loadIncidents = async () => {
    const { data } = await supabase
      .from('rework_incidents')
      .select(`
        *,
        original_work_order:original_work_order_id(job_number, description, completed_at),
        rework_work_order:rework_work_order_id(job_number),
        original_mechanic:original_mechanic_id(first_name, last_name),
        rework_mechanic:rework_mechanic_id(first_name, last_name)
      `)
      .gte('incident_date', dateRange.start)
      .lte('incident_date', dateRange.end)
      .order('incident_date', { ascending: false })
    
    if (data) setIncidents(data)
  }

  const loadWorkOrders = async () => {
    const { data } = await supabase
      .from('work_orders')
      .select(`
        *,
        mechanics(first_name, last_name),
        customers(first_name, last_name),
        vehicles(year, make, model, registration)
      `)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(100)
    
    if (data) setWorkOrders(data)
  }

  const loadMechanics = async () => {
    const { data } = await supabase
      .from('mechanics')
      .select('*')
      .eq('is_active', true)
      .order('first_name')
    
    if (data) setMechanics(data)
  }

  const loadTrends = async () => {
    const { data } = await supabase.rpc('get_rework_trends_by_category', {
      p_start_date: dateRange.start,
      p_end_date: dateRange.end
    })
    
    if (data) setTrends(data)
  }

  const loadHighReworkMechanics = async () => {
    const { data } = await supabase.rpc('get_mechanics_with_high_rework', {
      p_start_date: dateRange.start,
      p_end_date: dateRange.end,
      p_threshold: 5.0 // 5% threshold
    })
    
    if (data) setHighReworkMechanics(data)
  }

  const loadMechanicMetrics = async () => {
    const { data } = await supabase
      .from('mechanic_rework_metrics')
      .select(`
        *,
        mechanics(first_name, last_name)
      `)
      .gte('period_start', dateRange.start)
      .lte('period_end', dateRange.end)
      .order('rework_rate', { ascending: false })
    
    if (data) setMechanicMetrics(data)
  }

  const createIncident = async () => {
    if (!formData.original_work_order_id) {
      alert('Please select the original work order')
      return
    }

    // Calculate days since original work
    const originalWO = workOrders.find(wo => wo.id === formData.original_work_order_id)
    const daysSince = originalWO?.completed_at 
      ? Math.floor((new Date(formData.incident_date) - new Date(originalWO.completed_at)) / (1000 * 60 * 60 * 24))
      : 0

    const { error } = await supabase
      .from('rework_incidents')
      .insert([{
        ...formData,
        days_since_original_work: daysSince,
        created_by: `${currentUser.first_name} ${currentUser.last_name}`,
        original_mechanic_id: originalWO?.mechanic_id
      }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Rework incident reported!')
      setShowAddModal(false)
      setFormData({
        incident_date: new Date().toISOString().split('T')[0],
        discovery_method: 'quality_check',
        issue_category: 'incomplete_work',
        severity: 'moderate',
        is_warranty: false,
        is_chargeable: false,
        customer_notified: false
      })
      loadData()
    }
  }

  const updateIncidentStatus = async (incidentId, newStatus, additionalData = {}) => {
    const updates = { 
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...additionalData
    }

    if (newStatus === 'resolved' || newStatus === 'closed') {
      updates.resolved_date = new Date().toISOString().split('T')[0]
    }

    const { error } = await supabase
      .from('rework_incidents')
      .update(updates)
      .eq('id', incidentId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      loadData()
    }
  }

  const getSeverityBadge = (severity) => {
    const styles = {
      minor: 'bg-blue-500',
      moderate: 'bg-yellow-500',
      major: 'bg-orange-500',
      critical: 'bg-red-500',
      safety: 'bg-red-700'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[severity]}`}>
        {severity.toUpperCase()}
      </span>
    )
  }

  const getStatusBadge = (status) => {
    const styles = {
      reported: 'bg-red-500',
      investigating: 'bg-orange-500',
      in_progress: 'bg-blue-500',
      resolved: 'bg-green-500',
      closed: 'bg-gray-500'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[status]}`}>
        {status.toUpperCase().replace('_', ' ')}
      </span>
    )
  }

  const getCategoryIcon = (category) => {
    const icons = {
      incomplete_work: '⚠️',
      incorrect_diagnosis: '🔍',
      parts_failure: '🔩',
      installation_error: '🛠️',
      damage_caused: '💥',
      missed_issue: '👀',
      wrong_parts: '📦',
      other: '❓'
    }
    return icons[category] || '📋'
  }

  const getStats = () => {
    const total = incidents.length
    const critical = incidents.filter(i => i.severity === 'critical' || i.severity === 'safety').length
    const resolved = incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length
    const totalCost = incidents.reduce((sum, i) => sum + (parseFloat(i.rework_cost || 0) + parseFloat(i.goodwill_cost || 0)), 0)
    const avgDays = incidents.length > 0 
      ? incidents.reduce((sum, i) => sum + (i.days_since_original_work || 0), 0) / incidents.length
      : 0

    return { total, critical, resolved, totalCost, avgDays }
  }

  const stats = getStats()

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>🔧 Rework Tracking</h2>
        <div className="flex gap-2">
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              className={`px-3 py-2 ${t.input} rounded border`}
            />
            <span className={`px-3 py-2 ${t.text}`}>to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              className={`px-3 py-2 ${t.input} rounded border`}
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium">
            + Report Rework
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <div className={`text-sm ${t.textSecondary} mb-2`}>Total Incidents</div>
          <div className={`text-3xl font-bold ${t.text}`}>{stats.total}</div>
        </div>

        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <div className={`text-sm ${t.textSecondary} mb-2`}>Critical/Safety</div>
          <div className="text-3xl font-bold text-red-500">{stats.critical}</div>
        </div>

        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <div className={`text-sm ${t.textSecondary} mb-2`}>Resolved</div>
          <div className="text-3xl font-bold text-green-500">{stats.resolved}</div>
        </div>

        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <div className={`text-sm ${t.textSecondary} mb-2`}>Total Cost</div>
          <div className="text-3xl font-bold text-orange-500">${stats.totalCost.toLocaleString()}</div>
        </div>

        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <div className={`text-sm ${t.textSecondary} mb-2`}>Avg Days to Rework</div>
          <div className={`text-3xl font-bold ${t.text}`}>{stats.avgDays.toFixed(1)}</div>
        </div>
      </div>

      {/* High Rework Alert */}
      {highReworkMechanics.length > 0 && (
        <div className="bg-red-900 bg-opacity-30 border-2 border-red-500 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <h3 className={`font-bold ${t.text} text-lg`}>High Rework Rate Alert</h3>
              <p className={`text-sm ${t.textSecondary}`}>
                {highReworkMechanics.length} mechanic(s) with rework rate above 5%
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {highReworkMechanics.map(mech => (
              <div key={mech.mechanic_id} className={`${t.surface} ${t.border} border rounded p-3`}>
                <div className={`font-bold ${t.text}`}>{mech.mechanic_name}</div>
                <div className="flex justify-between items-center mt-2">
                  <div>
                    <div className={`text-xs ${t.textSecondary}`}>Jobs: {mech.total_jobs}</div>
                    <div className={`text-xs ${t.textSecondary}`}>Reworks: {mech.rework_count}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-400">
                      {parseFloat(mech.rework_rate).toFixed(1)}%
                    </div>
                    <div className="text-xs text-red-300">
                      ${parseFloat(mech.total_cost).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'incidents', label: 'All Incidents', icon: '📋' },
          { id: 'analytics', label: 'Analytics', icon: '📈' },
          { id: 'mechanics', label: 'By Mechanic', icon: '👨‍🔧' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium ${
              view === tab.id
                ? 'bg-blue-600 text-white'
                : `${t.surface} ${t.text} ${t.border} border`
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {view === 'overview' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Recent Incidents */}
          <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Recent Incidents</h3>
            </div>
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {incidents.slice(0, 10).map(incident => (
                <div key={incident.id} className={`${t.surface} ${t.border} border rounded p-3`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getCategoryIcon(incident.issue_category)}</span>
                      <div>
                        <div className={`text-sm font-bold ${t.text}`}>
                          {incident.original_work_order?.job_number}
                        </div>
                        <div className={`text-xs ${t.textSecondary}`}>
                          {new Date(incident.incident_date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    {getSeverityBadge(incident.severity)}
                  </div>
                  <div className={`text-xs ${t.text} mb-2`}>{incident.description}</div>
                  <div className="flex justify-between items-center">
                    <div className={`text-xs ${t.textSecondary}`}>
                      {incident.original_mechanic?.first_name} {incident.original_mechanic?.last_name}
                    </div>
                    {getStatusBadge(incident.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Issues by Category */}
          <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Issues by Category</h3>
            </div>
            <div className="p-4">
              {trends.map(trend => (
                <div key={trend.issue_category} className="mb-4">
                  <div className="flex justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{getCategoryIcon(trend.issue_category)}</span>
                      <span className={`text-sm ${t.text} capitalize`}>
                        {trend.issue_category.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${t.text}`}>{trend.incident_count}</div>
                      <div className="text-xs text-red-400">
                        ${parseFloat(trend.total_cost).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${(trend.incident_count / stats.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ALL INCIDENTS */}
      {view === 'incidents' && (
        <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
          <table className="min-w-full">
            <thead className={`${t.surface} ${t.border} border-b`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Date</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Job</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Category</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Mechanic</th>
                <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Severity</th>
                <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Cost</th>
                <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Days</th>
                <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
                <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.border}`}>
              {incidents.map(incident => (
                <tr key={incident.id} className={t.surfaceHover}>
                  <td className="px-6 py-4">
                    <div className={`text-sm ${t.text}`}>
                      {new Date(incident.incident_date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`text-sm font-bold ${t.text}`}>
                      {incident.original_work_order?.job_number}
                    </div>
                    <div className={`text-xs ${t.textSecondary}`}>
                      {incident.description.substring(0, 50)}...
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span>{getCategoryIcon(incident.issue_category)}</span>
                      <span className={`text-xs ${t.text} capitalize`}>
                        {incident.issue_category.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`text-sm ${t.text}`}>
                      {incident.original_mechanic?.first_name} {incident.original_mechanic?.last_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getSeverityBadge(incident.severity)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-semibold text-red-500">
                      ${(parseFloat(incident.rework_cost || 0) + parseFloat(incident.goodwill_cost || 0)).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`text-sm ${t.text}`}>{incident.days_since_original_work}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(incident.status)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex gap-1 justify-center">
                      {incident.status === 'reported' && (
                        <button
                          onClick={() => updateIncidentStatus(incident.id, 'investigating')}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded text-xs">
                          Investigate
                        </button>
                      )}
                      {incident.status === 'investigating' && (
                        <button
                          onClick={() => updateIncidentStatus(incident.id, 'in_progress')}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs">
                          Start Fix
                        </button>
                      )}
                      {incident.status === 'in_progress' && (
                        <button
                          onClick={() => updateIncidentStatus(incident.id, 'resolved')}
                          className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs">
                          Resolve
                        </button>
                      )}
                      {incident.status === 'resolved' && (
                        <button
                          onClick={() => updateIncidentStatus(incident.id, 'closed')}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs">
                          Close
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedIncident(incident)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs">
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ANALYTICS */}
      {view === 'analytics' && (
        <div className="space-y-6">
          {/* Trends Chart */}
          <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Rework Trends by Category</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-4 gap-4">
                {trends.map(trend => (
                  <div key={trend.issue_category} className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{getCategoryIcon(trend.issue_category)}</span>
                      <div>
                        <div className={`text-sm ${t.textSecondary} capitalize`}>
                          {trend.issue_category.replace('_', ' ')}
                        </div>
                        <div className={`text-2xl font-bold ${t.text}`}>{trend.incident_count}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className={`text-xs ${t.textSecondary}`}>Total Cost:</span>
                        <span className="text-xs font-semibold text-red-500">
                          ${parseFloat(trend.total_cost).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`text-xs ${t.textSecondary}`}>Avg Severity:</span>
                        <span className={`text-xs font-semibold ${t.text}`}>
                          {parseFloat(trend.avg_severity_score).toFixed(1)}/5
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`text-xs ${t.textSecondary}`}>% of Total:</span>
                        <span className={`text-xs font-semibold ${t.text}`}>
                          {((trend.incident_count / stats.total) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Discovery Method Breakdown */}
          <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Discovery Method Breakdown</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(
                  incidents.reduce((acc, inc) => {
                    acc[inc.discovery_method] = (acc[inc.discovery_method] || 0) + 1
                    return acc
                  }, {})
                ).map(([method, count]) => (
                  <div key={method} className={`${t.surface} ${t.border} border rounded p-4`}>
                    <div className={`text-sm ${t.textSecondary} capitalize mb-2`}>
                      {method.replace('_', ' ')}
                    </div>
                    <div className={`text-2xl font-bold ${t.text} mb-2`}>{count}</div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(count / stats.total) * 100}%` }}
                      ></div>
                    </div>
                    <div className={`text-xs ${t.textSecondary} mt-1`}>
                      {((count / stats.total) * 100).toFixed(1)}% of total
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BY MECHANIC */}
      {view === 'mechanics' && (
        <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
          <div className={`${t.surface} ${t.border} border-b p-4`}>
            <h3 className={`text-xl font-bold ${t.text}`}>Rework Metrics by Mechanic</h3>
          </div>
          <table className="min-w-full">
            <thead className={`${t.surface} ${t.border} border-b`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Mechanic</th>
                <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Total Jobs</th>
                <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Rework Incidents</th>
                <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Rework Rate</th>
                <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Total Cost</th>
                <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Critical</th>
                <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Complaints</th>
                <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Performance</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.border}`}>
              {mechanicMetrics.map(metric => (
                <tr key={metric.id} className={t.surfaceHover}>
                  <td className="px-6 py-4">
                    <div className={`text-sm font-bold ${t.text}`}>
                      {metric.mechanics?.first_name} {metric.mechanics?.last_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`text-sm ${t.text}`}>{metric.total_jobs}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`text-sm font-semibold ${t.text}`}>{metric.rework_incidents}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`text-sm font-bold ${
                      metric.rework_rate >= 10 ? 'text-red-500' :
                      metric.rework_rate >= 5 ? 'text-orange-500' :
                      metric.rework_rate >= 2 ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {parseFloat(metric.rework_rate).toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-semibold text-red-500">
                      ${parseFloat(metric.total_rework_cost).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`text-sm font-bold ${metric.critical_incidents > 0 ? 'text-red-500' : t.text}`}>
                      {metric.critical_incidents}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`text-sm ${t.text}`}>{metric.customer_complaints}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-full bg-gray-700 rounded-full h-4">
                      <div 
                        className={`h-4 rounded-full ${
                          metric.rework_rate >= 10 ? 'bg-red-500' :
                          metric.rework_rate >= 5 ? 'bg-orange-500' :
                          metric.rework_rate >= 2 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${100 - Math.min(metric.rework_rate * 10, 100)}%` }}
                      ></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Incident Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-3xl ${t.border} border-2 my-8`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Report Rework Incident</h3>
              <button onClick={() => {
                setShowAddModal(false)
                setFormData({
                  incident_date: new Date().toISOString().split('T')[0],
                  discovery_method: 'quality_check',
                  issue_category: 'incomplete_work',
                  severity: 'moderate',
                  is_warranty: false,
                  is_chargeable: false,
                  customer_notified: false
                })
              }} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Original Work Order *</label>
                <select
                  value={formData.original_work_order_id || ''}
                  onChange={(e) => setFormData({...formData, original_work_order_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Select work order...</option>
                  {workOrders.map(wo => (
                    <option key={wo.id} value={wo.id}>
                      {wo.job_number} - {wo.customers?.first_name} {wo.customers?.last_name} - 
                      {wo.vehicles?.year} {wo.vehicles?.make} {wo.vehicles?.model} 
                      ({wo.mechanics?.first_name} {wo.mechanics?.last_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Incident Date *</label>
                  <input
                    type="date"
                    value={formData.incident_date}
                    onChange={(e) => setFormData({...formData, incident_date: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Discovery Method *</label>
                  <select
                    value={formData.discovery_method}
                    onChange={(e) => setFormData({...formData, discovery_method: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}>
                    <option value="customer_complaint">Customer Complaint</option>
                    <option value="quality_check">Quality Check</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="warranty_claim">Warranty Claim</option>
                    <option value="internal_audit">Internal Audit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Issue Category *</label>
                  <select
                    value={formData.issue_category}
                    onChange={(e) => setFormData({...formData, issue_category: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}>
                    <option value="incomplete_work">Incomplete Work</option>
                    <option value="incorrect_diagnosis">Incorrect Diagnosis</option>
                    <option value="parts_failure">Parts Failure</option>
                    <option value="installation_error">Installation Error</option>
                    <option value="damage_caused">Damage Caused</option>
                    <option value="missed_issue">Missed Issue</option>
                    <option value="wrong_parts">Wrong Parts</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Severity *</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({...formData, severity: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}>
                    <option value="minor">Minor</option>
                    <option value="moderate">Moderate</option>
                    <option value="major">Major</option>
                    <option value="critical">Critical</option>
                    <option value="safety">Safety Issue</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Description *</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Detailed description of the rework issue..."
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Root Cause</label>
                <textarea
                  value={formData.root_cause || ''}
                  onChange={(e) => setFormData({...formData, root_cause: e.target.value})}
                  rows="2"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="What caused this issue?"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Corrective Action</label>
                <textarea
                  value={formData.corrective_action || ''}
                  onChange={(e) => setFormData({...formData, corrective_action: e.target.value})}
                  rows="2"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="How will this be fixed?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Rework Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.rework_cost || ''}
                    onChange={(e) => setFormData({...formData, rework_cost: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Goodwill Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.goodwill_cost || ''}
                    onChange={(e) => setFormData({...formData, goodwill_cost: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_warranty}
                    onChange={(e) => setFormData({...formData, is_warranty: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm font-medium ${t.text}`}>Warranty Work</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_chargeable}
                    onChange={(e) => setFormData({...formData, is_chargeable: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm font-medium ${t.text}`}>Chargeable</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.customer_notified}
                    onChange={(e) => setFormData({...formData, customer_notified: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className={`text-sm font-medium ${t.text}`}>Customer Notified</span>
                </label>
              </div>

              <button
                onClick={createIncident}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold">
                Report Rework Incident
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-4xl ${t.border} border-2 my-8`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <div>
                <h3 className={`text-2xl font-bold ${t.text}`}>Rework Incident Details</h3>
                <p className={`text-sm ${t.textSecondary}`}>
                  {selectedIncident.original_work_order?.job_number} - 
                  {new Date(selectedIncident.incident_date).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Status Bar */}
              <div className="flex gap-4">
                {getSeverityBadge(selectedIncident.severity)}
                {getStatusBadge(selectedIncident.status)}
                {selectedIncident.is_warranty && (
                  <span className="px-3 py-1 bg-yellow-600 text-white rounded-full text-xs font-bold">
                    WARRANTY
                  </span>
                )}
                {selectedIncident.is_chargeable && (
                  <span className="px-3 py-1 bg-green-600 text-white rounded-full text-xs font-bold">
                    CHARGEABLE
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className={`text-sm font-bold ${t.text} mb-3`}>Work Order Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={`text-sm ${t.textSecondary}`}>Job Number:</span>
                      <span className={`text-sm font-mono ${t.text}`}>
                        {selectedIncident.original_work_order?.job_number}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${t.textSecondary}`}>Original Mechanic:</span>
                      <span className={`text-sm ${t.text}`}>
                        {selectedIncident.original_mechanic?.first_name} {selectedIncident.original_mechanic?.last_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${t.textSecondary}`}>Days Since Work:</span>
                      <span className={`text-sm font-bold ${t.text}`}>
                        {selectedIncident.days_since_original_work} days
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className={`text-sm font-bold ${t.text} mb-3`}>Financial Impact</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={`text-sm ${t.textSecondary}`}>Rework Cost:</span>
                      <span className="text-sm font-bold text-red-500">
                        ${parseFloat(selectedIncident.rework_cost || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${t.textSecondary}`}>Goodwill Cost:</span>
                      <span className="text-sm font-bold text-orange-500">
                        ${parseFloat(selectedIncident.goodwill_cost || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className={`text-sm font-bold ${t.text}`}>Total Cost:</span>
                      <span className="text-lg font-bold text-red-500">
                        ${(parseFloat(selectedIncident.rework_cost || 0) + parseFloat(selectedIncident.goodwill_cost || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className={`text-sm font-bold ${t.text} mb-2`}>Issue Description</h4>
                <div className={`${t.surface} ${t.border} border rounded p-3 ${t.text}`}>
                  {selectedIncident.description}
                </div>
              </div>

              {selectedIncident.root_cause && (
                <div>
                  <h4 className={`text-sm font-bold ${t.text} mb-2`}>Root Cause</h4>
                  <div className={`${t.surface} ${t.border} border rounded p-3 ${t.text}`}>
                    {selectedIncident.root_cause}
                  </div>
                </div>
              )}

              {selectedIncident.corrective_action && (
                <div>
                  <h4 className={`text-sm font-bold ${t.text} mb-2`}>Corrective Action</h4>
                  <div className={`${t.surface} ${t.border} border rounded p-3 ${t.text}`}>
                    {selectedIncident.corrective_action}
                  </div>
                </div>
              )}

              {selectedIncident.preventive_action && (
                <div>
                  <h4 className={`text-sm font-bold ${t.text} mb-2`}>Preventive Action</h4>
                  <div className={`${t.surface} ${t.border} border rounded p-3 ${t.text}`}>
                    {selectedIncident.preventive_action}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}