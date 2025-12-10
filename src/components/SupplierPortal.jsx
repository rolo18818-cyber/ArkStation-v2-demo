import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function SupplierPortal({ theme: t, currentUser }) {
  const [suppliers, setSuppliers] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [showPOModal, setShowPOModal] = useState(false)
  const [parts, setParts] = useState([])
  const [supplierForm, setSupplierForm] = useState({
    name: '', contact_name: '', email: '', phone: '', address: '', account_number: '', payment_terms: '30', notes: ''
  })
  const [poForm, setPoForm] = useState({
    supplier_id: '', notes: '', items: []
  })

  useEffect(() => {
    loadSuppliers()
    loadPurchaseOrders()
    loadParts()
  }, [])

  const loadSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name')
    if (data) setSuppliers(data)
  }

  const loadPurchaseOrders = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select(`*, suppliers(name), purchase_order_items(*, parts(name, part_number))`)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setPurchaseOrders(data)
  }

  const loadParts = async () => {
    const { data } = await supabase.from('parts').select('*').order('name')
    if (data) setParts(data)
  }

  const openNewSupplier = () => {
    setSupplierForm({ name: '', contact_name: '', email: '', phone: '', address: '', account_number: '', payment_terms: '30', notes: '' })
    setShowSupplierModal(true)
  }

  const openEditSupplier = (supplier) => {
    setSupplierForm(supplier)
    setShowSupplierModal(true)
  }

  const saveSupplier = async () => {
    if (!supplierForm.name) { alert('Please enter supplier name'); return }
    try {
      if (supplierForm.id) {
        await supabase.from('suppliers').update(supplierForm).eq('id', supplierForm.id)
      } else {
        await supabase.from('suppliers').insert([supplierForm])
      }
      alert('✓ Supplier saved!')
      setShowSupplierModal(false)
      loadSuppliers()
    } catch (error) { alert('Error: ' + error.message) }
  }

  const deleteSupplier = async (id) => {
    if (!confirm('Delete this supplier?')) return
    await supabase.from('suppliers').delete().eq('id', id)
    loadSuppliers()
  }

  const openNewPO = (supplierId = '') => {
    setPoForm({ supplier_id: supplierId, notes: '', items: [{ part_id: '', quantity: 1, unit_cost: 0 }] })
    setShowPOModal(true)
  }

  const addPOItem = () => {
    setPoForm({ ...poForm, items: [...poForm.items, { part_id: '', quantity: 1, unit_cost: 0 }] })
  }

  const updatePOItem = (idx, field, value) => {
    const items = [...poForm.items]
    items[idx][field] = value
    if (field === 'part_id') {
      const part = parts.find(p => p.id === value)
      if (part) items[idx].unit_cost = part.cost_price || 0
    }
    setPoForm({ ...poForm, items })
  }

  const removePOItem = (idx) => {
    setPoForm({ ...poForm, items: poForm.items.filter((_, i) => i !== idx) })
  }

  const calculatePOTotal = () => {
    return poForm.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_cost || 0)), 0)
  }

  const createPO = async () => {
    if (!poForm.supplier_id) { alert('Select a supplier'); return }
    if (poForm.items.length === 0 || !poForm.items[0].part_id) { alert('Add at least one item'); return }

    try {
      const { data: poNumber } = await supabase.rpc('generate_po_number')
      const total = calculatePOTotal()

      const { data: po, error } = await supabase.from('purchase_orders').insert([{
        po_number: poNumber,
        supplier_id: poForm.supplier_id,
        total_amount: total,
        status: 'draft',
        notes: poForm.notes,
        created_by: currentUser?.id
      }]).select().single()

      if (error) throw error

      const items = poForm.items.filter(i => i.part_id).map(item => ({
        purchase_order_id: po.id,
        part_id: item.part_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: item.quantity * item.unit_cost
      }))

      await supabase.from('purchase_order_items').insert(items)

      alert(`✓ PO ${poNumber} created!`)
      setShowPOModal(false)
      loadPurchaseOrders()
    } catch (error) { alert('Error: ' + error.message) }
  }

  const updatePOStatus = async (poId, newStatus) => {
    await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', poId)

    if (newStatus === 'received') {
      const po = purchaseOrders.find(p => p.id === poId)
      for (const item of po.purchase_order_items || []) {
        const part = parts.find(p => p.id === item.part_id)
        if (part) {
          await supabase.from('parts').update({ quantity: part.quantity + item.quantity }).eq('id', item.part_id)
          await supabase.from('inventory_transactions').insert([{
            part_id: item.part_id,
            transaction_type: 'received',
            quantity: item.quantity,
            reference_type: 'purchase_order',
            reference_id: poId,
            notes: `PO ${po.po_number}`
          }])
        }
      }
    }
    loadPurchaseOrders()
    loadParts()
  }

  const getStatusBadge = (status) => {
    const styles = { draft: 'bg-gray-500', sent: 'bg-blue-500', confirmed: 'bg-yellow-500', shipped: 'bg-purple-500', received: 'bg-green-500', cancelled: 'bg-red-500' }
    return <span className={`px-2 py-1 text-xs font-bold rounded ${styles[status] || 'bg-gray-500'} text-white`}>{status?.toUpperCase()}</span>
  }

  const stats = {
    suppliers: suppliers.length,
    pendingPOs: purchaseOrders.filter(p => !['received', 'cancelled'].includes(p.status)).length,
    totalOutstanding: purchaseOrders.filter(p => !['received', 'cancelled'].includes(p.status)).reduce((sum, p) => sum + (p.total_amount || 0), 0)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>🏭 Supplier Portal</h2>
        <div className="flex gap-3">
          <button onClick={() => openNewPO()} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">+ New PO</button>
          <button onClick={openNewSupplier} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">+ Add Supplier</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-blue-500">{stats.suppliers}</div>
          <div className={t.textSecondary}>Suppliers</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-orange-500">{stats.pendingPOs}</div>
          <div className={t.textSecondary}>Pending Orders</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-red-500">${stats.totalOutstanding.toLocaleString()}</div>
          <div className={t.textSecondary}>Outstanding</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Suppliers List */}
        <div className={`${t.surface} rounded-lg ${t.border} border`}>
          <div className={`${t.border} border-b p-4`}>
            <h3 className={`text-lg font-bold ${t.text}`}>🏭 Suppliers</h3>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-opacity-20" style={{ borderColor: 'inherit' }}>
            {suppliers.map(supplier => (
              <div key={supplier.id} className={`p-4 ${t.surfaceHover}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`font-bold ${t.text}`}>{supplier.name}</div>
                    <div className={`text-sm ${t.textSecondary}`}>{supplier.contact_name}</div>
                    <div className={`text-xs ${t.textSecondary}`}>{supplier.phone} • {supplier.email}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openNewPO(supplier.id)} className="text-green-500 hover:text-green-700 text-sm">+ PO</button>
                    <button onClick={() => openEditSupplier(supplier)} className="text-blue-500 hover:text-blue-700 text-sm">Edit</button>
                    <button onClick={() => deleteSupplier(supplier.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                  </div>
                </div>
              </div>
            ))}
            {suppliers.length === 0 && <div className={`text-center py-8 ${t.textSecondary}`}>No suppliers</div>}
          </div>
        </div>

        {/* Recent POs */}
        <div className={`${t.surface} rounded-lg ${t.border} border`}>
          <div className={`${t.border} border-b p-4`}>
            <h3 className={`text-lg font-bold ${t.text}`}>📋 Purchase Orders</h3>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-opacity-20" style={{ borderColor: 'inherit' }}>
            {purchaseOrders.map(po => (
              <div key={po.id} className={`p-4 ${t.surfaceHover}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`font-bold ${t.text}`}>{po.po_number}</div>
                    <div className={`text-sm ${t.textSecondary}`}>{po.suppliers?.name}</div>
                    <div className={`text-xs ${t.textSecondary}`}>{new Date(po.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${t.text}`}>${po.total_amount?.toFixed(2)}</div>
                    {getStatusBadge(po.status)}
                  </div>
                </div>
                {!['received', 'cancelled'].includes(po.status) && (
                  <div className="flex gap-2 mt-2">
                    {po.status === 'draft' && <button onClick={() => updatePOStatus(po.id, 'sent')} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Send</button>}
                    {po.status === 'sent' && <button onClick={() => updatePOStatus(po.id, 'confirmed')} className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">Confirm</button>}
                    {po.status === 'confirmed' && <button onClick={() => updatePOStatus(po.id, 'shipped')} className="text-xs bg-purple-600 text-white px-2 py-1 rounded">Shipped</button>}
                    {['sent', 'confirmed', 'shipped'].includes(po.status) && <button onClick={() => updatePOStatus(po.id, 'received')} className="text-xs bg-green-600 text-white px-2 py-1 rounded">Received</button>}
                  </div>
                )}
              </div>
            ))}
            {purchaseOrders.length === 0 && <div className={`text-center py-8 ${t.textSecondary}`}>No purchase orders</div>}
          </div>
        </div>
      </div>

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-lg ${t.border} border-2`}>
            <div className={`${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>{supplierForm.id ? 'Edit' : 'New'} Supplier</h3>
              <button onClick={() => setShowSupplierModal(false)} className="text-red-500 font-bold text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className={`block text-sm ${t.text} mb-1`}>Company Name *</label><input type="text" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} className={`w-full px-3 py-2 ${t.input} rounded border`} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={`block text-sm ${t.text} mb-1`}>Contact Name</label><input type="text" value={supplierForm.contact_name} onChange={(e) => setSupplierForm({ ...supplierForm, contact_name: e.target.value })} className={`w-full px-3 py-2 ${t.input} rounded border`} /></div>
                <div><label className={`block text-sm ${t.text} mb-1`}>Account #</label><input type="text" value={supplierForm.account_number} onChange={(e) => setSupplierForm({ ...supplierForm, account_number: e.target.value })} className={`w-full px-3 py-2 ${t.input} rounded border`} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={`block text-sm ${t.text} mb-1`}>Phone</label><input type="text" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} className={`w-full px-3 py-2 ${t.input} rounded border`} /></div>
                <div><label className={`block text-sm ${t.text} mb-1`}>Email</label><input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} className={`w-full px-3 py-2 ${t.input} rounded border`} /></div>
              </div>
              <div><label className={`block text-sm ${t.text} mb-1`}>Address</label><input type="text" value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} className={`w-full px-3 py-2 ${t.input} rounded border`} /></div>
              <div><label className={`block text-sm ${t.text} mb-1`}>Payment Terms (days)</label><input type="number" value={supplierForm.payment_terms} onChange={(e) => setSupplierForm({ ...supplierForm, payment_terms: e.target.value })} className={`w-full px-3 py-2 ${t.input} rounded border`} /></div>
              <button onClick={saveSupplier} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">✓ Save Supplier</button>
            </div>
          </div>
        </div>
      )}

      {/* PO Modal */}
      {showPOModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border-2 max-h-[90vh] overflow-y-auto`}>
            <div className={`${t.border} border-b p-6 flex justify-between items-center sticky top-0 ${t.surface}`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>New Purchase Order</h3>
              <button onClick={() => setShowPOModal(false)} className="text-red-500 font-bold text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className={`block text-sm ${t.text} mb-1`}>Supplier *</label>
                <select value={poForm.supplier_id} onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })} className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className={`text-sm font-bold ${t.text}`}>Items</label>
                  <button onClick={addPOItem} className="text-blue-500 text-sm font-medium">+ Add Item</button>
                </div>
                <table className="min-w-full">
                  <thead><tr className={`${t.border} border-b`}>
                    <th className={`px-2 py-2 text-left text-xs ${t.textSecondary}`}>Part</th>
                    <th className={`px-2 py-2 w-20 text-xs ${t.textSecondary}`}>Qty</th>
                    <th className={`px-2 py-2 w-24 text-xs ${t.textSecondary}`}>Cost</th>
                    <th className={`px-2 py-2 w-24 text-right text-xs ${t.textSecondary}`}>Total</th>
                    <th className="w-8"></th>
                  </tr></thead>
                  <tbody>
                    {poForm.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1">
                          <select value={item.part_id} onChange={(e) => updatePOItem(idx, 'part_id', e.target.value)} className={`w-full px-2 py-1 ${t.input} rounded border text-sm`}>
                            <option value="">Select part...</option>
                            {parts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.part_number})</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1"><input type="number" min="1" value={item.quantity} onChange={(e) => updatePOItem(idx, 'quantity', parseInt(e.target.value) || 1)} className={`w-full px-2 py-1 ${t.input} rounded border text-sm text-center`} /></td>
                        <td className="px-2 py-1"><input type="number" step="0.01" value={item.unit_cost} onChange={(e) => updatePOItem(idx, 'unit_cost', parseFloat(e.target.value) || 0)} className={`w-full px-2 py-1 ${t.input} rounded border text-sm text-center`} /></td>
                        <td className={`px-2 py-1 text-right font-bold ${t.text}`}>${(item.quantity * item.unit_cost).toFixed(2)}</td>
                        <td className="px-2 py-1"><button onClick={() => removePOItem(idx)} className="text-red-500">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className={`${t.border} border-t`}>
                    <td colSpan="3" className={`px-2 py-2 text-right font-bold ${t.text}`}>Total:</td>
                    <td className="px-2 py-2 text-right font-bold text-green-500">${calculatePOTotal().toFixed(2)}</td>
                    <td></td>
                  </tr></tfoot>
                </table>
              </div>

              <div><label className={`block text-sm ${t.text} mb-1`}>Notes</label><textarea value={poForm.notes} onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })} rows="2" className={`w-full px-3 py-2 ${t.input} rounded border`} /></div>
              <button onClick={createPO} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">✓ Create Purchase Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
