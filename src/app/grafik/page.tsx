"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../raporty/klienci/supabase'; 

export default function SchedulePage() {
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [zapisaneZajecia, setZapisaneZajecia] = useState<any[]>([]);
  const [rodzajeZajec, setRodzajeZajec] = useState<any[]>([]);
  
  const [appRole, setAppRole] = useState<'admin' | 'klubowicz'>('admin');
  
  const [activeMenuClassId, setActiveMenuClassId] = useState<string | null>(null);
  const [historyModalClass, setHistoryModalClass] = useState<any | null>(null);
  const [modalHistoryData, setModalHistoryData] = useState<any[]>([]); 
  
  const [editClassModalData, setEditClassModalData] = useState<any | null>(null);
  const [editStartHour, setEditStartHour] = useState('08');
  const [editStartMin, setEditStartMin] = useState('00');
  const [editEndHour, setEditEndHour] = useState('09');
  const [editEndMin, setEditEndMin] = useState('00');
  const [editTrainer, setEditTrainer] = useState('');
  const [editLimit, setEditLimit] = useState('12');

  const [duplicateModalData, setDuplicateModalData] = useState<any | null>(null);
  const [dupDate, setDupDate] = useState('2026-08-07');
  const [dupStartHour, setDupStartHour] = useState('14');
  const [dupStartMin, setDupStartMin] = useState('15');
  const [dupEndHour, setDupEndHour] = useState('15');
  const [dupEndMin, setDupEndMin] = useState('15');
  const [dupPlan, setDupPlan] = useState('');
  const [dupTrainer, setDupTrainer] = useState('');
  const [dupLimit, setDupLimit] = useState('12');

  const [wydarzeniaKilkudniowe, setWydarzeniaKilkudniowe] = useState<any[]>([]);
  const [isMultiDayModalOpen, setIsMultiDayModalOpen] = useState(false);
  const [multiDayTitle, setMultiDayTitle] = useState('OBÓZ W WAŁCZU');
  const [multiDayFrom, setMultiDayFrom] = useState('2026-08-04');
  const [multiDayTo, setMultiDayTo] = useState('2026-08-06');

  const [nadpisaneZajeciaDni, setNadpisaneZajeciaDni] = useState<{ [key: string]: any }>({});
  const [jednorazoweZajecia, setJednorazoweZajecia] = useState<any[]>([]);
  
  const [zapisyNaZajecia, setZapisyNaZajecia] = useState<{ [key: string]: any[] }>({});

  const [dostepniKlienci, setDostepniKlienci] = useState<any[]>([]);
  const [listaTrenerow, setListaTrenerow] = useState<any[]>([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [searchClientQuery, setSearchClientQuery] = useState('');

  const [clientToUnregister, setClientToUnregister] = useState<any | null>(null);
  const [blokadaZapisow, setBlokadaZapisow] = useState(false);
  const [dlugoscBlokady, setDlugoscBlokady] = useState('3');

  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [calendarViewDate, setCalendarViewDate] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // GŁÓWNA FUNKCJA POBIERANIA DANYCH Z SUPABASE
  const loadDataFromSupabase = async () => {
    // 0. Pobierz definicje karnetów dla auto-naprawy wejść
    const { data: karnetyDefData } = await supabase.from('karnety').select('*');
    let ustrukturyzowaneKarnetyDef: any[] = [];
    if (karnetyDefData) {
      ustrukturyzowaneKarnetyDef = karnetyDefData.map((k: any) => {
        let meta: Record<string, any> = {};
        try { meta = JSON.parse(k.inne_ustawienia || '{}'); } catch(e) {}
        return {
          ...k,
          ilosc_wejsc: k.ilosc_wejsc || meta.ilosc_wejsc || meta.iloscTreningow || null
        };
      });
    }

    // 1. Klienci
    const { data: klienciData } = await supabase.from('klienci').select('*');
    if (klienciData) {
      const parsedKlienci = klienciData.map((c: any) => {
        let parsedKarnety = [];
        if (Array.isArray(c.karnetyKlubowicza)) {
          parsedKarnety = c.karnetyKlubowicza;
        } else if (typeof c.karnetyKlubowicza === 'string') {
          try { parsedKarnety = JSON.parse(c.karnetyKlubowicza); } catch(e) {}
        } else if (c.karnetyklubowicza) {
          parsedKarnety = c.karnetyklubowicza;
        }

        // Auto-heal brakujących wejść w historycznych karnetach
        parsedKarnety = parsedKarnety.map((k: any) => {
          if (k.pozostaloWejsc === undefined || k.pozostaloWejsc === null) {
            const pasujacyDef = ustrukturyzowaneKarnetyDef.find(dk => dk.nazwa === k.nazwa);
            if (pasujacyDef && pasujacyDef.ilosc_wejsc !== null) {
              const valWejsc = parseInt(pasujacyDef.ilosc_wejsc, 10);
              k.pozostaloWejsc = valWejsc;
              k.poczatkoweWejsc = valWejsc;
            }
          }
          return k;
        });

        return {
          ...c,
          id: c.id,
          firstName: c.Imię || c.firstName || '',
          lastName: c.Nazwisko || c.lastName || '',
          phone: c['Numer tel.'] || c.telefon || c.phone || '',
          email: c['E-mail'] || c.email || '',
          wallet: c.Portfel || c.portfel || c.wallet || '0.00 PLN',
          pass: c.pass || (parsedKarnety.length > 0 ? parsedKarnety[0].nazwa : 'OPEN'),
          expiresDate: c.expiresDate || (parsedKarnety.length > 0 ? parsedKarnety[0].waznyDo : ''),
          avatar: c.avatarUrl || c.avatar || null,
          karnetyKlubowicza: parsedKarnety
        };
      });
      setDostepniKlienci(parsedKlienci);
    }

    // 2. Zapisy na zajęcia
    const { data: zapisyData } = await supabase.from('zapisy_zajec').select('*');
    if (zapisyData) {
      const grouped: { [key: string]: any[] } = {};
      zapisyData.forEach((z: any) => {
        if (!grouped[z.class_key]) grouped[z.class_key] = [];
        grouped[z.class_key].push({
          id: z.klient_id,
          status: z.status,
          obecny: z.obecny
        });
      });
      setZapisyNaZajecia(grouped);
    }

    // 3. Nadpisania zajęć (edycje, odwołania)
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

    // 4. Wydarzenia kilkudniowe
    const { data: wydarzeniaData } = await supabase.from('wydarzenia_kilkudniowe').select('*');
    if (wydarzeniaData) {
      setWydarzeniaKilkudniowe(wydarzeniaData.map((w: any) => ({
        id: w.id,
        title: w.title,
        dateFrom: w.date_from,
        dateTo: w.date_to
      })));
    }

    // 5. Zajęcia jednorazowe/duplikowane
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
        isJednorazowe: true
      })));
    }

    // 6. Trenerzy
    const { data: trenerzyData } = await supabase.from('trenerzy').select('*');
    if (trenerzyData) {
      setListaTrenerow(trenerzyData);
      if (trenerzyData.length > 0) {
        setDupTrainer(trenerzyData[0].imie_nazwisko);
      }
    }

    // 7. Szablony zajęć (stały grafik) z Supabase (tabela: grafik_zajec)
    const { data: szablonyData } = await supabase.from('grafik_zajec').select('*');
    if (szablonyData) {
      setZapisaneZajecia(szablonyData.map((s: any) => ({
        id: s.id,
        title: s.title || s.nazwa,
        start: s.start || s.start_time,
        end: s.end || s.end_time,
        trainer: s.trainer || s.prowadzacy,
        limit: s.limit || s.limit_miejsc,
        days: s.days || {}
      })));
    }

    // 8. Rodzaje zajęć (kolory/etykiety) z Supabase
    const { data: rodzajeData } = await supabase.from('rodzaje_zajec').select('*');
    if (rodzajeData) {
      setRodzajeZajec(rodzajeData);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    
    // SPRAWDZENIE WEEKENDU - jeśli sobota (6) lub niedziela (0), przeskocz na przyszły poniedziałek
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 6) { // Sobota
      now.setDate(now.getDate() + 2);
    } else if (dayOfWeek === 0) { // Niedziela
      now.setDate(now.getDate() + 1);
    }

    setCurrentDate(now);
    setCalendarViewDate(now);

    loadDataFromSupabase();

    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem('forma_marzen_app_role');
      if (savedRole === 'klubowicz' || savedRole === 'admin') {
        setAppRole(savedRole);
      }
    }
  }, []);

  if (!isMounted || !currentDate || !calendarViewDate) {
    return <div className="p-8 text-center text-slate-500 font-bold">Ładowanie grafiku zajęć...</div>;
  }

  const openHistoryModal = async (item: any, displayDate: string) => {
    setHistoryModalClass({ ...item, displayDate });
    setModalHistoryData([]); 
    const classKey = `${item.id}_${displayDate}`;
    
    const { data } = await supabase
      .from('transakcje')
      .select('*')
      .eq('class_key', classKey)
      .order('created_at', { ascending: false });

    if (data) {
      setModalHistoryData(data);
    }
  };

  const getPrawdziweAktywneZapisy = (klientId: number) => {
    let count = 0;
    const now = new Date();
    
    Object.entries(zapisyNaZajecia).forEach(([classKey, uczestnicy]) => {
      const parts = classKey.split('_');
      const dateStr = parts[1];
      if (dateStr) {
        const [d, m] = dateStr.split('/').map(Number);
        const classDate = new Date(now.getFullYear(), m - 1, d, 23, 59, 59);

        if (classDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
          if (Array.isArray(uczestnicy) && uczestnicy.some((u: any) => u.id === klientId)) {
            count++;
          }
        }
      }
    });

    return count;
  };

  const getTopBorderColor = (title: string, isOdwolane: boolean, isUsuniete: boolean) => {
    if (isOdwolane || isUsuniete) return '#fda4af';
    if (!title) return '#0284c7';
    const found = rodzajeZajec.find(r => r.nazwa?.trim().toLowerCase() === title?.trim().toLowerCase());
    if (found && found.kolor) {
      return found.kolor;
    }
    const colorPalette = ['#2563eb', '#9333ea', '#16a34a', '#dc2626', '#d97706', '#0d9488', '#c026d3'];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colorPalette[Math.abs(hash) % colorPalette.length];
  };

  const getMonday = (d: Date) => {
    const dCopy = new Date(d);
    const day = dCopy.getDay();
    const diff = dCopy.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(dCopy.setDate(diff));
  };

  const currentMonday = getMonday(currentDate);
  const today = new Date();

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

  const handleSaveMultiDayEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!multiDayTitle.trim()) {
      alert("Podaj nazwę wydarzenia!");
      return;
    }

    const { error } = await supabase.from('wydarzenia_kilkudniowe').insert([
      {
        title: multiDayTitle.toUpperCase(),
        date_from: multiDayFrom,
        date_to: multiDayTo
      }
    ]);

    if (error) {
      console.error("Błąd dodawania wydarzenia:", error);
      alert("Nie udało się zapisać wydarzenia!");
      return;
    }

    for (const col of daysList) {
      if (col.isoDate >= multiDayFrom && col.isoDate <= multiDayTo) {
        const standardoweDnia = zapisaneZajecia
          .filter((item: any) => item.days && item.days[col.key])
          .map((item: any) => {
            const classKey = `${item.id}_${col.date}`;
            const override = nadpisaneZajeciaDni[classKey];
            return override ? { ...item, ...override } : item;
          });

        const jednorazoweDnia = jednorazoweZajecia.filter((item: any) => item.displayDate === col.date);
        const zajeciaDnia = [...standardoweDnia, ...jednorazoweDnia];

        for (const item of zajeciaDnia) {
          const classKey = `${item.id}_${col.date}`;
          await supabase.from('zapisy_zajec').delete().eq('class_key', classKey);
        }
      }
    }

    setIsMultiDayModalOpen(false);
    setMultiDayTitle('OBÓZ W WAŁCZU');
    loadDataFromSupabase();
  };

  const handleDeleteMultiDayEvent = async (id: number) => {
    if (confirm("Czy na pewno chcesz usunąć to wydarzenie kilkudniowe? Zajęcia zostaną przywrócone bez zapisanych użytkowników.")) {
      await supabase.from('wydarzenia_kilkudniowe').delete().eq('id', id);
      loadDataFromSupabase();
    }
  };

  const handleZapiszKlientaDoZajec = async (klient: any) => {
    if (!selectedClass) return;
    if (selectedClass.isOdwołane || selectedClass.isUsunięte) {
      alert("Nie można zapisać uczestnika na odwołane lub usunięte zajęcia!");
      return;
    }

    if (klient.blokadaDo) {
      const dataBlokady = new Date(klient.blokadaDo);
      const teraz = new Date();
      if (teraz <= dataBlokady) {
        alert(`Nie można zapisać klienta! ${klient.powodBlokady || 'Klient posiada aktywną blokadę zapisów.'}`);
        return;
      }
    }

    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const aktualni = zapisyNaZajecia[classKey] || [];

    if (aktualni.some(k => k.id === klient.id)) {
      alert("Ten klient jest już zapisany na te zajęcia!");
      return;
    }

    // --- WERYFIKACJA LIMITU DZIENNEGO ---
    let dailyLimit = Infinity; 
    if (klient.karnetyKlubowicza && klient.karnetyKlubowicza.length > 0) {
      const activePass = klient.karnetyKlubowicza[0];
      let meta: any = {};
      
      try {
        meta = typeof activePass.inne_ustawienia === 'string' 
          ? JSON.parse(activePass.inne_ustawienia) 
          : (activePass.inne_ustawienia || {});
      } catch(e) {}
      
      const typLimitu = meta.dziennyLimit || activePass.dziennyLimit;
      const iloscLimitu = meta.niestandardowyDziennyIlosc || activePass.niestandardowyDziennyIlosc;
      
      if (typLimitu === 'Niestandardowy') {
        dailyLimit = parseInt(iloscLimitu, 10) || Infinity;
      }
    }

    let userSignupsOnThisDate = 0;
    Object.entries(zapisyNaZajecia).forEach(([cKey, uczestnicy]) => {
      if (cKey.endsWith(`_${selectedClass.displayDate}`)) {
        if (Array.isArray(uczestnicy) && uczestnicy.some((u: any) => u.id === klient.id)) {
          userSignupsOnThisDate++;
        }
      }
    });

    if (userSignupsOnThisDate >= dailyLimit) {
      alert(`Nie można zapisać! Klubowicz wykorzystał już swój dzienny limit zapisów na ten dzień (Limit: ${dailyLimit}).`);
      return;
    }

    const limitZajec = selectedClass.limit || 12;
    const statusZpisu = aktualni.length >= limitZajec ? 'krzesełko' : 'zapisany';

    const { error } = await supabase.from('zapisy_zajec').insert([
      {
        class_key: classKey,
        klient_id: klient.id,
        status: statusZpisu,
        obecny: false
      }
    ]);

    if (error) {
      console.error("Błąd zapisu na zajęcia:", error);
      alert(`Nie udało się zapisać: ${error.message}`);
      return;
    }

    // --- AUTOMATYCZNE ODEJMOWANIE WEJŚCIA DLA KARNETU ILOŚCIOWEGO ---
    let updatedKarnety = [...(klient.karnetyKlubowicza || [])];
    const passIndex = updatedKarnety.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
    if (passIndex !== -1) {
      const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10);
      if (!isNaN(currentRemaining) && currentRemaining > 0) {
        updatedKarnety[passIndex] = {
          ...updatedKarnety[passIndex],
          pozostaloWejsc: currentRemaining - 1
        };
        await supabase.from('klienci').update({ karnetyKlubowicza: updatedKarnety }).eq('id', klient.id);
      }
    }

    const oblozenieStr = `${aktualni.length + 1}/${limitZajec}`;
    const typWydarzenia = statusZpisu === 'krzesełko' 
      ? `Zapisano na listę rezerwową (krzesełko)` 
      : `Zapisano na zajęcia`;

    await supabase.from('transakcje').insert([{
      klient_id: klient.id,
      typ_operacji: 'zajecia_zapis',
      class_key: classKey,
      opis: `${klient.firstName} ${klient.lastName} - ${typWydarzenia}. Obłożenie: ${oblozenieStr}`
    }]);

    setIsSearchingClient(false);
    setSearchClientQuery('');
    loadDataFromSupabase();
  };

  const handlePotwierdzWypisanie = async () => {
    if (!selectedClass || !clientToUnregister) return;
    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const limitZajec = selectedClass.limit || 12;
    const aktualni = zapisyNaZajecia[classKey] || [];

    const { error } = await supabase
      .from('zapisy_zajec')
      .delete()
      .eq('class_key', classKey)
      .eq('klient_id', clientToUnregister.id);

    if (error) {
      console.error("Błąd wypisywania z zajęć:", error);
      alert(`Nie udało się wypisać: ${error.message}`);
      return;
    }

    // --- ZAPYTANIE O ZWROT WEJŚCIA NA KARNET ILOŚCIOWY ---
    const zwrocicWejscie = confirm("Czy zwrócić klubowiczowi wejście na karnet?");
    let updatedKarnety = [...(clientToUnregister.karnetyKlubowicza || [])];
    if (zwrocicWejscie) {
      const passIndex = updatedKarnety.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
      if (passIndex !== -1) {
        const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10);
        const poczatkowe = parseInt(updatedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
        if (!isNaN(currentRemaining)) {
          updatedKarnety[passIndex] = {
            ...updatedKarnety[passIndex],
            pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
          };
          await supabase.from('klienci').update({ karnetyKlubowicza: updatedKarnety }).eq('id', clientToUnregister.id);
        }
      }
    }

    await supabase.from('transakcje').insert([{
      klient_id: clientToUnregister.id,
      typ_operacji: 'zajecia_wypis',
      class_key: classKey,
      opis: `${clientToUnregister.firstName} ${clientToUnregister.lastName} - Wypisanie z zajęć przez klub.${zwrocicWejscie ? ' Zwrócono 1 wejście.' : ''} Obłożenie po wypisie: ${aktualni.length - 1}/${limitZajec}`
    }]);

    if (blokadaZapisow) {
      const dni = parseInt(dlugoscBlokady) || 3;
      const dataWypisania = new Date();
      const dataWygaśnięcia = new Date(dataWypisania);
      dataWygaśnięcia.setDate(dataWypisania.getDate() + dni);

      const dataStr = `${dataWygaśnięcia.getFullYear()}-${String(dataWygaśnięcia.getMonth() + 1).padStart(2, '0')}-${String(dataWygaśnięcia.getDate()).padStart(2, '0')}`;
      const powod = `Blokada zapisów na ${dni} dni za brak obecności na treningu ${selectedClass.title} w dniu ${selectedClass.displayDate}.`;

      await supabase
        .from('klienci')
        .update({ blokadaDo: dataStr, powodBlokady: powod })
        .eq('id', clientToUnregister.id);
    }

    setClientToUnregister(null);
    setBlokadaZapisow(false);
    loadDataFromSupabase();
  };

  const toggleObecny = async (klientId: number) => {
    if (!selectedClass) return;
    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const aktualni = zapisyNaZajecia[classKey] || [];
    const szukany = aktualni.find(k => k.id === klientId);
    
    if (!szukany) return;
    const nowyStanObecny = !szukany.obecny;

    await supabase
      .from('zapisy_zajec')
      .update({ obecny: nowyStanObecny })
      .eq('class_key', classKey)
      .eq('klient_id', klientId);

    loadDataFromSupabase();
  };

  const handleSaveClassEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClassModalData) return;

    const newStart = `${editStartHour.padStart(2, '0')}:${editStartMin.padStart(2, '0')}`;
    const newEnd = `${editEndHour.padStart(2, '0')}:${editEndMin.padStart(2, '0')}`;
    const newLimitNum = parseInt(editLimit, 10) || 12;

    const classKey = `${editClassModalData.id}_${editClassModalData.displayDate}`;

    const { error } = await supabase.from('nadpisania_zajec').upsert([
      {
        class_key: classKey,
        start: newStart,
        end: newEnd,
        trainer: editTrainer,
        limit: newLimitNum,
        is_odwolane: editClassModalData.isOdwołane || false,
        is_usuniete: editClassModalData.isUsunięte || false
      }
    ], { onConflict: 'class_key' });

    if (error) {
      console.error("Błąd zapisu nadpisania w Supabase:", error);
      alert(`Błąd: ${error.message}`);
      return;
    }

    await supabase.from('transakcje').insert([{
      typ_operacji: 'edycja_zajec',
      class_key: classKey,
      opis: `Zmieniono dane zajęć. Nowy limit: ${newLimitNum}, Trener: ${editTrainer}, Godziny: ${newStart}-${newEnd}`
    }]);

    setEditClassModalData(null);
    loadDataFromSupabase();
    alert("Zajęcia w tym dniu zostały pomyślnie zaktualizowane w chmurze!");
  };

  const handleSaveDuplicateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dupPlan) {
      alert("Wybierz rodzaj zajęć / plan treningowy!");
      return;
    }

    const startStr = `${dupStartHour.padStart(2, '0')}:${dupStartMin.padStart(2, '0')}`;
    const endStr = `${dupEndHour.padStart(2, '0')}:${dupEndMin.padStart(2, '0')}`;
    const limitNum = parseInt(dupLimit, 10) || 12;

    const [y, m, d] = dupDate.split('-');
    const displayDateStr = `${d}/${m}`;

    const { error } = await supabase.from('zajecia_jednorazowe').insert([
      {
        title: dupPlan,
        start_time: startStr,
        end_time: endStr,
        trainer: dupTrainer,
        limit_miejsc: limitNum,
        display_date: displayDateStr,
        full_date_str: dupDate
      }
    ]);

    if (error) {
      console.error("Błąd dodawania zajęć jednorazowych:", error);
      alert("Nie udało się zapisać zajęć!");
      return;
    }

    setDuplicateModalData(null);
    alert(`Pomyślnie dodano zduplikowane zajęcia "${dupPlan}" na dzień ${dupDate}!`);
    loadDataFromSupabase();
  };

  const handleToggleOdwolajZajecia = async (item: any, displayDate: string) => {
    const classKey = `${item.id}_${displayDate}`;
    const nextOdwołaneState = !item.isOdwołane;

    if (nextOdwołaneState) {
      await supabase.from('zapisy_zajec').delete().eq('class_key', classKey);
    }

    await supabase.from('nadpisania_zajec').upsert([
      {
        class_key: classKey,
        start: item.start || '08:00',
        end: item.end || '09:00',
        trainer: item.trainer || '',
        limit: item.limit || 12,
        is_odwolane: nextOdwołaneState,
        is_usuniete: item.isUsunięte || false
      }
    ], { onConflict: 'class_key' });

    await supabase.from('transakcje').insert([{
      typ_operacji: nextOdwołaneState ? 'odwolanie_zajec' : 'przywrocenie_zajec',
      class_key: classKey,
      opis: nextOdwołaneState ? 'Odwołano zajęcia z poziomu grafiku' : 'Przywrócono odwołane zajęcia'
    }]);

    setActiveMenuClassId(null);
    loadDataFromSupabase();
  };

  const handleToggleUsunZajecia = async (item: any, displayDate: string) => {
    const classKey = `${item.id}_${displayDate}`;
    const nextUsunięteState = !item.isUsunięte;

    if (nextUsunięteState) {
      await supabase.from('zapisy_zajec').delete().eq('class_key', classKey);
    }

    await supabase.from('nadpisania_zajec').upsert([
      {
        class_key: classKey,
        start: item.start || '08:00',
        end: item.end || '09:00',
        trainer: item.trainer || '',
        limit: item.limit || 12,
        is_odwolane: item.isOdwołane || false,
        is_usuniete: nextUsunięteState
      }
    ], { onConflict: 'class_key' });

    await supabase.from('transakcje').insert([{
      typ_operacji: nextUsunięteState ? 'usuniecie_zajec' : 'przywrocenie_zajec',
      class_key: classKey,
      opis: nextUsunięteState ? 'Usunięto zajęcia z poziomu grafiku' : 'Przywrócono usunięte zajęcia'
    }]);

    setActiveMenuClassId(null);
    loadDataFromSupabase();
  };

  return (
    <div className="max-w-[1700px] mx-auto space-y-4 pb-24 relative">
      
      {/* GÓRNY PASEK AKCJI Z PRZYCISKIEM WYDARZENIA KILKUDNIOWEGO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-sky-200 p-4 rounded-2xl shadow-sm">
        <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
          GRAFIK ZAJĘĆ
        </h1>
        {appRole === 'admin' && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMultiDayModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span>⛺</span> + WYDARZENIE KILKUDNIOWE
            </button>
          </div>
        )}
      </div>

      {/* Pasek dni tygodnia */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button 
          onClick={handlePrevWeek}
          className="w-9 h-9 bg-white text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-full flex items-center justify-center font-bold shadow-sm shrink-0 transition-colors"
          title="Poprzedni tydzień"
        >
          ◀
        </button>
        
        <div className="grid grid-cols-5 gap-3 flex-1">
          {daysList.map((d, i) => (
            <div 
              key={i} 
              className={`flex flex-col items-center justify-center px-3 py-3 rounded-xl text-xs font-bold border transition-all ${
                d.isToday 
                  ? 'bg-white border-rose-500 text-rose-950 shadow-sm border-b-4 border-b-rose-600' 
                  : 'bg-sky-50/70 border-sky-200 text-slate-700'
              }`}
            >
              <span className={`tracking-wide uppercase text-[11px] ${d.isToday ? 'text-rose-700 font-black' : ''}`}>{d.day}</span>
              <button 
                onClick={() => {
                  setCurrentDate(d.fullDate);
                  setCalendarViewDate(new Date(d.fullDate.getFullYear(), d.fullDate.getMonth(), 1));
                  setIsCalendarOpen(!isCalendarOpen);
                }}
                className={`font-normal text-[11px] mt-0.5 underline decoration-dotted cursor-pointer px-2 py-0.5 rounded-md transition-colors ${
                  d.isToday ? 'bg-rose-100 text-rose-800' : 'text-sky-600 hover:text-sky-800 bg-sky-100/60'
                }`}
              >
                {d.date} 📅
              </button>
            </div>
          ))}
        </div>

        <button 
          onClick={handleNextWeek}
          className="w-9 h-9 bg-white text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-full flex items-center justify-center font-bold shadow-sm shrink-0 transition-colors"
          title="Następny tydzień"
        >
          ▶
        </button>
      </div>

      {/* KALENDARZ MIESIĘCZNY */}
      {isCalendarOpen && (
        <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-lg max-w-md mx-auto space-y-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-sky-100 pb-3">
            <button onClick={prevMonth} className="w-8 h-8 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-lg font-bold">◀</button>
            <h3 className="font-black text-sm text-sky-950 uppercase">{monthNames[month]} {year}</h3>
            <button onClick={nextMonth} className="w-8 h-8 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-lg font-bold">▶</button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'].map((mName, idx) => (
              <div key={idx} className="font-bold text-sky-900 py-1">{mName}</div>
            ))}

            {Array.from({ length: firstDayIndex }).map((_, idx) => (
              <div key={`empty-${idx}`} />
            ))}

            {Array.from({ length: totalDays }).map((_, idx) => {
              const dayNum = idx + 1;
              const thisDate = new Date(year, month, dayNum);
              const isSelected = currentDate.getDate() === dayNum && currentDate.getMonth() === month && currentDate.getFullYear() === year;

              return (
                <button
                  key={dayNum}
                  onClick={() => {
                    setCurrentDate(thisDate);
                    setIsCalendarOpen(false);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                    isSelected ? 'bg-rose-900 text-white shadow-sm' : 'hover:bg-sky-100 text-slate-700 bg-sky-50/50'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-2 border-t border-sky-100">
            <button onClick={() => setIsCalendarOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-1.5 rounded-xl text-xs">
              Zamknij
            </button>
          </div>
        </div>
      )}

      {/* SIATKA ZAJĘĆ */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
        {daysList.map((col, idx) => {
          const aktywneWydarzeniaDnia = wydarzeniaKilkudniowe.filter((w: any) => {
            return col.isoDate >= w.dateFrom && col.isoDate <= w.dateTo;
          });

          const czyObózAktywny = aktywneWydarzeniaDnia.length > 0;

          const standardoweDnia = czyObózAktywny ? [] : zapisaneZajecia
            .filter((item: any) => item.days && item.days[col.key])
            .map((item: any) => {
              const classKey = `${item.id}_${col.date}`;
              const override = nadpisaneZajeciaDni[classKey];
              if (override) {
                return { ...item, ...override };
              }
              return item;
            });

          const jednorazoweDnia = czyObózAktywny ? [] : jednorazoweZajecia.filter((item: any) => item.displayDate === col.date);
          const zajeciaDnia = [...standardoweDnia, ...jednorazoweDnia].sort((a: any, b: any) => (a.start || "").localeCompare(b.start || ""));

          return (
            <div key={idx} className="space-y-3 bg-sky-50/40 p-3 rounded-2xl border border-sky-100 min-h-[300px]">
              <div className="text-xs font-black uppercase tracking-wider text-sky-900 border-b border-sky-200 pb-2 mb-2 text-center">
                {col.day} <span className="text-[10px] text-slate-500 font-normal">({col.date})</span>
              </div>

              {/* WYŚWIETLANIE WYDARZEŃ KILKUDNIOWYCH */}
              {aktywneWydarzeniaDnia.map((wydarzenie: any) => (
                <div key={wydarzenie.id} className="bg-rose-100 border border-rose-300 rounded-2xl p-4 text-center space-y-2 shadow-sm relative overflow-hidden group">
                  <div className="py-2 px-3 bg-rose-200 text-rose-950 font-black rounded-xl text-xs uppercase tracking-wider border border-rose-300 shadow-inner">
                    {wydarzenie.title}
                  </div>
                  <div className="text-[11px] text-rose-900 font-bold">
                    Zajęcia odwołane z powodu wydarzenia
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-rose-800 font-bold px-1 pt-1 border-t border-rose-200">
                    <span>Od {wydarzenie.dateFrom} do {wydarzenie.dateTo}</span>
                    {appRole === 'admin' && (
                      <button 
                        onClick={() => handleDeleteMultiDayEvent(wydarzenie.id)}
                        className="text-rose-700 hover:text-rose-950 cursor-pointer underline"
                        title="Usuń wydarzenie"
                      >
                        Usuń
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {zajeciaDnia.length > 0 ? (
                zajeciaDnia.map((item: any, classIdx: number) => {
                  const durationText = calculateDuration(item.start, item.end);
                  const classKey = `${item.id}_${col.date}`;
                  const zapisaniWszyscy = zapisyNaZajecia[classKey] || [];
                  const limitZajec = item.limit || 12;
                  
                  const liczbaGlowna = Math.min(zapisaniWszyscy.length, limitZajec);
                  const liczbaKrzesełko = Math.max(0, zapisaniWszyscy.length - limitZajec);
                  const isFull = zapisaniWszyscy.length >= limitZajec;

                  const topColor = getTopBorderColor(item.title, item.isOdwołane, item.isUsunięte);
                  const isMenuOpen = activeMenuClassId === classKey;

                  return (
                    <div 
                      key={`${item.id}_${col.date}_${classIdx}`}
                      onClick={() => {
                        if (item.isOdwołane || item.isUsunięte) return;
                        setSelectedClass({
                          ...item,
                          displayDate: col.date,
                          durationText
                        });
                        setIsSearchingClient(false);
                        setSearchClientQuery('');
                      }}
                      style={{ borderTopWidth: '5px', borderTopStyle: 'solid', borderTopColor: topColor }}
                      className={`bg-white border rounded-2xl p-4 space-y-3 shadow-sm transition-all relative ${
                        item.isOdwołane || item.isUsunięte ? 'border-rose-200 opacity-90' : 'border-sky-100 hover:border-sky-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-base font-black text-slate-900">{item.start}</span>
                          <h3 className="text-xs font-bold text-slate-800 mt-0.5">{item.title}</h3>
                        </div>

                        {appRole === 'admin' && (
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => setActiveMenuClassId(isMenuOpen ? null : classKey)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-sm"
                              title="Ustawienia zajęć"
                            >
                              ⚙️
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 text-xs">
                                <button onClick={() => { openHistoryModal(item, col.date); setActiveMenuClassId(null); }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer">
                                  🕒 Pokaż historię
                                </button>
                                <button onClick={() => { alert("Wyślij wiadomość"); setActiveMenuClassId(null); }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer">
                                  ✉️ Wyślij wiadomość
                                </button>
                                <button onClick={() => { 
                                  setEditClassModalData({ ...item, displayDate: col.date });
                                  const [sh = '08', sm = '00'] = (item.start || '08:00').split(':');
                                  const [eh = '09', em = '00'] = (item.end || '09:00').split(':');
                                  setEditStartHour(sh);
                                  setEditStartMin(sm);
                                  setEditEndHour(eh);
                                  setEditEndMin(em);
                                  setEditTrainer(item.trainer || (listaTrenerow.length > 0 ? listaTrenerow[0].imie_nazwisko : ''));
                                  setEditLimit(String(item.limit || 12));
                                  setActiveMenuClassId(null); 
                                }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer">
                                  ✏️ Edytuj zajęcia
                                </button>

                                {!item.isOdwołane && !item.isUsunięte ? (
                                  <>
                                    <button onClick={() => { 
                                      const [sh = '14', sm = '15'] = (item.start || '14:15').split(':');
                                      const [eh = '15', em = '15'] = (item.end || '15:15').split(':');
                                      setDupDate('2026-' + col.date.split('/').reverse().join('-'));
                                      setDupStartHour(sh);
                                      setDupStartMin(sm);
                                      setDupEndHour(eh);
                                      setDupEndMin(em);
                                      setDupPlan(item.title || '');
                                      setDupTrainer(item.trainer || (listaTrenerow.length > 0 ? listaTrenerow[0].imie_nazwisko : ''));
                                      setDupLimit(String(item.limit || 12));
                                      setDuplicateModalData(true);
                                      setActiveMenuClassId(null); 
                                    }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer">
                                      📋 Duplikuj
                                    </button>
                                    <button onClick={() => handleToggleOdwolajZajecia(item, col.date)} className="w-full text-left px-4 py-2.5 text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2.5 cursor-pointer">
                                      ❌ Odwołaj zajęcia
                                    </button>
                                    <button onClick={() => handleToggleUsunZajecia(item, col.date)} className="w-full text-left px-4 py-2.5 text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2.5 cursor-pointer">
                                      🗑️ Usuń zajęcia
                                    </button>
                                  </>
                                ) : (
                                  <button onClick={() => {
                                    if (item.isOdwołane) handleToggleOdwolajZajecia(item, col.date);
                                    if (item.isUsunięte) handleToggleUsunZajecia(item, col.date);
                                  }} className="w-full text-left px-4 py-2.5 text-emerald-700 hover:bg-emerald-50 font-bold flex items-center gap-2.5 cursor-pointer">
                                    🔄 Przywróć zajęcia
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                      </div>

                      {item.isOdwołane ? (
                        <div className="py-1 px-3 bg-rose-100 text-rose-800 font-black text-center rounded-lg text-xs uppercase tracking-wider border border-rose-200">
                          ODWOŁANE
                        </div>
                      ) : item.isUsunięte ? (
                        <div className="py-1 px-3 bg-rose-100 text-rose-800 font-black text-center rounded-lg text-xs uppercase tracking-wider border border-rose-200">
                          USUNIĘTE
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold px-2 py-0.5 rounded text-[11px] border ${
                            isFull 
                              ? 'bg-rose-100 text-rose-900 border-rose-200' 
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}>
                            👥 {liczbaGlowna}/{limitZajec}
                          </span>

                          {liczbaKrzesełko > 0 && (
                            <span className="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded text-[11px] border border-blue-200 flex items-center gap-1">
                              🪑 {liczbaKrzesełko}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="text-[11px] text-slate-500 font-medium">
                        ⏱ {durationText}
                      </div>

                      <div className="text-[11px] text-slate-600 font-medium border-t border-slate-100 pt-2 flex items-center gap-1.5">
                        <span>👤</span> {item.trainer || 'Brak trenera'}
                      </div>
                    </div>
                  );
                })
              ) : (
                aktywneWydarzeniaDnia.length === 0 && (
                  <div className="py-12 text-center text-xs text-slate-400 font-medium">
                    Brak zajęć w tym dniu.
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL ZARZĄDZANIA UCZESTNIKAMI */}
      {selectedClass && (() => {
        const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
        const zapisaniWszyscy = zapisyNaZajecia[classKey] || [];
        const limitZajec = selectedClass.limit || 12;

        const sortAlfabet = (a: any, b: any) => {
          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
          return nameA.localeCompare(nameB);
        };

        const listaGlowna = [...zapisaniWszyscy.slice(0, limitZajec)].sort(sortAlfabet);
        const listaKrzesełko = zapisaniWszyscy.slice(limitZajec);
        const isFull = zapisaniWszyscy.length >= limitZajec;

        const filteredSuggestions = dostepniKlienci
          .filter(c => 
            `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(searchClientQuery.toLowerCase()) ||
            (c.email || '').toLowerCase().includes(searchClientQuery.toLowerCase())
          )
          .sort(sortAlfabet);

        return (
          <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <div className="bg-slate-100 border border-sky-200 rounded-3xl max-w-5xl w-full p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto relative">
              
              <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-sky-200 shadow-sm">
                <div className="flex items-center gap-3">
                  <h3 className="font-black text-sm text-sky-950 uppercase tracking-wide">
                    {selectedClass.title} {selectedClass.start}
                  </h3>
                  <span className="text-xs font-mono text-slate-400">{new Date().getFullYear()}-{selectedClass.displayDate.split('/').reverse().join('-')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                    isFull ? 'bg-rose-100 text-rose-900 border-rose-200' : 'bg-sky-100 text-sky-900 border-sky-200'
                  }`}>
                    {zapisaniWszyscy.length}/{limitZajec}
                  </span>
                  <button 
                    onClick={() => setSelectedClass(null)} 
                    className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full flex items-center justify-center font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* LISTA GŁÓWNA */}
              <div className="space-y-3">
                <h4 className="font-black text-xs text-slate-500 uppercase tracking-wider">Główna lista uczestników</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {listaGlowna.map((osobaZapisana) => {
                    const osoba = dostepniKlienci.find(c => c.id === osobaZapisana.id) || osobaZapisana;
                    const prawdziweZapisy = getPrawdziweAktywneZapisy(osoba.id);

                    const stanPortfelaStr = String(osoba.wallet || '0').replace(/[^0-9.-]+/g, '');
                    const stanPortfela = parseFloat(stanPortfelaStr) || 0;
                    let portfelColorClass = 'text-slate-500';
                    if (stanPortfela > 0) {
                      portfelColorClass = 'text-emerald-600 font-bold';
                    } else if (stanPortfela < 0) {
                      portfelColorClass = 'text-rose-600 font-bold';
                    }

                    return (
                      <div key={osoba.id} className="bg-white border border-sky-200 rounded-2xl p-4 shadow-sm relative flex flex-col justify-between space-y-4">
                        
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-black text-slate-900 text-sm">{osoba.firstName} {osoba.lastName}</h4>
                            <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                              <div><span className="font-bold text-slate-700">KARNET:</span> {osoba.pass || 'OPEN'}</div>
                              <div><span className="font-bold text-slate-700">WAŻNOŚĆ:</span> {osoba.expiresDate || '2026-09-01'}</div>
                              <div>aktywne zapisy: <strong className="text-sky-900">{prawdziweZapisy}</strong></div>
                              <div>
                                <span className="font-bold text-slate-700">PORTFEL:</span>{' '}
                                <span className={portfelColorClass}>{osoba.wallet || '0.00 PLN'}</span>
                              </div>
                              {osoba.blokadaDo && (
                                <div className="text-rose-600 font-bold mt-1 bg-rose-50 p-1.5 rounded border border-rose-100">
                                  ⚠️ {osoba.powodBlokady || `Blokada zapisów do ${osoba.blokadaDo}`}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* WYŚWIETLANIE ZDJĘCIA / AVATARA KLIENTA */}
                          <div className="w-10 h-10 rounded-full bg-sky-100 border-2 border-amber-500 overflow-hidden flex items-center justify-center font-bold text-sky-900 text-xs shrink-0 shadow-sm">
                            {osoba.avatar ? (
                              <img src={osoba.avatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              '👤'
                            )}
                          </div>
                        </div>

                        {appRole === 'admin' && (
                          <div className="flex items-center justify-between border-t border-sky-100 pt-3 text-xs">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={osobaZapisana.obecny ?? false} 
                                onChange={() => toggleObecny(osoba.id)}
                                className="w-4 h-4 accent-amber-600 rounded cursor-pointer" 
                              />
                              <span className="font-black text-amber-700 tracking-wider">OBECNY</span>
                            </label>
                            <button 
                              onClick={() => setClientToUnregister(osoba)}
                              className="text-rose-600 hover:text-rose-800 font-bold uppercase tracking-wider text-[11px]"
                            >
                              WYPISZ
                            </button>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>

                {listaGlowna.length === 0 && (
                  <div className="bg-white border border-sky-200 rounded-2xl p-8 text-center text-slate-400 font-medium text-xs">
                    Brak uczestników na głównej liście.
                  </div>
                )}
              </div>

              {/* SEKCJA: KRZESEŁKO (REZERWA) */}
              {listaKrzesełko.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-sky-200">
                  <h4 className="font-black text-xs text-blue-900 uppercase tracking-wider flex items-center gap-2">
                    <span>🪑</span> Lista rezerwowa (Krzesełko) - {listaKrzesełko.length} osób
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {listaKrzesełko.map((osobaZapisana, idx) => {
                      const osoba = dostepniKlienci.find(c => c.id === osobaZapisana.id) || osobaZapisana;
                      const prawdziweZapisy = getPrawdziweAktywneZapisy(osoba.id);

                      const stanPortfelaStr = String(osoba.wallet || '0').replace(/[^0-9.-]+/g, '');
                      const stanPortfela = parseFloat(stanPortfelaStr) || 0;
                      let portfelColorClass = 'text-slate-500';
                      if (stanPortfela > 0) {
                        portfelColorClass = 'text-emerald-600 font-bold';
                      } else if (stanPortfela < 0) {
                        portfelColorClass = 'text-rose-600 font-bold';
                      }

                      return (
                        <div key={osoba.id} className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 shadow-sm relative flex flex-col justify-between space-y-4">
                          
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-black text-slate-900 text-sm">{osoba.firstName} {osoba.lastName}</h4>
                                <span className="bg-blue-200 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded">
                                  #{idx + 1}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                                <div><span className="font-bold text-slate-700">KARNET:</span> {osoba.pass || 'OPEN'}</div>
                                <div><span className="font-bold text-slate-700">WAŻNOŚĆ:</span> {osoba.expiresDate || '2026-09-01'}</div>
                                <div>aktywne zapisy: <strong className="text-sky-900">{prawdziweZapisy}</strong></div>
                                <div>
                                  <span className="font-bold text-slate-700">PORTFEL:</span>{' '}
                                  <span className={portfelColorClass}>{osoba.wallet || '0.00 PLN'}</span>
                                </div>
                              </div>
                            </div>

                            {/* ZDJĘCIE / AVATAR NA LIŚCIE REZERWOWEJ */}
                            <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-500 overflow-hidden flex items-center justify-center font-bold text-blue-900 text-xs shrink-0 shadow-sm">
                              {osoba.avatar ? (
                                <img src={osoba.avatar} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                '🪑'
                              )}
                            </div>
                          </div>

                          {appRole === 'admin' && (
                            <div className="flex items-center justify-between border-t border-blue-100 pt-3 text-xs">
                              <span className="font-bold text-blue-800 text-[11px]">Oczekuje na wolne miejsce</span>
                              <button 
                                onClick={() => setClientToUnregister(osoba)}
                                className="text-rose-600 hover:text-rose-800 font-bold uppercase tracking-wider text-[11px]"
                              >
                                WYPISZ
                              </button>
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {appRole === 'admin' && (
                <div className="bg-white border border-sky-200 rounded-2xl p-4 space-y-3">
                  {!isSearchingClient ? (
                    <button 
                      onClick={() => setIsSearchingClient(true)}
                      className={`w-full font-black py-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-sm uppercase tracking-wider cursor-pointer ${
                        isFull 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      }`}
                    >
                      <span>{isFull ? '🪑' : '👤+'}</span> 
                      {isFull ? 'ZAPISZ NA KRZESEŁKO' : 'ZAPISZ KOLEJNEGO KLIENTA'}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-sky-950 uppercase">
                          {isFull ? 'Wyszukaj klubowicza na krzesełko:' : 'Wyszukaj klubowicza z bazy:'}
                        </span>
                        <button onClick={() => setIsSearchingClient(false)} className="text-slate-400 hover:text-slate-700 text-xs font-bold">Anuluj</button>
                      </div>
                      <input 
                        type="text"
                        autoFocus
                        placeholder="Wpisz imię, nazwisko lub email..."
                        value={searchClientQuery}
                        onChange={(e) => setSearchClientQuery(e.target.value)}
                        className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                      />

                      {searchClientQuery.trim().length > 0 && (
                        <div className="bg-white border border-sky-200 rounded-xl max-h-48 overflow-y-auto shadow-md divide-y divide-sky-50">
                          {filteredSuggestions.length > 0 ? (
                            filteredSuggestions.map((klient) => (
                              <div 
                                key={klient.id}
                                onClick={() => handleZapiszKlientaDoZajec(klient)}
                                className="px-3.5 py-2.5 hover:bg-sky-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                              >
                                <div>
                                  <span className="font-bold text-slate-900">{klient.firstName} {klient.lastName}</span>
                                  <span className="text-slate-400 ml-2">({klient.email || 'brak emaila'})</span>
                                  {klient.blokadaDo && (
                                    <span className="block text-rose-600 font-bold text-[10px]">⚠️ Blokada do {klient.blokadaDo}</span>
                                  )}
                                </div>
                                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${isFull ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                  {isFull ? '🪑 Krzesełko +' : 'Wybierz +'}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 text-center text-xs text-slate-400">
                              Brak wyników. Dodaj najpierw klienta w zakładce „Klienci”.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button 
                  onClick={() => setSelectedClass(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-6 py-2.5 rounded-xl text-xs transition-colors"
                >
                  Zamknij
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL POTWIERDZENIA WYPISANIA */}
      {clientToUnregister && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">⚠️ Wypisz uczestnika</h3>
              <button onClick={() => setClientToUnregister(null)} className="text-slate-400 font-bold">✕</button>
            </div>
            
            <div className="space-y-3 text-xs text-slate-700">
              <p>Czy na pewno chcesz wypisać użytkownika <strong>{clientToUnregister.firstName} {clientToUnregister.lastName}</strong> z zajęć?</p>
              
              <div className="bg-sky-50 p-3 rounded-xl border border-sky-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sky-950">
                  <input 
                    type="checkbox"
                    checked={blokadaZapisow}
                    onChange={(e) => setBlokadaZapisow(e.target.checked)}
                    className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                  />
                  <span>Nałóż blokadę zapisów za niestawienie się</span>
                </label>

                {blokadaZapisow && (
                  <div className="pl-6 pt-1 space-y-1">
                    <label className="text-slate-600 block">Długość blokady (w dniach):</label>
                    <input 
                      type="number" 
                      min="1"
                      value={dlugoscBlokady}
                      onChange={(e) => setDlugoscBlokady(e.target.value)}
                      className="w-20 bg-white border border-sky-300 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
              <button onClick={() => setClientToUnregister(null)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
              <button onClick={handlePotwierdzWypisanie} className="bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer">Potwierdź wypisanie</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: WYDARZENIE KILKUDNIOWE */}
      {isMultiDayModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">⛺ Dodaj wydarzenie kilkudniowe</h3>
              <button onClick={() => setIsMultiDayModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleSaveMultiDayEvent} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Nazwa wydarzenia *</label>
                <input 
                  type="text"
                  required
                  placeholder="np. OBÓZ W WAŁCZU"
                  value={multiDayTitle}
                  onChange={(e) => setMultiDayTitle(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Data od *</label>
                  <input 
                    type="date"
                    required
                    value={multiDayFrom}
                    onChange={(e) => setMultiDayFrom(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Data do *</label>
                  <input 
                    type="date"
                    required
                    value={multiDayTo}
                    onChange={(e) => setMultiDayTo(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-[11px]">
                ⚠️ W wybranym zakresie dat wszystkie zajęcia zostaną automatycznie oznaczone jako odwołane z powodu obozu/wydarzenia.
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsMultiDayModalOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer">Zapisz wydarzenie</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIA ZAJĘĆ Z CHMURY SUPABASE */}
      {historyModalClass && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🕒 Historia zajęć: {historyModalClass.title} ({historyModalClass.displayDate})</h3>
              <button onClick={() => setHistoryModalClass(null)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>

            <div className="overflow-x-auto text-xs max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sky-50 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200">
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Typ operacji</th>
                    <th className="py-2.5 px-3">Szczegóły logu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {modalHistoryData.map((hItem: any) => (
                    <tr key={hItem.id}>
                      <td className="py-3 px-3 font-mono">
                        {new Date(hItem.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 font-bold uppercase text-[10px] tracking-wider text-sky-800">
                        {hItem.typ_operacji.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700">
                        {hItem.opis}
                      </td>
                    </tr>
                  ))}
                  {modalHistoryData.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400">Brak zarejestrowanych zdarzeń w historii tych zajęć.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3 flex justify-end border-t border-sky-100">
              <button onClick={() => setHistoryModalClass(null)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer">Zamknij</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDYCJA ZAJĘĆ */}
      {editClassModalData && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">✏️ Edytuj zajęcia ({editClassModalData.displayDate})</h3>
              <button onClick={() => setEditClassModalData(null)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveClassEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Godzina rozpoczęcia</label>
                  <div className="flex gap-2">
                    <input type="text" maxLength={2} value={editStartHour} onChange={(e) => setEditStartHour(e.target.value)} className="w-14 bg-sky-50/50 border border-sky-200 rounded-xl px-2 py-2 text-center font-bold" />
                    <span className="self-center font-bold">:</span>
                    <input type="text" maxLength={2} value={editStartMin} onChange={(e) => setEditStartMin(e.target.value)} className="w-14 bg-sky-50/50 border border-sky-200 rounded-xl px-2 py-2 text-center font-bold" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Godzina zakończenia</label>
                  <div className="flex gap-2">
                    <input type="text" maxLength={2} value={editEndHour} onChange={(e) => setEditEndHour(e.target.value)} className="w-14 bg-sky-50/50 border border-sky-200 rounded-xl px-2 py-2 text-center font-bold" />
                    <span className="self-center font-bold">:</span>
                    <input type="text" maxLength={2} value={editEndMin} onChange={(e) => setEditEndMin(e.target.value)} className="w-14 bg-sky-50/50 border border-sky-200 rounded-xl px-2 py-2 text-center font-bold" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Trener</label>
                <select 
                  value={editTrainer} 
                  onChange={(e) => setEditTrainer(e.target.value)} 
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                >
                  <option value="">-- Wybierz trenera --</option>
                  {listaTrenerow.map((t: any) => (
                    <option key={t.id} value={t.imie_nazwisko}>{t.imie_nazwisko}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Limit miejsc</label>
                <input type="number" min="1" value={editLimit} onChange={(e) => setEditLimit(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setEditClassModalData(null)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer">Zapisz zmiany</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DUPLIKUJ ZAJĘCIA */}
      {duplicateModalData && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">📋 Duplikuj zajęcia</h3>
              <button onClick={() => setDuplicateModalData(null)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveDuplicateClass} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Wybierz datę docelową</label>
                <input type="date" value={dupDate} onChange={(e) => setDupDate(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Godzina startu</label>
                  <div className="flex gap-2">
                    <input type="text" maxLength={2} value={dupStartHour} onChange={(e) => setDupStartHour(e.target.value)} className="w-14 bg-sky-50/50 border border-sky-200 rounded-xl px-2 py-2 text-center font-bold" />
                    <span className="self-center font-bold">:</span>
                    <input type="text" maxLength={2} value={dupStartMin} onChange={(e) => setDupStartMin(e.target.value)} className="w-14 bg-sky-50/50 border border-sky-200 rounded-xl px-2 py-2 text-center font-bold" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Godzina końca</label>
                  <div className="flex gap-2">
                    <input type="text" maxLength={2} value={dupEndHour} onChange={(e) => setDupEndHour(e.target.value)} className="w-14 bg-sky-50/50 border border-sky-200 rounded-xl px-2 py-2 text-center font-bold" />
                    <span className="self-center font-bold">:</span>
                    <input type="text" maxLength={2} value={dupEndMin} onChange={(e) => setDupEndMin(e.target.value)} className="w-14 bg-sky-50/50 border border-sky-200 rounded-xl px-2 py-2 text-center font-bold" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Rodzaj zajęć</label>
                <select value={dupPlan} onChange={(e) => setDupPlan(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800">
                  <option value="">-- Wybierz plan --</option>
                  {rodzajeZajec.map((r: any) => (
                    <option key={r.id} value={r.nazwa}>{r.nazwa}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Trener</label>
                <select 
                  value={dupTrainer} 
                  onChange={(e) => setDupTrainer(e.target.value)} 
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                >
                  <option value="">-- Wybierz trenera --</option>
                  {listaTrenerow.map((t: any) => (
                    <option key={t.id} value={t.imie_nazwisko}>{t.imie_nazwisko}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Limit miejsc</label>
                <input type="number" min="1" value={dupLimit} onChange={(e) => setDupLimit(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setDuplicateModalData(null)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer">Zduplikuj zajęcia</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
