import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PaymentSplit from './PaymentSplit'

export default function Invoices({ theme: t }) {
  const [invoices, setInvoices] = useState([])
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    const { data } = await supabase
      .from('invoices')
      .select(`
        *,
        customers(first_name, last_name, company_name),
        work_orders(job_number)
      `)
      .order('created_at', { ascending: false })
    
    if (data) setInvoices(data)
  }

  const openPaymentModal = (invoice) => {
    setSelectedInvoice(invoice)
    setShowPaymentModal(true)
  }

  const getPaymentStatusBadge = (status) => {
    const styles = {
      unpaid: 'bg-red-500',
      partial: 'bg-orange-500',
      paid: 'bg-green-500',
      overdue: 'bg-red-700'
    }
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[status]}`}>
      {status.toUpperCase()}
    </span>
  }

  return (
    <div>
      <h2 className={`text-3xl font-bold ${t.text} mb-8`}>💰 Invoices</h2>

      <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
        <table className="min-w-full">
          <thead className={`${t.surface} ${t.border} border-b`}>
            <tr>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Invoice #</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Customer</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Job #</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Date</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Total</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Balance</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
              <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${t.border}`}>
            {invoices.map(invoice => (
              <tr key={invoice.id} className={t.surfaceHover}>
                <td className="px-6 py-4">
                  <div className={`text-sm font-bold ${t.text} font-mono`}>{invoice.invoice_number}</div>
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm ${t.text}`}>
                    {invoice.customers?.company_name || `${invoice.customers?.first_name} ${invoice.customers?.last_name}`}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm ${t.text}`}>{invoice.work_orders?.job_number || '-'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm ${t.text}`}>{new Date(invoice.invoice_date).toLocaleDateString()}</div>
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm font-bold ${t.text}`}>${invoice.total?.toFixed(2)}</div>
                </td>
                <td className="px-6 py-4">
                  <div className={`text-sm font-bold ${invoice.balance_due > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    ${invoice.balance_due?.toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-4">{getPaymentStatusBadge(invoice.payment_status)}</td>
                <td className="px-6 py-4">
                  {invoice.payment_status !== 'paid' && (
                    <button
                      onClick={() => openPaymentModal(invoice)}
                      className="text-green-500 hover:text-green-700 font-medium text-sm">
                      💳 Pay
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPaymentModal && selectedInvoice && (
        <PaymentSplit
          invoice={selectedInvoice}
          onComplete={() => {
            setShowPaymentModal(false)
            loadInvoices()
          }}
          onCancel={() => setShowPaymentModal(false)}
          theme={t}
        />
      )}
    </div>
  )
}