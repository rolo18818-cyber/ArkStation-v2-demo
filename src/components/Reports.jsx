import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Reports({ theme: t }) {
  const [dateRange, setDateRange] = useState('today')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalTransactions: 0,
    averageTransaction: 0,
    totalPOSRevenue: 0,
    totalInvoiceRevenue: 0,
    topCustomers: [],
    topParts: [],
    mechanicPerformance: [],
    revenueByDay: [],
    paymentMethods: []
  })

  useEffect(() => {
    loadReports()
  }, [dateRange, customStartDate, customEndDate])

  const getDateRange = () => {
    const now = new Date()
    let startDate, endDate

    switch(dateRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString()
        endDate = new Date().toISOString()
        break
      case 'yesterday':
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        startDate = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString()
        endDate = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString()
        break
      case 'week':
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        startDate = weekAgo.toISOString()
        endDate = new Date().toISOString()
        break
      case 'month':
        const monthAgo = new Date(now)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        startDate = monthAgo.toISOString()
        endDate = new Date().toISOString()
        break
      case 'year':
        const yearAgo = new Date(now)
        yearAgo.setFullYear(yearAgo.getFullYear() - 1)
        startDate = yearAgo.toISOString()
        endDate = new Date().toISOString()
        break
      case 'custom':
        startDate = customStartDate ? new Date(customStartDate).toISOString() : null
        endDate = customEndDate ? new Date(customEndDate).toISOString() : null
        break
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString()
        endDate = new Date().toISOString()
    }

    return { startDate, endDate }
  }

  const loadReports = async () => {
    const { startDate, endDate } = getDateRange()
    if (!startDate || !endDate) return

    // Total POS Revenue
    const { data: posTransactions } = await supabase
      .from('pos_transactions')
      .select('total_amount, payment_method, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const totalPOSRevenue = posTransactions?.reduce((sum, t) => sum + parseFloat(t.total_amount), 0) || 0

    // Total Invoice Revenue
    const { data: invoices } = await supabase
      .from('invoices')
      .select('total_amount')
      .eq('paid', true)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const totalInvoiceRevenue = invoices?.reduce((sum, i) => sum + parseFloat(i.total_amount), 0) || 0

    const totalRevenue = totalPOSRevenue + totalInvoiceRevenue
    const totalTransactions = (posTransactions?.length || 0) + (invoices?.length || 0)
    const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

    // Payment Methods Breakdown
    const paymentMethods = {}
    posTransactions?.forEach(t => {
      if (!paymentMethods[t.payment_method]) {
        paymentMethods[t.payment_method] = 0
      }
      paymentMethods[t.payment_method] += parseFloat(t.total_amount)
    })

    // Top Customers (from POS)
    const { data: posWithCustomers } = await supabase
      .from('pos_transactions')
      .select('customer_id, total_amount, customers(first_name, last_name)')
      .not('customer_id', 'is', null)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const customerTotals = {}
    posWithCustomers?.forEach(t => {
      if (t.customer_id) {
        if (!customerTotals[t.customer_id]) {
          customerTotals[t.customer_id] = {
            name: `${t.customers.first_name} ${t.customers.last_name}`,
            total: 0,
            count: 0
          }
        }
        customerTotals[t.customer_id].total += parseFloat(t.total_amount)
        customerTotals[t.customer_id].count += 1
      }
    })

    const topCustomers = Object.values(customerTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // Top Parts Sold
    const { data: lineItems } = await supabase
      .from('pos_line_items')
      .select('description, quantity, item_type')
      .eq('item_type', 'part')

    const partSales = {}
    lineItems?.forEach(item => {
      if (!partSales[item.description]) {
        partSales[item.description] = 0
      }
      partSales[item.description] += item.quantity
    })

    const topParts = Object.entries(partSales)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)

    // Mechanic Performance
    const { data: mechanicWork } = await supabase
      .from('work_orders')
      .select('assigned_mechanic_id, estimated_cost, status, mechanics(first_name, last_name)')
      .not('assigned_mechanic_id', 'is', null)
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    const mechanicStats = {}
    mechanicWork?.forEach(wo => {
      if (wo.assigned_mechanic_id) {
        if (!mechanicStats[wo.assigned_mechanic_id]) {
          mechanicStats[wo.assigned_mechanic_id] = {
            name: `${wo.mechanics.first_name} ${wo.mechanics.last_name}`,
            jobs: 0,
            completed: 0,
            revenue: 0
          }
        }
        mechanicStats[wo.assigned_mechanic_id].jobs += 1
        if (wo.status === 'completed') {
          mechanicStats[wo.assigned_mechanic_id].completed += 1
          mechanicStats[wo.assigned_mechanic_id].revenue += parseFloat(wo.estimated_cost || 0)
        }
      }
    })

    const mechanicPerformance = Object.values(mechanicStats)
      .sort((a, b) => b.revenue - a.revenue)

    // Revenue by Day (last 7 days for visual)
    const revenueByDay = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayStart = new Date(date.setHours(0, 0, 0, 0)).toISOString()
      const dayEnd = new Date(date.setHours(23, 59, 59, 999)).toISOString()

      const { data: dayPOS } = await supabase
        .from('pos_transactions')
        .select('total_amount')
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)

      const { data: dayInvoices } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('paid', true)
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)

      const dayRevenue = 
        (dayPOS?.reduce((sum, t) => sum + parseFloat(t.total_amount), 0) || 0) +
        (dayInvoices?.reduce((sum, i) => sum + parseFloat(i.total_amount), 0) || 0)

      revenueByDay.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        revenue: dayRevenue
      })
    }

    setStats({
      totalRevenue,
      totalTransactions,
      averageTransaction,
      totalPOSRevenue,
      totalInvoiceRevenue,
      topCustomers,
      topParts,
      mechanicPerformance,
      revenueByDay,
      paymentMethods: Object.entries(paymentMethods).map(([method, amount]) => ({ method, amount }))
    })
  }

  const maxRevenue = Math.max(...stats.revenueByDay.map(d => d.revenue), 1)

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>📊 Reports & Analytics</h2>
        
        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className={`px-4 py-2 ${t.input} rounded-lg border text-sm font-medium`}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last Year</option>
            <option value="custom">Custom Range</option>
          </select>

          {dateRange === 'custom' && (
            <>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className={`px-3 py-2 ${t.input} rounded border text-sm`}
              />
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className={`px-3 py-2 ${t.input} rounded border text-sm`}
              />
            </>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <div className={`text-sm ${t.textSecondary} mb-2`}>Total Revenue</div>
          <div className="text-3xl font-bold text-green-500">${stats.totalRevenue.toFixed(2)}</div>
          <div className={`text-xs ${t.textSecondary} mt-2`}>
            POS: ${stats.totalPOSRevenue.toFixed(2)} | Invoices: ${stats.totalInvoiceRevenue.toFixed(2)}
          </div>
        </div>

        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <div className={`text-sm ${t.textSecondary} mb-2`}>Total Transactions</div>
          <div className={`text-3xl font-bold ${t.text}`}>{stats.totalTransactions}</div>
        </div>

        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <div className={`text-sm ${t.textSecondary} mb-2`}>Average Transaction</div>
          <div className={`text-3xl font-bold ${t.text}`}>${stats.averageTransaction.toFixed(2)}</div>
        </div>

        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <div className={`text-sm ${t.textSecondary} mb-2`}>Payment Methods</div>
          <div className="space-y-1">
            {stats.paymentMethods.map(pm => (
              <div key={pm.method} className={`text-sm ${t.text} flex justify-between`}>
                <span className="uppercase">{pm.method}:</span>
                <span className="font-semibold">${pm.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className={`${t.surface} rounded-lg shadow-lg p-6 mb-6 ${t.border} border`}>
        <h3 className={`text-xl font-bold ${t.text} mb-4`}>Revenue Trend (Last 7 Days)</h3>
        <div className="flex items-end justify-between h-64 gap-2">
          {stats.revenueByDay.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="w-full flex items-end justify-center h-52">
                <div
                  className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                  style={{ height: `${(day.revenue / maxRevenue) * 100}%` }}
                  title={`$${day.revenue.toFixed(2)}`}
                />
              </div>
              <div className={`text-xs ${t.textSecondary} mt-2 text-center`}>{day.date}</div>
              <div className={`text-sm font-bold ${t.text}`}>${day.revenue.toFixed(0)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Customers */}
        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <h3 className={`text-xl font-bold ${t.text} mb-4`}>Top Customers</h3>
          <div className="space-y-3">
            {stats.topCustomers.map((customer, i) => (
              <div key={i} className={`flex justify-between items-center pb-3 border-b ${t.border}`}>
                <div>
                  <div className={`font-semibold ${t.text}`}>{customer.name}</div>
                  <div className={`text-xs ${t.textSecondary}`}>{customer.count} transactions</div>
                </div>
                <div className="text-lg font-bold text-green-500">${customer.total.toFixed(2)}</div>
              </div>
            ))}
            {stats.topCustomers.length === 0 && (
              <div className={`text-center py-4 ${t.textSecondary}`}>No customer data</div>
            )}
          </div>
        </div>

        {/* Top Parts */}
        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <h3 className={`text-xl font-bold ${t.text} mb-4`}>Top Selling Parts</h3>
          <div className="space-y-3">
            {stats.topParts.map((part, i) => (
              <div key={i} className={`flex justify-between items-center pb-3 border-b ${t.border}`}>
                <div className={`font-semibold ${t.text} flex-1`}>{part.name}</div>
                <div className="text-lg font-bold text-blue-500">{part.quantity} sold</div>
              </div>
            ))}
            {stats.topParts.length === 0 && (
              <div className={`text-center py-4 ${t.textSecondary}`}>No parts data</div>
            )}
          </div>
        </div>

        {/* Mechanic Performance */}
        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <h3 className={`text-xl font-bold ${t.text} mb-4`}>Mechanic Performance</h3>
          <div className="space-y-3">
            {stats.mechanicPerformance.map((mech, i) => (
              <div key={i} className={`pb-3 border-b ${t.border}`}>
                <div className={`font-semibold ${t.text} mb-1`}>{mech.name}</div>
                <div className="flex justify-between text-sm">
                  <span className={`${t.textSecondary}`}>Jobs: {mech.completed}/{mech.jobs}</span>
                  <span className="font-bold text-green-500">${mech.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
            {stats.mechanicPerformance.length === 0 && (
              <div className={`text-center py-4 ${t.textSecondary}`}>No mechanic data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}