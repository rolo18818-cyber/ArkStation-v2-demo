import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function TimeClock({ theme: t }) {
  const [mechanics, setMechanics] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  const [view, setView] = useState('clock') // clock, timesheet, payroll
  const [selectedWeek, setSelectedWeek] = useState(new Date())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadMechanics()
    loadTodaysEntries()
  }, [])

  const getMechanicName = (mechanic) => {
    if (!mechanic) return 'Unknown'
    if (mechanic.name) return mechanic.name
    if (mechanic.first_name) return `${mechanic.first_name} ${mechanic.last_name || ''}`.trim()
    return 'Unnamed'
  }

  const loadMechanics = async () => {
    const { data } = await supabase
      .from('mechanics')
      .select('*')
      .eq('active', true)
    if (data) setMechanics(data)
  }

  const loadTodaysEntries = async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Query by clock_in time range instead of date column
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .gte('clock_in', today.toISOString())
      .lt('clock_in', tomorrow.toISOString())

    if (data) setTimeEntries(data)
  }

  // Get current status for a mechanic
  const getStatus = (mechanicId) => {
    const entry = timeEntries.find(e => e.mechanic_id === mechanicId && !e.clock_out)
    if (!entry) return { status: 'out', entry: null }
    if (entry.break_start && !entry.break_end) return { status: 'break', entry }
    return { status: 'working', entry }
  }

  // Clock In
  const clockIn = async (mechanicId) => {
    setLoading(true)
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    
    // Try with date first, fallback without
    let result = await supabase.from('time_entries').insert([{
      mechanic_id: mechanicId,
      date: dateStr,
      clock_in: now.toISOString(),
      break_minutes: 0
    }])
    
    // If date column doesn't exist, try without it
    if (result.error?.message?.includes('date')) {
      result = await supabase.from('time_entries').insert([{
        mechanic_id: mechanicId,
        clock_in: now.toISOString(),
        break_minutes: 0
      }])
    }
    
    const error = result.error

    if (error) {
      console.error('Clock in error:', error)
      alert('Failed to clock in: ' + error.message)
    }
    
    await loadTodaysEntries()
    setLoading(false)
  }

  // Clock Out
  const clockOut = async (mechanicId) => {
    setLoading(true)
    const { status, entry } = getStatus(mechanicId)
    
    if (!entry) {
      alert('No active clock-in found')
      setLoading(false)
      return
    }

    const now = new Date()
    const clockInTime = new Date(entry.clock_in)
    const totalMinutes = (now - clockInTime) / 1000 / 60
    const breakMinutes = entry.break_minutes || 0
    const workedMinutes = totalMinutes - breakMinutes
    const hoursWorked = Math.round(workedMinutes / 60 * 100) / 100

    const { error } = await supabase.from('time_entries').update({
      clock_out: now.toISOString(),
      hours_worked: hoursWorked
    }).eq('id', entry.id)

    if (error) {
      console.error('Clock out error:', error)
      alert('Failed to clock out: ' + error.message)
    }

    await loadTodaysEntries()
    setLoading(false)
  }

  // Start Break
  const startBreak = async (mechanicId) => {
    setLoading(true)
    const { entry } = getStatus(mechanicId)
    if (!entry) {
      setLoading(false)
      return
    }

    await supabase.from('time_entries').update({
      break_start: new Date().toISOString()
    }).eq('id', entry.id)

    await loadTodaysEntries()
    setLoading(false)
  }

  // End Break
  const endBreak = async (mechanicId) => {
    setLoading(true)
    const { entry } = getStatus(mechanicId)
    if (!entry || !entry.break_start) {
      setLoading(false)
      return
    }

    const breakStart = new Date(entry.break_start)
    const breakEnd = new Date()
    const breakMinutes = (entry.break_minutes || 0) + Math.round((breakEnd - breakStart) / 1000 / 60)

    await supabase.from('time_entries').update({
      break_end: breakEnd.toISOString(),
      break_minutes: breakMinutes,
      break_start: null // Reset for next break
    }).eq('id', entry.id)

    await loadTodaysEntries()
    setLoading(false)
  }

  // Format duration
  const formatDuration = (startDate, endDate = new Date()) => {
    const start = new Date(startDate)
    const diff = endDate - start
    const hours = Math.floor(diff / 1000 / 60 / 60)
    const mins = Math.floor((diff / 1000 / 60) % 60)
    return `${hours}h ${mins}m`
  }

  // Format time
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className={`text-3xl font-bold ${t.text}`}>⏱️ Time Clock</h2>
          <div className={t.textSecondary}>
            {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="flex gap-2">
          {['clock', 'timesheet', 'payroll'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg font-medium capitalize ${
                view === v ? 'bg-blue-600 text-white' : `${t.surface} ${t.text} ${t.border} border`
              }`}>
              {v === 'clock' ? '🕐 Clock' : v === 'timesheet' ? '📋 Timesheet' : '💰 Payroll'}
            </button>
          ))}
        </div>
      </div>

      {/* Clock View */}
      {view === 'clock' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mechanics.map(mechanic => {
            const { status, entry } = getStatus(mechanic.id)
            const name = getMechanicName(mechanic)
            
            return (
              <div key={mechanic.id} className={`${t.surface} rounded-xl ${t.border} border-2 overflow-hidden`}>
                {/* Status Header */}
                <div className={`p-4 ${
                  status === 'working' ? 'bg-green-600' : 
                  status === 'break' ? 'bg-yellow-600' : 
                  'bg-gray-700'
                }`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-white font-bold text-lg">{name}</h3>
                      <div className="text-white/80 text-sm">${mechanic.hourly_rate || 65}/hr</div>
                    </div>
                    <div className="text-right">
                      <div className={`flex items-center gap-2 text-white font-bold`}>
                        <span className={`w-3 h-3 rounded-full ${
                          status === 'working' ? 'bg-white animate-pulse' : 
                          status === 'break' ? 'bg-yellow-300' : 
                          'bg-gray-400'
                        }`}></span>
                        {status === 'working' ? 'Working' : status === 'break' ? 'On Break' : 'Not Clocked In'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4">
                  {entry && (
                    <div className={`mb-4 space-y-1 text-sm ${t.textSecondary}`}>
                      <div>Clocked in: {formatTime(entry.clock_in)}</div>
                      <div className={`text-lg font-bold ${t.text}`}>
                        Duration: {formatDuration(entry.clock_in)}
                      </div>
                      {entry.break_minutes > 0 && (
                        <div>Break: {entry.break_minutes}m</div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {status === 'out' && (
                      <button
                        onClick={() => clockIn(mechanic.id)}
                        disabled={loading}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold"
                      >
                        ▶️ Clock In
                      </button>
                    )}

                    {status === 'working' && (
                      <>
                        <button
                          onClick={() => startBreak(mechanic.id)}
                          disabled={loading}
                          className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold"
                        >
                          ☕ Break
                        </button>
                        <button
                          onClick={() => clockOut(mechanic.id)}
                          disabled={loading}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold"
                        >
                          ⏹️ Clock Out
                        </button>
                      </>
                    )}

                    {status === 'break' && (
                      <button
                        onClick={() => endBreak(mechanic.id)}
                        disabled={loading}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-bold"
                      >
                        ▶️ End Break
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {mechanics.length === 0 && (
            <div className={`col-span-full ${t.surface} rounded-lg ${t.border} border p-12 text-center`}>
              <div className="text-4xl mb-2">🔧</div>
              <div className={t.text}>No active mechanics</div>
              <div className={`text-sm ${t.textSecondary}`}>Add mechanics in the Mechanics page</div>
            </div>
          )}
        </div>
      )}

      {/* Timesheet View */}
      {view === 'timesheet' && (
        <div className={`${t.surface} rounded-lg ${t.border} border overflow-hidden`}>
          <div className={`p-4 ${t.border} border-b`}>
            <h3 className={`font-bold ${t.text}`}>Today's Time Entries</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className={`${t.border} border-b bg-gray-800`}>
                <th className={`text-left p-3 ${t.text}`}>Mechanic</th>
                <th className={`text-center p-3 ${t.text}`}>Clock In</th>
                <th className={`text-center p-3 ${t.text}`}>Clock Out</th>
                <th className={`text-center p-3 ${t.text}`}>Breaks</th>
                <th className={`text-right p-3 ${t.text}`}>Hours</th>
              </tr>
            </thead>
            <tbody>
              {timeEntries.map(entry => {
                const mechanic = mechanics.find(m => m.id === entry.mechanic_id)
                return (
                  <tr key={entry.id} className={`${t.border} border-b`}>
                    <td className={`p-3 ${t.text} font-medium`}>{getMechanicName(mechanic)}</td>
                    <td className={`p-3 text-center ${t.text}`}>{formatTime(entry.clock_in)}</td>
                    <td className={`p-3 text-center ${t.text}`}>
                      {entry.clock_out ? formatTime(entry.clock_out) : (
                        <span className="text-green-500">Working...</span>
                      )}
                    </td>
                    <td className={`p-3 text-center ${t.textSecondary}`}>{entry.break_minutes || 0}m</td>
                    <td className={`p-3 text-right font-bold ${t.text}`}>
                      {entry.hours_worked ? `${entry.hours_worked}h` : '-'}
                    </td>
                  </tr>
                )
              })}
              {timeEntries.length === 0 && (
                <tr>
                  <td colSpan="5" className={`p-8 text-center ${t.textSecondary}`}>
                    No time entries for today
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Payroll View */}
      {view === 'payroll' && (
        <PayrollView theme={t} mechanics={mechanics} getMechanicName={getMechanicName} />
      )}
    </div>
  )
}

// Payroll Summary Component
function PayrollView({ theme: t, mechanics, getMechanicName }) {
  const [weekEntries, setWeekEntries] = useState([])
  const [selectedWeek, setSelectedWeek] = useState(new Date())

  const getWeekStart = (date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const getWeekEnd = (date) => {
    const start = getWeekStart(date)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return end
  }

  useEffect(() => {
    loadWeekEntries()
  }, [selectedWeek])

  const loadWeekEntries = async () => {
    const weekStart = getWeekStart(selectedWeek)
    const weekEnd = getWeekEnd(selectedWeek)

    // Query by clock_in time range instead of date column
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .gte('clock_in', weekStart.toISOString())
      .lte('clock_in', weekEnd.toISOString())

    if (data) setWeekEntries(data)
  }

  const prevWeek = () => {
    const d = new Date(selectedWeek)
    d.setDate(d.getDate() - 7)
    setSelectedWeek(d)
  }

  const nextWeek = () => {
    const d = new Date(selectedWeek)
    d.setDate(d.getDate() + 7)
    setSelectedWeek(d)
  }

  // Calculate totals per mechanic
  const getMechanicTotals = (mechanicId) => {
    const entries = weekEntries.filter(e => e.mechanic_id === mechanicId)
    const totalHours = entries.reduce((sum, e) => sum + (e.hours_worked || 0), 0)
    const totalBreaks = entries.reduce((sum, e) => sum + (e.break_minutes || 0), 0)
    const mechanic = mechanics.find(m => m.id === mechanicId)
    const rate = mechanic?.hourly_rate || 65
    const gross = totalHours * rate
    return { totalHours, totalBreaks, gross, days: entries.length }
  }

  const weekStart = getWeekStart(selectedWeek)
  const weekEnd = getWeekEnd(selectedWeek)

  return (
    <div className="space-y-4">
      {/* Week Selector */}
      <div className={`${t.surface} rounded-lg ${t.border} border p-4 flex justify-between items-center`}>
        <button onClick={prevWeek} className={`px-4 py-2 ${t.surface} ${t.border} border rounded ${t.text}`}>
          ← Prev Week
        </button>
        <div className={`text-center ${t.text}`}>
          <div className="font-bold">
            {weekStart.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - {weekEnd.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
        <button onClick={nextWeek} className={`px-4 py-2 ${t.surface} ${t.border} border rounded ${t.text}`}>
          Next Week →
        </button>
      </div>

      {/* Payroll Table */}
      <div className={`${t.surface} rounded-lg ${t.border} border overflow-hidden`}>
        <div className={`p-4 ${t.border} border-b bg-gray-800`}>
          <h3 className={`font-bold ${t.text}`}>💰 Weekly Payroll Summary</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className={`${t.border} border-b`}>
              <th className={`text-left p-4 ${t.text}`}>Mechanic</th>
              <th className={`text-center p-4 ${t.text}`}>Days Worked</th>
              <th className={`text-center p-4 ${t.text}`}>Hours</th>
              <th className={`text-center p-4 ${t.text}`}>Breaks</th>
              <th className={`text-center p-4 ${t.text}`}>Rate</th>
              <th className={`text-right p-4 ${t.text}`}>Gross Pay</th>
            </tr>
          </thead>
          <tbody>
            {mechanics.map(mechanic => {
              const { totalHours, totalBreaks, gross, days } = getMechanicTotals(mechanic.id)
              return (
                <tr key={mechanic.id} className={`${t.border} border-b`}>
                  <td className={`p-4 ${t.text} font-medium`}>{getMechanicName(mechanic)}</td>
                  <td className={`p-4 text-center ${t.text}`}>{days}</td>
                  <td className={`p-4 text-center ${t.text} font-bold`}>{totalHours.toFixed(1)}h</td>
                  <td className={`p-4 text-center ${t.textSecondary}`}>{totalBreaks}m</td>
                  <td className={`p-4 text-center ${t.textSecondary}`}>${mechanic.hourly_rate || 65}/hr</td>
                  <td className={`p-4 text-right font-bold text-green-500 text-lg`}>${gross.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-800">
              <td colSpan="5" className={`p-4 text-right font-bold ${t.text}`}>Total Payroll:</td>
              <td className={`p-4 text-right font-bold text-green-400 text-xl`}>
                ${mechanics.reduce((sum, m) => sum + getMechanicTotals(m.id).gross, 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
