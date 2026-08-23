"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../raporty/klienci/supabase';

// GLOBALNA BLOKADA (Zabezpieczenie przed podwójnym renderowaniem React Strict Mode)
let globalCreatingLock = false;
const SYSTEM_CHAT_ID = 5000;

// POMOCNICZA FUNKCJA DO PEWNEGO ODCZYTU RABATU CIĄGŁOŚCI OD ADMINA
const extractClientContinuityDiscount = (client: any): number | null => {
  if (!client) return null;
  
  // 1. PRIORYTET: Odczyt bezpośrednio z kolumny 'rabat' z bazy Supabase
  if (client.rabat !== undefined && client.rabat !== null && client.rabat !== '') {
    const val = parseFloat(String(client.rabat).replace(/[^0-9.-]/g, ''));
    if (!isNaN(val)) return val;
  }

  // 2. Warianty zapasowe
  const candidateKeys = [
    'rabat_za_ciaglosc',
    'Rabat za ciągłość',
    'rabatZaCiaglosc',
    'rabat_ciaglosc',
    'rabat_lojalnosciowy',
    'Rabat lojalnościowy',
    'system_discount_offset',
    'systemDiscountOffset'
  ];
  
  for (const k of candidateKeys) {
    if (client[k] !== undefined && client[k] !== null && client[k] !== '') {
      const val = parseFloat(String(client[k]).replace(/[^0-9.-]/g, ''));
      if (!isNaN(val)) return val;
    }
  }
  
  for (const key of Object.keys(client)) {
    const norm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (norm.includes('ciaglos') || norm.includes('ciaglo') || norm.includes('lojaln')) {
      if (client[key] !== undefined && client[key] !== null && client[key] !== '') {
        const val = parseFloat(String(client[key]).replace(/[^0-9.-]/g, ''));
        if (!isNaN(val)) return val;
      }
    }
  }
  return null;
};

// POMOCNICZA FUNKCJA DO OBSŁUGI STANU RATY I BONUSU DLA UMOWY 12M
const getContractRataInfo = (karnet: any) => {
  if (!karnet || !karnet.isContract12M) {
    return {
      isContract: false,
      rataNum: 0,
      isBonusActive: false,
      totalSuspUsed: 0,
      suspensionDaysLeft: 30,
      canActivateBonus: false,
      isFullyPaid: false
    };
  }

  let rataNum = 0;
  const rataStr = String(karnet.rata || '');
  const isBonusActive = rataStr.toLowerCase().includes('bonus') || karnet.statusTekst?.includes('Bonus z zawieszenia') || karnet.bonusActivated === true;

  if (isBonusActive) {
    rataNum = 13;
  } else {
    const match = rataStr.match(/(\d+)\s*\/\s*12/);
    if (match) {
      rataNum = parseInt(match[1], 10);
    }
  }

  const daysLeft = karnet.contractSuspensionDaysLeft !== undefined ? Number(karnet.contractSuspensionDaysLeft) : 30;
  const totalSuspUsed = karnet.totalSuspendedDaysUsed !== undefined && karnet.totalSuspendedDaysUsed !== null
    ? Number(karnet.totalSuspendedDaysUsed)
    : Math.max(0, 30 - daysLeft);

  const is12thPaid = rataNum >= 12 && !isBonusActive;
  const canActivateBonus = is12thPaid && totalSuspUsed > 0 && !isBonusActive && !karnet.bonusClaimed;
  const isFullyPaid = (is12thPaid && !canActivateBonus) || isBonusActive;

  return {
    isContract: true,
    rataNum,
    isBonusActive,
    totalSuspUsed,
    suspensionDaysLeft: daysLeft,
    canActivateBonus,
    isFullyPaid
  };
};

// POMOCNICZA FUNKCJA SPRAWDZAJĄCA CZY KARNET JEST AKTYWNY
const isPassActive = (k: any) => {
  if (!k) return false;
  const today = new Date().toISOString().split('T')[0];
  if (k.waznyDo && k.waznyDo < today) {
    return false;
  }
  if (k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined && k.pozostaloWejsc <= 0) {
    return false;
  }
  return true;
};

// POMOCNICZE FUNKCJE GRAMATYCZNE I DYNAMICZNEGO PRZELICZANIA WAŻNOŚCI KARNETÓW
const formatOkresGramatyka = (ilosc: number, jednostka: string): string => {
  if (jednostka === 'Dzień') {
    return ilosc === 1 ? 'dzień' : 'dni';
  }
  if (ilosc === 1) return 'miesiąc';
  const rem10 = ilosc % 10;
  const rem100 = ilosc % 100;
  if (rem10 >= 2 && rem10 <= 4 && (rem100 < 10 || rem100 >= 20)) {
    return 'miesiące';
  }
  return 'miesięcy';
};

const parsujOkresZDlugosci = (dlugoscStr: string) => {
  if (!dlugoscStr) return { ilosc: '1', jednostka: 'Miesiąc' };
  const match = dlugoscStr.match(/(\d+)\s*(dzień|dni|miesiąc|miesiące|miesięcy|m|d)/i);
  if (match) {
    const isDay = match[2].toLowerCase().startsWith('d');
    return {
      ilosc: match[1],
      jednostka: isDay ? 'Dzień' : 'Miesiąc'
    };
  }
  return { ilosc: '1', jednostka: 'Miesiąc' };
};

// DYNAMICZNY I NIEZAWODNY KALKULATOR DATY WYGAŚNIĘCIA KARNETU
const calculatePassValidityDaysOrEndDate = (baseDate: Date, passDef: any): Date => {
  let meta: Record<string, any> = {};
  if (passDef?.inne_ustawienia) {
    try {
      meta = typeof passDef.inne_ustawienia === 'string' ? JSON.parse(passDef.inne_ustawienia) : passDef.inne_ustawienia;
    } catch(e) {}
  }

  const typ = passDef?.typKarnetu || passDef?.typ_karnetu;
  const czasIlosc = parseInt(String(passDef?.czasIlosc || meta?.czasIlosc || ''), 10);
  const czasJednostka = passDef?.czasJednostka || meta?.czasJednostka;

  const limitIlosc = parseInt(String(passDef?.limitIlosc || meta?.limitIlosc || ''), 10);
  const limitOkres = passDef?.limitOkres || meta?.limitOkres;

  const targetDate = new Date(baseDate.getTime());

  if (typ === 'Na czas' && !isNaN(czasIlosc) && czasIlosc > 0) {
    if (czasJednostka === 'Dzień') {
      targetDate.setDate(targetDate.getDate() + czasIlosc);
      return targetDate;
    } else {
      targetDate.setMonth(targetDate.getMonth() + czasIlosc);
      return targetDate;
    }
  }

  if (typ === 'Na ilość treningów' && !isNaN(limitIlosc) && limitIlosc > 0) {
    if (limitOkres === 'Dzień') {
      targetDate.setDate(targetDate.getDate() + limitIlosc);
      return targetDate;
    } else {
      targetDate.setMonth(targetDate.getMonth() + limitIlosc);
      return targetDate;
    }
  }

  // Fallback z tekstu długości
  const dlugoscStr = (passDef?.dlugosc || passDef?.limitCzasowy || '').toLowerCase();
  
  const matchMonths = dlugoscStr.match(/(\d+)\s*(mies|m-c|rok|lat)/i);
  if (matchMonths) {
    let months = parseInt(matchMonths[1], 10) || 1;
    if (matchMonths[2].toLowerCase().startsWith('rok') || matchMonths[2].toLowerCase().startsWith('lat')) {
      months *= 12;
    }
    targetDate.setMonth(targetDate.getMonth() + months);
    return targetDate;
  }

  const matchDays = dlugoscStr.match(/(\d+)\s*(dni|dzień|d)/i);
  if (matchDays) {
    const days = parseInt(matchDays[1], 10) || 30;
    targetDate.setDate(targetDate.getDate() + days);
    return targetDate;
  }

  if (dlugoscStr.includes('rok')) {
    targetDate.setFullYear(targetDate.getFullYear() + 1);
    return targetDate;
  }

  targetDate.setMonth(targetDate.getMonth() + 1);
  return targetDate;
};

