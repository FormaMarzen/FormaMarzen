"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../raporty/klienci/supabase';

interface RegulationItem {
  id: string;
  slug: string;
  title: string;
  content: string;
  checkbox_text?: string;
}

export default function GeneralRegistrationPage() {
  const router = useRouter();
  const [customLogo, setCustomLogo] = useState('');
  const [logoError, setLogoError] = useState(false);

  // Stan formularza danych
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  // Dynamiczne regulaminy i zgody
  const [regulations, setRegulations] = useState<RegulationItem[]>([]);
  const [acceptedRegulations, setAcceptedRegulations] = useState<{ [key: string]: boolean }>({});
  
  // Stan modalu podglądu regulaminu
  const [activeModalReg, setActiveModalReg] = useState<RegulationItem | null>(null);

  // Status, walidacja i modal potwierdzenia adresu e-mail
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  useEffect(() => {
    try {
      const savedLogo = typeof window !== 'undefined' ? localStorage.getItem('forma_marzen_logo') : null;
      if (savedLogo) setCustomLogo(savedLogo);
    } catch (e) {
      console.warn('Brak dostępu do localStorage:', e);
    }

    fetchRegulations();
  }, []);

  const fetchRegulations = async () => {
    try {
      const { data, error } = await supabase.from('regulations').select('*').order('id', { ascending: true });
      if (data && !error) {
        setRegulations(data);
        const initialAccepted: { [key: string]: boolean } = {};
        data.forEach((reg: RegulationItem) => {
          initialAccepted[reg.slug] = false;
        });
        setAcceptedRegulations(initialAccepted);
      }
    } catch (err) {
      console.error('Błąd pobierania regulaminów:', err);
    }
  };

  const handleCheckboxChange = (slug: string, checked: boolean) => {
    setAcceptedRegulations(prev => ({ ...prev, [slug]: checked }));
  };

  const renderCheckboxTextWithLinks = (reg: RegulationItem) => {
    const text = reg.checkbox_text || `Zapoznałem się i akceptuję [[${reg.title}]]`;
    const parts = text.split(/\[\[(.*?)\]\]/g);

    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <span 
            key={index} 
            onClick={(e) => {
              e.preventDefault();
              setActiveModalReg(reg);
            }}
            className="text-sky-600 font-bold underline cursor-pointer hover:text-sky-700 transition-colors"
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const sendPushToAdmins = async (title: string, body: string, url: string = '/raporty/klienci') => {
    try {
      const { data: adminSubs } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('role', 'admin');

      const subscriptions = (adminSubs || [])
        .map(s => {
          if (!s.subscription) return null;
          try {
            return typeof s.subscription === 'string' ? JSON.parse(s.subscription) : s.subscription;
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);

      if (subscriptions.length > 0) {
        fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscriptions,
            payload: { title, body, url }
          })
        }).catch(e => console.error('Błąd fetch /api/push/send:', e));
      }

      await supabase.from('historia_powiadomien').insert([
        {
          odbiorca: `Administratorzy (${subscriptions.length} urządz.)`,
          odbiorca_id: null,
          tytul: title,
          tresc: body,
          typ: 'PUSH',
          status: subscriptions.length > 0 ? 'Wysłano' : 'Brak aktywnych urządzeń'
        }
      ]);
    } catch (pushErr) {
      console.error('Błąd podczas wysyłania powiadomienia push do administratora:', pushErr);
    }
  };

  const handleRegisterAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    
    const allAccepted = regulations.every(reg => acceptedRegulations[reg.slug]);
    if (!allAccepted) {
      setErrorMsg('Musisz zaznaczyć i zaakceptować wszystkie wymagane zgody i regulaminy.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Hasło musi mieć co najmniej 6 znaków.');
      return;
    }

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    setIsLoading(true);
    setErrorMsg('');

    try {
      // Weryfikacja czy adres e-mail już istnieje w tabeli klienci (niewrażliwa na wielkość liter)
      const { data: existingClientCheck } = await supabase
        .from('klienci')
        .select('id')
        .ilike('E-mail', cleanEmail)
        .maybeSingle();

      if (existingClientCheck) {
        setErrorMsg('Konto z tym adresem e-mail już istnieje! Przejdź do ekranu logowania.');
        setIsLoading(false);
        return;
      }

      // 1. Rejestracja w Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: { first_name: cleanFirstName, last_name: cleanLastName, phone: cleanPhone }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setErrorMsg('Konto z tym adresem e-mail już istnieje! Przejdź do ekranu logowania.');
        } else {
          setErrorMsg(authError.message);
        }
        setIsLoading(false);
        return;
      }

      const newUserId = authData.user?.id;
      const newClientId = Date.now();
      const todayIsoStr = new Date().toISOString().split('T')[0];

      // 2. Równoległe zapisy bazodanowe (zabezpieczone Promise.resolve)
      const databaseOperations: Promise<any>[] = [
        // 2a. Utworzenie rekordu w tabeli klienci
        Promise.resolve(
          supabase.from('klienci').insert([
            {
              id: newClientId,
              Imię: cleanFirstName,
              Nazwisko: cleanLastName,
              "Numer tel.": cleanPhone,
              "E-mail": cleanEmail,
              Zarejestrowany: todayIsoStr,
              Portfel: '0.00 PLN',
              karnetyKlubowicza: [],
              zapisyNadchodzace: []
            }
          ])
        ),

        // 2b. Początkowa transakcja
        Promise.resolve(
          supabase.from('transakcje').insert([
            {
              klient_id: newClientId,
              typ_operacji: 'utworzenie_konta',
              kwota: 0.00,
              opis: 'Utworzenie nowego konta klubowicza (saldo startowe)'
            }
          ])
        ),

        // 2c. Powiadomienie na czacie dla administratora (ID 5000)
        Promise.resolve(
          supabase.from('czat_wiadomosci').insert([
            {
              nadawca_id: 5000,
              nadawca_nazwa: 'System / Administrator',
              odbiorca_id: 5000,
              tresc: `Nowy użytkownik zarejestrowany (konto ogólne): ${cleanFirstName} ${cleanLastName} (${cleanEmail}, tel: ${cleanPhone})`,
              przeczytana: false
            }
          ])
        )
      ];

      // 2d. Zapis akceptacji regulaminów
      if (newUserId && regulations.length > 0) {
        const acceptanceInserts = regulations.map(reg => ({
          user_id: newUserId,
          user_email: cleanEmail,
          regulation_slug: reg.slug,
          accepted_at: new Date().toISOString()
        }));
        databaseOperations.push(
          Promise.resolve(supabase.from('regulation_acceptances').insert(acceptanceInserts))
        );
      }

      await Promise.all(databaseOperations);

      // 3. Wysłanie powiadomienia Web Push w tle
      sendPushToAdmins(
        'Nowe konto klubowicza!',
        `${cleanFirstName} ${cleanLastName} (${cleanEmail}) utworzył(a) nowe konto w aplikacji.`,
        '/raporty/klienci'
      );

      setIsLoading(false);
      setIsSuccessModalOpen(true);

    } catch (err: any) {
      console.error('Błąd procedury rejestracji ogólnej:', err);
      setErrorMsg(err.message || 'Wystąpił błąd podczas tworzenia konta.');
      setIsLoading(false);
    }
  };

  const handleModalConfirmRedirect = () => {
    setIsSuccessModalOpen(false);
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start py-12 px-4 sm:px-8 font-sans antialiased text-slate-800 overflow-y-auto">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6 mb-12">
        
        <div className="flex flex-col items-center space-y-3 text-center border-b border-slate-100 pb-6">
          <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center p-2 overflow-hidden">
            {customLogo ? (
              <img src={customLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : !logoError ? (
              <img 
                src="/logo.png" 
                alt="Forma Marzeń Logo" 
                className="max-h-full max-w-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="text-red-600 font-black text-xl">🏋️‍♂️</span>
            )}
          </div>
          <h1 className="text-lg font-black text-sky-950 uppercase tracking-wide">
            DOŁĄCZ DO KLUBU
          </h1>
          <p className="text-xs text-slate-600 font-medium">
            Utwórz konto w aplikacji Forma Marzeń, aby korzystać z harmonogramu, zapisów i funkcji społecznościowych.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl text-center">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegisterAndLogin} className="space-y-4 text-xs">
          <div className="space-y-3">
            <input 
              type="text" required placeholder="Imię *"
              value={firstName} onChange={(e) => setFirstName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-sky-500"
            />
            <input 
              type="text" required placeholder="Nazwisko *"
              value={lastName} onChange={(e) => setLastName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-sky-500"
            />
            <input 
              type="email" required placeholder="Adres e-mail *"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-sky-500"
            />
            <input 
              type="tel" required placeholder="Numer telefonu *"
              value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-sky-500"
            />
            <input 
              type="password" required placeholder="Ustaw hasło do konta (min. 6 znaków) *"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="space-y-2.5 pt-2 text-[11px] text-slate-600 border-t border-slate-100 mt-4 pt-4">
            {regulations.length > 0 ? (
              regulations.map((reg) => (
                <label key={reg.slug} className="flex items-start gap-2.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={!!acceptedRegulations[reg.slug]} 
                    onChange={(e) => handleCheckboxChange(reg.slug, e.target.checked)} 
                    className="mt-0.5 accent-blue-600 shrink-0" 
                  />
                  <span className="leading-relaxed">
                    {renderCheckboxTextWithLinks(reg)}
                  </span>
                </label>
              ))
            ) : (
              <div className="text-slate-400 italic text-center">Ładowanie wymaganych zgód...</div>
            )}
          </div>

          <div className="pt-3">
            <button 
              type="submit" disabled={isLoading}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black py-3.5 rounded-xl uppercase text-xs tracking-wider shadow-md transition-colors disabled:opacity-70 cursor-pointer"
            >
              {isLoading ? 'Tworzenie konta...' : '✨ ZAREJESTRUJ SIĘ'}
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-[11px] text-slate-500">
              Masz już konto? <Link href="/login" className="text-sky-600 font-bold underline">Zaloguj się</Link>
            </p>
          </div>
        </form>

      </div>

      {/* Modal regulaminu */}
      {activeModalReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-base text-slate-800">{activeModalReg.title}</h3>
              <button 
                onClick={() => setActiveModalReg(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
              {activeModalReg.content || 'Brak treści tego dokumentu.'}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setActiveModalReg(null)}
                className="px-5 py-2 bg-slate-800 text-white font-bold rounded-xl text-xs hover:bg-slate-900 cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal potwierdzenia rejestracji i weryfikacji e-mail */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 text-center space-y-5 shadow-2xl border border-sky-200">
            <div className="w-16 h-16 bg-sky-100 text-sky-700 border-2 border-sky-300 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner">
              ✉️
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                Potwierdź swój adres e-mail!
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Twoje konto zostało pomyślnie utworzone w aplikacji Forma Marzeń. Przed pierwszym zalogowaniem <strong className="text-slate-900">musisz potwierdzić swój adres e-mail</strong>, klikając w link aktywacyjny, który właśnie wysłaliśmy na:
              </p>
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5 font-mono font-bold text-sky-950 text-xs break-all">
                {email}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 font-medium text-left">
              ℹ️ Sprawdź także folder <strong>SPAM</strong> lub <strong>Oferty</strong>, jeśli wiadomość nie pojawi się w skrzynce odbiorczej w ciągu minuty.
            </div>

            <button
              onClick={handleModalConfirmRedirect}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black py-3.5 rounded-xl uppercase text-xs tracking-wider transition-colors shadow-md cursor-pointer"
            >
              Rozumiem, przejdź do logowania →
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
