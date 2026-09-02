import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const title = String(form.get('title') ?? '').trim()
    const course = String(form.get('course') ?? '').trim()
    const uploadedBy = String(form.get('uploaded_by') ?? '').trim()
    const studentEmail = String(form.get('student_email') ?? '').trim()
    const file = form.get('file')

    if (!title || !course) {
      return NextResponse.json({ error: 'Course and assignment description are required.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    let fileUrl: string | null = null
    if (file instanceof File && file.size > 0) {
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'Files must be 10MB or smaller.' }, { status: 413 })
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${crypto.randomUUID()}-${safeName}`
      const upload = await supabase.storage.from('assignments').upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })
      if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 })
      fileUrl = supabase.storage.from('assignments').getPublicUrl(path).data.publicUrl
    }

    const { data, error } = await supabase.from('assignments').insert({
      title,
      course,
      file_url: fileUrl,
      uploaded_by: uploadedBy || null,
      student_email: studentEmail || null,
      status: 'pending',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ assignment: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unable to save assignment.' }, { status: 500 })
  }
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data, error } = await supabase.from('assignments').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignments: data })
}
