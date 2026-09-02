import { NextRequest, NextResponse } from 'next/server'

const protectedPaths = ['/student', '/helper', '/admin']
const noStore = { 'Cache-Control': 'no-store, no-cache, must-revalidate, private', Pragma: 'no-cache', Expires: '0' }

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  if (!isProtected) return NextResponse.next()
  if (!request.cookies.get('unieveryhelp-demo-session')?.value) return NextResponse.redirect(new URL('/', request.url), { status: 303 })
  const response = NextResponse.next()
  for (const [key, value] of Object.entries(noStore)) response.headers.set(key, value)
  return response
}

export const config = { matcher: ['/student/:path*', '/helper/:path*', '/admin/:path*'] }
