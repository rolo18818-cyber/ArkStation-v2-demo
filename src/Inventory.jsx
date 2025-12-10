import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Inventory() {
  const [parts, setParts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    part_number: '',
    name: '',
    description: '',
    quantity: 0,
    cost_price: '',
    sell_price: '',
    supplier: '',
    low_stock_threshold: 5
  })

  useEffect(() => {
    loadParts()
  }, [])

  const loadParts = async () => {
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .order('name')
    
    if (data) setParts(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const { data, error } = await supabase
      .from('parts')
      .insert([{
        ...formData,
        quantity: parseInt(formData.quantity),
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        sell_price: formData.sell_price ? parseFloat(formData.sell_price) : null,
        low_stock_threshold: parseInt(formData.low_stock_threshold)
      }])
    
    if (!error) {
      setShowForm(false)
      setFormData({
        part_number: '',
        name: '',
        description: '',
        quantity: 0,
        cost_price: '',
        sell_price: '',
        supplier: '',
        low_stock_threshold: 5
      })
      loadParts()
    }
  }

  const updateQuantity = async (id, newQuantity) => {
    await supabase
      .from('parts')
      .update({ quantity: newQuantity })
      .eq('id', id)
    
    loadParts()
  }

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this part?')) {
      await supabase
        .from('parts')
        .delete()
        .eq('id', id)
      
      loadParts()
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Inventory</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          {showForm ? 'Cancel' : '+ Add Part'}
        </button>
      </div>

      {/* Add Part Form */}
      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">New Part</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Part Number *</label>
              <input
                type="text"
                required
                value={formData.part_number}
                onChange={(e) => setFormData({...formData, part_number: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
              <input
                type="number"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Alert</label>
              <input
                type="number"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData({...formData, low_stock_threshold: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
              <input
                type="number"
                step="0.01"
                value={formData.cost_price}
                onChange={(e) => setFormData({...formData, cost_price: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sell Price</label>
              <input
                type="number"
                step="0.01"
                value={formData.sell_price}
                onChange={(e) => setFormData({...formData, sell_price: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Add Part
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Parts List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Part #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sell Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {parts.map((part) => (
              <tr key={part.id} className={`hover:bg-gray-50 ${part.quantity <= part.low_stock_threshold ? 'bg-red-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{part.part_number}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{part.name}</div>
                  {part.description && <div className="text-sm text-gray-500">{part.description}</div>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateQuantity(part.id, Math.max(0, part.quantity - 1))}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      -
                    </button>
                    <span className={`text-sm font-medium ${part.quantity <= part.low_stock_threshold ? 'text-red-600' : 'text-gray-900'}`}>
                      {part.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(part.id, part.quantity + 1)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      +
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">${part.cost_price?.toFixed(2) || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">${part.sell_price?.toFixed(2) || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleDelete(part.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {parts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No parts in inventory yet. Add your first part above!
          </div>
        )}
      </div>
    </div>
  )
}

export default Inventory