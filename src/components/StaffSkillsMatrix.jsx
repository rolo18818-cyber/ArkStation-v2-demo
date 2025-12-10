import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function StaffSkillsMatrix({ theme: t }) {
  const [view, setView] = useState('overview') // overview, skills, certifications, training, reviews
  const [mechanics, setMechanics] = useState([])
  const [selectedMechanic, setSelectedMechanic] = useState(null)
  const [skills, setSkills] = useState([])
  const [certifications, setCertifications] = useState([])
  const [trainings, setTrainings] = useState([])
  const [trainingPrograms, setTrainingPrograms] = useState([])
  const [reviews, setReviews] = useState([])
  const [skillsSummary, setSkillsSummary] = useState(null)
  const [expiringCerts, setExpiringCerts] = useState([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [modalType, setModalType] = useState('skill')
  const [formData, setFormData] = useState({})

  useEffect(() => {
    loadMechanics()
    loadTrainingPrograms()
    loadExpiringCerts()
  }, [])

  useEffect(() => {
    if (selectedMechanic) {
      loadMechanicData()
    }
  }, [selectedMechanic])

  const loadMechanics = async () => {
    const { data } = await supabase
      .from('mechanics')
      .select('*')
      .eq('is_active', true)
      .order('first_name')
    
    if (data) {
      setMechanics(data)
      if (data.length > 0 && !selectedMechanic) {
        setSelectedMechanic(data[0].id)
      }
    }
  }

  const loadMechanicData = async () => {
    await Promise.all([
      loadSkills(),
      loadCertifications(),
      loadTrainings(),
      loadReviews(),
      loadSkillsSummary()
    ])
  }

  const loadSkills = async () => {
    const { data } = await supabase
      .from('staff_skills')
      .select('*')
      .eq('mechanic_id', selectedMechanic)
      .order('skill_category', { ascending: true })
    
    if (data) setSkills(data)
  }

  const loadCertifications = async () => {
    const { data } = await supabase
      .from('staff_certifications')
      .select('*')
      .eq('mechanic_id', selectedMechanic)
      .order('issue_date', { ascending: false })
    
    if (data) setCertifications(data)
  }

  const loadTrainings = async () => {
    const { data } = await supabase
      .from('training_enrollments')
      .select(`
        *,
        training_programs(program_name, program_type, duration_hours, cost)
      `)
      .eq('mechanic_id', selectedMechanic)
      .order('enrollment_date', { ascending: false })
    
    if (data) setTrainings(data)
  }

  const loadTrainingPrograms = async () => {
    const { data } = await supabase
      .from('training_programs')
      .select('*')
      .eq('is_active', true)
      .order('program_name')
    
    if (data) setTrainingPrograms(data)
  }

  const loadReviews = async () => {
    const { data } = await supabase
      .from('performance_reviews')
      .select('*')
      .eq('mechanic_id', selectedMechanic)
      .order('review_date', { ascending: false })
    
    if (data) setReviews(data)
  }

  const loadSkillsSummary = async () => {
    const { data } = await supabase.rpc('get_mechanic_skills_summary', {
      p_mechanic_id: selectedMechanic
    })
    
    if (data && data.length > 0) setSkillsSummary(data[0])
  }

  const loadExpiringCerts = async () => {
    const { data } = await supabase.rpc('get_expiring_certifications', {
      p_days_ahead: 90
    })
    
    if (data) setExpiringCerts(data)
  }

  const addSkill = async () => {
    const { error } = await supabase
      .from('staff_skills')
      .insert([{
        mechanic_id: selectedMechanic,
        ...formData,
        updated_at: new Date().toISOString()
      }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Skill added!')
      setShowAddModal(false)
      setFormData({})
      loadMechanicData()
    }
  }

  const addCertification = async () => {
    const { error } = await supabase
      .from('staff_certifications')
      .insert([{
        mechanic_id: selectedMechanic,
        ...formData
      }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Certification added!')
      setShowAddModal(false)
      setFormData({})
      loadMechanicData()
      loadExpiringCerts()
    }
  }

  const enrollInTraining = async () => {
    const { error } = await supabase
      .from('training_enrollments')
      .insert([{
        mechanic_id: selectedMechanic,
        ...formData
      }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Enrolled in training!')
      setShowAddModal(false)
      setFormData({})
      loadMechanicData()
    }
  }

  const addReview = async () => {
    const { error } = await supabase
      .from('performance_reviews')
      .insert([{
        mechanic_id: selectedMechanic,
        ...formData
      }])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('✓ Performance review added!')
      setShowAddModal(false)
      setFormData({})
      loadMechanicData()
    }
  }

  const updateTrainingStatus = async (enrollmentId, newStatus, completionData = {}) => {
    const updates = { status: newStatus, ...completionData }

    const { error } = await supabase
      .from('training_enrollments')
      .update(updates)
      .eq('id', enrollmentId)

    if (error) {
      alert('Error: ' + error.message)
    } else {
      loadTrainings()
    }
  }

  const getProficiencyColor = (level) => {
    const colors = {
      beginner: 'bg-gray-500',
      intermediate: 'bg-blue-500',
      advanced: 'bg-green-500',
      expert: 'bg-purple-500',
      master: 'bg-yellow-500'
    }
    return colors[level] || 'bg-gray-500'
  }

  const getCertStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-500',
      expired: 'bg-red-500',
      pending_renewal: 'bg-orange-500',
      suspended: 'bg-gray-500'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[status]}`}>
        {status.toUpperCase().replace('_', ' ')}
      </span>
    )
  }

  const getTrainingStatusBadge = (status) => {
    const styles = {
      enrolled: 'bg-blue-500',
      in_progress: 'bg-orange-500',
      completed: 'bg-green-500',
      failed: 'bg-red-500',
      withdrawn: 'bg-gray-500',
      pending: 'bg-yellow-500'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${styles[status]}`}>
        {status.toUpperCase().replace('_', ' ')}
      </span>
    )
  }

  const getRatingStars = (rating) => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)
    
    return (
      <div className="flex gap-1">
        {'⭐'.repeat(fullStars)}
        {hasHalfStar && '⭐'}
        {'☆'.repeat(emptyStars)}
      </div>
    )
  }

  const selectedMechanicData = mechanics.find(m => m.id === selectedMechanic)

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className={`text-3xl font-bold ${t.text}`}>👨‍🏫 Staff Skills Matrix</h2>
        <div className="flex gap-2">
          <select
            value={selectedMechanic || ''}
            onChange={(e) => setSelectedMechanic(e.target.value)}
            className={`px-3 py-2 ${t.input} rounded border`}>
            <option value="">Select mechanic...</option>
            {mechanics.map(m => (
              <option key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expiring Certifications Alert */}
      {expiringCerts.length > 0 && (
        <div className="bg-red-900 bg-opacity-30 border-2 border-red-500 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">⚠️</span>
            <div>
              <h3 className={`font-bold ${t.text} text-lg`}>Certifications Expiring Soon</h3>
              <p className={`text-sm ${t.textSecondary}`}>{expiringCerts.length} certification(s) expiring in the next 90 days</p>
            </div>
          </div>
          <div className="space-y-2">
            {expiringCerts.slice(0, 3).map(cert => (
              <div key={cert.mechanic_id + cert.certification_name} className={`${t.surface} ${t.border} border rounded p-3`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`font-bold ${t.text}`}>{cert.mechanic_name}</div>
                    <div className={`text-sm ${t.textSecondary}`}>{cert.certification_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-red-400">
                      Expires: {new Date(cert.expiry_date).toLocaleDateString()}
                    </div>
                    <div className={`text-xs ${t.textSecondary}`}>
                      {cert.days_until_expiry} days remaining
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedMechanicData && skillsSummary && (
        <>
          {/* Mechanic Summary Card */}
          <div className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border mb-6`}>
            <div className="grid grid-cols-6 gap-6">
              <div>
                <div className={`text-sm ${t.textSecondary} mb-1`}>Mechanic</div>
                <div className={`text-lg font-bold ${t.text}`}>
                  {selectedMechanicData.first_name} {selectedMechanicData.last_name}
                </div>
                <div className={`text-sm ${t.textSecondary}`}>{selectedMechanicData.email}</div>
              </div>
              <div>
                <div className={`text-sm ${t.textSecondary} mb-1`}>Total Skills</div>
                <div className={`text-2xl font-bold ${t.text}`}>{skillsSummary.total_skills}</div>
                <div className={`text-xs ${t.textSecondary}`}>
                  {skillsSummary.expert_level_skills} expert level
                </div>
              </div>
              <div>
                <div className={`text-sm ${t.textSecondary} mb-1`}>Certifications</div>
                <div className={`text-2xl font-bold text-green-500`}>{skillsSummary.active_certifications}</div>
                {skillsSummary.expiring_certifications > 0 && (
                  <div className="text-xs text-red-400">
                    {skillsSummary.expiring_certifications} expiring
                  </div>
                )}
              </div>
              <div>
                <div className={`text-sm ${t.textSecondary} mb-1`}>Completed Training</div>
                <div className={`text-2xl font-bold ${t.text}`}>{skillsSummary.completed_trainings}</div>
              </div>
              <div>
                <div className={`text-sm ${t.textSecondary} mb-1`}>Avg Rating</div>
                <div className="flex items-center gap-2">
                  <div className={`text-2xl font-bold ${t.text}`}>
                    {parseFloat(skillsSummary.avg_performance_rating || 0).toFixed(1)}
                  </div>
                  {getRatingStars(parseFloat(skillsSummary.avg_performance_rating || 0))}
                </div>
              </div>
              <div>
                <div className={`text-sm ${t.textSecondary} mb-1`}>Last Review</div>
                <div className={`text-sm ${t.text}`}>
                  {skillsSummary.last_review_date 
                    ? new Date(skillsSummary.last_review_date).toLocaleDateString()
                    : 'Never'}
                </div>
              </div>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'skills', label: 'Skills', icon: '🛠️' },
              { id: 'certifications', label: 'Certifications', icon: '📜' },
              { id: 'training', label: 'Training', icon: '📚' },
              { id: 'reviews', label: 'Performance', icon: '⭐' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  view === tab.id
                    ? 'bg-blue-600 text-white'
                    : `${t.surface} ${t.text} ${t.border} border`
                }`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* OVERVIEW */}
          {view === 'overview' && (
            <div className="grid grid-cols-2 gap-6">
              {/* Skills by Category */}
              <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
                <div className={`${t.surface} ${t.border} border-b p-4`}>
                  <h3 className={`text-xl font-bold ${t.text}`}>Skills by Category</h3>
                </div>
                <div className="p-4">
                  {Object.entries(
                    skills.reduce((acc, skill) => {
                      acc[skill.skill_category] = (acc[skill.skill_category] || 0) + 1
                      return acc
                    }, {})
                  ).map(([category, count]) => (
                    <div key={category} className="mb-3">
                      <div className="flex justify-between mb-1">
                        <span className={`text-sm ${t.text} capitalize`}>{category.replace('_', ' ')}</span>
                        <span className={`text-sm font-bold ${t.text}`}>{count}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${(count / skills.length) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className={`${t.surface} rounded-lg shadow-lg ${t.border} border`}>
                <div className={`${t.surface} ${t.border} border-b p-4`}>
                  <h3 className={`text-xl font-bold ${t.text}`}>Recent Activity</h3>
                </div>
                <div className="p-4 space-y-3">
                  {trainings.slice(0, 5).map(training => (
                    <div key={training.id} className={`${t.surface} ${t.border} border rounded p-3`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className={`text-sm font-bold ${t.text}`}>
                          {training.training_programs?.program_name}
                        </div>
                        {getTrainingStatusBadge(training.status)}
                      </div>
                      {training.status === 'in_progress' && training.completion_percentage > 0 && (
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${training.completion_percentage}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SKILLS VIEW */}
          {view === 'skills' && (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    setModalType('skill')
                    setShowAddModal(true)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
                  + Add Skill
                </button>
              </div>

              <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
                <table className="min-w-full">
                  <thead className={`${t.surface} ${t.border} border-b`}>
                    <tr>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Skill</th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Category</th>
                      <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Proficiency</th>
                      <th className={`px-6 py-3 text-right text-xs font-medium ${t.textSecondary} uppercase`}>Experience</th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Last Assessed</th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Assessor</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${t.border}`}>
                    {skills.map(skill => (
                      <tr key={skill.id} className={t.surfaceHover}>
                        <td className="px-6 py-4">
                          <div className={`text-sm font-bold ${t.text}`}>{skill.skill_name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-sm ${t.text} capitalize`}>
                            {skill.skill_category.replace('_', ' ')}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full text-white ${getProficiencyColor(skill.proficiency_level)}`}>
                            {skill.proficiency_level.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className={`text-sm ${t.text}`}>
                            {skill.years_experience ? `${skill.years_experience} years` : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-sm ${t.text}`}>
                            {skill.last_assessed ? new Date(skill.last_assessed).toLocaleDateString() : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-sm ${t.text}`}>{skill.assessor || '-'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* CERTIFICATIONS VIEW */}
          {view === 'certifications' && (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    setModalType('certification')
                    setShowAddModal(true)
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">
                  + Add Certification
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {certifications.map(cert => (
                  <div key={cert.id} className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border-2 ${
                    cert.status === 'active' ? 'border-green-500' : 
                    cert.status === 'expired' ? 'border-red-500' : 
                    'border-orange-500'
                  }`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className={`text-xl font-bold ${t.text} mb-1`}>{cert.certification_name}</h3>
                        <p className={`text-sm ${t.textSecondary}`}>{cert.issuing_organization}</p>
                      </div>
                      {getCertStatusBadge(cert.status)}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className={`text-sm ${t.textSecondary}`}>Type:</span>
                        <span className={`text-sm font-semibold ${t.text} capitalize`}>
                          {cert.certification_type}
                        </span>
                      </div>
                      {cert.certification_number && (
                        <div className="flex justify-between">
                          <span className={`text-sm ${t.textSecondary}`}>Cert #:</span>
                          <span className={`text-sm font-mono ${t.text}`}>{cert.certification_number}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className={`text-sm ${t.textSecondary}`}>Issued:</span>
                        <span className={`text-sm ${t.text}`}>
                          {new Date(cert.issue_date).toLocaleDateString()}
                        </span>
                      </div>
                      {cert.expiry_date && (
                        <div className="flex justify-between">
                          <span className={`text-sm ${t.textSecondary}`}>Expires:</span>
                          <span className={`text-sm font-semibold ${
                            new Date(cert.expiry_date) < new Date() ? 'text-red-500' :
                            new Date(cert.expiry_date) < new Date(Date.now() + 90*24*60*60*1000) ? 'text-orange-500' :
                            t.text
                          }`}>
                            {new Date(cert.expiry_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {cert.cost && (
                        <div className="flex justify-between">
                          <span className={`text-sm ${t.textSecondary}`}>Cost:</span>
                          <span className="text-sm font-semibold text-green-500">
                            ${cert.cost.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {cert.renewal_required && cert.status === 'active' && (
                      <div className="mt-4 pt-4 border-t border-orange-500">
                        <div className="text-xs text-orange-400 flex items-center gap-2">
                          <span>⚠️</span>
                          <span>Renewal required before expiry</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {certifications.length === 0 && (
                  <div className={`col-span-2 ${t.surface} rounded-lg shadow-lg p-12 ${t.border} border text-center`}>
                    <div className="text-6xl mb-4">📜</div>
                    <div className={`text-xl font-bold ${t.text} mb-2`}>No Certifications</div>
                    <div className={`${t.textSecondary}`}>Add certifications for this mechanic</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TRAINING VIEW */}
          {view === 'training' && (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    setModalType('training')
                    setShowAddModal(true)
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium">
                  + Enroll in Training
                </button>
              </div>

              <div className={`${t.surface} rounded-lg shadow-lg overflow-hidden ${t.border} border`}>
                <table className="min-w-full">
                  <thead className={`${t.surface} ${t.border} border-b`}>
                    <tr>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Program</th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Type</th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${t.textSecondary} uppercase`}>Enrolled</th>
                      <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Progress</th>
                      <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Status</th>
                      <th className={`px-6 py-3 text-center text-xs font-medium ${t.textSecondary} uppercase`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${t.border}`}>
                    {trainings.map(training => (
                      <tr key={training.id} className={t.surfaceHover}>
                        <td className="px-6 py-4">
                          <div className={`text-sm font-bold ${t.text}`}>
                            {training.training_programs?.program_name}
                          </div>
                          {training.training_programs?.duration_hours && (
                            <div className={`text-xs ${t.textSecondary}`}>
                              {training.training_programs.duration_hours}h
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-sm ${t.text} capitalize`}>
                            {training.training_programs?.program_type.replace('_', ' ')}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-sm ${t.text}`}>
                            {new Date(training.enrollment_date).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {training.completion_percentage > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-700 rounded-full h-2">
                                <div 
                                  className="bg-green-500 h-2 rounded-full"
                                  style={{ width: `${training.completion_percentage}%` }}
                                ></div>
                              </div>
                              <span className={`text-xs ${t.text}`}>{training.completion_percentage}%</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {getTrainingStatusBadge(training.status)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {training.status === 'enrolled' && (
                            <button
                              onClick={() => updateTrainingStatus(training.id, 'in_progress', {
                                actual_start_date: new Date().toISOString().split('T')[0]
                              })}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs">
                              Start
                            </button>
                          )}
                          {training.status === 'in_progress' && (
                            <button
                              onClick={() => updateTrainingStatus(training.id, 'completed', {
                                actual_completion_date: new Date().toISOString().split('T')[0],
                                completion_percentage: 100,
                                passed: true
                              })}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">
                              Complete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* PERFORMANCE REVIEWS VIEW */}
          {view === 'reviews' && (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => {
                    setModalType('review')
                    setShowAddModal(true)
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium">
                  + Add Review
                </button>
              </div>

              <div className="space-y-6">
                {reviews.map(review => (
                  <div key={review.id} className={`${t.surface} rounded-lg shadow-lg p-6 ${t.border} border`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className={`text-xl font-bold ${t.text}`}>
                          Performance Review - {new Date(review.review_date).toLocaleDateString()}
                        </h3>
                        <p className={`text-sm ${t.textSecondary}`}>
                          Period: {new Date(review.review_period_start).toLocaleDateString()} - {new Date(review.review_period_end).toLocaleDateString()}
                        </p>
                        <p className={`text-sm ${t.textSecondary}`}>Reviewer: {review.reviewer_name}</p>
                      </div>
                      <div className="text-center">
                        <div className="text-4xl font-bold text-blue-500">{review.overall_rating}</div>
                        <div className="flex justify-center mt-1">
                          {getRatingStars(review.overall_rating)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      {[
                        { label: 'Technical Skills', value: review.technical_skills_rating },
                        { label: 'Quality of Work', value: review.quality_of_work_rating },
                        { label: 'Productivity', value: review.productivity_rating },
                        { label: 'Customer Service', value: review.customer_service_rating },
                        { label: 'Teamwork', value: review.teamwork_rating },
                        { label: 'Attendance', value: review.attendance_rating }
                      ].map(item => item.value && (
                        <div key={item.label} className={`${t.surface} ${t.border} border rounded p-3`}>
                          <div className={`text-xs ${t.textSecondary} mb-1`}>{item.label}</div>
                          <div className="flex items-center gap-2">
                            <div className={`text-lg font-bold ${t.text}`}>{item.value}</div>
                            <div className="flex text-xs">
                              {getRatingStars(item.value)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {review.strengths && (
                      <div className="mb-4">
                        <div className={`text-sm font-bold ${t.text} mb-2`}>💪 Strengths:</div>
                        <div className={`text-sm ${t.text}`}>{review.strengths}</div>
                      </div>
                    )}

                    {review.areas_for_improvement && (
                      <div className="mb-4">
                        <div className={`text-sm font-bold ${t.text} mb-2`}>📈 Areas for Improvement:</div>
                        <div className={`text-sm ${t.text}`}>{review.areas_for_improvement}</div>
                      </div>
                    )}

                    {review.salary_adjustment && (
                      <div className={`mt-4 pt-4 border-t ${t.border}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-green-500 font-bold">💰 Salary Adjustment:</span>
                          <span className={`text-lg font-bold ${t.text}`}>
                            ${review.salary_adjustment.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}

                    {review.promotion_recommended && (
                      <div className="mt-2">
                        <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-sm font-bold">
                          🎯 Promotion Recommended
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {reviews.length === 0 && (
                  <div className={`${t.surface} rounded-lg shadow-lg p-12 ${t.border} border text-center`}>
                    <div className="text-6xl mb-4">⭐</div>
                    <div className={`text-xl font-bold ${t.text} mb-2`}>No Performance Reviews</div>
                    <div className={`${t.textSecondary}`}>Add the first performance review</div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${t.surface} rounded-lg shadow-2xl w-full max-w-2xl ${t.border} border-2 my-8`}>
            <div className={`${t.surface} ${t.border} border-b p-6 flex justify-between items-center`}>
              <h3 className={`text-2xl font-bold ${t.text}`}>
                Add {modalType === 'skill' ? 'Skill' : 
                     modalType === 'certification' ? 'Certification' : 
                     modalType === 'training' ? 'Training Enrollment' : 'Performance Review'}
              </h3>
              <button onClick={() => {
                setShowAddModal(false)
                setFormData({})
              }} className="text-red-500 hover:text-red-700 font-bold text-2xl">✕</button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {modalType === 'skill' && (
                <>
                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-2`}>Skill Name *</label>
                    <input
                      type="text"
                      value={formData.skill_name || ''}
                      onChange={(e) => setFormData({...formData, skill_name: e.target.value})}
                      className={`w-full px-3 py-2 ${t.input} rounded border`}
                      placeholder="e.g., Engine Diagnostics"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Category *</label>
                      <select
                        value={formData.skill_category || ''}
                        onChange={(e) => setFormData({...formData, skill_category: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}>
                        <option value="">Select category...</option>
                        <option value="technical">Technical</option>
                        <option value="diagnostic">Diagnostic</option>
                        <option value="specialized">Specialized</option>
                        <option value="safety">Safety</option>
                        <option value="customer_service">Customer Service</option>
                        <option value="management">Management</option>
                      </select>
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Proficiency Level *</label>
                      <select
                        value={formData.proficiency_level || ''}
                        onChange={(e) => setFormData({...formData, proficiency_level: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}>
                        <option value="">Select level...</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="expert">Expert</option>
                        <option value="master">Master</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Years Experience</label>
                      <input
                        type="number"
                        step="0.5"
                        value={formData.years_experience || ''}
                        onChange={(e) => setFormData({...formData, years_experience: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Last Assessed</label>
                      <input
                        type="date"
                        value={formData.last_assessed || ''}
                        onChange={(e) => setFormData({...formData, last_assessed: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-2`}>Assessor</label>
                    <input
                      type="text"
                      value={formData.assessor || ''}
                      onChange={(e) => setFormData({...formData, assessor: e.target.value})}
                      className={`w-full px-3 py-2 ${t.input} rounded border`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-2`}>Notes</label>
                    <textarea
                      value={formData.notes || ''}
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      rows="3"
                      className={`w-full px-3 py-2 ${t.input} rounded border`}
                    />
                  </div>

                  <button
                    onClick={addSkill}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold">
                    Add Skill
                  </button>
                </>
              )}

              {modalType === 'certification' && (
                <>
                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-2`}>Certification Name *</label>
                    <input
                      type="text"
                      value={formData.certification_name || ''}
                      onChange={(e) => setFormData({...formData, certification_name: e.target.value})}
                      className={`w-full px-3 py-2 ${t.input} rounded border`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Type *</label>
                      <select
                        value={formData.certification_type || ''}
                        onChange={(e) => setFormData({...formData, certification_type: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}>
                        <option value="">Select type...</option>
                        <option value="manufacturer">Manufacturer</option>
                        <option value="industry">Industry</option>
                        <option value="safety">Safety</option>
                        <option value="trade">Trade</option>
                        <option value="internal">Internal</option>
                      </select>
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Issuing Organization *</label>
                      <input
                        type="text"
                        value={formData.issuing_organization || ''}
                        onChange={(e) => setFormData({...formData, issuing_organization: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Certification Number</label>
                      <input
                        type="text"
                        value={formData.certification_number || ''}
                        onChange={(e) => setFormData({...formData, certification_number: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.cost || ''}
                        onChange={(e) => setFormData({...formData, cost: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Issue Date *</label>
                      <input
                        type="date"
                        value={formData.issue_date || ''}
                        onChange={(e) => setFormData({...formData, issue_date: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Expiry Date</label>
                      <input
                        type="date"
                        value={formData.expiry_date || ''}
                        onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.renewal_required || false}
                        onChange={(e) => setFormData({...formData, renewal_required: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className={`text-sm font-medium ${t.text}`}>Renewal Required</span>
                    </label>
                  </div>

                  <button
                    onClick={addCertification}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold">
                    Add Certification
                  </button>
                </>
              )}

              {modalType === 'training' && (
                <>
                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-2`}>Training Program *</label>
                    <select
                      value={formData.training_program_id || ''}
                      onChange={(e) => setFormData({...formData, training_program_id: e.target.value})}
                      className={`w-full px-3 py-2 ${t.input} rounded border`}>
                      <option value="">Select program...</option>
                      {trainingPrograms.map(prog => (
                        <option key={prog.id} value={prog.id}>
                          {prog.program_name} ({prog.duration_hours}h - ${prog.cost})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-2`}>Enrollment Date *</label>
                    <input
                      type="date"
                      value={formData.enrollment_date || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setFormData({...formData, enrollment_date: e.target.value})}
                      className={`w-full px-3 py-2 ${t.input} rounded border`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Scheduled Start</label>
                      <input
                        type="date"
                        value={formData.scheduled_start_date || ''}
                        onChange={(e) => setFormData({...formData, scheduled_start_date: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Scheduled End</label>
                      <input
                        type="date"
                        value={formData.scheduled_end_date || ''}
                        onChange={(e) => setFormData({...formData, scheduled_end_date: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <button
                    onClick={enrollInTraining}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-bold">
                    Enroll in Training
                  </button>
                </>
              )}

              {modalType === 'review' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Review Date *</label>
                      <input
                        type="date"
                        value={formData.review_date || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setFormData({...formData, review_date: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Reviewer Name *</label>
                      <input
                        type="text"
                        value={formData.reviewer_name || ''}
                        onChange={(e) => setFormData({...formData, reviewer_name: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Period Start *</label>
                      <input
                        type="date"
                        value={formData.review_period_start || ''}
                        onChange={(e) => setFormData({...formData, review_period_start: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Period End *</label>
                      <input
                        type="date"
                        value={formData.review_period_end || ''}
                        onChange={(e) => setFormData({...formData, review_period_end: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-2`}>Overall Rating (0-5) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={formData.overall_rating || ''}
                      onChange={(e) => setFormData({...formData, overall_rating: e.target.value})}
                      className={`w-full px-3 py-2 ${t.input} rounded border`}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {['technical_skills', 'quality_of_work', 'productivity', 'customer_service', 'teamwork', 'attendance'].map(field => (
                      <div key={field}>
                        <label className={`block text-xs font-medium ${t.text} mb-2 capitalize`}>
                          {field.replace('_', ' ')}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="5"
                          value={formData[`${field}_rating`] || ''}
                          onChange={(e) => setFormData({...formData, [`${field}_rating`]: e.target.value})}
                          className={`w-full px-3 py-2 ${t.input} rounded border text-sm`}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-2`}>Strengths</label>
                    <textarea
                      value={formData.strengths || ''}
                      onChange={(e) => setFormData({...formData, strengths: e.target.value})}
                      rows="2"
                      className={`w-full px-3 py-2 ${t.input} rounded border`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${t.text} mb-2`}>Areas for Improvement</label>
                    <textarea
                      value={formData.areas_for_improvement || ''}
                      onChange={(e) => setFormData({...formData, areas_for_improvement: e.target.value})}
                      rows="2"
                      className={`w-full px-3 py-2 ${t.input} rounded border`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${t.text} mb-2`}>Salary Adjustment</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.salary_adjustment || ''}
                        onChange={(e) => setFormData({...formData, salary_adjustment: e.target.value})}
                        className={`w-full px-3 py-2 ${t.input} rounded border`}
                      />
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.promotion_recommended || false}
                          onChange={(e) => setFormData({...formData, promotion_recommended: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <span className={`text-sm font-medium ${t.text}`}>Promotion Recommended</span>
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={addReview}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-lg font-bold">
                    Add Performance Review
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}