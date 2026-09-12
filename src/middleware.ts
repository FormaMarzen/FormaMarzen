import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Ponieważ standardowy klient Supabase przechowuje sesję w localStorage,
  // serwer nie widzi ciasteczek autoryzacyjnych. 
  // Ochronę interfejsu pozostawiamy komponentowi AuthGuard, a bazę zabezpieczymy przez RLS.
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
