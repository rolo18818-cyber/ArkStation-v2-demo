import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PointOfSale({ theme: t, userRole }) {
  const [parts, setParts] = useState([])
  const [services, setServices] = useState([])
  const [customers, setCustomers] = useState([])
  const [cart, setCart] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')

  useEffect(() => {
    loadParts()
    loadServices()
    loadCustomers()
  }, [])

  const loadParts = async () => {
    const { data } = await supabase
      .from('parts')
      .select('*')
      .gt('quantity', 0)
      .order('name')
    if (data) setParts(data)
  }

  const loadServices = async () => {
    const { data } = await supabase
      .from('service_packages')
      .select('*')
      .order('name')
    if (data) setServices(data)
  }

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('last_name')
    if (data) setCustomers(data)
  }

  const filteredCustomers = customers.filter(c => {
    const search = customerSearch.toLowerCase()
    return (
      c.first_name?.toLowerCase().includes(search) ||
      c.last_name?.toLowerCase().includes(search) ||
      c.company_name?.toLowerCase().includes(search) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search)
    )
  }).slice(0, 10)

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer)
    setCustomerSearch(customer.company_name || `${customer.first_name} ${customer.last_name}`)
    setShowCustomerResults(false)
  }

  const filteredParts = parts.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.part_number?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredServices = services.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const addToCart = (item, type) => {
    const existingItem = cart.find(i => i.id === item.id && i.type === type)
    
    if (existingItem) {
      setCart(cart.map(i =>
        i.id === item.id && i.type === type
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ))
    } else {
      setCart([...cart, {
        ...item,
        type,
        quantity: 1,
        price: type === 'part' ? item.sell_price : item.price
      }])
    }
  }

  const updateQuantity = (itemId, type, newQty) => {
    if (newQty < 1) {
      removeFromCart(itemId, type)
      return
    }
    setCart(cart.map(i =>
      i.id === itemId && i.type === type
        ? { ...i, quantity: newQty }
        : i
    ))
  }

  const removeFromCart = (itemId, type) => {
    setCart(cart.filter(i => !(i.id === itemId && i.type === type)))
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const tax = subtotal * 0.10
  const total = subtotal + tax

  const processCheckout = async () => {
    if (cart.length === 0) {
      alert('Cart is empty')
      return
    }

    if (!selectedCustomer) {
      alert('Please select a customer')
      return
    }

    // Generate invoice number
    const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number')

    // Create invoice
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert([{
        invoice_number: invoiceNumber,
        customer_id: selectedCustomer.id,
        invoice_type: 'retail',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        subtotal,
        tax,
        total,
        payment_status: 'paid',
        amount_paid: total,
        balance_due: 0
      }])
      .select()
      .single()

    if (invoiceError) {
      alert('Error creating invoice: ' + invoiceError.message)
      return
    }

    // Add invoice items
    const items = cart.map(item => ({
      invoice_id: invoiceData.id,
      description: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
      item_type: item.type
    }))

    await supabase.from('invoice_items').insert(items)

    // Record payment
    await supabase.from('invoice_payments').insert([{
      invoice_id: invoiceData.id,
      amount: total,
      payment_method: paymentMethod,
      processed_by: 'Current User' // TODO: Get from auth
    }])

    // Update part quantities
    for (const item of cart.filter(i => i.type === 'part')) {
      await supabase
        .from('parts')
        .update({ quantity: item.quantity - item.quantity })
        .eq('id', item.id)
    }

    // Log activity
    await supabase.from('activity_log').insert([{
      user_email: 'current_user@email.com', // TODO: Get from auth
      action: 'POS Sale Completed',
      entity_type: 'invoice',
      entity_id: invoiceData.id,
      details: { total, items: cart.length }
    }])

    alert(`✓ Sale completed!\nInvoice: ${invoiceNumber}\nTotal: $${total.toFixed(2)}`)
    
    // Reset
    setCart([])
    setSelectedCustomer(null)
    setCustomerSearch('')
    loadParts()
  }

  return (
    <div className="grid grid-cols-3 gap-6 h-[calc(100vh-120px)]">
      {/* Left Side - Products */}
      <div className={`col-span-2 ${t.surface} rounded-lg shadow-lg p-6 ${t.border} border overflow-hidden flex flex-col`}>
        <div className="mb-4">
          <h2 className={`text-2xl font-bold ${t.text} mb-4`}>💰 Point of Sale</h2>
          <input
            type="text"
            placeholder="🔍 Search parts or services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full px-4 py-3 ${t.input} rounded-lg border text-lg`}
          />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {searchTerm.length > 0 ? (
            <>
              {/* Parts Results */}
              {filteredParts.length > 0 && (
                <div className="mb-6">
                  <h3 className={`text-lg font-bold ${t.text} mb-3`}>PARTS</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredParts.map(part => (
                      <div
                        key={part.id}
                        onClick={() => addToCart(part, 'part')}
                        className={`${t.surface} ${t.border} border rounded-lg p-4 cursor-pointer hover:shadow-xl transition-all`}>
                        <div className={`font-semibold ${t.text} mb-1`}>{part.name}</div>
                        <div className={`text-xs ${t.textSecondary} mb-2`}>{part.part_number}</div>
                        <div className="flex justify-between items-center">
                          <span className="text-2xl font-bold text-green-500">${part.sell_price?.toFixed(2)}</span>
                          <span className={`text-xs ${t.textSecondary}`}>Stock: {part.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Services Results */}
              {filteredServices.length > 0 && (
                <div>
                  <h3 className={`text-lg font-bold ${t.text} mb-3`}>SERVICES</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredServices.map(service => (
                      <div
                        key={service.id}
                        onClick={() => addToCart(service, 'service')}
                        className={`${t.surface} ${t.border} border rounded-lg p-4 cursor-pointer hover:shadow-xl transition-all`}>
                        <div className={`font-semibold ${t.text} mb-1`}>{service.name}</div>
                        <div className={`text-xs ${t.textSecondary} mb-2`}>{service.description}</div>
                        <div className="text-2xl font-bold text-blue-500">${service.price?.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className={`text-center py-12 ${t.textSecondary}`}>
              Start typing to search for parts or services
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Cart */}
      <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border flex flex-col`}>
        <h3 className={`text-xl font-bold ${t.text} mb-4`}>CART</h3>

        {/* Customer Search */}
        <div className="mb-4">
          <label className={`block text-sm font-medium ${t.text} mb-2`}>Customer</label>
          <div className="relative">
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                setShowCustomerResults(true)
              }}
              onFocus={() => setShowCustomerResults(true)}
              placeholder="🔍 Search customer..."
              className={`w-full px-3 py-2 ${t.input} rounded border`}
            />
            
            {showCustomerResults && customerSearch.length > 0 && !selectedCustomer && (
              <div className={`absolute z-50 w-full mt-1 ${t.surface} ${t.border} border-2 rounded-lg shadow-2xl max-h-48 overflow-y-auto custom-scrollbar`}>
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map(customer => (
                    <div
                      key={customer.id}
                      onClick={() => selectCustomer(customer)}
                      className={`p-2 cursor-pointer ${t.surfaceHover} border-b ${t.border} last:border-b-0`}>
                      <div className={`font-semibold ${t.text} text-sm`}>
                        {customer.company_name || `${customer.first_name} ${customer.last_name}`}
                      </div>
                      <div className={`text-xs ${t.textSecondary}`}>
                        {customer.phone}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={`p-3 text-center ${t.textSecondary} text-sm`}>
                    No customers found
                  </div>
                )}
              </div>
            )}
          </div>
          
          {selectedCustomer && (
            <div className={`mt-2 p-2 ${t.surface} ${t.border} border rounded flex justify-between items-center`}>
              <div>
                <div className={`font-semibold ${t.text} text-sm`}>
                  {selectedCustomer.company_name || `${selectedCustomer.first_name} ${selectedCustomer.last_name}`}
                </div>
                <div className={`text-xs ${t.textSecondary}`}>{selectedCustomer.phone}</div>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomer(null)
                  setCustomerSearch('')
                }}
                className="text-red-500 hover:text-red-700 font-bold">
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto custom-scrollbar mb-4">
          {cart.length > 0 ? (
            <div className="space-y-2">
              {cart.map((item, index) => (
                <div key={`${item.id}-${item.type}-${index}`} className={`${t.surface} ${t.border} border rounded p-3`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className={`font-semibold ${t.text} text-sm`}>{item.name}</div>
                      <div className={`text-xs ${t.textSecondary}`}>${item.price.toFixed(2)} each</div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id, item.type)}
                      className="text-red-500 hover:text-red-700 font-bold ml-2">
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.type, item.quantity - 1)}
                        className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-bold">
                        −
                      </button>
                      <span className={`font-bold ${t.text}`}>{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.type, item.quantity + 1)}
                        className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-bold">
                        +
                      </button>
                    </div>
                    <div className={`font-bold ${t.text}`}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-center py-8 ${t.textSecondary}`}>
              Cart is empty
            </div>
          )}
        </div>

        {/* Totals */}
        <div className={`${t.surface} ${t.border} border rounded-lg p-4 mb-4`}>
          <div className="flex justify-between mb-2">
            <span className={t.textSecondary}>Subtotal:</span>
            <span className={`font-semibold ${t.text}`}>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className={t.textSecondary}>GST (10%):</span>
            <span className={`font-semibold ${t.text}`}>${tax.toFixed(2)}</span>
          </div>
          <div className={`flex justify-between pt-2 border-t ${t.border}`}>
            <span className={`font-bold ${t.text} text-xl`}>Total:</span>
            <span className="font-bold text-green-500 text-2xl">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Method */}
        <div className="mb-4">
          <label className={`block text-sm font-medium ${t.text} mb-2`}>Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className={`w-full px-3 py-2 ${t.input} rounded border`}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="eftpos">EFTPOS</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </div>

        {/* Checkout Button */}
        <button
          onClick={processCheckout}
          disabled={cart.length === 0 || !selectedCustomer}
          className={`w-full py-4 rounded-lg font-bold text-xl ${
            cart.length > 0 && selectedCustomer
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-400 cursor-not-allowed text-gray-600'
          }`}>
          {cart.length === 0 ? 'Add Items' : !selectedCustomer ? 'Select Customer' : `Checkout $${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  )
}