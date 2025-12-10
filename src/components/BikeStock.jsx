import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function BikeStock({ theme: t }) {
  const [bikes, setBikes] = useState([])
  const [customers, setCustomers] = useState([])
  const [mechanics, setMechanics] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showPDIModal, setShowPDIModal] = useState(false)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [selectedBike, setSelectedBike] = useState(null)
  const [pdiChecklist, setPdiChecklist] = useState([])
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  const [formData, setFormData] = useState({
    vin: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    engine_size: '',
    stock_type: 'new',
    purchase_price: 0,
    retail_price: 0,
    location: 'Showroom Floor',
    odometer: 0,
    notes: ''
  })

  const [saleData, setSaleData] = useState({
    customer_id: '',
    sale_price: 0
  })

  useEffect(() => {
    loadBikes()
    loadCustomers()
    loadMechanics()
  }, [])

  const loadBikes = async () => {
    const { data } = await supabase
      .from('bike_stock')
      .select(`
        *,
        customers(first_name, last_name, company_name),
        mechanics(first_name, last_name)
      `)
      .order('created_at', { ascending: false })
    
    if (data) {
      const bikesWithDays = data.map(bike => ({
        ...bike,
        days_in_stock: bike.status !== 'sold' 
          ? Math.floor((new Date() - new Date(bike.date_received)) / (1000 * 60 * 60 * 24))
          : bike.days_in_stock
      }))
      setBikes(bikesWithDays)
    }
  }

  const loadCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('last_name')
    if (data) setCustomers(data)
  }

  const loadMechanics = async () => {
    const { data } = await supabase.from('mechanics').select('*').eq('is_active', true)
    if (data) setMechanics(data)
  }

  const loadPDIChecklist = async (bikeId) => {
    const { data } = await supabase
      .from('pdi_checklist')
      .select(`
        *,
        mechanics(first_name, last_name)
      `)
      .eq('bike_stock_id', bikeId)
      .order('item_category, item_name')
    
    if (data) setPdiChecklist(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const { data: stockNumber } = await supabase.rpc('generate_stock_number')
    
    const { error } = await supabase.from('bike_stock').insert([{
      ...formData,
      stock_number: stockNumber
    }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Bike added to stock!')
      setShowAddForm(false)
      setFormData({
        vin: '',
        make: '',
        model: '',
        year: new Date().getFullYear(),
        color: '',
        engine_size: '',
        stock_type: 'new',
        purchase_price: 0,
        retail_price: 0,
        location: 'Showroom Floor',
        odometer: 0,
        notes: ''
      })
      loadBikes()
    }
  }

  const viewBikeDetails = async (bike) => {
    setSelectedBike(bike)
    await loadPDIChecklist(bike.id)
    setShowDetailModal(true)
  }

  const openPDIModal = async (bike) => {
    setSelectedBike(bike)
    await loadPDIChecklist(bike.id)
    setShowPDIModal(true)
  }

  const togglePDIItem = async (itemId, isChecked) => {
    const { error } = await supabase
      .from('pdi_checklist')
      .update({
        is_checked: !isChecked,
        checked_at: !isChecked ? new Date().toISOString() : null,
        checked_by: !isChecked ? 'current_user_id' : null
      })
      .eq('id', itemId)

    if (!error) {
      loadPDIChecklist(selectedBike.id)
    }
  }

  const completePDI = async () => {
    const allChecked = pdiChecklist.every(item => item.is_checked)
    
    if (!allChecked) {
      if (!confirm('Not all items are checked. Complete PDI anyway?')) return
    }

    const { error } = await supabase
      .from('bike_stock')
      .update({
        pdi_completed: true,
        pdi_date: new Date().toISOString(),
        status: 'available'
      })
      .eq('id', selectedBike.id)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ PDI completed!')
      setShowPDIModal(false)
      loadBikes()
    }
  }

  const openSaleModal = (bike) => {
    setSelectedBike(bike)
    setSaleData({
      customer_id: '',
      sale_price: bike.retail_price
    })
    setShowSaleModal(true)
  }

  const completeSale = async () => {
    if (!saleData.customer_id) {
      alert('Please select a customer')
      return
    }

    const { error } = await supabase.rpc('sell_bike', {
      p_bike_id: selectedBike.id,
      p_customer_id: saleData.customer_id,
      p_sale_price: saleData.sale_price
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Bike sold!')
      setShowSaleModal(false)
      loadBikes()
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      available: 'bg-green-500',
      sold: 'bg-gray-500',
      on_hold: 'bg-yellow-500',
      in_pdi: 'bg-blue-500',
      in_workshop: 'bg-orange-500',
      pending_delivery: 'bg-purple-500',
      delivered: 'bg-gray-600'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[status]}`}>
        {status.toUpperCase().replace('_', ' ')}
      </span>
    )
  }

  const getTypeBadge = (type) => {
    const styles = {
      new: 'bg-green-600',
      used: 'bg-blue-600',
      demo: 'bg-purple-600',
      company: 'bg-yellow-600',
      consignment: 'bg-orange-600'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[type]}`}>
        {type.toUpperCase()}
      </span>
    )
  }

  const filteredBikes = bikes.filter(bike => {
    const matchesType = filterType === 'all' || bike.stock_type === filterType
    const matchesStatus = filterStatus === 'all' || bike.status === filterStatus
    const matchesSearch = 
      bike.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bike.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bike.vin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bike.stock_number?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesType && matchesStatus && matchesSearch
  })

  const stats = {
    total: bikes.length,
    available: bikes.filter(b => b.status === 'available').length,
    sold: bikes.filter(b => b.status === 'sold').length,
    in_pdi: bikes.filter(b => b.status === 'in_pdi').length,
    total_value: bikes
      .filter(b => b.status !== 'sold')
      .reduce((sum, b) => sum + (b.retail_price || 0), 0)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className={`text-3xl font-bold ${t.text}`}>🏍️ Bike Stock Management</h2>
          <p className={`text-sm ${t.textSecondary} mt-1`}>
            {stats.available} available • {stats.sold} sold this period • Total value: ${stats.total_value.toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className={`${t.primary} ${t.primaryHover} ${t.primaryText} px-4 py-2 rounded-lg font-medium`}>
          + Add Bike to Stock
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg shadow-lg p-4 ${t.border} border`}>
          <div className={`text-sm ${t.textSecondary} mb-1`}>Total Stock</div>
          <div className={`text-3xl font-bold ${t.text}`}>{stats.total}</div>
        </div>
        <div className={`${t.surface} rounded-lg shadow-lg p-4 ${t.border} border-2 border-green-500`}>
          <div className={`text-sm ${t.textSecondary} mb-1`}>Available</div>
          <div className="text-3xl font-bold text-green-500">{stats.available}</div>
        </div>
        <div className={`${t.surface} rounded-lg shadow-lg p-4 ${t.border} border`}>
          <div className={`text-sm ${t.textSecondary} mb-1`}>In PDI</div>
          <div className="text-3xl font-bold text-blue-500">{stats.in_pdi}</div>
        </div>
        <div className={`${t.surface} rounded-lg shadow-lg p-4 ${t.border} border`}>
          <div className={`text-sm ${t.textSecondary} mb-1`}>Sold (Period)</div>
          <div className="text-3xl font-bold text-gray-500">{stats.sold}</div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${t.surface} rounded-lg shadow-lg p-4 mb-6 ${t.border} border`}>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={`block text-sm font-medium ${t.text} mb-2`}>Stock Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`w-full px-3 py-2 ${t.input} rounded border`}>
              <option value="all">All Types</option>
              <option value="new">New</option>
              <option value="used">Used</option>
              <option value="demo">Demo</option>
              <option value="company">Company</option>
              <option value="consignment">Consignment</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium ${t.text} mb-2`}>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`w-full px-3 py-2 ${t.input} rounded border`}>
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="in_pdi">In PDI</option>
              <option value="sold">Sold</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium ${t.text} mb-2`}>Search</label>
            <input
              type="text"
              placeholder="Make, model, VIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full px-3 py-2 ${t.input} rounded border`}
            />
          </div>
        </div>
      </div>

      {/* Bike Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBikes.map(bike => (
          <div
            key={bike.id}
            className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border-2 ${
              bike.status === 'available' ? 'border-green-500' : t.border
            }`}>
            <div className="bg-gradient-to-br from-blue-900 to-purple-900 h-48 flex items-center justify-center">
              <span className="text-6xl">🏍️</span>
            </div>

            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className={`text-lg font-bold ${t.text}`}>
                    {bike.year} {bike.make} {bike.model}
                  </h3>
                  <p className={`text-sm ${t.textSecondary}`}>{bike.engine_size}</p>
                </div>
                {getTypeBadge(bike.stock_type)}
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className={t.textSecondary}>Stock #:</span>
                  <span className={`font-mono ${t.text}`}>{bike.stock_number}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className={t.textSecondary}>Color:</span>
                  <span className={t.text}>{bike.color}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className={t.textSecondary}>Days in Stock:</span>
                  <span className={`font-bold ${bike.days_in_stock > 90 ? 'text-red-500' : t.text}`}>
                    {bike.days_in_stock}
                  </span>
                </div>
              </div>

              <div className="mb-3">
                {getStatusBadge(bike.status)}
                {bike.pdi_completed && (
                  <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-500 text-white">
                    ✓ PDI
                  </span>
                )}
              </div>

              <div className="mb-4">
                <div className="text-2xl font-bold text-green-500">
                  ${bike.retail_price?.toLocaleString()}
                </div>
                {bike.purchase_price && (
                  <div className={`text-xs ${t.textSecondary}`}>
                    Cost: ${bike.purchase_price?.toLocaleString()} • 
                    Margin: ${(bike.retail_price - bike.purchase_price).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => viewBikeDetails(bike)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-medium text-sm">
                  View
                </button>
                {bike.status === 'in_pdi' && !bike.pdi_completed && (
                  <button
                    onClick={() => openPDIModal(bike)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded font-medium text-sm">
                    PDI
                  </button>
                )}
                {bike.status === 'available' && (
                  <button
                    onClick={() => openSaleModal(bike)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded font-medium text-sm">
                    Sell
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-3xl ${t.border} border-2 my-8`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Add Bike to Stock</h3>
              <button onClick={() => setShowAddForm(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>VIN *</label>
                  <input
                    type="text"
                    required
                    value={formData.vin}
                    onChange={(e) => setFormData({...formData, vin: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="17-character VIN"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Stock Type *</label>
                  <select
                    value={formData.stock_type}
                    onChange={(e) => setFormData({...formData, stock_type: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}>
                    <option value="new">New</option>
                    <option value="used">Used</option>
                    <option value="demo">Demo</option>
                    <option value="company">Company</option>
                    <option value="consignment">Consignment</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Make *</label>
                  <input
                    type="text"
                    required
                    value={formData.make}
                    onChange={(e) => setFormData({...formData, make: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="Yamaha, Honda, etc"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Model *</label>
                  <input
                    type="text"
                    required
                    value={formData.model}
                    onChange={(e) => setFormData({...formData, model: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="MT-07, CBR650R, etc"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Year *</label>
                  <input
                    type="number"
                    required
                    value={formData.year}
                    onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Color</label>
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Engine Size</label>
                  <input
                    type="text"
                    value={formData.engine_size}
                    onChange={(e) => setFormData({...formData, engine_size: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="689cc, 250cc, etc"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Purchase Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({...formData, purchase_price: parseFloat(e.target.value)})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Retail Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.retail_price}
                    onChange={(e) => setFormData({...formData, retail_price: parseFloat(e.target.value)})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Odometer (km)</label>
                  <input
                    type="number"
                    value={formData.odometer}
                    onChange={(e) => setFormData({...formData, odometer: parseInt(e.target.value)})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Showroom Floor, Workshop, etc"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows="2"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                />
              </div>

              <button type="submit" className={`w-full ${t.primary} ${t.primaryHover} ${t.primaryText} py-3 rounded-lg font-bold`}>
                Add Bike to Stock
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PDI Modal */}
      {showPDIModal && selectedBike && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-4xl ${t.border} border-2 max-h-[90vh] overflow-y-auto`}>
            <div className={`sticky top-0 ${t.surface} ${t.border} border-b p-6 flex justify-between items-center z-10`}>
              <div>
                <h3 className={`text-2xl font-bold ${t.text}`}>PDI Checklist</h3>
                <p className={`text-sm ${t.textSecondary}`}>
                  {selectedBike.year} {selectedBike.make} {selectedBike.model} • {selectedBike.stock_number}
                </p>
              </div>
              <button onClick={() => setShowPDIModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className={`font-semibold ${t.text}`}>Progress:</span>
                  <span className={`font-bold ${t.text}`}>
                    {pdiChecklist.filter(i => i.is_checked).length} / {pdiChecklist.length}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-4">
                  <div
                    className="h-4 rounded-full bg-green-500 transition-all"
                    style={{ width: `${(pdiChecklist.filter(i => i.is_checked).length / pdiChecklist.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(
                  pdiChecklist.reduce((acc, item) => {
                    if (!acc[item.item_category]) acc[item.item_category] = []
                    acc[item.item_category].push(item)
                    return acc
                  }, {})
                ).map(([category, items]) => (
                  <div key={category} className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                    <h4 className={`font-bold ${t.text} mb-3`}>{category}</h4>
                    <div className="space-y-2">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={item.is_checked}
                            onChange={() => togglePDIItem(item.id, item.is_checked)}
                            className="w-5 h-5 cursor-pointer"
                          />
                          <span className={`${item.is_checked ? 'line-through text-gray-500' : t.text}`}>
                            {item.item_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={completePDI}
                className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-lg">
                Complete PDI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Modal */}
      {showSaleModal && selectedBike && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Sell Bike</h3>
              <button onClick={() => setShowSaleModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6">
              <div className={`${t.surface} ${t.border} border rounded-lg p-4 mb-6`}>
                <h4 className={`font-bold ${t.text} text-lg mb-2`}>
                  {selectedBike.year} {selectedBike.make} {selectedBike.model}
                </h4>
                <p className={`text-sm ${t.textSecondary}`}>
                  Stock #: {selectedBike.stock_number} • VIN: {selectedBike.vin}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Customer *</label>
                  <select
                    required
                    value={saleData.customer_id}
                    onChange={(e) => setSaleData({...saleData, customer_id: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}>
                    <option value="">Select customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} {c.company_name && `(${c.company_name})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Sale Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={saleData.sale_price}
                    onChange={(e) => setSaleData({...saleData, sale_price: parseFloat(e.target.value)})}
                    className={`w-full px-3 py-2 ${t.input} rounded border text-2xl font-bold`}
                  />
                  <p className={`text-xs ${t.textSecondary} mt-1`}>
                    Retail: ${selectedBike.retail_price?.toLocaleString()} • 
                    Cost: ${selectedBike.purchase_price?.toLocaleString()}
                  </p>
                </div>

                <div className={`${t.surface} ${t.border} border rounded p-4`}>
                  <div className="flex justify-between mb-2">
                    <span className={`font-semibold ${t.text}`}>Profit:</span>
                    <span className={`font-bold text-2xl ${
                      saleData.sale_price > selectedBike.purchase_price ? 'text-green-500' : 'text-red-500'
                    }`}>
                      ${(saleData.sale_price - selectedBike.purchase_price).toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={completeSale}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-lg">
                  Complete Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}