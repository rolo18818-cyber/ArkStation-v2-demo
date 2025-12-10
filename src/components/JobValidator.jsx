import { useState } from 'react'

// AI Job Validator - checks jobs before completion
export async function validateJobCompletion(job, parts, labor, checklist) {
  const issues = []
  const warnings = []
  const suggestions = []

  // 1. Check if checklist items are complete
  if (checklist && checklist.length > 0) {
    const incomplete = checklist.filter(c => !c.is_completed)
    if (incomplete.length > 0) {
      issues.push({
        type: 'checklist',
        severity: 'error',
        message: `${incomplete.length} checklist item(s) not completed`,
        items: incomplete.map(c => c.item_text)
      })
    }
  }

  // 2. Check for common missing items based on job type
  const jobDesc = (job.description || '').toLowerCase()
  
  // Service jobs should have oil
  if (jobDesc.includes('service') || jobDesc.includes('1st service') || jobDesc.includes('first service') || 
      jobDesc.includes('major service') || jobDesc.includes('minor service')) {
    const hasOil = parts?.some(p => 
      p.name?.toLowerCase().includes('oil') || 
      p.part_number?.toLowerCase().includes('oil')
    )
    if (!hasOil) {
      issues.push({
        type: 'parts',
        severity: 'warning',
        message: 'Service job has no oil on the job card',
        suggestion: 'Add engine oil to parts list'
      })
    }

    // Check for oil filter on major services
    if (jobDesc.includes('major') || jobDesc.includes('full')) {
      const hasOilFilter = parts?.some(p => 
        p.name?.toLowerCase().includes('oil filter') || 
        p.name?.toLowerCase().includes('filter')
      )
      if (!hasOilFilter) {
        warnings.push({
          type: 'parts',
          severity: 'warning',
          message: 'Major service - consider adding oil filter',
          suggestion: 'Check if oil filter needs replacing'
        })
      }
    }
  }

  // Brake jobs should have brake fluid or pads
  if (jobDesc.includes('brake')) {
    const hasBrakeParts = parts?.some(p => 
      p.name?.toLowerCase().includes('brake') || 
      p.name?.toLowerCase().includes('pad') ||
      p.name?.toLowerCase().includes('disc')
    )
    if (!hasBrakeParts) {
      warnings.push({
        type: 'parts',
        severity: 'warning',
        message: 'Brake job has no brake parts listed',
        suggestion: 'Add brake pads, fluid, or other brake components'
      })
    }
  }

  // Tyre jobs should have tyres
  if (jobDesc.includes('tyre') || jobDesc.includes('tire')) {
    const hasTyre = parts?.some(p => 
      p.name?.toLowerCase().includes('tyre') || 
      p.name?.toLowerCase().includes('tire')
    )
    if (!hasTyre) {
      warnings.push({
        type: 'parts',
        severity: 'warning',
        message: 'Tyre job has no tyres on the job card',
        suggestion: 'Add tyre to parts list'
      })
    }
  }

  // 3. Check for labor hours
  if (!labor || labor.length === 0) {
    warnings.push({
      type: 'labor',
      severity: 'warning',
      message: 'No labor items on job',
      suggestion: 'Add labor time for billing'
    })
  }

  // 4. Check if job has any charges at all
  const partsTotal = parts?.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0) || 0
  const laborTotal = labor?.reduce((sum, l) => sum + (l.hours * l.rate), 0) || 0
  
  if (partsTotal === 0 && laborTotal === 0) {
    issues.push({
      type: 'billing',
      severity: 'error',
      message: 'Job has no charges (parts or labor)',
      suggestion: 'Add parts and/or labor before completing'
    })
  }

  // 5. Check for work completed notes
  if (!job.work_completed || job.work_completed.trim() === '') {
    warnings.push({
      type: 'notes',
      severity: 'warning',
      message: 'No work completed notes',
      suggestion: 'Document what work was performed'
    })
  }

  return {
    canComplete: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    warnings,
    suggestions,
    summary: {
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: warnings.length + issues.filter(i => i.severity === 'warning').length,
      partsTotal,
      laborTotal,
      total: partsTotal + laborTotal
    }
  }
}

