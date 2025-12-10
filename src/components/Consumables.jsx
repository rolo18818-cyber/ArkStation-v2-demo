import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Consumables({ theme: t }) {
  const [consumables, setConsumables] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [view, setView] = useState('inventory')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showUsageForm, setShowUsageForm] = useState(false)
  const [showRestockForm, setShowRestockForm] = useState(false)
  const [selectedConsumable, setSelectedConsumable] = useState(null)
  const [usageHistory, setUsageHistory] = useState([])
  const [restockHistory, setRestockHistory] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [filterCategory, setFilterCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'shop_supplies',
    unit_of_measure: 'pieces',
    current_quantity: 0,
    min_quantity: 10,
    cost_per_unit: 0,
    supplier_id: '',
    notes: ''
  })

  const [usageData, setUsageData] = useState({
    consumable_id: '',
    work_order_id: '',
    quantity_used: 1,
    notes: ''
  })

  const [restockData, setRestockData] = useState({
    consumable_id: '',
    quantity_added: 0,
    cost_per_unit: 0,
    supplier_id: '',
    invoice_reference: ''
  })

  useEffect(() => {
    loadConsumables()
    loadSuppliers()
    loadWorkOrders()
  }, [])

  const loadConsumables = async () => {
    const { data } = await supabase
      .from('consumables')
      .select('*, customers(company_name, first_name, last_name)')
      .eq('is_active', true)
      .order('category, name')
    if (data) setConsumables(data)
  }

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('is_supplier', true)
    if (data) setSuppliers(data)
  }

  const loadWorkOrders = async () => {
    const { data } = await supabase
      .from('work_orders')
      .select('id, job_number')
      .in('status', ['in_progress', 'wait_parts'])
      .order('job_number')
    if (data) setWorkOrders(data)
  }

  const loadUsageHistory = async (consumableId) => {
    const { data } = await supabase
      .from('consumable_usage')
      .select('*, work_orders(job_number)')
      .eq('consumable_id', consumableId)
      .order('used_at', { ascending: false })
      .limit(50)
    if (data) setUsageHistory(data)
  }

  const loadRestockHistory = async (consumableId) => {
    const { data } = await supabase
      .from('consumable_restock')
      .select('*, customers(company_name, first_name, last_name)')
      .eq('consumable_id', consumableId)
      .order('restocked_at', { ascending: false })
      .limit(20)
    if (data) setRestockHistory(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('consumables').insert([formData])
    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Consumable added!')
      setShowAddForm(false)
      setFormData({
        name: '',
        category: 'shop_supplies',
        unit_of_measure: 'pieces',
        current_quantity: 0,
        min_quantity: 10,
        cost_per_unit: 0,
        supplier_id: '',
        notes: ''
      })
      loadConsumables()
    }
  }

  const handleUsage = async (e) => {
    e.preventDefault()
    
    const consumable = consumables.find(c => c.id === usageData.consumable_id)
    const costAllocated = consumable.cost_per_unit * usageData.quantity_used

    const { error } = await supabase.from('consumable_usage').insert([{
      ...usageData,
      cost_allocated: costAllocated,
      used_by: 'Current User' // TODO: Get from auth
    }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Usage recorded!')
      setShowUsageForm(false)
      setUsageData({
        consumable_id: '',
        work_order_id: '',
        quantity_used: 1,
        notes: ''
      })
      loadConsumables()
    }
  }

  const handleRestock = async (e) => {
    e.preventDefault()
    
    const totalCost = restockData.quantity_added * restockData.cost_per_unit

    const { error } = await supabase.from('consumable_restock').insert([{
      ...restockData,
      total_cost: totalCost,
      restocked_by: 'Current User' // TODO: Get from auth
    }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Stock updated!')
      setShowRestockForm(false)
      setRestockData({
        consumable_id: '',
        quantity_added: 0,
        cost_per_unit: 0,
        supplier_id: '',
        invoice_reference: ''
      })
      loadConsumables()
    }
  }

  const viewDetails = (consumable) => {
    setSelectedConsumable(consumable)
    loadUsageHistory(consumable.id)
    loadRestockHistory(consumable.id)
    setView('details')
  }

  const getLowStockItems = () => {
    return consumables.filter(c => c.current_quantity <= c.min_quantity)
  }

  const filteredConsumables = consumables.filter(c => {
    const matchesCategory = filterCategory === 'all' || c.category === filterCategory
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const categories = [
    { id: 'all', label: 'All Items', icon: '📦' },
    { id: 'abrasives', label: 'Abrasives', icon: '🔨' },
    { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
    { id: 'lubricants', label: 'Lubricants', icon: '🛢️' },
    { id: 'fasteners', label: 'Fasteners', icon: '🔩' },
    { id: 'shop_supplies', label: 'Shop Supplies', icon: '📋' },
    { id: 'safety', label: 'Safety', icon: '🦺' },
    { id: 'other', label: 'Other', icon: '📌' }
  ]

  const lowStockItems = getLowStockItems()

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className={`text-3xl font-bold ${t.text}`}>🧰 Consumables Tracking</h2>
          {lowStockItems.length > 0 && (
            <p className={`text-sm mt-1`}>
              <span className="bg-red-500 text-white px-2 py-1 rounded font-semibold">
                ⚠️ {lowStockItems.length} items low on stock
              </span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUsageForm(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium">
            📝 Record Usage
          </button>
          <button
            onClick={() => setShowRestockForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">
            📦 Restock
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className={`${t.primary} ${t.primaryHover} ${t.primaryText} px-4 py-2 rounded-lg font-medium`}>
            + Add Consumable
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
              filterCategory === cat.id
                ? 'bg-blue-600 text-white'
                : `${t.surface} ${t.text} ${t.border} border hover:bg-opacity-80`
            }`}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className={`${t.surface} rounded-lg shadow-lg p-4 mb-6 ${t.border} border`}>
        <input
          type="text"
          placeholder="🔍 Search consumables..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full px-4 py-2 ${t.input} rounded border`}
        />
      </div>

      {/* Inventory Grid */}
      {view === 'inventory' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredConsumables.map(item => {
            const isLow = item.current_quantity <= item.min_quantity
            const percentage = (item.current_quantity / item.min_quantity) * 100

            return (
              <div
                key={item.id}
                onClick={() => viewDetails(item)}
                className={`${t.surface} rounded-lg shadow-lg p-4 ${t.border} border-2 ${
                  isLow ? 'border-red-500' : t.border
                } cursor-pointer hover:shadow-xl transition-all`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className={`font-bold ${t.text} mb-1`}>{item.name}</h3>
                    <p className={`text-xs ${t.textSecondary} uppercase`}>{item.category}</p>
                  </div>
                  {isLow && <span className="text-2xl">⚠️</span>}
                </div>

                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className={`text-xs ${t.textSecondary}`}>Stock Level</span>
                    <span className={`text-xs font-bold ${isLow ? 'text-red-500' : t.text}`}>
                      {item.current_quantity} {item.unit_of_measure}
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isLow ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <div className={`text-xs ${t.textSecondary} mt-1`}>
                    Min: {item.min_quantity} {item.unit_of_measure}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div className={`text-xs ${t.textSecondary}`}>
                    ${item.cost_per_unit.toFixed(2)}/{item.unit_of_measure}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setUsageData({ ...usageData, consumable_id: item.id })
                      setShowUsageForm(true)
                    }}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded text-xs font-medium">
                    Use
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Details View */}
      {view === 'details' && selectedConsumable && (
        <div>
          <button
            onClick={() => setView('inventory')}
            className="mb-4 text-blue-500 hover:text-blue-700 font-medium">
            ← Back to Inventory
          </button>

          <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border mb-6`}>
            <h3 className={`text-2xl font-bold ${t.text} mb-4`}>{selectedConsumable.name}</h3>
            
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className={`${t.surface} ${t.border} border rounded p-3`}>
                <div className={`text-xs ${t.textSecondary}`}>Current Stock</div>
                <div className={`text-2xl font-bold ${t.text}`}>
                  {selectedConsumable.current_quantity}
                </div>
                <div className={`text-xs ${t.textSecondary}`}>{selectedConsumable.unit_of_measure}</div>
              </div>

              <div className={`${t.surface} ${t.border} border rounded p-3`}>
                <div className={`text-xs ${t.textSecondary}`}>Min Stock</div>
                <div className={`text-2xl font-bold ${t.text}`}>
                  {selectedConsumable.min_quantity}
                </div>
                <div className={`text-xs ${t.textSecondary}`}>{selectedConsumable.unit_of_measure}</div>
              </div>

              <div className={`${t.surface} ${t.border} border rounded p-3`}>
                <div className={`text-xs ${t.textSecondary}`}>Cost per Unit</div>
                <div className={`text-2xl font-bold text-green-500`}>
                  ${selectedConsumable.cost_per_unit.toFixed(2)}
                </div>
              </div>

              <div className={`${t.surface} ${t.border} border rounded p-3`}>
                <div className={`text-xs ${t.textSecondary}`}>Total Value</div>
                <div className={`text-2xl font-bold text-blue-500`}>
                  ${(selectedConsumable.current_quantity * selectedConsumable.cost_per_unit).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setUsageData({ ...usageData, consumable_id: selectedConsumable.id })
                  setShowUsageForm(true)
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded font-medium">
                Record Usage
              </button>
              <button
                onClick={() => {
                  setRestockData({ ...restockData, consumable_id: selectedConsumable.id, cost_per_unit: selectedConsumable.cost_per_unit })
                  setShowRestockForm(true)
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium">
                Restock
              </button>
            </div>
          </div>

          {/* Usage History */}
          <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border mb-6`}>
            <h4 className={`text-xl font-bold ${t.text} mb-4`}>Usage History</h4>
            <div className="space-y-2">
              {usageHistory.map(usage => (
                <div key={usage.id} className={`flex justify-between items-center p-3 ${t.surface} ${t.border} border rounded`}>
                  <div>
                    <div className={`font-semibold ${t.text}`}>
                      {usage.work_orders?.job_number || 'No job linked'}
                    </div>
                    <div className={`text-xs ${t.textSecondary}`}>
                      {usage.used_by} • {new Date(usage.used_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${t.text}`}>{usage.quantity_used} used</div>
                    <div className={`text-xs ${t.textSecondary}`}>${usage.cost_allocated?.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Restock History */}
          <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
            <h4 className={`text-xl font-bold ${t.text} mb-4`}>Restock History</h4>
            <div className="space-y-2">
              {restockHistory.map(restock => (
                <div key={restock.id} className={`flex justify-between items-center p-3 ${t.surface} ${t.border} border rounded`}>
                  <div>
                    <div className={`font-semibold ${t.text}`}>
                      {restock.customers?.company_name || 'No supplier'}
                    </div>
                    <div className={`text-xs ${t.textSecondary}`}>
                      {restock.restocked_by} • {new Date(restock.restocked_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-green-500`}>+{restock.quantity_added}</div>
                    <div className={`text-xs ${t.textSecondary}`}>${restock.total_cost?.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Consumable Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Add New Consumable</h3>
              <button onClick={() => setShowAddForm(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="Sandpaper 120 Grit"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}>
                    <option value="abrasives">Abrasives</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="lubricants">Lubricants</option>
                    <option value="fasteners">Fasteners</option>
                    <option value="shop_supplies">Shop Supplies</option>
                    <option value="safety">Safety</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Unit of Measure *</label>
                  <input
                    type="text"
                    required
                    value={formData.unit_of_measure}
                    onChange={(e) => setFormData({...formData, unit_of_measure: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="sheets, cans, pieces, etc"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Cost per Unit ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.cost_per_unit}
                    onChange={(e) => setFormData({...formData, cost_per_unit: parseFloat(e.target.value)})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Current Quantity *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.current_quantity}
                    onChange={(e) => setFormData({...formData, current_quantity: parseFloat(e.target.value)})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Min Quantity *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.min_quantity}
                    onChange={(e) => setFormData({...formData, min_quantity: parseFloat(e.target.value)})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Supplier (optional)</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">No supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.company_name || `${s.first_name} ${s.last_name}`}
                    </option>
                  ))}
                </select>
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
                Add Consumable
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Usage Form Modal */}
      {showUsageForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-xl ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Record Usage</h3>
              <button onClick={() => setShowUsageForm(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <form onSubmit={handleUsage} className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Consumable *</label>
                <select
                  required
                  value={usageData.consumable_id}
                  onChange={(e) => setUsageData({...usageData, consumable_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Select consumable...</option>
                  {consumables.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Stock: {c.current_quantity} {c.unit_of_measure})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Work Order (optional)</label>
                <select
                  value={usageData.work_order_id}
                  onChange={(e) => setUsageData({...usageData, work_order_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Not linked to a job</option>
                  {workOrders.map(wo => (
                    <option key={wo.id} value={wo.id}>{wo.job_number}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Quantity Used *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={usageData.quantity_used}
                  onChange={(e) => setUsageData({...usageData, quantity_used: parseFloat(e.target.value)})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Notes</label>
                <textarea
                  value={usageData.notes}
                  onChange={(e) => setUsageData({...usageData, notes: e.target.value})}
                  rows="2"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Optional notes about this usage..."
                />
              </div>

              <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-bold">
                Record Usage
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Restock Form Modal */}
      {showRestockForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-xl ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Restock Consumable</h3>
              <button onClick={() => setShowRestockForm(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <form onSubmit={handleRestock} className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Consumable *</label>
                <select
                  required
                  value={restockData.consumable_id}
                  onChange={(e) => {
                    const selected = consumables.find(c => c.id === e.target.value)
                    setRestockData({
                      ...restockData,
                      consumable_id: e.target.value,
                      cost_per_unit: selected?.cost_per_unit || 0
                    })
                  }}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Select consumable...</option>
                  {consumables.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Current: {c.current_quantity} {c.unit_of_measure})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Quantity Added *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={restockData.quantity_added}
                    onChange={(e) => setRestockData({...restockData, quantity_added: parseFloat(e.target.value)})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Cost per Unit ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={restockData.cost_per_unit}
                    onChange={(e) => setRestockData({...restockData, cost_per_unit: parseFloat(e.target.value)})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>
              </div>

              <div className={`${t.surface} ${t.border} border rounded p-3`}>
                <div className="flex justify-between">
                  <span className={`font-semibold ${t.text}`}>Total Cost:</span>
                  <span className="font-bold text-green-500 text-xl">
                    ${(restockData.quantity_added * restockData.cost_per_unit).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Supplier (optional)</label>
                <select
                  value={restockData.supplier_id}
                  onChange={(e) => setRestockData({...restockData, supplier_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">No supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.company_name || `${s.first_name} ${s.last_name}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Invoice Reference</label>
                <input
                  type="text"
                  value={restockData.invoice_reference}
                  onChange={(e) => setRestockData({...restockData, invoice_reference: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="PO number or invoice number"
                />
              </div>

              <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">
                Complete Restock
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}