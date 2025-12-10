import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PaymentPlans({ theme: t, currentUser }) {
  const [plans, setPlans] = useState([])
  const [invoices, setInvoices] = useState([])
  const [filter, setFilter] = useState('active')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [formData, setFormData] = useState({
    invoice_id: '',
    num_installments: 4,
    frequency: 'weekly',
    start_date: new Date().toISOString().split('T')[0],
    deposit_amount: 0
  })
  const [paymentAmount, setPaymentAmount] = useState('')

  useEffect(() => {
    loadPlans()
    loadUnpaidInvoices()
  }, [])

  const loadPlans = async () => {
    const { data } = await supabase
      .from('payment_plans')
      .select(`
        *,
        invoices(invoice_number, grand_total, customers(first_name, last_name, phone)),
        payment_plan_installments(*)
      `)
      .order('created_at', { ascending: false })
    if (data) setPlans(data)
  }

  const loadUnpaidInvoices = async () => {
    const { data } = await supabase
      .from('invoices')
      .select(`*, customers(first_name, last_name)`)
      .in('status', ['pending', 'partial'])
      .gt('balance_due', 0)
      .order('created_at', { ascending: false })
    if (data) setInvoices(data)
  }

  const openCreatePlan = () => {
    setFormData({
      invoice_id: '',
      num_installments: 4,
      frequency: 'weekly',
      start_date: new Date().toISOString().split('T')[0],
      deposit_amount: 0
    })
    setShowCreateModal(true)
  }

  const calculateInstallments = () => {
    const invoice = invoices.find(i => i.id === formData.invoice_id)
    if (!invoice) return []

    const totalAmount = invoice.balance_due - (parseFloat(formData.deposit_amount) || 0)
    const installmentAmount = totalAmount / formData.num_installments
    const installments = []

    let currentDate = new Date(formData.start_date)
    for (let i = 0; i < formData.num_installments; i++) {
      installments.push({
        number: i + 1,
        due_date: currentDate.toISOString().split('T')[0],
        amount: installmentAmount
      })

      // Calculate next date based on frequency
      if (formData.frequency === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7)
      } else if (formData.frequency === 'fortnightly') {
        currentDate.setDate(currentDate.getDate() + 14)
      } else if (formData.frequency === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1)
      }
    }

    return installments
  }

  const createPlan = async () => {
    if (!formData.invoice_id) {
      alert('Please select an invoice')
      return
    }

    const invoice = invoices.find(i => i.id === formData.invoice_id)
    const installments = calculateInstallments()
    const totalAmount = invoice.balance_due

    try {
      // Create payment plan
      const { data: plan, error } = await supabase
        .from('payment_plans')
        .insert([{
          invoice_id: formData.invoice_id,
          total_amount: totalAmount,
          deposit_amount: parseFloat(formData.deposit_amount) || 0,
          num_installments: formData.num_installments,
          frequency: formData.frequency,
          start_date: formData.start_date,
          status: 'active',
          amount_paid: parseFloat(formData.deposit_amount) || 0,
          amount_remaining: totalAmount - (parseFloat(formData.deposit_amount) || 0)
        }])
        .select()
        .single()

      if (error) throw error

      // Create installments
      const installmentInserts = installments.map(inst => ({
        payment_plan_id: plan.id,
        installment_number: inst.number,
        due_date: inst.due_date,
        amount: inst.amount,
        status: 'pending'
      }))

      await supabase.from('payment_plan_installments').insert(installmentInserts)

      // If deposit paid, record it
      if (formData.deposit_amount > 0) {
        await supabase.from('payment_plan_payments').insert([{
          payment_plan_id: plan.id,
          amount: formData.deposit_amount,
          payment_method: 'deposit',
          notes: 'Initial deposit'
        }])
      }

      // Update invoice to 'payment_plan' status
      await supabase
        .from('invoices')
        .update({ status: 'payment_plan' })
        .eq('id', formData.invoice_id)

      alert('✓ Payment plan created!')
      setShowCreateModal(false)
      loadPlans()
      loadUnpaidInvoices()
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  const openPaymentModal = (plan) => {
    setSelectedPlan(plan)
    const nextInstallment = plan.payment_plan_installments?.find(i => i.status === 'pending')
    setPaymentAmount(nextInstallment?.amount?.toFixed(2) || '')
    setShowPaymentModal(true)
  }

  const recordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert('Please enter a valid amount')
      return
    }

    const amount = parseFloat(paymentAmount)

    try {
      // Record payment
      await supabase.from('payment_plan_payments').insert([{
        payment_plan_id: selectedPlan.id,
        amount: amount,
        payment_method: 'card'
      }])

      // Update plan totals
      const newPaid = (selectedPlan.amount_paid || 0) + amount
      const newRemaining = selectedPlan.total_amount - newPaid

      await supabase
        .from('payment_plans')
        .update({
          amount_paid: newPaid,
          amount_remaining: newRemaining,
          status: newRemaining <= 0 ? 'completed' : 'active'
        })
        .eq('id', selectedPlan.id)

      // Mark installment(s) as paid
      let remainingPayment = amount
      const pendingInstallments = selectedPlan.payment_plan_installments
        ?.filter(i => i.status === 'pending')
        .sort((a, b) => a.installment_number - b.installment_number)

      for (const inst of pendingInstallments || []) {
        if (remainingPayment >= inst.amount) {
          await supabase
            .from('payment_plan_installments')
            .update({ status: 'paid', paid_date: new Date().toISOString() })
            .eq('id', inst.id)
          remainingPayment -= inst.amount
        } else if (remainingPayment > 0) {
          // Partial payment - mark as partial
          await supabase
            .from('payment_plan_installments')
            .update({ status: 'partial' })
            .eq('id', inst.id)
          break
        }
      }

      // If plan completed, update invoice
      if (newRemaining <= 0) {
        await supabase
          .from('invoices')
          .update({ status: 'paid', balance_due: 0 })
          .eq('id', selectedPlan.invoice_id)
      }

      alert('✓ Payment recorded!')
      setShowPaymentModal(false)
      loadPlans()
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  const cancelPlan = async (planId) => {
    if (!confirm('Cancel this payment plan? The invoice will return to unpaid status.')) return

    const plan = plans.find(p => p.id === planId)

    await supabase.from('payment_plans').update({ status: 'cancelled' }).eq('id', planId)
    await supabase.from('invoices').update({ status: 'partial' }).eq('id', plan.invoice_id)

    loadPlans()
    loadUnpaidInvoices()
  }

  const filteredPlans = plans.filter(p => {
    if (filter === 'all') return true
    return p.status === filter
  })

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-blue-500',
      completed: 'bg-green-500',
      cancelled: 'bg-red-500',
      overdue: 'bg-orange-500'
    }
    return <span className={`px-2 py-1 text-xs font-bold rounded ${styles[status] || 'bg-gray-500'} text-white`}>{status?.toUpperCase()}</span>
  }

  const getProgress = (plan) => {
    if (!plan.total_amount) return 0
    return Math.round((plan.amount_paid / plan.total_amount) * 100)
  }

  const getNextDueDate = (plan) => {
    const next = plan.payment_plan_installments?.find(i => i.status === 'pending')
    return next ? new Date(next.due_date).toLocaleDateString() : 'Complete'
  }

  const installments = calculateInstallments()
  const selectedInvoice = invoices.find(i => i.id === formData.invoice_id)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>💳 Payment Plans</h2>
        <button
          onClick={openCreatePlan}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold"
        >
          + New Plan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-blue-500">{plans.filter(p => p.status === 'active').length}</div>
          <div className={t.textSecondary}>Active Plans</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-green-500">
            ${plans.filter(p => p.status === 'active').reduce((sum, p) => sum + (p.amount_paid || 0), 0).toLocaleString()}
          </div>
          <div className={t.textSecondary}>Collected</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-orange-500">
            ${plans.filter(p => p.status === 'active').reduce((sum, p) => sum + (p.amount_remaining || 0), 0).toLocaleString()}
          </div>
          <div className={t.textSecondary}>Outstanding</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-green-500">{plans.filter(p => p.status === 'completed').length}</div>
          <div className={t.textSecondary}>Completed</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {['active', 'completed', 'cancelled', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium capitalize ${
              filter === f ? 'bg-blue-600 text-white' : `${t.surface} ${t.text} ${t.border} border`
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Plans List */}
      <div className="space-y-4">
        {filteredPlans.map(plan => (
          <div key={plan.id} className={`${t.surface} rounded-lg p-6 ${t.border} border`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className={`text-lg font-bold ${t.text}`}>
                  {plan.invoices?.customers?.first_name} {plan.invoices?.customers?.last_name}
                </div>
                <div className={`text-sm ${t.textSecondary}`}>
                  Invoice: {plan.invoices?.invoice_number} • {plan.frequency}
                </div>
              </div>
              <div className="text-right">
                {getStatusBadge(plan.status)}
                <div className={`text-sm ${t.textSecondary} mt-1`}>
                  Next due: {getNextDueDate(plan)}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className={t.textSecondary}>Progress</span>
                <span className={`font-bold ${t.text}`}>{getProgress(plan)}%</span>
              </div>
              <div className={`w-full h-3 rounded-full ${t.border} border overflow-hidden`}>
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${getProgress(plan)}%` }}
                />
              </div>
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div className={`text-xs ${t.textSecondary}`}>Total</div>
                <div className={`text-lg font-bold ${t.text}`}>${plan.total_amount?.toFixed(2)}</div>
              </div>
              <div>
                <div className={`text-xs ${t.textSecondary}`}>Paid</div>
                <div className="text-lg font-bold text-green-500">${plan.amount_paid?.toFixed(2)}</div>
              </div>
              <div>
                <div className={`text-xs ${t.textSecondary}`}>Remaining</div>
                <div className="text-lg font-bold text-orange-500">${plan.amount_remaining?.toFixed(2)}</div>
              </div>
            </div>

            {/* Installments */}
            <div className={`${t.surface} ${t.border} border rounded-lg p-3 mb-4`}>
              <div className={`text-sm font-bold ${t.text} mb-2`}>Installments</div>
              <div className="flex gap-2 flex-wrap">
                {plan.payment_plan_installments?.sort((a, b) => a.installment_number - b.installment_number).map(inst => (
                  <div
                    key={inst.id}
                    className={`px-3 py-2 rounded text-sm ${
                      inst.status === 'paid' ? 'bg-green-600 text-white' :
                      inst.status === 'partial' ? 'bg-yellow-600 text-white' :
                      'bg-gray-600 text-white'
                    }`}
                  >
                    <div className="font-bold">#{inst.installment_number}</div>
                    <div className="text-xs">${inst.amount?.toFixed(2)}</div>
                    <div className="text-xs">{new Date(inst.due_date).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            {plan.status === 'active' && (
              <div className="flex gap-3">
                <button
                  onClick={() => openPaymentModal(plan)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold"
                >
                  💵 Record Payment
                </button>
                <button
                  onClick={() => cancelPlan(plan.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ))}

        {filteredPlans.length === 0 && (
          <div className={`${t.surface} rounded-lg p-12 text-center ${t.border} border`}>
            <div className="text-6xl mb-4">💳</div>
            <div className={`text-xl ${t.text}`}>No payment plans found</div>
          </div>
        )}
      </div>

      {/* Create Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border-2 max-h-[90vh] overflow-y-auto`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center sticky top-0`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Create Payment Plan</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Select Invoice *</label>
                <select
                  value={formData.invoice_id}
                  onChange={(e) => setFormData({ ...formData, invoice_id: e.target.value })}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                >
                  <option value="">Choose an invoice...</option>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} - {inv.customers?.first_name} {inv.customers?.last_name} - ${inv.balance_due?.toFixed(2)} due
                    </option>
                  ))}
                </select>
              </div>

              {selectedInvoice && (
                <div className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                  <div className={`text-lg font-bold ${t.text}`}>Invoice Total: ${selectedInvoice.grand_total?.toFixed(2)}</div>
                  <div className={`text-sm ${t.textSecondary}`}>Balance Due: ${selectedInvoice.balance_due?.toFixed(2)}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Deposit Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.deposit_amount}
                    onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Number of Installments</label>
                  <select
                    value={formData.num_installments}
                    onChange={(e) => setFormData({ ...formData, num_installments: parseInt(e.target.value) })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  >
                    {[2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                      <option key={n} value={n}>{n} installments</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Frequency</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>First Payment Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  />
                </div>
              </div>

              {/* Preview Installments */}
              {selectedInvoice && installments.length > 0 && (
                <div className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                  <div className={`text-sm font-bold ${t.text} mb-3`}>Payment Schedule Preview</div>
                  <div className="space-y-2">
                    {formData.deposit_amount > 0 && (
                      <div className="flex justify-between p-2 bg-green-900 bg-opacity-30 rounded">
                        <span className={t.text}>Deposit (Today)</span>
                        <span className="font-bold text-green-500">${parseFloat(formData.deposit_amount).toFixed(2)}</span>
                      </div>
                    )}
                    {installments.map(inst => (
                      <div key={inst.number} className="flex justify-between p-2 bg-gray-700 bg-opacity-30 rounded">
                        <span className={t.text}>Payment #{inst.number} - {new Date(inst.due_date).toLocaleDateString()}</span>
                        <span className={`font-bold ${t.text}`}>${inst.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className={`flex justify-between p-2 ${t.border} border-t mt-2 pt-2`}>
                      <span className={`font-bold ${t.text}`}>Total</span>
                      <span className="font-bold text-green-500">${selectedInvoice.balance_due?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={createPlan}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold"
              >
                ✓ Create Payment Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-md ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>Record Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className={`${t.surface} ${t.border} border rounded-lg p-4`}>
                <div className={`text-sm ${t.textSecondary}`}>Customer</div>
                <div className={`text-lg font-bold ${t.text}`}>
                  {selectedPlan.invoices?.customers?.first_name} {selectedPlan.invoices?.customers?.last_name}
                </div>
                <div className={`text-sm ${t.textSecondary} mt-2`}>Remaining Balance</div>
                <div className="text-xl font-bold text-orange-500">${selectedPlan.amount_remaining?.toFixed(2)}</div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Payment Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className={`w-full px-3 py-3 ${t.input} rounded border text-lg`}
                  placeholder="0.00"
                />
              </div>

              <button
                onClick={recordPayment}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold"
              >
                💵 Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
