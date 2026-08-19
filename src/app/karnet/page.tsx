"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../raporty/klienci/supabase';

// GLOBALNA BLOKADA (Zabezpieczenie przed podwójnym renderowaniem React Strict Mode)
let globalCreatingLock = false;

export default function KarnetyPage() {
  const [karnety, setKarnety] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dostepneRodzajeZajec, setDostepneRodzajeZajec] = useState<any[]>([]);
  
  // Stany dla strefy klubowicza (klient przeglądający swój karnet)
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [appRole, setAppRole] = useState<'admin' | 'trener' | 'klubowicz'>('klubowicz');
  const [isClientSuspendModalOpen, setIsClientSuspendModalOpen] = useState(false);
  const [clientSuspendDays, setClientSuspendDays] = useState('3');
  const [clientSuspendStartDate, setClientSuspendStartDate] = useState('');
  const [clientSuspendEndDate, setClientSuspendEndDate] = useState('');
  const [clientSuspendMode, setClientSuspendMode] = useState<'days' | 'dates'>('days');

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
      setDiscountCodeStatus({ type: 'error', message: 'Ten kod jest nieaktywny' });
      return;
    }

    if (data.data_zakonczenia && new Date(data.data_zakonczenia) < new Date(new Date().setHours(0,0,0,0))) {
      setDiscountCodeStatus({ type: 'error', message: 'Ten kod stracił ważność' });
      return;
    }

    if (data.limit_ogolny > 0 && data.wykorzystano_ogolnie >= data.limit_ogolny) {
       setDiscountCodeStatus({ type: 'error', message: 'Limit użyć tego kodu został wyczerpany' });
       return;
    }

    // SPRAWDZENIE CZY KOD OBOWIĄZUJE NA WYBRANY KARNET
    if (!data.wszystkie_karnety && Array.isArray(data.wybrane_karnety)) {
      if (!data.wybrane_karnety.includes(currentPassName)) {
        setDiscountCodeStatus({ type: 'error', message: `Ten kod rabatowy nie obejmuje karnetu: ${currentPassName}` });
        return;
      }
    }

    setAppliedDiscountCode(data);
    setDiscountCodeStatus({ type: 'success', message: `Zastosowano rabat: ${data.wartosc_znizki}${data.typ_znizki === 'procentowa' ? '%' : ' PLN'}` });
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
    } else if (userEffectiveDiscount.percent > 0) {
      finalPrice = basePriceNum * (1 - userEffectiveDiscount.percent / 100);
      appliedLabel = userEffectiveDiscount.label;
    }

    if (finalPrice < 0) finalPrice = 0;
    return { finalPrice, appliedLabel };
  };

  const incrementCodeUsage = async (codeId: string) => {
    const { data } = await supabase.from('kody_rabatowe').select('wykorzystano_ogolnie').eq('id', codeId).single();
    if (data) {
      await supabase.from('kody_rabatowe').update({ wykorzystano_ogolnie: (data.wykorzystano_ogolnie || 0) + 1 }).eq('id', codeId);
    }
  };

  // KALKULACJA RABATU SYSTEMOWEGO (PROGRESJA DO 25% + ZASADA 1 DNIA CIĄGŁOŚCI + CYKLE W JSON)
  const calculateContinuityDiscount = (client: any) => {
    if (!client) return { hasContinuity: false, percent: 0, label: '0% (Brak)' };
    const karnety = client.karnetyKlubowicza || [];
    if (karnety.length === 0) return { hasContinuity: false, percent: 0, label: '0% (Pierwszy zakup)' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let isContinuous = false;
    let maxCykl = 1;

    for (const k of karnety) {
      const extensionsCount = Array.isArray(k.historiaPrzedluzen) ? k.historiaPrzedluzen.length : 0;
      const passCycle = typeof k.cykl === 'number' ? k.cykl : (1 + extensionsCount);
      maxCykl = Math.max(maxCykl, passCycle, karnety.length + extensionsCount);

      if (k.waznyDo) {
        const exp = new Date(k.waznyDo);
        exp.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today.getTime() - exp.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 1) {
          if (k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined && k.pozostaloWejsc <= 0) {
            if (diffDays <= 1) isContinuous = true;
          } else {
            isContinuous = true;
          }
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

    return {
      hasContinuity: true,
      percent: rabatProcent,
      label: `${rabatProcent}% (Ciągłość: ${liczbaKarnetow} ${liczbaKarnetow === 1 ? 'karnet' : 'karnety'})`
    };
  };

  // POMOCNIK DO WYCIĄGANIA EFEKTYWNEGO RABATU KLIENTA (RĘCZNY NADRZĘDNY > SYSTEMOWY)
  const getEffectiveDiscount = (client: any) => {
    if (!client) return { percent: 0, label: '', type: 'none' };
    const manualDiscountVal = client.discount ? parseFloat(String(client.discount).replace(/[^0-9.]/g, '')) : 0;
    if (manualDiscountVal > 0) {
      return { percent: manualDiscountVal, label: `(-${manualDiscountVal}% rabat ręczny)`, type: 'manual' };
    }
    const continuityInfo = calculateContinuityDiscount(client);
    if (continuityInfo.hasContinuity && continuityInfo.percent > 0) {
      return { percent: continuityInfo.percent, label: `(-${continuityInfo.percent}% ciągłość)`, type: 'system' };
    }
    return { percent: 0, label: '', type: 'none' };
  };

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

      if (userEmail) {
        const normalizedEmail = userEmail.toLowerCase().trim();
        const { data: klienciData } = await supabase.from('klienci').select('*');
        
        if (klienciData) {
          const enriched = klienciData.map((c: any) => {
            let parsedKarnety = [];
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

            return {
              ...c,
              id: c.id,
              firstName: c.Imię || '',
              lastName: c.Nazwisko || '',
              email: c['E-mail'] || c.email || '',
              discount: c.discount || '',
              karnetyKlubowicza: parsedKarnety,
              historiaZawieszenGlobalna: parsedGlobalHistory,
              wallet: c.Portfel || c.portfel || c.wallet || '0.00 PLN'
            };
          });
          
          let myUser = enriched.find((c: any) => c.email.toLowerCase().trim() === normalizedEmail);
          
          if (!myUser && appRole === 'klubowicz') {
             if (globalCreatingLock) {
                console.log("Blokada wyścigu przy tworzeniu konta.");
                return;
             }
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
                 historiaZawieszenGlobalna: [],
                 wallet: '0.00 PLN'
               };
             }
             globalCreatingLock = false;
          }
          
          if (myUser) setCurrentUser(myUser);
        }
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
            ...meta 
          };
        });
        setKarnety(parsedData);
        setDostepneKarnety(parsedData);
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

  const globalSuspensions = currentUser?.historiaZawieszenGlobalna || [];
  const allSuspensions = globalSuspensions.map((susp: any) => ({
    ...susp,
    karnetNazwa: susp.karnetNazwa || 'Karnet'
  })).sort((a: any, b: any) => new Date(b.utworzono || 0).getTime() - new Date(a.utworzono || 0).getTime());

  const dostepneKarnetyDoZakupu = dostepneKarnety.filter((defKarnetu) => {
    const limitWejscBaza = defKarnetu.ilosc_wejsc || defKarnetu.limitWejsc || defKarnetu.wejscia || null;
    const isTimeBased = limitWejscBaza === null || limitWejscBaza === '';
    const alreadyOwned = karnetyList.some((k: any) => k.nazwa === defKarnetu.nazwa);
    return !(isTimeBased && alreadyOwned);
  });

  // =========================================================================
  // PRZEDŁUŻENIE KARNETU Z OBSŁUGĄ KODÓW RABATOWYCH
  // =========================================================================
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

    const basePriceNum = defKarnetu ? parseFloat(defKarnetu.cena) : parseFloat((passToExtend.cena || '0').replace(/[^0-9.-]+/g, "")) || 0;
    
    const currentCykl = passToExtend.cykl || (passToExtend.historiaPrzedluzen ? passToExtend.historiaPrzedluzen.length + 1 : (karnetyList.length || 1));
    const nextCykl = currentCykl + 1;

    const effectiveDiscount = getEffectiveDiscount(currentUser);
    const { finalPrice: cenaWartosc, appliedLabel } = calculateFinalPrice(basePriceNum, effectiveDiscount, appliedDiscountCode);
    const cenaStr = `${cenaWartosc.toFixed(2)} PLN`;
    
    let updatedKarnetyList = [...karnetyList];

    updatedKarnetyList = updatedKarnetyList.map(k => {
      if (k.id === passToExtend.id) {
        let baseDate = new Date();
        if (k.waznyDo) {
          const parts = k.waznyDo.split('-');
          if (parts.length === 3) {
            const currentExp = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            if (currentExp > baseDate) {
              baseDate = currentExp;
            }
          }
        }
        baseDate.setDate(baseDate.getDate() + dniWażności);
        const year = baseDate.getFullYear();
        const month = String(baseDate.getMonth() + 1).padStart(2, '0');
        const day = String(baseDate.getDate()).padStart(2, '0');
        const nowaDataWygasnieciaStr = `${year}-${month}-${day}`;

        let updatedRemaining = k.pozostaloWejsc;
        let updatedInitial = k.poczatkoweWejsc;

        let metaExt: Record<string, any> = {};
        try { metaExt = JSON.parse(defKarnetu?.inne_ustawienia || '{}'); } catch(e) {}
        const extWejsciaVal = defKarnetu ? (defKarnetu.ilosc_wejsc || metaExt.ilosc_wejsc || metaExt.iloscTreningow || null) : null;
        const parsedExtWejscia = extWejsciaVal !== null ? parseInt(extWejsciaVal, 10) : null;

        if (parsedExtWejscia !== null) {
          updatedRemaining = (k.pozostaloWejsc || 0) + parsedExtWejscia;
          updatedInitial = (k.poczatkoweWejsc || 0) + parsedExtWejscia;
        }

        const nowaHistoria = [...(k.historiaPrzedluzen || []), {
          data: todayStr,
          staraWaznosc: k.waznyDo,
          nowaWaznosc: nowaDataWygasnieciaStr,
          cena: cenaStr,
          rabat: appliedLabel
        }];

        return {
          ...k,
          waznyDo: nowaDataWygasnieciaStr,
          cena: cenaStr,
          cykl: nextCykl,
          historiaPrzedluzen: nowaHistoria,
          znizkaProcentowa: appliedLabel,
          statusTekst: `Ważny do: ${nowaDataWygasnieciaStr}`,
          pozostaloWejsc: updatedRemaining,
          poczatkoweWejsc: updatedInitial
        };
      }
      return k;
    });

    const currentWalletNum = parseFloat((currentUser.Portfel || currentUser.portfel || currentUser.wallet || '0').replace(/[^0-9.-]+/g, "")) || 0;
    const nowyStanPortfela = currentWalletNum - cenaWartosc;
    const nowyStanPortfelaStr = `${nowyStanPortfela.toFixed(2)} PLN`;

    const dbPayload: any = {
      karnetyKlubowicza: typeof currentUser.karnetyKlubowicza === 'string' ? JSON.stringify(updatedKarnetyList) : updatedKarnetyList,
    };
    
    if (currentUser.portfel !== undefined) dbPayload.portfel = nowyStanPortfelaStr;
    else if (currentUser.Portfel !== undefined) dbPayload.Portfel = nowyStanPortfelaStr;
    else dbPayload.Portfel = nowyStanPortfelaStr;

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
        opis: `Przedłużenie (Zakładka Karnet): ${passToExtend.nazwa}${appliedLabel ? ` ${appliedLabel}` : ''}`
      }]);
    }

    if (appliedDiscountCode) {
      await incrementCodeUsage(appliedDiscountCode.id);
    }
    
    setCurrentUser({
      ...currentUser,
      karnetyKlubowicza: updatedKarnetyList,
      Portfel: dbPayload.Portfel || currentUser.Portfel,
      portfel: dbPayload.portfel || currentUser.portfel,
      wallet: nowyStanPortfelaStr
    });
    
    alert(`Karnet "${passToExtend.nazwa}" został pomyślnie przedłużony za kwotę ${cenaStr}.`);
    setIsExtendModalOpen(false);
    resetDiscountState();
    loadData();
  };

  // ZAKUP NOWEGO KARNETU Z UWZGLĘDNIENIEM KODU RABATOWEGO
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
    
    const basePriceNum = defKarnetu ? parseFloat(defKarnetu.cena) : 0;
    
    const effectiveDiscount = getEffectiveDiscount(currentUser);
    const { finalPrice: cenaWartosc, appliedLabel } = calculateFinalPrice(basePriceNum, effectiveDiscount, appliedDiscountCode);
    const cenaStr = `${cenaWartosc.toFixed(2)} PLN`;

    const limitWejscBaza = defKarnetu ? (defKarnetu.ilosc_wejsc || defKarnetu.limitWejsc || defKarnetu.wejscia || null) : null;
    
    const isTimeBased = limitWejscBaza === null;
    const existingPassIndex = updatedKarnetyList.findIndex(k => k.nazwa === selectedBuyPass);

    let nowaDataWygasnieciaStr = '';
    let nextCykl = (karnetyList.length || 0) + 1;

    if (isTimeBased && existingPassIndex !== -1) {
      nextCykl = (updatedKarnetyList[existingPassIndex].cykl || updatedKarnetyList.length || 1) + 1;

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

          const nowaHistoria = [...(k.historiaPrzedluzen || []), {
            data: todayStr,
            staraWaznosc: k.waznyDo,
            nowaWaznosc: nowaDataWygasnieciaStr,
            cena: cenaStr,
            rabat: appliedLabel
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
        nextCykl = nextCykl + 1;
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

    const dbPayload: any = {
      karnetyKlubowicza: typeof currentUser.karnetyKlubowicza === 'string' ? JSON.stringify(updatedKarnetyList) : updatedKarnetyList,
    };
    
    if (currentUser.portfel !== undefined) dbPayload.portfel = nowyStanPortfelaStr;
    else if (currentUser.Portfel !== undefined) dbPayload.Portfel = nowyStanPortfelaStr;
    else dbPayload.Portfel = nowyStanPortfelaStr;

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
        opis: `Zakup (Zakładka Karnet): ${selectedBuyPass}${appliedLabel ? ` ${appliedLabel}` : ''}`
      }]);
    }

    if (appliedDiscountCode) {
      await incrementCodeUsage(appliedDiscountCode.id);
    }

    setCurrentUser({
      ...currentUser,
      karnetyKlubowicza: updatedKarnetyList,
      Portfel: dbPayload.Portfel || currentUser.Portfel,
      portfel: dbPayload.portfel || currentUser.portfel,
      wallet: nowyStanPortfelaStr
    });
    alert(`Gratulacje! Zakupiono karnet za kwotę ${cenaStr} (Ważny do: ${nowaDataWygasnieciaStr}).`);
    setSelectedBuyPass('');
    setIsBuyPassModalOpen(false);
    resetDiscountState();
    loadData();
  };

  const getDaysBetween = (d1: string, d2: string) => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    date1.setHours(0,0,0,0);
    date2.setHours(0,0,0,0);
    return Math.round(Math.abs((date2.getTime() - date1.getTime()) / (24 * 60 * 60 * 1000))) + 1;
  };

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

  // ❄️ 1. LOGIKA ZAWIESZANIA (GLOBALNA HISTORIA NA KONCIE KLIENTA)
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

    const startObj = new Date(suspendStartDate);
    const month = startObj.getMonth(); 
    const year = startObj.getFullYear();
    const globalHistory = currentUser?.historiaZawieszenGlobalna || [];

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
      utworzono: new Date().toISOString()
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

    alert(`Pomyślnie zapisano zawieszenie. System automatycznie wypisał Cię z zajęć w wybranym okresie.`);
    setIsSuspendModalOpen(false);
    setSuspendStartDate('');
    setSuspendEndDate('');
  };

  // 🔓 2. LOGIKA ODWIESZANIA (GLOBALNA HISTORIA)
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
      statusTekst: `Ważny do: ${nowaDataWygasnieciaStr}`
    };

    const dbPayload: any = {
      karnetyKlubowicza: typeof currentUser.karnetyKlubowicza === 'string' ? JSON.stringify(updatedKarnetyList) : updatedKarnetyList,
      historiaZawieszenGlobalna: typeof currentUser.historiaZawieszenGlobalna === 'string' ? JSON.stringify(updatedGlobalHistory) : updatedGlobalHistory
    };

    const { error: updateError } = await supabase.from('klienci').update(dbPayload).eq('id', currentUser.id);

    if (updateError) {
      alert(`Błąd aktualizacji bazy danych: ${updateError.message}`);
      return;
    }

    setCurrentUser({
      ...currentUser,
      karnetyKlubowicza: updatedKarnetyList,
      historiaZawieszenGlobalna: updatedGlobalHistory
    });

    alert(`Karnet odwieszony! Zużyto ${actualDays} dni z limitu. Data ważności przedłużona do: ${nowaDataWygasnieciaStr}`);
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
    let dodanaIloscWejsc = null;

    if (typKarnetu === 'Na czas') {
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
      }

      loadData(); 
      setIsModalOpen(false);
      
    } catch (error: any) {
      console.error("Szczegóły błędu bazy danych:", error);
      alert(`Błąd zapisu: ${error.message || ''} | Code: ${error.code || ''}`);
    }
  };

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

  if (!isMounted || isLoading) {
    return <div className="p-10 flex justify-center text-slate-400 font-bold uppercase text-xs">Ładowanie danych karnetu...</div>;
  }

  // JEŚLI UŻYTKOWNIK TO KLUBOWICZ - WYŚWIETLAMY JEGO PANEL KARNETU Z OPCJĄ ZAWIESZENIA
  if (appRole === 'klubowicz' && currentUser) {
    const effectiveDiscount = getEffectiveDiscount(currentUser);

    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in pb-24 font-sans antialiased">
        
        {/* BANER INFORMACYJNY O AKTYWNYM RABACIE */}
        {effectiveDiscount.percent > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏷️</span>
              <div>
                <div className="font-black text-xs uppercase tracking-wider">Twój aktywny rabat: {effectiveDiscount.percent}%</div>
                <div className="text-[11px] text-emerald-700 mt-0.5">
                  {effectiveDiscount.type === 'manual' ? 'Przypisano indywidualny rabat stały do Twojego konta.' : `Rabat lojalnościowy naliczany za zachowanie ciągłości karnetów.`} Ceny zakupu i przedłużeń karnetów uwzględniają tę zniżkę.
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
                let isSuspended = !!karnet.zawieszonyOd;

                if (!isPending && !isSuspended) {
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
                if (isSuspended) statusColorClass = 'bg-slate-100 text-slate-600 border-slate-300'; 
                else if (isPending) statusColorClass = 'bg-amber-100 text-amber-800 border-amber-200'; 
                else if (isExpiring) statusColorClass = 'bg-rose-100 text-rose-800 border-rose-200'; 

                return (
                  <div key={karnet.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-black text-slate-900">{karnet.nazwa}</h3>
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
                          {karnet.cena && (
                            <span className="bg-slate-100 text-slate-700 font-semibold px-3 py-1 rounded-full text-xs border border-slate-200">
                              Cena: {karnet.cena}
                            </span>
                          )}
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
                          onClick={() => { resetDiscountState(); setPassToExtend(karnet); setIsExtendModalOpen(true); }}
                          className="bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 hover:border-sky-300 hover:text-sky-900 font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                        >
                          <span className="text-sm">🕒</span> PRZEDŁUŻ
                        </button>
                      )}
                      <button 
                        onClick={() => { resetDiscountState(); setActivationMode('today'); setSelectedBuyPass(''); setIsBuyPassModalOpen(true); }}
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
              onClick={() => { resetDiscountState(); setActivationMode('today'); setSelectedBuyPass(''); setIsBuyPassModalOpen(true); }}
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

        {/* MODAL ZASAD ZAWIESZEŃ (INFORMACYJNY) */}
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
                <p className="font-bold">Limity zawieszeń obowiązują globalnie dla Twojego konta klubowicza:</p>
                <ul className="list-disc pl-4 space-y-2 font-medium">
                  <li><strong>Standardowy kwartał:</strong> Maksymalnie do 14 dni zawieszenia w kwartale (podzielone na maksymalnie 2 okresy).</li>
                  <li><strong>Miesiące wakacyjne (Lipiec / Sierpień):</strong> Możliwość zawieszenia karnetu 1 raz w miesiącu (do 14 dni). Uwaga: jeśli karnet był zawieszany w wakacje, zawieszenie we wrześniu nie jest dozwolone.</li>
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
                  System przeliczy faktyczne dni zawieszenia i o tę wartość przedłuży ważność karnetu.
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

        {/* MODAL: PRZEDŁUŻ KARNET */}
        {isExtendModalOpen && passToExtend && (() => {
          const effectiveDiscount = getEffectiveDiscount(currentUser);
          const defKarnetu = dostepneKarnety.find(k => k.nazwa === passToExtend.nazwa);
          const basePrice = defKarnetu ? parseFloat(defKarnetu.cena) : parseFloat((passToExtend.cena || '0').replace(/[^0-9.-]+/g, "")) || 0;
          const { finalPrice, appliedLabel } = calculateFinalPrice(basePrice, effectiveDiscount, appliedDiscountCode);

          return (
            <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
                <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                  <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🕒 Przedłuż karnet</h3>
                  <button onClick={() => { setIsExtendModalOpen(false); resetDiscountState(); }} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
                </div>
                <form onSubmit={handleExtendSubmit} className="space-y-4 text-xs">
                  <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 text-sky-900">
                    Przedłużasz karnet: <strong className="block text-sm mt-1">{passToExtend.nazwa}</strong>
                  </div>

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
                  
                  <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-slate-600">
                      <span>Cena katalogowa:</span>
                      <span className="font-bold">{basePrice.toFixed(2)} PLN</span>
                    </div>
                    {appliedLabel && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Naliczony rabat:</span>
                        <span>{appliedLabel} (-{(basePrice - finalPrice).toFixed(2)} PLN)</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-900 font-black text-xs pt-1 border-t border-amber-200">
                      <span>Cena po przedłużeniu:</span>
                      <span className="text-emerald-700 font-bold">{finalPrice.toFixed(2)} PLN</span>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                    <button type="button" onClick={() => { setIsExtendModalOpen(false); resetDiscountState(); }} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer">
                      Anuluj
                    </button>
                    <button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer">
                      Potwierdzam przedłużenie ({finalPrice.toFixed(2)} PLN)
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* MODAL: KUP KARNET */}
        {isBuyPassModalOpen && (() => {
          const effectiveDiscount = getEffectiveDiscount(currentUser);
          const selectedPassDef = dostepneKarnety.find(k => k.nazwa === selectedBuyPass);
          const basePrice = selectedPassDef ? parseFloat(selectedPassDef.cena) : 0;
          const { finalPrice: discountedPrice, appliedLabel } = calculateFinalPrice(basePrice, effectiveDiscount, appliedDiscountCode);

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
                        const kBasePrice = parseFloat(k.cena) || 0;
                        const kFinalPrice = effectiveDiscount.percent > 0 
                          ? (kBasePrice * (1 - effectiveDiscount.percent / 100)).toFixed(2)
                          : k.cena;
                        return (
                          <option key={k.id} value={k.nazwa}>
                            {k.nazwa} (Cena: {kFinalPrice} PLN {effectiveDiscount.percent > 0 ? `| Rabat ${effectiveDiscount.percent}%` : ''})
                          </option>
                        );
                      })}
                    </select>
                  </div>

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
                        <span>Cena katalogowa:</span>
                        <span className="font-bold">{basePrice.toFixed(2)} PLN</span>
                      </div>
                      {appliedLabel && (
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>Naliczony rabat:</span>
                          <span>{appliedLabel} (-{(basePrice - discountedPrice).toFixed(2)} PLN)</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-900 font-black text-xs pt-1 border-t border-amber-200">
                        <span>Do zapłaty:</span>
                        <span className="text-emerald-700 font-bold">{discountedPrice.toFixed(2)} PLN</span>
                      </div>
                    </div>
                  )}

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
      </div>
    );
  }

  // PANEL ADMINISTRATORA / TRENERA (Zarządzanie cennikiem karnetów)
  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 font-sans antialiased">
      
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
                    <div className="font-bold text-slate-900 text-sm">{item.nazwa}</div>
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
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
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
                        className="w-full bg-sky-50/50 border border-sky-200 rounded-r-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-sky-500"
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
