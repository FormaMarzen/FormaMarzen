"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Bezpośrednia, bezpieczna inicjalizacja klienta Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AutomatyczneZapisyPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [klienciList, setKlienciList] = useState<any[]>([]);
  const [grafikItems, setGrafikItems] = useState<any[]>([]);
  const [zapisyZajecList, setZapisyZajecList] = useState<any[]>([]);
  const [selectedClientPerClass, setSelectedClientPerClass] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Pobierz klientów
      const { data: klienciData } = await supabase.from('klienci').select('id, Imię, Nazwisko, E-mail, zapisyNadchodzace');
      if (klienciData) {
        setKlienciList(klienciData);
      }

      // 2. Pobierz grafik cykliczny i jednorazowy
      const { data: cykliczne } = await supabase.from('grafik_zajec').select('*');
      const { data: jednorazowe } = await supabase.from('zajecia_jednorazowe').select('*');

      const combinedGrafik = [
        ...(cykliczne || []).map(c => ({ ...c, sourceType: 'cykliczne', title: c.title || c.nazwa, time: c.start || c.start_time, trainer: c.trainer || c.prowadzacy })),
        ...(jednorazowe || []).map(j => ({ ...j, sourceType: 'jednorazowe', title: j.title || j.nazwa, time: j.start_time || j.start, trainer: j.trainer || j.prowadzacy }))
      ];
      setGrafikItems(combinedGrafik);

      // 3. Pobierz aktualne zapisy na zajęcia
      const { data: zapisyData } = await supabase.from('zapisy_zajec').select('*');
      if (zapisyData) {
        setZapisyZajecList(zapisyData);
      }

    } catch (err) {
      console.error('Błąd ładowania danych:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Automatyczne przypisanie użytkownika do zajęć
  const handleAutoAssign = async (cls: any) => {
    const clientId = selectedClientPerClass[cls.id];
    if (!clientId) {
      showToast('Wybierz najpierw klubowicza z listy!', 'error');
      return;
    }

    try {
      const clientObj = klienciList.find(k => String(k.id) === String(clientId));
      const clientName = clientObj ? `${clientObj.Imię} ${clientObj.Nazwisko}` : 'Klubowicz';
      const todayStr = new Date().toISOString().split('T')[0];
      const classKey = `${cls.id}_${todayStr}`;

      // Sprawdzenie czy już jest zapisany
      const alreadyBooked = zapisyZajecList.some(z => z.class_key?.startsWith(`${cls.id}_`) && String(z.klient_id) === String(clientId));
      if (alreadyBooked) {
        showToast('Ten klubowicz jest już zapisany na te zajęcia!', 'error');
        return;
      }

      // 1. Zapis w tabeli zapisy_zajec
      const { error: insertErr } = await supabase.from('zapisy_zajec').insert([
        {
          class_key: classKey,
          klient_id: Number(clientId),
          status: 'zapisany',
          obecny: false
        }
      ]);

      if (insertErr) throw insertErr;

      // 2. Aktualizacja nadchodzących zapisów w tabeli klienci
      const existingZapisy = clientObj?.zapisyNadchodzace || [];
      const newZapis = {
        id: Date.now(),
        data: cls.full_date_str || todayStr,
        zajecia: cls.title || cls.nazwa || 'Zajęcia',
        karnet: 'Automatyczny zapis',
        zapisujacy: 'Panel Administratora'
      };
      const updatedZapisy = [newZapis, ...existingZapisy];

      await supabase
        .from('klienci')
        .update({ zapisyNadchodzace: updatedZapisy })
        .eq('id', clientId);

      showToast(`Pomyślnie zapisano: ${clientName} na ${cls.title || cls.nazwa}!`);
      setSelectedClientPerClass({ ...selectedClientPerClass, [cls.id]: '' });
      await loadData();
    } catch (err: any) {
      console.error('Błąd zapisu:', err);
      showToast('Błąd przypisania: ' + (err.message || ''), 'error');
    }
  };

  // Wykreślenie osoby z zajęć
  const handleRemoveParticipant = async (bookingId: number, clientId: number, classTitle: string) => {
    try {
      // 1. Usuń z tabeli zapisy_zajec
      const { error: deleteErr } = await supabase.from('zapisy_zajec').delete().eq('id', bookingId);
      if (deleteErr) throw deleteErr;

      // 2. Usuń z nadchodzących zapisów klienta
      const clientObj = klienciList.find(k => String(k.id) === String(clientId));
      if (clientObj && clientObj.zapisyNadchodzace) {
        const filteredZapisy = clientObj.zapisyNadchodzace.filter((z: any) => z.zajecia !== classTitle);
        await supabase
          .from('klienci')
          .update({ zapisyNadchodzace: filteredZapisy })
          .eq('id', clientId);
      }

      showToast('Klubowicz został wykreślony z zajęć.');
      await loadData();
    } catch (err: any) {
      console.error('Błąd wykreślania:', err);
      showToast('Nie udało się wykreślić osoby: ' + (err.message || ''), 'error');
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1250px] mx-auto p-12 text-center text-slate-500 font-bold text-xs animate-pulse">
        Ładowanie grafiku i listy zapisów...
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
              Zarządzanie Rezerwacjami
            </span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-white flex items-center gap-3">
            ⚡ AUTOMATYCZNE ZAPISY
          </h1>
          <p className="text-xs text-sky-200/80 font-medium">
            Wybierz zajęcia z grafiku, przypisz klubowicza i zarządzaj listą uczestników.
          </p>
        </div>
      </div>

      {/* SEKCJA GŁÓWNA: GRAFIK I LISTA UCZESTNIKÓW */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              📋 Grafik Zajęć i Lista Zapisanych Osób
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              Dodawaj oraz usuwaj uczestników poszczególnych treningów bezpośrednio poniżej.
            </p>
          </div>
          <span className="text-[11px] font-black text-sky-900 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200">
            Pozycji w grafiku: {grafikItems.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {grafikItems.length > 0 ? (
            grafikItems.map((cls, idx) => {
              // Filtruj zapisy pasujące do danej pozycji w grafiku (po ID zajęć w class_key)
              const classBookings = zapisyZajecList.filter(z => z.class_key?.startsWith(`${cls.id}_`));

              return (
                <div
                  key={cls.id || idx}
                  className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-4 hover:border-sky-300 transition-all shadow-sm"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-sky-100 text-sky-900">
                          {cls.sourceType === 'cykliczne' ? 'Zajęcia Cykliczne' : 'Zajęcia Jednorazowe'}
                        </span>
                        {cls.full_date_str && (
                          <span className="text-[11px] font-bold text-slate-500">
                            Data: {cls.full_date_str}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-black text-slate-900">
                        {cls.title || cls.nazwa || 'Trening'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-medium">
                        <span>🕒 Godzina: <strong className="text-slate-800">{cls.time || cls.godzina || cls.start || 'Brak'}</strong></span>
                        <span>•</span>
                        <span>👤 Prowadzący: <strong className="text-slate-800">{cls.trainer || cls.prowadzacy || 'Brak'}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-slate-200">
                      <select
                        value={selectedClientPerClass[cls.id] || ''}
                        onChange={(e) => setSelectedClientPerClass({ ...selectedClientPerClass, [cls.id]: e.target.value })}
                        className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500 min-w-[220px] cursor-pointer"
                      >
                        <option value="">Wybierz klubowicza...</option>
                        {klienciList.map((klient) => (
                          <option key={klient.id} value={klient.id}>
                            {klient.Imię} {klient.Nazwisko} ({klient['E-mail'] || 'Brak email'})
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleAutoAssign(cls)}
                        className="bg-sky-900 hover:bg-sky-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
                      >
                        ⚡ Zapisz
                      </button>
                    </div>
                  </div>

                  {/* LISTA ZAPISANYCH OSÓB POD DANYM TRENINGIEM */}
                  <div className="pt-3 border-t border-slate-200/70 space-y-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                      Zapisani uczestnicy ({classBookings.length}):
                    </span>
                    {classBookings.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {classBookings.map((booking) => {
                          const clientInfo = klienciList.find(k => String(k.id) === String(booking.klient_id));
                          const clientFullName = clientInfo ? `${clientInfo.Imię} ${clientInfo.Nazwisko}` : `Klubowicz ID: ${booking.klient_id}`;
                          const clientEmail = clientInfo?.['E-mail'] || '';

                          return (
                            <div
                              key={booking.id}
                              className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs"
                            >
                              <div className="overflow-hidden pr-2">
                                <p className="text-xs font-bold text-slate-800 truncate">{clientFullName}</p>
                                <p className="text-[10px] text-slate-400 truncate">{clientEmail}</p>
                              </div>
                              <button
                                onClick={() => handleRemoveParticipant(booking.id, booking.klient_id, cls.title || cls.nazwa)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] px-2.5 py-1 rounded-lg border border-rose-200 transition-colors cursor-pointer shrink-0"
                                title="Wykreśl z zajęć"
                              >
                                Wykreśl
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Brak zapisanych osób na te zajęcia.</p>
                    )}
                  </div>

                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-xs text-slate-400 font-medium">
              Brak dostępnych pozycji w grafiku zajęć.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
