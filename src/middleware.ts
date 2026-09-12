import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname;

  // Ścieżki, które NIE WYMAGAJĄ logowania
  const isPublicPath = 
    path === '/login' || 
    path.startsWith('/rejestracja') || 
    path.startsWith('/grafik-publiczny');

  // Sprawdzamy, czy istnieje ciasteczko autoryzacyjne sesji Supabase
  const allCookies = req.cookies.getAll();
  const hasSessionCookie = allCookies.some(
    cookie => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  );

  // Jeśli użytkownik NIE MA sesji i próbuje wejść na stronę chronioną
  if (!hasSessionCookie && !isPublicPath) {
    // Przekierowanie na login na poziomie serwera
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Jeśli zalogowany użytkownik wchodzi na /login, przenieś go do aplikacji
  if (hasSessionCookie && path === '/login') {
    return NextResponse.redirect(new URL('/', req.url)); 
  }

  return res;
}

// Konfiguracja ścieżek
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
