"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AutomatyczneZapisyPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [klienciList, setKlienciList] = useState<any[]>([]);
  const [grafikItems, setGrafikItems] = useState<any[]>([]);
  const [autoBookingsList, setAutoBookingsList] = useState<any[]>([]);
  
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Pobierz klientów
      const { data: klienciData } = await supabase.from('klienci').select('id, Imię, Nazwisko, E-mail, Wygasa, zapisyNadchodzace');
      if (klienciData) {
        setKlienciList(klienciData);
      }

      // 2. Pobierz grafik cykliczny
      const { data: cykliczne } = await supabase.from('grafik_zajec').select('*');
      const combinedGrafik = (cykliczne || []).map(c => ({
        ...c,
        title: c.title || c.nazwa,
        time: c.start || c.start_time,
        trainer: c.trainer || c.prowadzacy
      }));
      setGrafikItems(combinedGrafik);

      // 3. Pobierz aktywne automatyczne zapisy z tabeli 'automatyczne_zapisy'
      const { data: autoData, error: autoErr } = await supabase.from('automatyczne_zapisy').select('*');
      if (!autoErr && autoData) {
        setAutoBookingsList(autoData);
        // Automatyczna synchronizacja przyszłych terminów (90 dni do przodu) przy każdym wejściu
        await syncAutoBookings(autoData, klienciData || [], combinedGrafik);
      }

    } catch (err) {
      console.error('Błąd ładowania danych:', err);
    } finally {
      setLoading(false);
    }
  };

  // Funkcja synchronizująca reguły na 90 dni do przodu
  const syncAutoBookings = async (rules: any[], clients: any[], grafik: any[]) => {
    for (const rule of rules) {
      const clientObj = clients.find(k => String(k.id) === String(rule.klient_id));
      const classObj = grafik.find(c => String(c.id) === String(rule.grafik_id));
      if (!clientObj || !classObj) continue;

      const passExpiry = clientObj.Wygasa || rule.pass_expiry;
      
      // Pobierz istniejące zapisy klienta
      const { data: existingBookings } = await supabase
        .from('zapisy_zajec')
        .select('class_key')
        .eq('klient_id', Number(rule.klient_id));

      const bookedKeys = new Set((existingBookings || []).map(b => b.class_key));

      const dayMap: { [key: string]: number } = { nd: 0, pon: 1, wt: 2, sr: 3, czw: 4, pt: 5, sb: 6 };
      const activeDays = classObj.days || {};
      const targetDayIndices = Object.keys(activeDays)
        .filter(d => activeDays[d])
        .map(d => dayMap[d])
        .filter(idx => idx !== undefined);

      const startDate = new Date();
      let endDate = new Date();
      if (passExpiry) {
        const parsedExpiry = new Date(passExpiry);
        if (!isNaN(parsedExpiry.getTime()) && parsedExpiry > startDate) {
          endDate = parsedExpiry;
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
          const year = curr.getFullYear();
          const month = String(curr.getMonth() + 1).padStart(2, '0');
          const day = String(curr.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          const classKey = `${classObj.id}_${dateStr}`;

          if (!bookedKeys.has(classKey)) {
            await supabase.from('zapisy_zajec').insert([
              {
                class_key: classKey,
                klient_id: Number(rule.klient_id),
                status: 'zapisany',
                obecny: false
              }
            ]);

            newZapisyNadchodzace.unshift({
              id: Date.now() + Math.random(),
              data: dateStr,
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

  useEffect(() => {
    loadData();
  }, []);

  // Dodanie stałego automatycznego zapisu
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
      const passExpiry = clientObj.Wygasa || '';

      // 1. Zapis reguły w tabeli automatyczne_zapisy
      const { error: insertErr } = await supabase.from('automatyczne_zapisy').insert([
        {
          klient_id: Number(selectedClientId),
          client_name: clientName,
          grafik_id: Number(selectedClassId),
          class_title: classTitle,
          pass_expiry: passExpiry || 'Brak',
          created_at: new Date().toISOString()
        }
      ]);

      if (insertErr) throw insertErr;

      // 2. Pobierz istniejące zapisy klienta
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
      if (passExpiry) {
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
          const year = curr.getFullYear();
          const month = String(curr.getMonth() + 1).padStart(2, '0');
          const day = String(curr.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          const classKey = `${classObj.id}_${dateStr}`;

          if (!bookedKeys.has(classKey)) {
            await supabase.from('zapisy_zajec').insert([
              {
                class_key: classKey,
                klient_id: Number(selectedClientId),
                status: 'zapisany',
                obecny: false
              }
            ]);

            newZapisyNadchodzace.unshift({
              id: Date.now() + Math.random(),
              data: dateStr,
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

      showToast(`Ustawiono regułę! Dopisano na ${newBookingsCount} terminów (do 90 dni / wygaśnięcia karnetu).`);
      setSelectedClientId('');
      setSelectedClassId('');
      await loadData();
    } catch (err: any) {
      console.error('Błąd tworzenia automatycznego zapisu:', err);
      showToast('Błąd: ' + (err.message || ''), 'error');
    }
  };

  // Usunięcie automatycznego zapisu
  const handleRemoveAutoBooking = async (id: number) => {
    try {
      const { error } = await supabase.from('automatyczne_zapisy').delete().eq('id', id);
      if (error) throw error;

      showToast('Usunięto regułę automatycznego zapisu.');
      await loadData();
    } catch (err: any) {
      console.error('Błąd usuwania:', err);
      showToast('Nie udało się usunąć reguły: ' + (err.message || ''), 'error');
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1250px] mx-auto p-12 text-center text-slate-500 font-bold text-xs animate-pulse">
        Ładowanie panelu automatycznych zapisów...
      </div>
    );
  }

  return (
    <div className="max-w-[1250px] mx-auto space-y-6 pb-16 font-sans antialiased text-slate-800">
      
      {/* POWIADOMIENIE TOAST */}
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
              Stałe Rezerwacje Klubowe
            </span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-white flex items-center gap-3">
            ⚡ AUTOMATYCZNE ZAPISY NA CZAS KARNETU
          </h1>
          <p className="text-xs text-sky-200/80 font-medium">
            System automatycznie synchronizuje i dopisuje brakujące terminy na 90 dni do przodu, pomijając zajęcia, na które klient jest już zapisany.
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
            Wybierz klubowicza oraz interesujące go zajęcia cykliczne z grafiku.
          </p>
        </div>

        <form onSubmit={handleCreateAutoBooking} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 block">Wybierz Klubowicza:</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="">-- Wybierz osobę z bazy --</option>
              {klienciList.map((klient) => (
                <option key={klient.id} value={klient.id}>
                  {klient.Imię} {klient.Nazwisko} (Karnet do: {klient.Wygasa || 'Brak'})
                </option>
              ))}
            </select>
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
