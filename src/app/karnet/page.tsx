"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../raporty/klienci/supabase';

export default function KarnetPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [transakcje, setTransakcje] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isBuyPassModalOpen, setIsBuyPassModalOpen] = useState(false);
  const [dostepneKarnety, setDostepneKarnety] = useState<any[]>([]);
  const [selectedBuyPass, setSelectedBuyPass] = useState('');
  
  // Stan do wyboru terminu aktywacji karnetu
  const [activationMode, setActivationMode] = useState<'today' | 'after'>('today');

  // Stany dla przedłużania konkretnego karnetu z poziomu kafelka
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [passToExtend, setPassToExtend] = useState<any>(null);

  // STANY DLA ZAWIESZEŃ KARNETU
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [passToSuspendId, setPassToSuspendId] = useState<string>('');
  const [suspendStartDate, setSuspendStartDate] = useState('');
  const [suspendEndDate, setSuspendEndDate] = useState('');
  const [suspendError, setSuspendError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email;

    if (userEmail) {
      // 1. Pobierz dane klienta z bazy
      const { data: klientData } = await supabase
        .from('klienci')
        .select('*')
        .eq('E-mail', userEmail)
        .single();
        
      if (klientData) {
        // Zabezpieczenie: jeśli baza zwróciła karnety jako tekst (JSON), zamieniamy na tablicę
        if (typeof klientData.karnetyKlubowicza === 'string') {
          try {
            klientData.karnetyKlubowicza = JSON.parse(klientData.karnetyKlubowicza);
          } catch (e) {
            klientData.karnetyKlubowicza = [];
          }
        }
        
        setCurrentUser(klientData);
        
        // 2. Pobierz historię transakcji klienta
        const { data: tData } = await supabase
          .from('transakcje')
          .select('*')
          .eq('klient_id', klientData.id)
          .order('created_at', { ascending: false });
          
        if (tData) setTransakcje(tData);
      }
    }

    // 3. Pobierz listę karnetów dostępnych do zakupu z bazy
    const { data: karnetyData } = await supabase.from('karnety').select('*');
    if (karnetyData) {
      setDostepneKarnety(karnetyData.map((k: any) => ({
        ...k,
        cena: k.cena_brutto || k.cena || '0.00'
      })));
    }
    
    setIsLoading(false);
  };

  // Ustalanie najdalszej daty końca obecnych karnetów
  const rawKarnetyList = Array.isArray(currentUser?.karnetyKlubowicza) ? currentUser.karnetyKlubowicza : [];
  
  // SORTOWANIE KARNETÓW: OD NAJSZYBCIEJ KOŃCZĄCYCH SIĘ NA SAMEJ GÓRZE
  const karnetyList = [...rawKarnetyList].sort((a: any, b: any) => {
    const dateA = a.waznyDo || '9999-12-31';
    const dateB = b.waznyDo || '9999-12-31';
    return dateA.localeCompare(dateB);
  });

  const hasActivePasses = karnetyList.length > 0;
  
  let maxDateStr = '';
  if (hasActivePasses) {
    let maxTime = 0;
    karnetyList.forEach((k: any) => {
      if (k.waznyDo) {
        const parts = k.waznyDo.split('-');
        if (parts.length === 3) {
          const t = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
          if (t > maxTime) {
            maxTime = t;
            maxDateStr = k.waznyDo;
          }
        }
      }
    });
  }

  // 🌟 INTELIGENTNY FILTR: UKRYWA KARNETY CZASOWE, KTÓRE UŻYTKOWNIK JUŻ POSIADA
  const dostepneKarnetyDoZakupu = dostepneKarnety.filter((defKarnetu) => {
    const limitWejscBaza = defKarnetu.ilosc_wejsc || defKarnetu.limitWejsc || defKarnetu.wejscia || null;
    const isTimeBased = limitWejscBaza === null || limitWejscBaza === '';
    const alreadyOwned = karnetyList.some((k: any) => k.nazwa === defKarnetu.nazwa);
    
    // Zwraca true (pokazuje), jeśli NIE JEST TO (karnet czasowy ORAZ użytkownik go posiada)
    return !(isTimeBased && alreadyOwned);
  });

  // PRZEDŁUŻENIE Z POZIOMU KAFELKA ("🕒 PRZEDŁUŻ")
  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !passToExtend) return;

    const defKarnetu = dostepneKarnety.find(k => k.nazwa === passToExtend.nazwa);
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

    const cenaWartosc = defKarnetu ? parseFloat(defKarnetu.cena) : parseFloat((passToExtend.cena || '0').replace(/[^0-9.-]+/g, ""));
    const cenaStr = defKarnetu ? `${defKarnetu.cena} PLN` : passToExtend.cena;
    
    // Sprawdzamy typ karnetu: jeśli brak limitu wejść to karnet czasowy
    const isTimeBased = passToExtend.pozostaloWejsc === null || passToExtend.pozostaloWejsc === undefined;

    let updatedKarnetyList = [...karnetyList];

    if (isTimeBased) {
      // KARNET CZASOWY: Zmieniamy tylko datę (nie tworzymy nowego kafelka)
      updatedKarnetyList = updatedKarnetyList.map(k => {
        if (k.id === passToExtend.id) {
          let baseDate = new Date();
          if (k.waznyDo) {
            const parts = k.waznyDo.split('-');
            if (parts.length === 3) {
              baseDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
          }
          baseDate.setDate(baseDate.getDate() + dniWażności);
          const year = baseDate.getFullYear();
          const month = String(baseDate.getMonth() + 1).padStart(2, '0');
          const day = String(baseDate.getDate()).padStart(2, '0');
          const nowaDataWygasnieciaStr = `${year}-${month}-${day}`;

          return {
            ...k,
            waznyDo: nowaDataWygasnieciaStr,
            cena: cenaStr,
            statusTekst: `Ważny do: ${nowaDataWygasnieciaStr}`
          };
        }
        return k;
      });
    } else {
      // KARNET NA WEJŚCIA: Tworzymy zupełnie nowy karnet
      let baseDate = new Date();
      if (passToExtend.waznyDo) {
        const parts = passToExtend.waznyDo.split('-');
        if (parts.length === 3) {
          baseDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
      }
      baseDate.setDate(baseDate.getDate() + dniWażności);
      const year = baseDate.getFullYear();
      const month = String(baseDate.getMonth() + 1).padStart(2, '0');
      const day = String(baseDate.getDate()).padStart(2, '0');
      const nowaDataWygasnieciaStr = `${year}-${month}-${day}`;
      
      const limitWejscBaza = defKarnetu ? (defKarnetu.ilosc_wejsc || defKarnetu.limitWejsc || defKarnetu.wejscia || null) : passToExtend.pozostaloWejsc;

      const nowyKarnetObj = {
        id: Date.now(),
        nazwa: passToExtend.nazwa,
        waznyDo: nowaDataWygasnieciaStr,
        pozostaloWejsc: limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : null,
        cena: cenaStr,
        znizkaProcentowa: '',
        rata: '1 / 1',
        statusTekst: `Oczekujący (Ważny od: ${passToExtend.waznyDo} do: ${nowaDataWygasnieciaStr})`,
        blokadaDo: null,
        powodBlokady: null,
        zawieszonyOd: null,
        zawieszonyDo: null,
        historiaZawieszen: []
      };
      
      updatedKarnetyList.push(nowyKarnetObj);
    }

    const currentWalletNum = parseFloat(currentUser.Portfel?.replace(/[^0-9.-]+/g, "") || "0");
    const nowyStanPortfela = currentWalletNum - cenaWartosc;
    const nowyStanPortfelaStr = `${nowyStanPortfela.toFixed(2)} PLN`;

    const dbPayload: any = {
      karnetyKlubowicza: typeof currentUser.karnetyKlubowicza === 'string' ? JSON.stringify(updatedKarnetyList) : updatedKarnetyList,
      Portfel: nowyStanPortfelaStr
    };

    // Zaktualizuj główną datę 'Wygasa' w kliencie
    const latestExpDate = [...updatedKarnetyList].sort((a: any, b: any) => {
      const dateA = a.waznyDo || '9999-12-31';
      const dateB = b.waznyDo || '9999-12-31';
      return dateB.localeCompare(dateA); 
    })[0]?.waznyDo;

    if(latestExpDate) {
      dbPayload.Wygasa = latestExpDate;
    }

    if (currentUser.Cena !== undefined) dbPayload.Cena = cenaStr;
    else if (currentUser.cena !== undefined) dbPayload.cena = cenaStr;

    // 1. Zapis do bazy
    const { error: updateError } = await supabase.from('klienci').update(dbPayload).eq('id', currentUser.id);

    if (updateError) {
      alert(`Błąd aktualizacji bazy danych: ${updateError.message}`);
      return;
    }

    // 2. Dodanie rekordu transakcji
    if (cenaWartosc > 0) {
      await supabase.from('transakcje').insert([{
        klient_id: currentUser.id,
        typ_operacji: 'przedluzenie_karnetu',
        kwota: -cenaWartosc,
        opis: `Przedłużenie (Zakładka Karnet): ${passToExtend.nazwa}`
      }]);
    }

    alert(`Karnet "${passToExtend.nazwa}" został pomyślnie przedłużony.`);
    setIsExtendModalOpen(false);
    window.location.reload();
  };

  // ZAKUP KARNETU Z LISTY ($ KUP KARNET)
  const handleBuyPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedBuyPass) return;

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

    let updatedKarnetyList = Array.isArray(currentUser.karnetyKlubowicza) ? [...currentUser.karnetyKlubowicza] : [];
    
    const cenaWartosc = defKarnetu ? parseFloat(defKarnetu.cena) : 0;
    const cenaStr = defKarnetu ? `${defKarnetu.cena} PLN` : '0.00 PLN';
    const limitWejscBaza = defKarnetu ? (defKarnetu.ilosc_wejsc || defKarnetu.limitWejsc || defKarnetu.wejscia || null) : null;
    
    // Sprawdzamy czy to karnet na czas (bez wejść) i czy mamy go już w tablicy
    const isTimeBased = limitWejscBaza === null;
    const existingPassIndex = updatedKarnetyList.findIndex(k => k.nazwa === selectedBuyPass);

    let nowaDataWygasnieciaStr = '';

    if (isTimeBased && existingPassIndex !== -1) {
      // PRZEDŁUŻAMY ISTNIEJĄCY KARNET CZASOWY
      updatedKarnetyList = updatedKarnetyList.map((k, index) => {
        if (index === existingPassIndex) {
          let baseDate = new Date();
          // Jeśli wybrano 'after' dla przedłużenia
          if (activationMode === 'after' && k.waznyDo) {
            const parts = k.waznyDo.split('-');
            if (parts.length === 3) {
              baseDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
          }
          baseDate.setDate(baseDate.getDate() + dniWażności);
          const year = baseDate.getFullYear();
          const month = String(baseDate.getMonth() + 1).padStart(2, '0');
          const day = String(baseDate.getDate()).padStart(2, '0');
          nowaDataWygasnieciaStr = `${year}-${month}-${day}`;

          return {
            ...k,
            waznyDo: nowaDataWygasnieciaStr,
            cena: cenaStr,
            statusTekst: `Ważny do: ${nowaDataWygasnieciaStr}`
          };
        }
        return k;
      });
    } else {
      // TWORZYMY CAŁKOWICIE NOWY KARNET (nowy kafelek)
      let baseStartDate = new Date(); 
      if (activationMode === 'after' && maxDateStr) {
        const parts = maxDateStr.split('-');
        baseStartDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }

      const dataWygasniecia = new Date(baseStartDate);
      dataWygasniecia.setDate(dataWygasniecia.getDate() + dniWażności);
      
      const year = dataWygasniecia.getFullYear();
      const month = String(dataWygasniecia.getMonth() + 1).padStart(2, '0');
      const day = String(dataWygasniecia.getDate()).padStart(2, '0');
      nowaDataWygasnieciaStr = `${year}-${month}-${day}`;

      const statusTekst = activationMode === 'after' 
        ? `Oczekujący (Ważny od: ${maxDateStr} do: ${nowaDataWygasnieciaStr})`
        : `Ważny do: ${nowaDataWygasnieciaStr}`;

      const nowyKarnetObj = {
        id: Date.now(),
        nazwa: selectedBuyPass,
        waznyDo: nowaDataWygasnieciaStr,
        pozostaloWejsc: limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : null,
        cena: cenaStr,
        znizkaProcentowa: '',
        rata: '1 / 1',
        statusTekst: statusTekst,
        blokadaDo: null,
        powodBlokady: null,
        zawieszonyOd: null,
        zawieszonyDo: null,
        historiaZawieszen: []
      };

      updatedKarnetyList.push(nowyKarnetObj);
    }

    const currentWalletNum = parseFloat(currentUser.Portfel?.replace(/[^0-9.-]+/g, "") || "0");
    const nowyStanPortfela = currentWalletNum - cenaWartosc;
    const nowyStanPortfelaStr = `${nowyStanPortfela.toFixed(2)} PLN`;

    const dbPayload: any = {
      karnetyKlubowicza: typeof currentUser.karnetyKlubowicza === 'string' ? JSON.stringify(updatedKarnetyList) : updatedKarnetyList,
      Portfel: nowyStanPortfelaStr
    };

    // Zaktualizuj główną datę 'Wygasa' w kliencie
    const latestExpDate = [...updatedKarnetyList].sort((a: any, b: any) => {
      const dateA = a.waznyDo || '9999-12-31';
      const dateB = b.waznyDo || '9999-12-31';
      return dateB.localeCompare(dateA); 
    })[0]?.waznyDo;

    if(latestExpDate) {
      dbPayload.Wygasa = latestExpDate;
    }

    if (currentUser.Cena !== undefined) dbPayload.Cena = cenaStr;
    else if (currentUser.cena !== undefined) dbPayload.cena = cenaStr;

    const { error: updateError } = await supabase.from('klienci').update(dbPayload).eq('id', currentUser.id);

    if (updateError) {
      alert(`Błąd aktualizacji bazy danych: ${updateError.message}`);
      return;
    }

    if (cenaWartosc > 0) {
      await supabase.from('transakcje').insert([{
        klient_id: currentUser.id,
        typ_operacji: 'zakup_karnetu',
        kwota: -cenaWartosc,
        opis: `Zakup (Zakładka Karnet): ${selectedBuyPass}`
      }]);
    }

    alert(`Gratulacje! Zapisano operację karnetu (Ważny do: ${nowaDataWygasnieciaStr}).`);
    setSelectedBuyPass('');
    setIsBuyPassModalOpen(false);
    window.location.reload(); 
  };

  const openBuyModal = () => {
    setActivationMode('today');
    setSelectedBuyPass('');
    setIsBuyPassModalOpen(true);
  };

  // POMOCNICZA FUNKCJA DO OBLICZANIA DNI POMIĘDZY DATAMI
  const getDaysBetween = (d1: string, d2: string) => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    date1.setHours(0,0,0,0);
    date2.setHours(0,0,0,0);
    return Math.round(Math.abs((date2.getTime() - date1.getTime()) / (24 * 60 * 60 * 1000))) + 1; // Włącznie z dniem początkowym
  };

  // ZAWIESZANIE KARNETU (OBSŁUGA ZASAD)
  const handleSuspendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuspendError('');
    
    if (!passToSuspendId || !suspendStartDate || !suspendEndDate) {
      setSuspendError('Wypełnij wszystkie pola.');
      return;
    }

    const start = new Date(suspendStartDate);
    const end = new Date(suspendEndDate);
    const today = new Date();
    today.setHours(0,0,0,0);

    if (start < today) {
      setSuspendError('Data rozpoczęcia nie może być w przeszłości.');
      return;
    }
    if (end < start) {
      setSuspendError('Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.');
      return;
    }

    const requestedDays = getDaysBetween(suspendStartDate, suspendEndDate);
    if (requestedDays > 14) {
      setSuspendError(`Jednorazowe zawieszenie nie może być dłuższe niż 14 dni (Twoje: ${requestedDays}).`);
      return;
    }

    // Wyciągnij karnet z bazy usera
    const karnetIndex = karnetyList.findIndex((k: any) => k.id.toString() === passToSuspendId.toString());
    if (karnetIndex === -1) {
      setSuspendError('Nie znaleziono karnetu.');
      return;
    }
    const targetKarnet = karnetyList[karnetIndex];
    const suspensionHistory = targetKarnet.historiaZawieszen || [];

    const month = start.getMonth(); // 0 = styczeń, 6 = lipiec, 7 = sierpień
    const year = start.getFullYear();

    const isVacation = (month === 6 || month === 7); 
    const quarter = Math.floor(month / 3) + 1;

    // Sprawdzanie zasad na podstawie historii
    let sumDaysInPeriod = 0;
    let countSuspensionsInPeriod = 0;

    if (isVacation) {
      // ZASADA 2: WAKACJE - 1 zawieszenie na max 14 dni w danym miesiącu
      suspensionHistory.forEach((susp: any) => {
        const hStart = new Date(susp.od);
        if (hStart.getFullYear() === year && hStart.getMonth() === month) {
          sumDaysInPeriod += susp.dni;
          countSuspensionsInPeriod += 1;
        }
      });
      if (countSuspensionsInPeriod >= 1) {
        setSuspendError(`Wygasł limit ilościowy zawieszeń (1/miesiąc) na miesiąc wakacyjny (${month === 6 ? 'Lipiec' : 'Sierpień'}).`);
        return;
      }
      if (sumDaysInPeriod + requestedDays > 14) {
        setSuspendError(`W tym miesiącu wakacyjnym pozostało Ci do wykorzystania tylko ${14 - sumDaysInPeriod} dni.`);
        return;
      }
    } else {
      // ZASADA 1: KWARTAŁ - max 2 zawieszenia, zsumowane max 14 dni
      suspensionHistory.forEach((susp: any) => {
        const hStart = new Date(susp.od);
        const hMonth = hStart.getMonth();
        const hQuarter = Math.floor(hMonth / 3) + 1;
        
        // Zliczamy tylko zawieszenia, które nie wypadły na wakacje (aby oddzielić logicznie system)
        if (hStart.getFullYear() === year && hQuarter === quarter && hMonth !== 6 && hMonth !== 7) {
          sumDaysInPeriod += susp.dni;
          countSuspensionsInPeriod += 1;
        }
      });
      if (countSuspensionsInPeriod >= 2) {
        setSuspendError('Wykorzystano już 2 dostępne zawieszenia w tym kwartale.');
        return;
      }
      if (sumDaysInPeriod + requestedDays > 14) {
        setSuspendError(`W tym kwartale pozostało Ci do wykorzystania tylko ${14 - sumDaysInPeriod} dni zawieszenia (Limit to 14 na kwartał).`);
        return;
      }
    }

    // APLIKACJA ZAWIESZENIA - WYDŁUŻENIE DATY WAŻNOŚCI KARNETU
    let updatedKarnetyList = [...karnetyList];
    let nowaDataWygasnieciaStr = targetKarnet.waznyDo;

    if (targetKarnet.waznyDo) {
      const parts = targetKarnet.waznyDo.split('-');
      if (parts.length === 3) {
        const oldExpDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        oldExpDate.setDate(oldExpDate.getDate() + requestedDays);
        
        const nYear = oldExpDate.getFullYear();
        const nMonth = String(oldExpDate.getMonth() + 1).padStart(2, '0');
        const nDay = String(oldExpDate.getDate()).padStart(2, '0');
        nowaDataWygasnieciaStr = `${nYear}-${nMonth}-${nDay}`;
      }
    }

    updatedKarnetyList[karnetIndex] = {
      ...targetKarnet,
      zawieszonyOd: suspendStartDate,
      zawieszonyDo: suspendEndDate,
      waznyDo: nowaDataWygasnieciaStr,
      statusTekst: `Zawieszony (${suspendStartDate} - ${suspendEndDate}) - przedłużony do ${nowaDataWygasnieciaStr}`,
      historiaZawieszen: [
        ...suspensionHistory,
        {
          od: suspendStartDate,
          do: suspendEndDate,
          dni: requestedDays,
          utworzono: new Date().toISOString()
        }
      ]
    };

    // Zaktualizuj główną datę 'Wygasa' w kliencie by system to widział globalnie
    const latestExpDate = [...updatedKarnetyList].sort((a: any, b: any) => {
      const dateA = a.waznyDo || '9999-12-31';
      const dateB = b.waznyDo || '9999-12-31';
      return dateB.localeCompare(dateA); 
    })[0]?.waznyDo;

    const dbPayload: any = {
      karnetyKlubowicza: typeof currentUser.karnetyKlubowicza === 'string' ? JSON.stringify(updatedKarnetyList) : updatedKarnetyList,
      Wygasa: latestExpDate
    };

    const { error: updateError } = await supabase.from('klienci').update(dbPayload).eq('id', currentUser.id);

    if (updateError) {
      setSuspendError(`Błąd aktualizacji bazy danych: ${updateError.message}`);
      return;
    }

    alert(`Pomyślnie zawieszono karnet na ${requestedDays} dni. Data wygaśnięcia przesunięta na: ${nowaDataWygasnieciaStr}`);
    setIsSuspendModalOpen(false);
    setSuspendStartDate('');
    setSuspendEndDate('');
    window.location.reload();
  };

  const activeTimePasses = karnetyList.filter((k: any) => {
    const limitWejscBaza = k.pozostaloWejsc;
    const isTimeBased = limitWejscBaza === null || limitWejscBaza === undefined;
    const isActive = !k.statusTekst?.includes('Oczekujący');
    // Umożliwiamy zawieszenie tylko karnetów czasowych (bez wejść), które już działają
    return isTimeBased && isActive;
  });

  if (isLoading) {
    return <div className="p-10 flex justify-center text-slate-400 font-bold uppercase text-xs">Ładowanie danych karnetu...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      
      {/* SEKCJA 1: AKTYWNE KARNETY */}
      <div>
        <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest mb-4">TWOJE KARNETY</h2>
        
        <div className="space-y-4">
          {karnetyList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
              <span className="text-4xl block mb-3">🎟️</span>
              <h3 className="text-slate-800 font-bold mb-1">Brak aktywnych karnetów</h3>
              <p className="text-slate-500 text-xs">Wykup karnet, aby w pełni korzystać z możliwości klubu.</p>
            </div>
          ) : (
            karnetyList.map((karnet: any) => {
              // WYLICZANIE KOLORÓW ETYKIETY (Oczekujący / Wygasa / Aktywny / Zawieszony)
              let isExpiring = false;
              let isPending = karnet.statusTekst?.includes('Oczekujący');
              let isSuspended = karnet.statusTekst?.includes('Zawieszony');

              if (!isPending && !isSuspended) {
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

              let statusColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'; // Domyślnie zielony
              if (isSuspended) {
                statusColorClass = 'bg-slate-100 text-slate-600 border-slate-300'; // Zawieszony (Szary)
              } else if (isPending) {
                statusColorClass = 'bg-amber-100 text-amber-800 border-amber-200'; // Oczekujący żółty
              } else if (isExpiring) {
                statusColorClass = 'bg-rose-100 text-rose-800 border-rose-200'; // Kończący się czerwony
              }

              return (
                <div key={karnet.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-3">
                      <h3 className="text-xl font-black text-slate-900">{karnet.nazwa}</h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-slate-100 text-slate-700 font-semibold px-3 py-1 rounded-full text-xs border border-slate-200 shadow-sm">
                          Aktywne zapisy: {karnet.pozostaloWejsc !== null && karnet.pozostaloWejsc !== undefined ? karnet.pozostaloWejsc : 'Bez limitu'}
                        </span>
                        <span className={`font-semibold px-3 py-1 rounded-full text-xs border shadow-sm ${statusColorClass}`}>
                          {karnet.statusTekst || `Ważny do: ${karnet.waznyDo}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-4 flex flex-wrap justify-end gap-2">
                    <button 
                      onClick={() => { setPassToExtend(karnet); setIsExtendModalOpen(true); }}
                      className="bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 hover:border-sky-300 hover:text-sky-900 font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="text-sm">🕒</span> PRZEDŁUŻ
                    </button>
                    <button 
                      onClick={openBuyModal}
                      className="border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer"
                    >
                      $ KUP KARNET
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button 
            onClick={openBuyModal}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-sm transition-colors cursor-pointer flex items-center gap-2"
          >
            <span className="text-lg leading-none rounded-full bg-white/20 w-4 h-4 flex items-center justify-center">+</span> DOKUP DODATKOWY KARNET
          </button>
        </div>
      </div>

      {/* SEKCJA 1.5: ZARZĄDZANIE ZAWIESZENIAMI */}
      <div className="pt-2">
        <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest mb-4">ZARZĄDZANIE ZAWIESZENIAMI</h2>
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-4 text-sm text-slate-700">
            <div className="w-10 h-10 shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center text-lg">❄️</div>
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900">Zasady zawieszania karnetu</h4>
              <ul className="list-disc pl-4 space-y-1 text-xs">
                <li>Możesz zawiesić karnet maksymalnie **2 razy w ciągu każdego kwartału** roku, na maksymalnie zsumowaną ilość **14 dni**.</li>
                <li>W miesiącach wakacyjnych (Lipiec i Sierpień) posiadasz **osobny limit**: 1 zawieszenie na miesiąc, trwające maksymalnie 14 dni.</li>
                <li>Dni, w których karnet jest zawieszony, zostają automatycznie doliczone do daty wygaśnięcia.</li>
              </ul>
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <button 
              onClick={() => {
                if (activeTimePasses.length === 0) {
                  alert('Nie posiadasz aktualnie aktywnego karnetu, który można by zawiesić (karnety na wejścia lub już zawieszone nie podlegają tej operacji).');
                  return;
                }
                setPassToSuspendId(activeTimePasses[0].id.toString());
                setIsSuspendModalOpen(true);
              }}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              ZAWIEŚ KARNET
            </button>
          </div>
        </div>
      </div>

      {/* SEKCJA 2: HISTORIA TRANSAKCJI */}
      <div className="pt-2">
        <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest mb-4">HISTORIA TRANSAKCJI</h2>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-5">#</th>
                  <th className="py-4 px-5">DATA TRANSAKCJI</th>
                  <th className="py-4 px-5">PRZEDMIOT</th>
                  <th className="py-4 px-5">CENA</th>
                  <th className="py-4 px-5">RABAT</th>
                  <th className="py-4 px-5">METODA PŁATNOŚCI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {transakcje.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">Brak historii transakcji w bazie.</td>
                  </tr>
                ) : (
                  transakcje.map((t: any, index: number) => {
                    const absKwota = Math.abs(t.kwota).toFixed(2);
                    const formattedDate = t.created_at ? t.created_at.replace('T', ' ').substring(0, 16) : '-';
                    
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-5 font-medium">{index + 1}.</td>
                        <td className="py-4 px-5">{formattedDate}</td>
                        <td className="py-4 px-5 max-w-[200px] truncate" title={t.opis || 'Karnet'}>
                          Karnet: <br/><span className="font-bold text-slate-900">{t.opis ? t.opis.split(': ')[1] || t.opis : 'OPEN'}</span>
                        </td>
                        <td className="py-4 px-5 font-bold text-slate-900">{absKwota} PLN</td>
                        <td className="py-4 px-5">-</td>
                        <td className="py-4 px-5 text-slate-500">Płatność online</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL ZAWIESZENIA KARNETU */}
      {isSuspendModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider">❄️ Zawieszenie karnetu</h3>
              <button onClick={() => setIsSuspendModalOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleSuspendSubmit} className="space-y-4 text-xs">
              
              {suspendError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl text-center">
                  ⚠️ {suspendError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Karnet do zawieszenia</label>
                <select 
                  required
                  value={passToSuspendId} 
                  onChange={(e) => setPassToSuspendId(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-3 font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {activeTimePasses.map((k: any) => (
                    <option key={k.id} value={k.id.toString()}>{k.nazwa} (Ważny do {k.waznyDo})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Od dnia *</label>
                  <input 
                    type="date" 
                    required 
                    value={suspendStartDate} 
                    onChange={(e) => setSuspendStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-3 font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Do dnia (włącznie) *</label>
                  <input 
                    type="date" 
                    required 
                    value={suspendEndDate} 
                    onChange={(e) => setSuspendEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-3 font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsSuspendModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer">
                  Anuluj
                </button>
                <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer">
                  Zamroź karnet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PRZEDŁUŻENIA KARNETU Z POZIOMU KAFELKA */}
      {isExtendModalOpen && passToExtend && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🕒 Przedłuż karnet</h3>
              <button onClick={() => setIsExtendModalOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleExtendSubmit} className="space-y-4 text-xs">
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 text-sky-900 font-medium space-y-2">
                <p>Przedłużasz karnet: <strong className="text-slate-900 text-sm block">{passToExtend.nazwa}</strong></p>
                <p>Obecna ważność: <strong>{passToExtend.waznyDo}</strong></p>
                {passToExtend.pozostaloWejsc === null || passToExtend.pozostaloWejsc === undefined 
                  ? <p className="text-emerald-700 font-bold mt-2">To karnet czasowy. Data jego wygaśnięcia zostanie bezpośrednio zaktualizowana bez tworzenia nowego kafelka.</p>
                  : <p className="text-blue-700 font-bold mt-2">To karnet na ilość wejść. Do Twojego konta zostanie wygenerowany nowy kafelek ze świeżą pulą wejść.</p>
                }
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsExtendModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer">
                  Anuluj
                </button>
                <button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer">
                  Przedłużam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ZAKUPU NOWEGO KARNETU */}
      {isBuyPassModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🎟️ Kup nowy karnet</h3>
              <button onClick={() => setIsBuyPassModalOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleBuyPassSubmit} className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 font-medium">
                Wybierz karnet, aby przypisać go bezpośrednio do Twojego konta. Posiadane już karnety czasowe zostały ukryte.
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Wybierz karnet *</label>
                <select 
                  required
                  value={selectedBuyPass} 
                  onChange={(e) => setSelectedBuyPass(e.target.value)} 
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-3 font-bold focus:outline-none focus:border-blue-500 cursor-pointer text-slate-800"
                >
                  <option value="" disabled>-- Wybierz karnet --</option>
                  {dostepneKarnetyDoZakupu.map(k => (
                    <option key={k.id} value={k.nazwa}>{k.nazwa} (Cena: {k.cena} PLN)</option>
                  ))}
                </select>
                {dostepneKarnetyDoZakupu.length === 0 && (
                  <p className="text-rose-500 font-bold text-[10px] mt-1">Masz już wszystkie dostępne karnety czasowe.</p>
                )}
              </div>

              {hasActivePasses && maxDateStr && dostepneKarnetyDoZakupu.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="font-bold text-slate-700 block mt-2">Kiedy karnet ma zacząć obowiązywać?</label>
                  <div className="space-y-2">
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${activationMode === 'today' ? 'bg-blue-50 border-blue-400' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
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
                        <span className="text-[10px] text-slate-500">Zaktualizuje status natychmiast</span>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${activationMode === 'after' ? 'bg-blue-50 border-blue-400' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
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
                        <span className="text-[10px] text-slate-500">Zacznie obowiązywać od: <strong className="text-blue-700">{maxDateStr}</strong></span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsBuyPassModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer">
                  Anuluj
                </button>
                <button 
                  type="submit" 
                  disabled={dostepneKarnetyDoZakupu.length === 0}
                  className={`font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer ${
                    dostepneKarnetyDoZakupu.length === 0 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  Kupuję
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
