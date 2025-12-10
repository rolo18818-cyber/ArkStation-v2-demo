import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Vehicles({ theme: t }) {
  const [vehicles, setVehicles] = useState([])
  const [customers, setCustomers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [formData, setFormData] = useState({
    customer_id: '',
    make: '',
    model: '',
    year: '',
    vin: '',
    registration: '',
    color: '',
    current_odometer: 0
  })
  const [saleData, setSaleData] = useState({
    date_sold: new Date().toISOString().split('T')[0],
    sold_by: '',
    purchase_price: '',
    current_odometer: 0
  })
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadVehicles()
    loadCustomers()
  }, [])

  const loadVehicles = async () => {
    const { data } = await supabase
      .from('vehicles')
      .select('*, customers(first_name, last_name)')
      .order('created_at', { ascending: false })
    if (data) setVehicles(data)
  }

  const loadCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('last_name')
    if (data) setCustomers(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (editingVehicle) {
      const { error } = await supabase
        .from('vehicles')
        .update(formData)
        .eq('id', editingVehicle.id)
      
      if (error) {
        alert('Error updating vehicle: ' + error.message)
      } else {
        resetForm()
        loadVehicles()
      }
    } else {
      const { error } = await supabase.from('vehicles').insert([formData])
      
      if (error) {
        alert('Error creating vehicle: ' + error.message)
      } else {
        resetForm()
        loadVehicles()
      }
    }
  }

  const markAsSold = async () => {
    if (!saleData.sold_by || !saleData.date_sold) {
      alert('Please fill in all sale details')
      return
    }

    const { error } = await supabase
      .from('vehicles')
      .update({
        date_sold: saleData.date_sold,
        sold_by: saleData.sold_by,
        purchase_price: parseFloat(saleData.purchase_price) || null,
        current_odometer: parseInt(saleData.current_odometer) || 0
      })
      .eq('id', selectedVehicle.id)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      setShowSaleModal(false)
      setSelectedVehicle(null)
      setSaleData({ date_sold: new Date().toISOString().split('T')[0], sold_by: '', purchase_price: '', current_odometer: 0 })
      loadVehicles()
      alert('✓ Vehicle marked as sold! First service milestone created.')
    }
  }

  const editVehicle = (vehicle) => {
    setEditingVehicle(vehicle)
    setFormData({
      customer_id: vehicle.customer_id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      vin: vehicle.vin || '',
      registration: vehicle.registration || '',
      color: vehicle.color || '',
      current_odometer: vehicle.current_odometer || 0
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingVehicle(null)
    setFormData({
      customer_id: '',
      make: '',
      model: '',
      year: '',
      vin: '',
      registration: '',
      color: '',
      current_odometer: 0
    })
  }

  const deleteVehicle = async (id) => {
    if (!confirm('Are you sure? This will also delete service history!')) return
    
    const { error } = await supabase.from('vehicles').delete().eq('id', id)
    if (error) {
      alert('Error deleting vehicle: ' + error.message)
    } else {
      loadVehicles()
    }
  }

  const openSaleModal = (vehicle) => {
    setSelectedVehicle(vehicle)
    setSaleData({
      date_sold: new Date().toISOString().split('T')[0],
      sold_by: '',
      purchase_price: '',
      current_odometer: vehicle.current_odometer || 0
    })
    setShowSaleModal(true)
  }

  const filteredVehicles = vehicles.filter(v => {
    const searchLower = searchTerm.toLowerCase()
    const vehicleName = `${v.year} ${v.make} ${v.model}`.toLowerCase()
    const customerName = `${v.customers?.first_name} ${v.customers?.last_name}`.toLowerCase()
    return vehicleName.includes(searchLower) ||
           customerName.includes(searchLower) ||
           v.registration?.toLowerCase().includes(searchLower) ||
           v.vin?.toLowerCase().includes(searchLower)
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>Vehicles</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`${t.primary} ${t.primaryHover} ${t.primaryText} px-4 py-2 rounded-lg font-medium`}>
          {showForm ? 'Cancel' : '+ New Vehicle'}
        </button>
      </div>

      <div className={`${t.surface} rounded-lg shadow-lg p-4 mb-6 ${t.border} border`}>
        <input
          type="text"
          placeholder="🔍 Search by make, model, customer, rego, or VIN..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full px-4 py-2 ${t.input} rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
      </div>

      {showForm && (
        <div className={`${t.surface} rounded-lg shadow-lg p-6 mb-6 ${t.border} border`}>
          <h3 className={`text-xl font-semibold mb-4 ${t.text}`}>
            {editingVehicle ? 'Edit Vehicle' : 'New Vehicle'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${t.text} mb-1`}>Customer *</label>
              <select
                required
                value={formData.customer_id}
                onChange={(e) => setFormData({...formData, customer_id: e.target.value})}
                className={`w-full px-3 py-2 ${t.input} rounded-md border`}>
                <option value="">Select Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} - {c.phone}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Year *</label>
                <input
                  type="number"
                  required
                  value={formData.year}
                  onChange={(e) => setFormData({...formData, year: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-md border`}
                  placeholder="2024"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Make *</label>
                <input
                  type="text"
                  required
                  value={formData.make}
                  onChange={(e) => setFormData({...formData, make: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-md border`}
                  placeholder="Honda"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Model *</label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-md border`}
                  placeholder="CB500F"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Registration</label>
                <input
                  type="text"
                  value={formData.registration}
                  onChange={(e) => setFormData({...formData, registration: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-md border`}
                  placeholder="ABC123"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Color</label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({...formData, color: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-md border`}
                  placeholder="Red"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Odometer (km)</label>
                <input
                  type="number"
                  value={formData.current_odometer}
                  onChange={(e) => setFormData({...formData, current_odometer: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-md border`}
                  placeholder="15000"
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium ${t.text} mb-1`}>VIN</label>
              <input
                type="text"
                value={formData.vin}
                onChange={(e) => setFormData({...formData, vin: e.target.value})}
                className={`w-full px-3 py-2 ${t.input} rounded-md border`}
                placeholder="1HGBH41JXMN109186"
              />
            </div>

            <button type="submit" className={`w-full ${t.primary} ${t.primaryHover} ${t.primaryText} py-2 rounded-lg font-medium`}>
              {editingVehicle ? 'Update Vehicle' : 'Create Vehicle'}
            </button>
          </form>
        </div>
      )}

      <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
        <table className="min-w-full">
          <thead className={`${t.surface} ${t.border} border-b`}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Vehicle</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Customer</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Registration</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Sale Status</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>First Service</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${t.border}`}>
            {filteredVehicles.map((vehicle) => (
              <tr key={vehicle.id} className={t.surfaceHover}>
                <td className="px-6 py-4">
                  <div className={`text-sm font-medium ${t.text}`}>
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </div>
                  {vehicle.color && (
                    <div className={`text-xs ${t.textSecondary}`}>{vehicle.color}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm ${t.text}`}>
                    {vehicle.customers?.first_name} {vehicle.customers?.last_name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm ${t.text}`}>{vehicle.registration || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {vehicle.date_sold ? (
                    <div>
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500 text-white">
                        SOLD
                      </span>
                      <div className={`text-xs ${t.textSecondary} mt-1`}>
                        {new Date(vehicle.date_sold).toLocaleDateString()}
                      </div>
                    </div>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-500 text-white">
                      STOCK
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {vehicle.date_sold ? (
                    vehicle.first_service_completed ? (
                      <div>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500 text-white">
                          ✓ DONE
                        </span>
                        {vehicle.first_service_date && (
                          <div className={`text-xs ${t.textSecondary} mt-1`}>
                            {new Date(vehicle.first_service_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-500 text-white">
                          DUE
                        </span>
                        {vehicle.first_service_due_date && (
                          <div className={`text-xs ${t.textSecondary} mt-1`}>
                            Due: {new Date(vehicle.first_service_due_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <span className={`text-sm ${t.textSecondary}`}>N/A</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                  {!vehicle.date_sold && (
                    <button
                      onClick={() => openSaleModal(vehicle)}
                      className="text-green-500 hover:text-green-700 font-medium">
                      Mark Sold
                    </button>
                  )}
                  <button
                    onClick={() => editVehicle(vehicle)}
                    className="text-blue-500 hover:text-blue-700 font-medium">
                    Edit
                  </button>
                  <button
                    onClick={() => deleteVehicle(vehicle.id)}
                    className="text-red-500 hover:text-red-700 font-medium">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredVehicles.length === 0 && (
          <div className={`text-center py-12 ${t.textSecondary}`}>
            No vehicles found.
          </div>
        )}
      </div>

      {/* MARK AS SOLD MODAL */}
      {showSaleModal && selectedVehicle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl p-6 w-full max-w-md ${t.border} border-2`}>
            <h3 className={`text-2xl font-bold ${t.text} mb-4`}>Mark Vehicle as Sold</h3>
            <p className={`${t.textSecondary} mb-6`}>
              {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
            </p>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Sale Date *</label>
                <input
                  type="date"
                  required
                  value={saleData.date_sold}
                  onChange={(e) => setSaleData({...saleData, date_sold: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Sold By *</label>
                <input
                  type="text"
                  required
                  value={saleData.sold_by}
                  onChange={(e) => setSaleData({...saleData, sold_by: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Salesperson name"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Sale Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={saleData.purchase_price}
                  onChange={(e) => setSaleData({...saleData, purchase_price: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="15000.00"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Current Odometer (km)</label>
                <input
                  type="number"
                  value={saleData.current_odometer}
                  onChange={(e) => setSaleData({...saleData, current_odometer: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="5000"
                />
              </div>

              <div className={`${t.surface} ${t.border} border rounded p-3`}>
                <div className={`text-sm font-semibold ${t.text} mb-1`}>Auto-Creates:</div>
                <ul className={`text-xs ${t.textSecondary} space-y-1`}>
                  <li>✓ First service milestone (due in 30 days or +1000km)</li>
                  <li>✓ Service reminder notification</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSaleModal(false)}
                className={`flex-1 ${t.surface} ${t.border} border-2 py-2 rounded-lg font-medium`}>
                Cancel
              </button>
              <button
                onClick={markAsSold}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium">
                Mark as Sold
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}