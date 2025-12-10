import { useState, useEffect, useRef } from 'react'

export default function AIGuide({ theme: t, currentPage, currentUser, onNavigate }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const pageDescriptions = {
    dashboard: 'Main dashboard',
    myjobs: 'My assigned jobs',
    requests: 'Customer requests',
    workorders: 'Work orders',
    schedule: 'Workshop schedule',
    waiting: 'Waiting on parts',
    parts: 'Parts catalog',
    inventory: 'Inventory',
    customers: 'Customers',
    vehicles: 'Vehicles',
    pos: 'Point of Sale',
    invoices: 'Invoices',
    accounting: 'Accounting',
    ledger: 'General Ledger',
    mechanics: 'Mechanics',
    users: 'User management',
    timeclock: 'Time clock',
    settings: 'Settings'
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Navigate function - close panel and go to page
  const goToPage = (pageId) => {
    console.log('AIGuide navigating to:', pageId)
    setIsOpen(false)
    if (onNavigate && typeof onNavigate === 'function') {
      onNavigate(pageId)
    }
  }

  const quickActions = [
    { label: '📋 New Job', page: 'workorders' },
    { label: '📞 Log Request', page: 'requests' },
    { label: '📅 Schedule', page: 'schedule' },
    { label: '💰 POS', page: 'pos' },
  ]

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    // Simple keyword matching for navigation
    const lower = userMessage.toLowerCase()
    let suggestedPage = null
    let response = ''

    if (lower.includes('job') || lower.includes('work order')) {
      suggestedPage = 'workorders'
      response = 'I can help you with work orders. Would you like to go there?'
    } else if (lower.includes('schedule') || lower.includes('calendar')) {
      suggestedPage = 'schedule'
      response = 'The Schedule page shows your workshop calendar.'
    } else if (lower.includes('customer')) {
      suggestedPage = 'customers'
      response = 'You can manage customers in the Customers page.'
    } else if (lower.includes('invoice') || lower.includes('bill')) {
      suggestedPage = 'invoices'
      response = 'Invoices are managed in the Invoices page.'
    } else if (lower.includes('part') || lower.includes('inventory')) {
      suggestedPage = 'inventory'
      response = 'Check the Inventory page for parts and stock.'
    } else if (lower.includes('mechanic') || lower.includes('staff')) {
      suggestedPage = 'mechanics'
      response = 'Manage your mechanics in the Mechanics page.'
    } else if (lower.includes('time') || lower.includes('clock')) {
      suggestedPage = 'timeclock'
      response = 'The Time Clock page handles clock in/out and timesheets.'
    } else if (lower.includes('accounting') || lower.includes('finance') || lower.includes('money')) {
      suggestedPage = 'accounting'
      response = 'Financial information is in the Accounting section.'
    } else if (lower.includes('user')) {
      suggestedPage = 'users'
      response = 'User accounts are managed in the Users page under System.'
    } else {
      response = 'I can help you navigate Ark Station. Try asking about jobs, schedule, customers, invoices, inventory, or mechanics.'
    }

    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: response,
      suggestedPage
    }])
    setIsLoading(false)
  }

  // Collapsed state - just the floating button
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50">
        {/* Quick action buttons */}
        <div className="flex gap-2">
          {quickActions.map(action => (
            <button
              key={action.page}
              onClick={() => goToPage(action.page)}
              className={`${t.surface} ${t.text} ${t.border} border px-4 py-2 rounded-full text-sm font-medium shadow-lg hover:scale-105 transition-all hover:bg-blue-600 hover:text-white hover:border-blue-600`}
            >
              {action.label}
            </button>
          ))}
        </div>
        
        {/* AI button */}
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full shadow-lg flex items-center justify-center text-white text-2xl hover:scale-110 transition-transform"
          title="AI Assistant"
        >
          🤖
        </button>
      </div>
    )
  }

  // Open state - chat panel
  return (
    <div className="fixed bottom-6 right-6 w-80 z-50">
      <div className={`${t.surface} rounded-xl shadow-2xl ${t.border} border-2 overflow-hidden`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <span className="text-white font-bold">AI Assistant</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white hover:bg-white/20 px-2 py-1 rounded text-lg">
            ✕
          </button>
        </div>

        {/* Quick Nav */}
        <div className={`p-2 ${t.border} border-b flex gap-1 flex-wrap`}>
          {quickActions.map(action => (
            <button
              key={action.page}
              onClick={() => goToPage(action.page)}
              className={`text-xs px-2 py-1 rounded font-medium ${
                currentPage === action.page 
                  ? 'bg-blue-600 text-white' 
                  : `${t.surface} ${t.text} ${t.border} border hover:bg-blue-600 hover:text-white`
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="h-48 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && (
            <div className={`text-center ${t.textSecondary} text-sm py-4`}>
              <div className="text-2xl mb-2">👋</div>
              <div>Hi! Ask me anything about Ark Station.</div>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block max-w-[90%] ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : `${t.surface} ${t.text} ${t.border} border`
              } rounded-lg px-3 py-2 text-sm`}>
                {msg.content}
                {msg.suggestedPage && (
                  <button
                    onClick={() => goToPage(msg.suggestedPage)}
                    className="mt-2 block w-full bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs font-medium"
                  >
                    🔗 Go to {pageDescriptions[msg.suggestedPage] || msg.suggestedPage}
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className={`${t.surface} ${t.border} border rounded-lg px-3 py-2 inline-block`}>
              <span className="animate-pulse">...</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={`p-2 ${t.border} border-t flex gap-2`}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask me anything..."
            className={`flex-1 px-3 py-2 ${t.input} rounded-lg border text-sm`}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
