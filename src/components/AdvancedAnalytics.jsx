import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AdvancedAnalytics({ theme: t }) {
  const [view, setView] = useState('overview') // overview, revenue, mechanics, parts, customers
  const [dateRange, setDateRange] = useState('month')
  const [loading, setLoading] = useState(true)
  
  // Analytics data
  const [revenueData, setRevenueData] = useState([])
  const [mechanicPerformance, setMechanicPerformance] = useState([])
  const [partsAnalytics, setPartsAnalytics] = useState([])
  const [customerAnalytics, setCustomerAnalytics] = useState([])
  const [overviewStats, setOverviewStats] = useState({})

  useEffect(() => {
    loadAllAnalytics()
  }, [dateRange])

  const loadAllAnalytics = async () => {
    setLoading(true)
    await Promise.all([
      loadRevenueAnalytics(),
      loadMechanicPerformance(),
      loadPartsAnalytics(),
      loadCustomerAnalytics(),
      loadOverviewStats()
    ])
    setLoading(false)
  }

  const loadRevenueAnalytics = async () => {
    const { data } = await supabase
      .from('revenue_analytics')
      .select('*')
      .order('date', { ascending: false })
      .limit(30)
    
    if (data) setRevenueData(data)
  }

  const loadMechanicPerformance = async () => {
    const { data } = await supabase
      .from('mechanic_performance')
      .select('*')
      .order('total_labor_revenue', { ascending: false })
    
    if (data) setMechanicPerformance(data)
  }

  const loadPartsAnalytics = async () => {
    const { data } = await supabase
      .from('parts_profitability')
      .select('*')
      .order('total_profit', { ascending: false })
      .limit(50)
    
    if (data) setPartsAnalytics(data)
  }

  const loadCustomerAnalytics = async () => {
    const { data } = await supabase
      .from('customer_analytics')
      .select('*')
      .order('lifetime_value', { ascending: false })
      .limit(100)
    
    if (data) setCustomerAnalytics(data)
  }

  const loadOverviewStats = async () => {
    // Total revenue
    const { data: revenueSum } = await supabase
      .from('work_orders')
      .select('total_revenue')
      .eq('status', 'completed')
    
    const totalRevenue = revenueSum?.reduce((sum, o) => sum + (o.total_revenue || 0), 0) || 0

    // Total jobs
    const { count: totalJobs } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')

    // Active customers
    const { count: activeCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })

    // Total parts sold
    const { data: partsSold } = await supabase
      .from('work_order_parts')
      .select('quantity')
    
    const totalPartsSold = partsSold?.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0

    setOverviewStats({
      totalRevenue,
      totalJobs,
      activeCustomers,
      totalPartsSold,
      avgJobValue: totalJobs > 0 ? totalRevenue / totalJobs : 0
    })
  }

  const getTopPerformers = () => {
    return mechanicPerformance.slice(0, 5)
  }

  const getTopParts = () => {
    return partsAnalytics.slice(0, 10)
  }

  const getTopCustomers = () => {
    return customerAnalytics.slice(0, 10)
  }

  const calculateGrowth = () => {
    if (revenueData.length < 2) return 0
    const current = revenueData[0]?.total_revenue || 0
    const previous = revenueData[1]?.total_revenue || 0
    if (previous === 0) return 0
    return ((current - previous) / previous * 100).toFixed(1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className={`text-2xl ${t.text}`}>Loading analytics...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>📊 Advanced Analytics</h2>
        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className={`px-3 py-2 ${t.input} rounded border`}>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
            <option value="year">Last 365 Days</option>
          </select>
          <button
            onClick={loadAllAnalytics}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'revenue', label: 'Revenue', icon: '💰' },
          { id: 'mechanics', label: 'Mechanics', icon: '👷' },
          { id: 'parts', label: 'Parts', icon: '🔧' },
          { id: 'customers', label: 'Customers', icon: '👥' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
              view === tab.id
                ? 'bg-blue-600 text-white'
                : `${t.surface} ${t.text} ${t.border} border`
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {view === 'overview' && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Total Revenue</div>
              <div className="text-3xl font-bold text-green-500">
                ${overviewStats.totalRevenue?.toLocaleString()}
              </div>
              <div className={`text-xs mt-2 ${parseFloat(calculateGrowth()) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {parseFloat(calculateGrowth()) >= 0 ? '↑' : '↓'} {Math.abs(calculateGrowth())}% vs last period
              </div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Jobs Completed</div>
              <div className={`text-3xl font-bold ${t.text}`}>
                {overviewStats.totalJobs}
              </div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Avg Job Value</div>
              <div className="text-3xl font-bold text-blue-500">
                ${overviewStats.avgJobValue?.toLocaleString()}
              </div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Active Customers</div>
              <div className={`text-3xl font-bold ${t.text}`}>
                {overviewStats.activeCustomers}
              </div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Parts Sold</div>
              <div className={`text-3xl font-bold ${t.text}`}>
                {overviewStats.totalPartsSold}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Top Mechanics */}
            <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
              <div className={`${t.surface} ${t.border} border-b p-4`}>
                <h3 className={`text-xl font-bold ${t.text}`}>🏆 Top Mechanics</h3>
              </div>
              <div className="p-4 space-y-3">
                {getTopPerformers().map((mechanic, idx) => (
                  <div key={mechanic.id} className={`flex items-center gap-4 p-3 ${t.surface} ${t.border} border rounded`}>
                    <div className={`text-2xl font-bold ${
                      idx === 0 ? 'text-yellow-500' :
                      idx === 1 ? 'text-gray-400' :
                      idx === 2 ? 'text-orange-600' :
                      t.textSecondary
                    }`}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className={`font-bold ${t.text}`}>{mechanic.mechanic_name}</div>
                      <div className={`text-xs ${t.textSecondary}`}>
                        {mechanic.jobs_completed} jobs • {mechanic.total_hours_worked?.toFixed(1)}h
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-500">
                        ${mechanic.total_labor_revenue?.toLocaleString()}
                      </div>
                      <div className={`text-xs ${t.textSecondary}`}>
                        {mechanic.avg_profit_percentage?.toFixed(1)}% margin
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Parts */}
            <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
              <div className={`${t.surface} ${t.border} border-b p-4`}>
                <h3 className={`text-xl font-bold ${t.text}`}>🔥 Top Selling Parts</h3>
              </div>
              <div className="p-4 space-y-3">
                {getTopParts().slice(0, 5).map((part, idx) => (
                  <div key={part.id} className={`flex items-center gap-4 p-3 ${t.surface} ${t.border} border rounded`}>
                    <div className={`text-2xl font-bold ${t.textSecondary}`}>
                      #{idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className={`font-bold ${t.text}`}>{part.name}</div>
                      <div className={`text-xs ${t.textSecondary}`}>
                        Sold: {part.total_quantity_sold} • {part.times_sold}x
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-500">
                        ${part.total_profit?.toLocaleString()}
                      </div>
                      <div className={`text-xs ${t.textSecondary}`}>
                        {part.avg_markup_percentage?.toFixed(0)}% markup
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* REVENUE VIEW */}
      {view === 'revenue' && (
        <>
          <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Daily Revenue Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${t.surface} ${t.border} border-b`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Date</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Jobs</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Parts Revenue</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Labor Revenue</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Total Revenue</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Avg Job Value</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.border}`}>
                  {revenueData.map(day => (
                    <tr key={day.date} className={t.surfaceHover}>
                      <td className="px-6 py-4">
                        <div className={`text-sm ${t.text}`}>
                          {new Date(day.date).toLocaleDateString('en-AU', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-semibold ${t.text}`}>{day.total_jobs}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold text-blue-500">
                          ${day.parts_revenue?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold text-purple-500">
                          ${day.labor_revenue?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-bold text-green-500">
                          ${day.total_revenue?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm ${t.text}`}>
                          ${day.avg_job_value?.toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MECHANICS VIEW */}
      {view === 'mechanics' && (
        <>
          <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Mechanic Performance Leaderboard</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${t.surface} ${t.border} border-b`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Rank</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Mechanic</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Jobs</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Hours</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Revenue</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Avg/Job</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Profit %</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Commission</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.border}`}>
                  {mechanicPerformance.map((mechanic, idx) => (
                    <tr key={mechanic.id} className={t.surfaceHover}>
                      <td className="px-6 py-4">
                        <div className={`text-lg font-bold ${
                          idx === 0 ? 'text-yellow-500' :
                          idx === 1 ? 'text-gray-400' :
                          idx === 2 ? 'text-orange-600' :
                          t.text
                        }`}>
                          #{idx + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-bold ${t.text}`}>{mechanic.mechanic_name}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-semibold ${t.text}`}>{mechanic.jobs_completed}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm ${t.text}`}>{mechanic.total_hours_worked?.toFixed(1)}h</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-bold text-green-500">
                          ${mechanic.total_labor_revenue?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm ${t.text}`}>
                          ${mechanic.avg_labor_per_job?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-bold ${
                          mechanic.avg_profit_percentage >= 30 ? 'text-green-500' :
                          mechanic.avg_profit_percentage >= 20 ? 'text-blue-500' :
                          'text-orange-500'
                        }`}>
                          {mechanic.avg_profit_percentage?.toFixed(1)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-bold text-purple-500">
                          ${mechanic.total_commissions_earned?.toLocaleString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* PARTS VIEW */}
      {view === 'parts' && (
        <>
          <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Parts Profitability Analysis</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${t.surface} ${t.border} border-b`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Part Name</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Part #</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Times Sold</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Qty Sold</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Revenue</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Cost</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Profit</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Markup %</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.border}`}>
                  {partsAnalytics.map(part => (
                    <tr key={part.id} className={t.surfaceHover}>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-bold ${t.text}`}>{part.name}</div>
                        <div className={`text-xs ${t.textSecondary}`}>{part.category}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-xs font-mono ${t.text}`}>{part.part_number}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm ${t.text}`}>{part.times_sold}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-semibold ${t.text}`}>{part.total_quantity_sold}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold text-green-500">
                          ${part.total_revenue?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold text-red-500">
                          ${part.total_cost?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-bold text-blue-500">
                          ${part.total_profit?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-bold ${
                          part.avg_markup_percentage >= 50 ? 'text-green-500' :
                          part.avg_markup_percentage >= 30 ? 'text-blue-500' :
                          'text-orange-500'
                        }`}>
                          {part.avg_markup_percentage?.toFixed(0)}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* CUSTOMERS VIEW */}
      {view === 'customers' && (
        <>
          <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Customer Lifetime Value Analysis</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${t.surface} ${t.border} border-b`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Customer</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Total Jobs</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Lifetime Value</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Avg Job Value</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>First Visit</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Last Visit</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Vehicles</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.border}`}>
                  {customerAnalytics.map(customer => (
                    <tr key={customer.id} className={t.surfaceHover}>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-bold ${t.text}`}>{customer.customer_name}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-semibold ${t.text}`}>{customer.total_jobs}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-bold text-green-500">
                          ${customer.lifetime_value?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm ${t.text}`}>
                          ${customer.avg_job_value?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-xs ${t.textSecondary}`}>
                          {customer.first_visit ? new Date(customer.first_visit).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-xs ${t.textSecondary}`}>
                          {customer.last_visit ? new Date(customer.last_visit).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm ${t.text}`}>{customer.num_vehicles}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}