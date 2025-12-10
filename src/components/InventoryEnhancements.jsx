import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Html5QrcodeScanner } from 'html5-qrcode'

export default function InventoryEnhancements({ theme: t }) {
  const [view, setView] = useState('overview') // overview, reorder, scanner, transactions, suppliers
  const [parts, setParts] = useState([])
  const [lowStockParts, setLowStockParts] = useState([])
  const [reorderNeeded, setReorderNeeded] = useState([])
  const [transactions, setTransactions] = useState([])
  const [supplierPerformance, setSupplierPerformance] = useState([])
  const [showScannerModal, setShowScannerModal] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [selectedPart, setSelectedPart] = useState(null)
  const [scannerActive, setScannerActive] = useState(false)
  const [manualBarcode, setManualBarcode] = useState('')
  
  const [transactionData, setTransactionData] = useState({
    part_id: '',
    transaction_type: 'adjustment',
    quantity: 0,
    notes: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (showScannerModal && !scannerActive) {
      initializeScanner()
    }
  }, [showScannerModal])

  const loadData = async () => {
    await Promise.all([
      loadParts(),
      loadLowStock(),
      loadReorderNeeded(),
      loadTransactions(),
      loadSupplierPerformance()
    ])
  }

  const loadParts = async () => {
    const { data } = await supabase
      .from('parts')
      .select('*')
      .order('name')
    
    if (data) setParts(data)
  }

  const loadLowStock = async () => {
    const { data } = await supabase
      .from('parts')
      .select('*')
      .in('stock_status', ['low_stock', 'out_of_stock'])
      .order('quantity', { ascending: true })
    
    if (data) setLowStockParts(data)
  }

  const loadReorderNeeded = async () => {
    const { data } = await supabase.rpc('check_reorder_needed')
    if (data) setReorderNeeded(data)
  }

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('inventory_transactions')
      .select(`
        *,
        parts(name, part_number)
      `)
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (data) setTransactions(data)
  }

  const loadSupplierPerformance = async () => {
    const { data } = await supabase
      .from('supplier_performance')
      .select(`
        *,
        customers(company_name, first_name, last_name)
      `)
      .order('total_value', { ascending: false })
    
    if (data) setSupplierPerformance(data)
  }

  const initializeScanner = () => {
    setScannerActive(true)
    const scanner = new Html5QrcodeScanner(
      "barcode-reader",
      { 
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      false
    )

    scanner.render(onScanSuccess, onScanError)

    function onScanSuccess(decodedText) {
      handleBarcodeScanned(decodedText)
      scanner.clear()
      setScannerActive(false)
    }

    function onScanError(error) {
      // Silent error handling
    }
  }

  const handleBarcodeScanned = async (barcode) => {
    // Search for part by barcode
    const { data: part } = await supabase
      .from('parts')
      .select('*')
      .eq('barcode', barcode)
      .single()

    if (part) {
      setSelectedPart(part)
      alert(`✓ Found: ${part.name}`)
    } else {
      if (confirm(`Barcode ${barcode} not found. Create new part?`)) {
        // Open new part form with barcode pre-filled
        alert('New part form would open here')
      }
    }
  }

  const handleManualBarcodeSearch = async () => {
    if (!manualBarcode.trim()) return
    handleBarcodeScanned(manualBarcode)
    setManualBarcode('')
  }

  const generateBarcode = async (partId) => {
    // Generate EAN-13 style barcode
    const timestamp = Date.now().toString().slice(-10)
    const checksum = timestamp.split('').reduce((sum, digit) => sum + parseInt(digit), 0) % 10
    const barcode = timestamp + checksum

    const { error } = await supabase
      .from('parts')
      .update({ barcode: barcode })
      .eq('id', partId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert(`✓ Barcode generated: ${barcode}`)
      loadParts()
    }
  }

  const logTransaction = async () => {
    const { error } = await supabase.rpc('log_inventory_transaction', {
      p_part_id: transactionData.part_id,
      p_transaction_type: transactionData.transaction_type,
      p_quantity: parseInt(transactionData.quantity),
      p_notes: transactionData.notes
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      // Update part quantity
      const part = parts.find(p => p.id === transactionData.part_id)
      const newQuantity = transactionData.transaction_type === 'sale' || transactionData.transaction_type === 'damage'
        ? part.quantity - parseInt(transactionData.quantity)
        : part.quantity + parseInt(transactionData.quantity)

      await supabase
        .from('parts')
        .update({ quantity: newQuantity })
        .eq('id', transactionData.part_id)

      alert('✓ Transaction recorded!')
      setShowTransactionModal(false)
      setTransactionData({
        part_id: '',
        transaction_type: 'adjustment',
        quantity: 0,
        notes: ''
      })
      loadData()
    }
  }

  const updateReorderSettings = async (partId, reorderPoint, reorderQty, autoReorder) => {
    const { error } = await supabase
      .from('parts')
      .update({
        reorder_point: reorderPoint,
        reorder_quantity: reorderQty,
        auto_reorder: autoReorder
      })
      .eq('id', partId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Reorder settings updated!')
      loadData()
    }
  }

  const getStockStatusBadge = (status) => {
    const styles = {
      in_stock: 'bg-green-500',
      low_stock: 'bg-orange-500',
      out_of_stock: 'bg-red-500',
      on_order: 'bg-blue-500'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[status]}`}>
        {status.toUpperCase().replace('_', ' ')}
      </span>
    )
  }

  const getTransactionIcon = (type) => {
    const icons = {
      purchase: '📥',
      sale: '📤',
      adjustment: '⚖️',
      return: '↩️',
      transfer: '🔄',
      damage: '⚠️',
      count: '📊'
    }
    return icons[type] || '📦'
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>📦 Inventory Management</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowScannerModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
            📷 Scan Barcode
          </button>
          <button
            onClick={() => setShowTransactionModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">
            + Log Transaction
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'reorder', label: 'Reorder Alerts', icon: '🔔' },
          { id: 'transactions', label: 'Transactions', icon: '📝' },
          { id: 'suppliers', label: 'Suppliers', icon: '🏭' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
              view === tab.id
                ? 'bg-blue-600 text-white'
                : `${t.surface} ${t.text} ${t.border} border`
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {view === 'overview' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Total Parts</div>
              <div className={`text-3xl font-bold ${t.text}`}>{parts.length}</div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 border-red-500`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Low Stock</div>
              <div className="text-3xl font-bold text-red-500">{lowStockParts.length}</div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 border-orange-500`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Reorder Needed</div>
              <div className="text-3xl font-bold text-orange-500">{reorderNeeded.length}</div>
            </div>

            <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
              <div className={`text-sm ${t.textSecondary} mb-2`}>Total Value</div>
              <div className="text-3xl font-bold text-green-500">
                ${parts.reduce((sum, p) => sum + (p.quantity * (p.retail_price || 0)), 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Low Stock Alert */}
          {lowStockParts.length > 0 && (
            <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border-2 border-red-500 mb-6`}>
              <div className={`${t.surface} ${t.border} border-b p-4 flex items-center gap-3`}>
                <span className="text-3xl">⚠️</span>
                <h3 className={`text-xl font-bold ${t.text}`}>Low Stock Alerts</h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                {lowStockParts.slice(0, 6).map(part => (
                  <div key={part.id} className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className={`font-bold ${t.text}`}>{part.name}</h4>
                        <p className={`text-xs ${t.textSecondary}`}>{part.part_number}</p>
                      </div>
                      {getStockStatusBadge(part.stock_status)}
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className={`text-2xl font-bold ${part.quantity === 0 ? 'text-red-500' : 'text-orange-500'}`}>
                          {part.quantity}
                        </div>
                        <div className={`text-xs ${t.textSecondary}`}>
                          Min: {part.reorder_point || 10}
                        </div>
                      </div>
                      <button
                        onClick={() => generateBarcode(part.id)}
                        className="text-blue-500 hover:text-blue-700 text-sm font-medium">
                        {part.barcode ? '🏷️ View' : '+ Barcode'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Parts Table */}
          <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>All Parts Inventory</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${t.surface} ${t.border} border-b`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Part</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Barcode</th>
                    <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Stock</th>
                    <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Value</th>
                    <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Location</th>
                    <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.border}`}>
                  {parts.slice(0, 50).map(part => (
                    <tr key={part.id} className={t.surfaceHover}>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-bold ${t.text}`}>{part.name}</div>
                        <div className={`text-xs ${t.textSecondary}`}>{part.part_number}</div>
                      </td>
                      <td className="px-6 py-4">
                        {part.barcode ? (
                          <div className={`text-xs font-mono ${t.text}`}>{part.barcode}</div>
                        ) : (
                          <button
                            onClick={() => generateBarcode(part.id)}
                            className="text-blue-500 hover:text-blue-700 text-xs font-medium">
                            + Generate
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`text-sm font-bold ${
                          part.quantity === 0 ? 'text-red-500' :
                          part.quantity <= (part.reorder_point || 10) ? 'text-orange-500' :
                          t.text
                        }`}>
                          {part.quantity}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStockStatusBadge(part.stock_status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold text-green-500">
                          ${(part.quantity * (part.retail_price || 0)).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`text-xs ${t.text}`}>{part.location_bin || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedPart(part)
                            setTransactionData({...transactionData, part_id: part.id})
                            setShowTransactionModal(true)
                          }}
                          className="text-blue-500 hover:text-blue-700 text-sm font-medium">
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* REORDER VIEW */}
      {view === 'reorder' && (
        <>
          <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>🔔 Auto-Reorder Queue</h3>
            </div>
            {reorderNeeded.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h3 className={`text-2xl font-bold ${t.text} mb-2`}>All Stock Levels Good!</h3>
                <p className={`${t.textSecondary}`}>No parts need reordering at this time</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className={`${t.surface} ${t.border} border-b`}>
                    <tr>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Part</th>
                      <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Current</th>
                      <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Reorder Point</th>
                      <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Suggested Qty</th>
                      <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Priority</th>
                      <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${t.border}`}>
                    {reorderNeeded.map(item => (
                      <tr key={item.part_id} className={t.surfaceHover}>
                        <td className="px-6 py-4">
                          <div className={`text-sm font-bold ${t.text}`}>{item.part_name}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="text-sm font-bold text-red-500">{item.current_stock}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className={`text-sm ${t.text}`}>{item.reorder_point_val}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="text-sm font-bold text-blue-500">{item.suggested_order_qty}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${
                            item.current_stock === 0 ? 'bg-red-500' : 'bg-orange-500'
                          }`}>
                            {item.current_stock === 0 ? 'URGENT' : 'HIGH'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium">
                            Create PO
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* TRANSACTIONS VIEW */}
      {view === 'transactions' && (
        <>
          <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>📝 Transaction History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${t.surface} ${t.border} border-b`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Date</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Type</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Part</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Quantity</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Value</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Notes</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.border}`}>
                  {transactions.map(trans => (
                    <tr key={trans.id} className={t.surfaceHover}>
                      <td className="px-6 py-4">
                        <div className={`text-xs ${t.textSecondary}`}>
                          {new Date(trans.created_at).toLocaleString('en-AU')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getTransactionIcon(trans.transaction_type)}</span>
                          <span className={`text-xs font-semibold ${t.text} uppercase`}>
                            {trans.transaction_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm ${t.text}`}>{trans.parts?.name}</div>
                        <div className={`text-xs ${t.textSecondary}`}>{trans.parts?.part_number}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-bold ${
                          trans.transaction_type === 'sale' || trans.transaction_type === 'damage' ? 'text-red-500' : 'text-green-500'
                        }`}>
                          {trans.transaction_type === 'sale' || trans.transaction_type === 'damage' ? '-' : '+'}
                          {trans.quantity}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm ${t.text}`}>
                          ${trans.total_cost?.toLocaleString() || '0'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-xs ${t.textSecondary}`}>{trans.notes || '-'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* SUPPLIERS VIEW */}
      {view === 'suppliers' && (
        <>
          <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
            <div className={`${t.surface} ${t.border} border-b p-4`}>
              <h3 className={`text-xl font-bold ${t.text}`}>🏭 Supplier Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${t.surface} ${t.border} border-b`}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Supplier</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Total Orders</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Total Value</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Avg Delivery</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>On-Time %</th>
                    <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Quality</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.border}`}>
                  {supplierPerformance.map(supplier => (
                    <tr key={supplier.id} className={t.surfaceHover}>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-bold ${t.text}`}>
                          {supplier.customers?.company_name || `${supplier.customers?.first_name} ${supplier.customers?.last_name}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm ${t.text}`}>{supplier.total_orders}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-bold text-green-500">
                          ${supplier.total_value?.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm ${t.text}`}>{supplier.avg_delivery_time_days?.toFixed(1)} days</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={`text-sm font-bold ${
                          supplier.on_time_delivery_rate >= 90 ? 'text-green-500' :
                          supplier.on_time_delivery_rate >= 70 ? 'text-blue-500' :
                          'text-orange-500'
                        }`}>
                          {supplier.on_time_delivery_rate?.toFixed(0)}%
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          {'⭐'.repeat(Math.round(supplier.quality_rating || 0))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Barcode Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>📷 Barcode Scanner</h3>
              <button 
                onClick={() => {
                  setShowScannerModal(false)
                  setScannerActive(false)
                }}
                className="text-red-500 hover:text-red-700 font-bold text-2xl">
                ✕
              </button>
            </div>

            <div className="p-6">
              {/* Camera Scanner */}
              <div id="barcode-reader" className="mb-4"></div>

              {/* Manual Entry */}
              <div className="mt-6">
                <label className={`block text-sm font-medium ${t.text} mb-2`}>
                  Or enter barcode manually:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleManualBarcodeSearch()}
                    placeholder="Scan or type barcode..."
                    className={`flex-1 px-3 py-2 ${t.input} rounded border font-mono`}
                  />
                  <button
                    onClick={handleManualBarcodeSearch}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium">
                    Search
                  </button>
                </div>
              </div>

              {selectedPart && (
                <div className={`mt-6 ${t.surface} ${t.border} border-2 border-blue-500 rounded-lg p-4`}>
                  <h4 className={`font-bold ${t.text} mb-2`}>✓ Part Found:</h4>
                  <div className={`text-lg font-bold ${t.text}`}>{selectedPart.name}</div>
                  <div className={`text-sm ${t.textSecondary}`}>
                    Part #: {selectedPart.part_number} • Stock: {selectedPart.quantity}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-xl ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Log Inventory Transaction</h3>
              <button onClick={() => setShowTransactionModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Part *</label>
                <select
                  required
                  value={transactionData.part_id}
                  onChange={(e) => setTransactionData({...transactionData, part_id: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="">Select part...</option>
                  {parts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Current: {p.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Transaction Type *</label>
                <select
                  value={transactionData.transaction_type}
                  onChange={(e) => setTransactionData({...transactionData, transaction_type: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}>
                  <option value="adjustment">Adjustment</option>
                  <option value="purchase">Purchase</option>
                  <option value="return">Return</option>
                  <option value="damage">Damage/Loss</option>
                  <option value="count">Stock Count</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Quantity *</label>
                <input
                  type="number"
                  required
                  value={transactionData.quantity}
                  onChange={(e) => setTransactionData({...transactionData, quantity: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Notes</label>
                <textarea
                  value={transactionData.notes}
                  onChange={(e) => setTransactionData({...transactionData, notes: e.target.value})}
                  rows="3"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Optional notes about this transaction..."
                />
              </div>

              <button
                onClick={logTransaction}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">
                Log Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}