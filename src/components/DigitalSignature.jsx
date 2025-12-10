import { useRef, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function DigitalSignature({ workOrderId, signatureType, onComplete, theme: t }) {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [signerName, setSignerName] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }, [])

  const startDrawing = (e) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const ctx = canvas.getContext('2d')
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const saveSignature = async () => {
    if (!signerName.trim()) {
      alert('Please enter signer name')
      return
    }

    const canvas = canvasRef.current
    const signatureData = canvas.toDataURL('image/png')

    const { error } = await supabase
      .from('work_order_signatures')
      .insert([{
        work_order_id: workOrderId,
        signature_type: signatureType,
        signature_data: signatureData,
        signed_by_name: signerName
      }])

    if (error) {
      alert('Error saving signature: ' + error.message)
    } else {
      alert('✓ Signature saved!')
      if (onComplete) onComplete()
    }
  }

  const labels = {
    customer_approval: 'Customer Approval',
    customer_completion: 'Customer Sign-Off',
    mechanic: 'Mechanic Signature'
  }

  return (
    <div className={`${t.surface} ${t.border} border-2 rounded-lg p-6`}>
      <h3 className={`text-xl font-bold ${t.text} mb-4`}>✍️ {labels[signatureType]}</h3>

      <div className="mb-4">
        <label className={`block text-sm font-medium ${t.text} mb-1`}>
          {signatureType.includes('customer') ? 'Customer Name' : 'Mechanic Name'} *
        </label>
        <input
          type="text"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Full name"
          className={`w-full px-3 py-2 ${t.input} rounded border`}
        />
      </div>

      <div className="mb-4">
        <label className={`block text-sm font-medium ${t.text} mb-2`}>Sign below:</label>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="border-2 border-gray-400 rounded cursor-crosshair bg-white w-full"
          style={{ touchAction: 'none' }}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={clearSignature}
          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded font-medium">
          Clear
        </button>
        <button
          onClick={saveSignature}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-medium">
          Save Signature
        </button>
      </div>
    </div>
  )
}