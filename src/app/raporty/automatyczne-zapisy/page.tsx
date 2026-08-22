"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AutomatyczneZapisyPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [klienciList, setKlienciList] = useState<any[]>([]);
  const [grafikItems, setGrafikItems] = useState<any[]>([]);
  const [autoBookingsList, setAutoBookingsList] = useState<any[]>([]);
  
  // Stan wyboru
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  // Wyszukiwarka klubowiczów
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Pobierz klientów
      const { data: klienciData, error: klienciErr } = await supabase
        .from('klienci')
        .select('id, Imię, Nazwisko, E-mail, Wygasa, zapisyNadchodzace, karnetyKlubowicza');
      
      if (klienciErr) console.error('Błąd pobierania klientów:', klienciErr);
      if (klienciData) {
        setKlienciList(klienciData);
      }

      // 2. Pobierz grafik cykliczny
      const { data: cykliczne, error: cykliczneErr } = await supabase.from('grafik_zajec').select('*');
      if (cykliczneErr) console.error('Błąd pobierania grafiku:', cykliczneErr);

      const combinedGrafik = (cykliczne || []).map(c => ({
        ...c,
        title: c.title || c.nazwa,
        time: c.start || c.start_time || c.godzina,
        trainer: c.trainer || c.prowadzacy
      }));
      setGrafikItems(combinedGrafik);

      // 3. Pobierz aktywne automatyczne zapisy
      const { data: autoData, error: autoErr } = await supabase.from('automatyczne_zapisy').select('*');
      if (!autoErr && autoData) {
        setAutoBookingsList(autoData);
        await syncAutoBookings(autoData, klienciData || [], combinedGrafik);
      }

    } catch (err) {
      console.error('Błąd ładowania danych:', err);
    } finally {
      setLoading(false);
    }
  };

  // Synchronizacja reguł z pominięciem terminów, z których klient się wypisał
  const syncAutoBookings = async (rules: any[], clients: any[], grafik: any[]) => {
    for (const rule of rules) {
      const clientObj = clients.find(k => String(k.id) === String(rule.klient_id));
      const classObj = grafik.find(c => String(c.id) === String(rule.grafik_id));
      if (!clientObj || !classObj) continue;

      const passExpiry = clientObj.Wygasa || rule.pass_expiry;
      
      // Istniejące rezerwacje
      const { data: existingBookings } = await supabase
        .from('zapisy_zajec')
        .select('class_key')
        .eq('klient_id', Number(rule.klient_id));

      const bookedKeys = new Set((existingBookings || []).map(b => b.class_key));

      // Historia celowych wypisów klienta z transakcji
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
      let endDate = new Date();
      if (passExpiry && passExpiry !== 'Brak') {
        const parsedExpiry = new Date(passExpiry);
        if (!isNaN(parsedExpiry.getTime()) && parsedExpiry > startDate) {
          endDate = parsedExpiry;
        } else if (!isNaN(parsedExpiry.getTime()) && parsedExpiry <= startDate) {
          continue;
        } else {
          endDate.setDate(startDate.getDate() + 90);
        }
      } else {
        endDate.setDate(startDate.getDate() + 90);
      }

      let newZapisyNadchodzace = [...(clientObj.zapisyNadchodzace || [])];
      let updated = false;

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

            newZapisyNadchodzace.unshift({
              id: Date.now() + Math.random(),
              data: `${year}-${month}-${day}`,
              zajecia: classObj.title || classObj.nazwa,
              karnet: 'Automatyczny zapis',
              zapisujacy: 'Panel Administratora'
            });

            updated = true;
          }
        }
        curr.setDate(curr.getDate() + 1);
      }

      if (updated) {
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

      const clientName = `${clientObj.Imię} ${clientObj.Nazwisko}`;
      const classTitle = classObj.title || classObj.nazwa;
      const passExpiry = clientObj.Wygasa || 'Brak';

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

      const { data: existingBookings } = await supabase
        .from('zapisy_zajec')
        .select('class_key')
        .eq('klient_id', Number(selectedClientId));

      const bookedKeys = new Set((existingBookings || []).map(b => b.class_key));

      const dayMap: { [key: string]: number } = { nd: 0, pon: 1, wt: 2, sr: 3, czw: 4, pt: 5, sb: 6 };
      const activeDays = classObj.days || {};
      const targetDayIndices = Object.keys(activeDays)
        .filter(d => activeDays[d])
        .map(d => dayMap[d])
        .filter(idx => idx !== undefined);

      const startDate = new Date();
      let endDate = new Date();
      if (passExpiry && passExpiry !== 'Brak') {
        const parsedExpiry = new Date(passExpiry);
        if (!isNaN(parsedExpiry.getTime()) && parsedExpiry > startDate) {
          endDate = parsedExpiry;
        } else {
          endDate.setDate(startDate.getDate() + 90);
        }
      } else {
        endDate.setDate(startDate.getDate() + 90);
      }

      let newBookingsCount = 0;
      const newZapisyNadchodzace = [...(clientObj.zapisyNadchodzace || [])];

      let curr = new Date(startDate);
      while (curr <= endDate) {
        if (targetDayIndices.includes(curr.getDay())) {
          const month = String(curr.getMonth() + 1).padStart(2, '0');
          const day = String(curr.getDate()).padStart(2, '0');
          const year = curr.getFullYear();
          const classKeyDisplay = `${classObj.id}_${day}/${month}`;
          const classKeyIso = `${classObj.id}_${year}-${month}-${day}`;

          if (!bookedKeys.has(classKeyDisplay) && !bookedKeys.has(classKeyIso)) {
            await supabase.from('zapisy_zajec').insert([
              {
                class_key: classKeyDisplay,
                klient_id: Number(selectedClientId),
                status: 'zapisany',
                obecny: false
              }
            ]);

            newZapisyNadchodzace.unshift({
              id: Date.now() + Math.random(),
              data: `${year}-${month}-${day}`,
              zajecia: classTitle,
              karnet: 'Automatyczny zapis',
              zapisujacy: 'Panel Administratora'
            });

            newBookingsCount++;
          }
        }
        curr.setDate(curr.getDate() + 1);
      }

      await supabase
        .from('klienci')
        .update({ zapisyNadchodzace: newZapisyNadchodzace })
        .eq('id', Number(selectedClientId));

      showToast(`Ustawiono regułę! Dopisano na ${newBookingsCount} terminów.`);
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

      // 1. Pobierz wszystkie zapisy tego klienta
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
            const classDateTime = new Date(yr, m - 1, d, parseInt(sh), parseInt(sm), 0);

            // Jeśli trening jest w przyszłości - kwalifikuje się do usunięcia
            if (classDateTime > now) {
              keysToDelete.push(key);
              cancelledCount++;
            }
          }
        }
      });

      // 2. Usuń przyszłe rezerwacje z tabeli zapisy_zajec
      if (keysToDelete.length > 0) {
        await supabase
          .from('zapisy_zajec')
          .delete()
          .in('class_key', keysToDelete)
          .eq('klient_id', klientId);
      }

      // 3. Zaktualizuj tablicę zapisyNadchodzace w profilu klienta
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
          .eq('id', klientId);
      }

      // 4. Usuń regułę z tabeli automatyczne_zapisy
      const { error: delErr } = await supabase.from('automatyczne_zapisy').delete().eq('id', id);
      if (delErr) throw delErr;

      // 5. Zarejestruj transakcję informacyjną
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
            System synchronizuje terminy do końca ważności karnetu. Usunięcie reguły automatycznie wypisuje klubowicza ze wszystkich przyszłych terminów.
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
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          klient.Wygasa ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          Karnet: {klient.Wygasa || 'Brak'}
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
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              📋 Aktywne Reguły Automatycznych Zapisów
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Lista osób posiadających stałe przypisanie do zajęć cyklicznych.
            </p>
          </div>
          <span className="text-[11px] font-black text-sky-900 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200">
            Aktywnych reguł: {autoBookingsList.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {autoBookingsList.length > 0 ? (
            autoBookingsList.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50/80 border border-slate-200 rounded-2xl gap-3 hover:border-sky-300 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-emerald-100 text-emerald-900">
                      Stała Rezerwacja
                    </span>
                    <span className="text-[11px] text-slate-500 font-bold">
                      Ważność karnetu: {item.pass_expiry}
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
            ))
          ) : (
            <div className="text-center py-12 text-xs text-slate-400 font-medium">
              Brak zdefiniowanych automatycznych zapisów. Użyj formularza powyżej, aby dodać pierwszą regułę.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
