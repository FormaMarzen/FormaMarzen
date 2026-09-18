"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../raporty/klienci/supabase';

interface ClassItem {
  id?: string | number;
  title?: string;
  nazwa?: string;
  time?: string;
  godzina?: string;
  trainer?: string;
  prowadzacy?: string;
  start?: string;
  start_time?: string;
  limit?: number;
  bookedCount?: number;
  isFull?: boolean;
}

interface RegulationItem {
  id: string;
  slug: string;
  title: string;
  content: string;
  checkbox_text?: string;
}

interface ReferrerInfo {
  id: number;
  name: string;
  referral_code: string;
}

function FreeRegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [customLogo, setCustomLogo] = useState('');
  const [logoError, setLogoError] = useState(false);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState<{ id?: any; title: string; time: string; date: string } | null>(null);
  const [classesList, setClassesList] = useState<ClassItem[]>([]);

  // Dane Ambasadora (polecającego)
  const [referrer, setReferrer] = useState<ReferrerInfo | null>(null);

  // Stan formularza danych (Krok 2)
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

  // Status, walidacja i modal sukcesu rejestracji
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // Odczytanie kodu polecającego z URL
  useEffect(() => {
    let rawRef = searchParams.get('ref') || searchParams.get('kod') || searchParams.get('r') || '';
    
    if (!rawRef && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      rawRef = urlParams.get('ref') || urlParams.get('kod') || urlParams.get('r') || '';
    }

    if (rawRef) {
      const cleanRef = rawRef.trim();
      const verifyReferrer = async () => {
        try {
          let { data: clientData } = await supabase
            .from('klienci')
            .select('id, "Imię", "Nazwisko", referral_code')
            .ilike('referral_code', cleanRef)
            .maybeSingle();

          if (!clientData && !isNaN(Number(cleanRef))) {
            const { data: clientById } = await supabase
              .from('klienci')
              .select('id, "Imię", "Nazwisko", referral_code')
              .eq('id', Number(cleanRef))
              .maybeSingle();
            clientData = clientById;
          }

          if (clientData) {
            const fullName = `${clientData['Imię'] || ''} ${clientData['Nazwisko'] || ''}`.trim() || 'Klubowicz Forma Marzeń';
            setReferrer({
              id: clientData.id,
              name: fullName,
              referral_code: clientData.referral_code || cleanRef
            });
          }
        } catch (err) {
          console.error('Błąd weryfikacji ambasadora:', err);
        }
      };
      verifyReferrer();
    }
  }, [searchParams]);

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

  const fetchGrafik = useCallback(async (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayNameKey = ['nd', 'pon', 'wt', 'sr', 'czw', 'pt', 'sb'][date.getDay()];
    const targetDay = date.getDate();
    const targetMonth = date.getMonth() + 1;

    try {
      // Równoległe pobranie zajęć cyklicznych, jednorazowych oraz aktualnych zapisów z bazy
      const [{ data: cykliczne }, { data: jednorazowe }, { data: zapisy }] = await Promise.all([
        supabase.from('grafik_zajec').select('*'),
        supabase.from('zajecia_jednorazowe').select('*').eq('full_date_str', dateStr),
        supabase.from('zapisy_zajec').select('class_key')
      ]);

      const dzisiejszeCykliczne = (cykliczne || []).filter(c => c.days && c.days[dayNameKey]);
      
      let combined: ClassItem[] = [
        ...dzisiejszeCykliczne.map(c => ({ ...c, title: c.title || c.nazwa, time: c.start || c.start_time, trainer: c.trainer || c.prowadzacy })),
        ...(jednorazowe || []).map(j => ({ ...j, title: j.title || j.nazwa, time: j.start_time || j.start, trainer: j.trainer || j.prowadzacy }))
      ];

      // Mapowanie dostępności i limitów miejsc z odporną na formatowanie weryfikacją zapisów
      let processedCombined = combined.map(c => {
        const targetId = String(c.id);

        // Precyzyjne zliczanie dopasowań z bazy (ignorując zera wiodące w miesiącu/dniu)
        const bookedCount = (zapisy || []).filter((s: any) => {
          if (!s.class_key) return false;
          const parts = s.class_key.split('_');
          if (parts.length < 2) return false;
          const sId = parts[0];
          const datePart = parts[1]; // np. "18/09" lub "18/9"
          const [dStr, mStr] = datePart.split('/');
          if (!dStr || !mStr) return false;
          
          return (
            String(sId) === targetId &&
            parseInt(dStr, 10) === targetDay &&
            parseInt(mStr, 10) === targetMonth
          );
        }).length;

        const limit = c.limit !== undefined && c.limit !== null ? Number(c.limit) : 12;
        const isFull = bookedCount >= limit;

        return {
          ...c,
          bookedCount,
          limit,
          isFull
        };
      });

      // Sortowanie od najwcześniejszych do najpóźniejszych godzin danego dnia
      processedCombined.sort((a, b) => {
        const timeA = a.time || a.godzina || a.start || '00:00';
        const timeB = b.time || b.godzina || b.start || '00:00';
        return timeA.localeCompare(timeB);
      });

      // Filtrowanie zajęć, które już minęły lub są z dni przeszłych
      const now = new Date();
      const selectedMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (selectedMidnight < todayMidnight) {
        processedCombined = [];
      } else if (selectedMidnight.getTime() === todayMidnight.getTime()) {
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;

        processedCombined = processedCombined.filter(cls => {
          const clsTime = cls.time || cls.godzina || cls.start || '00:00';
          return clsTime >= currentTimeStr;
        });
      }

      setClassesList(processedCombined);
    } catch (err) {
      console.error('Błąd pobierania grafiku:', err);
      setClassesList([]);
    }
  }, []);

  useEffect(() => {
    fetchGrafik(currentDate);
  }, [currentDate, fetchGrafik]);

  const changeDay = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const handleSelectClass = (cls: ClassItem) => {
    if (cls.isFull) {
      setErrorMsg('Te zajęcia nie mają już wolnych miejsc. Wybierz inny termin.');
      return;
    }
    setErrorMsg('');
    setSelectedClass({
      id: cls.id,
      title: cls.title || cls.nazwa || 'Zajęcia',
      time: cls.time || cls.godzina || cls.start || '',
      date: currentDate.toLocaleDateString('pl-PL')
    });
    setStep(2);
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

    const cleanEmail = email.trim().toLowerCase();
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanPhone = phone.trim();

    setIsLoading(true);
    setErrorMsg('');

    try {
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
      const selectedClassDateIso = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      
      // Konstrukcja class_key spójna z resztą aplikacji (bez zer wiodących)
      const classKey = selectedClass?.id 
        ? `${selectedClass.id}_${currentDate.getDate()}/${currentDate.getMonth() + 1}`
        : null;

      // 2. Operacje bazodanowe
      const databaseOperations: Promise<any>[] = [
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
              referred_by: referrer ? referrer.id : null,
              zapisyNadchodzace: [
                {
                  id: Date.now(),
                  data: selectedClassDateIso,
                  zajecia: selectedClass?.title,
                  karnet: 'Pierwsze bezpłatne',
                  zapisujacy: 'Zapisany przez stronę www'
                }
              ]
            }
          ])
        ),

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

        Promise.resolve(
          supabase.from('czat_wiadomosci').insert([
            {
              nadawca_id: 5000,
              nadawca_nazwa: 'System / Administrator',
              odbiorca_id: 5000,
              tresc: `Nowy użytkownik zarejestrowany (darmowe zajęcia): ${cleanFirstName} ${cleanLastName} (${cleanEmail}, tel: ${cleanPhone})${referrer ? ` [Z polecenia: ${referrer.name}]` : ''}`,
              przeczytana: false
            }
          ])
        )
      ];

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

      if (classKey) {
        databaseOperations.push(
          Promise.resolve(
            supabase.from('zapisy_zajec').insert([
              {
                class_key: classKey,
                klient_id: newClientId,
                status: 'zapisany',
                obecny: false
              }
            ])
          )
        );
      }

      if (referrer) {
        databaseOperations.push(
          Promise.resolve(
            supabase.from('referrals').insert([
              {
                referrer_id: referrer.id,
                referred_client_id: newClientId,
                pass_name: 'Darmowy trening próbny',
                pass_price: 0.00,
                is_qualified: false,
                status: 'oczekuje_na_pierwszy_karnet'
              }
            ])
          )
        );

        databaseOperations.push(
          Promise.resolve(
            supabase.from('czat_wiadomosci').insert([
              {
                nadawca_id: 5000,
                nadawca_nazwa: 'Program Ambasador',
                odbiorca_id: referrer.id,
                tresc: `👋 Twój znajomy ${cleanFirstName} ${cleanLastName} zapisał się na darmowy trening próbny (${selectedClass?.title || 'Zajęcia'}) z Twojego polecenia! Gdy zakupi swój pierwszy karnet (min. 200 zł), otrzymasz nagrodę Ambasadora.`,
                przeczytana: false
              }
            ])
          )
        );
      }

      await Promise.all(databaseOperations);

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

        const pushTitle = 'Nowy klubowicz zarejestrowany!';
        const pushBody = `${cleanFirstName} ${cleanLastName} (${cleanEmail}) zarejestrował(a) się na bezpłatne zajęcia: ${selectedClass?.title || 'Zajęcia'} (${selectedClass?.date || todayIsoStr} ${selectedClass?.time || ''})${referrer ? ` [Ambasador: ${referrer.name}]` : ''}.`;

        if (subscriptions.length > 0) {
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscriptions,
              payload: {
                title: pushTitle,
                body: pushBody,
                url: '/raporty/klienci'
              }
            })
          }).catch(e => console.error('Błąd fetch /api/push/send:', e));
        }

        await supabase.from('historia_powiadomien').insert([
          {
            odbiorca: `Administratorzy (${subscriptions.length} urządz.)`,
            odbiorca_id: null,
            tytul: pushTitle,
            tresc: pushBody,
            typ: 'PUSH',
            status: subscriptions.length > 0 ? 'Wysłano' : 'Brak aktywnych urządzeń'
          }
        ]);
      } catch (pushErr) {
        console.error('Błąd podczas wysyłania powiadomienia push:', pushErr);
      }

      setIsSuccessModalOpen(true);
    } catch (err: any) {
      console.error('Błąd procedury rejestracji:', err);
      setErrorMsg(err.message || 'Wystąpił błąd podczas rejestracji. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalConfirmRedirect = () => {
    setIsSuccessModalOpen(false);
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start p-4 sm:p-8 font-sans antialiased text-slate-800">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6 my-auto">
        
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

          {/* BANER POLECENIA AMBASADORA */}
          {referrer ? (
            <div className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-md text-left flex items-center gap-3.5 border border-emerald-500 animate-in fade-in">
              <span className="text-3xl shrink-0">🎁</span>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-200">
                  Zaproszenie od Ambasadora
                </div>
                <div className="text-xs font-bold mt-0.5 leading-snug">
                  Dołączasz z polecenia klubowicza: <span className="underline font-black text-amber-300">{referrer.name}</span>.
                </div>
                <div className="text-[11px] text-emerald-100 font-medium mt-1">
                  Twój pierwszy trening próbny jest w <strong>100% darmowy (0 zł)</strong>!
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full bg-gradient-to-r from-sky-600 to-blue-700 text-white p-3.5 rounded-2xl shadow-sm text-center">
              <div className="text-[10px] font-black uppercase tracking-wider text-sky-200">
                Pierwszy Trening Próbny
              </div>
              <div className="text-xs font-bold mt-0.5">
                Wybierz dogodny termin – Twoje pierwsze zajęcia są całkowicie bezpłatne!
              </div>
            </div>
          )}

          <p className="text-xs text-slate-600 font-medium">
            Cześć, zapraszam Cię na zajęcia.<br />Myślę, że znajdziesz coś dla siebie.
          </p>

          <div className="w-full grid grid-cols-2 pt-4 text-xs font-bold border-b border-slate-200">
            <div className={`pb-2 border-b-2 ${step === 1 ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400'}`}>
              1. WYBIERZ DARMOWE ZAJĘCIA
            </div>
            <div className={`pb-2 border-b-2 ${step === 2 ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400'}`}>
              2. PRZEDSTAW SIĘ
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl text-center">
            ⚠️ {errorMsg}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-900 font-medium text-center">
              Wybierz datę i zajęcia z poniższego grafiku, na które chcesz bezpłatnie przyjść:
            </div>

            <div className="flex justify-between items-center bg-slate-100 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-800">
              <button onClick={() => changeDay(-1)} className="w-7 h-7 bg-sky-500 text-white rounded-full flex items-center justify-center shadow-sm cursor-pointer">‹</button>
              <div className="text-center flex flex-col items-center">
                <div className="uppercase tracking-wider text-[11px] text-slate-600">{currentDate.toLocaleDateString('pl-PL', { weekday: 'long' }).toUpperCase()}</div>
                <div className="text-sky-600 font-black text-sm flex items-center gap-1.5">
                  {currentDate.toLocaleDateString('pl-PL')}
                  <div className="relative cursor-pointer" title="Wybierz z kalendarza">
                    <input 
                      type="date" 
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                      onChange={(e) => {
                        if (e.target.value) setCurrentDate(new Date(e.target.value));
                      }} 
                    />
                    <span>📅</span>
                  </div>
                </div>
              </div>
              <button onClick={() => changeDay(1)} className="w-7 h-7 bg-sky-500 text-white rounded-full flex items-center justify-center shadow-sm cursor-pointer">›</button>
            </div>

            <div className="space-y-2.5 pt-2">
              {classesList.length > 0 ? (
                classesList.map((cls, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleSelectClass(cls)}
                    className={`border rounded-xl p-3.5 flex justify-between items-center transition-all shadow-sm ${
                      cls.isFull 
                        ? 'bg-slate-100 border-slate-300 opacity-80 cursor-not-allowed' 
                        : 'bg-white border-slate-200 hover:border-emerald-500 cursor-pointer group hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`font-bold text-xs ${cls.isFull ? 'text-slate-500 line-through' : 'text-slate-900 group-hover:text-emerald-700'}`}>
                          {cls.title ?? cls.nazwa ?? 'Zajęcia'}
                        </h4>
                        {cls.isFull ? (
                          <span className="bg-rose-100 text-rose-800 border border-rose-300 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                            <span>🔒</span> Brak miejsc ({cls.bookedCount}/{cls.limit})
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Darmowy Trening ({cls.bookedCount}/{cls.limit})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 block">• Prowadzący: {cls.trainer ?? cls.prowadzacy ?? 'Brak'}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-semibold text-slate-700">{cls.time ?? cls.godzina ?? cls.start ?? ''}</span>
                      {cls.isFull ? (
                        <span className="text-rose-600 text-base" title="Brak miejsc - kłódka">🔒</span>
                      ) : (
                        <span className="text-slate-400 group-hover:text-emerald-600 font-bold">→</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  Brak dostępnych lub nadchodzących zajęć w tym dniu.
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleRegisterAndLogin} className="space-y-4 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 font-medium text-center space-y-1">
              <div>
                Wybrane darmowe zajęcia: <span className="font-black text-emerald-900">{selectedClass?.title}</span>, {selectedClass?.date} o {selectedClass?.time}.
              </div>
              <div className="text-[11px] text-emerald-800 font-bold">
                Cena: 0.00 PLN (Wstęp bezpłatny)
              </div>
            </div>

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

            <div className="flex gap-2 pt-3">
              <button 
                type="button" onClick={() => setStep(1)}
                className="px-4 py-3 bg-slate-200 hover:bg-slate-300 font-bold rounded-xl text-slate-700 cursor-pointer"
              >
                Wstecz
              </button>
              <button 
                type="submit" disabled={isLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-colors disabled:opacity-70 cursor-pointer"
              >
                {isLoading ? 'Zapisywanie na zajęcia...' : '🎟️ ZAPISZ NA DARMOWY TRENING'}
              </button>
            </div>
          </form>
        )}

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

      {/* Modal potwierdzenia udanej rejestracji */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 text-center space-y-5 shadow-2xl border border-sky-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 border-2 border-emerald-300 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner">
              ✓
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                Rejestracja udana!
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Twoje konto zostało utworzone, a bezpłatne wejście na zajęcia (<strong className="text-slate-900">{selectedClass?.title}</strong>) zostało zarezerwowane.
              </p>
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5 font-mono font-bold text-sky-950 text-xs break-all">
                {email}
              </div>
            </div>

            <button
              onClick={handleModalConfirmRedirect}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black py-3.5 rounded-xl uppercase text-xs tracking-wider transition-colors shadow-md cursor-pointer"
            >
              Przejdź do logowania →
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default function FreeRegistrationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400">Ładowanie grafiku zajęć...</div>}>
      <FreeRegistrationContent />
    </Suspense>
  );
}
