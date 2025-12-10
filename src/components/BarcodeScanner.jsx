import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function BarcodeScanner({ theme: t, currentUser }) {
  const [mode, setMode] = useState('lookup') // lookup, checkin, checkout, stocktake
  const [barcode, setBarcode] = useState('')
  const [part, setPart] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [workOrders, setWorkOrders] = useState([])
  const [selectedWorkOrder, setSelectedWorkOrder] = useState('')
  const [recentScans, setRecentScans] = useState([])
  const [stocktakeItems, setStocktakeItems] = useState([])
  const inputRef = useRef(null)

  useEffect(() => {
    loadWorkOrders()
    inputRef.current?.focus()
  }, [])

  const loadWorkOrders = async () => {
    const { data } = await supabase
      .from('work_orders')
      .select(`*, customers(first_name, last_name), vehicles(registration)`)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })
    if (data) setWorkOrders(data)
  }

  const handleScan = async (e) => {
    if (e.key === 'Enter' && barcode.trim()) {
      await lookupPart(barcode.trim())
    }
  }

  const lookupPart = async (code) => {
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .or(`barcode.eq.${code},part_number.ilike.%${code}%`)
      .limit(1)
      .single()

    if (data) {
      setPart(data)
      addToRecentScans(data, 'lookup')
      
      if (mode === 'stocktake') {
        const existing = stocktakeItems.find(i => i.id === data.id)
        if (!existing) {
          setStocktakeItems([...stocktakeItems, { ...data, counted: data.quantity }])
        }
      }
    } else {
      setPart(null)
      alert('Part not found!')
    }
    setBarcode('')
    inputRef.current?.focus()
  }

  const addToRecentScans = (part, action) => {
    setRecentScans(prev => [{
      part,
      action,
      timestamp: new Date(),
      quantity: quantity
    }, ...prev.slice(0, 19)])
  }

  const checkoutPart = async () => {
    if (!part || !selectedWorkOrder) {
      alert('Select a work order first')
      return
    }

    if (part.quantity < quantity) {
      alert(`Only ${part.quantity} in stock!`)
      return
    }

    try {
      // Reduce stock
      await supabase
        .from('parts')
        .update({ quantity: part.quantity - quantity })
        .eq('id', part.id)

      // Add to work order
      const { data: existing } = await supabase
        .from('work_order_parts')
        .select('*')
        .eq('work_order_id', selectedWorkOrder)
        .eq('part_id', part.id)
        .single()

      if (existing) {
        await supabase
          .from('work_order_parts')
          .update({
            quantity: existing.quantity + quantity,
            total_price: (existing.quantity + quantity) * existing.unit_price
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('work_order_parts').insert([{
          work_order_id: selectedWorkOrder,
          part_id: part.id,
          quantity: quantity,
          unit_price: part.sell_price,
          total_price: quantity * part.sell_price
        }])
      }

      // Log transaction
      await supabase.from('inventory_transactions').insert([{
        part_id: part.id,
        transaction_type: 'used',
        quantity: -quantity,
        reference_type: 'work_order',
        reference_id: selectedWorkOrder,
        notes: `Scanned out to job`,
        created_by: currentUser?.id
      }])

      addToRecentScans(part, 'checkout')
      alert(`✓ ${quantity}x ${part.name} added to job!`)
      setPart({ ...part, quantity: part.quantity - quantity })
      setQuantity(1)
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  const checkinPart = async () => {
    if (!part) return

    try {
      await supabase
        .from('parts')
        .update({ quantity: part.quantity + quantity })
        .eq('id', part.id)

      await supabase.from('inventory_transactions').insert([{
        part_id: part.id,
        transaction_type: 'received',
        quantity: quantity,
        notes: 'Scanned in',
        created_by: currentUser?.id
      }])

      addToRecentScans(part, 'checkin')
      alert(`✓ ${quantity}x ${part.name} added to stock!`)
      setPart({ ...part, quantity: part.quantity + quantity })
      setQuantity(1)
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  const updateStocktakeCount = (partId, count) => {
    setStocktakeItems(prev => prev.map(item =>
      item.id === partId ? { ...item, counted: parseInt(count) || 0 } : item
    ))
  }

  const saveStocktake = async () => {
    if (stocktakeItems.length === 0) {
      alert('No items to save')
      return
    }

    try {
      for (const item of stocktakeItems) {
        const variance = item.counted - item.quantity
        if (variance !== 0) {
          await supabase
            .from('parts')
            .update({ quantity: item.counted })
            .eq('id', item.id)

          await supabase.from('inventory_transactions').insert([{
            part_id: item.id,
            transaction_type: 'adjustment',
            quantity: variance,
            notes: `Stocktake adjustment (was ${item.quantity}, now ${item.counted})`,
            created_by: currentUser?.id
          }])
        }
      }

      alert(`✓ Stocktake saved! ${stocktakeItems.length} items updated.`)
      setStocktakeItems([])
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  const getModeColor = (m) => {
    const colors = { lookup: 'bg-blue-600', checkin: 'bg-green-600', checkout: 'bg-orange-600', stocktake: 'bg-purple-600' }
    return colors[m] || 'bg-gray-600'
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>📷 Barcode Scanner</h2>
        <div className="flex gap-2">
          {['lookup', 'checkin', 'checkout', 'stocktake'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setPart(null); }}
              className={`px-4 py-2 rounded-lg font-medium capitalize ${mode === m ? `${getModeColor(m)} text-white` : `${t.surface} ${t.text} ${t.border} border`}`}
            >
              {m === 'lookup' && '🔍'} {m === 'checkin' && '📥'} {m === 'checkout' && '📤'} {m === 'stocktake' && '📋'} {m}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Scanner Input */}
        <div className="space-y-6">
          <div className={`${t.surface} rounded-lg p-6 ${t.border} border`}>
            <div className={`text-center mb-4 px-4 py-2 rounded-lg ${getModeColor(mode)} text-white font-bold text-lg`}>
              {mode === 'lookup' && '🔍 Part Lookup'}
              {mode === 'checkin' && '📥 Check In Stock'}
              {mode === 'checkout' && '📤 Check Out to Job'}
              {mode === 'stocktake' && '📋 Stocktake Mode'}
            </div>

            <div className="mb-4">
              <label className={`block text-sm font-medium ${t.text} mb-2`}>Scan Barcode or Enter Part Number</label>
              <input
                ref={inputRef}
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyPress={handleScan}
                className={`w-full px-4 py-4 ${t.input} rounded-lg border text-xl text-center font-mono`}
                placeholder="Scan or type..."
                autoFocus
              />
            </div>

            {mode === 'checkout' && (
              <div className="mb-4">
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Select Work Order</label>
                <select
                  value={selectedWorkOrder}
                  onChange={(e) => setSelectedWorkOrder(e.target.value)}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                >
                  <option value="">Choose a job...</option>
                  {workOrders.map(wo => (
                    <option key={wo.id} value={wo.id}>
                      {wo.job_number} - {wo.customers?.first_name} {wo.customers?.last_name} ({wo.vehicles?.registration})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(mode === 'checkin' || mode === 'checkout') && (
              <div className="mb-4">
                <label className={`block text-sm font-medium ${t.text} mb-2`}>Quantity</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="bg-red-600 hover:bg-red-700 text-white w-12 h-12 rounded-lg font-bold text-2xl">-</button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className={`flex-1 px-4 py-3 ${t.input} rounded-lg border text-center text-2xl font-bold`}
                  />
                  <button onClick={() => setQuantity(quantity + 1)} className="bg-green-600 hover:bg-green-700 text-white w-12 h-12 rounded-lg font-bold text-2xl">+</button>
                </div>
              </div>
            )}
          </div>

          {/* Part Details */}
          {part && (
            <div className={`${t.surface} rounded-lg p-6 ${t.border} border-2 border-blue-500`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className={`text-2xl font-bold ${t.text}`}>{part.name}</h3>
                  <div className={`font-mono ${t.textSecondary}`}>{part.part_number}</div>
                </div>
                <div className={`text-right`}>
                  <div className={`text-3xl font-bold ${part.quantity <= (part.reorder_point || 5) ? 'text-red-500' : 'text-green-500'}`}>
                    {part.quantity}
                  </div>
                  <div className={t.textSecondary}>in stock</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className={`${t.surface} ${t.border} border rounded p-3`}>
                  <div className={`text-xs ${t.textSecondary}`}>Cost Price</div>
                  <div className={`text-lg font-bold ${t.text}`}>${part.cost_price?.toFixed(2)}</div>
                </div>
                <div className={`${t.surface} ${t.border} border rounded p-3`}>
                  <div className={`text-xs ${t.textSecondary}`}>Sell Price</div>
                  <div className={`text-lg font-bold text-green-500`}>${part.sell_price?.toFixed(2)}</div>
                </div>
              </div>

              {part.location && (
                <div className={`${t.surface} ${t.border} border rounded p-3 mb-4`}>
                  <div className={`text-xs ${t.textSecondary}`}>Location</div>
                  <div className={`text-lg font-bold ${t.text}`}>📍 {part.location}</div>
                </div>
              )}

              {mode === 'checkin' && (
                <button onClick={checkinPart} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-bold text-lg">
                  📥 Check In {quantity}x {part.name}
                </button>
              )}

              {mode === 'checkout' && (
                <button onClick={checkoutPart} disabled={!selectedWorkOrder} className={`w-full py-4 rounded-lg font-bold text-lg ${selectedWorkOrder ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-gray-600 text-gray-400'}`}>
                  📤 Check Out {quantity}x to Job
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Stocktake List */}
          {mode === 'stocktake' && (
            <div className={`${t.surface} rounded-lg ${t.border} border`}>
              <div className={`${t.border} border-b p-4 flex justify-between items-center`}>
                <h3 className={`font-bold ${t.text}`}>📋 Stocktake Items ({stocktakeItems.length})</h3>
                {stocktakeItems.length > 0 && (
                  <button onClick={saveStocktake} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-medium">
                    💾 Save All
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {stocktakeItems.map(item => (
                  <div key={item.id} className={`p-3 ${t.border} border-b flex justify-between items-center`}>
                    <div>
                      <div className={`font-bold ${t.text}`}>{item.name}</div>
                      <div className={`text-xs ${t.textSecondary}`}>System: {item.quantity}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={item.counted}
                        onChange={(e) => updateStocktakeCount(item.id, e.target.value)}
                        className={`w-20 px-2 py-1 ${t.input} rounded border text-center ${item.counted !== item.quantity ? 'border-orange-500' : ''}`}
                      />
                      {item.counted !== item.quantity && (
                        <span className={`text-xs ${item.counted > item.quantity ? 'text-green-500' : 'text-red-500'}`}>
                          {item.counted > item.quantity ? '+' : ''}{item.counted - item.quantity}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {stocktakeItems.length === 0 && (
                  <div className={`text-center py-8 ${t.textSecondary}`}>Scan items to add to stocktake</div>
                )}
              </div>
            </div>
          )}

          {/* Recent Scans */}
          <div className={`${t.surface} rounded-lg ${t.border} border`}>
            <div className={`${t.border} border-b p-4`}>
              <h3 className={`font-bold ${t.text}`}>🕐 Recent Scans</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {recentScans.map((scan, idx) => (
                <div key={idx} className={`p-3 ${t.border} border-b flex justify-between items-center`}>
                  <div>
                    <div className={`font-medium ${t.text}`}>{scan.part.name}</div>
                    <div className={`text-xs ${t.textSecondary}`}>{scan.part.part_number}</div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs rounded font-bold ${
                      scan.action === 'checkin' ? 'bg-green-600' :
                      scan.action === 'checkout' ? 'bg-orange-600' : 'bg-blue-600'
                    } text-white`}>
                      {scan.action === 'checkin' ? `+${scan.quantity}` : scan.action === 'checkout' ? `-${scan.quantity}` : 'VIEW'}
                    </span>
                    <div className={`text-xs ${t.textSecondary} mt-1`}>
                      {scan.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              {recentScans.length === 0 && (
                <div className={`text-center py-8 ${t.textSecondary}`}>No recent scans</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
