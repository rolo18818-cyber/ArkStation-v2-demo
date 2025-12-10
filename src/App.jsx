import { useState, useEffect } from 'react'
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
import WaitingOnParts from './components/WaitingOnParts'
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
import Mechanics from './components/Mechanics'
import ActivityLog from './components/ActivityLog'
import Settings from './components/Settings'
import MobileView from './components/MobileView'
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
  const [collapsedGroups, setCollapsedGroups] = useState({})

  useEffect(() => {
    const savedTheme = localStorage.getItem('arkTheme')
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme)
    }
  }, [])

  const handleLogin = (user) => {
    setCurrentUser(user)
    // Auto-navigate mechanics to their job view
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

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }))
  }

  // Get theme object BEFORE the login check
  const t = themes[currentTheme]

  // Login screen - now has access to theme
  if (!currentUser) {
    return <Login onLogin={handleLogin} theme={t} />
  }

  // Grouped navigation items
  const getNavigationGroups = () => {
    const role = currentUser.role

    const groups = [
      {
        id: 'core',
        label: 'Core',
        icon: '⚡',
        pages: [
          { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['owner', 'manager', 'mechanic', 'parts', 'front_desk'] },
          { id: 'realtime', label: 'Realtime Monitor', icon: '📡', roles: ['owner', 'manager'] },
          { id: 'timeclock', label: 'Time Clock', icon: '⏰', roles: ['owner', 'manager', 'mechanic', 'parts', 'front_desk'] }
        ]
      },
      {
        id: 'jobs',
        label: 'Jobs',
        icon: '🔧',
        pages: [
          { id: 'myjobs', label: '🔧 My Jobs', icon: '👨‍🔧', roles: ['mechanic'] },
          { id: 'workorders', label: 'Work Orders', icon: '🔧', roles: ['owner', 'manager', 'mechanic', 'front_desk'] },
          { id: 'waiting', label: 'Waiting on Parts', icon: '⏳', roles: ['owner', 'manager', 'mechanic', 'parts'] },
          { id: 'templates', label: 'Job Templates', icon: '📋', roles: ['owner', 'manager', 'mechanic'] },
          { id: 'schedule', label: 'Schedule', icon: '📅', roles: ['owner', 'manager', 'front_desk'] }
        ]
      },
      {
        id: 'inventory',
        label: 'Inventory',
        icon: '📦',
        pages: [
          { id: 'parts', label: 'Parts', icon: '🔩', roles: ['owner', 'manager', 'mechanic', 'parts'] },
          { id: 'inventory', label: 'Inventory', icon: '📦', roles: ['owner', 'manager', 'parts'] },
          { id: 'inventory_plus', label: 'Inventory+', icon: '📦', roles: ['owner', 'manager', 'parts'] },
          { id: 'consumables', label: 'Consumables', icon: '🧰', roles: ['owner', 'manager', 'parts'] },
          { id: 'orders', label: 'Part Orders', icon: '📮', roles: ['owner', 'manager', 'parts'] },
          { id: 'bikestock', label: 'Bike Stock', icon: '🏍️', roles: ['owner', 'manager', 'front_desk'] }
        ]
      },
      {
        id: 'customers',
        label: 'Customers',
        icon: '👥',
        pages: [
          { id: 'customers', label: 'Customers', icon: '👥', roles: ['owner', 'manager', 'front_desk'] },
          { id: 'vehicles', label: 'Vehicles', icon: '🚗', roles: ['owner', 'manager', 'mechanic', 'front_desk'] },
          { id: 'reminders', label: 'Reminders', icon: '🔔', roles: ['owner', 'manager', 'front_desk'] },
          { id: 'timeline', label: 'Service Timeline', icon: '🏍️', roles: ['owner', 'manager', 'front_desk'] }
        ]
      },
      {
        id: 'financial',
        label: 'Financial',
        icon: '💰',
        pages: [
          { id: 'pos', label: 'Point of Sale', icon: '💰', roles: ['owner', 'manager', 'front_desk'] },
          { id: 'invoices', label: 'Invoices', icon: '🧾', roles: ['owner', 'manager', 'front_desk'] },
          { id: 'financial', label: 'Financial', icon: '💵', roles: ['owner', 'manager'] },
          { id: 'accounting', label: 'Accounting', icon: '💼', roles: ['owner'] }
        ]
      },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: '📈',
        pages: [
          { id: 'analytics', label: 'Analytics', icon: '📈', roles: ['owner', 'manager'] },
          { id: 'reports', label: 'Reports', icon: '📊', roles: ['owner', 'manager'] }
        ]
      },
      {
        id: 'workshop',
        label: 'Workshop Mgmt',
        icon: '🏗️',
        pages: [
          { id: 'capacity', label: 'Workshop Capacity', icon: '🏗️', roles: ['owner', 'manager'] },
          { id: 'rework', label: 'Rework Tracking', icon: '🔧', roles: ['owner', 'manager'] },
          { id: 'mechanics', label: 'Mechanics', icon: '👨‍🔧', roles: ['owner', 'manager'] },
          { id: 'skills', label: 'Staff Skills', icon: '📚', roles: ['owner', 'manager'] }
        ]
      },
      {
        id: 'system',
        label: 'System',
        icon: '⚙️',
        pages: [
          { id: 'testdata', label: 'Test Data', icon: '🧪', roles: ['owner'] },
          { id: 'activity', label: 'Activity Log', icon: '📝', roles: ['owner', 'manager'] },
          { id: 'settings', label: 'Settings', icon: '⚙️', roles: ['owner', 'manager', 'mechanic', 'parts', 'front_desk'] }
        ]
      }
    ]

    // Filter groups and pages by role
    return groups
      .map(group => ({
        ...group,
        pages: group.pages.filter(page => page.roles.includes(role))
      }))
      .filter(group => group.pages.length > 0)
  }

  const navigationGroups = getNavigationGroups()

  // Mobile view for mechanics
  if (isMobileView && currentUser.role === 'mechanic') {
    return (
      <div className={`min-h-screen ${t.bg}`}>
        <div className="p-4">
          <button
            onClick={() => setIsMobileView(false)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium mb-4">
            ← Back to Desktop View
          </button>
          <MobileView theme={t} currentUser={currentUser} />
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${t.bg} flex`}>
      {/* Sidebar */}
      <div className={`w-64 ${t.surface} ${t.border} border-r flex flex-col`} style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(59, 130, 246, 0.5) rgba(0, 0, 0, 0.1)'
      }}>
        {/* Logo/Header */}
        <div className={`p-6 ${t.border} border-b`}>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            Ark Station
          </h1>
          <p className={`text-xs ${t.textSecondary} mt-1`}>Workshop Management</p>
        </div>

        {/* User Info */}
        <div className={`p-4 ${t.border} border-b`}>
          <div className={`text-sm font-semibold ${t.text}`}>
            {currentUser.first_name} {currentUser.last_name}
          </div>
          <div className={`text-xs ${t.textSecondary} capitalize`}>{currentUser.role.replace('_', ' ')}</div>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 overflow-y-auto p-4" style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(59, 130, 246, 0.5) rgba(0, 0, 0, 0.1)'
        }}>
          <div className="space-y-2">
            {navigationGroups.map(group => (
              <div key={group.id}>
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg font-semibold ${t.text} ${t.surfaceHover} flex items-center justify-between transition-all`}>
                  <span>
                    <span className="mr-2">{group.icon}</span>
                    {group.label}
                  </span>
                  <span className="text-xs transition-transform" style={{
                    transform: collapsedGroups[group.id] ? 'rotate(0deg)' : 'rotate(180deg)'
                  }}>
                    ▼
                  </span>
                </button>
                
                {/* Group Pages */}
                {!collapsedGroups[group.id] && (
                  <div className="ml-3 mt-1 space-y-1">
                    {group.pages.map(item => (
                      <button
                        key={item.id}
                        data-page={item.id}
                        onClick={() => setCurrentPage(item.id)}
                        className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-all ${
                          currentPage === item.id
                            ? 'bg-blue-600 text-white font-semibold'
                            : `${t.text} ${t.surfaceHover}`
                        }`}>
                        <span className="mr-2">{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Theme Selector & Logout */}
        <div className={`p-4 ${t.border} border-t space-y-2`}>
          <div className="relative">
            <select
              value={currentTheme}
              onChange={(e) => changeTheme(e.target.value)}
              className={`w-full px-3 py-2 ${t.input} rounded border text-sm appearance-none cursor-pointer relative z-50`}>
              <option value="midnight">🌙 Midnight</option>
              <option value="carbon">⚫ Carbon</option>
              <option value="industrial">🌊 Industrial</option>
              <option value="light">☀️ Light</option>
            </select>
          </div>

          {currentUser.role === 'mechanic' && (
            <button
              onClick={() => setIsMobileView(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium text-sm">
              📱 Mobile View
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium">
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto" style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(59, 130, 246, 0.5) rgba(0, 0, 0, 0.1)'
      }}>
        <div className="p-8">
          {currentPage === 'dashboard' && <Dashboard theme={t} currentUser={currentUser} />}
          {currentPage === 'realtime' && <RealtimeMonitor theme={t} />}
          {currentPage === 'analytics' && <Analytics theme={t} />}
          {currentPage === 'pos' && <POS theme={t} currentUser={currentUser} />}
          {currentPage === 'timeclock' && <TimeClock theme={t} currentUser={currentUser} />}
          {currentPage === 'schedule' && <Schedule theme={t} currentUser={currentUser} />}
          {currentPage === 'workorders' && <WorkOrders theme={t} currentUser={currentUser} />}
          {currentPage === 'myjobs' && <MechanicJobView theme={t} currentUser={currentUser} />}
          {currentPage === 'waiting' && <WaitingOnParts theme={t} />}
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
          {currentPage === 'mechanics' && <Mechanics theme={t} />}
          {currentPage === 'capacity' && <WorkshopCapacity theme={t} />}
          {currentPage === 'timeline' && <VehicleServiceTimeline theme={t} />}
          {currentPage === 'skills' && <StaffSkillsMatrix theme={t} />}
          {currentPage === 'rework' && <ReworkTracking theme={t} currentUser={currentUser} />}
          {currentPage === 'testdata' && <TestDataGenerator theme={t} />}
          {currentPage === 'activity' && <ActivityLog theme={t} />}
          {currentPage === 'settings' && <Settings theme={t} currentUser={currentUser} />}
        </div>

        {/* AI Guide - Always Available */}
        <AIGuide theme={t} currentPage={currentPage} currentUser={currentUser} />
      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.5);
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.7);
        }
      `}</style>
    </div>
  )
}

export default App
