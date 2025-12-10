import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function NotificationCenter({ theme: t, currentUser }) {
  const [templates, setTemplates] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [customers, setCustomers] = useState([])
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [templateForm, setTemplateForm] = useState({
    name: '',
    type: 'sms',
    trigger: 'manual',
    subject: '',
    body: ''
  })
  const [sendForm, setSendForm] = useState({
    template_id: '',
    customer_id: '',
    channel: 'sms',
    custom_message: ''
  })

  useEffect(() => {
    loadTemplates()
    loadNotifications()
    loadCustomers()
  }, [])

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('notification_templates')
      .select('*')
      .order('name')
    if (data) setTemplates(data)
  }

  const loadNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select(`*, customers(first_name, last_name, phone, email)`)
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setNotifications(data)
  }

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('last_name')
    if (data) setCustomers(data)
  }

  const openNewTemplate = () => {
    setEditingTemplate(null)
    setTemplateForm({ name: '', type: 'sms', trigger: 'manual', subject: '', body: '' })
    setShowTemplateModal(true)
  }

  const openEditTemplate = (template) => {
    setEditingTemplate(template)
    setTemplateForm({
      name: template.name,
      type: template.type,
      trigger: template.trigger,
      subject: template.subject || '',
      body: template.body
    })
    setShowTemplateModal(true)
  }

  const saveTemplate = async () => {
    if (!templateForm.name || !templateForm.body) {
      alert('Please fill in name and message body')
      return
    }

    if (editingTemplate) {
      await supabase
        .from('notification_templates')
        .update(templateForm)
        .eq('id', editingTemplate.id)
    } else {
      await supabase.from('notification_templates').insert([templateForm])
    }

    alert('✓ Template saved!')
    setShowTemplateModal(false)
    loadTemplates()
  }

  const deleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return
    await supabase.from('notification_templates').delete().eq('id', id)
    loadTemplates()
  }

  const openSendModal = (template = null) => {
    setSendForm({
      template_id: template?.id || '',
      customer_id: '',
      channel: template?.type || 'sms',
      custom_message: template?.body || ''
    })
    setShowSendModal(true)
  }

  const sendNotification = async () => {
    if (!sendForm.customer_id) {
      alert('Please select a customer')
      return
    }

    const customer = customers.find(c => c.id === sendForm.customer_id)
    const template = templates.find(t => t.id === sendForm.template_id)

    // Replace placeholders in message
    let message = sendForm.custom_message
    message = message.replace(/\{first_name\}/g, customer.first_name || '')
    message = message.replace(/\{last_name\}/g, customer.last_name || '')
    message = message.replace(/\{phone\}/g, customer.phone || '')

    try {
      // Create notification record
      await supabase.from('notifications').insert([{
        customer_id: sendForm.customer_id,
        template_id: sendForm.template_id || null,
        channel: sendForm.channel,
        recipient: sendForm.channel === 'sms' ? customer.phone : customer.email,
        subject: template?.subject || null,
        message: message,
        status: 'pending'
      }])

      // In a real app, this would call an SMS/Email API
      // For now, we'll just mark it as sent after a delay
      setTimeout(async () => {
        // Update status to sent (simulated)
        const { data } = await supabase
          .from('notifications')
          .select('id')
          .eq('customer_id', sendForm.customer_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (data) {
          await supabase
            .from('notifications')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', data.id)
        }
        loadNotifications()
      }, 1000)

      alert(`✓ ${sendForm.channel.toUpperCase()} notification queued!`)
      setShowSendModal(false)
      loadNotifications()
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500',
      sent: 'bg-green-500',
      delivered: 'bg-blue-500',
      failed: 'bg-red-500'
    }
    return <span className={`px-2 py-1 text-xs font-bold rounded ${styles[status] || 'bg-gray-500'} text-white`}>{status?.toUpperCase()}</span>
  }

  const getTriggerBadge = (trigger) => {
    const styles = {
      manual: 'bg-gray-500',
      job_complete: 'bg-green-500',
      reminder_due: 'bg-blue-500',
      invoice_sent: 'bg-purple-500',
      quote_sent: 'bg-orange-500'
    }
    return <span className={`px-2 py-1 text-xs rounded ${styles[trigger] || 'bg-gray-500'} text-white`}>{trigger?.replace('_', ' ').toUpperCase()}</span>
  }

  // Placeholder tags
  const placeholders = [
    { tag: '{first_name}', desc: 'Customer first name' },
    { tag: '{last_name}', desc: 'Customer last name' },
    { tag: '{phone}', desc: 'Customer phone' },
    { tag: '{job_number}', desc: 'Work order number' },
    { tag: '{vehicle}', desc: 'Vehicle make/model' },
    { tag: '{total}', desc: 'Invoice total' },
    { tag: '{due_date}', desc: 'Payment due date' },
    { tag: '{shop_name}', desc: 'Your shop name' }
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>📬 Notification Center</h2>
        <div className="flex gap-3">
          <button
            onClick={() => openSendModal()}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            📤 Send Message
          </button>
          <button
            onClick={openNewTemplate}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            + New Template
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-blue-500">{templates.length}</div>
          <div className={t.textSecondary}>Templates</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-green-500">
            {notifications.filter(n => n.status === 'sent').length}
          </div>
          <div className={t.textSecondary}>Sent Today</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-yellow-500">
            {notifications.filter(n => n.status === 'pending').length}
          </div>
          <div className={t.textSecondary}>Pending</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-red-500">
            {notifications.filter(n => n.status === 'failed').length}
          </div>
          <div className={t.textSecondary}>Failed</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Templates */}
        <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
          <div className={`${t.surface} ${t.border} border-b p-4`}>
            <h3 className={`text-lg font-bold ${t.text}`}>📝 Message Templates</h3>
          </div>
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {templates.map(template => (
              <div key={template.id} className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className={`font-bold ${t.text}`}>{template.name}</div>
                    <div className="flex gap-2 mt-1">
                      <span className={`px-2 py-0.5 text-xs rounded ${template.type === 'sms' ? 'bg-green-600' : 'bg-blue-600'} text-white`}>
                        {template.type?.toUpperCase()}
                      </span>
                      {getTriggerBadge(template.trigger)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openSendModal(template)}
                      className="text-green-500 hover:text-green-700 text-sm font-medium"
                    >
                      Send
                    </button>
                    <button
                      onClick={() => openEditTemplate(template)}
                      className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className={`text-sm ${t.textSecondary} truncate`}>{template.body}</div>
              </div>
            ))}
            {templates.length === 0 && (
              <div className={`text-center py-8 ${t.textSecondary}`}>
                No templates yet. Create your first one!
              </div>
            )}
          </div>
        </div>

        {/* Recent Notifications */}
        <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
          <div className={`${t.surface} ${t.border} border-b p-4`}>
            <h3 className={`text-lg font-bold ${t.text}`}>📤 Recent Notifications</h3>
          </div>
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {notifications.slice(0, 20).map(notif => (
              <div key={notif.id} className={`${t.surface} ${t.border} border rounded-lg p-3`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`font-medium ${t.text}`}>
                      {notif.customers?.first_name} {notif.customers?.last_name}
                    </div>
                    <div className={`text-xs ${t.textSecondary}`}>{notif.recipient}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded ${notif.channel === 'sms' ? 'bg-green-600' : 'bg-blue-600'} text-white`}>
                      {notif.channel?.toUpperCase()}
                    </span>
                    {getStatusBadge(notif.status)}
                  </div>
                </div>
                <div className={`text-sm ${t.textSecondary} mt-2 truncate`}>{notif.message}</div>
                <div className={`text-xs ${t.textSecondary} mt-1`}>
                  {new Date(notif.created_at).toLocaleString()}
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <div className={`text-center py-8 ${t.textSecondary}`}>
                No notifications sent yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h3>
              <button onClick={() => setShowTemplateModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Template Name *</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="e.g., Service Reminder"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Type</label>
                  <select
                    value={templateForm.type}
                    onChange={(e) => setTemplateForm({ ...templateForm, type: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  >
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Trigger</label>
                <select
                  value={templateForm.trigger}
                  onChange={(e) => setTemplateForm({ ...templateForm, trigger: e.target.value })}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                >
                  <option value="manual">Manual Send</option>
                  <option value="job_complete">Job Complete</option>
                  <option value="reminder_due">Service Reminder Due</option>
                  <option value="invoice_sent">Invoice Sent</option>
                  <option value="quote_sent">Quote Sent</option>
                </select>
              </div>
              {templateForm.type === 'email' && (
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Subject</label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="Email subject line..."
                  />
                </div>
              )}
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Message Body *</label>
                <textarea
                  value={templateForm.body}
                  onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                  rows="5"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Hi {first_name}, your vehicle is ready for pickup..."
                />
              </div>
              <div className={`${t.surface} ${t.border} border rounded p-3`}>
                <div className={`text-sm font-bold ${t.text} mb-2`}>Available Placeholders:</div>
                <div className="flex flex-wrap gap-2">
                  {placeholders.map(p => (
                    <button
                      key={p.tag}
                      onClick={() => setTemplateForm({ ...templateForm, body: templateForm.body + p.tag })}
                      className={`px-2 py-1 text-xs ${t.surface} ${t.border} border rounded hover:bg-blue-600 hover:text-white`}
                      title={p.desc}
                    >
                      {p.tag}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={saveTemplate}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold"
              >
                ✓ Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-lg ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Send Notification</h3>
              <button onClick={() => setShowSendModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Customer *</label>
                <select
                  value={sendForm.customer_id}
                  onChange={(e) => setSendForm({ ...sendForm, customer_id: e.target.value })}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} - {c.phone || c.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Channel</label>
                  <select
                    value={sendForm.channel}
                    onChange={(e) => setSendForm({ ...sendForm, channel: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  >
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Template</label>
                  <select
                    value={sendForm.template_id}
                    onChange={(e) => {
                      const tmpl = templates.find(t => t.id === e.target.value)
                      setSendForm({
                        ...sendForm,
                        template_id: e.target.value,
                        custom_message: tmpl?.body || sendForm.custom_message
                      })
                    }}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  >
                    <option value="">Custom message</option>
                    {templates.filter(t => t.type === sendForm.channel).map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Message</label>
                <textarea
                  value={sendForm.custom_message}
                  onChange={(e) => setSendForm({ ...sendForm, custom_message: e.target.value })}
                  rows="4"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                />
              </div>
              <button
                onClick={sendNotification}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold"
              >
                📤 Send {sendForm.channel.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
