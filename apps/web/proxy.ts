import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  // PROXY SIMPLES - sem autenticação por enquanto
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/auth/login',
  ],
};