import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function MechanicJobView({ theme: t, currentUser }) {
  const [myJobs, setMyJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [view, setView] = useState('today') // today, all, completed
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [showSignOff, setShowSignOff] = useState(false)
  const [signOffData, setSignOffData] = useState({
    work_completed: '',
    work_required: '',
    mechanic_notes: '',
    hours_worked: ''
  })
  const [clockedIn, setClockedIn] = useState(null)

  const mechanicId = currentUser?.mechanic_id || currentUser?.id

  useEffect(() => {
    loadMyJobs()
    checkClockStatus()
  }, [view])

  const loadMyJobs = async () => {
    setLoading(true)
    let query = supabase
      .from('work_orders')
      .select(`
        *,
        customers(first_name, last_name, phone),
        vehicles(year, make, model, registration, vin)
      `)
      .eq('assigned_mechanic_id', mechanicId)
      .order('priority_score', { ascending: false })
      .order('scheduled_start', { ascending: true })

    if (view === 'today') {
      const today = new Date().toISOString().split('T')[0]
      query = query
        .gte('scheduled_start', `${today}T00:00:00`)
        .lte('scheduled_start', `${today}T23:59:59`)
        .neq('status', 'completed')
    } else if (view === 'all') {
      query = query.in('status', ['pending', 'in_progress', 'waiting_on_parts'])
    } else if (view === 'completed') {
      query = query.eq('status', 'completed').limit(20)
    }

    const { data } = await query
    if (data) setMyJobs(data)
    setLoading(false)
  }

  const checkClockStatus = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', currentUser?.id)
      .gte('clock_in', `${today}T00:00:00`)
      .is('clock_out', null)
      .single()
    
    setClockedIn(data)
  }

  const loadJobChecklist = async (jobId) => {
    const { data } = await supabase
      .from('work_order_checklist')
      .select('*')
      .eq('work_order_id', jobId)
      .order('sort_order')
    
    if (data) setChecklist(data)
  }

  const selectJob = async (job) => {
    setSelectedJob(job)
    await loadJobChecklist(job.id)
    setShowSignOff(false)
  }

  // ============ JOB ACTIONS ============
  const signOnToJob = async () => {
    if (!selectedJob) return
    
    await supabase.from('work_orders').update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
      started_by: mechanicId
    }).eq('id', selectedJob.id)

    // Log activity
    await supabase.from('job_activity_log').insert({
      work_order_id: selectedJob.id,
      user_id: currentUser?.id,
      action: 'signed_on',
      details: `${currentUser?.first_name} signed onto job`
    })

    alert('✓ Signed onto job!')
    loadMyJobs()
    setSelectedJob({ ...selectedJob, status: 'in_progress' })
  }

  const startSignOff = () => {
    setSignOffData({
      work_completed: selectedJob.work_completed || '',
      work_required: selectedJob.work_required || '',
      mechanic_notes: selectedJob.mechanic_notes || '',
      hours_worked: ''
    })
    setShowSignOff(true)
  }

  const completeSignOff = async () => {
    if (!signOffData.work_completed) {
      alert('Please describe the work completed')
      return
    }

    await supabase.from('work_orders').update({
      status: 'completed',
      completed_date: new Date().toISOString(),
      completed_by: mechanicId,
      work_completed: signOffData.work_completed,
      work_required: signOffData.work_required,
      mechanic_notes: signOffData.mechanic_notes,
      actual_hours: signOffData.hours_worked ? parseFloat(signOffData.hours_worked) : null
    }).eq('id', selectedJob.id)

    // Log activity
    await supabase.from('job_activity_log').insert({
      work_order_id: selectedJob.id,
      user_id: currentUser?.id,
      action: 'signed_off',
      details: `Completed: ${signOffData.work_completed.substring(0, 100)}...`
    })

    alert('✓ Job signed off successfully!')
    setShowSignOff(false)
    setSelectedJob(null)
    loadMyJobs()
  }

  const markWaitingParts = async () => {
    const reason = prompt('What parts are you waiting for?')
    if (!reason) return

    await supabase.from('work_orders').update({
      status: 'waiting_on_parts',
      waiting_reason: reason
    }).eq('id', selectedJob.id)

    await supabase.from('job_activity_log').insert({
      work_order_id: selectedJob.id,
      user_id: currentUser?.id,
      action: 'waiting_parts',
      details: reason
    })

    alert('✓ Marked as waiting on parts')
    loadMyJobs()
    setSelectedJob({ ...selectedJob, status: 'waiting_on_parts' })
  }

  const toggleChecklistItem = async (itemId, completed) => {
    await supabase.from('work_order_checklist').update({
      is_completed: completed,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by: completed ? mechanicId : null
    }).eq('id', itemId)

    setChecklist(checklist.map(c => 
      c.id === itemId ? { ...c, is_completed: completed } : c
    ))
  }

  // ============ AI FUNCTIONS ============
  const callAI = async (prompt, systemPrompt) => {
    try {
      const response = await fetch('http://localhost:3001/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000
        })
      })
      const data = await response.json()
      return data.content?.[0]?.text || ''
    } catch (error) {
      console.error('AI Error:', error)
      return null
    }
  }

  const aiGenerateChecklist = async () => {
    if (!selectedJob) return
    setAiLoading(true)

    const vehicle = selectedJob.vehicles
    const prompt = `Generate a service checklist for:
Vehicle: ${vehicle?.year} ${vehicle?.make} ${vehicle?.model}
Job: ${selectedJob.description}

Return JSON array: [{"item": "Check description", "category": "Category"}]
Categories: Pre-Service, Engine, Brakes, Suspension, Electrical, Fluids, Final Checks`

    const result = await callAI(prompt, 'You are a motorcycle mechanic. Generate detailed service checklists. Return ONLY valid JSON.')
    
    if (result) {
      try {
        const items = JSON.parse(result)
        // Clear existing and add new
        await supabase.from('work_order_checklist').delete().eq('work_order_id', selectedJob.id)
        
        for (let i = 0; i < items.length; i++) {
          await supabase.from('work_order_checklist').insert({
            work_order_id: selectedJob.id,
            item_text: items[i].item,
            category: items[i].category,
            is_completed: false,
            sort_order: i
          })
        }
        await loadJobChecklist(selectedJob.id)
      } catch (e) {
        alert('Error generating checklist')
      }
    }
    setAiLoading(false)
  }

  const aiSuggestNotes = async () => {
    if (!selectedJob) return
    setAiLoading(true)

    const completedItems = checklist.filter(c => c.is_completed).map(c => c.item_text).join(', ')
    const uncheckedItems = checklist.filter(c => !c.is_completed).map(c => c.item_text).join(', ')

    const prompt = `Based on this motorcycle service job:
Vehicle: ${selectedJob.vehicles?.year} ${selectedJob.vehicles?.make} ${selectedJob.vehicles?.model}
Job Description: ${selectedJob.description}
Completed checklist items: ${completedItems || 'None'}
Uncompleted items: ${uncheckedItems || 'None'}

Write professional sign-off notes:
1. Work Completed summary (2-3 sentences)
2. Any recommended future work (if applicable)

Format: {"work_completed": "...", "work_required": "..."}`

    const result = await callAI(prompt, 'You are a motorcycle mechanic. Write professional service notes. Return ONLY valid JSON.')
    
    if (result) {
      try {
        const notes = JSON.parse(result)
        setSignOffData({
          ...signOffData,
          work_completed: notes.work_completed || '',
          work_required: notes.work_required || ''
        })
      } catch (e) {
        alert('Error generating notes')
      }
    }
    setAiLoading(false)
  }

  const getPriorityColor = (job) => {
    if (job.customer_waiting) return 'border-l-4 border-l-purple-500'
    if (job.priority === 'urgent') return 'border-l-4 border-l-red-500'
    if (job.priority === 'high') return 'border-l-4 border-l-orange-500'
    if (job.promised_date && new Date(job.promised_date) <= new Date()) return 'border-l-4 border-l-yellow-500'
    return ''
  }

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-500',
      in_progress: 'bg-blue-500',
      waiting_on_parts: 'bg-orange-500',
      completed: 'bg-green-500'
    }
    return colors[status] || 'bg-gray-500'
  }

  const checklistProgress = checklist.length > 0 
    ? Math.round((checklist.filter(c => c.is_completed).length / checklist.length) * 100)
    : 0

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className={`text-3xl font-bold ${t.text}`}>🔧 My Jobs</h2>
          <p className={`text-sm ${t.textSecondary}`}>
            {clockedIn ? '🟢 Clocked In' : '🔴 Not Clocked In'} • {myJobs.length} jobs
          </p>
        </div>
        <div className="flex gap-2">
          {['today', 'all', 'completed'].map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg font-medium capitalize ${
                view === v ? 'bg-blue-600 text-white' : `${t.surface} ${t.text} ${t.border} border`
              }`}
            >
              {v === 'today' ? "Today's Jobs" : v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Job List */}
        <div className="col-span-4">
          <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border overflow-hidden`}>
            <div className={`${t.border} border-b p-3`}>
              <h3 className={`font-bold ${t.text}`}>
                {view === 'today' ? "Today's Schedule" : view === 'completed' ? 'Completed Jobs' : 'All Active Jobs'}
              </h3>
            </div>
            <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
              {loading ? (
                <div className={`text-center py-8 ${t.textSecondary}`}>Loading...</div>
              ) : myJobs.length === 0 ? (
                <div className={`text-center py-8 ${t.textSecondary}`}>No jobs found</div>
              ) : (
                myJobs.map(job => (
                  <div
                    key={job.id}
                    onClick={() => selectJob(job)}
                    className={`p-4 ${t.border} border-b cursor-pointer transition-all ${
                      selectedJob?.id === job.id ? 'bg-blue-900 bg-opacity-30' : t.surfaceHover
                    } ${getPriorityColor(job)}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-bold ${t.text}`}>{job.job_number}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusBadge(job.status)} text-white`}>
                        {job.status?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className={`text-sm ${t.text}`}>
                      {job.customers?.first_name} {job.customers?.last_name}
                    </div>
                    {job.vehicles && (
                      <div className={`text-xs ${t.textSecondary}`}>
                        🏍️ {job.vehicles.year} {job.vehicles.make} {job.vehicles.model}
                      </div>
                    )}
                    <div className={`text-xs ${t.textSecondary} mt-1 truncate`}>{job.description}</div>
                    <div className="flex gap-2 mt-2">
                      {job.customer_waiting && <span className="text-xs bg-purple-500 text-white px-1 rounded">WAITING</span>}
                      {job.priority === 'urgent' && <span className="text-xs bg-red-500 text-white px-1 rounded">URGENT</span>}
                      {job.priority === 'high' && <span className="text-xs bg-orange-500 text-white px-1 rounded">HIGH</span>}
                      {job.estimated_hours && <span className={`text-xs ${t.textSecondary}`}>{job.estimated_hours}h est</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Job Detail */}
        <div className="col-span-8">
          {selectedJob ? (
            <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
              {/* Job Header */}
              <div className={`${t.border} border-b p-4`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className={`text-2xl font-bold ${t.text}`}>{selectedJob.job_number}</h3>
                    <div className={`${t.textSecondary}`}>
                      {selectedJob.customers?.first_name} {selectedJob.customers?.last_name}
                      {selectedJob.customers?.phone && ` • ${selectedJob.customers.phone}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedJob.status === 'pending' && (
                      <button onClick={signOnToJob} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold">
                        ▶️ Sign On
                      </button>
                    )}
                    {selectedJob.status === 'in_progress' && (
                      <>
                        <button onClick={markWaitingParts} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-bold">
                          ⏳ Waiting Parts
                        </button>
                        <button onClick={startSignOff} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold">
                          ✅ Sign Off
                        </button>
                      </>
                    )}
                    {selectedJob.status === 'waiting_on_parts' && (
                      <button onClick={signOnToJob} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold">
                        ▶️ Resume
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sign Off Form */}
              {showSignOff ? (
                <div className="p-6 space-y-4">
                  <h4 className={`text-xl font-bold ${t.text}`}>Sign Off Job</h4>
                  
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className={`text-sm font-medium ${t.text}`}>Work Completed *</label>
                      <button onClick={aiSuggestNotes} disabled={aiLoading} className="text-xs text-purple-400 hover:text-purple-300">
                        🤖 AI Suggest
                      </button>
                    </div>
                    <textarea
                      value={signOffData.work_completed}
                      onChange={(e) => setSignOffData({...signOffData, work_completed: e.target.value})}
                      rows="4"
                      className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                      placeholder="Describe all work completed..."
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-1`}>Work Still Required (if any)</label>
                    <textarea
                      value={signOffData.work_required}
                      onChange={(e) => setSignOffData({...signOffData, work_required: e.target.value})}
                      rows="2"
                      className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                      placeholder="Additional work needed, recommendations..."
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-1`}>Technical Notes</label>
                    <textarea
                      value={signOffData.mechanic_notes}
                      onChange={(e) => setSignOffData({...signOffData, mechanic_notes: e.target.value})}
                      rows="2"
                      className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                      placeholder="Technical observations, part numbers, etc..."
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-1`}>Actual Hours Worked</label>
                    <input
                      type="number"
                      step="0.5"
                      value={signOffData.hours_worked}
                      onChange={(e) => setSignOffData({...signOffData, hours_worked: e.target.value})}
                      className={`w-32 px-3 py-2 ${t.input} rounded-lg border`}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button onClick={completeSignOff} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">
                      ✅ Complete Sign Off
                    </button>
                    <button onClick={() => setShowSignOff(false)} className={`px-6 py-3 ${t.surface} ${t.text} ${t.border} border rounded-lg`}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  {/* Vehicle Info */}
                  {selectedJob.vehicles && (
                    <div className={`${t.surface} ${t.border} border rounded-lg p-4 mb-4`}>
                      <h4 className={`font-bold ${t.text} mb-2`}>🏍️ Vehicle</h4>
                      <div className={`text-lg ${t.text}`}>
                        {selectedJob.vehicles.year} {selectedJob.vehicles.make} {selectedJob.vehicles.model}
                      </div>
                      <div className={t.textSecondary}>
                        Rego: {selectedJob.vehicles.registration} • VIN: {selectedJob.vehicles.vin || 'N/A'}
                      </div>
                    </div>
                  )}

                  {/* Job Description */}
                  <div className={`${t.surface} ${t.border} border rounded-lg p-4 mb-4`}>
                    <h4 className={`font-bold ${t.text} mb-2`}>📋 Job Description</h4>
                    <p className={t.text}>{selectedJob.description}</p>
                    {selectedJob.estimated_hours && (
                      <div className={`mt-2 text-sm ${t.textSecondary}`}>
                        Estimated time: {selectedJob.estimated_hours} hours
                      </div>
                    )}
                  </div>

                  {/* Checklist */}
                  <div className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                    <div className="flex justify-between items-center mb-3">
                      <h4 className={`font-bold ${t.text}`}>✅ Service Checklist</h4>
                      <div className="flex gap-2 items-center">
                        <span className={`text-sm ${t.textSecondary}`}>{checklistProgress}%</span>
                        <button
                          onClick={aiGenerateChecklist}
                          disabled={aiLoading}
                          className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded"
                        >
                          🤖 Generate
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${checklistProgress}%` }}
                      />
                    </div>

                    {checklist.length === 0 ? (
                      <div className={`text-center py-4 ${t.textSecondary}`}>
                        No checklist. Click "Generate" to create one.
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {Object.entries(
                          checklist.reduce((acc, item) => {
                            const cat = item.category || 'General'
                            if (!acc[cat]) acc[cat] = []
                            acc[cat].push(item)
                            return acc
                          }, {})
                        ).map(([category, items]) => (
                          <div key={category} className="mb-3">
                            <div className={`text-xs font-bold ${t.textSecondary} uppercase mb-1`}>{category}</div>
                            {items.map(item => (
                              <label key={item.id} className={`flex items-center gap-2 py-1 cursor-pointer ${t.surfaceHover} rounded px-2`}>
                                <input
                                  type="checkbox"
                                  checked={item.is_completed}
                                  onChange={(e) => toggleChecklistItem(item.id, e.target.checked)}
                                  className="w-5 h-5"
                                />
                                <span className={`text-sm ${item.is_completed ? 'line-through text-gray-500' : t.text}`}>
                                  {item.item_text}
                                </span>
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Previous Notes */}
                  {(selectedJob.internal_notes || selectedJob.work_required) && (
                    <div className={`${t.surface} ${t.border} border rounded-lg p-4 mt-4`}>
                      <h4 className={`font-bold ${t.text} mb-2`}>📝 Previous Notes</h4>
                      {selectedJob.internal_notes && (
                        <div className="mb-2">
                          <div className={`text-xs ${t.textSecondary}`}>Internal Notes:</div>
                          <p className={`text-sm ${t.text}`}>{selectedJob.internal_notes}</p>
                        </div>
                      )}
                      {selectedJob.work_required && (
                        <div>
                          <div className="text-xs text-orange-400">Work Required:</div>
                          <p className={`text-sm ${t.text}`}>{selectedJob.work_required}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border p-12 text-center`}>
              <div className="text-6xl mb-4">🔧</div>
              <h3 className={`text-xl font-bold ${t.text} mb-2`}>Select a Job</h3>
              <p className={t.textSecondary}>Click on a job from the list to view details and start working</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
