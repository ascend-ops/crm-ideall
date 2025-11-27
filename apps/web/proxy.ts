// proxy.ts - ATUALIZADO
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  let response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Sincroniza a sessão (IMPORTANTE para cookies)
  supabase.auth.getSession()

  // VERIFICA O COOKIE ESPECÍFICO DO SEU PROJETO
  const projectId = 'csjfusyklmerbjqkcaqo' // do seu URL do Supabase
  const hasAuthToken = request.cookies.get(`sb-${projectId}-auth-token`)?.value
  
  const pathname = request.nextUrl.pathname

  console.log("🛡️ Proxy verificando:", {
    pathname,
    hasAuthToken: !!hasAuthToken,
    cookies: request.cookies.getAll().map(c => c.name)
  })

  // Redireciona se já está logado e tenta acessar login
  if (hasAuthToken && pathname.startsWith("/auth/login")) {
    console.log("🔀 Redirecionando para dashboard (já logado)")
    return NextResponse.redirect(new URL("/app/dashboard", request.url))
  }

  // Redireciona se não está logado e tenta acessar dashboard
  if (!hasAuthToken && pathname.startsWith("/app/dashboard")) {
    console.log("🔀 Redirecionando para login (não logado)")
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/app/dashboard/:path*',
    '/auth/login',
  ],
}