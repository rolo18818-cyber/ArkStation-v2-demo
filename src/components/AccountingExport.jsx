import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AccountingExport({ theme: t, currentUser }) {
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [selectedInvoices, setSelectedInvoices] = useState([])
  const [exportFormat, setExportFormat] = useState('xero')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadInvoices()
    loadExpenses()
  }, [dateRange])

  const loadInvoices = async () => {
    const { data } = await supabase
      .from('invoices')
      .select(`*, customers(first_name, last_name, email, phone, address), work_orders(job_number)`)
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`)
      .order('created_at', { ascending: false })
    if (data) setInvoices(data)
  }

  const loadExpenses = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select(`*, suppliers(name)`)
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`)
      .eq('status', 'received')
      .order('created_at', { ascending: false })
    if (data) setExpenses(data)
  }

  const toggleInvoiceSelection = (invoiceId) => {
    setSelectedInvoices(prev => prev.includes(invoiceId) ? prev.filter(id => id !== invoiceId) : [...prev, invoiceId])
  }

  const selectAll = () => {
    setSelectedInvoices(selectedInvoices.length === invoices.length ? [] : invoices.map(i => i.id))
  }

  const generateXeroCSV = () => {
    const selected = invoices.filter(i => selectedInvoices.includes(i.id))
    const headers = ['ContactName', 'EmailAddress', 'InvoiceNumber', 'Reference', 'InvoiceDate', 'DueDate', 'Description', 'Quantity', 'UnitAmount', 'AccountCode', 'TaxType']
    const rows = selected.map(inv => [
      `${inv.customers?.first_name} ${inv.customers?.last_name}`,
      inv.customers?.email || '',
      inv.invoice_number,
      inv.work_orders?.job_number || '',
      new Date(inv.created_at).toISOString().split('T')[0],
      inv.due_date || new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0],
      `Workshop services - ${inv.invoice_number}`,
      1, inv.subtotal?.toFixed(2), '200', 'GST on Income'
    ])
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
  }

  const generateMYOBCSV = () => {
    const selected = invoices.filter(i => selectedInvoices.includes(i.id))
    const headers = ['Co./Last Name', 'First Name', 'Invoice #', 'Date', 'Item Number', 'Quantity', 'Description', 'Price', 'Total', 'Tax Code']
    const rows = selected.map(inv => [
      inv.customers?.last_name || '', inv.customers?.first_name || '', inv.invoice_number,
      new Date(inv.created_at).toLocaleDateString('en-AU'), 'SERVICE', 1,
      'Workshop services', inv.subtotal?.toFixed(2), inv.grand_total?.toFixed(2), 'GST'
    ])
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
  }

  const generateExpenseCSV = () => {
    const headers = ['Date', 'Supplier', 'Reference', 'Description', 'Amount', 'GST', 'Total', 'AccountCode']
    const rows = expenses.map(exp => [
      new Date(exp.created_at).toLocaleDateString('en-AU'), exp.suppliers?.name || '', exp.po_number,
      `Parts purchase - ${exp.po_number}`, ((exp.total_amount || 0) / 1.1).toFixed(2),
      ((exp.total_amount || 0) * 0.1 / 1.1).toFixed(2), exp.total_amount?.toFixed(2), '500'
    ])
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
  }

  const downloadCSV = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const exportInvoices = async () => {
    if (selectedInvoices.length === 0) { alert('Please select invoices'); return }
    setExporting(true)
    downloadCSV(exportFormat === 'xero' ? generateXeroCSV() : generateMYOBCSV(), `invoices_${exportFormat}_${dateRange.start}.csv`)
    await supabase.from('invoices').update({ exported_at: new Date().toISOString() }).in('id', selectedInvoices)
    setExporting(false)
    alert(`✓ ${selectedInvoices.length} invoices exported!`)
    setSelectedInvoices([])
    loadInvoices()
  }

  const exportExpenses = () => {
    if (expenses.length === 0) { alert('No expenses'); return }
    downloadCSV(generateExpenseCSV(), `expenses_${dateRange.start}.csv`)
    alert(`✓ ${expenses.length} expenses exported!`)
  }

  const totals = {
    invoices: invoices.reduce((sum, i) => sum + (i.grand_total || 0), 0),
    gst: invoices.reduce((sum, i) => sum + (i.tax_amount || 0), 0),
    expenses: expenses.reduce((sum, e) => sum + (e.total_amount || 0), 0),
    selected: invoices.filter(i => selectedInvoices.includes(i.id)).reduce((sum, i) => sum + (i.grand_total || 0), 0)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>📤 Accounting Export</h2>
        <div className="flex gap-4 items-center">
          <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className={`px-3 py-2 ${t.input} rounded border`} />
          <span className={t.textSecondary}>to</span>
          <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className={`px-3 py-2 ${t.input} rounded border`} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-blue-500">{invoices.length}</div>
          <div className={t.textSecondary}>Invoices</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-green-500">${totals.invoices.toLocaleString()}</div>
          <div className={t.textSecondary}>Revenue</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-orange-500">${totals.gst.toLocaleString()}</div>
          <div className={t.textSecondary}>GST Collected</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-red-500">${totals.expenses.toLocaleString()}</div>
          <div className={t.textSecondary}>Expenses</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
          <div className={`${t.border} border-b p-4 flex justify-between items-center`}>
            <h3 className={`text-lg font-bold ${t.text}`}>📄 Sales Invoices</h3>
            <div className="flex gap-2">
              <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} className={`px-3 py-1 ${t.input} rounded border text-sm`}>
                <option value="xero">Xero</option>
                <option value="myob">MYOB</option>
              </select>
              <button onClick={exportInvoices} disabled={selectedInvoices.length === 0} className={`px-4 py-1 rounded text-sm font-medium ${selectedInvoices.length > 0 ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-600 text-gray-400'}`}>
                📤 Export ({selectedInvoices.length})
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full">
              <thead className={`${t.surface} sticky top-0`}>
                <tr className={`${t.border} border-b`}>
                  <th className="px-4 py-2"><input type="checkbox" checked={selectedInvoices.length === invoices.length && invoices.length > 0} onChange={selectAll} /></th>
                  <th className={`px-4 py-2 text-left text-xs ${t.textSecondary}`}>Invoice</th>
                  <th className={`px-4 py-2 text-left text-xs ${t.textSecondary}`}>Customer</th>
                  <th className={`px-4 py-2 text-right text-xs ${t.textSecondary}`}>Total</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${t.border}`}>
                {invoices.map(inv => (
                  <tr key={inv.id} className={`${t.surfaceHover} cursor-pointer`} onClick={() => toggleInvoiceSelection(inv.id)}>
                    <td className="px-4 py-2"><input type="checkbox" checked={selectedInvoices.includes(inv.id)} readOnly /></td>
                    <td className="px-4 py-2">
                      <div className={`font-bold ${t.text}`}>{inv.invoice_number}</div>
                      <div className={`text-xs ${t.textSecondary}`}>{new Date(inv.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className={`px-4 py-2 ${t.text}`}>{inv.customers?.first_name} {inv.customers?.last_name}</td>
                    <td className={`px-4 py-2 text-right font-bold ${t.text}`}>${inv.grand_total?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
          <div className={`${t.border} border-b p-4 flex justify-between items-center`}>
            <h3 className={`text-lg font-bold ${t.text}`}>💸 Expenses</h3>
            <button onClick={exportExpenses} className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded text-sm font-medium">📤 Export All</button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full">
              <thead className={`${t.surface} sticky top-0`}>
                <tr className={`${t.border} border-b`}>
                  <th className={`px-4 py-2 text-left text-xs ${t.textSecondary}`}>PO #</th>
                  <th className={`px-4 py-2 text-left text-xs ${t.textSecondary}`}>Supplier</th>
                  <th className={`px-4 py-2 text-right text-xs ${t.textSecondary}`}>Total</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${t.border}`}>
                {expenses.map(exp => (
                  <tr key={exp.id} className={t.surfaceHover}>
                    <td className="px-4 py-2">
                      <div className={`font-bold ${t.text}`}>{exp.po_number}</div>
                      <div className={`text-xs ${t.textSecondary}`}>{new Date(exp.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className={`px-4 py-2 ${t.text}`}>{exp.suppliers?.name}</td>
                    <td className={`px-4 py-2 text-right font-bold ${t.text}`}>${exp.total_amount?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
