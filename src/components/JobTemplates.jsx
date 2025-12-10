import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function JobTemplates({ theme: t }) {
  const [templates, setTemplates] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    estimated_duration_minutes: 60,
    default_labor_hours: 1.0,
    checklist_items: []
  })
  const [newChecklistItem, setNewChecklistItem] = useState('')

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('job_templates')
      .select('*')
      .eq('is_active', true)
      .order('category, name')
    if (data) setTemplates(data)
  }

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return
    setFormData({
      ...formData,
      checklist_items: [...formData.checklist_items, newChecklistItem]
    })
    setNewChecklistItem('')
  }

  const removeChecklistItem = (index) => {
    setFormData({
      ...formData,
      checklist_items: formData.checklist_items.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const dataToSave = {
      ...formData,
      checklist_items: JSON.stringify(formData.checklist_items)
    }

    if (editingTemplate) {
      await supabase.from('job_templates').update(dataToSave).eq('id', editingTemplate.id)
    } else {
      await supabase.from('job_templates').insert([dataToSave])
    }

    resetForm()
    loadTemplates()
  }

  const editTemplate = (template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description || '',
      category: template.category || '',
      estimated_duration_minutes: template.estimated_duration_minutes,
      default_labor_hours: template.default_labor_hours,
      checklist_items: typeof template.checklist_items === 'string' 
        ? JSON.parse(template.checklist_items) 
        : template.checklist_items || []
    })
    setShowForm(true)
  }

  const deleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return
    await supabase.from('job_templates').update({ is_active: false }).eq('id', id)
    loadTemplates()
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingTemplate(null)
    setFormData({
      name: '',
      description: '',
      category: '',
      estimated_duration_minutes: 60,
      default_labor_hours: 1.0,
      checklist_items: []
    })
  }

  const categories = [...new Set(templates.map(t => t.category).filter(Boolean))]

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>📋 Job Templates</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`${t.primary} ${t.primaryHover} ${t.primaryText} px-4 py-2 rounded-lg font-medium`}>
          {showForm ? 'Cancel' : '+ New Template'}
        </button>
      </div>

      {showForm && (
        <div className={`${t.surface} rounded-lg shadow-lg p-6 mb-6 ${t.border} border`}>
          <h3 className={`text-xl font-semibold mb-4 ${t.text}`}>
            {editingTemplate ? 'Edit Template' : 'New Template'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Template Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Full Service"
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Service, Repair, Inspection"
                  list="categories"
                />
                <datalist id="categories">
                  {categories.map(cat => <option key={cat} value={cat} />)}
                </datalist>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium ${t.text} mb-1`}>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows="2"
                className={`w-full px-3 py-2 ${t.input} rounded border`}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Estimated Duration (minutes)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.estimated_duration_minutes}
                  onChange={(e) => setFormData({...formData, estimated_duration_minutes: parseInt(e.target.value)})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Default Labor Hours</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.default_labor_hours}
                  onChange={(e) => setFormData({...formData, default_labor_hours: parseFloat(e.target.value)})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                />
              </div>
            </div>

            <div className={`${t.surface} ${t.border} border rounded-lg p-4`}>
              <h4 className={`font-bold ${t.text} mb-3`}>Checklist Items</h4>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                  placeholder="Add checklist item..."
                  className={`flex-1 px-3 py-2 ${t.input} rounded border`}
                />
                <button
                  type="button"
                  onClick={addChecklistItem}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium">
                  Add
                </button>
              </div>
              {formData.checklist_items.length > 0 && (
                <div className="space-y-2">
                  {formData.checklist_items.map((item, index) => (
                    <div key={index} className={`flex justify-between items-center p-2 ${t.surface} ${t.border} border rounded`}>
                      <span className={t.text}>{item}</span>
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(index)}
                        className="text-red-500 hover:text-red-700 font-bold">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" className={`w-full ${t.primary} ${t.primaryHover} ${t.primaryText} py-2 rounded font-medium`}>
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map(template => {
          const checklist = typeof template.checklist_items === 'string' 
            ? JSON.parse(template.checklist_items) 
            : template.checklist_items || []
          
          return (
            <div key={template.id} className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className={`text-xl font-bold ${t.text}`}>{template.name}</h3>
                  {template.category && (
                    <span className={`text-xs ${t.textSecondary} uppercase`}>{template.category}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => editTemplate(template)} className="text-blue-500 hover:text-blue-700">Edit</button>
                  <button onClick={() => deleteTemplate(template.id)} className="text-red-500 hover:text-red-700">Delete</button>
                </div>
              </div>

              {template.description && (
                <p className={`text-sm ${t.textSecondary} mb-4`}>{template.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className={`${t.surface} ${t.border} border rounded p-3`}>
                  <div className={`text-xs ${t.textSecondary}`}>Duration</div>
                  <div className={`text-lg font-bold ${t.text}`}>{template.estimated_duration_minutes} min</div>
                </div>
                <div className={`${t.surface} ${t.border} border rounded p-3`}>
                  <div className={`text-xs ${t.textSecondary}`}>Labor Hours</div>
                  <div className={`text-lg font-bold ${t.text}`}>{template.default_labor_hours} hrs</div>
                </div>
              </div>

              {checklist.length > 0 && (
                <div>
                  <div className={`text-sm font-semibold ${t.text} mb-2`}>Checklist ({checklist.length} items)</div>
                  <div className="space-y-1">
                    {checklist.slice(0, 3).map((item, index) => (
                      <div key={index} className={`text-xs ${t.textSecondary}`}>✓ {item}</div>
                    ))}
                    {checklist.length > 3 && (
                      <div className={`text-xs ${t.textSecondary} italic`}>+ {checklist.length - 3} more...</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}