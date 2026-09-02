import { NextResponse } from 'next/server'

const cookieName = 'unieveryhelp-demo-session'
const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, private', Pragma: 'no-cache', Expires: '0' }

export async function GET() {
  const response = NextResponse.json({ authenticated: true }, { headers: noStore })
  response.cookies.set(cookieName, 'active', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 8 })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { headers: noStore })
  for (const cookie of [cookieName, 'currentUser', 'isLoggedIn', 'lastActivity']) response.cookies.set(cookie, '', { expires: new Date(0), maxAge: 0, path: '/' })
  return response
}
