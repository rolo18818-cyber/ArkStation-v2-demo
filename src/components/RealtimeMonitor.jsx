import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function RealtimeMonitor({ theme: t }) {
  const [activeJobs, setActiveJobs] = useState([])
  const [clockedInMechanics, setClockedInMechanics] = useState([])
  const [bayStatus, setBayStatus] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [stats, setStats] = useState({
    jobsToday: 0,
    revenueToday: 0,
    partsUsedToday: 0
  })

  useEffect(() => {
    loadData()
    
    // Set up real-time subscriptions
    const workOrderSub = supabase
      .channel('work_orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => {
        loadActiveJobs()
        loadStats()
      })
      .subscribe()

    const timeEntrySub = supabase
      .channel('time_entries_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => {
        loadClockedInMechanics()
      })
      .subscribe()

    const activitySub = supabase
      .channel('activity_log_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, (payload) => {
        setRecentActivity(prev => [payload.new, ...prev.slice(0, 19)])
      })
      .subscribe()

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000)

    return () => {
      workOrderSub.unsubscribe()
      timeEntrySub.unsubscribe()
      activitySub.unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const loadData = async () => {
    await Promise.all([
      loadActiveJobs(),
      loadClockedInMechanics(),
      loadBayStatus(),
      loadRecentActivity(),
      loadStats()
    ])
  }

  const loadActiveJobs = async () => {
    const { data } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers(first_name, last_name),
        vehicles(year, make, model, registration),
        mechanics(first_name, last_name)
      `)
      .eq('status', 'in_progress')
      .order('updated_at', { ascending: false })
    if (data) setActiveJobs(data)
  }

  const loadClockedInMechanics = async () => {
    const { data } = await supabase
      .from('time_entries')
      .select(`
        *,
        mechanics(id, first_name, last_name)
      `)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
    if (data) setClockedInMechanics(data)
  }

  const loadBayStatus = async () => {
    const { data } = await supabase
      .from('workshop_bays')
      .select(`
        *,
        assignments:bay_assignments(
          *,
          work_orders(job_number, description)
        )
      `)
      .eq('is_active', true)
      .order('bay_number')
    if (data) setBayStatus(data)
  }

  const loadRecentActivity = async () => {
    const { data } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setRecentActivity(data)
  }

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0]

    // Jobs today
    const { count: jobsToday } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00`)

    // Revenue today (from completed jobs)
    const { data: completedToday } = await supabase
      .from('work_orders')
      .select('grand_total')
      .eq('status', 'completed')
      .gte('completed_at', `${today}T00:00:00`)

    const revenueToday = completedToday?.reduce((sum, wo) => sum + (wo.grand_total || 0), 0) || 0

    // Parts used today
    const { data: partsToday } = await supabase
      .from('work_order_parts')
      .select('quantity')
      .gte('created_at', `${today}T00:00:00`)

    const partsUsedToday = partsToday?.reduce((sum, p) => sum + (p.quantity || 0), 0) || 0

    setStats({ jobsToday: jobsToday || 0, revenueToday, partsUsedToday })
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return '--:--'
    return new Date(timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  }

  const getElapsedTime = (clockIn) => {
    if (!clockIn) return '0h 0m'
    const now = new Date()
    const start = new Date(clockIn)
    const diffMinutes = Math.floor((now - start) / 1000 / 60)
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    return `${hours}h ${minutes}m`
  }

  const getActivityIcon = (action) => {
    if (action?.includes('created')) return '🆕'
    if (action?.includes('updated')) return '✏️'
    if (action?.includes('completed')) return '✅'
    if (action?.includes('deleted')) return '🗑️'
    if (action?.includes('payment')) return '💰'
    return '📌'
  }

  const getCurrentAssignment = (bay) => {
    return bay.assignments?.find(a => a.status === 'in_progress' || a.status === 'scheduled')
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>
          📡 Live Workshop Monitor
          <span className="ml-3 inline-flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-2"></span>
            <span className={`text-sm font-normal ${t.textSecondary}`}>Live</span>
          </span>
        </h2>
        <div className={`text-sm ${t.textSecondary}`}>
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-4xl font-bold text-blue-500">{activeJobs.length}</div>
          <div className={`text-sm ${t.textSecondary}`}>Jobs In Progress</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-4xl font-bold text-green-500">{clockedInMechanics.length}</div>
          <div className={`text-sm ${t.textSecondary}`}>Mechanics Working</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-4xl font-bold text-purple-500">{stats.jobsToday}</div>
          <div className={`text-sm ${t.textSecondary}`}>Jobs Today</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-4xl font-bold text-green-500">${stats.revenueToday.toLocaleString()}</div>
          <div className={`text-sm ${t.textSecondary}`}>Revenue Today</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Active Jobs */}
        <div>
          <h3 className={`text-xl font-bold ${t.text} mb-4`}>🔧 Jobs In Progress</h3>
          <div className="space-y-3">
            {activeJobs.map(job => (
              <div key={job.id} className={`${t.surface} rounded-lg p-4 ${t.border} border-2 border-blue-500`}>
                <div className="flex justify-between items-start mb-2">
                  <div className={`font-bold ${t.text}`}>{job.job_number}</div>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-500 text-white">
                    IN PROGRESS
                  </span>
                </div>
                <div className={`text-sm ${t.text} mb-1`}>
                  {job.customers?.first_name} {job.customers?.last_name}
                </div>
                <div className={`text-xs ${t.textSecondary} mb-2`}>
                  {job.vehicles?.year} {job.vehicles?.make} {job.vehicles?.model}
                </div>
                <div className={`text-sm ${t.textSecondary} truncate`}>
                  {job.description}
                </div>
                {job.mechanics && (
                  <div className="mt-2 pt-2 border-t border-opacity-20">
                    <span className={`text-xs ${t.textSecondary}`}>Mechanic: </span>
                    <span className={`text-xs font-bold ${t.text}`}>
                      {job.mechanics.first_name} {job.mechanics.last_name}
                    </span>
                  </div>
                )}
              </div>
            ))}
            {activeJobs.length === 0 && (
              <div className={`${t.surface} rounded-lg p-8 text-center ${t.border} border`}>
                <div className="text-4xl mb-2">🏖️</div>
                <div className={`${t.textSecondary}`}>No active jobs</div>
              </div>
            )}
          </div>
        </div>

        {/* Clocked In Mechanics */}
        <div>
          <h3 className={`text-xl font-bold ${t.text} mb-4`}>👷 On The Clock</h3>
          <div className="space-y-3">
            {clockedInMechanics.map(entry => (
              <div key={entry.id} className={`${t.surface} rounded-lg p-4 ${t.border} border-2 border-green-500`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white text-xl font-bold">
                    {entry.mechanics?.first_name?.[0]}{entry.mechanics?.last_name?.[0]}
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold ${t.text}`}>
                      {entry.mechanics?.first_name} {entry.mechanics?.last_name}
                    </div>
                    <div className={`text-sm ${t.textSecondary}`}>
                      In: {formatTime(entry.clock_in)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-500">
                      {getElapsedTime(entry.clock_in)}
                    </div>
                    {entry.break_start && !entry.break_end && (
                      <span className="px-2 py-1 text-xs rounded bg-yellow-500 text-white">ON BREAK</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {clockedInMechanics.length === 0 && (
              <div className={`${t.surface} rounded-lg p-8 text-center ${t.border} border`}>
                <div className="text-4xl mb-2">🌙</div>
                <div className={`${t.textSecondary}`}>No one clocked in</div>
              </div>
            )}
          </div>

          {/* Bay Status */}
          <h3 className={`text-xl font-bold ${t.text} mb-4 mt-6`}>🏗️ Bay Status</h3>
          <div className="grid grid-cols-2 gap-2">
            {bayStatus.map(bay => {
              const assignment = getCurrentAssignment(bay)
              const isOccupied = !!assignment
              return (
                <div 
                  key={bay.id} 
                  className={`${t.surface} rounded-lg p-3 ${t.border} border-2 ${isOccupied ? 'border-orange-500' : 'border-green-500'}`}>
                  <div className="flex justify-between items-center">
                    <div className={`font-bold ${t.text}`}>Bay {bay.bay_number}</div>
                    <div className={`text-xl ${isOccupied ? 'text-orange-500' : 'text-green-500'}`}>
                      {isOccupied ? '🔧' : '✓'}
                    </div>
                  </div>
                  {assignment && (
                    <div className={`text-xs ${t.textSecondary} mt-1`}>
                      {assignment.work_orders?.job_number}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Activity Feed */}
        <div>
          <h3 className={`text-xl font-bold ${t.text} mb-4`}>📋 Recent Activity</h3>
          <div className={`${t.surface} rounded-lg ${t.border} border overflow-hidden`}>
            <div className="max-h-[500px] overflow-y-auto">
              {recentActivity.map((activity, idx) => (
                <div 
                  key={activity.id || idx} 
                  className={`p-3 ${t.border} border-b flex items-start gap-3`}>
                  <div className="text-xl">{getActivityIcon(activity.action)}</div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${t.text} truncate`}>
                      {activity.action || activity.description}
                    </div>
                    <div className={`text-xs ${t.textSecondary}`}>
                      {activity.entity_type} • {formatTime(activity.created_at)}
                    </div>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <div className={`p-8 text-center ${t.textSecondary}`}>
                  No recent activity
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
