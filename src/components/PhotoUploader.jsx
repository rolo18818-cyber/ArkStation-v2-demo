import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PhotoUploader({ workOrderId, onUploadComplete, theme: t }) {
  const [uploading, setUploading] = useState(false)
  const [photoType, setPhotoType] = useState('before')
  const [caption, setCaption] = useState('')

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)

    try {
      // Convert to base64
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64String = reader.result

        // Save to database
        const { error } = await supabase
          .from('work_order_photos')
          .insert([{
            work_order_id: workOrderId,
            photo_url: base64String,
            photo_type: photoType,
            caption: caption || null,
            uploaded_by: 'Current User' // TODO: Get from auth
          }])

        if (error) {
          alert('Error uploading photo: ' + error.message)
        } else {
          alert('✓ Photo uploaded!')
          setCaption('')
          if (onUploadComplete) onUploadComplete()
        }
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      alert('Error: ' + error.message)
      setUploading(false)
    }
  }

  return (
    <div className={`${t.surface} ${t.border} border rounded-lg p-4`}>
      <h4 className={`font-bold ${t.text} mb-3`}>📷 Upload Photo</h4>
      
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <label className={`block text-sm font-medium ${t.text} mb-1`}>Photo Type</label>
          <select
            value={photoType}
            onChange={(e) => setPhotoType(e.target.value)}
            className={`w-full px-3 py-2 ${t.input} rounded border`}>
            <option value="before">Before</option>
            <option value="after">After</option>
            <option value="damage">Damage</option>
            <option value="parts">Parts</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className={`block text-sm font-medium ${t.text} mb-1`}>Caption (optional)</label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Description..."
            className={`w-full px-3 py-2 ${t.input} rounded border`}
          />
        </div>
      </div>

      <div>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={uploading}
          className={`w-full px-3 py-2 ${t.input} rounded border`}
        />
      </div>

      {uploading && (
        <div className="mt-3 text-center">
          <div className={`text-sm ${t.text}`}>Uploading...</div>
        </div>
      )}
    </div>
  )
}