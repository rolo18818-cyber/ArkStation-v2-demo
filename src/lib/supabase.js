import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://cmcyodioeahpqfgxqxuo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtY3lvZGlvZWFocHFmZ3hxeHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NzM5ODksImV4cCI6MjA4MDE0OTk4OX0.zW9LsrYcb_0TXeCQUwUn4xYOSPKP50iqfh5_WyMVkMY'
)