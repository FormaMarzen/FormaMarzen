"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';

export default function ClientsReportPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [dostepneKarnety, setDostepneKarnety] = useState<any[]>([]);

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [profileClient, setProfileClient] = useState<any | null>(null);
  const [tableActionClient, setTableActionClient] = useState<any | null>(null);

  const [isExtendPassModalOpen, setIsExtendPassModalOpen] = useState(false);
  const [extendPassTarget, setExtendPassTarget] = useState<any | null>(null);
  const [extendSelectedNewPassName, setExtendSelectedNewPassName] = useState('');
  const [extendNewDate, setExtendNewDate] = useState('');
  const [isEditingNewPassType, setIsEditingNewPassType] = useState(false);
  const [isEditingNewDate, setIsEditingNewDate] = useState(false);

  const [isEditProfileInfoOpen, setIsEditProfileInfoOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeProfileTab, setActiveProfileTab] = useState<'osobowe' | 'faktury' | 'rodzinne' | 'karta'>('osobowe');
  const [activeZapisyTab, setActiveZapisyTab] = useState<'nadchodzace' | 'przeszle' | 'wypisy' | 'automatyczne'>('nadchodzace');

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

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    price: '0.00 PLN',
    wallet: '0.00 PLN',
    registered: new Date().toISOString().split('T')[0],
    selectedPass: '', 
  });

  const loadData = async () => {
    // 1. Pobieranie danych równolegle
    const [
      { data: klienciData, error: klienciError },
      { data: karnetyData, error: karnetyError },
      { data: transakcjeData, error: transakcjeError }
    ] = await Promise.all([
      supabase.from('klienci').select('*'),
      supabase.from('karnety').select('*'),
      supabase.from('transakcje').select('*').order('created_at', { ascending: false })
    ]);

    if (klienciError) console.error("Błąd odczytu klientów", klienciError);
    if (karnetyError) console.error("Błąd odczytu karnetów", karnetyError);
    if (transakcjeError) console.error("Błąd odczytu transakcji", transakcjeError);

    if (klienciData) {
      const enriched = klienciData.map((c: any) => {
        // Zbieramy wszystkie transakcje danego klienta
        const clientTransakcje = transakcjeData ? transakcjeData.filter((t: any) => t.klient_id === c.id) : [];

        return {
          ...c,
          id: c.id,
          firstName: c.Imię || '',
          lastName: c.Nazwisko || '',
          registered: c.Zarejestrowany || c.registered || '2026-06-01',
          activated: c.activated || '2026-06-01',
          expiresDate: c.expiresDate || '',
          price: c.Cena || c.cena || c.price || '0.00 PLN',
          discount: c.discount || '',
          wallet: c.Portfel || c.portfel || c.wallet || '0.00 PLN',
          avatarUrl: c.avatarUrl || null,
          gender: c.płeć || c.gender || '',
          phone: c['Numer tel.'] || c.telefon || c.phone || '',
          email: c['E-mail'] || c.email || '',
          birthDate: c.birthDate || '',
          karnetyKlubowicza: c.karnetyKlubowicza || c.karnetyklubowicza || [],
          transakcje: clientTransakcje, // Podpinamy logi bezpośrednio z bazy
          zapisyNadchodzace: c.zapisyNadchodzace || [],
          zapisyPrzeszle: c.zapisyPrzeszle || [],
          zapisyWypisy: c.zapisyWypisy || []
        };
      });
      setClients(enriched);

      if (profileClient) {
        const currentActive = enriched.find((c: any) => c.id === profileClient.id);
        if (currentActive) setProfileClient(currentActive);
      }
    }

    if (karnetyData) {
      const ustrukturyzowaneKarnety = karnetyData.map((k: any) => ({
        ...k,
        cena: k.cena_brutto || k.cena || '0.00',
        limitCzasowy: k.dlugosc || k.limitCzasowy || ''
      }));
      setDostepneKarnety(ustrukturyzowaneKarnety);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let poczatkoweKarnety: any[] = [];
    let cenaKarnetu = '0.00 PLN';
    let cenaWartosc = 0;

    if (newClient.selectedPass) {
      const defKarnetu = dostepneKarnety.find(k => k.nazwa === newClient.selectedPass);
      let dniWażności = 30;
      
      if (defKarnetu && defKarnetu.limitCzasowy) {
        const limit = defKarnetu.limitCzasowy.toLowerCase();
        if (limit.includes('1 miesiąc') || limit.includes('miesiąc')) dniWażności = 30;
        else if (limit.includes('3 miesiące')) dniWażności = 90;
        else if (limit.includes('6 miesięcy')) dniWażności = 180;
        else if (limit.includes('1 rok')) dniWażności = 365;
        else if (limit.includes('42 dni')) dniWażności = 42;
        else if (limit.includes('14 dni')) dniWażności = 14;
        else if (limit.includes('7 dni')) dniWażności = 7;
      }

      const dataWygasniecia = new Date();
      dataWygasniecia.setDate(dataWygasniecia.getDate() + dniWażności);
      const dataWygasnieciaStr = dataWygasniecia.toISOString().split('T')[0];

      cenaWartosc = defKarnetu ? parseFloat(defKarnetu.cena) : 150;
      cenaKarnetu = `${cenaWartosc.toFixed(2)} PLN`;

      poczatkoweKarnety.push({
        id: Date.now(),
        nazwa: newClient.selectedPass,
        waznyDo: dataWygasnieciaStr,
        cena: cenaKarnetu,
        znizkaProcentowa: '',
        rata: '1 / 1',
        statusTekst: `Ważny do: ${dataWygasnieciaStr}`,
        blokadaDo: null,
        powodBlokady: null,
        zawieszonyOd: null,
        zawieszonyDo: null,
        historiaZawieszen: []
      });
    }

    // Odciągnięcie kwoty początkowego karnetu od stanu portfela (tworzy zadłużenie jeśli brak wpłaty)
    const poczatkowyStan = (parseFloat(newClient.wallet) || 0) - cenaWartosc;
    const poczatkowyStanStr = `${poczatkowyStan.toFixed(2)} PLN`;
    const newClientId = Date.now();

    const { error } = await supabase.from('klienci').insert([
      {
        id: newClientId,
        Imię: newClient.firstName,
        Nazwisko: newClient.lastName,
        "Numer tel.": newClient.phone,
        "E-mail": newClient.email,
        Cena: cenaKarnetu,
        Portfel: poczatkowyStanStr,
        Zarejestrowany: newClient.registered,
        karnetyKlubowicza: poczatkoweKarnety
      }
    ]);

    if (!error && newClient.selectedPass) {
      // Zapis transakcji zakupu do bazy
      await supabase.from('transakcje').insert([{
        klient_id: newClientId,
        typ_operacji: 'zakup_karnetu',
        kwota: -cenaWartosc,
        opis: `Pierwszy karnet: ${newClient.selectedPass} (Zadłużono portfel)`
      }]);
    }

    if (error) {
      console.error("Błąd zapisu do Supabase:", error);
      alert("Wystąpił błąd podczas dodawania klienta. Sprawdź konsolę (F12).");
    } else {
      setIsAddModalOpen(false);
      setNewClient({
        firstName: '', lastName: '', phone: '', email: '', price: '0.00 PLN', wallet: '0.00 PLN',
        registered: new Date().toISOString().split('T')[0], selectedPass: ''
      });
      loadData();
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    await supabase.from('klienci').update({ Imię: editingClient.firstName, Nazwisko: editingClient.lastName }).eq('id', editingClient.id);
    setEditingClient(null);
    loadData();
  };

  const handleSaveProfileInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient) return;

    await supabase.from('klienci').update({ Imię: profileClient.firstName, Nazwisko: profileClient.lastName, telefon: profileClient.phone, email: profileClient.email, płeć: profileClient.gender }).eq('id', profileClient.id);
    setIsEditProfileInfoOpen(false);
    loadData();
  };

  const handleDeleteClient = async (id: number) => {
    if (confirm("Czy na pewno chcesz całkowicie usunąć to konto i wszystkie powiązane z nim logi operacji?")) {
      // Usunięcie klienta (transakcje mogą mieć on delete cascade w bazie, ale usuwamy też dla pewności z poziomu aplikacji logikę klienta)
      await supabase.from('klienci').delete().eq('id', id);
      await supabase.from('transakcje').delete().eq('klient_id', id);
      
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profileClient) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
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

        await supabase.from('klienci').update({ avatarUrl: compressedDataUrl }).eq('id', profileClient.id);
        loadData();
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
    const kwotaKarnetu = parseFloat(nowaCena.replace(/[^0-9.]/g, '')) || 0;

    // Pobranie i pomniejszenie stanu portfela
    const currentWalletNum = parseFloat(String(profileClient.wallet).replace(/[^0-9.-]+/g, "")) || 0;
    const nowyStanPortfela = currentWalletNum - kwotaKarnetu;
    const nowyStanStr = `${nowyStanPortfela.toFixed(2)} PLN`;

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

    // Aktualizacja tabeli klientów
    const { error } = await supabase.from('klienci').update({
      karnetyKlubowicza: uaktualnioneKarnety,
      Cena: nowaCena,
      Portfel: nowyStanStr
    }).eq('id', profileClient.id);

    if (error) {
      alert(`Błąd zapisu: ${error.message}`);
      return;
    }

    // Logujemy operację zakupową
    await supabase.from('transakcje').insert([{
      klient_id: profileClient.id,
      typ_operacji: 'zakup_karnetu',
      kwota: -kwotaKarnetu,
      opis: `Przedłużenie karnetu: ${extendSelectedNewPassName} do ${extendNewDate} (Obciążenie portfela)`
    }]);

    alert(`Karnet został przedłużony! Pobrano ${kwotaKarnetu} PLN z portfela.`);
    setIsExtendPassModalOpen(false);
    loadData();
  };

  const handleAddSecondPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !selectedPassToAdd) return;

    const defKarnetu = dostepneKarnety.find(k => k.nazwa === selectedPassToAdd);
    
    let dniWażności = 30;
    if (defKarnetu && defKarnetu.limitCzasowy) {
      const limit = defKarnetu.limitCzasowy.toLowerCase();
      if (limit.includes('1 miesiąc') || limit.includes('miesiąc')) dniWażności = 30;
      else if (limit.includes('3 miesiące')) dniWażności = 90;
      else if (limit.includes('6 miesięcy')) dniWażności = 180;
      else if (limit.includes('1 rok')) dniWażności = 365;
      else if (limit.includes('42 dni')) dniWażności = 42;
      else if (limit.includes('14 dni')) dniWażności = 14;
      else if (limit.includes('7 dni')) dniWażności = 7;
    }

    const dataWygasniecia = new Date();
    dataWygasniecia.setDate(dataWygasniecia.getDate() + dniWażności);
    const dataWygasnieciaStr = dataWygasniecia.toISOString().split('T')[0];
    const cenaObjKarnetu = defKarnetu ? `${defKarnetu.cena} PLN` : '150.00 PLN';
    const kwotaKarnetu = parseFloat(cenaObjKarnetu.replace(/[^0-9.]/g, '')) || 0;

    // Pobranie i pomniejszenie portfela
    const currentWalletNum = parseFloat(String(profileClient.wallet).replace(/[^0-9.-]+/g, "")) || 0;
    const nowyStanPortfela = currentWalletNum - kwotaKarnetu;
    const nowyStanStr = `${nowyStanPortfela.toFixed(2)} PLN`;

    const nowyKarnetObj = {
      id: Date.now(),
      nazwa: selectedPassToAdd,
      waznyDo: dataWygasnieciaStr,
      cena: cenaObjKarnetu,
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

    const { error } = await supabase.from('klienci').update({
      karnetyKlubowicza: uaktualnioneKarnety,
      Cena: cenaObjKarnetu,
      Portfel: nowyStanStr
    }).eq('id', profileClient.id);

    if (error) {
      alert(`Błąd zapisu w bazie: ${error.message}`);
      return;
    }

    // Logujemy zakup
    await supabase.from('transakcje').insert([{
      klient_id: profileClient.id,
      typ_operacji: 'zakup_karnetu',
      kwota: -kwotaKarnetu,
      opis: `Dodatkowy karnet: ${selectedPassToAdd} (Obciążenie portfela)`
    }]);

    setSelectedPassToAdd('');
    setIsAddSecondPassModalOpen(false);
    loadData();
  };

  const handleConfirmSuspendPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !suspendPassTarget) return;

    const start = new Date(suspendStartDate);
    const end = new Date(suspendEndDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      alert("Data końcowa zawieszenia musi być późniejsza niż data początkowa!");
      return;
    }

    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === suspendPassTarget.id) {
        return { ...k, zawieszonyOd: suspendStartDate, zawieszonyDo: suspendEndDate };
      }
      return k;
    });

    await supabase.from('klienci').update({ karnetyKlubowicza: uaktualnioneKarnety }).eq('id', profileClient.id);

    alert(`Karnet został zawieszony od ${suspendStartDate} do ${suspendEndDate}.`);
    setIsSuspendModalOpen(false);
    loadData();
  };

  const handleCancelSuspension = async (karnetTarget: any) => {
    if (!confirm("Czy na pewno chcesz zakończyć/odwołać zawieszenie karnetu?")) return;
    if (!profileClient) return;

    const start = new Date(karnetTarget.zawieszonyOd);
    const end = new Date(karnetTarget.zawieszonyDo || new Date());
    const diffTime = end.getTime() - start.getTime();
    let dniZawieszenia = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (dniZawieszenia < 1) dniZawieszenia = 1;

    const obecnaDataWaznosci = new Date(karnetTarget.waznyDo);
    obecnaDataWaznosci.setDate(obecnaDataWaznosci.getDate() + dniZawieszenia);
    const nowaDataWaznosciStr = obecnaDataWaznosci.toISOString().split('T')[0];

    const nowyWpisHistorii = {
      id: Date.now(),
      dataZawieszenia: karnetTarget.zawieszonyOd,
      dataAtywacji: karnetTarget.zawieszonyDo,
      okres: `${dniZawieszenia} dni`,
      przezKogo: 'Maciej Klaput'
    };

    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === karnetTarget.id) {
        return {
          ...k, waznyDo: nowaDataWaznosciStr, statusTekst: `Ważny do: ${nowaDataWaznosciStr}`,
          zawieszonyOd: null, zawieszonyDo: null, historiaZawieszen: [nowyWpisHistorii, ...(k.historiaZawieszen || [])]
        };
      }
      return k;
    });

    await supabase.from('klienci').update({ karnetyKlubowicza: uaktualnioneKarnety }).eq('id', profileClient.id);

    alert(`Zawieszenie zakończone. Karnet wydłużony o ${dniZawieszenia} dni!`);
    loadData();
  };

  const handleSavePassEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !editingPassModal) return;

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
          ...k, nazwa: editingPassModal.nazwa, waznyDo: editingPassModal.waznyDo,
          cena: editingPassModal.cena.includes('PLN') ? editingPassModal.cena : `${editingPassModal.cena} PLN`,
          znizkaProcentowa: znizkaTekst, rata: editingPassModal.rata, statusTekst: `Ważny do: ${editingPassModal.waznyDo}`
        };
      }
      return k;
    });

    await supabase.from('klienci').update({ karnetyKlubowicza: uaktualnioneKarnety }).eq('id', profileClient.id);

    // Log edycji detali (bez wpływu na saldo)
    await supabase.from('transakcje').insert([{
      klient_id: profileClient.id,
      typ_operacji: 'edycja_karnetu',
      kwota: null,
      opis: `Ręczna modyfikacja ustawień karnetu: ${editingPassModal.nazwa}`
    }]);

    setEditingPassModal(null);
    loadData();
  };

  const handleConfirmDeletePass = async (passId: number) => {
    if (confirm("Czy na pewno chcesz usunąć ten karnet?")) {
      if (!profileClient) return;
      const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).filter((k: any) => k.id !== passId);
      
      await supabase.from('klienci').update({ karnetyKlubowicza: uaktualnioneKarnety }).eq('id', profileClient.id);
      
      await supabase.from('transakcje').insert([{
        klient_id: profileClient.id,
        typ_operacji: 'edycja_karnetu',
        kwota: null,
        opis: `Ręczne usunięcie karnetu z profilu`
      }]);

      setEditingPassModal(null);
      setIsGlobalPassMenuOpen(false);
      loadData();
    }
  };

  const handleWypiszZajecia = async (zajecieItem: any) => {
    if (!profileClient) return;

    const uaktualnioneNadchodzace = (profileClient.zapisyNadchodzace || []).filter((z: any) => z.id !== zajecieItem.id);
    const nowyWypis = { ...zajecieItem, wypisujacy: 'Wypisany przez klubowicza' };
    const uaktualnioneWypisy = [nowyWypis, ...(profileClient.zapisyWypisy || [])];

    await supabase.from('klienci').update({ zapisyNadchodzace: uaktualnioneNadchodzace, zapisyWypisy: uaktualnioneWypisy }).eq('id', profileClient.id);

    await supabase.from('transakcje').insert([{
      klient_id: profileClient.id,
      typ_operacji: 'zajecia_wypis',
      kwota: null,
      opis: `Wypisano z zajęć: ${zajecieItem.zajecia} (${zajecieItem.data})`
    }]);

    loadData();
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
        await supabase.from('klienci').update({
          blokadaDo: null, powodBlokady: null,
          karnetyKlubowicza: (profileClient.karnetyKlubowicza || []).map((k: any) => ({ ...k, blokadaDo: null, powodBlokady: null }))
        }).eq('id', profileClient.id);

        alert("Blokada została pomyślnie odwołana!");
        setIsBlockModalOpen(false);
        loadData();
        return;
      }
      const now = new Date();
      now.setDate(now.getDate() + dni);
      nowaDataStr = now.toISOString().split('T')[0];
    }

    const powod = `Zaktualizowana blokada zapisów do dnia ${nowaDataStr}.`;
    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => ({ ...k, blokadaDo: nowaDataStr, powodBlokady: powod }));

    await supabase.from('klienci').update({ blokadaDo: nowaDataStr, powodBlokady: powod, karnetyKlubowicza: uaktualnioneKarnety }).eq('id', profileClient.id);

    alert(`Blokada ustawiona do dnia: ${nowaDataStr}!`);
    setIsBlockModalOpen(false);
    loadData();
  };

  const handleTopUpWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !walletAmountInput) return;

    const kwotaZmiany = parseFloat(walletAmountInput);
    if (isNaN(kwotaZmiany)) return;

    const currentWalletNum = parseFloat(String(profileClient.wallet).replace(/[^0-9.-]+/g, "")) || 0;
    const nowyStan = currentWalletNum + kwotaZmiany;
    const nowyStanStr = `${nowyStan.toFixed(2)} PLN`;

    // 1. Zapisujemy w nowej tabeli Logów Transakcji (Supabase)
    await supabase.from('transakcje').insert([{
      klient_id: profileClient.id,
      typ_operacji: 'portfel',
      kwota: kwotaZmiany,
      opis: walletReasonInput || (kwotaZmiany >= 0 ? 'Doładowanie portfela' : 'Korekta / Odpis z portfela')
    }]);

    // 2. Aktualizujemy w kliencie faktyczny stan portfela
    await supabase.from('klienci').update({ Portfel: nowyStanStr }).eq('id', profileClient.id);

    setWalletAmountInput('');
    setWalletReasonInput('');
    setIsTopUpWalletOpen(false);
    loadData();
  };

  const filteredClients = clients.filter(c => 
    `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone || '').includes(searchQuery)
  );

  const sortedClients = [...filteredClients].sort((a, b) => {
    if (!sortField) return 0;
    
    let valA: any = '';
    let valB: any = '';

    if (sortField === 'firstName') { valA = a.firstName || ''; valB = b.firstName || ''; }
    else if (sortField === 'lastName') { valA = a.lastName || ''; valB = b.lastName || ''; }
    else if (sortField === 'registered') { valA = a.registered || ''; valB = b.registered || ''; }
    else if (sortField === 'activated') { valA = a.activated || ''; valB = b.activated || ''; }
    else if (sortField === 'email') { valA = a.email || ''; valB = b.email || ''; }
    else if (sortField === 'phone') { valA = a.phone || ''; valB = b.phone || ''; }
    else if (sortField === 'pass') { 
      valA = a.karnetyKlubowicza?.[0]?.nazwa || ''; 
      valB = b.karnetyKlubowicza?.[0]?.nazwa || ''; 
    }
    else if (sortField === 'price') { 
      valA = parseFloat(String(a.price).replace(/[^0-9.]/g, '')) || 0; 
      valB = parseFloat(String(b.price).replace(/[^0-9.]/g, '')) || 0; 
      return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    }
    else if (sortField === 'expiresDate') { 
      valA = a.karnetyKlubowicza?.[0]?.waznyDo || ''; 
      valB = b.karnetyKlubowicza?.[0]?.waznyDo || ''; 
    }
    else if (sortField === 'wallet') { 
      valA = parseFloat(String(a.wallet).replace(/[^0-9.-]+/g, '')) || 0; 
      valB = parseFloat(String(b.wallet).replace(/[^0-9.-]+/g, '')) || 0; 
      return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    }
    else if (sortField === 'birthDate') { valA = a.birthDate || ''; valB = b.birthDate || ''; }

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return 0;
  });

  const isWalletNegative = (walletStr: string) => {
    if (!walletStr) return false;
    return walletStr.includes('-');
  };

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 overflow-x-hidden">
      
      {/* Pasek Nagłówka z DODANYM PRZYCISKIEM "+ DODAJ KLUBOWICZA" */}
      <div className="flex justify-between items-center border-b border-sky-200 pb-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
          👥 Klienci
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-sm transition-all text-xs uppercase tracking-wider cursor-pointer">
            + DODAJ KLUBOWICZA
          </button>
          <button className="p-2 bg-white border border-sky-200 text-slate-700 rounded-xl hover:bg-sky-50 shadow-sm transition-all cursor-pointer" title="Ustawienia tabeli">⚙️</button>
          <button className="p-2 bg-white border border-sky-200 text-slate-700 rounded-xl hover:bg-sky-50 shadow-sm transition-all cursor-pointer" title="Eksportuj">📥</button>
        </div>
      </div>

      {/* Wyszukiwanie i Filtry */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-3 text-slate-400">🔍</span>
            <input 
              type="text"
              placeholder="Wyszukaj po imieniu, nazwisku, emailu lub telefonie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-sky-200 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
            />
          </div>
          <button className="px-4 py-2.5 bg-rose-800 hover:bg-rose-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 shadow-sm transition-all cursor-pointer">
            <span>🎛️</span> Ustaw filtry
          </button>
        </div>
      </div>

      {/* Tabela Klientów */}
      <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[1100px]">
            <thead>
              <tr className="bg-sky-50/80 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200">
                <th className="py-3 px-3 text-center w-10"><input type="checkbox" className="rounded border-sky-300" /></th>
                <th onClick={() => handleSort('firstName')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors">Imię {sortField === 'firstName' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('lastName')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors">Nazwisko {sortField === 'lastName' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('registered')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors">Zarejestrowany {sortField === 'registered' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('activated')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors">Aktywowany {sortField === 'activated' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('email')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors">Email {sortField === 'email' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('phone')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors">Telefon {sortField === 'phone' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('pass')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors">Karnet {sortField === 'pass' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('price')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors">Cena {sortField === 'price' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('expiresDate')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors">Wygasa {sortField === 'expiresDate' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('wallet')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors">Portfel {sortField === 'wallet' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('birthDate')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors">Urodziny {sortField === 'birthDate' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th className="py-3 px-3 text-right font-bold w-20">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedClients.map((client) => {
                const negativeW = isWalletNegative(client.wallet);
                const aktywnyKarnetZawieszony = (client.karnetyKlubowicza || []).find((k: any) => k.zawieszonyOd && k.zawieszonyDo);
                const maKarnet = client.karnetyKlubowicza && client.karnetyKlubowicza.length > 0;
                const nazwaKarnetu = maKarnet ? client.karnetyKlubowicza.map((k: any) => k.nazwa).join(', ') : '';
                const dataWygasnieciaKarnetu = maKarnet ? client.karnetyKlubowicza[0].waznyDo : '-';

                return (
                  <tr key={client.id} className="hover:bg-sky-50/40 transition-colors">
                    <td className="py-3.5 px-3 text-center"><input type="checkbox" className="rounded border-sky-300" /></td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">{client.firstName}</td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">{client.lastName}</td>
                    <td className="py-3.5 px-3 font-mono text-slate-500">{client.registered}</td>
                    <td className="py-3.5 px-3 font-mono text-slate-500">{client.activated}</td>
                    <td onClick={() => setProfileClient(client)} className="py-3.5 px-3 text-sky-700 font-medium hover:underline cursor-pointer truncate max-w-[150px]">{client.email || '-'}</td>
                    <td className="py-3.5 px-3 font-mono text-slate-600">{client.phone || '-'}</td>
                    <td className="py-3.5 px-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-800">{nazwaKarnetu}</span>
                        {aktywnyKarnetZawieszony && (
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded border border-amber-200 inline-block w-fit">
                            ⏸️ Zawieszony: od {aktywnyKarnetZawieszony.zawieszonyOd} do {aktywnyKarnetZawieszony.zawieszonyDo}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-medium text-slate-800"><div>{client.price}</div></td>
                    <td className="py-3.5 px-3 font-mono text-slate-600">{maKarnet ? dataWygasnieciaKarnetu : '-'}</td>
                    <td className="py-3.5 px-3 font-bold">
                      <span className={`px-2 py-0.5 rounded-lg text-xs ${negativeW ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                        {client.wallet}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-500">{client.birthDate || 'Nie podano'}</td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setProfileClient(client)} className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-lg border border-sky-200 cursor-pointer" title="Otwórz profil">👤</button>
                        <button onClick={() => setTableActionClient(client)} className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 cursor-pointer" title="Zarządzaj klubowiczem">✏️</button>
                        <button onClick={() => handleDeleteClient(client.id)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 cursor-pointer" title="Usuń">🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL SZYBKIEGO MENU ZARZĄDZANIA KLUBOWICZEM Z TABELI */}
      {tableActionClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 border border-sky-200 relative">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-base">
                  👤
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

      {/* MODAL PROFILU KLIENTA */}
      {profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-end backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col overflow-y-auto">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white sticky top-0 z-20">
              <button onClick={() => setProfileClient(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer">✕</button>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsWalletHistoryOpen(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer">🕒 LOGI UŻYTKOWNIKA</button>
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
                    className="bg-white hover:bg-sky-50 text-sky-900 px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-200 shadow-sm cursor-pointer transition-all"
                  >
                    ✏️ Edytuj zdjęcie
                  </button>
                </div>
              </div>

              {/* SEKCJA KARNETÓW */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-xs text-slate-500 uppercase tracking-wider">Karnety klubowicza</h3>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { setSelectedPassToAdd(dostepneKarnety[0]?.nazwa || ''); setIsAddSecondPassModalOpen(true); }} 
                      className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm"
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
                        <div className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-50 text-xs">
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
                          }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer">🕒 Przedłuż karnet</button>
                          <button onClick={() => { alert("Umowa wypowiedziana"); setIsGlobalPassMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer">📄 Wypowiedz umowę</button>
                          <button onClick={() => { if(profileClient.karnetyKlubowicza?.length > 0) { setSuspendPassTarget(profileClient.karnetyKlubowicza[0]); setSuspendStartDate(profileClient.karnetyKlubowicza[0].zawieszonyOd || '2026-08-06'); setSuspendEndDate(profileClient.karnetyKlubowicza[0].zawieszonyDo || '2026-08-08'); setIsSuspendModalOpen(true); } setIsGlobalPassMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer">⏸️ Zawieś karnet</button>
                          <button onClick={() => { setIsSuspendHistoryModalOpen(true); setIsGlobalPassMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer">📜 Historia zawieszeń</button>
                          <button onClick={() => { alert("Wygenerowano link do płatności"); setIsGlobalPassMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer">💳 Wygeneruj link do płatności</button>
                          <div className="border-t border-slate-100 my-1"></div>
                          <button onClick={() => { if(profileClient.karnetyKlubowicza?.length > 0) handleConfirmDeletePass(profileClient.karnetyKlubowicza[0].id); setIsGlobalPassMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2.5 cursor-pointer">🗑️ Usuń karnet</button>
                        </div>
                      )}
                    </div>
                  </div>
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
                              
                              {karnet.zawieszonyOd && karnet.zawieszonyDo && (
                                <div className="flex items-center gap-1.5 bg-amber-100 text-amber-900 text-xs font-black px-3 py-1 rounded border border-amber-200">
                                  <span>⏸️ Zawieszony od {karnet.zawieszonyOd} do {karnet.zawieszonyDo}</span>
                                  <button 
                                    onClick={() => { setSuspendPassTarget(karnet); setSuspendStartDate(karnet.zawieszonyOd); setSuspendEndDate(karnet.zawieszonyDo); setIsSuspendModalOpen(true); }}
                                    className="w-5 h-5 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded flex items-center justify-center text-[10px] cursor-pointer ml-1"
                                    title="Modyfikuj lub odwołaj zawieszenie"
                                  >
                                    ✏️
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className="bg-rose-100 text-rose-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-rose-200">
                                {karnet.statusTekst}
                              </span>
                              <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
                                Cena: {karnet.cena} {karnet.znizkaProcentowa && <strong className="text-emerald-700 font-extrabold ml-1">{karnet.znizkaProcentowa}</strong>}
                              </span>
                              {karnet.rata && (
                                <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
                                  Rata: {karnet.rata}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button onClick={() => { setBlockDaysInput('3'); setBlockDateInput(karnet.blokadaDo || ''); setIsBlockModalOpen(true); }} className="bg-rose-50 hover:bg-rose-100 text-rose-800 px-3.5 py-2 rounded-xl text-xs font-bold border border-rose-200 cursor-pointer">⚙️ ZARZĄDZAJ BLOKADĄ</button>
                            
                            <button 
                              onClick={() => {
                                setExtendPassTarget(karnet);
                                setExtendSelectedNewPassName(karnet.nazwa);
                                const curDate = new Date(karnet.waznyDo || Date.now());
                                curDate.setMonth(curDate.getMonth() + 1);
                                setExtendNewDate(curDate.toISOString().split('T')[0]);
                                setIsExtendPassModalOpen(true);
                              }}
                              className="bg-sky-50 hover:bg-sky-100 text-sky-800 px-3.5 py-2 rounded-xl text-xs font-bold border border-sky-200 cursor-pointer flex items-center gap-1.5"
                              title="Przedłuż karnet"
                            >
                              🕒 Przedłuż
                            </button>

                            <button 
                              onClick={() => setEditingPassModal({ ...karnet })}
                              className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 flex items-center justify-center font-bold cursor-pointer shadow-sm"
                              title="Edytuj szczegóły karnetu"
                            >
                              ✏️
                            </button>
                          </div>

                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs">
                      Brak przypisanych karnetów. Kliknij „+ Dodaj drugi karnet”, aby przypisać karnet.
                    </div>
                  )}
                </div>
              </div>

              {/* Sekcja Portfel */}
              <div className="space-y-4">
                <h3 className="font-black text-xs text-slate-500 uppercase tracking-wider">Portfel</h3>
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex justify-between items-center">
                  <span className={`font-black px-3 py-1 rounded-xl text-sm border ${isWalletNegative(profileClient.wallet) ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>{profileClient.wallet}</span>
                  <div className="flex gap-3">
                    <button onClick={() => setIsWalletHistoryOpen(true)} className="text-slate-600 text-xs font-bold underline cursor-pointer">🕒 POKAŻ HISTORIĘ PORTFELA I OPERACJI</button>
                    <button onClick={() => setIsTopUpWalletOpen(true)} className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-black cursor-pointer">+ UZUPEŁNIJ PORTFEL</button>
                  </div>
                </div>
              </div>

              {/* Sekcja Zapisy na zajęcia */}
              <div className="space-y-4">
                <h3 className="font-black text-xs text-slate-500 uppercase tracking-wider">Zapisy na zajęcia</h3>
                
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
                    <button onClick={() => setActiveZapisyTab('nadchodzace')} className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${activeZapisyTab === 'nadchodzace' ? 'border-amber-600 text-amber-700 font-black bg-white' : 'border-transparent hover:bg-slate-100'}`}>NADCHODZĄCE</button>
                    <button onClick={() => setActiveZapisyTab('przeszle')} className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${activeZapisyTab === 'przeszle' ? 'border-amber-600 text-amber-700 font-black bg-white' : 'border-transparent hover:bg-slate-100'}`}>PRZESZŁE</button>
                    <button onClick={() => setActiveZapisyTab('wypisy')} className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${activeZapisyTab === 'wypisy' ? 'border-amber-600 text-amber-700 font-black bg-white' : 'border-transparent hover:bg-slate-100'}`}>WYPISY</button>
                    <button onClick={() => setActiveZapisyTab('automatyczne')} className={`flex-1 py-3 text-center border-b-2 transition-colors cursor-pointer ${activeZapisyTab === 'automatyczne' ? 'border-amber-600 text-amber-700 font-black bg-white' : 'border-transparent hover:bg-slate-100'}`}>AUTOMATYCZNE ZAPISY</button>
                  </div>

                  <div className="overflow-x-auto">
                    {activeZapisyTab === 'nadchodzace' && (
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <th className="py-2.5 px-4 w-10">#</th>
                            <th className="py-2.5 px-4">Data zajęć</th>
                            <th className="py-2.5 px-4">Zajęcia</th>
                            <th className="py-2.5 px-4">Karnet</th>
                            <th className="py-2.5 px-4">Kto zapisał</th>
                            <th className="py-2.5 px-4 text-right">Wypisz</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {profileClient.zapisyNadchodzace && profileClient.zapisyNadchodzace.map((item: any, idx: number) => (
                            <tr key={item.id}>
                              <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-4 font-mono">{item.data}</td>
                              <td className="py-3 px-4 font-bold">{item.zajecia}</td>
                              <td className="py-3 px-4 font-semibold">{item.karnet}</td>
                              <td className="py-3 px-4"><span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded text-[10px] font-bold border border-sky-200">{item.zapisujacy}</span></td>
                              <td className="py-3 px-4 text-right"><button onClick={() => handleWypiszZajecia(item)} className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer" title="Wypisz">🗑️</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {activeZapisyTab === 'przeszle' && (
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <th className="py-2.5 px-4 w-10">#</th>
                            <th className="py-2.5 px-4">Data zajęć</th>
                            <th className="py-2.5 px-4">Zajęcia</th>
                            <th className="py-2.5 px-4">Karnet</th>
                            <th className="py-2.5 px-4">Obecność</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {profileClient.zapisyPrzeszle && profileClient.zapisyPrzeszle.map((item: any, idx: number) => (
                            <tr key={item.id}>
                              <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-4 font-mono">{item.data}</td>
                              <td className="py-3 px-4 font-bold">{item.zajecia}</td>
                              <td className="py-3 px-4 font-semibold">{item.karnet}</td>
                              <td className="py-3 px-4"><span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">{item.obecnosc}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {activeZapisyTab === 'wypisy' && (
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <th className="py-2.5 px-4 w-10">#</th>
                            <th className="py-2.5 px-4">Data zajęć</th>
                            <th className="py-2.5 px-4">Zajęcia</th>
                            <th className="py-2.5 px-4">Informacja</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {profileClient.zapisyWypisy && profileClient.zapisyWypisy.map((item: any, idx: number) => (
                            <tr key={item.id}>
                              <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-3 px-4 font-mono">{item.data}</td>
                              <td className="py-3 px-4 font-bold">{item.zajecia}</td>
                              <td className="py-3 px-4"><span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-200">{item.wypisujacy}</span></td>
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

      {/* MODAL: PRZEDŁUŻ KARNET */}
      {isExtendPassModalOpen && profileClient && extendPassTarget && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 border border-sky-200">
            
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider flex items-center gap-2">
                <span>🕒</span> Przedłuż karnet dla {profileClient.firstName} {profileClient.lastName}
              </h3>
              <button onClick={() => setIsExtendPassModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleConfirmExtendPass} className="space-y-4 text-xs">
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Aktualny karnet</div>
                <div className="font-bold text-slate-900 text-sm">Karnet: {extendPassTarget.nazwa}</div>
                <div className="font-mono text-slate-600">Wygasa: {extendPassTarget.waznyDo}</div>
              </div>

              <div className="flex justify-center">
                <div className="w-7 h-7 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700 font-bold">↓</div>
              </div>

              <div className="bg-sky-50/50 border border-sky-200 rounded-2xl p-4 space-y-3">
                <div className="text-[10px] font-black text-sky-800 uppercase tracking-wider">Nowy karnet</div>
                
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="font-bold text-slate-700">Karnet: </span>
                    {isEditingNewPassType ? (
                      <select 
                        value={extendSelectedNewPassName}
                        onChange={(e) => setExtendSelectedNewPassName(e.target.value)}
                        className="bg-white border border-sky-300 rounded-lg px-2 py-1 font-bold ml-2 text-slate-800 cursor-pointer"
                      >
                        {dostepneKarnety.map(k => (
                          <option key={k.id} value={k.nazwa}>{k.nazwa}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-black text-slate-900">{extendSelectedNewPassName}</span>
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
                  <div className="flex-1">
                    <span className="font-bold text-slate-700">Data: </span>
                    {isEditingNewDate ? (
                      <input 
                        type="date"
                        value={extendNewDate}
                        onChange={(e) => setExtendNewDate(e.target.value)}
                        className="bg-white border border-sky-300 rounded-lg px-2 py-1 font-bold ml-2 text-slate-800"
                      />
                    ) : (
                      <span className="font-mono font-bold text-slate-900">{extendNewDate}</span>
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
                <button type="button" onClick={() => setIsExtendPassModalOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer uppercase">Anuluj</button>
                <button type="submit" className="bg-rose-900 hover:bg-rose-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer uppercase tracking-wider">🕒 Przedłuż</button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDYCJA DANYCH KONTA Z POZIOMU PROFILU */}
      {isEditProfileInfoOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">✏️ Edytuj dane konta</h3>
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
                <button type="button" onClick={() => setIsEditProfileInfoOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="bg-amber-700 hover:bg-amber-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer">Zapisz zmiany</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ZAWIEŚ KARNET */}
      {isSuspendModalOpen && profileClient && suspendPassTarget && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider flex items-center gap-2">
                <span>⏸️</span> Zawieś karnet
              </h3>
              <button onClick={() => setIsSuspendModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
              <div className="flex items-start gap-2">
                <span>ℹ️</span>
                <div>Klubowicz miał zawieszony karnet, łącznie przez <strong>0 dni w roku 2026</strong>.</div>
              </div>
              <button 
                type="button" 
                onClick={() => { setIsSuspendModalOpen(false); setIsSuspendHistoryModalOpen(true); }}
                className="text-amber-900 font-black underline uppercase text-[10px] tracking-wider cursor-pointer block pt-1"
              >
                📜 Zobacz historię zawieszeń
              </button>
            </div>

            <form onSubmit={handleConfirmSuspendPass} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Od kiedy chcesz zawiesić ten karnet?</label>
                <input 
                  type="date"
                  value={suspendStartDate}
                  onChange={(e) => setSuspendStartDate(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Do kiedy?</label>
                <input 
                  type="date"
                  value={suspendEndDate}
                  onChange={(e) => setSuspendEndDate(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                />
              </div>

              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900 flex items-start gap-2">
                <span>ℹ️</span>
                <div>Karnet zostanie automatycznie odwieszony w dniu: <strong>{suspendEndDate}</strong>. Okres ważności karnetu zostanie wydłużony po zakończeniu zawieszenia.</div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-sky-100">
                {suspendPassTarget.zawieszonyOd ? (
                  <button 
                    type="button"
                    onClick={() => { handleCancelSuspension(suspendPassTarget); setIsSuspendModalOpen(false); }}
                    className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-black px-4 py-2.5 rounded-xl cursor-pointer"
                  >
                    🚫 Odwołaj zawieszenie
                  </button>
                ) : <div></div>}

                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsSuspendModalOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer uppercase">Anuluj</button>
                  <button type="submit" className="bg-rose-900 hover:bg-rose-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer uppercase tracking-wider">⏸️ Zawieś</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: HISTORIA ZAWIESZEŃ */}
      {isSuspendHistoryModalOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider flex items-center gap-2">
                <span>📜</span> Historia zawieszeń
              </h3>
              <button onClick={() => setIsSuspendHistoryModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3 w-10">#</th>
                    <th className="py-2.5 px-3">Data zawieszenia</th>
                    <th className="py-2.5 px-3">Data aktywacji</th>
                    <th className="py-2.5 px-3">Okres</th>
                    <th className="py-2.5 px-3">Przez kogo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {profileClient.karnetyKlubowicza && profileClient.karnetyKlubowicza.flatMap((k: any) => k.historiaZawieszen || []).map((item: any, idx: number) => (
                    <tr key={item.id || idx}>
                      <td className="py-3 px-3 font-mono text-slate-400">{idx + 1}.</td>
                      <td className="py-3 px-3 font-mono">{item.dataZawieszenia}</td>
                      <td className="py-3 px-3 font-mono">{item.dataAtywacji}</td>
                      <td className="py-3 px-3 font-bold text-sky-900">{item.okres}</td>
                      <td className="py-3 px-3 font-semibold">{item.przezKogo}</td>
                    </tr>
                  ))}
                  {(!profileClient.karnetyKlubowicza || profileClient.karnetyKlubowicza.flatMap((k: any) => k.historiaZawieszen || []).length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">Brak historii zawieszeń karnetu.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3 flex justify-end border-t border-sky-100">
              <button onClick={() => setIsSuspendHistoryModalOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-5 py-2.5 rounded-xl cursor-pointer text-xs uppercase">Anuluj</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDYCJI POSZCZEGÓLNEGO KARNETU */}
      {editingPassModal && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">Edytuj karnet</h3>
              <button onClick={() => setEditingPassModal(null)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSavePassEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-bold text-slate-700">Karnet</label>
                <div className="col-span-2 space-y-1">
                  <select 
                    value={editingPassModal.nazwa}
                    onChange={(e) => {
                      const sel = e.target.value;
                      const match = dostepneKarnety.find(k => k.nazwa === sel);
                      setEditingPassModal({
                        ...editingPassModal,
                        nazwa: sel,
                        cena: match ? `${match.cena} PLN` : editingPassModal.cena
                      });
                    }}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 cursor-pointer"
                  >
                    {dostepneKarnety.map(k => (
                      <option key={k.id} value={k.nazwa}>{k.nazwa} ({k.cena} PLN)</option>
                    ))}
                    <option value={editingPassModal.nazwa}>{editingPassModal.nazwa}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-bold text-slate-700">Data zakończenia</label>
                <div className="col-span-2">
                  <input 
                    type="date"
                    value={editingPassModal.waznyDo}
                    onChange={(e) => setEditingPassModal({...editingPassModal, waznyDo: e.target.value})}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-bold text-slate-700">Cena</label>
                <div className="col-span-2 flex items-center gap-2">
                  <input 
                    type="text"
                    value={editingPassModal.cena}
                    onChange={(e) => setEditingPassModal({...editingPassModal, cena: e.target.value})}
                    placeholder="Wpisz własną cenę"
                    className="flex-1 bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 font-bold whitespace-nowrap">Własna cena</span>
                </div>
              </div>

              <div className="grid grid-cols-3 items-center gap-4">
                <label className="font-bold text-slate-700">Obecna rata</label>
                <div className="col-span-2 flex items-center gap-2">
                  <input 
                    type="text"
                    value={editingPassModal.rata || ''}
                    onChange={(e) => setEditingPassModal({...editingPassModal, rata: e.target.value})}
                    className="flex-1 bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-sky-100">
                <button 
                  type="button"
                  onClick={() => handleConfirmDeletePass(editingPassModal.id)}
                  className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-black px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
                >
                  🗑️ Usuń karnet
                </button>
                
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingPassModal(null)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
                  <button type="submit" className="bg-rose-900 hover:bg-rose-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer uppercase tracking-wider">Zapisz karnet</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DODAWANIA DRUGIEGO KARNETU */}
      {isAddSecondPassModalOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🎟️ Przypisz karnet z bazy</h3>
              <button onClick={() => setIsAddSecondPassModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleAddSecondPassSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Wybierz karnet *</label>
                <select value={selectedPassToAdd} onChange={(e) => setSelectedPassToAdd(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold cursor-pointer">
                  <option value="">-- Wybierz karnet --</option>
                  {dostepneKarnety.map(k => (
                    <option key={k.id} value={k.nazwa}>{k.nazwa} ({k.cena} PLN)</option>
                  ))}
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsAddSecondPassModalOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer">Przypisz</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BLOKADY */}
      {isBlockModalOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">⚙️ Zarządzanie blokadą</h3>
              <button onClick={() => setIsBlockModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveBlockModification} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold">Liczba dni blokady (0 aby zdjąć)</label>
                <input type="number" value={blockDaysInput} onChange={(e) => { setBlockDaysInput(e.target.value); if(e.target.value) setBlockDateInput(''); }} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold" />
              </div>
              <div className="text-center font-bold text-slate-400 uppercase text-[10px]">LUB</div>
              <div className="space-y-1">
                <label className="font-bold">Data końcowa blokady</label>
                <input type="date" value={blockDateInput} onChange={(e) => { setBlockDateInput(e.target.value); if(e.target.value) setBlockDaysInput(''); }} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold" />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsBlockModalOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="bg-amber-700 hover:bg-amber-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer">Zapisz</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PORTFELA */}
      {isTopUpWalletOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">💰 Modyfikacja portfela</h3>
              <button onClick={() => setIsTopUpWalletOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleTopUpWalletSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold">Kwota (+/-)</label>
                <input type="number" step="0.01" required value={walletAmountInput} onChange={(e) => setWalletAmountInput(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold" />
              </div>
              <div className="space-y-1">
                <label className="font-bold">Tytuł operacji (opcjonalnie)</label>
                <input type="text" value={walletReasonInput} placeholder="np. Gotówka w recepcji" onChange={(e) => setWalletReasonInput(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold" />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsTopUpWalletOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="bg-amber-700 hover:bg-amber-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer">Zatwierdź</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTORII OPERACJI */}
      {isWalletHistoryOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🕒 Historia operacji i portfela</h3>
              <button onClick={() => setIsWalletHistoryOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex justify-between items-center text-xs">
              <span className="font-bold text-amber-900 uppercase">Aktualne saldo klubowicza:</span>
              <span className={`text-base font-black px-3 py-1 rounded-lg border ${isWalletNegative(profileClient.wallet) ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>
                {profileClient.wallet}
              </span>
            </div>

            <div className="overflow-x-auto text-xs max-h-[60vh]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sky-50 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200 sticky top-0">
                    <th className="py-2.5 px-3">Data operacji</th>
                    <th className="py-2.5 px-3">Kategoria</th>
                    <th className="py-2.5 px-3">Kwota transakcji</th>
                    <th className="py-2.5 px-3">Szczegóły</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {profileClient.transakcje && profileClient.transakcje.map((item: any) => (
                    <tr key={item.id} className="hover:bg-sky-50/30 transition-colors">
                      <td className="py-3 px-3 font-mono">{new Date(item.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-3 px-3 font-bold uppercase text-[10px] tracking-wider text-sky-800">{item.typ_operacji.replace('_', ' ')}</td>
                      <td className={`py-3 px-3 font-black text-sm ${item.kwota !== null && item.kwota < 0 ? 'text-rose-600' : item.kwota !== null && item.kwota > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {item.kwota !== null ? `${item.kwota > 0 ? '+' : ''}${item.kwota.toFixed(2)} PLN` : '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-600" title={item.opis}>{item.opis}</td>
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
              <button onClick={() => setIsWalletHistoryOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer">Zamknij</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDYCJI KLIENTA */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">✏️ Edytuj dane</h3>
              <button onClick={() => setEditingClient(null)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="font-bold">Imię</label><input type="text" value={editingClient.firstName || ''} onChange={(e) => setEditingClient({...editingClient, firstName: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2" /></div>
                <div className="space-y-1"><label className="font-bold">Nazwisko</label><input type="text" value={editingClient.lastName || ''} onChange={(e) => setEditingClient({...editingClient, lastName: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2" /></div>
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setEditingClient(null)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="bg-amber-700 hover:bg-amber-800 text-white font-black px-6 py-2 rounded-xl cursor-pointer">Zaktualizuj</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DODAWANIA NOWEGO KLIENTA DO BAZY */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">👤 Dodaj nowego klubowicza</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer transition-colors">✕</button>
            </div>
            <form onSubmit={handleAddClientSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Imię *</label>
                  <input required type="text" value={newClient.firstName} onChange={(e) => setNewClient({...newClient, firstName: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nazwisko *</label>
                  <input required type="text" value={newClient.lastName} onChange={(e) => setNewClient({...newClient, lastName: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Telefon</label>
                <input type="text" value={newClient.phone} onChange={(e) => setNewClient({...newClient, phone: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Email</label>
                <input type="email" value={newClient.email} onChange={(e) => setNewClient({...newClient, email: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" />
              </div>
              
              <div className="space-y-1 pt-2">
                <label className="font-bold text-slate-700 block">Wybierz karnet początkowy (opcjonalnie)</label>
                <select 
                  value={newClient.selectedPass} 
                  onChange={(e) => setNewClient({...newClient, selectedPass: e.target.value})} 
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- Brak przypisanego karnetu --</option>
                  {dostepneKarnety.map(k => (
                    <option key={k.id} value={k.nazwa}>{k.nazwa} ({k.cena} PLN)</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors">Anuluj</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer transition-colors">Zapisz do bazy</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
