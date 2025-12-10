import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function FinancialManagement({ theme: t }) {
  const [view, setView] = useState('overview') // overview, commissions, payment_plans, warranties
  const [workOrders, setWorkOrders] = useState([])
  const [commissions, setCommissions] = useState([])
  const [paymentPlans, setPaymentPlans] = useState([])
  const [warrantyClaims, setWarrantyClaims] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [selectedMechanic, setSelectedMechanic] = useState(null)
  const [dateRange, setDateRange] = useState('month')
  const [showCommissionModal, setShowCommissionModal] = useState(false)
  const [showPaymentPlanModal, setShowPaymentPlanModal] = useState(false)
  const [showWarrantyModal, setShowWarrantyModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [dateRange])

  const loadData = async () => {
    await Promise.all([
      loadWorkOrders(),
      loadCommissions(),
      loadPaymentPlans(),
      loadWarrantyClaims(),
      loadMechanics()
    ])
  }

  const loadWorkOrders = async () => {
    const { data } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers(first_name, last_name),
        mechanics(first_name, last_name)
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (data) {
      // Calculate profitability for each
      const ordersWithProfit = data.map(order => ({
        ...order,
        calculated_profit: (order.total_revenue || 0) - (order.total_cost || 0),
        calculated_margin: order.total_revenue > 0 
          ? ((order.total_revenue - order.total_cost) / order.total_revenue * 100).toFixed(2)
          : 0
      }))
      setWorkOrders(ordersWithProfit)
    }
  }

  const loadCommissions = async () => {
    const { data } = await supabase
      .from('mechanic_commissions')
      .select(`
        *,
        mechanics(first_name, last_name),
        work_orders(job_number)
      `)
      .order('created_at', { ascending: false })
    
    if (data) setCommissions(data)
  }

  const loadPaymentPlans = async () => {
    const { data } = await supabase
      .from('payment_plans')
      .select(`
        *,
        customers(first_name, last_name, phone),
        invoices(invoice_number)
      `)
      .order('created_at', { ascending: false })
    
    if (data) setPaymentPlans(data)
  }

  const loadWarrantyClaims = async () => {
    const { data } = await supabase
      .from('warranty_claims')
      .select(`
        *,
        customers(first_name, last_name),
        vehicles(make, model, year)
      `)
      .order('created_at', { ascending: false })
    
    if (data) setWarrantyClaims(data)
  }

  const loadMechanics = async () => {
    const { data } = await supabase
      .from('mechanics')
      .select('*')
      .eq('is_active', true)
      .order('first_name')
    
    if (data) setMechanics(data)
  }

  const calculateCommission = async (workOrderId, mechanicId) => {
    const { error } = await supabase.rpc('calculate_mechanic_commission', {
      p_work_order_id: workOrderId,
      p_mechanic_id: mechanicId
    })

    if (error) {
      alert('Error calculating commission: ' + error.message)
    } else {
      alert('✓ Commission calculated!')
      loadCommissions()
    }
  }

  const markCommissionPaid = async (commissionId) => {
    const { error } = await supabase
      .from('mechanic_commissions')
      .update({
        is_paid: true,
        paid_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', commissionId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Commission marked as paid!')
      loadCommissions()
    }
  }

  const calculateJobProfitability = async (workOrderId) => {
    const { error } = await supabase.rpc('calculate_job_profitability', {
      p_work_order_id: workOrderId
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Profitability calculated!')
      loadWorkOrders()
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-500',
      completed: 'bg-gray-500',
      defaulted: 'bg-red-500',
      cancelled: 'bg-orange-500',
      submitted: 'bg-blue-500',
      pending_review: 'bg-yellow-500',
      approved: 'bg-green-500',
      rejected: 'bg-red-500',
      paid: 'bg-gray-500'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[status]}`}>
        {status.toUpperCase().replace('_', ' ')}
      </span>
    )
  }

  const totalStats = {
    totalRevenue: workOrders.reduce((sum, o) => sum + (o.total_revenue || 0), 0),
    totalCost: workOrders.reduce((sum, o) => sum + (o.total_cost || 0), 0),
    totalProfit: workOrders.reduce((sum, o) => sum + (o.calculated_profit || 0), 0),
    avgMargin: workOrders.length > 0 
      ? workOrders.reduce((sum, o) => sum + parseFloat(o.calculated_margin || 0), 0) / workOrders.length 
      : 0,
    totalCommissionsOwed: commissions.filter(c => !c.is_paid).reduce((sum, c) => sum + (c.commission_amount || 0), 0),
    totalCommissionsPaid: commissions.filter(c => c.is_paid).reduce((sum, c) => sum + (c.commission_amount || 0), 0),
    activePaymentPlans: paymentPlans.filter(p => p.status === 'active').length,
    pendingWarranties: warrantyClaims.filter(w => w.status === 'submitted' || w.status === 'pending_review').length
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>💰 Financial Management</h2>
        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className={`px-3 py-2 ${t.input} rounded border`}>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'commissions', label: 'Commissions', icon: '💵' },
          { id: 'payment_plans', label: 'Payment Plans', icon: '📅' },
          { id: 'warranties', label: 'Warranties', icon: '🛡️' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium ${
              view === tab.id
                ? 'bg-blue-600 text-white'
                : `${t.surface} ${t.text} ${t.border} border`
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {view === 'overview' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Total Revenue</div>
              <div className="text-3xl font-bold text-green-500">
                ${totalStats.totalRevenue.toLocaleString()}
              </div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Total Cost</div>
              <div className="text-3xl font-bold text-red-500">
                ${totalStats.totalCost.toLocaleString()}
              </div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Total Profit</div>
              <div className={`text-3xl font-bold ${totalStats.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${totalStats.totalProfit.toLocaleString()}
              </div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Avg Margin</div>
              <div className="text-3xl font-bold text-blue-500">
                {totalStats.avgMargin.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Job Profitability Table */}
          <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border mb-6`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Job Profitability</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${t.surface} ${t.border} border-b`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Job #</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Customer</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Revenue</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Cost</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Profit</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Margin %</th>
                    <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.border}`}>
                  {workOrders.slice(0, 20).map(order => (
                    <tr key={order.id} className={t.surfaceHover}>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-mono font-bold ${t.text}`}>{order.job_number}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm ${t.text}`}>
                          {order.customers?.first_name} {order.customers?.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold text-green-500">
                          ${(order.total_revenue || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold text-red-500">
                          ${(order.total_cost || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-bold ${order.calculated_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          ${order.calculated_profit.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-bold ${parseFloat(order.calculated_margin) >= 20 ? 'text-green-500' : 'text-orange-500'}`}>
                          {order.calculated_margin}%
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => calculateJobProfitability(order.id)}
                          className="text-blue-500 hover:text-blue-700 font-medium text-sm">
                          Recalculate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Commissions View */}
      {view === 'commissions' && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Commissions Owed</div>
              <div className="text-3xl font-bold text-orange-500">
                ${totalStats.totalCommissionsOwed.toLocaleString()}
              </div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Commissions Paid</div>
              <div className="text-3xl font-bold text-green-500">
                ${totalStats.totalCommissionsPaid.toLocaleString()}
              </div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Total Commissions</div>
              <div className="text-3xl font-bold text-blue-500">
                ${(totalStats.totalCommissionsOwed + totalStats.totalCommissionsPaid).toLocaleString()}
              </div>
            </div>
          </div>

          <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Commission Records</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${t.surface} ${t.border} border-b`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Mechanic</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Job #</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Base Amount</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Rate %</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Commission</th>
                    <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
                    <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.border}`}>
                  {commissions.map(comm => (
                    <tr key={comm.id} className={t.surfaceHover}>
                      <td className="px-6 py-4">
                        <div className={`text-sm ${t.text}`}>
                          {comm.mechanics?.first_name} {comm.mechanics?.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-mono ${t.text}`}>{comm.work_orders?.job_number}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm ${t.text}`}>${comm.base_amount.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm ${t.text}`}>{comm.commission_rate}%</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-bold text-green-500">
                          ${comm.commission_amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {comm.is_paid ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500 text-white">
                            PAID
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-500 text-white">
                            OWED
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {!comm.is_paid && (
                          <button
                            onClick={() => markCommissionPaid(comm.id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium">
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Payment Plans View */}
      {view === 'payment_plans' && (
        <>
          <div className={`${t.surface} rounded-lg shadow-lg p-4 mb-6 ${t.border} border`}>
            <div className="flex justify-between items-center">
              <h3 className={`text-xl font-bold ${t.text}`}>Active Payment Plans: {totalStats.activePaymentPlans}</h3>
              <button
                onClick={() => setShowPaymentPlanModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium">
                + Create Payment Plan
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {paymentPlans.map(plan => (
              <div key={plan.id} className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className={`font-bold ${t.text} text-lg mb-1`}>
                      {plan.customers?.first_name} {plan.customers?.last_name}
                    </h4>
                    <p className={`text-sm ${t.textSecondary}`}>
                      Invoice: {plan.invoices?.invoice_number}
                    </p>
                  </div>
                  {getStatusBadge(plan.status)}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className={`text-sm ${t.textSecondary}`}>Total Amount:</span>
                    <span className={`font-bold ${t.text}`}>${plan.total_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${t.textSecondary}`}>Deposit Paid:</span>
                    <span className={`font-bold text-green-500`}>${plan.deposit_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${t.textSecondary}`}>Remaining:</span>
                    <span className={`font-bold text-orange-500`}>${plan.remaining_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${t.textSecondary}`}>Installments:</span>
                    <span className={`font-bold ${t.text}`}>
                      {plan.num_installments}x ${plan.installment_amount.toLocaleString()} ({plan.installment_frequency})
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium">
                    View Details
                  </button>
                  <button className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-medium">
                    Record Payment
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Warranties View */}
      {view === 'warranties' && (
        <>
          <div className={`${t.surface} rounded-lg shadow-lg p-4 mb-6 ${t.border} border`}>
            <div className="flex justify-between items-center">
              <h3 className={`text-xl font-bold ${t.text}`}>Pending Claims: {totalStats.pendingWarranties}</h3>
              <button
                onClick={() => setShowWarrantyModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium">
                + New Warranty Claim
              </button>
            </div>
          </div>

          <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
            <table className="min-w-full">
              <thead className={`${t.surface} ${t.border} border-b`}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Claim #</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Customer</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Vehicle</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Claim Amount</th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
                  <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${t.border}`}>
                {warrantyClaims.map(claim => (
                  <tr key={claim.id} className={t.surfaceHover}>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-mono font-bold ${t.text}`}>{claim.claim_number}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm ${t.text}`}>
                        {claim.customers?.first_name} {claim.customers?.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm ${t.text}`}>
                        {claim.vehicles?.year} {claim.vehicles?.make} {claim.vehicles?.model}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-bold text-green-500">
                        ${claim.claim_amount?.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(claim.status)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-blue-500 hover:text-blue-700 font-medium text-sm">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}