"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
}

interface RegulationItem {
  id: string;
  slug: string;
  title: string;
  content: string;
  checkbox_text?: string;
}

export default function FreeRegistrationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [customLogo, setCustomLogo] = useState('');
  const [logoError, setLogoError] = useState(false);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedClass, setSelectedClass] = useState<{ id?: any; title: string; time: string; date: string } | null>(null);
  const [classesList, setClassesList] = useState<ClassItem[]>([]);

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

  // Status, walidacja i modal potwierdzenia adresu e-mail
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  useEffect(() => {
    const savedLogo = localStorage.getItem('forma_marzen_logo');
    if (savedLogo) setCustomLogo(savedLogo);

    fetchGrafik(currentDate);
    fetchRegulations();
  }, [currentDate]);

  const fetchGrafik = async (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayNameKey = ['nd', 'pon', 'wt', 'sr', 'czw', 'pt', 'sb'][date.getDay()];

    const { data: cykliczne } = await supabase.from('grafik_zajec').select('*');
    const { data: jednorazowe } = await supabase.from('zajecia_jednorazowe').select('*').eq('full_date_str', dateStr);

    const dzisiejszeCykliczne = (cykliczne || []).filter(c => c.days && c.days[dayNameKey]);
    
    let combined: ClassItem[] = [
      ...dzisiejszeCykliczne.map(c => ({ ...c, title: c.title || c.nazwa, time: c.start || c.start_time, trainer: c.trainer || c.prowadzacy })),
      ...(jednorazowe || []).map(j => ({ ...j, title: j.title || j.nazwa, time: j.start_time || j.start, trainer: j.trainer || j.prowadzacy }))
    ];

    // Sortowanie od najwcześniejszych do najpóźniejszych godzin danego dnia
    combined.sort((a, b) => {
      const timeA = a.time || a.godzina || a.start || '00:00';
      const timeB = b.time || b.godzina || b.start || '00:00';
      return timeA.localeCompare(timeB);
    });

    // Filtrowanie zajęć, które już minęły lub są z dni przeszłych
    const now = new Date();
    const selectedMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (selectedMidnight < todayMidnight) {
      combined = [];
    } else if (selectedMidnight.getTime() === todayMidnight.getTime()) {
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;

      combined = combined.filter(cls => {
        const clsTime = cls.time || cls.godzina || cls.start || '00:00';
        return clsTime >= currentTimeStr;
      });
    }

    setClassesList(combined);
  };

  const fetchRegulations = async () => {
    const { data, error } = await supabase.from('regulations').select('*').order('id', { ascending: true });
    if (data && !error) {
      setRegulations(data);
      const initialAccepted: { [key: string]: boolean } = {};
      data.forEach((reg: RegulationItem) => {
        initialAccepted[reg.slug] = false;
      });
      setAcceptedRegulations(initialAccepted);
    }
  };

  const changeDay = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  const handleSelectClass = (cls: ClassItem) => {
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
    
    const allAccepted = regulations.every(reg => acceptedRegulations[reg.slug]);
    if (!allAccepted) {
      setErrorMsg('Musisz zaznaczyć i zaakceptować wszystkie wymagane zgody i regulaminy.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Hasło musi mieć co najmniej 6 znaków.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    // Weryfikacja czy adres e-mail już istnieje w tabeli klienci
    const { data: existingClientCheck } = await supabase
      .from('klienci')
      .select('id')
      .eq('E-mail', email)
      .maybeSingle();

    if (existingClientCheck) {
      setErrorMsg('Konto z tym adresem e-mail już istnieje! Przejdź do ekranu logowania.');
      setIsLoading(false);
      return;
    }

    // 1. Rejestracja w Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { first_name: firstName, last_name: lastName, phone: phone }
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

    // 2. Zapis akceptacji regulaminów z adresem e-mail
    if (newUserId) {
      const acceptanceInserts = regulations.map(reg => ({
        user_id: newUserId,
        user_email: email,
        regulation_slug: reg.slug,
        accepted_at: new Date().toISOString()
      }));
      await supabase.from('regulation_acceptances').insert(acceptanceInserts);
    }

    // 3. Dodanie klienta do tabeli "klienci" wraz z inicjalizacją portfela
    const { error: klientError } = await supabase.from('klienci').insert([
      {
        id: newClientId,
        Imię: firstName,
        Nazwisko: lastName,
        "Numer tel.": phone,
        "E-mail": email,
        Zarejestrowany: todayIsoStr,
        Portfel: '0.00 PLN',
        karnetyKlubowicza: [],
        zapisyNadchodzace: [
          {
            id: Date.now(),
            data: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`,
            zajecia: selectedClass?.title,
            karnet: 'Pierwsze bezpłatne',
            zapisujacy: 'Zapisany przez stronę www'
          }
        ]
      }
    ]);

    if (klientError) {
      console.error("Błąd zapisu klienta do bazy:", klientError);
    }

    // 4. Dodanie początkowej transakcji w tabeli transakcje
    await supabase.from('transakcje').insert([
      {
        klient_id: newClientId,
        typ_operacji: 'utworzenie_konta',
        kwota: 0.00,
        opis: 'Utworzenie nowego konta klubowicza (saldo startowe)'
      }
    ]);

    // 5. Dodanie wpisu do tabeli zapisów na zajęcia
    if (selectedClass?.id) {
      const classKey = `${selectedClass.id}_${currentDate.getDate().toString().padStart(2, '0')}/${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
      await supabase.from('zapisy_zajec').insert([
        {
          class_key: classKey,
          klient_id: newClientId,
          status: 'zapisany',
          obecny: false
        }
      ]);
    }

    // 6. Powiadomienie na czacie dla administratora (ID 5000)
    await supabase.from('czat_wiadomosci').insert([
      {
        nadawca_id: 5000,
        nadawca_nazwa: 'System / Administrator',
        odbiorca_id: 5000,
        tresc: `Nowy użytkownik zarejestrowany (darmowe zajęcia): ${firstName} ${lastName} (${email}, tel: ${phone})`,
        przeczytana: false
      }
    ]);

    // 7. Wysłanie powiadomienia Web Push do Administratora i rejestracja w historia_powiadomien
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
      const pushBody = `${firstName} ${lastName} (${email}) zarejestrował(a) się na bezpłatne zajęcia: ${selectedClass?.title || 'Zajęcia'} (${selectedClass?.date || todayIsoStr} ${selectedClass?.time || ''}).`;

      if (subscriptions.length > 0) {
        await fetch('/api/push/send', {
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
        });
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
      console.error('Błąd podczas wysyłania powiadomienia push do administratora:', pushErr);
    }

    setIsLoading(false);
    setIsSuccessModalOpen(true);
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
          <p className="text-xs text-slate-600 font-medium">
            Cześć, zapraszam Cię na zajęcia.<br />Myślę, że znajdziesz coś dla siebie.
          </p>

          <div className="w-full grid grid-cols-2 pt-4 text-xs font-bold border-b border-slate-200">
            <div className={`pb-2 border-b-2 ${step === 1 ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400'}`}>
              1. WYBIERZ ZAJĘCIA
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
              Cześć! Bardzo się cieszymy, że chcesz do nas dołączyć! Wybierz datę i zajęcia, na które chcesz się zapisać.
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
                    className="bg-white border border-slate-200 hover:border-sky-400 rounded-xl p-3.5 flex justify-between items-center cursor-pointer transition-all shadow-sm group"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-sky-600">
                        {cls.title ?? cls.nazwa ?? 'Zajęcia'}
                      </h4>
                      <span className="text-[11px] text-slate-500">• Prowadzący: {cls.trainer ?? cls.prowadzacy ?? 'Brak'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-700">{cls.time ?? cls.godzina ?? cls.start ?? ''}</span>
                      <span className="text-slate-400 group-hover:text-sky-600">→</span>
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
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-900 font-medium text-center">
              Wybrane zajęcia: <span className="font-bold">{selectedClass?.title}</span>, {selectedClass?.date} o {selectedClass?.time}. Świetnie! Teraz daj nam proszę znać trochę o sobie i widzimy się na zajęciach!
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
                className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-xl shadow-md transition-colors disabled:opacity-70 cursor-pointer"
              >
                {isLoading ? 'Zapisywanie na zajęcia...' : '📅 ZAPISZ NA ZAJĘCIA'}
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
                Twoje konto zostało pomyślnie utworzone, a miejsce na pierwszych bezpłatnych zajęciach (<strong className="text-slate-900">{selectedClass?.title}</strong>) zostało zarezerwowane. Przed pierwszym zalogowaniem <strong className="text-slate-900">musisz potwierdzić swój adres e-mail</strong>, klikając w link aktywacyjny, który właśnie wysłaliśmy na:
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
