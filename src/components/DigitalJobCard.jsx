import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function DigitalJobCard({ theme: t, workOrderId, onClose }) {
  const [workOrder, setWorkOrder] = useState(null)
  const [laborItems, setLaborItems] = useState([])
  const [partItems, setPartItems] = useState([])
  const [shopInfo, setShopInfo] = useState(null)
  const printRef = useRef(null)

  useEffect(() => {
    if (workOrderId) {
      loadWorkOrder()
      loadShopInfo()
    }
  }, [workOrderId])

  const loadWorkOrder = async () => {
    const { data: wo } = await supabase
      .from('work_orders')
      .select(`
        *,
        customers(first_name, last_name, phone, email, address),
        vehicles(year, make, model, registration, vin, color, odometer),
        mechanics(first_name, last_name)
      `)
      .eq('id', workOrderId)
      .single()

    if (wo) {
      setWorkOrder(wo)
      
      const { data: labor } = await supabase.from('work_order_labor').select('*').eq('work_order_id', workOrderId)
      setLaborItems(labor || [])

      const { data: parts } = await supabase.from('work_order_parts').select('*, parts(name, part_number)').eq('work_order_id', workOrderId)
      setPartItems(parts || [])
    }
  }

  const loadShopInfo = async () => {
    const { data } = await supabase.from('shop_settings').select('*').limit(1).single()
    setShopInfo(data)
  }

  const handlePrint = () => {
    const printContent = printRef.current
    const printWindow = window.open('', '_blank')
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Job Card - ${workOrder?.job_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { color: #666; }
          .job-number { font-size: 28px; font-weight: bold; text-align: center; margin: 15px 0; padding: 10px; border: 3px solid #000; }
          .section { margin-bottom: 15px; }
          .section-title { font-weight: bold; font-size: 14px; background: #f0f0f0; padding: 5px 10px; border: 1px solid #ccc; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
          .info-box { border: 1px solid #ccc; padding: 10px; }
          .info-box label { font-weight: bold; display: block; margin-bottom: 3px; color: #666; font-size: 10px; text-transform: uppercase; }
          .info-box .value { font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 5px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background: #f0f0f0; font-size: 11px; text-transform: uppercase; }
          .checklist-item { display: flex; align-items: center; padding: 5px 0; border-bottom: 1px dotted #ccc; }
          .checkbox { width: 18px; height: 18px; border: 2px solid #000; margin-right: 10px; }
          .signature-box { border: 1px solid #000; height: 60px; margin-top: 5px; }
          .notes-box { border: 1px solid #ccc; min-height: 80px; padding: 10px; margin-top: 5px; }
          .totals { text-align: right; margin-top: 10px; }
          .totals table { width: 250px; margin-left: auto; }
          .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `)
    
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  if (!workOrder) {
    return <div className={`${t.surface} rounded-lg p-8 text-center ${t.text}`}>Loading...</div>
  }

  const laborTotal = laborItems.reduce((sum, l) => sum + (l.amount || 0), 0)
  const partsTotal = partItems.reduce((sum, p) => sum + (p.total_price || 0), 0)
  const subtotal = laborTotal + partsTotal
  const gst = subtotal * 0.1
  const total = subtotal + gst

  return (
    <div>
      {/* Controls */}
      <div className="flex justify-between items-center mb-4 no-print">
        <h2 className={`text-2xl font-bold ${t.text}`}>📄 Digital Job Card</h2>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
            🖨️ Print Job Card
          </button>
          {onClose && (
            <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg">✕</button>
          )}
        </div>
      </div>

      {/* Printable Job Card */}
      <div ref={printRef} className={`${t.surface} rounded-lg p-6 ${t.border} border`} style={{ background: 'white', color: 'black' }}>
        {/* Header */}
        <div className="header">
          <h1>{shopInfo?.name || 'Ark Station Motorcycles'}</h1>
          <p>{shopInfo?.address || '123 Workshop Street'} | {shopInfo?.phone || '0400 000 000'}</p>
          <p>ABN: {shopInfo?.abn || '00 000 000 000'}</p>
        </div>

        {/* Job Number */}
        <div className="job-number">
          JOB #{workOrder.job_number}
        </div>

        {/* Customer & Vehicle Info */}
        <div className="grid">
          <div>
            <div className="section-title">Customer Details</div>
            <div className="info-box">
              <label>Name</label>
              <div className="value">{workOrder.customers?.first_name} {workOrder.customers?.last_name}</div>
            </div>
            <div className="info-box">
              <label>Phone</label>
              <div className="value">{workOrder.customers?.phone || '-'}</div>
            </div>
            <div className="info-box">
              <label>Email</label>
              <div className="value">{workOrder.customers?.email || '-'}</div>
            </div>
          </div>
          <div>
            <div className="section-title">Vehicle Details</div>
            <div className="info-box">
              <label>Vehicle</label>
              <div className="value">{workOrder.vehicles?.year} {workOrder.vehicles?.make} {workOrder.vehicles?.model}</div>
            </div>
            <div className="info-box">
              <label>Registration</label>
              <div className="value" style={{ fontSize: '18px', fontWeight: 'bold' }}>{workOrder.vehicles?.registration}</div>
            </div>
            <div className="info-box">
              <label>VIN</label>
              <div className="value" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{workOrder.vehicles?.vin || '-'}</div>
            </div>
          </div>
        </div>

        {/* Job Info */}
        <div className="grid">
          <div className="info-box">
            <label>Date In</label>
            <div className="value">{new Date(workOrder.created_at).toLocaleDateString('en-AU')}</div>
          </div>
          <div className="info-box">
            <label>Odometer In</label>
            <div className="value">{workOrder.odometer_in?.toLocaleString() || '________'} km</div>
          </div>
          <div className="info-box">
            <label>Technician</label>
            <div className="value">{workOrder.mechanics?.first_name} {workOrder.mechanics?.last_name || 'Unassigned'}</div>
          </div>
          <div className="info-box">
            <label>Status</label>
            <div className="value" style={{ textTransform: 'uppercase' }}>{workOrder.status?.replace('_', ' ')}</div>
          </div>
        </div>

        {/* Work Description */}
        <div className="section">
          <div className="section-title">Work Description / Customer Request</div>
          <div className="notes-box">
            {workOrder.description || 'No description provided'}
          </div>
        </div>

        {/* Pre-Service Checklist */}
        <div className="section">
          <div className="section-title">Pre-Service Checklist</div>
          <div style={{ columns: 2, padding: '10px' }}>
            {['Fuel level noted', 'Damage inspection', 'Personal items removed', 'Keys received', 'Customer signature obtained', 'Photos taken'].map((item, idx) => (
              <div key={idx} className="checklist-item">
                <div className="checkbox"></div>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Labor */}
        <div className="section">
          <div className="section-title">Labor</div>
          <table>
            <thead>
              <tr>
                <th style={{ width: '60%' }}>Description</th>
                <th>Hours</th>
                <th>Rate</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {laborItems.length > 0 ? laborItems.map((labor, idx) => (
                <tr key={idx}>
                  <td>{labor.description}</td>
                  <td>{labor.hours}</td>
                  <td>${labor.rate?.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>${labor.amount?.toFixed(2)}</td>
                </tr>
              )) : (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: '#999' }}>No labor recorded</td></tr>
              )}
              {/* Empty rows for handwriting */}
              {[...Array(Math.max(0, 3 - laborItems.length))].map((_, idx) => (
                <tr key={`empty-${idx}`}>
                  <td style={{ height: '30px' }}></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Parts */}
        <div className="section">
          <div className="section-title">Parts Used</div>
          <table>
            <thead>
              <tr>
                <th>Part Number</th>
                <th style={{ width: '40%' }}>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {partItems.length > 0 ? partItems.map((part, idx) => (
                <tr key={idx}>
                  <td style={{ fontFamily: 'monospace' }}>{part.parts?.part_number}</td>
                  <td>{part.parts?.name}</td>
                  <td>{part.quantity}</td>
                  <td>${part.unit_price?.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>${part.total_price?.toFixed(2)}</td>
                </tr>
              )) : (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: '#999' }}>No parts recorded</td></tr>
              )}
              {/* Empty rows for handwriting */}
              {[...Array(Math.max(0, 3 - partItems.length))].map((_, idx) => (
                <tr key={`empty-${idx}`}>
                  <td style={{ height: '30px' }}></td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Technician Notes */}
        <div className="section">
          <div className="section-title">Technician Notes / Additional Work Required</div>
          <div className="notes-box" style={{ minHeight: '100px' }}>
            {workOrder.technician_notes || ''}
          </div>
        </div>

        {/* Totals */}
        <div className="totals">
          <table>
            <tbody>
              <tr>
                <td>Labor Total:</td>
                <td style={{ textAlign: 'right' }}>${laborTotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Parts Total:</td>
                <td style={{ textAlign: 'right' }}>${partsTotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Subtotal:</td>
                <td style={{ textAlign: 'right' }}>${subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td>GST (10%):</td>
                <td style={{ textAlign: 'right' }}>${gst.toFixed(2)}</td>
              </tr>
              <tr style={{ fontWeight: 'bold', fontSize: '16px' }}>
                <td>TOTAL:</td>
                <td style={{ textAlign: 'right' }}>${total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="grid" style={{ marginTop: '20px' }}>
          <div>
            <div className="section-title">Technician Sign-Off</div>
            <div className="signature-box"></div>
            <p style={{ fontSize: '10px', marginTop: '5px' }}>Date: _______________</p>
          </div>
          <div>
            <div className="section-title">Quality Check</div>
            <div className="signature-box"></div>
            <p style={{ fontSize: '10px', marginTop: '5px' }}>Date: _______________</p>
          </div>
        </div>

        {/* Footer */}
        <div className="footer">
          <p>Thank you for choosing {shopInfo?.name || 'Ark Station Motorcycles'}!</p>
          <p>This job card is for workshop use only. Customer invoice will be provided separately.</p>
        </div>
      </div>
    </div>
  )
}