export default function KarnetyPage() {
  const [karnety, setKarnety] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dostepneRodzajeZajec, setDostepneRodzajeZajec] = useState<any[]>([]);
  
  // NOWOCZESNY SYSTEM POWIADOMIEŃ TOAST
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Stany dla strefy klubowicza (klient przeglądający swój karnet)
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [appRole, setAppRole] = useState<'admin' | 'trener' | 'klubowicz'>('klubowicz');

  // Stany dla modali w strefie klienta
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isSuspendInfoModalOpen, setIsSuspendInfoModalOpen] = useState(false);
  const [isUnsuspendModalOpen, setIsUnsuspendModalOpen] = useState(false);
  const [passToSuspendId, setPassToSuspendId] = useState<string>('');
  const [passToUnsuspendId, setPassToUnsuspendId] = useState<string>('');
  const [suspendStartDate, setSuspendStartDate] = useState('');
  const [suspendEndDate, setSuspendEndDate] = useState('');
  const [suspendError, setSuspendError] = useState('');

  const [isBuyPassModalOpen, setIsBuyPassModalOpen] = useState(false);
  const [dostepneKarnety, setDostepneKarnety] = useState<any[]>([]);
  const [selectedBuyPass, setSelectedBuyPass] = useState('');
  const [activationMode, setActivationMode] = useState<'today' | 'after'>('today');

  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [passToExtend, setPassToExtend] = useState<any>(null);

  // KODY RABATOWE
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscountCode, setAppliedDiscountCode] = useState<any>(null);
  const [discountCodeStatus, setDiscountCodeStatus] = useState({ type: '', message: '' });

  const todayStr = new Date().toISOString().split('T')[0];

  const resetDiscountState = () => {
    setDiscountCodeInput('');
    setAppliedDiscountCode(null);
    setDiscountCodeStatus({ type: '', message: '' });
  };

  // =========================================================================
  // 🎂 OBSŁUGA URODZIN (20% RABATU PRZEZ 5 DNI - DOKŁADNIE 1 RAZ W ROKU)
  // =========================================================================
  const checkBirthdayStatus = (birthDateStr: string | null | undefined, urodzinyRabatRok?: number | null) => {
    if (!birthDateStr) return { isBirthdayWindow: false, daysLeft: 0, isToday: false, alreadyUsedThisYear: false };

    const cleanStr = String(birthDateStr).trim();
    let bMonth = -1;
    let bDay = -1;

    const delimiter = cleanStr.includes('-') ? '-' : cleanStr.includes('.') ? '.' : cleanStr.includes('/') ? '/' : null;

    if (delimiter) {
      const parts = cleanStr.split(delimiter);
      if (parts.length >= 3) {
        if (parts[0].length === 4) {
          bMonth = parseInt(parts[1], 10) - 1;
          bDay = parseInt(parts[2], 10);
        } else {
          bDay = parseInt(parts[0], 10);
          bMonth = parseInt(parts[1], 10) - 1;
        }
      }
    }

    if (bMonth < 0 || isNaN(bMonth) || isNaN(bDay)) {
      return { isBirthdayWindow: false, daysLeft: 0, isToday: false, alreadyUsedThisYear: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();

    let thisYearBirthday = new Date(currentYear, bMonth, bDay);
    thisYearBirthday.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - thisYearBirthday.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const isWindow = diffDays >= 0 && diffDays < 5;
    const isUsed = Number(urodzinyRabatRok) === currentYear;

    if (isWindow) {
      return {
        isBirthdayWindow: true,
        daysLeft: 5 - diffDays,
        isToday: diffDays === 0,
        alreadyUsedThisYear: isUsed
      };
    }

    return { isBirthdayWindow: false, daysLeft: 0, isToday: false, alreadyUsedThisYear: isUsed };
  };

  // 💬 WYSYŁANIE WIADOMOŚCI URODZINOWEJ NA CZAT
  const sendBirthdayChatMessage = async (client: any) => {
    if (!client || !client.id) return;
    const currentYear = new Date().getFullYear();
    const lastSentYear = client.ostatnie_zyczenia_rok || client.urodziny_wiadomosc_rok;

    if (Number(lastSentYear) === currentYear) return;

    const birthdayMessage = `🎂 Wszystkiego najlepszego z okazji urodzin od całego zespołu FORMA MARZEŃ! 🎉 Z tej okazji przygotowaliśmy dla Ciebie specjalny prezent: 20% rabatu na zakup lub przedłużenie karnetu (do jednorazowego wykorzystania w ciągu 5 dni). Rabat nalicza się automatycznie w Twoim panelu!`;

    try {
      await supabase.from('czat_wiadomosci').insert([{
        nadawca_id: SYSTEM_CHAT_ID,
        nadawca_nazwa: 'Forma Marzeń (System)',
        nadawca_avatar: null,
        odbiorca_id: client.id,
        tresc: birthdayMessage,
        przeczytana: false,
        przeczytana_at: null,
        created_at: new Date().toISOString()
      }]);
    } catch (e) {
      console.log("Błąd zapisu wiadomości urodzinowej:", e);
    }

    try {
      await supabase.from('klienci').update({
        ostatnie_zyczenia_rok: currentYear
      }).eq('id', client.id);
    } catch (e) {}
  };

  // =========================================================================
  // 🏷️ WERYFIKACJA I NALICZANIE KODU RABATOWEGO
  // =========================================================================
  const handleApplyDiscountCode = async (e: React.MouseEvent) => {
    e.preventDefault();
    setDiscountCodeStatus({ type: 'loading', message: 'Sprawdzanie kodu...' });
    if (!discountCodeInput.trim()) {
      setDiscountCodeStatus({ type: 'error', message: 'Wpisz kod rabatowy' });
      return;
    }

    const currentPassName = isExtendModalOpen ? passToExtend?.nazwa : selectedBuyPass;

    if (!currentPassName) {
      setDiscountCodeStatus({ type: 'error', message: 'Najpierw wybierz karnet' });
      return;
    }

    const { data, error } = await supabase
      .from('kody_rabatowe')
      .select('*')
      .ilike('kod', discountCodeInput.trim())
      .maybeSingle();

    if (error || !data) {
      setDiscountCodeStatus({ type: 'error', message: 'Nieprawidłowy lub nieistniejący kod' });
      return;
    }

    if (!data.aktywny) {
      setDiscountCodeStatus({ type: 'error', message: 'Ten kod jest obecnie nieaktywny' });
      return;
    }

    if (data.data_zakonczenia && new Date(data.data_zakonczenia) < new Date(new Date().setHours(0,0,0,0))) {
      setDiscountCodeStatus({ type: 'error', message: 'Ten kod rabatowy stracił już ważność' });
      return;
    }

    if (data.limit_ogolny > 0 && (data.wykorzystano_ogolnie || 0) >= data.limit_ogolny) {
      setDiscountCodeStatus({ type: 'error', message: 'Ogólny limit użyć tego kodu został wyczerpany' });
      return;
    }

    if (!data.wszystkie_karnety && Array.isArray(data.wybrane_karnety)) {
      if (!data.wybrane_karnety.includes(currentPassName)) {
        setDiscountCodeStatus({ type: 'error', message: `Ten kod rabatowy nie obejmuje karnetu: "${currentPassName}"` });
        return;
      }
    }

    if (currentUser?.id) {
      const { count, error: countErr } = await supabase
        .from('kody_rabatowe_uzycia')
        .select('*', { count: 'exact', head: true })
        .eq('kod_id', data.id)
        .eq('klient_id', currentUser.id);

      if (!countErr && typeof count === 'number') {
        const limitNaOsobe = data.limit_na_osobe || 1;
        if (count >= limitNaOsobe) {
          setDiscountCodeStatus({ 
            type: 'error', 
            message: `Wykorzystałeś już ten kod maksymalną liczbę razy (${count}/${limitNaOsobe}).` 
          });
          return;
        }
      }
    }

    setAppliedDiscountCode(data);
    setDiscountCodeStatus({ 
      type: 'success', 
      message: `Zastosowano rabat: ${data.wartosc_znizki}${data.typ_znizki === 'procentowa' ? '%' : ' PLN'}` 
    });
  };

  const calculateFinalPrice = (basePriceNum: number, userEffectiveDiscount: any, appliedCode: any) => {
    let finalPrice = basePriceNum;
    let appliedLabel = '';
    
    if (appliedCode) {
      if (appliedCode.typ_znizki === 'procentowa') {
        finalPrice = basePriceNum * (1 - appliedCode.wartosc_znizki / 100);
        appliedLabel = `(-${appliedCode.wartosc_znizki}% kod: ${appliedCode.kod})`;
      } else {
        finalPrice = basePriceNum - appliedCode.wartosc_znizki;
        appliedLabel = `(-${appliedCode.wartosc_znizki} PLN kod: ${appliedCode.kod})`;
      }
    } else if (userEffectiveDiscount && userEffectiveDiscount.percent > 0) {
      finalPrice = basePriceNum * (1 - userEffectiveDiscount.percent / 100);
      appliedLabel = userEffectiveDiscount.label;
    }

    if (finalPrice < 0) finalPrice = 0;
    return { finalPrice, appliedLabel };
  };

  const incrementCodeUsage = async (codeId: string, klientId: number, karnetId: number | null, transakcjaId: number | null) => {
    const { data } = await supabase.from('kody_rabatowe').select('wykorzystano_ogolnie').eq('id', codeId).single();
    if (data) {
      await supabase.from('kody_rabatowe').update({ wykorzystano_ogolnie: (data.wykorzystano_ogolnie || 0) + 1 }).eq('id', codeId);
    }
    await supabase.from('kody_rabatowe_uzycia').insert([{
      kod_id: codeId,
      klient_id: klientId,
      karnet_id: karnetId,
      transakcja_id: transakcjaId
    }]);
  };

  // =========================================================================
  // KALKULACJA RABATU SYSTEMOWEGO (ZA CIĄGŁOŚĆ) - WYJĄTEK < 150 ZŁ
  // =========================================================================
  const calculateContinuityDiscount = (client: any, basePriceToCheck?: number) => {
    if (!client) return { hasContinuity: false, percent: 0, label: '0% (Brak)' };

    // WYJĄTEK SYSTEMOWY: Blokada rabatu za ciągłość poniżej 150 zł
    if (basePriceToCheck !== undefined && basePriceToCheck < 150) {
      return { hasContinuity: false, percent: 0, label: '0% (Karnet < 150 zł - brak rabatu ciągłości)' };
    }
    
    if (client.hasLostContinuity === true || client.hasLostContinuity === 'true') {
      return { hasContinuity: false, percent: 0, label: '0% (Wyzerowano)' };
    }

    const manualVal = extractClientContinuityDiscount(client);
    if (manualVal !== null) {
      if (manualVal <= 0) {
        return { hasContinuity: false, percent: 0, label: '0% (Wyzerowano)' };
      }
      return {
        hasContinuity: true,
        percent: Math.min(25, manualVal),
        label: `${manualVal}% (Rabat ciągłościowy)`
      };
    }

    const rawKarnety = client.karnetyKlubowicza || [];
    const karnety = rawKarnety.filter(isPassActive);
    if (karnety.length === 0) return { hasContinuity: false, percent: 0, label: '0% (Pierwszy zakup)' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let isContinuous = false;
    let maxCykl = 1;

    for (const k of karnety) {
      if (k.isContract12M) continue;

      const passCycle = typeof k.cykl === 'number' ? k.cykl : 1;
      maxCykl = Math.max(maxCykl, passCycle);

      if (k.waznyDo) {
        const exp = new Date(k.waznyDo);
        exp.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today.getTime() - exp.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 1) {
          isContinuous = true;
        }
      }
    }

    if (!isContinuous) {
      return { hasContinuity: false, percent: 0, label: '0% (Brak ciągłości - zresetowano)' };
    }

    const liczbaKarnetow = maxCykl;
    let rabatProcent = 0;

    if (liczbaKarnetow === 1) {
      rabatProcent = 2;
    } else if (liczbaKarnetow === 2) {
      rabatProcent = 4;
    } else if (liczbaKarnetow >= 3) {
      rabatProcent = Math.min(25, 4 + (liczbaKarnetow - 2) * 1);
    }

    const offset = typeof client.system_discount_offset === 'number' ? client.system_discount_offset : 0;
    rabatProcent = Math.max(0, rabatProcent + offset);

    if (rabatProcent === 0) {
      return { hasContinuity: false, percent: 0, label: '0% (Wyzerowano)' };
    }

    return {
      hasContinuity: true,
      percent: rabatProcent,
      label: `${rabatProcent}% (Ciągłość: poziom ${liczbaKarnetow})`
    };
  };

  // EFEKTYWNY RABAT Z UWZGLĘDNIENIEM WYJĄTKU < 150 ZŁ I UMOWY 12M
  const getEffectiveDiscount = (client: any, isTargetContract: boolean = false, basePriceToCheck?: number) => {
    if (!client) return { percent: 0, label: '', type: 'none', isBirthday: false, continuityPercent: 0, birthdayPercent: 0, daysLeftBirthday: 0, isBirthdayUsedThisYear: false };
    
    const bStatus = checkBirthdayStatus(client.birthDate || client.Urodziny || client.urodziny || client['Data urodzenia'], client.urodziny_rabat_rok);
    
    const birthdayDiscountVal = (bStatus.isBirthdayWindow && !bStatus.alreadyUsedThisYear) ? 20 : 0;
    const manualDiscountVal = client.discount ? parseFloat(String(client.discount).replace(/[^0-9.]/g, '')) : 0;
    
    const continuityInfo = !isTargetContract ? calculateContinuityDiscount(client, basePriceToCheck) : { hasContinuity: false, percent: 0, label: '' };
    const continuityDiscountVal = continuityInfo.hasContinuity ? continuityInfo.percent : 0;

    let totalPercent = 0;
    let labelParts: string[] = [];

    if (birthdayDiscountVal > 0) {
      totalPercent += birthdayDiscountVal;
      labelParts.push(`20% rabat urodzinowy`);
    }

    if (manualDiscountVal > 0) {
      totalPercent += manualDiscountVal;
      labelParts.push(`${manualDiscountVal}% rabat stały`);
    } else if (continuityDiscountVal > 0 && !isTargetContract) {
      totalPercent += continuityDiscountVal;
      labelParts.push(`${continuityDiscountVal}% ciągłość`);
    }

    if (totalPercent > 0) {
      return {
        percent: Math.min(100, totalPercent),
        label: `(-${totalPercent}% ${labelParts.join(' + ')})`,
        type: birthdayDiscountVal > 0 ? 'birthday' : (manualDiscountVal > 0 ? 'manual' : 'system'),
        isBirthday: birthdayDiscountVal > 0,
        continuityPercent: continuityDiscountVal,
        birthdayPercent: birthdayDiscountVal,
        daysLeftBirthday: bStatus.daysLeft,
        isBirthdayUsedThisYear: bStatus.alreadyUsedThisYear
      };
    }

    return { 
      percent: 0, 
      label: '', 
      type: 'none', 
      isBirthday: false, 
      continuityPercent: 0, 
      birthdayPercent: 0, 
      daysLeftBirthday: bStatus.daysLeft,
      isBirthdayUsedThisYear: bStatus.alreadyUsedThisYear
    };
  };

  // PRO-RATA DLA UMOWY 12M (Miesiąc zerowy)
  const calculateContractProRata = (baseMonthlyPrice: number) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = today.getDate();
    const remainingDays = totalDaysInMonth - currentDay + 1;
    const proRataFirstMonth = (baseMonthlyPrice / totalDaysInMonth) * remainingDays;
    const endOfFirstMonth = new Date(currentYear, currentMonth + 1, 0);
    const endOfFirstMonthStr = `${endOfFirstMonth.getFullYear()}-${String(endOfFirstMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfFirstMonth.getDate()).padStart(2, '0')}`;
    const endOfContract = new Date(currentYear, currentMonth + 13, 0);
    const endOfContractStr = `${endOfContract.getFullYear()}-${String(endOfContract.getMonth() + 1).padStart(2, '0')}-${String(endOfContract.getDate()).padStart(2, '0')}`;
    return {
      remainingDays,
      totalDaysInMonth,
      proRataFirstMonth: Math.round(proRataFirstMonth * 100) / 100,
      endOfFirstMonthStr,
      endOfContractStr
    };
  };
  // 1. POBIERANIE DANYCH Z SUPABASE ORAZ AUTOMATYCZNA KONTROLA WAŻNOŚCI KARNETÓW
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

      if (userEmail) {
        const normalizedEmail = userEmail.toLowerCase().trim();
        const { data: klienciData } = await supabase.from('klienci').select('*');
        
        if (klienciData) {
          const todayDateOnly = new Date().toISOString().split('T')[0];

          const enriched = await Promise.all(klienciData.map(async (c: any) => {
            let parsedKarnety: any[] = [];
            if (Array.isArray(c.karnetyKlubowicza)) {
              parsedKarnety = c.karnetyKlubowicza;
            } else if (typeof c.karnetyKlubowicza === 'string') {
              try { parsedKarnety = JSON.parse(c.karnetyKlubowicza); } catch(e) {}
            }

            let parsedGlobalHistory = [];
            if (Array.isArray(c.historiaZawieszenGlobalna)) {
              parsedGlobalHistory = c.historiaZawieszenGlobalna;
            } else if (typeof c.historiaZawieszenGlobalna === 'string') {
              try { parsedGlobalHistory = JSON.parse(c.historiaZawieszenGlobalna); } catch(e) {}
            }

            // BIEŻĄCA KONTROLA I ZEROWANIE WEJŚĆ PO WYGAŚNIĘCIU DATY KARNETU
            let karnetyChanged = false;
            const verifiedKarnety = parsedKarnety.map((k: any) => {
              if (k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined) {
                if (k.waznyDo && k.waznyDo < todayDateOnly && k.pozostaloWejsc > 0) {
                  karnetyChanged = true;
                  return {
                    ...k,
                    pozostaloWejsc: 0,
                    statusTekst: `Wygasł (${k.waznyDo}) - wejścia wyzerowane`
                  };
                }
              }
              return k;
            });

            if (karnetyChanged) {
              try {
                await supabase.from('klienci').update({
                  karnetyKlubowicza: verifiedKarnety
                }).eq('id', c.id);
              } catch (errDb) {
                console.error("Błąd zapisu wyzerowanych karnetów:", errDb);
              }
            }

            const rawContinuity = extractClientContinuityDiscount(c);

            return {
              ...c,
              id: c.id,
              firstName: c.Imię || '',
              lastName: c.Nazwisko || '',
              email: c['E-mail'] || c.email || '',
              discount: c.discount || '',
              birthDate: c.Urodziny || c.urodziny || c['Data urodzenia'] || c.Data_urodzenia || c.data_urodzenia || null,
              urodziny_rabat_rok: c.urodziny_rabat_rok || null,
              ostatnie_zyczenia_rok: c.ostatnie_zyczenia_rok || null,
              hasLostContinuity: c.hasLostContinuity ?? false,
              rabat: c.rabat,
              rabat_za_ciaglosc: rawContinuity !== null ? `${rawContinuity}%` : null,
              'Rabat za ciągłość': rawContinuity !== null ? `${rawContinuity}%` : null,
              system_discount_offset: c.system_discount_offset || 0,
              karnetyKlubowicza: verifiedKarnety,
              historiaZawieszenGlobalna: parsedGlobalHistory,
              wallet: c.Portfel || c.portfel || c.wallet || '0.00 PLN'
            };
          }));
          
          let myUser = enriched.find((c: any) => c.email.toLowerCase().trim() === normalizedEmail);
          
          if (!myUser && appRole === 'klubowicz') {
             if (globalCreatingLock) return;
             globalCreatingLock = true;
             
             const newClientId = Date.now();
             const defaultClient: any = {
               id: newClientId,
               Imię: userEmail.split('@')[0],
               Nazwisko: 'Klubowicz',
               "E-mail": userEmail,
               "Numer tel.": '-',
               Portfel: '0.00 PLN',
               discount: '',
               Urodziny: null,
               urodziny_rabat_rok: null,
               ostatnie_zyczenia_rok: null,
               hasLostContinuity: false,
               rabat: 0,
               rabat_za_ciaglosc: '0%',
               system_discount_offset: 0,
               Zarejestrowany: new Date().toISOString().split('T')[0],
               karnetyKlubowicza: []
             };
             
             const { error: insertErr } = await supabase.from('klienci').insert([defaultClient]);
             if (!insertErr) {
               myUser = {
                 ...defaultClient,
                 firstName: defaultClient.Imię,
                 lastName: defaultClient.Nazwisko,
                 email: defaultClient["E-mail"],
                 discount: '',
                 birthDate: null,
                 urodziny_rabat_rok: null,
                 ostatnie_zyczenia_rok: null,
                 hasLostContinuity: false,
                 rabat: 0,
                 rabat_za_ciaglosc: '0%',
                 'Rabat za ciągłość': '0%',
                 system_discount_offset: 0,
                 historiaZawieszenGlobalna: [],
                 wallet: '0.00 PLN'
               };
             }
             globalCreatingLock = false;
          }
          
          if (myUser) {
            setCurrentUser(myUser);
            const bStatus = checkBirthdayStatus(myUser.birthDate, myUser.urodziny_rabat_rok);
            if (bStatus.isBirthdayWindow) {
              sendBirthdayChatMessage(myUser);
            }
          }
        }
      }

      // Pobieranie karnetów
      const { data: karnetyData, error: karnetyError } = await supabase
        .from('karnety')
        .select('*')
        .order('id', { ascending: false });

      if (!karnetyError && karnetyData) {
        const parsedData = karnetyData.map((item: any) => {
          let meta: Record<string, any> = {};
          try {
            meta = JSON.parse(item.inne_ustawienia || '{}');
          } catch (e) {}

          const is12M = item.typ_karnetu === 'Umowa 12 miesięcy' || meta.isContract12M === true;
          const fallbackCzas = parsujOkresZDlugosci(item.dlugosc);

          return {
            id: item.id,
            utworzony: item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            nazwa: item.nazwa,
            cena: item.cena_brutto ? item.cena_brutto.toString() : '0',
            typKarnetu: item.typ_karnetu,
            limitCzasowy: item.dlugosc,
            czasIlosc: meta.czasIlosc || fallbackCzas.ilosc,
            czasJednostka: meta.czasJednostka || fallbackCzas.jednostka,
            limitIlosc: meta.limitIlosc || '1',
            limitOkres: meta.limitOkres || 'Miesiąc',
            dostepDo: item.dostep_do_zajec,
            dostepnyOnline: item.sprzedaz_online !== undefined ? item.sprzedaz_online : (meta.dostepnyOnline ?? true),
            ponownyZakup: meta.ponownyZakup !== undefined ? meta.ponownyZakup : true,
            zmianaNaInny: meta.zmianaNaInny !== undefined ? meta.zmianaNaInny : true,
            kupInnyKarnet: meta.kupInnyKarnet !== undefined ? meta.kupInnyKarnet : true,
            blokujPortfel: meta.blokujPortfel || false,
            portfelPrógKwota: meta.portfelPrógKwota || '0',
            wUzyciu: item.wUzyciu || 0,
            ilosc_wejsc: is12M ? null : (item.ilosc_wejsc || meta.ilosc_wejsc || null),
            isContract12M: is12M,
            ...meta 
          };
        });
        setKarnety(parsedData);
        setDostepneKarnety(parsedData);
      }

      // Pobieranie rodzajów zajęć
      const { data: rodzajeData, error: rodzajeError } = await supabase
        .from('rodzaje_zajec')
        .select('*')
        .order('nazwa', { ascending: true });

      if (!rodzajeError && rodzajeData && rodzajeData.length > 0) {
        setDostepneRodzajeZajec(rodzajeData);
      } else {
        setDostepneRodzajeZajec([
          { id: 1, nazwa: 'Brak zajęć w bazie (Dodaj w zakładce Rodzaje zajęć)' }
        ]);
      }

    } catch (err) {
      console.error("Błąd sieci:", err);
      globalCreatingLock = false;
    } finally {
      setIsLoading(false);
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
  const [limitCzasowyZapisow, setLimitCzasowyZapisow] = useState('Domyślny (14 dni)');
  const [niestandardowyDni, setNiestandardowyDni] = useState('14');
  const [tygodniowyLimit, setTygodniowyLimit] = useState('Bez limitu');
  const [dziennyLimit, setDziennyLimit] = useState('Domyślny (Bez limitu)');
  const [niestandardowyDziennyIlosc, setNiestandardowyDziennyIlosc] = useState('1');
  const [blokujPortfel, setBlokujPortfel] = useState(false);
  const [portfelPrógKwota, setPortfelPrógKwota] = useState('0');
  const [dostepnyOnline, setDostepnyOnline] = useState(true);
  const [ponownyZakup, setPonownyZakup] = useState(true);
  const [zmianaNaInny, setZmianaNaInny] = useState(true);
  const [kupInnyKarnet, setKupInnyKarnet] = useState(true);
  const [opis, setOpis] = useState('');
  const [obrazekUrl, setObrazekUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenAdd = () => {
    setEditingId(null);
    setNazwa(''); setCena(''); setStawkaVat('8%'); setTypKarnetu('Na czas'); setCzasIlosc('1'); setCzasJednostka('Miesiąc'); setIloscTreningow('10'); setDodajLimitCzasowy(true); setLimitIlosc('1'); setLimitOkres('Miesiąc'); setDostepDo('wszystkich zajęć'); setZaznaczoneZajecia([]); setLimitCzasowyZapisow('Domyślny (14 dni)'); setNiestandardowyDni('14'); setTygodniowyLimit('Bez limitu'); setDziennyLimit('Domyślny (Bez limitu)'); setNiestandardowyDziennyIlosc('1'); setBlokujPortfel(false); setPortfelPrógKwota('0'); setDostepnyOnline(true); setPonownyZakup(true); setZmianaNaInny(true); setKupInnyKarnet(true); setOpis(''); setObrazekUrl(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setNazwa(item.nazwa || ''); 
    setCena(item.cena || ''); 
    setStawkaVat(item.stawkaVat || '8%'); 
    setTypKarnetu(item.typKarnetu || item.typ_karnetu || 'Na czas');

    const parsedCzas = parsujOkresZDlugosci(item.dlugosc || item.limitCzasowy);
    setCzasIlosc(item.czasIlosc ? String(item.czasIlosc) : parsedCzas.ilosc);
    setCzasJednostka(item.czasJednostka || parsedCzas.jednostka);

    setIloscTreningow(item.iloscTreningow || item.ilosc_wejsc || '10'); 
    setDodajLimitCzasowy(item.dodajLimitCzasowy ?? true); 
    setLimitIlosc(item.limitIlosc ? String(item.limitIlosc) : '1'); 
    setLimitOkres(item.limitOkres || 'Miesiąc'); 
    setDostepDo(item.dostepDo || item.dostep_do_zajec || 'wszystkich zajęć'); 
    setZaznaczoneZajecia(item.zaznaczoneZajecia || []); 
    setLimitCzasowyZapisow(item.limitCzasowyZapisow || 'Domyślny (14 dni)'); 
    setNiestandardowyDni(item.niestandardowyDni || '14'); 
    setTygodniowyLimit(item.tygodniowyLimit || 'Bez limitu'); 
    setDziennyLimit(item.dziennyLimit || 'Domyślny (Bez limitu)'); 
    setNiestandardowyDziennyIlosc(item.niestandardowyDziennyIlosc || '1'); 
    setBlokujPortfel(item.blokujPortfel ?? false); 
    setPortfelPrógKwota(item.portfelPrógKwota || '0'); 
    setDostepnyOnline(item.dostepnyOnline ?? true); 
    setPonownyZakup(item.ponownyZakup ?? true); 
    setZmianaNaInny(item.zmianaNaInny ?? true); 
    setKupInnyKarnet(item.kupInnyKarnet ?? true); 
    setOpis(item.opis || ''); 
    setObrazekUrl(item.obrazekUrl || null);
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

  // POBIERANIE TYLKO AKTYWNYCH KARNETÓW KLIENTA
  const rawKarnetyList = Array.isArray(currentUser?.karnetyKlubowicza) ? currentUser.karnetyKlubowicza : [];
  const activeKarnetyList = rawKarnetyList.filter(isPassActive);
  const karnetyList = [...activeKarnetyList].sort((a: any, b: any) => {
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

  const globalSuspensions = currentUser?.historiaZawieszenGlobalna || [];
  const allSuspensions = globalSuspensions.map((susp: any) => ({
    ...susp,
    karnetNazwa: susp.karnetNazwa || 'Karnet'
  })).sort((a: any, b: any) => new Date(b.utworzono || 0).getTime() - new Date(a.utworzono || 0).getTime());

  // PRECYZYJNE EGZEKWOWANIE 4 REGUŁ SPRZEDAŻY ONLINE
  const dostepneKarnetyDoZakupu = dostepneKarnety.filter((defKarnetu) => {
    if (defKarnetu.dostepnyOnline === false) return false;

    const alreadyOwnedThis = karnetyList.some((k: any) => k.nazwa === defKarnetu.nazwa);
    if (alreadyOwnedThis && defKarnetu.ponownyZakup === false) return false;

    if (karnetyList.length > 0) {
      const anyOwnedBlocksChange = karnetyList.some((k: any) => {
        const ownedDef = dostepneKarnety.find(dk => dk.nazwa === k.nazwa);
        return ownedDef && ownedDef.zmianaNaInny === false;
      });
      if (anyOwnedBlocksChange && !alreadyOwnedThis) return false;

      const hasOtherPass = karnetyList.some((k: any) => k.nazwa !== defKarnetu.nazwa);
      if (hasOtherPass && defKarnetu.kupInnyKarnet === false) return false;
    }

    const limitWejscBaza = defKarnetu.ilosc_wejsc || defKarnetu.limitWejsc || defKarnetu.wejscia || null;
    const isTimeBased = limitWejscBaza === null || limitWejscBaza === '';
    if (isTimeBased && alreadyOwnedThis && defKarnetu.ponownyZakup === false) return false;

    return true;
  });

  // PRZEDŁUŻENIE KARNETU ORAZ OPŁACENIE KOLEJNEJ RATY UMOWY 12M / AKTYWACJA BONUSU
  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !passToExtend) return;

    const defKarnetu = dostepneKarnety.find(k => k.nazwa === passToExtend.nazwa);
    const isContract = passToExtend.isContract12M || defKarnetu?.isContract12M || defKarnetu?.typKarnetu === 'Umowa 12 miesięcy';
    
    let nextRataStr = '1 / 1';
    let nowaDataWygasnieciaStr = '';
    let isBonus13thPeriod = false;
    let bonusDaysAmount = 0;

    let basePriceNum = 0;
    if (isContract && passToExtend.cena) {
      basePriceNum = parseFloat(String(passToExtend.cena).replace(/[^0-9.-]+/g, "")) || 0;
    } else if (defKarnetu) {
      basePriceNum = parseFloat(defKarnetu.cena) || 0;
    } else {
      basePriceNum = parseFloat((passToExtend.cena || '0').replace(/[^0-9.-]+/g, "")) || 0;
    }

    if (isContract) {
      const contractInfo = getContractRataInfo(passToExtend);

      if (contractInfo.canActivateBonus) {
        isBonus13thPeriod = true;
        bonusDaysAmount = contractInfo.totalSuspUsed;
        nextRataStr = 'Bonus / 12';

        let baseDate = new Date();
        if (passToExtend.waznyDo) {
          const parts = passToExtend.waznyDo.split('-');
          if (parts.length === 3) {
            const exp = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            if (exp > baseDate) baseDate = exp;
          }
        }
        baseDate.setDate(baseDate.getDate() + bonusDaysAmount);
        nowaDataWygasnieciaStr = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;
        basePriceNum = 0;
      } else {
        const nextRataNum = Math.min(12, contractInfo.rataNum + 1);
        nextRataStr = `${nextRataNum} / 12`;

        let baseDate = new Date();
        if (passToExtend.waznyDo) {
          const parts = passToExtend.waznyDo.split('-');
          if (parts.length === 3) {
            const exp = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            if (exp > baseDate) baseDate = exp;
          }
        }
        const nextMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 2, 0);
        nowaDataWygasnieciaStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(nextMonthDate.getDate()).padStart(2, '0')}`;
      }
    } else {
      let baseDate = new Date();
      // Kontrola daty: jeśli karnet wygasł lub wejścia wyczerpane, liczymy od dzisiaj, w przeciwnym razie od poprzedniego terminu
      const isExpiredOrFinished = (passToExtend.waznyDo && passToExtend.waznyDo < todayStr) || (passToExtend.pozostaloWejsc !== null && passToExtend.pozostaloWejsc <= 0);

      if (passToExtend.waznyDo && !isExpiredOrFinished) {
        const parts = passToExtend.waznyDo.split('-');
        if (parts.length === 3) {
          const currentExp = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          if (currentExp > baseDate) baseDate = currentExp;
        }
      }
      
      const calcTargetDate = calculatePassValidityDaysOrEndDate(baseDate, defKarnetu || passToExtend);
      nowaDataWygasnieciaStr = `${calcTargetDate.getFullYear()}-${String(calcTargetDate.getMonth() + 1).padStart(2, '0')}-${String(calcTargetDate.getDate()).padStart(2, '0')}`;
    }

    const currentCykl = typeof passToExtend.cykl === 'number' ? passToExtend.cykl : 1;
    const nextCykl = isContract ? 1 : (appliedDiscountCode ? currentCykl : currentCykl + 1);

    // Przekazujemy basePriceNum w celu zablokowania rabatu ciągłościowego poniżej 150 zł
    const effectiveDiscount = getEffectiveDiscount(currentUser, isContract, basePriceNum);
    const { finalPrice: cenaWartosc, appliedLabel } = calculateFinalPrice(basePriceNum, effectiveDiscount, appliedDiscountCode);
    const cenaStr = `${cenaWartosc.toFixed(2)} PLN`;
    
    let updatedKarnetyList = [...karnetyList];

    updatedKarnetyList = updatedKarnetyList.map(k => {
      if (k.id === passToExtend.id) {
        let metaExt: Record<string, any> = {};
        try { metaExt = JSON.parse(defKarnetu?.inne_ustawienia || '{}'); } catch(e) {}
        const extWejsciaVal = (isContract) ? null : (defKarnetu ? (defKarnetu.ilosc_wejsc || metaExt.ilosc_wejsc || metaExt.iloscTreningow || null) : null);
        const parsedExtWejscia = extWejsciaVal !== null ? parseInt(extWejsciaVal, 10) : null;

        // Kontrola wejść: jeśli karnet wygasł lub wejścia zostały zużyte, nowa pula startuje od nowa (z zerowaniem starych)
        let updatedRemaining = k.pozostaloWejsc;
        let updatedInitial = k.poczatkoweWejsc;

        if (parsedExtWejscia !== null) {
          const isExpiredOrFinished = (k.waznyDo && k.waznyDo < todayStr) || (k.pozostaloWejsc !== null && k.pozostaloWejsc <= 0);
          if (isExpiredOrFinished) {
            updatedRemaining = parsedExtWejscia;
            updatedInitial = parsedExtWejscia;
          } else {
            updatedRemaining = (k.pozostaloWejsc || 0) + parsedExtWejscia;
            updatedInitial = (k.poczatkoweWejsc || 0) + parsedExtWejscia;
          }
        }

        const nowaHistoria = [...(k.historiaPrzedluzen || []), {
          data: todayStr,
          staraWaznosc: k.waznyDo,
          nowaWaznosc: nowaDataWygasnieciaStr,
          rata: isContract ? nextRataStr : undefined,
          cena: cenaStr,
          rabat: appliedLabel,
          usedCode: appliedDiscountCode ? appliedDiscountCode.kod : null
        }];

        let statusFinalTekst = `Ważny do: ${nowaDataWygasnieciaStr}`;
        if (isContract) {
          if (isBonus13thPeriod) {
            statusFinalTekst = `Umowa 12M (Bonus z zawieszenia: +${bonusDaysAmount} dni • Ważny do: ${nowaDataWygasnieciaStr})`;
          } else {
            statusFinalTekst = `Umowa 12M (Rata ${nextRataStr} • Ważny do: ${nowaDataWygasnieciaStr})`;
          }
        }
        return {
          ...k,
          waznyDo: nowaDataWygasnieciaStr,
          cena: isBonus13thPeriod ? (k.cena || '0.00 PLN') : cenaStr,
          cykl: nextCykl,
          rata: isContract ? nextRataStr : (k.rata || '1 / 1'),
          isContract12M: isContract,
          bonusActivated: isBonus13thPeriod ? true : k.bonusActivated,
          bonusClaimed: isBonus13thPeriod ? true : k.bonusClaimed,
          historiaPrzedluzen: nowaHistoria,
          znizkaProcentowa: appliedLabel,
          statusTekst: statusFinalTekst,
          pozostaloWejsc: isContract ? null : updatedRemaining,
          poczatkoweWejsc: isContract ? null : updatedInitial
        };
      }
      return k;
    });

    const currentWalletNum = parseFloat((currentUser.Portfel || currentUser.portfel || currentUser.wallet || '0').replace(/[^0-9.-]+/g, "")) || 0;
    const nowyStanPortfela = currentWalletNum - cenaWartosc;
    const nowyStanPortfelaStr = `${nowyStanPortfela.toFixed(2)} PLN`;

    const currentYear = new Date().getFullYear();
    const dbPayload: any = {
      karnetyKlubowicza: typeof currentUser.karnetyKlubowicza === 'string' ? JSON.stringify(updatedKarnetyList) : updatedKarnetyList,
    };
    
    if (effectiveDiscount.isBirthday && !appliedDiscountCode) {
      dbPayload.urodziny_rabat_rok = currentYear;
    }

    let finalRabatInt = typeof currentUser.rabat === 'number' ? currentUser.rabat : (extractClientContinuityDiscount(currentUser) ?? 0);
    let finalCyklInt = currentUser.cyklCiaglosci || 1;

    if (!isContract && !appliedDiscountCode && basePriceNum >= 150) {
      const currentContinuityVal = effectiveDiscount.continuityPercent || 0;
      let nextContinuityVal = currentContinuityVal;
      
      if (currentContinuityVal === 0) nextContinuityVal = 2;
      else if (currentContinuityVal === 2) nextContinuityVal = 4;
      else if (currentContinuityVal >= 4) nextContinuityVal = Math.min(25, currentContinuityVal + 1);

      finalRabatInt = nextContinuityVal;
      finalCyklInt = finalCyklInt + 1;

      dbPayload.rabat = finalRabatInt;
      dbPayload.cyklCiaglosci = finalCyklInt;
      dbPayload.hasLostContinuity = false;
    }

    if (currentUser.portfel !== undefined) dbPayload.portfel = nowyStanPortfelaStr;
    else if (currentUser.Portfel !== undefined) dbPayload.Portfel = nowyStanPortfelaStr;
    else dbPayload.Portfel = nowyStanPortfelaStr;

    if (!isBonus13thPeriod) {
      if (currentUser.Cena !== undefined) dbPayload.Cena = cenaStr;
      else if (currentUser.cena !== undefined) dbPayload.cena = cenaStr;
    }

    const { error: updateError } = await supabase.from('klienci').update(dbPayload).eq('id', currentUser.id);

    if (updateError) {
      showToast(`Błąd aktualizacji bazy danych: ${updateError.message}`, 'error');
      return;
    }

    let createdTransactionId: number | null = null;
    if (cenaWartosc > 0) {
      const opisOperacji = isContract 
        ? `Opłacenie raty ${nextRataStr} umowy 12M: ${passToExtend.nazwa}${appliedLabel ? ` ${appliedLabel}` : ''}`
        : `Przedłużenie (Zakładka Karnet): ${passToExtend.nazwa}${appliedLabel ? ` ${appliedLabel}` : ''}`;

      const { data: transData } = await supabase.from('transakcje').insert([{
        klient_id: currentUser.id,
        typ_operacji: isContract ? 'oplata_raty_12m' : 'zakup_karnetu',
        kwota: -cenaWartosc,
        opis: opisOperacji,
        kod_rabatowy: appliedDiscountCode?.kod || null
      }]).select('id').maybeSingle();

      if (transData?.id) createdTransactionId = transData.id;
    } else if (isBonus13thPeriod) {
      await supabase.from('transakcje').insert([{
        klient_id: currentUser.id,
        typ_operacji: 'bonus_zawieszenia_12m',
        kwota: 0,
        opis: `Aktywowano bezpłatny okres bonusowy (+${bonusDaysAmount} dni) z tytułu wykorzystanego zawieszenia dla umowy 12M: ${passToExtend.nazwa}`,
        kod_rabatowy: null
      }]);
    }

    if (appliedDiscountCode) {
      await incrementCodeUsage(
        appliedDiscountCode.id, 
        currentUser.id, 
        defKarnetu?.id || null, 
        createdTransactionId
      );
    }
    
    setCurrentUser({
      ...currentUser,
      karnetyKlubowicza: updatedKarnetyList,
      urodziny_rabat_rok: dbPayload.urodziny_rabat_rok || currentUser.urodziny_rabat_rok,
      rabat: finalRabatInt,
      cyklCiaglosci: finalCyklInt,
      hasLostContinuity: dbPayload.hasLostContinuity !== undefined ? dbPayload.hasLostContinuity : currentUser.hasLostContinuity,
      Portfel: dbPayload.Portfel || currentUser.Portfel,
      portfel: dbPayload.portfel || currentUser.portfel,
      wallet: nowyStanPortfelaStr
    });
    
    if (isBonus13thPeriod) {
      showToast(`Aktywowano bezpłatny okres bonusowy (+${bonusDaysAmount} dni) z tytułu zawieszenia karnetu!`, 'success');
    } else {
      showToast(isContract ? `Pomyślnie opłacono ratę ${nextRataStr} za kwotę ${cenaStr}.` : `Karnet "${passToExtend.nazwa}" został przedłużony za kwotę ${cenaStr}.`, 'success');
    }
    
    setIsExtendModalOpen(false);
    resetDiscountState();
    loadData();
  };

  // ZAKUP NOWEGO KARNETU
  const handleBuyPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedBuyPass) return;

    const defKarnetu = dostepneKarnety.find(k => k.nazwa === selectedBuyPass);

    let updatedKarnetyList = Array.isArray(currentUser.karnetyKlubowicza) ? [...currentUser.karnetyKlubowicza].filter(isPassActive) : [];
    
    const basePriceNum = defKarnetu ? parseFloat(defKarnetu.cena) : 0;
    const isContract = defKarnetu?.isContract12M || defKarnetu?.typKarnetu === 'Umowa 12 miesięcy';
    
    let calculatedFirstPayment = basePriceNum;
    let contractInfo: any = null;

    if (isContract) {
      contractInfo = calculateContractProRata(basePriceNum);
      calculatedFirstPayment = contractInfo.proRataFirstMonth;
    }
    
    const effectiveDiscount = getEffectiveDiscount(currentUser, isContract, calculatedFirstPayment);
    const { finalPrice: cenaWartosc, appliedLabel } = calculateFinalPrice(calculatedFirstPayment, effectiveDiscount, appliedDiscountCode);
    const cenaStr = `${cenaWartosc.toFixed(2)} PLN`;

    const limitWejscBaza = defKarnetu ? (defKarnetu.ilosc_wejsc || defKarnetu.limitWejsc || defKarnetu.wejscia || null) : null;
    const isTimeBased = limitWejscBaza === null;
    const existingPassIndex = updatedKarnetyList.findIndex(k => k.nazwa === selectedBuyPass);

    let nowaDataWygasnieciaStr = '';

    let baseCykl = 1;
    if (updatedKarnetyList.length > 0) {
      const highestCykl = Math.max(...updatedKarnetyList.map(k => (typeof k.cykl === 'number' ? k.cykl : 1)));
      baseCykl = highestCykl;
    }

    let nextCykl = isContract ? 1 : (appliedDiscountCode ? baseCykl : (updatedKarnetyList.length === 0 ? 1 : baseCykl + 1));
    let statusTekst = '';

    if (isContract) {
        nowaDataWygasnieciaStr = contractInfo.endOfFirstMonthStr;
        statusTekst = `Umowa 12M (Rata 0/12 - wyrównanie do końca m-ca: ${contractInfo.remainingDays}/${contractInfo.totalDaysInMonth} dni)`;
        
        updatedKarnetyList = updatedKarnetyList.map(k => ({ ...k, cykl: 1 }));

        const nowyKarnetObj = {
          id: Date.now(),
          nazwa: selectedBuyPass,
          waznyDo: nowaDataWygasnieciaStr,
          pozostaloWejsc: null,
          poczatkoweWejsc: null,
          cena: `${basePriceNum.toFixed(2)} PLN`,
          cykl: 1,
          znizkaProcentowa: appliedLabel,
          rata: '0 / 12',
          statusTekst: statusTekst,
          isContract12M: true,
          contractSuspensionDaysLeft: 30,
          totalSuspendedDaysUsed: 0,
          bonusActivated: false,
          bonusClaimed: false,
          blokadaDo: null,
          powodBlokady: null,
          zawieszonyOd: null,
          zawieszonyDo: null
        };
        updatedKarnetyList.push(nowyKarnetObj);

    } else if (isTimeBased && existingPassIndex !== -1 && !isContract) {
      const prevCykl = typeof updatedKarnetyList[existingPassIndex].cykl === 'number' ? updatedKarnetyList[existingPassIndex].cykl : 1;
      nextCykl = appliedDiscountCode ? prevCykl : prevCykl + 1;

      updatedKarnetyList = updatedKarnetyList.map((k, index) => {
        if (index === existingPassIndex) {
          let baseDate = new Date();
          if (activationMode === 'after' && k.waznyDo) {
            const parts = k.waznyDo.split('-');
            if (parts.length === 3) {
              baseDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
          }
          
          const calcTargetDate = calculatePassValidityDaysOrEndDate(baseDate, defKarnetu || k);
          nowaDataWygasnieciaStr = `${calcTargetDate.getFullYear()}-${String(calcTargetDate.getMonth() + 1).padStart(2, '0')}-${String(calcTargetDate.getDate()).padStart(2, '0')}`;

          const nowaHistoria = [...(k.historiaPrzedluzen || []), {
            data: todayStr,
            staraWaznosc: k.waznyDo,
            nowaWaznosc: nowaDataWygasnieciaStr,
            cena: cenaStr,
            rabat: appliedLabel,
            usedCode: appliedDiscountCode ? appliedDiscountCode.kod : null
          }];

          return {
            ...k,
            waznyDo: nowaDataWygasnieciaStr,
            cena: cenaStr,
            cykl: nextCykl,
            historiaPrzedluzen: nowaHistoria,
            znizkaProcentowa: appliedLabel,
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

      const calcTargetDate = calculatePassValidityDaysOrEndDate(baseStartDate, defKarnetu);
      nowaDataWygasnieciaStr = `${calcTargetDate.getFullYear()}-${String(calcTargetDate.getMonth() + 1).padStart(2, '0')}-${String(calcTargetDate.getDate()).padStart(2, '0')}`;

      statusTekst = activationMode === 'after' 
        ? `Oczekujący (Ważny od: ${maxDateStr} do: ${nowaDataWygasnieciaStr})`
        : `Ważny do: ${nowaDataWygasnieciaStr}`;

      const nowyKarnetObj = {
        id: Date.now(),
        nazwa: selectedBuyPass,
        waznyDo: nowaDataWygasnieciaStr,
        pozostaloWejsc: limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : null,
        poczatkoweWejsc: limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : null,
        cena: cenaStr,
        cykl: nextCykl,
        znizkaProcentowa: appliedLabel,
        rata: '1 / 1',
        statusTekst: statusTekst,
        blokadaDo: null,
        powodBlokady: null,
        zawieszonyOd: null,
        zawieszonyDo: null
      };
      updatedKarnetyList.push(nowyKarnetObj);
    }

    const currentWalletNum = parseFloat((currentUser.Portfel || currentUser.portfel || currentUser.wallet || '0').replace(/[^0-9.-]+/g, "")) || 0;
    const nowyStanPortfela = currentWalletNum - cenaWartosc;
    const nowyStanPortfelaStr = `${nowyStanPortfela.toFixed(2)} PLN`;

    const currentYear = new Date().getFullYear();
    const dbPayload: any = {
      karnetyKlubowicza: typeof currentUser.karnetyKlubowicza === 'string' ? JSON.stringify(updatedKarnetyList) : updatedKarnetyList,
    };
    
    if (effectiveDiscount.isBirthday && !appliedDiscountCode) {
      dbPayload.urodziny_rabat_rok = currentYear;
    }

    let finalRabatInt = typeof currentUser.rabat === 'number' ? currentUser.rabat : (extractClientContinuityDiscount(currentUser) ?? 0);
    let finalCyklInt = currentUser.cyklCiaglosci || 1;

    if (!isContract && !appliedDiscountCode && calculatedFirstPayment >= 150) {
      const currentContinuityVal = effectiveDiscount.continuityPercent || 0;
      let nextContinuityVal = currentContinuityVal;
      
      if (currentContinuityVal === 0) nextContinuityVal = 2;
      else if (currentContinuityVal === 2) nextContinuityVal = 4;
      else if (currentContinuityVal >= 4) nextContinuityVal = Math.min(25, currentContinuityVal + 1);

      finalRabatInt = nextContinuityVal;
      finalCyklInt = finalCyklInt + 1;

      dbPayload.rabat = finalRabatInt;
      dbPayload.cyklCiaglosci = finalCyklInt;
      dbPayload.hasLostContinuity = false;
    }

    if (currentUser.portfel !== undefined) dbPayload.portfel = nowyStanPortfelaStr;
    else if (currentUser.Portfel !== undefined) dbPayload.Portfel = nowyStanPortfelaStr;
    else dbPayload.Portfel = nowyStanPortfelaStr;

    if (currentUser.Cena !== undefined) dbPayload.Cena = cenaStr;
    else if (currentUser.cena !== undefined) dbPayload.cena = cenaStr;

    const { error: updateError } = await supabase.from('klienci').update(dbPayload).eq('id', currentUser.id);

    if (updateError) {
      showToast(`Błąd aktualizacji: ${updateError.message}`, 'error');
      return;
    }

    let createdTransactionId: number | null = null;
    if (cenaWartosc > 0) {
      const { data: transData } = await supabase.from('transakcje').insert([{
        klient_id: currentUser.id,
        typ_operacji: 'zakup_karnetu',
        kwota: -cenaWartosc,
        opis: `Zakup (Zakładka Karnet): ${selectedBuyPass}${appliedLabel ? ` ${appliedLabel}` : ''}`,
        kod_rabatowy: appliedDiscountCode?.kod || null
      }]).select('id').maybeSingle();

      if (transData?.id) createdTransactionId = transData.id;
    }

    if (appliedDiscountCode) {
      await incrementCodeUsage(
        appliedDiscountCode.id, 
        currentUser.id, 
        defKarnetu?.id || null, 
        createdTransactionId
      );
    }

    setCurrentUser({
      ...currentUser,
      karnetyKlubowicza: updatedKarnetyList,
      urodziny_rabat_rok: dbPayload.urodziny_rabat_rok || currentUser.urodziny_rabat_rok,
      rabat: finalRabatInt,
      cyklCiaglosci: finalCyklInt,
      hasLostContinuity: dbPayload.hasLostContinuity !== undefined ? dbPayload.hasLostContinuity : currentUser.hasLostContinuity,
      Portfel: dbPayload.Portfel || currentUser.Portfel,
      portfel: dbPayload.portfel || currentUser.portfel,
      wallet: nowyStanPortfelaStr
    });
    showToast(`Gratulacje! Aktywowano karnet za kwotę ${cenaStr}.`, 'success');
    setSelectedBuyPass('');
    setIsBuyPassModalOpen(false);
    resetDiscountState();
    loadData();
  };

  // POPRAWIONA I BEZBŁĘDNA FUNKCJA OBLICZANIA DNI
  const getDaysBetween = (d1: string, d2: string) => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    date1.setHours(0, 0, 0, 0);
    date2.setHours(0, 0, 0, 0);
    return Math.round(Math.abs((date2.getTime() - date1.getTime()) / (24 * 60 * 60 * 1000))) + 1;
  };

  // AUTOMATYCZNE WYPISYWANIE Z ZAJĘĆ
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

  // ❄️ 1. LOGIKA ZAWIESZANIA
  const handleSuspendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuspendError('');
    
    if (!passToSuspendId || !suspendStartDate || !suspendEndDate) {
      setSuspendError('Wypełnij wszystkie pola.');
      return;
    }

    if (suspendStartDate < todayStr) {
      setSuspendError('Data rozpoczęcia nie może być w przeszłości. Zawieszenie jest możliwe od dzisiaj.');
      return;
    }
    if (suspendEndDate < suspendStartDate) {
      setSuspendError('Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.');
      return;
    }

    const requestedDays = getDaysBetween(suspendStartDate, suspendEndDate);
    const karnetIndex = karnetyList.findIndex((k: any) => k.id.toString() === passToSuspendId.toString());
    if (karnetIndex === -1) return;
    
    const targetKarnet = karnetyList[karnetIndex];
    const isContract = targetKarnet.isContract12M;

    if (targetKarnet.waznyDo) {
      if (suspendStartDate > targetKarnet.waznyDo) {
        setSuspendError(`Zawieszenie musi rozpocząć się w trakcie ważności karnetu (najpóźniej ${targetKarnet.waznyDo}).`);
        return;
      }
    }

    const startObj = new Date(suspendStartDate);
    const month = startObj.getMonth(); 
    const year = startObj.getFullYear();
    const globalHistory = currentUser?.historiaZawieszenGlobalna || [];

    if (isContract) {
      const daysLeft = targetKarnet.contractSuspensionDaysLeft !== undefined ? targetKarnet.contractSuspensionDaysLeft : 30;
      if (requestedDays > daysLeft) {
        setSuspendError(`Przekroczono limit zawieszenia dla Umowy 12M. Pozostało Ci ${daysLeft} dni z rocznej puli 30 dni.`);
        return;
      }
    } else {
      if (requestedDays > 14) {
        setSuspendError(`Jednorazowe zawieszenie nie może być dłuższe niż 14 dni (Twoje: ${requestedDays}).`);
        return;
      }

      if (month === 8) {
        const usedInVacation = globalHistory.some((susp: any) => {
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
        globalHistory.forEach((susp: any) => {
          const hStart = new Date(susp.od);
          const hMonth = hStart.getMonth();
          if (hStart.getFullYear() === year && hMonth === month) {
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
        globalHistory.forEach((susp: any) => {
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
    }

    let updatedKarnetyList = [...karnetyList];
    updatedKarnetyList[karnetIndex] = {
      ...targetKarnet,
      zawieszonyOd: suspendStartDate,
      zawieszonyDo: suspendEndDate,
      statusTekst: `Zawieszony (od ${suspendStartDate} do ${suspendEndDate})`
    };

    const newGlobalSuspension = {
      id: Date.now(),
      karnetId: targetKarnet.id,
      karnetNazwa: targetKarnet.nazwa,
      od: suspendStartDate,
      planowane_do: suspendEndDate,
      do: '-',
      planowane_dni: requestedDays,
      dni: 0,
      status: 'aktywne',
      utworzono: new Date().toISOString(),
      isContract: isContract || false
    };

    const updatedGlobalHistory = [...globalHistory, newGlobalSuspension];

    const dbPayload: any = {
      karnetyKlubowicza: typeof currentUser.karnetyKlubowicza === 'string' ? JSON.stringify(updatedKarnetyList) : updatedKarnetyList,
      historiaZawieszenGlobalna: typeof currentUser.historiaZawieszenGlobalna === 'string' ? JSON.stringify(updatedGlobalHistory) : updatedGlobalHistory
    };

    const { error: updateError } = await supabase.from('klienci').update(dbPayload).eq('id', currentUser.id);

    if (updateError) {
      setSuspendError(`Błąd aktualizacji bazy danych: ${updateError.message}`);
      return;
    }

    await handleAutoWypiszPoZawieszeniu(currentUser.id, suspendStartDate, suspendEndDate, targetKarnet.nazwa);

    setCurrentUser({
      ...currentUser,
      karnetyKlubowicza: updatedKarnetyList,
      historiaZawieszenGlobalna: updatedGlobalHistory
    });

    showToast(`Pomyślnie zawieszono karnet na okres ${requestedDays} dni.`, 'success');
    setIsSuspendModalOpen(false);
    setSuspendStartDate('');
    setSuspendEndDate('');
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

    let updatedSuspensionDaysLeft = targetKarnet.contractSuspensionDaysLeft;
    let updatedTotalSuspendedDaysUsed = targetKarnet.totalSuspendedDaysUsed || 0;

    if (targetKarnet.isContract12M) {
      const currentPool = targetKarnet.contractSuspensionDaysLeft !== undefined ? targetKarnet.contractSuspensionDaysLeft : 30;
      updatedSuspensionDaysLeft = Math.max(0, currentPool - actualDays);
      updatedTotalSuspendedDaysUsed += actualDays;
    }

    const globalHistory = currentUser?.historiaZawieszenGlobalna || [];
    const updatedGlobalHistory = globalHistory.map((susp: any) => {
      if (susp.status === 'aktywne' && susp.karnetId?.toString() === targetKarnet.id?.toString()) {
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
      contractSuspensionDaysLeft: updatedSuspensionDaysLeft,
      totalSuspendedDaysUsed: updatedTotalSuspendedDaysUsed,
      statusTekst: targetKarnet.isContract12M 
        ? (targetKarnet.rata === 'Bonus / 12' 
            ? `Umowa 12M (Bonus z zawieszenia • Ważny do: ${nowaDataWygasnieciaStr})`
            : `Umowa 12M (Rata ${targetKarnet.rata || '0 / 12'} • Ważny do: ${nowaDataWygasnieciaStr})`)
        : `Ważny do: ${nowaDataWygasnieciaStr}`
    };

    const dbPayload: any = {
      karnetyKlubowicza: typeof currentUser.karnetyKlubowicza === 'string' ? JSON.stringify(updatedKarnetyList) : updatedKarnetyList,
      historiaZawieszenGlobalna: typeof currentUser.historiaZawieszenGlobalna === 'string' ? JSON.stringify(updatedGlobalHistory) : updatedGlobalHistory
    };

    const { error: updateError } = await supabase.from('klienci').update(dbPayload).eq('id', currentUser.id);

    if (updateError) {
      showToast(`Błąd aktualizacji: ${updateError.message}`, 'error');
      return;
    }

    setCurrentUser({
      ...currentUser,
      karnetyKlubowicza: updatedKarnetyList,
      historiaZawieszenGlobalna: updatedGlobalHistory
    });

    showToast(`Karnet odwieszony! Zużyto ${actualDays} dni z limitu. Data ważności przedłużona do: ${nowaDataWygasnieciaStr}`, 'success');
    setIsUnsuspendModalOpen(false);
  };

  const activePassesForSuspend = karnetyList.filter((k: any) => {
    const isActive = !k.statusTekst?.includes('Oczekujący') && !k.zawieszonyOd && k.waznyDo;
    return isActive;
  });

  const suspendedPasses = karnetyList.filter((k: any) => k.zawieszonyOd);

  // 2. ZAPISYWANIE DANYCH DO SUPABASE (Admin)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nazwa.trim() || !cena.trim()) return;

    let wyliczonaDlugosc = '';
    let dodanaIloscWejsc: number | null = null;
    const isContract = typKarnetu === 'Umowa 12 miesięcy';

    const intCzasIlosc = parseInt(czasIlosc, 10) || 1;
    const intLimitIlosc = parseInt(limitIlosc, 10) || 1;

    if (isContract) {
      wyliczonaDlugosc = 'Umowa 12 miesięcy (Cykliczna)';
      dodanaIloscWejsc = null;
    } else if (typKarnetu === 'Na czas') {
      const okresTekst = formatOkresGramatyka(intCzasIlosc, czasJednostka);
      wyliczonaDlugosc = `${intCzasIlosc} ${okresTekst}`;
      dodanaIloscWejsc = null;
    } else {
      dodanaIloscWejsc = parseInt(iloscTreningow, 10) || 10;
      if (dodajLimitCzasowy) {
        const okresLimitTekst = formatOkresGramatyka(intLimitIlosc, limitOkres);
        wyliczonaDlugosc = `${iloscTreningow} wejść / ${intLimitIlosc} ${okresLimitTekst}`;
      } else {
        wyliczonaDlugosc = `${iloscTreningow} wejść (bez limitu czasu)`;
      }
    }

    const metaDane = {
      stawkaVat,
      czasIlosc: String(intCzasIlosc),
      czasJednostka,
      iloscTreningow,
      ilosc_wejsc: isContract ? null : dodanaIloscWejsc,
      dodajLimitCzasowy,
      limitIlosc: String(intLimitIlosc),
      limitOkres,
      dlugoscDni: typKarnetu === 'Na czas' ? (czasJednostka === 'Dzień' ? intCzasIlosc : intCzasIlosc * 30) : null,
      dlugoscMiesiace: typKarnetu === 'Na czas' && czasJednostka === 'Miesiąc' ? intCzasIlosc : null,
      zaznaczoneZajecia: dostepDo === 'określonych zajęć' ? zaznaczoneZajecia : [],
      limitCzasowyZapisow,
      niestandardowyDni,
      tygodniowyLimit,
      dziennyLimit,
      niestandardowyDziennyIlosc,
      blokujPortfel,
      portfelPrógKwota,
      dostepnyOnline,
      ponownyZakup,
      zmianaNaInny,
      kupInnyKarnet,
      opis,
      obrazekUrl, 
      isContract12M: isContract,
      contractSuspensionDaysLeft: isContract ? 30 : null,
      totalSuspendedDaysUsed: 0,
      wUzyciu: 0
    };

    const supabasePayload = {
      nazwa: nazwa.trim(),
      cena_brutto: parseFloat(cena) || 0,
      typ_karnetu: typKarnetu,
      dlugosc: wyliczonaDlugosc,
      dostep_do_zajec: dostepDo,
      sprzedaz_online: dostepnyOnline,
      ilosc_wejsc: isContract ? null : dodanaIloscWejsc,
      inne_ustawienia: JSON.stringify(metaDane)
    };

    try {
      if (editingId !== null) {
        const { error } = await supabase.from('karnety').update(supabasePayload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('karnety').insert([supabasePayload]);
        if (error) throw error;

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
              [nazwa.trim()]: rulesData.booking_window_days ?? 14
            },
            expired_pass_grace_per_pass: {
              ...currentGraceMap,
              [nazwa.trim()]: rulesData.expired_pass_grace_days ?? 15
            }
          }).eq('id', rulesData.id);
        }
      }

      await loadData(); 
      setIsModalOpen(false);
      showToast("Zapisano pomyślnie!", 'success');
      
    } catch (error: any) {
      showToast(`Błąd zapisu: ${error.message || ''}`, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Czy na pewno chcesz usunąć ten karnet z cennika?")) {
      try {
        const { error } = await supabase.from('karnety').delete().eq('id', id);
        if (error) throw error;
        await loadData();
        showToast("Usunięto pomyślnie!", 'success');
      } catch (error: any) {
        showToast(`Nie udało się usunąć: ${error.message}`, 'error');
      }
    }
  };

  if (!isMounted || isLoading) {
    return <div className="p-10 flex justify-center text-slate-400 font-bold uppercase text-xs">Ładowanie danych karnetu...</div>;
  }

  // JEŚLI UŻYTKOWNIK TO KLUBOWICZ
  if (appRole === 'klubowicz' && currentUser) {
    const effectiveDiscount = getEffectiveDiscount(currentUser);
    const birthdayStatus = checkBirthdayStatus(currentUser.birthDate || currentUser.Urodziny, currentUser.urodziny_rabat_rok);

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in pb-24 font-sans antialiased relative">
        
        {/* 🎂 BANER URODZINOWY */}
        {birthdayStatus.isBirthdayWindow && (
          <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-top-4">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 text-8xl opacity-15 pointer-events-none select-none">
              🎂
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="bg-white/20 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/30">
                    🎉 Specjalna Okazja
                  </span>
                  {!birthdayStatus.alreadyUsedThisYear ? (
                    <span className="bg-white text-rose-600 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                      Prezent Urodzinowy: -20%
                    </span>
                  ) : (
                    <span className="bg-white/20 text-white text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-white/30">
                      Rabat Urodzinowy Wykorzystany
                    </span>
                  )}
                </div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                  Wszystkiego Najlepszego, {currentUser.firstName || 'Klubowiczu'}! 🎈
                </h3>
                <p className="text-xs sm:text-sm text-white/90 max-w-xl leading-relaxed">
                  {!birthdayStatus.alreadyUsedThisYear ? (
                    <>
                      Z okazji Twoich urodzin otrzymujesz <strong>jednorazowy 20% rabat</strong> na zakup lub przedłużenie dowolnego karnetu! Rabat nalicza się automatycznie w Twoim panelu przy najbliższej płatności.
                      {effectiveDiscount.continuityPercent > 0 && (
                        <span className="block mt-1 font-bold text-amber-200">
                          ✨ Twój rabat urodzinowy łączy się ze zgromadzonym rabatem za ciągłość (+{effectiveDiscount.continuityPercent}%)!
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-amber-100 font-medium">
                      Twój tegoroczny prezent urodzinowy (-20%) został już pomyślnie zrealizowany przy wcześniejszym zakupie. Życzymy udanych treningów!
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-col items-end shrink-0 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center sm:text-right">
                <div className="text-[10px] uppercase font-bold text-white/80 tracking-wider">Ważność okna:</div>
                <div className="text-xl font-black text-amber-200">
                  {birthdayStatus.daysLeft} {birthdayStatus.daysLeft === 1 ? 'dzień' : 'dni'}
                </div>
                <div className="text-[9px] text-white/70 mt-0.5">licząc od dnia urodzin</div>
              </div>
            </div>
          </div>
        )}

        {/* 🏷️ BANER INFORMACYJNY O AKTYWNYM RABACIE */}
        {!birthdayStatus.isBirthdayWindow && effectiveDiscount.percent > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏷️</span>
              <div>
                <div className="font-black text-xs uppercase tracking-wider">Twój aktywny rabat: {effectiveDiscount.percent}%</div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  {effectiveDiscount.type === 'manual' ? 'Przypisano indywidualny rabat stały do Twojego konta.' : `Rabat lojalnościowy naliczany za zachowanie ciągłości karnetów (od 150 zł).`} Ceny zakupu i przedłużeń karnetów uwzględniają tę zniżkę.
                </div>
              </div>
            </div>
            <span className="bg-emerald-200 text-emerald-900 font-mono font-black text-xs px-3 py-1.5 rounded-xl whitespace-nowrap">
              -{effectiveDiscount.percent}%
            </span>
          </div>
        )}

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
                let isSuspendedLocal = !!karnet.zawieszonyOd;
                const isContract = karnet.isContract12M;
                const contractInfo = getContractRataInfo(karnet);
                const isBonus13thActive = contractInfo.isBonusActive;

                if (!isPending && !isSuspendedLocal && !isBonus13thActive) {
                  if (karnet.waznyDo) {
                    const todayDate = new Date();
                    todayDate.setHours(0, 0, 0, 0);
                    const expDate = new Date(karnet.waznyDo);
                    expDate.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((expDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 5) isExpiring = true;
                  }
                  if (karnet.pozostaloWejsc !== null && karnet.pozostaloWejsc !== undefined) {
                    if (karnet.pozostaloWejsc <= 2) isExpiring = true;
                  }
                }

                let statusColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'; 
                if (isSuspendedLocal) statusColorClass = 'bg-slate-100 text-slate-600 border-slate-300'; 
                else if (isBonus13thActive) statusColorClass = 'bg-purple-100 text-purple-900 border-purple-300';
                else if (contractInfo.canActivateBonus) statusColorClass = 'bg-purple-50 text-purple-800 border-purple-300';
                else if (isPending) statusColorClass = 'bg-amber-100 text-amber-800 border-amber-200'; 
                else if (isExpiring) statusColorClass = 'bg-rose-100 text-rose-800 border-rose-200'; 

                return (
                  <div key={karnet.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-black text-slate-900">{karnet.nazwa}</h3>
                          {isContract && (
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md border uppercase ${
                              contractInfo.canActivateBonus
                                ? 'bg-purple-100 text-purple-900 border-purple-300'
                                : isBonus13thActive 
                                ? 'bg-purple-100 text-purple-900 border-purple-300' 
                                : 'bg-amber-500/20 text-amber-900 border-amber-300'
                            }`}>
                              {contractInfo.canActivateBonus 
                                ? `Umowa 12M • Dni bonusowe (+${contractInfo.totalSuspUsed} dni)` 
                                : isBonus13thActive 
                                ? 'Umowa 12M • Dni bonusowe' 
                                : `Umowa 12M • Rata ${karnet.rata || '0/12'}`}
                            </span>
                          )}
                          {karnet.znizkaProcentowa && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded border border-emerald-200">
                              {karnet.znizkaProcentowa}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-slate-100 text-slate-700 font-semibold px-3 py-1 rounded-full text-xs border border-slate-200 shadow-sm">
                            Aktywne zapisy: {karnet.pozostaloWejsc !== null && karnet.pozostaloWejsc !== undefined ? karnet.pozostaloWejsc : 'Bez limitu'}
                          </span>
                          <span className={`font-semibold px-3 py-1 rounded-full text-xs border shadow-sm ${statusColorClass}`}>
                            {karnet.statusTekst || `Ważny do: ${karnet.waznyDo}`}
                          </span>
                          {karnet.cena && !isBonus13thActive && (
                            <span className="bg-slate-100 text-slate-700 font-semibold px-3 py-1 rounded-full text-xs border border-slate-200">
                              Cena: {karnet.cena}
                            </span>
                          )}
                          {isContract && (
                            <span className="bg-sky-50 text-sky-800 font-bold px-3 py-1 rounded-full text-xs border border-sky-200">
                              Pozostało zawieszenia: <strong className="text-sky-950">{contractInfo.suspensionDaysLeft} dni</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t border-slate-100 pt-4 flex flex-wrap justify-end gap-2">
                      {isSuspendedLocal ? (
                         <button 
                           onClick={() => { setPassToUnsuspendId(karnet.id.toString()); setIsUnsuspendModalOpen(true); }}
                           className="bg-slate-800 border border-slate-900 text-white hover:bg-slate-900 font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                         >
                           <span className="text-sm">🔓</span> ODWIEŚ KARNET
                         </button>
                      ) : isContract ? (
                        contractInfo.canActivateBonus ? (
                          <button 
                            onClick={() => { resetDiscountState(); setPassToExtend(karnet); setIsExtendModalOpen(true); }}
                            className="bg-purple-600 hover:bg-purple-700 border border-purple-700 text-white font-black text-xs px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                          >
                            <span className="text-sm">🎁</span> AKTYWUJ BONUS (+{contractInfo.totalSuspUsed} DNI)
                          </button>
                        ) : !contractInfo.isFullyPaid ? (
                          <button 
                            onClick={() => { resetDiscountState(); setPassToExtend(karnet); setIsExtendModalOpen(true); }}
                            className="bg-amber-600 hover:bg-amber-700 border border-amber-700 text-white font-black text-xs px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                          >
                            <span className="text-sm">💳</span> OPŁAĆ KOLEJNĄ RATĘ
                          </button>
                        ) : null
                      ) : (
                        <button 
                          onClick={() => { resetDiscountState(); setPassToExtend(karnet); setIsExtendModalOpen(true); }}
                          className="bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 hover:border-sky-300 hover:text-sky-900 font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                        >
                          <span className="text-sm">🕒</span> PRZEDŁUŻ
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button 
              onClick={() => { resetDiscountState(); setActivationMode('today'); setSelectedBuyPass(''); setIsBuyPassModalOpen(true); }}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-sm transition-colors cursor-pointer flex items-center gap-2"
            >
              <span className="text-lg leading-none rounded-full bg-white/20 w-4 h-4 flex items-center justify-center">+</span> KUP NOWY KARNET
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
                <p className="text-xs text-slate-500 mt-1">Dla umów 12M masz 30 dni w roku. Niewykorzystane dni zostaną automatycznie doliczone po 12. racie jako <strong>bezpłatny okres bonusowy (0.00 PLN)</strong>.</p>
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
                      showToast('Nie posiadasz aktualnie aktywnego karnetu, który można by zawiesić.', 'info');
                      return;
                    }
                    setPassToSuspendId(activePassesForSuspend[0].id.toString());
                    setSuspendStartDate(todayStr);
                    setSuspendEndDate(todayStr);
                    setIsSuspendModalOpen(true);
                  }}
                  className="w-full sm:w-auto bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>❄️</span> ZAWIEŚ KARNET
                </button>
              )}
            </div>

            {/* TABELA GLOBALNEJ HISTORII ZAWIESZEŃ */}
            <div className="pt-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Historia Twoich zawieszeń (Konto)</h3>
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
                            <td className="py-3 px-4 font-bold text-slate-800">{susp.karnetNazwa} {susp.isContract ? '(Umowa 12M)' : ''}</td>
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
                                  ✅ Zakończone
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

        {/* MODAL ZASAD ZAWIESZEŃ */}
        {isSuspendInfoModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[2rem] max-w-md w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <span className="text-xl leading-none opacity-80">ℹ️</span> ZASADY ZAWIESZANIA KARNETÓW
                </h3>
                <button onClick={() => setIsSuspendInfoModalOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer text-lg">✕</button>
              </div>
              
              <div className="bg-sky-50/80 p-5 rounded-2xl border border-sky-100 space-y-3 text-xs text-sky-900">
                <p className="font-bold">Limity zawieszeń obowiązują dla Twoich karnetów:</p>
                <ul className="list-disc pl-4 space-y-2 font-medium">
                  <li><strong>Karnety na Umowę 12M:</strong> Przysługuje Ci łącznie <strong>30 dni darmowego zawieszenia</strong> w roku. Wszystkie wykorzystane dni zamrożenia po 12. racie zostaną zamienione w <strong>bezpłatny okres bonusowy (0.00 PLN)</strong> przedłużający Twój karnet!</li>
                  <li><strong>Karnety Standardowe:</strong> Maksymalnie do 14 dni zawieszenia w kwartale (podzielone na maksymalnie 2 okresy).</li>
                  <li><strong>Miesiące wakacyjne (Lipiec / Sierpień):</strong> Możliwość zawieszenia karnetu standardowego 1 raz w miesiącu (do 14 dni). Uwaga: jeśli karnet był zawieszany w wakacje, zawieszenie we wrześniu nie jest dozwolone.</li>
                  <li><strong>Odwieszenie:</strong> Karnet możesz odwiesić w dowolnym momencie przed czasem, a niewykorzystane dni zostaną automatycznie doliczone do daty ważności.</li>
                </ul>
              </div>

              <div className="flex justify-end pt-2">
                <button onClick={() => setIsSuspendInfoModalOpen(false)} className="bg-[#1e293b] hover:bg-slate-900 text-white font-bold text-xs px-8 py-3 rounded-xl uppercase transition-colors shadow-md cursor-pointer tracking-wider">
                  ZROZUMIAŁEM
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
                  System przeliczy faktyczne dni zawieszenia i o tę wartość przedłuży ważność karnetu (oraz doda je do bezpłatnego okresu bonusowego po 12. racie).
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

        {/* MODAL ZAWIESZENIA KARNETU */}
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
                      <option key={k.id} value={k.id.toString()}>
                        {k.nazwa} {k.isContract12M ? `(Umowa 12M - Pula: ${k.contractSuspensionDaysLeft ?? 30} dni)` : `(Ważny do ${k.waznyDo})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">Od dnia *</label>
                    <input 
                      type="date" 
                      required 
                      min={todayStr} 
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
                      min={suspendStartDate || todayStr}
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

        {/* MODAL: PRZEDŁUŻ KARNET / OPŁAĆ RATĘ 12M */}
        {isExtendModalOpen && passToExtend && (() => {
          const isContract = passToExtend.isContract12M;
          const contractInfo = getContractRataInfo(passToExtend);
          const defKarnetu = dostepneKarnety.find(k => k.nazwa === passToExtend.nazwa);
          
          let basePrice = 0;
          if (isContract && passToExtend.cena) {
            basePrice = parseFloat(String(passToExtend.cena).replace(/[^0-9.-]+/g, "")) || 0;
          } else if (defKarnetu) {
            basePrice = parseFloat(defKarnetu.cena) || 0;
          } else {
            basePrice = parseFloat((passToExtend.cena || '0').replace(/[^0-9.-]+/g, "")) || 0;
          }

          const isBonus13Period = contractInfo.canActivateBonus;

          if (isBonus13Period) {
            basePrice = 0;
          }

          const effectiveDiscount = getEffectiveDiscount(currentUser, isContract, basePrice);
          const { finalPrice, appliedLabel } = calculateFinalPrice(basePrice, effectiveDiscount, appliedDiscountCode);
          const nextRataNum = Math.min(12, contractInfo.rataNum + 1);

          return (
            <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
                <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                  <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">
                    {isBonus13Period 
                      ? '🎁 AKTYWACJA OKRESU BONUSOWEGO Z ZAWIESZENIA'
                      : isContract 
                        ? '💳 OPŁAĆ KOLEJNĄ RATĘ UMOWY 12M' 
                        : '🕒 Przedłuż karnet'}
                  </h3>
                  <button onClick={() => { setIsExtendModalOpen(false); resetDiscountState(); }} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
                </div>
                <form onSubmit={handleExtendSubmit} className="space-y-4 text-xs">
                  <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 text-sky-900">
                    {isBonus13Period ? (
                      <div className="space-y-1">
                        <span className="font-bold text-purple-900 block text-sm">🎉 Bezpłatny okres bonusowy (+{contractInfo.totalSuspUsed} dni)</span>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          W trakcie trwania 12-miesięcznej umowy wykorzystano łącznie <strong>{contractInfo.totalSuspUsed} dni zawieszenia</strong>. Okres ten zostaje doliczony jako bezpłatne przedłużenie Twojego karnetu.
                        </p>
                      </div>
                    ) : isContract ? (
                      <div>
                        <span>Opłacasz kolejną ratę (<strong>{nextRataNum} / 12</strong>) dla umowy:</span>
                        <strong className="block text-sm mt-1">{passToExtend.nazwa}</strong>
                      </div>
                    ) : (
                      <div>
                        <span>Przedłużasz karnet:</span>
                        <strong className="block text-sm mt-1">{passToExtend.nazwa}</strong>
                      </div>
                    )}
                  </div>

                  {!isBonus13Period && (
                    <div className="space-y-1 mt-2">
                      <label className="font-bold text-slate-700 block">Masz kod rabatowy?</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={discountCodeInput} 
                          onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                          placeholder="Wpisz kod"
                          className="flex-1 bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-blue-500 uppercase font-bold"
                          disabled={!!appliedDiscountCode}
                        />
                        {!appliedDiscountCode ? (
                          <button 
                            onClick={handleApplyDiscountCode}
                            className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer text-xs"
                          >
                            Zastosuj
                          </button>
                        ) : (
                          <button 
                            onClick={(e) => { e.preventDefault(); resetDiscountState(); }}
                            className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer text-xs"
                          >
                            Usuń
                          </button>
                        )}
                      </div>
                      {discountCodeStatus.message && (
                         <div className={`text-[10px] font-bold mt-1 ${discountCodeStatus.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {discountCodeStatus.message}
                         </div>
                      )}
                    </div>
                  )}
                  
                  <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-slate-600">
                      <span>{isBonus13Period ? 'Wartość bonusu:' : isContract ? 'Miesięczna kwota raty (Twoja stawka):' : 'Cena katalogowa:'}</span>
                      <span className="font-bold">{isBonus13Period ? '0.00 PLN' : `${basePrice.toFixed(2)} PLN`}</span>
                    </div>
                    {appliedLabel && !isBonus13Period && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Naliczony rabat:</span>
                        <span>{appliedLabel} (-{(basePrice - finalPrice).toFixed(2)} PLN)</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-900 font-black text-xs pt-1 border-t border-amber-200">
                      <span>Do zapłaty (z portfela):</span>
                      <span className="text-emerald-700 font-bold">{finalPrice.toFixed(2)} PLN</span>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                    <button type="button" onClick={() => { setIsExtendModalOpen(false); resetDiscountState(); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer">
                      Anuluj
                    </button>
                    <button type="submit" className={`${isBonus13Period ? 'bg-purple-700 hover:bg-purple-800' : 'bg-amber-600 hover:bg-amber-700'} text-white font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer`}>
                      {isBonus13Period 
                        ? `AKTYWUJ BONUS +${contractInfo.totalSuspUsed} DNI (0.00 PLN)` 
                        : isContract 
                          ? `OPŁAĆ RATĘ ${nextRataNum}/12 (${finalPrice.toFixed(2)} PLN)` 
                          : `Potwierdzam przedłużenie (${finalPrice.toFixed(2)} PLN)`}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* MODAL: KUP KARNET */}
        {isBuyPassModalOpen && (() => {
          const selectedPassDef = dostepneKarnety.find(k => k.nazwa === selectedBuyPass);
          const isContract = selectedPassDef?.isContract12M || selectedPassDef?.typKarnetu === 'Umowa 12 miesięcy';
          
          let basePrice = selectedPassDef ? parseFloat(selectedPassDef.cena) : 0;
          let calculatedFirstPayment = basePrice;
          let contractInfo: any = null;

          if (isContract) {
            contractInfo = calculateContractProRata(basePrice);
            calculatedFirstPayment = contractInfo.proRataFirstMonth;
          }

          const effectiveDiscount = getEffectiveDiscount(currentUser, isContract, calculatedFirstPayment);
          const { finalPrice: discountedPrice, appliedLabel } = calculateFinalPrice(calculatedFirstPayment, effectiveDiscount, appliedDiscountCode);

          return (
            <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
                <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                  <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🎟️ Kup / Dodaj karnet</h3>
                  <button onClick={() => { setIsBuyPassModalOpen(false); resetDiscountState(); }} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
                </div>
                <form onSubmit={handleBuyPassSubmit} className="space-y-4 text-xs">
                  <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-sky-900 font-medium">
                    Wybierz karnet, aby przypisać go do konta (zostanie pobrana kwota z portfela).
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Wybierz karnet z cennika *</label>
                    <select
                      required
                      value={selectedBuyPass}
                      onChange={(e) => {
                        setSelectedBuyPass(e.target.value);
                        resetDiscountState();
                      }}
                      className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-3 font-bold focus:outline-none focus:border-blue-500 cursor-pointer text-slate-800"
                    >
                      <option value="" disabled>-- Wybierz karnet --</option>
                      {dostepneKarnetyDoZakupu.map((k: any) => {
                        const kIsContract = k.isContract12M || k.typ_karnetu === 'Umowa 12 miesięcy' || k.typKarnetu === 'Umowa 12 miesięcy';
                        const kBasePrice = parseFloat(k.cena) || 0;
                        
                        let kDisplayPrice = kBasePrice;
                        if (kIsContract) {
                          const kProRata = calculateContractProRata(kBasePrice);
                          kDisplayPrice = kProRata.proRataFirstMonth;
                        }

                        const kEffectiveDisc = getEffectiveDiscount(currentUser, kIsContract, kDisplayPrice);
                        
                        const kFinalPrice = kEffectiveDisc.percent > 0 
                          ? (kDisplayPrice * (1 - kEffectiveDisc.percent / 100)).toFixed(2)
                          : kDisplayPrice.toFixed(2);

                        return (
                          <option key={k.id} value={k.nazwa}>
                            {k.nazwa} (Cena: {kFinalPrice} PLN {kIsContract ? '• Umowa 12M' : ''} {kEffectiveDisc.percent > 0 ? `| -${kEffectiveDisc.percent}%` : ''})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {selectedBuyPass && isContract && contractInfo && (
                    <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 space-y-2 text-amber-950">
                      <div className="font-black uppercase tracking-wider text-[11px]">Kalkulacja umowy 12 miesięcy:</div>
                      <div className="text-[11px] space-y-1">
                        <div className="flex justify-between">
                          <span>Wyrównanie za bieżący m-c ({contractInfo.remainingDays}/${contractInfo.totalDaysInMonth} dni):</span>
                          <strong>{contractInfo.proRataFirstMonth.toFixed(2)} PLN</strong>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Miesięczna opłata od 1. dnia kolejnego m-ca:</span>
                          <span>{basePrice.toFixed(2)} PLN / m-c</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Okres pełnej umowy (12 cykli):</span>
                          <span>do {contractInfo.endOfContractStr}</span>
                        </div>
                        <div className="text-[10px] text-amber-800 font-bold pt-1 border-t border-amber-200">
                          ℹ️ Karnety na umowę nie naliczają rabatu ciągłościowego oraz zerują dotychczasowy cykl zniżek za ciągłość.
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedBuyPass && selectedPassDef && (
                    <div className="space-y-1 mt-2">
                      <label className="font-bold text-slate-700 block">Masz kod rabatowy?</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={discountCodeInput} 
                          onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                          placeholder="Wpisz kod"
                          className="flex-1 bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-blue-500 uppercase font-bold"
                          disabled={!!appliedDiscountCode}
                        />
                        {!appliedDiscountCode ? (
                          <button 
                            onClick={handleApplyDiscountCode}
                            className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer text-xs"
                          >
                            Zastosuj
                          </button>
                        ) : (
                          <button 
                            onClick={(e) => { e.preventDefault(); resetDiscountState(); }}
                            className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer text-xs"
                          >
                            Usuń
                          </button>
                        )}
                      </div>
                      {discountCodeStatus.message && (
                         <div className={`text-[10px] font-bold mt-1 ${discountCodeStatus.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {discountCodeStatus.message}
                         </div>
                      )}
                    </div>
                  )}

                  {selectedBuyPass && selectedPassDef && (
                    <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 space-y-1.5 text-[11px]">
                      <div className="flex justify-between text-slate-600">
                        <span>Płatność początkowa:</span>
                        <span className="font-bold">{calculatedFirstPayment.toFixed(2)} PLN</span>
                      </div>
                      {appliedLabel && (
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>Naliczony rabat:</span>
                          <span>{appliedLabel} (-{(calculatedFirstPayment - discountedPrice).toFixed(2)} PLN)</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-900 font-black text-xs pt-1 border-t border-amber-200">
                        <span>Do zapłaty:</span>
                        <span className="text-emerald-700 font-bold">{discountedPrice.toFixed(2)} PLN</span>
                      </div>
                    </div>
                  )}

                  {currentUser?.karnetyKlubowicza?.length > 0 && !isContract && (
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
                            <span className="font-bold text-slate-800">Oczekujący</span>
                            <span className="text-[10px] text-slate-500">Zacznie obowiązywać po wygaśnięciu obecnego</span>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                  <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                    <button type="button" onClick={() => { setIsBuyPassModalOpen(false); resetDiscountState(); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer">
                      Anuluj
                    </button>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer">
                      Potwierdzam zakup ({discountedPrice.toFixed(2)} PLN)
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* TOAST DLA KLUBOWICZA */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-none">
            <div className={`px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'error'
                ? 'bg-slate-900 border-rose-500/30 text-white'
                : toast.type === 'info'
                ? 'bg-slate-900 border-sky-500/30 text-white'
                : 'bg-slate-900 border-slate-800 text-white'
            }`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
                toast.type === 'error' ? 'bg-rose-600 text-white' :
                toast.type === 'info' ? 'bg-sky-600 text-white' :
                'bg-emerald-600 text-white'
              }`}>
                {toast.type === 'error' ? '✕' : toast.type === 'info' ? 'ℹ' : '✓'}
              </div>
              <span className="text-xs sm:text-sm font-semibold text-white pr-2">
                {toast.message}
              </span>
            </div>
          </div>
        )}

      </div>
    );
  }

  // PANEL ADMINISTRATORA / TRENERA
  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 font-sans antialiased relative">
      
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
              {karnety.map((item: any) => (
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

      {/* MODAL DODAWANIA / EDYCJI KARNETU (ADMIN) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-sky-200 rounded-3xl max-w-3xl w-full p-8 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            
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

                {typKarnetu === 'Na czas' ? (
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
                ) : typKarnetu === 'Na ilość treningów' ? (
                  <div className="bg-sky-50/60 p-4 rounded-2xl border border-sky-200 space-y-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-800 block">Ilość treningów *</label>
                      <input 
                        type="number" 
                        min="1"
                        placeholder="np. 10"
                        value={iloscTreningow}
                        onChange={(e) => setIloscTreningow(e.target.value)}
                        className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold"
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
                ) : (
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-amber-900 space-y-2">
                    <p className="font-bold text-sm">Karnet na umowę cykliczną (12 miesięcy)</p>
                    <p className="text-[11px] leading-relaxed font-medium">
                      Wybór tej opcji oznacza, że karnet podlega pod zasady rozliczeń ratalnych z uwzględnieniem wyrównania za bieżący miesiąc (pro-rata). 
                      Klubowicz z tym karnetem otrzyma do dyspozycji dedykowaną, roczną pulę 30 dni na darmowe zawieszenie. Wszystkie wykorzystane dni zamrożenia po 12. racie zostaną zamienione w <strong>bezpłatny okres bonusowy (0.00 PLN)</strong>.
                    </p>
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
                        {dostepneRodzajeZajec.map((zaj: any) => (
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
                    <label className="font-bold text-slate-800 block">Tygodniowy limit zapisów</label>
                    <select 
                      value={tygodniowyLimit}
                      onChange={(e) => setTygodniowyLimit(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 font-bold cursor-pointer"
                    >
                      <option value="Bez limitu">Bez limitu</option>
                      <option value="1 na tydzień">1 na tydzień</option>
                      <option value="2 na tydzień">2 na tydzień</option>
                      <option value="3 na tydzień">3 na tydzień</option>
                      <option value="4 na tydzień">4 na tydzień</option>
                      <option value="5 na tydzień">5 na tydzień</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">Dzienny limit wejść</label>
                    <select 
                      value={dziennyLimit}
                      onChange={(e) => setDziennyLimit(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 font-bold cursor-pointer"
                    >
                      <option value="Domyślny (Bez limitu)">Domyślny (Bez limitu)</option>
                      <option value="1 dziennie">1 dziennie</option>
                      <option value="2 dziennie">2 dziennie</option>
                      <option value="Niestandardowy">Niestandardowy</option>
                    </select>

                    {dziennyLimit === 'Niestandardowy' && (
                      <div className="mt-2 space-y-1">
                        <label className="font-bold text-slate-700 block text-[10px]">Wpisz limit dzienny</label>
                        <input 
                          type="number"
                          min="1"
                          value={niestandardowyDziennyIlosc}
                          onChange={(e) => setNiestandardowyDziennyIlosc(e.target.value)}
                          className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-800 font-bold"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={blokujPortfel}
                      onChange={(e) => setBlokujPortfel(e.target.checked)}
                      className="w-4 h-4 accent-amber-700 rounded cursor-pointer"
                    />
                    <span className="font-bold text-slate-900">Blokuj zapisy w zależności od stanu portfela</span>
                  </label>

                  {blokujPortfel && (
                    <div className="pl-6 space-y-1">
                      <label className="font-bold text-slate-700 block text-[10px]">Próg zablokowania portfela (PLN)</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={portfelPrógKwota}
                        onChange={(e) => setPortfelPrógKwota(e.target.value)}
                        className="w-40 bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-1.5 text-slate-800 font-bold"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* SPRZEDAŻ ONLINE - 4 REGUŁY */}
              <div className="space-y-4 pt-2">
                <h4 className="font-extrabold text-sky-900 uppercase tracking-wider text-[11px] border-b border-sky-100 pb-1">
                  Sprzedaż online
                </h4>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 bg-sky-50/40 rounded-xl border border-sky-100 cursor-pointer">
                    <span className="font-semibold text-slate-800">Karnet dostępny do sprzedaży przy rejestracji online:</span>
                    <input 
                      type="checkbox" 
                      checked={dostepnyOnline} 
                      onChange={(e) => setDostepnyOnline(e.target.checked)}
                      className="w-4 h-4 accent-amber-700 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-sky-50/40 rounded-xl border border-sky-100 cursor-pointer">
                    <span className="font-semibold text-slate-800">Klubowicz z tym karnetem, może kupić ten karnet ponownie:</span>
                    <input 
                      type="checkbox" 
                      checked={ponownyZakup} 
                      onChange={(e) => setPonownyZakup(e.target.checked)}
                      className="w-4 h-4 accent-amber-700 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-sky-50/40 rounded-xl border border-sky-100 cursor-pointer">
                    <span className="font-semibold text-slate-800">Klubowicz z tym karnetem, może zmienić ten karnet na inny:</span>
                    <input 
                      type="checkbox" 
                      checked={zmianaNaInny} 
                      onChange={(e) => setZmianaNaInny(e.target.checked)}
                      className="w-4 h-4 accent-amber-700 rounded cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-sky-50/40 rounded-xl border border-sky-100 cursor-pointer">
                    <span className="font-semibold text-slate-800">Klubowicz z innym karnetem, może kupić ten karnet:</span>
                    <input 
                      type="checkbox" 
                      checked={kupInnyKarnet} 
                      onChange={(e) => setKupInnyKarnet(e.target.checked)}
                      className="w-4 h-4 accent-amber-700 rounded cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* WYGLĄD I OPIS KARNETU */}
              <div className="space-y-4 pt-2">
                <h4 className="font-extrabold text-sky-900 uppercase tracking-wider text-[11px] border-b border-sky-100 pb-1">
                  Wygląd i opis karnetu
                </h4>

                <div className="space-y-2">
                  <label className="font-bold text-slate-800 block">Obrazek</label>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageChange} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <div className="flex items-center gap-3">
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()} 
                      className="bg-white hover:bg-sky-50 text-sky-900 px-4 py-2 rounded-xl text-xs font-bold border border-sky-200 shadow-sm cursor-pointer transition-all"
                    >
                      🖼️ Wybierz obrazek
                    </button>
                    {obrazekUrl && (
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-sky-200">
                        <img src={obrazekUrl} alt="Podgląd" className="w-full h-full object-cover" />
                        <button 
                          type="button" 
                          onClick={() => setObrazekUrl(null)} 
                          className="absolute top-0 right-0 bg-rose-600 text-white w-4 h-4 rounded-bl flex items-center justify-center text-[9px] font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Opis</label>
                  <textarea 
                    rows={3}
                    placeholder="Opis karnetu..."
                    value={opis}
                    onChange={(e) => setOpis(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl p-3 text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
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

      {/* POWIADOMIENIE TOAST DLA ADMINA */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-none">
          <div className={`px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            toast.type === 'error'
              ? 'bg-slate-900 border-rose-500/30 text-white'
              : toast.type === 'info'
              ? 'bg-slate-900 border-sky-500/30 text-white'
              : 'bg-slate-900 border-slate-800 text-white'
            }`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
              toast.type === 'error' ? 'bg-rose-600 text-white' :
              toast.type === 'info' ? 'bg-sky-600 text-white' :
              'bg-emerald-600 text-white'
            }`}>
              {toast.type === 'error' ? '✕' : toast.type === 'info' ? 'ℹ' : '✓'}
            </div>
            <span className="text-xs sm:text-sm font-semibold text-white pr-2">
              {toast.message}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