// AI-powered deep analysis
export async function aiAnalyzeJob(job, parts, labor, checklist, vehicle) {
  try {
    const response = await fetch('http://localhost:3001/api/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: `You are a motorcycle workshop quality control AI. Analyze jobs before completion to catch missing items or potential issues.

Return ONLY valid JSON in this format:
{
  "issues": [{"message": "...", "severity": "error|warning", "category": "parts|labor|checklist|notes"}],
  "missingParts": [{"name": "...", "reason": "..."}],
  "suggestions": ["..."],
  "qualityScore": 85,
  "readyToComplete": true
}

Be practical - don't flag minor things. Focus on:
1. Missing consumables for the job type (oil for services, etc)
2. Incomplete checklist items
3. Missing labor charges
4. Safety concerns
5. Common oversights`,
        messages: [{
          role: 'user',
          content: `Analyze this job for completion readiness:

JOB: ${job.job_number}
DESCRIPTION: ${job.description}
VEHICLE: ${vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Not specified'}

PARTS ON JOB:
${parts?.length > 0 ? parts.map(p => `- ${p.name} x${p.quantity} @ $${p.unit_price}`).join('\n') : 'No parts'}

LABOR ON JOB:
${labor?.length > 0 ? labor.map(l => `- ${l.description}: ${l.hours}h @ $${l.rate}/h`).join('\n') : 'No labor'}

CHECKLIST:
${checklist?.length > 0 ? checklist.map(c => `- [${c.is_completed ? 'X' : ' '}] ${c.item_text}`).join('\n') : 'No checklist'}

WORK COMPLETED NOTES: ${job.work_completed || 'None'}
WORK REQUIRED NOTES: ${job.work_required || 'None'}`
        }],
        max_tokens: 1000
      })
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('AI Analysis Error:', e)
  }
  
  return null
}

// Component to display validation results
export default function JobValidationPanel({ theme: t, validation, aiAnalysis, onOverride, onFix }) {
  const [showDetails, setShowDetails] = useState(false)

  if (!validation) return null

  const hasErrors = validation.summary.errors > 0
  const hasWarnings = validation.summary.warnings > 0

  return (
    <div className={`${t.surface} rounded-lg ${t.border} border-2 ${
      hasErrors ? 'border-red-500' : hasWarnings ? 'border-yellow-500' : 'border-green-500'
    } overflow-hidden`}>
      {/* Header */}
      <div className={`p-4 ${
        hasErrors ? 'bg-red-500/20' : hasWarnings ? 'bg-yellow-500/20' : 'bg-green-500/20'
      }`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {hasErrors ? '❌' : hasWarnings ? '⚠️' : '✅'}
            </span>
            <div>
              <div className={`font-bold ${t.text}`}>
                {hasErrors ? 'Issues Found - Cannot Complete' : 
                 hasWarnings ? 'Warnings - Review Before Completing' : 
                 'Ready to Complete'}
              </div>
              <div className={`text-sm ${t.textSecondary}`}>
                {validation.summary.errors} errors, {validation.summary.warnings} warnings
              </div>
            </div>
          </div>
          
          {aiAnalysis && (
            <div className="text-right">
              <div className={`text-2xl font-bold ${
                aiAnalysis.qualityScore >= 80 ? 'text-green-500' :
                aiAnalysis.qualityScore >= 60 ? 'text-yellow-500' : 'text-red-500'
              }`}>
                {aiAnalysis.qualityScore}%
              </div>
              <div className={`text-xs ${t.textSecondary}`}>AI Quality Score</div>
            </div>
          )}
        </div>
      </div>

      {/* Issues List */}
      {(validation.issues.length > 0 || validation.warnings.length > 0) && (
        <div className="p-4 space-y-2">
          {validation.issues.map((issue, i) => (
            <div key={i} className={`flex items-start gap-3 p-2 rounded ${
              issue.severity === 'error' ? 'bg-red-500/10' : 'bg-yellow-500/10'
            }`}>
              <span>{issue.severity === 'error' ? '🔴' : '🟡'}</span>
              <div className="flex-1">
                <div className={t.text}>{issue.message}</div>
                {issue.suggestion && (
                  <div className={`text-sm ${t.textSecondary}`}>💡 {issue.suggestion}</div>
                )}
                {issue.items && (
                  <ul className={`text-sm ${t.textSecondary} ml-4 mt-1`}>
                    {issue.items.slice(0, 3).map((item, j) => (
                      <li key={j}>• {item}</li>
                    ))}
                    {issue.items.length > 3 && <li>• ...and {issue.items.length - 3} more</li>}
                  </ul>
                )}
              </div>
            </div>
          ))}
          
          {validation.warnings.map((warning, i) => (
            <div key={`w${i}`} className="flex items-start gap-3 p-2 rounded bg-yellow-500/10">
              <span>🟡</span>
              <div className="flex-1">
                <div className={t.text}>{warning.message}</div>
                {warning.suggestion && (
                  <div className={`text-sm ${t.textSecondary}`}>💡 {warning.suggestion}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Suggestions */}
      {aiAnalysis?.missingParts?.length > 0 && (
        <div className={`p-4 ${t.border} border-t`}>
          <div className={`text-sm font-bold ${t.text} mb-2`}>🤖 AI Suggested Missing Parts</div>
          <div className="space-y-1">
            {aiAnalysis.missingParts.map((part, i) => (
              <div key={i} className={`flex justify-between items-center text-sm p-2 ${t.surfaceHover} rounded`}>
                <span className={t.text}>{part.name}</span>
                <span className={t.textSecondary}>{part.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className={`p-4 ${t.border} border-t`}>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className={`text-lg font-bold ${t.text}`}>${validation.summary.partsTotal.toFixed(2)}</div>
            <div className={`text-xs ${t.textSecondary}`}>Parts</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${t.text}`}>${validation.summary.laborTotal.toFixed(2)}</div>
            <div className={`text-xs ${t.textSecondary}`}>Labor</div>
          </div>
          <div>
            <div className={`text-lg font-bold text-green-500`}>
              ${(validation.summary.total * 1.1).toFixed(2)}
            </div>
            <div className={`text-xs ${t.textSecondary}`}>Total (inc GST)</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      {hasWarnings && !hasErrors && onOverride && (
        <div className={`p-4 ${t.border} border-t flex gap-3`}>
          <button
            onClick={onOverride}
            className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg font-medium"
          >
            ⚠️ Complete Anyway
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`${t.surface} ${t.text} ${t.border} border px-4 py-2 rounded-lg`}
          >
            Details
          </button>
        </div>
      )}
    </div>
  )
}
