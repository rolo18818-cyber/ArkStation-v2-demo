import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function WarrantyClaims({ theme: t, currentUser }) {
  const [claims, setClaims] = useState([])
  const [filter, setFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [workOrders, setWorkOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [formData, setFormData] = useState({
    work_order_id: '',
    supplier_id: '',
    claim_type: 'parts',
    description: '',
    amount: '',
    part_name: '',
    part_number: ''
  })

  useEffect(() => {
    loadClaims()
    loadWorkOrders()
    loadSuppliers()
  }, [])

  const loadClaims = async () => {
    const { data } = await supabase
      .from('warranty_claims')
      .select(`
        *,
        work_orders(job_number, description, customers(first_name, last_name)),
        suppliers(name)
      `)
      .order('created_at', { ascending: false })
    if (data) setClaims(data)
  }

  const loadWorkOrders = async () => {
    const { data } = await supabase
      .from('work_orders')
      .select(`*, customers(first_name, last_name), vehicles(registration)`)
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setWorkOrders(data)
  }

  const loadSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name')
    if (data) setSuppliers(data)
  }

  const createClaim = async () => {
    if (!formData.description) {
      alert('Please enter a description')
      return
    }

    const claimNumber = `WC-${Date.now().toString().slice(-8)}`

    try {
      const { error } = await supabase.from('warranty_claims').insert([{
        claim_number: claimNumber,
        work_order_id: formData.work_order_id || null,
        supplier_id: formData.supplier_id || null,
        claim_type: formData.claim_type,
        description: formData.description,
        amount: parseFloat(formData.amount) || 0,
        part_name: formData.part_name,
        part_number: formData.part_number,
        status: 'pending',
        created_by: currentUser?.id
      }])

      if (error) throw error

      alert(`✓ Warranty claim ${claimNumber} created!`)
      setShowCreateModal(false)
      setFormData({
        work_order_id: '', supplier_id: '', claim_type: 'parts',
        description: '', amount: '', part_name: '', part_number: ''
      })
      loadClaims()
    } catch (error) {
      alert('Error: ' + error.message)
    }
  }

  const updateClaimStatus = async (claimId, newStatus) => {
    const updates = { status: newStatus }
    if (newStatus === 'approved' || newStatus === 'rejected') {
      updates.resolved_at = new Date().toISOString()
    }
    await supabase.from('warranty_claims').update(updates).eq('id', claimId)
    loadClaims()
  }

  const deleteClaim = async (claimId) => {
    if (!confirm('Delete this claim?')) return
    await supabase.from('warranty_claims').delete().eq('id', claimId)
    loadClaims()
  }

  const filteredClaims = claims.filter(c => filter === 'all' || c.status === filter)

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500',
      submitted: 'bg-blue-500',
      approved: 'bg-green-500',
      rejected: 'bg-red-500',
      credited: 'bg-purple-500'
    }
    return <span className={`px-2 py-1 text-xs font-bold rounded ${styles[status] || 'bg-gray-500'} text-white`}>{status?.toUpperCase()}</span>
  }

  const stats = {
    pending: claims.filter(c => c.status === 'pending').length,
    submitted: claims.filter(c => c.status === 'submitted').length,
    approved: claims.filter(c => c.status === 'approved').length,
    totalValue: claims.filter(c => c.status === 'approved').reduce((sum, c) => sum + (c.amount || 0), 0)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>🛡️ Warranty Claims</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold"
        >
          + New Claim
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-yellow-500">{stats.pending}</div>
          <div className={t.textSecondary}>Pending</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-blue-500">{stats.submitted}</div>
          <div className={t.textSecondary}>Submitted</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-green-500">{stats.approved}</div>
          <div className={t.textSecondary}>Approved</div>
        </div>
        <div className={`${t.surface} rounded-lg p-4 ${t.border} border`}>
          <div className="text-3xl font-bold text-green-500">${stats.totalValue.toLocaleString()}</div>
          <div className={t.textSecondary}>Recovered</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {['all', 'pending', 'submitted', 'approved', 'rejected'].map(f => (
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

      {/* Claims List */}
      <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
        <table className="min-w-full">
          <thead className={`${t.surface} ${t.border} border-b`}>
            <tr>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Claim #</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Type</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Description</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Supplier</th>
              <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Amount</th>
              <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
              <th className={`px-4 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${t.border}`}>
            {filteredClaims.map(claim => (
              <tr key={claim.id} className={t.surfaceHover}>
                <td className="px-4 py-3">
                  <div className={`font-bold ${t.text}`}>{claim.claim_number}</div>
                  <div className={`text-xs ${t.textSecondary}`}>
                    {new Date(claim.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded ${
                    claim.claim_type === 'parts' ? 'bg-blue-600' :
                    claim.claim_type === 'labor' ? 'bg-purple-600' : 'bg-gray-600'
                  } text-white`}>
                    {claim.claim_type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className={t.text}>{claim.description}</div>
                  {claim.part_name && (
                    <div className={`text-xs ${t.textSecondary}`}>
                      Part: {claim.part_name} ({claim.part_number})
                    </div>
                  )}
                  {claim.work_orders && (
                    <div className={`text-xs ${t.textSecondary}`}>
                      Job: {claim.work_orders.job_number}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className={t.text}>{claim.suppliers?.name || '-'}</div>
                </td>
                <td className={`px-4 py-3 text-right font-bold ${t.text}`}>
                  ${claim.amount?.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center">
                  {getStatusBadge(claim.status)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-center">
                    {claim.status === 'pending' && (
                      <button
                        onClick={() => updateClaimStatus(claim.id, 'submitted')}
                        className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                      >
                        Submit
                      </button>
                    )}
                    {claim.status === 'submitted' && (
                      <>
                        <button
                          onClick={() => updateClaimStatus(claim.id, 'approved')}
                          className="text-green-500 hover:text-green-700 text-sm font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateClaimStatus(claim.id, 'rejected')}
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteClaim(claim.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredClaims.length === 0 && (
          <div className={`text-center py-12 ${t.textSecondary}`}>No warranty claims found</div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-lg ${t.border} border-2`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>New Warranty Claim</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Claim Type</label>
                  <select
                    value={formData.claim_type}
                    onChange={(e) => setFormData({ ...formData, claim_type: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                  >
                    <option value="parts">Parts Warranty</option>
                    <option value="labor">Labor Warranty</option>
                    <option value="goodwill">Goodwill</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Related Job</label>
                <select
                  value={formData.work_order_id}
                  onChange={(e) => setFormData({ ...formData, work_order_id: e.target.value })}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                >
                  <option value="">Select job (optional)...</option>
                  {workOrders.map(wo => (
                    <option key={wo.id} value={wo.id}>
                      {wo.job_number} - {wo.customers?.first_name} {wo.customers?.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Supplier</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Part Name</label>
                  <input
                    type="text"
                    value={formData.part_name}
                    onChange={(e) => setFormData({ ...formData, part_name: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="Part name..."
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Part Number</label>
                  <input
                    type="text"
                    value={formData.part_number}
                    onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                    className={`w-full px-3 py-2 ${t.input} rounded border`}
                    placeholder="Part number..."
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  className={`w-full px-3 py-2 ${t.input} rounded border`}
                  placeholder="Describe the warranty issue..."
                />
              </div>
              <button
                onClick={createClaim}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold"
              >
                ✓ Create Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
