import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function WorkshopCapacity({ theme: t }) {
  const [view, setView] = useState('overview') // overview, bays, schedule, forecast
  const [bays, setBays] = useState([])
  const [assignments, setAssignments] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [utilization, setUtilization] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignmentData, setAssignmentData] = useState({
    bay_id: '',
    work_order_id: '',
    mechanic_id: '',
    estimated_duration_hours: 2,
    priority: 'medium',
    notes: ''
  })

  useEffect(() => {
    loadData()
  }, [selectedDate])

  const loadData = async () => {
    await Promise.all([
      loadBays(),
      loadAssignments(),
      loadWorkOrders(),
      loadMechanics(),
      loadUtilization()
    ])
  }

  const loadBays = async () => {
    const { data } = await supabase
      .from('workshop_bays')
      .select('*')
      .eq('is_active', true)
      .order('bay_number')
    
    if (data) setBays(data)
  }

  const loadAssignments = async () => {
    const { data } = await supabase
      .from('bay_assignments')
      .select(`
        *,
        workshop_bays(bay_number, bay_name),
        work_orders(job_number, description),
        mechanics(first_name, last_name)
      `)
      .gte('assigned_at', `${selectedDate}T00:00:00`)
      .lte('assigned_at', `${selectedDate}T23:59:59`)
      .order('assigned_at', { ascending: true })
    
    if (data) setAssignments(data)
  }

  const loadWorkOrders = async () => {
    const { data } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers(first_name, last_name),
        vehicles(year, make, model)
      `)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })
    
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

  const loadUtilization = async () => {
    const startDate = new Date(selectedDate)
    startDate.setDate(startDate.getDate() - 7)
    
    const { data } = await supabase.rpc('calculate_bay_utilization', {
      p_start_date: startDate.toISOString().split('T')[0],
      p_end_date: selectedDate
    })
    
    if (data) setUtilization(data)
  }

  const createAssignment = async () => {
    if (!assignmentData.bay_id || !assignmentData.work_order_id) {
      alert('Please select a bay and work order')
      return
    }

    const { error } = await supabase
      .from('bay_assignments')
      .insert([{
        ...assignmentData,
        assigned_at: new Date().toISOString()
      }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Job assigned to bay!')
      setShowAssignModal(false)
      setAssignmentData({
        bay_id: '',
        work_order_id: '',
        mechanic_id: '',
        estimated_duration_hours: 2,
        priority: 'medium',
        notes: ''
      })
      loadData()
    }
  }

  const updateAssignmentStatus = async (assignmentId, newStatus) => {
    const updates = { status: newStatus }
    
    if (newStatus === 'in_progress') {
      updates.started_at = new Date().toISOString()
    } else if (newStatus === 'completed') {
      const assignment = assignments.find(a => a.id === assignmentId)
      if (assignment && assignment.started_at) {
        const duration = (new Date() - new Date(assignment.started_at)) / (1000 * 60 * 60)
        updates.completed_at = new Date().toISOString()
        updates.actual_duration_hours = duration.toFixed(2)
      }
    }

    const { error } = await supabase
      .from('bay_assignments')
      .update(updates)
      .eq('id', assignmentId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      loadData()
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      scheduled: 'bg-blue-500',
      in_progress: 'bg-green-500',
      paused: 'bg-orange-500',
      completed: 'bg-gray-500',
      cancelled: 'bg-red-500'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[status]}`}>
        {status.toUpperCase().replace('_', ' ')}
      </span>
    )
  }

  const getPriorityBadge = (priority) => {
    const styles = {
      low: 'bg-blue-500',
      medium: 'bg-yellow-500',
      high: 'bg-orange-500',
      urgent: 'bg-red-500'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[priority]}`}>
        {priority.toUpperCase()}
      </span>
    )
  }

  const getBayTypeIcon = (type) => {
    const icons = {
      standard: '🔧',
      alignment: '📐',
      dyno: '📊',
      wash: '💧',
      paint: '🎨'
    }
    return icons[type] || '🔧'
  }

  const getTodaysStats = () => {
    const todayAssignments = assignments.filter(a => 
      a.assigned_at.startsWith(selectedDate)
    )
    
    return {
      total: todayAssignments.length,
      inProgress: todayAssignments.filter(a => a.status === 'in_progress').length,
      completed: todayAssignments.filter(a => a.status === 'completed').length,
      scheduled: todayAssignments.filter(a => a.status === 'scheduled').length,
      avgDuration: todayAssignments.filter(a => a.actual_duration_hours).length > 0
        ? (todayAssignments.reduce((sum, a) => sum + (a.actual_duration_hours || 0), 0) / 
           todayAssignments.filter(a => a.actual_duration_hours).length).toFixed(1)
        : 0
    }
  }

  const stats = getTodaysStats()

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>🏗️ Workshop Capacity Planning</h2>
        <div className="flex gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={`px-3 py-2 ${t.input} rounded border`}
          />
          <button
            onClick={() => setShowAssignModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
            + Assign to Bay
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'bays', label: 'Bay Status', icon: '🏗️' },
          { id: 'schedule', label: 'Schedule', icon: '📅' },
          { id: 'forecast', label: 'Utilization', icon: '📈' }
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
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Total Jobs Today</div>
              <div className={`text-3xl font-bold ${t.text}`}>{stats.total}</div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>In Progress</div>
              <div className="text-3xl font-bold text-green-500">{stats.inProgress}</div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Completed</div>
              <div className="text-3xl font-bold text-blue-500">{stats.completed}</div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Scheduled</div>
              <div className="text-3xl font-bold text-orange-500">{stats.scheduled}</div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Avg Duration</div>
              <div className={`text-3xl font-bold ${t.text}`}>{stats.avgDuration}h</div>
            </div>
          </div>

          {/* Bay Grid */}
          <div className="grid grid-cols-3 gap-6">
            {bays.map(bay => {
              const bayAssignments = assignments.filter(a => 
                a.bay_id === bay.id && 
                a.status !== 'completed' && 
                a.status !== 'cancelled'
              )
              
              const isAvailable = bayAssignments.length < bay.max_concurrent_jobs
              
              return (
                <div key={bay.id} className={`${t.surface} rounded-lg shadow-lg ${t.border} border-2 ${
                  isAvailable ? 'border-green-500' : 'border-red-500'
                }`}>
                  <div className={`p-4 ${t.border} border-b flex justify-between items-center`}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getBayTypeIcon(bay.bay_type)}</span>
                      <div>
                        <h3 className={`font-bold ${t.text}`}>{bay.bay_name}</h3>
                        <p className={`text-xs ${t.textSecondary}`}>{bay.bay_number}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      isAvailable ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {isAvailable ? 'AVAILABLE' : 'FULL'}
                    </span>
                  </div>

                  <div className="p-4">
                    <div className={`text-xs ${t.textSecondary} mb-2`}>
                      Capacity: {bayAssignments.length} / {bay.max_concurrent_jobs}
                    </div>

                    {bayAssignments.length > 0 ? (
                      <div className="space-y-2">
                        {bayAssignments.map(assignment => (
                          <div key={assignment.id} className={`${t.surface} ${t.border} border rounded p-2`}>
                            <div className="flex justify-between items-start mb-1">
                              <div className={`text-sm font-bold ${t.text}`}>
                                {assignment.work_orders?.job_number}
                              </div>
                              {getStatusBadge(assignment.status)}
                            </div>
                            <div className={`text-xs ${t.textSecondary}`}>
                              {assignment.mechanics?.first_name} {assignment.mechanics?.last_name}
                            </div>
                            <div className={`text-xs ${t.textSecondary}`}>
                              Est: {assignment.estimated_duration_hours}h
                            </div>
                            <div className="flex gap-1 mt-2">
                              {assignment.status === 'scheduled' && (
                                <button
                                  onClick={() => updateAssignmentStatus(assignment.id, 'in_progress')}
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs">
                                  Start
                                </button>
                              )}
                              {assignment.status === 'in_progress' && (
                                <button
                                  onClick={() => updateAssignmentStatus(assignment.id, 'completed')}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs">
                                  Complete
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`text-center py-4 ${t.textSecondary} text-sm`}>
                        No jobs assigned
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* BAY STATUS VIEW */}
      {view === 'bays' && (
        <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
          <div className={`${t.surface} ${t.border} border-b p-4`}>
            <h3 className={`text-xl font-bold ${t.text}`}>All Workshop Bays</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className={`${t.surface} ${t.border} border-b`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Bay</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Type</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Equipment</th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Capacity</th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Current Load</th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${t.border}`}>
                {bays.map(bay => {
                  const bayAssignments = assignments.filter(a => 
                    a.bay_id === bay.id && 
                    a.status !== 'completed' && 
                    a.status !== 'cancelled'
                  )
                  const isAvailable = bayAssignments.length < bay.max_concurrent_jobs
                  
                  return (
                    <tr key={bay.id} className={t.surfaceHover}>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-bold ${t.text}`}>{bay.bay_name}</div>
                        <div className={`text-xs ${t.textSecondary}`}>{bay.bay_number}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getBayTypeIcon(bay.bay_type)}</span>
                          <span className={`text-sm ${t.text} capitalize`}>{bay.bay_type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(bay.equipment || []).map((eq, idx) => (
                            <span key={idx} className={`px-2 py-1 text-xs ${t.surface} ${t.border} border rounded`}>
                              {eq}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`text-sm font-semibold ${t.text}`}>{bay.max_concurrent_jobs}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`text-sm font-bold ${
                          bayAssignments.length === 0 ? 'text-green-500' :
                          bayAssignments.length < bay.max_concurrent_jobs ? 'text-orange-500' :
                          'text-red-500'
                        }`}>
                          {bayAssignments.length}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          isAvailable ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {isAvailable ? 'AVAILABLE' : 'FULL'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SCHEDULE VIEW */}
      {view === 'schedule' && (
        <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
          <div className={`${t.surface} ${t.border} border-b p-4`}>
            <h3 className={`text-xl font-bold ${t.text}`}>Today's Schedule</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className={`${t.surface} ${t.border} border-b`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Time</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Bay</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Job</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Mechanic</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Duration</th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Priority</th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${t.border}`}>
                {assignments.map(assignment => (
                  <tr key={assignment.id} className={t.surfaceHover}>
                    <td className="px-6 py-4">
                      <div className={`text-sm ${t.text}`}>
                        {new Date(assignment.assigned_at).toLocaleTimeString('en-AU', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-semibold ${t.text}`}>
                        {assignment.workshop_bays?.bay_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-bold ${t.text}`}>
                        {assignment.work_orders?.job_number}
                      </div>
                      <div className={`text-xs ${t.textSecondary}`}>
                        {assignment.work_orders?.description}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm ${t.text}`}>
                        {assignment.mechanics?.first_name} {assignment.mechanics?.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`text-sm ${t.text}`}>
                        {assignment.actual_duration_hours ? (
                          <span className="font-bold text-green-500">
                            {assignment.actual_duration_hours}h
                          </span>
                        ) : (
                          <span>Est: {assignment.estimated_duration_hours}h</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getPriorityBadge(assignment.priority)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(assignment.status)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex gap-1 justify-center">
                        {assignment.status === 'scheduled' && (
                          <button
                            onClick={() => updateAssignmentStatus(assignment.id, 'in_progress')}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs">
                            Start
                          </button>
                        )}
                        {assignment.status === 'in_progress' && (
                          <>
                            <button
                              onClick={() => updateAssignmentStatus(assignment.id, 'paused')}
                              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs">
                              Pause
                            </button>
                            <button
                              onClick={() => updateAssignmentStatus(assignment.id, 'completed')}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">
                              Complete
                            </button>
                          </>
                        )}
                        {assignment.status === 'paused' && (
                          <button
                            onClick={() => updateAssignmentStatus(assignment.id, 'in_progress')}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs">
                            Resume
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* UTILIZATION VIEW */}
      {view === 'forecast' && (
        <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
          <div className={`${t.surface} ${t.border} border-b p-4`}>
            <h3 className={`text-xl font-bold ${t.text}`}>Bay Utilization (Last 7 Days)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className={`${t.surface} ${t.border} border-b`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Bay</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Total Hours</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Utilized Hours</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Utilization %</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Jobs Completed</th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Performance</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${t.border}`}>
                {utilization.map(util => (
                  <tr key={util.bay_id} className={t.surfaceHover}>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-bold ${t.text}`}>{util.bay_name}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`text-sm ${t.text}`}>{parseFloat(util.total_hours).toFixed(1)}h</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-semibold text-blue-500">
                        {parseFloat(util.utilized_hours).toFixed(1)}h
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`text-sm font-bold ${
                        util.utilization_percentage >= 80 ? 'text-green-500' :
                        util.utilization_percentage >= 60 ? 'text-blue-500' :
                        util.utilization_percentage >= 40 ? 'text-orange-500' :
                        'text-red-500'
                      }`}>
                        {parseFloat(util.utilization_percentage).toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`text-sm font-semibold ${t.text}`}>{util.jobs_completed}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-gray-700 rounded-full h-4">
                        <div 
                          className={`h-4 rounded-full ${
                            util.utilization_percentage >= 80 ? 'bg-green-500' :
                            util.utilization_percentage >= 60 ? 'bg-blue-500' :
                            util.utilization_percentage >= 40 ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(util.utilization_percentage, 100)}%` }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign to Bay Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Assign Job to Bay</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Work Order *</label>
                <select
                  value={assignmentData.work_order_id}
                  onChange={(e) => setAssignmentData({...assignmentData, work_order_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Select work order...</option>
                  {workOrders.map(wo => (
                    <option key={wo.id} value={wo.id}>
                      {wo.job_number} - {wo.customers?.first_name} {wo.customers?.last_name} - {wo.vehicles?.year} {wo.vehicles?.make} {wo.vehicles?.model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Bay *</label>
                <select
                  value={assignmentData.bay_id}
                  onChange={(e) => setAssignmentData({...assignmentData, bay_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Select bay...</option>
                  {bays.map(bay => (
                    <option key={bay.id} value={bay.id}>
                      {bay.bay_name} ({bay.bay_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Mechanic</label>
                <select
                  value={assignmentData.mechanic_id}
                  onChange={(e) => setAssignmentData({...assignmentData, mechanic_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Select mechanic...</option>
                  {mechanics.map(mech => (
                    <option key={mech.id} value={mech.id}>
                      {mech.first_name} {mech.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Estimated Hours *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={assignmentData.estimated_duration_hours}
                    onChange={(e) => setAssignmentData({...assignmentData, estimated_duration_hours: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Priority *</label>
                  <select
                    value={assignmentData.priority}
                    onChange={(e) => setAssignmentData({...assignmentData, priority: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Notes</label>
                <textarea
                  value={assignmentData.notes}
                  onChange={(e) => setAssignmentData({...assignmentData, notes: e.target.value})}
                  rows="3"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Any special instructions..."
                />
              </div>

              <button
                onClick={createAssignment}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold">
                Assign to Bay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}