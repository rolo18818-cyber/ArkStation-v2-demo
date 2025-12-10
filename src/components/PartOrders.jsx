import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PartOrders({ theme: t, userRole }) {
  const [lowStockParts, setLowStockParts] = useState([])
  const [pendingOrders, setPendingOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [selectedParts, setSelectedParts] = useState([])
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderData, setOrderData] = useState({
    supplier_id: '',
    expected_date: '',
    notes: ''
  })

  const canOrder = userRole === 'owner' || userRole === 'manager' || userRole === 'parts'

  useEffect(() => {
    loadLowStockParts()
    loadPendingOrders()
    loadSuppliers()
  }, [])

  const loadLowStockParts = async () => {
    const { data } = await supabase.rpc('check_reorder_needed')
    if (data) setLowStockParts(data)
  }

  const loadPendingOrders = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:supplier_id(company_name, first_name, last_name),
        items:purchase_order_items(*, parts(name, part_number))
      `)
      .in('status', ['draft', 'ordered', 'partial'])
      .order('created_at', { ascending: false })
    if (data) setPendingOrders(data)
  }

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_type', 'supplier')
      .order('company_name')
    if (data) setSuppliers(data)
  }

  const togglePartSelection = (part) => {
    const exists = selectedParts.find(p => p.part_id === part.part_id)
    if (exists) {
      setSelectedParts(selectedParts.filter(p => p.part_id !== part.part_id))
    } else {
      setSelectedParts([...selectedParts, { 
        ...part, 
        order_quantity: part.reorder_quantity || 10 
      }])
    }
  }

  const updateOrderQuantity = (partId, quantity) => {
    setSelectedParts(selectedParts.map(p => 
      p.part_id === partId ? { ...p, order_quantity: parseInt(quantity) || 1 } : p
    ))
  }

  const selectAllFromSupplier = (supplierId) => {
    const supplierParts = lowStockParts.filter(p => p.supplier_id === supplierId)
    const newSelected = supplierParts.map(p => ({
      ...p,
      order_quantity: p.reorder_quantity || 10
    }))
    setSelectedParts([...selectedParts.filter(p => p.supplier_id !== supplierId), ...newSelected])
  }

  const createPurchaseOrder = async () => {
    if (!orderData.supplier_id) {
      alert('Please select a supplier')
      return
    }

    const supplierParts = selectedParts.filter(p => p.supplier_id === orderData.supplier_id)
    if (supplierParts.length === 0) {
      alert('No parts selected for this supplier')
      return
    }

    // Generate PO number
    const { data: poNumber } = await supabase.rpc('generate_po_number')

    // Calculate total
    const totalCost = supplierParts.reduce((sum, p) => sum + (p.order_quantity * 10), 0) // Placeholder cost

    // Create PO
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .insert([{
        po_number: poNumber,
        supplier_id: orderData.supplier_id,
        status: 'draft',
        total_cost: totalCost,
        expected_date: orderData.expected_date || null,
        notes: orderData.notes
      }])
      .select()
      .single()

    if (poError) {
      alert('Error creating PO: ' + poError.message)
      return
    }

    // Add PO items
    const items = supplierParts.map(p => ({
      purchase_order_id: po.id,
      part_id: p.part_id,
      quantity_ordered: p.order_quantity,
      unit_cost: 10, // Placeholder - would come from part or supplier pricing
      total_cost: p.order_quantity * 10
    }))

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(items)

    if (itemsError) {
      alert('Error adding items: ' + itemsError.message)
    } else {
      alert(`✓ Purchase Order ${poNumber} created!`)
      setShowOrderModal(false)
      setSelectedParts(selectedParts.filter(p => p.supplier_id !== orderData.supplier_id))
      setOrderData({ supplier_id: '', expected_date: '', notes: '' })
      loadPendingOrders()
    }
  }

  const markOrderReceived = async (orderId) => {
    if (!confirm('Mark this entire order as received?')) return

    const { error } = await supabase
      .from('purchase_orders')
      .update({ 
        status: 'received',
        received_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', orderId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      // Update part quantities
      const order = pendingOrders.find(o => o.id === orderId)
      for (const item of order.items) {
        await supabase.rpc('log_inventory_transaction', {
          p_part_id: item.part_id,
          p_transaction_type: 'purchase',
          p_quantity: item.quantity_ordered,
          p_notes: `Received from PO ${order.po_number}`
        })
      }
      alert('✓ Order marked as received!')
      loadPendingOrders()
      loadLowStockParts()
    }
  }

  // Group low stock by supplier
  const partsBySupplier = lowStockParts.reduce((acc, part) => {
    const key = part.supplier_id || 'no_supplier'
    if (!acc[key]) {
      acc[key] = {
        supplier_name: part.supplier_name || 'No Supplier Assigned',
        supplier_id: part.supplier_id,
        parts: []
      }
    }
    acc[key].parts.push(part)
    return acc
  }, {})

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>📦 Part Orders</h2>
        {canOrder && selectedParts.length > 0 && (
          <button
            onClick={() => setShowOrderModal(true)}
            className={`${t.primary} ${t.primaryHover} ${t.primaryText} px-6 py-3 rounded-lg font-bold`}>
            Create PO ({selectedParts.length} parts)
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-4xl font-bold text-orange-500">{lowStockParts.length}</div>
          <div className={`text-sm ${t.textSecondary}`}>Parts Need Reorder</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-4xl font-bold text-blue-500">{pendingOrders.length}</div>
          <div className={`text-sm ${t.textSecondary}`}>Pending Orders</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-4xl font-bold text-green-500">{selectedParts.length}</div>
          <div className={`text-sm ${t.textSecondary}`}>Selected for Order</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Low Stock Parts */}
        <div>
          <h3 className={`text-xl font-bold ${t.text} mb-4`}>⚠️ Low Stock - Needs Reorder</h3>
          
          {Object.values(partsBySupplier).map(group => (
            <div key={group.supplier_id || 'none'} className={`${t.surface} rounded-lg shadow-lg mb-4 ${t.border} border overflow-hidden`}>
              <div className={`${t.surface} ${t.border} border-b p-4 flex justify-between items-center`}>
                <h4 className={`font-bold ${t.text}`}>🏭 {group.supplier_name}</h4>
                {canOrder && group.supplier_id && (
                  <button
                    onClick={() => selectAllFromSupplier(group.supplier_id)}
                    className="text-blue-500 hover:text-blue-700 text-sm font-medium">
                    Select All
                  </button>
                )}
              </div>
              <div className="divide-y divide-opacity-20">
                {group.parts.map(part => {
                  const isSelected = selectedParts.some(p => p.part_id === part.part_id)
                  return (
                    <div 
                      key={part.part_id}
                      className={`p-4 flex items-center justify-between ${isSelected ? 'bg-blue-500 bg-opacity-10' : ''}`}>
                      <div className="flex items-center gap-4">
                        {canOrder && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePartSelection(part)}
                            className="w-5 h-5"
                          />
                        )}
                        <div>
                          <div className={`font-bold ${t.text}`}>{part.name}</div>
                          <div className={`text-sm ${t.textSecondary}`}>{part.part_number}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-red-500 font-bold">{part.quantity} in stock</div>
                        <div className={`text-sm ${t.textSecondary}`}>Need: {part.shortage}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {lowStockParts.length === 0 && (
            <div className={`${t.surface} rounded-lg p-8 text-center ${t.border} border`}>
              <div className="text-6xl mb-4">✓</div>
              <div className={`${t.text} font-bold`}>All parts are stocked!</div>
            </div>
          )}
        </div>

        {/* Pending Orders */}
        <div>
          <h3 className={`text-xl font-bold ${t.text} mb-4`}>📋 Pending Orders</h3>
          
          {pendingOrders.map(order => (
            <div key={order.id} className={`${t.surface} rounded-lg shadow-lg mb-4 ${t.border} border overflow-hidden`}>
              <div className={`${t.surface} ${t.border} border-b p-4`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`font-bold ${t.text}`}>{order.po_number}</div>
                    <div className={`text-sm ${t.textSecondary}`}>
                      {order.supplier?.company_name || `${order.supplier?.first_name} ${order.supplier?.last_name}`}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    order.status === 'draft' ? 'bg-gray-500' :
                    order.status === 'ordered' ? 'bg-blue-500' :
                    'bg-orange-500'
                  } text-white`}>
                    {order.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className={`text-sm ${t.textSecondary} mb-2`}>
                  {order.items?.length} items • ${order.total_cost?.toFixed(2)}
                </div>
                {order.expected_date && (
                  <div className={`text-sm ${t.textSecondary}`}>
                    Expected: {new Date(order.expected_date).toLocaleDateString()}
                  </div>
                )}
                {canOrder && order.status === 'ordered' && (
                  <button
                    onClick={() => markOrderReceived(order.id)}
                    className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded font-medium">
                    ✓ Mark Received
                  </button>
                )}
              </div>
            </div>
          ))}

          {pendingOrders.length === 0 && (
            <div className={`${t.surface} rounded-lg p-8 text-center ${t.border} border`}>
              <div className="text-6xl mb-4">📦</div>
              <div className={`${t.text} font-bold`}>No pending orders</div>
            </div>
          )}
        </div>
      </div>

      {/* Create Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-lg ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Create Purchase Order</h3>
              <button onClick={() => setShowOrderModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Supplier *</label>
                <select
                  value={orderData.supplier_id}
                  onChange={(e) => setOrderData({...orderData, supplier_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Select Supplier...</option>
                  {suppliers.map(s => {
                    const count = selectedParts.filter(p => p.supplier_id === s.id).length
                    return (
                      <option key={s.id} value={s.id}>
                        {s.company_name || `${s.first_name} ${s.last_name}`} ({count} parts selected)
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Expected Delivery Date</label>
                <input
                  type="date"
                  value={orderData.expected_date}
                  onChange={(e) => setOrderData({...orderData, expected_date: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Notes</label>
                <textarea
                  value={orderData.notes}
                  onChange={(e) => setOrderData({...orderData, notes: e.target.value})}
                  rows="3"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Order notes..."
                />
              </div>

              {orderData.supplier_id && (
                <div className={`${t.surface} ${t.border} border rounded p-3`}>
                  <div className={`text-sm font-bold ${t.text} mb-2`}>Parts to order:</div>
                  {selectedParts.filter(p => p.supplier_id === orderData.supplier_id).map(part => (
                    <div key={part.part_id} className="flex justify-between items-center py-1">
                      <span className={`text-sm ${t.text}`}>{part.name}</span>
                      <input
                        type="number"
                        min="1"
                        value={part.order_quantity}
                        onChange={(e) => updateOrderQuantity(part.part_id, e.target.value)}
                        className={`w-20 px-2 py-1 ${t.input} rounded border text-center`}
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={createPurchaseOrder}
                className={`w-full ${t.primary} ${t.primaryHover} ${t.primaryText} py-3 rounded-lg font-bold`}>
                Create Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
