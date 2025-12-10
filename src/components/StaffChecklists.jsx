import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function StaffChecklists({ theme: t, currentUser }) {
  const [templates, setTemplates] = useState([])
  const [schedules, setSchedules] = useState([])
  const [todayChecklists, setTodayChecklists] = useState([])
  const [staff, setStaff] = useState([])
  const [activeTab, setActiveTab] = useState('today')
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', category: 'daily', items: [] })
  const [scheduleForm, setScheduleForm] = useState({ template_id: '', assigned_to: '', frequency: 'daily', days_of_week: [], time_due: '17:00', is_active: true })
  const [newItem, setNewItem] = useState('')

  useEffect(() => {
    loadTemplates()
    loadSchedules()
    loadTodayChecklists()
    loadStaff()
  }, [])

  const loadTemplates = async () => {
    const { data } = await supabase.from('staff_checklist_templates').select('*').order('name')
    if (data) setTemplates(data)
  }

  const loadSchedules = async () => {
    const { data } = await supabase.from('staff_checklist_schedules').select(`*, staff_checklist_templates(name, category)`).eq('is_active', true).order('time_due')
    if (data) setSchedules(data)
  }

  const loadTodayChecklists = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('staff_checklist_instances').select(`*, staff_checklist_templates(name, category, items)`).eq('date', today).order('created_at')
    if (data) setTodayChecklists(data)
  }

  const loadStaff = async () => {
    const { data } = await supabase.from('users').select('id, first_name, last_name, role').order('first_name')
    if (data) setStaff(data)
  }

  const openTemplateForm = (template = null) => {
    if (template) {
      setSelectedTemplate(template)
      setTemplateForm({ name: template.name, description: template.description || '', category: template.category || 'daily', items: template.items || [] })
    } else {
      setSelectedTemplate(null)
      setTemplateForm({ name: '', description: '', category: 'daily', items: [] })
    }
    setShowTemplateForm(true)
  }

  const addItem = () => {
    if (!newItem.trim()) return
    setTemplateForm({ ...templateForm, items: [...templateForm.items, { text: newItem.trim(), required: true }] })
    setNewItem('')
  }

  const removeItem = (index) => {
    setTemplateForm({ ...templateForm, items: templateForm.items.filter((_, i) => i !== index) })
  }

  const saveTemplate = async () => {
    if (!templateForm.name || templateForm.items.length === 0) {
      alert('Please add name and at least one item')
      return
    }

    if (selectedTemplate) {
      await supabase.from('staff_checklist_templates').update(templateForm).eq('id', selectedTemplate.id)
    } else {
      await supabase.from('staff_checklist_templates').insert([{ ...templateForm, created_by: currentUser?.id }])
    }

    setShowTemplateForm(false)
    loadTemplates()
  }

  const deleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return
    await supabase.from('staff_checklist_templates').delete().eq('id', id)
    loadTemplates()
  }

  const aiGenerateChecklist = async () => {
    if (!templateForm.name) {
      alert('Enter a checklist name first (e.g., "End of Day")')
      return
    }
    setAiLoading(true)

    try {
      const response = await fetch('http://localhost:3001/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: 'You are a motorcycle workshop manager. Generate practical checklist items. Reply with a simple numbered list, one item per line. No JSON, no formatting, just the items. Example:\n1. Lock all doors\n2. Turn off equipment\n3. Set alarm',
          messages: [{
            role: 'user',
            content: `Generate 8-12 items for a "${templateForm.name}" checklist for a motorcycle workshop. ${templateForm.description ? `Context: ${templateForm.description}` : ''}`
          }],
          max_tokens: 500
        })
      })

      const data = await response.json()
      let text = (data.content?.[0]?.text || '').trim()
      
      // Parse numbered list or bullet points
      const lines = text.split('\n').filter(line => line.trim())
      const items = lines.map(line => {
        // Remove numbering, bullets, dashes
        const cleaned = line.replace(/^[\d]+[\.\)]\s*/, '').replace(/^[-•*]\s*/, '').trim()
        return cleaned ? { text: cleaned, required: true } : null
      }).filter(Boolean)

      if (items.length > 0) {
        setTemplateForm({ ...templateForm, items })
      } else {
        alert('Could not generate items. Please add manually.')
      }
    } catch (e) {
      console.error('AI Error:', e)
      alert('AI unavailable. Please add items manually.')
    }
    setAiLoading(false)
  }

  const openScheduleForm = () => {
    setScheduleForm({ template_id: '', assigned_to: '', frequency: 'daily', days_of_week: [], time_due: '17:00', is_active: true })
    setShowScheduleForm(true)
  }

  const toggleDay = (day) => {
    const days = scheduleForm.days_of_week.includes(day)
      ? scheduleForm.days_of_week.filter(d => d !== day)
      : [...scheduleForm.days_of_week, day]
    setScheduleForm({ ...scheduleForm, days_of_week: days })
  }

  const saveSchedule = async () => {
    if (!scheduleForm.template_id) {
      alert('Please select a checklist template')
      return
    }
    await supabase.from('staff_checklist_schedules').insert([{ ...scheduleForm, created_by: currentUser?.id }])
    setShowScheduleForm(false)
    loadSchedules()
  }

  const deleteSchedule = async (id) => {
    if (!confirm('Delete this schedule?')) return
    await supabase.from('staff_checklist_schedules').delete().eq('id', id)
    loadSchedules()
  }

  const createTodayInstance = async (schedule) => {
    const today = new Date().toISOString().split('T')[0]
    const template = templates.find(t => t.id === schedule.template_id)
    
    await supabase.from('staff_checklist_instances').insert([{
      template_id: schedule.template_id,
      schedule_id: schedule.id,
      assigned_to: schedule.assigned_to,
      date: today,
      items: template?.items?.map(item => ({ ...item, completed: false })) || [],
      status: 'pending'
    }])
    loadTodayChecklists()
  }

  const toggleInstanceItem = async (instance, itemIndex) => {
    const items = [...instance.items]
    items[itemIndex].completed = !items[itemIndex].completed
    const allComplete = items.every(i => i.completed)
    
    await supabase.from('staff_checklist_instances').update({
      items,
      status: allComplete ? 'completed' : 'in_progress',
      completed_at: allComplete ? new Date().toISOString() : null
    }).eq('id', instance.id)
    loadTodayChecklists()
  }

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>✅ Staff Checklists</h2>
        <div className="flex gap-2">
          <button onClick={() => openTemplateForm()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">+ New Template</button>
          <button onClick={openScheduleForm} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">+ Schedule</button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-2 mb-6 ${t.border} border-b pb-2`}>
        {['today', 'templates', 'schedules'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg font-medium capitalize ${activeTab === tab ? 'bg-blue-600 text-white' : `${t.text} ${t.surfaceHover}`}`}>
            {tab === 'today' ? "Today's Checklists" : tab}
          </button>
        ))}
      </div>

      {/* Today Tab */}
      {activeTab === 'today' && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className={`font-bold ${t.text} mb-4`}>Active Checklists</h3>
            {todayChecklists.length === 0 ? (
              <div className={`${t.surface} rounded-lg p-8 text-center ${t.border} border`}>
                <div className="text-4xl mb-2">📋</div>
                <div className={t.textSecondary}>No checklists for today</div>
              </div>
            ) : (
              <div className="space-y-4">
                {todayChecklists.map(instance => {
                  const completedCount = instance.items?.filter(i => i.completed).length || 0
                  const totalCount = instance.items?.length || 0
                  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
                  
                  return (
                    <div key={instance.id} className={`${t.surface} rounded-lg ${t.border} border overflow-hidden`}>
                      <div className={`p-4 ${t.border} border-b flex justify-between items-center`}>
                        <div className={`font-bold ${t.text}`}>{instance.staff_checklist_templates?.name}</div>
                        <div className={`font-bold ${progress === 100 ? 'text-green-500' : 'text-orange-500'}`}>{completedCount}/{totalCount}</div>
                      </div>
                      <div className="w-full bg-gray-700 h-2">
                        <div className={`${progress === 100 ? 'bg-green-500' : 'bg-blue-500'} h-2 transition-all`} style={{ width: `${progress}%` }} />
                      </div>
                      <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                        {instance.items?.map((item, i) => (
                          <label key={i} className={`flex items-center gap-3 p-2 rounded ${t.surfaceHover} cursor-pointer`}>
                            <input type="checkbox" checked={item.completed} onChange={() => toggleInstanceItem(instance, i)} className="w-5 h-5" />
                            <span className={`${item.completed ? 'line-through text-gray-500' : t.text}`}>{item.text}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <h3 className={`font-bold ${t.text} mb-4`}>Scheduled Templates</h3>
            <div className="space-y-2">
              {schedules.map(schedule => {
                const template = templates.find(t => t.id === schedule.template_id)
                const alreadyCreated = todayChecklists.some(tc => tc.schedule_id === schedule.id)
                return (
                  <div key={schedule.id} className={`${t.surface} rounded-lg p-4 ${t.border} border flex justify-between items-center`}>
                    <div>
                      <div className={`font-medium ${t.text}`}>{template?.name || 'Unknown'}</div>
                      <div className={`text-xs ${t.textSecondary}`}>Due: {schedule.time_due}</div>
                    </div>
                    {alreadyCreated ? (
                      <span className="text-green-500 text-sm">✓ Created</span>
                    ) : (
                      <button onClick={() => createTodayInstance(schedule)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">Start</button>
                    )}
                  </div>
                )
              })}
              {schedules.length === 0 && <div className={`text-center py-8 ${t.textSecondary}`}>No schedules set up yet.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-3 gap-4">
          {templates.map(template => (
            <div key={template.id} className={`${t.surface} rounded-lg ${t.border} border overflow-hidden`}>
              <div className={`p-4 ${t.border} border-b flex justify-between`}>
                <div className={`font-bold ${t.text}`}>{template.name}</div>
                <span className={`text-xs ${t.textSecondary}`}>{template.items?.length || 0} items</span>
              </div>
              <div className="p-4 space-y-1 max-h-40 overflow-y-auto">
                {template.items?.slice(0, 5).map((item, i) => (
                  <div key={i} className={`text-sm ${t.textSecondary}`}>• {item.text}</div>
                ))}
                {(template.items?.length || 0) > 5 && <div className={`text-xs ${t.textSecondary}`}>+{template.items.length - 5} more...</div>}
              </div>
              <div className={`p-3 ${t.border} border-t flex gap-2`}>
                <button onClick={() => openTemplateForm(template)} className="flex-1 text-blue-500 hover:text-blue-400 text-sm">Edit</button>
                <button onClick={() => deleteTemplate(template.id)} className="flex-1 text-red-500 hover:text-red-400 text-sm">Delete</button>
              </div>
            </div>
          ))}
          {templates.length === 0 && <div className={`col-span-3 text-center py-12 ${t.textSecondary}`}>No templates yet. Click "+ New Template" to create one.</div>}
        </div>
      )}

      {/* Schedules Tab */}
      {activeTab === 'schedules' && (
        <div className={`${t.surface} rounded-lg overflow-hidden ${t.border} border`}>
          <table className="min-w-full">
            <thead className={`${t.border} border-b`}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Checklist</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Frequency</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Due Time</th>
                <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.border}`}>
              {schedules.map(schedule => (
                <tr key={schedule.id} className={t.surfaceHover}>
                  <td className={`px-4 py-3 font-medium ${t.text}`}>{schedule.staff_checklist_templates?.name}</td>
                  <td className={`px-4 py-3 ${t.textSecondary} capitalize`}>{schedule.frequency}</td>
                  <td className={`px-4 py-3 ${t.text}`}>{schedule.time_due}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteSchedule(schedule.id)} className="text-red-500 hover:text-red-400 text-sm">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {schedules.length === 0 && <div className={`text-center py-12 ${t.textSecondary}`}>No schedules yet.</div>}
        </div>
      )}

      {/* Template Form Modal */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border max-h-[90vh] overflow-y-auto`}>
            <div className={`${t.border} border-b p-4 flex justify-between items-center sticky top-0 ${t.surface}`}>
              <h3 className={`text-xl font-bold ${t.text}`}>{selectedTemplate ? 'Edit Template' : 'New Checklist Template'}</h3>
              <button onClick={() => setShowTemplateForm(false)} className="text-red-500 text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Name *</label>
                  <input type="text" value={templateForm.name} onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`} placeholder="e.g., End of Day Checklist" />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Category</label>
                  <select value={templateForm.category} onChange={(e) => setTemplateForm({...templateForm, category: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="opening">Opening</option>
                    <option value="closing">Closing</option>
                    <option value="safety">Safety</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className={`text-sm font-medium ${t.text}`}>Checklist Items</label>
                  <button onClick={aiGenerateChecklist} disabled={aiLoading} className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded">
                    {aiLoading ? '...' : '🤖 AI Generate'}
                  </button>
                </div>
                <div className="flex gap-2 mb-2">
                  <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addItem()}
                    className={`flex-1 px-3 py-2 ${t.input} rounded-lg border`} placeholder="Add new item..." />
                  <button onClick={addItem} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">Add</button>
                </div>
                <div className={`${t.surface} ${t.border} border rounded-lg p-2 max-h-60 overflow-y-auto`}>
                  {templateForm.items.length === 0 ? (
                    <div className={`text-center py-4 ${t.textSecondary}`}>No items yet. Add manually or use AI.</div>
                  ) : (
                    templateForm.items.map((item, i) => (
                      <div key={i} className={`flex items-center justify-between p-2 ${t.surfaceHover} rounded`}>
                        <span className={t.text}>{item.text}</span>
                        <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-400">✕</button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={saveTemplate} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">💾 Save Template</button>
                <button onClick={() => setShowTemplateForm(false)} className={`flex-1 ${t.surface} ${t.text} ${t.border} border py-3 rounded-lg`}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Form Modal */}
      {showScheduleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-lg ${t.border} border`}>
            <div className={`${t.border} border-b p-4 flex justify-between items-center`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Schedule Checklist</h3>
              <button onClick={() => setShowScheduleForm(false)} className="text-red-500 text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Checklist Template *</label>
                <select value={scheduleForm.template_id} onChange={(e) => setScheduleForm({...scheduleForm, template_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}>
                  <option value="">Select template...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Frequency</label>
                <select value={scheduleForm.frequency} onChange={(e) => setScheduleForm({...scheduleForm, frequency: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="specific_days">Specific Days</option>
                </select>
              </div>

              {scheduleForm.frequency === 'specific_days' && (
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-2`}>Days of Week</label>
                  <div className="flex gap-2 flex-wrap">
                    {daysOfWeek.map(day => (
                      <button key={day} onClick={() => toggleDay(day)}
                        className={`px-3 py-1 rounded ${scheduleForm.days_of_week.includes(day) ? 'bg-blue-600 text-white' : `${t.surface} ${t.text} ${t.border} border`}`}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Due Time</label>
                <input type="time" value={scheduleForm.time_due} onChange={(e) => setScheduleForm({...scheduleForm, time_due: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`} />
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={saveSchedule} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">💾 Save Schedule</button>
                <button onClick={() => setShowScheduleForm(false)} className={`flex-1 ${t.surface} ${t.text} ${t.border} border py-3 rounded-lg`}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
