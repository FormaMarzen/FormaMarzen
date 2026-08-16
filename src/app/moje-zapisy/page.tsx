"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Bezpośrednia, bezpieczna inicjalizacja klienta Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function MojeZapisyPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zapisyNadchodzace, setZapisyNadchodzace] = useState<any[]>([]);
  const [zapisyPrzeszle, setZapisyPrzeszle] = useState<any[]>([]);
  const [itemToUnregister, setItemToUnregister] = useState<any | null>(null);

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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

      // 2. Pobranie zalogowanego użytkownika
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

          // 3. Pobranie grafików, zajęć jednorazowych, nadpisań i zapisów
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
              let dataZajecStr = parts[1] || ''; 
              
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

              let dataObj = new Date();
              if (dataZajecStr.includes('/')) {
                const [d, m] = dataZajecStr.split('/');
                dataObj = new Date(dzis.getFullYear(), parseInt(m) - 1, parseInt(d));
              } else if (dataZajecStr.includes('-')) {
                dataObj = new Date(dataZajecStr);
              }

              const [sh = '00', sm = '00'] = (znalezionaGodzina || '00:00').split(':');
              const fullStartDateTime = new Date(dataObj.getFullYear(), dataObj.getMonth(), dataObj.getDate(), parseInt(sh), parseInt(sm), 0);

              const formatDataPL = dataObj.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
              const dzienTygodniaPL = dataObj.toLocaleDateString('pl-PL', { weekday: 'long' });
              
              const nazwaZGodzina = znalezionaGodzina ? `${znalezionaNazwa || 'Trening klubowy'} ${znalezionaGodzina}` : (znalezionaNazwa || 'Trening klubowy');

              const itemObj = {
                id: z.id,
                classKey: z.class_key,
                rawClassTitle: znalezionaNazwa || '',
                limit: limitMiejsc,
                data: formatDataPL,
                dzienTygodnia: dzienTygodniaPL.charAt(0).toUpperCase() + dzienTygodniaPL.slice(1),
                rawDate: dataObj,
                fullStartDateTime,
                zajecia: nazwaZGodzina,
                statusZapisu: z.status,
                karnet: parsedClient.karnetyKlubowicza?.[0]?.nazwa || 'OPEN',
                obecnosc: z.obecny ? 'Obecny' : (z.nieobecny ? 'Nieobecny' : (z.status === 'krzesełko' ? 'Lista rezerwowa' : 'Zapisany'))
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
    } catch (err) {
      console.error("Błąd podczas ładowania zapisów:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmWypisanie = async () => {
    if (!currentUser || !itemToUnregister) return;

    // 1. Sprawdzenie nadrzędnego limitu minimalnego czasu do wypisu
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

    // 2. Pobranie aktualnych uczestników przed usunięciem (do awansu z krzesełka)
    const { data: allParticipants } = await supabase
      .from('zapisy_zajec')
      .select('*')
      .eq('class_key', classKey);

    // 3. Usunięcie rezerwacji
    const { error } = await supabase
      .from('zapisy_zajec')
      .delete()
      .eq('class_key', classKey)
      .eq('klient_id', currentUser.id);

    if (error) {
      alert(`Błąd podczas wypisywania: ${error.message}`);
      return;
    }

    // 4. Zwrot wejścia na karnet ilościowy
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

    // 5. Rejestracja w transakcjach
    await supabase.from('transakcje').insert([{
      klient_id: currentUser.id,
      typ_operacji: 'zajecia_wypis',
      class_key: classKey,
      opis: `${currentUser.firstName || 'Klubowicz'} - Samodzielne wypisanie z zajęć: ${itemToUnregister.zajecia} (${itemToUnregister.data}). Zwrócono 1 wejście.`
    }]);

    // 6. Rejestracja w logach zasad nadrzędnych
    await supabase.from('booking_logs').insert([{
      action_type: 'CANCEL_SUCCESS',
      status: 'SUCCESS',
      reason: `${currentUser.firstName || 'Klubowicz'} wypisał się z ${classKey} w widoku Moje Zapisy`,
      rule_applied: 'USER_CANCEL',
      payload: { klient_id: currentUser.id, class_key: classKey }
    }]);

    // 7. Automatyczny awans pierwszej osoby z listy rezerwowej (krzesełka)
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
        const name = pClient 
          ? `${pClient.Imię || pClient.firstName || ''} ${pClient.Nazwisko || pClient.lastName || ''}`.trim() 
          : `ID: ${firstWaitlist.klient_id}`;

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

  if (isLoading) {
    return <div className="p-10 flex justify-center text-slate-400 font-bold uppercase text-xs">Ładowanie zapisów z bazy...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in pb-20 font-sans antialiased text-slate-800">
      
      {/* SEKCJA 1: AKTYWNE ZAPISY (NADCHODZĄCE) */}
      <div className="space-y-4">
        <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">AKTYWNE ZAPISY NA ZAJĘCIA</h2>
        
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
                    <td colSpan={5} className="py-8 text-center text-slate-400">Brak nadchodzących zapisów na zajęcia.</td>
                  </tr>
                ) : (
                  zapisyNadchodzace.map((item: any, index: number) => (
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

      {/* SEKCJA 2: HISTORIA ZAPISÓW (PRZESZŁE) */}
      <div className="space-y-4">
        <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">HISTORIA ZAPISÓW</h2>
        
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
                    <td colSpan={5} className="py-8 text-center text-slate-400">Brak historii odbytych zajęć.</td>
                  </tr>
                ) : (
                  zapisyPrzeszle.map((item: any, index: number) => (
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

      {/* MODAL POTWIERDZENIA WYPISANIA */}
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
