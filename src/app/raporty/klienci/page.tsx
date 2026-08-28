"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Bezpośrednia, bezpieczna inicjalizacja klienta Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Bezpieczny parser danych JSON / JSONB z Supabase
const safeJsonParse = (val: any, fallback: any = []) => {
  if (!val) return fallback;
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return parsed !== null ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }
  return fallback;
};

// Pomocniczy kalkulator dni do wygaśnięcia
const getDaysUntilExpiry = (expiryDateStr: string | null | undefined): number | null => {
  if (!expiryDateStr || expiryDateStr === '-') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expiryDateStr);
  expDate.setHours(0, 0, 0, 0);
  if (isNaN(expDate.getTime())) return null;
  return Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export default function KlienciPage() {
  const todayStr = new Date().toISOString().split('T')[0];

  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [dostepneKarnety, setDostepneKarnety] = useState<any[]>([]);
  const [zespolTrenerzy, setZespolTrenerzy] = useState<any[]>([]);
  
  // Dane grafiku i zapisów do pełnej synchronizacji
  const [zapisaneZajecia, setZapisaneZajecia] = useState<any[]>([]);
  const [jednorazoweZajecia, setJednorazoweZajecia] = useState<any[]>([]);
  const [nadpisaneZajeciaDni, setNadpisaneZajeciaDni] = useState<{ [key: string]: any }>({});
  const [wszystkieZapisy, setWszystkieZapisy] = useState<any[]>([]);
  const [automatyczneZapisy, setAutomatyczneZapisy] = useState<any[]>([]);
  const [wszystkieTransakcje, setWszystkieTransakcje] = useState<any[]>([]);

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [profileClient, setProfileClient] = useState<any | null>(null);
  const [tableActionClient, setTableActionClient] = useState<any | null>(null);

  const [isExtendPassModalOpen, setIsExtendPassModalOpen] = useState(false);
  const [extendPassTarget, setExtendPassTarget] = useState<any | null>(null);
  const [extendSelectedNewPassName, setExtendSelectedNewPassName] = useState('');
  const [extendNewDate, setExtendNewDate] = useState('');
  const [extendCustomPriceInput, setExtendCustomPriceInput] = useState('');
  const [isEditingNewPassType, setIsEditingNewPassType] = useState(false);
  const [isEditingNewDate, setIsEditingNewDate] = useState(false);
  const [isEditingNewPrice, setIsEditingNewPrice] = useState(false);

  const [isEditProfileInfoOpen, setIsEditProfileInfoOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 4 ZAKŁADKI W SEKCJI AKTYWNOŚĆ KLUBOWICZA
  const [activeZapisyTab, setActiveZapisyTab] = useState<'nadchodzace' | 'historia_zajec' | 'ruchy' | 'zawieszenia'>('nadchodzace');

  const [isWalletHistoryOpen, setIsWalletHistoryOpen] = useState(false);
  const [isTopUpWalletOpen, setIsTopUpWalletOpen] = useState(false);
  const [walletAmountInput, setWalletAmountInput] = useState('');
  const [walletReasonInput, setWalletReasonInput] = useState('');

  // STANY DLA ZAWIESZEŃ I BLOKAD
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

  const [isGlobalPassMenuOpen, setIsGlobalPassMenuOpen] = useState(false);
  const [editingPassModal, setEditingPassModal] = useState<any | null>(null);
  const [isAddSecondPassModalOpen, setIsAddSecondPassModalOpen] = useState(false);
  const [selectedPassToAdd, setSelectedPassToAdd] = useState('');
  const [newPassCustomRata, setNewPassCustomRata] = useState('0 / 12');
  const [newPassCustomSuspensionDays, setNewPassCustomSuspensionDays] = useState('30');
  const [newPassCustomPrice, setNewPassCustomPrice] = useState('');

  // STANY RABATÓW
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState('');

  const [isEditingSystemDiscount, setIsEditingSystemDiscount] = useState(false);
  const [systemDiscountInput, setSystemDiscountInput] = useState('');

  // STAN DLA HISTORII ZAKUPIONYCH KARNETÓW W PROFILU
  const [isPassHistoryOpen, setIsPassHistoryOpen] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    price: '0.00 PLN',
    wallet: '0.00 PLN',
    registered: todayStr,
    selectedPass: '',
    isContractMigration: false,
    customRata: '0 / 12',
    customSuspensionDays: '30',
    customContractPrice: ''
  });

  // KULOODPORNY PARSER DAT
  const parseClassDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    let d = String(dateStr).trim();
    
    // DD.MM.YYYY, DD-MM-YYYY, DD/MM/YYYY z opcjonalną godziną
    const regexFull = /(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/;
    const matchFull = d.match(regexFull);
    if (matchFull) {
      const year = matchFull[3];
      const month = matchFull[2].padStart(2, '0');
      const day = matchFull[1].padStart(2, '0');
      const hour = matchFull[4] ? matchFull[4].padStart(2, '0') : '23';
      const min = matchFull[5] ? matchFull[5].padStart(2, '0') : '59';
      const parsed = new Date(`${year}-${month}-${day}T${hour}:${min}:00`).getTime();
      if (!isNaN(parsed)) return parsed;
    }

    // Format YYYY-MM-DD
    const regexIso = /(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/;
    const matchIso = d.match(regexIso);
    if (matchIso) {
      const year = matchIso[1];
      const month = matchIso[2].padStart(2, '0');
      const day = matchIso[3].padStart(2, '0');
      const hour = matchIso[4] ? matchIso[4].padStart(2, '0') : '23';
      const min = matchIso[5] ? matchIso[5].padStart(2, '0') : '59';
      const parsed = new Date(`${year}-${month}-${day}T${hour}:${min}:00`).getTime();
      if (!isNaN(parsed)) return parsed;
    }

    // Format DD/MM lub DD.MM
    const regexShort = /(\d{1,2})[\.\-\/](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/;
    const matchShort = d.match(regexShort);
    if (matchShort) {
      const currentYear = new Date().getFullYear();
      const month = matchShort[2].padStart(2, '0');
      const day = matchShort[1].padStart(2, '0');
      const hour = matchShort[3] ? matchShort[3].padStart(2, '0') : '23';
      const min = matchShort[4] ? matchShort[4].padStart(2, '0') : '59';
      const parsed = new Date(`${currentYear}-${month}-${day}T${hour}:${min}:00`).getTime();
      if (!isNaN(parsed)) return parsed;
    }

    const fallback = new Date(d).getTime();
    return isNaN(fallback) ? 0 : fallback;
  };

  // HELPER UNIFIKACJI DATY I SYGNATURY DEDUKUJĄCEJ DUPLIKATY
  const normalizeDateToIsoDay = (dateStr: string): string => {
    if (!dateStr) return '';
    const ms = parseClassDate(dateStr);
    if (ms > 0) {
      const d = new Date(ms);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    return String(dateStr).trim();
  };

  const normalizeClassSignature = (dateStr: string, titleStr: string): string => {
    const day = normalizeDateToIsoDay(dateStr);
    const cleanTitle = (titleStr || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return `${day}_${cleanTitle}`;
  };

  // HELPERY SYNCHRONIZACJI DATY WAŻNOŚCI I CENY DO SUPABASE
  const getLatestPassExpiry = (passes: any[]): string | null => {
    if (!passes || passes.length === 0) return null;
    const validDates = passes
      .map((k: any) => k.waznyDo)
      .filter(Boolean)
      .sort((a: string, b: string) => b.localeCompare(a));
    return validDates.length > 0 ? validDates[0] : null;
  };

  const getPassPrice = (passes: any[]): string => {
    if (!passes || passes.length === 0) return '0.00 PLN';
    const latest = passes.reduce((prev: any, curr: any) => {
      return (!prev || (curr.waznyDo && curr.waznyDo > prev.waznyDo)) ? curr : prev;
    }, null);
    return latest?.cena || '0.00 PLN';
  };

  // FUNKCJE POMOCNICZE I RABATOWE
  const isWalletNegative = (walletStr: string) => walletStr?.includes('-');

  const calculateStandardSystemDiscount = (client: any) => {
    if (!client) return 0;
    const utraty = (client.transakcje || []).filter((t: any) => t.typ_operacji === 'utrata_ciaglosci');
    let lastResetDate = '1970-01-01T00:00:00.000Z';
    if (utraty.length > 0) {
      utraty.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      lastResetDate = utraty[0].created_at;
    }

    const transakcjeKarnetow = (client.transakcje || []).filter(
      (t: any) => 
        new Date(t.created_at) > new Date(lastResetDate) &&
        (t.typ_operacji === 'zakup_karnetu' || (t.opis && (t.opis.toLowerCase().includes('karnet') || t.opis.toLowerCase().includes('przedłużenie')))) &&
        (!t.opis || !t.opis.toLowerCase().includes('usunięcie'))
    );
    
    const count = transakcjeKarnetow.length;
    if (count <= 0) return 0;
    if (count === 1) return 2;
    if (count === 2) return 4;
    return Math.min(25, 4 + (count - 2)); 
  };

  const calculateSystemDiscount = (client: any) => {
    if (!client) return 0;
    if (client.hasLostContinuity === true || client.hasLostContinuity === 'true') return 0;

    if (client.rabat !== undefined && client.rabat !== null && client.rabat !== '') {
      const val = parseFloat(String(client.rabat).replace(/[^0-9.-]/g, ''));
      if (!isNaN(val) && val > 0) return val;
      if (!isNaN(val) && val === 0) return 0;
    }
    
    const std = calculateStandardSystemDiscount(client);
    const offset = parseFloat(client.systemDiscountOffset || client.system_discount_offset || '0') || 0;
    return Math.max(0, Math.min(25, std + offset));
  };

  const getEffectiveDiscount = (client: any, isContract: boolean = false) => {
    if (!client) return 0;
    const staly = parseFloat(client.discount || '0');
    if (staly > 0) return staly;
    if (isContract) return 0; 
    return calculateSystemDiscount(client);
  };

  // AUTOMATYCZNY AWANS Z LISTY REZERWOWEJ
  const promoteWaitlistForClass = async (classKey: string) => {
    const { data: participants } = await supabase
      .from('zapisy_zajec')
      .select('*')
      .eq('class_key', classKey);

    if (!participants) return;

    const parts = classKey.split('_');
    const classId = parts[0];
    let limit = 12;

    const [{ data: szablon }, { data: jednorazowe }, { data: nadpisanie }] = await Promise.all([
      supabase.from('grafik_zajec').select('*').eq('id', classId).maybeSingle(),
      supabase.from('zajecia_jednorazowe').select('*').eq('id', classId).maybeSingle(),
      supabase.from('nadpisania_zajec').select('*').eq('class_key', classKey).maybeSingle()
    ]);

    if (nadpisanie?.limit) limit = nadpisanie.limit;
    else if (szablon?.limit || szablon?.limit_miejsc) limit = szablon.limit || szablon.limit_miejsc;
    else if (jednorazowe?.limit_miejsc || jednorazowe?.limit) limit = jednorazowe.limit_miejsc || jednorazowe.limit;

    const mainList = participants.filter((p: any) => p.status === 'zapisany');
    const firstWaitlist = participants.find((p: any) => p.status === 'krzesełko');

    if (mainList.length < limit && firstWaitlist) {
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
  };

  // AUTOMATYCZNE WYPISYWANIE PO BLOKADZIE
  const handleAutoWypiszPoZablokowaniu = async (klientId: number, targetClientObj: any, powodBlokadyText: string) => {
    const now = new Date();
    const todayBeginning = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let cancelledCount = 0;
    const { data: userSignups } = await supabase
      .from('zapisy_zajec')
      .select('*')
      .eq('klient_id', klientId);

    if (userSignups && userSignups.length > 0) {
      for (const signup of userSignups) {
        const classDateMs = parseClassDate(signup.class_key?.split('_')[1] || '');
        const classDate = classDateMs ? new Date(classDateMs) : todayBeginning;
        
        if (classDate >= todayBeginning) {
          await supabase
            .from('zapisy_zajec')
            .delete()
            .eq('class_key', signup.class_key)
            .eq('klient_id', klientId);
          cancelledCount++;

          await promoteWaitlistForClass(signup.class_key);
        }
      }
    }

    if (cancelledCount > 0 && targetClientObj) {
      let updatedKarnety = safeJsonParse(targetClientObj.karnetyKlubowicza, []);
      const passIndex = updatedKarnety.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
      
      if (passIndex !== -1) {
        const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10) || 0;
        const poczatkowe = parseInt(updatedKarnety[passIndex].poczatkoweWejsc || currentRemaining + cancelledCount, 10);
        updatedKarnety[passIndex] = {
          ...updatedKarnety[passIndex],
          pozostaloWejsc: Math.min(poczatkowe, currentRemaining + cancelledCount)
        };
        await supabase.from('klienci').update({ karnetyKlubowicza: updatedKarnety }).eq('id', klientId);
      }

      await supabase.from('transakcje').insert([{
        klient_id: klientId,
        typ_operacji: 'zajecia_wypis',
        opis: `Automatycznie wypisano z ${cancelledCount} przyszłych zajęć z powodu blokady konta/karnetu (${powodBlokadyText}). Zwrócono ${cancelledCount} wejść.`
      }]);
    }
  };

  // AUTOMATYCZNE WYPISYWANIE PO ZAWIESZENIU
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
          const classTimeMs = parseClassDate(dateStr);
          const classDate = classTimeMs ? new Date(classTimeMs) : todayBeginning;
          const classDateStr = classDate.toISOString().split('T')[0];
          
          const isAfterStart = classDateStr >= zawieszonyOd;
          const isBeforeEnd = !zawieszonyDo || classDateStr <= zawieszonyDo;

          if (isAfterStart && isBeforeEnd && classDate >= todayBeginning) {
            await supabase
              .from('zapisy_zajec')
              .delete()
              .eq('class_key', signup.class_key)
              .eq('klient_id', klientId);
            cancelledCount++;

            await promoteWaitlistForClass(signup.class_key);
          }
        }
      }
    }

    if (cancelledCount > 0) {
      const { data: klientData } = await supabase.from('klienci').select('karnetyKlubowicza').eq('id', klientId).single();
      if (klientData) {
        let updatedKarnety = safeJsonParse(klientData.karnetyKlubowicza, []);
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

  // WYPISANIE POJEDYNCZE Z ZAJĘĆ (W TYM ZAPISÓW AUTOMATYCZNYCH)
  const handleWypiszZajecia = async (zajecieItem: any) => {
    if (!profileClient) return;

    const zwrocicWejscie = confirm("Czy zwrócić klubowiczowi wejście na karnet?");

    let karnetyZaktualizowane = safeJsonParse(profileClient.karnetyKlubowicza, []);
    if (zwrocicWejscie) {
      const passIndex = karnetyZaktualizowane.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
      if (passIndex !== -1) {
        const currentRemaining = parseInt(karnetyZaktualizowane[passIndex].pozostaloWejsc, 10) || 0;
        const poczatkowe = parseInt(karnetyZaktualizowane[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
        karnetyZaktualizowane[passIndex] = {
          ...karnetyZaktualizowane[passIndex],
          pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
        };
      }
    }

    // Obsługa usunięcia zapisu automatycznego z bazy automatyczne_zapisy
    if (String(zajecieItem.classKey || '').startsWith('auto_')) {
      const grafikId = String(zajecieItem.classKey).replace('auto_', '');
      await supabase
        .from('automatyczne_zapisy')
        .delete()
        .eq('grafik_id', grafikId)
        .eq('klient_id', profileClient.id);
    }

    if (zajecieItem.classKey && !String(zajecieItem.classKey).startsWith('auto_')) {
      await supabase
        .from('zapisy_zajec')
        .delete()
        .eq('class_key', zajecieItem.classKey)
        .eq('klient_id', profileClient.id);

      await promoteWaitlistForClass(zajecieItem.classKey);
    }

    const sigToRemove = normalizeClassSignature(zajecieItem.data, zajecieItem.zajecia);
    const stareNadchodzace = safeJsonParse(profileClient.zapisyNadchodzace, []);
    const uaktualnioneNadchodzace = stareNadchodzace.filter((z: any) => {
      const itemSig = normalizeClassSignature(z.data, z.zajecia);
      return z.id !== zajecieItem.id && z.classKey !== zajecieItem.classKey && itemSig !== sigToRemove;
    });

    const nowyWypis = { 
      ...zajecieItem, 
      id: Date.now(),
      wypisujacy: 'Zarządca (Panel Klienci)',
      data_operacji: new Date().toISOString()
    };
    const stareWypisy = safeJsonParse(profileClient.zapisyWypisy, []);
    const uaktualnioneWypisy = [nowyWypis, ...stareWypisy];

    await supabase.from('klienci').update({ 
      karnetyKlubowicza: karnetyZaktualizowane,
      zapisyNadchodzace: uaktualnioneNadchodzace, 
      zapisyWypisy: uaktualnioneWypisy
    }).eq('id', profileClient.id);

    await supabase.from('transakcje').insert([{
      klient_id: profileClient.id,
      typ_operacji: 'zajecia_wypis',
      kwota: null,
      class_key: zajecieItem.classKey || null,
      opis: `Wypisano z zajęć: ${zajecieItem.zajecia} (${zajecieItem.data})${zwrocicWejscie ? ' - zwrócono 1 wejście' : ''}`
    }]);

    loadData();
  };

  // MASOWE WYPISANIE ZE WSZYSTKICH NADCHODZĄCYCH ZAJĘĆ
  const handleWypiszWszystkieNadchodzace = async (upcomingItems: any[]) => {
    if (!profileClient || !upcomingItems || upcomingItems.length === 0) return;

    if (!confirm(`Czy na pewno chcesz wypisać klubowicza ze WSZYSTKICH (${upcomingItems.length}) nadchodzących zajęć?`)) {
      return;
    }

    const zwrocicWejscia = confirm(`Czy zwrócić klubowiczowi wejścia na karnet za anulowane rezerwacje (${upcomingItems.length} wejść)?`);

    let karnetyZaktualizowane = safeJsonParse(profileClient.karnetyKlubowicza, []);
    if (zwrocicWejscia) {
      const passIndex = karnetyZaktualizowane.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
      if (passIndex !== -1) {
        const currentRemaining = parseInt(karnetyZaktualizowane[passIndex].pozostaloWejsc, 10) || 0;
        const poczatkowe = parseInt(karnetyZaktualizowane[passIndex].poczatkoweWejsc || currentRemaining + upcomingItems.length, 10);
        karnetyZaktualizowane[passIndex] = {
          ...karnetyZaktualizowane[passIndex],
          pozostaloWejsc: Math.min(poczatkowe, currentRemaining + upcomingItems.length)
        };
      }
    }

    const noweWypisy: any[] = [];

    for (const item of upcomingItems) {
      if (String(item.classKey || '').startsWith('auto_')) {
        const grafikId = String(item.classKey).replace('auto_', '');
        await supabase
          .from('automatyczne_zapisy')
          .delete()
          .eq('grafik_id', grafikId)
          .eq('klient_id', profileClient.id);
      } else if (item.classKey) {
        await supabase
          .from('zapisy_zajec')
          .delete()
          .eq('class_key', item.classKey)
          .eq('klient_id', profileClient.id);

        await promoteWaitlistForClass(item.classKey);
      }

      noweWypisy.push({
        ...item,
        id: Date.now() + Math.random(),
        wypisujacy: 'Zarządca (Wypis masowy)',
        data_operacji: new Date().toISOString()
      });
    }

    const stareWypisy = safeJsonParse(profileClient.zapisyWypisy, []);
    const uaktualnioneWypisy = [...noweWypisy, ...stareWypisy];

    await supabase.from('klienci').update({
      karnetyKlubowicza: karnetyZaktualizowane,
      zapisyNadchodzace: [],
      zapisyWypisy: uaktualnioneWypisy
    }).eq('id', profileClient.id);

    await supabase.from('transakcje').insert([{
      klient_id: profileClient.id,
      typ_operacji: 'zajecia_wypis',
      kwota: null,
      opis: `Masowo wypisano ze wszystkich nadchodzących zajęć (${upcomingItems.length} treningów)${zwrocicWejscia ? ` - zwrócono ${upcomingItems.length} wejść` : ''}`
    }]);

    alert(`Pomyślnie wypisano ze wszystkich ${upcomingItems.length} nadchodzących zajęć.`);
    loadData();
  };

  const loadData = async () => {
    const [
      { data: klienciData },
      { data: karnetyData },
      { data: transakcjeData },
      { data: trenerzyData },
      { data: grafikData },
      { data: jednorazoweData },
      { data: nadpisaniaData },
      { data: zapisyData },
      { data: autoZapisyData }
    ] = await Promise.all([
      supabase.from('klienci').select('*'),
      supabase.from('karnety').select('*'),
      supabase.from('transakcje').select('*').order('created_at', { ascending: false }),
      supabase.from('trenerzy').select('*'),
      supabase.from('grafik_zajec').select('*'),
      supabase.from('zajecia_jednorazowe').select('*'),
      supabase.from('nadpisania_zajec').select('*'),
      supabase.from('zapisy_zajec').select('*'),
      supabase.from('automatyczne_zapisy').select('*')
    ]);

    if (trenerzyData) setZespolTrenerzy(trenerzyData);
    if (grafikData) setZapisaneZajecia(grafikData);
    if (jednorazoweData) setJednorazoweZajecia(jednorazoweData);
    if (zapisyData) setWszystkieZapisy(zapisyData);
    if (autoZapisyData) setAutomatyczneZapisy(autoZapisyData);
    if (transakcjeData) setWszystkieTransakcje(transakcjeData);

    if (nadpisaniaData) {
      const nadpisaniaMap: { [key: string]: any } = {};
      nadpisaniaData.forEach((n: any) => {
        nadpisaniaMap[n.class_key] = n;
      });
      setNadpisaneZajeciaDni(nadpisaniaMap);
    }

    let ustrukturyzowaneKarnety: any[] = [];
    if (karnetyData) {
      ustrukturyzowaneKarnety = karnetyData.map((k: any) => {
        let meta: Record<string, any> = {};
        try {
          meta = JSON.parse(k.inne_ustawienia || '{}');
        } catch(e) {}

        const is12M = k.typ_karnetu === 'Umowa 12 miesięcy' || meta.isContract12M === true;
        const isTimeBased = k.typ_karnetu === 'Na czas';

        return {
          ...k,
          cena: k.cena_brutto || k.cena || '0.00',
          limitCzasowy: k.dlugosc || k.limitCzasowy || '',
          isContract12M: is12M,
          ilosc_wejsc: (is12M || isTimeBased) ? null : (k.ilosc_wejsc || meta.ilosc_wejsc || meta.iloscTreningow || null)
        };
      });
      setDostepneKarnety(ustrukturyzowaneKarnety);
    }

    if (klienciData) {
      const todayDate = new Date();
      const yesterday = new Date(todayDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      const enrichedPromises = klienciData.map(async (c: any) => {
        const clientTransakcje = transakcjeData ? transakcjeData.filter((t: any) => String(t.klient_id) === String(c.id)) : [];
        const powiazanyTrener = trenerzyData?.find((t: any) => t.email && t.email === c['E-mail']);
        
        let parsedKarnety = safeJsonParse(c.karnetyKlubowicza || c.karnetyklubowicza, []);

        let karnetyZmienione = false;
        parsedKarnety = parsedKarnety.map((k: any) => {
          const pasujacyDef = ustrukturyzowaneKarnety.find(dk => dk.nazwa === k.nazwa);
          const isContract = k.isContract12M || pasujacyDef?.isContract12M || pasujacyDef?.typ_karnetu === 'Umowa 12 miesięcy';
          const isTimeBased = pasujacyDef?.typ_karnetu === 'Na czas';

          if (isContract) {
            k.isContract12M = true;
            k.pozostaloWejsc = null;
            k.poczatkoweWejsc = null;
            if (k.contractSuspensionDaysLeft === undefined) {
              k.contractSuspensionDaysLeft = 30;
              karnetyZmienione = true;
            }
            if (!k.rata) {
              k.rata = '0 / 12';
              karnetyZmienione = true;
            }
          } else if (isTimeBased) {
            k.pozostaloWejsc = null;
            k.poczatkoweWejsc = null;
          } else if (k.pozostaloWejsc === undefined || k.pozostaloWejsc === null) {
            if (pasujacyDef && pasujacyDef.ilosc_wejsc !== null) {
              const valWejsc = parseInt(pasujacyDef.ilosc_wejsc, 10);
              k.pozostaloWejsc = valWejsc;
              k.poczatkoweWejsc = valWejsc;
              karnetyZmienione = true;
            }
          }
          return k;
        });

        let hasChanges = karnetyZmienione;
        let utrataCiaglosci = false;
        let finalKarnety = [];

        for (const k of parsedKarnety) {
          if (k.waznyDo && k.waznyDo < yesterdayStr && !k.isContract12M) {
            hasChanges = true; 
          } else {
            finalKarnety.push(k);
          }
        }

        if (parsedKarnety.length > 0 && finalKarnety.length === 0) {
          utrataCiaglosci = true;
          hasChanges = true;
        }

        let currentDiscount = c.discount;
        let currentOffset = parseFloat(c.systemDiscountOffset || c.system_discount_offset || '0') || 0;
        let hasLostContinuity = c.hasLostContinuity || false;
        let currentRabat = c.rabat !== undefined ? c.rabat : null;

        if (utrataCiaglosci || finalKarnety.length === 0) {
           if (currentDiscount > 0 || !hasLostContinuity) {
               currentDiscount = '';
               hasLostContinuity = true;
               currentRabat = 0;
               
               const staryStd = calculateStandardSystemDiscount({ transakcje: clientTransakcje });
               currentOffset = -staryStd; 
               hasChanges = true;

               supabase.from('transakcje').insert([{
                 klient_id: c.id,
                 typ_operacji: 'utrata_ciaglosci',
                 kwota: null,
                 opis: 'Automatyczne usunięcie wygasłego karnetu - utrata ciągłości i zniżek'
               }]).then();
               
               clientTransakcje.push({
                 typ_operacji: 'utrata_ciaglosci',
                 created_at: new Date().toISOString(),
                 opis: 'Automatyczne usunięcie wygasłego karnetu - utrata ciągłości i zniżek'
               });
           }
        }

        const calculatedExpiry = getLatestPassExpiry(finalKarnety);
        const cenaAktywnegoKarnetu = getPassPrice(finalKarnety);

        if (hasChanges || c.Wygasa !== calculatedExpiry || c.Cena !== cenaAktywnegoKarnetu) {
           await supabase.from('klienci').update({ 
               karnetyKlubowicza: finalKarnety,
               Wygasa: calculatedExpiry,
               Cena: cenaAktywnegoKarnetu,
               discount: currentDiscount,
               rabat: currentRabat,
               system_discount_offset: currentOffset,
               hasLostContinuity: hasLostContinuity
           }).eq('id', c.id);
        }

        const effectiveBanDate = c.blokadaDo || c.blokada_do || (finalKarnety[0]?.blokadaDo) || null;
        const effectiveBanReason = c.powodBlokady || c.powod_blokady || (finalKarnety[0]?.powodBlokady) || null;

        const rawHistZaw1 = safeJsonParse(c.historiaZawieszenGlobalna || c.historiazawieszenglobalna, []);
        const rawHistZaw2 = safeJsonParse(c.historiaZawieszen, []);
        const rawHistZaw3 = safeJsonParse(c.historiazawieszen, []);
        const mergedHistoriaZawieszen = [...rawHistZaw1, ...rawHistZaw2, ...rawHistZaw3];

        return {
          ...c,
          id: c.id,
          rabat: c.rabat,
          systemDiscountOffset: currentOffset,
          hasLostContinuity: hasLostContinuity,
          firstName: c.Imię || c.firstName || '',
          lastName: c.Nazwisko || c.lastName || '',
          registered: c.Zarejestrowany || c.registered || '2026-06-01',
          activated: c.activated || '2026-06-01',
          expiresDate: calculatedExpiry || '',
          Wygasa: calculatedExpiry,
          price: cenaAktywnegoKarnetu,
          discount: currentDiscount || '',
          wallet: c.Portfel || c.portfel || c.wallet || '0.00 PLN',
          avatarUrl: c.avatarUrl || null,
          gender: c.płeć || c.gender || '',
          phone: c['Numer tel.'] || c.telefon || c.phone || '',
          email: c['E-mail'] || c.email || '',
          birthDate: c.Urodziny || c.birthDate || '',
          blokadaDo: effectiveBanDate,
          powodBlokady: effectiveBanReason,
          isTrainer: !!powiazanyTrener,
          trenerInfo: powiazanyTrener || null,
          karnetyKlubowicza: finalKarnety, 
          transakcje: clientTransakcje,
          zapisyNadchodzace: safeJsonParse(c.zapisyNadchodzace || c.zapisy_nadchodzace, []),
          zapisyPrzeszle: safeJsonParse(c.zapisyPrzeszle || c.zapisy_przeszle, []),
          zapisyWypisy: safeJsonParse(c.zapisyWypisy || c.zapisy_wypisy, []),
          historiaZawieszen: mergedHistoriaZawieszen
        };
      });
      
      const enriched = await Promise.all(enrichedPromises);
      setClients(enriched);

      setProfileClient((prevProfile: any) => {
        if (!prevProfile) return null;
        const currentActive = enriched.find((c: any) => String(c.id) === String(prevProfile.id));
        return currentActive || prevProfile;
      });
    }
  };

  useEffect(() => {
    loadData();

    const realtimeChannel = supabase
      .channel('realtime_klienci_zapisy_all_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zapisy_zajec' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automatyczne_zapisy' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grafik_zajec' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nadpisania_zajec' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zajecia_jednorazowe' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'klienci' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transakcje' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, []);

  const openProfile = async (clientToOpen: any) => {
    setProfileClient(clientToOpen);
  };

  const handleToggleClientTrainer = async (client: any) => {
    if (!client.isTrainer) {
      const { error } = await supabase.from('trenerzy').insert([{
        imie_nazwisko: `${client.firstName} ${client.lastName}`,
        email: client.email,
        telefon: client.phone
      }]);
      if (error) {
        alert("Błąd przypisywania do zespołu: " + error.message);
        return;
      }
    } else {
      if (client.email) {
        await supabase.from('trenerzy').delete().eq('email', client.email);
      }
    }
    loadData();
  };

  const handleSaveDiscount = async () => {
    if (!profileClient) return;
    
    const updatedClient = { ...profileClient, discount: discountInput };
    const { error } = await supabase.from('klienci').update({ discount: discountInput }).eq('id', profileClient.id);
    
    if (error) {
      alert(`Błąd zapisu rabatu w bazie: ${error.message}`);
      return;
    }
    
    setProfileClient(updatedClient);
    setClients(prev => prev.map(c => c.id === profileClient.id ? updatedClient : c));
    setIsEditingDiscount(false);
  };

  const handleSaveSystemDiscount = async () => {
    if (!profileClient) return;
    const targetVal = parseFloat(systemDiscountInput) || 0;
    
    const fakeClient = {...profileClient};
    fakeClient.hasLostContinuity = false;
    const std = calculateStandardSystemDiscount(fakeClient);
    
    const newOffset = targetVal - std;

    const updatedClient = { 
        ...profileClient, 
        rabat: targetVal,
        systemDiscountOffset: newOffset, 
        hasLostContinuity: false 
    };
    
    const { error } = await supabase.from('klienci').update({ 
        rabat: targetVal,
        system_discount_offset: newOffset, 
        hasLostContinuity: false 
    }).eq('id', profileClient.id);
    
    if (error) {
      alert(`Błąd zapisu rabatu za ciągłość: ${error.message}`);
      return;
    }
    
    setProfileClient(updatedClient);
    setClients(prev => prev.map(c => c.id === profileClient.id ? updatedClient : c));
    setIsEditingSystemDiscount(false);
  };

  const handleAddClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let poczatkoweKarnety: any[] = [];
    let cenaKarnetu = '0.00 PLN';
    let cenaWartosc = 0;
    let dataWygasnieciaStr: string | null = null;

    if (newClient.selectedPass) {
      const defKarnetu = dostepneKarnety.find(k => k.nazwa === newClient.selectedPass);
      const isContract = defKarnetu?.isContract12M || defKarnetu?.typ_karnetu === 'Umowa 12 miesięcy';
      const isTimeBased = defKarnetu?.typ_karnetu === 'Na czas';
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
      dataWygasnieciaStr = dataWygasniecia.toISOString().split('T')[0];

      if (isContract && newClient.customContractPrice && newClient.customContractPrice.trim() !== '') {
        cenaWartosc = parseFloat(newClient.customContractPrice.replace(/[^0-9.]/g, '')) || 0;
      } else {
        cenaWartosc = defKarnetu ? parseFloat(defKarnetu.cena) : 150;
      }
      cenaKarnetu = `${cenaWartosc.toFixed(2)} PLN`;

      let metaDef: Record<string, any> = {};
      try { metaDef = JSON.parse(defKarnetu?.inne_ustawienia || '{}'); } catch(e) {}
      const initialWejsciaVal = (isContract || isTimeBased) ? null : (defKarnetu ? (defKarnetu.ilosc_wejsc || metaDef.ilosc_wejsc || metaDef.iloscTreningow || null) : null);
      const parsedInitialWejscia = initialWejsciaVal !== null ? parseInt(initialWejsciaVal, 10) : null;

      poczatkoweKarnety.push({
        id: Date.now(),
        nazwa: newClient.selectedPass,
        waznyDo: dataWygasnieciaStr,
        cena: cenaKarnetu,
        znizkaProcentowa: '',
        rata: isContract ? (newClient.customRata || '0 / 12') : '1 / 1',
        statusTekst: isContract ? `Umowa 12M (Rata ${newClient.customRata || '0 / 12'})` : `Ważny do: ${dataWygasnieciaStr}`,
        isContract12M: isContract,
        contractSuspensionDaysLeft: isContract ? (parseInt(newClient.customSuspensionDays, 10) || 30) : undefined,
        blokadaDo: null,
        powodBlokady: null,
        zawieszonyOd: null,
        zawieszonyDo: null,
        historiaZawieszen: [],
        pozostaloWejsc: parsedInitialWejscia,
        poczatkoweWejsc: parsedInitialWejscia
      });
    }
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
        Wygasa: dataWygasnieciaStr,
        Portfel: poczatkowyStanStr,
        Zarejestrowany: newClient.registered,
        karnetyKlubowicza: poczatkoweKarnety
      }
    ]);

    if (!error && newClient.selectedPass) {
      await supabase.from('transakcje').insert([{
        klient_id: newClientId,
        typ_operacji: 'zakup_karnetu',
        kwota: -cenaWartosc,
        opis: `Pierwszy karnet: ${newClient.selectedPass} (Zadłużono portfel)`
      }]);
    }

    if (error) {
      alert("Wystąpił błąd podczas dodawania klienta: " + error.message);
    } else {
      setIsAddModalOpen(false);
      setNewClient({
        firstName: '', lastName: '', phone: '', email: '', price: '0.00 PLN', wallet: '0.00 PLN',
        registered: todayStr, selectedPass: '', isContractMigration: false, customRata: '0 / 12', customSuspensionDays: '30', customContractPrice: ''
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
    await supabase.from('klienci').update({ 
      Imię: profileClient.firstName, 
      Nazwisko: profileClient.lastName, 
      telefon: profileClient.phone, 
      email: profileClient.email, 
      płeć: profileClient.gender,
      Urodziny: profileClient.birthDate 
    }).eq('id', profileClient.id);
    setIsEditProfileInfoOpen(false);
    loadData();
  };

  const handleDeleteClient = async (id: number) => {
    if (confirm("Czy na pewno chcesz całkowicie usunąć to konto i wszystkie powiązane z nim logi operacji?")) {
      const { data: userSignups } = await supabase.from('zapisy_zajec').select('class_key').eq('klient_id', id);
      await supabase.from('zapisy_zajec').delete().eq('klient_id', id);
      if (userSignups) {
        for (const s of userSignups) {
          await promoteWaitlistForClass(s.class_key);
        }
      }
      await supabase.from('transakcje').delete().eq('klient_id', id);
      await supabase.from('automatyczne_zapisy').delete().eq('klient_id', id);
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

        setProfileClient((prev: any) => ({ ...prev, avatarUrl: compressedDataUrl }));
        setClients(prev => prev.map(c => c.id === profileClient.id ? { ...c, avatarUrl: compressedDataUrl } : c));

        const { error } = await supabase.from('klienci').update({ avatarUrl: compressedDataUrl }).eq('id', profileClient.id);
        
        if (error) {
            alert(`Błąd zapisu w bazie Supabase: ${error.message}`);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmExtendPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !extendPassTarget) return;

    const defKarnetu = dostepneKarnety.find(k => k.nazwa === extendSelectedNewPassName);
    const isContract = extendPassTarget.isContract12M || defKarnetu?.isContract12M || defKarnetu?.typ_karnetu === 'Umowa 12 miesięcy';
    const isTimeBased = defKarnetu?.typ_karnetu === 'Na czas';

    const activeDiscount = getEffectiveDiscount(profileClient, isContract);
    
    let bazowaCena = 0;
    if (extendCustomPriceInput && extendCustomPriceInput.trim() !== '') {
      bazowaCena = parseFloat(extendCustomPriceInput.replace(/[^0-9.]/g, '')) || 0;
    } else {
      bazowaCena = defKarnetu ? parseFloat(defKarnetu.cena) : parseFloat(String(extendPassTarget.cena).replace(/[^0-9.]/g, ''));
    }

    const cenaPoRabacie = isContract ? bazowaCena : bazowaCena * (1 - activeDiscount / 100);
    const nowaCena = `${cenaPoRabacie.toFixed(2)} PLN`;
    const kwotaKarnetu = cenaPoRabacie;

    const currentWalletNum = parseFloat(String(profileClient.wallet).replace(/[^0-9.-]+/g, "")) || 0;
    const nowyStanPortfela = currentWalletNum - kwotaKarnetu;
    const nowyStanStr = `${nowyStanPortfela.toFixed(2)} PLN`;

    let znizkaTekst = '';
    if (activeDiscount > 0 && !isContract) {
      znizkaTekst = `(-${activeDiscount}%)`;
    }

    let metaExt: Record<string, any> = {};
    try { metaExt = JSON.parse(defKarnetu?.inne_ustawienia || '{}'); } catch(e) {}
    const extWejsciaVal = (isContract || isTimeBased) ? null : (defKarnetu ? (defKarnetu.ilosc_wejsc || metaExt.ilosc_wejsc || metaExt.iloscTreningow || null) : null);
    const parsedExtWejscia = extWejsciaVal !== null ? parseInt(extWejsciaVal, 10) : null;

    const stareKarnety = safeJsonParse(profileClient.karnetyKlubowicza, []);
    const uaktualnioneKarnety = stareKarnety.map((k: any) => {
      if (k.id === extendPassTarget.id) {
        return {
          ...k,
          nazwa: extendSelectedNewPassName,
          waznyDo: extendNewDate,
          cena: nowaCena,
          znizkaProcentowa: znizkaTekst,
          statusTekst: isContract ? `Umowa 12M (${k.rata || '0 / 12'}) - Ważny do: ${extendNewDate}` : `Ważny do: ${extendNewDate}`,
          pozostaloWejsc: (isContract || isTimeBased) ? null : (parsedExtWejscia !== null ? parsedExtWejscia : k.pozostaloWejsc),
          poczatkoweWejsc: (isContract || isTimeBased) ? null : (parsedExtWejscia !== null ? parsedExtWejscia : k.poczatkoweWejsc)
        };
      }
      return k;
    });

    const latestExpiry = getLatestPassExpiry(uaktualnioneKarnety);

    await supabase.from('klienci').update({
      karnetyKlubowicza: uaktualnioneKarnety,
      Wygasa: latestExpiry,
      Cena: nowaCena,
      Portfel: nowyStanStr
    }).eq('id', profileClient.id);

    await supabase.from('transakcje').insert([{
      klient_id: profileClient.id,
      typ_operacji: 'zakup_karnetu',
      kwota: -kwotaKarnetu,
      opis: `Przedłużenie karnetu: ${extendSelectedNewPassName} do ${extendNewDate} ${znizkaTekst} (Obciążenie portfela)`
    }]);

    alert(`Karnet został przedłużony! Pobrano ${kwotaKarnetu.toFixed(2)} PLN z portfela.`);
    setIsExtendPassModalOpen(false);
    loadData();
  };

  const handleAddSecondPass = async (paymentMethod: 'paid' | 'later') => {
    if (!profileClient || !selectedPassToAdd) return;

    const defKarnetu = dostepneKarnety.find(k => k.nazwa === selectedPassToAdd);
    const isContract = defKarnetu?.isContract12M || defKarnetu?.typ_karnetu === 'Umowa 12 miesięcy';
    const isTimeBased = defKarnetu?.typ_karnetu === 'Na czas';
    
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
    
    const activeDiscount = getEffectiveDiscount(profileClient, isContract);
    
    let bazowaCena = 150.00;
    if (isContract && newPassCustomPrice && newPassCustomPrice.trim() !== '') {
      bazowaCena = parseFloat(newPassCustomPrice.replace(/[^0-9.]/g, '')) || 0;
    } else if (defKarnetu) {
      bazowaCena = parseFloat(defKarnetu.cena) || 0;
    }

    const kwotaKarnetu = isContract ? bazowaCena : bazowaCena * (1 - activeDiscount / 100);
    const cenaObjKarnetu = `${kwotaKarnetu.toFixed(2)} PLN`;

    let znizkaTekst = '';
    if (activeDiscount > 0 && !isContract) {
      znizkaTekst = `(-${activeDiscount}%)`;
    }

    let metaAdd: Record<string, any> = {};
    try { metaAdd = JSON.parse(defKarnetu?.inne_ustawienia || '{}'); } catch(e) {}
    const limitWejscBaza = (isContract || isTimeBased) ? null : (defKarnetu ? (defKarnetu.ilosc_wejsc || metaAdd.ilosc_wejsc || metaAdd.iloscTreningow || null) : null);
    const parsedLimitWejsc = limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : null;

    let nowyStanStr = profileClient.wallet;
    let logKwota = 0;
    let logOpis = `Dodano karnet: ${selectedPassToAdd} ${znizkaTekst} (Zapłacono z góry)`;

    if (paymentMethod === 'later') {
      const currentWalletNum = parseFloat(String(profileClient.wallet).replace(/[^0-9.-]+/g, "")) || 0;
      const nowyStanPortfela = currentWalletNum - kwotaKarnetu;
      nowyStanStr = `${nowyStanPortfela.toFixed(2)} PLN`;
      logKwota = -kwotaKarnetu;
      logOpis = `Dodano karnet: ${selectedPassToAdd} ${znizkaTekst} (Obciążenie portfela - do zapłaty)`;
    }

    const nowyKarnetObj = {
      id: Date.now(),
      nazwa: selectedPassToAdd,
      waznyDo: dataWygasnieciaStr,
      pozostaloWejsc: parsedLimitWejsc,
      poczatkoweWejsc: parsedLimitWejsc,
      cena: cenaObjKarnetu,
      znizkaProcentowa: znizkaTekst,
      rata: isContract ? (newPassCustomRata || '0 / 12') : '1 / 1',
      statusTekst: isContract ? `Umowa 12M (Rata ${newPassCustomRata || '0 / 12'})` : `Ważny do: ${dataWygasnieciaStr}`,
      isContract12M: isContract,
      contractSuspensionDaysLeft: isContract ? (parseInt(newPassCustomSuspensionDays, 10) || 30) : undefined,
      blokadaDo: null,
      powodBlokady: null,
      zawieszonyOd: null,
      zawieszonyDo: null,
      historiaZawieszen: []
    };
    const stareKarnety = safeJsonParse(profileClient.karnetyKlubowicza, []);
    const uaktualnioneKarnety = [...stareKarnety, nowyKarnetObj];
    const latestExpiry = getLatestPassExpiry(uaktualnioneKarnety);

    const { error } = await supabase.from('klienci').update({
      karnetyKlubowicza: uaktualnioneKarnety,
      Wygasa: latestExpiry,
      Cena: cenaObjKarnetu,
      Portfel: nowyStanStr
    }).eq('id', profileClient.id);

    if (error) {
      alert(`Błąd zapisu w bazie: ${error.message}`);
      return;
    }

    await supabase.from('transakcje').insert([{
      klient_id: profileClient.id,
      typ_operacji: 'zakup_karnetu',
      kwota: logKwota,
      opis: logOpis
    }]);

    setSelectedPassToAdd('');
    setNewPassCustomRata('0 / 12');
    setNewPassCustomSuspensionDays('30');
    setNewPassCustomPrice('');
    setIsAddSecondPassModalOpen(false);
    loadData();
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

    if (!confirm(`Czy na pewno chcesz zawiesić ten karnet od ${sOd} (planowo do ${sDo})? System automatycznie wypisze klubowicza z zajęć w tym okresie i zwróci wejścia.`)) return;

    const stareKarnety = safeJsonParse(profileClient.karnetyKlubowicza, []);
    const uaktualnioneKarnety = stareKarnety.map((k: any) => {
      if (k.id === suspendPassTarget.id) {
        return {
          ...k,
          zawieszonyOd: sOd,
          zawieszonyDo: sDo
        };
      }
      return k;
    });

    const { error } = await supabase.from('klienci').update({ karnetyKlubowicza: uaktualnioneKarnety }).eq('id', profileClient.id);
    
    if (!error) {
      await supabase.from('transakcje').insert([{
        klient_id: profileClient.id,
        typ_operacji: 'zawieszenie_karnetu',
        opis: `Zawieszono karnet ${suspendPassTarget.nazwa} w okresie ${sOd} - ${sDo} (Zarządca / Panel)`
      }]);
      await handleAutoWypiszPoZawieszeniu(profileClient.id, sOd, sDo, suspendPassTarget.nazwa);
      alert(`Karnet "${suspendPassTarget.nazwa}" został zawieszony.`);
      setIsSuspendModalOpen(false);
      loadData();
    } else {
      alert(`Błąd: ${error.message}`);
    }
  };

  const handleOdwiesKarnet = async (karnetTarget: any) => {
    if (!profileClient || !karnetTarget.zawieszonyOd) return;

    const dzisiaj = new Date();
    const start = new Date(karnetTarget.zawieszonyOd);
    dzisiaj.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    let diffDays = Math.floor((dzisiaj.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) diffDays = 0;

    if (!confirm(`Karnet był zawieszony od ${karnetTarget.zawieszonyOd} (łącznie ${diffDays} dni). \nCzy na pewno chcesz go odwiesić i przedłużyć jego ważność o ${diffDays} dni?`)) return;

    let currentExpDate = new Date(karnetTarget.waznyDo || new Date());
    currentExpDate.setDate(currentExpDate.getDate() + diffDays);
    const newExpDateStr = currentExpDate.toISOString().split('T')[0];

    let updatedSuspensionDaysLeft = karnetTarget.contractSuspensionDaysLeft;
    if (karnetTarget.isContract12M) {
      const currentPool = karnetTarget.contractSuspensionDaysLeft !== undefined ? karnetTarget.contractSuspensionDaysLeft : 30;
      updatedSuspensionDaysLeft = Math.max(0, currentPool - diffDays);
    }

    const historiaEntry = {
      id: Date.now(),
      od: karnetTarget.zawieszonyOd,
      do: todayStr,
      dni: diffDays,
      kto: 'Zarządca (Panel Klienci)'
    };

    const stareKarnety = safeJsonParse(profileClient.karnetyKlubowicza, []);
    const uaktualnioneKarnety = stareKarnety.map((k: any) => {
      if (k.id === karnetTarget.id) {
        const passHist = safeJsonParse(k.historiaZawieszen, []);
        return {
          ...k,
          waznyDo: newExpDateStr,
          statusTekst: k.isContract12M ? `Umowa 12M (${k.rata || '0 / 12'}) - Ważny do: ${newExpDateStr}` : `Ważny do: ${newExpDateStr}`,
          zawieszonyOd: null,
          zawieszonyDo: null,
          contractSuspensionDaysLeft: updatedSuspensionDaysLeft,
          historiaZawieszen: [historiaEntry, ...passHist]
        };
      }
      return k;
    });

    const latestExpiry = getLatestPassExpiry(uaktualnioneKarnety);

    const { error } = await supabase.from('klienci').update({ 
      karnetyKlubowicza: uaktualnioneKarnety,
      Wygasa: latestExpiry 
    }).eq('id', profileClient.id);

    if (!error) {
      await supabase.from('transakcje').insert([{
        klient_id: profileClient.id,
        typ_operacji: 'odwieszenie_karnetu',
        opis: `Odwieszono karnet ${karnetTarget.nazwa}. Przedłużono o ${diffDays} dni do ${newExpDateStr}.`
      }]);
      alert(`Karnet został odwieszony! Ważność została przedłużona o ${diffDays} dni. Nowa data to ${newExpDateStr}.`);
      setIsSuspendModalOpen(false);
      loadData();
    } else {
      alert(`Błąd: ${error.message}`);
    }
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
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + dni);
      bDo = endDate.toISOString().split('T')[0];
    }

    if (new Date(bDo) < new Date(bOd)) {
      alert("Data końcowa blokady musi być późniejsza lub równa dacie początkowej!");
      return;
    }

    if (!confirm(`Czy na pewno chcesz zablokować ten karnet w okresie ${bOd} - ${bDo}? Użytkownik zostanie automatycznie wypisany z nadchodzących zajęć.`)) return;

    const powod = `Zablokowano w okresie ${bOd} - ${bDo}`;

    const stareKarnety = safeJsonParse(profileClient.karnetyKlubowicza, []);
    const uaktualnioneKarnety = stareKarnety.map((k: any) => {
      if (k.id === suspendPassTarget.id) {
        return { 
          ...k, 
          blokadaOd: bOd, 
          blokadaDo: bDo, 
          powodBlokady: powod 
        };
      }
      return k;
    });

    const { error } = await supabase.from('klienci').update({ 
      karnetyKlubowicza: uaktualnioneKarnety,
      blokadaDo: bDo,
      powodBlokady: powod
    }).eq('id', profileClient.id);
    
    if (!error) {
      setClients(prev => prev.map(c => c.id === profileClient.id ? { ...c, blokadaDo: bDo, powodBlokady: powod, karnetyKlubowicza: uaktualnioneKarnety } : c));
      setProfileClient((prev: any) => ({ ...prev, blokadaDo: bDo, powodBlokady: powod, karnetyKlubowicza: uaktualnioneKarnety }));
      await handleAutoWypiszPoZablokowaniu(profileClient.id, profileClient, powod);
      alert(`Karnet został zablokowany do ${bDo}.`);
      setIsSuspendModalOpen(false);
      loadData();
    } else {
      alert(`Błąd: ${error.message}`);
    }
  };

  const handleCancelBlock = async (karnetTarget: any) => {
    if (!profileClient) return;
    if (!confirm("Czy na pewno chcesz usunąć blokadę tego karnetu i konta?")) return;

    const stareKarnety = safeJsonParse(profileClient.karnetyKlubowicza, []);
    const uaktualnioneKarnety = stareKarnety.map((k: any) => {
      if (k.id === karnetTarget.id || k.blokadaDo) {
        return { ...k, blokadaOd: null, blokadaDo: null, powodBlokady: null };
      }
      return k;
    });

    const { error } = await supabase.from('klienci').update({ 
      karnetyKlubowicza: uaktualnioneKarnety,
      blokadaDo: null,
      powodBlokady: null
    }).eq('id', profileClient.id);

    if (!error) {
      setClients(prev => prev.map(c => c.id === profileClient.id ? { ...c, blokadaDo: null, powodBlokady: null, karnetyKlubowicza: uaktualnioneKarnety } : c));
      setProfileClient((prev: any) => ({ ...prev, blokadaDo: null, powodBlokady: null, karnetyKlubowicza: uaktualnioneKarnety }));
      alert("Blokada konta i karnetu została całkowicie odwołana.");
      setIsSuspendModalOpen(false);
      loadData();
    } else {
      alert(`Błąd podczas odwoływania blokady: ${error.message}`);
    }
  };

  const handleSavePassEditSubmit = async () => {
    if (!profileClient || !editingPassModal) return;

    if (!confirm("Czy na pewno chcesz zapisać zmiany w karnecie?")) return;

    const bazowyKarnet = dostepneKarnety.find(k => k.nazwa === editingPassModal.nazwa);
    const isContract = editingPassModal.isContract12M || bazowyKarnet?.isContract12M || bazowyKarnet?.typ_karnetu === 'Umowa 12 miesięcy';
    const isTimeBased = bazowyKarnet?.typ_karnetu === 'Na czas';
    const activeRabat = getEffectiveDiscount(profileClient, isContract);
    const cenaRegularna = bazowyKarnet ? (parseFloat(bazowyKarnet.cena) * (1 - activeRabat / 100)) : null;
    const nowaCenaWartosc = parseFloat(String(editingPassModal.cena).replace(/[^0-9.]/g, '')) || 0;

    let znizkaTekst = profileClient.discount ? `(-${profileClient.discount}%)` : '';
    if (!isContract && !profileClient.discount && cenaRegularna && cenaRegularna > 0 && nowaCenaWartosc < cenaRegularna) {
      const roznica = cenaRegularna - nowaCenaWartosc;
      const procent = Math.round((roznica / cenaRegularna) * 100);
      znizkaTekst = `(-${procent}%)`;
    }

    const stareKarnety = safeJsonParse(profileClient.karnetyKlubowicza, []);
    const uaktualnioneKarnety = stareKarnety.map((k: any) => {
      if (k.id === editingPassModal.id) {
        return {
          ...k,
          nazwa: editingPassModal.nazwa,
          waznyDo: editingPassModal.waznyDo,
          pozostaloWejsc: (isContract || isTimeBased) ? null : editingPassModal.pozostaloWejsc,
          cena: String(editingPassModal.cena).includes('PLN') ? editingPassModal.cena : `${editingPassModal.cena} PLN`,
          znizkaProcentowa: isContract ? '' : znizkaTekst,
          rata: isContract ? editingPassModal.rata : (editingPassModal.rata || '1 / 1'),
          isContract12M: isContract,
          contractSuspensionDaysLeft: isContract ? (editingPassModal.contractSuspensionDaysLeft !== undefined ? editingPassModal.contractSuspensionDaysLeft : 30) : undefined,
          statusTekst: isContract ? `Umowa 12M (${editingPassModal.rata || '0 / 12'}) - Ważny do: ${editingPassModal.waznyDo}` : `Ważny do: ${editingPassModal.waznyDo}`
        };
      }
      return k;
    });

    const latestExpiry = getLatestPassExpiry(uaktualnioneKarnety);
    const passPrice = getPassPrice(uaktualnioneKarnety);

    await supabase.from('klienci').update({ 
      karnetyKlubowicza: uaktualnioneKarnety,
      Wygasa: latestExpiry,
      Cena: passPrice
    }).eq('id', profileClient.id);

    await supabase.from('transakcje').insert([{
      klient_id: profileClient.id,
      typ_operacji: 'edycja_karnetu',
      kwota: null,
      opis: `Ręczna modyfikacja ustawień karnetu: ${editingPassModal.nazwa}${isContract ? ` (Cena: ${editingPassModal.cena}, Rata: ${editingPassModal.rata})` : ''}`
    }]);

    setEditingPassModal(null);
    alert("Karnet został zaktualizowany!");
    loadData();
  };

  const handleConfirmDeletePass = async (passId: number) => {
    if (confirm("Czy na pewno chcesz usunąć ten karnet? Klient zostanie automatycznie wypisany ze wszystkich przyszłych zajęć.")) {
      if (!profileClient) return;

      const now = new Date();
      let cancelledCount = 0;

      const { data: userSignups } = await supabase
        .from('zapisy_zajec')
        .select('*')
        .eq('klient_id', profileClient.id);

      if (userSignups && userSignups.length > 0) {
        for (const signup of userSignups) {
          const parts = (signup.class_key || '').split('_');
          const dateStr = parts[1];
          if (dateStr) {
            const classTimeMs = parseClassDate(dateStr);
            if (classTimeMs && classTimeMs > now.getTime()) {
              await supabase
                .from('zapisy_zajec')
                .delete()
                .eq('class_key', signup.class_key)
                .eq('klient_id', profileClient.id);
              cancelledCount++;

              await promoteWaitlistForClass(signup.class_key);
            }
          }
        }
      }

      const stareKarnety = safeJsonParse(profileClient.karnetyKlubowicza, []);
      const uaktualnioneKarnety = stareKarnety.filter((k: any) => k.id !== passId);
      const latestExpiry = getLatestPassExpiry(uaktualnioneKarnety);
      const newCena = getPassPrice(uaktualnioneKarnety);
      
      await supabase.from('klienci').update({ 
        karnetyKlubowicza: uaktualnioneKarnety,
        Wygasa: latestExpiry,
        Cena: newCena
      }).eq('id', profileClient.id);
      
      if (cancelledCount > 0) {
        await supabase.from('transakcje').insert([{
          klient_id: profileClient.id,
          typ_operacji: 'zajecia_wypis',
          opis: `Automatycznie wypisano z ${cancelledCount} przyszłych zajęć z powodu usunięcia karnetu.`
        }]);
      }

      await supabase.from('transakcje').insert([{
        klient_id: profileClient.id,
        typ_operacji: 'edycja_karnetu',
        kwota: null,
        opis: `Ręczne usunięcie karnetu z profilu`
      }]);

      setEditingPassModal(null);
      setIsGlobalPassMenuOpen(false);
      alert(cancelledCount > 0 ? `Karnet usunięty. Wypisano z ${cancelledCount} przyszłych zajęć.` : "Karnet został usunięty!");
      loadData();
    }
  };

  const handleTopUpWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !walletAmountInput) return;

    const kwotaZmiany = parseFloat(walletAmountInput);
    if (isNaN(kwotaZmiany)) return;

    const currentWalletNum = parseFloat(String(profileClient.wallet).replace(/[^0-9.-]+/g, "")) || 0;
    const nowyStan = currentWalletNum + kwotaZmiany;
    const nowyStanStr = `${nowyStan.toFixed(2)} PLN`;

    await supabase.from('transakcje').insert([{
      klient_id: profileClient.id,
      typ_operacji: 'portfel',
      kwota: kwotaZmiany,
      opis: walletReasonInput || (kwotaZmiany >= 0 ? 'Doładowanie portfela' : 'Korekta / Odpis z portfela')
    }]);

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

  // LOGIKA SORTOWANIA GŁÓWNEJ TABELI KLIENTÓW
  const sortedClients = [...filteredClients].sort((a, b) => {
    // Domyślne sortowanie: najszybciej wygasające karnety na samej górze, brak karnetów na samym dole
    if (!sortField) {
      const expA = a.expiresDate || a.Wygasa || a.karnetyKlubowicza?.[0]?.waznyDo || '';
      const expB = b.expiresDate || b.Wygasa || b.karnetyKlubowicza?.[0]?.waznyDo || '';

      const hasPassA = Boolean(expA && a.karnetyKlubowicza && a.karnetyKlubowicza.length > 0);
      const hasPassB = Boolean(expB && b.karnetyKlubowicza && b.karnetyKlubowicza.length > 0);

      if (hasPassA && !hasPassB) return -1;
      if (!hasPassA && hasPassB) return 1;
      if (!hasPassA && !hasPassB) return (a.lastName || '').localeCompare(b.lastName || '');

      return expA.localeCompare(expB);
    }
    
    let valA: any = '';
    let valB: any = '';

    if (sortField === 'firstName') { valA = a.firstName || ''; valB = b.firstName || ''; }
    else if (sortField === 'lastName') { valA = a.lastName || ''; valB = b.lastName || ''; }
    else if (sortField === 'registered') { valA = a.registered || ''; valB = b.registered || ''; }
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
      const expA = a.expiresDate || a.Wygasa || a.karnetyKlubowicza?.[0]?.waznyDo || '';
      const expB = b.expiresDate || b.Wygasa || b.karnetyKlubowicza?.[0]?.waznyDo || '';
      const hasPassA = Boolean(expA && a.karnetyKlubowicza && a.karnetyKlubowicza.length > 0);
      const hasPassB = Boolean(expB && b.karnetyKlubowicza && b.karnetyKlubowicza.length > 0);

      if (hasPassA && !hasPassB) return -1;
      if (!hasPassA && hasPassB) return 1;
      if (!hasPassA && !hasPassB) return 0;

      return sortDirection === 'asc' ? expA.localeCompare(expB) : expB.localeCompare(expA);
    }
    else if (sortField === 'wallet') { 
      valA = parseFloat(String(a.wallet).replace(/[^0-9.-]+/g, "")) || 0; 
      valB = parseFloat(String(b.wallet).replace(/[^0-9.-]+/g, "")) || 0; 
      return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    }
    else if (sortField === 'birthDate') { valA = a.birthDate || ''; valB = b.birthDate || ''; }

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return 0;
  });

  const klienciTrenerzyList = clients.filter(c => c.isTrainer);
  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 overflow-x-hidden font-sans antialiased text-slate-800">
      
      {/* Pasek Nagłówka */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-sky-200 pb-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
          👥 Klienci
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-sm transition-all text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap">
            + DODAJ KLUBOWICZA
          </button>
          <button className="p-2 bg-white border border-sky-200 text-slate-700 rounded-xl hover:bg-sky-50 shadow-sm transition-all cursor-pointer" title="Ustawienia tabeli">⚙️</button>
          <button className="p-2 bg-white border border-sky-200 text-slate-700 rounded-xl hover:bg-sky-50 shadow-sm transition-all cursor-pointer" title="Eksportuj">📥</button>
        </div>
      </div>

      {/* PANEL NAD TABELĄ: KLIENT = TRENER */}
      <div className="bg-gradient-to-r from-sky-900 to-slate-900 border border-sky-700/40 rounded-2xl p-4 sm:p-5 shadow-lg text-white space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">Klubowicze pełniący funkcję Trenerów</h3>
          </div>
          <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
            {klienciTrenerzyList.length} przypisanych
          </span>
        </div>
        <p className="text-xs text-sky-200">
          Poniżej znajdują się klienci, którzy są powiązani z kontem trenera w zespole. Możesz zarządzać ich powiązaniami bezpośrednio z ich profilu.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          {klienciTrenerzyList.length > 0 ? (
            klienciTrenerzyList.map(t => (
              <div 
                key={t.id} 
                onClick={() => openProfile(t)}
                className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-all shadow-sm"
              >
                <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs">
                  {t.firstName?.[0]}{t.lastName?.[0]}
                </div>
                <div className="text-xs">
                  <div className="font-bold text-white whitespace-nowrap">{t.firstName} {t.lastName}</div>
                  <div className="text-[10px] text-amber-300 whitespace-nowrap">Trener w zespole</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-sky-300 italic py-2">
              Brak klientów przypisanych jako trenerzy. Aby przypisać klienta jako trenera, wejdź w jego profil i kliknij opcję powiązania.
            </div>
          )}
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
          <button className="px-4 py-2.5 bg-rose-800 hover:bg-rose-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 shadow-sm transition-all cursor-pointer whitespace-nowrap">
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
                <th className="py-3 px-3 text-center w-10 whitespace-nowrap"><input type="checkbox" className="rounded border-sky-300" /></th>
                <th onClick={() => handleSort('firstName')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors whitespace-nowrap">Imię {sortField === 'firstName' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('lastName')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors whitespace-nowrap">Nazwisko {sortField === 'lastName' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('registered')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors whitespace-nowrap">Dołączył {sortField === 'registered' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('email')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors whitespace-nowrap">Email {sortField === 'email' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('phone')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors whitespace-nowrap">Telefon {sortField === 'phone' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('pass')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors whitespace-nowrap">Karnet {sortField === 'pass' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('price')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors whitespace-nowrap">Cena {sortField === 'price' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('expiresDate')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors whitespace-nowrap">Wygasa {sortField === 'expiresDate' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('wallet')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors whitespace-nowrap">Portfel {sortField === 'wallet' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th onClick={() => handleSort('birthDate')} className="py-3 px-3 font-bold cursor-pointer hover:bg-sky-100/60 transition-colors whitespace-nowrap">Urodziny {sortField === 'birthDate' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</th>
                <th className="py-3 px-3 text-right font-bold w-20 whitespace-nowrap">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedClients.map((client) => {
                const negativeW = isWalletNegative(client.wallet);
                const aktywnyKarnetZawieszony = (client.karnetyKlubowicza || []).find((k: any) => k.zawieszonyOd && k.zawieszonyDo && k.zawieszonyDo >= todayStr);
                const aktywnaBlokada = (client.karnetyKlubowicza || []).find((k: any) => k.blokadaDo && k.blokadaDo >= todayStr) || (client.blokadaDo && client.blokadaDo >= todayStr);
                const maKarnet = client.karnetyKlubowicza && client.karnetyKlubowicza.length > 0;
                const nazwaKarnetu = maKarnet ? client.karnetyKlubowicza.map((k: any) => k.nazwa).join(', ') : '';
                const dataWygasnieciaKarnetu = maKarnet ? client.karnetyKlubowicza[0].waznyDo : '-';

                // WERYFIKACJA 5 DNI DO WYGAŚNIĘCIA
                const daysUntilExp = getDaysUntilExpiry(dataWygasnieciaKarnetu);
                const isPassExpiringSoon = maKarnet && daysUntilExp !== null && daysUntilExp <= 5;

                return (
                  <tr key={client.id} className="hover:bg-sky-50/40 transition-colors">
                    <td className="py-3.5 px-3 text-center whitespace-nowrap"><input type="checkbox" className="rounded border-sky-300" /></td>
                    <td className="py-3.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {client.firstName}
                        {client.isTrainer && <span className="text-[10px]" title="Trener w zespole">⭐</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-bold text-slate-900 whitespace-nowrap">{client.lastName}</td>
                    <td className="py-3.5 px-3 font-mono text-slate-500 whitespace-nowrap">{client.registered}</td>
                    <td onClick={() => openProfile(client)} className="py-3.5 px-3 text-sky-700 font-medium hover:underline cursor-pointer whitespace-nowrap">{client.email || '-'}</td>
                    <td className="py-3.5 px-3 font-mono text-slate-600 whitespace-nowrap">{client.phone || '-'}</td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800">{nazwaKarnetu}</span>
                          {client.karnetyKlubowicza?.[0]?.isContract12M && (
                            <span className="bg-amber-100 text-amber-900 text-[9px] font-black px-2 py-0.5 rounded border border-amber-300 uppercase">
                              12M • Rata {client.karnetyKlubowicza[0].rata || '0/12'}
                            </span>
                          )}
                        </div>
                        {aktywnyKarnetZawieszony && (
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded border border-amber-200 inline-block w-fit whitespace-nowrap">
                            ⏸️ Zawieszony: od {aktywnyKarnetZawieszony.zawieszonyOd} do {aktywnyKarnetZawieszony.zawieszonyDo}
                          </span>
                        )}
                        {aktywnaBlokada && (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded border border-rose-200 inline-block w-fit whitespace-nowrap">
                            ⚠️ Zablokowane: {client.blokadaDo || (client.karnetyKlubowicza && client.karnetyKlubowicza[0]?.blokadaDo)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-medium text-slate-800 whitespace-nowrap">{client.price}</td>
                    <td className="py-3.5 px-3 font-mono whitespace-nowrap">
                      {maKarnet && dataWygasnieciaKarnetu !== '-' ? (
                        isPassExpiringSoon ? (
                          <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-lg border border-rose-300 inline-block shadow-sm">
                            {dataWygasnieciaKarnetu}
                          </span>
                        ) : (
                          <span className="text-slate-700 font-medium">
                            {dataWygasnieciaKarnetu}
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-bold whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-lg text-xs whitespace-nowrap ${negativeW ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                        {client.wallet}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono text-slate-500 whitespace-nowrap">{client.birthDate || 'Nie podano'}</td>
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openProfile(client)} className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-lg border border-sky-200 cursor-pointer" title="Otwórz profil">👤</button>
                        <button onClick={() => setTableActionClient(client)} className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 cursor-pointer" title="Zarządzaj klubowiczem">✏️</button>
                        <button onClick={() => handleDeleteClient(client.id)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-sky-200 cursor-pointer" title="Usuń">🗑️</button>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold text-slate-700 text-center">
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
              <div className="flex justify-between items-center text-xs flex-wrap gap-2">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{tableActionClient.karnetyKlubowicza && tableActionClient.karnetyKlubowicza.length > 0 ? tableActionClient.karnetyKlubowicza.map((k:any)=>k.nazwa).join(', ') : 'Brak karnetu'}</div>
                <div className="bg-slate-100 px-3 py-1 rounded-xl text-slate-700 font-semibold whitespace-nowrap">
                  <div>Ważny do: {tableActionClient.karnetyKlubowicza && tableActionClient.karnetyKlubowicza.length > 0 ? tableActionClient.karnetyKlubowicza[0].waznyDo : '-'}</div>
                  <div className="text-[10px] text-slate-500">Cena: {tableActionClient.price || '0.00 PLN'}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-bold text-slate-700 text-center">
                <button onClick={() => { 
                  openProfile(tableActionClient); 
                  if(tableActionClient.karnetyKlubowicza?.length > 0) {
                    setExtendPassTarget(tableActionClient.karnetyKlubowicza[0]);
                    setExtendSelectedNewPassName(tableActionClient.karnetyKlubowicza[0].nazwa);
                    setExtendCustomPriceInput(tableActionClient.karnetyKlubowicza[0].cena ? tableActionClient.karnetyKlubowicza[0].cena.replace(/[^0-9.]/g, '') : '');
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-bold text-rose-800 text-center">
                <button onClick={handleDeactivateClient} className="p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">🔒</span> Dezaktywuj
                </button>
                <button onClick={handleDeactivateClientOnDate} className="p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">🔒</span> Dezaktywuj w dniu
                </button>
                <button onClick={() => handleDeleteClient(tableActionClient.id)} className="p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">🗑️</span> Usuń konto
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL PROFILU KLIENTA */}
      {profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-end backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col overflow-y-auto overflow-x-hidden">
            
            {/* Sticky Header profilu */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 bg-white sticky top-0 z-20">
              <button onClick={() => setProfileClient(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer">✕</button>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsWalletHistoryOpen(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer whitespace-nowrap">🕒 LOGI UŻYTKOWNIKA</button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 flex-1">
              
              {/* KARTA PROFILOWA */}
              <div className="flex flex-col-reverse sm:flex-row justify-between items-start sm:items-center gap-6 bg-slate-50/70 border border-slate-200 rounded-2xl p-4 sm:p-6 w-full">
                <div className="space-y-3 flex-1 min-w-0 w-full">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 truncate">{profileClient.firstName} {profileClient.lastName}</h2>
                    <button 
                      onClick={() => setIsEditProfileInfoOpen(true)}
                      className="w-8 h-8 bg-white hover:bg-sky-50 text-slate-700 rounded-xl border border-slate-200 flex items-center justify-center text-xs shadow-sm cursor-pointer transition-all shrink-0"
                      title="Edytuj dane konta"
                    >
                      ✏️
                    </button>
                  </div>

                  <div className="pt-1">
                    <button 
                      onClick={() => handleToggleClientTrainer(profileClient)}
                      className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-2 max-w-full text-left ${
                        profileClient.isTrainer 
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200' 
                          : 'bg-sky-100 text-sky-900 border border-sky-300 hover:bg-sky-200'
                      }`}
                    >
                      <span className="truncate">{profileClient.isTrainer ? '⭐ Trener w zespole (Usuń)' : '➕ Oznacz jako Trener w zespole'}</span>
                    </button>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1.5 pt-2">
                    <div><span className="font-semibold">Telefon:</span> <span className="font-mono text-slate-800">{profileClient.phone ? profileClient.phone : 'Nie podano'}</span></div>
                    <div className="break-all"><span className="font-semibold">Email:</span> <span className="text-slate-800">{profileClient.email ? profileClient.email : 'Nie podano'}</span></div>
                    <div><span className="font-semibold">Płeć:</span> <span className="text-slate-800">{profileClient.gender ? profileClient.gender : 'Nie podano'}</span></div>
                    <div><span className="font-semibold">Urodziny:</span> <span className="font-mono text-slate-800">{profileClient.birthDate ? profileClient.birthDate : 'Nie podano'}</span></div>
                  </div>
                </div>

                {/* Avatar */}
                <div className="flex flex-col items-center gap-2 shrink-0 self-center sm:self-auto">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-900 text-white font-black flex items-center justify-center text-3xl overflow-hidden border-2 border-sky-300 shadow-md">
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

              {/* SEKCJA KARNETÓW & RABATÓW */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <h3 className="font-black text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">Karnety klubowicza</h3>
                    
                    {/* STAŁY RABAT */}
                    <div className="flex items-center gap-2 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                       <span className="text-[10px] font-bold text-emerald-800 uppercase whitespace-nowrap">Stały rabat:</span>
                       {isEditingDiscount ? (
                         <div className="flex items-center gap-1">
                           <input 
                             type="number" 
                             className="w-12 bg-white border border-emerald-300 rounded px-1 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                             value={discountInput}
                             onChange={e => setDiscountInput(e.target.value)}
                             placeholder="%"
                           />
                           <span className="text-[10px] font-bold text-emerald-800">%</span>
                           <button onClick={handleSaveDiscount} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer">OK</button>
                           <button onClick={() => setIsEditingDiscount(false)} className="text-emerald-700 hover:text-emerald-900 text-[10px] font-bold cursor-pointer">✕</button>
                         </div>
                       ) : (
                         <div className="flex items-center gap-1.5 cursor-pointer group" onClick={() => { setDiscountInput(profileClient.discount || ''); setIsEditingDiscount(true); }}>
                           <span className="font-black text-emerald-700 text-xs">{profileClient.discount && profileClient.discount !== '0' ? `${profileClient.discount}%` : 'Brak'}</span>
                           <span className="opacity-40 group-hover:opacity-100 text-xs transition-opacity">✏️</span>
                         </div>
                       )}
                    </div>

                    {/* RABAT SYSTEMOWY */}
                    <div className="flex items-center gap-2 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200" title="Rabat za ciągłość zakupów">
                       <span className="text-[10px] font-bold text-sky-800 uppercase whitespace-nowrap">Rabat za ciągłość:</span>
                       {isEditingSystemDiscount ? (
                         <div className="flex items-center gap-1">
                           <input 
                             type="number" 
                             className="w-12 bg-white border border-sky-300 rounded px-1 text-xs font-bold text-slate-800 outline-none focus:border-sky-500"
                             value={systemDiscountInput}
                             onChange={e => setSystemDiscountInput(e.target.value)}
                             placeholder="%"
                           />
                           <span className="text-[10px] font-bold text-sky-800">%</span>
                           <button onClick={handleSaveSystemDiscount} className="bg-sky-600 hover:bg-sky-700 text-white text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer">OK</button>
                           <button onClick={() => setIsEditingSystemDiscount(false)} className="text-sky-700 hover:text-sky-900 text-[10px] font-bold cursor-pointer">✕</button>
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
                      onClick={() => { setSelectedPassToAdd(dostepneKarnety[0]?.nazwa || ''); setNewPassCustomPrice(''); setIsAddSecondPassModalOpen(true); }} 
                      className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm whitespace-nowrap"
                    >
                      + DODAJ DRUGI KARNET
                    </button>

                    <div className="relative">
                      <button 
                        onClick={() => setIsGlobalPassMenuOpen(!isGlobalPassMenuOpen)} 
                        className="w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 flex items-center justify-center font-bold cursor-pointer shadow-sm"
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
                              setExtendCustomPriceInput(profileClient.karnetyKlubowicza[0].cena ? profileClient.karnetyKlubowicza[0].cena.replace(/[^0-9.]/g, '') : '');
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
                          <div className="border-t border-slate-100 my-1"></div>
                          <button onClick={() => { if(profileClient.karnetyKlubowicza?.length > 0) handleConfirmDeletePass(profileClient.karnetyKlubowicza[0].id); setIsGlobalPassMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2.5 cursor-pointer whitespace-nowrap">🗑️ Usuń karnet</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lista karnetów w profilu */}
                <div className="space-y-3">
                  {profileClient.karnetyKlubowicza && profileClient.karnetyKlubowicza.length > 0 ? (
                    [...profileClient.karnetyKlubowicza]
                      .sort((a: any, b: any) => (a.waznyDo || '9999-12-31').localeCompare(b.waznyDo || '9999-12-31'))
                      .map((karnet: any) => {
                      
                      let isExpiring = false;
                      let isPending = karnet.statusTekst?.includes('Oczekujący');
                      const czyZawieszony = !!karnet.zawieszonyOd;
                      const isContract = karnet.isContract12M;

                      if (!isPending) {
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

                      let statusColorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                      if (isPending) statusColorClass = 'bg-amber-100 text-amber-800 border-amber-200';
                      else if (isExpiring) statusColorClass = 'bg-rose-100 text-rose-800 border-rose-200';

                      return (
                        <div key={karnet.id} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-2 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-black text-slate-900 text-base">{karnet.nazwa}</h4>
                                {isContract && (
                                  <span className="bg-amber-500/20 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded border border-amber-300 uppercase">
                                    Umowa 12M • Rata {karnet.rata || '0/12'}
                                  </span>
                                )}
                                {karnet.blokadaDo && karnet.blokadaDo >= todayStr && (
                                  <span className="bg-rose-100 text-rose-800 text-xs font-black px-2 py-0.5 rounded border border-rose-200">
                                    ⚠️ Zablokowane do {karnet.blokadaDo}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`${statusColorClass} text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap`}>
                                  {karnet.statusTekst || `Ważny do: ${karnet.waznyDo}`}
                                </span>
                                <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
                                  Cena: {karnet.cena} {karnet.znizkaProcentowa || ''}
                                </span>
                                {isContract && (
                                  <span className="bg-sky-50 text-sky-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-sky-200">
                                    Pula: {karnet.contractSuspensionDaysLeft ?? 30} dni
                                  </span>
                                )}
                                {karnet.pozostaloWejsc !== null && karnet.pozostaloWejsc !== undefined && (
                                  <span className="bg-sky-100 text-sky-900 text-[11px] font-black px-2 py-0.5 rounded-full border border-sky-200 flex items-center gap-1">
                                    <span>🎟️ Wejścia:</span> 
                                    <span className="text-amber-700">{karnet.pozostaloWejsc}</span> / <span>{karnet.poczatkoweWejsc || karnet.pozostaloWejsc}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                              {czyZawieszony ? (
                                <button 
                                  onClick={() => handleOdwiesKarnet(karnet)}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-200 cursor-pointer shadow-sm whitespace-nowrap"
                                >
                                  ▶️ ODWIEŚ
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
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-800 px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-200 cursor-pointer shadow-sm"
                                >
                                  ⚙️ STATUS
                                </button>
                              )}
                              <button 
                                onClick={() => {
                                  setExtendPassTarget(karnet);
                                  setExtendSelectedNewPassName(karnet.nazwa);
                                  setExtendCustomPriceInput(karnet.cena ? karnet.cena.replace(/[^0-9.]/g, '') : '');
                                  const curDate = new Date(karnet.waznyDo || Date.now());
                                  curDate.setMonth(curDate.getMonth() + 1);
                                  setExtendNewDate(curDate.toISOString().split('T')[0]);
                                  setIsExtendPassModalOpen(true);
                                }}
                                className="bg-sky-50 hover:bg-sky-100 text-sky-800 px-3 py-1.5 rounded-xl text-xs font-bold border border-sky-200 cursor-pointer shadow-sm"
                              >
                                🕒 Przedłuż
                              </button>
                              <button 
                                onClick={() => setEditingPassModal({ ...karnet })} 
                                className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-200 flex items-center justify-center font-bold cursor-pointer shadow-sm" 
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
                
                {/* Rozwijana historia karnetów */}
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

              {/* Sekcja Portfel */}
              <div className="space-y-3">
                <h3 className="font-black text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">Portfel</h3>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
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

                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setIsWalletHistoryOpen(true)} className="text-slate-600 text-xs font-bold underline cursor-pointer py-1.5">🕒 HISTORIA PORTFELA</button>
                    <button onClick={() => setIsTopUpWalletOpen(true)} className="bg-amber-600 text-white px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer whitespace-nowrap">+ UZUPEŁNIJ PORTFEL</button>
                  </div>
                </div>
              </div>

              {/* SEKCJA: AKTYWNOŚĆ KLUBOWICZA (4 ZAKŁADKI) */}
              <div className="space-y-4">
                <h3 className="font-black text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">Aktywność klubowicza</h3>
                
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600 overflow-x-auto no-scrollbar">
                    <button 
                      onClick={() => setActiveZapisyTab('nadchodzace')} 
                      className={`py-3 px-4 text-center border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${activeZapisyTab === 'nadchodzace' ? 'border-sky-600 text-sky-800 font-black bg-white' : 'border-transparent hover:bg-slate-100'}`}
                    >
                      📅 NADCHODZĄCE ZAJĘCIA
                    </button>
                    <button 
                      onClick={() => setActiveZapisyTab('historia_zajec')} 
                      className={`py-3 px-4 text-center border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${activeZapisyTab === 'historia_zajec' ? 'border-sky-600 text-sky-800 font-black bg-white' : 'border-transparent hover:bg-slate-100'}`}
                    >
                      📋 HISTORIA PRZESZŁYCH ZAJĘĆ
                    </button>
                    <button 
                      onClick={() => setActiveZapisyTab('ruchy')} 
                      className={`py-3 px-4 text-center border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${activeZapisyTab === 'ruchy' ? 'border-sky-600 text-sky-800 font-black bg-white' : 'border-transparent hover:bg-slate-100'}`}
                    >
                      🔄 HISTORIA RUCHÓW (ZAPISY / WYPISY)
                    </button>
                    <button 
                      onClick={() => setActiveZapisyTab('zawieszenia')} 
                      className={`py-3 px-4 text-center border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${activeZapisyTab === 'zawieszenia' ? 'border-sky-600 text-sky-800 font-black bg-white' : 'border-transparent hover:bg-slate-100'}`}
                    >
                      ⏸️ HISTORIA ZAWIESZEŃ
                    </button>
                  </div>

                  <div className="overflow-x-auto w-full">
                    
                    {/* 1. NADCHODZĄCE ZAJĘCIA */}
                    {activeZapisyTab === 'nadchodzace' && (() => {
                      const now = new Date();
                      const nowTime = now.getTime();
                      const upcomingMap = new Map<string, any>();
                      const seenSignatures = new Set<string>();

                      // A. Zapisy z globalnej tabeli 'zapisy_zajec'
                      (wszystkieZapisy || [])
                        .filter((z: any) => String(z.klient_id) === String(profileClient.id))
                        .forEach((z: any) => {
                          const parts = (z.class_key || '').split('_');
                          const classId = parts[0];
                          const dateStr = parts[1] || '';
                          
                          const stdClass = zapisaneZajecia.find(zc => String(zc.id) === classId);
                          const jednorazClass = jednorazoweZajecia.find(zc => String(zc.id) === classId);
                          const override = nadpisaneZajeciaDni[z.class_key];
                          const classInfo = override ? { ...stdClass, ...jednorazClass, ...override } : (stdClass || jednorazClass);
                          const title = classInfo?.title || classInfo?.nazwa || z.class_title || 'Trening';
                          const timeStr = classInfo?.start_time || classInfo?.start || '';

                          const classStartMs = parseClassDate(`${dateStr} ${timeStr}`);
                          
                          if (classStartMs >= nowTime) {
                            const uniqueKey = z.class_key || `${z.id}`;
                            const sig = normalizeClassSignature(`${dateStr} ${timeStr}`, title);
                            
                            // Weryfikacja czy zapis nie powstał z reguły automatycznych zapisów
                            const isAutoEnrolled = (automatyczneZapisy || []).some(
                              (az: any) => String(az.klient_id) === String(profileClient.id) && String(az.grafik_id) === String(classId)
                            );

                            let author = 'Klubowicz';
                            if (isAutoEnrolled) {
                              author = 'Zapis automatyczny (Klub)';
                            } else if (z.zapisujacy) {
                              const zLow = String(z.zapisujacy).toLowerCase();
                              if (zLow.includes('admin') || zLow.includes('trener') || zLow.includes('zarządca') || zLow.includes('klub') || zLow.includes('panel')) {
                                author = z.zapisujacy;
                              }
                            }

                            let statusDisplay = 'ZAPISANY';
                            if (z.status === 'krzesełko') {
                              statusDisplay = 'LISTA REZERWOWA (KRZESEŁKO)';
                            } else if (isAutoEnrolled) {
                              statusDisplay = 'ZAPIS AUTOMATYCZNY';
                            }

                            seenSignatures.add(sig);
                            seenSignatures.add(uniqueKey);

                            upcomingMap.set(uniqueKey, {
                              id: z.id || uniqueKey,
                              classKey: z.class_key,
                              data: `${dateStr} ${timeStr}`.trim(),
                              zajecia: title,
                              status: statusDisplay,
                              zapisujacy: author,
                              created_at: z.created_at || z.data_zapisu || null,
                              sortTime: classStartMs
                            });
                          }
                        });

                      // B. Zapisy z tabeli 'automatyczne_zapisy'
                      (automatyczneZapisy || [])
                        .filter((az: any) => String(az.klient_id) === String(profileClient.id))
                        .forEach((az: any) => {
                          const stdClass = zapisaneZajecia.find(zc => String(zc.id) === String(az.grafik_id));
                          if (stdClass) {
                            const uniqueKey = `auto_${az.id}_${az.grafik_id}`;
                            const hourStr = stdClass.start || stdClass.start_time || '';
                            const fullDateStr = `${stdClass.dzien_tygodnia || 'Zajęcia stałe'} ${hourStr}`.trim();
                            const title = az.class_title || stdClass.title || stdClass.nazwa || 'Trening cykliczny';
                            const sig = normalizeClassSignature(fullDateStr, title);

                            if (!upcomingMap.has(uniqueKey) && !seenSignatures.has(sig)) {
                              seenSignatures.add(sig);
                              seenSignatures.add(uniqueKey);
                              upcomingMap.set(uniqueKey, {
                                id: uniqueKey,
                                classKey: `auto_${az.grafik_id}`,
                                data: fullDateStr,
                                zajecia: title,
                                status: 'ZAPIS AUTOMATYCZNY',
                                zapisujacy: 'Zapis automatyczny (Klub)',
                                created_at: az.created_at || null,
                                sortTime: nowTime + 1000
                              });
                            }
                          }
                        });

                      // C. Dodatkowe nadchodzące zapisy z profilu klienta
                      (profileClient.zapisyNadchodzace || []).forEach((item: any) => {
                        const classStartMs = parseClassDate(item.data);
                        if (classStartMs >= nowTime) {
                          const uniqueKey = item.classKey || `${item.id}`;
                          const sig = normalizeClassSignature(item.data, item.zajecia || 'Trening');

                          if (!upcomingMap.has(uniqueKey) && !seenSignatures.has(sig) && !(item.classKey && seenSignatures.has(item.classKey))) {
                            seenSignatures.add(sig);
                            seenSignatures.add(uniqueKey);
                            upcomingMap.set(uniqueKey, {
                              id: item.id || uniqueKey,
                              classKey: item.classKey,
                              data: item.data,
                              zajecia: item.zajecia || 'Trening',
                              status: item.status || 'ZAPISANY',
                              zapisujacy: item.zapisujacy || 'Klub (Panel Administratora)',
                              created_at: item.created_at || null,
                              sortTime: classStartMs
                            });
                          }
                        }
                      });

                      const upcomingList = Array.from(upcomingMap.values()).sort((a, b) => a.sortTime - b.sortTime);

                      return (
                        <div className="space-y-3">
                          {upcomingList.length > 0 && (
                            <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center flex-wrap gap-2">
                              <span className="text-xs font-bold text-slate-600">Łącznie zaplanowanych treningów: <strong className="text-slate-900">{upcomingList.length}</strong></span>
                              <button 
                                onClick={() => handleWypiszWszystkieNadchodzace(upcomingList)}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                              >
                                <span>🗑️</span> WYPISZ ZE WSZYSTKICH ZAJĘĆ
                              </button>
                            </div>
                          )}

                          <table className="w-full text-left text-xs min-w-[700px]">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                                <th className="py-2.5 px-4 w-10 whitespace-nowrap">#</th>
                                <th className="py-2.5 px-4 whitespace-nowrap">Data i czas zajęć</th>
                                <th className="py-2.5 px-4 whitespace-nowrap">Nazwa zajęć</th>
                                <th className="py-2.5 px-4 whitespace-nowrap">Status</th>
                                <th className="py-2.5 px-4 whitespace-nowrap">Kto zapisał</th>
                                <th className="py-2.5 px-4 whitespace-nowrap">Data i godzina zapisu</th>
                                <th className="py-2.5 px-4 text-right whitespace-nowrap">Akcje</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {upcomingList.length > 0 ? upcomingList.map((item: any, idx: number) => {
                                const isKlubowicz = !item.zapisujacy || 
                                                    item.zapisujacy.toLowerCase().includes('klubowicz') || 
                                                    item.zapisujacy.toLowerCase().includes('użytkownik') || 
                                                    item.zapisujacy.toLowerCase().includes('sam');
                                return (
                                  <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">{idx + 1}</td>
                                    <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">{item.data}</td>
                                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{item.zajecia}</td>
                                    <td className="py-3 px-4 font-semibold whitespace-nowrap">
                                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-black border ${
                                        item.status?.includes('REZERWOWA') || item.status?.includes('KRZESEŁKO')
                                          ? 'bg-blue-100 text-blue-900 border-blue-200'
                                          : item.status?.includes('AUTOMATYCZNY')
                                          ? 'bg-purple-100 text-purple-900 border-purple-300'
                                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                      }`}>
                                        {item.status || 'ZAPISANY'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 whitespace-nowrap">
                                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                                        {isKlubowicz ? '📱 Klubowicz' : `🛡️ ${item.zapisujacy || 'Klub (Administrator/Trener)'}`}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                      {item.created_at ? new Date(item.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Zapisany w grafiku'}
                                    </td>
                                    <td className="py-3 px-4 text-right whitespace-nowrap">
                                      <button onClick={() => handleWypiszZajecia(item)} className="text-rose-600 hover:text-rose-800 font-bold cursor-pointer transition-colors" title="Wypisz z zajęć">🗑️ Wypisz</button>
                                    </td>
                                  </tr>
                                );
                              }) : (
                                <tr>
                                  <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">Brak nadchodzących zajęć dla tego klubowicza.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}

                    {/* 2. HISTORIA PRZESZŁYCH ZAJĘĆ */}
                    {activeZapisyTab === 'historia_zajec' && (() => {
                      const now = new Date();
                      const nowTime = now.getTime();
                      const pastClassesList: any[] = [];
                      const pastSignatures = new Set<string>();

                      (wszystkieZapisy || [])
                        .filter((z: any) => String(z.klient_id) === String(profileClient.id))
                        .forEach((z: any) => {
                          const parts = (z.class_key || '').split('_');
                          const classId = parts[0];
                          const dateStr = parts[1] || '';
                          
                          const stdClass = zapisaneZajecia.find(zc => String(zc.id) === classId);
                          const jednorazClass = jednorazoweZajecia.find(zc => String(zc.id) === classId);
                          const override = nadpisaneZajeciaDni[z.class_key];
                          const classInfo = override ? { ...stdClass, ...jednorazClass, ...override } : (stdClass || jednorazClass);
                          const title = classInfo?.title || classInfo?.nazwa || z.class_title || 'Trening';
                          const timeStr = classInfo?.start_time || classInfo?.start || '';

                          const classStartMs = parseClassDate(`${dateStr} ${timeStr}`);

                          if (classStartMs > 0 && classStartMs < nowTime) {
                            const sig = normalizeClassSignature(`${dateStr} ${timeStr}`, title);
                            pastSignatures.add(sig);

                            let statusObecnosci = '⏳ Oczekuje na oznaczenie';
                            let obecnoscKlasa = 'bg-slate-100 text-slate-700 border-slate-300';
                            if (z.obecny) {
                              statusObecnosci = '🟢 OBECNY';
                              obecnoscKlasa = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                            } else if (z.nieobecny) {
                              statusObecnosci = '🔴 NIEOBECNY';
                              obecnoscKlasa = 'bg-rose-100 text-rose-800 border-rose-300';
                            }

                            let author = 'Klubowicz';
                            if (z.zapisujacy) {
                              const zLow = String(z.zapisujacy).toLowerCase();
                              if (zLow.includes('admin') || zLow.includes('trener') || zLow.includes('zarządca') || zLow.includes('klub') || zLow.includes('panel')) {
                                author = z.zapisujacy;
                              }
                            }

                            pastClassesList.push({
                              id: z.id || `${z.class_key}_${profileClient.id}`,
                              data: `${dateStr} ${timeStr}`.trim(),
                              zajecia: title,
                              obecnoscTekst: statusObecnosci,
                              obecnoscKlasa: obecnoscKlasa,
                              zapisujacy: author,
                              _sortTime: classStartMs
                            });
                          }
                        });

                      (profileClient.zapisyPrzeszle || []).forEach((item: any) => {
                        const st = parseClassDate(item.data);
                        const sig = normalizeClassSignature(item.data, item.zajecia || 'Trening');
                        
                        if (!pastSignatures.has(sig)) {
                          pastSignatures.add(sig);
                          let statusObecnosci = '🟢 OBECNY';
                          let obecnoscKlasa = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                          const ob = (item.obecnosc || '').toLowerCase();
                          if (ob.includes('nieobecny') || ob.includes('nieobecność')) {
                            statusObecnosci = '🔴 NIEOBECNY';
                            obecnoscKlasa = 'bg-rose-100 text-rose-800 border-rose-300';
                          }
                          pastClassesList.push({
                            id: item.id || Date.now(),
                            data: item.data,
                            zajecia: item.zajecia,
                            obecnoscTekst: statusObecnosci,
                            obecnoscKlasa: obecnoscKlasa,
                            zapisujacy: item.zapisujacy || 'Klub / System',
                            _sortTime: st || nowTime - 1000
                          });
                        }
                      });

                      pastClassesList.sort((a, b) => b._sortTime - a._sortTime);

                      return (
                        <table className="w-full text-left text-xs min-w-[650px]">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                              <th className="py-2.5 px-4 w-10 whitespace-nowrap">#</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Data i czas zajęć</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Nazwa zajęć</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Obecność (Oznaczenie Trenera)</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Kto dokonał zapisu</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {pastClassesList.length > 0 ? pastClassesList.map((item: any, idx: number) => {
                              const isKlubowicz = !item.zapisujacy || 
                                                  item.zapisujacy.toLowerCase().includes('klubowicz') || 
                                                  item.zapisujacy.toLowerCase().includes('użytkownik') || 
                                                  item.zapisujacy.toLowerCase().includes('sam');
                              return (
                                <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">{idx + 1}</td>
                                  <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">{item.data}</td>
                                  <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{item.zajecia}</td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${item.obecnoscKlasa}`}>
                                      {item.obecnoscTekst}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                                      {isKlubowicz ? '📱 Sam (Klubowicz)' : `🛡️ ${item.zapisujacy || 'Klub (Administrator/Trener)'}`}
                                    </span>
                                  </td>
                                </tr>
                              );
                            }) : (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">Brak historii odbytych przeszłych zajęć.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      );
                    })()}

                    {/* 3. HISTORIA WSZYSTKICH RUCHÓW */}
                    {activeZapisyTab === 'ruchy' && (() => {
                      const allMovements: any[] = [];
                      const seenMovementIds = new Set<string>();

                      (wszystkieZapisy || [])
                        .filter((z: any) => String(z.klient_id) === String(profileClient.id))
                        .forEach((z: any) => {
                          const parts = (z.class_key || '').split('_');
                          const dateStr = parts[1] || '';
                          const tTime = z.created_at ? new Date(z.created_at).getTime() : Date.now();
                          const mId = `zapis_${z.id || z.class_key}`;
                          
                          let author = 'Klubowicz';
                          if (z.zapisujacy) {
                            const zLow = String(z.zapisujacy).toLowerCase();
                            if (zLow.includes('admin') || zLow.includes('trener') || zLow.includes('zarządca') || zLow.includes('klub') || zLow.includes('panel')) {
                              author = z.zapisujacy;
                            }
                          }

                          if (!seenMovementIds.has(mId)) {
                            seenMovementIds.add(mId);
                            allMovements.push({
                              id: mId,
                              typ: 'ZAPISANIE NA ZAJĘCIA',
                              typKlasa: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                              zajecia: z.class_title || `Trening (${dateStr})`,
                              kto: author,
                              dataZdarzenia: z.created_at ? new Date(z.created_at).toLocaleString('pl-PL') : 'Rejestracja w systemie',
                              sortTime: tTime
                            });
                          }
                        });

                      (profileClient.zapisyWypisy || []).forEach((item: any) => {
                        const tTime = item.data_operacji ? new Date(item.data_operacji).getTime() : Date.now();
                        const mId = `wypis_${item.id || item.classKey || Math.random()}`;
                        if (!seenMovementIds.has(mId)) {
                          seenMovementIds.add(mId);
                          allMovements.push({
                            id: mId,
                            typ: 'WYPISANIE Z ZAJĘĆ',
                            typKlasa: 'bg-rose-100 text-rose-800 border-rose-200',
                            zajecia: `${item.zajecia || 'Zajęcia'} (${item.data || ''})`,
                            kto: item.wypisujacy || 'Administrator / Trener',
                            dataZdarzenia: item.data_operacji ? new Date(item.data_operacji).toLocaleString('pl-PL') : 'Wcześniejsza operacja',
                            sortTime: tTime
                          });
                        }
                      });

                      (profileClient.transakcje || []).forEach((t: any) => {
                        if (t.typ_operacji === 'zajecia_wypis' && t.opis) {
                          const tTime = new Date(t.created_at).getTime();
                          const mId = `trans_wypis_${t.id}`;
                          if (!seenMovementIds.has(mId)) {
                            seenMovementIds.add(mId);
                            allMovements.push({
                              id: mId,
                              typ: 'WYPISANIE (LOG TRANSAKCJI)',
                              typKlasa: 'bg-rose-100 text-rose-800 border-rose-200',
                              zajecia: t.opis.replace('Wypisano z zajęć: ', '').replace('Automatycznie wypisano z ', 'Trening: '),
                              kto: 'System / Panel Zarządzania',
                              dataZdarzenia: new Date(t.created_at).toLocaleString('pl-PL'),
                              sortTime: tTime
                            });
                          }
                        } else if (t.typ_operacji === 'zajecia_awans_rezerwa' && t.opis) {
                          const tTime = new Date(t.created_at).getTime();
                          const mId = `trans_awans_${t.id}`;
                          if (!seenMovementIds.has(mId)) {
                            seenMovementIds.add(mId);
                            allMovements.push({
                              id: mId,
                              typ: 'AWANS Z LISTY REZERWOWEJ',
                              typKlasa: 'bg-blue-100 text-blue-800 border-blue-200',
                              zajecia: t.opis,
                              kto: 'Automatyczny algorytm kolejki',
                              dataZdarzenia: new Date(t.created_at).toLocaleString('pl-PL'),
                              sortTime: tTime
                            });
                          }
                        }
                      });

                      allMovements.sort((a, b) => b.sortTime - a.sortTime);

                      return (
                        <table className="w-full text-left text-xs min-w-[700px]">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                              <th className="py-2.5 px-4 whitespace-nowrap">Data i czas wydarzenia</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Rodzaj ruchu</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Zajęcia / Wydarzenie</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Przez kogo wykonano</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {allMovements.length > 0 ? allMovements.map((mov: any, idx: number) => {
                              const isKlubowicz = !mov.kto || 
                                                  mov.kto.toLowerCase().includes('klubowicz') || 
                                                  mov.kto.toLowerCase().includes('użytkownik') || 
                                                  mov.kto.toLowerCase().includes('sam');
                              return (
                                <tr key={`${mov.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">{mov.dataZdarzenia}</td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${mov.typKlasa}`}>
                                      {mov.typ}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{mov.zajecia}</td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                                      {isKlubowicz ? '📱 Klubowicz' : `🛡️ ${mov.kto}`}
                                    </span>
                                  </td>
                                </tr>
                              );
                            }) : (
                              <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-400 text-xs">Brak zarejestrowanych ruchów związanych z zapisami i wypisami.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      );
                    })()}

                    {/* 4. HISTORIA ZAWIESZEŃ KARNETU */}
                    {activeZapisyTab === 'zawieszenia' && (() => {
                      const suspensionsList: any[] = [];

                      (profileClient.karnetyKlubowicza || []).forEach((karnet: any) => {
                        if (karnet.zawieszonyOd) {
                          suspensionsList.push({
                            id: `aktywne_${karnet.id}`,
                            karnetNazwa: karnet.nazwa,
                            od: karnet.zawieszonyOd,
                            do: karnet.zawieszonyDo || 'Planowane',
                            dni: 'W trakcie trwania',
                            kto: '🛡️ Zarządca / Administrator',
                            status: '⏸️ TRWA ZAWIESZENIE',
                            statusKlasa: 'bg-amber-100 text-amber-900 border-amber-300',
                            dataOdwieszenia: '-'
                          });
                        }
                        const passHist = safeJsonParse(karnet.historiaZawieszen, []);
                        passHist.forEach((hz: any) => {
                          const isKlubowicz = hz.kto?.toLowerCase().includes('klubowicz') || hz.kto?.toLowerCase().includes('użytkownik') || hz.by?.toLowerCase().includes('user');
                          suspensionsList.push({
                            id: `hist_${hz.id || Math.random()}`,
                            karnetNazwa: karnet.nazwa,
                            od: hz.od,
                            do: hz.do,
                            dni: `${hz.dni} dni`,
                            kto: isKlubowicz ? '📱 Klubowicz (Aplikacja)' : `🛡️ ${hz.kto || 'Administrator'}`,
                            status: '✅ ZAKOŃCZONE / ODWIESZONY',
                            statusKlasa: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                            dataOdwieszenia: hz.do
                          });
                        });
                      });

                      (profileClient.historiaZawieszen || []).forEach((hz: any) => {
                        const isKlubowicz = hz.kto?.toLowerCase().includes('klubowicz') || hz.kto?.toLowerCase().includes('użytkownik') || hz.by?.toLowerCase().includes('user') || !hz.kto;
                        suspensionsList.push({
                          id: `hist_client_${hz.id || Math.random()}`,
                          karnetNazwa: hz.karnet || hz.karnetNazwa || hz.nazwa || 'Karnet klubowicza',
                          od: hz.od || hz.start_date || hz.od_dnia,
                          do: hz.status === 'aktywne' ? (hz.planowane_do || hz.do || '-') : (hz.do || hz.end_date || hz.do_dnia || '-'),
                          dni: hz.status === 'aktywne' ? `Plan. ${hz.planowane_dni || 0}` : (hz.dni ? `${hz.dni} dni` : '-'),
                          kto: isKlubowicz ? '📱 Klubowicz (Aplikacja)' : `🛡️ ${hz.kto || 'Administrator'}`,
                          status: hz.status === 'aktywne' ? '⏳ Trwa' : '✅ ZAKOŃCZONE',
                          statusKlasa: hz.status === 'aktywne' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-emerald-100 text-emerald-800 border-emerald-200',
                          dataOdwieszenia: hz.status === 'aktywne' ? '-' : (hz.do || '-')
                        });
                      });

                      (wszystkieTransakcje || [])
                        .filter((t: any) => String(t.klient_id) === String(profileClient.id))
                        .forEach((t: any) => {
                          if (t.typ_operacji === 'zawieszenie_karnetu' || (t.opis && t.opis.toLowerCase().includes('zawieszenie'))) {
                            const isKlubowicz = t.opis?.toLowerCase().includes('klubowicz') || t.opis?.toLowerCase().includes('użytkownik') || t.opis?.toLowerCase().includes('aplikacj');
                            suspensionsList.push({
                              id: `trans_${t.id}`,
                              karnetNazwa: t.opis || 'Karnet klubowicza',
                              od: new Date(t.created_at).toISOString().split('T')[0],
                              do: '-',
                              dni: '-',
                              kto: isKlubowicz ? '📱 Klubowicz (Aplikacja)' : '🛡️ Panel Zarządcy',
                              status: '📜 WPIS W BAZIE',
                              statusKlasa: 'bg-slate-100 text-slate-700 border-slate-200',
                              dataOdwieszenia: '-'
                            });
                          }
                        });

                      return (
                        <table className="w-full text-left text-xs min-w-[700px]">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                              <th className="py-2.5 px-4 whitespace-nowrap">Karnet</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Okres zawieszenia</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Czas trwania</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Kto zawiesił</th>
                              <th className="py-2.5 px-4 whitespace-nowrap">Data odwieszenia / Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {suspensionsList.length > 0 ? suspensionsList.map((item: any, idx: number) => (
                              <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{item.karnetNazwa}</td>
                                <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">{item.od} do {item.do}</td>
                                <td className="py-3 px-4 font-bold whitespace-nowrap">{item.dni}</td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                                    {item.kto}
                                  </span>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${item.statusKlasa}`}>
                                    {item.status} ({item.dataOdwieszenia})
                                  </span>
                                </td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">Brak historii zawieszeń karnetu dla tego klubowicza.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      );
                    })()}

                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRZEDŁUŻ KARNET */}
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
                <div className="font-bold text-slate-700 whitespace-nowrap">Aktualna cena: {extendPassTarget.cena}</div>
                {extendPassTarget.isContract12M && (
                  <div className="text-amber-800 font-bold text-[11px]">Umowa 12M • Bieżąca rata: {extendPassTarget.rata || '0 / 12'}</div>
                )}
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
                        onChange={(e) => {
                          const val = e.target.value;
                          setExtendSelectedNewPassName(val);
                          const def = dostepneKarnety.find(k => k.nazwa === val);
                          if (def && !extendCustomPriceInput) {
                            setExtendCustomPriceInput(def.cena);
                          }
                        }}
                        className="bg-white border border-sky-300 rounded-lg px-2 py-1 font-bold ml-2 text-slate-800 cursor-pointer"
                      >
                        {dostepneKarnety.map(k => {
                          const isContract = k.isContract12M || k.typ_karnetu === 'Umowa 12 miesięcy';
                          const baseCena = parseFloat(k.cena) || 0;
                          let finalCena = baseCena;
                          let hasDiscount = false;
                          const activeDiscount = getEffectiveDiscount(profileClient, isContract);
                          
                          if (activeDiscount > 0 && !isContract) {
                            finalCena = baseCena * (1 - activeDiscount / 100);
                            hasDiscount = true;
                          }
                          
                          return (
                            <option key={k.id} value={k.nazwa}>
                              {k.nazwa} ({finalCena.toFixed(2)} PLN{hasDiscount ? ` - po rabacie ${activeDiscount}%` : ''} {isContract ? '• Umowa 12M' : ''})
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <span className="font-black text-slate-900 whitespace-nowrap">
                        {(() => {
                          const defKarnetu = dostepneKarnety.find(k => k.nazwa === extendSelectedNewPassName);
                          const isContract = defKarnetu?.isContract12M || defKarnetu?.typ_karnetu === 'Umowa 12 miesięcy';
                          let baseCena = 0;
                          if (extendCustomPriceInput && extendCustomPriceInput.trim() !== '') {
                            baseCena = parseFloat(extendCustomPriceInput.replace(/[^0-9.]/g, '')) || 0;
                          } else {
                            baseCena = defKarnetu ? parseFloat(defKarnetu.cena) : parseFloat(extendPassTarget?.cena?.replace(/[^0-9.]/g, '') || '0');
                          }
                          let finalCena = baseCena;
                          let hasDiscount = false;
                          const activeDiscount = getEffectiveDiscount(profileClient, isContract);
                          if (activeDiscount > 0 && !isContract) {
                            finalCena = baseCena * (1 - activeDiscount / 100);
                            hasDiscount = true;
                          }
                          return `${extendSelectedNewPassName} (${finalCena.toFixed(2)} PLN${hasDiscount ? ` - po rabacie ${activeDiscount}%` : ''}${isContract ? ' • Umowa 12M' : ''})`;
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
                    <span className="font-bold text-slate-700">Cena przedłużenia (PLN): </span>
                    {isEditingNewPrice ? (
                      <input 
                        type="number"
                        step="0.01"
                        value={extendCustomPriceInput}
                        onChange={(e) => setExtendCustomPriceInput(e.target.value)}
                        placeholder="np. 119.00"
                        className="bg-white border border-sky-300 rounded-lg px-2 py-1 font-bold ml-2 text-slate-800 w-28"
                      />
                    ) : (
                      <span className="font-mono font-bold text-slate-900 whitespace-nowrap">
                        {extendCustomPriceInput ? `${parseFloat(extendCustomPriceInput).toFixed(2)} PLN (Własna stawka)` : 'Domyślna cena karnetu'}
                      </span>
                    )}
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setIsEditingNewPrice(!isEditingNewPrice)}
                    className="p-1.5 bg-white hover:bg-sky-100 text-sky-800 rounded-lg border border-sky-200 cursor-pointer"
                    title="Ustaw indywidualną cenę"
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

      {/* MODAL: EDYCJA DANYCH KONTA */}
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

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Urodziny</label>
                <input 
                  type="date" 
                  value={profileClient.birthDate || ''} 
                  onChange={(e) => setProfileClient({...profileClient, birthDate: e.target.value})} 
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" 
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsEditProfileInfoOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer whitespace-nowrap">Anuluj</button>
                <button type="submit" className="bg-amber-700 hover:bg-amber-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer whitespace-nowrap">Zapisz zmiany</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UZUPEŁNIJ PORTFEL */}
      {isTopUpWalletOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider whitespace-nowrap">💰 Uzupełnij portfel</h3>
              <button onClick={() => setIsTopUpWalletOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleTopUpWalletSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Kwota (+/-)</label>
                <input type="number" step="0.01" required value={walletAmountInput} onChange={(e) => setWalletAmountInput(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 whitespace-nowrap">Tytuł operacji (opcjonalnie)</label>
                <input type="text" value={walletReasonInput} placeholder="np. Gotówka w recepcji" onChange={(e) => setWalletReasonInput(e.target.value)} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsTopUpWalletOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl cursor-pointer whitespace-nowrap">Anuluj</button>
                <button type="submit" className="bg-amber-700 hover:bg-amber-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer whitespace-nowrap">Zatwierdź</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTORII OPERACJI I PORTFELA */}
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
                  {profileClient.transakcje && profileClient.transakcje
                    .filter((item: any) => item.typ_operacji !== 'zajecia_zapis' && item.typ_operacji !== 'zajecia_wypis')
                    .map((item: any) => (
                    <tr key={item.id} className="hover:bg-sky-50/30 transition-colors">
                      <td className="py-3 px-3 font-mono whitespace-nowrap">{new Date(item.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-3 px-3 font-bold uppercase text-[10px] tracking-wider text-sky-800 whitespace-nowrap">{item.typ_operacji.replace('_', ' ')}</td>
                      <td className={`py-3 px-3 font-black text-sm whitespace-nowrap ${item.kwota !== null && item.kwota < 0 ? 'text-rose-600' : item.kwota !== null && item.kwota > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {item.kwota !== null ? `${item.kwota > 0 ? '+' : ''}${item.kwota.toFixed(2)} PLN` : '-'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap" title={item.opis}>{item.opis}</td>
                    </tr>
                  ))}
                  {(!profileClient.transakcje || profileClient.transakcje.filter((item: any) => item.typ_operacji !== 'zajecia_zapis' && item.typ_operacji !== 'zajecia_wypis').length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">Brak zarejestrowanej historii operacji finansowych dla tego klienta w chmurze Supabase.</td>
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

      {/* MODAL DODAWANIA KOLEJNEGO KARNETU */}
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
                    const isContract = k.isContract12M || k.typ_karnetu === 'Umowa 12 miesięcy';
                    const baseCena = parseFloat(k.cena) || 0;
                    let finalCena = baseCena;
                    let hasDiscount = false;
                    const activeDiscount = getEffectiveDiscount(profileClient, isContract);
                    
                    if (activeDiscount > 0 && !isContract) {
                      finalCena = baseCena * (1 - activeDiscount / 100);
                      hasDiscount = true;
                    }
                    
                    return (
                      <option key={k.id} value={k.nazwa}>
                        {k.nazwa} ({finalCena.toFixed(2)} PLN{hasDiscount ? ` - po rabacie ${activeDiscount}%` : ''} {isContract ? '• Umowa 12M' : ''})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* OPCJE DLA UMOWY 12 MIESIĘCY */}
              {(() => {
                const targetDef = dostepneKarnety.find(k => k.nazwa === selectedPassToAdd);
                const isContract = targetDef?.isContract12M || targetDef?.typ_karnetu === 'Umowa 12 miesięcy';
                if (!isContract) return null;

                return (
                  <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 space-y-3">
                    <div className="font-black text-amber-950 uppercase tracking-wider text-[10px]">
                      Konfiguracja umowy 12M:
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block text-[10px]">Indywidualna kwota raty (PLN / m-c)</label>
                      <input 
                        type="number"
                        step="0.01"
                        placeholder={targetDef ? targetDef.cena : "np. 119.00"}
                        value={newPassCustomPrice}
                        onChange={(e) => setNewPassCustomPrice(e.target.value)}
                        className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 block text-[10px]">Bieżąca rata</label>
                        <input 
                          type="text" 
                          placeholder="np. 4 / 12"
                          value={newPassCustomRata}
                          onChange={(e) => setNewPassCustomRata(e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 block text-[10px]">Dni zawieszenia</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="30"
                          placeholder="30"
                          value={newPassCustomSuspensionDays}
                          onChange={(e) => setNewPassCustomSuspensionDays(e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

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

      {/* OKNO EDYCJI KARNETU */}
      {editingPassModal && (
        <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">✏️ Edytuj karnet</h3>
              <button onClick={() => setEditingPassModal(null)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Wybierz nowy karnet z bazy</label>
                <select 
                  value={editingPassModal.nazwa || ''} 
                  onChange={(e) => {
                    const wybranyNazwa = e.target.value;
                    const def = dostepneKarnety.find(k => k.nazwa === wybranyNazwa);
                    const isContract = def?.isContract12M || def?.typ_karnetu === 'Umowa 12 miesięcy';
                    const actRab = getEffectiveDiscount(profileClient, isContract);
                    const baseCena = def ? parseFloat(def.cena) : 0;
                    const finalCena = (actRab > 0 && !isContract) ? baseCena * (1 - actRab / 100) : baseCena;
                    
                    setEditingPassModal({
                      ...editingPassModal, 
                      nazwa: wybranyNazwa,
                      isContract12M: isContract,
                      rata: isContract ? (editingPassModal.rata || '0 / 12') : '1 / 1',
                      contractSuspensionDaysLeft: isContract ? (editingPassModal.contractSuspensionDaysLeft ?? 30) : undefined,
                      cena: def ? `${finalCena.toFixed(2)} PLN` : editingPassModal.cena
                    });
                  }} 
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold cursor-pointer text-slate-800"
                >
                  <option value="">-- Wybierz karnet z bazy --</option>
                  {dostepneKarnety.map(k => {
                    const isContract = k.isContract12M || k.typ_karnetu === 'Umowa 12 miesięcy';
                    const baseCena = parseFloat(k.cena) || 0;
                    let finalCena = baseCena;
                    let hasDiscount = false;
                    const activeDiscount = getEffectiveDiscount(profileClient, isContract);
                    if (activeDiscount > 0 && !isContract) {
                      finalCena = baseCena * (1 - activeDiscount / 100);
                      hasDiscount = true;
                    }
                    return (
                      <option key={k.id} value={k.nazwa}>
                        {k.nazwa} ({finalCena.toFixed(2)} PLN{hasDiscount ? ` - po rabacie ${activeDiscount}%` : ''} {isContract ? '• Umowa 12M' : ''})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Indywidualna cena karnetu / raty (PLN) *</label>
                <input 
                  type="text" 
                  value={editingPassModal.cena || ''} 
                  onChange={(e) => setEditingPassModal({...editingPassModal, cena: e.target.value})} 
                  placeholder="np. 119.00 PLN"
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" 
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Ważny do</label>
                <input 
                  type="date" 
                  value={editingPassModal.waznyDo || ''} 
                  onChange={(e) => setEditingPassModal({...editingPassModal, waznyDo: e.target.value})} 
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold cursor-pointer text-slate-800" 
                />
              </div>

              {editingPassModal.isContract12M ? (
                <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 space-y-3">
                  <div className="font-black text-amber-900 uppercase tracking-wider text-[10px]">
                    Parametry Umowy 12M:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block text-[10px]">Bieżąca rata (np. 4 / 12)</label>
                      <input 
                        type="text" 
                        value={editingPassModal.rata || ''} 
                        onChange={(e) => setEditingPassModal({...editingPassModal, rata: e.target.value})} 
                        className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block text-[10px]">Pozostało zawieszenia (dni)</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="30"
                        value={editingPassModal.contractSuspensionDaysLeft ?? 30} 
                        onChange={(e) => setEditingPassModal({...editingPassModal, contractSuspensionDaysLeft: parseInt(e.target.value, 10) || 0})} 
                        className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800" 
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Pozostało wejść (dla karnetów ilościowych)</label>
                  <input 
                    type="number" 
                    value={editingPassModal.pozostaloWejsc ?? ''} 
                    onChange={(e) => setEditingPassModal({...editingPassModal, pozostaloWejsc: e.target.value === '' ? null : parseInt(e.target.value, 10)})} 
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" 
                  />
                </div>
              )}
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

      {/* MODAL ZARZĄDZANIA STATUSEM KARNETU */}
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
                    Zatrzymuje bieg karnetu. Liczba dni zawieszenia zostanie wyliczona <strong>w momencie odwieszenia</strong> i doliczona do ważności.
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
                    <button type="button" onClick={() => { handleOdwiesKarnet(suspendPassTarget); }} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer">Odwieś karnet i dolicz dni</button>
                  </div>
                ) : (
                  <form onSubmit={handleConfirmSuspendPass} className="space-y-3 text-xs mt-4">
                    <div className="flex bg-white rounded-lg border border-amber-200 overflow-hidden font-bold">
                      <button type="button" onClick={() => setSuspendMode('days')} className={`flex-1 py-1.5 cursor-pointer transition-colors ${suspendMode === 'days' ? 'bg-amber-200 text-amber-900' : 'text-amber-700 hover:bg-amber-50'}`}>Liczba dni</button>
                      <button type="button" onClick={() => setSuspendMode('dates')} className={`flex-1 py-1.5 border-l border-amber-200 cursor-pointer transition-colors ${suspendMode === 'dates' ? 'bg-amber-200 text-amber-900' : 'text-amber-700 hover:bg-amber-50'}`}>Od-Do</button>
                    </div>

                    {suspendMode === 'days' ? (
                      <div className="space-y-1">
                        <label className="font-bold text-amber-900">Liczba dni zawieszenia</label>
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
                    Blokuje wejście do klubu i wypisuje z nadchodzących zajęć. <strong>NIE przedłuża</strong> ważności karnetu.
                  </p>
                </div>
                
                <form onSubmit={handleConfirmBlockPass} className="space-y-3 text-xs mt-4">
                  <div className="flex bg-white rounded-lg border border-rose-200 overflow-hidden font-bold">
                    <button type="button" onClick={() => setBlockMode('days')} className={`flex-1 py-1.5 cursor-pointer transition-colors ${blockMode === 'days' ? 'bg-rose-200 text-rose-900' : 'text-rose-600 hover:bg-rose-50'}`}>Liczba dni</button>
                    <button type="button" onClick={() => setBlockMode('dates')} className={`flex-1 py-1.5 border-l border-rose-200 cursor-pointer transition-colors ${blockMode === 'dates' ? 'bg-rose-200 text-rose-900' : 'text-rose-600 hover:bg-rose-50'}`}>Od-Do</button>
                  </div>

                  {blockMode === 'days' ? (
                    <div className="space-y-1">
                      <label className="font-bold text-rose-900">Liczba dni blokady</label>
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

      {/* MODAL HISTORII ZAWIESZEŃ */}
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
                  <div className="font-bold text-sky-900 mb-2">Karnet: {karnet.nazwa} {karnet.isContract12M ? '(Umowa 12M)' : ''}</div>
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

      {/* MODAL EDYCJI KLIENTA */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider whitespace-nowrap">✏️ Edytuj dane</h3>
              <button onClick={() => setEditingClient(null)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="font-bold text-slate-700 whitespace-nowrap">Imię</label><input type="text" value={editingClient.firstName || ''} onChange={(e) => setEditingClient({...editingClient, firstName: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 font-bold" /></div>
                <div className="space-y-1"><label className="font-bold text-slate-700 whitespace-nowrap">Nazwisko</label><input type="text" value={editingClient.lastName || ''} onChange={(e) => setEditingClient({...editingClient, lastName: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 font-bold" /></div>
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setEditingClient(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer whitespace-nowrap">Anuluj</button>
                <button type="submit" className="bg-amber-700 hover:bg-amber-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer whitespace-nowrap">Zaktualizuj</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DODAWANIA NOWEGO KLIENTA */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider whitespace-nowrap">👤 Dodaj nowego klubowicza</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer transition-colors">✕</button>
            </div>
            <form onSubmit={handleAddClientSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 whitespace-nowrap">Imię *</label>
                  <input required type="text" value={newClient.firstName} onChange={(e) => setNewClient({...newClient, firstName: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 whitespace-nowrap">Nazwisko *</label>
                  <input required type="text" value={newClient.lastName} onChange={(e) => setNewClient({...newClient, lastName: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 whitespace-nowrap">Telefon</label>
                <input type="text" value={newClient.phone} onChange={(e) => setNewClient({...newClient, phone: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 whitespace-nowrap">Email</label>
                <input type="email" value={newClient.email} onChange={(e) => setNewClient({...newClient, email: e.target.value})} className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800" />
              </div>
              
              <div className="space-y-1 pt-2">
                <label className="font-bold text-slate-700 block whitespace-nowrap">Wybierz karnet początkowy (opcjonalnie)</label>
                <select 
                  value={newClient.selectedPass} 
                  onChange={(e) => {
                    const passName = e.target.value;
                    const def = dostepneKarnety.find(k => k.nazwa === passName);
                    const isContract = def?.isContract12M || def?.typ_karnetu === 'Umowa 12 miesięcy';
                    setNewClient({
                      ...newClient, 
                      selectedPass: passName,
                      isContractMigration: isContract,
                      customContractPrice: def ? def.cena : ''
                    });
                  }} 
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- Brak przypisanego karnetu --</option>
                  {dostepneKarnety.map(k => (
                    <option key={k.id} value={k.nazwa}>{k.nazwa} ({k.cena} PLN){k.isContract12M ? ' • Umowa 12M' : ''}</option>
                  ))}
                </select>
              </div>

              {newClient.isContractMigration && (() => {
                const addModalTargetDef = dostepneKarnety.find(k => k.nazwa === newClient.selectedPass);
                return (
                  <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 space-y-3">
                    <div className="font-black text-amber-900 uppercase tracking-wider text-[10px]">
                      Parametry umowy 12M (indywidualna oferta):
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 block text-[10px]">Indywidualna kwota raty (PLN / m-c)</label>
                      <input 
                        type="number"
                        step="0.01"
                        placeholder={addModalTargetDef ? addModalTargetDef.cena : "np. 119.00"}
                        value={newClient.customContractPrice}
                        onChange={(e) => setNewClient({...newClient, customContractPrice: e.target.value})}
                        className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 block text-[10px]">Numer raty (np. 4 / 12)</label>
                        <input 
                          type="text" 
                          value={newClient.customRata} 
                          onChange={(e) => setNewClient({...newClient, customRata: e.target.value})} 
                          className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 block text-[10px]">Pozostałe dni zawieszenia</label>
                        <input 
                          type="number" 
                          min="0" 
                          max="30"
                          value={newClient.customSuspensionDays} 
                          onChange={(e) => setNewClient({...newClient, customSuspensionDays: e.target.value})} 
                          className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800" 
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap">Anuluj</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap">Zapisz do bazy</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
