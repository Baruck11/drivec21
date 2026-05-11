import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login']
const ROLE_ROUTES: Record<string, string[]> = {
  '/dashboard/admin': ['ADMIN'],
  '/dashboard/content': ['ADMIN', 'CONTENT_MANAGER'],
  '/dashboard/viewer': ['ADMIN', 'CONTENT_MANAGER', 'BROADCASTER_VIEWER'],
}

function decodeJwtPayload(token: string): { role?: string; exp?: number } | null {
  try {
    const payload = token.split('.')[1]
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

  const accessToken = request.cookies.get('accessToken')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '')

  // Redirect authenticated users away from login
  if (isPublicRoute && accessToken) {
    const payload = decodeJwtPayload(accessToken)
    if (payload?.exp && payload.exp * 1000 > Date.now()) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Redirect unauthenticated users to login
  if (!isPublicRoute && pathname.startsWith('/dashboard')) {
    if (!accessToken) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const payload = decodeJwtPayload(accessToken)
    if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Role-based access check
    const role = payload.role as string
    for (const [route, allowedRoles] of Object.entries(ROLE_ROUTES)) {
      if (pathname.startsWith(route) && !allowedRoles.includes(role)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
