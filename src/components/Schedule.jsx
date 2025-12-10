import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Schedule({ theme: t, currentUser }) {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [mechanics, setMechanics] = useState([])
  const [scheduledJobs, setScheduledJobs] = useState([])
  const [unscheduledJobs, setUnscheduledJobs] = useState([])
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiEstimate, setAiEstimate] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({
    mechanic_id: '',
    scheduled_start: '',
    scheduled_end: '',
    mechanic_hours: ''
  })

  // Get mechanic display name
  const getMechanicName = (mechanic) => {
    if (!mechanic) return 'Unknown'
    if (mechanic.name) return mechanic.name
    if (mechanic.first_name) return `${mechanic.first_name} ${mechanic.last_name || ''}`.trim()
    return 'Unnamed'
  }

  // Show current date/time for debugging
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    loadMechanics()
  }, [])

  useEffect(() => {
    if (mechanics.length > 0) {
      loadWorkOrders()
      loadScheduledJobs()
    }
  }, [currentWeek, mechanics])

  const loadMechanics = async () => {
    const { data, error } = await supabase
      .from('mechanics')
      .select('*')
      .eq('active', true)
    
    console.log('Mechanics loaded:', data, error)
    
    if (data && data.length > 0) {
      setMechanics(data)
    } else {
      // Fallback: try to get users with mechanic role
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name, role')
        .eq('role', 'mechanic')
      
      if (users && users.length > 0) {
        const mechanicsFromUsers = users.map(u => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          user_id: u.id,
          active: true,
          daily_hours_goal: 8
        }))
        setMechanics(mechanicsFromUsers)
      }
    }
  }

  const loadWorkOrders = async () => {
    const { data } = await supabase
      .from('work_orders')
      .select(`*, customers(first_name, last_name, is_priority), vehicles(year, make, model, registration)`)
      .is('scheduled_start', null)
      .in('status', ['pending', 'in_progress', 'waiting_on_parts'])
      .order('created_at')

    if (data) {
      const withScores = data.map(job => ({ ...job, priority_score: calculatePriorityScore(job) }))
      withScores.sort((a, b) => b.priority_score - a.priority_score)
      setUnscheduledJobs(withScores)
    }
  }

  const calculatePriorityScore = (job) => {
    let score = 0
    if (job.status === 'in_progress') score += 50
    if (job.priority === 'urgent') score += 100
    if (job.priority === 'high') score += 60
    if (job.customer_waiting) score += 80
    if (job.customers?.is_priority) score += 40
    return score
  }

  const loadScheduledJobs = async () => {
    const weekStart = getWeekStart(currentWeek)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    console.log('Loading jobs from', weekStart.toISOString(), 'to', weekEnd.toISOString())

    const { data, error } = await supabase
      .from('work_orders')
      .select(`*, customers(first_name, last_name), vehicles(year, make, model, registration)`)
      .not('scheduled_start', 'is', null)
      .gte('scheduled_start', weekStart.toISOString())
      .lt('scheduled_start', weekEnd.toISOString())
      .order('scheduled_start')

    console.log('Scheduled jobs:', data, error)

    if (data) {
      setScheduledJobs(data)
    }
  }

  const getWeekStart = (date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const getWeekDays = () => {
    const weekStart = getWeekStart(currentWeek)
    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + i)
      days.push(day)
    }
    return days
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const isToday = (date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const prevWeek = () => {
    const newDate = new Date(currentWeek)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentWeek(newDate)
  }

  const nextWeek = () => {
    const newDate = new Date(currentWeek)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentWeek(newDate)
  }

  const goToToday = () => {
    setCurrentWeek(new Date())
  }

  const openScheduleModal = (job) => {
    setSelectedJob(job)
    setAiEstimate(null)
    
    // Set default time to now, rounded to nearest 30 min
    const now = new Date()
    now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0)
    const defaultStart = now.toISOString().slice(0, 16)
    
    setScheduleForm({
      mechanic_id: job.assigned_mechanic_id || (mechanics[0]?.id || ''),
      scheduled_start: defaultStart,
      scheduled_end: '',
      mechanic_hours: job.estimated_hours || ''
    })
    setShowScheduleModal(true)
  }

  const getAITimeEstimate = async () => {
    if (!selectedJob) return
    setAiLoading(true)

    const description = selectedJob.description?.toLowerCase() || ''
    let result = { hours: 2, explanation: 'Standard workshop time' }

    // Fixed, consistent estimates
    if (description.includes('first service') || description.includes('1st service') || description.includes('run in')) {
      result = { hours: 1.5, explanation: 'First service: oil change, filter, basic inspection' }
    } else if (description.includes('major service') || description.includes('full service')) {
      result = { hours: 4, explanation: 'Major service: all fluids, filters, brakes, full inspection' }
    } else if (description.includes('minor service') || description.includes('basic service')) {
      result = { hours: 2, explanation: 'Minor service: oil, filter, chain, safety check' }
    } else if (description.includes('tyre') || description.includes('tire')) {
      result = { hours: 1, explanation: 'Tyre change including balance' }
    } else if (description.includes('brake')) {
      result = { hours: 2.5, explanation: 'Brake service: pads, fluid, inspection' }
    } else if (description.includes('chain') && description.includes('sprocket')) {
      result = { hours: 2, explanation: 'Chain and sprocket replacement' }
    } else if (description.includes('fork') || description.includes('suspension')) {
      result = { hours: 3, explanation: 'Suspension service' }
    } else if (description.includes('diagnostic') || description.includes('fault')) {
      result = { hours: 1.5, explanation: 'Diagnostic and fault finding' }
    } else if (description.includes('clutch')) {
      result = { hours: 3, explanation: 'Clutch replacement/adjustment' }
    } else if (description.includes('valve')) {
      result = { hours: 3, explanation: 'Valve clearance check and adjustment' }
    }

    setAiEstimate(result)
    setScheduleForm(prev => ({ ...prev, mechanic_hours: result.hours }))
    setAiLoading(false)
  }

  const handleSchedule = async () => {
    if (!selectedJob || !scheduleForm.scheduled_start) return

    // Calculate end time based on hours
    let endTime = null
    if (scheduleForm.scheduled_start && scheduleForm.mechanic_hours) {
      const start = new Date(scheduleForm.scheduled_start)
      const hours = parseFloat(scheduleForm.mechanic_hours)
      endTime = new Date(start.getTime() + hours * 60 * 60 * 1000)
    }

    const { error } = await supabase.from('work_orders').update({
      assigned_mechanic_id: scheduleForm.mechanic_id,
      scheduled_start: scheduleForm.scheduled_start,
      scheduled_end: endTime?.toISOString() || null,
      mechanic_hours: parseFloat(scheduleForm.mechanic_hours) || null,
      estimated_hours: parseFloat(scheduleForm.mechanic_hours) || null
    }).eq('id', selectedJob.id)

    if (!error) {
      setShowScheduleModal(false)
      loadWorkOrders()
      loadScheduledJobs()
    }
  }

  const getJobsForCell = (mechanicId, day) => {
    const dayStart = new Date(day)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(23, 59, 59, 999)

    return scheduledJobs.filter(job => {
      if (job.assigned_mechanic_id !== mechanicId) return false
      const jobStart = new Date(job.scheduled_start)
      return jobStart >= dayStart && jobStart <= dayEnd
    })
  }

  const getDayHours = (mechanicId, day) => {
    const jobs = getJobsForCell(mechanicId, day)
    return jobs.reduce((sum, job) => sum + (parseFloat(job.mechanic_hours) || parseFloat(job.estimated_hours) || 0), 0)
  }

  const weekDays = getWeekDays()

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className={`text-3xl font-bold ${t.text}`}>📅 Workshop Schedule</h2>
          <div className={`text-sm ${t.textSecondary}`}>
            Current: {currentTime.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} {currentTime.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={prevWeek} className={`px-4 py-2 ${t.surface} ${t.border} border rounded-lg ${t.text}`}>
            ← Prev
          </button>
          <button onClick={goToToday} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
            Today
          </button>
          <button onClick={nextWeek} className={`px-4 py-2 ${t.surface} ${t.border} border rounded-lg ${t.text}`}>
            Next →
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Unscheduled Jobs Sidebar */}
        <div className={`w-72 flex-shrink-0 ${t.surface} rounded-lg ${t.border} border overflow-hidden`}>
          <div className={`p-3 ${t.border} border-b`}>
            <h3 className={`font-bold ${t.text}`}>📋 Unscheduled Jobs ({unscheduledJobs.length})</h3>
            <p className={`text-xs ${t.textSecondary}`}>Click to schedule</p>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {unscheduledJobs.length === 0 ? (
              <div className={`p-4 text-center ${t.textSecondary}`}>
                All jobs scheduled! 🎉
              </div>
            ) : (
              unscheduledJobs.map(job => (
                <div
                  key={job.id}
                  onClick={() => openScheduleModal(job)}
                  className={`p-3 ${t.border} border-b cursor-pointer hover:bg-blue-600 hover:bg-opacity-20`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`font-bold text-sm ${t.text}`}>{job.job_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      job.priority === 'urgent' ? 'bg-red-500' :
                      job.priority === 'high' ? 'bg-orange-500' :
                      'bg-gray-500'
                    } text-white`}>
                      {job.priority}
                    </span>
                  </div>
                  <div className={`text-sm ${t.text} truncate`}>
                    {job.vehicles ? `${job.vehicles.year} ${job.vehicles.make} ${job.vehicles.model}` : 'No vehicle'}
                  </div>
                  <div className={`text-xs ${t.textSecondary} truncate`}>{job.description}</div>
                  {job.customer_waiting && (
                    <span className="text-xs text-yellow-500">⏳ Customer waiting</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="flex-1 overflow-x-auto">
          <div className={`${t.surface} rounded-lg ${t.border} border overflow-hidden`}>
            <table className="w-full">
              <thead>
                <tr className={`${t.border} border-b`}>
                  <th className={`p-3 text-left ${t.text} w-32`}>Mechanic</th>
                  {weekDays.map((day, i) => (
                    <th key={i} className={`p-3 text-center ${t.text} ${isToday(day) ? 'bg-blue-600 bg-opacity-30' : ''}`}>
                      <div className={`${isToday(day) ? 'font-bold text-blue-400' : ''}`}>{formatDate(day)}</div>
                      {isToday(day) && <div className="text-xs text-blue-400">TODAY</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mechanics.length === 0 ? (
                  <tr>
                    <td colSpan={8} className={`p-8 text-center ${t.textSecondary}`}>
                      <div className="text-4xl mb-2">🔧</div>
                      <div>No active mechanics found</div>
                      <div className="text-sm">Add mechanics in the Mechanics page</div>
                    </td>
                  </tr>
                ) : (
                  mechanics.map(mechanic => (
                    <tr key={mechanic.id} className={`${t.border} border-b`}>
                      <td className={`p-3 ${t.border} border-r`}>
                        <div className={`font-medium ${t.text}`}>{getMechanicName(mechanic)}</div>
                        <div className={`text-xs ${t.textSecondary}`}>Goal: {mechanic.daily_hours_goal || 8}h/day</div>
                      </td>
                      {weekDays.map((day, i) => {
                        const dayJobs = getJobsForCell(mechanic.id, day)
                        const dayHours = getDayHours(mechanic.id, day)
                        const goal = mechanic.daily_hours_goal || 8
                        const percentFull = Math.min(100, (dayHours / goal) * 100)
                        
                        return (
                          <td key={i} className={`p-1 ${t.border} border-r ${isToday(day) ? 'bg-blue-600 bg-opacity-10' : ''}`} style={{ minWidth: '120px', height: '80px', verticalAlign: 'top' }}>
                            <div className={`text-xs ${t.textSecondary} mb-1`}>{dayHours}/{goal}h</div>
                            <div className="w-full h-1 bg-gray-700 rounded mb-1">
                              <div 
                                className={`h-1 rounded ${percentFull >= 100 ? 'bg-green-500' : percentFull >= 50 ? 'bg-yellow-500' : 'bg-gray-500'}`}
                                style={{ width: `${percentFull}%` }}
                              />
                            </div>
                            {dayJobs.map(job => (
                              <div
                                key={job.id}
                                className={`text-xs p-1 mb-1 rounded cursor-pointer ${
                                  job.status === 'in_progress' ? 'bg-blue-600' :
                                  job.status === 'waiting_on_parts' ? 'bg-orange-600' :
                                  'bg-green-600'
                                } text-white truncate`}
                                title={`${job.job_number}: ${job.description}`}
                              >
                                {job.job_number?.split('-')[1]?.slice(-4) || 'Job'}
                              </div>
                            ))}
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-md ${t.border} border`}>
            <div className={`${t.border} border-b p-4 flex justify-between items-center`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Schedule Job</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-red-500 text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Job Info */}
              <div className={`bg-gray-800 rounded-lg p-3`}>
                <div className={`font-bold ${t.text}`}>{selectedJob.job_number}</div>
                <div className={`text-sm ${t.textSecondary}`}>{selectedJob.description}</div>
                {selectedJob.vehicles && (
                  <div className={`text-sm ${t.text}`}>
                    {selectedJob.vehicles.year} {selectedJob.vehicles.make} {selectedJob.vehicles.model}
                  </div>
                )}
              </div>

              {/* Mechanic */}
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Assign to Mechanic</label>
                <select value={scheduleForm.mechanic_id}
                  onChange={(e) => setScheduleForm({...scheduleForm, mechanic_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}>
                  {mechanics.map(m => (
                    <option key={m.id} value={m.id}>{getMechanicName(m)}</option>
                  ))}
                </select>
              </div>

              {/* Start Time */}
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Start Date/Time *</label>
                <input type="datetime-local" value={scheduleForm.scheduled_start}
                  onChange={(e) => setScheduleForm({...scheduleForm, scheduled_start: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
              </div>

              {/* Estimated Hours */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`text-sm font-medium ${t.text}`}>Estimated Hours</label>
                  <button onClick={getAITimeEstimate} disabled={aiLoading}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1">
                    {aiLoading ? '⏳' : '🤖'} AI Estimate
                  </button>
                </div>
                <input type="number" step="0.5" value={scheduleForm.mechanic_hours}
                  onChange={(e) => setScheduleForm({...scheduleForm, mechanic_hours: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  placeholder="e.g., 2" />
              </div>

              {/* AI Estimate Result */}
              {aiEstimate && (
                <div className="bg-purple-500 bg-opacity-20 rounded-lg p-3">
                  <div className={`font-bold ${t.text}`}>🤖 {aiEstimate.hours}h</div>
                  <div className={`text-sm ${t.textSecondary}`}>{aiEstimate.explanation}</div>
                </div>
              )}

              {/* Schedule Button */}
              <button onClick={handleSchedule}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">
                ✓ Schedule Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
