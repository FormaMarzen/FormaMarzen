"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from './raporty/klienci/supabase';

export default function DashboardPage() {
  const nowLocal = new Date();
  const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
  const currentTimeStr = `${String(nowLocal.getHours()).padStart(2, '0')}:${String(nowLocal.getMinutes()).padStart(2, '0')}`;
  
  const [salesPeriod, setSalesPeriod] = useState('Dziś');
  const [clientSearch, setClientSearch] = useState('');
  const [klienciList, setKlienciList] = useState<any[]>([]);
  const [zespolTrenerzy, setZespolTrenerzy] = useState<any[]>([]);
  const [zapisaneZajecia, setZapisaneZajecia] = useState<any[]>([]);
  const [jednorazoweZajecia, setJednorazoweZajecia] = useState<any[]>([]);
  const [nadpisaneZajeciaDni, setNadpisaneZajeciaDni] = useState<{ [key: string]: any }>({});
  const [wydarzeniaKilkudniowe, setWydarzeniaKilkudniowe] = useState<any[]>([]);
  const [zapisyNaZajecia, setZapisyNaZajecia] = useState<{ [key: string]: any[] }>({});
  const [rodzajeZajec, setRodzajeZajec] = useState<any[]>([]);
  const [wszystkieTransakcje, setWszystkieTransakcje] = useState<any[]>([]);
  const [appRole, setAppRole] = useState<'admin' | 'klubowicz'>('klubowicz');
  const [dostepneKarnety, setDostepneKarnety] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [tableActionClient, setTableActionClient] = useState<any | null>(null);
  const [profileClient, setProfileClient] = useState<any | null>(null);
  
  const [isExtendPassModalOpen, setIsExtendPassModalOpen] = useState(false);
  const [extendPassTarget, setExtendPassTarget] = useState<any | null>(null);
  const [extendSelectedNewPassName, setExtendSelectedNewPassName] = useState('');
  const [extendNewDate, setExtendNewDate] = useState('');
  const [isEditingNewPassType, setIsEditingNewPassType] = useState(false);
  const [isEditingNewDate, setIsEditingNewDate] = useState(false);
  const [isEditProfileInfoOpen, setIsEditProfileInfoOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isWalletHistoryOpen, setIsWalletHistoryOpen] = useState(false);
  const [isTopUpWalletOpen, setIsTopUpWalletOpen] = useState(false);
  const [walletAmountInput, setWalletAmountInput] = useState('');
  const [walletReasonInput, setWalletReasonInput] = useState('');
  
  // ZMIENNE DLA ZAWIESZEŃ I BLOKAD
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendPassTarget, setSuspendPassTarget] = useState<any | null>(null);
  const [suspendStartDate, setSuspendStartDate] = useState(todayStr);
  const [suspendEndDate, setSuspendEndDate] = useState(todayStr);
  const [suspendMode, setSuspendMode] = useState<'days' | 'dates'>('days');
  const [suspendPassDays, setSuspendPassDays] = useState('3');
  const [blockMode, setBlockMode] = useState<'days' | 'dates'>('days');
  const [blockPassDays, setBlockPassDays] = useState('3');
  const [blockPassStartDate, setBlockPassStartDate] = useState(todayStr);
  const [blockPassEndDate, setBlockPassEndDate] = useState(todayStr);
  const [isSuspendHistoryModalOpen, setIsSuspendHistoryModalOpen] = useState(false);
  
  // ZMIENNE DO PROFILU (Zakładki, Menu)
  const [isGlobalPassMenuOpen, setIsGlobalPassMenuOpen] = useState(false);
  const [activeZapisyTab, setActiveZapisyTab] = useState<'nadchodzace' | 'przeszle' | 'wypisy' | 'automatyczne'>('nadchodzace');
  const [editingPassModal, setEditingPassModal] = useState<any | null>(null);
  const [isAddSecondPassModalOpen, setIsAddSecondPassModalOpen] = useState(false);
  const [selectedPassToAdd, setSelectedPassToAdd] = useState('');
  const [isBuyPassModalOpen, setIsBuyPassModalOpen] = useState(false);
  const [selectedBuyPass, setSelectedBuyPass] = useState('');
  const [activationMode, setActivationMode] = useState<'today' | 'after'>('today');
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [searchClientQuery, setSearchClientQuery] = useState('');
  const [clientToUnregister, setClientToUnregister] = useState<any | null>(null);
  const [blokadaZapisow, setBlokadaZapisow] = useState(false);
  const [dlugoscBlokady, setDlugoscBlokady] = useState('3');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // NOWY STAN DO ROZWIJANIA LISTY AKTYWNYCH ZAPISÓW
  const [showAllMyClasses, setShowAllMyClasses] = useState(false);

  // 🌟 STAN DO STEROWANIA TYGODNIAMI W GRAFIKU 🌟
  const [selectedWeekDate, setSelectedWeekDate] = useState<Date>(new Date());

  const shiftWeek = (direction: number) => {
    const newDate = new Date(selectedWeekDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setSelectedWeekDate(newDate);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setSelectedWeekDate(new Date(e.target.value));
    }
  };

  // Funkcje pomocnicze
  const toggleDay = (dateStr: string) => setExpandedDays(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));

  const isWalletNegative = (walletStr: string) => {
    if (!walletStr) return false;
    return walletStr.includes('-');
  };

  const openProfile = (client: any) => {
    setProfileClient(client);
  };

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email;
    if (userEmail === 'maciejklaput@gmail.com') {
      setAppRole('admin');
    } else {
      setAppRole('klubowicz');
    }
    const { data: trenerzyData } = await supabase.from('trenerzy').select('*');
    if (trenerzyData) setZespolTrenerzy(trenerzyData);
    
    const { data: tData } = await supabase.from('transakcje').select('*').order('created_at', { ascending: false });
    if (tData) {
      setWszystkieTransakcje(tData);
    }

    const { data: klienciData } = await supabase.from('klienci').select('*');
    if (klienciData) {
      const enriched = klienciData.map((c: any) => {
        let parsedKarnety = [];
        if (Array.isArray(c.karnetyKlubowicza)) {
          parsedKarnety = c.karnetyKlubowicza;
        } else if (typeof c.karnetyKlubowicza === 'string') {
          try { parsedKarnety = JSON.parse(c.karnetyKlubowicza); } catch(e) {}
        }
        const powiazanyTrener = trenerzyData?.find((t: any) => t.email && t.email === c['E-mail']);
        const clientTransakcje = tData ? tData.filter((t: any) => t.klient_id === c.id) : [];

        return {
          ...c,
          _rawKarnety: c.karnetyKlubowicza,
          id: c.id,
          firstName: c.Imię || '',
          lastName: c.Nazwisko || '',
          registered: c.Zarejestrowany || c.registered || '2026-08-07',
          status: c.status || 'Aktywny',
          expiresDate: c.expiresDate || (parsedKarnety.length > 0 ? parsedKarnety[0].waznyDo : ''),
          pass: c.pass || (parsedKarnety.length > 0 ? parsedKarnety[0].nazwa : 'Brak karnetu'),
          price: c.Cena || c.cena || c.price || '0.00 PLN',
          discount: c.discount || '',
          wallet: c.Portfel || c.portfel || c.wallet || '0.00 PLN',
          avatarUrl: c.avatarUrl || c.avatar || null,
          gender: c.płeć || c.gender || '',
          phone: c['Numer tel.'] || c.telefon || c.phone || '',
          email: c['E-mail'] || c.email || '',
          birthDate: c.birthDate || '',
          karnetyKlubowicza: parsedKarnety,
          walletHistory: c.walletHistory || [],
          transakcje: clientTransakcje,
          isTrainer: !!powiazanyTrener,
          zapisyNadchodzace: c.zapisyNadchodzace || [],
          zapisyPrzeszle: c.zapisyPrzeszle || [],
          zapisyWypisy: c.zapisyWypisy || []
        };
      });
      setKlienciList(enriched);
      if (userEmail && userEmail !== 'maciejklaput@gmail.com') {
        const myUser = enriched.find((c: any) => c.email === userEmail);
        if (myUser) setCurrentUser(myUser);
      }
      if (profileClient) {
        const currentActive = enriched.find((c: any) => c.id === profileClient.id);
        if (currentActive) setProfileClient(currentActive);
      }
    }
    const { data: karnetyData } = await supabase.from('karnety').select('*');
    if (karnetyData) {
      setDostepneKarnety(karnetyData.map((k: any) => ({
        ...k,
        cena: k.cena_brutto || k.cena || '0.00'
      })));
    }
    const { data: rodzajeData } = await supabase.from('rodzaje_zajec').select('*');
    if (rodzajeData) setRodzajeZajec(rodzajeData);
    const { data: szablonyData } = await supabase.from('grafik_zajec').select('*');
    if (szablonyData) {
      setZapisaneZajecia(szablonyData.map((s: any) => ({
        ...s,
        title: s.title || s.nazwa,
        start: s.start || s.start_time,
        end: s.end || s.end_time,
        limit: s.limit || s.limit_miejsc,
        trainer: s.trainer || s.prowadzacy,
        days: s.days || {}
      })));
    }
    const { data: jednorazoweData } = await supabase.from('zajecia_jednorazowe').select('*');
    if (jednorazoweData) {
      setJednorazoweZajecia(jednorazoweData.map((j: any) => ({
        ...j,
        title: j.title || j.nazwa,
        start: j.start_time || j.start,
        end: j.end_time || j.end,
        limit: j.limit_miejsc || j.limit,
        trainer: j.trainer || j.prowadzacy,
        displayDate: j.display_date,
        fullDateStr: j.full_date_str
      })));
    }
    const { data: nadpisaniaData } = await supabase.from('nadpisania_zajec').select('*');
    if (nadpisaniaData) {
      const nadpisaniaMap: { [key: string]: any } = {};
      nadpisaniaData.forEach((n: any) => {
        nadpisaniaMap[n.class_key] = { start: n.start, end: n.end, trainer: n.trainer, limit: n.limit, isOdwołane: n.is_odwolane, isUsunięte: n.is_usuniete };
      });
      setNadpisaneZajeciaDni(nadpisaniaMap);
    }
    const { data: zapisyData } = await supabase.from('zapisy_zajec').select('*');
    if (zapisyData) {
      const grouped: { [key: string]: any[] } = {};
      zapisyData.forEach((z: any) => {
        if (!grouped[z.class_key]) grouped[z.class_key] = [];
        grouped[z.class_key].push({
          ...z,
          id: z.klient_id,
          status: z.status,
          obecny: z.obecny
        });
      });
      setZapisyNaZajecia(grouped);
    }
    const { data: wydarzeniaData } = await supabase.from('wydarzenia_kilkudniowe').select('*');
    if (wydarzeniaData) {
      setWydarzeniaKilkudniowe(wydarzeniaData.map((w: any) => ({ id: w.id, title: w.title, dateFrom: w.date_from, dateTo: w.date_to })));
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const updateSupabaseClient = async (updatedClient: any, payload: any) => {
    const safePayload = { ...payload };
    if (safePayload.karnetyKlubowicza !== undefined) {
      const isTextColumn = klienciList.some(c => typeof c._rawKarnety === 'string');
      if (isTextColumn || (typeof updatedClient._rawKarnety !== 'object' && !Array.isArray(updatedClient._rawKarnety))) {
        if (typeof safePayload.karnetyKlubowicza !== 'string') {
          safePayload.karnetyKlubowicza = JSON.stringify(safePayload.karnetyKlubowicza);
        }
      }
    }
    const { error } = await supabase.from('klienci').update(safePayload).eq('id', updatedClient.id);
    if (error) {
      alert(`BŁĄD ZAPISU DO BAZY SUPABASE:\n${error.message}\nSprawdź konsolę (F12) dla szczegółów.`);
      return false;
    }
    setKlienciList(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    if (profileClient && profileClient.id === updatedClient.id) {
      setProfileClient(updatedClient);
    }
    if (currentUser && currentUser.id === updatedClient.id) {
      setCurrentUser(updatedClient);
    }
    loadData();
    return true;
  };

  const handleToggleClientTrainer = async (client: any) => {
    if (!client.isTrainer) {
      const { error } = await supabase.from('trenerzy').insert([{
        imie_nazwisko: `${client.firstName} ${client.lastName}`,
        email: client.email,
        telefon: client.phone
      }]);
      if (error) { alert("Błąd przypisywania do zespołu: " + error.message); return; }
    } else {
      if (client.email) {
        await supabase.from('trenerzy').delete().eq('email', client.email);
      }
    }
    loadData();
  };

  const handleWypiszZajecia = async (zajecieItem: any) => {
    if (!profileClient) return;
    const uaktualnioneNadchodzace = (profileClient.zapisyNadchodzace || []).filter((z: any) => z.id !== zajecieItem.id);
    const nowyWypis = { ...zajecieItem, wypisujacy: 'Wypisany przez zarządcę z poziomu profilu' };
    const uaktualnioneWypisy = [nowyWypis, ...(profileClient.zapisyWypisy || [])];
    await supabase.from('klienci').update({ zapisyNadchodzace: uaktualnioneNadchodzace, zapisyWypisy: uaktualnioneWypisy }).eq('id', profileClient.id);
    await supabase.from('transakcje').insert([{ klient_id: profileClient.id, typ_operacji: 'zajecia_wypis', kwota: null, opis: `Wypisano z zajęć: ${zajecieItem.zajecia} (${zajecieItem.data})` }]);
    loadData();
  };

  const handleConfirmExtendPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !extendPassTarget) return;
    if (!confirm(`Czy na pewno chcesz przedłużyć ten karnet do dnia ${extendNewDate}?`)) return;
    const defKarnetu = dostepneKarnety.find(k => k.nazwa === extendSelectedNewPassName);
    const nowaCena = defKarnetu ? `${defKarnetu.cena} PLN` : extendPassTarget.cena;
    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === extendPassTarget.id) {
        return { ...k, nazwa: extendSelectedNewPassName || k.nazwa, waznyDo: extendNewDate, cena: nowaCena, statusTekst: `Ważny do: ${extendNewDate}` };
      }
      return k;
    });
    const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety, pass: uaktualnioneKarnety.map((k: any) => k.nazwa).join(', '), price: nowaCena, expiresDate: extendNewDate };
    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety };
    if (profileClient.Cena !== undefined) dbPayload.Cena = nowaCena;
    else if (profileClient.cena !== undefined) dbPayload.cena = nowaCena;
    const success = await updateSupabaseClient(updatedClient, dbPayload);
    if (success) { alert(`Karnet został pomyślnie przedłużony do ${extendNewDate}!`); setIsExtendPassModalOpen(false); }
  };

  const handleBuyPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedBuyPass) return;
    if (!confirm(`Czy na pewno chcesz kupić karnet: ${selectedBuyPass}?`)) return;
    const defKarnetu = dostepneKarnety.find(k => k.nazwa === selectedBuyPass);
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
    let karnetyList = Array.isArray(currentUser.karnetyKlubowicza) ? [...currentUser.karnetyKlubowicza] : [];
    const cenaWartosc = defKarnetu ? parseFloat(defKarnetu.cena) : 0;
    const cenaStr = defKarnetu ? `${defKarnetu.cena} PLN` : '0.00 PLN';
    const limitWejscBaza = defKarnetu ? (defKarnetu.ilosc_wejsc || defKarnetu.limitWejsc || defKarnetu.wejscia || null) : null;
    let updatedKarnety = [];
    let nowaDataWygasnieciaStr = '';
    
    if (karnetyList.length > 0 && activationMode === 'after') {
      updatedKarnety = karnetyList.map((k, index) => {
        if (index === karnetyList.length - 1) {
          let baseDate = new Date();
          if (k.waznyDo) {
            const parts = k.waznyDo.split('-');
            if (parts.length === 3) baseDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
          baseDate.setDate(baseDate.getDate() + dniWażności);
          nowaDataWygasnieciaStr = baseDate.toISOString().split('T')[0];
          const addedEntries = limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : 0;
          const currentEntries = k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined ? k.pozostaloWejsc : 0;
          return {
            ...k, nazwa: selectedBuyPass, waznyDo: nowaDataWygasnieciaStr, pozostaloWejsc: limitWejscBaza !== null ? currentEntries + addedEntries : null,
            cena: cenaStr, statusTekst: `Ważny do: ${nowaDataWygasnieciaStr}`
          };
        }
        return k;
      });
    } else {
      const dataWygasniecia = new Date();
      dataWygasniecia.setDate(dataWygasniecia.getDate() + dniWażności);
      nowaDataWygasnieciaStr = dataWygasniecia.toISOString().split('T')[0];
      const nowyKarnetObj = {
        id: Date.now(), nazwa: selectedBuyPass, waznyDo: nowaDataWygasnieciaStr, pozostaloWejsc: limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : null,
        cena: cenaStr, znizkaProcentowa: '', rata: '1 / 1', statusTekst: `Ważny do: ${nowaDataWygasnieciaStr}`, blokadaDo: null, powodBlokady: null,
        zawieszonyOd: null, zawieszonyDo: null, historiaZawieszen: []
      };
      updatedKarnety = [...karnetyList, nowyKarnetObj];
    }
    
    const currentWalletNum = parseFloat(currentUser.wallet.replace(/[^0-9.-]+/g, "")) || 0;
    const nowyStanPortfela = currentWalletNum - cenaWartosc;
    const nowyStanPortfelaStr = `${nowyStanPortfela.toFixed(2)} PLN`;
    const nowaHistoriaEntry = {
      id: Date.now(), date: new Date().toISOString().replace('T', ' ').substring(0, 16), type: `Zakup (Panel klienta): ${selectedBuyPass}`,
      amount: `-${cenaWartosc.toFixed(2)} PLN`, balance: nowyStanPortfelaStr
    };
    const updatedWalletHistory = [nowaHistoriaEntry, ...(currentUser.walletHistory || [])];
    const ostatecznaDataWygasniecia = updatedKarnety[updatedKarnety.length - 1]?.waznyDo || '';
    const updatedClient = {
      ...currentUser, karnetyKlubowicza: updatedKarnety, pass: updatedKarnety.map((k: any) => k.nazwa).join(', '),
      price: cenaStr, expiresDate: ostatecznaDataWygasniecia, wallet: nowyStanPortfelaStr, walletHistory: updatedWalletHistory
    };
    const dbPayload: any = { karnetyKlubowicza: updatedKarnety };
    if (currentUser.Cena !== undefined) dbPayload.Cena = cenaStr; else if (currentUser.cena !== undefined) dbPayload.cena = cenaStr;
    if (currentUser.Portfel !== undefined) dbPayload.Portfel = nowyStanPortfelaStr; else if (currentUser.portfel !== undefined) dbPayload.portfel = nowyStanPortfelaStr;
    
    const success = await updateSupabaseClient(updatedClient, dbPayload);
    if (success) {
      if (cenaWartosc > 0) {
        await supabase.from('transakcje').insert([{ klient_id: currentUser.id, typ_operacji: 'zakup_karnetu', kwota: -cenaWartosc, opis: `Zakup (Panel klienta): ${selectedBuyPass}` }]);
      }
      alert(`Gratulacje! Twój karnet został pomyślnie zaktualizowany (Ważny do: ${nowaDataWygasnieciaStr}).`);
      setSelectedBuyPass('');
      setIsBuyPassModalOpen(false);
    }
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
        const MAX_WIDTH = 250; const MAX_HEIGHT = 250;
        let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d'); ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        const updatedClient = { ...profileClient, avatarUrl: compressedDataUrl };
        setProfileClient(updatedClient);
        
        const dbPayload = { avatarUrl: compressedDataUrl };
        await updateSupabaseClient(updatedClient, dbPayload);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAddSecondPass = async (paymentMethod: 'paid' | 'later') => {
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
    const cenaObjKarnetu = defKarnetu ? `${defKarnetu.cena} PLN` : '150.00 PLN';
    const kwotaKarnetu = parseFloat(cenaObjKarnetu.replace(/[^0-9.]/g, '')) || 0;
    const limitWejscBaza = defKarnetu ? (defKarnetu.ilosc_wejsc || defKarnetu.limitWejsc || defKarnetu.wejscia || null) : null;
    let nowyStanStr = profileClient.wallet;
    let logKwota = 0;
    let logOpis = `Dodano karnet: ${selectedPassToAdd} (Zapłacono z góry)`;
    if (paymentMethod === 'later') {
      const currentWalletNum = parseFloat(String(profileClient.wallet).replace(/[^0-9.-]+/g, "")) || 0;
      const nowyStanPortfela = currentWalletNum - kwotaKarnetu;
      nowyStanStr = `${nowyStanPortfela.toFixed(2)} PLN`;
      logKwota = -kwotaKarnetu;
      logOpis = `Dodano karnet: ${selectedPassToAdd} (Obciążenie portfela - do zapłaty)`;
    }
    const nowyKarnetObj = {
      id: Date.now(), nazwa: selectedPassToAdd, waznyDo: dataWygasnieciaStr, pozostaloWejsc: limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : null,
      cena: cenaObjKarnetu, znizkaProcentowa: '', rata: '1 / 1', statusTekst: `Ważny do: ${dataWygasnieciaStr}`, blokadaDo: null, powodBlokady: null,
      zawieszonyOd: null, zawieszonyDo: null, historiaZawieszen: []
    };
    let karnetyList = Array.isArray(profileClient.karnetyKlubowicza) ? [...profileClient.karnetyKlubowicza] : [];
    const uaktualnioneKarnety = [...karnetyList, nowyKarnetObj];
    const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety, pass: uaktualnioneKarnety.map((k: any) => k.nazwa).join(', '), price: nowyKarnetObj.cena, expiresDate: uaktualnioneKarnety[0]?.waznyDo || '', wallet: nowyStanStr };
    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety };
    if (profileClient.Cena !== undefined) dbPayload.Cena = nowyKarnetObj.cena; else if (profileClient.cena !== undefined) dbPayload.cena = nowyKarnetObj.cena;
    if (profileClient.Portfel !== undefined) dbPayload.Portfel = nowyStanStr; else if (profileClient.portfel !== undefined) dbPayload.portfel = nowyStanStr;
    await updateSupabaseClient(updatedClient, dbPayload);
    await supabase.from('transakcje').insert([{ klient_id: profileClient.id, typ_operacji: 'zakup_karnetu', kwota: logKwota, opis: logOpis }]);
    setSelectedPassToAdd('');
    setIsAddSecondPassModalOpen(false);
  };
  const handleSavePassEditSubmit = async () => {
    if (!profileClient || !editingPassModal) return;
    if (!confirm("Czy na pewno chcesz zapisać zmiany w karnecie?")) return;
    const bazowyKarnet = dostepneKarnety.find(k => k.nazwa === editingPassModal.nazwa);
    const cenaRegularna = bazowyKarnet ? parseFloat(bazowyKarnet.cena) : null;
    const nowaCenaWartosc = parseFloat(editingPassModal.cena.replace(/[^0-9.]/g, '')) || 0;
    let znizkaTekst = '';
    if (cenaRegularna && cenaRegularna > 0 && nowaCenaWartosc < cenaRegularna) {
      const roznica = cenaRegularna - nowaCenaWartosc;
      const procent = Math.round((roznica / cenaRegularna) * 100);
      znizkaTekst = `(-${procent}%)`;
    }
    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === editingPassModal.id) {
        return {
          ...k, nazwa: editingPassModal.nazwa, waznyDo: editingPassModal.waznyDo, pozostaloWejsc: editingPassModal.pozostaloWejsc,
          cena: editingPassModal.cena.includes('PLN') ? editingPassModal.cena : `${editingPassModal.cena} PLN`,
          znizkaProcentowa: znizkaTekst, rata: editingPassModal.rata, statusTekst: `Ważny do: ${editingPassModal.waznyDo}`
        };
      }
      return k;
    });
    const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety, pass: uaktualnioneKarnety.map((k: any) => k.nazwa).join(', ') };
    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety };
    await updateSupabaseClient(updatedClient, dbPayload);
    setEditingPassModal(null);
    alert("Karnet został zaktualizowany!");
  };

  const handleConfirmDeletePass = async (passId: number) => {
    if (confirm("Czy na pewno chcesz usunąć ten karnet?")) {
      if (!profileClient) return;
      const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).filter((k: any) => k.id !== passId);
      const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety, pass: uaktualnioneKarnety.map((k: any) => k.nazwa).join(', ') || 'Brak karnetu' };
      const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety };
      await updateSupabaseClient(updatedClient, dbPayload);
      setEditingPassModal(null);
      setIsGlobalPassMenuOpen(false);
      alert("Karnet został usunięty!");
    }
  };

  const handleConfirmSuspendPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !suspendPassTarget) return;
    let sOd = suspendStartDate;
    let sDo = suspendEndDate;
    if (suspendMode === 'days') {
      sOd = todayStr;
      const dni = parseInt(suspendPassDays || '0', 10);
      if (dni <= 0) { alert("Liczba dni musi być większa od zera!"); return; }
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + dni);
      sDo = endDate.toISOString().split('T')[0];
    }
    if (new Date(sDo) < new Date(sOd)) {
      alert("Planowana data zakończenia zawieszenia musi być późniejsza lub równa dacie początkowej!");
      return;
    }
    if (!confirm(`Czy na pewno chcesz zawiesić ten karnet od ${sOd} (planowo do ${sDo})? Rzeczywista liczba dni doliczona do ważności karnetu zostanie i tak wyliczona dokładnie w momencie ręcznego odwieszenia.`)) return;
    let karnetyList = Array.isArray(profileClient.karnetyKlubowicza) ? [...profileClient.karnetyKlubowicza] : [];
    const uaktualnioneKarnety = karnetyList.map((k: any) => {
      if (k.id === suspendPassTarget.id) { return { ...k, zawieszonyOd: sOd, zawieszonyDo: sDo }; }
      return k;
    });
    const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety };
    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety };
    const success = await updateSupabaseClient(updatedClient, dbPayload);
    if (success) {
      alert(`Karnet "${suspendPassTarget.nazwa}" został zawieszony (planowo do ${sDo}). Przedłużenie jego ważności zostanie dokładnie przeliczone w momencie kliknięcia "Odwieś karnet".`);
      setIsSuspendModalOpen(false);
    }
  };

  const handleOdwiesKarnet = async (karnetTarget: any) => {
    if (!profileClient || !karnetTarget.zawieszonyOd) return;
    const dzisiaj = new Date();
    const start = new Date(karnetTarget.zawieszonyOd);
    dzisiaj.setHours(0, 0, 0, 0); start.setHours(0, 0, 0, 0);
    let diffDays = Math.floor((dzisiaj.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) diffDays = 0;
    if (!confirm(`Karnet był zawieszony od ${karnetTarget.zawieszonyOd} (łącznie ${diffDays} dni). \nCzy na pewno chcesz go odwiesić i przedłużyć jego ważność o ${diffDays} dni?`)) return;
    let currentExpDate = new Date(karnetTarget.waznyDo);
    currentExpDate.setDate(currentExpDate.getDate() + diffDays);
    const newExpDateStr = currentExpDate.toISOString().split('T')[0];
    const historiaEntry = { id: Date.now(), od: karnetTarget.zawieszonyOd, do: todayStr, dni: diffDays };
    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === karnetTarget.id) {
        return { ...k, waznyDo: newExpDateStr, statusTekst: `Ważny do: ${newExpDateStr}`, zawieszonyOd: null, zawieszonyDo: null, historiaZawieszen: [historiaEntry, ...(k.historiaZawieszen || [])] };
      }
      return k;
    });
    const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety };
    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety };
    const success = await updateSupabaseClient(updatedClient, dbPayload);
    if (success) alert(`Karnet został odwieszony! Ważność została przedłużona o ${diffDays} dni. Nowa data to ${newExpDateStr}.`);
  };

  const handleConfirmBlockPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !suspendPassTarget) return;
    let bOd = blockPassStartDate;
    let bDo = blockPassEndDate;
    if (blockMode === 'days') {
      bOd = todayStr;
      const dni = parseInt(blockPassDays || '0', 10);
      if (dni <= 0) { alert("Liczba dni musi być większa od zera!"); return; }
      const endDate = new Date(); endDate.setDate(endDate.getDate() + dni);
      bDo = endDate.toISOString().split('T')[0];
    }
    if (new Date(bDo) < new Date(bOd)) { alert("Data końcowa blokady musi być późniejsza lub równa dacie początkowej!"); return; }
    if (!confirm(`Czy na pewno chcesz zablokować ten karnet w okresie ${bOd} - ${bDo}? (Nie przedłuża to ważności karnetu)`)) return;
    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === suspendPassTarget.id) { return { ...k, blokadaOd: bOd, blokadaDo: bDo, powodBlokady: `Zablokowano w okresie ${bOd} - ${bDo}` }; }
      return k;
    });
    const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety };
    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety };
    const success = await updateSupabaseClient(updatedClient, dbPayload);
    if (success) { alert(`Karnet został zablokowany do ${bDo}.`); setIsSuspendModalOpen(false); }
  };

  const handleCancelBlock = async (karnetTarget: any) => {
    if (!profileClient) return;
    if (!confirm("Czy na pewno chcesz usunąć blokadę tego karnetu?")) return;
    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === karnetTarget.id) { return { ...k, blokadaOd: null, blokadaDo: null, powodBlokady: null }; }
      return k;
    });
    const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety };
    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety };
    await updateSupabaseClient(updatedClient, dbPayload);
    alert("Blokada została odwołana.");
    setIsSuspendModalOpen(false);
  };

  const handleTopUpWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !walletAmountInput) return;
    const kwotaZmiany = parseFloat(walletAmountInput);
    if (isNaN(kwotaZmiany)) return;
    if (!confirm(`Czy na pewno chcesz zmienić saldo portfela o kwotę ${kwotaZmiany > 0 ? '+' : ''}${kwotaZmiany.toFixed(2)} PLN?`)) return;
    const currentWalletNum = parseFloat(profileClient.wallet.replace(/[^0-9.-]+/g, "")) || 0;
    const nowyStan = currentWalletNum + kwotaZmiany;
    const nowyStanStr = `${nowyStan.toFixed(2)} PLN`;
    const nowaHistoriaEntry = {
      id: Date.now(), date: new Date().toISOString().replace('T', ' ').substring(0, 16), type: walletReasonInput || (kwotaZmiany >= 0 ? 'Doładowanie portfela' : 'Korekta portfela'),
      amount: `${kwotaZmiany >= 0 ? '+' : ''}${kwotaZmiany.toFixed(2)} PLN`, balance: nowyStanStr
    };
    const updatedWalletHistory = [nowaHistoriaEntry, ...(profileClient.walletHistory || [])];
    const updatedClient = { ...profileClient, wallet: nowyStanStr, walletHistory: updatedWalletHistory };
    const dbPayload: any = {};
    if (profileClient.Portfel !== undefined) dbPayload.Portfel = nowyStanStr;
    else if (profileClient.portfel !== undefined) dbPayload.portfel = nowyStanStr;
    await updateSupabaseClient(updatedClient, dbPayload);
    setWalletAmountInput(''); setWalletReasonInput(''); setIsTopUpWalletOpen(false);
  };

  const handleSaveProfileInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient) return;
    if (!confirm("Czy na pewno chcesz zapisać zmiany w danych profilu?")) return;
    const dbPayload: any = {};
    if (profileClient.Imię !== undefined) dbPayload['Imię'] = profileClient.firstName;
    if (profileClient.Nazwisko !== undefined) dbPayload['Nazwisko'] = profileClient.lastName;
    if (profileClient.telefon !== undefined) dbPayload.telefon = profileClient.phone;
    if (profileClient['Numer tel.'] !== undefined) dbPayload['Numer tel.'] = profileClient.phone;
    if (profileClient.email !== undefined) dbPayload.email = profileClient.email;
    if (profileClient['E-mail'] !== undefined) dbPayload['E-mail'] = profileClient.email;
    if (profileClient['płeć'] !== undefined) dbPayload['płeć'] = profileClient.gender;
    if (profileClient.gender !== undefined) dbPayload.gender = profileClient.gender;
    await updateSupabaseClient(profileClient, dbPayload);
    setIsEditProfileInfoOpen(false);
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
          if (Array.isArray(uczestnicy) && uczestnicy.some((u: any) => u.id === klientId)) count++;
        }
      }
    });
    return count;
  };

  const toggleObecny = async (klientId: number) => {
    if (!selectedClass) return;
    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const aktualni = zapisyNaZajecia[classKey] || [];
    const szukany = aktualni.find(k => k.id === klientId);
    if (!szukany) return;
    const nowyStanObecny = !szukany.obecny;
    await supabase.from('zapisy_zajec').update({ obecny: nowyStanObecny }).eq('class_key', classKey).eq('klient_id', klientId);
    loadData();
  };

  const handleKlubowiczZapiszSie = async () => {
    if (!currentUser || !selectedClass) return;
    if (selectedClass.isOdwołane || selectedClass.isUsunięte) { alert("Nie można zapisać się na odwołane lub usunięte zajęcia!"); return; }
    const walletVal = parseFloat(String(currentUser.wallet || currentUser.Portfel || '0').replace(/[^0-9.-]+/g, "")) || 0;
    if (walletVal < 0) { alert("Posiadasz zadłużenie na koncie! Ureguluj portfel, aby móc się zapisywać na zajęcia."); return; }
    const dzisiajData = new Date().toISOString().split('T')[0];
    if (currentUser.blokadaDo && currentUser.blokadaDo >= dzisiajData) { alert(`Nie możesz się zapisać! ${currentUser.powodBlokady || 'Posiadasz aktywną blokadę zapisów.'}`); return; }
    if (!confirm("Czy na pewno chcesz zapisać się na te zajęcia?")) return;
    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const aktualni = zapisyNaZajecia[classKey] || [];
    if (aktualni.some(k => k.id === currentUser.id)) { alert("Jesteś już zapisany na te zajęcia!"); return; }
    
    let dailyLimit = Infinity;
    if (currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza.length > 0) {
      const activePass = currentUser.karnetyKlubowicza[0];
      const passDef = dostepneKarnety.find((k: any) => k.nazwa === activePass.nazwa);
      if (passDef) {
        let meta: any = {};
        try { meta = typeof passDef.inne_ustawienia === 'string' ? JSON.parse(passDef.inne_ustawienia) : (passDef.inne_ustawienia || {}); } catch(e) {}
        const typLimitu = meta.dziennyLimit || passDef.dziennyLimit;
        const iloscLimitu = meta.niestandardowyDziennyIlosc || passDef.niestandardowyDziennyIlosc;
        if (typLimitu === 'Niestandardowy') dailyLimit = parseInt(iloscLimitu, 10) || Infinity;
      }
    }
    let userSignupsOnThisDate = 0;
    Object.entries(zapisyNaZajecia).forEach(([cKey, uczestnicy]) => {
      if (cKey.endsWith(`_${selectedClass.displayDate}`)) {
        if (Array.isArray(uczestnicy) && uczestnicy.some((u: any) => String(u.id) === String(currentUser.id))) userSignupsOnThisDate++;
      }
    });
    if (userSignupsOnThisDate >= dailyLimit) { alert(`Nie możesz się zapisać! Wykorzystałeś już swój dzienny limit zapisów na ten dzień (Limit: ${dailyLimit}).`); return; }
    
    const limitZajec = selectedClass.limit || 12;
    const statusZpisu = aktualni.length >= limitZajec ? 'krzesełko' : 'zapisany';
    const { error } = await supabase.from('zapisy_zajec').insert([{ class_key: classKey, klient_id: currentUser.id, status: statusZpisu, obecny: false }]);
    if (error) { alert(`Nie udało się zapisać na zajęcia: ${error.message}`); return; }
    const oblozenieStr = `${aktualni.length + 1}/${limitZajec}`;
    const typWydarzenia = statusZpisu === 'krzesełko' ? `Zapisano na listę rezerwową (krzesełko)` : `Zapisano na zajęcia`;
    await supabase.from('transakcje').insert([{ klient_id: currentUser.id, typ_operacji: 'zajecia_zapis', class_key: classKey, opis: `${currentUser.firstName || 'Klubowicz'} - ${typWydarzenia}. Obłożenie: ${oblozenieStr}` }]);
    alert(statusZpisu === 'krzesełko' ? "Zostałeś dopisany do listy rezerwowej (krzesełko)!" : "Zostałeś pomyślnie zapisany na zajęcia!");
    loadData();
    setSelectedClass(null);
  };

  const handleKlubowiczWypiszSie = async () => {
    if (!currentUser || !selectedClass) return;
    if (!confirm("Czy na pewno chcesz wypisać się z tych zajęć?")) return;
    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const { error } = await supabase.from('zapisy_zajec').delete().eq('class_key', classKey).eq('klient_id', currentUser.id);
    if (error) { alert(`Nie udało się wypisać z zajęć: ${error.message}`); return; }
    await supabase.from('transakcje').insert([{ klient_id: currentUser.id, typ_operacji: 'zajecia_wypis', class_key: classKey, opis: `${currentUser.firstName || 'Klubowicz'} - Samodzielne wypisanie z zajęć.` }]);
    alert("Zostałeś pomyślnie wypisany z zajęć.");
    loadData();
    setSelectedClass(null);
  };

  const handleWypiszZListyAktywnych = async (classKey: string, title: string, startStr: string, fullDateObj: Date) => {
    const todayDateOnly = new Date();
    todayDateOnly.setHours(0,0,0,0);
    if (fullDateObj.getTime() < todayDateOnly.getTime() || (fullDateObj.getTime() === todayDateOnly.getTime() && startStr < currentTimeStr)) {
        alert("Czas na zapisy/wypisy minął (Zajęcia historyczne).");
        return;
    }
    if (!currentUser) return;
    if (!confirm(`Czy na pewno chcesz wypisać się z zajęć: ${title}?`)) return;
    const { error } = await supabase.from('zapisy_zajec').delete().eq('class_key', classKey).eq('klient_id', currentUser.id);
    if (error) { alert(`Nie udało się wypisać z zajęć: ${error.message}`); return; }
    await supabase.from('transakcje').insert([{ klient_id: currentUser.id, typ_operacji: 'zajecia_wypis', class_key: classKey, opis: `${currentUser.firstName || 'Klubowicz'} - Samodzielne wypisanie z zajęć (z listy aktywnej): ${title}.` }]);
    alert("Zostałeś pomyślnie wypisany z zajęć.");
    loadData();
  };

  const handleZapiszKlientaDoZajec = async (klient: any) => {
    if (!selectedClass) return;
    if (selectedClass.isOdwołane || selectedClass.isUsunięte) { alert("Nie można zapisać uczestnika na odwołane lub usunięte zajęcia!"); return; }
    const dzisiajData = new Date().toISOString().split('T')[0];
    if (klient.blokadaDo && klient.blokadaDo >= dzisiajData) { alert(`Nie można zapisać klienta! ${klient.powodBlokady || 'Klient posiada aktywną blokadę zapisów.'}`); return; }
    const walletVal = parseFloat(String(klient.wallet || klient.Portfel || '0').replace(/[^0-9.-]+/g, "")) || 0;
    if (walletVal < 0) {
      if (!confirm(`UWAGA: Klubowicz ${klient.firstName} ${klient.lastName} posiada zadłużenie na koncie (${klient.wallet || klient.Portfel}). Czy na pewno chcesz zapisać tę osobę na zajęcia?`)) return;
    } else {
      if (!confirm(`Czy na pewno chcesz zapisać klienta ${klient.firstName} ${klient.lastName} na zajęcia?`)) return;
    }
    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const aktualni = zapisyNaZajecia[classKey] || [];
    if (aktualni.some(k => k.id === klient.id)) { alert("Ten klient jest już zapisany na te zajęcia!"); return; }
    let dailyLimit = Infinity;
    if (klient.karnetyKlubowicza && klient.karnetyKlubowicza.length > 0) {
      const activePass = klient.karnetyKlubowicza[0];
      const passDef = dostepneKarnety.find((k: any) => k.nazwa === activePass.nazwa);
      if (passDef) {
        let meta: any = {};
        try { meta = typeof passDef.inne_ustawienia === 'string' ? JSON.parse(passDef.inne_ustawienia) : (passDef.inne_ustawienia || {}); } catch(e) {}
        const typLimitu = meta.dziennyLimit || passDef.dziennyLimit;
        const iloscLimitu = meta.niestandardowyDziennyIlosc || passDef.niestandardowyDziennyIlosc;
        if (typLimitu === 'Niestandardowy') dailyLimit = parseInt(iloscLimitu, 10) || Infinity;
      }
    }
    let userSignupsOnThisDate = 0;
    Object.entries(zapisyNaZajecia).forEach(([cKey, uczestnicy]) => {
      if (cKey.endsWith(`_${selectedClass.displayDate}`)) {
        if (Array.isArray(uczestnicy) && uczestnicy.some((u: any) => String(u.id) === String(klient.id))) userSignupsOnThisDate++;
      }
    });
    if (userSignupsOnThisDate >= dailyLimit) { alert(`Nie można zapisać! Klubowicz wykorzystał już swój dzienny limit zapisów na ten dzień (Limit: ${dailyLimit}).`); return; }
    const limitZajec = selectedClass.limit || 12;
    const statusZpisu = aktualni.length >= limitZajec ? 'krzesełko' : 'zapisany';
    const { error } = await supabase.from('zapisy_zajec').insert([{ class_key: classKey, klient_id: klient.id, status: statusZpisu, obecny: false }]);
    if (error) { console.error("Błąd zapisu na zajęcia:", error); alert(`Nie udało się zapisać: ${error.message}`); return; }
    const oblozenieStr = `${aktualni.length + 1}/${limitZajec}`;
    const typWydarzenia = statusZpisu === 'krzesełko' ? `Zapisano na listę rezerwową (krzesełko)` : `Zapisano na zajęcia`;
    await supabase.from('transakcje').insert([{ klient_id: klient.id, typ_operacji: 'zajecia_zapis', class_key: classKey, opis: `${klient.firstName} ${klient.lastName} - ${typWydarzenia}. Obłożenie: ${oblozenieStr}` }]);
    setIsSearchingClient(false); setSearchClientQuery(''); loadData();
  };

  const handlePotwierdzWypisanie = async () => {
    if (!selectedClass || !clientToUnregister) return;
    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const limitZajec = selectedClass.limit || 12;
    const aktualni = zapisyNaZajecia[classKey] || [];
    const { error } = await supabase.from('zapisy_zajec').delete().eq('class_key', classKey).eq('klient_id', clientToUnregister.id);
    if (error) { console.error("Błąd wypisywania z zajęć:", error); alert(`Nie udało się wypisać: ${error.message}`); return; }
    await supabase.from('transakcje').insert([{ klient_id: clientToUnregister.id, typ_operacji: 'zajecia_wypis', class_key: classKey, opis: `${clientToUnregister.firstName} ${clientToUnregister.lastName} - Wypisanie z zajęć przez klub. Obłożenie po wypisie: ${aktualni.length - 1}/${limitZajec}` }]);
    if (blokadaZapisow) {
      const dni = parseInt(dlugoscBlokady) || 3;
      const dataWypisania = new Date(); const dataWygaśnięcia = new Date(dataWypisania);
      dataWygaśnięcia.setDate(dataWypisania.getDate() + dni);
      const dataStr = `${dataWygaśnięcia.getFullYear()}-${String(dataWygaśnięcia.getMonth() + 1).padStart(2, '0')}-${String(dataWygaśnięcia.getDate()).padStart(2, '0')}`;
      const powod = `Blokada zapisów na ${dni} dni za brak obecności na treningu ${selectedClass.title} w dniu ${selectedClass.displayDate}.`;
      await supabase.from('klienci').update({ blokadaDo: dataStr, powodBlokady: powod }).eq('id', clientToUnregister.id);
    }
    setClientToUnregister(null); setBlokadaZapisow(false); loadData();
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
  }).sort((a, b) => {
    const getEarliestExpirationDate = (client: any) => {
      let karnety = client.karnetyKlubowicza || [];
      if (karnety.length === 0) return '9999-12-31';
      let earliest = '9999-12-31';
      for (const k of karnety) { if (k.waznyDo && k.waznyDo < earliest) { earliest = k.waznyDo; } }
      return earliest;
    };
    return getEarliestExpirationDate(a).localeCompare(getEarliestExpirationDate(b));
  });

  const getMonday = (d: Date) => {
    const dCopy = new Date(d);
    const day = dCopy.getDay();
    if (day === 6) { dCopy.setDate(dCopy.getDate() + 2); } else if (day === 0) { dCopy.setDate(dCopy.getDate() + 1); }
    const currentDayOfWeek = dCopy.getDay();
    const diff = dCopy.getDate() - currentDayOfWeek + (currentDayOfWeek === 0 ? -6 : 1);
    return new Date(dCopy.setDate(diff));
  };
  const today = new Date();
  const currentMonday = getMonday(selectedWeekDate);
  const dashboardDays = Array.from({ length: 5 }).map((_, index) => {
    const dayDate = new Date(currentMonday);
    dayDate.setDate(currentMonday.getDate() + index);
    const dayNames = ['PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK'];
    const keys = ['pon', 'wt', 'sr', 'czw', 'pt'];
    const dayStr = String(dayDate.getDate()).padStart(2, '0');
    const monthStr = String(dayDate.getMonth() + 1).padStart(2, '0');
    return { day: dayNames[index], key: keys[index], date: `${dayStr}/${monthStr}`, isoDate: `${dayDate.getFullYear()}-${monthStr}-${dayStr}`, fullDate: dayDate };
  });

  const currentMonthStr = todayStr.substring(0, 7);
  const filteredTransakcje = wszystkieTransakcje.filter(t => {
    const tDate = t.created_at ? t.created_at.split('T')[0] : '';
    if (salesPeriod === 'Dziś') return tDate === todayStr;
    if (salesPeriod === 'Miesiąc') return tDate.startsWith(currentMonthStr);
    return true;
  });

  const karnetySales: { [key: string]: { count: number, total: number } } = {};
  let totalEarnings = 0;
  filteredTransakcje.forEach(t => {
    if (t.typ_operacji === 'zakup_karnetu' || (t.opis && t.opis.toLowerCase().includes('karnet'))) {
      let amount = Math.abs(Number(t.kwota) || 0);
      let passName = 'Inny karnet';
      let matchedPass = null;
      for (const k of dostepneKarnety) {
        if (t.opis && t.opis.includes(k.nazwa)) { passName = k.nazwa; matchedPass = k; break; }
      }
      if (amount === 0 && matchedPass) {
        const basePrice = parseFloat(matchedPass.cena) || 0;
        const client = klienciList.find(c => c.id === t.klient_id);
        const discountPercent = client?.discount ? parseFloat(client.discount) : 0;
        if (discountPercent > 0) { amount = basePrice * (1 - discountPercent / 100); } else { amount = basePrice; }
      }
      if (amount > 0) {
        if (!karnetySales[passName]) { karnetySales[passName] = { count: 0, total: 0 }; }
        karnetySales[passName].count += 1;
        karnetySales[passName].total += amount;
        totalEarnings += amount;
      }
    }
  });

  const groupedSalesArray = Object.entries(karnetySales).map(([name, data]) => ({ name, count: data.count, total: data.total }));

  let salesPeriodTitle = '';
  if (salesPeriod === 'Dziś') salesPeriodTitle = todayStr;
  if (salesPeriod === 'Miesiąc') salesPeriodTitle = `Miesiąc ${currentMonthStr}`;
  let needsNewPass = false; let isPassExpiringSoon = false; let expiringMessage = "";
  
  // WYZNACZANIE DANYCH DLA KLUBOWICZA DO NOWYCH SEKCJI
  let myUpcomingClasses: any[] = [];
  let prawdziweZapisyKlubowicza = 0;
  
  if (appRole === 'klubowicz' && currentUser) {
    const karnety = currentUser.karnetyKlubowicza || [];
    if (karnety.length === 0) { needsNewPass = true; } else {
      const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
      let hasAnyValid = false;
      for (const k of karnety) {
        let isValid = true; let isExpiring = false; let msg = "";
        if (k.waznyDo) {
          const expDate = new Date(k.waznyDo); expDate.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((expDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays < 0) { isValid = false; } else if (diffDays <= 5) { isExpiring = true; msg = `Twój karnet "${k.nazwa}" kończy się za ${diffDays} ${diffDays === 1 ? 'dzień' : 'dni'}!`; }
        }
        if (k.pozostaloWejsc !== undefined && k.pozostaloWejsc !== null) {
          if (k.pozostaloWejsc <= 0) { isValid = false; } else if (k.pozostaloWejsc <= 2) { isExpiring = true; msg = `W karnecie "${k.nazwa}" ${k.pozostaloWejsc === 1 ? 'zostało tylko 1 wejście' : `zostały tylko ${k.pozostaloWejsc} wejścia`}!`; }
        }
        if (isValid) { hasAnyValid = true; if (isExpiring) { isPassExpiringSoon = true; expiringMessage = msg; } }
      }
      if (!hasAnyValid) { needsNewPass = true; }
    }

    // Wyciąganie listy zajęć dla sekcji "TWOJE AKTYWNE ZAPISY"
    prawdziweZapisyKlubowicza = getPrawdziweAktywneZapisy(currentUser.id);
    const now = new Date();
    Object.entries(zapisyNaZajecia).forEach(([classKey, uczestnicy]) => {
      if (Array.isArray(uczestnicy) && uczestnicy.some((u: any) => String(u.id) === String(currentUser.id))) {
        const parts = classKey.split('_');
        const classId = parts[0];
        const dateStr = parts[1];
        if (dateStr) {
          const [d, m] = dateStr.split('/').map(Number);
          const classDate = new Date(now.getFullYear(), m - 1, d, 23, 59, 59);
          if (classDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
             const stdClass = zapisaneZajecia.find(z => String(z.id) === classId);
             const jednorazClass = jednorazoweZajecia.find(z => String(z.id) === classId);
             let classInfo = stdClass || jednorazClass;
             const override = nadpisaneZajeciaDni[classKey];
             if (override) classInfo = { ...classInfo, ...override };

             if (classInfo) {
               myUpcomingClasses.push({
                  ...classInfo,
                  classKey,
                  displayDate: dateStr,
                  fullDateObj: new Date(now.getFullYear(), m - 1, d)
               });
             }
          }
        }
      }
    });
    // Sortowanie chronologiczne po dacie i godzinie
    myUpcomingClasses.sort((a, b) => {
       if (a.fullDateObj.getTime() !== b.fullDateObj.getTime()) return a.fullDateObj.getTime() - b.fullDateObj.getTime();
       return (a.start || "").localeCompare(b.start || "");
    });
  }

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24">
    {appRole === 'klubowicz' && currentUser && (() => {
    const walletVal = parseFloat(String(currentUser.wallet || currentUser.Portfel || '0').replace(/[^0-9.-]+/g, "")) || 0;
    if (walletVal < 0) {
    return (
    <div className="bg-rose-100 border border-rose-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in zoom-in-95">
    <div className="flex items-center gap-4">
    <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center shrink-0 border border-rose-200">
    <span className="text-2xl">💸</span>
    </div>
    <div>
    <h3 className="font-black text-rose-950 text-sm sm:text-base uppercase tracking-wider">Zadłużenie na koncie!</h3>
    <p className="text-xs text-rose-800 font-medium mt-0.5">Twój portfel wykazuje saldo ujemne ({currentUser.wallet || currentUser.Portfel}). Masz zablokowaną możliwość zapisów na zajęcia do czasu uregulowania należności.</p>
    </div>
    </div>
    <Link
    href="/portfel"
    className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer shrink-0 text-center"
    >
    Przejdź do portfela
    </Link>
    </div>
    );
    }
    return null;
    })()}
    {appRole === 'klubowicz' && needsNewPass && (
    <div className="bg-amber-100 border border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in zoom-in-95">
    <div className="flex items-center gap-4">
    <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center shrink-0 border border-amber-200">
    <span className="text-2xl">🎟️</span>
    </div>
    <div>
    <h3 className="font-black text-amber-950 text-sm sm:text-base uppercase tracking-wider">Nie masz aktywnego karnetu!</h3>
    <p className="text-xs text-amber-800 font-medium mt-0.5">Aby w pełni korzystać z klubu i zapisywać się na zajęcia, wybierz swój karnet.</p>
    </div>
    </div>
    <button
    onClick={() => setIsBuyPassModalOpen(true)}
    className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer shrink-0"
    >
    Kup karnet
    </button>
    </div>
    )}
    {appRole === 'klubowicz' && !needsNewPass && isPassExpiringSoon && (
    <div className="bg-rose-100 border border-rose-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in zoom-in-95">
    <div className="flex items-center gap-4">
    <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center shrink-0 border border-rose-200">
    <span className="text-2xl">⚠️</span>
    </div>
    <div>
    <h3 className="font-black text-rose-950 text-sm sm:text-base uppercase tracking-wider">Kończy się twój karnet!</h3>
    <p className="text-xs text-rose-800 font-medium mt-0.5">{expiringMessage}</p>
    </div>
    </div>
    <button
    onClick={() => setIsBuyPassModalOpen(true)}
    className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer shrink-0"
    >
    Kup nowy / Przedłuż
    </button>
    </div>
    )}

    {/* NOWY DESIGN SEKCJI KLUBOWICZA: Lista zapisów zmodyfikowana na 3-kolumnową według screenów */}
    {appRole === 'klubowicz' && currentUser && (
      <div className="space-y-10 animate-in fade-in zoom-in-95">
        
        {/* TWOJE AKTYWNE ZAPISY - NOWY, WĄSKI I ZWARTY WYGLĄD */}
        <section className="space-y-4">
          <h2 className="text-[13px] font-medium text-slate-500 uppercase tracking-wider pl-1">Twoje aktywne zapisy</h2>
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            
            {/* Header: widoczny tylko jeśli są jakiekolwiek zajęcia */}
            {myUpcomingClasses.length > 0 && (
              <div className="flex justify-between px-5 py-3 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white">
                <div className="w-[45%]">Data</div>
                <div className="w-[40%]">Zajęcia</div>
                <div className="w-[15%] text-right pr-2">Wypisz</div>
              </div>
            )}
            
            <div className="divide-y divide-slate-100">
              {myUpcomingClasses.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500 font-medium">
                  Nie masz aktualnie żadnych aktywnych zapisów na zajęcia.
                </div>
              ) : (
                (showAllMyClasses ? myUpcomingClasses : myUpcomingClasses.slice(0, 3)).map((cls, idx) => (
                  <div key={idx} className="flex justify-between items-center px-5 py-4 hover:bg-slate-50 transition-colors bg-white">
                    {/* Kolumna 1: Data i czas */}
                    <div className="w-[45%] pr-2">
                      <div className="text-[12px] sm:text-[13px] font-bold text-slate-800 lowercase first-letter:uppercase truncate">
                        {cls.fullDateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {cls.start} - {cls.end} ({calculateDuration(cls.start, cls.end)})
                      </div>
                    </div>
                    {/* Kolumna 2: Nazwa i trener */}
                    <div className="w-[40%] pr-2">
                      <div className="text-[12px] sm:text-[13px] font-bold text-slate-900 truncate">{cls.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">{cls.trainer || 'Brak trenera'}</div>
                    </div>
                    {/* Kolumna 3: Przycisk Wypisz */}
                    <div className="w-[15%] flex justify-end items-center pr-1">
                      <button 
                        onClick={() => handleWypiszZListyAktywnych(cls.classKey, cls.title, cls.start, cls.fullDateObj)}
                        className="w-8 h-8 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105 cursor-pointer shrink-0"
                        title="Wypisz się z zajęć"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l4 4m0-4l-4 4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Przycisk rozwijania z owalnym designem */}
            {myUpcomingClasses.length > 3 && (
              <div className="p-4 flex justify-center bg-white border-t border-slate-100">
                <button 
                  onClick={() => setShowAllMyClasses(!showAllMyClasses)}
                  className="bg-white border border-slate-300 text-slate-700 font-bold px-6 py-2 rounded-full text-[11px] shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  <span className="text-slate-400">↕</span> 
                  {showAllMyClasses ? 'ZWIŃ LISTĘ' : `POKAŻ WSZYSTKIE (${myUpcomingClasses.length})`}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* TWOJE KARNETY */}
        <section className="space-y-4">
          <h2 className="text-[13px] font-medium text-slate-500 uppercase tracking-wider pl-1">Twoje karnety</h2>
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 space-y-4">
              <h3 className="font-black text-xl text-slate-900 uppercase">
                {currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza.length > 0 
                  ? currentUser.karnetyKlubowicza[0].nazwa 
                  : (currentUser.pass || 'Brak aktywnego karnetu')}
              </h3>
              <div className="flex flex-wrap gap-2">
                <span className="bg-slate-100 text-slate-700 px-4 py-1.5 rounded-full text-xs font-bold border border-slate-200">
                  Aktywne zapisy: {prawdziweZapisyKlubowicza}
                </span>
                {currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza.length > 0 && (
                  <span className="bg-slate-100 text-slate-700 px-4 py-1.5 rounded-full text-xs font-bold border border-slate-200">
                    Ważny do: {currentUser.karnetyKlubowicza[0].waznyDo}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end">
              <button 
                onClick={() => setIsBuyPassModalOpen(true)}
                className="bg-white border border-slate-300 text-slate-800 font-bold px-6 py-2.5 rounded-full shadow-sm text-xs hover:bg-slate-100 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span className="text-slate-500 font-serif">$</span> KUP KARNET
              </button>
            </div>
          </div>
        </section>

      </div>
    )}
    {/* ZMODYFIKOWANY NAGŁÓWEK GRAFIKU DOPASOWANY DO ZDJĘCIA */}
    <section className="space-y-4">
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 ${appRole === 'admin' ? 'bg-white border border-sky-200 p-4 rounded-2xl shadow-sm' : 'mt-8'}`}>
      <h2 className={`font-medium uppercase tracking-wider ${appRole === 'klubowicz' ? 'text-[13px] text-slate-500 pl-1' : 'text-base sm:text-lg font-black text-sky-950'}`}>
        {appRole === 'klubowicz' ? 'Grafik' : 'GRAFIK ZAJĘĆ'}
      </h2>
      
      <div className="flex items-center justify-center gap-4 bg-white border border-slate-200 rounded-3xl p-2.5 shadow-sm self-start md:self-auto w-full md:w-auto">
        <button onClick={() => shiftWeek(-1)} className="w-10 h-10 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105 cursor-pointer shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        
        <div className="flex flex-col items-center min-w-[150px]">
          <label className="cursor-pointer flex flex-col items-center group relative">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider text-center group-hover:text-sky-600 transition-colors">
              {(() => {
                const d1 = getMonday(selectedWeekDate);
                const d2 = new Date(d1); d2.setDate(d2.getDate() + 4);
                return `${d1.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} - ${d2.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}`;
              })()}
            </span>
            <div className="mt-1.5 p-1.5 bg-slate-100 rounded-full border border-slate-200 shadow-sm group-hover:bg-sky-50 transition-colors">
              ✏️
            </div>
            <input 
              type="date" 
              className="absolute opacity-0 inset-0 w-full h-full cursor-pointer" 
              value={selectedWeekDate.toISOString().split('T')[0]} 
              onChange={handleDateChange} 
            />
          </label>
        </div>

        <button onClick={() => shiftWeek(1)} className="w-10 h-10 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105 cursor-pointer shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
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
    const isPastDay = col.isoDate < todayStr;
    const hasAnyItems = zajeciaDnia.length > 0 || aktywneWydarzeniaDnia.length > 0;
    const isExpanded = expandedDays[col.isoDate] || false;

    const renderEventsAndClasses = () => (
      <>
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
        const isPastTime = col.isoDate === todayStr && (item.start < currentTimeStr);
        const isPastEvent = isPastDay || isPastTime;
        const isLockedForClient = appRole === 'klubowicz' && isPastEvent;
        return (
        <div
        key={classIdx}
        onClick={() => {
        if (item.isOdwołane || item.isUsunięte) return;
        if (isLockedForClient) {
        alert("Te zajęcia już się odbyły. Zapisy oraz wypisy nie są już możliwe.");
        return;
        }
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
        item.isOdwołane || item.isUsunięte
        ? 'border-rose-200 opacity-80 cursor-default'
        : isLockedForClient
        ? 'border-slate-200 opacity-60 cursor-not-allowed grayscale-[30%]'
        : 'border-sky-100 cursor-pointer hover:border-sky-300 hover:shadow-md'
        }`}
        >
        <div className="flex justify-between items-start">
        <div>
        <span className="text-base font-black text-slate-900">{item.start}</span>
        <h3 className="text-xs font-bold text-slate-800 mt-0.5">{item.title}</h3>
        </div>
        {isLockedForClient && !item.isOdwołane && !item.isUsunięte && (
        <div className="text-slate-400 text-sm" title="Zajęcia zablokowane (minęły)">
        🔒
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
      </>
    );

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
    
    {isPastDay && hasAnyItems ? (
      <div className="space-y-3">
        <button onClick={() => toggleDay(col.isoDate)} className="w-full bg-slate-200/60 hover:bg-slate-300/80 text-slate-600 font-bold text-[10px] uppercase tracking-wider py-2 rounded-xl flex items-center justify-center transition-colors cursor-pointer border border-slate-200">
          {isExpanded ? 'Zwiń minione zajęcia ⌃' : `Pokaż minione zajęcia (${zajeciaDnia.length + aktywneWydarzeniaDnia.length}) ⌄`}
        </button>
        {isExpanded && (
          <div className="space-y-3 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {renderEventsAndClasses()}
          </div>
        )}
      </div>
    ) : (
      renderEventsAndClasses()
    )}
    </div>
    );
    })}
    </div>
    </section>
    {appRole === 'admin' && (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-4">
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
    <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex justify-between items-center text-xs">
          <span className="text-emerald-900 font-bold uppercase tracking-wider text-[10px]">Łączny przychód:</span>
          <span className="font-black text-sm text-emerald-700">
            +{totalEarnings.toFixed(2)} PLN
          </span>
        </div>
        <div className="text-[11px] max-h-60 overflow-y-auto pr-2">
          <div className="flex justify-between text-slate-500 pb-2 border-b border-sky-100 font-bold sticky top-0 bg-white z-10 uppercase tracking-wider text-[9px]">
            <span className="w-1/2">Karnet</span>
            <span className="w-1/4 text-center">Ilość</span>
            <span className="w-1/4 text-right">Zysk brutto</span>
          </div>
          {groupedSalesArray.length === 0 ? (
            <div className="flex justify-between text-slate-400 py-6 border-b border-slate-100 text-center">
              <span className="w-full">Brak sprzedanych karnetów w tym okresie.</span>
            </div>
          ) : (
            groupedSalesArray.map((sale, idx) => (
              <div key={idx} className="flex justify-between items-center text-slate-700 py-3 border-b border-slate-100">
                <span className="w-1/2 font-bold truncate pr-2 text-sky-950" title={sale.name}>{sale.name}</span>
                <span className="w-1/4 text-center font-black bg-slate-100 text-slate-600 rounded-md py-0.5">{sale.count} szt.</span>
                <span className="w-1/4 text-right font-black text-emerald-600">
                  +{sale.total.toFixed(2)} PLN
                </span>
              </div>
            ))
          )}
          <div className="flex justify-between items-center text-slate-900 pt-4 font-black text-xs sticky bottom-0 bg-white">
            <span className="uppercase tracking-wider">Suma zysków:</span>
            <span className="text-emerald-700 text-sm">
              +{totalEarnings.toFixed(2)} PLN
            </span>
          </div>
        </div>
    </div>
    </section>
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
    const aktywnyKarnetZawieszony = (client.karnetyKlubowicza || []).find((k: any) => k.zawieszonyOd);
    const aktywnaBlokada = (client.karnetyKlubowicza || []).find((k: any) => k.blokadaDo && k.blokadaDo >= todayStr);
    let ostatecznaData = 'Brak';
    let badgeColorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (maKarnet) {
    const earliestPass = client.karnetyKlubowicza.reduce((earliest: any, k: any) => {
    if (!earliest) return k;
    return (k.waznyDo < earliest.waznyDo) ? k : earliest;
    }, null);
    if (earliestPass) {
    ostatecznaData = earliestPass.waznyDo;
    let isPending = earliestPass.statusTekst?.includes('Oczekujący');
    let isExpiring = false;
    if (!isPending) {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const expDate = new Date(earliestPass.waznyDo);
    expDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 5) isExpiring = true;
    if (earliestPass.pozostaloWejsc !== null && earliestPass.pozostaloWejsc !== undefined) {
    if (earliestPass.pozostaloWejsc <= 2) isExpiring = true;
    }
    }
    if (isPending) {
    badgeColorClass = 'bg-amber-100 text-amber-800 border-amber-200';
    } else if (isExpiring) {
    badgeColorClass = 'bg-rose-100 text-rose-800 border-rose-200';
    }
    }
    }
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
    <span className="text-[10px] text-slate-500 block mt-0.5">📞 {client.phone || 'Brak telefonu'}</span>
    </div>
    </div>
    <div className="flex items-center gap-1.5 text-slate-400 text-xs">
    <button onClick={() => setTableActionClient(client)} className="hover:text-slate-700 cursor-pointer p-1.5 bg-white border border-slate-200 rounded-md shadow-sm" title="Zarządzaj klubowiczem">✏️</button>
    </div>
    </div>
    <div className="text-[11px] font-bold text-sky-900 pl-1 flex flex-col gap-1 items-start">
    <div className="flex flex-wrap gap-2 items-center">
    <span>Karnet: {nazwaKarnetu}</span>
    {maKarnet && (
    <span className={`px-2 py-0.5 rounded-md border text-[9px] uppercase tracking-wider ${badgeColorClass}`}>
    Wygasa: {ostatecznaData}
    </span>
    )}
    </div>
    {aktywnyKarnetZawieszony && (
    <span className="bg-amber-100 text-amber-900 text-[9px] uppercase tracking-wider font-black px-2 py-0.5 rounded border border-amber-200">
    ⏸️ Zawieszony od: {aktywnyKarnetZawieszony.zawieszonyOd}
    </span>
    )}
    {aktywnaBlokada && (
    <span className="bg-rose-100 text-rose-800 text-[9px] uppercase tracking-wider font-black px-2 py-0.5 rounded border border-rose-200">
    ⚠️ Zablokowane: {aktywnaBlokada.blokadaOd ? `od ${aktywnaBlokada.blokadaOd} ` : ''}do {aktywnaBlokada.blokadaDo}
    </span>
    )}
    </div>
    <div className="flex flex-wrap items-center gap-2">
    {aktywnaBlokada ? (
      <span className="px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider bg-rose-100 text-rose-800 border border-rose-200 uppercase">
        ZABLOKOWANE
      </span>
    ) : aktywnyKarnetZawieszony ? (
      <span className="px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider bg-amber-100 text-amber-900 border border-amber-300 uppercase">
        ZAWIESZONY
      </span>
    ) : (
      <span className="px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
        {client.status || 'AKTYWNY'}
      </span>
    )}
    </div>
    </div>
    );
    })
    )}
    </div>
    </div>
    </section>
    </div>
    )}
    {isBuyPassModalOpen && (
    <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
    <div className="flex items-center justify-between border-b border-sky-100 pb-3">
    <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🎟️ Kup / Przedłuż karnet</h3>
    <button onClick={() => setIsBuyPassModalOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
    </div>
    <form onSubmit={handleBuyPassSubmit} className="space-y-4 text-xs">
    <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-sky-900 font-medium">
    Wybierz karnet, aby opłacić go ze środków w portfelu lub przypisać do konta.
    </div>
    <div className="space-y-1">
    <label className="font-bold text-slate-700 block">Wybierz karnet *</label>
    <select
    required
    value={selectedBuyPass}
    onChange={(e) => setSelectedBuyPass(e.target.value)}
    className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-3 font-bold focus:outline-none focus:border-blue-500 cursor-pointer text-slate-800"
    >
    <option value="" disabled>-- Wybierz karnet --</option>
    {dostepneKarnety.map(k => {
    const activeRabat = currentUser?.rabat || 0;
    const dPrice = (parseFloat(k.cena) * (1 - activeRabat/100)).toFixed(2);
    return <option key={k.id} value={k.nazwa}>{k.nazwa} (Cena: {dPrice} PLN)</option>;
    })}
    </select>
    </div>
    {currentUser?.karnetyKlubowicza?.length > 0 && (
    <div className="space-y-2 pt-2 border-t border-sky-100">
    <label className="font-bold text-slate-700 block mt-2">Kiedy karnet ma zacząć obowiązywać?</label>
    <div className="space-y-2">
    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${activationMode === 'today' ? 'bg-sky-50 border-blue-400' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
    <input
    type="radio"
    name="activationMode"
    value="today"
    checked={activationMode === 'today'}
    onChange={() => setActivationMode('today')}
    className="w-4 h-4 accent-blue-600 cursor-pointer"
    />
    <div className="flex flex-col">
    <span className="font-bold text-slate-800">Od dzisiaj</span>
    <span className="text-[10px] text-slate-500">Karnet zostanie aktywowany natychmiast</span>
    </div>
    </label>
    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${activationMode === 'after' ? 'bg-sky-50 border-blue-400' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
    <input
    type="radio"
    name="activationMode"
    value="after"
    checked={activationMode === 'after'}
    onChange={() => setActivationMode('after')}
    className="w-4 h-4 accent-blue-600 cursor-pointer"
    />
    <div className="flex flex-col">
    <span className="font-bold text-slate-800">Przedłużenie (Oczekujący)</span>
    <span className="text-[10px] text-slate-500">Zacznie obowiązywać po wygaśnięciu obecnego</span>
    </div>
    </label>
    </div>
    </div>
    )}
    <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
    <button type="button" onClick={() => setIsBuyPassModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer">
    Anuluj
    </button>
    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer">
    Kupuję i zatwierdzam
    </button>
    </div>
    </form>
    </div>
    </div>
    )}
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
    const isUserSignedUp = currentUser && zapisaniWszyscy.some((u: any) => String(u.id) === String(currentUser.id));
    const filteredSuggestions = klienciList
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
    className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full flex items-center justify-center font-bold transition-colors cursor-pointer"
    >
    ✕
    </button>
    </div>
    </div>
    <div className="space-y-3">
    <h4 className="font-black text-xs text-slate-500 uppercase tracking-wider">Główna lista uczestników</h4>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {listaGlowna.map((osobaZapisana) => {
    const osoba = klienciList.find(c => c.id === osobaZapisana.id) || osobaZapisana;
    const prawdziweZapisy = getPrawdziweAktywneZapisy(osoba.id);
    const stanPortfelaStr = String(osoba.wallet || '0').replace(/[^0-9.-]+/g, '');
    const stanPortfela = parseFloat(stanPortfelaStr) || 0;
    let portfelColorClass = 'text-slate-500';
    if (stanPortfela > 0) {
    portfelColorClass = 'text-emerald-600 font-bold';
    } else if (stanPortfela < 0) {
    portfelColorClass = 'text-rose-600 font-bold';
    }
    const isMe = currentUser && String(osoba.id) === String(currentUser.id);
    const canSeeDetails = appRole === 'admin' || isMe;
    const displayName = canSeeDetails
    ? `${osoba.firstName} ${osoba.lastName}`
    : `${osoba.firstName} ${osoba.lastName ? osoba.lastName.charAt(0) + '.' : ''}`;
    return (
    <div key={osoba.id} className="bg-white border border-sky-200 rounded-2xl p-4 shadow-sm relative flex flex-col justify-between space-y-4">
    <div className="flex items-start justify-between">
    <div>
    <h4 className="font-black text-slate-900 text-sm">{displayName}</h4>
    {canSeeDetails && (
    <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
    <div><span className="font-bold text-slate-700">KARNET:</span> {osoba.pass || 'OPEN'}</div>
    <div><span className="font-bold text-slate-700">WAŻNOŚĆ:</span> {osoba.expiresDate || '2026-09-01'}</div>
    <div>aktywne zapisy: <strong className="text-sky-900">{prawdziweZapisy}</strong></div>
    <div>
    <span className="font-bold text-slate-700">PORTFEL:</span>{' '}
    <span className={portfelColorClass}>{osoba.wallet || '0.00 PLN'}</span>
    </div>
    {osoba.blokadaDo && osoba.blokadaDo >= todayStr && (
    <div className="text-rose-600 font-bold mt-1 bg-rose-50 p-1.5 rounded border border-rose-100">
    ⚠️ {osoba.powodBlokady || `Blokada zapisów do ${osoba.blokadaDo}`}
    </div>
    )}
    </div>
    )}
    </div>
    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-sky-100 border-2 border-amber-500 overflow-hidden flex items-center justify-center font-bold text-sky-900 text-5xl shrink-0 shadow-sm">
    {osoba.avatarUrl ? (
    <img src={osoba.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
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
    {listaKrzesełko.length > 0 && (
    <div className="space-y-3 pt-4 border-t border-sky-200">
    <h4 className="font-black text-xs text-blue-900 uppercase tracking-wider flex items-center gap-2">
    <span>🪑</span> Lista rezerwowa (Krzesełko) - {listaKrzesełko.length} osób
    </h4>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {listaKrzesełko.map((osobaZapisana, idx) => {
    const osoba = klienciList.find(c => c.id === osobaZapisana.id) || osobaZapisana;
    const prawdziweZapisy = getPrawdziweAktywneZapisy(osoba.id);
    const stanPortfelaStr = String(osoba.wallet || '0').replace(/[^0-9.-]+/g, '');
    const stanPortfela = parseFloat(stanPortfelaStr) || 0;
    let portfelColorClass = 'text-slate-500';
    if (stanPortfela > 0) {
    portfelColorClass = 'text-emerald-600 font-bold';
    } else if (stanPortfela < 0) {
    portfelColorClass = 'text-rose-600 font-bold';
    }
    const isMe = currentUser && String(osoba.id) === String(currentUser.id);
    const canSeeDetails = appRole === 'admin' || isMe;
    const displayName = canSeeDetails
    ? `${osoba.firstName} ${osoba.lastName}`
    : `${osoba.firstName} ${osoba.lastName ? osoba.lastName.charAt(0) + '.' : ''}`;
    return (
    <div key={osoba.id} className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 shadow-sm relative flex flex-col justify-between space-y-4">
    <div className="flex items-start justify-between">
    <div>
    <div className="flex items-center gap-2">
    <h4 className="font-black text-slate-900 text-sm">{displayName}</h4>
    <span className="bg-blue-200 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded">
    #{idx + 1}
    </span>
    </div>
    {canSeeDetails && (
    <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
    <div><span className="font-bold text-slate-700">KARNET:</span> {osoba.pass || 'OPEN'}</div>
    <div><span className="font-bold text-slate-700">WAŻNOŚĆ:</span> {osoba.expiresDate || '2026-09-01'}</div>
    <div>aktywne zapisy: <strong className="text-sky-900">{prawdziweZapisy}</strong></div>
    <div>
    <span className="font-bold text-slate-700">PORTFEL:</span>{' '}
    <span className={portfelColorClass}>{osoba.wallet || '0.00 PLN'}</span>
    </div>
    </div>
    )}
    </div>
    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blue-100 border-2 border-blue-500 overflow-hidden flex items-center justify-center font-bold text-blue-900 text-5xl shrink-0 shadow-sm">
    {osoba.avatarUrl ? (
    <img src={osoba.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
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
    {appRole === 'klubowicz' ? (
    <div className="pt-2">
    {selectedClass.isLockedForClient ? (
    <div className="w-full bg-slate-100 border border-slate-200 text-slate-500 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider text-center shadow-sm">
    🔒 Czas na zapisy/wypisy minął (Zajęcia historyczne)
    </div>
    ) : !isUserSignedUp ? (
    (() => {
    const wVal = parseFloat(String(currentUser?.wallet || currentUser?.Portfel || '0').replace(/[^0-9.-]+/g, "")) || 0;
    if (wVal < 0) {
    return (
    <div className="w-full bg-rose-50 border border-rose-200 text-rose-800 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider text-center shadow-sm">
    💸 Zablokowane: Ureguluj portfel ({currentUser.wallet || currentUser.Portfel})
    </div>
    );
    }
    return (
    <button
    onClick={handleKlubowiczZapiszSie}
    className={`w-full font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer ${
    isFull
    ? 'bg-blue-600 hover:bg-blue-700 text-white'
    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
    }`}
    >
    {isFull ? '🪑 Zapisz się na listę rezerwową (Krzesełko)' : '✅ Zapisz się na zajęcia'}
    </button>
    );
    })()
    ) : (
    <button
    onClick={handleKlubowiczWypiszSie}
    className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
    >
    ❌ Wypisz się z zajęć
    </button>
    )}
    </div>
    ) : (
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
    <button onClick={() => setIsSearchingClient(false)} className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer">Anuluj</button>
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
    {klient.blokadaDo && klient.blokadaDo >= todayStr && (
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
    <div className="flex justify-end pt-2 border-t border-sky-200 mt-2">
    <button
    onClick={() => setSelectedClass(null)}
    className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-6 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
    >
    Zamknij
    </button>
    </div>
    </div>
    </div>
    );
    })()}
{tableActionClient && (
<div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
<div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 border border-sky-200 relative">
<div className="flex items-center justify-between border-b border-slate-100 pb-4">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-base">
👤
</div>
<div className="text-xs space-y-0.5">
<div className="font-black text-slate-900 text-sm whitespace-nowrap">{tableActionClient.firstName} {tableActionClient.lastName}</div>
<div className="font-mono text-slate-600 flex items-center gap-1.5"><span>📞</span> {tableActionClient.phone || 'Nie podano'}</div>
<div className="text-slate-500 flex items-center gap-1.5 whitespace-nowrap"><span>✉️</span> {tableActionClient.email || 'Nie podano'}</div>
</div>
</div>
<button onClick={() => setTableActionClient(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer">✕</button>
</div>
<div className="space-y-2">
<div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Klubowicz</div>
<div className="grid grid-cols-4 gap-2 text-xs font-bold text-slate-700 text-center">
<button onClick={() => { openProfile(tableActionClient); setTableActionClient(null); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
<span className="text-base">✏️</span> Edytuj
</button>
<button onClick={() => { alert("Sprzedaj produkt"); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
<span className="text-base">🛒</span> Sprzedaj produkt
</button>
<button onClick={() => { alert("Dodaj zadanie"); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
<span className="text-base">➕</span> Dodaj zadanie
</button>
<button onClick={() => { alert("Link do płatności"); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
<span className="text-base">💲</span> Link do płatności
</button>
<button onClick={() => { alert("Wyślij wiadomość"); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
<span className="text-base">✉️</span> Wyślij wiadomość
</button>
<button onClick={() => { alert("Resetuj hasło"); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
<span className="text-base">🔑</span> Resetuj hasło
</button>
<button onClick={() => { alert("Zamień w gościa"); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer col-span-2">
<span className="text-base">👤</span> Zamień w gościa
</button>
</div>
</div>
<div className="space-y-2">
<div className="flex justify-between items-center text-xs">
<div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{tableActionClient.karnetyKlubowicza && tableActionClient.karnetyKlubowicza.length > 0 ? tableActionClient.karnetyKlubowicza.map((k:any)=>k.nazwa).join(', ') : 'Brak karnetu'}</div>
<div className="bg-slate-100 px-3 py-1 rounded-xl text-slate-700 font-semibold whitespace-nowrap">
<div>Ważny do: {tableActionClient.karnetyKlubowicza && tableActionClient.karnetyKlubowicza.length > 0 ? tableActionClient.karnetyKlubowicza[0].waznyDo : '-'}</div>
<div className="text-[10px] text-slate-500">Cena: {tableActionClient.price || '0.00 PLN'}</div>
</div>
</div>
<div className="grid grid-cols-3 gap-2 text-xs font-bold text-slate-700 text-center">
<button onClick={() => { 
openProfile(tableActionClient); 
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
openProfile(tableActionClient); 
if(tableActionClient.karnetyKlubowicza?.length > 0) {
setSuspendPassTarget(tableActionClient.karnetyKlubowicza[0]);
setSuspendStartDate(tableActionClient.karnetyKlubowicza[0].zawieszonyOd || todayStr);
setSuspendEndDate(tableActionClient.karnetyKlubowicza[0].zawieszonyDo || todayStr);
setBlockPassStartDate(tableActionClient.karnetyKlubowicza[0].blokadaOd || todayStr);
setBlockPassEndDate(tableActionClient.karnetyKlubowicza[0].blokadaDo || todayStr);
setBlockMode('days');
}
setIsSuspendModalOpen(true); 
setTableActionClient(null); 
}} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
<span className="text-base">⏸️</span> Status karnetu
</button>
<button onClick={() => { openProfile(tableActionClient); setIsSuspendHistoryModalOpen(true); setTableActionClient(null); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
<span className="text-base">📜</span> Historia zawieszeń
</button>
</div>
</div>
<div className="space-y-2 pt-2 border-t border-slate-100">
<div className="text-[10px] font-black text-rose-500 uppercase tracking-wider flex items-center gap-1"><span>⚠️</span> DANGER ZONE</div>
<div className="grid grid-cols-3 gap-2 text-xs font-bold text-rose-800 text-center">
<button onClick={handleDeactivateClient} className="p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
<span className="text-base">🔒</span> Dezaktywuj
</button>
<button onClick={handleDeactivateClientOnDate} className="p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
<span className="text-base">🔒</span> Dezaktywuj w konkretnym dniu
</button>
<button onClick={() => handleDeleteClient(tableActionClient.id)} className="p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
<span className="text-base">🗑️</span> Całkowicie usuń konto
</button>
</div>
</div>
</div>
</div>
)}
{profileClient && (
<div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-end backdrop-blur-sm animate-in fade-in">
<div className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col overflow-y-auto">
<div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white sticky top-0 z-20">
<button onClick={() => setProfileClient(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer">✕</button>
<div className="flex items-center gap-3">
<button onClick={() => setIsWalletHistoryOpen(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer whitespace-nowrap">🕒 LOGI UŻYTKOWNIKA</button>
</div>
</div>
<div className="p-6 space-y-8 flex-1">
<div className="flex justify-between items-start gap-6 bg-slate-50/70 border border-slate-200 rounded-2xl p-6">
<div className="space-y-3">
<div className="flex items-center gap-3">
<h2 className="text-xl font-black text-slate-900 whitespace-nowrap">{profileClient.firstName} {profileClient.lastName}</h2>
<button
onClick={() => setIsEditProfileInfoOpen(true)}
className="w-8 h-8 bg-white hover:bg-sky-50 text-slate-700 rounded-xl border border-slate-200 flex items-center justify-center text-xs shadow-sm cursor-pointer transition-all"
title="Edytuj dane konta"
>
✏️
</button>
</div>
<div className="pt-1">
<button
onClick={() => handleToggleClientTrainer(profileClient)}
className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
profileClient.isTrainer
? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
: 'bg-sky-100 text-sky-900 border border-sky-300 hover:bg-sky-200'
}`}
>
<span>{profileClient.isTrainer ? '⭐ Klient jest trenerem (Kliknij, aby usunąć powiązanie)' : '➕ Oznacz jako Trener w zespole'}</span>
</button>
</div>
<div className="text-xs text-slate-600 space-y-1 pt-2">
<div><span className="font-semibold">Telefon:</span> <span className="whitespace-nowrap">{profileClient.phone ? profileClient.phone : 'Nie podano'}</span></div>
<div><span className="font-semibold">Email:</span> <span className="whitespace-nowrap">{profileClient.email ? profileClient.email : 'Nie podano'}</span></div>
<div><span className="font-semibold">Płeć:</span> <span className="whitespace-nowrap">{profileClient.gender ? profileClient.gender : 'Nie podano'}</span></div>
<div><span className="font-semibold">Urodziny:</span> <span className="whitespace-nowrap">{profileClient.birthDate ? profileClient.birthDate : 'Nie podano'}</span></div>
</div>
</div>
<div className="flex flex-col items-center gap-2">
<div className="w-28 h-28 rounded-full bg-slate-900 text-white font-black flex items-center justify-center text-3xl overflow-hidden border-2 border-sky-300 shadow-md">
{profileClient.avatarUrl ? (
<img src={profileClient.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
) : profileClient.gender?.toLowerCase() === 'mężczyzna' || profileClient.gender?.toLowerCase() === 'm' ? (
<span>👨</span>
) : profileClient.gender?.toLowerCase() === 'kobieta' || profileClient.gender?.toLowerCase() === 'k' ? (
<span>👩</span>
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
className="bg-white hover:bg-sky-50 text-sky-900 px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-200 shadow-sm cursor-pointer transition-all whitespace-nowrap"
>
✏️ Edytuj zdjęcie
</button>
</div>
</div>
<div className="space-y-4">
<div className="flex items-center justify-between flex-wrap gap-4">
<div className="flex items-center gap-4 flex-wrap">
<h3 className="font-black text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">Karnety klubowicza</h3>
<div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
<span className="text-[10px] font-bold text-emerald-800 uppercase">Stały rabat:</span>
{isEditingDiscount ? (
<div className="flex items-center gap-1">
<input
type="number"
className="w-14 bg-white border border-emerald-300 rounded px-1 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
value={discountInput}
onChange={e => setDiscountInput(e.target.value)}
placeholder="%"
/>
<span className="text-[10px] font-bold text-emerald-800">%</span>
<button onClick={handleSaveDiscount} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ml-1">Zapisz</button>
<button onClick={() => setIsEditingDiscount(false)} className="text-emerald-700 hover:text-emerald-900 text-[10px] font-bold cursor-pointer px-1">✕</button>
</div>
) : (
<div className="flex items-center gap-1.5 cursor-pointer group" onClick={() => { setDiscountInput(profileClient.discount || ''); setIsEditingDiscount(true); }}>
<span className="font-black text-emerald-700 text-xs">{profileClient.discount && profileClient.discount !== '0' ? `${profileClient.discount}% (Priorytet)` : 'Brak'}</span>
<span className="opacity-40 group-hover:opacity-100 text-xs transition-opacity">✏️</span>
</div>
)}
</div>
<div className="flex items-center gap-2 bg-sky-50 px-3 py-1 rounded-lg border border-sky-200" title="Naliczany automatycznie, z możliwością ręcznej modyfikacji i dalszego ciągłego naliczania">
<span className="text-[10px] font-bold text-sky-800 uppercase">Rabat za ciągłość:</span>
{isEditingSystemDiscount ? (
<div className="flex items-center gap-1">
<input
type="number"
className="w-14 bg-white border border-sky-300 rounded px-1 text-xs font-bold text-slate-800 outline-none focus:border-sky-500"
value={systemDiscountInput}
onChange={e => setSystemDiscountInput(e.target.value)}
placeholder="%"
/>
<span className="text-[10px] font-bold text-sky-800">%</span>
<button onClick={handleSaveSystemDiscount} className="bg-sky-600 hover:bg-sky-700 text-white text-[10px] px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ml-1">Zapisz</button>
<button onClick={() => setIsEditingSystemDiscount(false)} className="text-sky-700 hover:text-sky-900 text-[10px] font-bold cursor-pointer px-1">✕</button>
</div>
) : (
<div className="flex items-center gap-1.5 cursor-pointer group" onClick={() => { setSystemDiscountInput(calculateSystemDiscount(profileClient).toString()); setIsEditingSystemDiscount(true); }}>
<span className="font-black text-sky-700 text-xs">{calculateSystemDiscount(profileClient)}%</span>
<span className="opacity-40 group-hover:opacity-100 text-xs transition-opacity">✏️</span>
</div>
)}
</div>
</div>
<div className="flex items-center gap-2">
<button
onClick={() => { setSelectedPassToAdd(dostepneKarnety[0]?.nazwa || ''); setIsAddSecondPassModalOpen(true); }}
className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm whitespace-nowrap"
>
+ DODAJ DRUGI KARNET
</button>
<div className="relative">
<button
onClick={() => setIsGlobalPassMenuOpen(!isGlobalPassMenuOpen)}
className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 flex items-center justify-center font-bold cursor-pointer shadow-sm"
title="Zarządzaj karnetem"
>
✏️
</button>
{isGlobalPassMenuOpen && (
<div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-[70] text-xs">
<button onClick={() => {
if(profileClient.karnetyKlubowicza?.length > 0) {
setExtendPassTarget(profileClient.karnetyKlubowicza[0]);
setExtendSelectedNewPassName(profileClient.karnetyKlubowicza[0].nazwa);
const curDate = new Date(profileClient.karnetyKlubowicza[0].waznyDo || Date.now());
curDate.setMonth(curDate.getMonth() + 1);
setExtendNewDate(curDate.toISOString().split('T')[0]);
setIsExtendPassModalOpen(true);
} else {
alert("Brak aktywnego karnetu do przedłużenia.");
}
setIsGlobalPassMenuOpen(false);
}} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer whitespace-nowrap">🕒 Przedłuż karnet</button>
<button onClick={() => { alert("Umowa wypowiedziana"); setIsGlobalPassMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer whitespace-nowrap">📄 Wypowiedz umowę</button>
<button onClick={() => {
if(profileClient.karnetyKlubowicza?.length > 0) {
setSuspendPassTarget(profileClient.karnetyKlubowicza[0]);
setSuspendStartDate(profileClient.karnetyKlubowicza[0].zawieszonyOd || todayStr);
setSuspendEndDate(profileClient.karnetyKlubowicza[0].zawieszonyDo || todayStr);
setSuspendPassDays('3');
setSuspendMode('days');
setBlockPassStartDate(profileClient.karnetyKlubowicza[0].blokadaOd || todayStr);
setBlockPassEndDate(profileClient.karnetyKlubowicza[0].blokadaDo || todayStr);
setBlockMode('days');
setIsSuspendModalOpen(true);
}
setIsGlobalPassMenuOpen(false);
}} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer whitespace-nowrap">⚙️ Status karnetu</button>
<button onClick={() => { setIsSuspendHistoryModalOpen(true); setIsGlobalPassMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer whitespace-nowrap">📜 Historia zawieszeń</button>
<button onClick={() => { alert("Wygenerowano link do płatności"); setIsGlobalPassMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer whitespace-nowrap">💳 Wygeneruj link do płatności</button>
<div className="border-t border-slate-100 my-1"></div>
<button onClick={() => { if(profileClient.karnetyKlubowicza?.length > 0) handleConfirmDeletePass(profileClient.karnetyKlubowicza[0].id); setIsGlobalPassMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2.5 cursor-pointer whitespace-nowrap">🗑️ Usuń karnet</button>
</div>
)}
</div>
</div>
</div>
<div className="space-y-3">
{profileClient.karnetyKlubowicza && profileClient.karnetyKlubowicza.length > 0 ? (
[...profileClient.karnetyKlubowicza]
.sort((a: any, b: any) => (a.waznyDo || '9999-12-31').localeCompare(b.waznyDo || '9999-12-31'))
.map((karnet: any) => {
let isExpiring = false;
let isPending = karnet.statusTekst?.includes('Oczekujący');
const czyZawieszony = !!karnet.zawieszonyOd;
if (!isPending) {
if (karnet.waznyDo) {
const todayDate = new Date();
todayDate.setHours(0, 0, 0, 0);
const expDate = new Date(karnet.waznyDo);
expDate.setHours(0, 0, 0, 0);
const diffDays = Math.ceil((expDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
if (diffDays <= 5) {
isExpiring = true;
}
}
if (karnet.pozostaloWejsc !== null && karnet.pozostaloWejsc !== undefined) {
if (karnet.pozostaloWejsc <= 2) {
isExpiring = true;
}
}
}
let statusColorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
if (isPending) {
statusColorClass = 'bg-amber-100 text-amber-800 border-amber-200';
} else if (isExpiring) {
statusColorClass = 'bg-rose-100 text-rose-800 border-rose-200';
}
return (
<div key={karnet.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 relative">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
<div className="space-y-2">
<div className="flex flex-wrap items-center gap-2">
<h4 className="font-black text-slate-900 text-base">{karnet.nazwa}</h4>
{karnet.blokadaDo && karnet.blokadaDo >= todayStr && (
<span className="bg-rose-100 text-rose-800 text-xs font-black px-2.5 py-1 rounded border border-rose-200">
⚠️ Zablokowane: {karnet.blokadaOd ? `od ${karnet.blokadaOd} ` : ''}do {karnet.blokadaDo}
</span>
)}
</div>
<div className="flex flex-wrap items-center gap-2">
<span className={`${statusColorClass} text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap`}>
{karnet.statusTekst || `Ważny do: ${karnet.waznyDo}`}
</span>
<span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
Cena: {karnet.cena} {karnet.znizkaProcentowa ? ` ${karnet.znizkaProcentowa}` : ''}
</span>
</div>
</div>
<div className="flex items-center gap-2">
{czyZawieszony ? (
<button
onClick={() => handleOdwiesKarnet(karnet)}
className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-200 cursor-pointer shadow-sm whitespace-nowrap"
>
▶️ ODWIEŚ KARNET
</button>
) : (
<button
onClick={() => {
setSuspendPassTarget(karnet);
setSuspendStartDate(todayStr);
setSuspendEndDate(todayStr);
setSuspendPassDays('3');
setSuspendMode('days');
setBlockPassStartDate(karnet.blokadaOd || todayStr);
setBlockPassEndDate(karnet.blokadaDo || todayStr);
setBlockMode('days');
setIsSuspendModalOpen(true);
}}
className="bg-rose-50 hover:bg-rose-100 text-rose-800 px-3.5 py-2 rounded-xl text-xs font-bold border border-rose-200 cursor-pointer shadow-sm"
>
⚙️ STATUS
</button>
)}
<button
onClick={() => {
setExtendPassTarget(karnet);
setExtendSelectedNewPassName(karnet.nazwa);
const curDate = new Date(karnet.waznyDo || Date.now());
curDate.setMonth(curDate.getMonth() + 1);
setExtendNewDate(curDate.toISOString().split('T')[0]);
setIsExtendPassModalOpen(true);
}}
className="bg-sky-50 hover:bg-sky-100 text-sky-800 px-3.5 py-2 rounded-xl text-xs font-bold border border-sky-200 cursor-pointer shadow-sm"
>
🕒 Przedłuż
</button>
<button
onClick={() => setEditingPassModal({ ...karnet })}
className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 flex items-center justify-center font-bold cursor-pointer shadow-sm"
title="Edytuj"
>
✏️
</button>
</div>
</div>
</div>
);
})
) : (
<div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs">
Brak przypisanych karnetów.
</div>
)}
</div>
<div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 mt-4">
<button
onClick={() => setIsPassHistoryOpen(!isPassHistoryOpen)}
className="w-full flex justify-between items-center text-xs font-black text-slate-700 uppercase tracking-wider cursor-pointer"
>
<span>📜 HISTORIA WSZYSTKICH KUPIONYCH KARNETÓW ({ (profileClient.transakcje || []).filter((t: any) => (t.typ_operacji === 'zakup_karnetu' || (t.opis && (t.opis.toLowerCase().includes('karnet') || t.opis.toLowerCase().includes('przedłużenie')))) && (!t.opis || !t.opis.toLowerCase().includes('usunięcie'))).length })</span>
<span>{isPassHistoryOpen ? '▲' : '▼'}</span>
</button>
{isPassHistoryOpen && (
<div className="space-y-2 pt-2 border-t border-slate-200 max-h-48 overflow-y-auto text-xs">
{(profileClient.transakcje || []).filter((t: any) => (t.typ_operacji === 'zakup_karnetu' || (t.opis && (t.opis.toLowerCase().includes('karnet') || t.opis.toLowerCase().includes('przedłużenie')))) && (!t.opis || !t.opis.toLowerCase().includes('usunięcie'))).length > 0 ? (
(profileClient.transakcje || [])
.filter((t: any) => (t.typ_operacji === 'zakup_karnetu' || (t.opis && (t.opis.toLowerCase().includes('karnet') || t.opis.toLowerCase().includes('przedłużenie')))) && (!t.opis || !t.opis.toLowerCase().includes('usunięcie')))
.map((t: any) => (
<div key={t.id} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200">
<div>
<div className="font-bold text-slate-900">{t.opis || 'Zakup karnetu'}</div>
<div className="text-[10px] font-mono text-slate-500">{new Date(t.created_at).toLocaleString('pl-PL')}</div>
</div>
<div className="font-black text-slate-800">{t.kwota !== null ? `${t.kwota} PLN` : ''}</div>
</div>
))
) : (
<div className="text-slate-400 italic text-center py-3">Brak historii zakupów karnetów w bazie transakcji.</div>
)}
</div>
)}
</div>
</div>
<div className="space-y-4">
<h3 className="font-black text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">Portfel</h3>
<div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex justify-between items-center">
{(() => {
const walletVal = parseFloat(String(profileClient.wallet).replace(/[^0-9.-]+/g, "")) || 0;
let walletClass = 'bg-slate-100 text-slate-800 border-slate-200';
if (walletVal < 0) walletClass = 'bg-rose-100 text-rose-800 border-rose-200';
else if (walletVal > 0) walletClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
return (
<span className={`font-black px-3 py-1 rounded-xl text-sm border whitespace-nowrap ${walletClass}`}>
{profileClient.wallet}
</span>
);
})()}
<div className="flex gap-3">
<button onClick={() => setIsWalletHistoryOpen(true)} className="text-slate-600 text-xs font-bold underline cursor-pointer whitespace-nowrap">🕒 POKAŻ HISTORIĘ PORTFELA I OPERACJI</button>
<button onClick={() => setIsTopUpWalletOpen(true)} className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-black cursor-pointer whitespace-nowrap">+ UZUPEŁNIJ PORTFEL</button>
</div>
</div>
</div>
<div className="space-y-4">
<h3 className="font-black text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">Zapisy na zajęcia</h3>
<div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
<div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
<button onClick={() => setActiveZapisyTab('nadchodzace')} className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer whitespace-nowrap ${activeZapisyTab === 'nadchodzace' ? 'border-amber-600 text-amber-700 font-black bg-white' : 'border-transparent hover:bg-slate-100'}`}>NADCHODZĄCE</button>
<button onClick={() => setActiveZapisyTab('przeszle')} className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer whitespace-nowrap ${activeZapisyTab === 'przeszle' ? 'border-amber-600 text-amber-700 font-black bg-white' : 'border-transparent hover:bg-slate-100'}`}>PRZESZŁE</button>
<button onClick={() => setActiveZapisyTab('wypisy')} className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer whitespace-nowrap ${activeZapisyTab === 'wypisy' ? 'border-amber-600 text-amber-700 font-black bg-white' : 'border-transparent hover:bg-slate-100'}`}>WYPISY</button>
<button onClick={() => setActiveZapisyTab('automatyczne')} className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer whitespace-nowrap ${activeZapisyTab === 'automatyczne' ? 'border-amber-600 text-amber-700 font-black bg-white' : 'border-transparent hover:bg-slate-100'}`}>AUTOMATYCZNE ZAPISY</button>
</div>
<div className="overflow-x-auto">
{activeZapisyTab === 'nadchodzace' && (
<table className="w-full text-left text-xs">
<thead>
<tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
<th className="py-2.5 px-4 w-10 whitespace-nowrap">#</th>
<th className="py-2.5 px-4 whitespace-nowrap">Data zajęć</th>
<th className="py-2.5 px-4 whitespace-nowrap">Zajęcia</th>
<th className="py-2.5 px-4 whitespace-nowrap">Karnet</th>
<th className="py-2.5 px-4 whitespace-nowrap">Kto zapisał</th>
<th className="py-2.5 px-4 text-right whitespace-nowrap">Wypisz</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100 text-slate-700">
{profileClient.zapisyNadchodzace && profileClient.zapisyNadchodzace.map((item: any, idx: number) => (
<tr key={item.id}>
<td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">{idx + 1}</td>
<td className="py-3 px-4 font-mono whitespace-nowrap">{item.data}</td>
<td className="py-3 px-4 font-bold whitespace-nowrap">{item.zajecia}</td>
<td className="py-3 px-4 font-semibold whitespace-nowrap">{item.karnet}</td>
<td className="py-3 px-4 whitespace-nowrap"><span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded text-[10px] font-bold border border-sky-200">{item.zapisujacy}</span></td>
<td className="py-3 px-4 text-right whitespace-nowrap"><button onClick={() => handleWypiszZajecia(item)} className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer" title="Wypisz">🗑️</button></td>
</tr>
))}
</tbody>
</table>
)}
{activeZapisyTab === 'przeszle' && (
<table className="w-full text-left text-xs">
<thead>
<tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
<th className="py-2.5 px-4 w-10 whitespace-nowrap">#</th>
<th className="py-2.5 px-4 whitespace-nowrap">Data zajęć</th>
<th className="py-2.5 px-4 whitespace-nowrap">Zajęcia</th>
<th className="py-2.5 px-4 whitespace-nowrap">Karnet</th>
<th className="py-2.5 px-4 whitespace-nowrap">Obecność</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100 text-slate-700">
{profileClient.zapisyPrzeszle && profileClient.zapisyPrzeszle.map((item: any, idx: number) => (
<tr key={item.id}>
<td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">{idx + 1}</td>
<td className="py-3 px-4 font-mono whitespace-nowrap">{item.data}</td>
<td className="py-3 px-4 font-bold whitespace-nowrap">{item.zajecia}</td>
<td className="py-3 px-4 font-semibold whitespace-nowrap">{item.karnet}</td>
<td className="py-3 px-4 whitespace-nowrap"><span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">{item.obecnosc}</span></td>
</tr>
))}
</tbody>
</table>
)}
{activeZapisyTab === 'wypisy' && (
<table className="w-full text-left text-xs">
<thead>
<tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
<th className="py-2.5 px-4 w-10 whitespace-nowrap">#</th>
<th className="py-2.5 px-4 whitespace-nowrap">Data zajęć</th>
<th className="py-2.5 px-4 whitespace-nowrap">Zajęcia</th>
<th className="py-2.5 px-4 whitespace-nowrap">Informacja</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100 text-slate-700">
{profileClient.zapisyWypisy && profileClient.zapisyWypisy.map((item: any, idx: number) => (
<tr key={item.id}>
<td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">{idx + 1}</td>
<td className="py-3 px-4 font-mono whitespace-nowrap">{item.data}</td>
<td className="py-3 px-4 font-bold whitespace-nowrap">{item.zajecia}</td>
<td className="py-3 px-4 whitespace-nowrap"><span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-200">{item.wypisujacy}</span></td>
</tr>
))}
</tbody>
</table>
)}
{activeZapisyTab === 'automatyczne' && (
<div className="p-8 text-center text-slate-400 text-xs">Brak automatycznych zapisów.</div>
)}
</div>
</div>
</div>
</div>
</div>
</div>
)}
{isExtendPassModalOpen && profileClient && extendPassTarget && (
<div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
<div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 border border-sky-200">
<div className="flex items-center justify-between border-b border-sky-100 pb-3">
<h3 className="font-black text-sm text-sky-950 uppercase tracking-wider flex items-center gap-2 whitespace-nowrap">
<span>🕒</span> Przedłuż karnet dla {profileClient.firstName} {profileClient.lastName}
</h3>
<button onClick={() => setIsExtendPassModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
</div>
<form onSubmit={handleConfirmExtendPass} className="space-y-4 text-xs">
<div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
<div className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Aktualny karnet</div>
<div className="font-bold text-slate-900 text-sm whitespace-nowrap">Karnet: {extendPassTarget.nazwa}</div>
<div className="font-mono text-slate-600 whitespace-nowrap">Wygasa: {extendPassTarget.waznyDo}</div>
</div>
<div className="flex justify-center">
<div className="w-7 h-7 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 font-bold">↓</div>
</div>
<div className="bg-sky-50/50 border border-sky-200 rounded-2xl p-4 space-y-3">
<div className="text-[10px] font-black text-sky-800 uppercase tracking-wider whitespace-nowrap">Nowy karnet</div>
<div className="flex items-center justify-between">
<div className="flex-1 whitespace-nowrap">
<span className="font-bold text-slate-700">Karnet: </span>
{isEditingNewPassType ? (
<select
value={extendSelectedNewPassName}
onChange={(e) => setExtendSelectedNewPassName(e.target.value)}
className="bg-white border border-sky-300 rounded-lg px-2 py-1 font-bold ml-2 text-slate-800 cursor-pointer"
>
{dostepneKarnety.map(k => {
const baseCena = parseFloat(k.cena) || 0;
let finalCena = baseCena;
let hasDiscount = false;
const activeDiscount = getEffectiveDiscount(profileClient);
if (activeDiscount > 0) {
finalCena = baseCena * (1 - activeDiscount / 100);
hasDiscount = true;
}
return (
<option key={k.id} value={k.nazwa}>
{k.nazwa} ({finalCena.toFixed(2)} PLN{hasDiscount ? ` - po rabacie ${activeDiscount}%` : ''})
</option>
);
})}
</select>
) : (
<span className="font-black text-slate-900 whitespace-nowrap">
{(() => {
const defKarnetu = dostepneKarnety.find(k => k.nazwa === extendSelectedNewPassName);
const baseCena = defKarnetu ? parseFloat(defKarnetu.cena) : parseFloat(extendPassTarget?.cena?.replace(/[^0-9.]/g, '') || '0');
let finalCena = baseCena;
let hasDiscount = false;
const activeDiscount = getEffectiveDiscount(profileClient);
if (activeDiscount > 0) {
finalCena = baseCena * (1 - activeDiscount / 100);
hasDiscount = true;
}
return `${extendSelectedNewPassName} (${finalCena.toFixed(2)} PLN${hasDiscount ? ` - po rabacie ${activeDiscount}%` : ''})`;
})()}
</span>
)}
</div>
<button
type="button"
onClick={() => setIsEditingNewPassType(!isEditingNewPassType)}
className="p-1.5 bg-white hover:bg-sky-100 text-sky-800 rounded-lg border border-sky-200 cursor-pointer"
title="Zmień typ karnetu"
>
✏️
</button>
</div>
<div className="flex items-center justify-between">
<div className="flex-1 whitespace-nowrap">
<span className="font-bold text-slate-700">Data: </span>
{isEditingNewDate ? (
<input
type="date"
value={extendNewDate}
onChange={(e) => setExtendNewDate(e.target.value)}
className="bg-white border border-sky-300 rounded-lg px-2 py-1 font-bold ml-2 text-slate-800"
/>
) : (
<span className="font-mono font-bold text-slate-900 whitespace-nowrap">{extendNewDate}</span>
)}
</div>
<button
type="button"
onClick={() => setIsEditingNewDate(!isEditingNewDate)}
className="p-1.5 bg-white hover:bg-sky-100 text-sky-800 rounded-lg border border-sky-200 cursor-pointer"
title="Zmień datę"
>
✏️
</button>
</div>
</div>
<div className="pt-4 flex justify-end gap-3 border-t border-sky-100">
<button type="button" onClick={() => setIsExtendPassModalOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer uppercase whitespace-nowrap">Anuluj</button>
<button type="submit" className="bg-rose-900 hover:bg-rose-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer uppercase tracking-wider whitespace-nowrap">🕒 Przedłuż</button>
</div>
</form>
</div>
</div>
)}
{isEditProfileInfoOpen && profileClient && (
<div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
<div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-sky-200">
<div className="flex items-center justify-between border-b border-sky-100 pb-3">
<h3 className="font-black text-sm text-sky-950 uppercase tracking-wider whitespace-nowrap">✏️ Edytuj dane konta</h3>
<button onClick={() => setIsEditProfileInfoOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
</div>
<form onSubmit={handleSaveProfileInfoSubmit} className="space-y-4 text-xs">
<div className="grid grid-cols-2 gap-3">
<div className="space-y-1">
<label className="font-bold text-slate-700">Imię</label>
<input
type="text"
value={profileClient.firstName || ''}
onChange={(e) => setProfileClient({...profileClient, firstName: e.target.value})}
className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
/>
</div>
<div className="space-y-1">
<label className="font-bold text-slate-700">Nazwisko</label>
<input
type="text"
value={profileClient.lastName || ''}
onChange={(e) => setProfileClient({...profileClient, lastName: e.target.value})}
className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
/>
</div>
</div>
<div className="space-y-1">
<label className="font-bold text-slate-700">Numer telefonu</label>
<input
type="text"
value={profileClient.phone || ''}
onChange={(e) => setProfileClient({...profileClient, phone: e.target.value})}
placeholder="np. 691118579"
className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
/>
</div>
<div className="space-y-1">
<label className="font-bold text-slate-700">Adres email</label>
<input
type="email"
value={profileClient.email || ''}
onChange={(e) => setProfileClient({...profileClient, email: e.target.value})}
placeholder="np. adres@email.com"
className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
/>
</div>
<div className="space-y-1">
<label className="font-bold text-slate-700">Płeć</label>
<select
value={profileClient.gender || ''}
onChange={(e) => setProfileClient({...profileClient, gender: e.target.value})}
className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 cursor-pointer"
>
<option value="">-- Wybierz płeć --</option>
<option value="Mężczyzna">Mężczyzna</option>
<option value="Kobieta">Kobieta</option>
<option value="Inna">Inna</option>
</select>
</div>
<div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
<button type="button" onClick={() => setIsEditProfileInfoOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer whitespace-nowrap">Anuluj</button>
<button type="submit" className="bg-amber-700 hover:bg-amber-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer whitespace-nowrap">Zapisz zmiany</button>
</div>
</form>
</div>
</div>
)}
{isTopUpWalletOpen && profileClient && (
<div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
<div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
<div className="flex items-center justify-between border-b border-sky-100 pb-3">
<h3 className="font-black text-sm text-sky-950 uppercase tracking-wider whitespace-nowrap">💰 Uzupełnij portfel</h3>
<button onClick={() => setIsTopUpWalletOpen(false)} className="text-slate-400 font-bold">✕</button>
</div>
<form onSubmit={handleTopUpWalletSubmit} className="space-y-4 text-xs">
<div className="space-y-1">
<label className="font-bold">Kwota (+/-)</label>
<input type="number" step="0.01" required value={walletAmountInput} onChange={(e) => setWalletAmountInput(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold" />
</div>
<div className="space-y-1">
<label className="font-bold whitespace-nowrap">Tytuł operacji (opcjonalnie)</label>
<input type="text" value={walletReasonInput} placeholder="np. Gotówka w recepcji" onChange={(e) => setWalletReasonInput(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold" />
</div>
<div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
<button type="button" onClick={() => setIsTopUpWalletOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer whitespace-nowrap">Anuluj</button>
<button type="submit" className="bg-amber-700 hover:bg-amber-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer whitespace-nowrap">Zatwierdź</button>
</div>
</form>
</div>
</div>
)}
{isWalletHistoryOpen && profileClient && (
<div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
<div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 border border-sky-200">
<div className="flex items-center justify-between border-b border-sky-100 pb-3">
<h3 className="font-black text-sm text-sky-950 uppercase tracking-wider whitespace-nowrap">🕒 Historia operacji i portfela</h3>
<button onClick={() => setIsWalletHistoryOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
</div>
<div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex justify-between items-center text-xs">
<span className="font-bold text-amber-900 uppercase whitespace-nowrap">Aktualne saldo klubowicza:</span>
<span className={`text-base font-black px-3 py-1 rounded-lg border whitespace-nowrap ${isWalletNegative(profileClient.wallet) ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>
{profileClient.wallet}
</span>
</div>
<div className="overflow-x-auto text-xs max-h-[60vh]">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-sky-50 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200 sticky top-0">
<th className="py-2.5 px-3 whitespace-nowrap">Data operacji</th>
<th className="py-2.5 px-3 whitespace-nowrap">Kategoria</th>
<th className="py-2.5 px-3 whitespace-nowrap">Kwota transakcji</th>
<th className="py-2.5 px-3 whitespace-nowrap">Szczegóły</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-100 text-slate-700">
{profileClient.transakcje && profileClient.transakcje.map((item: any) => (
<tr key={item.id} className="hover:bg-sky-50/30 transition-colors">
<td className="py-3 px-3 font-mono whitespace-nowrap">{new Date(item.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
<td className="py-3 px-3 font-bold uppercase text-[10px] tracking-wider text-sky-800 whitespace-nowrap">{item.typ_operacji.replace('_', ' ')}</td>
<td className={`py-3 px-3 font-black text-sm whitespace-nowrap ${item.kwota !== null && item.kwota < 0 ? 'text-rose-600' : item.kwota !== null && item.kwota > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
{item.kwota !== null ? `${item.kwota > 0 ? '+' : ''}${item.kwota.toFixed(2)} PLN` : '-'}
</td>
<td className="py-3 px-3 text-slate-600 whitespace-nowrap" title={item.opis}>{item.opis}</td>
</tr>
))}
{(!profileClient.transakcje || profileClient.transakcje.length === 0) && (
<tr>
<td colSpan={4} className="py-8 text-center text-slate-400">Brak zarejestrowanej historii operacji dla tego klienta w chmurze Supabase.</td>
</tr>
)}
</tbody>
</table>
</div>
<div className="pt-3 flex justify-end border-t border-sky-100">
<button onClick={() => setIsWalletHistoryOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer whitespace-nowrap">Zamknij</button>
</div>
</div>
</div>
)}
{isAddSecondPassModalOpen && profileClient && (
<div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
<div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
<div className="flex items-center justify-between border-b border-sky-100 pb-3">
<h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🎟️ Przypisz karnet z bazy</h3>
<button onClick={() => setIsAddSecondPassModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
</div>
<div className="space-y-4 text-xs">
<div className="space-y-1">
<label className="font-bold text-slate-700 block">Wybierz karnet *</label>
<select value={selectedPassToAdd} onChange={(e) => setSelectedPassToAdd(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold cursor-pointer">
<option value="">-- Wybierz karnet --</option>
{dostepneKarnety.map(k => {
const baseCena = parseFloat(k.cena) || 0;
let finalCena = baseCena;
let hasDiscount = false;
const activeDiscount = getEffectiveDiscount(profileClient);
if (activeDiscount > 0) {
finalCena = baseCena * (1 - activeDiscount / 100);
hasDiscount = true;
}
return (
<option key={k.id} value={k.nazwa}>
{k.nazwa} ({finalCena.toFixed(2)} PLN{hasDiscount ? ` - po rabacie ${activeDiscount}%` : ''})
</option>
);
})}
</select>
</div>
<div className="pt-4 flex justify-between gap-2 border-t border-sky-100">
<button type="button" onClick={() => setIsAddSecondPassModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
<div className="flex gap-2">
<button type="button" onClick={() => handleAddSecondPass('later')} className="bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold px-4 py-2.5 rounded-xl cursor-pointer whitespace-nowrap">Dopisz do rachunku</button>
<button type="button" onClick={() => handleAddSecondPass('paid')} className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer whitespace-nowrap">Zapłacono</button>
</div>
</div>
</div>
</div>
</div>
)}
{editingPassModal && (
<div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
<div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
<div className="flex items-center justify-between border-b border-sky-100 pb-3">
<h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">✏️ Edytuj karnet</h3>
<button onClick={() => setEditingPassModal(null)} className="text-slate-400 font-bold cursor-pointer">✕</button>
</div>
<div className="space-y-3 text-xs">
<div className="space-y-1">
<label className="font-bold">Wybierz nowy karnet z bazy</label>
<select
value={editingPassModal.nazwa || ''}
onChange={(e) => {
const wybranyNazwa = e.target.value;
const def = dostepneKarnety.find(k => k.nazwa === wybranyNazwa);
const actRab = getEffectiveDiscount(profileClient);
const baseCena = def ? parseFloat(def.cena) : 0;
const finalCena = actRab > 0 ? baseCena * (1 - actRab / 100) : baseCena;
setEditingPassModal({
...editingPassModal,
nazwa: wybranyNazwa,
cena: def ? `${finalCena.toFixed(2)} PLN` : editingPassModal.cena
});
}}
className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold cursor-pointer"
>
<option value="">-- Wybierz karnet z bazy --</option>
{dostepneKarnety.map(k => {
const baseCena = parseFloat(k.cena) || 0;
let finalCena = baseCena;
let hasDiscount = false;
const activeDiscount = getEffectiveDiscount(profileClient);
if (activeDiscount > 0) {
finalCena = baseCena * (1 - activeDiscount / 100);
hasDiscount = true;
}
return (
<option key={k.id} value={k.nazwa}>
{k.nazwa} ({finalCena.toFixed(2)} PLN{hasDiscount ? ` - po rabacie ${activeDiscount}%` : ''})
</option>
);
})}
</select>
</div>
<div className="space-y-1">
<label className="font-bold">Ważny do</label>
<input
type="date"
value={editingPassModal.waznyDo || ''}
onChange={(e) => setEditingPassModal({...editingPassModal, waznyDo: e.target.value})}
className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold cursor-pointer"
/>
</div>
<div className="space-y-1">
<label className="font-bold">Pozostało wejść</label>
<input
type="number"
value={editingPassModal.pozostaloWejsc ?? ''}
onChange={(e) => setEditingPassModal({...editingPassModal, pozostaloWejsc: e.target.value === '' ? null : parseInt(e.target.value, 10)})}
className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold"
/>
</div>
</div>
<div className="pt-4 flex justify-between items-center border-t border-sky-100">
<button
onClick={() => handleConfirmDeletePass(editingPassModal.id)}
className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-black px-4 py-2.5 rounded-xl border border-rose-200 cursor-pointer"
>
🗑️ Usuń karnet
</button>
<div className="flex gap-2">
<button onClick={() => setEditingPassModal(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
<button
onClick={handleSavePassEditSubmit}
className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer"
>
Zapisz
</button>
</div>
</div>
</div>
</div>
)}
{isSuspendModalOpen && profileClient && suspendPassTarget && (
<div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
<div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 border border-sky-200 max-h-[90vh] overflow-y-auto">
<div className="flex items-center justify-between border-b border-sky-100 pb-3">
<h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">⚙️ Status karnetu: {suspendPassTarget.nazwa}</h3>
<button onClick={() => setIsSuspendModalOpen(false)} className="text-slate-400 font-bold text-lg hover:text-slate-700 cursor-pointer">✕</button>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="space-y-4 border border-amber-200 bg-amber-50/50 p-5 rounded-2xl flex flex-col justify-between">
<div>
<h4 className="font-black text-amber-900 text-xs uppercase flex items-center gap-2"><span>⏸️</span> Zawieś karnet</h4>
<p className="text-[10px] text-amber-800 leading-tight mt-1">
Zatrzymuje bieg karnetu. Liczba dni zawieszenia zostanie wyliczona <strong>dopiero w momencie odwieszenia</strong> i dopiero wtedy doliczona do ważności karnetu.
</p>
</div>
{suspendPassTarget.zawieszonyOd ? (
<div className="space-y-3 text-xs mt-4">
<div className="flex bg-white rounded-lg border border-amber-200 overflow-hidden font-bold">
<div className="flex-1 py-1.5 text-center bg-amber-200 text-amber-900">Karnet zawieszony</div>
</div>
<div className="space-y-1">
<label className="font-bold text-amber-900">Zawieszony od dnia</label>
<div className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 font-bold font-mono">{suspendPassTarget.zawieszonyOd}</div>
</div>
<button type="button" onClick={() => { handleOdwiesKarnet(suspendPassTarget); }} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer">Odwieś karnet teraz i dolicz dni</button>
</div>
) : (
<form onSubmit={handleConfirmSuspendPass} className="space-y-3 text-xs mt-4">
<div className="flex bg-white rounded-lg border border-amber-200 overflow-hidden font-bold">
<button type="button" onClick={() => setSuspendMode('days')} className={`flex-1 py-1.5 cursor-pointer transition-colors ${suspendMode === 'days' ? 'bg-amber-200 text-amber-900' : 'text-amber-700 hover:bg-amber-50'}`}>Liczba dni</button>
<button type="button" onClick={() => setSuspendMode('dates')} className={`flex-1 py-1.5 border-l border-amber-200 cursor-pointer transition-colors ${suspendMode === 'dates' ? 'bg-amber-200 text-amber-900' : 'text-amber-700 hover:bg-amber-50'}`}>Od-Do</button>
</div>
{suspendMode === 'days' ? (
<div className="space-y-1">
<label className="font-bold text-amber-900">Liczba dni zawieszenia od dzisiaj</label>
<input type="number" min="1" required value={suspendPassDays} onChange={(e) => setSuspendPassDays(e.target.value)} className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 font-bold" />
</div>
) : (
<>
<div className="space-y-1">
<label className="font-bold text-amber-900">Zawieś od</label>
<input type="date" required value={suspendStartDate} onChange={(e) => setSuspendStartDate(e.target.value)} className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 font-bold cursor-pointer" />
</div>
<div className="space-y-1">
<label className="font-bold text-amber-900">Zawieś do (planowo)</label>
<input type="date" required value={suspendEndDate} onChange={(e) => setSuspendEndDate(e.target.value)} className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 font-bold cursor-pointer" />
</div>
</>
)}
<button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer">Zatwierdź zawieszenie</button>
</form>
)}
</div>
<div className="space-y-4 border border-rose-200 bg-rose-50/50 p-5 rounded-2xl flex flex-col justify-between">
<div>
<h4 className="font-black text-rose-900 text-xs uppercase flex items-center gap-2"><span>🔒</span> Zablokuj karnet</h4>
<p className="text-[10px] text-rose-800 leading-tight mt-1">
Blokuje możliwość wejścia do klubu. <strong>NIE przedłuża</strong> ważności karnetu.
</p>
</div>
<form onSubmit={handleConfirmBlockPass} className="space-y-3 text-xs mt-4">
<div className="flex bg-white rounded-lg border border-rose-200 overflow-hidden font-bold">
<button type="button" onClick={() => setBlockMode('days')} className={`flex-1 py-1.5 cursor-pointer transition-colors ${blockMode === 'days' ? 'bg-rose-200 text-rose-900' : 'text-rose-600 hover:bg-rose-50'}`}>Liczba dni</button>
<button type="button" onClick={() => setBlockMode('dates')} className={`flex-1 py-1.5 border-l border-rose-200 cursor-pointer transition-colors ${blockMode === 'dates' ? 'bg-rose-200 text-rose-900' : 'text-rose-600 hover:bg-rose-50'}`}>Od-Do</button>
</div>
{blockMode === 'days' ? (
<div className="space-y-1">
<label className="font-bold text-rose-900">Liczba dni blokady od dzisiaj</label>
<input type="number" min="1" required value={blockPassDays} onChange={(e) => setBlockPassDays(e.target.value)} className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2 font-bold" />
</div>
) : (
<>
<div className="space-y-1">
<label className="font-bold text-rose-900">Zablokowany od</label>
<input type="date" required value={blockPassStartDate} onChange={(e) => setBlockPassStartDate(e.target.value)} className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2 font-bold cursor-pointer" />
</div>
<div className="space-y-1">
<label className="font-bold text-rose-900">Zablokowany do</label>
<input type="date" required value={blockPassEndDate} onChange={(e) => setBlockPassEndDate(e.target.value)} className="w-full bg-white border border-rose-200 rounded-xl px-3 py-2 font-bold cursor-pointer" />
</div>
</>
)}
<button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer">Nałóż blokadę</button>
</form>
{suspendPassTarget.blokadaDo && suspendPassTarget.blokadaDo >= todayStr && (
<button type="button" onClick={() => handleCancelBlock(suspendPassTarget)} className="w-full bg-white border border-rose-300 text-rose-700 font-bold py-2 rounded-xl hover:bg-rose-100 transition-colors cursor-pointer mt-3">Odwołaj aktywną blokadę</button>
)}
</div>
</div>
</div>
</div>
)}
{isSuspendHistoryModalOpen && profileClient && (
<div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
<div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-sky-200">
<div className="flex items-center justify-between border-b border-sky-100 pb-3">
<h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">📜 Historia zawieszeń</h3>
<button onClick={() => setIsSuspendHistoryModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
</div>
<div className="space-y-4 max-h-64 overflow-y-auto pr-2">
{(profileClient.karnetyKlubowicza || []).map((karnet: any) => (
<div key={karnet.id} className="bg-sky-50/50 border border-sky-100 p-3 rounded-xl text-xs">
<div className="font-bold text-sky-900 mb-2">Karnet: {karnet.nazwa}</div>
{karnet.historiaZawieszen && karnet.historiaZawieszen.length > 0 ? (
<div className="space-y-2">
{karnet.historiaZawieszen.map((hz: any) => (
<div key={hz.id} className="flex justify-between bg-white border border-sky-200 p-2 rounded-lg">
<span className="font-mono text-slate-600">{hz.od} do {hz.do}</span>
<span className="font-bold text-slate-800">{hz.dni} dni</span>
</div>
))}
</div>
) : (
<div className="text-slate-400 italic">Brak zawieszeń dla tego karnetu.</div>
)}
</div>
))}
</div>
<div className="pt-3 flex justify-end border-t border-sky-100">
<button onClick={() => setIsSuspendHistoryModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer">Zamknij</button>
</div>
</div>
</div>
)}
{clientToUnregister && (
<div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
<div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
<div className="flex items-center justify-between border-b border-sky-100 pb-3">
<h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">⚠️ Wypisz uczestnika</h3>
<button onClick={() => setClientToUnregister(null)} className="text-slate-400 font-bold cursor-pointer">✕</button>
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
</div>
);
}
