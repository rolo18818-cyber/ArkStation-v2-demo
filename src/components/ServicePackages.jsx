import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ServicePackages({ theme: t }) {
  const [packages, setPackages] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    estimated_hours: ''
  })

  useEffect(() => {
    loadPackages()
  }, [])

  const loadPackages = async () => {
    const { data } = await supabase
      .from('service_packages')
      .select('*')
      .eq('is_active', true)
      .order('name')
    
    if (data) setPackages(data)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const { error } = await supabase.from('service_packages').insert([{
      name: formData.name,
      description: formData.description || null,
      price: parseFloat(formData.price),
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
      is_active: true
    }])
    
    if (error) {
      console.error('Error:', error)
      alert('Error adding service package: ' + error.message)
    } else {
      setShowForm(false)
      setFormData({
        name: '',
        description: '',
        price: '',
        estimated_hours: ''
      })
      loadPackages()
    }
  }

  const handleDelete = async (id) => {
    if (confirm('Delete this service package?')) {
      await supabase.from('service_packages').update({ is_active: false }).eq('id', id)
      loadPackages()
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>Service Packages</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`${t.primary} ${t.primaryHover} ${t.primaryText} px-4 py-2 rounded-lg font-medium transition-all shadow-lg`}
        >
          {showForm ? 'Cancel' : '+ Add Package'}
        </button>
      </div>

      {showForm && (
        <div className={`${t.surface} rounded-lg shadow-lg p-6 mb-6 ${t.border} border`}>
          <h3 className={`text-xl font-semibold mb-4 ${t.text}`}>New Service Package</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${t.text} mb-1`}>Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className={`w-full px-3 py-2 ${t.input} rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="e.g., Basic Service"
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${t.text} mb-1`}>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows="3"
                className={`w-full px-3 py-2 ${t.input} rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                placeholder="What's included in this service..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Price ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Estimated Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.estimated_hours}
                  onChange={(e) => setFormData({...formData, estimated_hours: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
            </div>
            <button type="submit" className={`w-full ${t.primary} ${t.primaryHover} ${t.primaryText} py-2 rounded-lg font-medium transition-all`}>
              Add Service Package
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <div key={pkg.id} className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border transition-transform hover:scale-105`}>
            <div className="flex justify-between items-start mb-4">
              <h3 className={`text-xl font-semibold ${t.text}`}>{pkg.name}</h3>
              <button onClick={() => handleDelete(pkg.id)} className="text-red-500 hover:text-red-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            {pkg.description && (
              <p className={`${t.textSecondary} text-sm mb-4`}>{pkg.description}</p>
            )}
            <div className={`border-t ${t.border} pt-4`}>
              <div className="flex justify-between items-center">
                <span className="text-2xl font-bold text-blue-500">${pkg.price.toFixed(2)}</span>
                {pkg.estimated_hours && (
                  <span className={`text-sm ${t.textSecondary}`}>{pkg.estimated_hours}h</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {packages.length === 0 && (
        <div className={`text-center py-12 ${t.textSecondary} ${t.surface} rounded-lg shadow ${t.border} border`}>
          No service packages yet. Add your first one above!
        </div>
      )}
    </div>
  )
}