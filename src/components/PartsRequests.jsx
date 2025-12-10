import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PartsRequests({ theme: t }) {
  const [requests, setRequests] = useState([])
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [selectedRequests, setSelectedRequests] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [selectedSupplier, setSelectedSupplier] = useState(null)

  useEffect(() => {
    loadRequests()
    loadSuppliers()
  }, [])

  const loadRequests = async () => {
    const { data } = await supabase
      .from('parts_requests')
      .select(`
        *,
        work_orders(job_number, customers(first_name, last_name), vehicles(make, model, registration))
      `)
      .order('created_at', { ascending: false })
    
    if (data) setRequests(data)
  }

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('is_supplier', true)
      .order('company_name')
    if (data) setSuppliers(data)
  }

  const getUrgencyBadge = (urgency) => {
    const styles = {
      need_now: 'bg-red-500',
      need_today: 'bg-orange-500',
      can_wait: 'bg-green-500'
    }
    const labels = {
      need_now: '🔴 URGENT',
      need_today: '🟡 TODAY',
      can_wait: '🟢 CAN WAIT'
    }
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[urgency]}`}>
      {labels[urgency]}
    </span>
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500',
      ordered: 'bg-blue-500',
      fulfilled: 'bg-green-500',
      cancelled: 'bg-gray-500'
    }
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[status]}`}>
      {status.toUpperCase()}
    </span>
  }

  const toggleSelectRequest = (requestId) => {
    if (selectedRequests.includes(requestId)) {
      setSelectedRequests(selectedRequests.filter(id => id !== requestId))
    } else {
      setSelectedRequests([...selectedRequests, requestId])
    }
  }

  const openOrderModal = () => {
    if (selectedRequests.length === 0) {
      alert('Select at least one request to order')
      return
    }
    setShowOrderModal(true)
  }

  const createOrderFromRequests = async () => {
    if (!selectedSupplier) {
      alert('Select a supplier')
      return
    }

    // Generate PO number
    const { data: poNumberData } = await supabase.rpc('generate_po_number')
    
    // Create PO
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert([{
        po_number: poNumberData,
        supplier_id: selectedSupplier,
        status: 'draft',
        notes: `Created from ${selectedRequests.length} parts requests`
      }])
      .select()
      .single()

    if (poError) {
      alert('Error: ' + poError.message)
      return
    }

    // Get the selected requests
    const requestsToOrder = requests.filter(r => selectedRequests.includes(r.id))
    
    // Add items to PO
    const itemsToInsert = []
    for (const req of requestsToOrder) {
      // Try to find matching part
      const { data: partData } = await supabase
        .from('parts')
        .select('*')
        .or(`name.ilike.%${req.part_description}%,part_number.ilike.%${req.part_description}%`)
        .limit(1)
        .single()

      if (partData) {
        itemsToInsert.push({
          purchase_order_id: poData.id,
          part_id: partData.id,
          quantity_ordered: req.quantity,
          unit_cost: partData.cost_price || 0,
          total_cost: (partData.cost_price || 0) * req.quantity
        })
      }
    }

    if (itemsToInsert.length > 0) {
      await supabase.from('purchase_order_items').insert(itemsToInsert)
    }

    // Mark requests as ordered
    await supabase
      .from('parts_requests')
      .update({ 
        status: 'ordered',
        ordered_date: new Date().toISOString(),
        po_id: poData.id
      })
      .in('id', selectedRequests)

    alert(`✓ Purchase order ${poData.po_number} created with ${itemsToInsert.length} items`)
    setShowOrderModal(false)
    setSelectedRequests([])
    setSelectedSupplier(null)
    loadRequests()
  }

  const fulfillRequest = async (requestId) => {
    if (!confirm('Mark this request as fulfilled?')) return
    
    await supabase
      .from('parts_requests')
      .update({ status: 'fulfilled' })
      .eq('id', requestId)
    
    loadRequests()
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const orderedRequests = requests.filter(r => r.status === 'ordered')

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>📦 Parts Requests</h2>
        {selectedRequests.length > 0 && (
          <button
            onClick={openOrderModal}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-lg">
            🛒 Create Order ({selectedRequests.length} items)
          </button>
        )}
      </div>

      {/* Pending Requests */}
      <div className="mb-8">
        <h3 className={`text-2xl font-bold ${t.text} mb-4`}>⏳ Pending Requests</h3>
        {pendingRequests.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {pendingRequests.map(req => (
              <div key={req.id} className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 ${selectedRequests.includes(req.id) ? 'border-blue-500' : ''}`}>
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedRequests.includes(req.id)}
                    onChange={() => toggleSelectRequest(req.id)}
                    className="mt-1 w-6 h-6 cursor-pointer"
                  />
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className={`text-xl font-bold ${t.text} mb-1`}>{req.part_description}</div>
                        <div className={`text-sm ${t.textSecondary}`}>
                          Job: {req.work_orders?.job_number} • {req.work_orders?.customers?.first_name} {req.work_orders?.customers?.last_name}
                        </div>
                        {req.work_orders?.vehicles && (
                          <div className={`text-sm ${t.textSecondary}`}>
                            {req.work_orders.vehicles.make} {req.work_orders.vehicles.model} ({req.work_orders.vehicles.registration})
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {getUrgencyBadge(req.urgency)}
                        {getStatusBadge(req.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className={`${t.surface} ${t.border} border rounded p-3`}>
                        <div className={`text-xs ${t.textSecondary}`}>Quantity</div>
                        <div className={`text-2xl font-bold ${t.text}`}>{req.quantity}</div>
                      </div>
                      <div className={`${t.surface} ${t.border} border rounded p-3`}>
                        <div className={`text-xs ${t.textSecondary}`}>Requested By</div>
                        <div className={`text-sm font-semibold ${t.text}`}>{req.requested_by}</div>
                      </div>
                      <div className={`${t.surface} ${t.border} border rounded p-3`}>
                        <div className={`text-xs ${t.textSecondary}`}>Requested</div>
                        <div className={`text-sm ${t.text}`}>{new Date(req.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>

                    {req.notes && (
                      <div className={`mt-3 p-3 ${t.surface} ${t.border} border rounded`}>
                        <div className={`text-xs ${t.textSecondary} mb-1`}>Notes:</div>
                        <div className={`text-sm ${t.text}`}>{req.notes}</div>
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => fulfillRequest(req.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium">
                        Mark Fulfilled
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`${t.surface} rounded-lg shadow p-12 text-center ${t.border} border`}>
            <div className="text-6xl mb-4">✓</div>
            <div className={`text-xl ${t.text}`}>No pending parts requests</div>
          </div>
        )}
      </div>

      {/* Ordered Requests */}
      {orderedRequests.length > 0 && (
        <div>
          <h3 className={`text-2xl font-bold ${t.text} mb-4`}>📋 Ordered (Awaiting Delivery)</h3>
          <div className="space-y-3">
            {orderedRequests.map(req => (
              <div key={req.id} className={`${t.surface} rounded-lg shadow p-4 ${t.border} border`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`font-semibold ${t.text}`}>{req.part_description}</div>
                    <div className={`text-xs ${t.textSecondary}`}>
                      Qty: {req.quantity} • Ordered: {new Date(req.ordered_date).toLocaleDateString()}
                    </div>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Create Purchase Order</h3>
              <button onClick={() => setShowOrderModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Select Supplier *</label>
                <select
                  value={selectedSupplier || ''}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className={`w-full px-3 py-3 ${t.input} rounded border text-lg`}>
                  <option value="">Choose supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.company_name || `${s.first_name} ${s.last_name}`} {s.supplier_code && `(${s.supplier_code})`} - {s.lead_time_days} day delivery
                    </option>
                  ))}
                </select>
              </div>

              <div className={`${t.surface} ${t.border} border rounded-lg p-4 mb-6`}>
                <h4 className={`font-bold ${t.text} mb-3`}>Items to Order ({selectedRequests.length})</h4>
                <div className="space-y-2">
                  {requests.filter(r => selectedRequests.includes(r.id)).map(req => (
                    <div key={req.id} className={`flex justify-between items-center p-2 ${t.surface} ${t.border} border rounded`}>
                      <div className={`${t.text}`}>{req.part_description}</div>
                      <div className={`font-bold ${t.text}`}>Qty: {req.quantity}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={createOrderFromRequests}
                disabled={!selectedSupplier}
                className={`w-full ${selectedSupplier ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'} text-white py-3 rounded-lg font-bold text-lg`}>
                Create Draft Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}