"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Bezpośrednia inicjalizacja klienta publicznego Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function PublicSchedulePage() {
  const [activeTab, setActiveTab] = useState<'grafik' | 'karnety'>('grafik');
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);

  const [zapisaneZajecia, setZapisaneZajecia] = useState<any[]>([]);
  const [jednorazoweZajecia, setJednorazoweZajecia] = useState<any[]>([]);
  const [nadpisaneZajeciaDni, setNadpisaneZajeciaDni] = useState<{ [key: string]: any }>({});
  const [wydarzeniaKilkudniowe, setWydarzeniaKilkudniowe] = useState<any[]>([]);
  const [zapisyNaZajecia, setZapisyNaZajecia] = useState<{ [key: string]: any[] }>({});
  const [rodzajeZajec, setRodzajeZajec] = useState<any[]>([]);
  const [karnetyCennik, setKarnetyCennik] = useState<any[]>([]);

  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [calendarViewDate, setCalendarViewDate] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // STAN ZASAD ZAPISÓW (DO WERYFIKACJI AUTOODWOŁANIA)
  const [bookingRules, setBookingRules] = useState<any>({
    min_participants: null,
    auto_cancel_deadline_minutes: null,
    min_participants_per_class: {},
    auto_cancel_deadline_per_class: {},
  });

  const getMonday = (d: Date) => {
    const dCopy = new Date(d);
    const day = dCopy.getDay();
    if (day === 6) {
      dCopy.setDate(dCopy.getDate() + 2);
    } else if (day === 0) {
      dCopy.setDate(dCopy.getDate() + 1);
    }
    const currentDayOfWeek = dCopy.getDay();
    const diff = dCopy.getDate() - currentDayOfWeek + (currentDayOfWeek === 0 ? -6 : 1);
    return new Date(dCopy.setDate(diff));
  };

  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return "60 min";
    try {
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const diffMins = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMins > 0) return `${diffMins} min`;
    } catch (e) {}
    return "60 min";
  };

  const getTopBorderColor = (title: string, isOdwolane: boolean, isUsuniete: boolean) => {
    if (isOdwolane || isUsuniete) return '#fda4af';
    if (!title) return '#0284c7';
    const found = rodzajeZajec.find(r => r.nazwa?.trim().toLowerCase() === title?.trim().toLowerCase());
    if (found && found.kolor) return found.kolor;
    const colorPalette = ['#2563eb', '#9333ea', '#16a34a', '#dc2626', '#d97706', '#0d9488', '#c026d3'];
    let hash = 0;
    for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash);
    return colorPalette[Math.abs(hash) % colorPalette.length];
  };

  const checkClassAutoCancellation = (classItem: any, displayDate: string, signups: any[]) => {
    if (!classItem || classItem.isOdwołane || classItem.isUsunięte) return { isAutoCancelled: false, reason: '' };
    
    const trainingName = classItem.title || '';
    const minRequired = bookingRules.min_participants_per_class?.[trainingName] !== undefined
      ? bookingRules.min_participants_per_class[trainingName]
      : bookingRules.min_participants;
    
    const deadlineMins = bookingRules.auto_cancel_deadline_per_class?.[trainingName] !== undefined
      ? bookingRules.auto_cancel_deadline_per_class[trainingName]
      : bookingRules.auto_cancel_deadline_minutes;

    if (minRequired && minRequired > 0 && deadlineMins !== null && deadlineMins !== undefined && deadlineMins > 0) {
      const [dStr, mStr] = displayDate.split('/');
      const classYear = currentDate ? currentDate.getFullYear() : new Date().getFullYear();
      const [sh = '00', sm = '00'] = (classItem.start || '00:00').split(':');
      const classStartDateTime = new Date(classYear, parseInt(mStr) - 1, parseInt(dStr), parseInt(sh), parseInt(sm), 0);
      const now = new Date();
      const diffMinutes = (classStartDateTime.getTime() - now.getTime()) / (1000 * 60);

      if (diffMinutes <= deadlineMins && diffMinutes >= 0) {
        const activeCount = Array.isArray(signups) ? signups.filter(s => s.status === 'zapisany').length : 0;
        if (activeCount < minRequired) {
          return {
            isAutoCancelled: true,
            reason: `ODWOŁANE (Brak min. frekwencji)`
          };
        }
      }
    }
    return { isAutoCancelled: false, reason: '' };
  };

  const loadPublicData = async () => {
    try {
      setIsLoading(true);

      // 1. Nadrzędne reguły
      const { data: rulesData } = await supabase
        .from('club_booking_rules')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rulesData) {
        setBookingRules({
          min_participants: rulesData.min_participants ?? null,
          auto_cancel_deadline_minutes: rulesData.auto_cancel_deadline_minutes ?? null,
          min_participants_per_class: rulesData.min_participants_per_class || {},
          auto_cancel_deadline_per_class: rulesData.auto_cancel_deadline_per_class || {},
        });
      }

      // 2. Szablony grafiku
      const { data: szablonyData } = await supabase.from('grafik_zajec').select('*');
      if (szablonyData) {
        setZapisaneZajecia(szablonyData.map((s: any) => ({
          id: s.id,
          title: s.title || s.nazwa,
          start: s.start || s.start_time,
          end: s.end || s.end_time,
          trainer: s.trainer || s.prowadzacy,
          limit: s.limit || s.limit_miejsc,
          days: s.days || {},
          isOdwołane: false,
          isUsunięte: false
        })));
      }

      // 3. Zajęcia jednorazowe
      const { data: jednorazoweData } = await supabase.from('zajecia_jednorazowe').select('*');
      if (jednorazoweData) {
        setJednorazoweZajecia(jednorazoweData.map((j: any) => ({
          id: j.id,
          title: j.title || j.nazwa,
          start: j.start_time || j.start,
          end: j.end_time || j.end,
          trainer: j.trainer,
          limit: j.limit_miejsc || j.limit,
          displayDate: j.display_date,
          fullDateStr: j.full_date_str,
          isJednorazowe: true,
          isOdwołane: false,
          isUsunięte: false
        })));
      }

      // 4. Nadpisania dni (edycje/odwołania)
      const { data: nadpisaniaData } = await supabase.from('nadpisania_zajec').select('*');
      if (nadpisaniaData) {
        const nadpisaniaMap: { [key: string]: any } = {};
        nadpisaniaData.forEach((n: any) => {
          nadpisaniaMap[n.class_key] = {
            start: n.start,
            end: n.end,
            trainer: n.trainer,
            limit: n.limit,
            isOdwołane: n.is_odwolane,
            isUsunięte: n.is_usuniete
          };
        });
        setNadpisaneZajeciaDni(nadpisaniaMap);
      }

      // 5. Zapisy (dla liczników wolnych miejsc)
      const { data: zapisyData } = await supabase.from('zapisy_zajec').select('class_key, status');
      if (zapisyData) {
        const grouped: { [key: string]: any[] } = {};
        zapisyData.forEach((z: any) => {
          if (!grouped[z.class_key]) grouped[z.class_key] = [];
          grouped[z.class_key].push(z);
        });
        setZapisyNaZajecia(grouped);
      }

      // 6. Wydarzenia kilkudniowe (obozy)
      const { data: wydarzeniaData } = await supabase.from('wydarzenia_kilkudniowe').select('*');
      if (wydarzeniaData) {
        setWydarzeniaKilkudniowe(wydarzeniaData.map((w: any) => ({
          id: w.id,
          title: w.title,
          dateFrom: w.date_from,
          dateTo: w.date_to
        })));
      }

      // 7. Rodzaje zajęć (kolory)
      const { data: rodzajeData } = await supabase.from('rodzaje_zajec').select('*');
      if (rodzajeData) {
        setRodzajeZajec(rodzajeData);
      }

      // 8. Obowiązujące karnety
      const { data: karnetyData } = await supabase
        .from('cennik')
        .select('*')
        .order('id', { ascending: true });

      if (karnetyData && karnetyData.length > 0) {
        setKarnetyCennik(karnetyData);
      } else {
        // Domyślny pakiet demonstracyjny w przypadku pustej tabeli
        setKarnetyCennik([
          {
            id: 1,
            nazwa: 'Karnet Open',
            cena: '199 zł',
            okres: '30 dni',
            opis: 'Nielimitowany dostęp do wszystkich zajęć grupowych w klubie.',
            popularny: true,
            korzysci: ['Wszystkie zajęcia grupowe', 'Rezerwacja miejsc online', 'Brak umowy terminowej']
          },
          {
            id: 2,
            nazwa: 'Karnet 8 Wejść',
            cena: '150 zł',
            okres: '30 dni',
            opis: 'Idealny wybór dla osób trenujących regularnie 2 razy w tygodniu.',
            popularny: false,
            korzysci: ['8 wejść na dowolne zajęcia', 'Ważność 30 dni', 'Elastyczne rezerwacje']
          },
          {
            id: 3,
            nazwa: 'Karnet 4 Wejścia',
            cena: '90 zł',
            okres: '30 dni',
            opis: 'Świetny pakiet startowy dla osób zaczynających swoją przygodę.',
            popularny: false,
            korzysci: ['4 wejścia na zajęcia', 'Ważność 30 dni', 'Dostęp do panelu klienta']
          },
          {
            id: 4,
            nazwa: 'Wejście Jednorazowe',
            cena: '35 zł',
            okres: '1 trening',
            opis: 'Pojedyncze wejście na wybrany trening grupowy.',
            popularny: false,
            korzysci: ['1 trening grupowy', 'Płatność przed wejściem', 'Pełna elastyczność']
          }
        ]);
      }
    } catch (err) {
      console.error("Błąd podczas pobierania publicznego grafiku:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 6) now.setDate(now.getDate() + 2);
    else if (dayOfWeek === 0) now.setDate(now.getDate() + 1);

    setCurrentDate(now);
    setCalendarViewDate(now);
    loadPublicData();
  }, []);

  if (!isMounted || !currentDate || !calendarViewDate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 font-bold text-sm tracking-wide animate-pulse">
          Ładowanie grafiku zajęć...
        </div>
      </div>
    );
  }

  const currentMonday = getMonday(currentDate);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentTimeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

  const daysList = Array.from({ length: 5 }).map((_, index) => {
    const dayDate = new Date(currentMonday);
    dayDate.setDate(currentMonday.getDate() + index);

    const dayNames = ['PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK'];
    const keys = ['pon', 'wt', 'sr', 'czw', 'pt'];

    const dayStr = String(dayDate.getDate()).padStart(2, '0');
    const monthStr = String(dayDate.getMonth() + 1).padStart(2, '0');
    const isoDateStr = `${dayDate.getFullYear()}-${monthStr}-${dayStr}`;

    const isToday =
      dayDate.getDate() === today.getDate() &&
      dayDate.getMonth() === today.getMonth() &&
      dayDate.getFullYear() === today.getFullYear();

    return {
      day: dayNames[index],
      key: keys[index],
      date: `${dayStr}/${monthStr}`,
      isoDate: isoDateStr,
      fullDate: dayDate,
      isToday
    };
  });

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const nextMonth = () => {
    setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1));
  };

  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

  return (
    <div className="min-h-screen bg-slate-100/60 py-8 px-3 sm:px-6 font-sans antialiased text-slate-800">
      <div className="max-w-[1700px] mx-auto space-y-6">

        {/* NAGŁÓWEK STRONY Z PRZEŁĄCZNIKIEM ZAKŁADEK I PRZYCISKAMI AKCJI */}
        <header className="bg-white border border-sky-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-5">
          
          {/* LOGO I TYTUŁ */}
          <div className="flex items-center gap-4 text-center lg:text-left">
            <div className="w-14 h-14 bg-gradient-to-tr from-sky-600 to-amber-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-md shrink-0">
              ⚡
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-sky-950">
                FORMA MARZEŃ
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Grafik treningów klubowych oraz aktualna oferta karnetów.
              </p>
            </div>
          </div>

          {/* ZAKŁADKI: GRAFIK / KARNETY */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-sky-100">
            <button
              onClick={() => setActiveTab('grafik')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'grafik'
                  ? 'bg-white text-sky-950 shadow-sm border border-sky-200'
                  : 'text-slate-600 hover:text-sky-950'
              }`}
            >
              📅 Grafik zajęć
            </button>
            <button
              onClick={() => setActiveTab('karnety')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'karnety'
                  ? 'bg-white text-sky-950 shadow-sm border border-sky-200'
                  : 'text-slate-600 hover:text-sky-950'
              }`}
            >
              🎟️ Obowiązujące karnety
            </button>
          </div>

          {/* PRZYCISKI AKCJI: ZAPISZ NA TRENING / ZALOGUJ */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-center">
            <button
              onClick={() => setIsSignupModalOpen(true)}
              className="flex-1 sm:flex-initial bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black px-6 py-3 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-transform active:scale-95 text-center flex items-center justify-center gap-2 cursor-pointer border border-amber-400"
            >
              <span>🔥</span> ZAPISZ NA TRENING
            </button>

            <Link
              href="/login"
              className="flex-1 sm:flex-initial bg-sky-950 hover:bg-sky-900 text-white font-black px-6 py-3 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-transform active:scale-95 text-center flex items-center justify-center gap-2 cursor-pointer border border-sky-900"
            >
              <span>👤</span> ZALOGUJ SIĘ DO PANELU ↗
            </Link>
          </div>
        </header>

        {/* MODAL: WYBÓR TYPU ZAPISU */}
        {isSignupModalOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-sky-200 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 relative">
              <button
                onClick={() => setIsSignupModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>

              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-xl mx-auto font-black shadow-inner">
                  ✨
                </div>
                <h2 className="text-xl font-black text-sky-950 uppercase tracking-wide">
                  Dołącz do treningu
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Wybierz jedną z opcji poniżej, aby rozpocząć treningi w naszym klubie:
                </p>
              </div>

              <div className="space-y-3 pt-2">
                {/* PRZYCISK 1: KUP KARNET */}
                <button
                  onClick={() => {
                    setIsSignupModalOpen(false);
                    setActiveTab('karnety');
                  }}
                  className="w-full bg-sky-950 hover:bg-sky-900 text-white font-black py-4 px-6 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-between group cursor-pointer border border-sky-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🎟️</span>
                    <div className="text-left">
                      <div className="font-black">KUP KARNET</div>
                      <div className="text-[10px] text-sky-200 font-normal">Zobacz dostępne pakiety i karnety</div>
                    </div>
                  </div>
                  <span className="text-sky-300 group-hover:translate-x-1 transition-transform">→</span>
                </button>

                {/* PRZYCISK 2: PIERWSZY BEZPŁATNY TRENING */}
                <Link
                  href="/login?first_free=true"
                  onClick={() => setIsSignupModalOpen(false)}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black py-4 px-6 rounded-2xl text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-between group cursor-pointer border border-amber-400"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🎁</span>
                    <div className="text-left">
                      <div className="font-black">PIERWSZY BEZPŁATNY TRENING</div>
                      <div className="text-[10px] text-amber-950/80 font-medium">Wypróbuj nasze zajęcia bez opłat</div>
                    </div>
                  </div>
                  <span className="text-slate-950 group-hover:translate-x-1 transition-transform">→</span>
                </Link>
              </div>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-slate-400">
                  Masz już konto? <Link href="/login" className="text-sky-700 font-bold underline">Zaloguj się</Link>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* WIDOK: ZAKŁADKA 1 - GRAFIK ZAJĘĆ */}
        {activeTab === 'grafik' && (
          <>
            {/* NAWIGACJA TYGODNI */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={handlePrevWeek}
                className="w-10 h-10 bg-white text-sky-700 hover:bg-sky-50 border border-sky-200 rounded-full flex items-center justify-center font-bold shadow-sm shrink-0 transition-transform active:scale-95 cursor-pointer"
                title="Poprzedni tydzień"
              >
                ◀
              </button>

              <div className="grid grid-cols-5 gap-2 sm:gap-3 flex-1 min-w-[500px]">
                {daysList.map((d, i) => (
                  <div
                    key={i}
                    className={`flex flex-col items-center justify-center px-2 py-3 rounded-2xl text-xs font-bold border transition-all ${
                      d.isToday
                        ? 'bg-white border-rose-500 text-rose-950 shadow-md border-b-4 border-b-rose-600'
                        : 'bg-white/80 border-sky-200 text-slate-700'
                    }`}
                  >
                    <span className={`tracking-wide uppercase text-[11px] ${d.isToday ? 'text-rose-700 font-black' : ''}`}>
                      {d.day}
                    </span>
                    <button
                      onClick={() => {
                        setCurrentDate(d.fullDate);
                        setCalendarViewDate(new Date(d.fullDate.getFullYear(), d.fullDate.getMonth(), 1));
                        setIsCalendarOpen(!isCalendarOpen);
                      }}
                      className={`font-normal text-[11px] mt-1 underline decoration-dotted cursor-pointer px-2.5 py-0.5 rounded-lg transition-colors ${
                        d.isToday ? 'bg-rose-100 text-rose-800' : 'text-sky-700 hover:text-sky-900 bg-sky-50'
                      }`}
                    >
                      {d.date} 📅
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleNextWeek}
                className="w-10 h-10 bg-white text-sky-700 hover:bg-sky-50 border border-sky-200 rounded-full flex items-center justify-center font-bold shadow-sm shrink-0 transition-transform active:scale-95 cursor-pointer"
                title="Następny tydzień"
              >
                ▶
              </button>
            </div>

            {/* KALENDARZ MIESIĘCZNY (POPUP) */}
            {isCalendarOpen && (
              <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-2xl max-w-md mx-auto space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                  <button onClick={prevMonth} className="w-8 h-8 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl font-bold cursor-pointer">◀</button>
                  <h3 className="font-black text-sm text-sky-950 uppercase">{monthNames[month]} {year}</h3>
                  <button onClick={nextMonth} className="w-8 h-8 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl font-bold cursor-pointer">▶</button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map((mName, idx) => (
                    <div key={idx} className="font-bold text-sky-900 py-1 text-[11px]">{mName}</div>
                  ))}

                  {Array.from({ length: firstDayIndex }).map((_, idx) => (
                    <div key={`empty-${idx}`} />
                  ))}

                  {Array.from({ length: totalDays }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const thisDate = new Date(year, month, dayNum);
                    const isSelected = currentDate ? currentDate.getDate() === dayNum && currentDate.getMonth() === month && currentDate.getFullYear() === year : false;

                    return (
                      <button
                        key={dayNum}
                        onClick={() => {
                          setCurrentDate(thisDate);
                          setIsCalendarOpen(false);
                        }}
                        className={`py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          isSelected ? 'bg-rose-900 text-white shadow-sm' : 'hover:bg-sky-100 text-slate-700 bg-sky-50/50'
                        }`}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2 border-t border-sky-100">
                  <button onClick={() => setIsCalendarOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-1.5 rounded-xl text-xs cursor-pointer">
                    Zamknij
                  </button>
                </div>
              </div>
            )}

            {/* GŁÓWNA SIATKA GRAFIKU */}
            <main className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
              {daysList.map((col, idx) => {
                const aktywneWydarzeniaDnia = wydarzeniaKilkudniowe.filter((w: any) => col.isoDate >= w.dateFrom && col.isoDate <= w.dateTo);
                const czyObózAktywny = aktywneWydarzeniaDnia.length > 0;

                const standardoweDnia = czyObózAktywny ? [] : zapisaneZajecia
                  .filter((item: any) => item.days && item.days[col.key])
                  .map((item: any) => {
                    const classKey = `${item.id}_${col.date}`;
                    const override = nadpisaneZajeciaDni[classKey];
                    return override ? { ...item, ...override } : item;
                  })
                  .filter((item: any) => !item.isUsunięte);

                const jednorazoweDnia = czyObózAktywny ? [] : jednorazoweZajecia
                  .filter((item: any) => item.displayDate === col.date)
                  .filter((item: any) => !item.isUsunięte);

                const zajeciaDnia = [...standardoweDnia, ...jednorazoweDnia].sort((a: any, b: any) => (a.start || "").localeCompare(b.start || ""));
                const isPastDay = col.isoDate < todayStr;

                return (
                  <div
                    key={idx}
                    className={`space-y-3 p-3.5 rounded-3xl border transition-all ${
                      col.isToday
                        ? 'bg-white border-rose-500 shadow-md border-t-4 border-t-rose-600'
                        : 'bg-white/80 border-sky-100'
                    }`}
                  >
                    <div className={`text-xs font-black uppercase tracking-wider border-b pb-2 mb-2 text-center ${
                      col.isToday ? 'text-rose-950 border-rose-200' : 'text-sky-900 border-sky-100'
                    }`}>
                      <span className={col.isToday ? 'text-rose-700' : ''}>{col.day}</span>{' '}
                      <span className={`text-[10px] font-normal ${col.isToday ? 'text-rose-800' : 'text-slate-500'}`}>({col.date})</span>
                    </div>

                    {/* WYDARZENIA KILKUDNIOWE (OBOZY) */}
                    {aktywneWydarzeniaDnia.map((wydarzenie: any) => (
                      <div key={wydarzenie.id} className="bg-rose-100 border border-rose-300 rounded-2xl p-4 text-center space-y-1.5 shadow-sm">
                        <div className="py-1.5 px-3 bg-rose-200 text-rose-950 font-black rounded-xl text-xs uppercase tracking-wider border border-rose-300">
                          {wydarzenie.title}
                        </div>
                        <div className="text-[11px] text-rose-900 font-bold">
                          Odwołano zajęcia z powodu wydarzenia
                        </div>
                      </div>
                    ))}

                    {/* LISTA ZAJĘĆ */}
                    {zajeciaDnia.length > 0 ? (
                      zajeciaDnia.map((item: any, classIdx: number) => {
                        const durationText = calculateDuration(item.start, item.end);
                        const classKey = `${item.id}_${col.date}`;
                        const zapisani = zapisyNaZajecia[classKey] || [];
                        const limitZajec = item.limit || 12;

                        const liczbaGlowna = Math.min(zapisani.length, limitZajec);
                        const liczbaKrzesełko = Math.max(0, zapisani.length - limitZajec);
                        const isFull = zapisani.length >= limitZajec;
                        const isPastTime = col.isoDate === todayStr && (item.start < currentTimeStr);
                        const isPastEvent = isPastDay || isPastTime;

                        const autoCancelStatus = checkClassAutoCancellation(item, col.date, zapisani);
                        const isClassCancelled = item.isOdwołane || autoCancelStatus.isAutoCancelled;
                        const topColor = getTopBorderColor(item.title, isClassCancelled, item.isUsunięte);

                        return (
                          <div
                            key={`${item.id}_${col.date}_${classIdx}`}
                            style={{ borderTopWidth: '4px', borderTopStyle: 'solid', borderTopColor: topColor }}
                            className={`bg-white border rounded-2xl p-3.5 space-y-2 shadow-sm relative transition-all ${
                              isClassCancelled
                                ? 'border-rose-200 opacity-75 bg-rose-50/20 cursor-default'
                                : isPastEvent
                                ? 'border-slate-200 opacity-60 grayscale-[30%] cursor-default'
                                : 'border-slate-100 hover:border-sky-200 hover:shadow-md cursor-default'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="truncate">
                                <span className="text-sm font-black text-slate-900">{item.start}</span>
                                <h3 className="text-xs font-bold text-slate-800 truncate" title={item.title}>
                                  {item.title}
                                </h3>
                              </div>
                              {isPastEvent && !isClassCancelled && (
                                <span className="text-slate-400 text-xs shrink-0" title="Zajęcia już się odbyły">
                                  ⏱️
                                </span>
                              )}
                            </div>

                            {isClassCancelled ? (
                              <div className="py-1 px-2 bg-rose-100 text-rose-800 font-black text-center rounded-lg text-[10px] uppercase tracking-wider border border-rose-200">
                                {autoCancelStatus.isAutoCancelled ? autoCancelStatus.reason : 'ODWOŁANE'}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-1 text-[10px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-bold px-2 py-0.5 rounded-md border ${
                                    isFull ? 'bg-rose-100 text-rose-900 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  }`}>
                                    👥 {liczbaGlowna}/{limitZajec}
                                  </span>
                                  {liczbaKrzesełko > 0 && (
                                    <span className="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded-md border border-blue-200">
                                      🪑 {liczbaKrzesełko}
                                    </span>
                                  )}
                                </div>
                                <span className="text-slate-400 font-medium whitespace-nowrap text-[10px]">
                                  ⏱ {durationText}
                                </span>
                              </div>
                            )}

                            <div className="text-[11px] text-slate-600 font-medium border-t border-slate-100 pt-1.5 flex items-center gap-1.5 truncate">
                              <span className="text-[10px]">👤</span>
                              <span className="truncate">{item.trainer || 'Brak trenera'}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      aktywneWydarzeniaDnia.length === 0 && (
                        <div className="py-10 text-center text-xs text-slate-400 font-medium">
                          Brak zajęć w tym dniu.
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </main>
          </>
        )}

        {/* WIDOK: ZAKŁADKA 2 - OBOWIĄZUJĄCE KARNETY */}
        {activeTab === 'karnety' && (
          <section className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-white border border-sky-200 rounded-3xl p-6 sm:p-8 text-center max-w-3xl mx-auto space-y-3">
              <span className="bg-amber-100 text-amber-900 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                Oferta klubu
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-sky-950 uppercase tracking-tight">
                Wybierz karnet dla siebie
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                Przejrzyste zasady bez ukrytych opłat. Wybierz dogodny pakiet i ciesz się regularnymi treningami.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {karnetyCennik.map((karnet: any) => (
                <div
                  key={karnet.id}
                  className={`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between relative shadow-sm hover:shadow-md ${
                    karnet.popularny
                      ? 'border-amber-400 shadow-amber-100 border-2 ring-2 ring-amber-400/20'
                      : 'border-sky-100'
                  }`}
                >
                  {karnet.popularny && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                      Najczęściej wybierany
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-black text-sky-950 uppercase">
                        {karnet.nazwa || karnet.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {karnet.opis || karnet.description || 'Dostęp do treningów grupowych'}
                      </p>
                    </div>

                    <div className="py-2 border-y border-slate-100">
                      <div className="text-3xl font-black text-slate-900">
                        {karnet.cena || karnet.price}
                      </div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                        Ważność: {karnet.okres || karnet.duration || '30 dni'}
                      </div>
                    </div>

                    {karnet.korzysci && Array.isArray(karnet.korzysci) && (
                      <ul className="space-y-2 text-xs text-slate-600">
                        {karnet.korzysci.map((korzysc: string, kIdx: number) => (
                          <li key={kIdx} className="flex items-center gap-2">
                            <span className="text-emerald-500 font-black">✓</span>
                            <span>{korzysc}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="pt-6 mt-4 border-t border-slate-100">
                    <Link
                      href="/login"
                      className={`w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider text-center block transition-transform active:scale-95 ${
                        karnet.popularny
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md'
                          : 'bg-sky-950 hover:bg-sky-900 text-white'
                      }`}
                    >
                      Kup karnet ↗
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* STOPKA INFORMACYJNA */}
        <footer className="bg-white border border-sky-200 rounded-3xl p-6 text-center text-xs text-slate-500 space-y-3">
          <p className="font-bold text-slate-800 uppercase tracking-wide text-sm">
            Chcesz zapisać się na zajęcia lub dołączyć do klubu?
          </p>
          <p className="max-w-md mx-auto">
            Zaloguj się do swojego profilu klubowicza lub skontaktuj się bezpośrednio z recepcją klubu.
          </p>
          <div className="pt-2 flex justify-center gap-3 flex-wrap">
            <button
              onClick={() => setIsSignupModalOpen(true)}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl uppercase tracking-wider shadow-sm transition-all cursor-pointer"
            >
              Dołącz teraz ↗
            </button>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-sky-950 hover:bg-sky-900 text-white font-black px-6 py-2.5 rounded-xl uppercase tracking-wider shadow-sm transition-all"
            >
              Panel logowania ↗
            </Link>
          </div>
        </footer>

      </div>
    </div>
  );
}
