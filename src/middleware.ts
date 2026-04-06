import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// These are the admin routes that need protection
const protectedRoutes = [
  '/admin',
  '/customers',
  '/ebikes',
  '/orders',
  '/reports',
  '/riders',
  '/tracking',
  '/profile'
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Handle CORS preflight for all API routes explicitly
  if (pathname.startsWith('/api/')) {
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
        },
      });
    }
  }

  // Check if it's an admin protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  )

  if (isProtectedRoute) {
    const token = request.cookies.get('token')?.value

    if (!token) {
      // No token found, redirect to admin login
      const url = request.nextUrl.clone()
      url.pathname = '/adminlogin'
      return NextResponse.redirect(url)
    }
  }

  // Allow the request to proceed if valid or unrestricted
  const response = NextResponse.next()
  
  // Inject CORS headers into all API responses
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images).*)'],
}
