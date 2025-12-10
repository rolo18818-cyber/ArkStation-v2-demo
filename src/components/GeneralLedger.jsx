import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function GeneralLedger({ theme: t, currentUser }) {
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [activeTab, setActiveTab] = useState('chart')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [showTransactionForm, setShowTransactionForm] = useState(false)
  const [showJournalEntry, setShowJournalEntry] = useState(false)
  const [accountForm, setAccountForm] = useState({
    code: '',
    name: '',
    type: 'asset',
    subtype: '',
    description: '',
    is_active: true,
    tax_code: '',
    opening_balance: ''
  })
  const [journalEntry, setJournalEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    lines: [
      { account_id: '', debit: '', credit: '', description: '' },
      { account_id: '', debit: '', credit: '', description: '' }
    ]
  })

  useEffect(() => {
    // Set default date range to current month
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    setDateRange({ start, end })
    loadAccounts()
  }, [])

  useEffect(() => {
    if (selectedAccount && dateRange.start && dateRange.end) {
      loadTransactions()
    }
  }, [selectedAccount, dateRange])

  const loadAccounts = async () => {
    const { data } = await supabase
      .from('gl_accounts')
      .select('*')
      .order('code')
    if (data) setAccounts(data)
  }

  const loadTransactions = async () => {
    if (!selectedAccount) return
    
    const { data } = await supabase
      .from('gl_transactions')
      .select('*')
      .eq('account_id', selectedAccount.id)
      .gte('date', dateRange.start)
      .lte('date', dateRange.end)
      .order('date')
      .order('created_at')
    
    if (data) {
      // Calculate running balance
      let balance = selectedAccount.opening_balance || 0
      const withBalance = data.map(tx => {
        if (selectedAccount.type === 'asset' || selectedAccount.type === 'expense') {
          balance += (tx.debit || 0) - (tx.credit || 0)
        } else {
          balance += (tx.credit || 0) - (tx.debit || 0)
        }
        return { ...tx, running_balance: balance }
      })
      setTransactions(withBalance)
    }
  }

  // Account Types and Subtypes
  const accountTypes = {
    asset: {
      label: 'Assets',
      code: '1',
      subtypes: ['Bank', 'Accounts Receivable', 'Inventory', 'Equipment', 'Other Current Asset', 'Fixed Asset']
    },
    liability: {
      label: 'Liabilities',
      code: '2',
      subtypes: ['Accounts Payable', 'Credit Card', 'Loan', 'GST Payable', 'Other Current Liability', 'Long-term Liability']
    },
    equity: {
      label: 'Equity',
      code: '3',
      subtypes: ['Owner Equity', 'Retained Earnings', 'Drawings']
    },
    revenue: {
      label: 'Revenue',
      code: '4',
      subtypes: ['Sales', 'Service Revenue', 'Parts Revenue', 'Other Income']
    },
    expense: {
      label: 'Expenses',
      code: '5',
      subtypes: ['Cost of Goods Sold', 'Wages', 'Rent', 'Utilities', 'Insurance', 'Marketing', 'Office Expenses', 'Other Expense']
    }
  }

  const generateAccountCode = (type, subtype) => {
    const typeCode = accountTypes[type]?.code || '9'
    const existingCodes = accounts.filter(a => a.type === type).map(a => parseInt(a.code))
    const maxCode = existingCodes.length > 0 ? Math.max(...existingCodes) : parseInt(typeCode + '000')
    return (maxCode + 10).toString()
  }

  const openAccountForm = (account = null) => {
    if (account) {
      setAccountForm({
        code: account.code,
        name: account.name,
        type: account.type,
        subtype: account.subtype || '',
        description: account.description || '',
        is_active: account.is_active !== false,
        tax_code: account.tax_code || '',
        opening_balance: account.opening_balance || ''
      })
    } else {
      setAccountForm({
        code: '',
        name: '',
        type: 'asset',
        subtype: '',
        description: '',
        is_active: true,
        tax_code: '',
        opening_balance: ''
      })
    }
    setShowAccountForm(true)
  }

  const saveAccount = async () => {
    if (!accountForm.code || !accountForm.name) {
      alert('Please fill in account code and name')
      return
    }

    const saveData = {
      ...accountForm,
      opening_balance: accountForm.opening_balance ? parseFloat(accountForm.opening_balance) : 0
    }

    const { error } = await supabase.from('gl_accounts').upsert([saveData], { onConflict: 'code' })
    if (error) { alert('Error: ' + error.message); return }
    
    setShowAccountForm(false)
    loadAccounts()
  }

  const deleteAccount = async (account) => {
    if (!confirm(`Delete account ${account.code} - ${account.name}?`)) return
    await supabase.from('gl_accounts').delete().eq('id', account.id)
    loadAccounts()
  }

  // Journal Entry Functions
  const addJournalLine = () => {
    setJournalEntry({
      ...journalEntry,
      lines: [...journalEntry.lines, { account_id: '', debit: '', credit: '', description: '' }]
    })
  }

  const removeJournalLine = (index) => {
    if (journalEntry.lines.length <= 2) return
    setJournalEntry({
      ...journalEntry,
      lines: journalEntry.lines.filter((_, i) => i !== index)
    })
  }

  const updateJournalLine = (index, field, value) => {
    const lines = [...journalEntry.lines]
    lines[index][field] = value
    // Clear the other amount field
    if (field === 'debit' && value) lines[index].credit = ''
    if (field === 'credit' && value) lines[index].debit = ''
    setJournalEntry({ ...journalEntry, lines })
  }

  const journalTotals = {
    debit: journalEntry.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0),
    credit: journalEntry.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0)
  }

  const isBalanced = Math.abs(journalTotals.debit - journalTotals.credit) < 0.01

  const saveJournalEntry = async () => {
    if (!journalEntry.date || !journalEntry.description) {
      alert('Please fill in date and description')
      return
    }
    if (!isBalanced) {
      alert('Journal entry must balance (debits = credits)')
      return
    }

    // Generate reference if not provided
    const reference = journalEntry.reference || `JE-${Date.now().toString().slice(-6)}`

    // Insert each line as a transaction
    for (const line of journalEntry.lines) {
      if (!line.account_id || (!line.debit && !line.credit)) continue
      
      await supabase.from('gl_transactions').insert([{
        account_id: line.account_id,
        date: journalEntry.date,
        reference,
        description: line.description || journalEntry.description,
        debit: line.debit ? parseFloat(line.debit) : 0,
        credit: line.credit ? parseFloat(line.credit) : 0,
        created_by: currentUser?.id
      }])
    }

    alert('✓ Journal entry saved!')
    setShowJournalEntry(false)
    setJournalEntry({
      date: new Date().toISOString().split('T')[0],
      reference: '',
      description: '',
      lines: [
        { account_id: '', debit: '', credit: '', description: '' },
        { account_id: '', debit: '', credit: '', description: '' }
      ]
    })
    if (selectedAccount) loadTransactions()
  }

  // Calculate account balance
  const getAccountBalance = (account) => {
    const txs = transactions.filter(t => t.account_id === account.id)
    let balance = account.opening_balance || 0
    txs.forEach(tx => {
      if (account.type === 'asset' || account.type === 'expense') {
        balance += (tx.debit || 0) - (tx.credit || 0)
      } else {
        balance += (tx.credit || 0) - (tx.debit || 0)
      }
    })
    return balance
  }

  // Group accounts by type
  const accountsByType = Object.keys(accountTypes).reduce((acc, type) => {
    acc[type] = accounts.filter(a => a.type === type)
    return acc
  }, {})

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-3xl font-bold ${t.text}`}>📒 General Ledger</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowJournalEntry(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">
            + Journal Entry
          </button>
          <button onClick={() => openAccountForm()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
            + New Account
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex gap-2 mb-6 ${t.border} border-b pb-2`}>
        {['chart', 'ledger', 'trial'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg font-medium ${
              activeTab === tab ? 'bg-blue-600 text-white' : `${t.text} ${t.surfaceHover}`
            }`}
          >
            {tab === 'chart' ? 'Chart of Accounts' : tab === 'ledger' ? 'Account Ledger' : 'Trial Balance'}
          </button>
        ))}
      </div>

      {/* Chart of Accounts Tab */}
      {activeTab === 'chart' && (
        <div className="space-y-6">
          {Object.entries(accountTypes).map(([type, config]) => {
            const typeAccounts = accountsByType[type] || []
            const typeTotal = typeAccounts.reduce((sum, a) => sum + (a.opening_balance || 0), 0)
            
            return (
              <div key={type} className={`${t.surface} rounded-lg ${t.border} border overflow-hidden`}>
                <div className={`${t.border} border-b p-4 flex justify-between items-center`}>
                  <div>
                    <h3 className={`text-lg font-bold ${t.text}`}>{config.label}</h3>
                    <span className={`text-xs ${t.textSecondary}`}>{typeAccounts.length} accounts</span>
                  </div>
                  <div className={`text-lg font-bold ${type === 'asset' || type === 'expense' ? 'text-blue-500' : 'text-green-500'}`}>
                    ${typeTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                {typeAccounts.length > 0 ? (
                  <table className="min-w-full">
                    <thead className={`${t.border} border-b`}>
                      <tr>
                        <th className={`px-4 py-2 text-left text-xs font-medium ${t.textSecondary} uppercase w-24`}>Code</th>
                        <th className={`px-4 py-2 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Name</th>
                        <th className={`px-4 py-2 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Subtype</th>
                        <th className={`px-4 py-2 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Tax</th>
                        <th className={`px-4 py-2 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Balance</th>
                        <th className={`px-4 py-2 text-center text-xs font-medium ${t.textSecondary} uppercase w-24`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${t.border}`}>
                      {typeAccounts.map(account => (
                        <tr 
                          key={account.id} 
                          className={`${t.surfaceHover} cursor-pointer`}
                          onClick={() => { setSelectedAccount(account); setActiveTab('ledger') }}
                        >
                          <td className={`px-4 py-2 font-mono ${t.text}`}>{account.code}</td>
                          <td className={`px-4 py-2 font-medium ${t.text}`}>{account.name}</td>
                          <td className={`px-4 py-2 ${t.textSecondary}`}>{account.subtype || '-'}</td>
                          <td className={`px-4 py-2 ${t.textSecondary}`}>{account.tax_code || '-'}</td>
                          <td className={`px-4 py-2 text-right font-mono ${t.text}`}>
                            ${(account.opening_balance || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => openAccountForm(account)} className="text-blue-500 hover:text-blue-400 text-sm mr-2">
                              Edit
                            </button>
                            <button onClick={() => deleteAccount(account)} className="text-red-500 hover:text-red-400 text-sm">
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className={`text-center py-4 ${t.textSecondary}`}>No accounts</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Ledger Tab */}
      {activeTab === 'ledger' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Account List */}
          <div className="col-span-3">
            <div className={`${t.surface} rounded-lg ${t.border} border overflow-hidden`}>
              <div className={`${t.border} border-b p-3`}>
                <h3 className={`font-bold ${t.text}`}>Accounts</h3>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {accounts.map(account => (
                  <div
                    key={account.id}
                    onClick={() => setSelectedAccount(account)}
                    className={`p-3 ${t.border} border-b cursor-pointer transition-colors ${
                      selectedAccount?.id === account.id ? 'bg-blue-600' : t.surfaceHover
                    }`}
                  >
                    <div className={`font-mono text-xs ${selectedAccount?.id === account.id ? 'text-blue-200' : t.textSecondary}`}>
                      {account.code}
                    </div>
                    <div className={`font-medium ${selectedAccount?.id === account.id ? 'text-white' : t.text}`}>
                      {account.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ledger View */}
          <div className="col-span-9">
            {selectedAccount ? (
              <div className={`${t.surface} rounded-lg ${t.border} border overflow-hidden`}>
                <div className={`${t.border} border-b p-4`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className={`text-sm font-mono ${t.textSecondary}`}>{selectedAccount.code}</div>
                      <h3 className={`text-xl font-bold ${t.text}`}>{selectedAccount.name}</h3>
                    </div>
                    <div className="flex gap-4 items-center">
                      <div>
                        <input
                          type="date"
                          value={dateRange.start}
                          onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                          className={`px-2 py-1 ${t.input} rounded border text-sm`}
                        />
                        <span className={`mx-2 ${t.textSecondary}`}>to</span>
                        <input
                          type="date"
                          value={dateRange.end}
                          onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                          className={`px-2 py-1 ${t.input} rounded border text-sm`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <table className="min-w-full">
                  <thead className={`${t.border} border-b`}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Date</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Reference</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Description</th>
                      <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Debit</th>
                      <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Credit</th>
                      <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Balance</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${t.border}`}>
                    {/* Opening Balance Row */}
                    <tr className={t.surface}>
                      <td className={`px-4 py-2 ${t.textSecondary}`}>{dateRange.start}</td>
                      <td className={`px-4 py-2 ${t.textSecondary}`}>-</td>
                      <td className={`px-4 py-2 ${t.textSecondary} italic`}>Opening Balance</td>
                      <td className={`px-4 py-2 text-right ${t.textSecondary}`}>-</td>
                      <td className={`px-4 py-2 text-right ${t.textSecondary}`}>-</td>
                      <td className={`px-4 py-2 text-right font-mono font-bold ${t.text}`}>
                        ${(selectedAccount.opening_balance || 0).toFixed(2)}
                      </td>
                    </tr>
                    {transactions.map(tx => (
                      <tr key={tx.id} className={t.surfaceHover}>
                        <td className={`px-4 py-2 ${t.text}`}>{new Date(tx.date).toLocaleDateString()}</td>
                        <td className={`px-4 py-2 font-mono text-sm ${t.textSecondary}`}>{tx.reference}</td>
                        <td className={`px-4 py-2 ${t.text}`}>{tx.description}</td>
                        <td className={`px-4 py-2 text-right font-mono ${tx.debit ? 'text-blue-500' : t.textSecondary}`}>
                          {tx.debit ? `$${tx.debit.toFixed(2)}` : '-'}
                        </td>
                        <td className={`px-4 py-2 text-right font-mono ${tx.credit ? 'text-green-500' : t.textSecondary}`}>
                          {tx.credit ? `$${tx.credit.toFixed(2)}` : '-'}
                        </td>
                        <td className={`px-4 py-2 text-right font-mono font-bold ${t.text}`}>
                          ${tx.running_balance?.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className={`${t.border} border-t`}>
                    <tr>
                      <td colSpan="3" className={`px-4 py-3 font-bold ${t.text}`}>Period Totals</td>
                      <td className={`px-4 py-3 text-right font-mono font-bold text-blue-500`}>
                        ${transactions.reduce((sum, tx) => sum + (tx.debit || 0), 0).toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-bold text-green-500`}>
                        ${transactions.reduce((sum, tx) => sum + (tx.credit || 0), 0).toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-bold text-lg ${t.text}`}>
                        ${(transactions[transactions.length - 1]?.running_balance || selectedAccount.opening_balance || 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className={`${t.surface} rounded-lg p-12 text-center ${t.border} border`}>
                <div className="text-4xl mb-4">📒</div>
                <div className={`font-bold ${t.text}`}>Select an account to view ledger</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trial Balance Tab */}
      {activeTab === 'trial' && (
        <div className={`${t.surface} rounded-lg ${t.border} border overflow-hidden`}>
          <div className={`${t.border} border-b p-4 flex justify-between items-center`}>
            <h3 className={`text-lg font-bold ${t.text}`}>Trial Balance</h3>
            <div className={t.textSecondary}>As at {new Date().toLocaleDateString()}</div>
          </div>
          <table className="min-w-full">
            <thead className={`${t.border} border-b`}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Code</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Account</th>
                <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Debit</th>
                <th className={`px-4 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Credit</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.border}`}>
              {accounts.map(account => {
                const balance = account.opening_balance || 0
                const isDebit = account.type === 'asset' || account.type === 'expense'
                const displayDebit = isDebit && balance > 0 ? balance : (!isDebit && balance < 0 ? Math.abs(balance) : 0)
                const displayCredit = !isDebit && balance > 0 ? balance : (isDebit && balance < 0 ? Math.abs(balance) : 0)
                
                if (displayDebit === 0 && displayCredit === 0) return null
                
                return (
                  <tr key={account.id} className={t.surfaceHover}>
                    <td className={`px-4 py-2 font-mono ${t.textSecondary}`}>{account.code}</td>
                    <td className={`px-4 py-2 ${t.text}`}>{account.name}</td>
                    <td className={`px-4 py-2 text-right font-mono ${displayDebit ? 'text-blue-500' : t.textSecondary}`}>
                      {displayDebit ? `$${displayDebit.toFixed(2)}` : '-'}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${displayCredit ? 'text-green-500' : t.textSecondary}`}>
                      {displayCredit ? `$${displayCredit.toFixed(2)}` : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className={`${t.border} border-t-2`}>
              <tr>
                <td colSpan="2" className={`px-4 py-3 font-bold ${t.text}`}>TOTALS</td>
                <td className={`px-4 py-3 text-right font-mono font-bold text-xl text-blue-500`}>
                  ${accounts.reduce((sum, a) => {
                    const bal = a.opening_balance || 0
                    const isDebit = a.type === 'asset' || a.type === 'expense'
                    return sum + (isDebit && bal > 0 ? bal : (!isDebit && bal < 0 ? Math.abs(bal) : 0))
                  }, 0).toFixed(2)}
                </td>
                <td className={`px-4 py-3 text-right font-mono font-bold text-xl text-green-500`}>
                  ${accounts.reduce((sum, a) => {
                    const bal = a.opening_balance || 0
                    const isDebit = a.type === 'asset' || a.type === 'expense'
                    return sum + (!isDebit && bal > 0 ? bal : (isDebit && bal < 0 ? Math.abs(bal) : 0))
                  }, 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Account Form Modal */}
      {showAccountForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-lg ${t.border} border`}>
            <div className={`${t.border} border-b p-4 flex justify-between items-center`}>
              <h3 className={`text-xl font-bold ${t.text}`}>
                {accountForm.code ? 'Edit Account' : 'New Account'}
              </h3>
              <button onClick={() => setShowAccountForm(false)} className="text-red-500 text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Account Type *</label>
                  <select
                    value={accountForm.type}
                    onChange={(e) => {
                      const type = e.target.value
                      setAccountForm({
                        ...accountForm,
                        type,
                        subtype: '',
                        code: generateAccountCode(type)
                      })
                    }}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  >
                    {Object.entries(accountTypes).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Subtype</label>
                  <select
                    value={accountForm.subtype}
                    onChange={(e) => setAccountForm({...accountForm, subtype: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  >
                    <option value="">Select...</option>
                    {accountTypes[accountForm.type]?.subtypes.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Code *</label>
                  <input
                    type="text"
                    value={accountForm.code}
                    onChange={(e) => setAccountForm({...accountForm, code: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border font-mono`}
                  />
                </div>
                <div className="col-span-2">
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Account Name *</label>
                  <input
                    type="text"
                    value={accountForm.name}
                    onChange={(e) => setAccountForm({...accountForm, name: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                    placeholder="e.g., Business Cheque Account"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Tax Code</label>
                  <select
                    value={accountForm.tax_code}
                    onChange={(e) => setAccountForm({...accountForm, tax_code: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  >
                    <option value="">None</option>
                    <option value="GST">GST (10%)</option>
                    <option value="GST-Free">GST-Free</option>
                    <option value="Input-Taxed">Input Taxed</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Opening Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    value={accountForm.opening_balance}
                    onChange={(e) => setAccountForm({...accountForm, opening_balance: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${t.text} mb-1`}>Description</label>
                <input
                  type="text"
                  value={accountForm.description}
                  onChange={(e) => setAccountForm({...accountForm, description: e.target.value})}
                  className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  placeholder="Optional description..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={saveAccount} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">
                  💾 Save Account
                </button>
                <button onClick={() => setShowAccountForm(false)} className={`flex-1 ${t.surface} ${t.text} ${t.border} border py-3 rounded-lg`}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Journal Entry Modal */}
      {showJournalEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-4xl ${t.border} border max-h-[90vh] overflow-y-auto`}>
            <div className={`${t.border} border-b p-4 flex justify-between items-center sticky top-0 ${t.surface}`}>
              <h3 className={`text-xl font-bold ${t.text}`}>Journal Entry</h3>
              <button onClick={() => setShowJournalEntry(false)} className="text-red-500 text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Date *</label>
                  <input
                    type="date"
                    value={journalEntry.date}
                    onChange={(e) => setJournalEntry({...journalEntry, date: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Reference</label>
                  <input
                    type="text"
                    value={journalEntry.reference}
                    onChange={(e) => setJournalEntry({...journalEntry, reference: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                    placeholder="Auto-generated if blank"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${t.text} mb-1`}>Description *</label>
                  <input
                    type="text"
                    value={journalEntry.description}
                    onChange={(e) => setJournalEntry({...journalEntry, description: e.target.value})}
                    className={`w-full px-3 py-2 ${t.input} rounded-lg border`}
                    placeholder="e.g., Monthly depreciation"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className={`text-sm font-medium ${t.text}`}>Journal Lines</label>
                  <button onClick={addJournalLine} className="text-blue-500 hover:text-blue-400 text-sm">
                    + Add Line
                  </button>
                </div>
                
                <table className="min-w-full">
                  <thead>
                    <tr className={`${t.border} border-b`}>
                      <th className={`px-2 py-2 text-left text-xs font-medium ${t.textSecondary}`}>Account</th>
                      <th className={`px-2 py-2 text-left text-xs font-medium ${t.textSecondary}`}>Description</th>
                      <th className={`px-2 py-2 text-right text-xs font-medium ${t.textSecondary} w-32`}>Debit</th>
                      <th className={`px-2 py-2 text-right text-xs font-medium ${t.textSecondary} w-32`}>Credit</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalEntry.lines.map((line, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1">
                          <select
                            value={line.account_id}
                            onChange={(e) => updateJournalLine(i, 'account_id', e.target.value)}
                            className={`w-full px-2 py-1 ${t.input} rounded border text-sm`}
                          >
                            <option value="">Select account...</option>
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => updateJournalLine(i, 'description', e.target.value)}
                            className={`w-full px-2 py-1 ${t.input} rounded border text-sm`}
                            placeholder="Line description..."
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="0.01"
                            value={line.debit}
                            onChange={(e) => updateJournalLine(i, 'debit', e.target.value)}
                            className={`w-full px-2 py-1 ${t.input} rounded border text-sm text-right`}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            step="0.01"
                            value={line.credit}
                            onChange={(e) => updateJournalLine(i, 'credit', e.target.value)}
                            className={`w-full px-2 py-1 ${t.input} rounded border text-sm text-right`}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-2 py-1">
                          {journalEntry.lines.length > 2 && (
                            <button onClick={() => removeJournalLine(i)} className="text-red-500 hover:text-red-400">
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className={`${t.border} border-t`}>
                    <tr>
                      <td colSpan="2" className={`px-2 py-2 text-right font-bold ${t.text}`}>Totals:</td>
                      <td className={`px-2 py-2 text-right font-mono font-bold ${journalTotals.debit ? 'text-blue-500' : t.textSecondary}`}>
                        ${journalTotals.debit.toFixed(2)}
                      </td>
                      <td className={`px-2 py-2 text-right font-mono font-bold ${journalTotals.credit ? 'text-green-500' : t.textSecondary}`}>
                        ${journalTotals.credit.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan="5" className={`px-2 py-2 text-center font-bold ${isBalanced ? 'text-green-500' : 'text-red-500'}`}>
                        {isBalanced ? '✓ Balanced' : `⚠ Out of balance by $${Math.abs(journalTotals.debit - journalTotals.credit).toFixed(2)}`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={saveJournalEntry} 
                  disabled={!isBalanced}
                  className={`flex-1 ${isBalanced ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 cursor-not-allowed'} text-white py-3 rounded-lg font-bold`}
                >
                  💾 Post Journal Entry
                </button>
                <button onClick={() => setShowJournalEntry(false)} className={`flex-1 ${t.surface} ${t.text} ${t.border} border py-3 rounded-lg`}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
