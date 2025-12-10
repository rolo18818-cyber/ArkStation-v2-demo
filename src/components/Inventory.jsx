import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Inventory({ theme: t, userRole }) {
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
    reorder_point: 5
  })

  useEffect(() => {
    loadParts()
  }, [])

  const loadParts = async () => {
    const { data } = await supabase
      .from('parts')
      .select('*')
      .order('name')
    if (data) setParts(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase
      .from('parts')
      .insert([{
        ...formData,
        quantity: parseInt(formData.quantity),
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        sell_price: formData.sell_price ? parseFloat(formData.sell_price) : null,
        reorder_point: parseInt(formData.reorder_point)
      }])
    
    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Part added!')
      setShowForm(false)
      setFormData({ part_number: '', name: '', description: '', quantity: 0, cost_price: '', sell_price: '', supplier: '', reorder_point: 5 })
      loadParts()
    }
  }

  const updateQuantity = async (id, newQuantity) => {
    await supabase.from('parts').update({ quantity: newQuantity }).eq('id', id)
    loadParts()
  }

  const handleDelete = async (id) => {
    if (confirm('Delete this part?')) {
      await supabase.from('parts').delete().eq('id', id)
      loadParts()
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>🔩 Inventory</h2>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold"
        >
          {showForm ? 'Cancel' : '+ Add Part'}
        </button>
      </div>

      {showForm && (
        <div className={`${t.surface} rounded-lg shadow-lg p-6 mb-6 ${t.border} border`}>
          <h3 className={`text-xl font-semibold ${t.text} mb-4`}>New Part</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium ${t.text} mb-1`}>Part Number *</label>
              <input 
                type="text" 
                required 
                value={formData.part_number} 
                onChange={(e) => setFormData({...formData, part_number: e.target.value})} 
                className={`w-full px-3 py-2 ${t.input} rounded border`} 
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${t.text} mb-1`}>Name *</label>
              <input 
                type="text" 
                required 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                className={`w-full px-3 py-2 ${t.input} rounded border`} 
              />
            </div>
            <div className="md:col-span-2">
              <label className={`block text-sm font-medium ${t.text} mb-1`}>Description</label>
              <textarea 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
                rows="2" 
                className={`w-full px-3 py-2 ${t.input} rounded border`} 
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${t.text} mb-1`}>Quantity *</label>
              <input 
                type="number" 
                required 
                value={formData.quantity} 
                onChange={(e) => setFormData({...formData, quantity: e.target.value})} 
                className={`w-full px-3 py-2 ${t.input} rounded border`} 
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${t.text} mb-1`}>Reorder Point</label>
              <input 
                type="number" 
                value={formData.reorder_point} 
                onChange={(e) => setFormData({...formData, reorder_point: e.target.value})} 
                className={`w-full px-3 py-2 ${t.input} rounded border`} 
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${t.text} mb-1`}>Cost Price</label>
              <input 
                type="number" 
                step="0.01" 
                value={formData.cost_price} 
                onChange={(e) => setFormData({...formData, cost_price: e.target.value})} 
                className={`w-full px-3 py-2 ${t.input} rounded border`} 
                placeholder="0.00" 
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${t.text} mb-1`}>Sell Price</label>
              <input 
                type="number" 
                step="0.01" 
                value={formData.sell_price} 
                onChange={(e) => setFormData({...formData, sell_price: e.target.value})} 
                className={`w-full px-3 py-2 ${t.input} rounded border`} 
                placeholder="0.00" 
              />
            </div>
            <div className="md:col-span-2">
              <button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-lg"
              >
                ✓ Add Part
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
        <table className="min-w-full">
          <thead className={`${t.surface} ${t.border} border-b`}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Part #</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Name</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Quantity</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Cost</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Sell Price</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${t.border}`}>
            {parts.map((part) => (
              <tr key={part.id} className={`${t.surfaceHover} ${part.quantity <= (part.reorder_point || 5) ? 'bg-red-900 bg-opacity-30' : ''}`}>
                <td className="px-6 py-4">
                  <div className={`text-sm font-medium ${t.text}`}>{part.part_number}</div>
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm font-medium ${t.text}`}>{part.name}</div>
                  {part.description && <div className={`text-sm ${t.textSecondary}`}>{part.description}</div>}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <button 
                      onClick={() => updateQuantity(part.id, Math.max(0, part.quantity - 1))} 
                      className="w-8 h-8 rounded bg-red-600 hover:bg-red-700 text-white font-bold"
                    >
                      -
                    </button>
                    <span className={`text-lg font-bold min-w-[40px] text-center ${part.quantity <= (part.reorder_point || 5) ? 'text-red-500' : t.text}`}>
                      {part.quantity}
                    </span>
                    <button 
                      onClick={() => updateQuantity(part.id, part.quantity + 1)} 
                      className="w-8 h-8 rounded bg-green-600 hover:bg-green-700 text-white font-bold"
                    >
                      +
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm ${t.text}`}>${part.cost_price?.toFixed(2) || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm font-bold ${t.text}`}>${part.sell_price?.toFixed(2) || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => handleDelete(part.id)} 
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded font-medium text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {parts.length === 0 && (
          <div className={`text-center py-12 ${t.textSecondary}`}>
            No parts in inventory yet. Add your first part above!
          </div>
        )}
      </div>
    </div>
  )
}