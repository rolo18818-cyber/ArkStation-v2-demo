import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function RealTimeDashboard({ theme: t }) {
  const [metrics, setMetrics] = useState({
    todayRevenue: 0,
    todayJobs: 0,
    completedJobs: 0,
    activeJobs: 0,
    partsRevenue: 0,
    laborRevenue: 0,
    todayBookings: 0,
    pendingParts: 0
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [topMechanics, setTopMechanics] = useState([])

  useEffect(() => {
    loadMetrics()
    loadRecentActivity()
    loadTopMechanics()
    
    const interval = setInterval(loadMetrics, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const loadMetrics = async () => {
    const today = new Date().toISOString().split('T')[0]

    // Today's work orders
    const { data: workOrders } = await supabase
      .from('work_orders')
      .select('*')
      .gte('created_at', today)

    // Today's bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_date', today)

    // Pending parts requests
    const { data: parts } = await supabase
      .from('parts_requests')
      .select('*')
      .eq('status', 'pending')

    const completed = workOrders?.filter(w => w.status === 'completed') || []
    const active = workOrders?.filter(w => w.status === 'in_progress') || []
    
    const totalRevenue = completed.reduce((sum, w) => sum + (w.parts_total + w.labor_total), 0)
    const partsRev = completed.reduce((sum, w) => sum + w.parts_total, 0)
    const laborRev = completed.reduce((sum, w) => sum + w.labor_total, 0)

    setMetrics({
      todayRevenue: totalRevenue,
      todayJobs: workOrders?.length || 0,
      completedJobs: completed.length,
      activeJobs: active.length,
      partsRevenue: partsRev,
      laborRevenue: laborRev,
      todayBookings: bookings?.length || 0,
      pendingParts: parts?.length || 0
    })
  }

  const loadRecentActivity = async () => {
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (data) setRecentActivity(data)
  }

  const loadTopMechanics = async () => {
    const today = new Date().toISOString().split('T')[0]
    
    const { data } = await supabase
      .from('work_orders')
      .select('assigned_mechanic_id, mechanics(first_name, last_name)')
      .gte('created_at', today)
      .eq('status', 'completed')

    if (data) {
      const mechanicStats = {}
      data.forEach(wo => {
        const id = wo.assigned_mechanic_id
        if (!id) return
        if (!mechanicStats[id]) {
          mechanicStats[id] = {
            name: `${wo.mechanics.first_name} ${wo.mechanics.last_name}`,
            jobsCompleted: 0
          }
        }
        mechanicStats[id].jobsCompleted++
      })
      
      const sorted = Object.values(mechanicStats).sort((a, b) => b.jobsCompleted - a.jobsCompleted)
      setTopMechanics(sorted.slice(0, 5))
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className={`text-3xl font-bold ${t.text}`}>📊 Real-Time Dashboard</h2>
          <p className={`text-sm ${t.textSecondary} mt-1`}>
            Live metrics • Updates every 30 seconds • {new Date().toLocaleDateString()}
          </p>
        </div>
        <button onClick={loadMetrics} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium">
          🔄 Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 border-green-500`}>
          <div className="text-5xl mb-2">💰</div>
          <div className="text-4xl font-bold text-green-500 mb-1">
            ${metrics.todayRevenue.toFixed(0)}
          </div>
          <div className={`${t.text} font-semibold`}>Today's Revenue</div>
          <div className={`text-xs ${t.textSecondary} mt-2`}>
            Parts: ${metrics.partsRevenue.toFixed(0)} • Labor: ${metrics.laborRevenue.toFixed(0)}
          </div>
        </div>

        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 border-blue-500`}>
          <div className="text-5xl mb-2">🔧</div>
          <div className="text-4xl font-bold text-blue-500 mb-1">{metrics.todayJobs}</div>
          <div className={`${t.text} font-semibold`}>Jobs Today</div>
          <div className={`text-xs ${t.textSecondary} mt-2`}>
            ✓ {metrics.completedJobs} Done • ⚙️ {metrics.activeJobs} Active
          </div>
        </div>

        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 border-purple-500`}>
          <div className="text-5xl mb-2">📅</div>
          <div className="text-4xl font-bold text-purple-500 mb-1">{metrics.todayBookings}</div>
          <div className={`${t.text} font-semibold`}>Today's Bookings</div>
          <div className={`text-xs ${t.textSecondary} mt-2`}>Scheduled appointments</div>
        </div>

        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 ${metrics.pendingParts > 0 ? 'border-orange-500' : 'border-gray-500'}`}>
          <div className="text-5xl mb-2">📦</div>
          <div className={`text-4xl font-bold mb-1 ${metrics.pendingParts > 0 ? 'text-orange-500' : t.text}`}>
            {metrics.pendingParts}
          </div>
          <div className={`${t.text} font-semibold`}>Parts Requests</div>
          <div className={`text-xs ${t.textSecondary} mt-2`}>Awaiting order</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Mechanics Today */}
        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <h3 className={`text-xl font-bold ${t.text} mb-4`}>🏆 Top Mechanics Today</h3>
          {topMechanics.length > 0 ? (
            <div className="space-y-3">
              {topMechanics.map((mech, index) => (
                <div key={index} className={`flex justify-between items-center p-3 ${t.surface} ${t.border} border rounded`}>
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl font-bold ${index === 0 ? 'text-yellow-500' : t.textSecondary}`}>
                      #{index + 1}
                    </div>
                    <div className={`font-semibold ${t.text}`}>{mech.name}</div>
                  </div>
                  <div className={`text-lg font-bold ${t.text}`}>{mech.jobsCompleted} jobs</div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-center py-8 ${t.textSecondary}`}>No completed jobs yet today</div>
          )}
        </div>

        {/* Recent Activity */}
        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <h3 className={`text-xl font-bold ${t.text} mb-4`}>⚡ Recent Activity</h3>
          {recentActivity.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentActivity.map(activity => (
                <div key={activity.id} className={`p-2 ${t.surface} ${t.border} border rounded`}>
                  <div className={`text-sm ${t.text} font-semibold`}>{activity.action}</div>
                  <div className={`text-xs ${t.textSecondary}`}>
                    {activity.user_email} • {new Date(activity.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-center py-8 ${t.textSecondary}`}>No recent activity</div>
          )}
        </div>
      </div>
    </div>
  )
}