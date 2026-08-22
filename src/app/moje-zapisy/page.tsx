"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Bezpośrednia, bezpieczna inicjalizacja klienta Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function MojeZapisyPage() {
  const [activeTab, setActiveTab] = useState<'zapisy' | 'ranking'>('zapisy');
  const [isOnlyRanking, setIsOnlyRanking] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Zapisy i interakcje
  const [zapisyNadchodzace, setZapisyNadchodzace] = useState<any[]>([]);
  const [showAllActive, setShowAllActive] = useState(false);
  const [zapisyPrzeszle, setZapisyPrzeszle] = useState<any[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [itemToUnregister, setItemToUnregister] = useState<any | null>(null);

  // Ranking globalny i wyszukiwarki
  const [allUsersAttendance, setAllUsersAttendance] = useState<any[]>([]);
  const [rankingFilterMonth, setRankingFilterMonth] = useState(new Date().getMonth());
  const [rankingFilterYear, setRankingFilterYear] = useState(new Date().getFullYear());
  const [rankingSearchMonth, setRankingSearchMonth] = useState('');
  const [rankingSearchYear, setRankingSearchYear] = useState('');

  // Statystyki użytkownika
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth());
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());

  // Stan nadrzędnych reguł rezerwacji
  const [bookingRules, setBookingRules] = useState<any>({
    cancel_deadline_minutes: 90,
    cancel_deadline_per_class: {},
    booking_cutoff_minutes: null,
    booking_cutoff_per_class: {},
    booking_window_days: 14,
    booking_window_per_pass: {},
    expired_pass_grace_days: 15,
    expired_pass_grace_per_pass: {},
    max_daily_bookings: null,
    max_daily_same_type_bookings: 1
  });

  // Pomocnicza funkcja do bezpiecznego parsowania daty z class_key
  const parseDateFromClassKey = (classKey: string) => {
    const parts = classKey ? classKey.split('_') : [];
    const datePart = parts[1] || '';
    const currentYear = new Date().getFullYear();

    if (!datePart) return new Date();

    if (datePart.includes('/')) {
      const segments = datePart.split('/');
      if (segments.length === 2) {
        const [d, m] = segments;
        return new Date(currentYear, parseInt(m) - 1, parseInt(d));
      } else if (segments.length === 3) {
        const [d, m, y] = segments;
        const fullYear = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
        return new Date(fullYear, parseInt(m) - 1, parseInt(d));
      }
    } else if (datePart.includes('-')) {
      const segments = datePart.split('-');
      if (segments.length === 3) {
        // YYYY-MM-DD
        const [y, m, d] = segments;
        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      } else if (segments.length === 2) {
        // DD-MM
        const [d, m] = segments;
        return new Date(currentYear, parseInt(m) - 1, parseInt(d));
      }
    }
    return new Date();
  };

  useEffect(() => {
    // Sprawdzenie czy widok jest uruchomiony z parametrem w adresie lub w menu administratora
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const path = window.location.pathname.toLowerCase();
      if (params.get('ranking') === 'true' || path.includes('admin') || path.includes('ranking')) {
        setIsOnlyRanking(true);
        setActiveTab('ranking');
      }
    }
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Pobranie nadrzędnych zasad z club_booking_rules
      const { data: rulesData } = await supabase
        .from('club_booking_rules')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rulesData) {
        setBookingRules({
          cancel_deadline_minutes: rulesData.cancel_deadline_minutes ?? 90,
          cancel_deadline_per_class: rulesData.cancel_deadline_per_class || {},
          booking_cutoff_minutes: rulesData.booking_cutoff_minutes ?? null,
          booking_cutoff_per_class: rulesData.booking_cutoff_per_class || {},
          booking_window_days: rulesData.booking_window_days ?? 14,
          booking_window_per_pass: rulesData.booking_window_per_pass || {},
          expired_pass_grace_days: rulesData.expired_pass_grace_days ?? 15,
          expired_pass_grace_per_pass: rulesData.expired_pass_grace_per_pass || {},
          max_daily_bookings: rulesData.max_daily_bookings ?? null,
          max_daily_same_type_bookings: rulesData.max_daily_same_type_bookings ?? 1
        });
      }

      // 2. Pobranie zalogowanego użytkownika z tabeli klienci
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;

      if (userEmail) {
        const { data: klientData } = await supabase
          .from('klienci')
          .select('*')
          .eq('E-mail', userEmail)
          .single();
          
        if (klientData) {
          const rawClient = klientData as any;
          let parsedKarnety = [];
          if (Array.isArray(rawClient.karnetyKlubowicza)) {
            parsedKarnety = rawClient.karnetyKlubowicza;
          } else if (typeof rawClient.karnetyKlubowicza === 'string') {
            try { parsedKarnety = JSON.parse(rawClient.karnetyKlubowicza); } catch(e) {}
          }

          const parsedClient = {
            ...rawClient,
            firstName: rawClient.Imię || rawClient.firstName || '',
            lastName: rawClient.Nazwisko || rawClient.lastName || '',
            karnetyKlubowicza: parsedKarnety
          };
          setCurrentUser(parsedClient);

          // 3. Pobranie grafików, zajęć jednorazowych, nadpisań i zapisów użytkownika
          const [{ data: szablonyData }, { data: jednorazoweData }, { data: nadpisaniaData }, { data: zData }] = await Promise.all([
            supabase.from('grafik_zajec').select('*'),
            supabase.from('zajecia_jednorazowe').select('*'),
            supabase.from('nadpisania_zajec').select('*'),
            supabase.from('zapisy_zajec').select('*').eq('klient_id', rawClient.id)
          ]);

          if (zData) {
            const nadchodzace: any[] = [];
            const przeszle: any[] = [];
            const dzis = new Date();
            dzis.setHours(0, 0, 0, 0);

            zData.forEach((z: any) => {
              const parts = z.class_key ? z.class_key.split('_') : [];
              const classId = parts[0];
              let znalezionaNazwa = z.tytul || z.zajecia || null;
              let znalezionaGodzina = '';
              let limitMiejsc = 12;

              const override = nadpisaniaData?.find((n: any) => n.class_key === z.class_key);
              if (override) {
                if (override.start) znalezionaGodzina = override.start;
                if (override.limit) limitMiejsc = override.limit;
              }

              if (classId) {
                const szablon = szablonyData?.find((s: any) => String(s.id) === String(classId));
                if (szablon) {
                  if (!znalezionaNazwa) znalezionaNazwa = szablon.title || szablon.nazwa;
                  if (!znalezionaGodzina) znalezionaGodzina = szablon.start || szablon.start_time;
                  if (szablon.limit || szablon.limit_miejsc) limitMiejsc = szablon.limit || szablon.limit_miejsc;
                } else {
                  const jednorazowe = jednorazoweData?.find((j: any) => String(j.id) === String(classId));
                  if (jednorazowe) {
                    if (!znalezionaNazwa) znalezionaNazwa = jednorazowe.title || jednorazowe.nazwa;
                    if (!znalezionaGodzina) znalezionaGodzina = jednorazowe.start_time || jednorazowe.start;
                    if (jednorazowe.limit || jednorazowe.limit_miejsc) limitMiejsc = jednorazowe.limit || jednorazowe.limit_miejsc;
                  }
                }
              }

              const dataObj = parseDateFromClassKey(z.class_key);
              const [sh = '00', sm = '00'] = (znalezionaGodzina || '00:00').split(':');
              const fullStartDateTime = new Date(dataObj.getFullYear(), dataObj.getMonth(), dataObj.getDate(), parseInt(sh), parseInt(sm), 0);

              const formatDataPL = dataObj.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
              const dzienTygodniaPL = dataObj.toLocaleDateString('pl-PL', { weekday: 'long' });
              const nazwaZGodzina = znalezionaGodzina ? `${znalezionaNazwa || 'Trening klubowy'} ${znalezionaGodzina}` : (znalezionaNazwa || 'Trening klubowy');

              const obecnoscText = (z.obecny === true || z.obecny === 1 || z.obecny === 'true' || z.obecny === 'TRUE' || z.obecny === '1') ? 'Obecny' : (z.nieobecny ? 'Nieobecny' : (z.status === 'krzesełko' ? 'Lista rezerwowa' : 'Zapisany'));

              const itemObj = {
                id: z.id,
                classKey: z.class_key,
                rawClassTitle: znalezionaNazwa || 'Trening',
                limit: limitMiejsc,
                data: formatDataPL,
                dzienTygodnia: dzienTygodniaPL.charAt(0).toUpperCase() + dzienTygodniaPL.slice(1),
                rawDate: dataObj,
                fullStartDateTime,
                zajecia: nazwaZGodzina,
                statusZapisu: z.status,
                karnet: parsedClient.karnetyKlubowicza?.[0]?.nazwa || 'OPEN',
                obecnosc: obecnoscText
              };

              if (fullStartDateTime >= new Date()) {
                nadchodzace.push(itemObj);
              } else {
                przeszle.push(itemObj);
              }
            });

            nadchodzace.sort((a, b) => a.fullStartDateTime.getTime() - b.fullStartDateTime.getTime());
            przeszle.sort((a, b) => b.fullStartDateTime.getTime() - a.fullStartDateTime.getTime());

            setZapisyNadchodzace(nadchodzace);
            setZapisyPrzeszle(przeszle);
          }
        }
      }

      // 4. Pobieranie danych do globalnego rankingu klubowiczów ze wszystkich zapisów i klientów
      const [{ data: allRecords }, { data: allClients }] = await Promise.all([
        supabase.from('zapisy_zajec').select('klient_id, obecny, class_key'),
        supabase.from('klienci').select('id, Imię, Nazwisko, firstName, lastName')
      ]);

      if (allRecords && allClients) {
        const rankingMap: Record<number, any> = {};
        
        allRecords.filter((r: any) => r.obecny === true || r.obecny === 1 || r.obecny === 'true' || r.obecny === 'TRUE' || r.obecny === '1').forEach((r: any) => {
          if (!rankingMap[r.klient_id]) {
            const client = allClients.find((c: any) => String(c.id) === String(r.klient_id)) as any;
            const imie = client ? (client.Imię || client.firstName || '') : '';
            const nazwisko = client ? (client.Nazwisko || client.lastName || '') : '';
            const fullName = `${imie} ${nazwisko}`.trim();

            rankingMap[r.klient_id] = {
              name: fullName || `Klubowicz ID: ${r.klient_id}`,
              records: []
            };
          }

          const dateObj = parseDateFromClassKey(r.class_key);
          rankingMap[r.klient_id].records.push({ date: dateObj });
        });

        setAllUsersAttendance(Object.values(rankingMap));
      }

    } catch (err) {
      console.error("Błąd ładowania danych:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmWypisanie = async () => {
    if (!currentUser || !itemToUnregister) return;

    const trainingName = itemToUnregister.rawClassTitle || '';
    const cancelDeadlineMinutes = bookingRules.cancel_deadline_per_class?.[trainingName] ?? bookingRules.cancel_deadline_minutes ?? 90;
    const now = new Date();
    const diffMinutes = (itemToUnregister.fullStartDateTime.getTime() - now.getTime()) / (1000 * 60);

    if (diffMinutes < cancelDeadlineMinutes && diffMinutes > 0) {
      if (!confirm(`Uwaga: Czas na bezpłatny wypis z tych zajęć wynosi ${cancelDeadlineMinutes} minut przed rozpoczęciem. Czy na pewno chcesz zrezygnować?`)) {
        return;
      }
    }

    const classKey = itemToUnregister.classKey;
    const limitZajec = itemToUnregister.limit || 12;

    const { data: allParticipants } = await supabase
      .from('zapisy_zajec')
      .select('*')
      .eq('class_key', classKey);

    const { error } = await supabase
      .from('zapisy_zajec')
      .delete()
      .eq('class_key', classKey)
      .eq('klient_id', currentUser.id);

    if (error) {
      alert(`Błąd podczas wypisywania: ${error.message}`);
      return;
    }

    let updatedKarnety = [...(currentUser.karnetyKlubowicza || [])];
    const passIndex = updatedKarnety.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
    if (passIndex !== -1) {
      const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10);
      const poczatkowe = parseInt(updatedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
      if (!isNaN(currentRemaining)) {
        updatedKarnety[passIndex] = {
          ...updatedKarnety[passIndex],
          pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
        };
        await supabase.from('klienci').update({ karnetyKlubowicza: updatedKarnety }).eq('id', currentUser.id);
      }
    }

    await supabase.from('transakcje').insert([{
      klient_id: currentUser.id,
      typ_operacji: 'zajecia_wypis',
      class_key: classKey,
      opis: `${currentUser.firstName || 'Klubowicz'} - Samodzielne wypisanie z zajęć: ${itemToUnregister.zajecia} (${itemToUnregister.data}). Zwrócono 1 wejście.`
    }]);

    await supabase.from('booking_logs').insert([{
      action_type: 'CANCEL_SUCCESS',
      status: 'SUCCESS',
      reason: `${currentUser.firstName || 'Klubowicz'} wypisał się z ${classKey} w widoku Moje Zapisy`,
      rule_applied: 'USER_CANCEL',
      payload: { klient_id: currentUser.id, class_key: classKey }
    }]);

    if (allParticipants) {
      const pozostali = allParticipants.filter((p: any) => p.klient_id !== currentUser.id);
      const mainList = pozostali.filter((p: any) => p.status === 'zapisany');
      const firstWaitlist = pozostali.find((p: any) => p.status === 'krzesełko');

      if (mainList.length < limitZajec && firstWaitlist) {
        await supabase
          .from('zapisy_zajec')
          .update({ status: 'zapisany' })
          .eq('class_key', classKey)
          .eq('klient_id', firstWaitlist.klient_id);

        const { data: promotedClient } = await supabase
          .from('klienci')
          .select('*')
          .eq('id', firstWaitlist.klient_id)
          .single();

        const pClient = promotedClient as any;
        const imieP = pClient ? (pClient.Imię || pClient.firstName || '') : '';
        const nazwiskoP = pClient ? (pClient.Nazwisko || pClient.lastName || '') : '';
        const name = `${imieP} ${nazwiskoP}`.trim() || `ID: ${firstWaitlist.klient_id}`;

        await supabase.from('transakcje').insert([{
          klient_id: firstWaitlist.klient_id,
          typ_operacji: 'zajecia_awans_rezerwa',
          class_key: classKey,
          opis: `Automatyczny awans: ${name} przepisany z listy rezerwowej (krzesełka) na listę główną.`
        }]);

        await supabase.from('booking_logs').insert([{
          action_type: 'WAITLIST_PROMOTED',
          status: 'SUCCESS',
          reason: `${name} awansował na listę główną w ${classKey}`,
          rule_applied: 'waitlist_auto_promote',
          payload: { klient_id: firstWaitlist.klient_id, class_key: classKey }
        }]);
      }
    }

    setItemToUnregister(null);
    loadData();
  };

  // Kalkulacja statystyk użytkownika z rozpiską na rodzaje ćwiczeń
  const getUserStatsForRange = (isYear: boolean, year: number, month?: number) => {
    const filtered = zapisyPrzeszle.filter(item => {
      const d = item.fullStartDateTime;
      if (d.getFullYear() !== year) return false;
      if (!isYear && d.getMonth() !== month) return false;
      return item.obecnosc === 'Obecny';
    });

    const count = filtered.length;
    const breakdown: Record<string, number> = {};
    filtered.forEach(item => {
      const type = item.rawClassTitle || 'Trening ogólny';
      breakdown[type] = (breakdown[type] || 0) + 1;
    });
    return { count, breakdown };
  };

  const userStatsMonth = useMemo(() => getUserStatsForRange(false, statsYear, statsMonth), [zapisyPrzeszle, statsYear, statsMonth]);
  const userStatsYear = useMemo(() => getUserStatsForRange(true, statsYear), [zapisyPrzeszle, statsYear]);

  // Kalkulacja globalnego rankingu klubowiczów
  const getGlobalRanking = (isYear: boolean, year: number, month?: number) => {
    const results: Record<string, number> = {};
    allUsersAttendance.forEach(u => {
      const validRecords = u.records.filter((r: any) => {
        if (r.date.getFullYear() !== year) return false;
        if (!isYear && r.date.getMonth() !== month) return false;
        return true;
      });
      if (validRecords.length > 0) {
        results[u.name] = validRecords.length;
      }
    });
    return Object.entries(results).sort((a: any, b: any) => b[1] - a[1]);
  };

  const rankingMonthData = useMemo(() => getGlobalRanking(false, rankingFilterYear, rankingFilterMonth), [allUsersAttendance, rankingFilterYear, rankingFilterMonth]);
  const rankingYearData = useMemo(() => getGlobalRanking(true, rankingFilterYear), [allUsersAttendance, rankingFilterYear]);

  // Przygotowanie danych z zachowaniem rzeczywistego miejsca przy wyszukiwaniu
  const filteredRankingMonth = useMemo(() => {
    return rankingMonthData.map(([name, count], idx) => ({
      name,
      count,
      position: idx + 1
    })).filter(item => item.name.toLowerCase().includes(rankingSearchMonth.toLowerCase()));
  }, [rankingMonthData, rankingSearchMonth]);

  const filteredRankingYear = useMemo(() => {
    return rankingYearData.map(([name, count], idx) => ({
      name,
      count,
      position: idx + 1
    })).filter(item => item.name.toLowerCase().includes(rankingSearchYear.toLowerCase()));
  }, [rankingYearData, rankingSearchYear]);

  if (isLoading) {
    return <div className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Ładowanie panelu klubowicza...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in pb-20 font-sans antialiased text-slate-800">
      
      {/* NAGŁÓWEK ORAZ GŁÓWNA NAWIGACJA / ZAKŁADKI (Ukrywane w trybie administratora) */}
      {!isOnlyRanking && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Panel Klubowicza</h1>
            <p className="text-xs text-slate-500 font-medium">Zarządzaj swoimi zapisami, sprawdzaj historię i śledź ranking klubowy.</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setActiveTab('zapisy')} 
              className={`px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'zapisy' ? 'bg-white text-sky-950 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Moje Zapisy
            </button>
            <button 
              onClick={() => setActiveTab('ranking')} 
              className={`px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${activeTab === 'ranking' ? 'bg-white text-sky-950 shadow-sm border border-slate-200/60' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Ranking Klubowiczów
            </button>
          </div>
        </div>
      )}

      {/* NAGŁÓWEK DLA PANELU ADMINISTRATORA */}
      {isOnlyRanking && (
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Globalny Ranking Klubowiczów</h1>
          <p className="text-xs text-slate-500 font-medium">Zestawienie aktywności i frekwencji wszystkich klubowiczów w klubie.</p>
        </div>
      )}

      {activeTab === 'zapisy' && !isOnlyRanking ? (
        <div className="space-y-12">
          
          {/* SEKCJA 1: AKTYWNE ZAPISY (NADCHODZĄCE) - 4 PIERWSZE + ROZWIJANA LISTA */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">AKTYWNE ZAPISY NA ZAJĘCIA</h2>
              {zapisyNadchodzace.length > 4 && (
                <button 
                  onClick={() => setShowAllActive(!showAllActive)}
                  className="text-xs font-bold text-sky-600 hover:text-sky-800 cursor-pointer uppercase tracking-wider"
                >
                  {showAllActive ? 'Zwiń listę ↑' : `Pokaż wszystkie (${zapisyNadchodzace.length}) ↓`}
                </button>
              )}
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <th className="py-4 px-5 w-12">#</th>
                      <th className="py-4 px-5">DATA ZAJĘĆ</th>
                      <th className="py-4 px-5">ZAJĘCIA</th>
                      <th className="py-4 px-5">KARNET</th>
                      <th className="py-4 px-5 text-right">AKCJA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {zapisyNadchodzace.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">Brak nadchodzących zapisów na zajęcia.</td>
                      </tr>
                    ) : (
                      (showAllActive ? zapisyNadchodzace : zapisyNadchodzace.slice(0, 4)).map((item: any, index: number) => (
                        <tr key={item.id || index} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-5 font-medium text-slate-400">{index + 1}.</td>
                          <td className="py-4 px-5">
                            <div className="font-mono font-bold text-slate-900">{item.data}</div>
                            <div className="text-[10px] text-slate-500 font-semibold uppercase">{item.dzienTygodnia}</div>
                          </td>
                          <td className="py-4 px-5 font-bold text-sky-950">
                            {item.zajecia}
                            {item.statusZapisu === 'krzesełko' && (
                              <span className="ml-2 bg-blue-100 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded border border-blue-200">
                                🪑 Krzesełko
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5 font-semibold text-slate-600">{item.karnet}</td>
                          <td className="py-4 px-5 text-right">
                            <button 
                              onClick={() => setItemToUnregister(item)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer border border-rose-200 shadow-sm uppercase tracking-wider text-[10px]"
                            >
                              Wypisz się
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SEKCJA 2: HISTORIA ZAPISÓW (PRZESZŁE) - OSTATNIE 3 + ROZWIJANA LISTA */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">HISTORIA ZAPISÓW</h2>
              {zapisyPrzeszle.length > 3 && (
                <button 
                  onClick={() => setShowAllHistory(!showAllHistory)}
                  className="text-xs font-bold text-sky-600 hover:text-sky-800 cursor-pointer uppercase tracking-wider"
                >
                  {showAllHistory ? 'Zwiń listę ↑' : `Pokaż wszystkie (${zapisyPrzeszle.length}) ↓`}
                </button>
              )}
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <th className="py-4 px-5 w-12">#</th>
                      <th className="py-4 px-5">DATA ZAJĘĆ</th>
                      <th className="py-4 px-5">ZAJĘCIA</th>
                      <th className="py-4 px-5">KARNET</th>
                      <th className="py-4 px-5">STATUS / OBECNOŚĆ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {zapisyPrzeszle.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">Brak historii odbytych zajęć od początku istnienia konta.</td>
                      </tr>
                    ) : (
                      (showAllHistory ? zapisyPrzeszle : zapisyPrzeszle.slice(0, 3)).map((item: any, index: number) => (
                        <tr key={item.id || index} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-5 font-medium text-slate-400">{index + 1}.</td>
                          <td className="py-4 px-5">
                            <div className="font-mono font-bold text-slate-900">{item.data}</div>
                            <div className="text-[10px] text-slate-500 font-semibold uppercase">{item.dzienTygodnia}</div>
                          </td>
                          <td className="py-4 px-5 font-bold text-slate-900">{item.zajecia}</td>
                          <td className="py-4 px-5 text-slate-600">{item.karnet}</td>
                          <td className="py-4 px-5">
                            <span className={`font-bold px-2.5 py-1 rounded-md border text-[10px] ${
                              item.obecnosc === 'Obecny'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.obecnosc === 'Nieobecny'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {item.obecnosc}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SEKCJA 3: STATYSTYKI UŻYTKOWNIKA (MIESIĘCZNE I ROCZNE Z ROZPISKĄ NA RODZAJE ĆWICZEŃ) */}
          <div className="space-y-4 pt-2">
            <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">TWOJE STATYSTYKI TRENINGOWE</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Statystyki Miesięczne */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">Miesięczne podsumowanie</h3>
                  <select 
                    value={statsMonth}
                    onChange={(e) => setStatsMonth(parseInt(e.target.value))}
                    className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    {Array.from({ length: 12 }).map((_, mIdx) => (
                      <option key={mIdx} value={mIdx}>
                        {new Date(2026, mIdx, 1).toLocaleString('pl-PL', { month: 'long' }).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-baseline gap-2 pt-2">
                  <span className="text-4xl font-black text-sky-600">{userStatsMonth.count}</span>
                  <span className="text-xs font-bold text-slate-500 uppercase">odbytych treningów (Obecny)</span>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rozpiska według rodzajów ćwiczeń:</div>
                  {Object.keys(userStatsMonth.breakdown).length === 0 ? (
                    <div className="text-xs text-slate-400 italic">Brak obecności w wybranym miesiącu.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {Object.entries(userStatsMonth.breakdown).map(([typeName, countVal]: any) => (
                        <div key={typeName} className="flex justify-between items-center text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                          <span className="font-bold text-slate-700">{typeName}</span>
                          <span className="bg-sky-100 text-sky-800 font-black px-2 py-0.5 rounded-md text-[11px]">{countVal}x</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Statystyki Roczne */}
              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">Roczne podsumowanie</h3>
                  <select 
                    value={statsYear}
                    onChange={(e) => setStatsYear(parseInt(e.target.value))}
                    className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-baseline gap-2 pt-2">
                  <span className="text-4xl font-black text-sky-600">{userStatsYear.count}</span>
                  <span className="text-xs font-bold text-slate-500 uppercase">odbytych treningów w roku {statsYear}</span>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rozpiska według rodzajów ćwiczeń:</div>
                  {Object.keys(userStatsYear.breakdown).length === 0 ? (
                    <div className="text-xs text-slate-400 italic">Brak obecności w wybranym roku.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {Object.entries(userStatsYear.breakdown).map(([typeName, countVal]: any) => (
                        <div key={typeName} className="flex justify-between items-center text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                          <span className="font-bold text-slate-700">{typeName}</span>
                          <span className="bg-sky-100 text-sky-800 font-black px-2 py-0.5 rounded-md text-[11px]">{countVal}x</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      ) : (
        
        /* SEKCJA ZAKŁADKI: GLOBALNY RANKING KLUBOWICZÓW (OBOK SIEBIE Z WYSZUKIWARKĄ) */
        <div className="space-y-6 animate-in fade-in">
          
          {!isOnlyRanking && (
            <div>
              <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">GLOBALNY RANKING KLUBOWICZÓW</h2>
              <p className="text-xs text-slate-500 mt-1">Zestawienie najbardziej aktywnych klubowiczów na podstawie obecności potwierdzonych przez trenera.</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* Tabela 1: Ranking Miesięczny */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🏆 Ranking Miesięczny</h3>
                <select 
                  value={rankingFilterMonth}
                  onChange={(e) => setRankingFilterMonth(parseInt(e.target.value))}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  {Array.from({ length: 12 }).map((_, mIdx) => (
                    <option key={mIdx} value={mIdx}>
                      {new Date(2026, mIdx, 1).toLocaleString('pl-PL', { month: 'long' }).toUpperCase()} {rankingFilterYear}
                    </option>
                  ))}
                </select>
              </div>

              {/* Wyszukiwarka w rankingu miesięcznym */}
              <div>
                <input 
                  type="text"
                  placeholder="🔍 Wyszukaj siebie lub klubowicza..."
                  value={rankingSearchMonth}
                  onChange={(e) => setRankingSearchMonth(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="overflow-x-auto text-xs max-h-[450px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px] sticky top-0">
                      <th className="py-3 px-3 w-16">Pozycja</th>
                      <th className="py-3 px-3">Klubowicz</th>
                      <th className="py-3 px-3 text-right">Liczba obecności</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredRankingMonth.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-400">Brak wyników wyszukiwania lub obecności w wybranym miesiącu.</td>
                      </tr>
                    ) : (
                      filteredRankingMonth.map((item: any, idx: number) => (
                        <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${currentUser && item.name.toLowerCase() === `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim().toLowerCase() ? 'bg-sky-50/80 font-bold' : ''}`}>
                          <td className="py-3.5 px-3 font-mono font-bold text-slate-500">
                            {item.position === 1 ? '🥇 1' : item.position === 2 ? '🥈 2' : item.position === 3 ? '🥉 3' : `${item.position}.`}
                          </td>
                          <td className="py-3.5 px-3 font-bold text-slate-900">{item.name}</td>
                          <td className="py-3.5 px-3 text-right font-black text-sky-600 text-sm">{item.count} treningów</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabela 2: Ranking Roczny */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🌟 Ranking Roczny</h3>
                <select 
                  value={rankingFilterYear}
                  onChange={(e) => setRankingFilterYear(parseInt(e.target.value))}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Wyszukiwarka w rankingu rocznym */}
              <div>
                <input 
                  type="text"
                  placeholder="🔍 Wyszukaj siebie lub klubowicza..."
                  value={rankingSearchYear}
                  onChange={(e) => setRankingSearchYear(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl px-3.5 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="overflow-x-auto text-xs max-h-[450px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px] sticky top-0">
                      <th className="py-3 px-3 w-16">Pozycja</th>
                      <th className="py-3 px-3">Klubowicz</th>
                      <th className="py-3 px-3 text-right">Liczba obecności</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredRankingYear.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-400">Brak wyników wyszukiwania lub obecności w wybranym roku.</td>
                      </tr>
                    ) : (
                      filteredRankingYear.map((item: any, idx: number) => (
                        <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${currentUser && item.name.toLowerCase() === `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim().toLowerCase() ? 'bg-sky-50/80 font-bold' : ''}`}>
                          <td className="py-3.5 px-3 font-mono font-bold text-slate-500">
                            {item.position === 1 ? '🥇 1' : item.position === 2 ? '🥈 2' : item.position === 3 ? '🥉 3' : `${item.position}.`}
                          </td>
                          <td className="py-3.5 px-3 font-bold text-slate-900">{item.name}</td>
                          <td className="py-3.5 px-3 text-right font-black text-sky-600 text-sm">{item.count} treningów</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>

      )}

      {/* MODAL POTWIERDZENIA WYPISANIA Z ZAJĘĆ */}
      {itemToUnregister && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">⚠️ Potwierdź wypisanie</h3>
              <button onClick={() => setItemToUnregister(null)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            
            <div className="space-y-3 text-xs text-slate-700">
              <p>Czy na pewno chcesz wypisać się z zajęć:</p>
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-200 space-y-1">
                <div className="font-black text-sky-950 text-sm">{itemToUnregister.zajecia}</div>
                <div className="font-mono text-sky-800">Termin: {itemToUnregister.data} ({itemToUnregister.dzienTygodnia})</div>
              </div>
              <p className="text-[11px] text-slate-500">Operacja ta zwolni Twoje miejsce na liście i zwróci wejście na Twój karnet.</p>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
              <button 
                onClick={() => setItemToUnregister(null)} 
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button 
                onClick={handleConfirmWypisanie} 
                className="bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer"
              >
                Tak, wypisz się
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
