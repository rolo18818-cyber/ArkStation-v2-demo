import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function MyJobs({ theme: t, currentUser }) {
  const [jobs, setJobs] = useState([])
  const [mechanic, setMechanic] = useState(null)
  const [filter, setFilter] = useState('today')
  const [selectedJob, setSelectedJob] = useState(null)
  const [showSignOff, setShowSignOff] = useState(false)
  const [loading, setLoading] = useState(false)
  const [clockedOnJob, setClockedOnJob] = useState(null)
  
  // Sign off form
  const [signOffData, setSignOffData] = useState({
    work_completed: '',
    work_required: '',
    technical_notes: '',
    actual_hours: '',
    labour_rate: 120,
    labour_description: 'General Service Labour'
  })

  useEffect(() => {
    findMechanic()
  }, [currentUser])

  useEffect(() => {
    if (mechanic) {
      loadJobs()
      checkClockedOnJob()
    }
  }, [mechanic, filter])

  const findMechanic = async () => {
    if (!currentUser) return

    // Try user_id link first
    let { data } = await supabase
      .from('mechanics')
      .select('*')
      .eq('user_id', currentUser.id)
      .single()

    if (!data) {
      // Try name match
      const fullName = `${currentUser.first_name} ${currentUser.last_name}`.trim().toLowerCase()
      const { data: allMechanics } = await supabase.from('mechanics').select('*')
      data = allMechanics?.find(m => 
        m.name?.toLowerCase() === fullName ||
        `${m.first_name || ''} ${m.last_name || ''}`.trim().toLowerCase() === fullName
      )
    }

    if (data) {
      setMechanic(data)
    }
  }

  const loadJobs = async () => {
    if (!mechanic) return

    let query = supabase
      .from('work_orders')
      .select(`
        *,
        customers(first_name, last_name, phone),
        vehicles(make, model, year, registration)
      `)
      .eq('assigned_mechanic_id', mechanic.id)
      .order('priority', { ascending: false })

    if (filter === 'today') {
      query = query.in('status', ['pending', 'in_progress', 'waiting_on_parts'])
    } else if (filter === 'completed') {
      query = query.eq('status', 'completed')
    }

    const { data } = await query
    if (data) setJobs(data)
  }

  const checkClockedOnJob = async () => {
    if (!mechanic) return
    
    // Find job with active clock
    const { data } = await supabase
      .from('job_time_entries')
      .select('*, work_orders(*)')
      .eq('mechanic_id', mechanic.id)
      .is('clock_out', null)
      .single()

    if (data) {
      setClockedOnJob(data)
    } else {
      setClockedOnJob(null)
    }
  }

  // Clock ON to a job
  const clockOnJob = async (job) => {
    if (clockedOnJob) {
      alert(`Already clocked on to ${clockedOnJob.work_orders?.job_number || 'another job'}. Clock off first.`)
      return
    }

    setLoading(true)
    
    // Create job time entry
    const { error } = await supabase.from('job_time_entries').insert([{
      work_order_id: job.id,
      mechanic_id: mechanic.id,
      clock_in: new Date().toISOString()
    }])

    if (!error) {
      // Update job status to in_progress
      await supabase.from('work_orders').update({ 
        status: 'in_progress',
        job_clock_in: new Date().toISOString()
      }).eq('id', job.id)
    }

    await loadJobs()
    await checkClockedOnJob()
    setLoading(false)
  }

  // Clock OFF from a job (pause)
  const clockOffJob = async () => {
    if (!clockedOnJob) return

    setLoading(true)
    
    const clockIn = new Date(clockedOnJob.clock_in)
    const clockOut = new Date()
    const hoursWorked = Math.round((clockOut - clockIn) / 1000 / 60 / 60 * 100) / 100

    await supabase.from('job_time_entries').update({
      clock_out: clockOut.toISOString(),
      hours_worked: hoursWorked
    }).eq('id', clockedOnJob.id)

    await checkClockedOnJob()
    await loadJobs()
    setLoading(false)
  }

  // Get total time on job
  const getJobTotalTime = async (jobId) => {
    const { data } = await supabase
      .from('job_time_entries')
      .select('hours_worked')
      .eq('work_order_id', jobId)
      .not('hours_worked', 'is', null)

    return data?.reduce((sum, e) => sum + (e.hours_worked || 0), 0) || 0
  }

  // Open sign off modal
  const openSignOff = async (job) => {
    const totalHours = await getJobTotalTime(job.id)
    setSelectedJob(job)
    setSignOffData({
      work_completed: '',
      work_required: '',
      technical_notes: job.notes || '',
      actual_hours: totalHours.toFixed(1) || '',
      labour_rate: mechanic?.hourly_rate || 120,
      labour_description: 'General Service Labour'
    })
    setShowSignOff(true)
  }

  // AI Suggest for work completed
  const aiSuggestCompletion = () => {
    if (!selectedJob) return

    const vehicle = selectedJob.vehicles
    const vehicleStr = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'motorcycle'
    const desc = selectedJob.description?.toLowerCase() || ''

    let suggestion = ''
    
    if (desc.includes('first service') || desc.includes('1000km')) {
      suggestion = `Completed first service on ${vehicleStr}. Changed engine oil and filter. Checked and adjusted chain tension. Inspected brakes, tyres, and all fluid levels. Tested all lights and controls. Vehicle running well and ready for collection.`
    } else if (desc.includes('major service')) {
      suggestion = `Completed major service on ${vehicleStr}. Changed engine oil, oil filter, air filter, and spark plugs. Replaced brake fluid and coolant. Adjusted valve clearances. Inspected brake pads and rotors. Lubricated cables and pivots. Full safety inspection completed. Vehicle in excellent condition.`
    } else if (desc.includes('tyre') || desc.includes('tire')) {
      suggestion = `Replaced tyres on ${vehicleStr}. Fitted new rubber, balanced wheels, and checked tyre pressures. Inspected brake components while wheels were removed. Test ridden and handling correctly.`
    } else if (desc.includes('brake')) {
      suggestion = `Completed brake service on ${vehicleStr}. Replaced brake pads front and rear. Inspected rotors - within spec. Bled brake system with fresh fluid. Brakes now working correctly with good feel at lever/pedal.`
    } else if (desc.includes('chain') || desc.includes('sprocket')) {
      suggestion = `Replaced chain and sprockets on ${vehicleStr}. Fitted new chain, front and rear sprockets. Adjusted chain tension and lubricated. Checked wheel alignment. Test ridden - smooth power delivery.`
    } else {
      suggestion = `Completed ${selectedJob.description || 'service'} on ${vehicleStr}. All work carried out to manufacturer specifications. Vehicle inspected and test ridden. Ready for customer collection.`
    }

    // Replace the text (not append)
    setSignOffData(prev => ({ ...prev, work_completed: suggestion }))
  }

  // Complete sign off
  const completeSignOff = async () => {
    if (!signOffData.work_completed.trim()) {
      alert('Please enter work completed notes')
      return
    }
    if (!signOffData.actual_hours) {
      alert('Please enter actual hours worked')
      return
    }

    setLoading(true)

    // Clock off if still on job
    if (clockedOnJob?.work_order_id === selectedJob.id) {
      await clockOffJob()
    }

    // Update work order
    await supabase.from('work_orders').update({
      status: 'completed',
      completion_notes: signOffData.work_completed,
      work_required: signOffData.work_required,
      technical_notes: signOffData.technical_notes,
      actual_hours: parseFloat(signOffData.actual_hours),
      completed_at: new Date().toISOString()
    }).eq('id', selectedJob.id)

    // Add labour entry
    if (signOffData.actual_hours > 0) {
      await supabase.from('work_order_labor').insert([{
        work_order_id: selectedJob.id,
        description: signOffData.labour_description,
        hours: parseFloat(signOffData.actual_hours),
        rate: parseFloat(signOffData.labour_rate),
        total: parseFloat(signOffData.actual_hours) * parseFloat(signOffData.labour_rate),
        mechanic_id: mechanic.id
      }])
    }

    setShowSignOff(false)
    setSelectedJob(null)
    await loadJobs()
    setLoading(false)
  }

  // Mark waiting on parts
  const markWaitingParts = async (job) => {
    await supabase.from('work_orders').update({ status: 'waiting_on_parts' }).eq('id', job.id)
    loadJobs()
  }

  // Format duration
  const formatDuration = (startDate) => {
    const start = new Date(startDate)
    const diff = new Date() - start
    const hours = Math.floor(diff / 1000 / 60 / 60)
    const mins = Math.floor((diff / 1000 / 60) % 60)
    return `${hours}h ${mins}m`
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

  if (!mechanic) {
    return (
      <div className={`${t.surface} rounded-lg ${t.border} border p-12 text-center`}>
        <div className="text-4xl mb-4">👨‍🔧</div>
        <h3 className={`text-xl font-bold ${t.text} mb-2`}>Mechanic Profile Not Found</h3>
        <p className={t.textSecondary}>Your user account needs to be linked to a mechanic profile.</p>
        <p className={`text-sm ${t.textSecondary} mt-2`}>Ask your manager to link your account in System → Mechanics</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className={`text-3xl font-bold ${t.text} flex items-center gap-3`}>
            🔧 My Jobs
          </h2>
          <p className={t.textSecondary}>
            {clockedOnJob ? (
              <span className="text-green-500">● Clocked on to {clockedOnJob.work_orders?.job_number}</span>
            ) : (
              <span className="text-gray-500">● Not clocked on to any job</span>
            )}
          </p>
        </div>
        
        <div className="flex gap-2">
          {['today', 'all', 'completed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium capitalize ${
                filter === f ? 'bg-blue-600 text-white' : `${t.surface} ${t.text} ${t.border} border`
              }`}>
              {f === 'today' ? "Today's Jobs" : f}
            </button>
          ))}
        </div>
      </div>

      {/* Active Job Timer */}
      {clockedOnJob && (
        <div className="bg-green-600 rounded-xl p-4 mb-6 flex justify-between items-center">
          <div className="text-white">
            <div className="font-bold text-lg">⏱️ Working on: {clockedOnJob.work_orders?.job_number}</div>
            <div className="text-white/80">Started: {new Date(clockedOnJob.clock_in).toLocaleTimeString()}</div>
            <div className="text-2xl font-bold mt-1">{formatDuration(clockedOnJob.clock_in)}</div>
          </div>
          <button onClick={clockOffJob} disabled={loading}
            className="bg-white text-green-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100">
            ⏸️ Pause / Clock Off Job
          </button>
        </div>
      )}

      {/* Jobs List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {jobs.map(job => {
          const isActive = clockedOnJob?.work_order_id === job.id
          return (
            <div key={job.id} 
              className={`${t.surface} rounded-xl ${t.border} border-2 overflow-hidden ${
                isActive ? 'ring-2 ring-green-500' : ''
              }`}>
              {/* Job Header */}
              <div className={`p-4 ${isActive ? 'bg-green-600' : 'bg-gray-800'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-white font-bold text-lg">{job.job_number}</div>
                    <div className="text-white/80">
                      {job.customers?.first_name} {job.customers?.last_name}
                    </div>
                  </div>
                  <span className={`${getStatusColor(job.status)} text-white text-xs px-3 py-1 rounded-full`}>
                    {job.status?.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Job Details */}
              <div className="p-4 space-y-3">
                {job.vehicles && (
                  <div className={`flex items-center gap-2 ${t.text}`}>
                    <span>🏍️</span>
                    <span className="font-medium">
                      {job.vehicles.year} {job.vehicles.make} {job.vehicles.model}
                    </span>
                  </div>
                )}

                <div className={t.textSecondary}>
                  {job.description}
                </div>

                {job.estimated_hours && (
                  <div className={`text-sm ${t.textSecondary}`}>
                    Est: {job.estimated_hours}h
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3 border-t border-gray-700">
                  {!isActive && job.status !== 'completed' && (
                    <button onClick={() => clockOnJob(job)} disabled={loading || clockedOnJob}
                      className={`flex-1 py-2 rounded-lg font-medium ${
                        clockedOnJob 
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}>
                      ▶️ Clock On
                    </button>
                  )}

                  {isActive && (
                    <button onClick={clockOffJob} disabled={loading}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg font-medium">
                      ⏸️ Pause
                    </button>
                  )}

                  {job.status !== 'completed' && (
                    <>
                      <button onClick={() => markWaitingParts(job)}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium">
                        🔧 Parts
                      </button>
                      <button onClick={() => openSignOff(job)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
                        ✅ Sign Off
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {jobs.length === 0 && (
        <div className={`${t.surface} rounded-lg ${t.border} border p-12 text-center`}>
          <div className="text-4xl mb-2">✅</div>
          <div className={t.text}>No jobs found</div>
          <div className={`text-sm ${t.textSecondary}`}>
            {filter === 'today' ? 'No active jobs for today' : 'Try a different filter'}
          </div>
        </div>
      )}

      {/* Sign Off Modal */}
      {showSignOff && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-xl shadow-2xl w-full max-w-2xl ${t.border} border max-h-[90vh] overflow-y-auto`}>
            {/* Header */}
            <div className={`p-4 ${t.border} border-b sticky top-0 ${t.surface}`}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`text-xl font-bold ${t.text}`}>Sign Off Job</h3>
                  <p className={t.textSecondary}>{selectedJob.job_number}</p>
                </div>
                <button onClick={() => setShowSignOff(false)} className="text-red-500 text-2xl">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Work Completed */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className={`font-medium ${t.text}`}>Work Completed *</label>
                  <button onClick={aiSuggestCompletion}
                    className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded">
                    🤖 AI Suggest
                  </button>
                </div>
                <textarea value={signOffData.work_completed}
                  onChange={(e) => setSignOffData({...signOffData, work_completed: e.target.value})}
                  rows={4}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  placeholder="Describe the work completed..." />
              </div>

              {/* Work Still Required */}
              <div>
                <label className={`font-medium ${t.text} block mb-2`}>Work Still Required (if any)</label>
                <textarea value={signOffData.work_required}
                  onChange={(e) => setSignOffData({...signOffData, work_required: e.target.value})}
                  rows={2}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  placeholder="Any follow-up work needed..." />
              </div>

              {/* Technical Notes */}
              <div>
                <label className={`font-medium ${t.text} block mb-2`}>Technical Notes</label>
                <textarea value={signOffData.technical_notes}
                  onChange={(e) => setSignOffData({...signOffData, technical_notes: e.target.value})}
                  rows={2}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  placeholder="Part numbers, measurements, observations..." />
              </div>

              {/* Labour Entry */}
              <div className={`${t.border} border rounded-lg p-4`}>
                <h4 className={`font-bold ${t.text} mb-3`}>💰 Labour Entry</h4>
                
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <label className={`text-sm ${t.textSecondary} block mb-1`}>Hours *</label>
                    <input type="number" step="0.5" value={signOffData.actual_hours}
                      onChange={(e) => setSignOffData({...signOffData, actual_hours: e.target.value})}
                      className={`w-full px-3 py-2 ${t.input} rounded-lg border text-lg font-bold`} />
                  </div>
                  <div>
                    <label className={`text-sm ${t.textSecondary} block mb-1`}>Rate ($/hr)</label>
                    <input type="number" value={signOffData.labour_rate}
                      onChange={(e) => setSignOffData({...signOffData, labour_rate: e.target.value})}
                      className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
                  </div>
                  <div>
                    <label className={`text-sm ${t.textSecondary} block mb-1`}>Total</label>
                    <div className={`px-3 py-2 ${t.surface} ${t.border} border rounded-lg text-lg font-bold text-green-500`}>
                      ${((parseFloat(signOffData.actual_hours) || 0) * (parseFloat(signOffData.labour_rate) || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className={`text-sm ${t.textSecondary} block mb-1`}>Description</label>
                  <input type="text" value={signOffData.labour_description}
                    onChange={(e) => setSignOffData({...signOffData, labour_description: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={completeSignOff} disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold text-lg">
                  ✅ Complete Sign Off
                </button>
                <button onClick={() => setShowSignOff(false)}
                  className={`${t.surface} ${t.text} ${t.border} border px-6 py-3 rounded-lg`}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
