"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../app/raporty/klienci/supabase'; 

type Regulation = {
  id: string;
  slug: string;
  title: string;
  content: string;
  force_accept_date: string;
};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Stan przechowujący regulaminy, które muszą zostać natychmiast zaakceptowane
  const [pendingRegulations, setPendingRegulations] = useState<Regulation[]>([]);
  const [isAccepting, setIsAccepting] = useState(false);

  // Dodano obsługę trasy publicznego grafiku obok logowania i rejestracji
  const isPublicPath = 
    pathname === '/login' || 
    pathname?.startsWith('/rejestracja') || 
    pathname === '/grafik-publiczny' || 
    pathname?.startsWith('/grafik-publiczny');

  useEffect(() => {
    const checkAuthAndRegulations = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session && !isPublicPath) {
        router.push('/login');
        return;
      } 
      
      if (session && !isPublicPath) {
        setUserId(session.user.id);
        setUserEmail(session.user.email ?? null);
        
        // 1. Sprawdzamy czy to administrator (admini nie muszą akceptować regulaminów)
        let isAdmin = false;
        if (session.user.email === 'maciejklaput@gmail.com') {
          isAdmin = true;
        } else {
          const { data: clientData } = await supabase
            .from('klienci')
            .select('rola, role')
            .eq('id', session.user.id)
            .single();
          const role = clientData?.rola || clientData?.role || session.user.user_metadata?.role;
          isAdmin = (role === 'admin' || role === 'administrator');
        }

        if (!isAdmin) {
          // 2. Pobieramy regulaminy, które mają ustawione force_accept_date
          const { data: forcedRegs } = await supabase
            .from('regulations')
            .select('*')
            .not('force_accept_date', 'is', null);

          if (forcedRegs && forcedRegs.length > 0) {
            // 3. Pobieramy akceptacje tego konkretnego użytkownika - sortujemy po dacie malejąco (NAJNOWSZE PIERWSZE)
            const { data: userAcceptances } = await supabase
              .from('regulation_acceptances')
              .select('*')
              .eq('user_id', session.user.id)
              .order('accepted_at', { ascending: false });

            // 4. Filtrujemy te, które wymagają (ponownej) akceptacji
            const toAccept = forcedRegs.filter(reg => {
              // find() teraz znajdzie najnowszą akceptację, ponieważ posortowaliśmy tablicę malejąco
              const acceptance = userAcceptances?.find(a => a.regulation_slug === reg.slug);
              if (!acceptance) return true; // Brak jakiejkolwiek akceptacji
              
              // Sprawdzamy, czy NAJNOWSZA data akceptacji jest starsza niż data wymuszenia
              const forceDate = new Date(reg.force_accept_date).getTime();
              const acceptedDate = new Date(acceptance.accepted_at).getTime();
              return acceptedDate < forceDate; 
            });

            setPendingRegulations(toAccept);
          }
        }
        
        setIsAuthorized(true);
      }
      
      setIsChecking(false);
    };
    
    checkAuthAndRegulations();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && !isPublicPath) {
        router.push('/login');
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [pathname, router, isPublicPath]);

  // Funkcja do obsługi kliknięcia "Akceptuję" na zablokowanym ekranie
  const handleAccept = async (slug: string) => {
    if (!userId) return;
    setIsAccepting(true);

    const { error } = await supabase
      .from('regulation_acceptances')
      .insert([{ 
        user_id: userId, 
        user_email: userEmail,
        regulation_slug: slug 
      }]);

    if (!error) {
      // Usuwamy zaakceptowany regulamin z kolejki "do akceptacji"
      setPendingRegulations(prev => prev.filter(r => r.slug !== slug));
    } else {
      console.error(error);
      alert('Wystąpił błąd podczas akceptacji. Spróbuj ponownie.');
    }
    
    setIsAccepting(false);
  };

  // EKRAN ŁADOWANIA (Weryfikacja dostępu)
  if (isChecking && !isPublicPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-xs">
        Weryfikacja dostępu...
      </div>
    );
  }

  // EKRAN BLOKADY (App Blocker)
  if (pendingRegulations.length > 0 && !isPublicPath) {
    const currentReg = pendingRegulations[0]; 
    
    return (
      <div className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 sm:p-8">
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          <div className="p-6 border-b border-slate-100 bg-amber-500 text-slate-950">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-wider">Wymagana akceptacja dokumentu</h2>
                <p className="text-sm font-semibold text-slate-900/80">Aby kontynuować korzystanie z aplikacji, zapoznaj się ze zaktualizowanymi zasadami.</p>
              </div>
            </div>
          </div>
          
          <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-slate-50">
            <h3 className="text-2xl font-bold text-slate-800 mb-6 pb-4 border-b border-slate-200">
              {currentReg.title}
            </h3>
            <div className="prose prose-slate max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
              {currentReg.content || 'Brak treści regulaminu.'}
            </div>
          </div>
          
          <div className="p-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Klikając "Akceptuję", potwierdzasz znajomość powyższego dokumentu.
            </div>
            <button 
              onClick={() => handleAccept(currentReg.slug)}
              disabled={isAccepting}
              className="w-full sm:w-auto px-8 py-3.5 text-slate-950 bg-amber-500 rounded-xl hover:bg-amber-600 transition-colors font-black shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
            >
              {isAccepting ? 'Przetwarzanie...' : 'Akceptuję zasady'}
              {!isAccepting && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STANDARDOWY ZWROT
  return <>{children}</>;
}
