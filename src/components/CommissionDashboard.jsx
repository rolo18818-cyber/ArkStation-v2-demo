import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function CommissionDashboard({ theme: t, currentUser }) {
  const [mechanics, setMechanics] = useState([])
  const [commissions, setCommissions] = useState([])
  const [selectedMechanic, setSelectedMechanic] = useState('all')
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutData, setPayoutData] = useState({ mechanic_id: '', amount: 0 })

  useEffect(() => {
    loadMechanics()
    loadCommissions()
  }, [dateRange, selectedMechanic])

  const loadMechanics = async () => {
    const { data } = await supabase
      .from('mechanics')
      .select('*')
      .eq('is_active', true)
      .order('first_name')
    if (data) setMechanics(data)
  }

  const loadCommissions = async () => {
    let query = supabase
      .from('mechanic_commissions')
      .select(`
        *,
        mechanics(first_name, last_name),
        work_orders(job_number, description)
      `)
      .gte('created_at', `${dateRange.start}T00:00:00`)
      .lte('created_at', `${dateRange.end}T23:59:59`)
      .order('created_at', { ascending: false })

    if (selectedMechanic !== 'all') {
      query = query.eq('mechanic_id', selectedMechanic)
    }

    const { data } = await query
    if (data) setCommissions(data)
  }

  const getMechanicStats = (mechanicId) => {
    const mechanicCommissions = commissions.filter(c => c.mechanic_id === mechanicId)
    const laborTotal = mechanicCommissions.filter(c => c.commission_type === 'labor').reduce((sum, c) => sum + (c.amount || 0), 0)
    const partsTotal = mechanicCommissions.filter(c => c.commission_type === 'parts').reduce((sum, c) => sum + (c.amount || 0), 0)
    const bonusTotal = mechanicCommissions.filter(c => c.commission_type === 'bonus').reduce((sum, c) => sum + (c.amount || 0), 0)
    const paidTotal = mechanicCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0)
    const unpaidTotal = mechanicCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0)
    const jobCount = new Set(mechanicCommissions.map(c => c.work_order_id)).size

    return { laborTotal, partsTotal, bonusTotal, total: laborTotal + partsTotal + bonusTotal, paidTotal, unpaidTotal, jobCount }
  }

  const markAsPaid = async (commissionId) => {
    await supabase
      .from('mechanic_commissions')
      .update({ status: 'paid', paid_date: new Date().toISOString() })
      .eq('id', commissionId)
    loadCommissions()
  }

  const markAllAsPaid = async (mechanicId) => {
    if (!confirm('Mark all pending commissions as paid for this mechanic?')) return

    await supabase
      .from('mechanic_commissions')
      .update({ status: 'paid', paid_date: new Date().toISOString() })
      .eq('mechanic_id', mechanicId)
      .eq('status', 'pending')

    loadCommissions()
    alert('✓ All commissions marked as paid!')
  }

  const totalUnpaid = mechanics.reduce((sum, m) => sum + getMechanicStats(m.id).unpaidTotal, 0)
  const totalPaid = mechanics.reduce((sum, m) => sum + getMechanicStats(m.id).paidTotal, 0)
  const totalEarned = mechanics.reduce((sum, m) => sum + getMechanicStats(m.id).total, 0)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>💰 Commission Dashboard</h2>
        <div className="flex gap-4">
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className={`px-3 py-2 ${t.input} rounded border`}
            />
            <span className={t.textSecondary}>to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className={`px-3 py-2 ${t.input} rounded border`}
            />
          </div>
          <select
            value={selectedMechanic}
            onChange={(e) => setSelectedMechanic(e.target.value)}
            className={`px-3 py-2 ${t.input} rounded border`}
          >
            <option value="all">All Mechanics</option>
            {mechanics.map(m => (
              <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-green-500">${totalEarned.toLocaleString()}</div>
          <div className={t.textSecondary}>Total Earned</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-blue-500">${totalPaid.toLocaleString()}</div>
          <div className={t.textSecondary}>Paid Out</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-orange-500">${totalUnpaid.toLocaleString()}</div>
          <div className={t.textSecondary}>Pending Payout</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-purple-500">{commissions.length}</div>
          <div className={t.textSecondary}>Commission Records</div>
        </div>
      </div>

      {/* Mechanic Cards */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {mechanics.map(mechanic => {
          const stats = getMechanicStats(mechanic.id)
          return (
            <div key={mechanic.id} className={`${t.surface} rounded-lg p-6 ${t.border} border`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className={`text-xl font-bold ${t.text}`}>
                    {mechanic.first_name} {mechanic.last_name}
                  </div>
                  <div className={`text-sm ${t.textSecondary}`}>
                    {stats.jobCount} jobs • {mechanic.commission_rate || 10}% commission rate
                  </div>
                </div>
                {stats.unpaidTotal > 0 && (
                  <button
                    onClick={() => markAllAsPaid(mechanic.id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium"
                  >
                    Pay All (${stats.unpaidTotal.toFixed(2)})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className={`${t.surface} ${t.border} border rounded p-3 text-center`}>
                  <div className="text-lg font-bold text-blue-500">${stats.laborTotal.toFixed(2)}</div>
                  <div className={`text-xs ${t.textSecondary}`}>Labor</div>
                </div>
                <div className={`${t.surface} ${t.border} border rounded p-3 text-center`}>
                  <div className="text-lg font-bold text-purple-500">${stats.partsTotal.toFixed(2)}</div>
                  <div className={`text-xs ${t.textSecondary}`}>Parts</div>
                </div>
                <div className={`${t.surface} ${t.border} border rounded p-3 text-center`}>
                  <div className="text-lg font-bold text-yellow-500">${stats.bonusTotal.toFixed(2)}</div>
                  <div className={`text-xs ${t.textSecondary}`}>Bonus</div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-opacity-20">
                <div>
                  <span className={t.textSecondary}>Total: </span>
                  <span className={`text-xl font-bold text-green-500`}>${stats.total.toFixed(2)}</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-500">Paid: ${stats.paidTotal.toFixed(2)}</span>
                  <span className="text-orange-500">Pending: ${stats.unpaidTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Commissions */}
      <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
        <div className={`${t.surface} ${t.border} border-b p-4`}>
          <h3 className={`text-lg font-bold ${t.text}`}>Recent Commission Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className={`${t.surface} ${t.border} border-b`}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Date</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Mechanic</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Job</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Type</th>
                <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Amount</th>
                <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
                <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Action</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.border}`}>
              {commissions.slice(0, 50).map(comm => (
                <tr key={comm.id} className={t.surfaceHover}>
                  <td className="px-4 py-3">
                    <div className={`text-sm ${t.text}`}>{new Date(comm.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-sm font-medium ${t.text}`}>
                      {comm.mechanics?.first_name} {comm.mechanics?.last_name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-sm ${t.text}`}>{comm.work_orders?.job_number}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-bold rounded ${
                      comm.commission_type === 'labor' ? 'bg-blue-500' :
                      comm.commission_type === 'parts' ? 'bg-purple-500' :
                      'bg-yellow-500'
                    } text-white`}>
                      {comm.commission_type?.toUpperCase()}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${t.text}`}>
                    ${comm.amount?.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs font-bold rounded ${
                      comm.status === 'paid' ? 'bg-green-500' : 'bg-orange-500'
                    } text-white`}>
                      {comm.status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {comm.status === 'pending' && (
                      <button
                        onClick={() => markAsPaid(comm.id)}
                        className="text-green-500 hover:text-green-700 font-medium text-sm"
                      >
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {commissions.length === 0 && (
            <div className={`text-center py-12 ${t.textSecondary}`}>
              No commission records for this period
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
