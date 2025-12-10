import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function BookingCalendar({ theme: t, currentUser }) {
  const [bookings, setBookings] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [customers, setCustomers] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('week')
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [formData, setFormData] = useState({
    customer_id: '',
    vehicle_id: '',
    service_type: 'general',
    duration: 60,
    notes: '',
    mechanic_id: ''
  })

  useEffect(() => {
    loadBookings()
    loadMechanics()
    loadCustomers()
  }, [currentDate])

  const loadBookings = async () => {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 7)

    const { data } = await supabase
      .from('bookings')
      .select(`
        *,
        customers(first_name, last_name, phone),
        vehicles(year, make, model, registration),
        mechanics(first_name, last_name)
      `)
      .gte('start_time', startOfWeek.toISOString())
      .lt('start_time', endOfWeek.toISOString())
      .order('start_time')

    if (data) setBookings(data)
  }

  const loadMechanics = async () => {
    const { data } = await supabase.from('mechanics').select('*').eq('is_active', true).order('first_name')
    if (data) setMechanics(data)
  }

  const loadCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('last_name')
    if (data) setCustomers(data)
  }

  const loadVehicles = async (customerId) => {
    if (!customerId) { setVehicles([]); return }
    const { data } = await supabase.from('vehicles').select('*').eq('customer_id', customerId)
    if (data) setVehicles(data)
  }

  const getWeekDays = () => {
    const days = []
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      days.push(day)
    }
    return days
  }

  const getTimeSlots = () => {
    const slots = []
    for (let hour = 7; hour < 18; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`)
      slots.push(`${hour.toString().padStart(2, '0')}:30`)
    }
    return slots
  }

  const openBookingSlot = (date, time) => {
    const [hours, minutes] = time.split(':')
    const startTime = new Date(date)
    startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)

    setSelectedSlot({ date, time, startTime })
    setFormData({
      customer_id: '',
      vehicle_id: '',
      service_type: 'general',
      duration: 60,
      notes: '',
      mechanic_id: ''
    })
    setVehicles([])
    setShowBookingModal(true)
  }

  const getBookingForSlot = (date, time) => {
    const [hours, minutes] = time.split(':')
    const slotTime = new Date(date)
    slotTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)

    return bookings.find(b => {
      const bookingStart = new Date(b.start_time)
      const bookingEnd = new Date(b.end_time)
      return slotTime >= bookingStart && slotTime < bookingEnd
    })
  }

  const saveBooking = async () => {
    if (!formData.customer_id) {
      alert('Please select a customer')
      return
    }

    const endTime = new Date(selectedSlot.startTime)
    endTime.setMinutes(endTime.getMinutes() + formData.duration)

    try {
      const { error } = await supabase.from('bookings').insert([{
        customer_id: formData.customer_id,
        vehicle_id: formData.vehicle_id || null,
        mechanic_id: formData.mechanic_id || null,
        service_type: formData.service_type,
        start_time: selectedSlot.startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration: formData.duration,
        notes: formData.notes,
        status: 'confirmed'
      }])

      if (error) throw error

      alert('✓ Booking created!')
      setShowBookingModal(false)
      loadBookings()
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  const cancelBooking = async (bookingId) => {
    if (!confirm('Cancel this booking?')) return
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
    loadBookings()
  }

  const convertToWorkOrder = async (booking) => {
    if (!confirm('Convert this booking to a work order?')) return

    try {
      const { data: jobNumber } = await supabase.rpc('generate_job_number')

      const { error } = await supabase.from('work_orders').insert([{
        job_number: jobNumber,
        customer_id: booking.customer_id,
        vehicle_id: booking.vehicle_id,
        description: `${booking.service_type} - ${booking.notes || 'Scheduled service'}`,
        status: 'pending',
        booking_id: booking.id
      }])

      if (error) throw error

      await supabase.from('bookings').update({ status: 'converted' }).eq('id', booking.id)

      alert(`✓ Work Order ${jobNumber} created!`)
      loadBookings()
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + (direction * 7))
    setCurrentDate(newDate)
  }

  const goToToday = () => setCurrentDate(new Date())

  const weekDays = getWeekDays()
  const timeSlots = getTimeSlots()

  const getServiceColor = (type) => {
    const colors = {
      general: 'bg-blue-500',
      major: 'bg-purple-500',
      repair: 'bg-orange-500',
      tyres: 'bg-green-500',
      inspection: 'bg-yellow-500'
    }
    return colors[type] || 'bg-gray-500'
  }

  const todayStats = {
    total: bookings.filter(b => {
      const bDate = new Date(b.start_time).toDateString()
      return bDate === new Date().toDateString() && b.status !== 'cancelled'
    }).length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    converted: bookings.filter(b => b.status === 'converted').length
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>📅 Booking Calendar</h2>
        <div className="flex gap-3">
          <button onClick={goToToday} className={`${t.surface} ${t.text} px-4 py-2 rounded-lg border ${t.border}`}>
            Today
          </button>
          <div className="flex">
            <button onClick={() => navigateWeek(-1)} className={`${t.surface} ${t.text} px-4 py-2 rounded-l-lg border ${t.border}`}>
              ← Prev
            </button>
            <button onClick={() => navigateWeek(1)} className={`${t.surface} ${t.text} px-4 py-2 rounded-r-lg border ${t.border}`}>
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-blue-500">{todayStats.total}</div>
          <div className={t.textSecondary}>Today's Bookings</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-green-500">{todayStats.confirmed}</div>
          <div className={t.textSecondary}>Confirmed</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-purple-500">{todayStats.converted}</div>
          <div className={t.textSecondary}>Converted to Jobs</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-orange-500">{bookings.length}</div>
          <div className={t.textSecondary}>This Week</div>
        </div>
      </div>

      {/* Week Header */}
      <div className={`${t.surface} rounded-t-lg ${t.border} border`}>
        <div className={`text-center py-3 ${t.text} font-bold text-lg`}>
          {weekDays[0].toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={`${t.surface} rounded-b-lg shadow-lg overflow-hidden ${t.border} border-l border-r border-b`}>
        {/* Day Headers */}
        <div className="grid grid-cols-8">
          <div className={`p-2 ${t.border} border-r border-b`}></div>
          {weekDays.map((day, idx) => {
            const isToday = day.toDateString() === new Date().toDateString()
            return (
              <div
                key={idx}
                className={`p-2 text-center ${t.border} border-r border-b ${isToday ? 'bg-blue-600' : ''}`}
              >
                <div className={`text-xs ${isToday ? 'text-white' : t.textSecondary}`}>
                  {day.toLocaleDateString('en-AU', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-bold ${isToday ? 'text-white' : t.text}`}>
                  {day.getDate()}
                </div>
              </div>
            )
          })}
        </div>

        {/* Time Slots */}
        <div className="max-h-[600px] overflow-y-auto">
          {timeSlots.map((time, timeIdx) => (
            <div key={time} className="grid grid-cols-8">
              <div className={`p-1 text-xs ${t.textSecondary} ${t.border} border-r text-right pr-2`}>
                {time}
              </div>
              {weekDays.map((day, dayIdx) => {
                const booking = getBookingForSlot(day, time)
                const isPast = day < new Date() && day.toDateString() !== new Date().toDateString()

                return (
                  <div
                    key={dayIdx}
                    onClick={() => !booking && !isPast && openBookingSlot(day, time)}
                    className={`p-1 min-h-[40px] ${t.border} border-r border-b ${
                      isPast ? 'bg-gray-800 bg-opacity-50' : 'cursor-pointer hover:bg-blue-900 hover:bg-opacity-20'
                    }`}
                  >
                    {booking && timeIdx === timeSlots.findIndex(t => {
                      const [h, m] = t.split(':')
                      const slot = new Date(day)
                      slot.setHours(parseInt(h), parseInt(m))
                      return slot >= new Date(booking.start_time) && slot < new Date(booking.end_time)
                    }) && (
                      <div
                        className={`${getServiceColor(booking.service_type)} text-white text-xs rounded px-1 py-0.5 cursor-pointer`}
                        onClick={(e) => { e.stopPropagation(); cancelBooking(booking.id) }}
                        title={`${booking.customers?.first_name} ${booking.customers?.last_name} - ${booking.service_type}`}
                      >
                        <div className="font-bold truncate">
                          {booking.customers?.first_name}
                        </div>
                        <div className="truncate opacity-80">
                          {booking.vehicles?.registration || booking.service_type}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Bookings List */}
      <div className={`${t.surface} rounded-lg mt-6 ${t.border} border`}>
        <div className={`${t.border} border-b p-4`}>
          <h3 className={`text-lg font-bold ${t.text}`}>📋 Upcoming Bookings</h3>
        </div>
        <div className="divide-y divide-gray-700">
          {bookings.filter(b => b.status === 'confirmed').slice(0, 10).map(booking => (
            <div key={booking.id} className={`p-4 flex justify-between items-center ${t.surfaceHover}`}>
              <div>
                <div className={`font-bold ${t.text}`}>
                  {booking.customers?.first_name} {booking.customers?.last_name}
                </div>
                <div className={`text-sm ${t.textSecondary}`}>
                  {new Date(booking.start_time).toLocaleString()} • {booking.duration} min
                </div>
                <div className="flex gap-2 mt-1">
                  <span className={`px-2 py-0.5 text-xs rounded ${getServiceColor(booking.service_type)} text-white`}>
                    {booking.service_type}
                  </span>
                  {booking.vehicles && (
                    <span className={`text-xs ${t.textSecondary}`}>
                      {booking.vehicles.registration}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => convertToWorkOrder(booking)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium"
                >
                  → Work Order
                </button>
                <button
                  onClick={() => cancelBooking(booking.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
          {bookings.filter(b => b.status === 'confirmed').length === 0 && (
            <div className={`text-center py-8 ${t.textSecondary}`}>No upcoming bookings</div>
          )}
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && selectedSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-lg ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <div>
                <h3 className={`text-2xl font-bold ${t.text}`}>New Booking</h3>
                <p className={t.textSecondary}>
                  {selectedSlot.date.toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric' })} at {selectedSlot.time}
                </p>
              </div>
              <button onClick={() => setShowBookingModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Customer *</label>
                <select
                  value={formData.customer_id}
                  onChange={(e) => {
                    setFormData({ ...formData, customer_id: e.target.value, vehicle_id: '' })
                    loadVehicles(e.target.value)
                  }}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name} - {c.phone}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Vehicle</label>
                <select
                  value={formData.vehicle_id}
                  onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  disabled={!formData.customer_id}
                >
                  <option value="">Select vehicle...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} ({v.registration})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Service Type</label>
                  <select
                    value={formData.service_type}
                    onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  >
                    <option value="general">General Service</option>
                    <option value="major">Major Service</option>
                    <option value="repair">Repair</option>
                    <option value="tyres">Tyres</option>
                    <option value="inspection">Inspection</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Duration</label>
                  <select
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  >
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="90">1.5 hours</option>
                    <option value="120">2 hours</option>
                    <option value="180">3 hours</option>
                    <option value="240">4 hours</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Assign Mechanic</label>
                <select
                  value={formData.mechanic_id}
                  onChange={(e) => setFormData({ ...formData, mechanic_id: e.target.value })}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                >
                  <option value="">Unassigned</option>
                  {mechanics.map(m => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows="2"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Additional notes..."
                />
              </div>
              <button
                onClick={saveBooking}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold"
              >
                ✓ Create Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
