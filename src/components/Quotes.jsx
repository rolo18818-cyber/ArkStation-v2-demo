import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Quotes({ theme: t, currentUser }) {
  const [quotes, setQuotes] = useState([])
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [parts, setParts] = useState([])
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showBuilder, setShowBuilder] = useState(false)
  const [editingQuote, setEditingQuote] = useState(null)
  const [quoteItems, setQuoteItems] = useState({ labor: [], parts: [] })
  const [formData, setFormData] = useState({
    customer_id: '',
    vehicle_id: '',
    valid_until: '',
    notes: ''
  })

  useEffect(() => {
    loadQuotes()
    loadCustomers()
    loadParts()
  }, [])

  const loadQuotes = async () => {
    const { data } = await supabase
      .from('quotes')
      .select(`*, customers(first_name, last_name, email, phone), vehicles(year, make, model, registration)`)
      .order('created_at', { ascending: false })
    if (data) setQuotes(data)
  }

  const loadCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('last_name')
    if (data) setCustomers(data)
  }

  const loadVehicles = async (customerId) => {
    if (!customerId) { setVehicles([]); return }
    const { data } = await supabase.from('vehicles').select('*').eq('customer_id', customerId).order('year', { ascending: false })
    if (data) setVehicles(data)
  }

  const loadParts = async () => {
    const { data } = await supabase.from('parts').select('*').gt('quantity', 0).order('name')
    if (data) setParts(data)
  }

  const handleCustomerChange = (customerId) => {
    setFormData({ ...formData, customer_id: customerId, vehicle_id: '' })
    loadVehicles(customerId)
  }

  const openNewQuote = () => {
    setEditingQuote(null)
    setFormData({ customer_id: '', vehicle_id: '', valid_until: '', notes: '' })
    setQuoteItems({ labor: [], parts: [] })
    setVehicles([])
    setShowBuilder(true)
  }

  const openEditQuote = async (quote) => {
    setEditingQuote(quote)
    setFormData({
      customer_id: quote.customer_id || '',
      vehicle_id: quote.vehicle_id || '',
      valid_until: quote.valid_until || '',
      notes: quote.notes || ''
    })
    await loadVehicles(quote.customer_id)
    const { data: laborItems } = await supabase.from('quote_labor').select('*').eq('quote_id', quote.id)
    const { data: partItems } = await supabase.from('quote_parts').select('*, parts(name, part_number)').eq('quote_id', quote.id)
    setQuoteItems({ labor: laborItems || [], parts: partItems || [] })
    setShowBuilder(true)
  }

  const addLaborLine = () => {
    setQuoteItems({
      ...quoteItems,
      labor: [...quoteItems.labor, { id: `new-${Date.now()}`, description: '', hours: 1, rate: 120, amount: 120 }]
    })
  }

  const updateLaborLine = (index, field, value) => {
    const updated = [...quoteItems.labor]
    updated[index][field] = value
    if (field === 'hours' || field === 'rate') {
      updated[index].amount = (parseFloat(updated[index].hours) || 0) * (parseFloat(updated[index].rate) || 0)
    }
    setQuoteItems({ ...quoteItems, labor: updated })
  }

  const removeLaborLine = (index) => setQuoteItems({ ...quoteItems, labor: quoteItems.labor.filter((_, i) => i !== index) })

  const addPartLine = () => {
    setQuoteItems({
      ...quoteItems,
      parts: [...quoteItems.parts, { id: `new-${Date.now()}`, part_id: '', quantity: 1, unit_price: 0, total_price: 0 }]
    })
  }

  const updatePartLine = (index, field, value) => {
    const updated = [...quoteItems.parts]
    updated[index][field] = value
    if (field === 'part_id') {
      const part = parts.find(p => p.id === value)
      if (part) {
        updated[index].unit_price = part.sell_price || 0
        updated[index].total_price = (updated[index].quantity || 1) * (part.sell_price || 0)
      }
    }
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].total_price = (parseFloat(updated[index].quantity) || 0) * (parseFloat(updated[index].unit_price) || 0)
    }
    setQuoteItems({ ...quoteItems, parts: updated })
  }

  const removePartLine = (index) => setQuoteItems({ ...quoteItems, parts: quoteItems.parts.filter((_, i) => i !== index) })

  const calculateTotals = () => {
    const laborTotal = quoteItems.labor.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0)
    const partsTotal = quoteItems.parts.reduce((sum, p) => sum + (parseFloat(p.total_price) || 0), 0)
    const subtotal = laborTotal + partsTotal
    const tax = subtotal * 0.1
    return { laborTotal, partsTotal, subtotal, tax, grandTotal: subtotal + tax }
  }

  const saveQuote = async (status = 'draft') => {
    if (!formData.customer_id) { alert('Please select a customer'); return }
    const totals = calculateTotals()
    try {
      let quoteId = editingQuote?.id
      if (editingQuote) {
        await supabase.from('quotes').update({
          customer_id: formData.customer_id, vehicle_id: formData.vehicle_id || null,
          valid_until: formData.valid_until || null, notes: formData.notes, status,
          subtotal: totals.subtotal, tax_amount: totals.tax, grand_total: totals.grandTotal
        }).eq('id', editingQuote.id)
      } else {
        const { data: quoteNumber } = await supabase.rpc('generate_quote_number')
        const { data: newQuote, error } = await supabase.from('quotes').insert([{
          quote_number: quoteNumber, customer_id: formData.customer_id, vehicle_id: formData.vehicle_id || null,
          valid_until: formData.valid_until || null, notes: formData.notes, status,
          subtotal: totals.subtotal, tax_amount: totals.tax, grand_total: totals.grandTotal
        }]).select().single()
        if (error) throw error
        quoteId = newQuote.id
      }
      await supabase.from('quote_labor').delete().eq('quote_id', quoteId)
      await supabase.from('quote_parts').delete().eq('quote_id', quoteId)
      if (quoteItems.labor.length > 0) {
        await supabase.from('quote_labor').insert(quoteItems.labor.map(l => ({
          quote_id: quoteId, description: l.description, hours: parseFloat(l.hours) || 0,
          rate: parseFloat(l.rate) || 0, amount: parseFloat(l.amount) || 0
        })))
      }
      if (quoteItems.parts.length > 0) {
        const partInserts = quoteItems.parts.filter(p => p.part_id).map(p => ({
          quote_id: quoteId, part_id: p.part_id, quantity: parseInt(p.quantity) || 1,
          unit_price: parseFloat(p.unit_price) || 0, total_price: parseFloat(p.total_price) || 0
        }))
        if (partInserts.length > 0) await supabase.from('quote_parts').insert(partInserts)
      }
      alert(`✓ Quote ${status === 'sent' ? 'sent' : 'saved'}!`)
      setShowBuilder(false)
      loadQuotes()
    } catch (error) { alert('Error: ' + error.message) }
  }

  const convertToWorkOrder = async (quote) => {
    if (!confirm('Convert this quote to a work order?')) return
    try {
      const { data: jobNumber } = await supabase.rpc('generate_job_number')
      const { data: workOrder, error } = await supabase.from('work_orders').insert([{
        job_number: jobNumber, customer_id: quote.customer_id, vehicle_id: quote.vehicle_id,
        description: `From Quote ${quote.quote_number}`, status: 'pending', estimated_cost: quote.grand_total
      }]).select().single()
      if (error) throw error
      const { data: laborItems } = await supabase.from('quote_labor').select('*').eq('quote_id', quote.id)
      if (laborItems?.length > 0) {
        await supabase.from('work_order_labor').insert(laborItems.map(l => ({
          work_order_id: workOrder.id, description: l.description, hours: l.hours, rate: l.rate, amount: l.amount
        })))
      }
      const { data: partItems } = await supabase.from('quote_parts').select('*').eq('quote_id', quote.id)
      if (partItems?.length > 0) {
        await supabase.from('work_order_parts').insert(partItems.map(p => ({
          work_order_id: workOrder.id, part_id: p.part_id, quantity: p.quantity, unit_price: p.unit_price, total_price: p.total_price
        })))
      }
      await supabase.from('quotes').update({ status: 'accepted' }).eq('id', quote.id)
      alert(`✓ Work Order ${jobNumber} created!`)
      loadQuotes()
    } catch (error) { alert('Error: ' + error.message) }
  }

  const deleteQuote = async (quoteId) => {
    if (!confirm('Delete this quote?')) return
    await supabase.from('quote_labor').delete().eq('quote_id', quoteId)
    await supabase.from('quote_parts').delete().eq('quote_id', quoteId)
    await supabase.from('quotes').delete().eq('id', quoteId)
    loadQuotes()
  }

  const filteredQuotes = quotes.filter(q => {
    const matchesFilter = filter === 'all' || q.status === filter
    const matchesSearch = q.quote_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customers?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.customers?.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const getStatusBadge = (status) => {
    const styles = { draft: 'bg-gray-500', sent: 'bg-blue-500', accepted: 'bg-green-500', declined: 'bg-red-500', expired: 'bg-orange-500' }
    return <span className={`px-2 py-1 text-xs font-bold rounded ${styles[status] || 'bg-gray-500'} text-white`}>{status?.toUpperCase()}</span>
  }

  const totals = calculateTotals()

  return (
    <div>
      {!showBuilder ? (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className={`text-3xl font-bold ${t.text}`}>📋 Quotes</h2>
            <button onClick={openNewQuote} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold">+ New Quote</button>
          </div>
          <div className="flex gap-4 mb-6">
            <input type="text" placeholder="Search quotes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`flex-1 px-4 py-2 ${t.input} rounded-lg border`} />
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`px-4 py-2 ${t.input} rounded-lg border`}>
              <option value="all">All Quotes</option>
              <option value="draft">Drafts</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
            </select>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
              <div className="text-3xl font-bold text-blue-500">{quotes.filter(q => q.status === 'draft').length}</div>
              <div className={t.textSecondary}>Drafts</div>
            </div>
            <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
              <div className="text-3xl font-bold text-yellow-500">{quotes.filter(q => q.status === 'sent').length}</div>
              <div className={t.textSecondary}>Pending</div>
            </div>
            <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
              <div className="text-3xl font-bold text-green-500">{quotes.filter(q => q.status === 'accepted').length}</div>
              <div className={t.textSecondary}>Accepted</div>
            </div>
            <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
              <div className="text-3xl font-bold text-green-500">${quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + (q.grand_total || 0), 0).toLocaleString()}</div>
              <div className={t.textSecondary}>Accepted Value</div>
            </div>
          </div>
          <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
            <table className="min-w-full">
              <thead className={`${t.surface} ${t.border} border-b`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Quote #</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Customer</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Vehicle</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Total</th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${t.border}`}>
                {filteredQuotes.map(quote => (
                  <tr key={quote.id} className={t.surfaceHover}>
                    <td className="px-6 py-4">
                      <div className={`font-bold ${t.text}`}>{quote.quote_number}</div>
                      <div className={`text-xs ${t.textSecondary}`}>{new Date(quote.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={t.text}>{quote.customers?.first_name} {quote.customers?.last_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={t.text}>{quote.vehicles ? `${quote.vehicles.year} ${quote.vehicles.make} ${quote.vehicles.model}` : '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-right"><div className={`font-bold ${t.text}`}>${quote.grand_total?.toFixed(2)}</div></td>
                    <td className="px-6 py-4 text-center">{getStatusBadge(quote.status)}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 justify-center">
                        <button onClick={() => openEditQuote(quote)} className="text-blue-500 hover:text-blue-700 font-medium text-sm">Edit</button>
                        {(quote.status === 'sent' || quote.status === 'draft') && (
                          <button onClick={() => convertToWorkOrder(quote)} className="text-green-500 hover:text-green-700 font-medium text-sm">Convert</button>
                        )}
                        <button onClick={() => deleteQuote(quote.id)} className="text-red-500 hover:text-red-700 font-medium text-sm">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredQuotes.length === 0 && <div className={`text-center py-12 ${t.textSecondary}`}>No quotes found</div>}
          </div>
        </>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className={`text-3xl font-bold ${t.text}`}>{editingQuote ? `Edit Quote ${editingQuote.quote_number}` : '📋 New Quote'}</h2>
            <button onClick={() => setShowBuilder(false)} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium">← Back</button>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-6">
              <div className={`${t.surface} rounded-lg p-6 ${t.border} border`}>
                <h3 className={`text-lg font-bold ${t.text} mb-4`}>Customer & Vehicle</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-1`}>Customer *</label>
                    <select value={formData.customer_id} onChange={(e) => handleCustomerChange(e.target.value)} className={`w-full px-3 py-2 ${t.input} rounded border`}>
                      <option value="">Select customer...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-1`}>Vehicle</label>
                    <select value={formData.vehicle_id} onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })} className={`w-full px-3 py-2 ${t.input} rounded border`} disabled={!formData.customer_id}>
                      <option value="">Select vehicle...</option>
                      {vehicles.map(v => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} ({v.registration})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-1`}>Valid Until</label>
                    <input type="date" value={formData.valid_until} onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })} className={`w-full px-3 py-2 ${t.input} rounded border`} />
                  </div>
                </div>
              </div>
              <div className={`${t.surface} rounded-lg p-6 ${t.border} border`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-lg font-bold ${t.text}`}>🔧 Labor</h3>
                  <button onClick={addLaborLine} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium">+ Add Labor</button>
                </div>
                {quoteItems.labor.length > 0 ? (
                  <table className="min-w-full">
                    <thead><tr className={`${t.border} border-b`}>
                      <th className={`px-2 py-2 text-left text-xs ${t.textSecondary}`}>Description</th>
                      <th className={`px-2 py-2 text-center text-xs ${t.textSecondary} w-20`}>Hours</th>
                      <th className={`px-2 py-2 text-center text-xs ${t.textSecondary} w-24`}>Rate</th>
                      <th className={`px-2 py-2 text-right text-xs ${t.textSecondary} w-24`}>Amount</th>
                      <th className="w-10"></th>
                    </tr></thead>
                    <tbody>
                      {quoteItems.labor.map((labor, idx) => (
                        <tr key={labor.id}>
                          <td className="px-2 py-2"><input type="text" value={labor.description} onChange={(e) => updateLaborLine(idx, 'description', e.target.value)} className={`w-full px-2 py-1 ${t.input} rounded border text-sm`} placeholder="Labor description..." /></td>
                          <td className="px-2 py-2"><input type="number" step="0.5" value={labor.hours} onChange={(e) => updateLaborLine(idx, 'hours', e.target.value)} className={`w-full px-2 py-1 ${t.input} rounded border text-sm text-center`} /></td>
                          <td className="px-2 py-2"><input type="number" value={labor.rate} onChange={(e) => updateLaborLine(idx, 'rate', e.target.value)} className={`w-full px-2 py-1 ${t.input} rounded border text-sm text-center`} /></td>
                          <td className={`px-2 py-2 text-right font-bold ${t.text}`}>${(labor.amount || 0).toFixed(2)}</td>
                          <td className="px-2 py-2"><button onClick={() => removeLaborLine(idx)} className="text-red-500 hover:text-red-700">✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div className={`text-center py-4 ${t.textSecondary}`}>No labor items</div>}
              </div>
              <div className={`${t.surface} rounded-lg p-6 ${t.border} border`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-lg font-bold ${t.text}`}>🔩 Parts</h3>
                  <button onClick={addPartLine} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium">+ Add Part</button>
                </div>
                {quoteItems.parts.length > 0 ? (
                  <table className="min-w-full">
                    <thead><tr className={`${t.border} border-b`}>
                      <th className={`px-2 py-2 text-left text-xs ${t.textSecondary}`}>Part</th>
                      <th className={`px-2 py-2 text-center text-xs ${t.textSecondary} w-20`}>Qty</th>
                      <th className={`px-2 py-2 text-center text-xs ${t.textSecondary} w-24`}>Price</th>
                      <th className={`px-2 py-2 text-right text-xs ${t.textSecondary} w-24`}>Total</th>
                      <th className="w-10"></th>
                    </tr></thead>
                    <tbody>
                      {quoteItems.parts.map((part, idx) => (
                        <tr key={part.id}>
                          <td className="px-2 py-2">
                            <select value={part.part_id} onChange={(e) => updatePartLine(idx, 'part_id', e.target.value)} className={`w-full px-2 py-1 ${t.input} rounded border text-sm`}>
                              <option value="">Select part...</option>
                              {parts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.part_number})</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2"><input type="number" min="1" value={part.quantity} onChange={(e) => updatePartLine(idx, 'quantity', e.target.value)} className={`w-full px-2 py-1 ${t.input} rounded border text-sm text-center`} /></td>
                          <td className="px-2 py-2"><input type="number" step="0.01" value={part.unit_price} onChange={(e) => updatePartLine(idx, 'unit_price', e.target.value)} className={`w-full px-2 py-1 ${t.input} rounded border text-sm text-center`} /></td>
                          <td className={`px-2 py-2 text-right font-bold ${t.text}`}>${(part.total_price || 0).toFixed(2)}</td>
                          <td className="px-2 py-2"><button onClick={() => removePartLine(idx)} className="text-red-500 hover:text-red-700">✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div className={`text-center py-4 ${t.textSecondary}`}>No parts added</div>}
              </div>
              <div className={`${t.surface} rounded-lg p-6 ${t.border} border`}>
                <h3 className={`text-lg font-bold ${t.text} mb-4`}>📝 Notes</h3>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows="3" className={`w-full px-3 py-2 ${t.input} rounded border`} placeholder="Additional notes..." />
              </div>
            </div>
            <div className="space-y-6">
              <div className={`${t.surface} rounded-lg p-6 ${t.border} border sticky top-6`}>
                <h3 className={`text-lg font-bold ${t.text} mb-4`}>💰 Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className={t.textSecondary}>Labor:</span><span className={`font-bold ${t.text}`}>${totals.laborTotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className={t.textSecondary}>Parts:</span><span className={`font-bold ${t.text}`}>${totals.partsTotal.toFixed(2)}</span></div>
                  <div className={`border-t ${t.border} pt-3`}><div className="flex justify-between"><span className={t.textSecondary}>Subtotal:</span><span className={`font-bold ${t.text}`}>${totals.subtotal.toFixed(2)}</span></div></div>
                  <div className="flex justify-between"><span className={t.textSecondary}>GST (10%):</span><span className={`font-bold ${t.text}`}>${totals.tax.toFixed(2)}</span></div>
                  <div className={`border-t ${t.border} pt-3`}><div className="flex justify-between text-xl"><span className={`font-bold ${t.text}`}>Total:</span><span className="font-bold text-green-500">${totals.grandTotal.toFixed(2)}</span></div></div>
                </div>
                <div className="mt-6 space-y-3">
                  <button onClick={() => saveQuote('draft')} className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-bold">💾 Save Draft</button>
                  <button onClick={() => saveQuote('sent')} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold">📤 Save & Send</button>
                  {editingQuote && <button onClick={() => convertToWorkOrder(editingQuote)} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">🔧 Convert to Work Order</button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
