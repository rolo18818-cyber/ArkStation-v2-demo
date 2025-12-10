import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'

// Import all components
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import RealtimeMonitor from './components/RealtimeMonitor'
import Analytics from './components/Analytics'
import POS from './components/POS'
import TimeClock from './components/TimeClock'
import Schedule from './components/Schedule'
import WorkOrders from './components/WorkOrders'
import EnhancedWorkOrder from './components/EnhancedWorkOrder'
import MechanicJobView from './components/MechanicJobView'
import MechanicMobile from './components/MechanicMobile'
import WaitingOnParts from './components/WaitingOnParts'
import CustomerPartsOrders from './components/CustomerPartsOrders'
import CustomerRequests from './components/CustomerRequests'
import JobTemplates from './components/JobTemplates'
import Parts from './components/Parts'
import Inventory from './components/Inventory'
import InventoryEnhancements from './components/InventoryEnhancements'
import Consumables from './components/Consumables'
import PartOrders from './components/PartOrders'
import BikeStock from './components/BikeStock'
import Customers from './components/Customers'
import Vehicles from './components/Vehicles'
import Reminders from './components/Reminders'
import Invoices from './components/Invoices'
import Financial from './components/Financial'
import Reports from './components/Reports'
import Accounting from './components/Accounting'
import GeneralLedger from './components/GeneralLedger'
import StaffChecklists from './components/StaffChecklists'
import Mechanics from './components/Mechanics'
import Users from './components/Users'
import ActivityLog from './components/ActivityLog'
import Settings from './components/Settings'
import AIGuide from './components/AIGuide'
import WorkshopCapacity from './components/WorkshopCapacity'
import VehicleServiceTimeline from './components/VehicleServiceTimeline'
import StaffSkillsMatrix from './components/StaffSkillsMatrix'
import ReworkTracking from './components/ReworkTracking'
import TestDataGenerator from './components/TestDataGenerator'

