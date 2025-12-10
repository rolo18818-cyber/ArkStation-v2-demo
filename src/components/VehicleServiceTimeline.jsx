import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function VehicleServiceTimeline({ theme: t }) {
  const [view, setView] = useState('timeline') // timeline, warranties, recalls, modifications
  const [vehicles, setVehicles] = useState([])
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [serviceHistory, setServiceHistory] = useState([])
  const [warranties, setWarranties] = useState([])
  const [recalls, setRecalls] = useState([])
  const [modifications, setModifications] = useState([])
  const [serviceIntervals, setServiceIntervals] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [modalType, setModalType] = useState('service') // service, warranty, recall, modification

  const [formData, setFormData] = useState({})

  useEffect(() => {
    loadVehicles()
  }, [])

  useEffect(() => {
    if (selectedVehicle) {
      loadVehicleData()
    }
  }, [selectedVehicle])

  const loadVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select(`
        *,
        customers(first_name, last_name)
      `)
      .order('created_at', { ascending: false })
    
    if (data) {
      setVehicles(data)
      if (data.length > 0 && !selectedVehicle) {
        setSelectedVehicle(data[0].id)
      }
    }
  }

  const loadVehicleData = async () => {
    await Promise.all([
      loadServiceHistory(),
      loadWarranties(),
      loadRecalls(),
      loadModifications(),
      loadServiceIntervals()
    ])
  }

  const loadServiceHistory = async () => {
    const { data } = await supabase.rpc('get_vehicle_history', {
      p_vehicle_id: selectedVehicle
    })
    
    if (data) setServiceHistory(data)
  }

  const loadWarranties = async () => {
    const { data } = await supabase
      .from('vehicle_warranties')
      .select('*')
      .eq('vehicle_id', selectedVehicle)
      .order('start_date', { ascending: false })
    
    if (data) setWarranties(data)
  }

  const loadRecalls = async () => {
    const { data } = await supabase
      .from('vehicle_recalls')
      .select(`
        *,
        work_orders(job_number)
      `)
      .eq('vehicle_id', selectedVehicle)
      .order('recall_date', { ascending: false })
    
    if (data) setRecalls(data)
  }

  const loadModifications = async () => {
    const { data } = await supabase
      .from('vehicle_modifications')
      .select(`
        *,
        work_orders(job_number)
      `)
      .eq('vehicle_id', selectedVehicle)
      .order('modification_date', { ascending: false })
    
    if (data) setModifications(data)
  }

  const loadServiceIntervals = async () => {
    const { data } = await supabase.rpc('calculate_service_intervals', {
      p_vehicle_id: selectedVehicle
    })
    
    if (data && data.length > 0) setServiceIntervals(data[0])
  }

  const addServiceRecord = async () => {
    const { error } = await supabase
      .from('vehicle_service_timeline')
      .insert([{
        vehicle_id: selectedVehicle,
        ...formData
      }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Service record added!')
      setShowAddModal(false)
      setFormData({})
      loadVehicleData()
    }
  }

  const addWarranty = async () => {
    const { error } = await supabase
      .from('vehicle_warranties')
      .insert([{
        vehicle_id: selectedVehicle,
        ...formData
      }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Warranty added!')
      setShowAddModal(false)
      setFormData({})
      loadVehicleData()
    }
  }

  const addRecall = async () => {
    const { error } = await supabase
      .from('vehicle_recalls')
      .insert([{
        vehicle_id: selectedVehicle,
        ...formData
      }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Recall added!')
      setShowAddModal(false)
      setFormData({})
      loadVehicleData()
    }
  }

  const addModification = async () => {
    const { error } = await supabase
      .from('vehicle_modifications')
      .insert([{
        vehicle_id: selectedVehicle,
        ...formData
      }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Modification added!')
      setShowAddModal(false)
      setFormData({})
      loadVehicleData()
    }
  }

  const updateRecallStatus = async (recallId, newStatus) => {
    const updates = { status: newStatus }
    if (newStatus === 'completed') {
      updates.completed_date = new Date().toISOString().split('T')[0]
    }

    const { error } = await supabase
      .from('vehicle_recalls')
      .update(updates)
      .eq('id', recallId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      loadRecalls()
    }
  }

  const getServiceTypeIcon = (type) => {
    const icons = {
      maintenance: '🔧',
      repair: '🛠️',
      inspection: '🔍',
      modification: '⚡',
      recall: '⚠️',
      warranty: '🛡️',
      accident: '💥'
    }
    return icons[type] || '📋'
  }

  const getServiceTypeBadge = (type) => {
    const styles = {
      maintenance: 'bg-blue-500',
      repair: 'bg-orange-500',
      inspection: 'bg-green-500',
      modification: 'bg-purple-500',
      recall: 'bg-red-500',
      warranty: 'bg-yellow-500',
      accident: 'bg-red-700'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[type]}`}>
        {type.toUpperCase()}
      </span>
    )
  }

  const getRecallStatusBadge = (status) => {
    const styles = {
      open: 'bg-red-500',
      scheduled: 'bg-orange-500',
      completed: 'bg-green-500',
      not_applicable: 'bg-gray-500'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[status]}`}>
        {status.toUpperCase().replace('_', ' ')}
      </span>
    )
  }

  const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle)

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>🏍️ Vehicle Service Timeline</h2>
        <div className="flex gap-2">
          <select
            value={selectedVehicle || ''}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className={`px-3 py-2 ${t.input} rounded border`}>
            <option value="">Select vehicle...</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.year} {v.make} {v.model} - {v.registration} ({v.customers?.first_name} {v.customers?.last_name})
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setModalType('service')
              setShowAddModal(true)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
            + Add Record
          </button>
        </div>
      </div>

      {selectedVehicleData && (
        <>
          {/* Vehicle Info Card */}
          <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border mb-6`}>
            <div className="grid grid-cols-5 gap-6">
              <div>
                <div className={`text-sm ${t.textSecondary} mb-1`}>Vehicle</div>
                <div className={`text-lg font-bold ${t.text}`}>
                  {selectedVehicleData.year} {selectedVehicleData.make} {selectedVehicleData.model}
                </div>
                <div className={`text-sm ${t.textSecondary}`}>{selectedVehicleData.registration}</div>
              </div>
              <div>
                <div className={`text-sm ${t.textSecondary} mb-1`}>Owner</div>
                <div className={`text-lg font-bold ${t.text}`}>
                  {selectedVehicleData.customers?.first_name} {selectedVehicleData.customers?.last_name}
                </div>
              </div>
              <div>
                <div className={`text-sm ${t.textSecondary} mb-1`}>Current Mileage</div>
                <div className={`text-lg font-bold ${t.text}`}>
                  {selectedVehicleData.current_mileage?.toLocaleString() || 'N/A'} km
                </div>
              </div>
              {serviceIntervals && (
                <>
                  <div>
                    <div className={`text-sm ${t.textSecondary} mb-1`}>Last Service</div>
                    <div className={`text-lg font-bold ${t.text}`}>
                      {serviceIntervals.days_since_service} days ago
                    </div>
                    <div className={`text-xs ${t.textSecondary}`}>
                      {new Date(serviceIntervals.last_service_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className={`text-sm ${t.textSecondary} mb-1`}>Next Service</div>
                    <div className={`text-lg font-bold ${serviceIntervals.is_overdue ? 'text-red-500' : t.text}`}>
                      {serviceIntervals.is_overdue ? 'OVERDUE' : 
                       serviceIntervals.next_service_due ? new Date(serviceIntervals.next_service_due).toLocaleDateString() : 'Not scheduled'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { id: 'timeline', label: 'Service Timeline', icon: '📅' },
              { id: 'warranties', label: 'Warranties', icon: '🛡️' },
              { id: 'recalls', label: 'Recalls', icon: '⚠️' },
              { id: 'modifications', label: 'Modifications', icon: '⚡' }
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

          {/* TIMELINE VIEW */}
          {view === 'timeline' && (
            <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
              <div className={`${t.surface} ${t.border} border-b p-4`}>
                <h3 className={`text-xl font-bold ${t.text}`}>Complete Service History</h3>
              </div>
              <div className="p-6">
                {serviceHistory.length > 0 ? (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-blue-500"></div>

                    <div className="space-y-6">
                      {serviceHistory.map((event, idx) => (
                        <div key={idx} className="relative pl-20">
                          {/* Timeline dot */}
                          <div className="absolute left-6 top-2 w-5 h-5 rounded-full bg-blue-600 border-4 border-gray-900"></div>

                          <div className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{getServiceTypeIcon(event.event_type)}</span>
                                <div>
                                  <div className={`font-bold ${t.text}`}>{event.event_description}</div>
                                  <div className={`text-sm ${t.textSecondary}`}>
                                    {new Date(event.event_date).toLocaleDateString('en-AU', { 
                                      weekday: 'long', 
                                      year: 'numeric', 
                                      month: 'long', 
                                      day: 'numeric' 
                                    })}
                                  </div>
                                </div>
                              </div>
                              {getServiceTypeBadge(event.event_type)}
                            </div>

                            <div className="grid grid-cols-3 gap-4 mt-3">
                              {event.mileage && (
                                <div>
                                  <div className={`text-xs ${t.textSecondary}`}>Mileage</div>
                                  <div className={`text-sm font-semibold ${t.text}`}>
                                    {event.mileage.toLocaleString()} km
                                  </div>
                                </div>
                              )}
                              {event.event_cost && (
                                <div>
                                  <div className={`text-xs ${t.textSecondary}`}>Cost</div>
                                  <div className="text-sm font-semibold text-green-500">
                                    ${event.event_cost.toLocaleString()}
                                  </div>
                                </div>
                              )}
                              {event.work_order_number && (
                                <div>
                                  <div className={`text-xs ${t.textSecondary}`}>Job Number</div>
                                  <div className={`text-sm font-mono font-semibold ${t.text}`}>
                                    {event.work_order_number}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📋</div>
                    <div className={`text-xl font-bold ${t.text} mb-2`}>No Service History</div>
                    <div className={`${t.textSecondary}`}>Add the first service record for this vehicle</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WARRANTIES VIEW */}
          {view === 'warranties' && (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    setModalType('warranty')
                    setShowAddModal(true)
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">
                  + Add Warranty
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {warranties.map(warranty => (
                  <div key={warranty.id} className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 ${
                    warranty.is_active ? 'border-green-500' : 'border-gray-500'
                  }`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className={`text-xl font-bold ${t.text} capitalize mb-1`}>
                          {warranty.warranty_type} Warranty
                        </h3>
                        <p className={`text-sm ${t.textSecondary}`}>{warranty.provider}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        warranty.is_active ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                      }`}>
                        {warranty.is_active ? 'ACTIVE' : 'EXPIRED'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className={`text-sm ${t.textSecondary}`}>Start Date:</span>
                        <span className={`text-sm font-semibold ${t.text}`}>
                          {new Date(warranty.start_date).toLocaleDateString()}
                        </span>
                      </div>
                      {warranty.end_date && (
                        <div className="flex justify-between">
                          <span className={`text-sm ${t.textSecondary}`}>End Date:</span>
                          <span className={`text-sm font-semibold ${t.text}`}>
                            {new Date(warranty.end_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {warranty.end_mileage && (
                        <div className="flex justify-between">
                          <span className={`text-sm ${t.textSecondary}`}>Mileage Limit:</span>
                          <span className={`text-sm font-semibold ${t.text}`}>
                            {warranty.end_mileage.toLocaleString()} km
                          </span>
                        </div>
                      )}
                      {warranty.cost && (
                        <div className="flex justify-between">
                          <span className={`text-sm ${t.textSecondary}`}>Cost:</span>
                          <span className="text-sm font-semibold text-green-500">
                            ${warranty.cost.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className={`text-sm ${t.textSecondary}`}>Claims Made:</span>
                        <span className={`text-sm font-semibold ${t.text}`}>
                          {warranty.claim_count}
                        </span>
                      </div>
                    </div>

                    {warranty.notes && (
                      <div className={`mt-4 pt-4 border-t ${t.border}`}>
                        <div className={`text-xs ${t.textSecondary} mb-1`}>Notes:</div>
                        <div className={`text-sm ${t.text}`}>{warranty.notes}</div>
                      </div>
                    )}
                  </div>
                ))}

                {warranties.length === 0 && (
                  <div className={`col-span-2 ${t.surface} rounded-lg shadow-lg p-12 ${t.border} border text-center`}>
                    <div className="text-6xl mb-4">🛡️</div>
                    <div className={`text-xl font-bold ${t.text} mb-2`}>No Warranties</div>
                    <div className={`${t.textSecondary}`}>Add warranty information for this vehicle</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* RECALLS VIEW */}
          {view === 'recalls' && (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    setModalType('recall')
                    setShowAddModal(true)
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium">
                  + Add Recall
                </button>
              </div>

              <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
                <table className="min-w-full">
                  <thead className={`${t.surface} ${t.border} border-b`}>
                    <tr>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Recall #</th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Date</th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Description</th>
                      <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Severity</th>
                      <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
                      <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${t.border}`}>
                    {recalls.map(recall => (
                      <tr key={recall.id} className={t.surfaceHover}>
                        <td className="px-6 py-4">
                          <div className={`text-sm font-mono font-bold ${t.text}`}>{recall.recall_number}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-sm ${t.text}`}>
                            {new Date(recall.recall_date).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-sm ${t.text}`}>{recall.description}</div>
                          {recall.work_orders && (
                            <div className={`text-xs ${t.textSecondary}`}>
                              Job: {recall.work_orders.job_number}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${
                            recall.severity === 'safety' ? 'bg-red-500' :
                            recall.severity === 'compliance' ? 'bg-orange-500' :
                            'bg-blue-500'
                          }`}>
                            {recall.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {getRecallStatusBadge(recall.status)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {recall.status === 'open' && (
                            <button
                              onClick={() => updateRecallStatus(recall.id, 'scheduled')}
                              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs mr-1">
                              Schedule
                            </button>
                          )}
                          {recall.status === 'scheduled' && (
                            <button
                              onClick={() => updateRecallStatus(recall.id, 'completed')}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs">
                              Complete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {recalls.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">✅</div>
                    <div className={`text-xl font-bold ${t.text} mb-2`}>No Recalls</div>
                    <div className={`${t.textSecondary}`}>This vehicle has no outstanding recalls</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* MODIFICATIONS VIEW */}
          {view === 'modifications' && (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    setModalType('modification')
                    setShowAddModal(true)
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium">
                  + Add Modification
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {modifications.map(mod => (
                  <div key={mod.id} className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">⚡</span>
                        <div>
                          <h3 className={`text-xl font-bold ${t.text} capitalize`}>
                            {mod.modification_type} Modification
                          </h3>
                          <p className={`text-sm ${t.textSecondary}`}>
                            {new Date(mod.modification_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      {mod.affects_warranty && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-500 text-white">
                          ⚠️ AFFECTS WARRANTY
                        </span>
                      )}
                    </div>

                    <div className={`${t.text} mb-4`}>{mod.description}</div>

                    <div className="grid grid-cols-3 gap-4">
                      {mod.installer && (
                        <div>
                          <div className={`text-xs ${t.textSecondary}`}>Installer</div>
                          <div className={`text-sm font-semibold ${t.text}`}>{mod.installer}</div>
                        </div>
                      )}
                      {mod.cost && (
                        <div>
                          <div className={`text-xs ${t.textSecondary}`}>Cost</div>
                          <div className="text-sm font-semibold text-green-500">
                            ${mod.cost.toLocaleString()}
                          </div>
                        </div>
                      )}
                      {mod.work_orders && (
                        <div>
                          <div className={`text-xs ${t.textSecondary}`}>Job Number</div>
                          <div className={`text-sm font-mono font-semibold ${t.text}`}>
                            {mod.work_orders.job_number}
                          </div>
                        </div>
                      )}
                    </div>

                    {mod.parts_installed && mod.parts_installed.length > 0 && (
                      <div className="mt-4">
                        <div className={`text-xs ${t.textSecondary} mb-2`}>Parts Installed:</div>
                        <div className="flex flex-wrap gap-2">
                          {mod.parts_installed.map((part, idx) => (
                            <span key={idx} className={`px-2 py-1 text-xs ${t.surface} ${t.border} border rounded`}>
                              {part}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {modifications.length === 0 && (
                  <div className={`${t.surface} rounded-lg shadow-lg p-12 ${t.border} border text-center`}>
                    <div className="text-6xl mb-4">⚡</div>
                    <div className={`text-xl font-bold ${t.text} mb-2`}>No Modifications</div>
                    <div className={`${t.textSecondary}`}>This vehicle has no recorded modifications</div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Add Record Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border-2 my-8`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>
                Add {modalType === 'service' ? 'Service Record' : 
                     modalType === 'warranty' ? 'Warranty' : 
                     modalType === 'recall' ? 'Recall' : 'Modification'}
              </h3>
              <button onClick={() => {
                setShowAddModal(false)
                setFormData({})
              }} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {modalType === 'service' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Service Date *</label>
                      <input
                        type="date"
                        value={formData.service_date || ''}
                        onChange={(e) => setFormData({...formData, service_date: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Service Type *</label>
                      <select
                        value={formData.service_type || ''}
                        onChange={(e) => setFormData({...formData, service_type: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}>
                        <option value="">Select type...</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="repair">Repair</option>
                        <option value="inspection">Inspection</option>
                        <option value="modification">Modification</option>
                        <option value="recall">Recall</option>
                        <option value="warranty">Warranty</option>
                        <option value="accident">Accident</option>
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
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Mileage</label>
                      <input
                        type="number"
                        value={formData.mileage || ''}
                        onChange={(e) => setFormData({...formData, mileage: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.cost || ''}
                        onChange={(e) => setFormData({...formData, cost: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Next Service Due</label>
                      <input
                        type="date"
                        value={formData.next_service_due || ''}
                        onChange={(e) => setFormData({...formData, next_service_due: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Next Service Mileage</label>
                      <input
                        type="number"
                        value={formData.next_service_mileage || ''}
                        onChange={(e) => setFormData({...formData, next_service_mileage: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_major_service || false}
                        onChange={(e) => setFormData({...formData, is_major_service: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className={`text-sm font-medium ${t.text}`}>Major Service</span>
                    </label>
                  </div>

                  <button
                    onClick={addServiceRecord}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold">
                    Add Service Record
                  </button>
                </>
              )}

              {modalType === 'warranty' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Warranty Type *</label>
                      <select
                        value={formData.warranty_type || ''}
                        onChange={(e) => setFormData({...formData, warranty_type: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}>
                        <option value="">Select type...</option>
                        <option value="manufacturer">Manufacturer</option>
                        <option value="extended">Extended</option>
                        <option value="aftermarket">Aftermarket</option>
                        <option value="powertrain">Powertrain</option>
                        <option value="comprehensive">Comprehensive</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Provider *</label>
                      <input
                        type="text"
                        value={formData.provider || ''}
                        onChange={(e) => setFormData({...formData, provider: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Start Date *</label>
                      <input
                        type="date"
                        value={formData.start_date || ''}
                        onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>End Date</label>
                      <input
                        type="date"
                        value={formData.end_date || ''}
                        onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>End Mileage</label>
                      <input
                        type="number"
                        value={formData.end_mileage || ''}
                        onChange={(e) => setFormData({...formData, end_mileage: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.cost || ''}
                        onChange={(e) => setFormData({...formData, cost: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-2`}>Notes</label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      rows="3"
                      className={`w-full px-3 py-2 ${t.input} rounded border`}
                    />
                  </div>

                  <button
                    onClick={addWarranty}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">
                    Add Warranty
                  </button>
                </>
              )}

              {modalType === 'recall' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Recall Number *</label>
                      <input
                        type="text"
                        value={formData.recall_number || ''}
                        onChange={(e) => setFormData({...formData, recall_number: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Recall Date *</label>
                      <input
                        type="date"
                        value={formData.recall_date || ''}
                        onChange={(e) => setFormData({...formData, recall_date: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-2`}>Description *</label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows="3"
                      className={`w-full px-3 py-2 ${t.input} rounded border`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-2`}>Severity *</label>
                    <select
                      value={formData.severity || 'minor'}
                      onChange={(e) => setFormData({...formData, severity: e.target.value})}
                      className={`w-full px-3 py-2 ${t.input} rounded border`}>
                      <option value="safety">Safety</option>
                      <option value="compliance">Compliance</option>
                      <option value="minor">Minor</option>
                    </select>
                  </div>

                  <button
                    onClick={addRecall}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold">
                    Add Recall
                  </button>
                </>
              )}

              {modalType === 'modification' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Modification Date *</label>
                      <input
                        type="date"
                        value={formData.modification_date || ''}
                        onChange={(e) => setFormData({...formData, modification_date: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Type *</label>
                      <select
                        value={formData.modification_type || ''}
                        onChange={(e) => setFormData({...formData, modification_type: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}>
                        <option value="">Select type...</option>
                        <option value="performance">Performance</option>
                        <option value="appearance">Appearance</option>
                        <option value="suspension">Suspension</option>
                        <option value="exhaust">Exhaust</option>
                        <option value="electronics">Electronics</option>
                        <option value="other">Other</option>
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
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Installer</label>
                      <input
                        type="text"
                        value={formData.installer || ''}
                        onChange={(e) => setFormData({...formData, installer: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.cost || ''}
                        onChange={(e) => setFormData({...formData, cost: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.affects_warranty || false}
                        onChange={(e) => setFormData({...formData, affects_warranty: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className={`text-sm font-medium ${t.text}`}>Affects Warranty</span>
                    </label>
                  </div>

                  <button
                    onClick={addModification}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold">
                    Add Modification
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}