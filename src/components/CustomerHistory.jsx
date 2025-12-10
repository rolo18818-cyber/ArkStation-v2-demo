import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function CustomerHistory({ theme: t }) {
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerData, setCustomerData] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadCustomers()
  }, [])

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerHistory(selectedCustomer)
    }
  }, [selectedCustomer])

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('last_name')
    if (data) setCustomers(data)
  }

  const loadCustomerHistory = async (customerId) => {
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('*')
      .eq('customer_id', customerId)

    const { data: workOrders } = await supabase
      .from('work_orders')
      .select('*, vehicles(make, model, year), mechanics(first_name, last_name)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    const { data: invoices } = await supabase
      .from('invoices')
      .select('*, work_orders(description)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    const { data: posTransactions } = await supabase
      .from('pos_transactions')
      .select('*, pos_line_items(*)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    const invoiceTotal = invoices?.reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0) || 0
    const posTotal = posTransactions?.reduce((sum, pos) => sum + parseFloat(pos.total_amount), 0) || 0
    const lifetimeValue = invoiceTotal + posTotal

    const totalWorkOrders = workOrders?.length || 0
    const completedWorkOrders = workOrders?.filter(wo => wo.status === 'completed').length || 0
    const activeWorkOrders = workOrders?.filter(wo => ['pending', 'in_progress', 'wait_parts'].includes(wo.status)).length || 0
    const unpaidInvoices = invoices?.filter(inv => !inv.paid).length || 0
    const unpaidAmount = invoices?.filter(inv => !inv.paid).reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0) || 0

    setCustomerData({
      customer,
      vehicles,
      workOrders,
      invoices,
      posTransactions,
      stats: {
        lifetimeValue,
        totalWorkOrders,
        completedWorkOrders,
        activeWorkOrders,
        unpaidInvoices,
        unpaidAmount,
        totalVehicles: vehicles?.length || 0,
        totalPurchases: posTransactions?.length || 0
      }
    })
  }

  const filteredCustomers = customers.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status) => {
    const styles = {
      'pending': 'bg-yellow-500 text-white',
      'in_progress': 'bg-blue-500 text-white',
      'wait_parts': 'bg-orange-500 text-white',
      'completed': 'bg-green-500 text-white'
    }
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status]}`}>
        {status.toUpperCase().replace('_', ' ')}
      </span>
    )
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-4">
        <h2 className={`text-3xl font-bold ${t.text} mb-6`}>Customer History</h2>
        
        <input
          type="text"
          placeholder="🔍 Search customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full px-4 py-3 ${t.input} rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4`}
        />

        <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border overflow-hidden`}>
          <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
            {filteredCustomers.map(customer => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomer(customer.id)}
                className={`w-full p-4 text-left transition-all border-b ${t.border} ${
                  selectedCustomer === customer.id
                    ? `${t.primary} ${t.primaryText}`
                    : `${t.surfaceHover} ${t.text}`
                }`}>
                <div className="font-semibold">{customer.first_name} {customer.last_name}</div>
                <div className={`text-sm ${selectedCustomer === customer.id ? 'text-white opacity-90' : t.textSecondary}`}>
                  {customer.phone}
                </div>
                {customer.email && (
                  <div className={`text-xs ${selectedCustomer === customer.id ? 'text-white opacity-80' : t.textSecondary}`}>
                    {customer.email}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="col-span-8">
        {!customerData ? (
          <div className={`${t.surface} rounded-lg shadow-lg p-12 text-center ${t.border} border`}>
            <div className="text-6xl mb-4">👤</div>
            <div className={`text-xl ${t.textSecondary}`}>Select a customer to view their history</div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-2xl font-bold ${t.text} mb-2`}>
                    {customerData.customer.first_name} {customerData.customer.last_name}
                  </h3>
                  <div className={`${t.textSecondary} space-y-1`}>
                    <div>📞 {customerData.customer.phone}</div>
                    {customerData.customer.email && <div>✉️ {customerData.customer.email}</div>}
                    {customerData.customer.address && <div>📍 {customerData.customer.address}</div>}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm ${t.textSecondary} mb-1`}>Lifetime Value</div>
                  <div className="text-3xl font-bold text-green-500">
                    ${customerData.stats.lifetimeValue.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className={`${t.surface} rounded-lg shadow p-4 ${t.border} border`}>
                <div className={`text-sm ${t.textSecondary}`}>Vehicles</div>
                <div className={`text-2xl font-bold ${t.text}`}>{customerData.stats.totalVehicles}</div>
              </div>
              <div className={`${t.surface} rounded-lg shadow p-4 ${t.border} border`}>
                <div className={`text-sm ${t.textSecondary}`}>Work Orders</div>
                <div className={`text-2xl font-bold ${t.text}`}>{customerData.stats.totalWorkOrders}</div>
                <div className={`text-xs ${t.textSecondary} mt-1`}>
                  {customerData.stats.activeWorkOrders} active
                </div>
              </div>
              <div className={`${t.surface} rounded-lg shadow p-4 ${t.border} border`}>
                <div className={`text-sm ${t.textSecondary}`}>POS Purchases</div>
                <div className={`text-2xl font-bold ${t.text}`}>{customerData.stats.totalPurchases}</div>
              </div>
              <div className={`${t.surface} rounded-lg shadow p-4 ${t.border} border`}>
                <div className={`text-sm ${t.textSecondary}`}>Unpaid</div>
                <div className={`text-2xl font-bold ${customerData.stats.unpaidInvoices > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  ${customerData.stats.unpaidAmount.toFixed(2)}
                </div>
                <div className={`text-xs ${t.textSecondary} mt-1`}>
                  {customerData.stats.unpaidInvoices} invoices
                </div>
              </div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <h4 className={`text-xl font-bold ${t.text} mb-4`}>Vehicles</h4>
              {customerData.vehicles?.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {customerData.vehicles.map(vehicle => (
                    <div key={vehicle.id} className={`${t.surface} ${t.border} border-2 rounded-lg p-3`}>
                      <div className={`font-bold ${t.text}`}>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </div>
                      {vehicle.registration && (
                        <div className={`text-sm ${t.textSecondary}`}>Rego: {vehicle.registration}</div>
                      )}
                      {vehicle.color && (
                        <div className={`text-sm ${t.textSecondary}`}>{vehicle.color}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-center py-4 ${t.textSecondary}`}>No vehicles registered</div>
              )}
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <h4 className={`text-xl font-bold ${t.text} mb-4`}>Work Orders</h4>
              {customerData.workOrders?.length > 0 ? (
                <div className="space-y-3">
                  {customerData.workOrders.map(wo => (
                    <div key={wo.id} className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className={`font-bold ${t.text}`}>{wo.job_number}</div>
                          <div className={`text-sm ${t.textSecondary}`}>
                            {new Date(wo.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        {getStatusBadge(wo.status)}
                      </div>
                      <div className={`text-sm ${t.text} mb-2`}>{wo.description}</div>
                      {wo.vehicles && (
                        <div className={`text-xs ${t.textSecondary} mb-1`}>
                          {wo.vehicles.year} {wo.vehicles.make} {wo.vehicles.model}
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-2">
                        {wo.mechanics && (
                          <div className={`text-xs ${t.textSecondary}`}>
                            Mechanic: {wo.mechanics.first_name} {wo.mechanics.last_name}
                          </div>
                        )}
                        {wo.estimated_cost && (
                          <div className={`text-sm font-bold ${t.text}`}>
                            ${wo.estimated_cost.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-center py-4 ${t.textSecondary}`}>No work orders yet</div>
              )}
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <h4 className={`text-xl font-bold ${t.text} mb-4`}>Invoices</h4>
              {customerData.invoices?.length > 0 ? (
                <div className="space-y-2">
                  {customerData.invoices.map(inv => (
                    <div key={inv.id} className={`flex justify-between items-center p-3 ${t.surface} ${t.border} border rounded`}>
                      <div>
                        <div className={`font-semibold ${t.text}`}>{inv.invoice_number}</div>
                        <div className={`text-xs ${t.textSecondary}`}>
                          {new Date(inv.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold ${t.text}`}>${inv.total_amount.toFixed(2)}</div>
                        <span className={`text-xs px-2 py-1 rounded ${inv.paid ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                          {inv.paid ? 'PAID' : 'UNPAID'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-center py-4 ${t.textSecondary}`}>No invoices yet</div>
              )}
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <h4 className={`text-xl font-bold ${t.text} mb-4`}>POS Purchases</h4>
              {customerData.posTransactions?.length > 0 ? (
                <div className="space-y-2">
                  {customerData.posTransactions.map(trans => (
                    <div key={trans.id} className={`p-3 ${t.surface} ${t.border} border rounded`}>
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <div className={`font-semibold ${t.text}`}>{trans.transaction_number}</div>
                          <div className={`text-xs ${t.textSecondary}`}>
                            {new Date(trans.created_at).toLocaleDateString()} • {trans.payment_method.toUpperCase()}
                          </div>
                        </div>
                        <div className={`font-bold ${t.text}`}>${trans.total_amount.toFixed(2)}</div>
                      </div>
                      <div className={`text-xs ${t.textSecondary}`}>
                        {trans.pos_line_items?.length || 0} items
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-center py-4 ${t.textSecondary}`}>No POS purchases yet</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}