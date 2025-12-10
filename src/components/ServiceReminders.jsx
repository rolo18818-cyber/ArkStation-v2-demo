import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ServiceReminders({ theme: t }) {
  const [dueServices, setDueServices] = useState([])
  const [overdueServices, setOverdueServices] = useState([])
  const [upcomingServices, setUpcomingServices] = useState([])

  useEffect(() => {
    loadServiceReminders()
  }, [])

  const loadServiceReminders = async () => {
    const today = new Date().toISOString().split('T')[0]
    const oneWeekFromNow = new Date()
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7)
    const weekFromNow = oneWeekFromNow.toISOString().split('T')[0]

    // Get overdue first services
    const { data: overdue } = await supabase
      .from('vehicles')
      .select('*, customers(first_name, last_name, phone, email)')
      .eq('first_service_completed', false)
      .not('date_sold', 'is', null)
      .lt('first_service_due_date', today)
      .order('first_service_due_date')

    // Get due today
    const { data: dueToday } = await supabase
      .from('vehicles')
      .select('*, customers(first_name, last_name, phone, email)')
      .eq('first_service_completed', false)
      .not('date_sold', 'is', null)
      .eq('first_service_due_date', today)

    // Get upcoming (next 7 days)
    const { data: upcoming } = await supabase
      .from('vehicles')
      .select('*, customers(first_name, last_name, phone, email)')
      .eq('first_service_completed', false)
      .not('date_sold', 'is', null)
      .gt('first_service_due_date', today)
      .lte('first_service_due_date', weekFromNow)
      .order('first_service_due_date')

    setOverdueServices(overdue || [])
    setDueServices(dueToday || [])
    setUpcomingServices(upcoming || [])
  }

  const markServiceCompleted = async (vehicleId) => {
    const { error } = await supabase
      .from('vehicles')
      .update({
        first_service_completed: true,
        first_service_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', vehicleId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Service marked as completed!')
      loadServiceReminders()
    }
  }

  const sendReminder = async (vehicle) => {
    // TODO: Integrate with SMS/Email service
    alert(`Reminder would be sent to:\n${vehicle.customers.first_name} ${vehicle.customers.last_name}\n${vehicle.customers.phone}\n${vehicle.customers.email}`)
  }

  const VehicleCard = ({ vehicle, status }) => {
    const daysOverdue = status === 'overdue' 
      ? Math.floor((new Date() - new Date(vehicle.first_service_due_date)) / (1000 * 60 * 60 * 24))
      : 0

    return (
      <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 ${
        status === 'overdue' ? 'border-red-500' : status === 'due' ? 'border-orange-500' : 'border-blue-500'
      }`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className={`text-xl font-bold ${t.text}`}>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </div>
            <div className={`${t.textSecondary} text-sm`}>
              {vehicle.registration && `${vehicle.registration} • `}
              Sold: {new Date(vehicle.date_sold).toLocaleDateString()}
            </div>
          </div>
          {status === 'overdue' && (
            <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
              {daysOverdue} DAYS OVERDUE
            </span>
          )}
          {status === 'due' && (
            <span className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-full">
              DUE TODAY
            </span>
          )}
        </div>

        <div className={`${t.surface} ${t.border} border rounded p-3 mb-4`}>
          <div className={`font-semibold ${t.text} mb-2`}>
            {vehicle.customers?.first_name} {vehicle.customers?.last_name}
          </div>
          <div className={`text-sm ${t.textSecondary}`}>
            📞 {vehicle.customers?.phone}
          </div>
          {vehicle.customers?.email && (
            <div className={`text-sm ${t.textSecondary}`}>
              ✉️ {vehicle.customers?.email}
            </div>
          )}
        </div>

        <div className={`text-sm ${t.textSecondary} mb-4`}>
          Service Due: {new Date(vehicle.first_service_due_date).toLocaleDateString()}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => sendReminder(vehicle)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium">
            📱 Send Reminder
          </button>
          <button
            onClick={() => markServiceCompleted(vehicle.id)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-medium">
            ✓ Mark Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className={`text-3xl font-bold ${t.text} mb-8`}>🔔 Service Reminders</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 border-red-500`}>
          <div className="text-5xl mb-2">🚨</div>
          <div className={`text-4xl font-bold text-red-500 mb-1`}>{overdueServices.length}</div>
          <div className={`${t.text} font-semibold`}>Overdue Services</div>
        </div>
        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 border-orange-500`}>
          <div className="text-5xl mb-2">⏰</div>
          <div className={`text-4xl font-bold text-orange-500 mb-1`}>{dueServices.length}</div>
          <div className={`${t.text} font-semibold`}>Due Today</div>
        </div>
        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 border-blue-500`}>
          <div className="text-5xl mb-2">📅</div>
          <div className={`text-4xl font-bold text-blue-500 mb-1`}>{upcomingServices.length}</div>
          <div className={`${t.text} font-semibold`}>Next 7 Days</div>
        </div>
      </div>

      {/* Overdue */}
      {overdueServices.length > 0 && (
        <div className="mb-8">
          <h3 className={`text-2xl font-bold text-red-500 mb-4`}>🚨 OVERDUE - Action Required</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {overdueServices.map(vehicle => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} status="overdue" />
            ))}
          </div>
        </div>
      )}

      {/* Due Today */}
      {dueServices.length > 0 && (
        <div className="mb-8">
          <h3 className={`text-2xl font-bold text-orange-500 mb-4`}>⏰ Due Today</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dueServices.map(vehicle => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} status="due" />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcomingServices.length > 0 && (
        <div className="mb-8">
          <h3 className={`text-2xl font-bold text-blue-500 mb-4`}>📅 Upcoming (Next 7 Days)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {upcomingServices.map(vehicle => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} status="upcoming" />
            ))}
          </div>
        </div>
      )}

      {overdueServices.length === 0 && dueServices.length === 0 && upcomingServices.length === 0 && (
        <div className={`${t.surface} rounded-lg shadow-lg p-12 text-center ${t.border} border`}>
          <div className="text-8xl mb-4">✓</div>
          <div className={`text-2xl font-bold ${t.text} mb-2`}>All Caught Up!</div>
          <div className={`${t.textSecondary}`}>No first services due at this time</div>
        </div>
      )}
    </div>
  )
}