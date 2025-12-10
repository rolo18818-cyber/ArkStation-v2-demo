import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function MobileView({ theme: t, currentUser }) {
  const [myJobs, setMyJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [showPartRequest, setShowPartRequest] = useState(false)
  const [showLaborEntry, setShowLaborEntry] = useState(false)
  const [showNotesEntry, setShowNotesEntry] = useState(false)
  const [jobParts, setJobParts] = useState([])
  const [jobLabor, setJobLabor] = useState([])
  const [partRequest, setPartRequest] = useState({
    part_description: '',
    quantity: 1,
    urgency: 'need_today',
    notes: ''
  })
  const [laborEntry, setLaborEntry] = useState({
    description: '',
    hours: ''
  })
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    if (currentUser.role === 'mechanic') {
      loadMyJobs()
      const interval = setInterval(loadMyJobs, 30000)
      return () => clearInterval(interval)
    }
  }, [])

  const loadMyJobs = async () => {
    const { data } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers(first_name, last_name),
        vehicles(make, model, year, registration)
      `)
      .eq('assigned_mechanic_id', currentUser.mechanic_id)
      .in('status', ['pending', 'in_progress', 'wait_parts'])
      .order('created_at', { ascending: false })
    
    if (data) setMyJobs(data)
  }

  const loadJobDetails = async (job) => {
    setSelectedJob(job)
    setNoteText(job.mechanic_notes || '')
    
    const { data: partsData } = await supabase
      .from('job_parts')
      .select('*, parts(name)')
      .eq('work_order_id', job.id)
    
    const { data: laborData } = await supabase
      .from('work_order_labor')
      .select('*')
      .eq('work_order_id', job.id)
      .eq('mechanic_id', currentUser.mechanic_id)
    
    setJobParts(partsData || [])
    setJobLabor(laborData || [])
  }

  const updateJobStatus = async (jobId, newStatus) => {
    const updates = { status: newStatus }
    if (newStatus === 'in_progress') {
      updates.actual_start = new Date().toISOString()
    } else if (newStatus === 'completed') {
      updates.completed_date = new Date().toISOString()
      updates.actual_end = new Date().toISOString()
    }

    await supabase.from('work_orders').update(updates).eq('id', jobId)
    loadMyJobs()
    setSelectedJob(null)
  }

  const submitPartRequest = async () => {
    if (!selectedJob || !partRequest.part_description) {
      alert('Please fill in part description')
      return
    }

    await supabase.from('parts_requests').insert([{
      work_order_id: selectedJob.id,
      requested_by: `${currentUser.first_name} ${currentUser.last_name}`,
      ...partRequest
    }])

    setShowPartRequest(false)
    setPartRequest({ part_description: '', quantity: 1, urgency: 'need_today', notes: '' })
    alert('✓ Part request submitted!')
    await supabase.from('work_orders').update({ status: 'wait_parts' }).eq('id', selectedJob.id)
    loadMyJobs()
  }

  const addLaborEntry = async () => {
    if (!laborEntry.description || !laborEntry.hours) {
      alert('Please fill in all fields')
      return
    }

    const { data: mechanic } = await supabase
      .from('mechanics')
      .select('hourly_rate')
      .eq('id', currentUser.mechanic_id)
      .single()

    const rate = mechanic?.hourly_rate || 100
    const hours = parseFloat(laborEntry.hours)

    await supabase.from('work_order_labor').insert([{
      work_order_id: selectedJob.id,
      mechanic_id: currentUser.mechanic_id,
      description: laborEntry.description,
      hours,
      rate,
      total: hours * rate
    }])

    setLaborEntry({ description: '', hours: '' })
    setShowLaborEntry(false)
    alert('✓ Labor entry added!')
    loadJobDetails(selectedJob)
  }

  const saveNotes = async () => {
    await supabase
      .from('work_orders')
      .update({ mechanic_notes: noteText })
      .eq('id', selectedJob.id)
    
    setShowNotesEntry(false)
    alert('✓ Notes saved!')
    loadJobDetails({ ...selectedJob, mechanic_notes: noteText })
  }

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-500',
      'in_progress': 'bg-blue-500',
      'wait_parts': 'bg-orange-500'
    }
    return colors[status]
  }

  if (selectedJob) {
    const totalLabor = jobLabor.reduce((sum, l) => sum + parseFloat(l.total || 0), 0)
    const totalParts = jobParts.reduce((sum, p) => sum + parseFloat(p.total_price || 0), 0)

    return (
      <div className={`min-h-screen ${t.bg} p-4`}>
        <button 
          onClick={() => setSelectedJob(null)}
          className={`mb-4 ${t.surface} ${t.text} px-6 py-3 rounded-lg font-bold shadow-lg text-lg`}>
          ← Back
        </button>

        <div className={`${t.surface} rounded-lg shadow-xl p-6 ${t.border} border mb-4`}>
          <div className={`text-3xl font-bold ${t.text} mb-3`}>{selectedJob.job_number}</div>
          <div className={`text-2xl ${t.text} mb-3`}>
            {selectedJob.customers?.first_name} {selectedJob.customers?.last_name}
          </div>
          
          {selectedJob.vehicles && (
            <div className={`${t.textSecondary} mb-4 text-xl font-semibold`}>
              {selectedJob.vehicles.year} {selectedJob.vehicles.make} {selectedJob.vehicles.model}
            </div>
          )}

          <div className={`${t.text} mb-4 text-lg leading-relaxed bg-gray-800 p-4 rounded`}>
            {selectedJob.description}
          </div>

          {selectedJob.mechanic_notes && (
            <div className={`bg-blue-900 border-2 border-blue-500 rounded-lg p-4 mb-4`}>
              <div className={`text-sm font-bold ${t.text} mb-2`}>📝 My Notes:</div>
              <div className={`${t.text} text-lg`}>{selectedJob.mechanic_notes}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className={`${t.surface} ${t.border} border-2 rounded-lg p-4 text-center`}>
              <div className={`text-sm ${t.textSecondary}`}>My Labor</div>
              <div className="text-3xl font-bold text-green-500">${totalLabor.toFixed(2)}</div>
              <div className={`text-sm ${t.textSecondary}`}>{jobLabor.length} entries</div>
            </div>
            <div className={`${t.surface} ${t.border} border-2 rounded-lg p-4 text-center`}>
              <div className={`text-sm ${t.textSecondary}`}>Parts Used</div>
              <div className="text-3xl font-bold text-blue-500">${totalParts.toFixed(2)}</div>
              <div className={`text-sm ${t.textSecondary}`}>{jobParts.length} parts</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {selectedJob.status === 'pending' && (
            <button
              onClick={() => updateJobStatus(selectedJob.id, 'in_progress')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-xl font-bold text-2xl shadow-2xl">
              🔧 START JOB
            </button>
          )}

          {selectedJob.status === 'in_progress' && (
            <>
              <button
                onClick={() => setShowLaborEntry(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-xl font-bold text-xl shadow-xl">
                ⏱️ BOOK LABOR HOURS
              </button>

              <button
                onClick={() => setShowNotesEntry(true)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-5 rounded-xl font-bold text-xl shadow-xl">
                📝 ADD/EDIT NOTES
              </button>

              <button
                onClick={() => setShowPartRequest(true)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-xl font-bold text-xl shadow-xl">
                📦 REQUEST PARTS
              </button>

              <button
                onClick={() => updateJobStatus(selectedJob.id, 'completed')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 rounded-xl font-bold text-2xl shadow-2xl mt-6">
                ✓ COMPLETE JOB
              </button>
            </>
          )}

          {selectedJob.status === 'wait_parts' && (
            <div className={`${t.surface} ${t.border} border-4 border-orange-500 rounded-xl p-8 text-center`}>
              <div className="text-6xl mb-4">⏳</div>
              <div className={`text-2xl font-bold ${t.text} mb-2`}>Waiting for Parts</div>
              <div className={`text-lg ${t.textSecondary}`}>Check with parts department</div>
              <button
                onClick={() => updateJobStatus(selectedJob.id, 'in_progress')}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold">
                Resume Work
              </button>
            </div>
          )}

          {/* Show Labor History */}
          {jobLabor.length > 0 && (
            <div className={`${t.surface} ${t.border} border rounded-xl p-4 mt-6`}>
              <h3 className={`text-xl font-bold ${t.text} mb-3`}>My Labor Entries:</h3>
              {jobLabor.map(labor => (
                <div key={labor.id} className={`${t.surface} ${t.border} border rounded p-3 mb-2`}>
                  <div className={`font-semibold ${t.text} text-lg`}>{labor.description}</div>
                  <div className={`${t.textSecondary}`}>{labor.hours}h × ${labor.rate}/h = ${labor.total.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LABOR ENTRY MODAL */}
        {showLaborEntry && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className={`${t.surface} rounded-xl shadow-2xl p-6 w-full max-w-md ${t.border} border-2`}>
              <h3 className={`text-3xl font-bold ${t.text} mb-6`}>Book Labor Hours</h3>
              
              <div className="space-y-5">
                <div>
                  <label className={`block text-lg font-bold ${t.text} mb-2`}>What did you do? *</label>
                  <input
                    type="text"
                    value={laborEntry.description}
                    onChange={(e) => setLaborEntry({...laborEntry, description: e.target.value})}
                    className={`w-full px-4 py-4 ${t.input} rounded-lg border text-xl`}
                    placeholder="Oil change, brake service..."
                  />
                </div>

                <div>
                  <label className={`block text-lg font-bold ${t.text} mb-2`}>Hours Worked *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={laborEntry.hours}
                    onChange={(e) => setLaborEntry({...laborEntry, hours: e.target.value})}
                    className={`w-full px-4 py-4 ${t.input} rounded-lg border text-2xl font-bold text-center`}
                    placeholder="2.5"
                  />
                  <p className={`text-sm ${t.textSecondary} mt-2`}>Use 0.5 for 30min, 1.5 for 1h 30min, etc.</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowLaborEntry(false)}
                    className={`flex-1 ${t.surface} ${t.border} border-2 py-4 rounded-xl font-bold text-lg`}>
                    Cancel
                  </button>
                  <button
                    onClick={addLaborEntry}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-lg">
                    Save Labor
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NOTES MODAL */}
        {showNotesEntry && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className={`${t.surface} rounded-xl shadow-2xl p-6 w-full max-w-md ${t.border} border-2`}>
              <h3 className={`text-3xl font-bold ${t.text} mb-6`}>Job Notes</h3>
              
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows="8"
                className={`w-full px-4 py-4 ${t.input} rounded-lg border text-lg`}
                placeholder="Add notes about issues found, work performed, recommendations..."
              />

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowNotesEntry(false)}
                  className={`flex-1 ${t.surface} ${t.border} border-2 py-4 rounded-xl font-bold text-lg`}>
                  Cancel
                </button>
                <button
                  onClick={saveNotes}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold text-lg">
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PART REQUEST MODAL */}
        {showPartRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className={`${t.surface} rounded-xl shadow-2xl p-6 w-full max-w-md ${t.border} border-2`}>
              <h3 className={`text-3xl font-bold ${t.text} mb-6`}>Request Parts</h3>
              
              <div className="space-y-5">
                <div>
                  <label className={`block text-lg font-bold ${t.text} mb-2`}>What do you need? *</label>
                  <input
                    type="text"
                    value={partRequest.part_description}
                    onChange={(e) => setPartRequest({...partRequest, part_description: e.target.value})}
                    className={`w-full px-4 py-4 ${t.input} rounded-lg border text-xl`}
                    placeholder="Brake pads, oil filter..."
                  />
                </div>

                <div>
                  <label className={`block text-lg font-bold ${t.text} mb-2`}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={partRequest.quantity}
                    onChange={(e) => setPartRequest({...partRequest, quantity: parseInt(e.target.value)})}
                    className={`w-full px-4 py-4 ${t.input} rounded-lg border text-2xl font-bold text-center`}
                  />
                </div>

                <div>
                  <label className={`block text-lg font-bold ${t.text} mb-2`}>How urgent?</label>
                  <select
                    value={partRequest.urgency}
                    onChange={(e) => setPartRequest({...partRequest, urgency: e.target.value})}
                    className={`w-full px-4 py-4 ${t.input} rounded-lg border text-xl font-bold`}>
                    <option value="need_now">🔴 URGENT - Work stopped</option>
                    <option value="need_today">🟡 Need today</option>
                    <option value="can_wait">🟢 Can wait</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-lg font-bold ${t.text} mb-2`}>Notes</label>
                  <textarea
                    value={partRequest.notes}
                    onChange={(e) => setPartRequest({...partRequest, notes: e.target.value})}
                    rows="3"
                    className={`w-full px-4 py-3 ${t.input} rounded-lg border text-lg`}
                    placeholder="Part number, specs..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowPartRequest(false)}
                    className={`flex-1 ${t.surface} ${t.border} border-2 py-4 rounded-xl font-bold text-lg`}>
                    Cancel
                  </button>
                  <button
                    onClick={submitPartRequest}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-xl font-bold text-lg">
                    Submit Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${t.bg} p-4`}>
      <div className="mb-6">
        <h1 className={`text-5xl font-bold ${t.text} mb-2`}>👋 {currentUser.first_name}</h1>
        <div className={`text-2xl ${t.textSecondary}`}>My Jobs</div>
      </div>

      {myJobs.length === 0 ? (
        <div className={`${t.surface} rounded-xl shadow-xl p-16 text-center ${t.border} border`}>
          <div className="text-9xl mb-6">✓</div>
          <div className={`text-3xl ${t.text} font-bold`}>No Active Jobs</div>
          <div className={`text-xl ${t.textSecondary} mt-2`}>All caught up!</div>
        </div>
      ) : (
        <div className="space-y-4">
          {myJobs.map(job => (
            <button
              key={job.id}
              onClick={() => loadJobDetails(job)}
              className={`w-full ${t.surface} rounded-xl shadow-xl p-6 ${t.border} border-2 text-left transition-all active:scale-98`}>
              <div className="flex justify-between items-start mb-4">
                <div className={`text-3xl font-bold ${t.text}`}>{job.job_number}</div>
                <div className={`px-4 py-2 rounded-full text-white text-base font-bold ${getStatusColor(job.status)}`}>
                  {job.status.toUpperCase().replace('_', ' ')}
                </div>
              </div>

              <div className={`text-2xl ${t.text} mb-3 font-semibold`}>
                {job.customers?.first_name} {job.customers?.last_name}
              </div>

              {job.vehicles && (
                <div className={`${t.textSecondary} mb-3 text-xl`}>
                  {job.vehicles.year} {job.vehicles.make} {job.vehicles.model}
                </div>
              )}

              <div className={`${t.text} text-lg leading-relaxed`}>
                {job.description.substring(0, 100)}{job.description.length > 100 && '...'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}