// Theme configurations
const themes = {
  midnight: {
    bg: 'bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900',
    surface: 'bg-gray-800',
    surfaceHover: 'hover:bg-gray-700',
    border: 'border-gray-700',
    text: 'text-gray-100',
    textSecondary: 'text-gray-400',
    input: 'bg-gray-700 text-gray-100 border-gray-600'
  },
  carbon: {
    bg: 'bg-gradient-to-br from-black via-gray-900 to-black',
    surface: 'bg-gray-900',
    surfaceHover: 'hover:bg-gray-800',
    border: 'border-gray-800',
    text: 'text-gray-100',
    textSecondary: 'text-gray-500',
    input: 'bg-gray-800 text-gray-100 border-gray-700'
  },
  industrial: {
    bg: 'bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900',
    surface: 'bg-slate-800',
    surfaceHover: 'hover:bg-slate-700',
    border: 'border-slate-700',
    text: 'text-slate-100',
    textSecondary: 'text-slate-400',
    input: 'bg-slate-700 text-slate-100 border-slate-600'
  },
  light: {
    bg: 'bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50',
    surface: 'bg-white',
    surfaceHover: 'hover:bg-gray-50',
    border: 'border-gray-300',
    text: 'text-gray-900',
    textSecondary: 'text-gray-600',
    input: 'bg-white text-gray-900 border-gray-300'
  }
}

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [currentTheme, setCurrentTheme] = useState('midnight')
  const [isMobileView, setIsMobileView] = useState(false)
  const [highlightedPage, setHighlightedPage] = useState(null)
  const navRefs = useRef({})

  useEffect(() => {
    const savedTheme = localStorage.getItem('arkTheme')
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme)
    }
  }, [])

  // Function to highlight a nav item (called by AI Guide)
  const highlightNav = (pageId) => {
    setHighlightedPage(pageId)
    if (navRefs.current[pageId]) {
      navRefs.current[pageId].scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setTimeout(() => setHighlightedPage(null), 3000)
  }

  useEffect(() => {
    window.highlightNavItem = highlightNav
  }, [])

  const handleLogin = (user) => {
    setCurrentUser(user)
    if (user.role === 'mechanic') {
      setCurrentPage('myjobs')
    } else {
      setCurrentPage('dashboard')
    }
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setCurrentPage('dashboard')
    setIsMobileView(false)
  }

  const changeTheme = (theme) => {
    setCurrentTheme(theme)
    localStorage.setItem('arkTheme', theme)
  }

  const t = themes[currentTheme]

  if (!currentUser) {
    return <Login onLogin={handleLogin} theme={t} />
  }

  // Navigation items - flat list for better space usage
  const getNavItems = () => {
    const role = currentUser.role
    return [
      { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['owner', 'manager', 'mechanic', 'parts', 'front_desk'] },
      { id: 'divider1', type: 'divider', label: 'JOBS' },
      { id: 'myjobs', label: 'My Jobs', icon: '👨‍🔧', roles: ['mechanic'] },
      { id: 'requests', label: 'Requests', icon: '📞', roles: ['owner', 'manager', 'front_desk'] },
      { id: 'workorders', label: 'Work Orders', icon: '🔧', roles: ['owner', 'manager', 'mechanic', 'front_desk', 'parts'] },
      { id: 'schedule', label: 'Schedule', icon: '📅', roles: ['owner', 'manager', 'front_desk', 'mechanic'] },
      { id: 'waiting', label: 'Waiting Parts', icon: '⏳', roles: ['owner', 'manager', 'mechanic', 'parts'] },
      { id: 'divider2', type: 'divider', label: 'PARTS & INVENTORY' },
      { id: 'parts', label: 'Parts', icon: '🔩', roles: ['owner', 'manager', 'mechanic', 'parts'] },
      { id: 'customerparts', label: 'Customer Orders', icon: '📦', roles: ['owner', 'manager', 'parts', 'front_desk'] },
      { id: 'inventory', label: 'Inventory', icon: '📦', roles: ['owner', 'manager', 'parts'] },
      { id: 'orders', label: 'Part Orders', icon: '📮', roles: ['owner', 'manager', 'parts'] },
      { id: 'bikestock', label: 'Bike Stock', icon: '🏍️', roles: ['owner', 'manager', 'front_desk'] },
      { id: 'divider3', type: 'divider', label: 'CUSTOMERS' },
      { id: 'customers', label: 'Customers', icon: '👥', roles: ['owner', 'manager', 'front_desk'] },
      { id: 'vehicles', label: 'Vehicles', icon: '🏍️', roles: ['owner', 'manager', 'mechanic', 'front_desk'] },
      { id: 'reminders', label: 'Reminders', icon: '🔔', roles: ['owner', 'manager', 'front_desk'] },
      { id: 'divider4', type: 'divider', label: 'FINANCIAL' },
      { id: 'pos', label: 'POS', icon: '💰', roles: ['owner', 'manager', 'front_desk'] },
      { id: 'invoices', label: 'Invoices', icon: '🧾', roles: ['owner', 'manager', 'front_desk'] },
      { id: 'accounting', label: 'Accounting', icon: '💼', roles: ['owner'] },
      { id: 'ledger', label: 'General Ledger', icon: '📒', roles: ['owner'] },
      { id: 'divider5', type: 'divider', label: 'REPORTS & TOOLS' },
      { id: 'analytics', label: 'Analytics', icon: '📈', roles: ['owner', 'manager'] },
      { id: 'reports', label: 'Reports', icon: '📊', roles: ['owner', 'manager'] },
      { id: 'staffchecklists', label: 'Staff Checklists', icon: '✅', roles: ['owner', 'manager'] },
      { id: 'divider6', type: 'divider', label: 'SYSTEM' },
      { id: 'users', label: 'Users', icon: '👤', roles: ['owner', 'admin'] },
      { id: 'mechanics', label: 'Mechanics', icon: '👨‍🔧', roles: ['owner', 'manager'] },
      { id: 'timeclock', label: 'Time Clock', icon: '⏰', roles: ['owner', 'manager', 'mechanic', 'parts', 'front_desk'] },
      { id: 'settings', label: 'Settings', icon: '⚙️', roles: ['owner', 'manager', 'mechanic', 'parts', 'front_desk'] },
    ].filter(item => item.type === 'divider' || item.roles?.includes(role))
  }

  const navItems = getNavItems()

  // Mobile view for mechanics
  if (isMobileView && currentUser.role === 'mechanic') {
    return <MechanicMobile theme={t} currentUser={currentUser} />
  }

  return (
    <div className={`h-screen ${t.bg} flex overflow-hidden`}>
      {/* Sidebar - Fixed height, internal scroll */}
      <div className={`w-56 ${t.surface} ${t.border} border-r flex flex-col h-screen`}>
        {/* Logo - Fixed */}
        <div className={`p-4 ${t.border} border-b flex-shrink-0`}>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            Ark Station
          </h1>
          <p className={`text-xs ${t.textSecondary}`}>{currentUser.first_name} • {currentUser.role}</p>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'thin' }}>
          {navItems.map((item) => {
            if (item.type === 'divider') {
              return (
                <div key={item.id} className={`px-2 py-1 mt-2 text-xs font-bold ${t.textSecondary} uppercase`}>
                  {item.label}
                </div>
              )
            }
            return (
              <button
                key={item.id}
                ref={(el) => navRefs.current[item.id] = el}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                  currentPage === item.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : highlightedPage === item.id
                    ? 'bg-yellow-500 text-black font-semibold animate-pulse'
                    : `${t.text} ${t.surfaceHover}`
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Bottom Controls - Fixed */}
        <div className={`p-3 ${t.border} border-t flex-shrink-0 space-y-2`}>
          <select
            value={currentTheme}
            onChange={(e) => changeTheme(e.target.value)}
            className={`w-full px-2 py-1 ${t.input} rounded border text-xs`}
          >
            <option value="midnight">🌙 Midnight</option>
            <option value="carbon">⚫ Carbon</option>
            <option value="industrial">🌊 Industrial</option>
            <option value="light">☀️ Light</option>
          </select>

          {currentUser.role === 'mechanic' && (
            <button
              onClick={() => setIsMobileView(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-medium text-xs"
            >
              📱 Mobile View
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-medium text-xs"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content - Fills remaining space */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
        <div className="p-6">
          {currentPage === 'dashboard' && <Dashboard theme={t} currentUser={currentUser} />}
          {currentPage === 'realtime' && <RealtimeMonitor theme={t} />}
          {currentPage === 'analytics' && <Analytics theme={t} />}
          {currentPage === 'pos' && <POS theme={t} currentUser={currentUser} />}
          {currentPage === 'timeclock' && <TimeClock theme={t} currentUser={currentUser} />}
          {currentPage === 'schedule' && <Schedule theme={t} currentUser={currentUser} />}
          {currentPage === 'workorders' && <WorkOrders theme={t} currentUser={currentUser} />}
          {currentPage === 'myjobs' && <MechanicJobView theme={t} currentUser={currentUser} />}
          {currentPage === 'requests' && <CustomerRequests theme={t} currentUser={currentUser} />}
          {currentPage === 'waiting' && <WaitingOnParts theme={t} />}
          {currentPage === 'customerparts' && <CustomerPartsOrders theme={t} currentUser={currentUser} />}
          {currentPage === 'templates' && <JobTemplates theme={t} />}
          {currentPage === 'parts' && <Parts theme={t} />}
          {currentPage === 'inventory' && <Inventory theme={t} />}
          {currentPage === 'inventory_plus' && <InventoryEnhancements theme={t} />}
          {currentPage === 'consumables' && <Consumables theme={t} />}
          {currentPage === 'orders' && <PartOrders theme={t} currentUser={currentUser} />}
          {currentPage === 'bikestock' && <BikeStock theme={t} />}
          {currentPage === 'customers' && <Customers theme={t} />}
          {currentPage === 'vehicles' && <Vehicles theme={t} />}
          {currentPage === 'reminders' && <Reminders theme={t} currentUser={currentUser} />}
          {currentPage === 'invoices' && <Invoices theme={t} />}
          {currentPage === 'financial' && <Financial theme={t} />}
          {currentPage === 'reports' && <Reports theme={t} />}
          {currentPage === 'accounting' && <Accounting theme={t} />}
          {currentPage === 'ledger' && <GeneralLedger theme={t} currentUser={currentUser} />}
          {currentPage === 'staffchecklists' && <StaffChecklists theme={t} currentUser={currentUser} />}
          {currentPage === 'mechanics' && <Mechanics theme={t} />}
          {currentPage === 'users' && <Users theme={t} />}
          {currentPage === 'capacity' && <WorkshopCapacity theme={t} />}
          {currentPage === 'timeline' && <VehicleServiceTimeline theme={t} />}
          {currentPage === 'skills' && <StaffSkillsMatrix theme={t} />}
          {currentPage === 'rework' && <ReworkTracking theme={t} currentUser={currentUser} />}
          {currentPage === 'testdata' && <TestDataGenerator theme={t} />}
          {currentPage === 'activity' && <ActivityLog theme={t} />}
          {currentPage === 'settings' && <Settings theme={t} currentUser={currentUser} />}
        </div>

        {/* AI Guide */}
        <AIGuide 
          theme={t} 
          currentPage={currentPage} 
          currentUser={currentUser}
          onNavigate={(page) => { setCurrentPage(page); highlightNav(page) }}
        />
      </div>

      {/* Scrollbar Styles */}
      <style>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.5); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.7); }
      `}</style>
    </div>
  )
}

export default App
