"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../app/raporty/klienci/supabase'; // Upewnij się, że ścieżka do Supabase jest poprawna

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Sprawdzamy czy ścieżka zaczyna się od rejestracja lub jest loginem
  const isPublicPath = pathname === '/login' || pathname?.startsWith('/rejestracja');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session && !isPublicPath) {
        router.push('/login');
      } else {
        setIsAuthorized(true);
      }
    };
    
    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && !isPublicPath) {
        router.push('/login');
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [pathname, router, isPublicPath]);

  if (!isAuthorized && !isPublicPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-xs">
        Weryfikacja dostępu...
      </div>
    );
  }

  return <>{children}</>;
}
