import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function MechanicMobile({ theme: t, currentUser }) {
  const [view, setView] = useState('today') // today, week, job
  const [myJobs, setMyJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSignOff, setShowSignOff] = useState(false)
  const [signOffData, setSignOffData] = useState({
    work_completed: '',
    work_required: '',
    mechanic_notes: '',
    hours_worked: ''
  })
  const [weekSchedule, setWeekSchedule] = useState([])

  const mechanicId = currentUser?.mechanic_id || currentUser?.id

  useEffect(() => {
    loadMyJobs()
    loadWeekSchedule()
  }, [])

  const loadMyJobs = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    
    const { data } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers(first_name, last_name, phone),
        vehicles(year, make, model, registration)
      `)
      .eq('assigned_mechanic_id', mechanicId)
      .in('status', ['pending', 'in_progress', 'waiting_on_parts'])
      .gte('scheduled_start', `${today}T00:00:00`)
      .lte('scheduled_start', `${today}T23:59:59`)
      .order('scheduled_start')

    if (data) setMyJobs(data)
    setLoading(false)
  }

  const loadWeekSchedule = async () => {
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay() + 1)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const { data } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers(first_name, last_name),
        vehicles(year, make, model, registration)
      `)
      .eq('assigned_mechanic_id', mechanicId)
      .gte('scheduled_start', weekStart.toISOString())
      .lte('scheduled_start', weekEnd.toISOString())
      .order('scheduled_start')

    if (data) {
      // Group by day
      const grouped = {}
      data.forEach(job => {
        const day = new Date(job.scheduled_start).toDateString()
        if (!grouped[day]) grouped[day] = []
        grouped[day].push(job)
      })
      setWeekSchedule(grouped)
    }
  }

  const loadChecklist = async (jobId) => {
    const { data } = await supabase
      .from('work_order_checklist')
      .select('*')
      .eq('work_order_id', jobId)
      .order('sort_order')
    if (data) setChecklist(data)
  }

  const openJob = async (job) => {
    setSelectedJob(job)
    await loadChecklist(job.id)
    setView('job')
  }

  const signOnToJob = async () => {
    await supabase.from('work_orders').update({
      status: 'in_progress',
      started_at: new Date().toISOString()
    }).eq('id', selectedJob.id)
    
    setSelectedJob({ ...selectedJob, status: 'in_progress' })
    loadMyJobs()
  }

  const toggleChecklistItem = async (itemId, completed) => {
    await supabase.from('work_order_checklist').update({
      is_completed: completed,
      completed_at: completed ? new Date().toISOString() : null
    }).eq('id', itemId)
    
    setChecklist(checklist.map(c => 
      c.id === itemId ? { ...c, is_completed: completed } : c
    ))
  }

  const markWaitingParts = async () => {
    const reason = prompt('What parts are you waiting for?')
    if (!reason) return
    
    await supabase.from('work_orders').update({
      status: 'waiting_on_parts',
      waiting_reason: reason
    }).eq('id', selectedJob.id)
    
    setSelectedJob({ ...selectedJob, status: 'waiting_on_parts' })
    loadMyJobs()
  }

  const completeSignOff = async () => {
    if (!signOffData.work_completed) {
      alert('Please describe work completed')
      return
    }

    await supabase.from('work_orders').update({
      status: 'completed',
      completed_date: new Date().toISOString(),
      work_completed: signOffData.work_completed,
      work_required: signOffData.work_required,
      mechanic_notes: signOffData.mechanic_notes,
      actual_hours: signOffData.hours_worked ? parseFloat(signOffData.hours_worked) : null
    }).eq('id', selectedJob.id)

    alert('✓ Job signed off!')
    setShowSignOff(false)
    setSelectedJob(null)
    setView('today')
    loadMyJobs()
  }

  const generateChecklist = async () => {
    if (!selectedJob?.vehicles) {
      alert('No vehicle info available')
      return
    }
    
    setLoading(true)
    const vehicle = selectedJob.vehicles
    
    try {
      const response = await fetch('http://localhost:3001/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: 'You are a motorcycle mechanic. Generate service checklists. Return ONLY a valid JSON array like [{"item": "Check item", "category": "Category"}]. Categories: Pre-Service, Engine, Brakes, Suspension, Electrical, Fluids, Final Checks. No other text.',
          messages: [{
            role: 'user',
            content: `Generate checklist for: ${vehicle.year} ${vehicle.make} ${vehicle.model}, Job: ${selectedJob.description}`
          }],
          max_tokens: 2000
        })
      })
      
      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      
      // Try to extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const items = JSON.parse(jsonMatch[0])
        
        // Clear existing and add new
        await supabase.from('work_order_checklist').delete().eq('work_order_id', selectedJob.id)
        
        for (let i = 0; i < items.length; i++) {
          await supabase.from('work_order_checklist').insert({
            work_order_id: selectedJob.id,
            item_text: items[i].item,
            category: items[i].category || 'General',
            is_completed: false,
            sort_order: i
          })
        }
        await loadChecklist(selectedJob.id)
      }
    } catch (e) {
      console.error('AI Error:', e)
      alert('Could not generate checklist')
    }
    setLoading(false)
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-500',
      in_progress: 'bg-blue-500',
      waiting_on_parts: 'bg-orange-500',
      completed: 'bg-green-500'
    }
    return colors[status] || 'bg-gray-500'
  }

  // ============ TODAY VIEW ============
  if (view === 'today') {
    return (
      <div className={`min-h-screen ${t.bg} p-4`}>
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className={`text-2xl font-bold ${t.text}`}>My Jobs</h1>
              <p className={t.textSecondary}>{new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView('week')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
              >
                📅
              </button>
              <button
                onClick={() => window.location.reload()}
                className={`${t.surface} ${t.text} px-4 py-2 rounded-lg font-medium ${t.border} border`}
              >
                🖥️
              </button>
            </div>
          </div>

          {/* Jobs List */}
          {loading ? (
            <div className={`text-center py-12 ${t.textSecondary}`}>Loading...</div>
          ) : myJobs.length === 0 ? (
            <div className={`${t.surface} rounded-xl p-8 text-center ${t.border} border`}>
              <div className="text-4xl mb-4">🎉</div>
              <div className={`font-bold ${t.text}`}>No jobs scheduled today</div>
              <button onClick={() => setView('week')} className={`mt-4 ${t.textSecondary}`}>
                View week schedule →
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myJobs.map(job => (
                <div
                  key={job.id}
                  onClick={() => openJob(job)}
                  className={`${t.surface} rounded-xl p-4 ${t.border} border-2 active:scale-98 transition-transform cursor-pointer`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`font-bold ${t.text}`}>{job.job_number}</span>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(job.status)} text-white`}>
                      {job.status?.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className={`${t.text} font-medium`}>
                    {job.customers?.first_name} {job.customers?.last_name}
                  </div>
                  
                  {job.vehicles && (
                    <div className={`text-sm ${t.textSecondary} mt-1`}>
                      🏍️ {job.vehicles.year} {job.vehicles.make} {job.vehicles.model}
                    </div>
                  )}
                  
                  <div className={`text-sm ${t.text} mt-2`}>{job.description}</div>
                  
                  {job.scheduled_start && (
                    <div className={`text-sm ${t.textSecondary} mt-2`}>
                      ⏰ {new Date(job.scheduled_start).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                      {job.estimated_hours && ` • ${job.estimated_hours}h`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ============ WEEK VIEW ============
  if (view === 'week') {
    const days = Object.keys(weekSchedule).sort((a, b) => new Date(a) - new Date(b))
    
    return (
      <div className={`min-h-screen ${t.bg} p-4`}>
        <div className="max-w-lg mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className={`text-2xl font-bold ${t.text}`}>Week Schedule</h1>
            <button
              onClick={() => setView('today')}
              className={`${t.surface} ${t.text} px-4 py-2 rounded-lg font-medium ${t.border} border`}
            >
              ← Today
            </button>
          </div>

          {days.length === 0 ? (
            <div className={`${t.surface} rounded-xl p-8 text-center ${t.border} border`}>
              <div className="text-4xl mb-4">📅</div>
              <div className={`font-bold ${t.text}`}>No jobs scheduled this week</div>
            </div>
          ) : (
            <div className="space-y-6">
              {days.map(day => (
                <div key={day}>
                  <div className={`font-bold ${t.text} mb-2`}>
                    {new Date(day).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </div>
                  <div className="space-y-2">
                    {weekSchedule[day].map(job => (
                      <div
                        key={job.id}
                        onClick={() => openJob(job)}
                        className={`${t.surface} rounded-lg p-3 ${t.border} border cursor-pointer`}
                      >
                        <div className="flex justify-between">
                          <span className={`font-medium ${t.text}`}>{job.job_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(job.status)} text-white`}>
                            {job.status?.replace('_', ' ')}
                          </span>
                        </div>
                        <div className={`text-sm ${t.textSecondary}`}>
                          {job.customers?.first_name} • {job.vehicles?.registration || job.vehicles?.model}
                        </div>
                        <div className={`text-xs ${t.textSecondary} mt-1`}>
                          {new Date(job.scheduled_start).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                          {job.estimated_hours && ` • ${job.estimated_hours}h`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ============ JOB DETAIL VIEW ============
  if (view === 'job' && selectedJob) {
    const checklistProgress = checklist.length > 0 
      ? Math.round((checklist.filter(c => c.is_completed).length / checklist.length) * 100)
      : 0

    // Sign Off Form
    if (showSignOff) {
      return (
        <div className={`min-h-screen ${t.bg} p-4`}>
          <div className="max-w-lg mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className={`text-2xl font-bold ${t.text}`}>Sign Off Job</h1>
              <button onClick={() => setShowSignOff(false)} className="text-red-500 text-2xl">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block font-medium ${t.text} mb-2`}>Work Completed *</label>
                <textarea
                  value={signOffData.work_completed}
                  onChange={(e) => setSignOffData({...signOffData, work_completed: e.target.value})}
                  rows="4"
                  className={`w-full px-4 py-3 ${t.input} rounded-xl border text-base`}
                  placeholder="Describe all work completed..."
                />
              </div>

              <div>
                <label className={`block font-medium ${t.text} mb-2`}>Work Still Required</label>
                <textarea
                  value={signOffData.work_required}
                  onChange={(e) => setSignOffData({...signOffData, work_required: e.target.value})}
                  rows="3"
                  className={`w-full px-4 py-3 ${t.input} rounded-xl border text-base`}
                  placeholder="Any additional work needed..."
                />
              </div>

              <div>
                <label className={`block font-medium ${t.text} mb-2`}>Technical Notes</label>
                <textarea
                  value={signOffData.mechanic_notes}
                  onChange={(e) => setSignOffData({...signOffData, mechanic_notes: e.target.value})}
                  rows="2"
                  className={`w-full px-4 py-3 ${t.input} rounded-xl border text-base`}
                  placeholder="Part numbers, observations..."
                />
              </div>

              <div>
                <label className={`block font-medium ${t.text} mb-2`}>Hours Worked</label>
                <input
                  type="number"
                  step="0.5"
                  value={signOffData.hours_worked}
                  onChange={(e) => setSignOffData({...signOffData, hours_worked: e.target.value})}
                  className={`w-full px-4 py-3 ${t.input} rounded-xl border text-base`}
                  placeholder="e.g., 2.5"
                />
              </div>

              <button
                onClick={completeSignOff}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg mt-4"
              >
                ✅ Complete Sign Off
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className={`min-h-screen ${t.bg} p-4 pb-32`}>
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => { setView('today'); setSelectedJob(null) }} className={`${t.text} font-medium`}>
              ← Back
            </button>
            <span className={`px-3 py-1 text-sm font-bold rounded-full ${getStatusColor(selectedJob.status)} text-white`}>
              {selectedJob.status?.replace('_', ' ')}
            </span>
          </div>

          {/* Job Info */}
          <div className={`${t.surface} rounded-xl p-4 ${t.border} border mb-4`}>
            <div className={`text-xl font-bold ${t.text}`}>{selectedJob.job_number}</div>
            <div className={`${t.text} mt-2`}>
              {selectedJob.customers?.first_name} {selectedJob.customers?.last_name}
            </div>
            {selectedJob.customers?.phone && (
              <a href={`tel:${selectedJob.customers.phone}`} className="text-blue-500 text-sm">
                📞 {selectedJob.customers.phone}
              </a>
            )}
          </div>

          {/* Vehicle */}
          {selectedJob.vehicles && (
            <div className={`${t.surface} rounded-xl p-4 ${t.border} border mb-4`}>
              <div className={`text-sm font-bold ${t.textSecondary} mb-1`}>VEHICLE</div>
              <div className={`${t.text} font-medium`}>
                {selectedJob.vehicles.year} {selectedJob.vehicles.make} {selectedJob.vehicles.model}
              </div>
              <div className={t.textSecondary}>Rego: {selectedJob.vehicles.registration}</div>
            </div>
          )}

          {/* Job Description */}
          <div className={`${t.surface} rounded-xl p-4 ${t.border} border mb-4`}>
            <div className={`text-sm font-bold ${t.textSecondary} mb-1`}>JOB</div>
            <div className={t.text}>{selectedJob.description}</div>
          </div>

          {/* Checklist */}
          <div className={`${t.surface} rounded-xl p-4 ${t.border} border mb-4`}>
            <div className="flex justify-between items-center mb-3">
              <div className={`text-sm font-bold ${t.textSecondary}`}>CHECKLIST</div>
              <button
                onClick={generateChecklist}
                disabled={loading}
                className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg"
              >
                {loading ? '...' : '🤖 Generate'}
              </button>
            </div>

            {/* Progress */}
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className={t.textSecondary}>Progress</span>
                <span className={checklistProgress === 100 ? 'text-green-500' : 'text-orange-500'}>
                  {checklistProgress}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${checklistProgress}%` }}
                />
              </div>
            </div>

            {checklist.length === 0 ? (
              <div className={`text-center py-4 ${t.textSecondary} text-sm`}>
                Tap "Generate" to create checklist
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {checklist.map(item => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded-lg ${t.surfaceHover}`}
                  >
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={(e) => toggleChecklistItem(item.id, e.target.checked)}
                      className="w-6 h-6 rounded"
                    />
                    <span className={`text-sm ${item.is_completed ? 'line-through text-gray-500' : t.text}`}>
                      {item.item_text}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons - Fixed at bottom */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-900 border-t border-gray-700">
            <div className="max-w-lg mx-auto flex gap-3">
              {selectedJob.status === 'pending' && (
                <button
                  onClick={signOnToJob}
                  className="flex-1 bg-green-600 text-white py-4 rounded-xl font-bold text-lg"
                >
                  ▶️ Sign On
                </button>
              )}
              
              {selectedJob.status === 'in_progress' && (
                <>
                  <button
                    onClick={markWaitingParts}
                    className="flex-1 bg-orange-600 text-white py-4 rounded-xl font-bold"
                  >
                    ⏳ Parts
                  </button>
                  <button
                    onClick={() => setShowSignOff(true)}
                    className="flex-1 bg-green-600 text-white py-4 rounded-xl font-bold"
                  >
                    ✅ Sign Off
                  </button>
                </>
              )}

              {selectedJob.status === 'waiting_on_parts' && (
                <button
                  onClick={signOnToJob}
                  className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg"
                >
                  ▶️ Resume Job
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
