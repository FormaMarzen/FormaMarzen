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
  
  const [activationMode, setActivationMode] = useState<'today' | 'after'>('today');

  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [passToExtend, setPassToExtend] = useState<any>(null);

  // STANY DLA ZAWIESZEŃ KARNETU
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isSuspendInfoModalOpen, setIsSuspendInfoModalOpen] = useState(false);
  const [isUnsuspendModalOpen, setIsUnsuspendModalOpen] = useState(false);
  const [passToSuspendId, setPassToSuspendId] = useState<string>('');
  const [passToUnsuspendId, setPassToUnsuspendId] = useState<string>('');
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
      const { data: klientData } = await supabase
        .from('klienci')
        .select('*')
        .eq('E-mail', userEmail)
        .single();
        
      if (klientData) {
        if (typeof klientData.karnetyKlubowicza === 'string') {
          try {
            klientData.karnetyKlubowicza = JSON.parse(klientData.karnetyKlubowicza);
          } catch (e) {
            klientData.karnetyKlubowicza = [];
          }
        }
        setCurrentUser(klientData);
        
        const { data: tData } = await supabase
          .from('transakcje')
          .select('*')
          .eq('klient_id', klientData.id)
          .order('created_at', { ascending: false });
          
        if (tData) setTransakcje(tData);
      }
    }

    const { data: karnetyData } = await supabase.from('karnety').select('*');
    if (karnetyData) {
      setDostepneKarnety(karnetyData.map((k: any) => ({
        ...k,
        cena: k.cena_brutto || k.cena || '0.00'
      })));
    }
    
    setIsLoading(false);
  };

  const rawKarnetyList = Array.isArray(currentUser?.karnetyKlubowicza) ? currentUser.karnetyKlubowicza : [];
  
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

  const allSuspensions = karnetyList.flatMap((k: any) => 
    (k.historiaZawieszen || []).map((susp: any) => ({
      ...susp,
      karnetNazwa: k.nazwa
    }))
  ).sort((a: any, b: any) => new Date(b.utworzono).getTime() - new Date(a.utworzono).getTime());

  const dostepneKarnetyDoZakupu = dostepneKarnety.filter((defKarnetu) => {
    const limitWejscBaza = defKarnetu.ilosc_wejsc || defKarnetu.limitWejsc || defKarnetu.wejscia || null;
    const isTimeBased = limitWejscBaza === null || limitWejscBaza === '';
    const alreadyOwned = karnetyList.some((k: any) => k.nazwa === defKarnetu.nazwa);
    return !(isTimeBased && alreadyOwned);
  });

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
    
    const isTimeBased = passToExtend.pozostaloWejsc === null || passToExtend.pozostaloWejsc === undefined;
    let updatedKarnetyList = [...karnetyList];

    if (isTimeBased) {
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

    const latestExpDate = [...updatedKarnetyList].sort((a: any, b: any) => {
      const dateA = a.waznyDo || '9999-12-31';
      const dateB = b.waznyDo || '9999-12-31';
      return dateB.localeCompare(dateA); 
    })[0]?.waznyDo;

    if(latestExpDate) dbPayload.Wygasa = latestExpDate;
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
        typ_operacji: 'przedluzenie_karnetu',
        kwota: -cenaWartosc,
        opis: `Przedłużenie (Zakładka Karnet): ${passToExtend.nazwa}`
      }]);
    }
    alert(`Karnet "${passToExtend.nazwa}" został pomyślnie przedłużony.`);
    setIsExtendModalOpen(false);
    window.location.reload();
  };

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
    
    const isTimeBased = limitWejscBaza === null;
    const existingPassIndex = updatedKarnetyList.findIndex(k => k.nazwa === selectedBuyPass);

    let nowaDataWygasnieciaStr = '';

    if (isTimeBased && existingPassIndex !== -1) {
      updatedKarnetyList = updatedKarnetyList.map((k, index) => {
        if (index === existingPassIndex) {
          let baseDate = new Date();
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

    const latestExpDate = [...updatedKarnetyList].sort((a: any, b: any) => {
      const dateA = a.waznyDo || '9999-12-31';
      const dateB = b.waznyDo || '9999-12-31';
      return dateB.localeCompare(dateA); 
    })[0]?.waznyDo;

    if(latestExpDate) dbPayload.Wygasa = latestExpDate;
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

  const getDaysBetween = (d1: string, d2: string) => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    date1.setHours(0,0,0,0);
    date2.setHours(0,0,0,0);
    return Math.round(Math.abs((date2.getTime() - date1.getTime()) / (24 * 60 * 60 * 1000))) + 1;
  };

  const dzisiajString = new Date().toISOString().split('T')[0];

  // AUTOMATYCZNE WYPISYWANIE Z ZAJĘĆ PODCZAS ZAWIESZENIA
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

    if (cancelledCount > 0) {
      const { data: klientData } = await supabase.from('klienci').select('karnetyKlubowicza').eq('id', klientId).single();
      if (klientData) {
        let updatedKarnety = klientData.karnetyKlubowicza;
        if (typeof updatedKarnety === 'string') {
          try { updatedKarnety = JSON.parse(updatedKarnety); } catch(e) { updatedKarnety = []; }
        }
        if (!Array.isArray(updatedKarnety)) updatedKarnety = [];

        const passIndex = updatedKarnety.findIndex((k: any) => k.nazwa === nazwaKarnetu && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
        
        if (passIndex !== -1) {
          const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10) || 0;
          const poczatkowe = parseInt(updatedKarnety[passIndex].poczatkoweWejsc || currentRemaining + cancelledCount, 10);
          updatedKarnety[passIndex] = {
            ...updatedKarnety[passIndex],
            pozostaloWejsc: Math.min(poczatkowe, currentRemaining + cancelledCount)
          };
          await supabase.from('klienci').update({ karnetyKlubowicza: updatedKarnety }).eq('id', klientId);
        }
      }

      await supabase.from('transakcje').insert([{
        klient_id: klientId,
        typ_operacji: 'zajecia_wypis',
        opis: `Automatycznie wypisano z ${cancelledCount} przyszłych zajęć z powodu zawieszenia karnetu. Zwrócono ${cancelledCount} wejść.`
      }]);
    }
  };

  // ❄️ 1. LOGIKA ZAWIESZANIA (ZAPIS PLANU) - ZABRONIONA DATA WSTECZNA
  const handleSuspendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuspendError('');
    
    if (!passToSuspendId || !suspendStartDate || !suspendEndDate) {
      setSuspendError('Wypełnij wszystkie pola.');
      return;
    }

    // Bezpieczne porównanie stringów dat YYYY-MM-DD eliminujące błędy stref czasowych
    if (suspendStartDate < dzisiajString) {
      setSuspendError('Data rozpoczęcia nie może być w przeszłości. Zawieszenie jest możliwe od dzisiaj.');
      return;
    }
    if (suspendEndDate < suspendStartDate) {
      setSuspendError('Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.');
      return;
    }

    const requestedDays = getDaysBetween(suspendStartDate, suspendEndDate);
    if (requestedDays > 14) {
      setSuspendError(`Jednorazowe zawieszenie nie może być dłuższe niż 14 dni (Twoje: ${requestedDays}).`);
      return;
    }

    const karnetIndex = karnetyList.findIndex((k: any) => k.id.toString() === passToSuspendId.toString());
    if (karnetIndex === -1) return;
    
    const targetKarnet = karnetyList[karnetIndex];

    if (targetKarnet.waznyDo) {
      if (suspendStartDate > targetKarnet.waznyDo) {
        setSuspendError(`Zawieszenie musi rozpocząć się w trakcie ważności karnetu (najpóźniej ${targetKarnet.waznyDo}).`);
        return;
      }
    }

    const suspensionHistory = targetKarnet.historiaZawieszen || [];
    const startObj = new Date(suspendStartDate);
    const month = startObj.getMonth(); 
    const year = startObj.getFullYear();

    if (month === 8) {
      const usedInVacation = suspensionHistory.some((susp: any) => {
        const hStart = new Date(susp.od);
        const hMonth = hStart.getMonth();
        return hStart.getFullYear() === year && (hMonth === 6 || hMonth === 7);
      });
      if (usedInVacation) {
        setSuspendError('Zgodnie z regulaminem, jeśli karnet był zawieszany w wakacje (lipiec/sierpień), nie możesz zawiesić go we wrześniu.');
        return;
      }
    }

    const isVacation = (month === 6 || month === 7); 
    const quarter = Math.floor(month / 3) + 1;

    let sumDaysInPeriod = 0;
    let countSuspensionsInPeriod = 0;

    if (isVacation) {
      suspensionHistory.forEach((susp: any) => {
        const hStart = new Date(susp.od);
        if (hStart.getFullYear() === year && hStart.getMonth() === month) {
          const daysToCount = susp.status === 'aktywne' ? susp.planowane_dni : susp.dni;
          sumDaysInPeriod += daysToCount;
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
      suspensionHistory.forEach((susp: any) => {
        const hStart = new Date(susp.od);
        const hMonth = hStart.getMonth();
        const hQuarter = Math.floor(hMonth / 3) + 1;
        if (hStart.getFullYear() === year && hQuarter === quarter && hMonth !== 6 && hMonth !== 7) {
          const daysToCount = susp.status === 'aktywne' ? susp.planowane_dni : susp.dni;
          sumDaysInPeriod += daysToCount;
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

    let updatedKarnetyList = [...karnetyList];
    updatedKarnetyList[karnetIndex] = {
      ...targetKarnet,
      zawieszonyOd: suspendStartDate,
      zawieszonyDo: suspendEndDate,
      statusTekst: `Zawieszony (od ${suspendStartDate} do ${suspendEndDate})`,
      historiaZawieszen: [
        ...suspensionHistory,
        {
          od: suspendStartDate,
          planowane_do: suspendEndDate,
          do: '-',
          planowane_dni: requestedDays,
          dni: 0,
          status: 'aktywne',
          utworzono: new Date().toISOString()
        }
      ]
    };

    const dbPayload: any = {
      karnetyKlubowicza: typeof currentUser.karnetyKlubowicza === 'string' ? JSON.stringify(updatedKarnetyList) : updatedKarnetyList
    };

    const { error: updateError } = await supabase.from('klienci').update(dbPayload).eq('id', currentUser.id);

    if (updateError) {
      setSuspendError(`Błąd aktualizacji bazy danych: ${updateError.message}`);
      return;
    }

    // Automatyczne wypisanie z zajęć w okresie zawieszenia
    await handleAutoWypiszPoZawieszeniu(currentUser.id, suspendStartDate, suspendEndDate, targetKarnet.nazwa);

    alert(`Pomyślnie zapisano zawieszenie. System automatycznie wypisał Cię z zajęć w wybranym okresie.`);
    setIsSuspendModalOpen(false);
    setSuspendStartDate('');
    setSuspendEndDate('');
    window.location.reload();
  };

  // 🔓 2. LOGIKA ODWIESZANIA
  const handleUnsuspendSubmit = async () => {
    if (!passToUnsuspendId) return;
    
    const karnetIndex = karnetyList.findIndex((k: any) => k.id.toString() === passToUnsuspendId.toString());
    if (karnetIndex === -1) return;

    const targetKarnet = karnetyList[karnetIndex];
    if (!targetKarnet.zawieszonyOd) return;

    const today = new Date();
    today.setHours(0,0,0,0);
    const start = new Date(targetKarnet.zawieszonyOd);
    start.setHours(0,0,0,0);
    const plannedEnd = new Date(targetKarnet.zawieszonyDo);
    plannedEnd.setHours(0,0,0,0);

    let actualEnd = today;
    if (today < start) {
      actualEnd = start; 
    } else if (today > plannedEnd) {
      actualEnd = plannedEnd; 
    }

    let actualDays = 0;
    if (today >= start) {
      actualDays = getDaysBetween(targetKarnet.zawieszonyOd, actualEnd.toISOString().split('T')[0]);
    }

    let nowaDataWygasnieciaStr = targetKarnet.waznyDo;
    if (actualDays > 0 && targetKarnet.waznyDo) {
      const parts = targetKarnet.waznyDo.split('-');
      if (parts.length === 3) {
        const oldExpDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        oldExpDate.setDate(oldExpDate.getDate() + actualDays);
        nowaDataWygasnieciaStr = `${oldExpDate.getFullYear()}-${String(oldExpDate.getMonth() + 1).padStart(2, '0')}-${String(oldExpDate.getDate()).padStart(2, '0')}`;
      }
    }

    const updatedHistory = (targetKarnet.historiaZawieszen || []).map((susp: any) => {
      if (susp.status === 'aktywne') {
        return {
          ...susp,
          do: actualEnd.toISOString().split('T')[0],
          dni: actualDays,
          status: 'zakończone'
        };
      }
      return susp;
    });

    let updatedKarnetyList = [...karnetyList];
    updatedKarnetyList[karnetIndex] = {
      ...targetKarnet,
      zawieszonyOd: null,
      zawieszonyDo: null,
      waznyDo: nowaDataWygasnieciaStr,
      statusTekst: `Ważny do: ${nowaDataWygasnieciaStr}`,
      historiaZawieszen: updatedHistory
    };

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
      alert(`Błąd aktualizacji bazy danych: ${updateError.message}`);
      return;
    }

    alert(`Karnet odwieszony! Zużyto ${actualDays} dni z limitu. Data ważności przedłużona do: ${nowaDataWygasnieciaStr}`);
    setIsUnsuspendModalOpen(false);
    window.location.reload();
  };

  const activePassesForSuspend = karnetyList.filter((k: any) => {
    const isActive = !k.statusTekst?.includes('Oczekujący') && !k.zawieszonyOd && k.waznyDo;
    return isActive;
  });

  const suspendedPasses = karnetyList.filter((k: any) => k.zawieszonyOd);

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
              let isExpiring = false;
              let isPending = karnet.statusTekst?.includes('Oczekujący');
              let isSuspended = !!karnet.zawieszonyOd;

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

              let statusColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'; 
              if (isSuspended) {
                statusColorClass = 'bg-slate-100 text-slate-600 border-slate-300'; 
              } else if (isPending) {
                statusColorClass = 'bg-amber-100 text-amber-800 border-amber-200'; 
              } else if (isExpiring) {
                statusColorClass = 'bg-rose-100 text-rose-800 border-rose-200'; 
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
                    {isSuspended ? (
                       <button 
                         onClick={() => { setPassToUnsuspendId(karnet.id.toString()); setIsUnsuspendModalOpen(true); }}
                         className="bg-slate-800 border border-slate-900 text-white hover:bg-slate-900 font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                       >
                         <span className="text-sm">🔓</span> ODWIEŚ KARNET
                       </button>
                    ) : (
                      <button 
                        onClick={() => { setPassToExtend(karnet); setIsExtendModalOpen(true); }}
                        className="bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 hover:border-sky-300 hover:text-sky-900 font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="text-sm">🕒</span> PRZEDŁUŻ
                      </button>
                    )}
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
          <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">ZARZĄDZANIE ZAWIESZENIAMI</h2>
          <button 
            onClick={() => setIsSuspendInfoModalOpen(true)}
            className="text-sky-600 hover:text-sky-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200"
          >
            <span className="text-base leading-none">ℹ️</span> Zasady zawieszania karnetów
          </button>
        </div>
        
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-bold text-slate-800 text-sm">Chcesz zamrozić swój karnet?</h3>
              <p className="text-xs text-slate-500 mt-1">Niewykorzystane dni zostaną automatycznie doliczone do daty wygaśnięcia po Twoim powrocie (odwieszeniu).</p>
            </div>
            {suspendedPasses.length > 0 ? (
               <button 
                 onClick={() => {
                   setPassToUnsuspendId(suspendedPasses[0].id.toString());
                   setIsUnsuspendModalOpen(true);
                 }}
                 className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
               >
                 <span>🔓</span> ODWIEŚ KARNET
               </button>
            ) : (
              <button 
                onClick={() => {
                  if (activePassesForSuspend.length === 0) {
                    alert('Nie posiadasz aktualnie aktywnego karnetu, który można by zawiesić.');
                    return;
                  }
                  setPassToSuspendId(activePassesForSuspend[0].id.toString());
                  setIsSuspendModalOpen(true);
                }}
                className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>❄️</span> ZAWIEŚ KARNET
              </button>
            )}
          </div>

          {/* TABELA HISTORII ZAWIESZEŃ */}
          <div className="pt-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Historia Twoich zawieszeń</h3>
            {allSuspensions.length === 0 ? (
              <div className="text-xs text-slate-400 italic bg-white p-4 rounded-xl border border-slate-100 text-center">
                Brak historii zawieszeń na Twoim koncie.
              </div>
            ) : (
              <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-left border-collapse min-w-max text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Data Operacji</th>
                      <th className="py-3 px-4">Karnet</th>
                      <th className="py-3 px-4">Okres zawieszenia</th>
                      <th className="py-3 px-4 text-center">Zużyte dni</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {allSuspensions.map((susp: any, idx: number) => {
                      const formattedCreated = susp.utworzono ? new Date(susp.utworzono).toLocaleString('pl-PL', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'}) : '-';
                      const isZakonczone = susp.status === 'zakończone' || susp.status === undefined;

                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-500">{formattedCreated}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">{susp.karnetNazwa}</td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="font-semibold">{susp.od}</span> <span className="text-slate-400">do</span> <span className="font-semibold">{susp.status === 'aktywne' ? susp.planowane_do : susp.do}</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isZakonczone ? (
                              <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-bold border border-slate-200">{susp.dni} dni</span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-lg font-bold border border-slate-200 text-[10px]">Plan. {susp.planowane_dni}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isZakonczone ? (
                              <span className="text-emerald-600 font-bold flex items-center justify-end gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                Zakończone
                              </span>
                            ) : (
                              <span className="text-amber-600 font-bold flex items-center justify-end gap-1">
                                ⏳ Trwa
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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

      {/* MODAL ZASAD ZAWIESZEŃ (INFORMACYJNY) */}
      {isSuspendInfoModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="text-xl">ℹ️</span> Zasady zawieszania karnetów
              </h3>
              <button onClick={() => setIsSuspendInfoModalOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer text-lg">✕</button>
            </div>
            
            <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 text-sky-900 font-medium">
                Masz wyjazd służbowy, chorobę lub planujesz urlop? Nasz system pozwala na zamrożenie karnetu, abyś nie tracił opłaconych dni!
              </div>
              
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Standardowe zasady (w ciągu roku)</h4>
                <ul className="list-none space-y-2 pl-1">
                  <li className="flex gap-2"><span className="text-blue-500 font-bold">1.</span> Klient może zawiesić karnet maksymalnie <strong>2 razy w ciągu każdego kwartału</strong> roku.</li>
                  <li className="flex gap-2"><span className="text-blue-500 font-bold">2.</span> Maksymalna zsumowana ilość dni zawieszenia w kwartale to <strong>14 dni</strong>.</li>
                  <li className="flex gap-2"><span className="text-blue-500 font-bold">3.</span> Zawieszenie jest możliwe tylko od <strong>dzisiaj</strong> na czas trwania ważności karnetu. Nie ma możliwości zawieszania wstecz.</li>
                  <li className="flex gap-2"><span className="text-emerald-500 font-bold">4.</span> Możesz samodzielnie <strong>odwiesić karnet wcześniej</strong> - system obliczy zużyte dni i zaktualizuje limity.</li>
                </ul>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-4">
                <h4 className="font-bold text-slate-900 text-sm">Zasady wakacyjne (Lipiec, Sierpień, Wrzesień)</h4>
                <ul className="list-none space-y-2 pl-1">
                  <li className="flex gap-2"><span className="text-orange-500 font-bold">1.</span> W miesiącach letnich limit kwartalny nie obowiązuje.</li>
                  <li className="flex gap-2"><span className="text-orange-500 font-bold">2.</span> W lipcu oraz sierpniu możesz zawiesić karnet <strong>1 raz w każdym z tych miesięcy</strong>, na maksymalnie <strong>14 dni</strong>.</li>
                  <li className="flex gap-2"><span className="text-rose-500 font-bold">3.</span> Jeżeli zawiesisz karnet w lipcu lub sierpniu, <strong>tracisz możliwość zawieszenia go we wrześniu</strong>.</li>
                </ul>
              </div>
              
              <div className="bg-slate-100 p-3 rounded-lg text-[11px] font-semibold text-slate-500 mt-2">
                * Dni, w których karnet faktycznie był zawieszony, zostają automatycznie doliczone do daty wygaśnięcia Twojego karnetu po wykonaniu akcji ODWIESZENIA.
              </div>
            </div>

            <div className="pt-4 flex justify-end border-t border-slate-100">
              <button onClick={() => setIsSuspendInfoModalOpen(false)} className="bg-slate-800 hover:bg-slate-900 text-white font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer">
                Zrozumiałem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ODWIESZANIA KARNETU */}
      {isUnsuspendModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider">🔓 Odwieszenie karnetu</h3>
              <button onClick={() => setIsUnsuspendModalOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer text-lg">✕</button>
            </div>
            
            <div className="space-y-4 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium p-4 rounded-xl leading-relaxed text-center">
                Czy na pewno chcesz <strong>już dzisiaj</strong> odwiesić swój karnet i wrócić na treningi? <br/><br/>
                Po potwierdzeniu, system przeliczy dni, które rzeczywiście były zawieszone, i o tę wartość <strong>przedłuży ważność Twojego karnetu</strong>.
              </div>
              
              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsUnsuspendModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer">
                  Anuluj
                </button>
                <button onClick={handleUnsuspendSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer">
                  Tak, Odwieszam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ZAWIESZENIA KARNETU (FORMULARZ) */}
      {isSuspendModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider">❄️ Zawieszenie karnetu</h3>
              <button onClick={() => setIsSuspendModalOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer text-lg">✕</button>
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
                  {activePassesForSuspend.map((k: any) => (
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
                    min={dzisiajString} 
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
                    min={suspendStartDate || dzisiajString}
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
                Wybierz karnet, aby przypisać go bezpośrednio do Twojego konta.
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
