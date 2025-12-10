import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function WaitingOnParts({ theme: t }) {
  const [waitingJobs, setWaitingJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [partsStatus, setPartsStatus] = useState([])
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [selectedPart, setSelectedPart] = useState(null)
  const [receiveQuantity, setReceiveQuantity] = useState(0)

  useEffect(() => {
    loadWaitingJobs()
  }, [])

  const loadWaitingJobs = async () => {
    const { data } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers(first_name, last_name, phone),
        vehicles(make, model, year, registration),
        mechanics(first_name, last_name)
      `)
      .eq('waiting_on_parts', true)
      .order('created_at', { ascending: false })

    if (data) setWaitingJobs(data)
  }

  const loadPartsStatus = async (workOrderId) => {
    const { data } = await supabase
      .from('parts_request_status')
      .select(`
        *,
        parts(name, part_number, supplier_part_number)
      `)
      .eq('work_order_id', workOrderId)
      .order('created_at')

    if (data) setPartsStatus(data)
  }

  const viewJobDetails = async (job) => {
    setSelectedJob(job)
    await loadPartsStatus(job.id)
    setShowDetailModal(true)
  }

  const openReceiveModal = (part) => {
    setSelectedPart(part)
    setReceiveQuantity(part.quantity_requested - part.quantity_received)
    setShowReceiveModal(true)
  }

  const receiveParts = async () => {
    if (receiveQuantity <= 0) {
      alert('Please enter a valid quantity')
      return
    }

    const { error } = await supabase.rpc('mark_parts_received', {
      p_parts_request_status_id: selectedPart.id,
      p_quantity_received: receiveQuantity
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Parts received!')
      setShowReceiveModal(false)
      setSelectedPart(null)
      await loadPartsStatus(selectedJob.id)
      await loadWaitingJobs()
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500',
      ordered: 'bg-blue-500',
      partially_received: 'bg-orange-500',
      received: 'bg-green-500',
      cancelled: 'bg-red-500'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[status]}`}>
        {status.toUpperCase().replace('_', ' ')}
      </span>
    )
  }

  const calculateProgress = (job) => {
    if (!partsStatus.length) return 0
    const received = partsStatus.filter(p => p.status === 'received').length
    return (received / partsStatus.length) * 100
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className={`text-3xl font-bold ${t.text}`}>⏳ Jobs Waiting on Parts</h2>
          <p className={`text-sm ${t.textSecondary} mt-1`}>
            {waitingJobs.length} job{waitingJobs.length !== 1 ? 's' : ''} on hold
          </p>
        </div>
      </div>

      {waitingJobs.length === 0 ? (
        <div className={`${t.surface} rounded-lg shadow-lg p-12 text-center ${t.border} border`}>
          <div className="text-6xl mb-4">✅</div>
          <h3 className={`text-2xl font-bold ${t.text} mb-2`}>No Jobs Waiting!</h3>
          <p className={`${t.textSecondary}`}>All jobs have their parts ready or are in progress</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {waitingJobs.map(job => (
            <div
              key={job.id}
              onClick={() => viewJobDetails(job)}
              className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 border-orange-500 cursor-pointer hover:shadow-xl transition-all`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className={`text-xl font-bold ${t.text} mb-1`}>{job.job_number}</h3>
                  <p className={`text-sm ${t.textSecondary}`}>
                    {job.customers?.first_name} {job.customers?.last_name}
                  </p>
                  <p className={`text-xs ${t.textSecondary}`}>
                    {job.vehicles?.year} {job.vehicles?.make} {job.vehicles?.model}
                  </p>
                </div>
                <span className="text-4xl">⏳</span>
              </div>

              <div className={`${t.surface} ${t.border} border rounded p-3 mb-4`}>
                <p className={`text-sm ${t.text} font-medium mb-1`}>Work Description:</p>
                <p className={`text-sm ${t.textSecondary}`}>{job.description}</p>
              </div>

              {job.inspection_notes && (
                <div className={`${t.surface} ${t.border} border rounded p-3 mb-4 bg-blue-900 bg-opacity-30`}>
                  <p className={`text-sm ${t.text} font-medium mb-1`}>📝 Inspection Notes:</p>
                  <p className={`text-sm ${t.textSecondary}`}>{job.inspection_notes}</p>
                </div>
              )}

              {job.additional_issues_found && (
                <div className={`${t.surface} ${t.border} border rounded p-3 mb-4 bg-red-900 bg-opacity-30`}>
                  <p className={`text-sm ${t.text} font-medium mb-1`}>⚠️ Additional Issues Found:</p>
                  <p className={`text-sm ${t.textSecondary}`}>{job.additional_issues_found}</p>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className={`text-xs ${t.textSecondary}`}>
                  Waiting since {new Date(job.updated_at).toLocaleDateString()}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    viewJobDetails(job)
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded font-medium text-sm"
                >
                  View Parts Status
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-4xl ${t.border} border-2 max-h-[90vh] overflow-y-auto`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center sticky top-0 z-10`}>
              <div>
                <h3 className={`text-2xl font-bold ${t.text}`}>{selectedJob.job_number}</h3>
                <p className={`text-sm ${t.textSecondary}`}>
                  {selectedJob.customers?.first_name} {selectedJob.customers?.last_name} •
                  {selectedJob.vehicles?.year} {selectedJob.vehicles?.make} {selectedJob.vehicles?.model}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-red-500 hover:text-red-700 font-bold text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className={`text-sm font-medium ${t.text}`}>Parts Arrival Progress</span>
                  <span className={`text-sm font-bold ${t.text}`}>
                    {partsStatus.filter(p => p.status === 'received').length} / {partsStatus.length} received
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4">
                  <div
                    className="h-4 rounded-full bg-green-500 transition-all"
                    style={{ width: `${calculateProgress(selectedJob)}%` }}
                  />
                </div>
              </div>

              {/* Parts List */}
              <h4 className={`text-xl font-bold ${t.text} mb-4`}>Parts Status</h4>
              <div className="space-y-3">
                {partsStatus.map(part => (
                  <div
                    key={part.id}
                    className={`${t.surface} ${t.border} border-2 rounded-lg p-4 ${
                      part.status === 'received' ? 'border-green-500' : 'border-orange-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h5 className={`font-bold ${t.text} mb-1`}>{part.parts?.name}</h5>
                        <p className={`text-xs ${t.textSecondary}`}>
                          Part #: {part.parts?.part_number}
                          {part.parts?.supplier_part_number && ` • Supplier #: ${part.parts.supplier_part_number}`}
                        </p>
                      </div>
                      {getStatusBadge(part.status)}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className={`${t.surface} ${t.border} border rounded p-2 text-center`}>
                        <div className={`text-xs ${t.textSecondary}`}>Requested</div>
                        <div className={`text-lg font-bold ${t.text}`}>{part.quantity_requested}</div>
                      </div>
                      <div className={`${t.surface} ${t.border} border rounded p-2 text-center`}>
                        <div className={`text-xs ${t.textSecondary}`}>Received</div>
                        <div className={`text-lg font-bold text-green-500`}>{part.quantity_received}</div>
                      </div>
                      <div className={`${t.surface} ${t.border} border rounded p-2 text-center`}>
                        <div className={`text-xs ${t.textSecondary}`}>Remaining</div>
                        <div className={`text-lg font-bold text-orange-500`}>
                          {part.quantity_requested - part.quantity_received}
                        </div>
                      </div>
                    </div>

                    {part.expected_arrival_date && (
                      <div className={`text-xs ${t.textSecondary} mb-2`}>
                        Expected: {new Date(part.expected_arrival_date).toLocaleDateString()}
                      </div>
                    )}

                    {part.notes && (
                      <div className={`text-xs ${t.textSecondary} mb-3 italic`}>
                        Note: {part.notes}
                      </div>
                    )}

                    {part.status !== 'received' && (
                      <button
                        onClick={() => openReceiveModal(part)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded font-medium"
                      >
                        Mark as Received
                      </button>
                    )}

                    {part.status === 'received' && part.actual_arrival_date && (
                      <div className="text-center py-2 bg-green-500 text-white rounded font-bold">
                        ✓ RECEIVED on {new Date(part.actual_arrival_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {partsStatus.every(p => p.status === 'received') && (
                <div className="mt-6 bg-green-500 text-white p-4 rounded-lg text-center">
                  <div className="text-3xl mb-2">✓</div>
                  <div className="font-bold text-lg">All Parts Received!</div>
                  <div className="text-sm">This job has been automatically returned to pending status</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receive Parts Modal */}
      {showReceiveModal && selectedPart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-md ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Receive Parts</h3>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="text-red-500 hover:text-red-700 font-bold text-xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <h4 className={`font-bold ${t.text} mb-2`}>{selectedPart.parts?.name}</h4>
                <p className={`text-sm ${t.textSecondary}`}>
                  Part #: {selectedPart.parts?.part_number}
                </p>
              </div>

              <div className={`${t.surface} ${t.border} border rounded p-4 mb-4`}>
                <div className="flex justify-between mb-2">
                  <span className={`text-sm ${t.textSecondary}`}>Quantity Requested:</span>
                  <span className={`font-bold ${t.text}`}>{selectedPart.quantity_requested}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className={`text-sm ${t.textSecondary}`}>Already Received:</span>
                  <span className={`font-bold text-green-500`}>{selectedPart.quantity_received}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-700">
                  <span className={`text-sm ${t.textSecondary}`}>Remaining:</span>
                  <span className={`font-bold text-orange-500`}>
                    {selectedPart.quantity_requested - selectedPart.quantity_received}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <label className={`block text-sm font-medium ${t.text} mb-2`}>
                  Quantity Receiving Now *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedPart.quantity_requested - selectedPart.quantity_received}
                  value={receiveQuantity}
                  onChange={(e) => setReceiveQuantity(parseInt(e.target.value))}
                  className={`w-full px-3 py-2 ${t.input} rounded border text-lg font-bold text-center`}
                />
              </div>

              <button
                onClick={receiveParts}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-lg"
              >
                Receive {receiveQuantity} Part{receiveQuantity !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}