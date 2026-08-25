"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ROZWIĄZANIE PROBLEMU LIMITU 1000 REKORDÓW SUPABASE Z OBSŁUGĄ WYBRANYCH KOLUMN
const fetchAllFromSupabase = async (
  table: string, 
  selectQuery: string = '*', 
  orderBy: string = 'id', 
  ascending: boolean = false, 
  maxPages: number = 5
) => {
  let result: any[] = [];
  for (let i = 0; i < maxPages; i++) {
    const { data, error } = await supabase
      .from(table)
      .select(selectQuery)
      .order(orderBy, { ascending })
      .range(i * 1000, (i + 1) * 1000 - 1);
    
    if (error) {
      console.error(`Błąd pobierania tabeli ${table}:`, error);
      break;
    }
    if (data && data.length > 0) {
      result.push(...data);
      if (data.length < 1000) break;
    } else {
      break;
    }
  }
  return result;
};

export default function AutomatyczneZapisyPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [klienciList, setKlienciList] = useState<any[]>([]);
  const [grafikItems, setGrafikItems] = useState<any[]>([]);
  const [autoBookingsList, setAutoBookingsList] = useState<any[]>([]);
  const [zapisyList, setZapisyList] = useState<any[]>([]);
  
  // Stan wyboru
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  // Wyszukiwarka klubowiczów w formularzu
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Wyszukiwarka w aktywnych regułach
  const [rulesSearchQuery, setRulesSearchQuery] = useState<string>('');

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // REF DLA OCHRONY PRZED NIESKOŃCZONĄ PĘTLĄ ZAPYTANIA I NAKŁADANIEM SIĘ (Race Condition)
  const isFetchingRef = useRef(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Funkcja wyliczająca rzeczywistą datę ważności karnetu z tablicy karnetyKlubowicza lub kolumny Wygasa
  const getClientPassExpiry = (client: any): string | null => {
    if (!client) return null;
    let parsedKarnety: any[] = [];
    if (Array.isArray(client.karnetyKlubowicza)) {
      parsedKarnety = client.karnetyKlubowicza;
    } else if (typeof client.karnetyKlubowicza === 'string') {
      try {
        parsedKarnety = JSON.parse(client.karnetyKlubowicza);
      } catch (e) {
        parsedKarnety = [];
      }
    }

    if (parsedKarnety && parsedKarnety.length > 0) {
      const validPasses = parsedKarnety.filter((k: any) => k && k.waznyDo);
      if (validPasses.length > 0) {
        validPasses.sort((a: any, b: any) => (b.waznyDo || '').localeCompare(a.waznyDo || ''));
        return validPasses[0].waznyDo;
      }
    }

    if (client.Wygasa && client.Wygasa !== 'Brak' && client.Wygasa !== 'null') {
      return client.Wygasa;
    }

    return null;
  };

  // Kalkulacja liczby wyłącznie przyszłych treningów dla danej reguły
  const getFutureBookingsCount = (rule: any, bookings: any[], grafik: any[]): number => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const classObj = grafik.find(c => String(c.id) === String(rule.grafik_id));
    const [sh = '00', sm = '00'] = (classObj?.time || classObj?.start || classObj?.godzina || '00:00').split(':');

    return (bookings || []).filter((b: any) => {
      if (String(b.klient_id) !== String(rule.klient_id)) return false;
      const key = b.class_key || '';
      if (!key.startsWith(`${rule.grafik_id}_`)) return false;

      const datePart = key.split('_')[1];
      if (!datePart) return false;

      let m = 0;
      let d = 0;
      let yr = currentYear;

      if (datePart.includes('/')) {
        const p = datePart.split('/').map(Number);
        d = p[0];
        m = p[1];
      } else if (datePart.includes('-')) {
        const p = datePart.split('-').map(Number);
        yr = p[0];
        m = p[1];
        d = p[2];
      } else {
        return false;
      }

      const classDateTime = new Date(yr, m - 1, d, parseInt(sh, 10), parseInt(sm, 10), 0);
      return classDateTime > now && (b.status === 'zapisany' || !b.status);
    }).length;
  };

  const loadData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setLoading(true);

      // 1. Pobierz klientów z bazy z ominięciem limitu 1000
      const klienciData = await fetchAllFromSupabase(
        'klienci', 
        'id, Imię, Nazwisko, E-mail, Wygasa, zapisyNadchodzace, karnetyKlubowicza', 
        'id', 
        true, 
        10
      );
      
      let enrichedClients: any[] = [];
      if (klienciData && klienciData.length > 0) {
        enrichedClients = klienciData.map((c: any) => {
          const passExp = getClientPassExpiry(c);
          return {
            ...c,
            calculatedPassExpiry: passExp,
            displayPassExpiry: passExp || 'Brak'
          };
        });
        setKlienciList(enrichedClients);
      }

      // 2. Pobierz grafik cykliczny
      const cykliczne = await fetchAllFromSupabase('grafik_zajec', '*', 'id', true, 2);

      const combinedGrafik = (cykliczne || []).map(c => ({
        ...c,
        title: c.title || c.nazwa,
        time: c.start || c.start_time || c.godzina,
        trainer: c.trainer || c.prowadzacy
      }));
      setGrafikItems(combinedGrafik);

      // 3. Pobierz wszystkie wpisy z zapisy_zajec do precyzyjnego licznika
      const zapisyData = await fetchAllFromSupabase('zapisy_zajec', '*', 'id', false, 10);
      if (zapisyData) setZapisyList(zapisyData);

      // 4. Pobierz aktywne automatyczne zapisy i dokonaj pełnej synchronizacji
      const autoData = await fetchAllFromSupabase('automatyczne_zapisy', '*', 'id', false, 5);
      if (autoData) {
        setAutoBookingsList(autoData);
        await syncAutoBookings(autoData, enrichedClients, combinedGrafik);
        
        // Odświeżenie zapisów po synchronizacji
        const refreshedZapisy = await fetchAllFromSupabase('zapisy_zajec', '*', 'id', false, 10);
        if (refreshedZapisy) setZapisyList(refreshedZapisy);
      }

    } catch (err) {
      console.error('Błąd ładowania danych:', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  // Automatyczna aktualizacja reguł i dopisywanie/odpisywanie terminów na podstawie bieżącej ważności karnetu
  const syncAutoBookings = async (rules: any[], clients: any[], grafik: any[]) => {
    const now = new Date();
    const currentYear = now.getFullYear();

    for (const rule of rules) {
      const clientObj = clients.find(k => String(k.id) === String(rule.klient_id));
      const classObj = grafik.find(c => String(c.id) === String(rule.grafik_id));
      if (!clientObj || !classObj) continue;

      const livePassExpiry = clientObj.calculatedPassExpiry;

      if (livePassExpiry !== rule.pass_expiry) {
        await supabase
          .from('automatyczne_zapisy')
          .update({ pass_expiry: livePassExpiry || 'Brak' })
          .eq('id', rule.id);
        rule.pass_expiry = livePassExpiry || 'Brak';
      }

      const { data: existingBookings } = await supabase
        .from('zapisy_zajec')
        .select('id, class_key')
        .eq('klient_id', Number(rule.klient_id));

      const bookedKeys = new Set((existingBookings || []).map(b => b.class_key));

      const { data: cancelledT } = await supabase
        .from('transakcje')
        .select('class_key')
        .eq('klient_id', Number(rule.klient_id))
        .eq('typ_operacji', 'zajecia_wypis');

      const cancelledKeys = new Set((cancelledT || []).map(t => t.class_key).filter(Boolean));

      const dayMap: { [key: string]: number } = { nd: 0, pon: 1, wt: 2, sr: 3, czw: 4, pt: 5, sb: 6 };
      const activeDays = classObj.days || {};
      const targetDayIndices = Object.keys(activeDays)
        .filter(d => activeDays[d])
        .map(d => dayMap[d])
        .filter(idx => idx !== undefined);

      const startDate = new Date();
      let endDate: Date | null = null;

      if (livePassExpiry && livePassExpiry !== 'Brak') {
        const parsedExpiry = new Date(livePassExpiry);
        if (!isNaN(parsedExpiry.getTime())) {
          endDate = new Date(parsedExpiry.getFullYear(), parsedExpiry.getMonth(), parsedExpiry.getDate(), 23, 59, 59);
        }
      }

      if (!endDate || endDate < startDate) {
        const keysToRemove: string[] = [];
        (existingBookings || []).forEach((b: any) => {
          if (b.class_key && b.class_key.startsWith(`${classObj.id}_`)) {
            const datePart = b.class_key.split('_')[1];
            if (datePart) {
              let m = 0, d = 0, yr = currentYear;
              if (datePart.includes('/')) {
                const p = datePart.split('/').map(Number);
                d = p[0]; m = p[1];
              } else if (datePart.includes('-')) {
                const p = datePart.split('-').map(Number);
                yr = p[0]; m = p[1]; d = p[2];
              }
              const [sh = '00', sm = '00'] = (classObj.time || classObj.start || '00:00').split(':');
              const classDateTime = new Date(yr, m - 1, d, parseInt(sh, 10), parseInt(sm, 10), 0);
              if (classDateTime > now) {
                keysToRemove.push(b.class_key);
              }
            }
          }
        });

        if (keysToRemove.length > 0) {
          await supabase
            .from('zapisy_zajec')
            .delete()
            .in('class_key', keysToRemove)
            .eq('klient_id', Number(rule.klient_id));
        }
        continue;
      }

      let newZapisyNadchodzace = [...(clientObj.zapisyNadchodzace || [])];
      let hasUpdates = false;

      let curr = new Date(startDate);
      while (curr <= endDate) {
        if (targetDayIndices.includes(curr.getDay())) {
          const month = String(curr.getMonth() + 1).padStart(2, '0');
          const day = String(curr.getDate()).padStart(2, '0');
          const year = curr.getFullYear();
          
          const classKeyDisplay = `${classObj.id}_${day}/${month}`;
          const classKeyIso = `${classObj.id}_${year}-${month}-${day}`;

          const isAlreadyBooked = bookedKeys.has(classKeyDisplay) || bookedKeys.has(classKeyIso);
          const wasManuallyCancelled = cancelledKeys.has(classKeyDisplay) || cancelledKeys.has(classKeyIso);

          if (!isAlreadyBooked && !wasManuallyCancelled) {
            await supabase.from('zapisy_zajec').insert([
              {
                class_key: classKeyDisplay,
                klient_id: Number(rule.klient_id),
                status: 'zapisany',
                obecny: false
              }
            ]);

            // Zabezpieczenie przed duplikatem w tej samej sesji synchronizacji
            bookedKeys.add(classKeyDisplay);
            bookedKeys.add(classKeyIso);

            const dateStr = `${year}-${month}-${day}`;
            const zajeciaTitle = classObj.title || classObj.nazwa;
            const alreadyInArray = newZapisyNadchodzace.some(
              (z: any) => z.data === dateStr && (z.zajecia || '').trim().toLowerCase() === zajeciaTitle.trim().toLowerCase()
            );

            if (!alreadyInArray) {
              newZapisyNadchodzace.unshift({
                id: Date.now() + Math.random(),
                data: dateStr,
                zajecia: zajeciaTitle,
                karnet: 'Automatyczny zapis',
                zapisujacy: 'Panel Administratora'
              });
            }

            hasUpdates = true;
          }
        }
        curr.setDate(curr.getDate() + 1);
      }

      if (hasUpdates) {
        await supabase
          .from('klienci')
          .update({ zapisyNadchodzace: newZapisyNadchodzace })
          .eq('id', Number(rule.klient_id));
      }
    }
  };

  // Subskrypcja Realtime
  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('realtime-auto-zapisy')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'klienci' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automatyczne_zapisy' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zapisy_zajec' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreateAutoBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !selectedClassId) {
      showToast('Wybierz klubowicza oraz zajęcia z grafiku!', 'error');
      return;
    }

    try {
      const clientObj = klienciList.find(k => String(k.id) === String(selectedClientId));
      const classObj = grafikItems.find(c => String(c.id) === String(selectedClassId));

      if (!clientObj || !classObj) {
        showToast('Nie znaleziono wybranego klienta lub zajęć.', 'error');
        return;
      }

      const passExpiry = clientObj.calculatedPassExpiry;
      if (!passExpiry) {
        showToast('Wybrany klubowicz nie posiada aktywnego karnetu! Przypisz karnet przed ustawieniem reguły.', 'error');
        return;
      }

      const clientName = `${clientObj.Imię} ${clientObj.Nazwisko}`;
      const classTitle = classObj.title || classObj.nazwa;

      const { error: insertErr } = await supabase.from('automatyczne_zapisy').insert([
        {
          klient_id: Number(selectedClientId),
          client_name: clientName,
          grafik_id: Number(selectedClassId),
          class_title: classTitle,
          pass_expiry: passExpiry,
          created_at: new Date().toISOString()
        }
      ]);

      if (insertErr) throw insertErr;

      showToast(`Ustawiono regułę automatycznego zapisu dla: ${clientName}!`);
      setSelectedClientId('');
      setClientSearchQuery('');
      setSelectedClassId('');
      await loadData();
    } catch (err: any) {
      console.error('Błąd tworzenia automatycznego zapisu:', err);
      showToast('Błąd: ' + (err.message || ''), 'error');
    }
  };

  // Usunięcie reguły oraz automatyczne wypisanie z przyszłych nieodbytych treningów
  const handleRemoveAutoBooking = async (id: number) => {
    try {
      const ruleToDelete = autoBookingsList.find(r => r.id === id);
      if (!ruleToDelete) {
        showToast('Nie znaleziono reguły do usunięcia.', 'error');
        return;
      }

      if (!confirm(`Czy na pewno chcesz usunąć regułę automatycznego zapisu dla: ${ruleToDelete.client_name}? Klubowicz zostanie automatycznie wypisany ze wszystkich przyszłych terminów tych zajęć.`)) {
        return;
      }

      const klientId = Number(ruleToDelete.klient_id);
      const grafikId = String(ruleToDelete.grafik_id);
      const classObj = grafikItems.find(c => String(c.id) === grafikId);
      const now = new Date();
      const currentYear = now.getFullYear();

      const { data: userBookings } = await supabase
        .from('zapisy_zajec')
        .select('*')
        .eq('klient_id', klientId);

      const keysToDelete: string[] = [];
      let cancelledCount = 0;

      (userBookings || []).forEach((b: any) => {
        const key = b.class_key || '';
        if (key.startsWith(`${grafikId}_`)) {
          const datePart = key.split('_')[1];
          if (datePart) {
            let m = 0;
            let d = 0;
            let yr = currentYear;

            if (datePart.includes('/')) {
              const p = datePart.split('/').map(Number);
              d = p[0];
              m = p[1];
            } else if (datePart.includes('-')) {
              const p = datePart.split('-').map(Number);
              yr = p[0];
              m = p[1];
              d = p[2];
            }

            const [sh = '00', sm = '00'] = (classObj?.time || classObj?.start || '00:00').split(':');
            const classDateTime = new Date(yr, m - 1, d, parseInt(sh, 10), parseInt(sm, 10), 0);

            if (classDateTime > now) {
              keysToDelete.push(key);
              cancelledCount++;
            }
          }
        }
      });

      if (keysToDelete.length > 0) {
        await supabase
          .from('zapisy_zajec')
          .delete()
          .in('class_key', keysToDelete)
          .eq('klient_id', klientId);
      }

      const clientObj = klienciList.find(k => Number(k.id) === klientId);
      if (clientObj) {
        let currentNadchodzace = clientObj.zapisyNadchodzace || [];
        if (typeof currentNadchodzace === 'string') {
          try { currentNadchodzace = JSON.parse(currentNadchodzace); } catch(e) { currentNadchodzace = []; }
        }

        const classTitleToMatch = (ruleToDelete.class_title || classObj?.title || '').trim().toLowerCase();
        
        const filteredNadchodzace = (currentNadchodzace || []).filter((z: any) => {
          const zTitle = (z.zajecia || '').trim().toLowerCase();
          if (zTitle !== classTitleToMatch) return true;
          
          if (!z.data) return false;
          let m = 0;
          let d = 0;
          let yr = currentYear;
          if (z.data.includes('/')) {
            const p = z.data.split('/').map(Number);
            d = p[0];
            m = p[1];
          } else if (z.data.includes('-')) {
            const p = z.data.split('-').map(Number);
            yr = p[0];
            m = p[1];
            d = p[2];
          }
          const itemDateTime = new Date(yr, m - 1, d, 23, 59, 59);
          return itemDateTime < now;
        });

        await supabase
          .from('klienci')
          .update({ zapisyNadchodzace: filteredNadchodzace })
          .eq('id', Number(klientId));
      }

      const { error: delErr } = await supabase.from('automatyczne_zapisy').delete().eq('id', id);
      if (delErr) throw delErr;

      if (cancelledCount > 0) {
        await supabase.from('transakcje').insert([{
          klient_id: klientId,
          typ_operacji: 'zajecia_wypis',
          opis: `Usunięto regułę automatycznych zapisów (${ruleToDelete.class_title}). Automatycznie wypisano z ${cancelledCount} przyszłych treningów.`
        }]);
      }

      showToast(`Usunięto regułę! Wypisano klubowicza z ${cancelledCount} przyszłych treningów.`);
      await loadData();
    } catch (err: any) {
      console.error('Błąd usuwania reguły:', err);
      showToast('Nie udało się usunąć reguły: ' + (err.message || ''), 'error');
    }
  };

  const filteredClients = klienciList.filter((k) => {
    const query = clientSearchQuery.toLowerCase();
    const fullName = `${k.Imię || ''} ${k.Nazwisko || ''}`.toLowerCase();
    const email = (k['E-mail'] || '').toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

  const selectedClientObject = klienciList.find(k => String(k.id) === String(selectedClientId));

  // Filtrowanie listy aktywnych reguł
  const filteredAutoBookings = autoBookingsList.filter((item) => {
    const query = rulesSearchQuery.toLowerCase().trim();
    if (!query) return true;
    const clientName = (item.client_name || '').toLowerCase();
    const classTitle = (item.class_title || '').toLowerCase();
    return clientName.includes(query) || classTitle.includes(query);
  });

  if (loading && klienciList.length === 0) {
    return (
      <div className="max-w-[1250px] mx-auto p-12 text-center text-slate-500 font-bold text-xs animate-pulse">
        Ładowanie panelu automatycznych zapisów...
      </div>
    );
  }

  return (
    <div className="max-w-[1250px] mx-auto space-y-6 pb-16 font-sans antialiased text-slate-800">
      
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl border flex items-center gap-3 transition-all duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          <span className="text-base">{toastMessage.type === 'success' ? '✅' : '⚠️'}</span>
          <p className="text-xs font-bold tracking-wide">{toastMessage.text}</p>
        </div>
      )}

      {/* GÓRNY PASEK NAGŁÓWKA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-sky-950 via-slate-900 to-sky-900 border border-sky-800/60 p-6 rounded-3xl shadow-lg text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
            </span>
            <span className="text-[11px] font-black tracking-widest text-sky-300 uppercase">
              Stałe Rezerwacje Klubowe (Realtime)
            </span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-white flex items-center gap-3">
            ⚡ AUTOMATYCZNE ZAPISY NA CZAS KARNETU
          </h1>
          <p className="text-xs text-sky-200/80 font-medium">
            System na bieżąco weryfikuje ważność karnetów. Przedłużenie karnetu automatycznie wydłuża stałe zapisy, a usunięcie reguły zwalnia przyszłe miejsca.
          </p>
        </div>
      </div>

      {/* FORMULARZ DODAWANIA AUTOMATYCZNEGO ZAPISU */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            ➕ Nowy Automatyczny Zapis
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Wyszukaj klubowicza po nazwisku/e-mailu oraz wskaż zajęcia cykliczne z grafiku.
          </p>
        </div>

        <form onSubmit={handleCreateAutoBooking} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          
          <div className="space-y-1.5 relative" ref={dropdownRef}>
            <label className="text-[11px] font-bold text-slate-700 block">Wyszukaj Klubowicza:</label>
            <div className="relative">
              <input
                type="text"
                value={selectedClientObject ? `${selectedClientObject.Imię} ${selectedClientObject.Nazwisko}` : clientSearchQuery}
                onChange={(e) => {
                  setClientSearchQuery(e.target.value);
                  setSelectedClientId('');
                  setIsClientDropdownOpen(true);
                }}
                onFocus={() => setIsClientDropdownOpen(true)}
                placeholder="Wpisz imię, nazwisko lub email..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 pr-8"
              />
              {selectedClientId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClientId('');
                    setClientSearchQuery('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {isClientDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl divide-y divide-slate-100">
                {filteredClients.length > 0 ? (
                  filteredClients.map((klient) => (
                    <div
                      key={klient.id}
                      onClick={() => {
                        setSelectedClientId(String(klient.id));
                        setClientSearchQuery(`${klient.Imię} ${klient.Nazwisko}`);
                        setIsClientDropdownOpen(false);
                      }}
                      className="p-3 hover:bg-sky-50/70 cursor-pointer transition-colors flex justify-between items-center text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">{klient.Imię} {klient.Nazwisko}</div>
                        <div className="text-[10px] text-slate-400">{klient['E-mail'] || 'Brak e-maila'}</div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                          klient.calculatedPassExpiry ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          Karnet: {klient.displayPassExpiry}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-xs text-slate-400 text-center font-medium">
                    Nie znaleziono klubowicza
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 block">Wybierz Zajęcia z Grafiku:</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="">-- Wybierz trening cykliczny --</option>
              {grafikItems.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.title || cls.nazwa} (Godz. {cls.time || cls.godzina || cls.start})
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="submit"
              className="w-full bg-sky-900 hover:bg-sky-800 text-white font-bold text-xs py-3 px-6 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              ⚡ Ustaw Automatyczny Zapis
            </button>
          </div>

        </form>
      </div>

      {/* LISTA AKTYWNYCH AUTOMATYCZNYCH ZAPISÓW */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
          <div className="space-y-1">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              📋 Aktywne Reguły Automatycznych Zapisów
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Lista osób posiadających stałe przypisanie do zajęć cyklicznych wraz z aktualnym statusem karnetu oraz liczbą zaplanowanych przyszłych treningów.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-black text-sky-900 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200">
              Aktywnych reguł: {filteredAutoBookings.length} {rulesSearchQuery && `(z ${autoBookingsList.length})`}
            </span>
          </div>
        </div>

        {/* WYSZUKIWARKA REGUŁ */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          <input
            type="text"
            value={rulesSearchQuery}
            onChange={(e) => setRulesSearchQuery(e.target.value)}
            placeholder="Szukaj reguły po imieniu, nazwisku klubowicza lub nazwie treningu..."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-8 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
          />
          {rulesSearchQuery && (
            <button
              type="button"
              onClick={() => setRulesSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          {filteredAutoBookings.length > 0 ? (
            filteredAutoBookings.map((item) => {
              const matchedClient = klienciList.find(k => String(k.id) === String(item.klient_id));
              const livePassExpiry = matchedClient ? matchedClient.displayPassExpiry : (item.pass_expiry || 'Brak');
              const hasActivePass = matchedClient ? !!matchedClient.calculatedPassExpiry : (item.pass_expiry && item.pass_expiry !== 'Brak');
              const futureBookingsCount = getFutureBookingsCount(item, zapisyList, grafikItems);

              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50/80 border border-slate-200 rounded-2xl gap-3 hover:border-sky-300 transition-all"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-emerald-100 text-emerald-900">
                        Stała Rezerwacja
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                        hasActivePass ? 'bg-sky-50 text-sky-900 border-sky-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        Ważność karnetu: {livePassExpiry}
                      </span>
                      <span className="bg-amber-100 text-amber-900 text-[11px] font-black px-2.5 py-0.5 rounded-md border border-amber-300 flex items-center gap-1 shadow-xs">
                        <span>🎯 Przyszłe treningi:</span>
                        <span className="text-amber-950 font-black underline">{futureBookingsCount}</span>
                      </span>
                    </div>
                    <h3 className="text-xs font-black text-slate-900">
                      Klubowicz: <span className="text-sky-900">{item.client_name}</span>
                    </h3>
                    <p className="text-[11px] text-slate-600 font-medium">
                      Zajęcia cykliczne: <strong className="text-slate-800">{item.class_title}</strong>
                    </p>
                  </div>

                  <button
                    onClick={() => handleRemoveAutoBooking(item.id)}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-4 py-2.5 rounded-xl border border-rose-200 transition-colors cursor-pointer shrink-0 self-start sm:self-center"
                  >
                    Usuń regułę
                  </button>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-xs text-slate-400 font-medium">
              {rulesSearchQuery
                ? `Nie znaleziono reguł pasujących do frazy: "${rulesSearchQuery}"`
                : 'Brak zdefiniowanych automatycznych zapisów. Użyj formularza powyżej, aby dodać pierwszą regułę.'}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
