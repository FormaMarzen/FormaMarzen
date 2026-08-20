"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Bezpośrednia, bezpieczna inicjalizacja klienta Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function KarnetyPage() {
  const [karnety, setKarnety] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [dostepneRodzajeZajec, setDostepneRodzajeZajec] = useState<any[]>([]);
  
  // Stany dla strefy klubowicza (klient przeglądający swój karnet)
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [appRole, setAppRole] = useState<'admin' | 'trener' | 'klubowicz'>('klubowicz');
  const [isClientSuspendModalOpen, setIsClientSuspendModalOpen] = useState(false);
  const [clientSuspendDays, setClientSuspendDays] = useState('3');
  const [clientSuspendStartDate, setClientSuspendStartDate] = useState('');
  const [clientSuspendEndDate, setClientSuspendEndDate] = useState('');
  const [clientSuspendMode, setClientSuspendMode] = useState<'days' | 'dates'>('days');

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. POBIERANIE DANYCH Z SUPABASE (Karnety + Rodzaje Zajęć + Użytkownik)
  const loadData = async () => {
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

      const { data: klienciData } = await supabase.from('klienci').select('*');
      if (klienciData && userEmail) {
        const enriched = klienciData.map((c: any) => {
          let parsedKarnety = [];
          if (Array.isArray(c.karnetyKlubowicza)) {
            parsedKarnety = c.karnetyKlubowicza;
          } else if (typeof c.karnetyKlubowicza === 'string') {
            try { parsedKarnety = JSON.parse(c.karnetyKlubowicza); } catch(e) {}
          }
          return {
            ...c,
            id: c.id,
            firstName: c.Imię || '',
            lastName: c.Nazwisko || '',
            email: c['E-mail'] || c.email || '',
            karnetyKlubowicza: parsedKarnety,
            wallet: c.Portfel || c.portfel || c.wallet || '0.00 PLN'
          };
        });
        const myUser = enriched.find((c: any) => c.email === userEmail);
        if (myUser) setCurrentUser(myUser);
      }

      // A. Pobieranie karnetów (cennik)
      const { data: karnetyData, error: karnetyError } = await supabase
        .from('karnety')
        .select('*')
        .order('id', { ascending: false });

      if (karnetyError) {
        console.error("Błąd pobierania karnetów:", karnetyError);
      } else if (karnetyData) {
        const parsedData = karnetyData.map((item: any) => {
          let meta: Record<string, any> = {};
          try {
            meta = JSON.parse(item.inne_ustawienia || '{}');
          } catch (e) {
            console.log("Brak dodatkowych ustawień dla:", item.nazwa);
          }

          return {
            id: item.id,
            utworzony: item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            nazwa: item.nazwa,
            cena: item.cena_brutto ? item.cena_brutto.toString() : '0',
            typKarnetu: item.typ_karnetu,
            limitCzasowy: item.dlugosc,
            dostepDo: item.dostep_do_zajec,
            dostepnyOnline: item.sprzedaz_online,
            wUzyciu: item.wUzyciu || 0,
            ilosc_wejsc: item.ilosc_wejsc || meta.ilosc_wejsc || null,
            isContract12M: item.typ_karnetu === 'Umowa 12 miesięcy' || meta.isContract12M === true,
            ...meta 
          };
        });
        setKarnety(parsedData);
      }

      // B. Pobieranie rodzajów zajęć z bazy
      const { data: rodzajeData, error: rodzajeError } = await supabase
        .from('rodzaje_zajec')
        .select('*')
        .order('nazwa', { ascending: true });

      if (rodzajeError) {
        console.error("Błąd pobierania rodzajów zajęć:", rodzajeError);
      } else if (rodzajeData && rodzajeData.length > 0) {
        setDostepneRodzajeZajec(rodzajeData);
      } else {
        setDostepneRodzajeZajec([
          { id: 1, nazwa: 'Brak zajęć w bazie (Dodaj w zakładce Rodzaje zajęć)' }
        ]);
      }

    } catch (err) {
      console.error("Błąd sieci podczas pobierania:", err);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Stany formularza administratora
  const [nazwa, setNazwa] = useState('');
  const [cena, setCena] = useState('');
  const [stawkaVat, setStawkaVat] = useState('8%');
  const [typKarnetu, setTypKarnetu] = useState('Na czas');
  const [czasIlosc, setCzasIlosc] = useState('1');
  const [czasJednostka, setCzasJednostka] = useState('Miesiąc');
  const [iloscTreningow, setIloscTreningow] = useState('10');
  const [dodajLimitCzasowy, setDodajLimitCzasowy] = useState(true);
  const [limitIlosc, setLimitIlosc] = useState('1');
  const [limitOkres, setLimitOkres] = useState('Miesiąc');
  const [dostepDo, setDostepDo] = useState('wszystkich zajęć');
  const [zaznaczoneZajecia, setZaznaczoneZajecia] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [limitCzasowyZapisow, setLimitCzasowyZapisow] = useState('Domyślny (14 dni)');
  const [niestandardowyDni, setNiestandardowyDni] = useState('14');
  const [tygodniowyLimit, setTygodniowyLimit] = useState('Bez limitu');
  const [dziennyLimit, setDziennyLimit] = useState('Domyślny (Bez limitu)');
  const [niestandardowyDziennyIlosc, setNiestandardowyDziennyIlosc] = useState('1');
  const [blokujPortfel, setBlokujPortfel] = useState(false);
  const [portfelPrógKwota, setPortfelPrógKwota] = useState('0');
  const [dostepnyOnline, setDostepnyOnline] = useState(false);
  const [ponownyZakup, setPonownyZakup] = useState(true);
  const [zmianaNaInny, setZmianaNaInny] = useState(true);
  const [kupInnyKarnet, setKupInnyKarnet] = useState(true);
  const [opis, setOpis] = useState('');
  const [obrazekUrl, setObrazekUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenAdd = () => {
    setEditingId(null);
    setNazwa(''); setCena(''); setStawkaVat('8%'); setTypKarnetu('Na czas'); setCzasIlosc('1'); setCzasJednostka('Miesiąc'); setIloscTreningow('10'); setDodajLimitCzasowy(true); setLimitIlosc('1'); setLimitOkres('Miesiąc'); setDostepDo('wszystkich zajęć'); setZaznaczoneZajecia([]); setLimitCzasowyZapisow('Domyślny (14 dni)'); setNiestandardowyDni('14'); setTygodniowyLimit('Bez limitu'); setDziennyLimit('Domyślny (Bez limitu)'); setNiestandardowyDziennyIlosc('1'); setBlokujPortfel(false); setPortfelPrógKwota('0'); setDostepnyOnline(false); setPonownyZakup(true); setZmianaNaInny(true); setKupInnyKarnet(true); setOpis(''); setObrazekUrl(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setNazwa(item.nazwa || ''); setCena(item.cena || ''); setStawkaVat(item.stawkaVat || '8%'); setTypKarnetu(item.typKarnetu || 'Na czas'); setCzasIlosc(item.czasIlosc || '1'); setCzasJednostka(item.czasJednostka || 'Miesiąc'); setIloscTreningow(item.iloscTreningow || item.ilosc_wejsc || '10'); setDodajLimitCzasowy(item.dodajLimitCzasowy ?? true); setLimitIlosc(item.limitIlosc || '1'); setLimitOkres(item.limitOkres || 'Miesiąc'); setDostepDo(item.dostepDo || 'wszystkich zajęć'); setZaznaczoneZajecia(item.zaznaczoneZajecia || []); setLimitCzasowyZapisow(item.limitCzasowyZapisow || 'Domyślny (14 dni)'); setNiestandardowyDni(item.niestandardowyDni || '14'); setTygodniowyLimit(item.tygodniowyLimit || 'Bez limitu'); setDziennyLimit(item.dziennyLimit || 'Domyślny (Bez limitu)'); setNiestandardowyDziennyIlosc(item.niestandardowyDziennyIlosc || '1'); setBlokujPortfel(item.blokujPortfel ?? false); setPortfelPrógKwota(item.portfelPrógKwota || '0'); setDostepnyOnline(item.dostepnyOnline ?? false); setPonownyZakup(item.ponownyZakup ?? true); setZmianaNaInny(item.zmianaNaInny ?? true); setKupInnyKarnet(item.kupInnyKarnet ?? true); setOpis(item.opis || ''); setObrazekUrl(item.obrazekUrl || null);
    setIsModalOpen(true);
  };

  const handleToggleZajecie = (nazwaZajec: string) => {
    if (zaznaczoneZajecia.includes(nazwaZajec)) {
      setZaznaczoneZajecia(zaznaczoneZajecia.filter(z => z !== nazwaZajec));
    } else {
      setZaznaczoneZajecia([...zaznaczoneZajecia, nazwaZajec]);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 250; 
        const MAX_HEIGHT = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setObrazekUrl(compressedDataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Automatyczne wypisywanie z zajęć w trakcie trwania zawieszenia lub usunięcia karnetu
  const handleAutoWypiszPoZawieszeniu = async (klientId: number, zawieszonyOd: string, zawieszonyDo: string, nazwaKarnetu: string) => {
    const now = new Date();
    const todayBeginning = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let cancelledCount = 0;
    const { data: userSignups } = await supabase
      .from('zapisy_zajec')
      .select('*')
      .eq('klient_id', klientId);

    if (userSignups && userSignups.length > 0) {
      for (const signup of userSignups) {
        const parts = (signup.class_key || '').split('_');
        const dateStr = parts[1];
        if (dateStr) {
          const [d, m] = dateStr.split('/').map(Number);
          const classDate = new Date(now.getFullYear(), m - 1, d, 23, 59, 59);
          const classDateForCheck = new Date(now.getFullYear(), m - 1, d);
          const classDateStr = `${classDateForCheck.getFullYear()}-${String(classDateForCheck.getMonth() + 1).padStart(2, '0')}-${String(classDateForCheck.getDate()).padStart(2, '0')}`;
          
          const isAfterStart = classDateStr >= zawieszonyOd;
          const isBeforeEnd = !zawieszonyDo || classDateStr <= zawieszonyDo;

          if (isAfterStart && isBeforeEnd && classDate >= todayBeginning) {
            await supabase
              .from('zapisy_zajec')
              .delete()
              .eq('class_key', signup.class_key)
              .eq('klient_id', klientId);
            cancelledCount++;
          }
        }
      }
    }

    // Aktualizacja w tabeli klienci (karnety, zapisyNadchodzace, zapisyWypisy)
    const { data: klientData } = await supabase.from('klienci').select('*').eq('id', klientId).single();
    if (klientData) {
      let updatedKarnety = klientData.karnetyKlubowicza;
      if (typeof updatedKarnety === 'string') {
        try { updatedKarnety = JSON.parse(updatedKarnety); } catch(e) { updatedKarnety = []; }
      }
      if (!Array.isArray(updatedKarnety)) updatedKarnety = [];

      let updatedNadchodzace = klientData.zapisyNadchodzace;
      if (typeof updatedNadchodzace === 'string') {
        try { updatedNadchodzace = JSON.parse(updatedNadchodzace); } catch(e) { updatedNadchodzace = []; }
      }
      if (Array.isArray(updatedNadchodzace)) {
        updatedNadchodzace = updatedNadchodzace.filter((z: any) => {
          if (!z.data) return true;
          const isAfterStart = z.data >= zawieszonyOd;
          const isBeforeEnd = !zawieszonyDo || z.data <= zawieszonyDo;
          return !(isAfterStart && isBeforeEnd);
        });
      }

      if (cancelledCount > 0) {
        const passIndex = updatedKarnety.findIndex((k: any) => k.nazwa === nazwaKarnetu && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
        if (passIndex !== -1) {
          const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10) || 0;
          const poczatkowe = parseInt(updatedKarnety[passIndex].poczatkoweWejsc || currentRemaining + cancelledCount, 10);
          updatedKarnety[passIndex] = {
            ...updatedKarnety[passIndex],
            pozostaloWejsc: Math.min(poczatkowe, currentRemaining + cancelledCount)
          };
        }
      }

      await supabase.from('klienci').update({ 
        karnetyKlubowicza: updatedKarnety,
        zapisyNadchodzace: updatedNadchodzace 
      }).eq('id', klientId);
    }

    if (cancelledCount > 0) {
      await supabase.from('transakcje').insert([{
        klient_id: klientId,
        typ_operacji: 'zajecia_wypis',
        opis: `Automatycznie wypisano z ${cancelledCount} przyszłych zajęć z powodu zawieszenia/aktualizacji karnetu. Zwrócono ${cancelledCount} wejść.`
      }]);
    }
  };

  // Obsługa samodzielnego zawieszania karnetu przez klubowicza
  const handleClientSuspendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.karnetyKlubowicza || currentUser.karnetyKlubowicza.length === 0) return;
    
    let sOd = clientSuspendStartDate || todayStr;
    let sDo = clientSuspendEndDate;
    if (clientSuspendMode === 'days') {
      sOd = todayStr;
      const dni = parseInt(clientSuspendDays || '0', 10);
      if (dni <= 0) { alert("Liczba dni musi być większa od zera!"); return; }
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + dni);
      sDo = endDate.toISOString().split('T')[0];
    }
    
    if (sOd < todayStr) {
      alert("Data rozpoczęcia zawieszenia nie może być w przeszłości!");
      return;
    }
    if (sDo < sOd) {
      alert("Planowana data zakończenia zawieszenia musi być późniejsza lub równa dacie początkowej!");
      return;
    }

    if (!confirm(`Czy na pewno chcesz zawiesić swój karnet od ${sOd} do ${sDo}?`)) return;

    const updatedKarnety = currentUser.karnetyKlubowicza.map((k: any, idx: number) => {
      if (idx === 0) {
        return { ...k, zawieszonyOd: sOd, zawieszonyDo: sDo };
      }
      return k;
    });

    const { error } = await supabase.from('klienci').update({ karnetyKlubowicza: updatedKarnety }).eq('id', currentUser.id);
    if (error) {
      alert("Błąd podczas zawieszania karnetu: " + error.message);
      return;
    }

    await handleAutoWypiszPoZawieszeniu(currentUser.id, sOd, sDo, currentUser.karnetyKlubowicza[0].nazwa);

    alert("Twój karnet został pomyślnie zawieszony! System automatycznie wypisał Cię z zajęć w wybranym okresie.");
    setIsClientSuspendModalOpen(false);
    loadData();
  };

  const handleClientOdwiesKarnet = async (karnetTarget: any) => {
    if (!currentUser || !karnetTarget.zawieszonyOd) return;
    const dzisiaj = new Date();
    const start = new Date(karnetTarget.zawieszonyOd);
    dzisiaj.setHours(0, 0, 0, 0); start.setHours(0, 0, 0, 0);
    let diffDays = Math.floor((dzisiaj.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) diffDays = 0;
    
    if (!confirm(`Karnet był zawieszony od ${karnetTarget.zawieszonyOd} (łącznie ${diffDays} dni). \nCzy chcesz go teraz odwiesić i przedłużyć jego ważność o ${diffDays} dni?`)) return;
    
    let currentExpDate = new Date(karnetTarget.waznyDo);
    currentExpDate.setDate(currentExpDate.getDate() + diffDays);
    const newExpDateStr = currentExpDate.toISOString().split('T')[0];
    const historiaEntry = { id: Date.now(), od: karnetTarget.zawieszonyOd, do: todayStr, dni: diffDays };

    const updatedKarnety = currentUser.karnetyKlubowicza.map((k: any) => {
      if (k.id === karnetTarget.id) {
        return { 
          ...k, 
          waznyDo: newExpDateStr, 
          statusTekst: `Ważny do: ${newExpDateStr}`, 
          zawieszonyOd: null, 
          zawieszonyDo: null, 
          historiaZawieszen: [historiaEntry, ...(k.historiaZawieszen || [])] 
        };
      }
      return k;
    });

    const { error } = await supabase.from('klienci').update({ karnetyKlubowicza: updatedKarnety }).eq('id', currentUser.id);
    if (error) {
      alert("Błąd podczas odwieszania: " + error.message);
      return;
    }

    alert(`Karnet został odwieszony! Ważność przedłużona o ${diffDays} dni.`);
    loadData();
  };

  // 2. ZAPISYWANIE DANYCH DO SUPABASE (Admin) z automatyczną synchronizacją zasad nadrzędnych
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nazwa.trim() || !cena.trim()) return;

    let wyliczonaDlugosc = '';
    let dodanaIloscWejsc = null;
    const isContract = typKarnetu === 'Umowa 12 miesięcy';

    if (isContract) {
      wyliczonaDlugosc = 'Umowa 12 miesięcy (Cykliczna)';
    } else if (typKarnetu === 'Na czas') {
      wyliczonaDlugosc = `${czasIlosc} ${czasJednostka.toLowerCase()}${parseInt(czasIlosc) > 1 && czasJednostka === 'Miesiąc' ? 'e' : ''}`;
    } else {
      dodanaIloscWejsc = parseInt(iloscTreningow, 10) || 10;
      if (dodajLimitCzasowy) {
        wyliczonaDlugosc = `${iloscTreningow} wejść / ${limitIlosc} ${limitOkres.toLowerCase()}${parseInt(limitIlosc) > 1 && limitOkres === 'Miesiąc' ? 'e' : ''}`;
      } else {
        wyliczonaDlugosc = `${iloscTreningow} wejść (bez limitu czasu)`;
      }
    }

    const metaDane = {
      stawkaVat,
      czasIlosc,
      czasJednostka,
      iloscTreningow,
      ilosc_wejsc: dodanaIloscWejsc,
      dodajLimitCzasowy,
      limitIlosc,
      limitOkres,
      zaznaczoneZajecia,
      limitCzasowyZapisow,
      niestandardowyDni,
      tygodniowyLimit,
      dziennyLimit,
      niestandardowyDziennyIlosc,
      blokujPortfel,
      portfelPrógKwota,
      ponownyZakup,
      zmianaNaInny,
      kupInnyKarnet,
      opis,
      obrazekUrl, 
      isContract12M: isContract,
      wUzyciu: 0
    };

    const supabasePayload = {
      nazwa: nazwa,
      cena_brutto: parseFloat(cena) || 0,
      typ_karnetu: typKarnetu,
      dlugosc: wyliczonaDlugosc,
      dostep_do_zajec: dostepDo,
      sprzedaz_online: dostepnyOnline,
      ilosc_wejsc: dodanaIloscWejsc,
      inne_ustawienia: JSON.stringify(metaDane)
    };

    try {
      if (editingId !== null) {
        const { error } = await supabase.from('karnety').update(supabasePayload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('karnety').insert([supabasePayload]);
        if (error) throw error;

        // Synchronizacja z nadrzędnymi zasadami zapisu (utworzenie domyślnych wpisów dla nowego karnetu)
        const { data: rulesData } = await supabase
          .from('club_booking_rules')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rulesData) {
          const currentWindowMap = rulesData.booking_window_per_pass || {};
          const currentGraceMap = rulesData.expired_pass_grace_per_pass || {};

          await supabase.from('club_booking_rules').update({
            booking_window_per_pass: {
              ...currentWindowMap,
              [nazwa]: rulesData.booking_window_days ?? 14
            },
            expired_pass_grace_per_pass: {
              ...currentGraceMap,
              [nazwa]: rulesData.expired_pass_grace_days ?? 15
            }
          }).eq('id', rulesData.id);
        }
      }

      loadData(); 
      setIsModalOpen(false);
      
    } catch (error: any) {
      console.error("Szczegóły błędu bazy danych:", error);
      alert(`Błąd zapisu: ${error.message || ''}`);
    }
  };

  // 3. USUWANIE DANYCH Z SUPABASE (Admin)
  const handleDelete = async (id: number) => {
    if (confirm("Czy na pewno chcesz usunąć ten karnet z cennika?")) {
      try {
        const { error } = await supabase.from('karnety').delete().eq('id', id);
        if (error) throw error;
        loadData();
      } catch (error: any) {
        console.error("Błąd podczas usuwania:", error);
        alert(`Nie udało się usunąć: ${error.message || JSON.stringify(error)}`);
      }
    }
  };

  if (!isMounted) {
    return <div className="p-8 text-center text-slate-500 font-bold">Ładowanie karnetów z chmury...</div>;
  }

  // JEŚLI UŻYTKOWNIK TO KLUBOWICZ - WYŚWIETLAMY JEGO PANEL KARNETU
  if (appRole === 'klubowicz' && currentUser) {
    const aktywnyKarnet = currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza.length > 0 ? currentUser.karnetyKlubowicza[0] : null;
    const czyZawieszony = aktywnyKarnet && !!aktywnyKarnet.zawieszonyOd;
    const czyZablokowany = aktywnyKarnet && aktywnyKarnet.blokadaDo && aktywnyKarnet.blokadaDo >= todayStr;

    return (
      <div className="max-w-[1700px] mx-auto space-y-6 pb-24 animate-in fade-in font-sans antialiased text-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-sky-200 p-5 rounded-2xl shadow-sm">
          <h1 className="text-lg font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
            TWOJE KARNETY
          </h1>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
          {aktywnyKarnet ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase">{aktywnyKarnet.nazwa}</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {aktywnyKarnet.pozostaloWejsc !== null && aktywnyKarnet.pozostaloWejsc !== undefined && (
                      <span className="bg-sky-100 text-sky-900 px-3 py-1 rounded-full text-xs font-black border border-sky-200">
                        🎟️ Wejścia: {aktywnyKarnet.pozostaloWejsc} / {aktywnyKarnet.poczatkoweWejsc || aktywnyKarnet.pozostaloWejsc}
                      </span>
                    )}
                    <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">
                      Ważny do: {aktywnyKarnet.waznyDo}
                    </span>
                    {czyZawieszony && (
                      <span className="bg-amber-100 text-amber-900 px-3 py-1 rounded-full text-xs font-black border border-amber-200">
                        ⏸️ ZAWIESZONE: OD {aktywnyKarnet.zawieszonyOd} {aktywnyKarnet.zawieszonyDo ? `DO ${aktywnyKarnet.zawieszonyDo}` : ''}
                      </span>
                    )}
                    {czyZablokowany && (
                      <span className="bg-rose-100 text-rose-800 px-3 py-1 rounded-full text-xs font-black border border-rose-200">
                        ⚠️ ZABLOKOWANE: OD {aktywnyKarnet.blokadaOd || ''} DO {aktywnyKarnet.blokadaDo}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {czyZawieszony ? (
                    <button 
                      onClick={() => handleClientOdwiesKarnet(aktywnyKarnet)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-sm transition-colors"
                    >
                      ▶️ Odwieś karnet
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        setClientSuspendStartDate(todayStr);
                        setClientSuspendEndDate(todayStr);
                        setClientSuspendDays('3');
                        setClientSuspendMode('days');
                        setIsClientSuspendModalOpen(true);
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-sm transition-colors"
                    >
                      ❄️ Zawieś karnet
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400 font-medium text-xs">
              Brak aktywnego karnetu na koncie.
            </div>
          )}
        </div>

        {/* Sekcja zarządzania zawieszeniami w strefie klienta */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider">Zarządzanie zawieszeniami</h3>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Chcesz zamrozić swój karnet?</h4>
              <p className="text-xs text-slate-500 mt-0.5">Niewykorzystane dni zostaną automatycznie doliczone do daty wygaśnięcia po Twoim powrocie (odwieszeniu).</p>
            </div>
            <button 
              onClick={() => {
                if (!aktywnyKarnet) {
                  alert("Nie posiadasz aktywnego karnetu.");
                  return;
                }
                setClientSuspendStartDate(todayStr);
                setClientSuspendEndDate(todayStr);
                setClientSuspendDays('3');
                setClientSuspendMode('days');
                setIsClientSuspendModalOpen(true);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white font-black px-5 py-3 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer shrink-0"
            >
              ❄️ Zawieś karnet
            </button>
          </div>
        </div>

        {/* Modal zawieszania */}
        {isClientSuspendModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
              <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">❄️ Zawieś swój karnet</h3>
                <button onClick={() => setIsClientSuspendModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
              </div>
              <form onSubmit={handleClientSuspendSubmit} className="space-y-4 text-xs">
                <div className="flex bg-slate-100 rounded-xl p-1 font-bold">
                  <button type="button" onClick={() => setClientSuspendMode('days')} className={`flex-1 py-2 rounded-lg cursor-pointer transition-colors ${clientSuspendMode === 'days' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>Liczba dni</button>
                  <button type="button" onClick={() => setClientSuspendMode('dates')} className={`flex-1 py-2 rounded-lg cursor-pointer transition-colors ${clientSuspendMode === 'dates' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>Zakres dat</button>
                </div>
                {clientSuspendMode === 'days' ? (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Liczba dni zawieszenia</label>
                    <input type="number" min="1" required value={clientSuspendDays} onChange={(e) => setClientSuspendDays(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Zawieszony od</label>
                      <input type="date" required value={clientSuspendStartDate} onChange={(e) => setClientSuspendStartDate(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold cursor-pointer" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">Zawieszony do</label>
                      <input type="date" required value={clientSuspendEndDate} onChange={(e) => setClientSuspendEndDate(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold cursor-pointer" />
                    </div>
                  </>
                )}
                <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                  <button type="button" onClick={() => setIsClientSuspendModalOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
                  <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer uppercase tracking-wider">Potwierdź zawieszenie</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // PANEL ADMINISTRATORA / TRENERA (Zarządzanie cennikiem karnetów)
  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 font-sans antialiased text-slate-800">
      
      {/* GÓRNY PASEK AKCJI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-sky-200 p-5 rounded-2xl shadow-sm">
        <h1 className="text-lg font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
          KARNETY
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleOpenAdd}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span>+ DODAJ NOWY KARNET</span>
          </button>
          <button className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer">
            ❓ POMOC
          </button>
        </div>
      </div>

      {/* TABELA KARNETÓW */}
      <div className="bg-white border border-sky-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sky-50/70 border-b border-sky-200 text-[11px] font-bold text-sky-900 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-14"></th>
                <th className="py-3.5 px-4">Nazwa</th>
                <th className="py-3.5 px-4">Cena brutto</th>
                <th className="py-3.5 px-4">Typ karnetu</th>
                <th className="py-3.5 px-4">Długość</th>
                <th className="py-3.5 px-4">Dostęp do zajęć</th>
                <th className="py-3.5 px-4">Inne ustawienia</th>
                <th className="py-3.5 px-4">Sprzedaż online</th>
                <th className="py-3.5 px-4 text-center">W użyciu</th>
                <th className="py-3.5 px-4 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100 text-xs">
              {karnety.map((item) => (
                <tr key={item.id} className="hover:bg-sky-50/40 transition-colors">
                  <td className="py-4 px-4 text-center">
                    {item.obrazekUrl ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-sky-200 shadow-sm mx-auto">
                        <img src={item.obrazekUrl} alt={item.nazwa} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 flex items-center justify-center text-lg mx-auto">
                        🎟️
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-bold text-slate-900 text-sm">
                      {item.nazwa}
                      {item.isContract12M && (
                        <span className="ml-2 bg-amber-100 text-amber-900 text-[9px] px-2 py-0.5 rounded font-black uppercase inline-block">Umowa 12M</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">Utworzony: {item.utworzony}</div>
                  </td>
                  <td className="py-4 px-4 font-bold text-slate-800">
                    {Number(item.cena).toFixed(2)} PLN
                    <div className="text-[10px] font-normal text-slate-500">VAT: {item.stawkaVat} (B)</div>
                  </td>
                  <td className="py-4 px-4 font-medium text-sky-900">
                    {item.typKarnetu}
                  </td>
                  <td className="py-4 px-4 font-medium text-slate-700">
                    {item.limitCzasowy}
                  </td>
                  <td className="py-4 px-4 text-slate-600 text-[11px]">
                    <div>• Dostęp do zajęć: <strong className="text-slate-900">{item.dostepDo}</strong></div>
                    {item.dostepDo === 'określonych zajęć' && item.zaznaczoneZajecia?.length > 0 && (
                      <div className="text-[10px] text-sky-800 mt-0.5">({item.zaznaczoneZajecia.join(', ')})</div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-slate-600 text-[11px] space-y-0.5">
                    <div>• Dzienny limit: {item.dziennyLimit === 'Niestandardowy' ? `${item.niestandardowyDziennyIlosc} dziennie` : item.dziennyLimit}</div>
                    {item.blokujPortfel && (
                      <div className="text-rose-700 font-bold">• Blokada portfela: &lt; {item.portfelPrógKwota} PLN</div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">• Rejestracja online:</span> 
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.dostepnyOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {item.dostepnyOnline ? 'Tak' : 'Nie'}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center font-bold text-slate-900">{item.wUzyciu || 0}</td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => handleOpenEdit(item)}
                        className="w-7 h-7 bg-amber-800 hover:bg-amber-900 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm cursor-pointer" 
                        title="Edytuj"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="w-7 h-7 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center border border-rose-200 transition-colors cursor-pointer" 
                        title="Usuń"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {karnety.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400 font-medium">
                    Brak zdefiniowanych karnetów. Kliknij „+ DODAJ NOWY KARNET”, aby dodać swój pierwszy karnet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DODAWANIA / EDYCJI KARNETU */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-sky-200 rounded-3xl max-w-3xl w-full p-8 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            
            {/* Nagłówek modalu */}
            <div className="flex items-center justify-between border-b border-sky-100 pb-4 sticky top-0 bg-white z-10">
              <h3 className="font-black text-sm text-sky-950 uppercase">
                {editingId !== null ? 'Edytuj karnet' : 'Dodaj nowy karnet'}
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleSave}
                  className="bg-amber-800 hover:bg-amber-900 text-white font-black px-6 py-2 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  ZAPISZ
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-base">✕</button>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6 text-xs">
              
              {/* PODSTAWOWE INFORMACJE */}
              <div className="space-y-4">
                <h4 className="font-extrabold text-sky-900 uppercase tracking-wider text-[11px] border-b border-sky-100 pb-1">
                  Podstawowe informacje
                </h4>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Nazwa *</label>
                  <input 
                    type="text"
                    required
                    placeholder="np. OPEN, 10 wejść"
                    value={nazwa}
                    onChange={(e) => setNazwa(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500 font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="font-bold text-slate-800 block">Cena brutto *</label>
                    <div className="flex">
                      <span className="bg-slate-100 border border-r-0 border-sky-200 rounded-l-xl px-3 py-2 text-slate-600 font-bold flex items-center">PLN</span>
                      <input 
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={cena}
                        onChange={(e) => setCena(e.target.value)}
                        className="w-full bg-sky-50/50 border border-sky-200 rounded-r-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-sky-500 font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">Stawka VAT</label>
                    <input 
                      type="text"
                      placeholder="np. 8%, 23%, ZW"
                      value={stawkaVat}
                      onChange={(e) => setStawkaVat(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Typ karnetu *</label>
                  <select 
                    value={typKarnetu}
                    onChange={(e) => setTypKarnetu(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500 font-bold cursor-pointer"
                  >
                    <option value="Na czas">Na czas</option>
                    <option value="Na ilość treningów">Na ilość treningów</option>
                    <option value="Umowa 12 miesięcy">Umowa 12 miesięcy</option>
                  </select>
                </div>

                {typKarnetu === 'Umowa 12 miesięcy' ? (
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-amber-900 space-y-2">
                    <p className="font-bold text-sm">Karnet na umowę cykliczną (12 miesięcy)</p>
                    <p className="text-[11px] leading-relaxed font-medium">
                      Wybór tej opcji oznacza, że karnet podlega pod zasady rozliczeń ratalnych z uwzględnieniem wyrównania za bieżący miesiąc (pro-rata). 
                      Klubowicz z tym karnetem otrzyma do dyspozycji dedykowaną, roczną pulę 30 dni na zawieszenie. System przy zakupie wyliczy stawkę automatycznie.
                    </p>
                  </div>
                ) : typKarnetu === 'Na czas' ? (
                  <div className="grid grid-cols-2 gap-3 bg-sky-50/60 p-4 rounded-2xl border border-sky-200">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-800 block">Ilość *</label>
                      <input 
                        type="number" 
                        min="1"
                        value={czasIlosc}
                        onChange={(e) => setCzasIlosc(e.target.value)}
                        className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-800 block">Okres *</label>
                      <select 
                        value={czasJednostka}
                        onChange={(e) => setCzasJednostka(e.target.value)}
                        className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold cursor-pointer"
                      >
                        <option value="Dzień">Dzień</option>
                        <option value="Miesiąc">Miesiąc</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="bg-sky-50/60 p-4 rounded-2xl border border-sky-200 space-y-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-800 block">Ilość treningów *</label>
                      <input 
                        type="number" 
                        min="1"
                        placeholder="np. 10"
                        value={iloscTreningow}
                        onChange={(e) => setIloscTreningow(e.target.value)}
                        className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 font-bold"
                      />
                    </div>

                    <div className="space-y-3 pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={dodajLimitCzasowy}
                          onChange={(e) => setDodajLimitCzasowy(e.target.checked)}
                          className="w-4 h-4 accent-amber-700 rounded cursor-pointer"
                        />
                        <span className="font-bold text-slate-900">Dodaj limit czasowy</span>
                      </label>

                      {dodajLimitCzasowy && (
                        <div className="grid grid-cols-2 gap-3 pl-6 pt-1">
                          <div className="space-y-1">
                            <label className="font-bold text-slate-700 block">Ilość *</label>
                            <input 
                              type="number" 
                              min="1"
                              value={limitIlosc}
                              onChange={(e) => setLimitIlosc(e.target.value)}
                              className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="font-bold text-slate-700 block">Okres *</label>
                            <select 
                              value={limitOkres}
                              onChange={(e) => setLimitOkres(e.target.value)}
                              className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold cursor-pointer"
                            >
                              <option value="Dzień">Dzień</option>
                              <option value="Miesiąc">Miesiąc</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* OGRANICZENIA KARNETU */}
              <div className="space-y-4 pt-2">
                <h4 className="font-extrabold text-sky-900 uppercase tracking-wider text-[11px] border-b border-sky-100 pb-1">
                  Ograniczenia karnetu
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 relative">
                    <label className="font-bold text-slate-800 block">Dostęp do:</label>
                    <select 
                      value={dostepDo}
                      onChange={(e) => {
                        setDostepDo(e.target.value);
                        if (e.target.value === 'określonych zajęć') {
                          setIsDropdownOpen(true);
                        } else {
                          setIsDropdownOpen(false);
                          setZaznaczoneZajecia([]);
                        }
                      }}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 font-bold cursor-pointer"
                    >
                      <option value="wszystkich zajęć">wszystkich zajęć</option>
                      <option value="określonych zajęć">określonych zajęć</option>
                    </select>

                    {dostepDo === 'określonych zajęć' && (
                      <div className="mt-2 bg-white border border-sky-300 rounded-2xl p-3 shadow-lg space-y-2 max-h-52 overflow-y-auto">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-sky-100">
                          Zaznacz dostępne zajęcia:
                        </div>
                        {dostepneRodzajeZajec.map((zaj) => (
                          <label key={zaj.id || zaj.nazwa} className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-sky-50 rounded-xl cursor-pointer transition-colors">
                            <input 
                              type="checkbox"
                              checked={zaznaczoneZajecia.includes(zaj.nazwa)}
                              onChange={() => handleToggleZajecie(zaj.nazwa)}
                              className="w-4 h-4 accent-amber-700 rounded cursor-pointer"
                            />
                            <span className="font-semibold text-slate-800 text-xs">{zaj.nazwa}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">Limit czasowy zapisów:</label>
                    <select 
                      value={limitCzasowyZapisow}
                      onChange={(e) => setLimitCzasowyZapisow(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 font-bold cursor-pointer"
                    >
                      <option value="Domyślny (14 dni)">Domyślny (14 dni)</option>
                      <option value="Niestandardowy">Niestandardowy</option>
                    </select>

                    {limitCzasowyZapisow === 'Niestandardowy' && (
                      <div className="mt-3 bg-sky-50/60 p-3.5 rounded-2xl border border-sky-200 space-y-2">
                        <div className="text-[11px] text-slate-600 font-medium">
                          Ile dni przed rozpoczęciem zajęć, klubowicz może się na nie zapisać
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block text-[10px] uppercase">Liczba dni *</label>
                          <input 
                            type="number"
                            min="0"
                            value={niestandardowyDni}
                            onChange={(e) => setNiestandardowyDni(e.target.value)}
                            className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">Tygodniowy limit zapisów:</label>
                    <select 
                      value={tygodniowyLimit}
                      onChange={(e) => setTygodniowyLimit(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 cursor-pointer font-medium"
                    >
                      <option value="Bez limitu">Bez limitu</option>
                      <option value="1 raz w tygodniu">1 raz w tygodniu</option>
                      <option value="2 razy w tygodniu">2 razy w tygodniu</option>
                      <option value="3 razy w tygodniu">3 razy w tygodniu</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">Dzienny limit zapisów:</label>
                    <select 
                      value={dziennyLimit}
                      onChange={(e) => setDziennyLimit(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 font-bold cursor-pointer"
                    >
                      <option value="Domyślny (Bez limitu)">Domyślny (Bez limitu)</option>
                      <option value="Niestandardowy">Niestandardowy</option>
                    </select>

                    {dziennyLimit === 'Niestandardowy' && (
                      <div className="mt-3 bg-sky-50/60 p-3.5 rounded-2xl border border-sky-200 space-y-2">
                        <div className="text-[11px] text-slate-600 font-medium">
                          Na ile zajęć, klubowicz może się zapisać dziennie
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block text-[10px] uppercase">Numer *</label>
                          <input 
                            type="number"
                            min="1"
                            value={niestandardowyDziennyIlosc}
                            onChange={(e) => setNiestandardowyDziennyIlosc(e.target.value)}
                            className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* BLOKADA ZAPISÓW W ZALEŻNOŚCI OD STANU PORTFELA */}
                <div className="bg-sky-50/60 p-4 rounded-2xl border border-sky-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Blokuj zapisy w zależności od stanu portfela</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={blokujPortfel}
                        onChange={(e) => setBlokujPortfel(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  {blokujPortfel && (
                    <div className="space-y-1 pt-1">
                      <label className="font-bold text-slate-700 block text-[10px] uppercase">Blokuj zapisy gdy stan portfela jest mniejszy niż *</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={portfelPrógKwota}
                        onChange={(e) => setPortfelPrógKwota(e.target.value)}
                        className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* SPRZEDAŻ ONLINE */}
              <div className="space-y-4 pt-2">
                <h4 className="font-extrabold text-sky-900 uppercase tracking-wider text-[11px] border-b border-sky-100 pb-1">
                  Sprzedaż online
                </h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-1">
                    <span className="font-medium text-slate-800">Karnet dostępny do sprzedaży przy rejestracji online:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={dostepnyOnline}
                        onChange={(e) => setDostepnyOnline(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="font-medium text-slate-800">Klubowicz z tym karnetem, może kupić ten karnet ponownie:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={ponownyZakup}
                        onChange={(e) => setPonownyZakup(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="font-medium text-slate-800">Klubowicz z tym karnetem, może zmienić ten karnet na inny:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={zmianaNaInny}
                        onChange={(e) => setZmianaNaInny(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="font-medium text-slate-800">Klubowicz z innym karnetem, może kupić ten karnet:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={kupInnyKarnet}
                        onChange={(e) => setKupInnyKarnet(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* WYGLĄD I OPIS */}
              <div className="space-y-4 pt-2">
                <h4 className="font-extrabold text-sky-900 uppercase tracking-wider text-[11px] border-b border-sky-100 pb-1">
                  Wygląd i opis karnetu
                </h4>

                <div className="space-y-2">
                  <label className="font-bold text-slate-800 block">Obrazek</label>
                  <div className="flex items-center gap-4">
                    {obrazekUrl && (
                      <div className="w-16 h-16 rounded-xl border border-sky-200 overflow-hidden shrink-0 shadow-sm bg-white">
                        <img src={obrazekUrl} alt="Podgląd" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex flex-col items-start gap-1">
                      <input 
                        type="file" 
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-sky-50 hover:bg-sky-100 border border-sky-200 px-4 py-2 rounded-xl text-xs font-bold text-sky-900 transition-colors cursor-pointer"
                      >
                        🖼️ Wybierz obrazek
                      </button>
                      {obrazekUrl && (
                        <button 
                          type="button" 
                          onClick={() => setObrazekUrl(null)}
                          className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer ml-1"
                        >
                          Usuń obrazek
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Opis</label>
                  <textarea 
                    rows={3}
                    placeholder="Opis karnetu..."
                    value={opis}
                    onChange={(e) => setOpis(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
                  />
                </div>
              </div>

              {/* Przyciski dolne */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-sky-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button 
                  type="submit"
                  className="bg-amber-800 hover:bg-amber-900 text-white font-black px-6 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  {editingId !== null ? 'ZAKTUALIZUJ' : 'ZAPISZ'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
