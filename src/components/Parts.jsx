import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Parts({ theme: t, userRole }) {
  const [parts, setParts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPart, setEditingPart] = useState(null)
  const [formData, setFormData] = useState({
    part_number: '',
    name: '',
    description: '',
    category: '',
    cost_price: '',
    sell_price: '',
    quantity: 0,
    reorder_point: 5,
    reorder_quantity: 10,
    supplier_id: '',
    location: '',
    barcode: ''
  })

  const canEdit = userRole === 'owner' || userRole === 'manager' || userRole === 'parts'

  useEffect(() => {
    loadParts()
    loadSuppliers()
  }, [])

  const loadParts = async () => {
    const { data } = await supabase
      .from('parts')
      .select(`
        *,
        supplier:supplier_id(company_name, first_name, last_name)
      `)
      .order('name')
    if (data) setParts(data)
  }

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_type', 'supplier')
      .order('company_name')
    if (data) setSuppliers(data)
  }

  const filteredParts = parts.filter(part => {
    const matchesSearch = 
      part.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (filter === 'all') return matchesSearch
    if (filter === 'low_stock') return matchesSearch && part.quantity <= part.reorder_point
    if (filter === 'out_of_stock') return matchesSearch && part.quantity === 0
    if (filter === 'in_stock') return matchesSearch && part.quantity > part.reorder_point
    return matchesSearch
  })

  const openAddModal = () => {
    setEditingPart(null)
    setFormData({
      part_number: '',
      name: '',
      description: '',
      category: '',
      cost_price: '',
      sell_price: '',
      quantity: 0,
      reorder_point: 5,
      reorder_quantity: 10,
      supplier_id: '',
      location: '',
      barcode: ''
    })
    setShowAddModal(true)
  }

  const openEditModal = (part) => {
    setEditingPart(part)
    setFormData({
      part_number: part.part_number || '',
      name: part.name || '',
      description: part.description || '',
      category: part.category || '',
      cost_price: part.cost_price || '',
      sell_price: part.sell_price || '',
      quantity: part.quantity || 0,
      reorder_point: part.reorder_point || 5,
      reorder_quantity: part.reorder_quantity || 10,
      supplier_id: part.supplier_id || '',
      location: part.location || '',
      barcode: part.barcode || ''
    })
    setShowAddModal(true)
  }

  const savePart = async () => {
    if (!formData.name || !formData.part_number) {
      alert('Please fill in part name and part number')
      return
    }

    const partData = {
      ...formData,
      cost_price: parseFloat(formData.cost_price) || 0,
      sell_price: parseFloat(formData.sell_price) || 0,
      quantity: parseInt(formData.quantity) || 0,
      reorder_point: parseInt(formData.reorder_point) || 5,
      reorder_quantity: parseInt(formData.reorder_quantity) || 10,
      supplier_id: formData.supplier_id || null
    }

    if (editingPart) {
      const { error } = await supabase
        .from('parts')
        .update(partData)
        .eq('id', editingPart.id)

      if (error) {
        alert('Error updating part: ' + error.message)
      } else {
        alert('✓ Part updated!')
        setShowAddModal(false)
        loadParts()
      }
    } else {
      const { error } = await supabase
        .from('parts')
        .insert([partData])

      if (error) {
        alert('Error adding part: ' + error.message)
      } else {
        alert('✓ Part added!')
        setShowAddModal(false)
        loadParts()
      }
    }
  }

  const deletePart = async (partId) => {
    if (!confirm('Are you sure you want to delete this part?')) return

    const { error } = await supabase
      .from('parts')
      .delete()
      .eq('id', partId)

    if (error) {
      alert('Error deleting part: ' + error.message)
    } else {
      alert('✓ Part deleted!')
      loadParts()
    }
  }

  const adjustStock = async (partId, adjustment) => {
    const part = parts.find(p => p.id === partId)
    const newQuantity = part.quantity + adjustment
    
    if (newQuantity < 0) {
      alert('Cannot have negative stock')
      return
    }

    const { error } = await supabase
      .from('parts')
      .update({ quantity: newQuantity })
      .eq('id', partId)

    if (!error) {
      // Log the transaction
      await supabase.rpc('log_inventory_transaction', {
        p_part_id: partId,
        p_transaction_type: adjustment > 0 ? 'adjustment' : 'adjustment',
        p_quantity: Math.abs(adjustment),
        p_notes: `Manual ${adjustment > 0 ? 'increase' : 'decrease'} of ${Math.abs(adjustment)}`
      })
      loadParts()
    }
  }

  const getStockBadge = (part) => {
    if (part.quantity === 0) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500 text-white">OUT OF STOCK</span>
    } else if (part.quantity <= part.reorder_point) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-500 text-white">LOW STOCK</span>
    } else {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500 text-white">IN STOCK</span>
    }
  }

  const getMargin = (part) => {
    if (!part.cost_price || part.cost_price === 0) return 0
    return ((part.sell_price - part.cost_price) / part.cost_price * 100).toFixed(1)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>🔩 Parts Management</h2>
        {canEdit && (
          <button
            onClick={openAddModal}
            className={`${t.primary} ${t.primaryHover} ${t.primaryText} px-6 py-3 rounded-lg font-bold`}>
            + Add Part
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search parts by name, part number, or barcode..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`flex-1 px-4 py-3 ${t.input} rounded-lg border`}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`px-4 py-3 ${t.input} rounded-lg border`}>
          <option value="all">All Parts ({parts.length})</option>
          <option value="in_stock">In Stock ({parts.filter(p => p.quantity > p.reorder_point).length})</option>
          <option value="low_stock">Low Stock ({parts.filter(p => p.quantity <= p.reorder_point && p.quantity > 0).length})</option>
          <option value="out_of_stock">Out of Stock ({parts.filter(p => p.quantity === 0).length})</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className={`text-3xl font-bold ${t.text}`}>{parts.length}</div>
          <div className={`text-sm ${t.textSecondary}`}>Total Parts</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-green-500">{parts.filter(p => p.quantity > p.reorder_point).length}</div>
          <div className={`text-sm ${t.textSecondary}`}>In Stock</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-orange-500">{parts.filter(p => p.quantity <= p.reorder_point && p.quantity > 0).length}</div>
          <div className={`text-sm ${t.textSecondary}`}>Low Stock</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-red-500">{parts.filter(p => p.quantity === 0).length}</div>
          <div className={`text-sm ${t.textSecondary}`}>Out of Stock</div>
        </div>
      </div>

      {/* Parts Table */}
      <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
        <table className="min-w-full">
          <thead className={`${t.surface} ${t.border} border-b`}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Part #</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Name</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Category</th>
              <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Cost</th>
              <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Sell</th>
              <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Margin</th>
              <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Stock</th>
              <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
              {canEdit && <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>}
            </tr>
          </thead>
          <tbody className={`divide-y ${t.border}`}>
            {filteredParts.map(part => (
              <tr key={part.id} className={t.surfaceHover}>
                <td className="px-6 py-4">
                  <div className={`text-sm font-mono font-bold ${t.text}`}>{part.part_number}</div>
                  {part.barcode && (
                    <div className={`text-xs ${t.textSecondary}`}>BC: {part.barcode}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm font-semibold ${t.text}`}>{part.name}</div>
                  {part.supplier && (
                    <div className={`text-xs ${t.textSecondary}`}>
                      {part.supplier.company_name || `${part.supplier.first_name} ${part.supplier.last_name}`}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm ${t.text}`}>{part.category || '-'}</div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className={`text-sm ${t.text}`}>${part.cost_price?.toFixed(2) || '0.00'}</div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className={`text-sm font-bold ${t.text}`}>${part.sell_price?.toFixed(2) || '0.00'}</div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className={`text-sm font-bold ${getMargin(part) > 30 ? 'text-green-500' : getMargin(part) > 15 ? 'text-blue-500' : 'text-orange-500'}`}>
                    {getMargin(part)}%
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {canEdit && (
                      <button
                        onClick={() => adjustStock(part.id, -1)}
                        className="w-6 h-6 rounded bg-red-500 text-white text-xs font-bold hover:bg-red-600">
                        -
                      </button>
                    )}
                    <span className={`text-lg font-bold ${t.text} w-12 text-center`}>{part.quantity}</span>
                    {canEdit && (
                      <button
                        onClick={() => adjustStock(part.id, 1)}
                        className="w-6 h-6 rounded bg-green-500 text-white text-xs font-bold hover:bg-green-600">
                        +
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  {getStockBadge(part)}
                </td>
                {canEdit && (
                  <td className="px-6 py-4 text-center">
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => openEditModal(part)}
                        className="text-blue-500 hover:text-blue-700 font-medium text-sm">
                        Edit
                      </button>
                      <button
                        onClick={() => deletePart(part.id)}
                        className="text-red-500 hover:text-red-700 font-medium text-sm">
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredParts.length === 0 && (
          <div className={`text-center py-12 ${t.textSecondary}`}>
            No parts found matching your criteria
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border-2 max-h-[90vh] overflow-y-auto`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center sticky top-0`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>
                {editingPart ? 'Edit Part' : 'Add New Part'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Part Number *</label>
                  <input
                    type="text"
                    value={formData.part_number}
                    onChange={(e) => setFormData({...formData, part_number: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="e.g., BRK-001"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border font-mono`}
                    placeholder="Scan or enter barcode"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Part Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="e.g., Brake Pads - Front"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="2"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Part description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="e.g., Brakes, Engine, Electrical"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="e.g., Shelf A-3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Cost Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({...formData, cost_price: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Sell Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.sell_price}
                    onChange={(e) => setFormData({...formData, sell_price: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Current Stock</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Reorder Point</label>
                  <input
                    type="number"
                    value={formData.reorder_point}
                    onChange={(e) => setFormData({...formData, reorder_point: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Reorder Quantity</label>
                  <input
                    type="number"
                    value={formData.reorder_quantity}
                    onChange={(e) => setFormData({...formData, reorder_quantity: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Supplier</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Select Supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.company_name || `${s.first_name} ${s.last_name}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={savePart}
                  className={`flex-1 ${t.primary} ${t.primaryHover} ${t.primaryText} py-3 rounded-lg font-bold`}>
                  {editingPart ? 'Update Part' : 'Add Part'}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className={`flex-1 ${t.surface} ${t.surfaceHover} ${t.text} ${t.border} border py-3 rounded-lg font-bold`}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
