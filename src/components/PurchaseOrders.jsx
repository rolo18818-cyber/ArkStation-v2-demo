import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PurchaseOrders({ theme: t }) {
  const [orders, setOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [parts, setParts] = useState([])
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [orderItems, setOrderItems] = useState([])
  const [ordersBySupplier, setOrdersBySupplier] = useState({})
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadOrders()
    loadSuppliers()
    loadParts()
  }, [])

  const loadOrders = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select('*, customers(company_name, first_name, last_name)')
      .order('created_at', { ascending: false })
    if (data) setOrders(data)
  }

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('is_supplier', true)
      .order('company_name')
    if (data) setSuppliers(data)
  }

  const loadParts = async () => {
    const { data } = await supabase
      .from('parts')
      .select('*')
      .order('name')
    if (data) setParts(data)
  }

  const filteredParts = parts.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.part_number?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const addToCart = (part) => {
    const supplierId = part.supplier_id
    if (!supplierId) {
      alert('This part has no supplier assigned. Please assign a supplier in Inventory.')
      return
    }

    const supplier = suppliers.find(s => s.id === supplierId)
    
    setOrdersBySupplier(prev => {
      const existing = prev[supplierId] || { supplier, items: [] }
      const existingItem = existing.items.find(i => i.part_id === part.id)
      
      if (existingItem) {
        return {
          ...prev,
          [supplierId]: {
            ...existing,
            items: existing.items.map(i =>
              i.part_id === part.id
                ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_cost }
                : i
            )
          }
        }
      } else {
        return {
          ...prev,
          [supplierId]: {
            ...existing,
            items: [...existing.items, {
              part_id: part.id,
              part_name: part.name,
              part_number: part.part_number,
              supplier_part_number: part.supplier_part_number,
              quantity: 1,
              unit_cost: part.cost_price || 0,
              total: part.cost_price || 0
            }]
          }
        }
      }
    })
  }

  const updateItemQty = (supplierId, partId, newQty) => {
    if (newQty < 1) {
      removeItem(supplierId, partId)
      return
    }

    setOrdersBySupplier(prev => ({
      ...prev,
      [supplierId]: {
        ...prev[supplierId],
        items: prev[supplierId].items.map(i =>
          i.part_id === partId
            ? { ...i, quantity: newQty, total: newQty * i.unit_cost }
            : i
        )
      }
    }))
  }

  const removeItem = (supplierId, partId) => {
    setOrdersBySupplier(prev => {
      const updated = {
        ...prev,
        [supplierId]: {
          ...prev[supplierId],
          items: prev[supplierId].items.filter(i => i.part_id !== partId)
        }
      }
      
      if (updated[supplierId].items.length === 0) {
        delete updated[supplierId]
      }
      
      return updated
    })
  }

  const createSingleSupplierOrder = async (supplierId) => {
    const order = ordersBySupplier[supplierId]
    if (!order || order.items.length === 0) return

    const { data: poNumberData } = await supabase.rpc('generate_po_number')
    
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert([{
        po_number: poNumberData,
        supplier_id: supplierId,
        status: 'draft'
      }])
      .select()
      .single()

    if (poError) {
      alert('Error: ' + poError.message)
      return
    }

    const itemsToInsert = order.items.map(item => ({
      purchase_order_id: poData.id,
      part_id: item.part_id,
      quantity_ordered: item.quantity,
      unit_cost: item.unit_cost,
      total_cost: item.total
    }))

    await supabase.from('purchase_order_items').insert(itemsToInsert)

    alert(`✓ Purchase order created: ${poData.po_number}`)
    
    setOrdersBySupplier(prev => {
      const updated = {...prev}
      delete updated[supplierId]
      return updated
    })
    
    loadOrders()
  }

  const createAllOrders = async () => {
    const supplierIds = Object.keys(ordersBySupplier)
    if (supplierIds.length === 0) {
      alert('No items in cart')
      return
    }

    for (const supplierId of supplierIds) {
      await createSingleSupplierOrder(supplierId)
    }
    
    alert(`✓ Created ${supplierIds.length} purchase orders!`)
    setShowOrderForm(false)
  }

  const viewOrder = async (order) => {
    setSelectedOrder(order)
    const { data } = await supabase
      .from('purchase_order_items')
      .select('*, parts(name, part_number)')
      .eq('purchase_order_id', order.id)
    setOrderItems(data || [])
    setShowViewModal(true)
  }

  const exportToCSV = (order, items) => {
    const csvContent = [
      ['Purchase Order', order.po_number],
      ['Supplier', order.customers.company_name || `${order.customers.first_name} ${order.customers.last_name}`],
      ['Date', new Date(order.order_date).toLocaleDateString()],
      [''],
      ['Part Number', 'Description', 'Qty', 'Unit Cost', 'Total'],
      ...items.map(item => [
        item.parts?.part_number || '',
        item.parts?.name || '',
        item.quantity_ordered,
        `$${item.unit_cost.toFixed(2)}`,
        `$${item.total_cost.toFixed(2)}`
      ]),
      [''],
      ['Subtotal', '', '', '', `$${order.subtotal.toFixed(2)}`],
      ['Tax (10%)', '', '', '', `$${order.tax.toFixed(2)}`],
      ['Total', '', '', '', `$${order.total_cost.toFixed(2)}`]
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${order.po_number}.csv`
    a.click()
  }

  const receiveItems = async (itemId, quantityReceived) => {
    if (quantityReceived < 1) return

    await supabase.rpc('receive_po_items', {
      p_po_item_id: itemId,
      p_quantity_received: quantityReceived
    })

    alert('✓ Items received')
    viewOrder(selectedOrder)
    loadOrders()
  }

  const sendOrder = async (orderId) => {
    if (!confirm('Mark this order as SENT?')) return

    await supabase
      .from('purchase_orders')
      .update({ 
        status: 'sent',
        sent_date: new Date().toISOString(),
        sent_by: 'Current User'
      })
      .eq('id', orderId)

    alert('✓ Order marked as sent')
    loadOrders()
  }

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-500',
      sent: 'bg-blue-500',
      confirmed: 'bg-purple-500',
      partially_received: 'bg-orange-500',
      received: 'bg-green-500',
      cancelled: 'bg-red-500'
    }
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[status]}`}>
      {status.toUpperCase()}
    </span>
  }

  const totalOrders = Object.keys(ordersBySupplier).length
  const totalItems = Object.values(ordersBySupplier).reduce((sum, order) => sum + order.items.length, 0)

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>🛒 Purchase Orders</h2>
        <button
          onClick={() => setShowOrderForm(!showOrderForm)}
          className={`${t.primary} ${t.primaryHover} ${t.primaryText} px-4 py-2 rounded-lg font-medium`}>
          {showOrderForm ? 'Cancel' : '+ New Order'}
        </button>
      </div>

      {showOrderForm && (
        <div className={`${t.surface} rounded-lg shadow-lg p-6 mb-6 ${t.border} border`}>
          <h3 className={`text-xl font-semibold mb-4 ${t.text}`}>Create Purchase Orders</h3>

          {/* Search Parts */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="🔍 Search parts to add..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full px-4 py-3 ${t.input} rounded-lg border text-lg`}
            />
          </div>

          {/* Available Parts */}
          {searchTerm.length > 0 && (
            <div className="mb-6 max-h-64 overflow-y-auto custom-scrollbar">
              <h4 className={`text-lg font-bold ${t.text} mb-3`}>Available Parts</h4>
              <div className="grid grid-cols-2 gap-3">
                {filteredParts.map(part => (
                  <div
                    key={part.id}
                    onClick={() => addToCart(part)}
                    className={`${t.surface} ${t.border} border rounded-lg p-3 cursor-pointer hover:shadow-lg transition-shadow`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className={`font-semibold ${t.text}`}>{part.name}</div>
                        <div className={`text-xs ${t.textSecondary}`}>{part.part_number}</div>
                        {part.supplier_part_number && (
                          <div className={`text-xs ${t.textSecondary}`}>Supplier #: {part.supplier_part_number}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-500">${part.cost_price?.toFixed(2) || '0.00'}</div>
                        <div className={`text-xs ${t.textSecondary}`}>Stock: {part.quantity}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orders by Supplier */}
          {Object.entries(ordersBySupplier).map(([supplierId, order]) => {
            const subtotal = order.items.reduce((sum, item) => sum + item.total, 0)
            const tax = subtotal * 0.10
            const total = subtotal + tax

            return (
              <div key={supplierId} className={`${t.surface} ${t.border} border-2 border-blue-500 rounded-lg p-4 mb-4`}>
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h4 className={`font-bold ${t.text} text-lg`}>
                      {order.supplier.company_name || `${order.supplier.first_name} ${order.supplier.last_name}`}
                    </h4>
                    <div className={`text-xs ${t.textSecondary}`}>
                      {order.supplier.supplier_code} • {order.supplier.lead_time_days} day delivery
                    </div>
                  </div>
                  <button
                    onClick={() => createSingleSupplierOrder(supplierId)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold">
                    Create PO (${total.toFixed(2)})
                  </button>
                </div>

                <div className="space-y-2 mb-3">
                  {order.items.map(item => (
                    <div key={item.part_id} className={`flex justify-between items-center p-2 ${t.surface} ${t.border} border rounded`}>
                      <div className={`${t.text} flex-1`}>{item.part_name}</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateItemQty(supplierId, item.part_id, item.quantity - 1)}
                          className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-sm font-bold">−</button>
                        <span className={`font-bold ${t.text} min-w-[30px] text-center`}>{item.quantity}</span>
                        <button onClick={() => updateItemQty(supplierId, item.part_id, item.quantity + 1)}
                          className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-sm font-bold">+</button>
                        <span className={`font-bold ${t.text} ml-3 min-w-[80px] text-right`}>${item.total.toFixed(2)}</span>
                        <button onClick={() => removeItem(supplierId, item.part_id)}
                          className="text-red-500 hover:text-red-700 font-bold ml-2">✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`pt-3 border-t ${t.border} text-right`}>
                  <div className={`text-sm ${t.textSecondary}`}>Subtotal: ${subtotal.toFixed(2)}</div>
                  <div className={`text-sm ${t.textSecondary}`}>GST: ${tax.toFixed(2)}</div>
                  <div className={`text-lg font-bold ${t.text}`}>Total: ${total.toFixed(2)}</div>
                </div>
              </div>
            )
          })}

          {totalOrders > 0 && (
            <div className={`${t.surface} ${t.border} border rounded-lg p-4 mb-4 bg-blue-900`}>
              <div className="flex justify-between items-center">
                <div>
                  <div className={`font-bold ${t.text} text-lg`}>
                    {totalOrders} Order{totalOrders !== 1 ? 's' : ''} • {totalItems} Item{totalItems !== 1 ? 's' : ''}
                  </div>
                  <div className={`text-xs ${t.textSecondary}`}>Creating orders for {totalOrders} supplier{totalOrders !== 1 ? 's' : ''}</div>
                </div>
                <button
                  onClick={createAllOrders}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold text-lg">
                  Create All Orders
                </button>
              </div>
            </div>
          )}

          {totalOrders === 0 && (
            <div className={`text-center py-12 ${t.textSecondary}`}>
              Search for parts above to start creating orders
            </div>
          )}
        </div>
      )}

      <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
        <table className="min-w-full">
          <thead className={`${t.surface} ${t.border} border-b`}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>PO #</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Supplier</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Date</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Total</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${t.border}`}>
            {orders.map(order => (
              <tr key={order.id} className={t.surfaceHover}>
                <td className="px-6 py-4"><div className={`text-sm font-bold ${t.text} font-mono`}>{order.po_number}</div></td>
                <td className="px-6 py-4">
                  <div className={`text-sm ${t.text}`}>
                    {order.customers?.company_name || `${order.customers?.first_name} ${order.customers?.last_name}`}
                  </div>
                </td>
                <td className="px-6 py-4"><div className={`text-sm ${t.text}`}>{new Date(order.order_date).toLocaleDateString()}</div></td>
                <td className="px-6 py-4"><div className={`text-sm font-bold ${t.text}`}>${order.total_cost.toFixed(2)}</div></td>
                <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => viewOrder(order)} className="text-blue-500 hover:text-blue-700 font-medium text-sm">
                      View
                    </button>
                    {order.status === 'draft' && (
                      <button onClick={() => sendOrder(order.id)} className="text-green-500 hover:text-green-700 font-medium text-sm">
                        Send
                      </button>
                    )}
                    <button onClick={() => exportToCSV(order, orderItems)} className="text-purple-500 hover:text-purple-700 font-medium text-sm">
                      CSV
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {showViewModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-5xl ${t.border} border-2 max-h-[90vh] overflow-y-auto custom-scrollbar`}>
            <div className={`sticky top-0 ${t.surface} ${t.border} border-b p-6 flex justify-between items-center z-10`}>
              <div>
                <h3 className={`text-2xl font-bold ${t.text}`}>{selectedOrder.po_number}</h3>
                <p className={`text-sm ${t.textSecondary} mt-1`}>
                  {selectedOrder.customers?.company_name || `${selectedOrder.customers?.first_name} ${selectedOrder.customers?.last_name}`}
                </p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6">
              <div className="space-y-3">
                {orderItems.map(item => (
                  <div key={item.id} className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className={`font-semibold ${t.text} text-lg`}>{item.parts?.name}</div>
                        <div className={`text-xs ${t.textSecondary}`}>{item.parts?.part_number}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-500">${item.total_cost.toFixed(2)}</div>
                        <div className={`text-xs ${t.textSecondary}`}>${item.unit_cost.toFixed(2)} each</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className={`${t.surface} ${t.border} border rounded p-2 text-center`}>
                        <div className={`text-xs ${t.textSecondary}`}>Ordered</div>
                        <div className={`text-xl font-bold ${t.text}`}>{item.quantity_ordered}</div>
                      </div>
                      <div className={`${t.surface} ${t.border} border rounded p-2 text-center`}>
                        <div className={`text-xs ${t.textSecondary}`}>Received</div>
                        <div className={`text-xl font-bold text-green-500`}>{item.quantity_received}</div>
                      </div>
                      <div className={`${t.surface} ${t.border} border rounded p-2 text-center`}>
                        <div className={`text-xs ${t.textSecondary}`}>Remaining</div>
                        <div className={`text-xl font-bold text-orange-500`}>{item.quantity_ordered - item.quantity_received}</div>
                      </div>
                    </div>

                    {selectedOrder.status !== 'draft' && item.quantity_received < item.quantity_ordered && (
                      <div className="flex gap-2">
                        <button onClick={() => receiveItems(item.id, 1)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium">
                          Receive 1
                        </button>
                        <button onClick={() => receiveItems(item.id, item.quantity_ordered - item.quantity_received)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-medium">
                          Receive All
                        </button>
                      </div>
                    )}

                    {item.quantity_received >= item.quantity_ordered && (
                      <div className="text-center py-2 bg-green-500 text-white rounded font-bold">
                        ✓ FULLY RECEIVED
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className={`mt-6 ${t.border} border-t pt-4`}>
                <div className="flex justify-between text-xl font-bold">
                  <span className={t.text}>Order Total:</span>
                  <span className="text-green-500">${selectedOrder.total_cost.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}