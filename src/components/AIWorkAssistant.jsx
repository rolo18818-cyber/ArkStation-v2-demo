import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AIWorkAssistant({ theme: t, workOrderId, vehicle, onSuggestionGenerated }) {
  const [loading, setLoading] = useState(false)
  const [symptomDescription, setSymptomDescription] = useState('')
  const [suggestion, setSuggestion] = useState(null)
  const [error, setError] = useState(null)

  const generateSuggestion = async () => {
    if (!symptomDescription.trim()) {
      alert('Please describe the issue first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Call Claude API via Anthropic
const response = await fetch('http://localhost:3001/api/anthropic', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: `You are an expert motorcycle mechanic. A customer has brought in their ${vehicle?.year || ''} ${vehicle?.make || ''} ${vehicle?.model || ''} with the following issue:

"${symptomDescription}"

Please provide a comprehensive diagnostic and repair plan in the following JSON format (respond ONLY with valid JSON, no markdown, no backticks):

{
  "checks": [
    {"item": "Check description", "priority": "high", "estimated_time": "10 minutes"}
  ],
  "parts_needed": [
    {"part": "Part name", "quantity": 1, "estimated_cost": 50.00, "urgency": "immediate"}
  ],
  "estimated_duration_minutes": 120,
  "estimated_total_cost": 250.00,
  "common_issues": "Detailed explanation of common causes",
  "safety_warnings": "Safety concerns the mechanic should know",
  "additional_inspection": "Areas to inspect during this work"
}`
          }]
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'AI request failed')
      }

      const data = await response.json()
      const aiResponse = data.content[0].text

      // Parse JSON response - handle various formats
      let parsedSuggestion
      try {
        // Try direct parse first
        parsedSuggestion = JSON.parse(aiResponse)
      } catch (e) {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                         aiResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                         aiResponse.match(/\{[\s\S]*\}/)
        
        if (jsonMatch) {
          const jsonStr = jsonMatch[1] || jsonMatch[0]
          parsedSuggestion = JSON.parse(jsonStr)
        } else {
          throw new Error('Could not extract JSON from AI response')
        }
      }

      // Validate the response has required fields
      if (!parsedSuggestion.checks || !parsedSuggestion.parts_needed) {
        throw new Error('Invalid AI response format')
      }
      
      // Save to database
      const { error: dbError } = await supabase.rpc('save_ai_suggestion', {
        p_work_order_id: workOrderId,
        p_vehicle_make: vehicle?.make || 'Unknown',
        p_vehicle_model: vehicle?.model || 'Unknown',
        p_vehicle_year: vehicle?.year || new Date().getFullYear(),
        p_symptom_description: symptomDescription,
        p_suggested_checks: parsedSuggestion.checks,
        p_suggested_parts: parsedSuggestion.parts_needed,
        p_estimated_duration: parsedSuggestion.estimated_duration_minutes || 0,
        p_estimated_cost: parsedSuggestion.estimated_total_cost || 0,
        p_common_issues: parsedSuggestion.common_issues || '',
        p_safety_warnings: parsedSuggestion.safety_warnings || ''
      })

      if (dbError) {
        console.error('Database error:', dbError)
        // Don't throw - we still want to show the suggestion
      }

      setSuggestion(parsedSuggestion)
      if (onSuggestionGenerated) {
        onSuggestionGenerated(parsedSuggestion)
      }

    } catch (err) {
      console.error('AI Error:', err)
      setError(err.message || 'Failed to generate suggestion. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const addPartToWorkOrder = async (part) => {
    try {
      // Search for part in inventory
      const { data: partData } = await supabase
        .from('parts')
        .select('*')
        .ilike('name', `%${part.part}%`)
        .limit(1)
        .single()

      if (partData) {
        // Add to work order parts
        const { error } = await supabase
          .from('work_order_parts')
          .insert([{
            work_order_id: workOrderId,
            part_id: partData.id,
            quantity: part.quantity,
            unit_price: partData.retail_price,
            total_price: partData.retail_price * part.quantity
          }])

        if (!error) {
          alert(`✓ ${part.part} added to work order`)
        } else {
          throw error
        }
      } else {
        alert(`Part "${part.part}" not found in inventory. Please add manually.`)
      }
    } catch (error) {
      console.error('Error adding part:', error)
      alert('Error adding part: ' + error.message)
    }
  }

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'bg-red-500',
      medium: 'bg-orange-500',
      low: 'bg-blue-500'
    }
    return colors[priority?.toLowerCase()] || 'bg-gray-500'
  }

  const getUrgencyColor = (urgency) => {
    const colors = {
      immediate: 'bg-red-500',
      soon: 'bg-orange-500',
      optional: 'bg-blue-500'
    }
    return colors[urgency?.toLowerCase()] || 'bg-gray-500'
  }

  return (
    <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-4xl">🤖</span>
        <div>
          <h3 className={`text-xl font-bold ${t.text}`}>AI Work Assistant</h3>
          <p className={`text-sm ${t.textSecondary}`}>
            Powered by Claude Sonnet 4 • Instant diagnostic suggestions
          </p>
        </div>
      </div>

      {!suggestion ? (
        <>
          <div className="mb-4">
            <label className={`block text-sm font-medium ${t.text} mb-2`}>
              Describe the issue or work needed *
            </label>
            <textarea
              value={symptomDescription}
              onChange={(e) => setSymptomDescription(e.target.value)}
              rows="4"
              placeholder="e.g., Customer reports clutch slipping when accelerating hard, especially in higher gears. Also mentions grinding noise when shifting..."
              className={`w-full px-3 py-2 ${t.input} rounded border`}
              disabled={loading}
            />
          </div>

          <div className={`bg-blue-900 bg-opacity-30 border border-blue-500 rounded p-3 mb-4 text-sm ${t.text}`}>
            <strong>💡 Tip:</strong> Be specific about symptoms, when they occur, and any customer observations.
            The more detail you provide, the better the AI suggestions will be.
          </div>

          {error && (
            <div className="bg-red-900 bg-opacity-30 border border-red-500 rounded p-3 mb-4 text-sm text-red-300">
              <strong>⚠️ Error:</strong> {error}
            </div>
          )}

          <button
            onClick={generateSuggestion}
            disabled={loading || !symptomDescription.trim()}
            className={`w-full py-3 rounded-lg font-bold text-lg ${
              loading || !symptomDescription.trim()
                ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } transition-all`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block animate-spin">⚙️</span>
                Analyzing with AI...
              </span>
            ) : (
              '🤖 Generate Diagnostic Plan'
            )}
          </button>
        </>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <div className={`text-sm ${t.textSecondary}`}>AI Diagnostic Complete</div>
              <div className={`text-2xl font-bold ${t.text}`}>
                Est. {Math.floor((suggestion.estimated_duration_minutes || 0) / 60)}h {(suggestion.estimated_duration_minutes || 0) % 60}m
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm ${t.textSecondary}`}>Estimated Cost</div>
              <div className="text-2xl font-bold text-green-500">
                ${(suggestion.estimated_total_cost || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Safety Warnings */}
          {suggestion.safety_warnings && (
            <div className="bg-red-900 bg-opacity-30 border-2 border-red-500 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⚠️</span>
                <span className={`font-bold ${t.text}`}>Safety Warnings</span>
              </div>
              <p className={`text-sm ${t.text}`}>{suggestion.safety_warnings}</p>
            </div>
          )}

          {/* Common Issues */}
          {suggestion.common_issues && (
            <div className={`${t.surface} ${t.border} border rounded-lg p-4`}>
              <h4 className={`font-bold ${t.text} mb-2 flex items-center gap-2`}>
                <span>📋</span> Common Issues for This Symptom
              </h4>
              <p className={`text-sm ${t.text}`}>{suggestion.common_issues}</p>
            </div>
          )}

          {/* Checks to Perform */}
          {suggestion.checks && suggestion.checks.length > 0 && (
            <div>
              <h4 className={`font-bold ${t.text} mb-3 flex items-center gap-2`}>
                <span>✅</span> Diagnostic Checks ({suggestion.checks.length})
              </h4>
              <div className="space-y-2">
                {suggestion.checks.map((check, idx) => (
                  <div
                    key={idx}
                    className={`${t.surface} ${t.border} border rounded-lg p-3 flex items-start gap-3`}
                  >
                    <input type="checkbox" className="mt-1 w-5 h-5 cursor-pointer" />
                    <div className="flex-1">
                      <div className={`font-semibold ${t.text}`}>{check.item}</div>
                      <div className="flex gap-2 mt-1">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${getPriorityColor(check.priority)}`}>
                          {(check.priority || 'MEDIUM').toUpperCase()}
                        </span>
                        {check.estimated_time && (
                          <span className={`text-xs ${t.textSecondary}`}>
                            ⏱️ {check.estimated_time}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parts Needed */}
          {suggestion.parts_needed && suggestion.parts_needed.length > 0 && (
            <div>
              <h4 className={`font-bold ${t.text} mb-3 flex items-center gap-2`}>
                <span>📦</span> Parts Needed ({suggestion.parts_needed.length})
              </h4>
              <div className="space-y-2">
                {suggestion.parts_needed.map((part, idx) => (
                  <div
                    key={idx}
                    className={`${t.surface} ${t.border} border rounded-lg p-3`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className={`font-semibold ${t.text}`}>{part.part}</div>
                        <div className={`text-sm ${t.textSecondary}`}>
                          Qty: {part.quantity} • Est: ${(part.estimated_cost || 0).toFixed(2)}
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${getUrgencyColor(part.urgency)}`}>
                        {(part.urgency || 'SOON').toUpperCase()}
                      </span>
                    </div>
                    <button
                      onClick={() => addPartToWorkOrder(part)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium transition-all">
                      Add to Work Order
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Inspection */}
          {suggestion.additional_inspection && (
            <div className={`${t.surface} ${t.border} border rounded-lg p-4 bg-purple-900 bg-opacity-20`}>
              <h4 className={`font-bold ${t.text} mb-2 flex items-center gap-2`}>
                <span>🔍</span> Additional Inspection Recommended
              </h4>
              <p className={`text-sm ${t.text}`}>{suggestion.additional_inspection}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setSuggestion(null)
                setSymptomDescription('')
                setError(null)
              }}
              className={`flex-1 ${t.surface} ${t.text} ${t.border} border py-2 rounded font-medium hover:bg-opacity-80 transition-all`}
            >
              New Analysis
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium transition-all">
              Print Plan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}