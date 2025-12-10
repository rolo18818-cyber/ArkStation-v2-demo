import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PaymentSplit({ invoice, onComplete, onCancel, theme: t }) {
  const [payments, setPayments] = useState([
    { method: 'cash', amount: 0 }
  ])

  const addPayment = () => {
    setPayments([...payments, { method: 'cash', amount: 0 }])
  }

  const updatePayment = (index, field, value) => {
    const updated = [...payments]
    updated[index][field] = field === 'amount' ? parseFloat(value) || 0 : value
    setPayments(updated)
  }

  const removePayment = (index) => {
    setPayments(payments.filter((_, i) => i !== index))
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = invoice.balance_due - totalPaid

  const processPayments = async () => {
    if (Math.abs(remaining) > 0.01) {
      alert(`Payment total must equal balance due ($${invoice.balance_due.toFixed(2)})`)
      return
    }

    // Insert all payments
    for (const payment of payments) {
      if (payment.amount > 0) {
        await supabase
          .from('invoice_payments')
          .insert([{
            invoice_id: invoice.id,
            amount: payment.amount,
            payment_method: payment.method,
            processed_by: 'Current User' // TODO: Get from auth
          }])
      }
    }

    // Update invoice
    await supabase
      .from('invoices')
      .update({
        payment_status: 'paid',
        amount_paid: invoice.balance_due,
        balance_due: 0
      })
      .eq('id', invoice.id)

    alert('✓ Payment processed!')
    if (onComplete) onComplete()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border-2`}>
        <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
          <div>
            <h3 className={`text-2xl font-bold ${t.text}`}>💳 Split Payment</h3>
            <p className={`text-sm ${t.textSecondary} mt-1`}>
              Invoice: {invoice.invoice_number} • Balance: ${invoice.balance_due.toFixed(2)}
            </p>
          </div>
          <button onClick={onCancel} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
        </div>

        <div className="p-6">
          <div className="space-y-4 mb-6">
            {payments.map((payment, index) => (
              <div key={index} className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                <div className="flex gap-4 items-start">
                  <div className="flex-1">
                    <label className={`block text-sm font-medium ${t.text} mb-1`}>Payment Method</label>
                    <select
                      value={payment.method}
                      onChange={(e) => updatePayment(index, 'method', e.target.value)}
                      className={`w-full px-3 py-2 ${t.input} rounded border`}>
                      <option value="cash">Cash</option>
                      <option value="card">Credit/Debit Card</option>
                      <option value="eftpos">EFTPOS</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className={`block text-sm font-medium ${t.text} mb-1`}>Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={payment.amount}
                      onChange={(e) => updatePayment(index, 'amount', e.target.value)}
                      className={`w-full px-3 py-2 ${t.input} rounded border`}
                    />
                  </div>

                  {payments.length > 1 && (
                    <button
                      onClick={() => removePayment(index)}
                      className="mt-7 text-red-500 hover:text-red-700 font-bold text-xl">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addPayment}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium mb-6">
            + Add Another Payment Method
          </button>

          <div className={`${t.surface} ${t.border} border rounded-lg p-4 mb-6`}>
            <div className="flex justify-between mb-2">
              <span className={t.textSecondary}>Balance Due:</span>
              <span className={`font-semibold ${t.text}`}>${invoice.balance_due.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className={t.textSecondary}>Total Paid:</span>
              <span className={`font-semibold ${t.text}`}>${totalPaid.toFixed(2)}</span>
            </div>
            <div className={`flex justify-between pt-2 border-t ${t.border}`}>
              <span className={`font-bold ${t.text}`}>Remaining:</span>
              <span className={`font-bold text-xl ${remaining > 0.01 ? 'text-red-500' : 'text-green-500'}`}>
                ${remaining.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-bold">
              Cancel
            </button>
            <button
              onClick={processPayments}
              disabled={Math.abs(remaining) > 0.01}
              className={`flex-1 ${Math.abs(remaining) > 0.01 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white py-3 rounded-lg font-bold`}>
              Process Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}