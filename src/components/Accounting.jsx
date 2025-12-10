import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Accounting({ theme: t }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState('month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    amount: '',
    gst_amount: '',
    supplier: '',
    reference: '',
    payment_method: 'card'
  })

  useEffect(() => {
    const now = new Date()
    if (dateRange === 'month') {
      setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
      setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0])
    } else if (dateRange === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3)
      setStartDate(new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0])
      setEndDate(new Date(now.getFullYear(), quarter * 3 + 3, 0).toISOString().split('T')[0])
    } else if (dateRange === 'year') {
      setStartDate(new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0])
      setEndDate(new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0])
    } else if (dateRange === 'fy') {
      // Australian FY July-June
      const fy = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
      setStartDate(new Date(fy, 6, 1).toISOString().split('T')[0])
      setEndDate(new Date(fy + 1, 5, 30).toISOString().split('T')[0])
    }
  }, [dateRange])

  useEffect(() => {
    if (startDate && endDate) {
      loadData()
    }
  }, [startDate, endDate])

  const loadData = async () => {
    setLoading(true)
    await Promise.all([
      loadInvoices(),
      loadExpenses(),
      loadPayments()
    ])
    setLoading(false)
  }

  const loadInvoices = async () => {
    const { data } = await supabase
      .from('invoices')
      .select('*, customers(first_name, last_name)')
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59')
      .order('created_at', { ascending: false })
    if (data) setInvoices(data)
  }

  const loadExpenses = async () => {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
    if (data) setExpenses(data)
  }

  const loadPayments = async () => {
    const { data } = await supabase
      .from('payments')
      .select('*, invoices(invoice_number, customers(first_name, last_name))')
      .gte('payment_date', startDate)
      .lte('payment_date', endDate)
      .order('payment_date', { ascending: false })
    if (data) setPayments(data)
  }

  // Calculations
  const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0)
  const totalGSTCollected = invoices.reduce((sum, inv) => sum + (parseFloat(inv.gst_amount) || parseFloat(inv.total) / 11 || 0), 0)
  const totalExpenses = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0)
  const totalGSTPaid = expenses.reduce((sum, exp) => sum + (parseFloat(exp.gst_amount) || 0), 0)
  const netGST = totalGSTCollected - totalGSTPaid
  const grossProfit = totalRevenue - totalExpenses
  const paidInvoices = invoices.filter(i => i.status === 'paid')
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid')
  const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0)

  // Group expenses by category
  const expensesByCategory = expenses.reduce((acc, exp) => {
    const cat = exp.category || 'Other'
    if (!acc[cat]) acc[cat] = 0
    acc[cat] += parseFloat(exp.amount) || 0
    return acc
  }, {})

  // Group revenue by month
  const revenueByMonth = invoices.reduce((acc, inv) => {
    const month = new Date(inv.created_at).toLocaleString('en-AU', { month: 'short', year: '2-digit' })
    if (!acc[month]) acc[month] = 0
    acc[month] += parseFloat(inv.total) || 0
    return acc
  }, {})

  const saveExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount) {
      alert('Please fill in required fields')
      return
    }

    const { error } = await supabase.from('expenses').insert([{
      ...expenseForm,
      amount: parseFloat(expenseForm.amount),
      gst_amount: expenseForm.gst_amount ? parseFloat(expenseForm.gst_amount) : parseFloat(expenseForm.amount) / 11
    }])

    if (error) {
      alert('Error: ' + error.message)
      return
    }

    alert('✓ Expense recorded!')
    setShowExpenseModal(false)
    setExpenseForm({
      date: new Date().toISOString().split('T')[0],
      category: '',
      description: '',
      amount: '',
      gst_amount: '',
      supplier: '',
      reference: '',
      payment_method: 'card'
    })
    loadExpenses()
  }

  const exportToCSV = (type) => {
    let data = []
    let filename = ''
    let headers = []

    if (type === 'invoices') {
      headers = ['Invoice #', 'Date', 'Customer', 'Subtotal', 'GST', 'Total', 'Status']
      data = invoices.map(inv => [
        inv.invoice_number,
        new Date(inv.created_at).toLocaleDateString(),
        `${inv.customers?.first_name || ''} ${inv.customers?.last_name || ''}`,
        (parseFloat(inv.total) - (parseFloat(inv.gst_amount) || parseFloat(inv.total) / 11)).toFixed(2),
        (parseFloat(inv.gst_amount) || parseFloat(inv.total) / 11).toFixed(2),
        parseFloat(inv.total).toFixed(2),
        inv.status
      ])
      filename = `invoices_${startDate}_${endDate}.csv`
    } else if (type === 'expenses') {
      headers = ['Date', 'Category', 'Description', 'Supplier', 'Amount', 'GST', 'Reference']
      data = expenses.map(exp => [
        exp.date,
        exp.category,
        exp.description,
        exp.supplier,
        parseFloat(exp.amount).toFixed(2),
        (parseFloat(exp.gst_amount) || 0).toFixed(2),
        exp.reference
      ])
      filename = `expenses_${startDate}_${endDate}.csv`
    } else if (type === 'bas') {
      headers = ['Description', 'Amount']
      data = [
        ['Total Sales (G1)', totalRevenue.toFixed(2)],
        ['GST on Sales (1A)', totalGSTCollected.toFixed(2)],
        ['Total Purchases', totalExpenses.toFixed(2)],
        ['GST on Purchases (1B)', totalGSTPaid.toFixed(2)],
        ['GST Payable/Refundable', netGST.toFixed(2)]
      ]
      filename = `bas_summary_${startDate}_${endDate}.csv`
    } else if (type === 'profit_loss') {
      headers = ['Category', 'Amount']
      data = [
        ['REVENUE', ''],
        ['Total Sales', totalRevenue.toFixed(2)],
        ['', ''],
        ['EXPENSES', ''],
        ...Object.entries(expensesByCategory).map(([cat, amt]) => [cat, amt.toFixed(2)]),
        ['Total Expenses', totalExpenses.toFixed(2)],
        ['', ''],
        ['GROSS PROFIT', grossProfit.toFixed(2)]
      ]
      filename = `profit_loss_${startDate}_${endDate}.csv`
    }

    const csvContent = [headers.join(','), ...data.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setShowExportModal(false)
  }

  const expenseCategories = [
    'Parts & Inventory',
    'Tools & Equipment',
    'Rent & Utilities',
    'Wages & Salaries',
    'Insurance',
    'Vehicle Expenses',
    'Marketing & Advertising',
    'Professional Services',
    'Office Supplies',
    'Bank Fees',
    'Other'
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>💼 Accounting</h2>
        <div className="flex gap-3">
          <button onClick={() => setShowExpenseModal(true)} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium">
            + Record Expense
          </button>
          <button onClick={() => setShowExportModal(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">
            📥 Export
          </button>
        </div>
      </div>

      {/* Date Range */}
      <div className={`${t.surface} rounded-lg p-4 ${t.border} border mb-6`}>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2">
            {['month', 'quarter', 'year', 'fy', 'custom'].map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-lg font-medium capitalize ${
                  dateRange === range ? 'bg-blue-600 text-white' : `${t.surface} ${t.text} ${t.border} border`
                }`}
              >
                {range === 'fy' ? 'FY' : range}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`px-3 py-2 ${t.input} rounded border`}
              />
              <span className={t.textSecondary}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`px-3 py-2 ${t.input} rounded border`}
              />
            </div>
          )}
          <span className={`${t.textSecondary} text-sm`}>
            {startDate && endDate && `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-2 mb-6 ${t.border} border-b pb-2`}>
        {['overview', 'invoices', 'expenses', 'gst', 'reports'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg font-medium capitalize ${
              activeTab === tab ? 'bg-blue-600 text-white' : `${t.text} ${t.surfaceHover}`
            }`}
          >
            {tab === 'gst' ? 'GST/BAS' : tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={`text-center py-12 ${t.textSecondary}`}>Loading...</div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-4">
                <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
                  <div className={`text-sm ${t.textSecondary}`}>Total Revenue</div>
                  <div className="text-3xl font-bold text-green-500">${totalRevenue.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</div>
                  <div className={`text-xs ${t.textSecondary}`}>{invoices.length} invoices</div>
                </div>
                <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
                  <div className={`text-sm ${t.textSecondary}`}>Total Expenses</div>
                  <div className="text-3xl font-bold text-red-500">${totalExpenses.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</div>
                  <div className={`text-xs ${t.textSecondary}`}>{expenses.length} expenses</div>
                </div>
                <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
                  <div className={`text-sm ${t.textSecondary}`}>Gross Profit</div>
                  <div className={`text-3xl font-bold ${grossProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ${grossProfit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </div>
                  <div className={`text-xs ${t.textSecondary}`}>
                    {totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0}% margin
                  </div>
                </div>
                <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
                  <div className={`text-sm ${t.textSecondary}`}>Outstanding</div>
                  <div className="text-3xl font-bold text-orange-500">${totalOutstanding.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</div>
                  <div className={`text-xs ${t.textSecondary}`}>{unpaidInvoices.length} unpaid</div>
                </div>
              </div>

              {/* GST Summary */}
              <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
                <h3 className={`font-bold ${t.text} mb-4`}>GST Summary</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className={t.textSecondary}>GST Collected</div>
                    <div className={`text-xl font-bold ${t.text}`}>${totalGSTCollected.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className={t.textSecondary}>GST Paid</div>
                    <div className={`text-xl font-bold ${t.text}`}>${totalGSTPaid.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className={t.textSecondary}>Net GST {netGST >= 0 ? 'Payable' : 'Refund'}</div>
                    <div className={`text-xl font-bold ${netGST >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                      ${Math.abs(netGST).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expense Breakdown */}
              <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
                <h3 className={`font-bold ${t.text} mb-4`}>Expense Breakdown</h3>
                <div className="space-y-2">
                  {Object.entries(expensesByCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount]) => (
                      <div key={category} className="flex items-center gap-2">
                        <div className="w-32 truncate">{category}</div>
                        <div className="flex-1 bg-gray-700 rounded-full h-4">
                          <div
                            className="bg-red-500 h-4 rounded-full"
                            style={{ width: `${(amount / totalExpenses) * 100}%` }}
                          />
                        </div>
                        <div className={`w-24 text-right ${t.text}`}>${amount.toFixed(2)}</div>
                        <div className={`w-12 text-right ${t.textSecondary} text-sm`}>
                          {((amount / totalExpenses) * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Invoices Tab */}
          {activeTab === 'invoices' && (
            <div className={`${t.surface} rounded-lg overflow-hidden ${t.border} border`}>
              <table className="min-w-full">
                <thead className={`${t.border} border-b`}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Invoice #</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Date</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Customer</th>
                    <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Subtotal</th>
                    <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>GST</th>
                    <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Total</th>
                    <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.border}`}>
                  {invoices.map(inv => {
                    const gst = parseFloat(inv.gst_amount) || parseFloat(inv.total) / 11
                    const subtotal = parseFloat(inv.total) - gst
                    return (
                      <tr key={inv.id} className={t.surfaceHover}>
                        <td className={`px-4 py-3 font-medium ${t.text}`}>{inv.invoice_number}</td>
                        <td className={`px-4 py-3 ${t.textSecondary}`}>{new Date(inv.created_at).toLocaleDateString()}</td>
                        <td className={`px-4 py-3 ${t.text}`}>{inv.customers?.first_name} {inv.customers?.last_name}</td>
                        <td className={`px-4 py-3 text-right ${t.text}`}>${subtotal.toFixed(2)}</td>
                        <td className={`px-4 py-3 text-right ${t.textSecondary}`}>${gst.toFixed(2)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${t.text}`}>${parseFloat(inv.total).toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            inv.status === 'paid' ? 'bg-green-500' :
                            inv.status === 'sent' ? 'bg-blue-500' :
                            inv.status === 'overdue' ? 'bg-red-500' : 'bg-yellow-500'
                          } text-white`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className={`${t.border} border-t`}>
                  <tr>
                    <td colSpan="3" className={`px-4 py-3 font-bold ${t.text}`}>TOTALS</td>
                    <td className={`px-4 py-3 text-right font-bold ${t.text}`}>
                      ${(totalRevenue - totalGSTCollected).toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${t.textSecondary}`}>
                      ${totalGSTCollected.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold text-green-500`}>
                      ${totalRevenue.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Expenses Tab */}
          {activeTab === 'expenses' && (
            <div className={`${t.surface} rounded-lg overflow-hidden ${t.border} border`}>
              <table className="min-w-full">
                <thead className={`${t.border} border-b`}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Date</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Category</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Description</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Supplier</th>
                    <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Amount</th>
                    <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>GST</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Reference</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.border}`}>
                  {expenses.map(exp => (
                    <tr key={exp.id} className={t.surfaceHover}>
                      <td className={`px-4 py-3 ${t.textSecondary}`}>{new Date(exp.date).toLocaleDateString()}</td>
                      <td className={`px-4 py-3 ${t.text}`}>{exp.category}</td>
                      <td className={`px-4 py-3 ${t.text}`}>{exp.description}</td>
                      <td className={`px-4 py-3 ${t.textSecondary}`}>{exp.supplier || '-'}</td>
                      <td className={`px-4 py-3 text-right font-bold ${t.text}`}>${parseFloat(exp.amount).toFixed(2)}</td>
                      <td className={`px-4 py-3 text-right ${t.textSecondary}`}>${(parseFloat(exp.gst_amount) || 0).toFixed(2)}</td>
                      <td className={`px-4 py-3 ${t.textSecondary}`}>{exp.reference || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className={`${t.border} border-t`}>
                  <tr>
                    <td colSpan="4" className={`px-4 py-3 font-bold ${t.text}`}>TOTALS</td>
                    <td className={`px-4 py-3 text-right font-bold text-red-500`}>${totalExpenses.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${t.textSecondary}`}>${totalGSTPaid.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* GST/BAS Tab */}
          {activeTab === 'gst' && (
            <div className="space-y-6">
              <div className={`${t.surface} rounded-lg p-6 ${t.border} border`}>
                <h3 className={`text-xl font-bold ${t.text} mb-6`}>BAS Summary Report</h3>
                
                <div className="space-y-4">
                  <div className={`grid grid-cols-2 gap-4 pb-4 ${t.border} border-b`}>
                    <div className={t.text}>G1 - Total Sales (including GST)</div>
                    <div className={`text-right font-bold ${t.text}`}>${totalRevenue.toFixed(2)}</div>
                  </div>
                  
                  <div className={`grid grid-cols-2 gap-4 pb-4 ${t.border} border-b`}>
                    <div className={t.text}>1A - GST on Sales</div>
                    <div className={`text-right font-bold ${t.text}`}>${totalGSTCollected.toFixed(2)}</div>
                  </div>
                  
                  <div className={`grid grid-cols-2 gap-4 pb-4 ${t.border} border-b`}>
                    <div className={t.text}>G10 - Capital Purchases</div>
                    <div className={`text-right font-bold ${t.text}`}>$0.00</div>
                  </div>
                  
                  <div className={`grid grid-cols-2 gap-4 pb-4 ${t.border} border-b`}>
                    <div className={t.text}>G11 - Non-Capital Purchases</div>
                    <div className={`text-right font-bold ${t.text}`}>${totalExpenses.toFixed(2)}</div>
                  </div>
                  
                  <div className={`grid grid-cols-2 gap-4 pb-4 ${t.border} border-b`}>
                    <div className={t.text}>1B - GST on Purchases</div>
                    <div className={`text-right font-bold ${t.text}`}>${totalGSTPaid.toFixed(2)}</div>
                  </div>
                  
                  <div className={`grid grid-cols-2 gap-4 pt-4`}>
                    <div className={`font-bold ${t.text}`}>
                      {netGST >= 0 ? '8A - GST Payable' : '8B - GST Refundable'}
                    </div>
                    <div className={`text-right text-2xl font-bold ${netGST >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                      ${Math.abs(netGST).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => exportToCSV('bas')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium">
                  📥 Export BAS Summary
                </button>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="grid grid-cols-2 gap-6">
              {/* P&L */}
              <div className={`${t.surface} rounded-lg p-6 ${t.border} border`}>
                <h3 className={`text-xl font-bold ${t.text} mb-4`}>Profit & Loss</h3>
                
                <div className="space-y-3">
                  <div className={`font-bold text-green-500 pb-2 ${t.border} border-b`}>REVENUE</div>
                  <div className="flex justify-between">
                    <span className={t.text}>Sales Revenue</span>
                    <span className={t.text}>${totalRevenue.toFixed(2)}</span>
                  </div>
                  
                  <div className={`font-bold text-red-500 pt-4 pb-2 ${t.border} border-b`}>EXPENSES</div>
                  {Object.entries(expensesByCategory).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between">
                      <span className={t.textSecondary}>{cat}</span>
                      <span className={t.text}>${amt.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className={`flex justify-between font-bold pt-2 ${t.border} border-t`}>
                    <span className={t.text}>Total Expenses</span>
                    <span className="text-red-500">${totalExpenses.toFixed(2)}</span>
                  </div>
                  
                  <div className={`flex justify-between font-bold text-xl pt-4 ${t.border} border-t`}>
                    <span className={t.text}>NET PROFIT</span>
                    <span className={grossProfit >= 0 ? 'text-green-500' : 'text-red-500'}>
                      ${grossProfit.toFixed(2)}
                    </span>
                  </div>
                </div>
                
                <button onClick={() => exportToCSV('profit_loss')} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                  Export P&L
                </button>
              </div>

              {/* Aged Receivables */}
              <div className={`${t.surface} rounded-lg p-6 ${t.border} border`}>
                <h3 className={`text-xl font-bold ${t.text} mb-4`}>Aged Receivables</h3>
                
                {unpaidInvoices.length === 0 ? (
                  <div className={`text-center py-8 ${t.textSecondary}`}>
                    ✅ All invoices paid!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unpaidInvoices.slice(0, 10).map(inv => {
                      const days = Math.floor((new Date() - new Date(inv.created_at)) / (1000 * 60 * 60 * 24))
                      return (
                        <div key={inv.id} className={`flex justify-between items-center p-2 ${t.surfaceHover} rounded`}>
                          <div>
                            <div className={t.text}>{inv.invoice_number}</div>
                            <div className={`text-xs ${t.textSecondary}`}>
                              {inv.customers?.first_name} {inv.customers?.last_name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-bold ${t.text}`}>${parseFloat(inv.total).toFixed(2)}</div>
                            <div className={`text-xs ${days > 30 ? 'text-red-500' : days > 14 ? 'text-orange-500' : t.textSecondary}`}>
                              {days} days
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${t.surface} rounded-lg p-6 w-full max-w-md ${t.border} border`}>
            <h3 className={`text-xl font-bold ${t.text} mb-4`}>Export Data</h3>
            <div className="space-y-3">
              <button onClick={() => exportToCSV('invoices')} className={`w-full p-3 ${t.surfaceHover} ${t.border} border rounded-lg text-left ${t.text}`}>
                📄 Invoices CSV
              </button>
              <button onClick={() => exportToCSV('expenses')} className={`w-full p-3 ${t.surfaceHover} ${t.border} border rounded-lg text-left ${t.text}`}>
                📄 Expenses CSV
              </button>
              <button onClick={() => exportToCSV('bas')} className={`w-full p-3 ${t.surfaceHover} ${t.border} border rounded-lg text-left ${t.text}`}>
                📄 BAS Summary CSV
              </button>
              <button onClick={() => exportToCSV('profit_loss')} className={`w-full p-3 ${t.surfaceHover} ${t.border} border rounded-lg text-left ${t.text}`}>
                📄 Profit & Loss CSV
              </button>
            </div>
            <button onClick={() => setShowExportModal(false)} className="mt-4 w-full py-2 bg-gray-600 text-white rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${t.surface} rounded-lg p-6 w-full max-w-lg ${t.border} border`}>
            <h3 className={`text-xl font-bold ${t.text} mb-4`}>Record Expense</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Date *</label>
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Category *</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({...expenseForm, category: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                >
                  <option value="">Select...</option>
                  {expenseCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Description *</label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="e.g., Oil filters from Repco"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Amount (inc GST) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>GST Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={expenseForm.gst_amount}
                  onChange={(e) => setExpenseForm({...expenseForm, gst_amount: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Auto-calculated if blank"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Supplier</label>
                <input
                  type="text"
                  value={expenseForm.supplier}
                  onChange={(e) => setExpenseForm({...expenseForm, supplier: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="e.g., Repco"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Reference/Invoice #</label>
                <input
                  type="text"
                  value={expenseForm.reference}
                  onChange={(e) => setExpenseForm({...expenseForm, reference: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="e.g., INV-12345"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={saveExpense} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium">
                💾 Save Expense
              </button>
              <button onClick={() => setShowExpenseModal(false)} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
