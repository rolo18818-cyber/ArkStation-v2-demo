import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Dashboard() {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeWorkOrders: 0,
    completedToday: 0,
    lowStockParts: 0
  })

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    // Get total customers
    const { count: customerCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })

    // Get active work orders
    const { count: activeOrders } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'in_progress'])

    // Get completed today
    const today = new Date().toISOString().split('T')[0]
    const { count: completedToday } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_date', today)

    // Get low stock parts
    const { data: parts } = await supabase
      .from('parts')
      .select('*')
    
    const lowStock = parts?.filter(p => p.quantity <= p.low_stock_threshold).length || 0

    setStats({
      totalCustomers: customerCount || 0,
      activeWorkOrders: activeOrders || 0,
      completedToday: completedToday || 0,
      lowStockParts: lowStock
    })
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Customers */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Total Customers</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalCustomers}</p>
            </div>
          </div>
        </div>

        {/* Active Work Orders */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Active Orders</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.activeWorkOrders}</p>
            </div>
          </div>
        </div>

        {/* Completed Today */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Completed Today</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.completedToday}</p>
            </div>
          </div>
        </div>

        {/* Low Stock Parts */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-gray-500">Low Stock Alerts</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.lowStockParts}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard