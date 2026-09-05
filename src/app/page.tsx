"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Bezpośrednia, bezpieczna inicjalizacja klienta Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Pomocnik do konwersji klucza VAPID
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ROZWIĄZANIE PROBLEMU LIMITU REKORDÓW SUPABASE - POBIERANIE PEŁNE I OD NAJNOWSZYCH
const fetchAllFromSupabase = async (
  table: string,
  orderBy: string = 'created_at',
  ascending: boolean = false,
  maxPages: number = 50 // Bezpieczny limit do 50 000 rekordów zamiast domyślnego limitu 1000
) => {
  let result: any[] = [];
  for (let i = 0; i < maxPages; i++) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending })
      .range(i * 1000, (i + 1) * 1000 - 1);
    
    if (error) {
      if (orderBy !== 'id' && error.message?.includes('does not exist')) {
        return fetchAllFromSupabase(table, 'id', ascending, maxPages);
      }
      console.error(`Błąd pobierania tabeli ${table}:`, error);
      break;
    }
    if (data && data.length > 0) {
      result.push(...data);
      if (data.length < 1000) break;
    } else {
      break;
    }
  }
  return result;
};

export default function DashboardPage() {
  const nowLocal = new Date();
  const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
  const currentTimeStr = `${String(nowLocal.getHours()).padStart(2, '0')}:${String(nowLocal.getMinutes()).padStart(2, '0')}`;
  
  // SYSTEM POWIADOMIEŃ TOAST
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // POMOCNIK GENEROWANIA WARIANTÓW CLASS_KEY
  const getKeysVariants = (classId: string | number, dateStr: string) => {
    const keys = new Set<string>();
    if (!dateStr) return [`${classId}`];
    
    keys.add(`${classId}_${dateStr}`);

    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const now = new Date();
      let yr = selectedWeekDate ? selectedWeekDate.getFullYear() : now.getFullYear();
      
      if (m < (now.getMonth() + 1) || (m === (now.getMonth() + 1) && d < now.getDate())) {
        yr = now.getFullYear() + 1;
      }

      const dPadded = String(d).padStart(2, '0');
      const mPadded = String(m).padStart(2, '0');

      keys.add(`${classId}_${dPadded}/${mPadded}`);
      keys.add(`${classId}_${d}/${m}`);
      keys.add(`${classId}_${yr}-${mPadded}-${dPadded}`);
    } else if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const yr = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const dPadded = String(d).padStart(2, '0');
        const mPadded = String(m).padStart(2, '0');

        keys.add(`${classId}_${dPadded}/${mPadded}`);
        keys.add(`${classId}_${d}/${m}`);
        keys.add(`${classId}_${yr}-${mPadded}-${dPadded}`);
      }
    }
    return Array.from(keys);
  };

  // UNIWERSALNA FUNKCJA WYSYŁANIA POWIADOMIEŃ PUSH
  const sendPushNotification = async (
    clientIds: number | string | (number | string)[],
    payload: { title?: string; body?: string; url?: string; typ?: string; type?: string }
  ) => {
    try {
      const rawIds = Array.isArray(clientIds) ? clientIds : [clientIds];
      const validIds = rawIds
        .map(id => Number(id))
        .filter(id => !isNaN(id) && id > 0 && id !== 5000 && id !== 999999999);

      if (validIds.length === 0) {
        return;
      }

      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientIds: validIds,
          payload: {
            title: payload.title || 'FORMA MARZEŃ',
            body: payload.body || '',
            url: payload.url || '/',
            typ: payload.typ || payload.type || 'PUSH'
          }
        })
      });

      await res.json();
    } catch (err) {
      console.error('[PUSH CLIENT ERROR] Błąd wywołania sendPushNotification:', err);
    }
  };

  // HELPER: AUTOMATYCZNY AWANS Z LISTY REZERWOWEJ I WYSYŁKA PUSH
  const promoteWaitlistMember = async (classItem: any, displayDate: string, currentSignups: any[], removedUserId: number) => {
    if (!classItem) return;
    const classKey = `${classItem.id}_${displayDate}`;
    const allVariantKeys = getKeysVariants(classItem.id, displayDate);
    const limitZajec = classItem.limit || 12;
    
    const pozostali = currentSignups.filter((u: any) => String(u.id) !== String(removedUserId));
    const listaGlowna = pozostali.filter((u: any) => u.status === 'zapisany');
    const rezerwa = pozostali.filter((u: any) => u.status === 'krzesełko');

    if (listaGlowna.length < limitZajec && rezerwa.length > 0) {
      let d = 1, m = 1;
      if (displayDate.includes('/')) {
        [d, m] = displayDate.split('/').map(Number);
      } else if (displayDate.includes('-')) {
        const p = displayDate.split('-').map(Number);
        m = p[1]; d = p[2];
      }
      const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
      const [sh = '00', sm = '00'] = (classItem.start || '00:00').split(':');
      const classStartDateTime = new Date(classYear, m - 1, d, parseInt(sh), parseInt(sm), 0);
      const diffMinutes = (classStartDateTime.getTime() - new Date().getTime()) / (1000 * 60);

      const posortowanaRezerwa = rezerwa.sort((a: any, b: any) => {
        if (a.created_at && b.created_at) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return Number(a.id) - Number(b.id);
      });

      let promotedUser = null;
      for (const wMember of posortowanaRezerwa) {
        const cutoffMin = wMember.waitlist_cutoff_minutes !== undefined && wMember.waitlist_cutoff_minutes !== null 
          ? Number(wMember.waitlist_cutoff_minutes) 
          : 30;
        if (diffMinutes > cutoffMin) {
          promotedUser = wMember;
          break;
        }
      }

      if (promotedUser) {
        await supabase.from('zapisy_zajec').update({ status: 'zapisany' }).in('class_key', allVariantKeys).eq('klient_id', promotedUser.id);
        
        await sendPushNotification(promotedUser.id, {
          title: `Jesteś na liście głównej: ${classItem.title}!`,
          body: `Zwolniło się miejsce! Zostałeś przeniesiony z listy rezerwowej na listę główną treningu ${classItem.title} (${displayDate} ${classItem.start}).`,
          url: '/'
        });

        const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
        const dayOfWeekName = dayNames[classStartDateTime.getDay()];
        const formattedFullDate = `${dayOfWeekName}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${classYear}`;
        const durationText = calculateDuration(classItem.start, classItem.end);

        await supabase.from('transakcje').insert([{ 
          klient_id: promotedUser.id, 
          typ_operacji: 'awans_z_krzesełka', 
          class_key: classKey, 
          opis: `${promotedUser.firstName || 'Klubowicz'} ${promotedUser.lastName || ''} - Automatyczny awans z listy rezerwowej na listę główną: ${classItem.title} (${formattedFullDate} ${classItem.start}-${classItem.end || ''}, ${durationText}). Status: ✅ Lista główna.` 
        }]);
        
        await supabase.from('booking_logs').insert([{
          action_type: 'WAITLIST_PROMOTION',
          status: 'SUCCESS',
          reason: `Klubowicz ID:${promotedUser.id} awansowany na listę główną w ${classKey}`,
          rule_applied: 'waitlist_auto_promotion',
          payload: { klient_id: promotedUser.id, class_key: classKey }
        }]);
      }
    }
  };
  
  // REJESTRACJA I ZAPIS SUBSKRYPCJI PUSH
  const subscribeToPushNotifications = async (klientId: number) => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicVapidKey) {
          console.warn('Brak NEXT_PUBLIC_VAPID_PUBLIC_KEY w zmiennych środowiskowych.');
          return;
        }

        const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      if (subscription) {
        const subStr = JSON.stringify(subscription);
        await supabase.from('klienci').update({ push_subscription: subStr }).eq('id', klientId);
      }
    } catch (err) {
      console.warn('Nie udało się zarejestrować powiadomień Push:', err);
    }
  };

  // NORMALIZACJA I DOPASOWYWANIE NAZW ZAJĘĆ
  const normalizeText = (text: string): string => {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\/\-\_\,\.\+\&\(\)]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const areClassNamesMatching = (nameA: string, nameB: string): boolean => {
    if (!nameA || !nameB) return false;
    const normA = normalizeText(nameA);
    const normB = normalizeText(nameB);

    if (normA === normB) return true;
    if (normA.replace(/\s+/g, '') === normB.replace(/\s+/g, '')) return true;

    return false;
  };

  // WERYFIKACJA UPRAWNIEŃ KARNETU DO ZAJĘĆ
  const checkPassAllowsClass = (passItem: any, classTitle: string, allPassDefs: any[]) => {
    if (!passItem || !classTitle) return false;
    const passName = (passItem.nazwa || passItem.pass || '').trim();
    const normPassName = normalizeText(passName);
    const normClassTitle = normalizeText(classTitle);

    if (normPassName.includes('open') || normPassName.includes('medicover')) return true;

    const passAccessType = normalizeText(passItem.dostepDo || passItem.dostep_do_zajec || '');
    if (passAccessType.includes('wszystk') || passAccessType === 'all') {
      return true;
    }

    const allowedList = passItem.zaznaczoneZajecia || passItem.wybraneZajecia || [];
    if (Array.isArray(allowedList) && allowedList.length > 0) {
      const isMatched = allowedList.some((item: any) => {
        const itemName = typeof item === 'string' ? item : (item.nazwa || item.title || item.name || '');
        const normItem = normalizeText(itemName);
        return normItem === normClassTitle || normItem.replace(/\s+/g, '') === normClassTitle.replace(/\s+/g, '');
      });
      if (isMatched) return true;
    }

    const def = allPassDefs.find((d: any) => {
      const defName = (d.nazwa || '').trim();
      return defName.toLowerCase() === passName.toLowerCase() || normalizeText(defName) === normPassName;
    });

    if (def) {
      const accessType = normalizeText(def.dostep_do_zajec || def.dostepDo || '');
      if (accessType.includes('wszystk') || accessType === 'all') {
        return true;
      }

      let meta: any = {};
      try {
        meta = typeof def.inne_ustawienia === 'string' ? JSON.parse(def.inne_ustawienia) : (def.inne_ustawienia || {});
      } catch (e) {
        meta = {};
      }

      const defAllowedList = 
        meta.zaznaczoneZajecia || meta.zaznaczone_zajecia ||
        meta.wybraneZajecia || meta.wybrane_zajecia || 
        def.zaznaczoneZajecia || [];

      if (Array.isArray(defAllowedList) && defAllowedList.length > 0) {
        const isMatched = defAllowedList.some((item: any) => {
          const itemName = typeof item === 'string' ? item : (item.nazwa || item.title || item.name || '');
          const normItem = normalizeText(itemName);
          return normItem === normClassTitle || normItem.replace(/\s+/g, '') === normClassTitle.replace(/\s+/g, '');
        });
        if (isMatched) return true;
      }
    }

    if (normPassName === normClassTitle || normPassName.replace(/\s+/g, '') === normClassTitle.replace(/\s+/g, '')) {
      return true;
    }

    return false;
  };

  // STANY DANYCH I WIDOKU
  const [adminViewTab, setAdminViewTab] = useState<'grafik' | 'operacje'>('grafik');
  const [salesPeriod, setSalesPeriod] = useState('Dziś');
  const [clientSearch, setClientSearch] = useState('');
  const [operationsSearchQuery, setOperationsSearchQuery] = useState('');
  const [operationsDateRange, setOperationsDateRange] = useState({
    from: `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-01`,
    to: todayStr
  });

  const [klienciList, setKlienciList] = useState<any[]>([]);
  const [zespolTrenerzy, setZespolTrenerzy] = useState<any[]>([]);
  const [zapisaneZajecia, setZapisaneZajecia] = useState<any[]>([]);
  const [jednorazoweZajecia, setJednorazoweZajecia] = useState<any[]>([]);
  const [nadpisaneZajeciaDni, setNadpisaneZajeciaDni] = useState<{ [key: string]: any }>({});
  const [wydarzeniaKilkudniowe, setWydarzeniaKilkudniowe] = useState<any[]>([]);
  const [zapisyNaZajecia, setZapisyNaZajecia] = useState<{ [key: string]: any[] }>({});
  const [rodzajeZajec, setRodzajeZajec] = useState<any[]>([]);
  const [wszystkieTransakcje, setWszystkieTransakcje] = useState<any[]>([]);
  const [indywidualneLimity, setIndywidualneLimity] = useState<any[]>([]);
  const [appRole, setAppRole] = useState<'admin' | 'trener' | 'klubowicz'>('klubowicz');
  const [dostepneKarnety, setDostepneKarnety] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentTrenerProfile, setCurrentTrenerProfile] = useState<any>(null);
  const [ogloszeniaList, setOgloszeniaList] = useState<any[]>([]);
  
  const [tableActionClient, setTableActionClient] = useState<any | null>(null);
  const [profileClient, setProfileClient] = useState<any | null>(null);
  
  const [isExtendPassModalOpen, setIsExtendPassModalOpen] = useState(false);
  const [extendPassTarget, setExtendPassTarget] = useState<any | null>(null);
  const [extendSelectedNewPassName, setExtendSelectedNewPassName] = useState('');
  const [extendNewDate, setExtendNewDate] = useState('');
  const [isEditingNewPassType, setIsEditingNewPassType] = useState(false);
  const [isEditingNewDate, setIsEditingNewDate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isWalletHistoryOpen, setIsWalletHistoryOpen] = useState(false);
  const [isTopUpWalletOpen, setIsTopUpWalletOpen] = useState(false);
  const [walletAmountInput, setWalletAmountInput] = useState('');
  const [walletReasonInput, setWalletReasonInput] = useState('');
  
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
  const [isBuyPassModalOpen, setIsBuyPassModalOpen] = useState(false);
  const [selectedBuyPass, setSelectedBuyPass] = useState('');
  const [activationMode, setActivationMode] = useState<'today' | 'after'>('today');
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [searchClientQuery, setSearchClientQuery] = useState('');
  const [clientToUnregister, setClientToUnregister] = useState<any | null>(null);
  const [clientToMarkAbsent, setClientToMarkAbsent] = useState<any | null>(null);
  const [blokadaZapisow, setBlokadaZapisow] = useState(false);
  const [dlugoscBlokady, setDlugoscBlokady] = useState('3');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [selectedWaitlistCutoff, setSelectedWaitlistCutoff] = useState<number>(30);
  const [isEditWaitlistModalOpen, setIsEditWaitlistModalOpen] = useState(false);
  const [editWaitlistTarget, setEditWaitlistTarget] = useState<any | null>(null);
  const [editWaitlistCutoff, setEditWaitlistCutoff] = useState<number>(30);

  // STANY ZINTEGROWANE Z GRAFIKU
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

  // MODAL WYDARZEŃ: JEDNODNIOWE I KILKUDNIOWE
  const [isMultiDayModalOpen, setIsMultiDayModalOpen] = useState(false);
  const [eventModeType, setEventModeType] = useState<'jednodniowe' | 'kilkudniowe'>('kilkudniowe');
  const [multiDayTitle, setMultiDayTitle] = useState('OBÓZ W WAŁCZU');
  const [multiDayFrom, setMultiDayFrom] = useState(todayStr);
  const [multiDayTo, setMultiDayTo] = useState(todayStr);

  const [calendarViewDate, setCalendarViewDate] = useState<Date | null>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [showAllMyClasses, setShowAllMyClasses] = useState(false);
  const [selectedWeekDate, setSelectedWeekDate] = useState<Date>(new Date());

  const [bookingRules, setBookingRules] = useState<any>({
    cancel_deadline_minutes: 90,
    booking_cutoff_minutes: null,
    booking_window_days: 14,
    expired_pass_grace_days: 15,
    max_daily_bookings: null,
    max_daily_same_type_bookings: 1,
    min_participants: null,
    auto_cancel_deadline_minutes: null,
    cancel_deadline_per_class: {},
    booking_cutoff_per_class: {},
    booking_window_per_pass: {},
    expired_pass_grace_per_pass: {},
    min_participants_per_class: {},
    auto_cancel_deadline_per_class: {},
  });

  // PRECYZYJNY HELPER ROZWIĄZYWANIA ZAJĘĆ
  const findClassDetails = (classId: string | number, dateStr: string) => {
    if (!dateStr) return null;
    let d = 1, m = 1;
    const now = new Date();
    let year = now.getFullYear();

    if (dateStr.includes('-')) {
      const parts = dateStr.split('-').map(Number);
      if (parts.length === 3) {
        year = parts[0];
        m = parts[1];
        d = parts[2];
      }
    } else if (dateStr.includes('/')) {
      const parts = dateStr.split('/').map(Number);
      d = parts[0];
      m = parts[1];
      const currentMonth = now.getMonth() + 1;
      const currentDay = now.getDate();
      
      if (m < currentMonth || (m === currentMonth && d < currentDay)) {
        year = now.getFullYear() + 1;
      } else {
        year = now.getFullYear();
      }
    }

    const dayDate = new Date(year, m - 1, d);
    const dayOfWeek = dayDate.getDay();
    const dayKeys = ['nd', 'pon', 'wt', 'sr', 'czw', 'pt', 'sob'];
    const dayKey = dayKeys[dayOfWeek] || 'pon';
    const displayDateStr = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
    const isoDateStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const jednorazClass = jednorazoweZajecia.find(j => 
      String(j.id) === String(classId) && 
      (j.fullDateStr === isoDateStr || j.displayDate === displayDateStr || j.displayDate === dateStr)
    );

    const stdClass = zapisaneZajecia.find(z => 
      String(z.id) === String(classId) && z.days && z.days[dayKey] === true
    );

    const baseClass = jednorazClass || stdClass;
    if (!baseClass) return null;

    const classKey = `${classId}_${dateStr}`;
    const override = nadpisaneZajeciaDni[classKey] || 
      nadpisaneZajeciaDni[`${classId}_${isoDateStr}`] || 
      nadpisaneZajeciaDni[`${classId}_${displayDateStr}`];

    if (override) {
      if (override.isUsunięte) return null;
      return {
        ...baseClass,
        ...override,
        targetDayDate: dayDate,
        displayDateStr,
        isoDateStr,
        dayKey
      };
    }

    return {
      ...baseClass,
      targetDayDate: dayDate,
      displayDateStr,
      isoDateStr,
      dayKey
    };
  };

  // PRECYZYJNA KALKULACJA ODLICZANIA DO KOŃCA MOŻLIWOŚCI WYPISANIA
  const getCancelDeadlineInfo = (classItem: any, displayDate: string) => {
    if (!classItem || classItem.isOdwołane || classItem.isUsunięte) return null;
    const trainingName = classItem.title || '';
    const cancelDeadlineMinutes = bookingRules.cancel_deadline_per_class?.[trainingName] !== undefined
      ? Number(bookingRules.cancel_deadline_per_class[trainingName])
      : Number(bookingRules.cancel_deadline_minutes ?? 90);

    if (!displayDate || !classItem.start) return null;

    let d = 1, m = 1;
    if (displayDate.includes('/')) {
      [d, m] = displayDate.split('/').map(Number);
    } else if (displayDate.includes('-')) {
      const p = displayDate.split('-').map(Number);
      m = p[1];
      d = p[2];
    }

    const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
    const [sh = '00', sm = '00'] = (classItem.start || '00:00').split(':');
    const classStartDateTime = new Date(classYear, m - 1, d, parseInt(sh), parseInt(sm), 0);
    const now = new Date();
    const diffMinutes = (classStartDateTime.getTime() - now.getTime()) / (1000 * 60);

    if (diffMinutes <= 0) {
      return {
        canCancel: false,
        status: 'past',
        label: 'Zajęcia zakończone',
        minutesLeftToCancel: 0
      };
    }

    if (diffMinutes <= cancelDeadlineMinutes) {
      return {
        canCancel: false,
        status: 'locked',
        label: 'Minął czas na bezpłatny wypis',
        minutesLeftToCancel: 0
      };
    }

    const minutesLeft = Math.floor(diffMinutes - cancelDeadlineMinutes);

    if (minutesLeft <= 120) {
      const hours = Math.floor(minutesLeft / 60);
      const mins = minutesLeft % 60;
      const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      return {
        canCancel: true,
        status: 'countdown',
        label: `⏱️ Wypis możliwy jeszcze przez: ${timeStr}`,
        minutesLeftToCancel: minutesLeft
      };
    }

    return {
      canCancel: true,
      status: 'open',
      label: `Wypis do ${cancelDeadlineMinutes} min przed startem`,
      minutesLeftToCancel: minutesLeft
    };
  };

  const getProgrammedWorkout = (classItem: any, isoDate?: string, displayDate?: string) => {
    if (!classItem || !classItem.title) return null;
    const matchedRodzaj = rodzajeZajec.find((r: any) => (r.nazwa || '').trim().toLowerCase() === (classItem.title || '').trim().toLowerCase());
    if (!matchedRodzaj || !matchedRodzaj.programowanieTreningow || !Array.isArray(matchedRodzaj.programowanieList) || matchedRodzaj.programowanieList.length === 0) {
      return null;
    }
    const list = matchedRodzaj.programowanieList;
    if (list.length === 0) return null;

    const dayKeys = ['pon', 'wt', 'sr', 'czw', 'pt'];
    const weeklySlots: { key: string; dayIndex: number; start: string }[] = [];
    
    zapisaneZajecia
      .filter((z: any) => (z.title || '').trim().toLowerCase() === (classItem.title || '').trim().toLowerCase())
      .forEach((z: any) => {
        dayKeys.forEach((k, dIdx) => {
          if (z.days && z.days[k]) {
            weeklySlots.push({ key: k, dayIndex: dIdx, start: z.start || '00:00' });
          }
        });
      });

    weeklySlots.sort((a, b) => {
      if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
      return (a.start || '').localeCompare(b.start || '');
    });

    let targetDate: Date;
    if (isoDate && isoDate.includes('-')) {
      const [y, m, d] = isoDate.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
    } else if (displayDate && displayDate.includes('/')) {
      const [d, m] = displayDate.split('/').map(Number);
      const y = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
      targetDate = new Date(y, m - 1, d);
    } else {
      targetDate = new Date();
    }

    const baseDate = new Date(2026, 0, 5); 
    const diffMs = targetDate.getTime() - baseDate.getTime();
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    const dayOfWeek = targetDate.getDay();
    const currentDayIdx = dayOfWeek >= 1 && dayOfWeek <= 5 ? dayOfWeek - 1 : 0;

    const slotsCount = weeklySlots.length > 0 ? weeklySlots.length : 1;
    const currentSlotIndex = weeklySlots.findIndex(s => s.dayIndex === currentDayIdx && s.start === classItem.start);
    const safeSlotIdx = currentSlotIndex >= 0 ? currentSlotIndex : (currentDayIdx % slotsCount);

    const totalStep = Math.max(0, (diffWeeks * slotsCount) + safeSlotIdx);
    const workoutIndex = totalStep % list.length;
    
    return {
      index: workoutIndex + 1,
      total: list.length,
      workout: list[workoutIndex]
    };
  };

  const processWaitlistCutoffs = async (
    classes: any[],
    jednorazowe: any[],
    signupsMap: { [key: string]: any[] },
    overridesMap: { [key: string]: any },
    days: any[]
  ) => {
    const now = new Date();
    let hasChanges = false;

    for (const col of days) {
      const stdDnia = classes
        .filter((item: any) => item.days && item.days[col.key])
        .map((item: any) => {
          const classKey = `${item.id}_${col.date}`;
          const override = overridesMap[classKey];
          return override ? { ...item, ...override, classKey } : { ...item, classKey };
        });

      const jednorazDnia = jednorazowe
        .filter((item: any) => item.displayDate === col.date)
        .map((item: any) => {
          const classKey = `${item.id}_${col.date}`;
          const override = overridesMap[classKey];
          return override ? { ...item, ...override, classKey } : { ...item, classKey };
        });

      const allClasses = [...stdDnia, ...jednorazDnia];

      for (const cls of allClasses) {
        if (cls.isOdwołane || cls.isUsunięte) continue;

        const classSignups = signupsMap[cls.classKey] || [];
        const waitlistSignups = classSignups.filter((s: any) => s.status === 'krzesełko');

        if (waitlistSignups.length === 0) continue;

        const [dStr, mStr] = col.date.split('/');
        const classYear = col.fullDate ? col.fullDate.getFullYear() : now.getFullYear();
        const [sh = '00', sm = '00'] = (cls.start || '00:00').split(':');
        const classStartDateTime = new Date(classYear, parseInt(mStr) - 1, parseInt(dStr), parseInt(sh), parseInt(sm), 0);
        const diffMinutes = (classStartDateTime.getTime() - now.getTime()) / (1000 * 60);

        for (const wMember of waitlistSignups) {
          const cutoffMin = wMember.waitlist_cutoff_minutes !== undefined && wMember.waitlist_cutoff_minutes !== null 
            ? Number(wMember.waitlist_cutoff_minutes) 
            : 30;

          if (diffMinutes <= cutoffMin && diffMinutes >= 0) {
            hasChanges = true;
            const keysToDelete = getKeysVariants(cls.id, col.date);

            await supabase
              .from('zapisy_zajec')
              .delete()
              .in('class_key', keysToDelete)
              .eq('klient_id', Number(wMember.id));

            const { data: clientData } = await supabase.from('klienci').select('*').eq('id', wMember.id).maybeSingle();
            if (clientData) {
              let parsedKarnety = [];
              if (Array.isArray(clientData.karnetyKlubowicza)) parsedKarnety = clientData.karnetyKlubowicza;
              else if (typeof clientData.karnetyKlubowicza === 'string') {
                try { parsedKarnety = JSON.parse(clientData.karnetyKlubowicza); } catch(e) {}
              }

              const passIndex = parsedKarnety.findIndex((k: any) => isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
              if (passIndex !== -1) {
                const currentRemaining = parseInt(parsedKarnety[passIndex].pozostaloWejsc, 10);
                const poczatkowe = parseInt(parsedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
                parsedKarnety[passIndex] = {
                  ...parsedKarnety[passIndex],
                  pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
                };
                await supabase.from('klienci').update({ karnetyKlubowicza: parsedKarnety }).eq('id', wMember.id);
              }

              const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
              const dayName = dayNames[classStartDateTime.getDay()];
              const formattedDate = `${dayName}, ${col.date}.${classYear}`;
              const durationText = calculateDuration(cls.start, cls.end);

              await supabase.from('transakcje').insert([{
                klient_id: wMember.id,
                typ_operacji: 'zajecia_wypis',
                class_key: cls.classKey,
                opis: `Automatyczne zwolnienie z krzesełka: ${cls.title} (${formattedDate} ${cls.start}-${cls.end || ''}, ${durationText}) - upłynął wybrany czas gotowości (${cutoffMin} min przed startem). Zwrócono 1 wejście.`
              }]);
            }

            await sendPushNotification(wMember.id, {
              title: `Zwolniono miejsce na liście rezerwowej: ${cls.title}`,
              body: `Zostałeś automatycznie wypisany z listy rezerwowej treningu ${cls.title} (${col.date} ${cls.start}), ponieważ do zajęć zostało mniej niż ${cutoffMin} min. Zwrócono wejście.`,
              url: '/'
            });

            await supabase.from('booking_logs').insert([{
              action_type: 'WAITLIST_CUTOFF_EXPIRED',
              status: 'SUCCESS',
              reason: `Klubowicz ID:${wMember.id} usunięty z listy rezerwowej ${cls.classKey} (upłynął limit ${cutoffMin} min).`,
              rule_applied: 'waitlist_cutoff_auto_removal',
              payload: { class_key: cls.classKey, klient_id: wMember.id, cutoff_minutes: cutoffMin }
            }]);
          }
        }
      }
    }

    return hasChanges;
  };

  const processAutoCancellations = async (
    classes: any[],
    jednorazowe: any[],
    signupsMap: { [key: string]: any[] },
    overridesMap: { [key: string]: any },
    rules: any,
    days: any[]
  ) => {
    const now = new Date();
    let hasChanges = false;

    for (const col of days) {
      const stdDnia = classes
        .filter((item: any) => item.days && item.days[col.key])
        .map((item: any) => {
          const classKey = `${item.id}_${col.date}`;
          const override = overridesMap[classKey];
          return override ? { ...item, ...override, classKey } : { ...item, classKey };
        });

      const jednorazDnia = jednorazowe
        .filter((item: any) => item.displayDate === col.date)
        .map((item: any) => {
          const classKey = `${item.id}_${col.date}`;
          const override = overridesMap[classKey];
          return override ? { ...item, ...override, classKey } : { ...item, classKey };
        });

      const allClasses = [...stdDnia, ...jednorazDnia];

      for (const cls of allClasses) {
        if (cls.isOdwołane || cls.isUsunięte) continue;

        const trainingName = cls.title || '';
        const minRequired = rules.min_participants_per_class?.[trainingName] !== undefined
          ? rules.min_participants_per_class[trainingName]
          : rules.min_participants;
        
        const deadlineMins = rules.auto_cancel_deadline_per_class?.[trainingName] !== undefined
          ? rules.auto_cancel_deadline_per_class[trainingName]
          : rules.auto_cancel_deadline_minutes;

        if (minRequired && minRequired > 0 && deadlineMins !== null && deadlineMins !== undefined && deadlineMins > 0) {
          const [dStr, mStr] = col.date.split('/');
          const classYear = col.fullDate ? col.fullDate.getFullYear() : now.getFullYear();
          const [sh = '00', sm = '00'] = (cls.start || '00:00').split(':');
          const classStartDateTime = new Date(classYear, parseInt(mStr) - 1, parseInt(dStr), parseInt(sh), parseInt(sm), 0);
          const diffMinutes = (classStartDateTime.getTime() - now.getTime()) / (1000 * 60);

          if (diffMinutes <= deadlineMins && diffMinutes >= 0) {
            const classSignups = signupsMap[cls.classKey] || [];
            const activeSignups = classSignups.filter((s: any) => s.status === 'zapisany');

            if (activeSignups.length < minRequired) {
              hasChanges = true;
              
              const allVariantKeys = getKeysVariants(cls.id, col.date);
              for (const vKey of allVariantKeys) {
                await supabase.from('nadpisania_zajec').upsert({
                  class_key: vKey,
                  start: cls.start,
                  end: cls.end,
                  trainer: cls.trainer,
                  limit: cls.limit,
                  is_odwolane: true,
                  is_usuniete: false
                });
              }

              const participantIds: number[] = [];
              const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
              const dayName = dayNames[classStartDateTime.getDay()];
              const formattedDate = `${dayName}, ${col.date}.${classYear}`;
              const durationText = calculateDuration(cls.start, cls.end);

              for (const participant of classSignups) {
                participantIds.push(participant.id);
                const { data: clientData } = await supabase.from('klienci').select('*').eq('id', participant.id).maybeSingle();
                if (clientData) {
                  let parsedKarnety = [];
                  if (Array.isArray(clientData.karnetyKlubowicza)) parsedKarnety = clientData.karnetyKlubowicza;
                  else if (typeof clientData.karnetyKlubowicza === 'string') {
                    try { parsedKarnety = JSON.parse(clientData.karnetyKlubowicza); } catch(e) {}
                  }

                  const passIndex = parsedKarnety.findIndex((k: any) => isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
                  if (passIndex !== -1) {
                    const currentRemaining = parseInt(parsedKarnety[passIndex].pozostaloWejsc, 10);
                    const poczatkowe = parseInt(parsedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
                    parsedKarnety[passIndex] = {
                      ...parsedKarnety[passIndex],
                      pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
                    };
                    await supabase.from('klienci').update({ karnetyKlubowicza: parsedKarnety }).eq('id', participant.id);
                  }

                  await supabase.from('transakcje').insert([{
                    klient_id: participant.id,
                    typ_operacji: 'zajecia_wypis',
                    class_key: cls.classKey,
                    opis: `Automatyczne odwołanie zajęć: ${cls.title} (${formattedDate} ${cls.start}-${cls.end || ''}, ${durationText}) z powodu zbyt małej liczby osób (${activeSignups.length}/${minRequired}). Zwrócono 1 wejście.`
                  }]);
                }
              }

              if (participantIds.length > 0) {
                await sendPushNotification(participantIds, {
                  title: `Odwołano trening: ${cls.title}`,
                  body: `Trening ${cls.title} w dniu ${col.date} o godz. ${cls.start} został odwołany z powodu zbyt małej liczby uczestników (${activeSignups.length}/${minRequired}). Zwrócono wejście.`,
                  url: '/'
                });
              }

              const keysToDelete = getKeysVariants(cls.id, col.date);
              await supabase.from('zapisy_zajec').delete().in('class_key', keysToDelete);

              await supabase.from('booking_logs').insert([{
                action_type: 'CLASS_AUTO_CANCELLED',
                status: 'SUCCESS',
                reason: `Zajęcia ${cls.title} (${cls.classKey}) odwołane automatycznie (${activeSignups.length}/${minRequired} os.). Wypisano ${classSignups.length} osób (w tym krzesełko) i zwrócono wejścia.`,
                rule_applied: 'min_participants_auto_cancel',
                payload: { class_key: cls.classKey, participants_count: activeSignups.length, min_required: minRequired }
              }]);
            }
          }
        }
      }
    }

    return hasChanges;
  };

  // SILNIK NATYCHMIASTOWEGO ODWOŁYWANIA PO WYPISANIU UCZESTNIKA
  const checkAndTriggerImmediateAutoCancel = async (
    classItem: any,
    displayDate: string,
    currentRemainingSignups: any[]
  ) => {
    if (!classItem || classItem.isOdwołane || classItem.isUsunięte) return false;
    
    const trainingName = classItem.title || '';
    const minRequired = bookingRules.min_participants_per_class?.[trainingName] !== undefined
      ? bookingRules.min_participants_per_class[trainingName]
      : bookingRules.min_participants;
    
    const deadlineMins = bookingRules.auto_cancel_deadline_per_class?.[trainingName] !== undefined
      ? bookingRules.auto_cancel_deadline_per_class[trainingName]
      : bookingRules.auto_cancel_deadline_minutes;

    if (minRequired && minRequired > 0 && deadlineMins !== null && deadlineMins !== undefined && deadlineMins > 0) {
      let d = 1, m = 1;
      if (displayDate.includes('/')) {
        [d, m] = displayDate.split('/').map(Number);
      } else if (displayDate.includes('-')) {
        const p = displayDate.split('-').map(Number);
        m = p[1];
        d = p[2];
      }
      const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
      const [sh = '00', sm = '00'] = (classItem.start || '00:00').split(':');
      const classStartDateTime = new Date(classYear, m - 1, d, parseInt(sh), parseInt(sm), 0);
      const now = new Date();
      const diffMinutes = (classStartDateTime.getTime() - now.getTime()) / (1000 * 60);

      if (diffMinutes <= deadlineMins && diffMinutes >= 0) {
        const activeSignups = currentRemainingSignups.filter((s: any) => s.status === 'zapisany');
        if (activeSignups.length < minRequired) {
          const classKey = `${classItem.id}_${displayDate}`;
          const allVariantKeys = getKeysVariants(classItem.id, displayDate);

          for (const vKey of allVariantKeys) {
            await supabase.from('nadpisania_zajec').upsert({
              class_key: vKey,
              start: classItem.start,
              end: classItem.end,
              trainer: classItem.trainer,
              limit: classItem.limit || 12,
              is_odwolane: true,
              is_usuniete: false
            });
          }

          const participantIds: number[] = [];
          const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
          const dayName = dayNames[classStartDateTime.getDay()];
          const formattedDate = `${dayName}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${classYear}`;
          const durationText = calculateDuration(classItem.start, classItem.end);

          for (const participant of currentRemainingSignups) {
            participantIds.push(participant.id);
            const { data: clientData } = await supabase.from('klienci').select('*').eq('id', participant.id).maybeSingle();
            if (clientData) {
              let parsedKarnety = [];
              if (Array.isArray(clientData.karnetyKlubowicza)) parsedKarnety = clientData.karnetyKlubowicza;
              else if (typeof clientData.karnetyKlubowicza === 'string') {
                try { parsedKarnety = JSON.parse(clientData.karnetyKlubowicza); } catch(e) {}
              }

              const passIndex = parsedKarnety.findIndex((k: any) => isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
              if (passIndex !== -1) {
                const currentRemaining = parseInt(parsedKarnety[passIndex].pozostaloWejsc, 10);
                const poczatkowe = parseInt(parsedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
                parsedKarnety[passIndex] = {
                  ...parsedKarnety[passIndex],
                  pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
                };
                await supabase.from('klienci').update({ karnetyKlubowicza: parsedKarnety }).eq('id', participant.id);
              }

              await supabase.from('transakcje').insert([{
                klient_id: participant.id,
                typ_operacji: 'zajecia_wypis',
                class_key: classKey,
                opis: `Automatyczne odwołanie zajęć: ${classItem.title} (${formattedDate} ${classItem.start}-${classItem.end || ''}, ${durationText}) po wypisaniu uczestnika (pozostało: ${activeSignups.length}/${minRequired} os.). Zwrócono 1 wejście.`
              }]);
            }
          }

          if (participantIds.length > 0) {
            await sendPushNotification(participantIds, {
              title: `Odwołano trening: ${classItem.title}`,
              body: `Trening ${classItem.title} w dniu ${displayDate} o godz. ${classItem.start} został automatycznie odwołany z powodu zbyt małej liczby osób (${activeSignups.length}/${minRequired}). Zwrócono wejście.`,
              url: '/'
            });
          }

          await supabase.from('zapisy_zajec').delete().in('class_key', allVariantKeys);

          await supabase.from('booking_logs').insert([{
            action_type: 'CLASS_AUTO_CANCELLED_ON_UNENROLL',
            status: 'SUCCESS',
            reason: `Zajęcia ${classItem.title} (${classKey}) odwołane natychmiast po wypisaniu uczestnika (${activeSignups.length}/${minRequired} os.). Wypisano ${currentRemainingSignups.length} osób i zwrócono wejścia.`,
            rule_applied: 'min_participants_auto_cancel_immediate',
            payload: { class_key: classKey, participants_count: activeSignups.length, min_required: minRequired }
          }]);

          return true;
        }
      }
    }
    return false;
  };

  const checkClassAutoCancellation = (classItem: any, displayDate: string, signups: any[]) => {
    if (!classItem || classItem.isUsunięte) return { isAutoCancelled: false, reason: '' };
    if (classItem.isOdwołane) return { isAutoCancelled: true, reason: 'ODWOŁANE PRZEZ KLUB' };
    
    const trainingName = classItem.title || '';
    const minRequired = bookingRules.min_participants_per_class?.[trainingName] !== undefined
      ? bookingRules.min_participants_per_class[trainingName]
      : bookingRules.min_participants;
    
    const deadlineMins = bookingRules.auto_cancel_deadline_per_class?.[trainingName] !== undefined
      ? bookingRules.auto_cancel_deadline_per_class[trainingName]
      : bookingRules.auto_cancel_deadline_minutes;

    if (minRequired && minRequired > 0 && deadlineMins !== null && deadlineMins !== undefined && deadlineMins > 0) {
      let d = 1, m = 1;
      if (displayDate.includes('/')) {
        [d, m] = displayDate.split('/').map(Number);
      } else if (displayDate.includes('-')) {
        const p = displayDate.split('-').map(Number);
        m = p[1];
        d = p[2];
      }
      const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
      const [sh = '00', sm = '00'] = (classItem.start || '00:00').split(':');
      const classStartDateTime = new Date(classYear, m - 1, d, parseInt(sh), parseInt(sm), 0);
      const now = new Date();
      const diffMinutes = (classStartDateTime.getTime() - now.getTime()) / (1000 * 60);

      if (diffMinutes <= deadlineMins && diffMinutes >= 0) {
        const activeCount = Array.isArray(signups) ? signups.filter(s => s.status === 'zapisany').length : 0;
        if (activeCount < minRequired) {
          return {
            isAutoCancelled: true,
            reason: `ODWOŁANE (Brak min. liczby osób: ${activeCount}/${minRequired})`
          };
        }
      }
    }
    return { isAutoCancelled: false, reason: '' };
  };

  const isBirthdayOnDate = (birthDateStr?: string, classDisplayDate?: string, classIsoDate?: string) => {
    if (!birthDateStr) return false;
    let bDay: number | null = null;
    let bMonth: number | null = null;

    if (birthDateStr.includes('-')) {
      const parts = birthDateStr.split('-');
      if (parts.length === 3) {
        bMonth = parseInt(parts[1], 10);
        bDay = parseInt(parts[2], 10);
      }
    } else if (birthDateStr.includes('.')) {
      const parts = birthDateStr.split('.');
      if (parts.length >= 2) {
        bDay = parseInt(parts[0], 10);
        bMonth = parseInt(parts[1], 10);
      }
    } else if (birthDateStr.includes('/')) {
      const parts = birthDateStr.split('/');
      if (parts.length >= 2) {
        bDay = parseInt(parts[0], 10);
        bMonth = parseInt(parts[1], 10);
      }
    }

    if (bDay === null || bMonth === null || isNaN(bDay) || isNaN(bMonth)) return false;

    let cDay: number | null = null;
    let cMonth: number | null = null;

    if (classDisplayDate && classDisplayDate.includes('/')) {
      const parts = classDisplayDate.split('/');
      cDay = parseInt(parts[0], 10);
      cMonth = parseInt(parts[1], 10);
    } else if (classIsoDate && classIsoDate.includes('-')) {
      const parts = classIsoDate.split('-');
      cMonth = parseInt(parts[1], 10);
      cDay = parseInt(parts[2], 10);
    }

    if (cDay === null || cMonth === null || isNaN(cDay) || isNaN(cMonth)) return false;

    return bDay === cDay && bMonth === cMonth;
  };

  const isContractPass = (k: any) => {
    if (!k) return false;
    const lower = (k.nazwa || k.pass || '').toLowerCase();
    const typ = (k.typKarnetu || k.typ_karnetu || '').toLowerCase();
    return k.isContract12M === true || typ.includes('umowa') || lower.includes('umowa');
  };

  const isTimePass = (k: any) => {
    if (!k) return false;
    if (isContractPass(k)) return true;
    const lower = (k.nazwa || k.pass || '').toLowerCase();
    const typ = (k.typKarnetu || k.typ_karnetu || '').toLowerCase();
    if (typ === 'na czas' || typ.includes('czas')) return true;
    if (lower.includes('open') || lower.includes('miesiąc') || lower.includes('miesiac') || lower.includes('rok') || lower.includes('czasowy')) {
      if (typ === 'na ilość treningów' || typ.includes('ilość') || typ.includes('trening')) return false;
      return true;
    }
    return false;
  };

  const isQuantityPass = (k: any) => {
    if (!k) return false;
    if (isTimePass(k)) return false;
    const typ = (k.typKarnetu || k.typ_karnetu || '').toLowerCase();
    if (typ === 'na ilość treningów' || typ.includes('ilość') || typ.includes('trening')) return true;
    return k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined;
  };

  const calculateContinuityDiscount = (client: any) => {
    if (!client) return { hasContinuity: false, percent: 0, label: '0% (Brak)' };
    const karnety = client.karnetyKlubowicza || [];
    if (karnety.length === 0) return { hasContinuity: false, percent: 0, label: '0% (Pierwszy zakup)' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let isContinuous = false;
    for (const k of karnety) {
      if (k.waznyDo) {
        const expDate = new Date(k.waznyDo);
        expDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today.getTime() - expDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 1) {
          if (isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined && k.pozostaloWejsc <= 0) {
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

    const liczbaKarnetow = karnety.length;
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

  const toggleDay = (dateStr: string) => setExpandedDays(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));

  const openProfile = (client: any) => {
    setProfileClient(client);
  };

  const getMonday = (d: Date) => {
    const dCopy = new Date(d);
    const day = dCopy.getDay();
    if (day === 6) { dCopy.setDate(dCopy.getDate() + 2); } else if (day === 0) { dCopy.setDate(dCopy.getDate() + 1); }
    const currentDayOfWeek = dCopy.getDay();
    const diff = dCopy.getDate() - currentDayOfWeek + (currentDayOfWeek === 0 ? -6 : 1);
    return new Date(dCopy.setDate(diff));
  };

  const getTopBorderColor = (title: string, isOdwolane: boolean, isUsunięte: boolean) => {
    if (isOdwolane || isUsunięte) return '#fda4af';
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

  const nextMonth = () => {
    if (!calendarViewDate) return;
    setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    if (!calendarViewDate) return;
    setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1));
  };

  const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

  // REF DLA OCHRONY PRZED PĘTLĄ ZAPYTANIA
  const isFetchingRef = useRef(false);

  // AUTOMATYCZNA WERYFIKACJA PŁATNOŚCI UMÓW (4. I 7. DZIEŃ MIESIĄCA)
  const checkContractPaymentEnforcement = async (allClients: any[]) => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const currentYear = today.getFullYear();
    const currentMonthNum = today.getMonth() + 1; // 1-12
    const firstDayOfCurrentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}-01`;
    const endOfCurrentMonth = new Date(currentYear, currentMonthNum, 0);
    const endOfCurrentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}-${String(endOfCurrentMonth.getDate()).padStart(2, '0')}`;

    // Weryfikujemy dyscyplinę płatności tylko od 4. dnia miesiąca
    if (dayOfMonth < 4) return;

    for (const client of allClients) {
      const hasContract = client.karnetyKlubowicza && client.karnetyKlubowicza.some((k: any) => isContractPass(k));
      if (!hasContract) continue;

      // Sprawdzamy pole umowa_oplacona_do
      const oplaconaDo = client.umowa_oplacona_do || client.umowaOplaconaDo;
      const czyOplaconyBiezacyMiesiac = oplaconaDo && String(oplaconaDo) >= firstDayOfCurrentMonthStr;

      if (!czyOplaconyBiezacyMiesiac) {
        const powod = "Nieopłacenie karnetu na umowę (brak wpłaty do 3. dnia miesiąca)";

        // 4. DZIEŃ MIESIĄCA - NAKŁADANIE BLOKADY ZAPISÓW
        const juzMaBlokadeUmowy = client.blokadaDo && client.powodBlokady === powod;
        if (!juzMaBlokadeUmowy) {
          const updatedClientKarnety = (client.karnetyKlubowicza || []).map((k: any) => ({
            ...k,
            blokadaDo: endOfCurrentMonthStr,
            powodBlokady: powod
          }));

          await supabase.from('klienci').update({
            blokadaDo: endOfCurrentMonthStr,
            powodBlokady: powod,
            karnetyKlubowicza: updatedClientKarnety
          }).eq('id', client.id);

          await supabase.from('booking_logs').insert([{
            action_type: 'CONTRACT_UNPAID_BLOCKED',
            status: 'BLOCKED',
            reason: `Klubowicz ID:${client.id} zablokowany z powodu braku wpłaty do 3. dnia miesiąca.`,
            rule_applied: 'contract_payment_day_4_enforcement',
            payload: { klient_id: client.id, umowa_oplacona_do: oplaconaDo, blokada_do: endOfCurrentMonthStr }
          }]);
        }

        // 7. DZIEŃ MIESIĄCA - AUTOMATYCZNE WYPISANIE ZE WSZYSTKICH ZAJĘĆ
        if (dayOfMonth >= 7) {
          await handleAutoWypiszPoZablokowaniu(client.id, client, powod, undefined);
        }
      }
    }
  };

  // RÓWNOLEGŁE POBIERANIE DANYCH
  const loadData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const twoWeeksAgoStr = `${twoWeeksAgo.getFullYear()}-${String(twoWeeksAgo.getMonth() + 1).padStart(2, '0')}-${String(twoWeeksAgo.getDate()).padStart(2, '0')}`;

      const oneYearForward = new Date();
      oneYearForward.setDate(oneYearForward.getDate() + 365);
      const oneYearForwardStr = `${oneYearForward.getFullYear()}-${String(oneYearForward.getMonth() + 1).padStart(2, '0')}-${String(oneYearForward.getDate()).padStart(2, '0')}`;

      const [
        rulesRes,
        sessionRes,
        trenerzyData,
        tData,
        karnetyDefData,
        klienciData,
        ogloszeniaData,
        szablonyData,
        rawJednorazoweRes,
        nadpisaniaData,
        zapisyData,
        rodzajeData,
        rawWydarzeniaRes,
        limityKlubowiczowData
      ] = await Promise.all([
        supabase.from('club_booking_rules').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.auth.getSession(),
        fetchAllFromSupabase('trenerzy', 'id', true, 20),
        fetchAllFromSupabase('transakcje', 'created_at', false, 50),
        fetchAllFromSupabase('karnety', 'id', true, 20),
        fetchAllFromSupabase('klienci', 'id', true, 50),
        fetchAllFromSupabase('ogloszenia', 'id', false, 20),
        fetchAllFromSupabase('grafik_zajec', 'id', true, 20),
        supabase.from('zajecia_jednorazowe').select('*').gte('full_date_str', twoWeeksAgoStr).lte('full_date_str', oneYearForwardStr).order('full_date_str', { ascending: true }),
        fetchAllFromSupabase('nadpisania_zajec', 'id', false, 50),
        fetchAllFromSupabase('zapisy_zajec', 'created_at', false, 50),
        fetchAllFromSupabase('rodzaje_zajec', 'id', true, 20),
        supabase.from('wydarzenia_kilkudniowe').select('*').gte('date_to', twoWeeksAgoStr).lte('date_from', oneYearForwardStr).order('date_from', { ascending: true }),
        fetchAllFromSupabase('indywidualne_limity_zapisow', 'created_at', false, 20)
      ]);

      if (limityKlubowiczowData) {
        setIndywidualneLimity(limityKlubowiczowData);
      }

      let parsedRules = { ...bookingRules };
      if (rulesRes.data) {
        const rulesData = rulesRes.data;
        parsedRules = {
          cancel_deadline_minutes: rulesData.cancel_deadline_minutes ?? 90,
          booking_cutoff_minutes: rulesData.booking_cutoff_minutes ?? null,
          booking_window_days: rulesData.booking_window_days ?? 14,
          expired_pass_grace_days: rulesData.expired_pass_grace_days ?? 15,
          max_daily_bookings: rulesData.max_daily_bookings ?? null,
          max_daily_same_type_bookings: 1,
          min_participants: rulesData.min_participants ?? null,
          auto_cancel_deadline_minutes: rulesData.auto_cancel_deadline_minutes ?? null,
          cancel_deadline_per_class: rulesData.cancel_deadline_per_class || {},
          booking_cutoff_per_class: rulesData.booking_cutoff_per_class || {},
          booking_window_per_pass: rulesData.booking_window_per_pass || {},
          expired_pass_grace_per_pass: rulesData.expired_pass_grace_per_pass || {},
          min_participants_per_class: rulesData.min_participants_per_class || {},
          auto_cancel_deadline_per_class: rulesData.auto_cancel_deadline_per_class || {},
        };
        setBookingRules(parsedRules);
        setDlugoscBlokady(String(rulesData.absence_ban_days || 3));
      }

      const userEmail = sessionRes.data?.session?.user?.email;
      if (trenerzyData) setZespolTrenerzy(trenerzyData);
      
      let determinedRole: 'admin' | 'trener' | 'klubowicz' = 'klubowicz';
      if (userEmail === 'maciejklaput@gmail.com') {
        determinedRole = 'admin';
        setAppRole('admin');
      } else {
        const trenerObj = trenerzyData?.find((t: any) => t.email === userEmail);
        if (trenerObj) {
          determinedRole = 'trener';
          setAppRole('trener');
          setCurrentTrenerProfile(trenerObj);
        } else {
          determinedRole = 'klubowicz';
          setAppRole('klubowicz');
        }
      }
      
      if (tData) setWszystkieTransakcje(tData);

      let ustrukturyzowaneKarnetyDef: any[] = [];
      if (karnetyDefData) {
        ustrukturyzowaneKarnetyDef = karnetyDefData.map((k: any) => {
          let meta: Record<string, any> = {};
          try { meta = JSON.parse(k.inne_ustawienia || '{}'); } catch(e) {}
          return {
            ...k,
            cena: k.cena_brutto || k.cena || '0.00',
            ilosc_wejsc: k.ilosc_wejsc || meta.ilosc_wejsc || meta.iloscTreningow || null,
            zaznaczoneZajecia: meta.zaznaczoneZajecia || meta.wybraneZajecia || [],
            dostep_do_zajec: k.dostep_do_zajec || 'wszystkich zajęć'
          };
        });
        setDostepneKarnety(ustrukturyzowaneKarnetyDef);
      }

      let matchedCurrentClient: any = null;
      if (klienciData) {
        const enriched = klienciData.map((c: any) => {
          let parsedKarnety = [];
          if (Array.isArray(c.karnetyKlubowicza)) {
            parsedKarnety = c.karnetyKlubowicza;
          } else if (typeof c.karnetyKlubowicza === 'string') {
            try { parsedKarnety = JSON.parse(c.karnetyKlubowicza); } catch(e) {}
          }

          parsedKarnety = parsedKarnety.map((k: any) => {
            const pasujacyDef = ustrukturyzowaneKarnetyDef.find(dk => (dk.nazwa || '').trim().toLowerCase() === (k.nazwa || '').trim().toLowerCase());
            const isTime = isTimePass(k) || (pasujacyDef && isTimePass(pasujacyDef));

            if (isTime) {
              k.pozostaloWejsc = null;
              k.poczatkoweWejsc = null;
            } else if (k.pozostaloWejsc === undefined || k.pozostaloWejsc === null) {
              if (pasujacyDef && pasujacyDef.ilosc_wejsc !== null) {
                const valWejsc = parseInt(pasujacyDef.ilosc_wejsc, 10);
                k.pozostaloWejsc = isNaN(valWejsc) ? null : valWejsc;
                k.poczatkoweWejsc = isNaN(valWejsc) ? null : valWejsc;
              }
            }

            k.dostepDo = k.dostepDo || k.dostep_do_zajec || pasujacyDef?.dostep_do_zajec || 'wszystkich zajęć';
            k.zaznaczoneZajecia = k.zaznaczoneZajecia || k.wybraneZajecia || pasujacyDef?.zaznaczoneZajecia || [];

            return k;
          });

          const powiazanyTrener = trenerzyData?.find((t: any) => t.email && t.email === (c['E-mail'] || c.email));
          const clientTransakcje = tData ? tData.filter((t: any) => t.klient_id === c.id) : [];

          return {
            ...c,
            _rawKarnety: c.karnetyKlubowicza,
            id: c.id,
            firstName: c.Imię || c.firstName || '',
            lastName: c.Nazwisko || c.lastName || '',
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
            birthDate: c.Urodziny || c.birthDate || '',
            blokadaDo: c.blokadaDo || c.blokada_do || (parsedKarnety[0]?.blokadaDo) || null,
            powodBlokady: c.powodBlokady || c.powod_blokady || (parsedKarnety[0]?.powodBlokady) || null,
            umowa_oplacona_do: c.umowa_oplacona_do || null,
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
        
        // Weryfikacja umów w tle
        checkContractPaymentEnforcement(enriched);
        
        if (userEmail) {
          matchedCurrentClient = enriched.find((c: any) => c.email === userEmail);
          if (matchedCurrentClient) {
            setCurrentUser(matchedCurrentClient);
            subscribeToPushNotifications(matchedCurrentClient.id);
          }
        }

        if (profileClient) {
          const currentActive = enriched.find((c: any) => c.id === profileClient.id);
          if (currentActive) {
            setProfileClient(currentActive);
          }
        }
      }
      // Ogłoszenia
      if (ogloszeniaData) {
        const activeUserId = matchedCurrentClient ? String(matchedCurrentClient.id) : null;
        const activeUserEmail = (userEmail || '').toLowerCase().trim();
        const activeUserName = matchedCurrentClient 
          ? `${matchedCurrentClient.firstName || ''} ${matchedCurrentClient.lastName || ''}`.toLowerCase().trim() 
          : '';
        const userPasses = (matchedCurrentClient?.karnetyKlubowicza || []).map((k: any) => (k.nazwa || '').toLowerCase().trim());
        if (matchedCurrentClient?.pass) userPasses.push(matchedCurrentClient.pass.toLowerCase().trim());

        const parsedOgloszenia = ogloszeniaData
          .map((o: any) => {
            let tArray: string[] = ['Wszystkich'];
            if (Array.isArray(o.target_array)) {
              tArray = o.target_array;
            } else if (typeof o.target_array === 'string') {
              try { tArray = JSON.parse(o.target_array); } catch (e) { tArray = [o.target_array]; }
            } else if (o.targetArray) {
              tArray = Array.isArray(o.targetArray) ? o.targetArray : [o.targetArray];
            }

            return {
              id: o.id,
              dateFrom: o.date_from || o.dateFrom || '',
              dateTo: o.date_to || o.dateTo || '',
              target: o.target || 'Wszystkich',
              targetArray: tArray,
              targetUserId: o.target_user_id || o.user_id || o.klient_id || o.targetUserId || null,
              content: o.content || o.tresc || '',
              isVisible: o.is_visible !== undefined ? o.is_visible : (o.isVisible !== undefined ? o.isVisible : true),
              createdAt: o.created_at || o.createdAt || ''
            };
          })
          .filter((o: any) => {
            if (determinedRole === 'admin') return true;
            if (!o.isVisible) return false;

            const dzisStr = new Date().toISOString().split('T')[0];
            if (o.dateFrom && o.dateFrom > dzisStr) return false;
            if (o.dateTo && o.dateTo < dzisStr) return false;

            if (o.targetUserId && activeUserId && String(o.targetUserId) === activeUserId) return true;

            const mainTarget = (o.target || '').toLowerCase().trim();
            const targetsList = (o.targetArray || []).map((t: string) => String(t).toLowerCase().trim());
            const allTargets = [mainTarget, ...targetsList];

            if (allTargets.includes('wszystkich') || allTargets.includes('wszyscy')) return true;
            if (determinedRole === 'klubowicz' && (allTargets.includes('klubowicz') || allTargets.includes('klubowicze'))) return true;
            if (determinedRole === 'trener' && (allTargets.includes('trener') || allTargets.includes('trenerzy'))) return true;

            if (activeUserId && allTargets.some(t => t === activeUserId || t === `id:${activeUserId}` || t.includes(`id: ${activeUserId}`))) return true;
            if (activeUserEmail && allTargets.some(t => t === activeUserEmail)) return true;
            if (activeUserName && allTargets.some(t => t.includes(activeUserName) || activeUserName.includes(t))) return true;

            if (userPasses.some((p: any) => allTargets.includes(p))) return true;

            return false;
          });

        setOgloszeniaList(parsedOgloszenia);
      }

      // Grafik stały
      let mappedSzablony: any[] = [];
      if (szablonyData) {
        mappedSzablony = szablonyData.map((s: any) => ({
          ...s,
          title: s.title || s.nazwa,
          start: s.start || s.start_time,
          end: s.end || s.end_time,
          limit: s.limit || s.limit_miejsc,
          trainer: s.trainer || s.prowadzacy,
          days: s.days || {},
          isOdwołane: false,
          isUsunięte: false
        }));
        setZapisaneZajecia(mappedSzablony);
      }

      // Zajęcia jednorazowe
      let mappedJednorazowe: any[] = [];
      const rawJednorazowe = rawJednorazoweRes.data;
      if (rawJednorazowe && rawJednorazowe.length > 0) {
        mappedJednorazowe = rawJednorazowe.map((j: any) => ({
          ...j,
          rawDbId: j.id,
          id: `j_${j.id}`,
          title: j.title || j.nazwa,
          start: j.start_time || j.start,
          end: j.end_time || j.end,
          limit: j.limit_miejsc || j.limit,
          trainer: j.trainer || j.prowadzacy,
          displayDate: j.display_date,
          fullDateStr: j.full_date_str,
          isJednorazowe: true,
          isOdwołane: false,
          isUsunięte: false
        }));
      } else {
        const fallbackJednorazowe = await fetchAllFromSupabase('zajecia_jednorazowe', 'id', false, 20);
        if (fallbackJednorazowe) {
          mappedJednorazowe = fallbackJednorazowe.map((j: any) => ({
            ...j,
            rawDbId: j.id,
            id: `j_${j.id}`,
            title: j.title || j.nazwa,
            start: j.start_time || j.start,
            end: j.end_time || j.end,
            limit: j.limit_miejsc || j.limit,
            trainer: j.trainer || j.prowadzacy,
            displayDate: j.display_date,
            fullDateStr: j.full_date_str,
            isJednorazowe: true,
            isOdwołane: false,
            isUsunięte: false
          }));
        }
      }
      setJednorazoweZajecia(mappedJednorazowe);

      // Nadpisania zajęć
      const nadpisaniaMap: { [key: string]: any } = {};
      if (nadpisaniaData) {
        nadpisaniaData.forEach((n: any) => {
          const itemVal = { 
            start: n.start, 
            end: n.end, 
            trainer: n.trainer, 
            limit: n.limit, 
            isOdwołane: n.is_odwolane, 
            isUsunięte: n.is_usuniete 
          };
          nadpisaniaMap[n.class_key] = itemVal;
          if (n.class_key && n.class_key.includes('_')) {
            const [cId, dPart] = n.class_key.split('_');
            const variants = getKeysVariants(cId, dPart);
            variants.forEach(vk => { nadpisaniaMap[vk] = itemVal; });
          }
        });
        setNadpisaneZajeciaDni(nadpisaniaMap);
      }

      // Zapisy na zajęcia (główna lista + krzesełko)
      const groupedZapisy: { [key: string]: any[] } = {};
      if (zapisyData) {
        const sortedZapisy = [...zapisyData].sort((a: any, b: any) => {
          if (a.created_at && b.created_at) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          if (a.id && b.id) return Number(a.id) - Number(b.id);
          return 0;
        });

        sortedZapisy.forEach((z: any) => {
          const entry = {
            ...z,
            id: z.klient_id,
            status: z.status || 'zapisany',
            waitlist_cutoff_minutes: z.waitlist_cutoff_minutes !== undefined && z.waitlist_cutoff_minutes !== null ? Number(z.waitlist_cutoff_minutes) : 30,
            obecny: z.obecny,
            nieobecny: z.nieobecny
          };

          if (!groupedZapisy[z.class_key]) groupedZapisy[z.class_key] = [];
          groupedZapisy[z.class_key].push(entry);

          if (z.class_key && z.class_key.includes('_')) {
            const [classId, datePart] = z.class_key.split('_');
            const allVariants = getKeysVariants(classId, datePart);
            allVariants.forEach(vKey => {
              if (!groupedZapisy[vKey]) groupedZapisy[vKey] = [];
              if (!groupedZapisy[vKey].some((item: any) => item.id === z.klient_id)) {
                groupedZapisy[vKey].push(entry);
              }
            });
          }
        });
        setZapisyNaZajecia(groupedZapisy);
      }

      // Bieżący tydzień grafiku i weryfikacja automatyzacji
      const currentMon = getMonday(selectedWeekDate);
      const activeDashboardDays = Array.from({ length: 5 }).map((_, index) => {
        const dayDate = new Date(currentMon);
        dayDate.setDate(currentMon.getDate() + index);
        const dayNames = ['PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK'];
        const keys = ['pon', 'wt', 'sr', 'czw', 'pt'];
        const dayStr = String(dayDate.getDate()).padStart(2, '0');
        const monthStr = String(dayDate.getMonth() + 1).padStart(2, '0');
        return { 
          day: dayNames[index], 
          key: keys[index], 
          date: `${dayStr}/${monthStr}`, 
          isoDate: `${dayDate.getFullYear()}-${monthStr}-${dayStr}`, 
          fullDate: dayDate 
        };
      });
      await processWaitlistCutoffs(
        mappedSzablony,
        mappedJednorazowe,
        groupedZapisy,
        nadpisaniaMap,
        activeDashboardDays
      );

      await processAutoCancellations(
        mappedSzablony,
        mappedJednorazowe,
        groupedZapisy,
        nadpisaniaMap,
        parsedRules,
        activeDashboardDays
      );

      // Rodzaje zajęć
      if (rodzajeData) {
        const parsedRodzaje = rodzajeData.map((item: any) => {
          let parsedUstawienia: any = {};
          try {
            parsedUstawienia = typeof item.ustawienia === 'string' ? JSON.parse(item.ustawienia) : (item.ustawienia || {});
          } catch(e) {
            parsedUstawienia = {};
          }
          return {
            id: item.id,
            nazwa: item.nazwa || '',
            kolor: item.kolor || '#7bc043',
            ...parsedUstawienia
          };
        });
        setRodzajeZajec(parsedRodzaje);
      }
      
      // Wydarzenia jedno- i kilkudniowe
      const rawWydarzenia = rawWydarzeniaRes.data;
      if (rawWydarzenia && rawWydarzenia.length > 0) {
        setWydarzeniaKilkudniowe(rawWydarzenia.map((w: any) => ({ 
          id: w.id, 
          title: w.title, 
          dateFrom: w.date_from, 
          dateTo: w.date_to 
        })));
      } else {
        const fallbackWydarzenia = await fetchAllFromSupabase('wydarzenia_kilkudniowe', 'date_from', true, 20);
        if (fallbackWydarzenia) {
          setWydarzeniaKilkudniowe(fallbackWydarzenia.map((w: any) => ({ 
            id: w.id, 
            title: w.title, 
            dateFrom: w.date_from, 
            dateTo: w.date_to 
          })));
        }
      }

    } catch (err) {
      console.error("Błąd podczas ładowania danych Dashboardu:", err);
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zapisy_zajec' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automatyczne_zapisy' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'klienci' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nadpisania_zajec' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wydarzenia_kilkudniowe' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'indywidualne_limity_zapisow' }, () => loadData())
      .subscribe();

    window.addEventListener('storage', loadData);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('storage', loadData);
    };
  }, [selectedWeekDate]);
  
  // OBSŁUGA HISTORII ZAJĘĆ (MODAL HISTORII)
  const openHistoryModal = async (item: any, displayDate: string) => {
    setHistoryModalClass({ ...item, displayDate });
    setModalHistoryData([]); 
    const keys = getKeysVariants(item.id, displayDate);
    
    const { data } = await supabase
      .from('transakcje')
      .select('*')
      .in('class_key', keys)
      .order('created_at', { ascending: false });

    if (data) {
      setModalHistoryData(data);
    }
  };

  // OBSŁUGA WYDARZEŃ JEDNODNIOWYCH I KILKUDNIOWYCH (OBOZY, DNI SPECJALNE ITP.)
  const handleSaveMultiDayEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!multiDayTitle.trim()) {
      showToast("Podaj nazwę wydarzenia!", 'warning');
      return;
    }

    const effectiveDateTo = eventModeType === 'jednodniowe' ? multiDayFrom : multiDayTo;

    const { error } = await supabase.from('wydarzenia_kilkudniowe').insert([
      {
        title: multiDayTitle.toUpperCase(),
        date_from: multiDayFrom,
        date_to: effectiveDateTo
      }
    ]);

    if (error) {
      console.error("Błąd dodawania wydarzenia:", error);
      showToast("Nie udało się zapisać wydarzenia: " + error.message, 'error');
      return;
    }

    const currentMon = getMonday(selectedWeekDate);
    const daysList = Array.from({ length: 5 }).map((_, index) => {
      const dayDate = new Date(currentMon);
      dayDate.setDate(currentMon.getDate() + index);
      const keys = ['pon', 'wt', 'sr', 'czw', 'pt'];
      const dayStr = String(dayDate.getDate()).padStart(2, '0');
      const monthStr = String(dayDate.getMonth() + 1).padStart(2, '0');
      return {
        key: keys[index],
        date: `${dayStr}/${monthStr}`,
        isoDate: `${dayDate.getFullYear()}-${monthStr}-${dayStr}`,
        fullDate: dayDate
      };
    });

    for (const col of daysList) {
      if (col.isoDate >= multiDayFrom && col.isoDate <= effectiveDateTo) {
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
          const keysToDelete = getKeysVariants(item.id, col.date);
          const zapisani = zapisyNaZajecia[classKey] || [];
          const participantIds: number[] = [];
          
          const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
          const dayName = dayNames[col.fullDate.getDay()];
          const formattedDate = `${dayName}, ${col.date}.${col.fullDate.getFullYear()}`;
          const durationText = calculateDuration(item.start, item.end);

          for (const u of zapisani) {
            participantIds.push(u.id);
            const { data: clientData } = await supabase.from('klienci').select('*').eq('id', u.id).maybeSingle();
            if (clientData) {
              let parsedKarnety = [];
              if (Array.isArray(clientData.karnetyKlubowicza)) parsedKarnety = clientData.karnetyKlubowicza;
              else if (typeof clientData.karnetyKlubowicza === 'string') {
                try { parsedKarnety = JSON.parse(clientData.karnetyKlubowicza); } catch(e) {}
              }

              const passIndex = parsedKarnety.findIndex((k: any) => isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
              if (passIndex !== -1) {
                const currentRemaining = parseInt(parsedKarnety[passIndex].pozostaloWejsc, 10);
                const poczatkowe = parseInt(parsedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
                parsedKarnety[passIndex] = {
                  ...parsedKarnety[passIndex],
                  pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
                };
                await supabase.from('klienci').update({ karnetyKlubowicza: parsedKarnety }).eq('id', u.id);
              }

              await supabase.from('transakcje').insert([{
                klient_id: u.id,
                typ_operacji: 'zajecia_wypis',
                class_key: classKey,
                opis: `Wypisano z zajęć: ${item.title} (${formattedDate} ${item.start}-${item.end || ''}, ${durationText}) z powodu wydarzenia "${multiDayTitle}". Zwrócono 1 wejście.`
              }]);
            }
          }

          if (participantIds.length > 0) {
            await sendPushNotification(participantIds, {
              title: `Odwołano zajęcia: ${item.title}`,
              body: `Zajęcia "${item.title}" w dniu ${col.date} o godz. ${item.start} zostały odwołane z powodu wydarzenia "${multiDayTitle}". Zwrócono wejście.`,
              url: '/'
            });
          }

          await supabase.from('zapisy_zajec').delete().in('class_key', keysToDelete);
        }
      }
    }

    setIsMultiDayModalOpen(false);
    setMultiDayTitle('OBÓZ W WAŁCZU');
    loadData();
    showToast(`Pomyślnie dodano wydarzenie "${multiDayTitle.toUpperCase()}"!`);
  };

  const handleDeleteMultiDayEvent = async (id: number) => {
    if (confirm("Czy na pewno chcesz usunąć to wydarzenie? Zajęcia zostaną przywrócone bez zapisanych użytkowników.")) {
      await supabase.from('wydarzenia_kilkudniowe').delete().eq('id', id);
      loadData();
      showToast("Wydarzenie zostało usunięte.");
    }
  };

  // EDYCJA GODZIN / TRENERA / LIMITU ZAJĘĆ
  const handleSaveClassEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClassModalData) return;

    const newStart = `${editStartHour.padStart(2, '0')}:${editStartMin.padStart(2, '0')}`;
    const newEnd = `${editEndHour.padStart(2, '0')}:${editEndMin.padStart(2, '0')}`;
    const newLimitNum = parseInt(editLimit, 10) || 12;

    const classKey = `${editClassModalData.id}_${editClassModalData.displayDate}`;
    const allVariantKeys = getKeysVariants(editClassModalData.id, editClassModalData.displayDate);

    for (const vKey of allVariantKeys) {
      await supabase.from('nadpisania_zajec').upsert({
        class_key: vKey,
        start: newStart,
        end: newEnd,
        trainer: editTrainer,
        limit: newLimitNum,
        is_odwolane: editClassModalData.isOdwołane || false,
        is_usuniete: editClassModalData.isUsunięte || false
      });
    }

    const durationText = calculateDuration(newStart, newEnd);
    await supabase.from('transakcje').insert([{
      typ_operacji: 'edycja_zajec',
      class_key: classKey,
      opis: `Zmieniono dane zajęć: ${editClassModalData.title} (${editClassModalData.displayDate} ${newStart}-${newEnd}, ${durationText}). Limit: ${newLimitNum}, Trener: ${editTrainer}`
    }]);

    setEditClassModalData(null);
    loadData();
    showToast("Zajęcia w tym dniu zostały zaktualizowane!");
  };

  // DUPLIKOWANIE ZAJĘĆ DO JEDNORAZOWYCH
  const handleSaveDuplicateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dupPlan) {
      showToast("Wybierz rodzaj zajęć / plan treningowy!", 'warning');
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
      showToast("Nie udało się zapisać zajęć: " + error.message, 'error');
      return;
    }

    setDuplicateModalData(null);
    showToast(`Pomyślnie dodano zajęcia "${dupPlan}" na dzień ${dupDate}!`);
    loadData();
  };

  // ODWOŁYWANIE I PRZYWRACANIE ZAJĘĆ
  const handleToggleOdwolajZajecia = async (item: any, displayDate: string) => {
    const classKey = `${item.id}_${displayDate}`;
    const allVariantKeys = getKeysVariants(item.id, displayDate);
    const nextOdwołaneState = !item.isOdwołane;

    setActiveMenuClassId(null);

    const { data: dbSignups } = await supabase
      .from('zapisy_zajec')
      .select('klient_id, status')
      .in('class_key', allVariantKeys);

    const zapisani = dbSignups || [];
    const participantIds: number[] = Array.from(new Set(zapisani.map((s: any) => Number(s.klient_id)).filter(Boolean)));

    await supabase.from('nadpisania_zajec').delete().in('class_key', allVariantKeys);

    if (nextOdwołaneState) {
      let d = 1, m = 1;
      if (displayDate.includes('/')) {
        [d, m] = displayDate.split('/').map(Number);
      } else if (displayDate.includes('-')) {
        const p = displayDate.split('-').map(Number);
        m = p[1]; d = p[2];
      }
      const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
      const dayDate = new Date(classYear, m - 1, d);
      const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
      const dayName = dayNames[dayDate.getDay()];
      const formattedDate = `${dayName}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${classYear}`;
      const durationText = calculateDuration(item.start, item.end);

      for (const u of zapisani) {
        const { data: clientData } = await supabase.from('klienci').select('*').eq('id', u.klient_id).maybeSingle();
        if (clientData) {
          let parsedKarnety = [];
          if (Array.isArray(clientData.karnetyKlubowicza)) parsedKarnety = clientData.karnetyKlubowicza;
          else if (typeof clientData.karnetyKlubowicza === 'string') {
            try { parsedKarnety = JSON.parse(clientData.karnetyKlubowicza); } catch(e) {}
          }

          const passIndex = parsedKarnety.findIndex((k: any) => isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
          if (passIndex !== -1) {
            const currentRemaining = parseInt(parsedKarnety[passIndex].pozostaloWejsc, 10);
            const poczatkowe = parseInt(parsedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
            parsedKarnety[passIndex] = {
              ...parsedKarnety[passIndex],
              pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
            };
            await supabase.from('klienci').update({ karnetyKlubowicza: parsedKarnety }).eq('id', u.klient_id);
          }

          await supabase.from('transakcje').insert([{
            klient_id: u.klient_id,
            typ_operacji: 'zajecia_wypis',
            class_key: classKey,
            opis: `Odwołano zajęcia: ${item.title} (${formattedDate} ${item.start}-${item.end || ''}, ${durationText}). Wypisano uczestnika (${u.status === 'krzesełko' ? '🪑 Lista rezerwowa' : '✅ Lista główna'}) i zwrócono wejście.`
          }]);
        }
      }

      if (participantIds.length > 0) {
        await sendPushNotification(participantIds, {
          title: `Odwołano trening: ${item.title}`,
          body: `Trening "${item.title}" w dniu ${displayDate} o godz. ${item.start} został odwołany przez klub. Zwrócono wejście na karnet.`,
          url: '/'
        });
      }

      await supabase.from('zapisy_zajec').delete().in('class_key', allVariantKeys);

      const rowsToInsert = allVariantKeys.map(vKey => ({
        class_key: vKey,
        start: item.start || '08:00',
        end: item.end || '09:00',
        trainer: item.trainer || '',
        limit: item.limit || 12,
        is_odwolane: true,
        is_usuniete: item.isUsunięte || false
      }));
      await supabase.from('nadpisania_zajec').insert(rowsToInsert);
    } else {
      if (item.isUsunięte) {
        const rowsToInsert = allVariantKeys.map(vKey => ({
          class_key: vKey,
          start: item.start || '08:00',
          end: item.end || '09:00',
          trainer: item.trainer || '',
          limit: item.limit || 12,
          is_odwolane: false,
          is_usuniete: item.isUsunięte || false
        }));
        await supabase.from('nadpisania_zajec').insert(rowsToInsert);
      }
    }

    setNadpisaneZajeciaDni(prev => {
      const updated = { ...prev };
      allVariantKeys.forEach(k => {
        if (nextOdwołaneState) {
          updated[k] = { ...item, isOdwołane: true, isUsunięte: item.isUsunięte || false };
        } else {
          delete updated[k];
        }
      });
      return updated;
    });

    await supabase.from('transakcje').insert([{
      typ_operacji: nextOdwołaneState ? 'odwolanie_zajec' : 'przywrocenie_zajec',
      class_key: classKey,
      opis: nextOdwołaneState ? `Odwołano zajęcia: "${item.title}" (${displayDate} ${item.start}) z poziomu grafiku` : `Przywrócono odwołane zajęcia: "${item.title}" (${displayDate} ${item.start})`
    }]);

    await loadData();
    showToast(nextOdwołaneState ? "Zajęcia zostały odwołane." : "Zajęcia zostały pomyślnie przywrócone!");
  };

  // USUWANIE I PRZYWRACANIE ZAJĘĆ
  const handleToggleUsunZajecia = async (item: any, displayDate: string) => {
    const classKey = `${item.id}_${displayDate}`;
    const keysToDelete = getKeysVariants(item.id, displayDate);
    const nextUsunięteState = !item.isUsunięte;

    setActiveMenuClassId(null);

    if (nextUsunięteState) {
      const zapisani = zapisyNaZajecia[classKey] || [];
      const participantIds: number[] = [];

      for (const u of zapisani) {
        participantIds.push(u.id);
        const { data: clientData } = await supabase.from('klienci').select('*').eq('id', u.id).maybeSingle();
        if (clientData) {
          let parsedKarnety = [];
          if (Array.isArray(clientData.karnetyKlubowicza)) parsedKarnety = clientData.karnetyKlubowicza;
          else if (typeof clientData.karnetyKlubowicza === 'string') {
            try { parsedKarnety = JSON.parse(clientData.karnetyKlubowicza); } catch(e) {}
          }

          const passIndex = parsedKarnety.findIndex((k: any) => isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
          if (passIndex !== -1) {
            const currentRemaining = parseInt(parsedKarnety[passIndex].pozostaloWejsc, 10);
            const poczatkowe = parseInt(parsedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
            parsedKarnety[passIndex] = {
              ...parsedKarnety[passIndex],
              pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
            };
            await supabase.from('klienci').update({ karnetyKlubowicza: parsedKarnety }).eq('id', u.id);
          }

          await supabase.from('transakcje').insert([{
            klient_id: u.id,
            typ_operacji: 'zajecia_wypis',
            class_key: classKey,
            opis: `Usunięto zajęcia: "${item.title}" (${displayDate} ${item.start}). Wypisano uczestnika (${u.status === 'krzesełko' ? 'lista rezerwowa' : 'lista główna'}) i zwrócono wejście.`
          }]);
        }
      }

      if (participantIds.length > 0) {
        await sendPushNotification(participantIds, {
          title: `Usunięto trening: ${item.title}`,
          body: `Trening "${item.title}" w dniu ${displayDate} o godz. ${item.start} został usunięty z grafiku. Zwrócono wejście na karnet.`,
          url: '/'
        });
      }

      await supabase.from('zapisy_zajec').delete().in('class_key', keysToDelete);
    }

    if (item.isJednorazowe) {
      const rawDbId = item.rawDbId || (typeof item.id === 'string' && item.id.startsWith('j_') ? item.id.replace('j_', '') : item.id);
      await supabase.from('zajecia_jednorazowe').delete().eq('id', rawDbId);
      await supabase.from('nadpisania_zajec').delete().in('class_key', keysToDelete);
    } else {
      await supabase.from('nadpisania_zajec').delete().in('class_key', keysToDelete);

      if (nextUsunięteState) {
        const rowsToInsert = keysToDelete.map(vKey => ({
          class_key: vKey,
          start: item.start || '08:00',
          end: item.end || '09:00',
          trainer: item.trainer || '',
          limit: item.limit || 12,
          is_odwolane: item.isOdwołane || false,
          is_usuniete: true
        }));
        await supabase.from('nadpisania_zajec').insert(rowsToInsert);
      }
    }

    setNadpisaneZajeciaDni(prev => {
      const updated = { ...prev };
      keysToDelete.forEach(k => {
        if (nextUsunięteState && !item.isJednorazowe) {
          updated[k] = { ...item, isOdwołane: item.isOdwołane || false, isUsunięte: true };
        } else {
          delete updated[k];
        }
      });
      return updated;
    });

    await supabase.from('transakcje').insert([{
      typ_operacji: nextUsunięteState ? 'usuniecie_zajec' : 'przywrocenie_zajec',
      class_key: classKey,
      opis: nextUsunięteState ? `Usunięto zajęcia: "${item.title}" (${displayDate} ${item.start})` : `Przywrócono usunięte zajęcia: "${item.title}" (${displayDate} ${item.start})`
    }]);

    await loadData();
    showToast(nextUsunięteState ? "Zajęcia zostały usunięte." : "Zajęcia zostały pomyślnie przywrócone!");
  };

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
      console.error("Błąd zapisu do bazy Supabase:", error);
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

  const handleAutoWypiszPoZablokowaniu = async (klientId: number, targetClientObj: any, powodBlokadyText: string, excludeClassKey?: string) => {
    const now = new Date();
    let cancelledCount = 0;
    const { data: userSignups } = await supabase
      .from('zapisy_zajec')
      .select('*')
      .eq('klient_id', klientId);

    if (userSignups && userSignups.length > 0) {
      for (const signup of userSignups) {
        if (excludeClassKey && signup.class_key === excludeClassKey) {
          continue;
        }
        const parts = (signup.class_key || '').split('_');
        const classId = parts[0];
        const dateStr = parts[1];
        if (dateStr) {
          const classDetails = findClassDetails(classId, dateStr);
          if (classDetails) {
            const [sh = '00', sm = '00'] = (classDetails.start || '00:00').split(':');
            const classStartDateTime = new Date(
              classDetails.targetDayDate.getFullYear(),
              classDetails.targetDayDate.getMonth(),
              classDetails.targetDayDate.getDate(),
              parseInt(sh),
              parseInt(sm),
              0
            );
            
            if (classStartDateTime > now) {
              const keysToDelete = getKeysVariants(classId, dateStr);
              const classKey = `${classId}_${dateStr}`;
              const aktualni = zapisyNaZajecia[classKey] || [];

              await supabase
                .from('zapisy_zajec')
                .delete()
                .in('class_key', keysToDelete)
                .eq('klient_id', Number(klientId));
              cancelledCount++;

              await promoteWaitlistMember(classDetails, dateStr, aktualni, klientId);
            }
          }
        }
      }
    }
    if (cancelledCount > 0 && targetClientObj) {
      let updatedKarnety = [...(targetClientObj.karnetyKlubowicza || [])];
      const passIndex = updatedKarnety.findIndex((k: any) => isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
      
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
        opis: `Automatycznie wypisano z ${cancelledCount} przyszłych zajęć z powodu blokady konta (${powodBlokadyText}). Zwrócono ${cancelledCount} wejść.`
      }]);
    }
  };

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
        const classId = parts[0];
        const dateStr = parts[1];
        if (dateStr) {
          const classDetails = findClassDetails(classId, dateStr);
          if (classDetails) {
            const classDateStr = classDetails.isoDateStr;
            const classDate = new Date(classDetails.targetDayDate.getFullYear(), classDetails.targetDayDate.getMonth(), classDetails.targetDayDate.getDate(), 23, 59, 59);
            
            const isAfterStart = classDateStr >= zawieszonyOd;
            const isBeforeEnd = !zawieszonyDo || classDateStr <= zawieszonyDo;

            if (isAfterStart && isBeforeEnd && classDate >= todayBeginning) {
              const keysToDelete = getKeysVariants(classId, dateStr);
              const classKey = `${classId}_${dateStr}`;
              const aktualni = zapisyNaZajecia[classKey] || [];

              await supabase
                .from('zapisy_zajec')
                .delete()
                .in('class_key', keysToDelete)
                .eq('klient_id', Number(klientId));
              cancelledCount++;

              await promoteWaitlistMember(classDetails, dateStr, aktualni, klientId);
            }
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

        const passIndex = updatedKarnety.findIndex((k: any) => k.nazwa === nazwaKarnetu && isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
        
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

  const handleConfirmExtendPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !extendPassTarget) return;
    if (!confirm(`Czy na pewno chcesz przedłużyć ten karnet do dnia ${extendNewDate}?`)) return;
    
    const defKarnetu = dostepneKarnety.find(k => k.nazwa === extendSelectedNewPassName);
    let bazowaCenaNum = defKarnetu ? parseFloat(defKarnetu.cena) : parseFloat(extendPassTarget.cena.replace(/[^0-9.]/g, '')) || 0;
    const allowedClasses = defKarnetu?.zaznaczoneZajecia || [];
    const dostepDo = defKarnetu?.dostep_do_zajec || 'wszystkich zajęć';
    
    const effectiveDiscount = getEffectiveDiscount(profileClient);
    const finalPriceNum = effectiveDiscount.percent > 0 
      ? bazowaCenaNum * (1 - effectiveDiscount.percent / 100) 
      : bazowaCenaNum;
    const nowaCena = `${finalPriceNum.toFixed(2)} PLN`;

    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === extendPassTarget.id) {
        return { 
          ...k, 
          nazwa: extendSelectedNewPassName || k.nazwa, 
          waznyDo: extendNewDate, 
          cena: nowaCena, 
          zaznaczoneZajecia: extendSelectedNewPassName ? allowedClasses : k.zaznaczoneZajecia,
          dostepDo: extendSelectedNewPassName ? dostepDo : k.dostepDo,
          znizkaProcentowa: effectiveDiscount.label,
          statusTekst: `Ważny do: ${extendNewDate}` 
        };
      }
      return k;
    });

    const updatedClient = { 
      ...profileClient, 
      karnetyKlubowicza: uaktualnioneKarnety, 
      pass: uaktualnioneKarnety.map((k: any) => k.nazwa).join(', '), 
      price: nowaCena, 
      expiresDate: extendNewDate 
    };

    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety };
    if (profileClient.Cena !== undefined) dbPayload.Cena = nowaCena;
    else if (profileClient.cena !== undefined) dbPayload.cena = nowaCena;

    const success = await updateSupabaseClient(updatedClient, dbPayload);
    if (success) { 
      showToast(`Karnet przedłużony do ${extendNewDate}! Cena: ${nowaCena}`); 
      setIsExtendPassModalOpen(false); 
    }
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
    const basePriceNum = defKarnetu ? parseFloat(defKarnetu.cena) : 0;
    
    const effectiveDiscount = getEffectiveDiscount(currentUser);
    const cenaWartosc = effectiveDiscount.percent > 0 
      ? basePriceNum * (1 - effectiveDiscount.percent / 100) 
      : basePriceNum;
    const cenaStr = `${cenaWartosc.toFixed(2)} PLN`;

    const allowedClasses = defKarnetu?.zaznaczoneZajecia || [];
    const dostepDo = defKarnetu?.dostep_do_zajec || 'wszystkich zajęć';
    
    const isTimePassBuy = isTimePass(defKarnetu) || isTimePass({ nazwa: selectedBuyPass });
    const limitWejscBaza = (!isTimePassBuy && defKarnetu) ? (defKarnetu.ilosc_wejsc || null) : null;
    const parsedLimitWejsc = limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : null;

    let updatedKarnety = [];
    let nowaDataWygasnieciaStr = '';

    if (karnetyList.length > 0 && activationMode === 'after') {
      updatedKarnety = karnetyList.map((k: any, index: number) => {
        if (index === karnetyList.length - 1) {
          let baseDate = new Date();
          if (k.waznyDo) {
            const parts = k.waznyDo.split('-');
            if (parts.length === 3) baseDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
          baseDate.setDate(baseDate.getDate() + dniWażności);
          nowaDataWygasnieciaStr = baseDate.toISOString().split('T')[0];
          const addedEntries = parsedLimitWejsc !== null ? parsedLimitWejsc : 0;
          const currentEntries = k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined ? k.pozostaloWejsc : 0;
          return {
            ...k, 
            nazwa: selectedBuyPass, 
            waznyDo: nowaDataWygasnieciaStr, 
            pozostaloWejsc: isTimePassBuy ? null : (parsedLimitWejsc !== null ? currentEntries + addedEntries : null),
            poczatkoweWejsc: isTimePassBuy ? null : (parsedLimitWejsc !== null ? (k.poczatkoweWejsc || currentEntries) + addedEntries : null),
            cena: cenaStr, 
            zaznaczoneZajecia: allowedClasses,
            dostepDo: dostepDo,
            znizkaProcentowa: effectiveDiscount.label,
            statusTekst: `Ważny do: ${nowaDataWygasnieciaStr}`
          };
        }
        return k;
      });
    } else {
      const dataWygasniecia = new Date();
      dataWygasniecia.setDate(dataWygasniecia.getDate() + dniWażności);
      nowaDataWygasnieciaStr = dataWygasniecia.toISOString().split('T')[0];
      const nowyKarnetObj = {
        id: Date.now(), 
        nazwa: selectedBuyPass, 
        waznyDo: nowaDataWygasnieciaStr, 
        pozostaloWejsc: isTimePassBuy ? null : parsedLimitWejsc,
        poczatkoweWejsc: isTimePassBuy ? null : parsedLimitWejsc,
        cena: cenaStr, 
        zaznaczoneZajecia: allowedClasses,
        dostepDo: dostepDo,
        znizkaProcentowa: effectiveDiscount.label, 
        rata: '1 / 1', 
        statusTekst: `Ważny do: ${nowaDataWygasnieciaStr}`, 
        blokadaDo: null, 
        powodBlokady: null,
        zawieszonyOd: null, 
        zawieszonyDo: null, 
        historiaZawieszen: []
      };
      updatedKarnety = [...karnetyList, nowyKarnetObj];
    }
    
    const currentWalletNum = parseFloat(currentUser.wallet.replace(/[^0-9.-]+/g, "")) || 0;
    const nowyStanPortfela = currentWalletNum - cenaWartosc;
    const nowyStanPortfelaStr = `${nowyStanPortfela.toFixed(2)} PLN`;
    const nowaHistoriaEntry = {
      id: Date.now(), 
      date: new Date().toISOString().replace('T', ' ').substring(0, 16), 
      type: `Zakup (Panel klienta): ${selectedBuyPass}${effectiveDiscount.label ? ` ${effectiveDiscount.label}` : ''}`,
      amount: `-${cenaWartosc.toFixed(2)} PLN`, 
      balance: nowyStanPortfelaStr
    };

    const updatedWalletHistory = [nowaHistoriaEntry, ...(currentUser.walletHistory || [])];
    const ostatecznaDataWygasniecia = updatedKarnety[updatedKarnety.length - 1]?.waznyDo || '';
    
    const updatedClient = { 
      ...currentUser, 
      karnetyKlubowicza: updatedKarnety, 
      pass: updatedKarnety.map((k: any) => k.nazwa).join(', '),
      price: cenaStr, 
      expiresDate: ostatecznaDataWygasniecia, 
      wallet: nowyStanPortfelaStr, 
      walletHistory: updatedWalletHistory
    };

    const dbPayload: any = { karnetyKlubowicza: updatedKarnety };
    if (currentUser.Cena !== undefined) dbPayload.Cena = cenaStr; 
    else if (currentUser.cena !== undefined) dbPayload.cena = cenaStr;
    if (currentUser.Portfel !== undefined) dbPayload.Portfel = nowyStanPortfelaStr; 
    else if (currentUser.portfel !== undefined) dbPayload.portfel = nowyStanPortfelaStr;

    const success = await updateSupabaseClient(updatedClient, dbPayload);
    if (success) {
      if (cenaWartosc > 0) {
        await supabase.from('transakcje').insert([{ 
          klient_id: currentUser.id, 
          typ_operacji: 'zakup_karnetu', 
          kwota: -cenaWartosc, 
          opis: `Zakup (Panel klienta): ${selectedBuyPass}${effectiveDiscount.label ? ` ${effectiveDiscount.label}` : ''}` 
        }]);
      }
      showToast(`Karnet zakupiony pomyślnie za ${cenaStr} (Ważny do: ${nowaDataWygasnieciaStr})!`);
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
      showToast("Konto zostało usunięte.");
    }
  };

  const handleDeactivateClient = () => {
    if (confirm("Czy na pewno chcesz dezaktywować tego użytkownika?")) {
      showToast("Konto zostało dezaktywowane.", 'info');
      setTableActionClient(null);
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
        showToast("Zdjęcie profilowe zostało zaktualizowane!");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSavePassEditSubmit = async () => {
    if (!profileClient || !editingPassModal) return;
    if (!confirm("Czy na pewno chcesz zapisać zmiany w karnecie?")) return;
    const bazowyKarnet = dostepneKarnety.find(k => k.nazwa === editingPassModal.nazwa);
    const cenaRegularna = bazowyKarnet ? parseFloat(bazowyKarnet.cena) : null;
    const nowaCenaWartosc = parseFloat(editingPassModal.cena.replace(/[^0-9.]/g, '')) || 0;
    
    const allowedClasses = bazowyKarnet?.zaznaczoneZajecia || [];
    const dostepDo = bazowyKarnet?.dostep_do_zajec || 'wszystkich zajęć';

    let znizkaTekst = '';
    if (cenaRegularna && cenaRegularna > 0 && nowaCenaWartosc < cenaRegularna) {
      const roznica = cenaRegularna - nowaCenaWartosc;
      const procent = Math.round((roznica / cenaRegularna) * 100);
      znizkaTekst = `(-${procent}%)`;
    }
    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === editingPassModal.id) {
        const isTimePassItem = isTimePass(editingPassModal);
        
        return {
          ...k, 
          nazwa: editingPassModal.nazwa, 
          waznyDo: editingPassModal.waznyDo, 
          pozostaloWejsc: isTimePassItem ? null : editingPassModal.pozostaloWejsc,
          poczatkoweWejsc: isTimePassItem ? null : (k.poczatkoweWejsc || editingPassModal.pozostaloWejsc),
          cena: editingPassModal.cena.includes('PLN') ? editingPassModal.cena : `${editingPassModal.cena} PLN`,
          zaznaczoneZajecia: allowedClasses,
          dostepDo: dostepDo,
          znizkaProcentowa: znizkaTekst, 
          rata: editingPassModal.rata, 
          statusTekst: `Ważny do: ${editingPassModal.waznyDo}`
        };
      }
      return k;
    });
    const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety, pass: uaktualnioneKarnety.map((k: any) => k.nazwa).join(', ') };
    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety };
    await updateSupabaseClient(updatedClient, dbPayload);
    setEditingPassModal(null);
    showToast("Karnet został zaktualizowany!");
  };

  const handleConfirmDeletePass = async (passId: number) => {
    if (!profileClient) return;
    if (!confirm("Czy na pewno chcesz usunąć ten karnet? Klient zostanie automatycznie wypisany ze wszystkich przyszłych zajęć.")) return;
    
    const now = new Date();
    let cancelledCount = 0;
    
    const { data: userSignups } = await supabase
      .from('zapisy_zajec')
      .select('*')
      .eq('klient_id', profileClient.id);

    if (userSignups && userSignups.length > 0) {
      for (const signup of userSignups) {
        const parts = (signup.class_key || '').split('_');
        const classId = parts[0];
        const dateStr = parts[1];
        if (dateStr) {
          const classDetails = findClassDetails(classId, dateStr);
          if (classDetails) {
            const [sh = '00', sm = '00'] = (classDetails.start || '00:00').split(':');
            const classStartDateTime = new Date(
              classDetails.targetDayDate.getFullYear(),
              classDetails.targetDayDate.getMonth(),
              classDetails.targetDayDate.getDate(),
              parseInt(sh),
              parseInt(sm),
              0
            );

            if (classStartDateTime > now) {
              const keysToDelete = getKeysVariants(classId, dateStr);
              const classKey = `${classId}_${dateStr}`;
              const aktualni = zapisyNaZajecia[classKey] || [];

              await supabase
                .from('zapisy_zajec')
                .delete()
                .in('class_key', keysToDelete)
                .eq('klient_id', profileClient.id);
              cancelledCount++;

              await promoteWaitlistMember(classDetails, dateStr, aktualni, profileClient.id);
            }
          }
        }
      }
    }

    let updatedNadchodzace = profileClient.zapisyNadchodzace;
    if (typeof updatedNadchodzace === 'string') {
      try { updatedNadchodzace = JSON.parse(updatedNadchodzace); } catch(e) { updatedNadchodzace = []; }
    }
    if (Array.isArray(updatedNadchodzace)) {
      updatedNadchodzace = updatedNadchodzace.filter((z: any) => {
        if (!z.data) return false;
        const [d, m] = z.data.includes('-') 
          ? z.data.split('-').slice(1).reverse().map(Number) 
          : (z.data.includes('/') ? z.data.split('/').map(Number) : [1, 1]);
        const classDate = new Date(now.getFullYear(), m - 1, d, 23, 59, 59);
        return classDate < now;
      });
    }

    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).filter((k: any) => k.id !== passId);
    const updatedClient = { 
      ...profileClient, 
      karnetyKlubowicza: uaktualnioneKarnety, 
      pass: uaktualnioneKarnety.map((k: any) => k.nazwa).join(', ') || 'Brak karnetu',
      zapisyNadchodzace: updatedNadchodzace
    };
    
    const dbPayload: any = { 
      karnetyKlubowicza: uaktualnioneKarnety, 
      zapisyNadchodzace: updatedNadchodzace 
    };

    await updateSupabaseClient(updatedClient, dbPayload);

    if (cancelledCount > 0) {
      await supabase.from('transakcje').insert([{
        klient_id: profileClient.id,
        typ_operacji: 'zajecia_wypis',
        opis: `Automatycznie wypisano z ${cancelledCount} przyszłych zajęć z powodu usunięcia karnetu.`
      }]);

      await supabase.from('booking_logs').insert([{
        action_type: 'PASS_DELETED_UNENROLLED',
        status: 'SUCCESS',
        reason: `Usunięto karnet dla ${profileClient.firstName} ${profileClient.lastName}. Wypisano z ${cancelledCount} przyszłych zajęć.`,
        rule_applied: 'pass_deletion_cleanup',
        payload: { klient_id: profileClient.id, cancelled_count: cancelledCount }
      }]);
    }

    setEditingPassModal(null);
    setIsGlobalPassMenuOpen(false);
    showToast(cancelledCount > 0 
      ? `Karnet usunięty. Wypisano z ${cancelledCount} przyszłych zajęć.` 
      : "Karnet został usunięty."
    );
  };

  const handleConfirmSuspendPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !suspendPassTarget) return;
    let sOd = suspendStartDate;
    let sDo = suspendEndDate;
    if (suspendMode === 'days') {
      sOd = todayStr;
      const dni = parseInt(suspendPassDays || '0', 10);
      if (dni <= 0) { showToast("Liczba dni musi być większa od zera!", 'warning'); return; }
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + dni);
      sDo = endDate.toISOString().split('T')[0];
    }
    if (new Date(sDo) < new Date(sOd)) {
      showToast("Planowana data zakończenia musi być późniejsza lub równa dacie początkowej!", 'error');
      return;
    }
    if (!confirm(`Czy na pewno chcesz zawiesić ten karnet od ${sOd} (planowo do ${sDo})? Rzeczywista liczba dni doliczona do ważności zostanie wyliczona przy odwieszeniu.`)) return;
    let karnetyList = Array.isArray(profileClient.karnetyKlubowicza) ? [...profileClient.karnetyKlubowicza] : [];
    const uaktualnioneKarnety = karnetyList.map((k: any) => {
      if (k.id === suspendPassTarget.id) { return { ...k, zawieszonyOd: sOd, zawieszonyDo: sDo }; }
      return k;
    });
    const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety };
    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety };
    const success = await updateSupabaseClient(updatedClient, dbPayload);
    if (success) {
      await handleAutoWypiszPoZawieszeniu(profileClient.id, sOd, sDo, suspendPassTarget.nazwa);
      showToast(`Karnet "${suspendPassTarget.nazwa}" został zawieszony.`);
      setIsSuspendModalOpen(false);
    }
  };

  const handleOdwiesKarnet = async (karnetTarget: any) => {
    if (!profileClient || !karnetTarget.zawieszonyOd) return;
    const dzisiaj = new Date();
    const start = new Date(karnetTarget.zawieszonyOd);
    dzisiaj.setHours(0, 0, 0, 0); start.setHours(0, 0, 0, 0);
    let diffDays = Math.floor((dzisiaj.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays < 1) diffDays = 1;
    if (!confirm(`Karnet był zawieszony od ${karnetTarget.zawieszonyOd} (łącznie ${diffDays} dni). Czy na pewno chcesz go odwiesić i przedłużyć ważność o ${diffDays} dni?`)) return;
    
    let currentExpDate = new Date(karnetTarget.waznyDo);
    currentExpDate.setDate(currentExpDate.getDate() + diffDays);
    const newExpDateStr = currentExpDate.toISOString().split('T')[0];
    const historiaEntry = { id: Date.now(), od: karnetTarget.zawieszonyOd, do: todayStr, dni: diffDays };

    const isContract = isContractPass(karnetTarget);
    let updatedSuspensionDaysLeft = karnetTarget.contractSuspensionDaysLeft;
    let updatedTotalSuspendedDaysUsed = karnetTarget.totalSuspendedDaysUsed || 0;

    if (isContract) {
      const currentPool = karnetTarget.contractSuspensionDaysLeft !== undefined ? karnetTarget.contractSuspensionDaysLeft : 30;
      updatedSuspensionDaysLeft = Math.max(0, currentPool - diffDays);
      updatedTotalSuspendedDaysUsed += diffDays;
    }

    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === karnetTarget.id) {
        return { 
          ...k, 
          waznyDo: newExpDateStr, 
          statusTekst: isContract 
            ? `Umowa 12M (Rata ${k.rata || '0/12'} • Ważny do: ${newExpDateStr})`
            : `Ważny do: ${newExpDateStr}`, 
          zawieszonyOd: null, 
          zawieszonyDo: null,
          contractSuspensionDaysLeft: updatedSuspensionDaysLeft,
          totalSuspendedDaysUsed: updatedTotalSuspendedDaysUsed,
          historiaZawieszen: [historiaEntry, ...(k.historiaZawieszen || [])] 
        };
      }
      return k;
    });

    const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety };
    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety };
    const success = await updateSupabaseClient(updatedClient, dbPayload);
    if (success) showToast(`Karnet odwieszony! Przedłużono o ${diffDays} dni.`);
  };

  const handleConfirmBlockPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !suspendPassTarget) return;
    let bOd = blockPassStartDate;
    let bDo = blockPassEndDate;
    if (blockMode === 'days') {
      bOd = todayStr;
      const dni = parseInt(blockPassDays || '0', 10);
      if (dni <= 0) { showToast("Liczba dni musi być większa od zera!", 'warning'); return; }
      const endDate = new Date(); endDate.setDate(endDate.getDate() + dni);
      bDo = endDate.toISOString().split('T')[0];
    }
    if (new Date(bDo) < new Date(bOd)) { showToast("Data końcowa blokady musi być późniejsza lub równa początkowej!", 'error'); return; }
    if (!confirm(`Czy na pewno chcesz zablokować ten karnet w okresie ${bOd} - ${bDo}? Użytkownik zostanie automatycznie wypisany z nadchodzących zajęć.`)) return;
    
    const powod = `Zablokowano w okresie ${bOd} - ${bDo}`;
    const now = new Date();
    let cancelledCount = 0;

    const { data: userSignups } = await supabase
      .from('zapisy_zajec')
      .select('*')
      .eq('klient_id', profileClient.id);

    if (userSignups && userSignups.length > 0) {
      for (const signup of userSignups) {
        const parts = (signup.class_key || '').split('_');
        const classId = parts[0];
        const dateStr = parts[1];
        if (dateStr) {
          const classDetails = findClassDetails(classId, dateStr);
          if (classDetails) {
            const [sh = '00', sm = '00'] = (classDetails.start || '00:00').split(':');
            const classStartDateTime = new Date(
              classDetails.targetDayDate.getFullYear(),
              classDetails.targetDayDate.getMonth(),
              classDetails.targetDayDate.getDate(),
              parseInt(sh),
              parseInt(sm),
              0
            );
            
            if (classStartDateTime > now) {
              const keysToDelete = getKeysVariants(classId, dateStr);
              const classKey = `${classId}_${dateStr}`;
              const aktualni = zapisyNaZajecia[classKey] || [];

              await supabase
                .from('zapisy_zajec')
                .delete()
                .in('class_key', keysToDelete)
                .eq('klient_id', profileClient.id);
              cancelledCount++;

              await promoteWaitlistMember(classDetails, dateStr, aktualni, profileClient.id);
            }
          }
        }
      }
    }

    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === suspendPassTarget.id) {
        let newPozostalo = k.pozostaloWejsc;
        if (isQuantityPass(k) && newPozostalo !== null && newPozostalo !== undefined && cancelledCount > 0) {
          const currentRemaining = parseInt(newPozostalo, 10) || 0;
          const poczatkowe = parseInt(k.poczatkoweWejsc || currentRemaining + cancelledCount, 10);
          newPozostalo = Math.min(poczatkowe, currentRemaining + cancelledCount);
        }
        return { 
          ...k, 
          blokadaOd: bOd, 
          blokadaDo: bDo, 
          powodBlokady: powod,
          pozostaloWejsc: newPozostalo
        };
      }
      return k;
    });

    const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety, blokadaDo: bDo, powodBlokady: powod };
    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety, blokadaDo: bDo, powodBlokady: powod };
    
    const success = await updateSupabaseClient(updatedClient, dbPayload);
    if (success) { 
      if (cancelledCount > 0) {
        await supabase.from('transakcje').insert([{
          klient_id: profileClient.id,
          typ_operacji: 'zajecia_wypis',
          opis: `Automatycznie wypisano z ${cancelledCount} przyszłych zajęć z powodu blokady karnetu (${powod}). Zwrócono ${cancelledCount} wejść.`
        }]);
      }
      showToast(`Karnet został zablokowany do ${bDo}.`); 
      setIsSuspendModalOpen(false); 
      loadData();
    }
  };

  const handleCancelBlock = async (karnetTarget: any) => {
    if (!profileClient || !karnetTarget) return;
    if (!confirm("Czy na pewno chcesz usunąć blokadę tego karnetu?")) return;
    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === karnetTarget.id) { 
        return { ...k, blokadaOd: null, blokadaDo: null, powodBlokady: null }; 
      }
      return k;
    });
    const updatedClient = { ...profileClient, karnetyKlubowicza: uaktualnioneKarnety, blokadaDo: null, powodBlokady: null };
    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety, blokadaDo: null, powodBlokady: null };
    await updateSupabaseClient(updatedClient, dbPayload);
    showToast("Blokada została odwołana.");
    setIsSuspendModalOpen(false);
  };

  const handleTopUpWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !walletAmountInput) return;
    const kwotaZmiany = parseFloat(walletAmountInput);
    if (isNaN(kwotaZmiany)) return;
    if (!confirm(`Czy na pewno chcesz zmienić saldo portfela o kwotę ${kwotaZmiany > 0 ? '+' : ''}${kwotaZmiany.toFixed(2)} PLN?`)) return;
    const currentWalletNum = parseFloat(String(profileClient.wallet).replace(/[^0-9.-]+/g, "")) || 0;
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
    const dbPayload: any = {};
    if (profileClient.Portfel !== undefined) dbPayload.Portfel = nowyStanStr;
    else if (profileClient.portfel !== undefined) dbPayload.portfel = nowyStanStr;
    await updateSupabaseClient(updatedClient, dbPayload);
    setWalletAmountInput(''); setWalletReasonInput(''); setIsTopUpWalletOpen(false);
    showToast("Saldo portfela zostało zaktualizowane.");
  };

  const getPrawdziweAktywneZapisy = (klientId: number) => {
    let count = 0;
    const now = new Date();
    const countedIsoKeys = new Set<string>();

    Object.entries(zapisyNaZajecia).forEach(([classKey, uczestnicy]) => {
      const parts = classKey.split('_');
      const classId = parts[0];
      const dateStr = parts[1];
      if (dateStr) {
        const classDetails = findClassDetails(classId, dateStr);
        if (classDetails) {
          const uniqueKey = `${classDetails.id}_${classDetails.isoDateStr}`;
          if (countedIsoKeys.has(uniqueKey)) return;

          const [sh = '00', sm = '00'] = (classDetails.start || '00:00').split(':');
          const classStartDateTime = new Date(
            classDetails.targetDayDate.getFullYear(),
            classDetails.targetDayDate.getMonth(),
            classDetails.targetDayDate.getDate(),
            parseInt(sh),
            parseInt(sm),
            0
          );

          if (classStartDateTime >= now) {
            if (Array.isArray(uczestnicy) && uczestnicy.some((u: any) => String(u.id) === String(klientId))) {
              count++;
              countedIsoKeys.add(uniqueKey);
            }
          }
        }
      }
    });
    return count;
  };

  // OPTYMISTYCZNA OBSŁUGA OBECNOŚCI (0 MS OPÓŹNIENIA)
  const toggleObecny = async (klientId: number) => {
    if (!selectedClass) return;
    const keys = getKeysVariants(selectedClass.id, selectedClass.displayDate);
    const aktualni = zapisyNaZajecia[`${selectedClass.id}_${selectedClass.displayDate}`] || [];
    const szukany = aktualni.find(k => k.id === klientId);
    if (!szukany) return;
    const nowyStanObecny = !szukany.obecny;

    // Natychmiastowa zmiana w stanie komponentu (Optimistic UI)
    setZapisyNaZajecia(prev => {
      const updated = { ...prev };
      keys.forEach(k => {
        if (updated[k]) {
          updated[k] = updated[k].map(item => 
            item.id === klientId ? { ...item, obecny: nowyStanObecny, nieobecny: false } : item
          );
        }
      });
      return updated;
    });

    // W tle: synchronizacja z Supabase
    await supabase
      .from('zapisy_zajec')
      .update({ obecny: nowyStanObecny, nieobecny: false })
      .in('class_key', keys)
      .eq('klient_id', klientId);
  };

  // OBSŁUGA NIEOBECNOŚCI: TRENER (AUTO BLOKADA 3 DNI, BRAK PYTANIA O ZWROT) VS ADMIN
  const toggleNieobecnyAction = async (osobaZapisana: any, klient: any) => {
    if (!selectedClass) return;

    if (osobaZapisana.nieobecny) {
      // Odznaczenie nieobecności - Optimistic UI
      const keys = getKeysVariants(selectedClass.id, selectedClass.displayDate);
      setZapisyNaZajecia(prev => {
        const updated = { ...prev };
        keys.forEach(k => {
          if (updated[k]) {
            updated[k] = updated[k].map(item => 
              item.id === klient.id ? { ...item, nieobecny: false, obecny: false } : item
            );
          }
        });
        return updated;
      });
      await supabase.from('zapisy_zajec').update({ nieobecny: false, obecny: false }).in('class_key', keys).eq('klient_id', klient.id);
      loadData();
    } else {
      if (appRole === 'trener') {
        // ROLA TRENERA: Natychmiastowe odebranie wejścia bez pytania, auto blokada 3 dni i wypisanie z kolejnych zajęć
        await wykonajNieobecnoscDlaTrenera(osobaZapisana, klient);
      } else {
        // ROLA ADMINISTRATORA: Bez zmian, dialog z potwierdzeniem
        setBlokadaZapisow(true);
        setDlugoscBlokady(String(bookingRules.absence_ban_days || 3));
        setClientToMarkAbsent(klient);
      }
    }
  };

  // DEDYKOWANA LOGIKA DLA TRENERA (BŁYSKAWICZNA DYSKRYMINACJA NIEOBECNOŚCI)
  const wykonajNieobecnoscDlaTrenera = async (osobaZapisana: any, klient: any) => {
    if (!selectedClass) return;
    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const keys = getKeysVariants(selectedClass.id, selectedClass.displayDate);

    // Optimistic UI - natychmiastowe oznaczenie na czerwono
    setZapisyNaZajecia(prev => {
      const updated = { ...prev };
      keys.forEach(k => {
        if (updated[k]) {
          updated[k] = updated[k].map(item => 
            item.id === klient.id ? { ...item, obecny: false, nieobecny: true } : item
          );
        }
      });
      return updated;
    });

    await supabase.from('zapisy_zajec').update({ obecny: false, nieobecny: true }).in('class_key', keys).eq('klient_id', klient.id);

    // Automatyczna 3-dniowa blokada zapisów
    const dni = 3;
    const dataWygaśnięcia = new Date();
    dataWygaśnięcia.setDate(dataWygaśnięcia.getDate() + dni);
    const dataStr = `${dataWygaśnięcia.getFullYear()}-${String(dataWygaśnięcia.getMonth() + 1).padStart(2, '0')}-${String(dataWygaśnięcia.getDate()).padStart(2, '0')}`;
    const powod = `Blokada zapisów na 3 dni za nieobecność na treningu ${selectedClass.title} w dniu ${selectedClass.displayDate}.`;

    let updatedClientKarnety = (klient.karnetyKlubowicza || []).map((k: any) => ({
      ...k,
      blokadaDo: dataStr,
      powodBlokady: powod
    }));

    await supabase.from('klienci').update({
      blokadaDo: dataStr,
      powodBlokady: powod,
      karnetyKlubowicza: updatedClientKarnety
    }).eq('id', klient.id);

    // Rejestracja w transakcjach
    let d = 1, m = 1;
    if (selectedClass.displayDate.includes('/')) {
      [d, m] = selectedClass.displayDate.split('/').map(Number);
    }
    const yr = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
    const durationText = calculateDuration(selectedClass.start, selectedClass.end);

    await supabase.from('transakcje').insert([{
      klient_id: klient.id,
      typ_operacji: 'nieobecnosc_trener',
      class_key: classKey,
      opis: `${klient.firstName} ${klient.lastName} - Trener oznaczył NIEOBECNOŚĆ na: ${selectedClass.title} (${selectedClass.displayDate} ${selectedClass.start}-${selectedClass.end || ''}, ${durationText}). Nałożono 3 dni blokady zapisów (do ${dataStr}). Wejście NIE zostało zwrócone.`
    }]);

    await supabase.from('booking_logs').insert([{
      action_type: 'TRAINER_MARKED_ABSENT',
      status: 'BLOCKED',
      reason: `Trener oznaczył nieobecność klubowicza ID:${klient.id}. Blokada do ${dataStr}. Brak zwrotu wejścia.`,
      rule_applied: 'trainer_absence_auto_ban',
      payload: { klient_id: klient.id, class_key: classKey, ban_until: dataStr }
    }]);

    // Automatyczne wypisanie klubowicza ze wszystkich przyszłych zajęć w okresie trwania blokady
    await handleAutoWypiszPoZablokowaniu(klient.id, klient, powod, classKey);

    showToast(`Oznaczono nieobecność. Nałożono 3 dni blokady zapisów na ${klient.firstName} ${klient.lastName}.`);
    loadData();
  };

  const handleKlubowiczZapiszSie = async () => {
    if (!currentUser || !selectedClass) return;
    
    const karnetyUzytkownika = currentUser.karnetyKlubowicza || [];
    const dzisiajDateObj = new Date();
    dzisiajDateObj.setHours(0, 0, 0, 0);

    const posiadaAktywnyKarnet = karnetyUzytkownika.some((k: any) => {
      if (!k) return false;
      if (k.waznyDo) {
        const expDate = new Date(k.waznyDo);
        expDate.setHours(23, 59, 59, 999);
        if (expDate < dzisiajDateObj) return false;
      }
      if (isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined) {
        if (parseInt(k.pozostaloWejsc, 10) <= 0) return false;
      }
      return true;
    });

    if (karnetyUzytkownika.length === 0 || !posiadaAktywnyKarnet) {
      await supabase.from('booking_logs').insert([{
        action_type: 'BOOKING_BLOCKED',
        status: 'BLOCKED',
        reason: `${currentUser.firstName || 'Klubowicz'}: Brak aktywnego karnetu na koncie.`,
        rule_applied: 'no_active_pass',
        payload: { klient_id: currentUser.id, class_id: selectedClass.id }
      }]);
      showToast("Nie możesz zapisać się na zajęcia! Nie posiadasz aktywnego karnetu. Kup lub przedłuż karnet w zakładce Karnety.", 'error');
      return;
    }
    const passAllowsThisClass = karnetyUzytkownika.some((k: any) => {
      if (!k) return false;
      if (k.waznyDo) {
        const expDate = new Date(k.waznyDo);
        expDate.setHours(23, 59, 59, 999);
        if (expDate < dzisiajDateObj) return false;
      }
      if (isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined) {
        if (parseInt(k.pozostaloWejsc, 10) <= 0) return false;
      }
      return checkPassAllowsClass(k, selectedClass.title, dostepneKarnety);
    });

    if (!passAllowsThisClass) {
      await supabase.from('booking_logs').insert([{
        action_type: 'BOOKING_BLOCKED',
        status: 'BLOCKED',
        reason: `${currentUser.firstName || 'Klubowicz'}: Posiadany karnet nie upoważnia do zapisu na zajęcia "${selectedClass.title}".`,
        rule_applied: 'pass_class_restriction',
        payload: { klient_id: currentUser.id, class_id: selectedClass.id, class_title: selectedClass.title }
      }]);
      showToast(`Twój karnet nie upoważnia do zapisu na zajęcia "${selectedClass.title}"! Wybierz odpowiedni karnet w zakładce Karnety.`, 'error');
      return;
    }

    const classKeyCurrent = `${selectedClass.id}_${selectedClass.displayDate}`;
    const zapisaniCurrent = zapisyNaZajecia[classKeyCurrent] || [];
    const autoCancelStatus = checkClassAutoCancellation(selectedClass, selectedClass.displayDate, zapisaniCurrent);
    
    if (selectedClass.isOdwołane || selectedClass.isUsunięte || autoCancelStatus.isAutoCancelled) { 
      showToast(autoCancelStatus.isAutoCancelled ? autoCancelStatus.reason : "Nie można zapisać się na odwołane lub usunięte zajęcia!", 'error'); 
      return; 
    }
    const walletVal = parseFloat(String(currentUser.wallet || currentUser.Portfel || '0').replace(/[^0-9.-]+/g, "")) || 0;
    if (walletVal < 0) { 
      showToast("Posiadasz zadłużenie na koncie! Ureguluj portfel, aby móc się zapisywać.", 'error'); 
      return; 
    }
    
    const now = new Date();
    const dzisiajData = todayStr;

    const clientBanDate = currentUser.blokadaDo || currentUser.blokada_do;
    const isClientBlocked = clientBanDate && String(clientBanDate) >= dzisiajData;
    const isPassBlocked = (currentUser.karnetyKlubowicza || []).some((k: any) => k.blokadaDo && String(k.blokadaDo) >= dzisiajData);
    
    if (isClientBlocked || isPassBlocked) {
      const errReason = currentUser.powodBlokady || (isClientBlocked ? `Twoje konto posiada aktywną blokadę do ${clientBanDate}.` : 'Twój karnet posiada aktywną blokadę.');
      await supabase.from('booking_logs').insert([{
        action_type: 'BOOKING_BLOCKED',
        status: 'BLOCKED',
        reason: `${currentUser.firstName || 'Klubowicz'}: ${errReason}`,
        rule_applied: 'absence_ban',
        payload: { klient_id: currentUser.id, class_id: selectedClass.id }
      }]);
      showToast(`Nie możesz się zapisać! ${errReason}`, 'error');
      return;
    }

    const classKeyStr = `${selectedClass.id}_${selectedClass.displayDate}`;
    const parts = classKeyStr.split('_');
    const dateStr = parts[1];
    let d = 1, m = 1;
    if (dateStr.includes('/')) {
      [d, m] = dateStr.split('/').map(Number);
    } else if (dateStr.includes('-')) {
      const p = dateStr.split('-').map(Number);
      m = p[1];
      d = p[2];
    }
    const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : now.getFullYear();
    const [sh = '00', sm = '00'] = (selectedClass.start || '00:00').split(':');
    const classStartDateTime = new Date(classYear, m - 1, d, parseInt(sh), parseInt(sm), 0);
    const calcClassDateStr = `${classYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const isPassSuspended = (currentUser.karnetyKlubowicza || []).some((k: any) => {
      if (k.zawieszonyOd) {
         const sOd = k.zawieszonyOd;
         const sDo = k.zawieszonyDo || '9999-12-31';
         return calcClassDateStr >= sOd && calcClassDateStr <= sDo;
      }
      return false;
    });

    if (isPassSuspended) {
      showToast(`Twój karnet jest zawieszony w dniu tych zajęć (${calcClassDateStr}).`, 'warning');
      return;
    }

    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const allVariantKeys = getKeysVariants(selectedClass.id, selectedClass.displayDate);

    const { data: liveSignupsDb } = await supabase
      .from('zapisy_zajec')
      .select('id, status, klient_id')
      .in('class_key', allVariantKeys);

    const actualDbSignups = liveSignupsDb || [];
    if (actualDbSignups.some(k => String(k.klient_id) === String(currentUser.id))) { 
      showToast("Jesteś już zapisany na te zajęcia!", 'info'); 
      return; 
    }

    // SPRAWDZENIE NADRZĘDNEGO INDYWIDUALNEGO LIMITU ZAPISU W PRZÓD DLA KLUBOWICZA
    const userFullName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim().toLowerCase();
    const userIndividualLimit = indywidualneLimity.find((l: any) => 
      (l.klubowicz_id && String(l.klubowicz_id) === String(currentUser.id)) ||
      (l.klubowicz_nazwa && l.klubowicz_nazwa.trim().toLowerCase() === userFullName)
    );

    let bookingWindowDays = 14;
    let isIndividualRuleApplied = false;

    if (userIndividualLimit && Number(userIndividualLimit.dni_w_przod) > 0) {
      bookingWindowDays = Number(userIndividualLimit.dni_w_przod);
      isIndividualRuleApplied = true;
    } else {
      const passName = (currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza.length > 0)
        ? currentUser.karnetyKlubowicza[0].nazwa
        : (currentUser.pass || 'OPEN');
      bookingWindowDays = bookingRules.booking_window_per_pass?.[passName] ?? bookingRules.booking_window_days ?? 14;
    }

    const maxBookingDate = new Date();
    maxBookingDate.setDate(maxBookingDate.getDate() + bookingWindowDays);
    maxBookingDate.setHours(23, 59, 59, 999);

    if (classStartDateTime > maxBookingDate) {
      const reason = isIndividualRuleApplied
        ? `Posiadasz indywidualne ograniczenie zapisów do ${bookingWindowDays} dni w przód.`
        : `Dla Twojego karnetu zapisy otwierają się ${bookingWindowDays} dni przed terminem zajęć.`;

      await supabase.from('booking_logs').insert([{
        action_type: 'BOOKING_BLOCKED',
        status: 'BLOCKED',
        reason: `${currentUser.firstName || 'Klubowicz'}: ${reason}`,
        rule_applied: isIndividualRuleApplied ? 'INDYWIDUALNY_LIMIT_ZAPISOW' : 'booking_window_per_pass',
        payload: { klient_id: currentUser.id, class_key: classKey, window_days: bookingWindowDays, is_individual: isIndividualRuleApplied }
      }]);
      showToast(`Nie możesz się zapisać! ${reason}`, 'error');
      return;
    }

    const trainingName = selectedClass.title || '';
    const cutoffMinutes = bookingRules.booking_cutoff_per_class?.[trainingName] !== undefined
      ? bookingRules.booking_cutoff_per_class[trainingName]
      : bookingRules.booking_cutoff_minutes;

    if (cutoffMinutes !== null && cutoffMinutes !== undefined && cutoffMinutes > 0) {
      const cutoffMs = cutoffMinutes * 60 * 1000;
      const diffMs = classStartDateTime.getTime() - now.getTime();
      if (diffMs > 0 && diffMs < cutoffMs) {
        const reason = `Zapisy na "${trainingName}" są blokowane na ${cutoffMinutes} minut przed rozpoczęciem.`;
        await supabase.from('booking_logs').insert([{
          action_type: 'BOOKING_BLOCKED',
          status: 'BLOCKED',
          reason: `${currentUser.firstName || 'Klubowicz'}: ${reason}`,
          rule_applied: 'booking_cutoff_per_class',
          payload: { klient_id: currentUser.id, class_key: classKey, training: trainingName, cutoff: cutoffMinutes }
        }]);
        showToast(`Nie możesz się zapisać! ${reason}`, 'error');
        return;
      }
    }

    const passName = (currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza.length > 0)
      ? currentUser.karnetyKlubowicza[0].nazwa
      : (currentUser.pass || 'OPEN');

    if (currentUser.expiresDate) {
      const graceDays = bookingRules.expired_pass_grace_per_pass?.[passName] ?? bookingRules.expired_pass_grace_days ?? 0;
      const expDate = new Date(currentUser.expiresDate);
      expDate.setDate(expDate.getDate() + graceDays);
      expDate.setHours(23, 59, 59, 999);

      if (classStartDateTime > expDate) {
        const reason = `Karnet "${passName}" wygasł. Okres karencji wynosił ${graceDays} dni.`;
        await supabase.from('booking_logs').insert([{
          action_type: 'BOOKING_BLOCKED',
          status: 'BLOCKED',
          reason: `${currentUser.firstName || 'Klubowicz'}: ${reason}`,
          rule_applied: 'expired_pass_grace_per_pass',
          payload: { klient_id: currentUser.id, class_key: classKey, pass: passName, grace_days: graceDays }
        }]);
        showToast(`Nie możesz się zapisać! ${reason}`, 'error');
        return;
      }
    }

    const maxSameType = bookingRules.max_daily_same_type_bookings ?? 1;
    if (maxSameType < 999) {
      let sameTypeCount = 0;
      const stdDnia = zapisaneZajecia.map(item => ({ ...item, displayDate: selectedClass.displayDate }));
      const jednorazDnia = jednorazoweZajecia.filter(j => j.displayDate === selectedClass.displayDate);
      const allClassesDnia = [...stdDnia, ...jednorazDnia];

      allClassesDnia.forEach(c => {
        const cKey = `${c.id}_${selectedClass.displayDate}`;
        const cTitle = (c.title || '').trim().toLowerCase();
        const sTitle = (selectedClass.title || '').trim().toLowerCase();
        if (cTitle === sTitle && zapisyNaZajecia[cKey]) {
          if (zapisyNaZajecia[cKey].some((u: any) => String(u.id) === String(currentUser.id))) {
            sameTypeCount++;
          }
        }
      });

      if (sameTypeCount >= maxSameType) {
        const reason = `Osiągnąłeś limit (${maxSameType}) zapisów na trening "${selectedClass.title}" w tym dniu.`;
        await supabase.from('booking_logs').insert([{
          action_type: 'BOOKING_BLOCKED',
          status: 'BLOCKED',
          reason: `${currentUser.firstName || 'Klubowicz'}: ${reason}`,
          rule_applied: 'max_daily_same_type_bookings',
          payload: { klient_id: currentUser.id, class_key: classKey, same_type_limit: maxSameType }
        }]);
        showToast(`Nie możesz się zapisać! ${reason}`, 'error');
        return;
      }
    }

    let dailyLimit = bookingRules.max_daily_bookings !== null && bookingRules.max_daily_bookings !== undefined
      ? bookingRules.max_daily_bookings
      : Infinity;

    if (currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza.length > 0) {
      const activePass = currentUser.karnetyKlubowicza[0];
      const passDef = dostepneKarnety.find((k: any) => k.nazwa === activePass.nazwa);
      if (passDef) {
        let meta: any = {};
        try { meta = typeof passDef.inne_ustawienia === 'string' ? JSON.parse(passDef.inne_ustawienia) : (passDef.inne_ustawienia || {}); } catch(e) {}
        const typLimitu = meta.dziennyLimit || passDef.dziennyLimit;
        const iloscLimitu = meta.niestandardowyDziennyIlosc || passDef.niestandardowyDziennyIlosc;
        if (typLimitu === 'Niestandardowy') {
          dailyLimit = Math.min(dailyLimit, parseInt(iloscLimitu, 10) || Infinity);
        }
      }
    }

    let userSignupsOnThisDate = 0;
    const countedDayClassKeys = new Set<string>();
    Object.entries(zapisyNaZajecia).forEach(([cKey, uczestnicy]) => {
      if (cKey.includes(`_${selectedClass.displayDate}`) || cKey.endsWith(`_${selectedClass.displayDate}`)) {
        const classId = cKey.split('_')[0];
        const normalizedKey = `${classId}_${selectedClass.displayDate}`;
        if (!countedDayClassKeys.has(normalizedKey)) {
          if (Array.isArray(uczestnicy) && uczestnicy.some((u: any) => String(u.id) === String(currentUser.id))) {
            userSignupsOnThisDate++;
            countedDayClassKeys.add(normalizedKey);
          }
        }
      }
    });

    if (userSignupsOnThisDate >= dailyLimit) { 
      const reason = `Wykorzystałeś już swój dzienny limit wejść na ten dzień (${dailyLimit}).`;
      await supabase.from('booking_logs').insert([{
        action_type: 'BOOKING_BLOCKED',
        status: 'BLOCKED',
        reason: `${currentUser.firstName || 'Klubowicz'}: ${reason}`,
        rule_applied: 'max_daily_bookings',
        payload: { klient_id: currentUser.id, class_key: classKey, daily_limit: dailyLimit }
      }]);
      showToast(`Nie możesz się zapisać! ${reason}`, 'error'); 
      return; 
    }

    const limitZajec = selectedClass.limit || 12;
    const liveGlownaCount = actualDbSignups.filter((u: any) => u.status === 'zapisany').length;
    const isWaitlistTarget = liveGlownaCount >= limitZajec;

    if (isWaitlistTarget) {
      setSelectedWaitlistCutoff(30);
      setIsWaitlistModalOpen(true);
      return;
    }
    
    if (!confirm("Czy na pewno chcesz zapisać się na te zajęcia?")) return;

    // Optimistic UI - natychmiastowe zaktualizowanie zapisu na kafelku
    const newEntry = {
      id: currentUser.id,
      klient_id: currentUser.id,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      status: 'zapisany',
      waitlist_cutoff_minutes: null,
      obecny: false,
      nieobecny: false
    };

    setZapisyNaZajecia(prev => {
      const updated = { ...prev };
      allVariantKeys.forEach(vk => {
        if (!updated[vk]) updated[vk] = [];
        if (!updated[vk].some((item: any) => item.id === currentUser.id)) {
          updated[vk] = [...updated[vk], newEntry];
        }
      });
      return updated;
    });

    const { error } = await supabase.from('zapisy_zajec').insert([
      { class_key: classKey, klient_id: currentUser.id, status: 'zapisany', waitlist_cutoff_minutes: null, obecny: false }
    ]);
    
    if (error) { 
      showToast(`Nie udało się zapisać na zajęcia: ${error.message}`, 'error'); 
      loadData();
      return; 
    }

    let updatedKarnety = [...(currentUser.karnetyKlubowicza || [])];
    const passIndex = updatedKarnety.findIndex((k: any) => isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
    if (passIndex !== -1) {
      const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10);
      if (!isNaN(currentRemaining) && currentRemaining > 0) {
        updatedKarnety[passIndex] = {
          ...updatedKarnety[passIndex],
          pozostaloWejsc: currentRemaining - 1
        };
        await supabase.from('klienci').update({ karnetyKlubowicza: updatedKarnety }).eq('id', currentUser.id);
      }
    }

    const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const dayOfWeekName = dayNames[classStartDateTime.getDay()];
    const formattedFullDate = `${dayOfWeekName}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${classYear}`;
    const durationText = calculateDuration(selectedClass.start, selectedClass.end);
    const oblozenieStr = `${liveGlownaCount + 1}/${limitZajec}`;
    
    await supabase.from('transakcje').insert([{ 
      klient_id: currentUser.id, 
      typ_operacji: 'zajecia_zapis', 
      class_key: classKey, 
      opis: `${currentUser.firstName || 'Klubowicz'} ${currentUser.lastName || ''} - Zapis na trening: ${selectedClass.title} (${formattedFullDate} ${selectedClass.start}-${selectedClass.end || ''}, ${durationText}). Status: ✅ Lista główna. Obłożenie: ${oblozenieStr}` 
    }]);

    await supabase.from('booking_logs').insert([{
      action_type: 'BOOKING_SUCCESS',
      status: 'SUCCESS',
      reason: `${currentUser.firstName || 'Klubowicz'} zapisany do ${classKey} (zapisany)`,
      rule_applied: isIndividualRuleApplied ? 'INDYWIDUALNY_LIMIT_ZAPISOW' : 'VALIDATION_PASSED',
      payload: { klient_id: currentUser.id, class_key: classKey, status: 'zapisany', is_individual: isIndividualRuleApplied }
    }]);

    showToast("Zostałeś pomyślnie zapisany na zajęcia!");
    setSelectedClass(null);
    loadData();
  };

  const handleConfirmWaitlistSignup = async (cutoffMinutes: number) => {
    if (!currentUser || !selectedClass) return;

    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const allVariantKeys = getKeysVariants(selectedClass.id, selectedClass.displayDate);
    const limitZajec = selectedClass.limit || 12;
    const aktualni = zapisyNaZajecia[classKey] || [];

    // Optimistic UI - dodanie na krzesełko natychmiast
    const waitlistEntry = {
      id: currentUser.id,
      klient_id: currentUser.id,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      status: 'krzesełko',
      waitlist_cutoff_minutes: cutoffMinutes,
      obecny: false,
      nieobecny: false
    };

    setZapisyNaZajecia(prev => {
      const updated = { ...prev };
      allVariantKeys.forEach(vk => {
        if (!updated[vk]) updated[vk] = [];
        if (!updated[vk].some((item: any) => item.id === currentUser.id)) {
          updated[vk] = [...updated[vk], waitlistEntry];
        }
      });
      return updated;
    });

    const { error } = await supabase.from('zapisy_zajec').insert([
      { class_key: classKey, klient_id: currentUser.id, status: 'krzesełko', waitlist_cutoff_minutes: cutoffMinutes, obecny: false }
    ]);

    if (error) {
      showToast(`Nie udało się zapisać na listę rezerwową: ${error.message}`, 'error');
      loadData();
      return;
    }

    let updatedKarnety = [...(currentUser.karnetyKlubowicza || [])];
    const passIndex = updatedKarnety.findIndex((k: any) => isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
    if (passIndex !== -1) {
      const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10);
      if (!isNaN(currentRemaining) && currentRemaining > 0) {
        updatedKarnety[passIndex] = {
          ...updatedKarnety[passIndex],
          pozostaloWejsc: currentRemaining - 1
        };
        await supabase.from('klienci').update({ karnetyKlubowicza: updatedKarnety }).eq('id', currentUser.id);
      }
    }

    let d = 1, m = 1;
    if (selectedClass.displayDate.includes('/')) {
      [d, m] = selectedClass.displayDate.split('/').map(Number);
    } else if (selectedClass.displayDate.includes('-')) {
      const p = selectedClass.displayDate.split('-').map(Number);
      m = p[1]; d = p[2];
    }
    const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
    const classDateObj = new Date(classYear, m - 1, d);
    const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const dayOfWeekName = dayNames[classDateObj.getDay()];
    const formattedFullDate = `${dayOfWeekName}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${classYear}`;
    const durationText = calculateDuration(selectedClass.start, selectedClass.end);

    const rezerwaCount = aktualni.filter((u: any) => u.status === 'krzesełko').length + 1;
    const cutoffLabel = cutoffMinutes >= 60 ? `${cutoffMinutes / 60}h` : `${cutoffMinutes} min`;

    await supabase.from('transakcje').insert([{ 
      klient_id: currentUser.id, 
      typ_operacji: 'zajecia_zapis', 
      class_key: classKey, 
      opis: `${currentUser.firstName || 'Klubowicz'} ${currentUser.lastName || ''} - Zapis na listę rezerwową (krzesełko #${rezerwaCount}): ${selectedClass.title} (${formattedFullDate} ${selectedClass.start}-${selectedClass.end || ''}, ${durationText}). Czas gotowości: ${cutoffLabel} przed startem. Status: 🪑 Krzesełko.` 
    }]);

    await supabase.from('booking_logs').insert([{
      action_type: 'WAITLIST_JOIN',
      status: 'SUCCESS',
      reason: `${currentUser.firstName || 'Klubowicz'} dopisany do krzesełka w ${classKey} (Limit: ${cutoffMinutes} min)`,
      rule_applied: 'VALIDATION_PASSED',
      payload: { klient_id: currentUser.id, class_key: classKey, status: 'krzesełko', cutoff_minutes: cutoffMinutes }
    }]);

    setIsWaitlistModalOpen(false);
    showToast(`Dopisano do listy rezerwowej! System wypisze Cię automatycznie na ${cutoffLabel} przed startem, jeśli nie zwolni się miejsce.`);
    setSelectedClass(null);
    loadData();
  };

  const handleUpdateWaitlistCutoff = async (newCutoff: number) => {
    if (!selectedClass || !editWaitlistTarget) return;
    const keys = getKeysVariants(selectedClass.id, selectedClass.displayDate);
    const { error } = await supabase
      .from('zapisy_zajec')
      .update({ waitlist_cutoff_minutes: newCutoff })
      .in('class_key', keys)
      .eq('klient_id', editWaitlistTarget.id);

    if (error) { 
      showToast(`Nie udało się zaktualizować czasu wypisu: ${error.message}`, 'error'); 
      return; 
    }

    const cutoffLabel = newCutoff >= 60 ? `${newCutoff / 60}h` : `${newCutoff} min`;
    showToast(`Zaktualizowano czas wypisu z listy rezerwowej na: ${cutoffLabel} przed startem.`);
    setIsEditWaitlistModalOpen(false);
    setEditWaitlistTarget(null);
    await loadData();
  };

  const handleKlubowiczWypiszSie = async () => {
    if (!currentUser || !selectedClass) return;
    
    const deadlineInfo = getCancelDeadlineInfo(selectedClass, selectedClass.displayDate);
    if (deadlineInfo && !deadlineInfo.canCancel) {
      showToast(deadlineInfo.label, 'error');
      return;
    }

    if (!confirm("Czy na pewno chcesz wypisać się z tych zajęć?")) return;

    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const keysToDelete = getKeysVariants(selectedClass.id, selectedClass.displayDate);
    const aktualni = zapisyNaZajecia[classKey] || [];

    // Optimistic UI - natychmiastowe usunięcie z widoku
    setZapisyNaZajecia(prev => {
      const updated = { ...prev };
      keysToDelete.forEach(vk => {
        if (updated[vk]) {
          updated[vk] = updated[vk].filter(item => item.id !== currentUser.id);
        }
      });
      return updated;
    });

    const { error } = await supabase
      .from('zapisy_zajec')
      .delete()
      .in('class_key', keysToDelete)
      .eq('klient_id', currentUser.id);

    if (error) { 
      showToast(`Nie udało się wypisać z zajęć: ${error.message}`, 'error'); 
      loadData();
      return; 
    }
    let updatedNadchodzace = currentUser.zapisyNadchodzace || [];
    if (typeof updatedNadchodzace === 'string') {
      try { updatedNadchodzace = JSON.parse(updatedNadchodzace); } catch(e) { updatedNadchodzace = []; }
    }
    const [dStr, mStr] = selectedClass.displayDate.split('/');
    const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
    const filteredNadchodzace = updatedNadchodzace.filter((z: any) => {
      const zData = z.data || '';
      return !(zData.includes(selectedClass.displayDate) || zData.includes(`${classYear}-${mStr.padStart(2, '0')}-${dStr.padStart(2, '0')}`));
    });

    let updatedKarnety = [...(currentUser.karnetyKlubowicza || [])];
    const passIndex = updatedKarnety.findIndex((k: any) => isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
    if (passIndex !== -1) {
      const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10);
      const poczatkowe = parseInt(updatedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
      if (!isNaN(currentRemaining)) {
        updatedKarnety[passIndex] = {
          ...updatedKarnety[passIndex],
          pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
        };
      }
    }

    await supabase.from('klienci').update({ 
      karnetyKlubowicza: updatedKarnety,
      zapisyNadchodzace: filteredNadchodzace
    }).eq('id', currentUser.id);

    const classDateObj = new Date(classYear, parseInt(mStr) - 1, parseInt(dStr));
    const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const dayOfWeekName = dayNames[classDateObj.getDay()];
    const formattedFullDate = `${dayOfWeekName}, ${dStr}.${mStr}.${classYear}`;
    const durationText = calculateDuration(selectedClass.start, selectedClass.end);

    await supabase.from('transakcje').insert([
      { 
        klient_id: currentUser.id, 
        typ_operacji: 'zajecia_wypis', 
        class_key: classKey, 
        opis: `${currentUser.firstName || 'Klubowicz'} ${currentUser.lastName || ''} - Samodzielne wypisanie z zajęć: ${selectedClass.title} (${formattedFullDate} ${selectedClass.start}-${selectedClass.end || ''}, ${durationText}). Zwrócono 1 wejście.` 
      },
      { 
        klient_id: currentUser.id, 
        typ_operacji: 'zajecia_wypis', 
        class_key: `${selectedClass.id}_${classYear}-${mStr.padStart(2, '0')}-${dStr.padStart(2, '0')}`, 
        opis: `Auto-blokada ponownego zapisu (${selectedClass.title} ${selectedClass.displayDate})` 
      }
    ]);

    await supabase.from('booking_logs').insert([{
      action_type: 'CANCEL_SUCCESS',
      status: 'SUCCESS',
      reason: `${currentUser.firstName || 'Klubowicz'} wypisał się z ${classKey}`,
      rule_applied: 'USER_CANCEL',
      payload: { klient_id: currentUser.id, class_key: classKey }
    }]);

    const pozostaliUczestnicy = aktualni.filter((u: any) => String(u.id) !== String(currentUser.id));
    
    // Auto-odwołanie zajęć jeśli jest pusto
    const autoCancelled = await checkAndTriggerImmediateAutoCancel(
      selectedClass,
      selectedClass.displayDate,
      pozostaliUczestnicy
    );

    // Awans z listy rezerwowej (jeśli nie odwołano automatycznie całych zajęć)
    if (!autoCancelled) {
      await promoteWaitlistMember(selectedClass, selectedClass.displayDate, aktualni, currentUser.id);
    }

    showToast("Zostałeś pomyślnie wypisany z zajęć.");
    setSelectedClass(null);
    loadData();
  };

  // WYPISANIE KLUBOWICZA Z LISTY AKTYWNYCH ZAPISÓW (PANEL GŁÓWNY)
  const handleWypiszZListyAktywnych = async (classKey: string, title: string, startStr: string, fullDateObj: Date) => {
    const now = new Date();
    const [sh = '00', sm = '00'] = (startStr || '00:00').split(':');
    const classStartDateTime = new Date(fullDateObj.getFullYear(), fullDateObj.getMonth(), fullDateObj.getDate(), parseInt(sh), parseInt(sm), 0);

    if (classStartDateTime.getTime() < now.getTime()) {
      showToast("Czas na wypisanie minął (Zajęcia historyczne).", 'info');
      return;
    }
    if (!currentUser) return;
    
    const cancelDeadlineMinutes = bookingRules.cancel_deadline_per_class?.[title] !== undefined
      ? Number(bookingRules.cancel_deadline_per_class[title])
      : Number(bookingRules.cancel_deadline_minutes ?? 90);
    const diffMinutes = (classStartDateTime.getTime() - now.getTime()) / (1000 * 60);

    if (diffMinutes < cancelDeadlineMinutes && diffMinutes > 0) {
      showToast(`Nie możesz się wypisać! Minimalny czas na bezpłatny wypis z tych zajęć wynosi ${cancelDeadlineMinutes} minut przed startem.`, 'error');
      return;
    }

    if (!confirm(`Czy na pewno chcesz wypisać się z zajęć: ${title}?`)) return;

    const parts = classKey.split('_');
    const classId = parts[0];
    const dateStr = parts[1];
    const keysToDelete = getKeysVariants(classId, dateStr);

    const { error } = await supabase
      .from('zapisy_zajec')
      .delete()
      .in('class_key', keysToDelete)
      .eq('klient_id', currentUser.id);

    if (error) { 
      showToast(`Nie udało się wypisać z zajęć: ${error.message}`, 'error'); 
      return; 
    }

    let updatedNadchodzace = currentUser.zapisyNadchodzace || [];
    if (typeof updatedNadchodzace === 'string') {
      try { updatedNadchodzace = JSON.parse(updatedNadchodzace); } catch(e) { updatedNadchodzace = []; }
    }
    const dayStr = String(fullDateObj.getDate()).padStart(2, '0');
    const monthStr = String(fullDateObj.getMonth() + 1).padStart(2, '0');
    const yearStr = String(fullDateObj.getFullYear());
    const filteredNadchodzace = updatedNadchodzace.filter((z: any) => {
      const zData = z.data || '';
      return !(zData.includes(`${dayStr}/${monthStr}`) || zData.includes(`${yearStr}-${monthStr}-${dayStr}`));
    });

    let updatedKarnety = [...(currentUser.karnetyKlubowicza || [])];
    const passIndex = updatedKarnety.findIndex((k: any) => isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
    if (passIndex !== -1) {
      const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10);
      const poczatkowe = parseInt(updatedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
      if (!isNaN(currentRemaining)) {
        updatedKarnety[passIndex] = {
          ...updatedKarnety[passIndex],
          pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
        };
      }
    }

    await supabase.from('klienci').update({ 
      karnetyKlubowicza: updatedKarnety,
      zapisyNadchodzace: filteredNadchodzace
    }).eq('id', currentUser.id);

    const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const dayName = dayNames[fullDateObj.getDay()];
    const formattedFullDate = `${dayName}, ${dayStr}.${monthStr}.${yearStr}`;

    await supabase.from('transakcje').insert([
      { 
        klient_id: currentUser.id, 
        typ_operacji: 'zajecia_wypis', 
        class_key: classKey, 
        opis: `${currentUser.firstName || 'Klubowicz'} ${currentUser.lastName || ''} - Samodzielne wypisanie z zajęć: ${title} (${formattedFullDate} ${startStr}). Zwrócono 1 wejście.` 
      },
      { 
        klient_id: currentUser.id, 
        typ_operacji: 'zajecia_wypis', 
        class_key: `${classId}_${yearStr}-${monthStr}-${dayStr}`, 
        opis: `Auto-blokada ponownego zapisu (${title})` 
      }
    ]);
    
    const classInfo = findClassDetails(classId, dateStr);
    const limitZajec = classInfo?.limit || 12;

    const aktualni = zapisyNaZajecia[classKey] || [];
    const pozostaliUczestnicy = aktualni.filter((u: any) => String(u.id) !== String(currentUser.id));

    const autoCancelled = await checkAndTriggerImmediateAutoCancel(
      classInfo || { id: classId, title, start: startStr, limit: limitZajec },
      dateStr,
      pozostaliUczestnicy
    );

    // Awans z krzesełka połączony z powiadomieniami PUSH
    if (!autoCancelled) {
      await promoteWaitlistMember(
        classInfo || { id: classId, title, start: startStr, limit: limitZajec },
        dateStr,
        aktualni,
        currentUser.id
      );
    }

    showToast(autoCancelled 
      ? "Wypisano z zajęć. Trening został automatycznie odwołany z powodu zbyt małej liczby osób (zwrócono wejścia)." 
      : "Zostałeś pomyślnie wypisany z zajęć i odzyskałeś wejście."
    );
    await loadData();
  };

  // ZAPIS KLUBOWICZA DO ZAJĘĆ PRZEZ TRENERA / ADMINA Z WALIDACJĄ OVERBOOKINGU
  const handleZapiszKlientaDoZajec = async (klient: any) => {
    if (!selectedClass) return;
    if (selectedClass.isOdwołane || selectedClass.isUsunięte) { 
      showToast("Nie można zapisać na odwołane lub usunięte zajęcia!", 'error'); 
      return; 
    }
    
    const dzisiajData = todayStr;
    const clientBanDate = klient.blokadaDo || klient.blokada_do;
    const isClientBlocked = clientBanDate && String(clientBanDate) >= dzisiajData;
    const isPassBlocked = (klient.karnetyKlubowicza || []).some((k: any) => k.blokadaDo && String(k.blokadaDo) >= dzisiajData);
    
    if (isClientBlocked || isPassBlocked) { 
      showToast(`Nie można zapisać klienta! ${klient.powodBlokady || (isClientBlocked ? `Klient posiada aktywną blokadę konta do ${clientBanDate}.` : 'Klient posiada aktywną blokadę karnetu.')}`, 'error'); 
      return; 
    }

    const classKeyStr = `${selectedClass.id}_${selectedClass.displayDate}`;
    const parts = classKeyStr.split('_');
    const dateStr = parts[1];
    let d = 1, m = 1;
    if (dateStr.includes('/')) {
      [d, m] = dateStr.split('/').map(Number);
    } else if (dateStr.includes('-')) {
      const p = dateStr.split('-').map(Number);
      m = p[1];
      d = p[2];
    }
    const classDateObj = new Date(new Date().getFullYear(), m - 1, d);
    const calcClassDateStr = `${classDateObj.getFullYear()}-${String(classDateObj.getMonth() + 1).padStart(2, '0')}-${String(classDateObj.getDate()).padStart(2, '0')}`;

    const isPassSuspended = (klient.karnetyKlubowicza || []).some((k: any) => {
      if (k.zawieszonyOd) {
         const sOd = k.zawieszonyOd;
         const sDo = k.zawieszonyDo || '9999-12-31';
         return calcClassDateStr >= sOd && calcClassDateStr <= sDo;
      }
      return false;
    });

    if (isPassSuspended) {
      showToast(`Karnet klienta jest zawieszony w dniu tych zajęć (${calcClassDateStr}).`, 'warning');
      return;
    }

    const passAllowsClass = (klient.karnetyKlubowicza || []).some((k: any) => {
      if (k.waznyDo) {
        const expDate = new Date(k.waznyDo);
        expDate.setHours(23, 59, 59, 999);
        if (expDate < new Date()) return false;
      }
      if (isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined && parseInt(k.pozostaloWejsc, 10) <= 0) {
        return false;
      }
      return checkPassAllowsClass(k, selectedClass.title, dostepneKarnety);
    });

    if (klient.karnetyKlubowicza && klient.karnetyKlubowicza.length > 0 && !passAllowsClass) {
      if (!confirm(`UWAGA: Karnet klienta "${klient.pass || ''}" nie obejmuje zajęć "${selectedClass.title}". Czy na pewno chcesz zapisać go mimo to jako administrator/trener?`)) {
        return;
      }
    }

    const walletVal = parseFloat(String(klient.wallet || klient.Portfel || '0').replace(/[^0-9.-]+/g, "")) || 0;
    if (walletVal < 0) {
      if (!confirm(`UWAGA: Klubowicz ${klient.firstName} ${klient.lastName} posiada zadłużenie (${klient.wallet || klient.Portfel}). Zapisać mimo to?`)) return;
    } else {
      if (!confirm(`Czy na pewno chcesz zapisać klienta ${klient.firstName} ${klient.lastName} na zajęcia?`)) return;
    }

    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const allVariantKeys = getKeysVariants(selectedClass.id, selectedClass.displayDate);

    const { data: liveDbSignups } = await supabase
      .from('zapisy_zajec')
      .select('id, status, klient_id')
      .in('class_key', allVariantKeys);

    const actualDbList = liveDbSignups || [];
    if (actualDbList.some(k => String(k.klient_id) === String(klient.id))) { 
      showToast("Ten klient jest już na liście tych zajęć!", 'info'); 
      return; 
    }
    
    let dailyLimit = bookingRules.max_daily_bookings !== null && bookingRules.max_daily_bookings !== undefined
      ? bookingRules.max_daily_bookings
      : Infinity;

    if (klient.karnetyKlubowicza && klient.karnetyKlubowicza.length > 0) {
      const activePass = klient.karnetyKlubowicza[0];
      const passDef = dostepneKarnety.find((k: any) => k.nazwa === activePass.nazwa);
      if (passDef) {
        let meta: any = {};
        try { meta = typeof passDef.inne_ustawienia === 'string' ? JSON.parse(passDef.inne_ustawienia) : (passDef.inne_ustawienia || {}); } catch(e) {}
        const typLimitu = meta.dziennyLimit || passDef.dziennyLimit;
        const iloscLimitu = meta.niestandardowyDziennyIlosc || passDef.niestandardowyDziennyIlosc;
        if (typLimitu === 'Niestandardowy') dailyLimit = Math.min(dailyLimit, parseInt(iloscLimitu, 10) || Infinity);
      }
    }

    let userSignupsOnThisDate = 0;
    const countedDayKeys = new Set<string>();
    Object.entries(zapisyNaZajecia).forEach(([cKey, uczestnicy]) => {
      if (cKey.includes(`_${selectedClass.displayDate}`) || cKey.endsWith(`_${selectedClass.displayDate}`)) {
        const classId = cKey.split('_')[0];
        const normalizedKey = `${classId}_${selectedClass.displayDate}`;
        if (!countedDayKeys.has(normalizedKey)) {
          if (Array.isArray(uczestnicy) && uczestnicy.some((u: any) => String(u.id) === String(klient.id))) {
            userSignupsOnThisDate++;
            countedDayKeys.add(normalizedKey);
          }
        }
      }
    });

    if (userSignupsOnThisDate >= dailyLimit) { 
      showToast(`Nie można zapisać! Wykorzystano dzienny limit (${dailyLimit}).`, 'error'); 
      return; 
    }
    
    const limitZajec = selectedClass.limit || 12;
    const glownaLiveCount = actualDbList.filter((u: any) => u.status === 'zapisany').length;
    const statusZpisu = glownaLiveCount >= limitZajec ? 'krzesełko' : 'zapisany';

    const { error } = await supabase.from('zapisy_zajec').insert([
      { class_key: classKey, klient_id: klient.id, status: statusZpisu, waitlist_cutoff_minutes: statusZpisu === 'krzesełko' ? 30 : null, obecny: false }
    ]);
    
    if (error) { 
      showToast(`Nie udało się zapisać: ${error.message}`, 'error'); 
      return; 
    }

    let updatedKarnety = [...(klient.karnetyKlubowicza || [])];
    const passIndex = updatedKarnety.findIndex((k: any) => isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
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

    const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const dayOfWeekName = dayNames[classDateObj.getDay()];
    const formattedFullDate = `${dayOfWeekName}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${classDateObj.getFullYear()}`;
    const durationText = calculateDuration(selectedClass.start, selectedClass.end);
    const oblozenieStr = `${glownaLiveCount + (statusZpisu === 'zapisany' ? 1 : 0)}/${limitZajec}`;
    const statusLabel = statusZpisu === 'krzesełko' ? '🪑 Krzesełko (Lista rezerwowa)' : '✅ Lista główna';
    
    await supabase.from('transakcje').insert([{ 
      klient_id: klient.id, 
      typ_operacji: 'zajecia_zapis', 
      class_key: classKey, 
      opis: `${klient.firstName} ${klient.lastName} - Zapis na trening: ${selectedClass.title} (${formattedFullDate} ${selectedClass.start}-${selectedClass.end || ''}, ${durationText}). Status: ${statusLabel}. Obłożenie: ${oblozenieStr}` 
    }]);

    await sendPushNotification(klient.id, {
      title: `Zapisano na trening: ${selectedClass.title}`,
      body: `Zostałeś zapisany na trening "${selectedClass.title}" (${selectedClass.displayDate} ${selectedClass.start}) - ${statusZpisu === 'krzesełko' ? 'Lista rezerwowa' : 'Lista główna'}.`,
      url: '/'
    });

    setIsSearchingClient(false); 
    setSearchClientQuery(''); 
    await loadData();
    showToast(`Pomyślnie zapisano ${klient.firstName} ${klient.lastName}! (${statusZpisu === 'krzesełko' ? 'Krzesełko' : 'Lista główna'})`);
  };

  // OBSŁUGA WYPISYWANIA: TRENER (ZAWSZE ODEJMUJE WEJŚCIE, PYTA O BLOKADĘ) VS ADMIN (PYTA O ZWROT)
  const handlePotwierdzWypisanie = async () => {
    if (!selectedClass || !clientToUnregister) return;
    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const keysToDelete = getKeysVariants(selectedClass.id, selectedClass.displayDate);
    const aktualni = zapisyNaZajecia[classKey] || [];

    // Optimistic UI - natychmiastowe usunięcie klienta z listy
    setZapisyNaZajecia(prev => {
      const updated = { ...prev };
      keysToDelete.forEach(k => {
        if (updated[k]) {
          updated[k] = updated[k].filter(item => item.id !== clientToUnregister.id);
        }
      });
      return updated;
    });

    const { error } = await supabase
      .from('zapisy_zajec')
      .delete()
      .in('class_key', keysToDelete)
      .eq('klient_id', clientToUnregister.id);

    if (error) { 
      showToast(`Nie udało się wypisać: ${error.message}`, 'error'); 
      loadData();
      return; 
    }

    // REGULA DLA RÓL:
    // Administrator: pyta czy zwrócić wejście
    // Trener: NIE pyta czy zwrócić wejście, zawsze wejście przepada (nie jest zwracane do puli)
    let zwrocicWejscie = false;
    if (appRole === 'admin') {
      zwrocicWejscie = confirm("Czy zwrócić klubowiczowi wejście na karnet?");
    } else {
      zwrocicWejscie = false;
    }

    let updatedKarnety = [...(clientToUnregister.karnetyKlubowicza || [])];
    if (zwrocicWejscie) {
      const passIndex = updatedKarnety.findIndex((k: any) => isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
      if (passIndex !== -1) {
        const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10);
        const poczatkowe = parseInt(updatedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
        if (!isNaN(currentRemaining)) {
          updatedKarnety[passIndex] = {
            ...updatedKarnety[passIndex],
            pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
          };
        }
      }
    }

    let updatedNadchodzace = clientToUnregister.zapisyNadchodzace || [];
    if (typeof updatedNadchodzace === 'string') {
      try { updatedNadchodzace = JSON.parse(updatedNadchodzace); } catch(e) { updatedNadchodzace = []; }
    }
    const [dStr, mStr] = selectedClass.displayDate.split('/');
    const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
    const filteredNadchodzace = updatedNadchodzace.filter((z: any) => {
      const zData = z.data || '';
      return !(zData.includes(selectedClass.displayDate) || zData.includes(`${classYear}-${mStr.padStart(2, '0')}-${dStr.padStart(2, '0')}`));
    });

    await supabase.from('klienci').update({ 
      karnetyKlubowicza: updatedKarnety,
      zapisyNadchodzace: filteredNadchodzace
    }).eq('id', clientToUnregister.id);

    const classDateObj = new Date(classYear, parseInt(mStr) - 1, parseInt(dStr));
    const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const dayOfWeekName = dayNames[classDateObj.getDay()];
    const formattedFullDate = `${dayOfWeekName}, ${dStr}.${mStr}.${classYear}`;
    const durationText = calculateDuration(selectedClass.start, selectedClass.end);

    await supabase.from('transakcje').insert([
      { 
        klient_id: clientToUnregister.id, 
        typ_operacji: 'zajecia_wypis', 
        class_key: classKey, 
        opis: `${clientToUnregister.firstName} ${clientToUnregister.lastName} - Wypisanie z treningu przez ${appRole === 'trener' ? 'trenera' : 'klub'}: ${selectedClass.title} (${formattedFullDate} ${selectedClass.start}-${selectedClass.end || ''}, ${durationText}).${zwrocicWejscie ? ' Zwrócono 1 wejście.' : ' Wejście NIE zostało zwrócone.'}` 
      },
      { 
        klient_id: clientToUnregister.id, 
        typ_operacji: 'zajecia_wypis', 
        class_key: `${selectedClass.id}_${classYear}-${mStr.padStart(2, '0')}-${dStr.padStart(2, '0')}`, 
        opis: `Auto-blokada ponownego zapisu (${selectedClass.title} ${selectedClass.displayDate})` 
      }
    ]);
    
    const pozostaliUczestnicy = aktualni.filter((u: any) => u.id !== clientToUnregister.id);

    const autoCancelled = await checkAndTriggerImmediateAutoCancel(
      selectedClass,
      selectedClass.displayDate,
      pozostaliUczestnicy
    );

    if (!autoCancelled) {
      await promoteWaitlistMember(selectedClass, selectedClass.displayDate, aktualni, clientToUnregister.id);
    }

    if (blokadaZapisow) {
      const dni = parseInt(dlugoscBlokady) || 3;
      const dataWygaśnięcia = new Date();
      dataWygaśnięcia.setDate(dataWygaśnięcia.getDate() + dni);
      const dataStr = `${dataWygaśnięcia.getFullYear()}-${String(dataWygaśnięcia.getMonth() + 1).padStart(2, '0')}-${String(dataWygaśnięcia.getDate()).padStart(2, '0')}`;
      const powod = `Blokada zapisów na ${dni} dni po wypisaniu z treningu ${selectedClass.title} w dniu ${selectedClass.displayDate}.`;
      
      let updatedClientKarnety = (clientToUnregister.karnetyKlubowicza || []).map((k: any) => ({
        ...k,
        blokadaDo: dataStr,
        powodBlokady: powod
      }));

      await supabase.from('klienci').update({ blokadaDo: dataStr, powodBlokady: powod, karnetyKlubowicza: updatedClientKarnety }).eq('id', clientToUnregister.id);
      
      setKlienciList(prev => prev.map(c => c.id === clientToUnregister.id ? { ...c, blokadaDo: dataStr, powodBlokady: powod, karnetyKlubowicza: updatedClientKarnety } : c));
      if (currentUser && currentUser.id === clientToUnregister.id) {
        setCurrentUser((prev: any) => ({ ...prev, blokadaDo: dataStr, powodBlokady: powod, karnetyKlubowicza: updatedClientKarnety }));
      }
      
      await handleAutoWypiszPoZablokowaniu(clientToUnregister.id, clientToUnregister, powod, classKey);
    }
    setClientToUnregister(null); 
    setBlokadaZapisow(false); 
    await loadData();
    showToast(autoCancelled 
      ? "Wypisano klienta. Trening został automatycznie odwołany ze względu na brak minimalnej liczby uczestników." 
      : `Wypisano klienta z zajęć.${!zwrocicWejscie ? ' Wejście nie zostało zwrócone.' : ''}`
    );
  };

  const handlePotwierdzNieobecnosc = async () => {
    if (!selectedClass || !clientToMarkAbsent) return;
    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const keys = getKeysVariants(selectedClass.id, selectedClass.displayDate);
    const { error } = await supabase.from('zapisy_zajec').update({ obecny: false, nieobecny: true }).in('class_key', keys).eq('klient_id', clientToMarkAbsent.id);
    if (error) { showToast(`Nie udało się oznaczyć: ${error.message}`, 'error'); return; }
    
    let d = 1, m = 1;
    if (selectedClass.displayDate.includes('/')) {
      [d, m] = selectedClass.displayDate.split('/').map(Number);
    } else if (selectedClass.displayDate.includes('-')) {
      const p = selectedClass.displayDate.split('-').map(Number);
      m = p[1]; d = p[2];
    }
    const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
    const classDateObj = new Date(classYear, m - 1, d);
    const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const dayOfWeekName = dayNames[classDateObj.getDay()];
    const formattedFullDate = `${dayOfWeekName}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${classYear}`;
    const durationText = calculateDuration(selectedClass.start, selectedClass.end);

    await supabase.from('transakcje').insert([{ 
      klient_id: clientToMarkAbsent.id, 
      typ_operacji: 'zajecia_wypis', 
      class_key: classKey, 
      opis: `${clientToMarkAbsent.firstName} ${clientToMarkAbsent.lastName} - Oznaczono jako NIEOBECNY na treningu: ${selectedClass.title} (${formattedFullDate} ${selectedClass.start}-${selectedClass.end || ''}, ${durationText}).` 
    }]);
    
    if (blokadaZapisow) {
      const dni = parseInt(dlugoscBlokady) || 3;
      const dataWygaśnięcia = new Date();
      dataWygaśnięcia.setDate(dataWygaśnięcia.getDate() + dni);
      const dataStr = `${dataWygaśnięcia.getFullYear()}-${String(dataWygaśnięcia.getMonth() + 1).padStart(2, '0')}-${String(dataWygaśnięcia.getDate()).padStart(2, '0')}`;
      const powod = `Blokada zapisów na ${dni} dni za brak obecności na treningu ${selectedClass.title} w dniu ${selectedClass.displayDate}.`;
      
      let updatedClientKarnety = (clientToMarkAbsent.karnetyKlubowicza || []).map((k: any) => ({
        ...k,
        blokadaDo: dataStr,
        powodBlokady: powod
      }));

      await supabase.from('klienci').update({ blokadaDo: dataStr, powodBlokady: powod, karnetyKlubowicza: updatedClientKarnety }).eq('id', clientToMarkAbsent.id);
      
      setKlienciList(prev => prev.map(c => c.id === clientToMarkAbsent.id ? { ...c, blokadaDo: dataStr, powodBlokady: powod, karnetyKlubowicza: updatedClientKarnety } : c));
      if (currentUser && currentUser.id === clientToMarkAbsent.id) {
        setCurrentUser((prev: any) => ({ ...prev, blokadaDo: dataStr, powodBlokady: powod, karnetyKlubowicza: updatedClientKarnety }));
      }
      
      await handleAutoWypiszPoZablokowaniu(clientToMarkAbsent.id, clientToMarkAbsent, powod, classKey);
    }
    setClientToMarkAbsent(null); 
    setBlokadaZapisow(false); 
    await loadData();
    showToast(`Oznaczono nieobecność dla ${clientToMarkAbsent.firstName} ${clientToMarkAbsent.lastName}.`);
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

  const today = new Date();
  const currentMonday = getMonday(selectedWeekDate);
  const dashboardDays = Array.from({ length: 5 }).map((_, index) => {
    const dayDate = new Date(currentMonday);
    dayDate.setDate(currentMonday.getDate() + index);
    const dayNames = ['PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK'];
    const keys = ['pon', 'wt', 'sr', 'czw', 'pt'];
    const dayStr = String(dayDate.getDate()).padStart(2, '0');
    const monthStr = String(dayDate.getMonth() + 1).padStart(2, '0');
    return { 
      day: dayNames[index], 
      key: keys[index], 
      date: `${dayStr}/${monthStr}`, 
      isoDate: `${dayDate.getFullYear()}-${monthStr}-${dayStr}`, 
      fullDate: dayDate 
    };
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
        const effectiveDiscount = getEffectiveDiscount(client);
        if (effectiveDiscount.percent > 0) { 
          amount = basePrice * (1 - effectiveDiscount.percent / 100); 
        } else { 
          amount = basePrice; 
        }
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
  
  let myUpcomingClasses: any[] = [];
  let prawdziweZapisyKlubowicza = 0;

  if (['klubowicz', 'trener'].includes(appRole) && currentUser) {
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
        if (isQuantityPass(k) && k.pozostaloWejsc !== undefined && k.pozostaloWejsc !== null) {
          if (k.pozostaloWejsc <= 0) { isValid = false; } else if (k.pozostaloWejsc <= 2) { isExpiring = true; msg = `W karnecie "${k.nazwa}" ${k.pozostaloWejsc === 1 ? 'zostało tylko 1 wejście' : `zostały tylko ${k.pozostaloWejsc} wejścia`}!`; }
        }
        if (isValid) { hasAnyValid = true; if (isExpiring) { isPassExpiringSoon = true; expiringMessage = msg; } }
      }
      if (!hasAnyValid) { needsNewPass = true; }
    }

    prawdziweZapisyKlubowicza = getPrawdziweAktywneZapisy(currentUser.id);
    const now = new Date();
    Object.entries(zapisyNaZajecia).forEach(([classKey, uczestnicy]) => {
      const mojZapis = Array.isArray(uczestnicy) ? uczestnicy.find((u: any) => String(u.id) === String(currentUser.id)) : null;
      if (mojZapis) {
        const parts = classKey.split('_');
        const classId = parts[0];
        const dateStr = parts[1];
        if (dateStr) {
          const classInfo = findClassDetails(classId, dateStr);

          if (classInfo) {
            if (appRole === 'klubowicz' && classInfo.isUsunięte) {
              // pomijamy usunięte dla klubowicza
            } else {
              const [sh = '00', sm = '00'] = (classInfo.start || '00:00').split(':');
              const classStartDateTime = new Date(
                classInfo.targetDayDate.getFullYear(),
                classInfo.targetDayDate.getMonth(),
                classInfo.targetDayDate.getDate(),
                parseInt(sh),
                parseInt(sm),
                0
              );

              if (classStartDateTime >= now) {
                const progWorkout = getProgrammedWorkout(classInfo, classInfo.isoDateStr, classInfo.displayDateStr);
                const cancelInfo = getCancelDeadlineInfo(classInfo, classInfo.displayDateStr);

                if (!myUpcomingClasses.some((existing: any) => String(existing.id) === String(classInfo.id) && existing.isoDateStr === classInfo.isoDateStr)) {
                  myUpcomingClasses.push({
                    ...classInfo,
                    classKey,
                    displayDate: classInfo.displayDateStr,
                    isoDateStr: classInfo.isoDateStr,
                    fullDateObj: classInfo.targetDayDate,
                    signupStatus: mojZapis.status || 'zapisany',
                    isKrzeselko: mojZapis.status === 'krzesełko',
                    waitlistCutoffMinutes: mojZapis.waitlist_cutoff_minutes || 30,
                    programmedWorkout: progWorkout,
                    cancelInfo
                  });
                }
              }
            }
          }
        }
      }
    });
    myUpcomingClasses.sort((a, b) => {
       if (a.fullDateObj.getTime() !== b.fullDateObj.getTime()) return a.fullDateObj.getTime() - b.fullDateObj.getTime();
       return (a.start || "").localeCompare(b.start || "");
    });
  }

  const isCurrentUserBlocked = currentUser?.blokadaDo && currentUser.blokadaDo >= todayStr;
  const activePassBlocked = (currentUser?.karnetyKlubowicza || []).find((k: any) => k.blokadaDo && k.blokadaDo >= todayStr);
  const activePassSuspended = (currentUser?.karnetyKlubowicza || []).find((k: any) => k.zawieszonyOd);

  // FILTROWANIE OPERACJI / TRANSAKCJI DLA TABELI OPERACJI W PANELU ZARZĄDZANIA
  const filteredOperationsList = wszystkieTransakcje.filter(t => {
    if (!t) return false;
    const tDate = t.created_at ? t.created_at.split('T')[0] : '';
    if (operationsDateRange.from && tDate < operationsDateRange.from) return false;
    if (operationsDateRange.to && tDate > operationsDateRange.to) return false;

    if (!operationsSearchQuery.trim()) return true;
    const q = operationsSearchQuery.toLowerCase();
    const opisText = (t.opis || '').toLowerCase();
    const opTypeText = (t.typ_operacji || '').toLowerCase();
    const clientObj = klienciList.find(c => c.id === t.klient_id);
    const clientName = clientObj ? `${clientObj.firstName || ''} ${clientObj.lastName || ''}`.toLowerCase() : '';
    const clientEmail = clientObj?.email ? clientObj.email.toLowerCase() : '';

    return opisText.includes(q) || opTypeText.includes(q) || clientName.includes(q) || clientEmail.includes(q);
  });

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 font-sans antialiased text-slate-800 relative">
      
      {/* SYSTEM POWIADOMIEŃ TOAST */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-[100] px-5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
            toastMessage.type === 'success'
              ? 'bg-slate-900 text-emerald-300 border-emerald-500/50'
              : toastMessage.type === 'error'
              ? 'bg-slate-900 text-rose-300 border-rose-500/50'
              : toastMessage.type === 'warning'
              ? 'bg-slate-900 text-amber-300 border-amber-500/50'
              : 'bg-slate-900 text-sky-300 border-sky-500/50'
          }`}
        >
          <span className="text-lg">
            {toastMessage.type === 'success' && '✅'}
            {toastMessage.type === 'error' && '🚫'}
            {toastMessage.type === 'warning' && '⚠️'}
            {toastMessage.type === 'info' && 'ℹ️'}
          </span>
          <p className="text-xs font-bold tracking-wide text-white">{toastMessage.text}</p>
        </div>
      )}

      {/* SEKCJA: OGŁOSZENIA SPERSONALIZOWANE */}
      {['klubowicz', 'trener'].includes(appRole) && ogloszeniaList.length > 0 && (
        <div className="space-y-3">
          {ogloszeniaList.map((ogloszenie: any) => (
            <div
              key={ogloszenie.id}
              className="bg-gradient-to-r from-sky-950 via-slate-900 to-slate-950 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-sky-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in zoom-in-95"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-sky-800/40 border border-sky-700/60 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                  📢
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
                      Ogłoszenie
                    </span>
                    {ogloszenie.target && ogloszenie.target !== 'Wszystkich' && (
                      <span className="bg-sky-900/80 text-sky-200 text-[10px] font-bold px-2.5 py-0.5 rounded-md border border-sky-700/80">
                        Dotyczy: {ogloszenie.target}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-slate-100 whitespace-pre-wrap leading-relaxed">
                    {ogloszenie.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BANNER 1: BLOKADA KONTA KLUBOWICZA */}
      {['klubowicz', 'trener'].includes(appRole) && currentUser && isCurrentUserBlocked && (
        <div className="bg-rose-100 border border-rose-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center shrink-0 border border-rose-200">
              <span className="text-2xl">🚫</span>
            </div>
            <div>
              <h3 className="font-black text-rose-950 text-sm sm:text-base uppercase tracking-wider">Konto zablokowane!</h3>
              <p className="text-xs text-rose-800 font-medium mt-0.5">
                {currentUser.powodBlokady || `Posiadasz aktywną blokadę zapisów na zajęcia do ${currentUser.blokadaDo}.`}
              </p>
            </div>
          </div>
          <span className="bg-rose-600 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider shrink-0">
            Blokada do: {currentUser.blokadaDo}
          </span>
        </div>
      )}

      {/* BANNER 2: ZABLOKOWANY KARNET */}
      {['klubowicz', 'trener'].includes(appRole) && currentUser && activePassBlocked && !isCurrentUserBlocked && (
        <div className="bg-rose-100 border border-rose-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center shrink-0 border border-rose-200">
              <span className="text-2xl">🔒</span>
            </div>
            <div>
              <h3 className="font-black text-rose-950 text-sm sm:text-base uppercase tracking-wider">Twój karnet został zablokowany!</h3>
              <p className="text-xs text-rose-800 font-medium mt-0.5">
                Karnet "{activePassBlocked.nazwa}" jest zablokowany w okresie {activePassBlocked.blokadaOd ? `od ${activePassBlocked.blokadaOd} ` : ''}do {activePassBlocked.blokadaDo}.
              </p>
            </div>
          </div>
          <span className="bg-rose-600 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider shrink-0">
            Blokada do: {activePassBlocked.blokadaDo}
          </span>
        </div>
      )}

      {/* BANNER 3: ZAWIESZONY KARNET */}
      {['klubowicz', 'trener'].includes(appRole) && currentUser && activePassSuspended && (
        <div className="bg-amber-100 border border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center shrink-0 border border-amber-200">
              <span className="text-2xl">⏸️</span>
            </div>
            <div>
              <h3 className="font-black text-amber-950 text-sm sm:text-base uppercase tracking-wider">Twój karnet jest zawieszony</h3>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                Karnet "{activePassSuspended.nazwa}" został zawieszony od dnia {activePassSuspended.zawieszonyOd} {activePassSuspended.zawieszonyDo ? `(planowo do ${activePassSuspended.zawieszonyDo})` : ''}. Ważność zostanie doliczona po odwieszeniu.
              </p>
            </div>
          </div>
          <span className="bg-amber-600 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider shrink-0">
            Zawieszony
          </span>
        </div>
      )}

      {/* BANNER 4: ZADŁUŻENIE W PORTFELU */}
      {['klubowicz', 'trener'].includes(appRole) && currentUser && (() => {
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

      {/* BANNER 5: BRAK KARNETU */}
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
          <Link
            href="/karnet"
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer shrink-0 text-center"
          >
            Kup karnet
          </Link>
        </div>
      )}

      {/* BANNER 6: KOŃCZĄCY SIĘ KARNET */}
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
          <Link
            href="/karnet"
            className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer shrink-0 text-center"
          >
            Kup nowy / Przedłuż
          </Link>
        </div>
      )}

      {/* WIDOK DLA KLUBOWICZA I TRENERA: TWOJE ZAPISY I KARNETY */}
      {['klubowicz', 'trener'].includes(appRole) && currentUser && (
        <div className="space-y-10 animate-in fade-in zoom-in-95">
          
          {/* SEKCJA: TWOJE AKTYWNE ZAPISY */}
          <section className="space-y-4">
            <h2 className="text-[13px] font-medium text-slate-500 uppercase tracking-wider pl-1">Twoje aktywne zapisy</h2>
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              
              {myUpcomingClasses.length > 0 && (
                <div className="hidden sm:flex justify-between px-5 py-3 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white">
                  <div className="w-[30%]">Data</div>
                  <div className="w-[45%]">Zajęcia i plan</div>
                  <div className="w-[25%] text-right pr-2">Status wypisu</div>
                </div>
              )}
              
              <div className="divide-y divide-slate-100">
                {myUpcomingClasses.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500 font-medium">
                    Nie masz aktualnie żadnych aktywnych zapisów na zajęcia.
                  </div>
                ) : (
                  (showAllMyClasses ? myUpcomingClasses : myUpcomingClasses.slice(0, 3)).map((cls, idx) => {
                    const cancelInfo = cls.cancelInfo || getCancelDeadlineInfo(cls, cls.displayDate);

                    return (
                      <div key={idx} className="flex items-center justify-between p-4 sm:px-5 sm:py-4 hover:bg-slate-50 transition-colors bg-white gap-2 sm:gap-4">
                        
                        <div className="shrink-0 min-w-[95px] sm:min-w-[130px] pr-1">
                          <div className="text-[10px] font-black text-sky-700 uppercase tracking-wider mb-0.5">
                            {['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'][cls.fullDateObj.getDay()]}
                          </div>
                          <div className="text-[12px] sm:text-[13px] font-bold text-slate-800 font-mono">
                            {`${String(cls.fullDateObj.getDate()).padStart(2, '0')}.${String(cls.fullDateObj.getMonth() + 1).padStart(2, '0')}.${String(cls.fullDateObj.getFullYear()).slice(-2)}`}
                          </div>
                          <div className="text-[10px] sm:text-[12px] text-slate-500 mt-0.5">
                            {cls.start} - {cls.end} ({calculateDuration(cls.start, cls.end)})
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 px-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] sm:text-[13px] font-bold text-slate-900">{cls.title}</span>
                            {cls.isKrzeselko ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditWaitlistTarget(currentUser);
                                  setEditWaitlistCutoff(cls.waitlistCutoffMinutes || 30);
                                  setSelectedClass(cls);
                                  setIsEditWaitlistModalOpen(true);
                                }}
                                className="bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-200 text-[9px] font-black px-2 py-0.5 rounded-md inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shadow-xs shrink-0"
                                title="Kliknij, aby zmienić czas gotowości bez utraty miejsca w kolejce"
                              >
                                <span>🪑 Krzesełko ({cls.waitlistCutoffMinutes >= 60 ? `${cls.waitlistCutoffMinutes / 60}h` : `${cls.waitlistCutoffMinutes} min`})</span>
                                <span className="text-[8px] opacity-70">✏️</span>
                              </button>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[9px] font-black px-2 py-0.5 rounded-md inline-flex items-center gap-1 shrink-0">
                                <span>✅ Grupa Główna</span>
                              </span>
                            )}
                          </div>

                          {cls.programmedWorkout && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="bg-amber-100 text-amber-950 font-black text-[9px] px-1.5 py-0.5 rounded border border-amber-300">
                                Trening {cls.programmedWorkout.index}/{cls.programmedWorkout.total}: {cls.programmedWorkout.workout.tytul}
                              </span>
                              {cls.programmedWorkout.workout.opis && (
                                <span className="text-[10px] text-slate-500 truncate max-w-[160px] sm:max-w-[250px]" title={cls.programmedWorkout.workout.opis}>
                                  ({cls.programmedWorkout.workout.opis})
                                </span>
                              )}
                            </div>
                          )}
                          <div className="text-[11px] sm:text-[12px] text-slate-500 mt-0.5 truncate">{cls.trainer || 'Brak trenera'}</div>
                        </div>

                        <div className="shrink-0 flex items-center justify-end gap-2.5 pl-1">
                          {cancelInfo && (
                            <div className="text-right hidden sm:block">
                              {cancelInfo.status === 'countdown' ? (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-950 font-bold px-2 py-1 rounded-lg text-[10px] border border-amber-300 animate-pulse">
                                  {cancelInfo.label}
                                </span>
                              ) : cancelInfo.status === 'locked' ? (
                                <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-bold px-2 py-1 rounded-lg text-[10px] border border-rose-200">
                                  🔒 Zablokowany wypis
                                </span>
                              ) : null}
                            </div>
                          )}

                          <button 
                            onClick={() => handleWypiszZListyAktywnych(cls.classKey, cls.title, cls.start, cls.fullDateObj)}
                            disabled={cancelInfo && !cancelInfo.canCancel}
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-md transition-transform shrink-0 ${
                              cancelInfo && !cancelInfo.canCancel
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                : 'bg-[#ff2a43] hover:bg-rose-600 text-white hover:scale-105 cursor-pointer'
                            }`}
                            title={cancelInfo && !cancelInfo.canCancel ? cancelInfo.label : "Wypisz się z zajęć"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l4 4m0-4l-4 4" />
                            </svg>
                          </button>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
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

          {/* SEKCJA: TWOJE KARNETY */}
          {appRole === 'klubowicz' && (
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
                    {currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza.length > 0 && isQuantityPass(currentUser.karnetyKlubowicza[0]) && currentUser.karnetyKlubowicza[0].pozostaloWejsc !== null && currentUser.karnetyKlubowicza[0].pozostaloWejsc !== undefined && (
                      <span className="bg-sky-100 text-sky-900 px-4 py-1.5 rounded-full text-xs font-black border border-sky-200 flex items-center gap-1">
                        <span>🎟️ Wejścia:</span> 
                        <span className="text-amber-700">{currentUser.karnetyKlubowicza[0].pozostaloWejsc}</span> / <span>{currentUser.karnetyKlubowicza[0].poczatkoweWejsc || currentUser.karnetyKlubowicza[0].pozostaloWejsc}</span>
                      </span>
                    )}
                    {currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza.length > 0 && (
                      <span className="bg-slate-100 text-slate-700 px-4 py-1.5 rounded-full text-xs font-bold border border-slate-200">
                        Ważny do: {currentUser.karnetyKlubowicza[0].waznyDo}
                      </span>
                    )}
                    {currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza.length > 0 && currentUser.karnetyKlubowicza[0].zawieszonyOd && (
                      <span className="bg-amber-100 text-amber-900 px-4 py-1.5 rounded-full text-xs font-black border border-amber-200 flex items-center gap-1">
                        ⏸️ ZAWIESZONE: OD {currentUser.karnetyKlubowicza[0].zawieszonyOd} {currentUser.karnetyKlubowicza[0].zawieszonyDo ? `DO ${currentUser.karnetyKlubowicza[0].zawieszonyDo}` : ''}
                      </span>
                    )}
                    {currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza.length > 0 && currentUser.karnetyKlubowicza[0].blokadaDo && currentUser.karnetyKlubowicza[0].blokadaDo >= todayStr && (
                      <span className="bg-rose-100 text-rose-800 px-4 py-1.5 rounded-full text-xs font-black border border-rose-200 flex items-center gap-1">
                        ⚠️ ZABLOKOWANE: {currentUser.karnetyKlubowicza[0].blokadaOd ? `OD ${currentUser.karnetyKlubowicza[0].blokadaOd} ` : ''}DO {currentUser.karnetyKlubowicza[0].blokadaDo}
                      </span>
                    )}
                    {currentUser.blokadaDo && currentUser.blokadaDo >= todayStr && !(currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza[0]?.blokadaDo) && (
                      <span className="bg-rose-100 text-rose-800 px-4 py-1.5 rounded-full text-xs font-black border border-rose-200 flex items-center gap-1">
                        ⚠️ BLOKADA KONTA DO {currentUser.blokadaDo} {currentUser.powodBlokady ? `(${currentUser.powodBlokady})` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end">
                  <Link 
                    href="/karnet"
                    className="bg-white border border-slate-300 text-slate-800 font-bold px-6 py-2.5 rounded-full shadow-sm text-xs hover:bg-slate-100 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span className="text-slate-500 font-serif">$</span> KUP KARNET
                  </Link>
                </div>
              </div>
            </section>
          )}

        </div>
      )}

      {/* PANEL GŁÓWNY: PRZEŁĄCZNIK WIDOKÓW DLA OBSŁUGI KLUBU (GRAFIK vs TABELA OPERACJI) */}
      {(appRole === 'admin' || appRole === 'trener') && (
        <div className="flex items-center justify-between bg-white border border-sky-200 p-3 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdminViewTab('grafik')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                adminViewTab === 'grafik'
                  ? 'bg-sky-950 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              📅 Grafik Zajęć
            </button>
            <button
              onClick={() => setAdminViewTab('operacje')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                adminViewTab === 'operacje'
                  ? 'bg-sky-950 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              📋 Tabela Operacji ({wszystkieTransakcje.length})
            </button>
          </div>
          <div className="flex items-center gap-2">
            {adminViewTab === 'grafik' && appRole === 'admin' && (
              <button 
                onClick={() => {
                  setEventModeType('kilkudniowe');
                  setIsMultiDayModalOpen(true);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <span>⛺</span> + WYDARZENIE KLUBU
              </button>
            )}
          </div>
        </div>
      )}

      {/* ZAKŁADKA 1: TABELA OPERACJI I ZAPISÓW (PEŁNE PRECYZYJNE DANE Z GRAFIKU) */}
      {(appRole === 'admin' || appRole === 'trener') && adminViewTab === 'operacje' && (
        <section className="space-y-4 animate-in fade-in">
          {/* Pasek wyszukiwania i filtrów */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-sky-200 p-4 rounded-2xl shadow-sm">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Szukaj po nazwisku, zajęciach, dacie lub godzinie..."
                value={operationsSearchQuery}
                onChange={(e) => setOperationsSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 hidden sm:inline">📅 Zakres dat:</span>
              <input
                type="date"
                value={operationsDateRange.from}
                onChange={(e) => setOperationsDateRange({ ...operationsDateRange, from: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
              />
              <span className="text-slate-400 font-bold">-</span>
              <input
                type="date"
                value={operationsDateRange.to}
                onChange={(e) => setOperationsDateRange({ ...operationsDateRange, to: e.target.value })}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
              />
            </div>
          </div>

          {/* Tabela operacji */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-5 whitespace-nowrap">DATA OPERACJI</th>
                    <th className="py-3.5 px-5 whitespace-nowrap">KLUBOWICZ</th>
                    <th className="py-3.5 px-5 whitespace-nowrap">AKCJA</th>
                    <th className="py-3.5 px-5">ZAJĘCIA I SZCZEGÓŁY</th>
                    <th className="py-3.5 px-5 text-right whitespace-nowrap">ŹRÓDŁO OPERACJI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredOperationsList.map((op) => {
                    const client = klienciList.find(c => c.id === op.klient_id);
                    const clientName = client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() : `Klubowicz #${op.klient_id}`;
                    const clientEmail = client?.email || '';
                    
                    const opDate = op.created_at ? new Date(op.created_at) : new Date();
                    const opDateFormatted = `${opDate.getFullYear()}-${String(opDate.getMonth() + 1).padStart(2, '0')}-${String(opDate.getDate()).padStart(2, '0')}`;
                    const opTimeFormatted = `${String(opDate.getHours()).padStart(2, '0')}:${String(opDate.getMinutes()).padStart(2, '0')}`;

                    let classDetailsResolved: any = null;
                    if (op.class_key && op.class_key.includes('_')) {
                      const [cId, dPart] = op.class_key.split('_');
                      classDetailsResolved = findClassDetails(cId, dPart);
                    }

                    const isSignup = op.typ_operacji === 'zajecia_zapis';
                    const isAwans = op.typ_operacji === 'awans_z_krzesełka';
                    const isWypis = op.typ_operacji === 'zajecia_wypis';

                    return (
                      <tr key={op.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-5 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{opDateFormatted}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{opTimeFormatted}</div>
                        </td>

                        <td className="py-4 px-5 whitespace-nowrap">
                          <div className="font-black text-slate-900">{clientName}</div>
                          {clientEmail && <div className="text-[11px] text-slate-400">{clientEmail}</div>}
                        </td>

                        <td className="py-4 px-5 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            isSignup
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : isAwans
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : isWypis
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-slate-100 text-slate-800 border border-slate-200'
                          }`}>
                            {isSignup ? 'ZAPIS' : isAwans ? 'AWANS' : isWypis ? 'WYPIS' : op.typ_operacji}
                          </span>
                        </td>

                        <td className="py-4 px-5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <span>📌</span>
                              <span>
                                {classDetailsResolved
                                  ? `${classDetailsResolved.title} (${classDetailsResolved.displayDateStr} ${classDetailsResolved.start}-${classDetailsResolved.end})`
                                  : (op.opis?.split(' - ')[1] || op.opis || 'Trening grupowy')}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 pl-5 leading-tight">
                              {op.opis}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200">
                            <span>📱</span> Klubowicz (Aplikacja)
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredOperationsList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                        Brak zarejestrowanych operacji w wybranym filtrze.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ZAKŁADKA 2: GRAFIK ZAJĘĆ */}
      {(!((appRole === 'admin' || appRole === 'trener') && adminViewTab === 'operacje')) && (
        <section className="space-y-4">
          <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 ${(appRole === 'admin' || appRole === 'trener') ? 'bg-white border border-sky-200 p-4 rounded-2xl shadow-sm' : 'mt-8'}`}>
            <div className="flex items-center gap-3">
              <h2 className={`font-medium uppercase tracking-wider ${['klubowicz', 'trener'].includes(appRole) ? 'text-[13px] text-slate-500 pl-1' : 'text-base sm:text-lg font-black text-sky-950'}`}>
                {['klubowicz', 'trener'].includes(appRole) ? 'Grafik' : 'GRAFIK ZAJĘĆ'}
              </h2>
            </div>
            
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
                })
                .filter((item: any) => {
                  if (appRole === 'klubowicz' && item.isUsunięte) return false;
                  return true;
                });

              const jednorazoweDnia = czyObózAktywny ? [] : jednorazoweZajecia
                .filter((item: any) => item.displayDate === col.date)
                .map((item: any) => {
                  const classKey = `${item.id}_${col.date}`;
                  const override = nadpisaneZajeciaDni[classKey];
                  return override ? { ...item, ...override } : item;
                })
                .filter((item: any) => {
                  if (appRole === 'klubowicz' && item.isUsunięte) return false;
                  return true;
                });

              const zajeciaDnia = [...standardoweDnia, ...jednorazoweDnia].sort((a: any, b: any) => (a.start || "").localeCompare(b.start || ""));
              const isPastDay = col.isoDate < todayStr;
              const isOtherDay = !isToday;
              const hasAnyItems = zajeciaDnia.length > 0 || aktywneWydarzeniaDnia.length > 0;
              const isExpanded = expandedDays[col.isoDate] || false;

              const renderEventsAndClasses = () => (
                <>
                  {aktywneWydarzeniaDnia.map((wydarzenie: any) => (
                    <div key={wydarzenie.id} className="bg-rose-100 border border-rose-300 rounded-xl p-3 text-center space-y-1.5 shadow-sm relative group">
                      <div className="py-1 px-2 bg-rose-200 text-rose-950 font-black rounded-lg text-[11px] uppercase tracking-wider border border-rose-300">
                        {wydarzenie.title}
                      </div>
                      <div className="text-[10px] text-rose-900 font-bold">
                        Odwołano zajęcia z powodu wydarzenia
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-rose-800 font-bold px-1 pt-1 border-t border-rose-200">
                        <span>{wydarzenie.dateFrom} - {wydarzenie.dateTo}</span>
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
                  <div className="space-y-2">
                    {zajeciaDnia.length === 0 && aktywneWydarzeniaDnia.length === 0 ? (
                      <div className="py-6 text-center text-[11px] text-slate-400 font-medium">
                        Brak zajęć w tym dniu.
                      </div>
                    ) : (
                      zajeciaDnia.map((item: any, classIdx: number) => {
                        const durationText = calculateDuration(item.start, item.end);
                        const classKey = `${item.id}_${col.date}`;
                        const classKeyUnique = `${item.id}_${col.date}_${classIdx}`;
                        const zapisani = zapisyNaZajecia[classKey] || [];
                        const limitZajec = item.limit || 12;
                        const zapisaniGlowna = zapisani.filter((s: any) => s.status === 'zapisany');
                        const zapisaniKrzeselko = zapisani.filter((s: any) => s.status === 'krzesełko');
                        const liczbaGlowna = zapisaniGlowna.length;
                        const liczbaKrzesełko = zapisaniKrzeselko.length;
                        const isFull = liczbaGlowna >= limitZajec;
                        const isPastTime = col.isoDate === todayStr && (item.start < currentTimeStr);
                        const isPastEvent = isPastDay || isPastTime;
                        const isLockedForClient = ['klubowicz', 'trener'].includes(appRole) && isPastEvent;

                        const autoCancelStatus = checkClassAutoCancellation(item, col.date, zapisani);
                        const isClassCancelled = item.isOdwołane || autoCancelStatus.isAutoCancelled;
                        const topColor = getTopBorderColor(item.title, isClassCancelled, item.isUsunięte);
                        
                        const progInfo = getProgrammedWorkout(item, col.isoDate, col.date);

                        const mySignupEntry = currentUser ? zapisani.find((s: any) => String(s.id) === String(currentUser.id)) : null;
                        const isUserInMainGroup = mySignupEntry && mySignupEntry.status === 'zapisany';
                        const isUserInWaitlist = mySignupEntry && mySignupEntry.status === 'krzesełko';

                        const isPassRestrictedForClass = appRole === 'klubowicz' && currentUser?.karnetyKlubowicza?.length > 0 && !currentUser.karnetyKlubowicza.some((k: any) => checkPassAllowsClass(k, item.title, dostepneKarnety));

                        const cancelDeadlineInfo = getCancelDeadlineInfo(item, col.date);
                        const isMenuOpen = activeMenuClassId === classKeyUnique;

                        return (
                          <div
                            key={classIdx}
                            onClick={() => {
                              if (isClassCancelled || item.isUsunięte) return;
                              if (isLockedForClient) {
                                showToast("Te zajęcia już się odbyły. Zapisy oraz wypisy nie są już możliwe.", 'info');
                                return;
                              }
                              if (isPassRestrictedForClass && !isUserInMainGroup && !isUserInWaitlist) {
                                showToast(`Twój karnet nie upoważnia do zapisu na zajęcia "${item.title}".`, 'warning');
                              }
                              setSelectedClass({
                                ...item,
                                displayDate: col.date,
                                isoDate: col.isoDate, 
                                durationText,
                                programmedWorkout: progInfo
                              });
                              setIsSearchingClient(false);
                              setSearchClientQuery('');
                            }}
                            style={{ borderTopWidth: '3.5px', borderTopStyle: 'solid', borderTopColor: topColor }}
                            className={`bg-white border rounded-xl p-2.5 space-y-1.5 shadow-sm transition-all relative ${
                              isMenuOpen ? 'z-[60]' : 'z-10'
                            } ${
                              isClassCancelled || item.isUsunięte
                                ? 'border-rose-200 opacity-80 cursor-default bg-rose-50/20'
                                : isLockedForClient
                                ? 'border-slate-200 opacity-60 cursor-not-allowed grayscale-[30%]'
                                : isUserInMainGroup
                                ? 'border-emerald-300 ring-2 ring-emerald-400/40 bg-emerald-50/20 hover:shadow-md cursor-pointer'
                                : isUserInWaitlist
                                ? 'border-blue-300 ring-2 ring-blue-400/40 bg-blue-50/20 hover:shadow-md cursor-pointer'
                                : isPassRestrictedForClass
                                ? 'border-amber-200/80 bg-amber-50/15 hover:shadow-md cursor-pointer'
                                : 'border-sky-100 cursor-pointer hover:border-sky-300 hover:shadow-md'
                            }`}
                          >
                            <div className="flex justify-between items-center gap-1.5">
                              <div className="flex items-baseline gap-1.5 truncate">
                                <span className="text-xs sm:text-sm font-black text-slate-900 shrink-0">{item.start}</span>
                                <h3 className="text-[11px] sm:text-xs font-bold text-slate-800 truncate" title={item.title}>{item.title}</h3>
                              </div>
                              
                              <div className="flex items-center gap-1 shrink-0">
                                {isUserInMainGroup && !isClassCancelled && !item.isUsunięte && (
                                  <span className="bg-emerald-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs animate-in fade-in zoom-in-95">
                                    ✅ ZAPISANY
                                  </span>
                                )}
                                {isUserInWaitlist && !isClassCancelled && !item.isUsunięte && (
                                  <span className="bg-blue-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs animate-in fade-in zoom-in-95">
                                    🪑 REZERWA
                                  </span>
                                )}
                                {isPassRestrictedForClass && !isUserInMainGroup && !isUserInWaitlist && !isClassCancelled && !item.isUsunięte && (
                                  <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[9px] sm:text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider inline-flex items-center gap-1 shadow-xs">
                                    <span>⚠️</span> Inny karnet
                                  </span>
                                )}

                                {isLockedForClient && !isClassCancelled && !item.isUsunięte && (
                                  <span className="text-slate-400 text-xs shrink-0" title="Zajęcia zablokowane (minęły)">
                                    🔒
                                  </span>
                                )}

                                {/* MENU ADMINISTRACYJNE ⚙️ */}
                                {appRole === 'admin' && (
                                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                                    <button 
                                      onClick={() => setActiveMenuClassId(isMenuOpen ? null : classKeyUnique)}
                                      className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                                      title="Ustawienia zajęć"
                                    >
                                      ⚙️
                                    </button>

                                    {isMenuOpen && (
                                      <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-[100] text-xs">
                                        <button onClick={() => { openHistoryModal(item, col.date); setActiveMenuClassId(null); }} className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2 cursor-pointer">
                                          🕒 Historia zajęć
                                        </button>
                                        <button onClick={() => { showToast("Wiadomości wysyłane są bezpośrednio z poziomu aplikacji.", 'info'); setActiveMenuClassId(null); }} className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2 cursor-pointer">
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
                                          setEditTrainer(item.trainer || (zespolTrenerzy.length > 0 ? (zespolTrenerzy[0].imie_nazwisko || zespolTrenerzy[0].nazwa) : ''));
                                          setEditLimit(String(item.limit || 12));
                                          setActiveMenuClassId(null); 
                                        }} className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2 cursor-pointer">
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
                                              setDupTrainer(item.trainer || (zespolTrenerzy.length > 0 ? (zespolTrenerzy[0].imie_nazwisko || zespolTrenerzy[0].nazwa) : ''));
                                              setDupLimit(String(item.limit || 12));
                                              setDuplicateModalData(true);
                                              setActiveMenuClassId(null); 
                                            }} className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2 cursor-pointer">
                                              📋 Duplikuj
                                            </button>
                                            <button onClick={() => handleToggleOdwolajZajecia(item, col.date)} className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2 cursor-pointer">
                                              ❌ Odwołaj zajęcia
                                            </button>
                                            <button onClick={() => handleToggleUsunZajecia(item, col.date)} className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2 cursor-pointer">
                                              🗑️ Usuń zajęcia
                                            </button>
                                          </>
                                        ) : (
                                          <button onClick={() => {
                                            if (item.isOdwołane) handleToggleOdwolajZajecia(item, col.date);
                                            if (item.isUsunięte) handleToggleUsunZajecia(item, col.date);
                                          }} className="w-full text-left px-4 py-2 text-emerald-700 hover:bg-emerald-50 font-bold flex items-center gap-2 cursor-pointer">
                                            🔄 Przywróć zajęcia
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {(isUserInMainGroup || isUserInWaitlist) && !isClassCancelled && !item.isUsunięte && cancelDeadlineInfo && (
                              <div className="pt-0.5">
                                {cancelDeadlineInfo.status === 'countdown' ? (
                                  <div className="bg-amber-100/90 border border-amber-300 text-amber-950 font-bold text-[9px] px-2 py-0.5 rounded-md inline-flex items-center gap-1 animate-pulse">
                                    {cancelDeadlineInfo.label}
                                  </div>
                                ) : cancelDeadlineInfo.status === 'locked' ? (
                                  <div className="bg-rose-100 text-rose-800 font-bold text-[9px] px-2 py-0.5 rounded-md inline-flex items-center gap-1 border border-rose-200">
                                    🔒 Brak możliwości wypisu
                                  </div>
                                ) : null}
                              </div>
                            )}

                            {progInfo && !isClassCancelled && !item.isUsunięte && (
                              <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-1.5 text-[10px] space-y-0.5 shadow-2xs">
                                <div className="flex items-center justify-between text-amber-950 font-black">
                                  <span className="truncate">🏋️ {progInfo.workout.tytul}</span>
                                  <span className="bg-amber-200 text-amber-900 px-1 py-0.2 rounded text-[9px] font-mono shrink-0 ml-1">#{progInfo.index}/{progInfo.total}</span>
                                </div>
                                {progInfo.workout.opis && (
                                  <div className="text-slate-600 text-[9px] line-clamp-2 leading-tight">
                                    {progInfo.workout.opis}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {item.isUsunięte ? (
                              <div className="py-0.5 px-2 bg-rose-100 text-rose-800 font-black text-center rounded text-[10px] uppercase tracking-wider border border-rose-200">
                                USUNIĘTE
                              </div>
                            ) : isClassCancelled ? (
                              <div className="py-0.5 px-2 bg-rose-100 text-rose-800 font-black text-center rounded text-[10px] uppercase tracking-wider border border-rose-200 leading-tight">
                                {autoCancelStatus.reason || 'ODWOŁANE PRZEZ KLUB'}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-1 text-[10px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`font-bold px-1.5 py-0.5 rounded border leading-none ${
                                    isFull ? 'bg-rose-100 text-rose-900 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  }`}>
                                    👥 {liczbaGlowna}/{limitZajec}
                                  </span>
                                  {liczbaKrzesełko > 0 && (
                                    <span className="bg-blue-100 text-blue-900 font-bold px-1.5 py-0.5 rounded border border-blue-200 leading-none">
                                      🪑 {liczbaKrzesełko}
                                    </span>
                                  )}
                                </div>
                                <span className="text-slate-400 font-medium whitespace-nowrap text-[9px] sm:text-[10px]">
                                  ⏱ {durationText}
                                </span>
                              </div>
                            )}

                            <div className="text-[10px] text-slate-600 font-medium border-t border-slate-100 pt-1 flex items-center gap-1 truncate">
                              <span className="text-[9px]">👤</span>
                              <span className="truncate">{item.trainer || 'Brak trenera'}</span>
                            </div>
                          </div>
                        );
                      }))}
                  </div>
                </>
              );

              return (
                <div
                  key={idx}
                  className={`space-y-2.5 p-3 rounded-2xl border-2 transition-all ${
                    isToday
                      ? 'bg-white border-rose-500 shadow-lg ring-2 ring-rose-300/60'
                      : 'bg-sky-50/50 border-sky-200/80 shadow-sm'
                  }`}
                >
                  <div className={`p-3 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 shadow-sm transition-all ${
                    isToday 
                      ? 'bg-gradient-to-br from-rose-600 to-rose-700 text-white shadow-rose-200' 
                      : 'bg-gradient-to-br from-sky-900 to-slate-900 text-white'
                  }`}>
                    <div className="text-sm sm:text-base font-black uppercase tracking-wider drop-shadow-xs">
                      {col.day}
                    </div>
                    <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-black font-mono tracking-wide shadow-xs ${
                      isToday ? 'bg-white text-rose-800' : 'bg-white/15 text-sky-100 border border-white/20'
                    }`}>
                      <span>📅</span>
                      <span>{col.date}</span>
                    </div>
                  </div>
                  
                  {isOtherDay && hasAnyItems ? (
                    <div className="space-y-2">
                      <button
                        onClick={() => toggleDay(col.isoDate)}
                        className="w-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-black text-[11px] uppercase tracking-wider py-2 px-3 rounded-xl flex items-center justify-center transition-colors cursor-pointer border border-slate-300 shadow-xs"
                      >
                        {isPastDay
                          ? (isExpanded ? 'Zwiń minione zajęcia ⌃' : `Pokaż minione zajęcia (${zajeciaDnia.length + aktywneWydarzeniaDnia.length}) ⌄`)
                          : (isExpanded ? 'Zwiń zajęcia ⌃' : `Pokaż zajęcia (${zajeciaDnia.length + aktywneWydarzeniaDnia.length}) ⌄`)}
                      </button>
                      {isExpanded && (
                        <div className="space-y-2 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
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
      )}

      {/* SEKCJE DLA ADMINA: SPRZEDAŻ I KLIENCI */}
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
                    const aktywnaBlokada = (client.karnetyKlubowicza || []).find((k: any) => k.blokadaDo && k.blokadaDo >= todayStr) || (client.blokadaDo && client.blokadaDo >= todayStr);
                    let ostatecznaData = 'Brak';
                    let badgeColorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                    let firstPass = null;

                    if (maKarnet) {
                      firstPass = client.karnetyKlubowicza[0];
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
                          if (isQuantityPass(earliestPass) && earliestPass.pozostaloWejsc !== null && earliestPass.pozostaloWejsc !== undefined) {
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
                            {maKarnet && firstPass && isContractPass(firstPass) && (
                              <>
                                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                                  <span>💳 Rata:</span>
                                  <span className="text-amber-950 font-bold">{firstPass.rata || '1 / 12'}</span>
                                </span>
                                <span className="bg-sky-100 text-sky-900 text-[10px] font-black px-2 py-0.5 rounded-md border border-sky-200 flex items-center gap-1">
                                  <span>❄️ Zawieszenie:</span>
                                  <span className="text-sky-950 font-bold">{firstPass.contractSuspensionDaysLeft !== undefined ? firstPass.contractSuspensionDaysLeft : 30} / 30 dni</span>
                                </span>
                              </>
                            )}
                            {maKarnet && firstPass && isQuantityPass(firstPass) && firstPass.pozostaloWejsc !== null && firstPass.pozostaloWejsc !== undefined && (
                              <span className="bg-sky-100 text-sky-900 text-[10px] font-black px-2 py-0.5 rounded-md border border-sky-200 flex items-center gap-1">
                                <span>🎟️ Wejścia:</span> 
                                <span className="text-amber-700">{firstPass.pozostaloWejsc}</span> / <span>{firstPass.poczatkoweWejsc || firstPass.pozostaloWejsc}</span>
                              </span>
                            )}
                          </div>
                          {aktywnyKarnetZawieszony && (
                            <span className="bg-amber-100 text-amber-900 text-[9px] uppercase tracking-wider font-black px-2 py-1 rounded border border-amber-200 block">
                              ⏸️ ZAWIESZONE: OD {aktywnyKarnetZawieszony.zawieszonyOd} {aktywnyKarnetZawieszony.zawieszonyDo ? `DO ${aktywnyKarnetZawieszony.zawieszonyDo}` : ''}
                            </span>
                          )}
                          {aktywnaBlokada && (
                            <span className="bg-rose-100 text-rose-800 text-[9px] uppercase tracking-wider font-black px-2 py-1 rounded border border-rose-200 block">
                              ⚠️ ZABLOKOWANE: DO {client.blokadaDo || (client.karnetyKlubowicza && client.karnetyKlubowicza[0]?.blokadaDo)}
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

      {/* MODAL: KUP KARNET */}
      {isBuyPassModalOpen && (() => {
        const effectiveDiscount = getEffectiveDiscount(currentUser);
        const selectedPassDef = dostepneKarnety.find(k => k.nazwa === selectedBuyPass);
        const basePrice = selectedPassDef ? parseFloat(selectedPassDef.cena) : 0;
        const discountedPrice = effectiveDiscount.percent > 0 
          ? basePrice * (1 - effectiveDiscount.percent / 100) 
          : basePrice;

        return (
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
                  <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-slate-600">
                      <span>Cena katalogowa:</span>
                      <span className="font-bold">{basePrice.toFixed(2)} PLN</span>
                    </div>
                    {effectiveDiscount.percent > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Naliczony rabat {effectiveDiscount.label}:</span>
                        <span>-{effectiveDiscount.percent}% (-{(basePrice - discountedPrice).toFixed(2)} PLN)</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-900 font-black text-xs pt-1 border-t border-amber-200">
                      <span>Do zapłaty:</span>
                      <span className="text-emerald-700">{discountedPrice.toFixed(2)} PLN</span>
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
        );
      })()}
      {/* MODAL: ZARZĄDZANIE UCZESTNIKAMI ZAJĘĆ */}
      {selectedClass && (() => {
        const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
        const zapisaniWszyscy = zapisyNaZajecia[classKey] || [];
        const limitZajec = selectedClass.limit || 12;
        
        const sortAlfabet = (a: any, b: any) => {
          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
          return nameA.localeCompare(nameB);
        };

        const glownaNieposortowana = zapisaniWszyscy.filter(u => u.status === 'zapisany');
        const listaGlowna = [...glownaNieposortowana].sort(sortAlfabet);
        const listaKrzesełko = zapisaniWszyscy.filter(u => u.status === 'krzesełko');
        
        const isFull = glownaNieposortowana.length >= limitZajec;
        const isUserSignedUp = currentUser && zapisaniWszyscy.some((u: any) => String(u.id) === String(currentUser.id));
        const filteredSuggestions = klienciList
          .filter(c =>
            `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(searchClientQuery.toLowerCase()) ||
            (c.email || '').toLowerCase().includes(searchClientQuery.toLowerCase())
          )
          .sort(sortAlfabet);
        
        const canManageClass = appRole === 'admin' || appRole === 'trener';

        let d = '01', m = '01';
        if (selectedClass.displayDate && selectedClass.displayDate.includes('/')) {
          [d, m] = selectedClass.displayDate.split('/');
        }
        const yr = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
        const cDate = new Date(yr, parseInt(m) - 1, parseInt(d));
        const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
        const dayName = dayNames[cDate.getDay()];
        const fullDateDisplay = `${dayName}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${yr}`;
        const durationDisplay = calculateDuration(selectedClass.start, selectedClass.end);

        return (
          <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <div className="bg-slate-100 border border-sky-200 rounded-3xl max-w-5xl w-full p-6 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto relative">
              
              {/* Nagłówek ze szczegółami zajęć */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-6 py-4 rounded-2xl border border-sky-200 shadow-sm gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-base font-black text-sky-950 uppercase tracking-wide">
                      🏋️ {selectedClass.title}
                    </span>
                    <span className="bg-sky-100 text-sky-900 font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg border border-sky-200">
                      ⏱ {selectedClass.start} - {selectedClass.end} ({durationDisplay})
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
                    <span>📅 {fullDateDisplay}</span>
                    <span>•</span>
                    <span>Prowadzący: <strong>{selectedClass.trainer || 'Brak trenera'}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${
                    isFull ? 'bg-rose-100 text-rose-900 border-rose-200' : 'bg-sky-100 text-sky-900 border-sky-200'
                  }`}>
                    👥 {glownaNieposortowana.length}/{limitZajec}
                  </span>
                  <button
                    onClick={() => setSelectedClass(null)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Opis zaprogramowanej jednostki */}
              {selectedClass.programmedWorkout && (
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-white border-2 border-amber-300 rounded-2xl p-4 shadow-sm space-y-1.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-2">
                      <span className="text-base">🏋️</span>
                      <span>Plan jednostki: {selectedClass.programmedWorkout.workout.tytul}</span>
                    </span>
                    <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-xs">
                      Trening #{selectedClass.programmedWorkout.index} z {selectedClass.programmedWorkout.total}
                    </span>
                  </div>
                  {selectedClass.programmedWorkout.workout.opis ? (
                    <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed pt-1">
                      {selectedClass.programmedWorkout.workout.opis}
                    </p>
                  ) : (
                    <p className="text-[11px] italic text-slate-400">
                      Brak szczegółowego opisu dla tej jednostki treningowej.
                    </p>
                  )}
                </div>
              )}

              {/* Główna lista zapisanych */}
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

                    const isThisUserMe = currentUser && String(osoba.id) === String(currentUser.id);
                    const canSeeThisPersonDetails = canManageClass || isThisUserMe;
                    const displayName = canSeeThisPersonDetails
                      ? `${osoba.firstName} ${osoba.lastName}`
                      : `${osoba.firstName} ${osoba.lastName ? osoba.lastName.charAt(0) + '.' : ''}`;

                    const hasBirthdayToday = isBirthdayOnDate(osoba.birthDate || osoba.Urodziny, selectedClass.displayDate, selectedClass.isoDate);

                    const isMedicover = (osoba.pass || '').toUpperCase().includes('MEDICOVER') ||
                      (osoba.karnetyKlubowicza || []).some((k: any) => (k.nazwa || '').toUpperCase().includes('MEDICOVER'));

                    return (
                      <div 
                        key={osoba.id} 
                        className={`rounded-2xl p-4 shadow-sm relative flex flex-col justify-between space-y-3 transition-all ${
                          canManageClass && isMedicover
                            ? 'bg-gradient-to-br from-emerald-50 via-white to-sky-50 border-2 border-emerald-500 ring-2 ring-emerald-300/60 shadow-md'
                            : 'bg-white border border-sky-200'
                        }`}
                      >
                        {canManageClass && isMedicover && (
                          <div className="bg-emerald-500 text-slate-950 font-black text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider flex items-center justify-between shadow-xs border border-emerald-400">
                            <span className="flex items-center gap-1.5">
                              <span className="animate-bounce">📱</span> SKANUJ KOD QR MEDICOVER
                            </span>
                            <span className="bg-slate-950 text-emerald-300 px-1.5 py-0.2 rounded font-mono text-[9px]">
                              MEDICOVER
                            </span>
                          </div>
                        )}

                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-black text-slate-900 text-sm">{displayName}</h4>
                              {hasBirthdayToday && (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm" title="Dzisiaj ma urodziny!">
                                  🎂 <span>Urodziny!</span>
                                </span>
                              )}
                            </div>
                            {canSeeThisPersonDetails && (
                              <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                                <div>
                                  <span className="font-bold text-slate-700">KARNET:</span>{' '}
                                  <span className={isMedicover ? 'font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded' : ''}>
                                    {osoba.pass || 'OPEN'}
                                  </span>
                                </div>
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
                          <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden flex items-center justify-center font-bold text-5xl shrink-0 shadow-sm ${
                            isMedicover ? 'bg-emerald-100 border-4 border-emerald-500 text-emerald-900' : 'bg-sky-100 border-2 border-amber-500 text-sky-900'
                          }`}>
                            {osoba.avatarUrl ? (
                              <img src={osoba.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              '👤'
                            )}
                          </div>
                        </div>
                        {canManageClass && (
                          <div className="flex items-center justify-end gap-2 border-t border-sky-100 pt-3 text-xs w-full">
                            {(!osobaZapisana.nieobecny) && (
                              <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border font-black uppercase tracking-wider text-[10px] cursor-pointer transition-all shadow-sm ${
                                osobaZapisana.obecny ? 'bg-emerald-100 border-emerald-400 text-emerald-800 ring-2 ring-emerald-200' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white hover:border-emerald-300 hover:text-emerald-600'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={osobaZapisana.obecny ?? false}
                                  onChange={() => toggleObecny(osoba.id)}
                                  className="hidden"
                                />
                                {osobaZapisana.obecny ? '✅ OBECNY' : 'OBECNY'}
                              </label>
                            )}

                            {(!osobaZapisana.obecny) && (
                              <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border font-black uppercase tracking-wider text-[10px] cursor-pointer transition-all shadow-sm ${
                                osobaZapisana.nieobecny ? 'bg-amber-100 border-amber-400 text-amber-800 ring-2 ring-amber-200' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white hover:border-amber-300 hover:text-amber-600'
                              }`}>
                                <input
                                  type="checkbox"
                                  checked={osobaZapisana.nieobecny ?? false}
                                  onChange={() => toggleNieobecnyAction(osobaZapisana, osoba)}
                                  className="hidden"
                                />
                                {osobaZapisana.nieobecny ? '🚫 NIEOBECNY' : 'NIEOBECNY'}
                              </label>
                            )}

                            {(!osobaZapisana.obecny && !osobaZapisana.nieobecny) && (
                              <button
                                onClick={() => { setBlokadaZapisow(false); setClientToUnregister(osoba); }}
                                className="px-3 py-2 text-rose-500 hover:text-rose-700 bg-slate-50 hover:bg-rose-50 font-black uppercase tracking-wider text-[10px] rounded-xl border border-slate-200 hover:border-rose-200 transition-all shadow-sm cursor-pointer"
                              >
                                WYPISZ
                              </button>
                            )}
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

              {/* Lista rezerwowa (Krzesełko) */}
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

                      const isThisUserMe = currentUser && String(osoba.id) === String(currentUser.id);
                      const canSeeThisPersonDetails = canManageClass || isThisUserMe;
                      const displayName = canSeeThisPersonDetails
                        ? `${osoba.firstName} ${osoba.lastName}`
                        : `${osoba.firstName} ${osoba.lastName ? osoba.lastName.charAt(0) + '.' : ''}`;

                      const hasBirthdayToday = isBirthdayOnDate(osoba.birthDate || osoba.Urodziny, selectedClass.displayDate, selectedClass.isoDate);
                      const cutoffMin = osobaZapisana.waitlist_cutoff_minutes || 30;

                      const isMedicover = (osoba.pass || '').toUpperCase().includes('MEDICOVER') ||
                        (osoba.karnetyKlubowicza || []).some((k: any) => (k.nazwa || '').toUpperCase().includes('MEDICOVER'));

                      return (
                        <div 
                          key={osoba.id} 
                          className={`rounded-2xl p-4 shadow-sm relative flex flex-col justify-between space-y-3 transition-all ${
                            canManageClass && isMedicover
                              ? 'bg-gradient-to-br from-emerald-50 via-white to-blue-50 border-2 border-emerald-500 ring-2 ring-emerald-300/60 shadow-md'
                              : 'bg-blue-50/50 border border-blue-200'
                          }`}
                        >
                          {canManageClass && isMedicover && (
                            <div className="bg-emerald-500 text-slate-950 font-black text-[10px] px-3 py-1 rounded-xl uppercase tracking-wider flex items-center justify-between shadow-xs border border-emerald-400">
                              <span className="flex items-center gap-1.5">
                                <span className="animate-bounce">📱</span> SKANUJ KOD QR MEDICOVER
                              </span>
                              <span className="bg-slate-950 text-emerald-300 px-1.5 py-0.2 rounded font-mono text-[9px]">
                                MEDICOVER
                              </span>
                            </div>
                          )}

                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-black text-slate-900 text-sm">{displayName}</h4>
                                <span className="bg-blue-200 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded">
                                  #{idx + 1}
                                </span>
                                {hasBirthdayToday && (
                                  <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm" title="Dzisiaj ma urodziny!">
                                    🎂 <span>Urodziny!</span>
                                  </span>
                                )}
                              </div>
                              {canSeeThisPersonDetails && (
                                <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                                  <div>
                                    <span className="font-bold text-slate-700">KARNET:</span>{' '}
                                    <span className={isMedicover ? 'font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded' : ''}>
                                      {osoba.pass || 'OPEN'}
                                    </span>
                                  </div>
                                  <div><span className="font-bold text-slate-700">WAŻNOŚĆ:</span> {osoba.expiresDate || '2026-09-01'}</div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-700">LIMIT WYPISU:</span> 
                                    <strong className="text-blue-900">{cutoffMin >= 60 ? `${cutoffMin / 60}h` : `${cutoffMin} min`} przed startem</strong>
                                    {isThisUserMe && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditWaitlistTarget(osoba);
                                          setEditWaitlistCutoff(cutoffMin);
                                          setIsEditWaitlistModalOpen(true);
                                        }}
                                        className="text-[10px] bg-blue-200 hover:bg-blue-300 text-blue-950 font-bold px-1.5 py-0.2 rounded cursor-pointer transition-colors"
                                        title="Zmień czas gotowości bez utraty kolejki"
                                      >
                                        Zmień ✏️
                                      </button>
                                    )}
                                  </div>
                                  <div>aktywne zapisy: <strong className="text-sky-900">{prawdziweZapisy}</strong></div>
                                  <div>
                                    <span className="font-bold text-slate-700">PORTFEL:</span>{' '}
                                    <span className={portfelColorClass}>{osoba.wallet || '0.00 PLN'}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden flex items-center justify-center font-bold text-5xl shrink-0 shadow-sm ${
                              isMedicover ? 'bg-emerald-100 border-4 border-emerald-500 text-emerald-900' : 'bg-blue-100 border-2 border-blue-500 text-blue-900'
                            }`}>
                              {osoba.avatarUrl ? (
                                <img src={osoba.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                '🪑'
                              )}
                            </div>
                          </div>
                          {canManageClass && (
                            <div className="flex items-center justify-between border-t border-blue-100 pt-3 text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditWaitlistTarget(osoba);
                                  setEditWaitlistCutoff(cutoffMin);
                                  setIsEditWaitlistModalOpen(true);
                                }}
                                className="font-bold text-blue-800 hover:text-blue-950 text-[11px] underline cursor-pointer"
                              >
                                Wypis: {cutoffMin >= 60 ? `${cutoffMin / 60}h` : `${cutoffMin}m`} przed (Edytuj ✏️)
                              </button>
                              <button
                                onClick={() => setClientToUnregister(osoba)}
                                className="text-rose-600 hover:text-rose-800 font-bold uppercase tracking-wider text-[11px] cursor-pointer"
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

              {/* Dolny pasek zapisu */}
              {['klubowicz', 'trener'].includes(appRole) && !canManageClass ? (
                <div className="pt-2">
                  {!isUserSignedUp ? (
                    (() => {
                      const wVal = parseFloat(String(currentUser?.wallet || currentUser?.Portfel || '0').replace(/[^0-9.-]+/g, "")) || 0;
                      if (wVal < 0) {
                        return (
                          <div className="w-full bg-rose-50 border border-rose-200 text-rose-800 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider text-center shadow-sm">
                            💸 Zablokowane: Ureguluj portfel ({currentUser.wallet || currentUser.Portfel})
                          </div>
                        );
                      }
                      const hasActivePass = currentUser?.karnetyKlubowicza?.length > 0;
                      const allowsThisClass = hasActivePass && currentUser.karnetyKlubowicza.some((k: any) => checkPassAllowsClass(k, selectedClass.title, dostepneKarnety));
                      
                      if (appRole === 'klubowicz' && hasActivePass && !allowsThisClass) {
                        return (
                          <div className="w-full bg-amber-50 border border-amber-300 text-amber-950 font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider text-center shadow-sm space-y-1">
                            <div>⚠️ Twój karnet nie upoważnia do zapisu na te zajęcia</div>
                            <div className="text-[10px] font-medium text-amber-800 lowercase first-letter:uppercase">Wybierz inny karnet obejmujący te zajęcia w zakładce Karnety.</div>
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

      {/* MODAL: WYBÓR CZASU WYPISU Z LISTY REZERWOWEJ */}
      {isWaitlistModalOpen && selectedClass && (
        <div className="fixed inset-0 bg-slate-950/70 z-[70] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🪑</span>
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">Zapis na listę rezerwową</h3>
              </div>
              <button onClick={() => setIsWaitlistModalOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            <div className="space-y-4 text-xs">
              <div className="bg-sky-50 border border-sky-200/80 rounded-2xl p-4 text-slate-700 leading-relaxed">
                <p className="font-bold text-sky-950 mb-1">Na ile przed rozpoczęciem treningu system ma Cię automatycznie wypisać?</p>
                <p className="text-[11px] text-slate-500">
                  Jeśli przed wybranym czasem nie zwolni się miejsce na liście głównej, system automatycznie wypisze Cię z krzesełka i zwróci wejście na karnet.
                </p>
              </div>

              <div className="space-y-2">
                <label className="font-black text-slate-700 uppercase tracking-wider text-[10px] block">Wybierz czas gotowości / dojazdu:</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { minutes: 30, label: '30 minut przed startem', desc: 'Szybki dojazd' },
                    { minutes: 45, label: '45 minut przed startem', desc: 'Standardowy czas' },
                    { minutes: 60, label: '1 godzina (60 min) przed startem', desc: 'Optymalny czas' },
                    { minutes: 90, label: '1,5 godziny (90 min) przed startem', desc: 'Większy zapas' },
                    { minutes: 120, label: '2 godziny (120 min) przed startem', desc: 'Maksymalny zapas' },
                  ].map((option) => (
                    <label
                      key={option.minutes}
                      className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                        selectedWaitlistCutoff === option.minutes
                          ? 'bg-sky-100/70 border-sky-500 ring-2 ring-sky-200'
                          : 'bg-slate-50/50 border-slate-200 hover:bg-sky-50/40 hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="waitlistCutoff"
                          value={option.minutes}
                          checked={selectedWaitlistCutoff === option.minutes}
                          onChange={() => setSelectedWaitlistCutoff(option.minutes)}
                          className="w-4 h-4 accent-sky-600 cursor-pointer"
                        />
                        <span className="font-bold text-slate-800 text-xs">{option.label}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{option.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-sky-100">
                <button
                  type="button"
                  onClick={() => setIsWaitlistModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmWaitlistSignup(selectedWaitlistCutoff)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2.5 rounded-xl uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
                >
                  Potwierdź krzesełko
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDYCJA CZASU WYPISU Z LISTY REZERWOWEJ */}
      {isEditWaitlistModalOpen && editWaitlistTarget && (
        <div className="fixed inset-0 bg-slate-950/70 z-[70] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-blue-200">
            <div className="flex items-center justify-between border-b border-blue-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⏱️</span>
                <h3 className="font-black text-sm text-blue-950 uppercase tracking-wider">Zmień czas gotowości</h3>
              </div>
              <button onClick={() => { setIsEditWaitlistModalOpen(false); setEditWaitlistTarget(null); }} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            <div className="space-y-4 text-xs">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-slate-700 leading-relaxed">
                <p className="font-bold text-blue-950 mb-1">
                  Uczestnik: {editWaitlistTarget.firstName} {editWaitlistTarget.lastName}
                </p>
                <p className="text-[11px] text-slate-500">
                  Zmiana czasu gotowości <strong>nie zmienia</strong> kolejności na liście rezerwowej.
                </p>
              </div>

              <div className="space-y-2">
                <label className="font-black text-slate-700 uppercase tracking-wider text-[10px] block">Nowy czas gotowości / dojazdu:</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { minutes: 30, label: '30 minut przed startem', desc: 'Szybki dojazd' },
                    { minutes: 45, label: '45 minut przed startem', desc: 'Standardowy czas' },
                    { minutes: 60, label: '1 godzina (60 min) przed startem', desc: 'Optymalny czas' },
                    { minutes: 90, label: '1,5 godziny (90 min) przed startem', desc: 'Większy zapas' },
                    { minutes: 120, label: '2 godziny (120 min) przed startem', desc: 'Maksymalny zapas' },
                  ].map((option) => (
                    <label
                      key={option.minutes}
                      className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                        editWaitlistCutoff === option.minutes
                          ? 'bg-blue-100/70 border-blue-500 ring-2 ring-blue-200'
                          : 'bg-slate-50/50 border-slate-200 hover:bg-blue-50/40 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="editWaitlistCutoffRadio"
                          value={option.minutes}
                          checked={editWaitlistCutoff === option.minutes}
                          onChange={() => setEditWaitlistCutoff(option.minutes)}
                          className="w-4 h-4 accent-blue-600 cursor-pointer"
                        />
                        <span className="font-bold text-slate-800 text-xs">{option.label}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{option.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-blue-100">
                <button
                  type="button"
                  onClick={() => { setIsEditWaitlistModalOpen(false); setEditWaitlistTarget(null); }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateWaitlistCutoff(editWaitlistCutoff)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2.5 rounded-xl uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
                >
                  Zapisz zmianę
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AKCJE KLUBOWICZA W TABELI */}
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
              <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700 text-center">
                <button onClick={() => { openProfile(tableActionClient); setTableActionClient(null); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">✏️</span> Edytuj
                </button>
                <button onClick={() => { showToast("Wysłano link do resetu hasła.", 'info'); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">🔑</span> Resetuj hasło
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
              <div className="grid grid-cols-2 gap-2 text-xs font-bold text-rose-800 text-center">
                <button onClick={handleDeactivateClient} className="p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">🔒</span> Dezaktywuj
                </button>
                <button onClick={() => handleDeleteClient(tableActionClient.id)} className="p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl border border-rose-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">🗑️</span> Całkowicie usuń konto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROFIL KLUBOWICZA */}
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

              {/* Karnety klubowicza */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">Karnety klubowicza</h3>
                  <div className="flex items-center gap-2">
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
                              showToast("Brak aktywnego karnetu do przedłużenia.", 'info');
                            }
                            setIsGlobalPassMenuOpen(false);
                          }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer whitespace-nowrap">🕒 Przedłuż karnet</button>
                          <button onClick={() => { showToast("Umowa została oznaczona jako wypowiedziana.", 'info'); setIsGlobalPassMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer whitespace-nowrap">📄 Wypowiedz umowę</button>
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
                          <button onClick={() => { showToast("Wygenerowano link do płatności.", 'info'); setIsGlobalPassMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-slate-50 font-bold flex items-center gap-2.5 cursor-pointer whitespace-nowrap">💳 Wygeneruj link do płatności</button>
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
                          if (isQuantityPass(karnet) && karnet.pozostaloWejsc !== null && karnet.pozostaloWejsc !== undefined) {
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
                                  {czyZawieszony && (
                                    <span className="bg-amber-100 text-amber-900 text-xs font-black px-2.5 py-1 rounded border border-amber-200">
                                      ⏸️ ZAWIESZONE: OD {karnet.zawieszonyOd} {karnet.zawieszonyDo ? `DO ${karnet.zawieszonyDo}` : ''}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`${statusColorClass} text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap`}>
                                    {karnet.statusTekst || `Ważny do: ${karnet.waznyDo}`}
                                  </span>
                                  <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-slate-200">
                                    Cena: {karnet.cena}
                                  </span>
                                  {isQuantityPass(karnet) && karnet.pozostaloWejsc !== null && karnet.pozostaloWejsc !== undefined && (
                                    <span className="bg-sky-100 text-sky-900 text-[11px] font-black px-2 py-0.5 rounded-full border border-sky-200 flex items-center gap-1">
                                      <span>🎟️ Wejścia:</span> 
                                      <span className="text-amber-700">{karnet.pozostaloWejsc}</span> / <span>{karnet.poczatkoweWejsc || karnet.pozostaloWejsc}</span>
                                    </span>
                                  )}
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
              </div>

              {/* Portfel */}
              <div className="space-y-4 border-t border-slate-200 pt-4 mt-4">
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
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDYTUJ KARNET */}
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
                    setEditingPassModal({
                      ...editingPassModal,
                      nazwa: wybranyNazwa,
                      cena: def ? `${def.cena} PLN` : editingPassModal.cena
                    });
                  }}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold cursor-pointer"
                >
                  <option value="">-- Wybierz karnet z bazy --</option>
                  {dostepneKarnety.map(k => (
                    <option key={k.id} value={k.nazwa}>{k.nazwa} ({k.cena} PLN)</option>
                  ))}
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

      {/* MODAL: STATUS KARNETU (ZAWIESZENIE / BLOKADA) */}
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
                    Zatrzymuje bieg karnetu. Liczba dni zawieszenia zostanie wyliczona <strong>dopiero w momencie odwieszenia</strong> i wtedy doliczona do ważności.
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
                    {suspendPassTarget.zawieszonyDo && (
                      <div className="space-y-1">
                        <label className="font-bold text-amber-900">Planowane zakończenie</label>
                        <div className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 font-bold font-mono">{suspendPassTarget.zawieszonyDo}</div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="font-bold text-amber-900">Liczba dni zawieszenia (dotychczas)</label>
                      <div className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 font-bold font-mono">{Math.max(0, Math.floor((new Date(todayStr).getTime() - new Date(suspendPassTarget.zawieszonyOd).getTime()) / (1000 * 60 * 60 * 24)))} dni</div>
                    </div>
                    <button type="button" onClick={() => { handleOdwiesKarnet(suspendPassTarget); setIsSuspendModalOpen(false); }} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer">Odwieś karnet teraz i dolicz dni</button>
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
                    <p className="text-[9px] text-amber-700 leading-tight">Data zakończenia jest orientacyjna — realną liczbę dni system doliczy dopiero przy ręcznym odwieszeniu.</p>
                    <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer">Zatwierdź zawieszenie</button>
                  </form>
                )}
              </div>
              <div className="space-y-4 border border-rose-200 bg-rose-50/50 p-5 rounded-2xl flex flex-col justify-between">
                <div>
                  <h4 className="font-black text-rose-900 text-xs uppercase flex items-center gap-2"><span>🔒</span> Zablokuj karnet</h4>
                  <p className="text-[10px] text-rose-800 leading-tight mt-1">
                    Blokuje wejście do klubu oraz zapisy. Wypisuje z nadchodzących zajęć. <strong>NIE przedłuża</strong> ważności karnetu.
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

      {/* MODAL: HISTORIA ZAWIESZEŃ */}
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

      {/* MODAL: POTWIERDZENIE WYPISANIA (ADMIN I TRENER) */}
      {clientToUnregister && (
        <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">⚠️ Wypisz uczestnika</h3>
              <button onClick={() => setClientToUnregister(null)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <div className="space-y-3 text-xs text-slate-700">
              <p>Czy na pewno chcesz wypisać użytkownika <strong>{clientToUnregister.firstName} {clientToUnregister.lastName}</strong> z zajęć?</p>
              
              {appRole === 'trener' && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 font-medium">
                  ℹ️ Tryb trenera: Wejście z karnetu ilościowego <strong>zostanie odjęte</strong> (brak zwrotu wejścia).
                </div>
              )}

              <div className="bg-sky-50 p-3 rounded-xl border border-sky-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-sky-950">
                  <input
                    type="checkbox"
                    checked={blokadaZapisow}
                    onChange={(e) => setBlokadaZapisow(e.target.checked)}
                    className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                  />
                  <span>Nałóż blokadę zapisów</span>
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

      {/* MODAL: OZNACZ JAKO NIEOBECNEGO (TYLKO ADMINISTRATOR) */}
      {clientToMarkAbsent && (
        <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-amber-200">
            <div className="flex items-center justify-between border-b border-amber-100 pb-3">
              <h3 className="font-black text-sm text-amber-950 uppercase tracking-wider">🚫 Oznacz jako nieobecnego</h3>
              <button onClick={() => setClientToMarkAbsent(null)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <div className="space-y-3 text-xs text-slate-700">
              <p>Użytkownik <strong>{clientToMarkAbsent.firstName} {clientToMarkAbsent.lastName}</strong> zostanie oznaczony jako nieobecny na zajęciach. To wydarzenie zostanie zapisane w logach.</p>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950">
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
                      className="w-20 bg-white border border-amber-300 rounded-lg px-2 py-1 font-bold text-slate-800"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-2 border-t border-amber-100">
              <button onClick={() => setClientToMarkAbsent(null)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
              <button onClick={handlePotwierdzNieobecnosc} className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer">Potwierdź nieobecność</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRZEDŁUŻ KARNET */}
      {isExtendPassModalOpen && profileClient && extendPassTarget && (() => {
        const effectiveDiscount = getEffectiveDiscount(profileClient);
        const defKarnetu = dostepneKarnety.find(k => k.nazwa === (extendSelectedNewPassName || extendPassTarget.nazwa));
        const basePrice = defKarnetu ? parseFloat(defKarnetu.cena) : parseFloat(extendPassTarget.cena.replace(/[^0-9.]/g, '')) || 0;
        const finalPrice = effectiveDiscount.percent > 0 ? basePrice * (1 - effectiveDiscount.percent / 100) : basePrice;

        return (
          <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
              <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🕒 Przedłuż karnet</h3>
                <button onClick={() => setIsExtendPassModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
              </div>
              <form onSubmit={handleConfirmExtendPass} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Karnet</label>
                  <div className="flex gap-2 items-center">
                    {isEditingNewPassType ? (
                      <select
                        value={extendSelectedNewPassName}
                        onChange={(e) => setExtendSelectedNewPassName(e.target.value)}
                        className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 font-bold cursor-pointer"
                      >
                        {dostepneKarnety.map(k => (
                          <option key={k.id} value={k.nazwa}>{k.nazwa} ({k.cena} PLN)</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold">{extendSelectedNewPassName}</div>
                    )}
                    <button type="button" onClick={() => setIsEditingNewPassType(!isEditingNewPassType)} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">✏️</button>
                  </div>
                </div>

                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-600">
                    <span>Cena katalogowa:</span>
                    <span className="font-bold">{basePrice.toFixed(2)} PLN</span>
                  </div>
                  {effectiveDiscount.percent > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Rabat {effectiveDiscount.label}:</span>
                      <span>-{effectiveDiscount.percent}% (-{(basePrice - finalPrice).toFixed(2)} PLN)</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 font-black text-xs pt-1 border-t border-amber-200">
                    <span>Cena po przedłużeniu:</span>
                    <span className="text-emerald-700">{finalPrice.toFixed(2)} PLN</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nowa data wygaśnięcia</label>
                  <div className="flex gap-2 items-center">
                    {isEditingNewDate ? (
                      <input
                        type="date"
                        value={extendNewDate}
                        onChange={(e) => setExtendNewDate(e.target.value)}
                        className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 font-bold cursor-pointer"
                      />
                    ) : (
                      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold font-mono">{extendNewDate}</div>
                    )}
                    <button type="button" onClick={() => setIsEditingNewDate(!isEditingNewDate)} className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer">✏️</button>
                  </div>
                </div>
                <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                  <button type="button" onClick={() => setIsExtendPassModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
                  <button type="submit" className="bg-sky-900 hover:bg-sky-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer">Przedłuż karnet</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: HISTORIA PORTFELA */}
      {isWalletHistoryOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🕒 Logi użytkownika: {profileClient.firstName} {profileClient.lastName}</h3>
              <button onClick={() => setIsWalletHistoryOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <div className="overflow-x-auto text-xs max-h-72 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="py-2.5 px-3 whitespace-nowrap">Data</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Typ operacji</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Kwota</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Opis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {profileClient.transakcje && profileClient.transakcje.map((t: any) => (
                    <tr key={t.id}>
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">{new Date(t.created_at).toLocaleString('pl-PL')}</td>
                      <td className="py-2.5 px-3 font-bold text-sky-900 whitespace-nowrap">{t.typ_operacji}</td>
                      <td className={`py-2.5 px-3 font-black whitespace-nowrap ${t.kwota < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {t.kwota ? `${t.kwota > 0 ? '+' : ''}${t.kwota} PLN` : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-600">{t.opis}</td>
                    </tr>
                  ))}
                  {(!profileClient.transakcje || profileClient.transakcje.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">Brak zarejestrowanych transakcji w bazie.</td>
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

      {/* MODAL: DOŁADUJ PORTFEL */}
      {isTopUpWalletOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">💰 Zmień stan portfela</h3>
              <button onClick={() => setIsTopUpWalletOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleTopUpWalletSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Kwota zmiany (np. 50 lub -30 dla obciążenia) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={walletAmountInput}
                  onChange={(e) => setWalletAmountInput(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tytuł operacji</label>
                <input
                  type="text"
                  placeholder="np. Wpłata gotówkowa w klubie"
                  value={walletReasonInput}
                  onChange={(e) => setWalletReasonInput(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold"
                />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsTopUpWalletOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer">Zatwierdź zmianę</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL Z GRAFIKU: WYDARZENIE JEDNODNIOWE LUB KILKUDNIOWE */}
      {isMultiDayModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">
                ⛺ Dodaj wydarzenie specjalne
              </h3>
              <button onClick={() => setIsMultiDayModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleSaveMultiDayEvent} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Typ wydarzenia:</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEventModeType('jednodniowe')}
                    className={`py-2 text-center rounded-lg font-black uppercase text-[11px] transition-all cursor-pointer ${
                      eventModeType === 'jednodniowe'
                        ? 'bg-white text-sky-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    1 Dzień (Jednodniowe)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventModeType('kilkudniowe')}
                    className={`py-2 text-center rounded-lg font-black uppercase text-[11px] transition-all cursor-pointer ${
                      eventModeType === 'kilkudniowe'
                        ? 'bg-white text-sky-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Kilkudniowe (Obóz)
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Nazwa wydarzenia *</label>
                <input 
                  type="text"
                  required
                  placeholder={eventModeType === 'jednodniowe' ? 'np. DZIEN OTWARTY / SWIETO KLUBU' : 'np. OBÓZ W WAŁCZU'}
                  value={multiDayTitle}
                  onChange={(e) => setMultiDayTitle(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                />
              </div>

              {eventModeType === 'jednodniowe' ? (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Data wydarzenia *</label>
                  <input 
                    type="date"
                    required
                    value={multiDayFrom}
                    onChange={(e) => {
                      setMultiDayFrom(e.target.value);
                      setMultiDayTo(e.target.value);
                    }}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                  />
                </div>
              ) : (
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
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-[11px] leading-relaxed">
                ⚠️ W wybranym terminie wszystkie zajęcia z grafiku zostaną automatycznie oznaczone jako odwołane z powodu tego wydarzenia, a uczestnikom zostaną natychmiast zwrócone wejścia na karnety.
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsMultiDayModalOpen(false)} className="bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer">
                  {eventModeType === 'jednodniowe' ? 'Zapisz wydarzenie 1-dniowe' : 'Zapisz wydarzenie kilkudniowe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL Z GRAFIKU: HISTORIA ZAJĘĆ */}
      {historyModalClass && (
        <div className="fixed inset-0 bg-slate-950/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
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

      {/* MODAL Z GRAFIKU: EDYCJA ZAJĘĆ */}
      {editClassModalData && (
        <div className="fixed inset-0 bg-slate-950/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
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
                  {zespolTrenerzy.map((t: any) => (
                    <option key={t.id} value={t.imie_nazwisko || t.nazwa}>{t.imie_nazwisko || t.nazwa}</option>
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

      {/* MODAL Z GRAFIKU: DUPLIKUJ ZAJĘCIA */}
      {duplicateModalData && (
        <div className="fixed inset-0 bg-slate-950/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
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
                  {zespolTrenerzy.map((t: any) => (
                    <option key={t.id} value={t.imie_nazwisko || t.nazwa}>{t.imie_nazwisko || t.nazwa}</option>
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
