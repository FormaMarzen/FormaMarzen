"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from './raporty/klienci/supabase'; 

export default function DashboardPage() {
  const [salesPeriod, setSalesPeriod] = useState('Dziś');
  const [clientSearch, setClientSearch] = useState('');
  const [klienciList, setKlienciList] = useState<any[]>([]);
  
  // Stany dla Grafiku
  const [zapisaneZajecia, setZapisaneZajecia] = useState<any[]>([]); // Szablony
  const [jednorazoweZajecia, setJednorazoweZajecia] = useState<any[]>([]);
  const [nadpisaneZajeciaDni, setNadpisaneZajeciaDni] = useState<{ [key: string]: any }>({});
  const [wydarzeniaKilkudniowe, setWydarzeniaKilkudniowe] = useState<any[]>([]);
  const [zapisyNaZajecia, setZapisyNaZajecia] = useState<{ [key: string]: any[] }>({});
  const [rodzajeZajec, setRodzajeZajec] = useState<any[]>([]);
  
  // Stany dla Transakcji
  const [wszystkieTransakcje, setWszystkieTransakcje] = useState<any[]>([]);

  const [appRole, setAppRole] = useState<'admin' | 'klubowicz'>('admin');
  const [dostepneKarnety, setDostepneKarnety] = useState<any[]>([]);

  // Pełne stany zarządzania klubowiczem i modali profilu
  const [tableActionClient, setTableActionClient] = useState<any | null>(null);
  const [profileClient, setProfileClient] = useState<any | null>(null);
  
  const [isExtendPassModalOpen, setIsExtendPassModalOpen] = useState(false);
  const [extendPassTarget, setExtendPassTarget] = useState<any | null>(null);
  const [extendSelectedNewPassName, setExtendSelectedNewPassName] = useState('');
  const [extendNewDate, setExtendNewDate] = useState('');

  const [isEditProfileInfoOpen, setIsEditProfileInfoOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isWalletHistoryOpen, setIsWalletHistoryOpen] = useState(false);
  const [isTopUpWalletOpen, setIsTopUpWalletOpen] = useState(false);
  const [walletAmountInput, setWalletAmountInput] = useState('');
  const [walletReasonInput, setWalletReasonInput] = useState('');

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockDaysInput, setBlockDaysInput] = useState('3');
  const [blockDateInput, setBlockDateInput] = useState('');

  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendPassTarget, setSuspendPassTarget] = useState<any | null>(null);
  const [suspendStartDate, setSuspendStartDate] = useState('2026-08-06');
  const [suspendEndDate, setSuspendEndDate] = useState('2026-08-13');
  const [isSuspendHistoryModalOpen, setIsSuspendHistoryModalOpen] = useState(false);

  const [isGlobalPassMenuOpen, setIsGlobalPassMenuOpen] = useState(false);
  const [editingPassModal, setEditingPassModal] = useState<any | null>(null);
  const [isAddSecondPassModalOpen, setIsAddSecondPassModalOpen] = useState(false);
  const [selectedPassToAdd, setSelectedPassToAdd] = useState('');

  // 1. POBIERANIE DANYCH Z BAZY SUPABASE DLA KOKPITU
  const loadData = async () => {
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem('forma_marzen_app_role');
      if (savedRole === 'klubowicz' || savedRole === 'admin') {
        setAppRole(savedRole);
      }
    }

    // A. Klienci
    const { data: klienciData } = await supabase.from('klienci').select('*');
    if (klienciData) {
      const enriched = klienciData.map((c: any) => ({
        ...c,
        id: c.id,
        firstName: c.Imię || '',
        lastName: c.Nazwisko || '',
        registered: c.Zarejestrowany || c.registered || '2026-08-07',
        status: c.status || 'Aktywny',
        expiresDate: c.expiresDate || '',
        price: c.Cena || c.cena || c.price || '0.00 PLN',
        discount: c.discount || '',
        wallet: c.Portfel || c.portfel || c.wallet || '0.00 PLN',
        avatarUrl: c.avatarUrl || c.avatar || null,
        gender: c.płeć || c.gender || '',
        phone: c['Numer tel.'] || c.telefon || c.phone || '',
        email: c['E-mail'] || c.email || '',
        birthDate: c.birthDate || '',
        karnetyKlubowicza: c.karnetyKlubowicza || [],
        walletHistory: c.walletHistory || []
      }));
      setKlienciList(enriched);
    }

    // B. Karnety do list rozwijanych
    const { data: karnetyData } = await supabase.from('karnety').select('*');
    if (karnetyData) {
      setDostepneKarnety(karnetyData.map((k: any) => ({
        ...k,
        cena: k.cena_brutto || '0.00' 
      })));
    }

    // C. Transakcje (Finanse)
    const { data: tData } = await supabase.from('transakcje').select('*').order('created_at', { ascending: false });
    if (tData) {
      setWszystkieTransakcje(tData);
    }

    // D. Grafik z chmury (Szablony, Jednorazowe, Nadpisania, Zapisy)
    const { data: rodzajeData } = await supabase.from('rodzaje_zajec').select('*');
    if (rodzajeData) setRodzajeZajec(rodzajeData);

    const { data: szablonyData } = await supabase.from('szablony_zajec').select('*');
    if (szablonyData) {
      setZapisaneZajecia(szablonyData.map((s: any) => ({ ...s, start: s.start_time, end: s.end_time, limit: s.limit_miejsc })));
    }

    const { data: jednorazoweData } = await supabase.from('zajecia_jednorazowe').select('*');
    if (jednorazoweData) {
      setJednorazoweZajecia(jednorazoweData.map((j: any) => ({ ...j, start: j.start_time, end: j.end_time, limit: j.limit_miejsc })));
    }

    const { data: nadpisaniaData } = await supabase.from('nadpisania_zajec').select('*');
    if (nadpisaniaData) {
      const nadpisaniaMap: { [key: string]: any } = {};
      nadpisaniaData.forEach((n: any) => {
        nadpisaniaMap[n.class_key] = { start: n.start, end: n.end, trainer: n.trainer, limit: n.limit, isOdwołane: n.is_odwolane, isUsunięte: n.is_usuniete };
      });
      setNadpisaneZajeciaDni(nadpisaniaMap);
    }

    const { data: wydarzeniaData } = await supabase.from('wydarzenia_kilkudniowe').select('*');
    if (wydarzeniaData) {
      setWydarzeniaKilkudniowe(wydarzeniaData.map((w: any) => ({ id: w.id, title: w.title, dateFrom: w.date_from, dateTo: w.date_to })));
    }

    const { data: zapisyData } = await supabase.from('zapisy_zajec').select('*');
    if (zapisyData) {
      const grouped: { [key: string]: any[] } = {};
      zapisyData.forEach((z: any) => {
        if (!grouped[z.class_key]) grouped[z.class_key] = [];
        grouped[z.class_key].push(z);
      });
      setZapisyNaZajecia(grouped);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  // 2. UNIWERSALNA FUNKCJA AKTUALIZUJĄCA KLIENTA W BAZIE
  const updateSupabaseClient = async (updatedClient: any, payload: any) => {
    setKlienciList(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    if (profileClient && profileClient.id === updatedClient.id) {
      setProfileClient(updatedClient);
    }
    await supabase.from('klienci').update(payload).eq('id', updatedClient.id);
    loadData(); 
  };

  const handleDeleteClient = async (id: number) => {
    if (confirm("Czy na pewno chcesz całkowicie usunąć to konto?")) {
      await supabase.from('klienci').delete().eq('id', id);
      setTableActionClient(null);
      if (profileClient && profileClient.id === id) setProfileClient(null);
      loadData();
    }
  };

  const handleDeactivateClient = () => {
    if (confirm("Czy na pewno chcesz dezaktywować tego użytkownika?")) {
      alert("Konto zostało dezaktywowane.");
      setTableActionClient(null);
    }
  };

  const handleDeactivateClientOnDate = () => {
    const dataWyb = prompt("Podaj datę, w której konto ma zostać dezaktywowane (YYYY-MM-DD):", "2026-08-31");
    if (dataWyb) {
      if (confirm(`Czy na pewno chcesz zaplanować dezaktywację konta na dzień ${dataWyb}?`)) {
        alert(`Zaplanowano dezaktywację konta na dzień ${dataWyb}.`);
        setTableActionClient(null);
      }
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profileClient) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
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

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        const updatedClient = { ...profileClient, avatarUrl: compressedDataUrl };
        
        await updateSupabaseClient(updatedClient, { avatarUrl: compressedDataUrl });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmExtendPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !extendPassTarget) return;

    const defKarnetu = dostepneKarnety.find(k => k.nazwa === extendSelectedNewPassName);
    const nowaCena = defKarnetu ? `${defKarnetu.cena} PLN` : extendPassTarget.cena;

    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === extendPassTarget.id) {
        return {
          ...k,
          nazwa: extendSelectedNewPassName,
          waznyDo: extendNewDate,
          cena: nowaCena,
          statusTekst: `Ważny do: ${extendNewDate}`
        };
      }
      return k;
    });

    const updatedClient = {
      ...profileClient,
      karnetyKlubowicza: uaktualnioneKarnety,
      pass: extendSelectedNewPassName,
      price: nowaCena,
      expiresDate: extendNewDate
    };

    await updateSupabaseClient(updatedClient, { 
      karnetyKlubowicza: uaktualnioneKarnety,
      Cena: nowaCena
    });
    
    alert(`Karnet został pomyślnie przedłużony do ${extendNewDate}!`);
    setIsExtendPassModalOpen(false);
  };

  const handleAddSecondPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !selectedPassToAdd) return;

    const defKarnetu = dostepneKarnety.find(k => k.nazwa === selectedPassToAdd);
    let dniWażności = 30;
    
    if (defKarnetu && defKarnetu.dlugosc) {
      const dlugoscStr = defKarnetu.dlugosc.toLowerCase();
      if (dlugoscStr.includes('1 miesiąc') || dlugoscStr.includes('miesiąc')) dniWażności = 30;
      else if (dlugoscStr.includes('3 miesiące')) dniWażności = 90;
      else if (dlugoscStr.includes('6 miesięcy')) dniWażności = 180;
      else if (dlugoscStr.includes('1 rok')) dniWażności = 365;
      else if (dlugoscStr.includes('14 dni')) dniWażności = 14;
      else if (dlugoscStr.includes('7 dni')) dniWażności = 7;
    }

    const dataWygasniecia = new Date();
    dataWygasniecia.setDate(dataWygasniecia.getDate() + dniWażności);
    const dataWygasnieciaStr = dataWygasniecia.toISOString().split('T')[0];

    const nowyKarnetObj = {
      id: Date.now(),
      nazwa: selectedPassToAdd,
      waznyDo: dataWygasnieciaStr,
      cena: defKarnetu ? `${defKarnetu.cena} PLN` : '150.00 PLN',
      znizkaProcentowa: '',
      rata: '1 / 1',
      statusTekst: `Ważny do: ${dataWygasnieciaStr}`,
      blokadaDo: null,
      powodBlokady: null,
      zawieszonyOd: null,
      zawieszonyDo: null,
      historiaZawieszen: []
    };

    const uaktualnioneKarnety = [...(profileClient.karnetyKlubowicza || []), nowyKarnetObj];
    const updatedClient = {
      ...profileClient,
      karnetyKlubowicza: uaktualnioneKarnety,
      pass: uaktualnioneKarnety.map((k: any) => k.nazwa).join(', '),
      price: nowyKarnetObj.cena,
      expiresDate: uaktualnioneKarnety[0]?.waznyDo || ''
    };

    await updateSupabaseClient(updatedClient, { 
      karnetyKlubowicza: uaktualnioneKarnety,
      Cena: nowyKarnetObj.cena
    });

    setSelectedPassToAdd('');
    setIsAddSecondPassModalOpen(false);
  };

  const handleConfirmSuspendPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !suspendPassTarget) return;

    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === suspendPassTarget.id) {
        return { ...k, zawieszonyOd: suspendStartDate, zawieszonyDo: suspendEndDate };
      }
      return k;
    });

    const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety };
    
    await updateSupabaseClient(updatedClient, { karnetyKlubowicza: uaktualnioneKarnety });
    
    alert(`Karnet został zawieszony od ${suspendStartDate} do ${suspendEndDate}.`);
    setIsSuspendModalOpen(false);
  };

  const handleSaveBlockModification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient) return;

    let nowaDataStr = '';
    if (blockDateInput) {
      nowaDataStr = blockDateInput;
    } else {
      const dni = parseInt(blockDaysInput, 10);
      if (dni <= 0) {
        const updatedClient = {
          ...profileClient,
          blokadaDo: null,
          powodBlokady: null,
          karnetyKlubowicza: (profileClient.karnetyKlubowicza || []).map((k: any) => ({ ...k, blokadaDo: null, powodBlokady: null }))
        };
        
        await updateSupabaseClient(updatedClient, { 
          blokadaDo: null, 
          powodBlokady: null, 
          karnetyKlubowicza: updatedClient.karnetyKlubowicza 
        });

        alert("Blokada została pomyślnie odwołana!");
        setIsBlockModalOpen(false);
        return;
      }
      const now = new Date();
      now.setDate(now.getDate() + dni);
      nowaDataStr = now.toISOString().split('T')[0];
    }

    const updatedClient = {
      ...profileClient,
      blokadaDo: nowaDataStr,
      powodBlokady: `Zaktualizowana blokada zapisów do dnia ${nowaDataStr}.`,
      karnetyKlubowicza: (profileClient.karnetyKlubowicza || []).map((k: any) => ({ ...k, blokadaDo: nowaDataStr }))
    };

    await updateSupabaseClient(updatedClient, { 
      blokadaDo: nowaDataStr, 
      powodBlokady: updatedClient.powodBlokady, 
      karnetyKlubowicza: updatedClient.karnetyKlubowicza 
    });

    alert(`Blokada została ustawiona do dnia: ${nowaDataStr}!`);
    setIsBlockModalOpen(false);
  };

  const handleTopUpWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !walletAmountInput) return;

    const kwotaZmiany = parseFloat(walletAmountInput);
    if (isNaN(kwotaZmiany)) return;

    const currentWalletNum = parseFloat(profileClient.wallet.replace(/[^0-9.-]+/g, "")) || 0;
    const nowyStan = currentWalletNum + kwotaZmiany;
    const nowyStanStr = `${nowyStan.toFixed(2)} PLN`;

    const nowaHistoriaEntry = {
      id: Date.now(),
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      type: walletReasonInput || (kwotaZmiany >= 0 ? 'Doładowanie portfela' : 'Korekta portfela'),
      amount: `${kwotaZmiany >= 0 ? '+' : ''}${kwotaZmiany.toFixed(2)} PLN`,
      balance: nowyStanStr
    };

    const updatedWalletHistory = [nowaHistoriaEntry, ...(profileClient.walletHistory || [])];
    const updatedClient = { ...profileClient, wallet: nowyStanStr, walletHistory: updatedWalletHistory };
    
    await updateSupabaseClient(updatedClient, { 
      Portfel: nowyStanStr, 
      walletHistory: updatedWalletHistory 
    });

    setWalletAmountInput('');
    setWalletReasonInput('');
    setIsTopUpWalletOpen(false);
  };

  const handleSaveProfileInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient) return;
    
    await updateSupabaseClient(profileClient, { 
      Imię: profileClient.firstName, 
      Nazwisko: profileClient.lastName, 
      telefon: profileClient.phone, 
      email: profileClient.email, 
      płeć: profileClient.gender 
    });
    
    setIsEditProfileInfoOpen(false);
  };

  // POMOCNICZE FUNKCJE GRAFIKU
  const getTopBorderColor = (title: string, isOdwolane: boolean, isUsuniete: boolean) => {
    if (isOdwolane || isUsuniete) return '#fda4af';
    if (!title) return '#0284c7';
    const found = rodzajeZajec.find(r => r.nazwa?.trim().toLowerCase() === title?.trim().toLowerCase());
    if (found && found.kolor) return found.kolor;
    const colorPalette = ['#2563eb', '#9333ea', '#16a34a', '#dc2626', '#d97706', '#0d9488', '#c026d3'];
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colorPalette[Math.abs(hash) % colorPalette.length];
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

  const filteredClients = klienciList.filter(client => {
    const fullName = `${client.firstName || ''} ${client.lastName || ''}`.toLowerCase();
    const email = (client.email || '').toLowerCase();
    const query = clientSearch.toLowerCase();
    return fullName.includes(query) || email.includes(query);
  });

    // WYLICZANIE DYNAMICZNEGO KALENDARZA (Z PRZEŁĄCZANIEM NA KOLEJNY TYDZIEŃ W SOBOTĘ I NIEDZIELĘ)
  const getMonday = (d: Date) => {
    const dCopy = new Date(d);
    const day = dCopy.getDay();
    
    // Jeśli dzisiaj jest sobota (6) lub niedziela (0), przeskocz od razu do poniedziałku następnego tygodnia
    if (day === 6) {
      dCopy.setDate(dCopy.getDate() + 2);
    } else if (day === 0) {
      dCopy.setDate(dCopy.getDate() + 1);
    }

    const currentDayOfWeek = dCopy.getDay();
    const diff = dCopy.getDate() - currentDayOfWeek + (currentDayOfWeek === 0 ? -6 : 1);
    return new Date(dCopy.setDate(diff));
  };

  const today = new Date();
  const currentMonday = getMonday(new Date());
  
  const dashboardDays = Array.from({ length: 5 }).map((_, index) => {
    const dayDate = new Date(currentMonday);
    dayDate.setDate(currentMonday.getDate() + index);
    const dayNames = ['PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK'];
    const keys = ['pon', 'wt', 'sr', 'czw', 'pt'];
    
    const dayStr = String(dayDate.getDate()).padStart(2, '0');
    const monthStr = String(dayDate.getMonth() + 1).padStart(2, '0');
    const isoDateStr = `${dayDate.getFullYear()}-${monthStr}-${dayStr}`;

    return {
      day: dayNames[index],
      key: keys[index],
      date: `${dayStr}/${monthStr}`,
      isoDate: isoDateStr,
      fullDate: dayDate
    };
  });

  // WYLICZANIE TRANSAKCJI I SPRZEDAŻY
  const todayStr = today.toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7);
  
  const filteredTransakcje = wszystkieTransakcje.filter(t => {
    const tDate = t.created_at ? t.created_at.split('T')[0] : '';
    if (salesPeriod === 'Dziś') return tDate === todayStr;
    if (salesPeriod === 'Miesiąc') return tDate.startsWith(currentMonthStr);
    return true;
  });

  const sumaTransakcji = filteredTransakcje.reduce((acc, t) => acc + (Number(t.kwota) || 0), 0);
  let salesPeriodTitle = '';
  if (salesPeriod === 'Dziś') salesPeriodTitle = todayStr;
  if (salesPeriod === 'Miesiąc') salesPeriodTitle = `Miesiąc ${currentMonthStr}`;

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24">
      
      {/* 1. GRAFIK NA CAŁĄ SZEROKOŚĆ (5 DNI) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between bg-white border border-sky-200 p-4 rounded-2xl shadow-sm">
          <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-sky-950">
            GRAFIK ZAJĘĆ (BIEŻĄCY TYDZIEŃ)
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
          {dashboardDays.map((col, idx) => {
            const isToday = 
              col.fullDate.getDate() === today.getDate() && 
              col.fullDate.getMonth() === today.getMonth() && 
              col.fullDate.getFullYear() === today.getFullYear();

            const aktywneWydarzeniaDnia = wydarzeniaKilkudniowe.filter((w: any) => col.isoDate >= w.dateFrom && col.isoDate <= w.dateTo);
            const czyObózAktywny = aktywneWydarzeniaDnia.length > 0;

            const standardoweDnia = czyObózAktywny ? [] : zapisaneZajecia
              .filter((item: any) => item.days && item.days[col.key])
              .map((item: any) => {
                const classKey = `${item.id}_${col.date}`;
                const override = nadpisaneZajeciaDni[classKey];
                return override ? { ...item, ...override } : item;
              });

            const jednorazoweDnia = czyObózAktywny ? [] : jednorazoweZajecia.filter((item: any) => item.displayDate === col.date);
            const zajeciaDnia = [...standardoweDnia, ...jednorazoweDnia].sort((a: any, b: any) => (a.start || "").localeCompare(b.start || ""));

            return (
              <div 
                key={idx} 
                className={`space-y-3 p-3 rounded-2xl border transition-all ${
                  isToday 
                    ? 'bg-white border-rose-500 shadow-md border-t-4 border-t-rose-600' 
                    : 'bg-sky-50/40 border-sky-100'
                }`}
              >
                <div className={`text-xs font-black uppercase tracking-wider border-b pb-2 mb-2 text-center ${
                  isToday ? 'text-rose-950 border-rose-200' : 'text-sky-900 border-sky-200'
                }`}>
                  <span className={isToday ? 'text-rose-700' : ''}>{col.day}</span>{' '}
                  <span className={`text-[10px] font-normal ${isToday ? 'text-rose-800' : 'text-slate-500'}`}>({col.date})</span>
                </div>

                {/* WYŚWIETLANIE WYDARZEŃ KILKUDNIOWYCH (OBOZY) */}
                {aktywneWydarzeniaDnia.map((wydarzenie: any) => (
                  <div key={wydarzenie.id} className="bg-rose-100 border border-rose-300 rounded-2xl p-4 text-center space-y-2 shadow-sm">
                    <div className="py-2 px-3 bg-rose-200 text-rose-950 font-black rounded-xl text-xs uppercase tracking-wider border border-rose-300">
                      {wydarzenie.title}
                    </div>
                    <div className="text-[11px] text-rose-900 font-bold">
                      Odwołano zajęcia z powodu wydarzenia
                    </div>
                  </div>
                ))}

                <div className="space-y-3">
                  {zajeciaDnia.length === 0 && aktywneWydarzeniaDnia.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 font-medium">
                      Brak zajęć w tym dniu.
                    </div>
                  ) : (
                    zajeciaDnia.map((item: any, classIdx: number) => {
                      const durationText = calculateDuration(item.start, item.end);
                      const classKey = `${item.id}_${col.date}`;
                      const zapisani = zapisyNaZajecia[classKey] || [];
                      const limitZajec = item.limit || 12;
                      const liczbaGlowna = Math.min(zapisani.length, limitZajec);
                      const liczbaKrzesełko = Math.max(0, zapisani.length - limitZajec);
                      const isFull = zapisani.length >= limitZajec;

                      const topColor = getTopBorderColor(item.title, item.isOdwołane, item.isUsunięte);

                      return (
                        <div 
                          key={classIdx}
                          style={{ borderTopWidth: '5px', borderTopStyle: 'solid', borderTopColor: topColor }}
                          className={`bg-white border rounded-2xl p-4 space-y-3 shadow-sm ${item.isOdwołane || item.isUsunięte ? 'border-rose-200 opacity-80' : 'border-sky-100'}`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-base font-black text-slate-900">{item.start}</span>
                              <h3 className="text-xs font-bold text-slate-800 mt-0.5">{item.title}</h3>
                            </div>
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
                                isFull ? 'bg-rose-100 text-rose-900 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. DOLNY PANEL: SPRZEDAŻ (LEWA) ORAZ KLIENCI (PRAWA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-4">
        
        {/* SPRZEDAŻ (LEWA STRONA) */}
        <section className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <Link 
              href="/raporty/transakcje" 
              className="text-base font-bold uppercase tracking-wider text-sky-900 hover:text-sky-700 flex items-center gap-2 transition-colors cursor-pointer group"
            >
              SPRZEDAŻ Z BAZY <span className="text-xs group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
            </Link>
          </div>

          <div className="bg-white border border-sky-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-sky-100 rounded-full flex items-center justify-center font-bold text-sky-700 text-sm">
                  $
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 uppercase">RAPORT FINANSOWY</div>
                  <div className="text-[10px] text-slate-500">{salesPeriodTitle}</div>
                </div>
              </div>
              <select 
                value={salesPeriod}
                onChange={(e) => setSalesPeriod(e.target.value)}
                className="bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                <option value="Dziś">Dziś</option>
                <option value="Miesiąc">Ten miesiąc</option>
              </select>
            </div>

            <div className="bg-sky-50 p-3 rounded-xl border border-sky-100 flex justify-between items-center text-xs">
              <span className="text-slate-600 font-medium">Łączny bilans operacji:</span>
              <span className={`font-bold text-sm ${sumaTransakcji < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                {sumaTransakcji.toFixed(2)} PLN
              </span>
            </div>

            <div className="text-[11px] max-h-60 overflow-y-auto pr-2">
              <div className="flex justify-between text-slate-500 pb-2 border-b border-sky-100 font-semibold sticky top-0 bg-white z-10">
                <span>Operacja</span>
                <span>Ilość</span>
                <span>Kwota brutto</span>
              </div>
              
              {filteredTransakcje.length === 0 ? (
                <div className="flex justify-between text-slate-400 py-4 border-b border-slate-100 text-center">
                  <span className="w-full">Brak zarejestrowanych transakcji w tym okresie.</span>
                </div>
              ) : (
                filteredTransakcje.map((t: any) => (
                  <div key={t.id} className="flex justify-between text-slate-700 py-2.5 border-b border-slate-100">
                    <span className="truncate pr-2 max-w-[200px]" title={t.opis}>{t.opis || t.typ_operacji}</span>
                    <span>1</span>
                    <span className={`font-bold ${t.kwota < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {Number(t.kwota).toFixed(2)} PLN
                    </span>
                  </div>
                ))
              )}

              <div className="flex justify-between text-slate-900 pt-3 font-bold text-xs sticky bottom-0 bg-white">
                <span>Podsumowanie:</span>
                <span className={sumaTransakcji < 0 ? 'text-rose-700' : 'text-emerald-700'}>
                  {sumaTransakcji.toFixed(2)} PLN
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* KLIENCI (PRAWA STRONA) */}
        <section className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <Link 
              href="/raporty/klienci" 
              className="text-base font-bold uppercase tracking-wider text-sky-900 hover:text-sky-700 flex items-center gap-2 transition-colors cursor-pointer group"
            >
              KLIENCI ({klienciList.length}) <span className="text-xs group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
            </Link>
          </div>

          <div className="bg-white border border-sky-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="Szukaj klienta po imieniu, nazwisku lub e-mail..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="flex-1 bg-sky-50 border border-sky-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {filteredClients.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs font-medium">
                  Brak klientów pasujących do wyszukiwania.
                </div>
              ) : (
                filteredClients.map((client) => {
                  const maKarnet = client.karnetyKlubowicza && client.karnetyKlubowicza.length > 0;
                  const nazwaKarnetu = maKarnet ? client.karnetyKlubowicza.map((k: any) => k.nazwa).join(', ') : (client.pass || 'Brak karnetu');

                  return (
                    <div 
                      key={client.id}
                      className="bg-sky-50/50 border border-sky-100 rounded-xl p-4 space-y-3 hover:border-sky-300 transition-all shadow-sm"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-sky-100 border-2 border-amber-500 rounded-full overflow-hidden flex items-center justify-center font-bold text-sky-900 text-xs shrink-0 shadow-sm">
                            {client.avatarUrl ? (
                              <img src={client.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              '👤'
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">{client.firstName} {client.lastName}</h4>
                            <span className="text-[10px] text-slate-500 block mt-0.5">✉ {client.email}</span>
                          </div>
                        </div>
                        {appRole === 'admin' && (
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <button onClick={() => setTableActionClient(client)} className="hover:text-slate-700 cursor-pointer p-1.5 bg-white border border-slate-200 rounded-md shadow-sm" title="Zarządzaj klubowiczem">✏️</button>
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] font-bold text-sky-900 pl-1">
                        Karnet: {nazwaKarnetu}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                          {client.status || 'Aktywny'}
                        </span>
                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          Rejestracja: {client.registered}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

      </div>

      {/* MODAL SZYBKIEGO MENU ZARZĄDZANIA KLUBOWICZEM */}
      {tableActionClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 border border-sky-200 relative">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-base overflow-hidden">
                  {tableActionClient.avatarUrl ? (
                    <img src={tableActionClient.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    '👤'
                  )}
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-black text-slate-900 text-sm">{tableActionClient.firstName} {tableActionClient.lastName}</div>
                  <div className="font-mono text-slate-600 flex items-center gap-1.5"><span>📞</span> {tableActionClient.phone || 'Nie podano'}</div>
                  <div className="text-slate-500 flex items-center gap-1.5"><span>✉️</span> {tableActionClient.email || 'Nie podano'}</div>
                </div>
              </div>
              <button onClick={() => setTableActionClient(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer">✕</button>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Klubowicz</div>
              <div className="grid grid-cols-4 gap-2 text-xs font-bold text-slate-700 text-center">
                <button onClick={() => { setProfileClient(tableActionClient); setTableActionClient(null); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">✏️</span> Edytuj
                </button>
                <button onClick={() => alert("Sprzedaj produkt")} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">🛒</span> Sprzedaj produkt
                </button>
                <button onClick={() => alert("Dodaj zadanie")} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">➕</span> Dodaj zadanie
                </button>
                <button onClick={() => alert("Link do płatności")} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">💲</span> Link do płatności
                </button>
                <button onClick={() => alert("Wyślij wiadomość")} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">✉️</span> Wyślij wiadomość
                </button>
                <button onClick={() => alert("Resetuj hasło")} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">🔑</span> Resetuj hasło
                </button>
                <button onClick={() => alert("Zamień w gościa")} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer col-span-2">
                  <span className="text-base">👤</span> Zamień w gościa
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{tableActionClient.karnetyKlubowicza && tableActionClient.karnetyKlubowicza.length > 0 ? tableActionClient.karnetyKlubowicza.map((k:any)=>k.nazwa).join(', ') : 'Brak karnetu'}</div>
                <div className="bg-slate-100 px-3 py-1 rounded-xl text-slate-700 font-semibold">
                  <div>Ważny do: {tableActionClient.karnetyKlubowicza && tableActionClient.karnetyKlubowicza.length > 0 ? tableActionClient.karnetyKlubowicza[0].waznyDo : '-'}</div>
                  <div className="text-[10px] text-slate-500">Cena: {tableActionClient.price || '0.00 PLN'}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs font-bold text-slate-700 text-center">
                <button onClick={() => { 
                  setProfileClient(tableActionClient); 
                  if(tableActionClient.karnetyKlubowicza?.length > 0) {
                    setExtendPassTarget(tableActionClient.karnetyKlubowicza[0]);
                    setExtendSelectedNewPassName(tableActionClient.karnetyKlubowicza[0].nazwa);
                    const curDate = new Date(tableActionClient.karnetyKlubowicza[0].waznyDo || Date.now());
                    curDate.setMonth(curDate.getMonth() + 1);
                    setExtendNewDate(curDate.toISOString().split('T')[0]);
                  }
                  setIsExtendPassModalOpen(true); 
                  setTableActionClient(null); 
                }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">🕒</span> Przedłuż karnet
                </button>
                <button onClick={() => { 
                  setProfileClient(tableActionClient); 
                  if(tableActionClient.karnetyKlubowicza?.length > 0) {
                    setSuspendPassTarget(tableActionClient.karnetyKlubowicza[0]);
                    setSuspendStartDate(tableActionClient.karnetyKlubowicza[0].zawieszonyOd || '2026-08-06');
                    setSuspendEndDate(tableActionClient.karnetyKlubowicza[0].zawieszonyDo || '2026-08-13');
                  }
                  setIsSuspendModalOpen(true); 
                  setTableActionClient(null); 
                }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">⏸️</span> Zawieś karnet
                </button>
                <button onClick={() => { setProfileClient(tableActionClient); setIsSuspendHistoryModalOpen(true); setTableActionClient(null); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">📜</span> Historia zawieszeń
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-[10px] font-black text-rose-500 uppercase tracking-wider flex items-center gap-1"><span>⚠️</span> DANGER ZONE</div>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold text-rose-800 text-center">
                <button onClick={handleDeactivateClient} className="p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center gap-1.5 cursor-pointer">
                  <span className="text-base">🔒</span> Dezaktywuj
                </button>
                <button onClick={handleDeactivateClientOnDate} className="p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center gap-1.5 cursor-pointer">
                  <span className="text-base">🔒</span> Dezaktywuj w dniu
                </button>
                <button onClick={() => handleDeleteClient(tableActionClient.id)} className="p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center gap-1.5 cursor-pointer">
                  <span className="text-base">🗑️</span> Usuń konto
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL PEŁNEGO PROFILU KLIENTA (Z W PEŁNI DZIAŁAJĄCYMI PRZYCISKAMI) */}
      {profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-end backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col overflow-y-auto">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white sticky top-0 z-20">
              <button onClick={() => setProfileClient(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer">✕</button>
              <div className="flex items-center gap-3">
                <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer">🕒 LOGI UŻYTKOWNIKA</button>
              </div>
            </div>

            <div className="p-6 space-y-8 flex-1">
              
              <div className="flex justify-between items-start gap-6 bg-slate-50/70 border border-slate-200 rounded-2xl p-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-slate-900">{profileClient.firstName} {profileClient.lastName}</h2>
                    <button 
                      onClick={() => setIsEditProfileInfoOpen(true)}
                      className="w-8 h-8 bg-white hover:bg-sky-50 text-slate-700 rounded-xl border border-slate-200 flex items-center justify-center text-xs shadow-sm cursor-pointer transition-all"
                      title="Edytuj dane konta"
                    >
                      ✏️
                    </button>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <div><span className="font-semibold">Telefon:</span> {profileClient.phone ? profileClient.phone : 'Nie podano'}</div>
                    <div><span className="font-semibold">Email:</span> {profileClient.email ? profileClient.email : 'Nie podano'}</div>
                    <div><span className="font-semibold">Płeć:</span> {profileClient.gender ? profileClient.gender : 'Nie podano'}</div>
                    <div><span className="font-semibold">Urodziny:</span> {profileClient.birthDate ? profileClient.birthDate : 'Nie podano'}</div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="w-28 h-28 rounded-full bg-slate-900 text-white font-black flex items-center justify-center text-3xl overflow-hidden border-2 border-sky-300 shadow-md">
                    {profileClient.avatarUrl ? (
                      <img src={profileClient.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span>👤</span>
                    )}
                  </div>

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleAvatarChange} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="bg-white hover:bg-sky-50 text-sky-900 px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-200 shadow-sm cursor-pointer transition-all"
                  >
                    ✏️ Edytuj zdjęcie
                  </button>
                </div>
              </div>

              {/* KARNETY */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-xs text-slate-500 uppercase tracking-wider">Karnety klubowicza</h3>
                  <button 
                    onClick={() => { setSelectedPassToAdd(dostepneKarnety[0]?.nazwa || ''); setIsAddSecondPassModalOpen(true); }} 
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm"
                  >
                    + DODAJ DRUGI KARNET
                  </button>
                </div>

                <div className="space-y-3">
                  {profileClient.karnetyKlubowicza && profileClient.karnetyKlubowicza.length > 0 ? (
                    profileClient.karnetyKlubowicza.map((karnet: any) => (
                      <div key={karnet.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 relative">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-black text-slate-900 text-base">{karnet.nazwa}</h4>
                              {karnet.blokadaDo && (
                                <span className="bg-rose-100 text-rose-800 text-xs font-black px-2.5 py-1 rounded border border-rose-200">
                                  ⚠️ Zablokowane do: {karnet.blokadaDo}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="bg-rose-100 text-rose-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-rose-200">
                                {karnet.statusTekst || `Ważny do: ${karnet.waznyDo}`}
                              </span>
                              <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
                                Cena: {karnet.cena}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button onClick={() => { setBlockDaysInput('3'); setBlockDateInput(karnet.blokadaDo || ''); setIsBlockModalOpen(true); }} className="bg-rose-50 hover:bg-rose-100 text-rose-800 px-3.5 py-2 rounded-xl text-xs font-bold border border-rose-200 cursor-pointer">⚙️ BLOKADA</button>
                            <button 
                              onClick={() => {
                                setExtendPassTarget(karnet);
                                setExtendSelectedNewPassName(karnet.nazwa);
                                const curDate = new Date(karnet.waznyDo || Date.now());
                                curDate.setMonth(curDate.getMonth() + 1);
                                setExtendNewDate(curDate.toISOString().split('T')[0]);
                                setIsExtendPassModalOpen(true);
                              }}
                              className="bg-sky-50 hover:bg-sky-100 text-sky-800 px-3.5 py-2 rounded-xl text-xs font-bold border border-sky-200 cursor-pointer"
                            >
                              🕒 Przedłuż
                            </button>
                            <button onClick={() => setEditingPassModal({ ...karnet })} className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 flex items-center justify-center font-bold cursor-pointer" title="Edytuj">✏️</button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs">
                      Brak przypisanych karnetów.
                    </div>
                  )}
                </div>
              </div>

              {/* PORTFEL */}
              <div className="space-y-4">
                <h3 className="font-black text-xs text-slate-500 uppercase tracking-wider">Portfel</h3>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex justify-between items-center">
                  <span className="font-black px-3 py-1 rounded-xl text-sm border bg-emerald-100 text-emerald-800 border-emerald-200">{profileClient.wallet}</span>
                  <div className="flex gap-3">
                    <button onClick={() => setIsWalletHistoryOpen(true)} className="text-slate-600 text-xs font-bold underline cursor-pointer">🕒 HISTORIA</button>
                    <button onClick={() => setIsTopUpWalletOpen(true)} className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-black cursor-pointer">+ UZUPEŁNIJ PORTFEL</button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRZEDŁUŻ KARNET */}
      {isExtendPassModalOpen && profileClient && extendPassTarget && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🕒 Przedłuż karnet</h3>
              <button onClick={() => setIsExtendPassModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleConfirmExtendPass} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold">Nowa data ważności</label>
                <input type="date" value={extendNewDate} onChange={(e) => setExtendNewDate(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold" />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsExtendPassModalOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl">Anuluj</button>
                <button type="submit" className="bg-rose-900 text-white font-black px-6 py-2.5 rounded-xl uppercase">Przedłuż</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDYCJA DANYCH KONTA */}
      {isEditProfileInfoOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">✏️ Edytuj dane konta</h3>
              <button onClick={() => setIsEditProfileInfoOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveProfileInfoSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="font-bold">Imię</label><input type="text" value={profileClient.firstName || ''} onChange={(e) => setProfileClient({...profileClient, firstName: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold" /></div>
                <div className="space-y-1"><label className="font-bold">Nazwisko</label><input type="text" value={profileClient.lastName || ''} onChange={(e) => setProfileClient({...profileClient, lastName: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold" /></div>
              </div>
              <div className="space-y-1"><label className="font-bold">Telefon</label><input type="text" value={profileClient.phone || ''} onChange={(e) => setProfileClient({...profileClient, phone: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold" /></div>
              <div className="space-y-1"><label className="font-bold">Email</label><input type="email" value={profileClient.email || ''} onChange={(e) => setProfileClient({...profileClient, email: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold" /></div>
              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsEditProfileInfoOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl">Anuluj</button>
                <button type="submit" className="bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl">Zapisz zmiany</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UZUPEŁNIJ PORTFEL */}
      {isTopUpWalletOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">💰 Uzupełnij portfel</h3>
              <button onClick={() => setIsTopUpWalletOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <form onSubmit={handleTopUpWalletSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold">Kwota (+/-)</label>
                <input type="number" step="0.01" required value={walletAmountInput} onChange={(e) => setWalletAmountInput(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold" />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsTopUpWalletOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl">Anuluj</button>
                <button type="submit" className="bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl">Zatwierdź</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIA PORTFELA */}
      {isWalletHistoryOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🕒 Historia portfela</h3>
              <button onClick={() => setIsWalletHistoryOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sky-50 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200">
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Operacja</th>
                    <th className="py-2.5 px-3">Kwota</th>
                    <th className="py-2.5 px-3">Stan po</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {profileClient.walletHistory.map((item: any) => (
                    <tr key={item.id}>
                      <td className="py-3 px-3 font-mono">{item.date}</td>
                      <td className="py-3 px-3 font-bold">{item.type}</td>
                      <td className={`py-3 px-3 font-semibold ${item.amount.startsWith('-') ? 'text-rose-600' : 'text-emerald-600'}`}>{item.amount}</td>
                      <td className="py-3 px-3 font-bold text-sky-900">{item.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pt-3 flex justify-end border-t border-sky-100">
              <button onClick={() => setIsWalletHistoryOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs">Zamknij</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DODAWANIE DRUGIEGO KARNETU */}
      {isAddSecondPassModalOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🎟️ Przypisz karnet z bazy</h3>
              <button onClick={() => setIsAddSecondPassModalOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>
            <form onSubmit={handleAddSecondPassSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Wybierz karnet *</label>
                <select value={selectedPassToAdd} onChange={(e) => setSelectedPassToAdd(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold">
                  <option value="">-- Wybierz karnet --</option>
                  {dostepneKarnety.map(k => (
                    <option key={k.id} value={k.nazwa}>{k.nazwa} ({k.cena} PLN)</option>
                  ))}
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsAddSecondPassModalOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl">Anuluj</button>
                <button type="submit" className="bg-amber-600 text-white font-black px-6 py-2.5 rounded-xl">Przypisz</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

