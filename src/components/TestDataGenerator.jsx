import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function TestDataGenerator({ theme: t }) {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])

  const generateTestData = async () => {
    setLoading(true)
    setResults([])
    const logs = []

    try {
      const timestamp = Date.now() // For unique identifiers

      // 1. Generate Customers
      logs.push('📝 Creating test customers...')
      setResults([...logs])
      
      const customers = []
      for (let i = 1; i <= 10; i++) {
        const { data, error } = await supabase
          .from('customers')
          .insert([{
            first_name: `Test${i}`,
            last_name: `Customer${i}`,
            email: `test${i}@example.com`,
            phone: `0400${String(i).padStart(6, '0')}`,
            address: `${i} Test Street, Sydney NSW 2000`,
            notes: `Test customer ${i}`,
            is_company: false,
            marketing_opt_in: true
          }])
          .select()
        
        if (!error && data) customers.push(data[0])
      }
      logs.push(`✅ Created ${customers.length} customers`)
      setResults([...logs])

      if (customers.length === 0) {
        logs.push('❌ Stopping - no customers created')
        setResults([...logs])
        setLoading(false)
        return
      }

      // 2. Generate Vehicles
      logs.push('')
      logs.push('📝 Creating test vehicles...')
      setResults([...logs])
      
      const vehicles = []
      const makes = ['Harley-Davidson', 'Yamaha', 'Kawasaki', 'Honda', 'Ducati']
      const models = ['Sportster 883', 'MT-07', 'Ninja 650', 'CBR600RR', 'Monster 821']
      
      for (let i = 0; i < customers.length; i++) {
        const { data, error } = await supabase
          .from('vehicles')
          .insert([{
            customer_id: customers[i].id,
            year: 2018 + (i % 5),
            make: makes[i % makes.length],
            model: models[i % models.length],
            registration: `TEST${String(i + 1).padStart(3, '0')}`,
            vin: `TESTVEH${timestamp}${String(i + 1).padStart(5, '0')}`,
            color: ['Black', 'Red', 'Blue', 'White', 'Silver'][i % 5],
            current_odometer: 5000 + (i * 1000),
            notes: `Test vehicle ${i + 1}`
          }])
          .select()
        
        if (!error && data) vehicles.push(data[0])
      }
      
      logs.push(`✅ Created ${vehicles.length} vehicles`)
      setResults([...logs])

      // 3. Generate Mechanics
      logs.push('')
      logs.push('📝 Creating test mechanics...')
      setResults([...logs])
      
      const mechanics = []
      for (let i = 1; i <= 5; i++) {
        const { data, error } = await supabase
          .from('mechanics')
          .insert([{
            first_name: `Mechanic${i}`,
            last_name: `Test${i}`,
            email: `mechanic${i}@arkstation.com`,
            phone: `0500${String(i).padStart(6, '0')}`,
            hourly_rate: 80 + (i * 5),
            commission_rate: 10,
            is_active: true
          }])
          .select()
        
        if (!error && data) mechanics.push(data[0])
      }
      
      logs.push(`✅ Created ${mechanics.length} mechanics`)
      setResults([...logs])

      // 4. Generate Work Orders
      logs.push('')
      logs.push('📝 Creating test work orders...')
      setResults([...logs])
      
      const workOrders = []
      if (vehicles.length > 0 && mechanics.length > 0) {
        const statuses = ['pending', 'in_progress', 'waiting_on_parts', 'completed']
        
        for (let i = 0; i < Math.min(20, vehicles.length); i++) {
          const status = statuses[i % statuses.length]
          const laborCost = 100 + (i * 10)
          const partsCost = 50 + (i * 5)
          const totalCost = laborCost + partsCost
          const laborHours = 1 + (i * 0.5)
          
          const { data, error } = await supabase
            .from('work_orders')
            .insert([{
              customer_id: customers[i % customers.length].id,
              vehicle_id: vehicles[i % vehicles.length].id,
              assigned_mechanic_id: mechanics[i % mechanics.length].id,
              job_number: `JOB-${timestamp}-${String(i + 1).padStart(3, '0')}`,
              description: `Test work - General service and inspection ${i + 1}`,
              status: status,
              order_type: 'work_order',
              labor_cost: laborCost,
              labor_hours: laborHours,
              labor_rate: 100,
              parts_cost: partsCost,
              parts_total: partsCost,
              labor_total: laborCost,
              total_cost: totalCost,
              total: totalCost,
              estimated_cost: totalCost,
              waiting_on_parts: status === 'waiting_on_parts',
              customer_approved: true
            }])
            .select()
          
          if (!error && data) {
            workOrders.push(data[0])
          } else if (error) {
            logs.push(`⚠️ Work order ${i + 1}: ${error.message}`)
            setResults([...logs])
          }
        }
      }
      
      logs.push(`✅ Created ${workOrders.length} work orders`)
      setResults([...logs])

      // 5. Generate Parts
      logs.push('')
      logs.push('📝 Creating test parts...')
      setResults([...logs])
      
      const parts = []
      const partsList = [
        { name: 'Oil Filter - Standard', cat: 'engine', cost: 15, sell: 30 },
        { name: 'Air Filter - Performance', cat: 'engine', cost: 25, sell: 50 },
        { name: 'Spark Plug - NGK', cat: 'engine', cost: 8, sell: 16 },
        { name: 'Brake Pads - Front Set', cat: 'brakes', cost: 40, sell: 80 },
        { name: 'Brake Pads - Rear Set', cat: 'brakes', cost: 35, sell: 70 },
        { name: 'Chain - 520 Standard', cat: 'drivetrain', cost: 60, sell: 120 },
        { name: 'Sprocket Set', cat: 'drivetrain', cost: 80, sell: 160 },
        { name: 'Battery - 12V AGM', cat: 'electrical', cost: 70, sell: 140 }
      ]
      
      for (let i = 0; i < partsList.length; i++) {
        const p = partsList[i]
        const { data, error } = await supabase
          .from('parts')
          .insert([{
            name: p.name,
            part_number: `PART-${String(1000 + i).padStart(4, '0')}`,
            description: `Test part - ${p.name}`,
            category: p.cat,
            cost_price: p.cost,
            sell_price: p.sell,
            quantity: 10 + (i * 2),
            low_stock_threshold: 5,
            supplier: 'Test Supplier'
          }])
          .select()
        
        if (!error && data) parts.push(data[0])
      }
      
      logs.push(`✅ Created ${parts.length} parts`)
      setResults([...logs])

      // 6. Generate Bike Stock
      logs.push('')
      logs.push('📝 Creating test bike stock...')
      setResults([...logs])
      
      const bikes = []
      const stockBikes = [
        { year: 2024, make: 'Harley-Davidson', model: 'Street Bob 114', price: 25000, engine: 1868 },
        { year: 2024, make: 'Yamaha', model: 'MT-09', price: 14000, engine: 890 },
        { year: 2023, make: 'Kawasaki', model: 'Z900', price: 13000, engine: 948 },
        { year: 2024, make: 'Honda', model: 'CB650R', price: 12000, engine: 649 },
        { year: 2023, make: 'Ducati', model: 'Monster 821', price: 18000, engine: 821 }
      ]
      
      const bikeStatuses = ['available', 'in_pdi', 'on_hold']
      
      for (let i = 0; i < stockBikes.length; i++) {
        const bike = stockBikes[i]
        const { data, error } = await supabase
          .from('bike_stock')
          .insert([{
            year: bike.year,
            make: bike.make,
            model: bike.model,
            vin: `TESTBIKE${timestamp}${String(i + 1).padStart(5, '0')}`,
            color: ['Vivid Black', 'Icon Blue', 'Metallic Spark Black', 'Pearl White', 'Ducati Red'][i],
            stock_type: 'new',
            status: bikeStatuses[i % bikeStatuses.length],
            purchase_price: bike.price * 0.8,
            retail_price: bike.price,
            engine_size: bike.engine,
            odometer: 0,
            date_received: new Date(Date.now() - (i * 7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
            location: `Showroom Bay ${i + 1}`,
            stock_number: `STK-${timestamp}-${String(i + 1).padStart(3, '0')}`
          }])
          .select()
        
        if (!error && data) {
          bikes.push(data[0])
        } else if (error) {
          logs.push(`⚠️ Bike ${i + 1}: ${error.message}`)
          setResults([...logs])
        }
      }
      
      logs.push(`✅ Created ${bikes.length} stock bikes`)
      setResults([...logs])

      // 7. Generate Consumables
      logs.push('')
      logs.push('📝 Creating test consumables...')
      setResults([...logs])
      
      const consumables = []
      const consumablesList = [
        { name: 'Engine Oil 10W-40 Synthetic', unit: 'liters', qty: 50, min: 20, cost: 8 },
        { name: 'Brake Fluid DOT 4', unit: 'liters', qty: 20, min: 10, cost: 12 },
        { name: 'Coolant Premix', unit: 'liters', qty: 30, min: 15, cost: 10 },
        { name: 'Shop Rags - Heavy Duty', unit: 'boxes', qty: 15, min: 5, cost: 25 },
        { name: 'Degreaser Spray', unit: 'bottles', qty: 10, min: 5, cost: 8 }
      ]
      
      for (let i = 0; i < consumablesList.length; i++) {
        const item = consumablesList[i]
        const { data, error } = await supabase
          .from('consumables')
          .insert([{
            name: item.name,
            unit_of_measure: item.unit,
            current_quantity: item.qty,
            min_quantity: item.min,
            cost_per_unit: item.cost,
            is_active: true
          }])
          .select()
        
        if (!error && data) consumables.push(data[0])
      }
      
      logs.push(`✅ Created ${consumables.length} consumables`)
      setResults([...logs])

      logs.push('')
      logs.push('🎉 TEST DATA GENERATION COMPLETE!')
      logs.push('')
      logs.push('📊 Summary:')
      logs.push(`   • ${customers.length} Customers`)
      logs.push(`   • ${vehicles.length} Vehicles`)
      logs.push(`   • ${mechanics.length} Mechanics`)
      logs.push(`   • ${workOrders.length} Work Orders`)
      logs.push(`   • ${parts.length} Parts`)
      logs.push(`   • ${bikes.length} Stock Bikes`)
      logs.push(`   • ${consumables.length} Consumables`)
      logs.push('')
      logs.push('✨ SUCCESS! Refresh your pages to see all the data!')
      setResults([...logs])

    } catch (error) {
      logs.push('')
      logs.push(`❌ Unexpected Error: ${error.message}`)
      console.error('Test data error:', error)
      setResults([...logs])
    } finally {
      setLoading(false)
    }
  }

  const clearTestData = async () => {
    if (!confirm('⚠️ This will delete ALL test data! Are you sure?')) return
    
    setLoading(true)
    const logs = ['🗑️ Deleting test data...']
    setResults(logs)

    try {
      // Delete in correct order (foreign key constraints)
      logs.push('Deleting work order dependencies...')
      setResults([...logs])
      
      const { data: workOrderIds } = await supabase
        .from('work_orders')
        .select('id')
        .like('job_number', 'JOB-%')
      
      if (workOrderIds && workOrderIds.length > 0) {
        const ids = workOrderIds.map(wo => wo.id)
        await supabase.from('consumable_usage').delete().in('work_order_id', ids)
        await supabase.from('work_order_parts').delete().in('work_order_id', ids)
      }
      
      logs.push('Deleting work orders...')
      setResults([...logs])
      await supabase.from('work_orders').delete().like('job_number', 'JOB-%')
      
      logs.push('Deleting vehicles...')
      setResults([...logs])
      await supabase.from('vehicles').delete().like('vin', 'TESTVEH%')
      
      logs.push('Deleting customers...')
      setResults([...logs])
      await supabase.from('customers').delete().like('email', 'test%@example.com')
      
      logs.push('Deleting mechanics...')
      setResults([...logs])
      await supabase.from('mechanics').delete().like('email', 'mechanic%@arkstation.com')
      
      logs.push('Deleting parts...')
      setResults([...logs])
      await supabase.from('parts').delete().like('part_number', 'PART-%')
      
      logs.push('Deleting bike stock...')
      setResults([...logs])
      await supabase.from('bike_stock').delete().like('vin', 'TESTBIKE%')
      
      logs.push('Deleting consumables...')
      setResults([...logs])
      await supabase.from('consumables').delete().like('name', '%Oil%')
      await supabase.from('consumables').delete().like('name', '%Brake%')
      await supabase.from('consumables').delete().like('name', '%Coolant%')
      await supabase.from('consumables').delete().like('name', '%Rags%')
      await supabase.from('consumables').delete().like('name', '%Degreaser%')

      logs.push('')
      logs.push('✅ All test data deleted!')
      setResults([...logs])
    } catch (error) {
      logs.push(`❌ Error: ${error.message}`)
      setResults([...logs])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className={`text-3xl font-bold ${t.text} mb-6`}>🧪 Test Data Generator</h2>

      <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border mb-6`}>
        <h3 className={`text-xl font-bold ${t.text} mb-4`}>Generate Demo Data</h3>
        <p className={`${t.textSecondary} mb-4`}>
          Creates realistic sample data for testing all features:
        </p>
        <ul className={`${t.text} mb-6 space-y-2 text-sm`}>
          <li>✓ 10 Test Customers with addresses</li>
          <li>✓ 10 Test Vehicles (various makes/models)</li>
          <li>✓ 5 Test Mechanics</li>
          <li>✓ 20 Test Work Orders (various statuses)</li>
          <li>✓ 8 Test Parts (filters, pads, chains, etc)</li>
          <li>✓ 5 Test Stock Bikes (showroom inventory)</li>
          <li>✓ 5 Test Consumables (oils, fluids, supplies)</li>
        </ul>

        <div className="flex gap-4">
          <button
            onClick={generateTestData}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? '⏳ Generating...' : '🚀 Generate Test Data'}
          </button>

          <button
            onClick={clearTestData}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? '⏳ Clearing...' : '🗑️ Clear Test Data'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
          <h3 className={`text-xl font-bold ${t.text} mb-4`}>Progress Log</h3>
          <div className={`${t.surface} ${t.border} border rounded p-4 font-mono text-xs space-y-1 max-h-96 overflow-y-auto`}
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(59, 130, 246, 0.5) rgba(0, 0, 0, 0.1)'
            }}>
            {results.map((r, i) => (
              <div key={i} className={`${
                r.startsWith('❌') || r.startsWith('⚠️') ? 'text-red-400' :
                r.startsWith('✅') || r.startsWith('✓') ? 'text-green-400' :
                r.startsWith('🎉') ? 'text-blue-400 font-bold' : t.text
              }`}>{r}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}