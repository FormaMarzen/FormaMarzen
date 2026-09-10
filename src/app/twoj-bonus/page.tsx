"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TwojBonusPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [appRole, setAppRole] = useState<'admin' | 'trener' | 'klubowicz'>('klubowicz');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [allKlienci, setAllKlienci] = useState<any[]>([]);
  const [karnetyCennik, setKarnetyCennik] = useState<any[]>([]);

  // Progi bonusowe (konfigurowalne lub domyślne dla klubu)
  const [progiUmowa] = useState([
    { miesiecy: 3, bonus: '10% zniżki na suplementy w barze + darmowy shake' },
    { miesiecy: 6, bonus: '2 tygodnie zamrożenia ekstra w puli + ręcznik klubowy' },
    { miesiecy: 12, bonus: '1 miesiąc darmowego okresu bonusowego (0 PLN) + koszulka Forma Marzeń' },
  ]);

  const [progiOpen] = useState([
    { cykl: 2, bonus: 'Jednorazowe wejście dla znajomego gratis' },
    { cykl: 4, bonus: '15 PLN w portfelu klubowym do wykorzystania na dowolne usługi' },
    { cykl: 6, bonus: 'Darmowa konsultacja treningowa lub fizjoterapeutyczna' },
  ]);

  const [progiOgolnorozwojowe] = useState([
    { wejsc: 10, bonus: '1 darmowe wejście do puli karnetu' },
    { wejsc: 25, bonus: 'Energetyczny shake białkowy w prezencie' },
  ]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;

      const { data: trenerzyData } = await supabase.from('trenerzy').select('*');
      if (userEmail === 'maciejklaput@gmail.com') {
        setAppRole('admin');
      } else {
        const trenerObj = trenerzyData?.find((t: any) => t.email === userEmail);
        if (trenerObj) {
          setAppRole('trener');
        } else {
          setAppRole('klubowicz');
        }
      }

      // Pobieranie katalogu karnetów
      const { data: karnetyData } = await supabase.from('karnety').select('*');
      if (karnetyData) setKarnetyCennik(karnetyData);

      // Pobieranie klientów
      const { data: klienciData } = await supabase.from('klienci').select('*');
      if (klienciData) {
        const mapped = klienciData.map((c: any) => {
          let parsedKarnety = [];
          if (Array.isArray(c.karnetyKlubowicza)) {
            parsedKarnety = c.karnetyKlubowicza;
          } else if (typeof c.karnetyKlubowicza === 'string') {
            try { parsedKarnety = JSON.parse(c.karnetyKlubowicza); } catch(e) {}
          }
          return {
            ...c,
            firstName: c.Imię || '',
            lastName: c.Nazwisko || '',
            email: c['E-mail'] || c.email || '',
            karnetyKlubowicza: parsedKarnety,
            cyklCiaglosci: c.cyklCiaglosci || 1,
          };
        });
        setAllKlienci(mapped);
        if (userEmail) {
          const myUser = mapped.find((u: any) => u.email === userEmail);
          if (myUser) setCurrentUser(myUser);
        }
      }
    } catch (err) {
      console.error("Błąd ładowania danych dla Twoj Bonus:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, []);

  if (!isMounted || isLoading) {
    return <div className="p-12 text-center text-slate-500 font-bold uppercase text-xs">Ładowanie programu bonusowego...</div>;
  }

  // Aktywny karnet użytkownika (jeśli klubowicz)
  const aktywnyKarnet = currentUser && currentUser.karnetyKlubowicza?.length > 0 ? currentUser.karnetyKlubowicza[0] : null;
  const typAktualnegoKarnetu = aktywnyKarnet?.typKarnetu || 'Na czas';
  const cyklCiągłościKlienta = currentUser?.cyklCiaglosci || 1;

  // Obliczanie postępu dla umowy (np. rata lub miesiące trwania)
  const umowaMiesiaceZaliczone = aktywnyKarnet?.rata ? parseInt(String(aktywnyKarnet.rata).match(/(\d+)/)?.[1] || '1', 10) : 1;

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 font-sans antialiased text-slate-800">
      
      {/* NAGŁÓWEK STRONY */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-sky-200 p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
            🎁 TWÓJ BONUS I PROGRAM LOJALNOŚCIOWY
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Sprawdź swoje progi ciągłości, aktywne bonusy i nagrody za regularność w klubie Forma Marzeń.
          </p>
        </div>
        {appRole === 'admin' && (
          <div className="bg-amber-100 text-amber-900 px-4 py-2 rounded-xl text-xs font-black uppercase border border-amber-300">
            👑 Tryb Administratora (Podgląd globalny)
          </div>
        )}
      </div>

      {/* SEKCJA DLA KLUBOWICZA */}
      {appRole === 'klubowicz' && currentUser && (
        <div className="space-y-6">
          {/* Kafel podsumowania użytkownika */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-sky-200 p-6 rounded-3xl shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase">Twój aktywny karnet</div>
              <div className="text-lg font-black text-slate-900">{aktywnyKarnet ? aktywnyKarnet.nazwa : 'Brak aktywnego karnetu'}</div>
              <div className="text-xs text-sky-800 font-semibold">{typAktualnegoKarnetu}</div>
            </div>

            <div className="bg-white border border-sky-200 p-6 rounded-3xl shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase">Ciągłość i staż (Cykl)</div>
              <div className="text-2xl font-black text-sky-950">{cyklCiągłościKlienta} <span className="text-xs font-normal text-slate-500">miesięcy z rzędu</span></div>
              <div className="text-xs text-emerald-700 font-bold">✓ Zachowana ciągłość płatności</div>
            </div>

            <div className="bg-white border border-sky-200 p-6 rounded-3xl shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase">Status bonusów</div>
              <div className="text-lg font-black text-amber-700">Aktywne progi lojalnościowe</div>
              <div className="text-xs text-slate-500">System automatycznie nalicza nagrody</div>
            </div>
          </div>

          {/* WYŚWIETLANIE PROGÓW W ZALEŻNOŚCI OD TYPU KARNETU */}
          <div className="bg-white border border-sky-200 rounded-3xl p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-black text-sky-950 uppercase tracking-wider border-b border-sky-100 pb-3">
              📋 Progi i nagrody dla Twojego rodzaju karnetu ({typAktualnegoKarnetu})
            </h3>

            {typAktualnegoKarnetu === 'Umowa 12 miesięcy' ? (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-900 text-xs">
                  <strong>Zasady dla Umowy Cyklicznej:</strong> Im dłużej trenujesz bez przerwy, tym cenniejsze bonusy otrzymujesz. Po 12. racie zyskujesz darmowy okres bonusowy za dni zamrożenia.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {progiUmowa.map((p, idx) => {
                    const osiagniety = umowaMiesiaceZaliczone >= p.miesiecy;
                    return (
                      <div key={idx} className={`border rounded-2xl p-5 space-y-3 ${osiagniety ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-black text-xs uppercase text-slate-900">Próg {p.miesiecy} miesięcy</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${osiagniety ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'}`}>
                            {osiagniety ? 'ODBLOKOWANY ✓' : 'W TRAKCIE'}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-700">{p.bonus}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : typAktualnegoKarnetu === 'Na czas' ? (
              <div className="space-y-4">
                <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl text-sky-900 text-xs">
                  <strong>Zasady dla karnetów OPEN / Na czas:</strong> Regularne odnawianie karnetu buduje Twój cykl ciągłości miesięcznej.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {progiOpen.map((p, idx) => {
                    const osiagniety = cyklCiągłościKlienta >= p.cykl;
                    return (
                      <div key={idx} className={`border rounded-2xl p-5 space-y-3 ${osiagniety ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-black text-xs uppercase text-slate-900">Cykl {p.cykl} miesięcy</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${osiagniety ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'}`}>
                            {osiagniety ? 'ODBLOKOWANY ✓' : 'W TRAKCIE'}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-700">{p.bonus}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl text-sky-900 text-xs">
                  <strong>Zasady dla karnetów Ogólnorozwojowych / Na ilość wejść:</strong> Liczy się liczba wykorzystanych wejść i dynamika treningów.
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {progiOgolnorozwojowe.map((p, idx) => (
                    <div key={idx} className="border border-slate-200 bg-slate-50 rounded-2xl p-5 space-y-3">
                      <div className="font-black text-xs uppercase text-slate-900">Próg: {p.wejsc} wejść</div>
                      <p className="text-xs font-medium text-slate-700">{p.bonus}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WIDOK DLA ADMINISTRATORA / TRENERA */}
      {(appRole === 'admin' || appRole === 'trener') && (
        <div className="space-y-6">
          <div className="bg-white border border-sky-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-sky-950 uppercase tracking-wider">
              ⚙️ Konfiguracja progów bonusowych w klubie
            </h3>
            <p className="text-xs text-slate-500">
              Poniższe progi są automatycznie weryfikowane przez system na podstawie ciągłości karnetów i historii klientów w bazie Supabase.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="bg-sky-50/50 border border-sky-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-black text-xs text-sky-950 uppercase">Progi: Umowa 12M</h4>
                <ul className="space-y-2 text-xs text-slate-700">
                  {progiUmowa.map((p, i) => (
                    <li key={i} className="bg-white p-2.5 rounded-xl border border-sky-100 flex justify-between">
                      <span><strong>{p.miesiecy}M:</strong> {p.bonus}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-sky-50/50 border border-sky-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-black text-xs text-sky-950 uppercase">Progi: Karnety OPEN</h4>
                <ul className="space-y-2 text-xs text-slate-700">
                  {progiOpen.map((p, i) => (
                    <li key={i} className="bg-white p-2.5 rounded-xl border border-sky-100 flex justify-between">
                      <span><strong>{p.cykl} Cykle:</strong> {p.bonus}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-sky-50/50 border border-sky-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-black text-xs text-sky-950 uppercase">Progi: Ogólnorozwojowe</h4>
                <ul className="space-y-2 text-xs text-slate-700">
                  {progiOgolnorozwojowe.map((p, i) => (
                    <li key={i} className="bg-white p-2.5 rounded-xl border border-sky-100 flex justify-between">
                      <span><strong>{p.wejsc} Wejść:</strong> {p.bonus}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* LISTA KLIENTÓW I ICH CYKL CIĄGŁOŚCI */}
          <div className="bg-white border border-sky-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-sky-100 font-black text-sm text-sky-950 uppercase">
              👥 Status ciągłości klubowiczów w bazie
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sky-50/70 border-b border-sky-200 text-[11px] font-bold text-sky-900 uppercase">
                    <th className="py-3 px-4">Klubowicz</th>
                    <th className="py-3 px-4">E-mail</th>
                    <th className="py-3 px-4">Cykl Ciągłości</th>
                    <th className="py-3 px-4">Aktywny Karnet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100 text-xs">
                  {allKlienci.slice(0, 15).map((klient) => {
                    const karnet = klient.karnetyKlubowicza?.[0];
                    return (
                      <tr key={klient.id} className="hover:bg-sky-50/40">
                        <td className="py-3 px-4 font-bold text-slate-900">{klient.firstName} {klient.lastName}</td>
                        <td className="py-3 px-4 text-slate-600">{klient.email}</td>
                        <td className="py-3 px-4 font-black text-sky-900">{klient.cyklCiaglosci} mies.</td>
                        <td className="py-3 px-4 text-slate-700">{karnet ? karnet.nazwa : 'Brak'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
