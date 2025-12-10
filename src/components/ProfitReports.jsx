import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ProfitReports({ theme: t }) {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [workOrders, setWorkOrders] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [serviceTypes, setServiceTypes] = useState([])
  const [viewMode, setViewMode] = useState('overview') // overview, jobs, mechanics, services

  useEffect(() => {
    loadData()
  }, [dateRange])

  const loadData = async () => {
    // Load work orders with all related data
    const { data: woData } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers(first_name, last_name),
        vehicles(make, model, registration),
        mechanics(first_name, last_name),
        work_order_labor(hours, rate, amount),
        work_order_parts(quantity, unit_price, total_price, parts(cost_price))
      `)
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`)
      .in('status', ['completed', 'invoiced'])
      .order('created_at', { ascending: false })

    if (woData) {
      // Calculate profitability for each job
      const enrichedData = woData.map(wo => {
        const laborRevenue = wo.work_order_labor?.reduce((sum, l) => sum + (l.amount || 0), 0) || 0
        const laborCost = wo.work_order_labor?.reduce((sum, l) => sum + ((l.hours || 0) * 50), 0) || 0 // $50/hr labor cost
        
        const partsRevenue = wo.work_order_parts?.reduce((sum, p) => sum + (p.total_price || 0), 0) || 0
        const partsCost = wo.work_order_parts?.reduce((sum, p) => sum + ((p.parts?.cost_price || 0) * (p.quantity || 0)), 0) || 0
        
        const totalRevenue = laborRevenue + partsRevenue
        const totalCost = laborCost + partsCost
        const profit = totalRevenue - totalCost
        const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

        return {
          ...wo,
          laborRevenue,
          laborCost,
          laborProfit: laborRevenue - laborCost,
          partsRevenue,
          partsCost,
          partsProfit: partsRevenue - partsCost,
          totalRevenue,
          totalCost,
          profit,
          margin
        }
      })
      setWorkOrders(enrichedData)

      // Calculate mechanic stats
      const mechanicStats = {}
      enrichedData.forEach(wo => {
        if (wo.assigned_mechanic_id && wo.mechanics) {
          const mechId = wo.assigned_mechanic_id
          if (!mechanicStats[mechId]) {
            mechanicStats[mechId] = {
              id: mechId,
              name: `${wo.mechanics.first_name} ${wo.mechanics.last_name}`,
              jobs: 0,
              revenue: 0,
              cost: 0,
              profit: 0,
              hours: 0
            }
          }
          mechanicStats[mechId].jobs++
          mechanicStats[mechId].revenue += wo.totalRevenue
          mechanicStats[mechId].cost += wo.totalCost
          mechanicStats[mechId].profit += wo.profit
          mechanicStats[mechId].hours += wo.work_order_labor?.reduce((sum, l) => sum + (l.hours || 0), 0) || 0
        }
      })
      setMechanics(Object.values(mechanicStats))
    }
  }

  // Calculate overall stats
  const stats = {
    totalJobs: workOrders.length,
    totalRevenue: workOrders.reduce((sum, wo) => sum + wo.totalRevenue, 0),
    totalCost: workOrders.reduce((sum, wo) => sum + wo.totalCost, 0),
    totalProfit: workOrders.reduce((sum, wo) => sum + wo.profit, 0),
    laborRevenue: workOrders.reduce((sum, wo) => sum + wo.laborRevenue, 0),
    laborProfit: workOrders.reduce((sum, wo) => sum + wo.laborProfit, 0),
    partsRevenue: workOrders.reduce((sum, wo) => sum + wo.partsRevenue, 0),
    partsProfit: workOrders.reduce((sum, wo) => sum + wo.partsProfit, 0),
    avgJobValue: workOrders.length > 0 ? workOrders.reduce((sum, wo) => sum + wo.totalRevenue, 0) / workOrders.length : 0,
    avgMargin: workOrders.length > 0 ? workOrders.reduce((sum, wo) => sum + wo.margin, 0) / workOrders.length : 0
  }

  const getMarginColor = (margin) => {
    if (margin >= 40) return 'text-green-500'
    if (margin >= 25) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>📊 Profit Reports</h2>
        <div className="flex gap-4 items-center">
          <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className={`px-3 py-2 ${t.input} rounded border`} />
          <span className={t.textSecondary}>to</span>
          <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className={`px-3 py-2 ${t.input} rounded border`} />
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 mb-6">
        {['overview', 'jobs', 'mechanics'].map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-6 py-2 rounded-lg font-medium capitalize ${
              viewMode === mode ? 'bg-blue-600 text-white' : `${t.surface} ${t.text} ${t.border} border`
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Overview */}
      {viewMode === 'overview' && (
        <>
          {/* Main Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
              <div className="text-3xl font-bold text-blue-500">{stats.totalJobs}</div>
              <div className={t.textSecondary}>Completed Jobs</div>
            </div>
            <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
              <div className="text-3xl font-bold text-green-500">${stats.totalRevenue.toLocaleString()}</div>
              <div className={t.textSecondary}>Total Revenue</div>
            </div>
            <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
              <div className="text-3xl font-bold text-red-500">${stats.totalCost.toLocaleString()}</div>
              <div className={t.textSecondary}>Total Cost</div>
            </div>
            <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
              <div className={`text-3xl font-bold ${stats.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${stats.totalProfit.toLocaleString()}
              </div>
              <div className={t.textSecondary}>Gross Profit</div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Labor vs Parts */}
            <div className={`${t.surface} rounded-lg p-6 ${t.border} border`}>
              <h3 className={`text-lg font-bold ${t.text} mb-4`}>Revenue Breakdown</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className={t.textSecondary}>Labor</span>
                    <span className={`font-bold ${t.text}`}>${stats.laborRevenue.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${(stats.laborRevenue / stats.totalRevenue) * 100 || 0}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className={t.textSecondary}>Parts</span>
                    <span className={`font-bold ${t.text}`}>${stats.partsRevenue.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500" style={{ width: `${(stats.partsRevenue / stats.totalRevenue) * 100 || 0}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Profit Breakdown */}
            <div className={`${t.surface} rounded-lg p-6 ${t.border} border`}>
              <h3 className={`text-lg font-bold ${t.text} mb-4`}>Profit Breakdown</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className={t.textSecondary}>Labor Profit</span>
                  <span className="text-xl font-bold text-green-500">${stats.laborProfit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={t.textSecondary}>Parts Profit</span>
                  <span className="text-xl font-bold text-green-500">${stats.partsProfit.toLocaleString()}</span>
                </div>
                <div className={`flex justify-between items-center pt-4 border-t ${t.border}`}>
                  <span className={t.textSecondary}>Average Job Value</span>
                  <span className={`text-xl font-bold ${t.text}`}>${stats.avgJobValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={t.textSecondary}>Average Margin</span>
                  <span className={`text-xl font-bold ${getMarginColor(stats.avgMargin)}`}>{stats.avgMargin.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Performers */}
          <div className="grid grid-cols-2 gap-6">
            <div className={`${t.surface} rounded-lg ${t.border} border`}>
              <div className={`${t.border} border-b p-4`}>
                <h3 className={`font-bold ${t.text}`}>🏆 Most Profitable Jobs</h3>
              </div>
              <div className="divide-y divide-opacity-20" style={{ borderColor: 'inherit' }}>
                {workOrders.sort((a, b) => b.profit - a.profit).slice(0, 5).map(wo => (
                  <div key={wo.id} className="p-4 flex justify-between items-center">
                    <div>
                      <div className={`font-bold ${t.text}`}>{wo.job_number}</div>
                      <div className={`text-sm ${t.textSecondary}`}>{wo.customers?.first_name} {wo.customers?.last_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-500">${wo.profit.toFixed(2)}</div>
                      <div className={`text-sm ${getMarginColor(wo.margin)}`}>{wo.margin.toFixed(1)}% margin</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${t.surface} rounded-lg ${t.border} border`}>
              <div className={`${t.border} border-b p-4`}>
                <h3 className={`font-bold ${t.text}`}>⚠️ Low Margin Jobs</h3>
              </div>
              <div className="divide-y divide-opacity-20" style={{ borderColor: 'inherit' }}>
                {workOrders.filter(wo => wo.margin < 25).sort((a, b) => a.margin - b.margin).slice(0, 5).map(wo => (
                  <div key={wo.id} className="p-4 flex justify-between items-center">
                    <div>
                      <div className={`font-bold ${t.text}`}>{wo.job_number}</div>
                      <div className={`text-sm ${t.textSecondary}`}>{wo.customers?.first_name} {wo.customers?.last_name}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${wo.profit >= 0 ? 'text-yellow-500' : 'text-red-500'}`}>${wo.profit.toFixed(2)}</div>
                      <div className="text-sm text-red-500">{wo.margin.toFixed(1)}% margin</div>
                    </div>
                  </div>
                ))}
                {workOrders.filter(wo => wo.margin < 25).length === 0 && (
                  <div className={`text-center py-8 ${t.textSecondary}`}>No low margin jobs! 🎉</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Jobs View */}
      {viewMode === 'jobs' && (
        <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
          <table className="min-w-full">
            <thead className={`${t.surface} ${t.border} border-b`}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Job</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Customer</th>
                <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Revenue</th>
                <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Cost</th>
                <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Profit</th>
                <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Margin</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.border}`}>
              {workOrders.map(wo => (
                <tr key={wo.id} className={t.surfaceHover}>
                  <td className="px-4 py-3">
                    <div className={`font-bold ${t.text}`}>{wo.job_number}</div>
                    <div className={`text-xs ${t.textSecondary}`}>{new Date(wo.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={t.text}>{wo.customers?.first_name} {wo.customers?.last_name}</div>
                    <div className={`text-xs ${t.textSecondary}`}>{wo.vehicles?.registration}</div>
                  </td>
                  <td className={`px-4 py-3 text-right ${t.text}`}>${wo.totalRevenue.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right ${t.text}`}>${wo.totalCost.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${wo.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ${wo.profit.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${getMarginColor(wo.margin)}`}>
                    {wo.margin.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mechanics View */}
      {viewMode === 'mechanics' && (
        <div className="grid grid-cols-2 gap-6">
          {mechanics.map(mech => (
            <div key={mech.id} className={`${t.surface} rounded-lg p-6 ${t.border} border`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className={`text-xl font-bold ${t.text}`}>{mech.name}</h3>
                  <div className={`text-sm ${t.textSecondary}`}>{mech.jobs} jobs • {mech.hours.toFixed(1)} hours</div>
                </div>
                <div className={`text-2xl font-bold ${mech.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ${mech.profit.toLocaleString()}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className={`${t.surface} ${t.border} border rounded p-3 text-center`}>
                  <div className={`text-lg font-bold ${t.text}`}>${mech.revenue.toLocaleString()}</div>
                  <div className={`text-xs ${t.textSecondary}`}>Revenue</div>
                </div>
                <div className={`${t.surface} ${t.border} border rounded p-3 text-center`}>
                  <div className={`text-lg font-bold ${t.text}`}>${(mech.revenue / mech.jobs || 0).toFixed(0)}</div>
                  <div className={`text-xs ${t.textSecondary}`}>Avg/Job</div>
                </div>
                <div className={`${t.surface} ${t.border} border rounded p-3 text-center`}>
                  <div className={`text-lg font-bold ${getMarginColor((mech.profit / mech.revenue) * 100)}`}>
                    {((mech.profit / mech.revenue) * 100 || 0).toFixed(1)}%
                  </div>
                  <div className={`text-xs ${t.textSecondary}`}>Margin</div>
                </div>
              </div>
            </div>
          ))}
          {mechanics.length === 0 && (
            <div className={`col-span-2 ${t.surface} rounded-lg p-12 text-center ${t.border} border`}>
              <div className={t.textSecondary}>No mechanic data for this period</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
