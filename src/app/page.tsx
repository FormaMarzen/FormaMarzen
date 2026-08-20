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

export default function DashboardPage() {
  const nowLocal = new Date();
  const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
  const currentTimeStr = `${String(nowLocal.getHours()).padStart(2, '0')}:${String(nowLocal.getMinutes()).padStart(2, '0')}`;
  
  // NOWOCZESNY SYSTEM POWIADOMIEŃ TOAST Z DOŁU EKRANU
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // UNIWERSALNA FUNKCJA WYSYŁANIA POWIADOMIEŃ PUSH DO KLUBOWICZÓW
  const sendPushNotification = async (clientIds: number | number[], payload: { title: string; body: string; url?: string }) => {
    try {
      const ids = Array.isArray(clientIds) ? clientIds : [clientIds];
      if (ids.length === 0) return;

      const { data: clients } = await supabase
        .from('klienci')
        .select('id, push_subscription')
        .in('id', ids);

      if (!clients || clients.length === 0) return;

      const subscriptions = clients
        .map(c => {
          if (!c.push_subscription) return null;
          try {
            return typeof c.push_subscription === 'string' ? JSON.parse(c.push_subscription) : c.push_subscription;
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);

      if (subscriptions.length === 0) return;

      await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptions,
          payload
        })
      });
    } catch (err) {
      console.error('Błąd podczas wysyłania powiadomienia push:', err);
    }
  };

  // REJESTRACJA I ZAPIS SUBSKRYPCJI PUSH W BAZIE SUPABASE
  const subscribeToPushNotifications = async (klientId: number) => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicVapidKey) return;

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
  const [appRole, setAppRole] = useState<'admin' | 'trener' | 'klubowicz'>('klubowicz');
  const [dostepneKarnety, setDostepneKarnety] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentTrenerProfile, setCurrentTrenerProfile] = useState<any>(null);
  const [ogloszeniaList, setOgloszeniaList] = useState<any[]>([]);
  
  const [tableActionClient, setTableActionClient] = useState<any | null>(null);
  const [profileClient, setProfileClient] = useState<any | null>(null);
  const [profileManualDiscountInput, setProfileManualDiscountInput] = useState<string>('');
  
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
  const [clientToMarkAbsent, setClientToMarkAbsent] = useState<any | null>(null);
  const [blokadaZapisow, setBlokadaZapisow] = useState(false);
  const [dlugoscBlokady, setDlugoscBlokady] = useState('3');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // STAN WYBORU CZASU WYPISU Z KRZESEŁKA
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [selectedWaitlistCutoff, setSelectedWaitlistCutoff] = useState<number>(30);

  const [showAllMyClasses, setShowAllMyClasses] = useState(false);
  const [selectedWeekDate, setSelectedWeekDate] = useState<Date>(new Date());

  // STAN NADRZĘDNYCH ZASAD ZAPISÓW
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

  // SILNIK AUTOMATYCZNEGO WYPISYWANIA Z LISTY REZERWOWEJ PO UPŁYWIE CZASU DOSTĘPNOŚCI KLUBOWICZA
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

          // Jeśli czas do zajęć jest mniejszy lub równy niż zadeklarowany czas gotowości klubowicza
          if (diffMinutes <= cutoffMin && diffMinutes >= 0) {
            hasChanges = true;

            // 1. Usunięcie wpisu z listy rezerwowej w Supabase
            await supabase
              .from('zapisy_zajec')
              .delete()
              .eq('class_key', cls.classKey)
              .eq('klient_id', wMember.id);

            // 2. Zwrot wejścia jeśli to karnet ilościowy
            const { data: clientData } = await supabase.from('klienci').select('*').eq('id', wMember.id).maybeSingle();
            if (clientData) {
              let parsedKarnety = [];
              if (Array.isArray(clientData.karnetyKlubowicza)) parsedKarnety = clientData.karnetyKlubowicza;
              else if (typeof clientData.karnetyKlubowicza === 'string') {
                try { parsedKarnety = JSON.parse(clientData.karnetyKlubowicza); } catch(e) {}
              }

              const passIndex = parsedKarnety.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
              if (passIndex !== -1) {
                const currentRemaining = parseInt(parsedKarnety[passIndex].pozostaloWejsc, 10);
                const poczatkowe = parseInt(parsedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
                parsedKarnety[passIndex] = {
                  ...parsedKarnety[passIndex],
                  pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
                };
                await supabase.from('klienci').update({ karnetyKlubowicza: parsedKarnety }).eq('id', wMember.id);
              }

              await supabase.from('transakcje').insert([{
                klient_id: wMember.id,
                typ_operacji: 'zajecia_wypis',
                class_key: cls.classKey,
                opis: `Automatyczne zwolnienie z krzesełka "${cls.title}" (${col.date} ${cls.start}) - minął Twój wybrany czas gotowości (${cutoffMin} min przed startem). Zwrócono 1 wejście.`
              }]);
            }

            // 3. Wysłanie powiadomienia Push
            await sendPushNotification(wMember.id, {
              title: `Zwolniono miejsce na liście rezerwowej: ${cls.title}`,
              body: `Zostałeś automatycznie wypisany z listy rezerwowej treningu ${cls.title} (${col.date} ${cls.start}), ponieważ do zajęć zostało mniej niż ${cutoffMin} min. Zwrócono wejście.`,
              url: '/'
            });

            // 4. Log do bazy
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

  // SILNIK AUTOMATYCZNEGO ODWOŁYWANIA ZAJĘĆ, WYPISYWANIA OSÓB, ZWROTU WEJŚĆ I POWIADOMIEŃ PUSH
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
              
              // 1. Zapisujemy odwołanie w bazie
              await supabase.from('nadpisania_zajec').upsert({
                class_key: cls.classKey,
                start: cls.start,
                end: cls.end,
                trainer: cls.trainer,
                limit: cls.limit,
                is_odwolane: true,
                is_usuniete: false
              });

              // 2. Wypisujemy wszystkich uczestników i zwracamy im wejścia
              const participantIds: number[] = [];
              for (const participant of classSignups) {
                participantIds.push(participant.id);
                const { data: clientData } = await supabase.from('klienci').select('*').eq('id', participant.id).maybeSingle();
                if (clientData) {
                  let parsedKarnety = [];
                  if (Array.isArray(clientData.karnetyKlubowicza)) parsedKarnety = clientData.karnetyKlubowicza;
                  else if (typeof clientData.karnetyKlubowicza === 'string') {
                    try { parsedKarnety = JSON.parse(clientData.karnetyKlubowicza); } catch(e) {}
                  }

                  const passIndex = parsedKarnety.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
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
                    opis: `Automatyczne odwołanie zajęć "${cls.title}" (${col.date} ${cls.start}) z powodu zbyt małej liczby osób (${activeSignups.length}/${minRequired}). Zwrócono 1 wejście.`
                  }]);
                }
              }

              // WYSYŁAMY POWIADOMIENIE PUSH O ODWOŁANIU TRENINGU
              if (participantIds.length > 0) {
                await sendPushNotification(participantIds, {
                  title: `Odwołano trening: ${cls.title}`,
                  body: `Trening ${cls.title} w dniu ${col.date} o godz. ${cls.start} został odwołany z powodu zbyt małej liczby uczestników. Zwrócono wejście.`,
                  url: '/'
                });
              }

              // 3. Usuwamy wpisy z tabeli zapisy_zajec
              await supabase.from('zapisy_zajec').delete().eq('class_key', cls.classKey);

              // 4. Logujemy zdarzenie
              await supabase.from('booking_logs').insert([{
                action_type: 'CLASS_AUTO_CANCELLED',
                status: 'SUCCESS',
                reason: `Zajęcia ${cls.title} (${cls.classKey}) odwołane automatycznie (${activeSignups.length}/${minRequired} os.). Wypisano ${classSignups.length} osób i zwrócono wejścia.`,
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

  // WERYFIKACJA AUTOMATYCZNEGO ODWOŁANIA ZAJĘĆ W WIDOKU
  const checkClassAutoCancellation = (classItem: any, displayDate: string, signups: any[]) => {
    if (!classItem || classItem.isOdwołane || classItem.isUsunięte) return { isAutoCancelled: false, reason: '' };
    
    const trainingName = classItem.title || '';
    const minRequired = bookingRules.min_participants_per_class?.[trainingName] !== undefined
      ? bookingRules.min_participants_per_class[trainingName]
      : bookingRules.min_participants;
    
    const deadlineMins = bookingRules.auto_cancel_deadline_per_class?.[trainingName] !== undefined
      ? bookingRules.auto_cancel_deadline_per_class[trainingName]
      : bookingRules.auto_cancel_deadline_minutes;

    if (minRequired && minRequired > 0 && deadlineMins !== null && deadlineMins !== undefined && deadlineMins > 0) {
      const [dStr, mStr] = displayDate.split('/');
      const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
      const [sh = '00', sm = '00'] = (classItem.start || '00:00').split(':');
      const classStartDateTime = new Date(classYear, parseInt(mStr) - 1, parseInt(dStr), parseInt(sh), parseInt(sm), 0);
      const now = new Date();
      const diffMinutes = (classStartDateTime.getTime() - now.getTime()) / (1000 * 60);

      if (diffMinutes <= deadlineMins && diffMinutes >= 0) {
        const activeCount = Array.isArray(signups) ? signups.filter(s => s.status === 'zapisany').length : 0;
        if (activeCount < minRequired) {
          return {
            isAutoCancelled: true,
            reason: `ODWOŁANE (Brak min. ${minRequired} os. na ${deadlineMins} min przed)`
          };
        }
      }
    }
    return { isAutoCancelled: false, reason: '' };
  };

  // WERYFIKACJA URODZIN KLUBOWICZA W DNIU TRENINGU
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

  // PRECYZYJNA KALKULACJA RABATU SYSTEMOWEGO (PROGRESJA DO 25% + ZASADA 1 DNIA CIĄGŁOŚCI)
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

  // POMOCNIK DO WYCIĄGANIA EFEKTYWNEGO RABATU KLIENTA (RĘCZNY > SYSTEMOWY)
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
    setProfileManualDiscountInput(client.discount ? String(client.discount).replace(/[^0-9.]/g, '') : '');
  };

  const getMonday = (d: Date) => {
    const dCopy = new Date(d);
    const day = dCopy.getDay();
    if (day === 6) { dCopy.setDate(dCopy.getDate() + 2); } else if (day === 0) { dCopy.setDate(dCopy.getDate() + 1); }
    const currentDayOfWeek = dCopy.getDay();
    const diff = dCopy.getDate() - currentDayOfWeek + (currentDayOfWeek === 0 ? -6 : 1);
    return new Date(dCopy.setDate(diff));
  };

  const loadData = async () => {
    let parsedRules = { ...bookingRules };
    const { data: rulesData } = await supabase
      .from('club_booking_rules')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rulesData) {
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

    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email;
    
    const { data: trenerzyData } = await supabase.from('trenerzy').select('*');
    if (trenerzyData) setZespolTrenerzy(trenerzyData);
    
    if (userEmail === 'maciejklaput@gmail.com') {
      setAppRole('admin');
    } else {
      const trenerObj = trenerzyData?.find((t: any) => t.email === userEmail);
      if (trenerObj) {
        setAppRole('trener');
        setCurrentTrenerProfile(trenerObj);
      } else {
        setAppRole('klubowicz');
      }
    }
    
    const { data: tData } = await supabase.from('transakcje').select('*').order('created_at', { ascending: false });
    if (tData) {
      setWszystkieTransakcje(tData);
    }

    // POBIERANIE OGŁOSZEŃ Z SUPABASE
    const { data: ogloszeniaData } = await supabase
      .from('ogloszenia')
      .select('*')
      .order('id', { ascending: false });

    if (ogloszeniaData) {
      const parsedOgloszenia = ogloszeniaData.map((o: any) => {
        let tArray = ['Wszystkich'];
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
          content: o.content || o.tresc || '',
          isVisible: o.is_visible !== undefined ? o.is_visible : (o.isVisible !== undefined ? o.isVisible : true),
          createdAt: o.created_at || o.createdAt || ''
        };
      });
      setOgloszeniaList(parsedOgloszenia);
    }

    const { data: karnetyDefData } = await supabase.from('karnety').select('*');
    let ustrukturyzowaneKarnetyDef: any[] = [];
    if (karnetyDefData) {
      ustrukturyzowaneKarnetyDef = karnetyDefData.map((k: any) => {
        let meta: Record<string, any> = {};
        try { meta = JSON.parse(k.inne_ustawienia || '{}'); } catch(e) {}
        return {
          ...k,
          ilosc_wejsc: k.ilosc_wejsc || meta.ilosc_wejsc || meta.iloscTreningow || null
        };
      });
      setDostepneKarnety(karnetyDefData.map((k: any) => ({
        ...k,
        cena: k.cena_brutto || k.cena || '0.00'
      })));
    }

    const { data: szablonyData } = await supabase.from('grafik_zajec').select('*');
    let mappedSzablony: any[] = [];
    if (szablonyData) {
      mappedSzablony = szablonyData.map((s: any) => ({
        ...s,
        title: s.title || s.nazwa,
        start: s.start || s.start_time,
        end: s.end || s.end_time,
        limit: s.limit || s.limit_miejsc,
        trainer: s.trainer || s.prowadzacy,
        days: s.days || {}
      }));
      setZapisaneZajecia(mappedSzablony);
    }

    const { data: jednorazoweData } = await supabase.from('zajecia_jednorazowe').select('*');
    let mappedJednorazowe: any[] = [];
    if (jednorazoweData) {
      mappedJednorazowe = jednorazoweData.map((j: any) => ({
        ...j,
        title: j.title || j.nazwa,
        start: j.start_time || j.start,
        end: j.end_time || j.end,
        limit: j.limit_miejsc || j.limit,
        trainer: j.trainer || j.prowadzacy,
        displayDate: j.display_date,
        fullDateStr: j.full_date_str
      }));
      setJednorazoweZajecia(mappedJednorazowe);
    }

    const { data: nadpisaniaData } = await supabase.from('nadpisania_zajec').select('*');
    const nadpisaniaMap: { [key: string]: any } = {};
    if (nadpisaniaData) {
      nadpisaniaData.forEach((n: any) => {
        nadpisaniaMap[n.class_key] = { start: n.start, end: n.end, trainer: n.trainer, limit: n.limit, isOdwołane: n.is_odwolane, isUsunięte: n.is_usuniete };
      });
      setNadpisaneZajeciaDni(nadpisaniaMap);
    }

    // POBIERANIE ZAPISÓW Z CHRONOLOGICZNYM SORTOWANIEM (ZACHOWANIE KOLEJKI KRZESEŁKA I LIMITU MINUT)
    const { data: zapisyData } = await supabase.from('zapisy_zajec').select('*');
    const groupedZapisy: { [key: string]: any[] } = {};
    if (zapisyData) {
      const sortedZapisy = [...zapisyData].sort((a: any, b: any) => {
        if (a.created_at && b.created_at) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (a.id && b.id) return Number(a.id) - Number(b.id);
        return 0;
      });
      sortedZapisy.forEach((z: any) => {
        if (!groupedZapisy[z.class_key]) groupedZapisy[z.class_key] = [];
        groupedZapisy[z.class_key].push({
          ...z,
          id: z.klient_id,
          status: z.status || 'zapisany',
          waitlist_cutoff_minutes: z.waitlist_cutoff_minutes !== undefined && z.waitlist_cutoff_minutes !== null ? Number(z.waitlist_cutoff_minutes) : 30,
          obecny: z.obecny,
          nieobecny: z.nieobecny
        });
      });
      setZapisyNaZajecia(groupedZapisy);
    }

    // OBLICZANIE DNI BIEŻĄCEGO TYGODNIA
    const currentMon = getMonday(selectedWeekDate);
    const activeDashboardDays = Array.from({ length: 5 }).map((_, index) => {
      const dayDate = new Date(currentMon);
      dayDate.setDate(currentMon.getDate() + index);
      const dayNames = ['PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK'];
      const keys = ['pon', 'wt', 'sr', 'czw', 'pt'];
      const dayStr = String(dayDate.getDate()).padStart(2, '0');
      const monthStr = String(dayDate.getMonth() + 1).padStart(2, '0');
      return { day: dayNames[index], key: keys[index], date: `${dayStr}/${monthStr}`, isoDate: `${dayDate.getFullYear()}-${monthStr}-${dayStr}`, fullDate: dayDate };
    });

    // 1. URUCHOMIENIE WERYFIKACJI AUTO-WYPISU Z KRZESEŁKA (JEŚLI MINĄŁ CZAS GOTOWOŚCI)
    const waitlistCutoffChanges = await processWaitlistCutoffs(
      mappedSzablony,
      mappedJednorazowe,
      groupedZapisy,
      nadpisaniaMap,
      activeDashboardDays
    );

    // 2. URUCHOMIENIE WERYFIKACJI AUTOODWOŁYWANIA ZAJĘĆ
    const changesOccurred = await processAutoCancellations(
      mappedSzablony,
      mappedJednorazowe,
      groupedZapisy,
      nadpisaniaMap,
      parsedRules,
      activeDashboardDays
    );

    if (waitlistCutoffChanges || changesOccurred) {
      loadData();
      return;
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

        parsedKarnety = parsedKarnety.map((k: any) => {
          const lowerName = (k.nazwa || '').toLowerCase();
          const isTimePass = lowerName.includes('open') || lowerName.includes('miesiąc') || lowerName.includes('miesiac') || lowerName.includes('rok') || lowerName.includes('czasowy');
          
          if (isTimePass) {
            k.pozostaloWejsc = null;
            k.poczatkoweWejsc = null;
          } else if (k.pozostaloWejsc === undefined || k.pozostaloWejsc === null) {
            const pasujacyDef = ustrukturyzowaneKarnetyDef.find(dk => dk.nazwa === k.nazwa);
            if (pasujacyDef && pasujacyDef.ilosc_wejsc !== null) {
              const valWejsc = parseInt(pasujacyDef.ilosc_wejsc, 10);
              k.pozostaloWejsc = valWejsc;
              k.poczatkoweWejsc = valWejsc;
            }
          }
          return k;
        });

        const powiazanyTrener = trenerzyData?.find((t: any) => t.email && t.email === c['E-mail']);
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
        if (myUser) {
          setCurrentUser(myUser);
          subscribeToPushNotifications(myUser.id);
        }
      }
      if (profileClient) {
        const currentActive = enriched.find((c: any) => c.id === profileClient.id);
        if (currentActive) {
          setProfileClient(currentActive);
        }
      }
    }
    const { data: rodzajeData } = await supabase.from('rodzaje_zajec').select('*');
    if (rodzajeData) setRodzajeZajec(rodzajeData);
    
    const { data: wydarzeniaData } = await supabase.from('wydarzenia_kilkudniowe').select('*');
    if (wydarzeniaData) {
      setWydarzeniaKilkudniowe(wydarzeniaData.map((w: any) => ({ id: w.id, title: w.title, dateFrom: w.date_from, dateTo: w.date_to })));
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, [selectedWeekDate]);

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

  const handleSaveManualDiscountSubmit = async () => {
    if (!profileClient) return;
    const discountVal = profileManualDiscountInput.trim() === '' ? '' : `${parseFloat(profileManualDiscountInput) || 0}%`;
    const updatedClient = { ...profileClient, discount: discountVal };
    const dbPayload = { discount: discountVal };
    const success = await updateSupabaseClient(updatedClient, dbPayload);
    if (success) {
      showToast(`Pomyślnie zaktualizowano rabat ręczny na: ${discountVal || 'Brak (0%)'}`);
    }
  };

  // AUTOMATYCZNE WYPISYWANIE PO ZABLOKOWANIU (TYLKO PRZYSZŁE ZAJĘCIA)
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
          const [d, m] = dateStr.split('/').map(Number);
          const stdClass = zapisaneZajecia.find(z => String(z.id) === classId);
          const jednorazClass = jednorazoweZajecia.find(z => String(z.id) === classId);
          const override = nadpisaneZajeciaDni[signup.class_key];
          const classInfo = override ? { ...stdClass, ...jednorazClass, ...override } : (stdClass || jednorazClass);
          
          const [sh = '00', sm = '00'] = (classInfo?.start || '00:00').split(':');
          const classStartDateTime = new Date(now.getFullYear(), m - 1, d, parseInt(sh), parseInt(sm), 0);
          
          if (classStartDateTime > now) {
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

    if (cancelledCount > 0 && targetClientObj) {
      let updatedKarnety = [...(targetClientObj.karnetyKlubowicza || [])];
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

  const handleToggleClientTrainer = async (client: any) => {
    if (!client.isTrainer) {
      const { error } = await supabase.from('trenerzy').insert([{
        imie_nazwisko: `${client.firstName} ${client.lastName}`,
        email: client.email,
        telefon: client.phone
      }]);
      if (error) { showToast("Błąd przypisywania do zespołu: " + error.message, 'error'); return; }
    } else {
      if (client.email) {
        await supabase.from('trenerzy').delete().eq('email', client.email);
      }
    }
    loadData();
  };

  const handleWypiszZajecia = async (zajecieItem: any) => {
    if (!profileClient) return;
    const zwrocicWejscie = confirm("Czy zwrócić klubowiczowi wejście na karnet?");
    const uaktualnioneNadchodzace = (profileClient.zapisyNadchodzace || []).filter((z: any) => z.id !== zajecieItem.id);
    const nowyWypis = { ...zajecieItem, wypisujacy: 'Wypisany przez zarządcę z poziomu profilu' };
    const uaktualnioneWypisy = [nowyWypis, ...(profileClient.zapisyWypisy || [])];

    let karnetyZaktualizowane = [...(profileClient.karnetyKlubowicza || [])];
    if (zwrocicWejscie) {
      const passIndex = karnetyZaktualizowane.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
      if (passIndex !== -1) {
        const currentRemaining = parseInt(karnetyZaktualizowane[passIndex].pozostaloWejsc, 10);
        const poczatkowe = parseInt(karnetyZaktualizowane[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
        if (!isNaN(currentRemaining)) {
          karnetyZaktualizowane[passIndex] = {
            ...karnetyZaktualizowane[passIndex],
            pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
          };
        }
      }
    }

    await supabase.from('klienci').update({ karnetyKlubowicza: karnetyZaktualizowane, zapisyNadchodzace: uaktualnioneNadchodzace, zapisyWypisy: uaktualnioneWypisy }).eq('id', profileClient.id);
    await supabase.from('transakcje').insert([{ klient_id: profileClient.id, typ_operacji: 'zajecia_wypis', kwota: null, opis: `Wypisano z zajęć: ${zajecieItem.zajecia} (${zajecieItem.data})${zwrocicWejscie ? ' - Zwrócono 1 wejście.' : ''}` }]);
    loadData();
    showToast('Wypisano klubowicza z zajęć.');
  };

  const handleConfirmExtendPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileClient || !extendPassTarget) return;
    if (!confirm(`Czy na pewno chcesz przedłużyć ten karnet do dnia ${extendNewDate}?`)) return;
    
    const defKarnetu = dostepneKarnety.find(k => k.nazwa === extendSelectedNewPassName);
    let bazowaCenaNum = defKarnetu ? parseFloat(defKarnetu.cena) : parseFloat(extendPassTarget.cena.replace(/[^0-9.]/g, '')) || 0;
    
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

    let metaBuy: Record<string, any> = {};
    try { metaBuy = JSON.parse(defKarnetu?.inne_ustawienia || '{}'); } catch(e) {}
    
    const lowerBuyName = selectedBuyPass.toLowerCase();
    const isTimePassBuy = lowerBuyName.includes('open') || lowerBuyName.includes('miesiąc') || lowerBuyName.includes('miesiac') || lowerBuyName.includes('rok') || lowerBuyName.includes('czasowy');
    
    const limitWejscBaza = (!isTimePassBuy && defKarnetu) ? (defKarnetu.ilosc_wejsc || metaBuy.ilosc_wejsc || metaBuy.iloscTreningow || null) : null;
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

  const handleDeactivateClientOnDate = () => {
    const dataWyb = prompt("Podaj datę, w której konto ma zostać dezaktywowane (YYYY-MM-DD):", "2026-08-31");
    if (dataWyb) {
      if (confirm(`Czy na pewno chcesz zaplanować dezaktywację konta na dzień ${dataWyb}?`)) {
        showToast(`Zaplanowano dezaktywację konta na dzień ${dataWyb}.`, 'info');
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
        showToast("Zdjęcie profilowe zostało zaktualizowane!");
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
    
    const basePriceNum = defKarnetu ? parseFloat(defKarnetu.cena) : 150.00;
    const effectiveDiscount = getEffectiveDiscount(profileClient);
    const kwotaKarnetu = effectiveDiscount.percent > 0 
      ? basePriceNum * (1 - effectiveDiscount.percent / 100) 
      : basePriceNum;
    const cenaObjKarnetu = `${kwotaKarnetu.toFixed(2)} PLN`;

    let metaSecond: Record<string, any> = {};
    try { metaSecond = JSON.parse(defKarnetu?.inne_ustawienia || '{}'); } catch(e) {}
    
    const lowerSecondName = selectedPassToAdd.toLowerCase();
    const isTimePassSecond = lowerSecondName.includes('open') || lowerSecondName.includes('miesiąc') || lowerSecondName.includes('miesiac') || lowerSecondName.includes('rok') || lowerSecondName.includes('czasowy');
    
    const limitWejscBaza = (!isTimePassSecond && defKarnetu) ? (defKarnetu.ilosc_wejsc || metaSecond.ilosc_wejsc || metaSecond.iloscTreningow || null) : null;
    const parsedLimitWejsc = limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : null;

    let nowyStanStr = profileClient.wallet;
    let logKwota = 0;
    let logOpis = `Dodano karnet: ${selectedPassToAdd}${effectiveDiscount.label ? ` ${effectiveDiscount.label}` : ''} (Zapłacono z góry)`;
    
    if (paymentMethod === 'later') {
      const currentWalletNum = parseFloat(String(profileClient.wallet).replace(/[^0-9.-]+/g, "")) || 0;
      const nowyStanPortfela = currentWalletNum - kwotaKarnetu;
      nowyStanStr = `${nowyStanPortfela.toFixed(2)} PLN`;
      logKwota = -kwotaKarnetu;
      logOpis = `Dodano karnet: ${selectedPassToAdd}${effectiveDiscount.label ? ` ${effectiveDiscount.label}` : ''} (Obciążenie portfela - do zapłaty)`;
    }

    const nowyKarnetObj = {
      id: Date.now(), 
      nazwa: selectedPassToAdd, 
      waznyDo: dataWygasnieciaStr, 
      pozostaloWejsc: isTimePassSecond ? null : parsedLimitWejsc,
      poczatkoweWejsc: isTimePassSecond ? null : parsedLimitWejsc,
      cena: cenaObjKarnetu, 
      znizkaProcentowa: effectiveDiscount.label, 
      rata: '1 / 1', 
      statusTekst: `Ważny do: ${dataWygasnieciaStr}`, 
      blokadaDo: null, 
      powodBlokady: null,
      zawieszonyOd: null, 
      zawieszonyDo: null, 
      historiaZawieszen: []
    };

    let karnetyList = Array.isArray(profileClient.karnetyKlubowicza) ? [...profileClient.karnetyKlubowicza] : [];
    const uaktualnioneKarnety = [...karnetyList, nowyKarnetObj];
    const updatedClient = { 
      ...profileClient, 
      karnetyKlubowicza: uaktualnioneKarnety, 
      pass: uaktualnioneKarnety.map((k: any) => k.nazwa).join(', '), 
      price: nowyKarnetObj.cena, 
      expiresDate: uaktualnioneKarnety[0]?.waznyDo || '', 
      wallet: nowyStanStr 
    };

    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety };
    if (profileClient.Cena !== undefined) dbPayload.Cena = nowyKarnetObj.cena; 
    else if (profileClient.cena !== undefined) dbPayload.cena = nowyKarnetObj.cena;
    if (profileClient.Portfel !== undefined) dbPayload.Portfel = nowyStanStr; 
    else if (profileClient.portfel !== undefined) dbPayload.portfel = nowyStanStr;

    await updateSupabaseClient(updatedClient, dbPayload);
    await supabase.from('transakcje').insert([{ klient_id: profileClient.id, typ_operacji: 'zakup_karnetu', kwota: logKwota, opis: logOpis }]);
    setSelectedPassToAdd('');
    setIsAddSecondPassModalOpen(false);
    showToast(`Pomyślnie przypisano karnet "${selectedPassToAdd}".`);
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
        const lowerName = (editingPassModal.nazwa || '').toLowerCase();
        const isTimePass = lowerName.includes('open') || lowerName.includes('miesiąc') || lowerName.includes('miesiac') || lowerName.includes('rok') || lowerName.includes('czasowy');
        
        return {
          ...k, 
          nazwa: editingPassModal.nazwa, 
          waznyDo: editingPassModal.waznyDo, 
          pozostaloWejsc: isTimePass ? null : editingPassModal.pozostaloWejsc,
          poczatkoweWejsc: isTimePass ? null : (k.poczatkoweWejsc || editingPassModal.pozostaloWejsc),
          cena: editingPassModal.cena.includes('PLN') ? editingPassModal.cena : `${editingPassModal.cena} PLN`,
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

  // CAŁKOWITE USUNIĘCIE KARNETU + AUTOMATYCZNE WYPISANIE Z PRZYSZŁYCH ZAJĘĆ
  const handleConfirmDeletePass = async (passId: number) => {
    if (!profileClient) return;
    if (!confirm("Czy na pewno chcesz usunąć ten karnet? Klient zostanie automatycznie wypisany ze wszystkich przyszłych zajęć.")) return;
    
    const now = new Date();
    let cancelledCount = 0;
    
    // 1. Pobieramy rezerwacje klienta i usuwamy te, które są w przyszłości
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
          const [d, m] = dateStr.split('/').map(Number);
          const stdClass = zapisaneZajecia.find(z => String(z.id) === classId);
          const jednorazClass = jednorazoweZajecia.find(z => String(z.id) === classId);
          const override = nadpisaneZajeciaDni[signup.class_key];
          const classInfo = override ? { ...stdClass, ...jednorazClass, ...override } : (stdClass || jednorazClass);

          const [sh = '00', sm = '00'] = (classInfo?.start || '00:00').split(':');
          const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : now.getFullYear();
          const classStartDateTime = new Date(classYear, m - 1, d, parseInt(sh), parseInt(sm), 0);

          if (classStartDateTime > now) {
            await supabase
              .from('zapisy_zajec')
              .delete()
              .eq('class_key', signup.class_key)
              .eq('klient_id', profileClient.id);
            cancelledCount++;
          }
        }
      }
    }

    // 2. Czyścimy zapisy nadchodzące w obiekcie klienta
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

    // 3. Usuwamy karnet z profilu
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

    // 4. Rejestrujemy transakcje i logi
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
    let diffDays = Math.floor((dzisiaj.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) diffDays = 0;
    if (!confirm(`Karnet był zawieszony od ${karnetTarget.zawieszonyOd} (łącznie ${diffDays} dni). Czy na pewno chcesz go odwiesić i przedłużyć ważność o ${diffDays} dni?`)) return;
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
          const [d, m] = dateStr.split('/').map(Number);
          const stdClass = zapisaneZajecia.find(z => String(z.id) === classId);
          const jednorazClass = jednorazoweZajecia.find(z => String(z.id) === classId);
          const override = nadpisaneZajeciaDni[signup.class_key];
          const classInfo = override ? { ...stdClass, ...jednorazClass, ...override } : (stdClass || jednorazClass);
          
          const [sh = '00', sm = '00'] = (classInfo?.start || '00:00').split(':');
          const classStartDateTime = new Date(now.getFullYear(), m - 1, d, parseInt(sh), parseInt(sm), 0);
          
          if (classStartDateTime > now) {
            await supabase
              .from('zapisy_zajec')
              .delete()
              .eq('class_key', signup.class_key)
              .eq('klient_id', profileClient.id);
            cancelledCount++;
          }
        }
      }
    }

    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === suspendPassTarget.id) {
        let newPozostalo = k.pozostaloWejsc;
        if (newPozostalo !== null && newPozostalo !== undefined && cancelledCount > 0) {
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
    if (!profileClient) return;
    if (!confirm("Czy na pewno chcesz usunąć blokadę tego karnetu?")) return;
    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === karnetTarget.id) { return { ...k, blokadaOd: null, blokadaDo: null, powodBlokady: null }; }
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
    showToast("Dane profilu zostały zaktualizowane.");
  };

  const getPrawdziweAktywneZapisy = (klientId: number) => {
    let count = 0;
    const now = new Date();
    Object.entries(zapisyNaZajecia).forEach(([classKey, uczestnicy]) => {
      const parts = classKey.split('_');
      const classId = parts[0];
      const dateStr = parts[1];
      if (dateStr) {
        const [d, m] = dateStr.split('/').map(Number);
        const stdClass = zapisaneZajecia.find(z => String(z.id) === classId);
        const jednorazClass = jednorazoweZajecia.find(z => String(z.id) === classId);
        const override = nadpisaneZajeciaDni[classKey];
        const classInfo = override ? { ...stdClass, ...jednorazClass, ...override } : (stdClass || jednorazClass);

        const [sh = '00', sm = '00'] = (classInfo?.start || '00:00').split(':');
        const classStartDateTime = new Date(now.getFullYear(), m - 1, d, parseInt(sh), parseInt(sm), 0);

        if (classStartDateTime >= now) {
          if (Array.isArray(uczestnicy) && uczestnicy.some((u: any) => String(u.id) === String(klientId))) count++;
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
    await supabase.from('zapisy_zajec').update({ obecny: nowyStanObecny, nieobecny: false }).eq('class_key', classKey).eq('klient_id', klientId);
    loadData();
  };

  const toggleNieobecnyAction = async (osobaZapisana: any, klient: any) => {
    if (!selectedClass) return;
    if (osobaZapisana.nieobecny) {
      const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
      await supabase.from('zapisy_zajec').update({ nieobecny: false, obecny: false }).eq('class_key', classKey).eq('klient_id', klient.id);
      loadData();
    } else {
      setBlokadaZapisow(true);
      setDlugoscBlokady(String(bookingRules.absence_ban_days || 3));
      setClientToMarkAbsent(klient);
    }
  };

  // =========================================================================
  // GŁÓWNA LOGIKA ZAPISU KLUBOWICZA ZE STRONY GŁÓWNEJ
  // =========================================================================
  const handleKlubowiczZapiszSie = async () => {
    if (!currentUser || !selectedClass) return;
    
    // 0. BLOKADA: WERYFIKACJA POSIADANIA AKTYWNEGO KARNETU
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
      if (k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined) {
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

    // Weryfikacja automatycznego odwołania
    const classKeyCurrent = `${selectedClass.id}_${selectedClass.displayDate}`;
    const zapisaniCurrent = zapisyNaZajecia[classKeyCurrent] || [];
    const autoCancelStatus = checkClassAutoCancellation(selectedClass, selectedClass.displayDate, zapisaniCurrent);
    
    if (selectedClass.isOdwołane || selectedClass.isUsunięte || autoCancelStatus.isAutoCancelled) { 
      showToast(autoCancelStatus.isAutoCancelled ? autoCancelStatus.reason : "Nie można zapisać się na odwołane lub usunięte zajęcia!", 'error'); 
      return; 
    }
    
    // 1. Zadłużenie w portfelu
    const walletVal = parseFloat(String(currentUser.wallet || currentUser.Portfel || '0').replace(/[^0-9.-]+/g, "")) || 0;
    if (walletVal < 0) { 
      showToast("Posiadasz zadłużenie na koncie! Ureguluj portfel, aby móc się zapisywać.", 'error'); 
      return; 
    }
    
    const now = new Date();
    const dzisiajData = todayStr;

    // 2. Blokady konta lub karnetu
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
    const [d, m] = dateStr.split('/').map(Number);
    const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : now.getFullYear();
    const [sh = '00', sm = '00'] = (selectedClass.start || '00:00').split(':');
    const classStartDateTime = new Date(classYear, m - 1, d, parseInt(sh), parseInt(sm), 0);
    const calcClassDateStr = `${classYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    // 3. Zawieszenie karnetu
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
    const aktualni = zapisyNaZajecia[classKey] || [];
    if (aktualni.some(k => String(k.id) === String(currentUser.id))) { 
      showToast("Jesteś już zapisany na te zajęcia!", 'info'); 
      return; 
    }

    // 4. Okno zapisu w przód (per-karnet)
    const passName = (currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza.length > 0)
      ? currentUser.karnetyKlubowicza[0].nazwa
      : (currentUser.pass || 'OPEN');
    const bookingWindowDays = bookingRules.booking_window_per_pass?.[passName] ?? bookingRules.booking_window_days ?? 14;
    const maxBookingDate = new Date();
    maxBookingDate.setDate(maxBookingDate.getDate() + bookingWindowDays);
    maxBookingDate.setHours(23, 59, 59, 999);

    if (classStartDateTime > maxBookingDate) {
      const reason = `Dla karnetu "${passName}" zapisy otwierają się ${bookingWindowDays} dni przed terminem zajęć.`;
      await supabase.from('booking_logs').insert([{
        action_type: 'BOOKING_BLOCKED',
        status: 'BLOCKED',
        reason: `${currentUser.firstName || 'Klubowicz'}: ${reason}`,
        rule_applied: 'booking_window_per_pass',
        payload: { klient_id: currentUser.id, class_key: classKey, pass: passName, window_days: bookingWindowDays }
      }]);
      showToast(`Nie możesz się zapisać! ${reason}`, 'error');
      return;
    }

    // 5. Blokada zapisów przed startem zajęć (per-trening)
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

    // 6. Karencja po wygaśnięciu karnetu (per-karnet)
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

    // 7. Limit zajęć jednego typu dziennie
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

    // 8. Limit wszystkich zajęć dziennie
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
    Object.entries(zapisyNaZajecia).forEach(([cKey, uczestnicy]) => {
      if (cKey.endsWith(`_${selectedClass.displayDate}`)) {
        if (Array.isArray(uczestnicy) && uczestnicy.some((u: any) => String(u.id) === String(currentUser.id))) {
          userSignupsOnThisDate++;
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
    const glownaCount = aktualni.filter((u: any) => u.status === 'zapisany').length;
    const isWaitlistTarget = glownaCount >= limitZajec;

    // JEŚLI BRAKUJE MIEJSC – OTWIERAMY MODAL WYBORU CZASU WYPISU Z KRZESEŁKA
    if (isWaitlistTarget) {
      setSelectedWaitlistCutoff(30);
      setIsWaitlistModalOpen(true);
      return;
    }
    
    if (!confirm("Czy na pewno chcesz zapisać się na te zajęcia?")) return;

    const { error } = await supabase.from('zapisy_zajec').insert([
      { class_key: classKey, klient_id: currentUser.id, status: 'zapisany', waitlist_cutoff_minutes: null, obecny: false }
    ]);
    
    if (error) { 
      showToast(`Nie udało się zapisać na zajęcia: ${error.message}`, 'error'); 
      return; 
    }

    // Zużycie wejścia dla karnetu ilościowego
    let updatedKarnety = [...(currentUser.karnetyKlubowicza || [])];
    const passIndex = updatedKarnety.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
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

    const oblozenieStr = `${glownaCount + 1}/${limitZajec}`;
    
    await supabase.from('transakcje').insert([{ 
      klient_id: currentUser.id, 
      typ_operacji: 'zajecia_zapis', 
      class_key: classKey, 
      opis: `${currentUser.firstName || 'Klubowicz'} - Zapisano na zajęcia. Obłożenie: ${oblozenieStr}` 
    }]);

    await supabase.from('booking_logs').insert([{
      action_type: 'BOOKING_SUCCESS',
      status: 'SUCCESS',
      reason: `${currentUser.firstName || 'Klubowicz'} zapisany do ${classKey} (zapisany)`,
      rule_applied: 'VALIDATION_PASSED',
      payload: { klient_id: currentUser.id, class_key: classKey, status: 'zapisany' }
    }]);

    showToast("Zostałeś pomyślnie zapisany na zajęcia!");
    loadData();
    setSelectedClass(null);
  };

  // POTWIERDZENIE ZAPISU NA KRZESEŁKO Z WYBRANYM LOKALNYM LUB GLOBALNYM CZASEM GOTOWOŚCI
  const handleConfirmWaitlistSignup = async (cutoffMinutes: number) => {
    if (!currentUser || !selectedClass) return;

    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const limitZajec = selectedClass.limit || 12;
    const aktualni = zapisyNaZajecia[classKey] || [];

    const { error } = await supabase.from('zapisy_zajec').insert([
      { class_key: classKey, klient_id: currentUser.id, status: 'krzesełko', waitlist_cutoff_minutes: cutoffMinutes, obecny: false }
    ]);

    if (error) {
      showToast(`Nie udało się zapisać na listę rezerwową: ${error.message}`, 'error');
      return;
    }

    // Zużycie wejścia
    let updatedKarnety = [...(currentUser.karnetyKlubowicza || [])];
    const passIndex = updatedKarnety.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
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

    const rezerwaCount = aktualni.filter((u: any) => u.status === 'krzesełko').length + 1;
    const cutoffLabel = cutoffMinutes >= 60 ? `${cutoffMinutes / 60}h` : `${cutoffMinutes} min`;

    await supabase.from('transakcje').insert([{ 
      klient_id: currentUser.id, 
      typ_operacji: 'zajecia_zapis', 
      class_key: classKey, 
      opis: `${currentUser.firstName || 'Klubowicz'} - Zapisano na listę rezerwową (krzesełko #${rezerwaCount}). Czas gotowości: ${cutoffLabel} przed startem.` 
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
    loadData();
    setSelectedClass(null);
  };

  // =========================================================================
  // GŁÓWNA LOGIKA WYPISANIA KLUBOWICZA ZE SZTYWNĄ BLOKADĄ I INTELIGENTNYM AWANSEM
  // =========================================================================
  const handleKlubowiczWypiszSie = async () => {
    if (!currentUser || !selectedClass) return;
    
    const trainingName = selectedClass.title || '';
    const cancelDeadlineMinutes = bookingRules.cancel_deadline_per_class?.[trainingName] ?? bookingRules.cancel_deadline_minutes ?? 90;
    const [dStr, mStr] = selectedClass.displayDate.split('/');
    const classYear = selectedWeekDate ? selectedWeekDate.getFullYear() : new Date().getFullYear();
    const [sh = '00', sm = '00'] = (selectedClass.start || '00:00').split(':');
    const classStartDateTime = new Date(classYear, parseInt(mStr) - 1, parseInt(dStr), parseInt(sh), parseInt(sm), 0);
    const now = new Date();
    const diffMinutes = (classStartDateTime.getTime() - now.getTime()) / (1000 * 60);

    // SZTYWNA BLOKADA WYPISANIA PO PRZEKROCZENIU MINIMALNEGO CZASU
    if (diffMinutes < cancelDeadlineMinutes && diffMinutes > 0) {
      showToast(`Nie możesz się wypisać! Minimalny czas na bezpłatny wypis z tych zajęć wynosi ${cancelDeadlineMinutes} minut przed startem.`, 'error');
      return;
    }

    if (diffMinutes <= 0) {
      showToast("Zajęcia już się rozpoczęły lub minęły. Wypisanie jest niemożliwe.", 'error');
      return;
    }

    if (!confirm("Czy na pewno chcesz wypisać się z tych zajęć?")) return;

    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const limitZajec = selectedClass.limit || 12;
    const aktualni = zapisyNaZajecia[classKey] || [];

    const { error } = await supabase.from('zapisy_zajec').delete().eq('class_key', classKey).eq('klient_id', currentUser.id);
    if (error) { 
      showToast(`Nie udało się wypisać z zajęć: ${error.message}`, 'error'); 
      return; 
    }

    let updatedKarnety = [...(currentUser.karnetyKlubowicza || [])];
    const passIndex = updatedKarnety.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
    if (passIndex !== -1) {
      const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10);
      const poczatkowe = parseInt(updatedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
      if (!isNaN(currentRemaining)) {
        updatedKarnety[passIndex] = {
          ...updatedKarnety[passIndex],
          pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
        };
        await supabase.from('klienci').update({ karnetyKlubowicza: updatedKarnety }).eq('id', currentUser.id);
      }
    }

    await supabase.from('transakcje').insert([{ 
      klient_id: currentUser.id, 
      typ_operacji: 'zajecia_wypis', 
      class_key: classKey, 
      opis: `${currentUser.firstName || 'Klubowicz'} - Samodzielne wypisanie z zajęć. Zwrócono 1 wejście.` 
    }]);

    await supabase.from('booking_logs').insert([{
      action_type: 'CANCEL_SUCCESS',
      status: 'SUCCESS',
      reason: `${currentUser.firstName || 'Klubowicz'} wypisał się z ${classKey}`,
      rule_applied: 'USER_CANCEL',
      payload: { klient_id: currentUser.id, class_key: classKey }
    }]);

    const pozostaliUczestnicy = aktualni.filter(u => String(u.id) !== String(currentUser.id));
    const listaGlownaPoWypisie = pozostaliUczestnicy.filter(u => u.status === 'zapisany');
    const rezerwaPoWypisie = pozostaliUczestnicy.filter(u => u.status === 'krzesełko');

    // INTELIGENTNY AWANS: WYBIERAMY PIERWSZĄ OSOBĘ Z KRZESEŁKA, KTÓREJ LIMIT GOTOWOŚCI NIE WYGASŁ
    if (listaGlownaPoWypisie.length < limitZajec && rezerwaPoWypisie.length > 0) {
      const kandydatDoAwansu = rezerwaPoWypisie.find((w: any) => {
        const cutoff = w.waitlist_cutoff_minutes !== undefined && w.waitlist_cutoff_minutes !== null ? Number(w.waitlist_cutoff_minutes) : 30;
        return diffMinutes > cutoff;
      }) || rezerwaPoWypisie[0];

      if (kandydatDoAwansu) {
        await supabase
          .from('zapisy_zajec')
          .update({ status: 'zapisany' })
          .eq('class_key', classKey)
          .eq('klient_id', kandydatDoAwansu.id);

        const awansowanyKlient = klienciList.find(c => c.id === kandydatDoAwansu.id);
        const imieNazwisko = awansowanyKlient ? `${awansowanyKlient.firstName} ${awansowanyKlient.lastName}` : `ID: ${kandydatDoAwansu.id}`;

        await supabase.from('transakcje').insert([{
          klient_id: kandydatDoAwansu.id,
          typ_operacji: 'zajecia_awans_rezerwa',
          class_key: classKey,
          opis: `Automatyczny awans: ${imieNazwisko} przepisany z listy rezerwowej na listę główną.`
        }]);

        await supabase.from('booking_logs').insert([{
          action_type: 'WAITLIST_PROMOTED',
          status: 'SUCCESS',
          reason: `${imieNazwisko} awansował na listę główną w ${classKey}`,
          rule_applied: 'waitlist_auto_promote',
          payload: { klient_id: kandydatDoAwansu.id, class_key: classKey }
        }]);

        // WYSŁANIE POWIADOMIENIA PUSH O AWANSIE Z KRZESEŁKA NA TRENING
        await sendPushNotification(kandydatDoAwansu.id, {
          title: 'Zwolniło się miejsce!',
          body: `Awansowałeś z listy rezerwowej (krzesełko) na listę główną treningu ${selectedClass.title} (${selectedClass.displayDate} ${selectedClass.start})!`,
          url: '/'
        });
      }
    }

    showToast("Zostałeś pomyślnie wypisany z zajęć i odzyskałeś wejście.");
    loadData();
    setSelectedClass(null);
  };

  const handleWypiszZListyAktywnych = async (classKey: string, title: string, startStr: string, fullDateObj: Date) => {
    const now = new Date();
    const [sh = '00', sm = '00'] = (startStr || '00:00').split(':');
    const classStartDateTime = new Date(fullDateObj.getFullYear(), fullDateObj.getMonth(), fullDateObj.getDate(), parseInt(sh), parseInt(sm), 0);

    if (classStartDateTime.getTime() < now.getTime()) {
      showToast("Czas na wypisanie minął (Zajęcia historyczne).", 'info');
      return;
    }
    if (!currentUser) return;
    
    const cancelDeadlineMinutes = bookingRules.cancel_deadline_per_class?.[title] ?? bookingRules.cancel_deadline_minutes ?? 90;
    const diffMinutes = (classStartDateTime.getTime() - now.getTime()) / (1000 * 60);

    // SZTYWNA BLOKADA WYPISANIA PO CZASIE
    if (diffMinutes < cancelDeadlineMinutes && diffMinutes > 0) {
      showToast(`Nie możesz się wypisać! Czas na bezpłatny wypis z tych zajęć wynosi ${cancelDeadlineMinutes} minut przed startem.`, 'error');
      return;
    }

    if (!confirm(`Czy na pewno chcesz wypisać się z zajęć: ${title}?`)) return;

    const { error } = await supabase.from('zapisy_zajec').delete().eq('class_key', classKey).eq('klient_id', currentUser.id);
    if (error) { showToast(`Nie udało się wypisać z zajęć: ${error.message}`, 'error'); return; }

    let updatedKarnety = [...(currentUser.karnetyKlubowicza || [])];
    const passIndex = updatedKarnety.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
    if (passIndex !== -1) {
      const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10);
      const poczatkowe = parseInt(updatedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
      if (!isNaN(currentRemaining)) {
        updatedKarnety[passIndex] = {
          ...updatedKarnety[passIndex],
          pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
        };
        await supabase.from('klienci').update({ karnetyKlubowicza: updatedKarnety }).eq('id', currentUser.id);
      }
    }

    await supabase.from('transakcje').insert([{ klient_id: currentUser.id, typ_operacji: 'zajecia_wypis', class_key: classKey, opis: `${currentUser.firstName || 'Klubowicz'} - Samodzielne wypisanie z zajęć: ${title}. Zwrócono 1 wejście.` }]);
    
    const parts = classKey.split('_');
    const classId = parts[0];
    const stdClass = zapisaneZajecia.find(z => String(z.id) === classId);
    const jednorazClass = jednorazoweZajecia.find(z => String(z.id) === classId);
    const override = nadpisaneZajeciaDni[classKey];
    const classInfo = override ? { ...stdClass, ...jednorazClass, ...override } : (stdClass || jednorazClass);
    const limitZajec = classInfo?.limit || 12;

    const aktualni = zapisyNaZajecia[classKey] || [];
    const pozostaliUczestnicy = aktualni.filter(u => String(u.id) !== String(currentUser.id));
    const listaGlownaPoWypisie = pozostaliUczestnicy.filter(u => u.status === 'zapisany');
    const rezerwaPoWypisie = pozostaliUczestnicy.filter(u => u.status === 'krzesełko');

    if (listaGlownaPoWypisie.length < limitZajec && rezerwaPoWypisie.length > 0) {
      const kandydatDoAwansu = rezerwaPoWypisie.find((w: any) => {
        const cutoff = w.waitlist_cutoff_minutes !== undefined && w.waitlist_cutoff_minutes !== null ? Number(w.waitlist_cutoff_minutes) : 30;
        return diffMinutes > cutoff;
      }) || rezerwaPoWypisie[0];

      if (kandydatDoAwansu) {
        await supabase
          .from('zapisy_zajec')
          .update({ status: 'zapisany' })
          .eq('class_key', classKey)
          .eq('klient_id', kandydatDoAwansu.id);

        const awansowanyKlient = klienciList.find(c => c.id === kandydatDoAwansu.id);
        const imieNazwisko = awansowanyKlient ? `${awansowanyKlient.firstName} ${awansowanyKlient.lastName}` : `ID: ${kandydatDoAwansu.id}`;

        await supabase.from('transakcje').insert([{
          klient_id: kandydatDoAwansu.id,
          typ_operacji: 'zajecia_awans_rezerwa',
          class_key: classKey,
          opis: `Automatyczny awans: ${imieNazwisko} przepisany z listy rezerwowej na listę główną.`
        }]);

        await supabase.from('booking_logs').insert([{
          action_type: 'WAITLIST_PROMOTED',
          status: 'SUCCESS',
          reason: `${imieNazwisko} awansował na listę główną w ${classKey}`,
          rule_applied: 'waitlist_auto_promote',
          payload: { klient_id: kandydatDoAwansu.id, class_key: classKey }
        }]);

        // WYSŁANIE POWIADOMIENIA PUSH O AWANSIE Z KRZESEŁKA NA TRENING
        await sendPushNotification(kandydatDoAwansu.id, {
          title: 'Zwolniło się miejsce!',
          body: `Awansowałeś z listy rezerwowej (krzesełko) na listę główną treningu ${title} (${startStr})!`,
          url: '/'
        });
      }
    }

    showToast("Zostałeś pomyślnie wypisany z zajęć i odzyskałeś wejście.");
    loadData();
  };

  const handleZapiszKlientaDoZajec = async (klient: any) => {
    if (!selectedClass) return;
    if (selectedClass.isOdwołane || selectedClass.isUsunięte) { showToast("Nie można zapisać na odwołane lub usunięte zajęcia!", 'error'); return; }
    
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
    const [d, m] = dateStr.split('/').map(Number);
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

    const walletVal = parseFloat(String(klient.wallet || klient.Portfel || '0').replace(/[^0-9.-]+/g, "")) || 0;
    if (walletVal < 0) {
      if (!confirm(`UWAGA: Klubowicz ${klient.firstName} ${klient.lastName} posiada zadłużenie (${klient.wallet || klient.Portfel}). Zapisać mimo to?`)) return;
    } else {
      if (!confirm(`Czy na pewno chcesz zapisać klienta ${klient.firstName} ${klient.lastName} na zajęcia?`)) return;
    }
    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const aktualni = zapisyNaZajecia[classKey] || [];
    if (aktualni.some(k => k.id === klient.id)) { showToast("Ten klient jest już zapisany na te zajęcia!", 'info'); return; }
    
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
    Object.entries(zapisyNaZajecia).forEach(([cKey, uczestnicy]) => {
      if (cKey.endsWith(`_${selectedClass.displayDate}`)) {
        if (Array.isArray(uczestnicy) && uczestnicy.some((u: any) => String(u.id) === String(klient.id))) userSignupsOnThisDate++;
      }
    });
    if (userSignupsOnThisDate >= dailyLimit) { showToast(`Nie można zapisać! Wykorzystano dzienny limit (${dailyLimit}).`, 'error'); return; }
    
    const limitZajec = selectedClass.limit || 12;
    const glownaCount = aktualni.filter((u: any) => u.status === 'zapisany').length;
    const statusZpisu = glownaCount >= limitZajec ? 'krzesełko' : 'zapisany';
    const { error } = await supabase.from('zapisy_zajec').insert([{ class_key: classKey, klient_id: klient.id, status: statusZpisu, waitlist_cutoff_minutes: statusZpisu === 'krzesełko' ? 30 : null, obecny: false }]);
    if (error) { showToast(`Nie udało się zapisać: ${error.message}`, 'error'); return; }

    let updatedKarnety = [...(klient.karnetyKlubowicza || [])];
    const passIndex = updatedKarnety.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
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

    const oblozenieStr = `${glownaCount + (statusZpisu === 'zapisany' ? 1 : 0)}/${limitZajec}`;
    const typWydarzenia = statusZpisu === 'krzesełko' ? `Zapisano na listę rezerwową (krzesełko)` : `Zapisano na zajęcia`;
    await supabase.from('transakcje').insert([{ klient_id: klient.id, typ_operacji: 'zajecia_zapis', class_key: classKey, opis: `${klient.firstName} ${klient.lastName} - ${typWydarzenia}. Obłożenie: ${oblozenieStr}` }]);
    setIsSearchingClient(false); setSearchClientQuery(''); loadData();
    showToast(`Pomyślnie zapisano ${klient.firstName} ${klient.lastName}!`);
  };

  const handlePotwierdzWypisanie = async () => {
    if (!selectedClass || !clientToUnregister) return;
    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const limitZajec = selectedClass.limit || 12;
    const aktualni = zapisyNaZajecia[classKey] || [];
    const { error } = await supabase.from('zapisy_zajec').delete().eq('class_key', classKey).eq('klient_id', clientToUnregister.id);
    if (error) { showToast(`Nie udało się wypisać: ${error.message}`, 'error'); return; }

    const zwrocicWejscie = confirm("Czy zwrócić klubowiczowi wejście na karnet?");
    let updatedKarnety = [...(clientToUnregister.karnetyKlubowicza || [])];
    if (zwrocicWejscie) {
      const passIndex = updatedKarnety.findIndex((k: any) => k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined);
      if (passIndex !== -1) {
        const currentRemaining = parseInt(updatedKarnety[passIndex].pozostaloWejsc, 10);
        const poczatkowe = parseInt(updatedKarnety[passIndex].poczatkoweWejsc || currentRemaining + 1, 10);
        if (!isNaN(currentRemaining)) {
          updatedKarnety[passIndex] = {
            ...updatedKarnety[passIndex],
            pozostaloWejsc: Math.min(poczatkowe, currentRemaining + 1)
          };
          await supabase.from('klienci').update({ karnetyKlubowicza: updatedKarnety }).eq('id', clientToUnregister.id);
        }
      }
    }

    await supabase.from('transakcje').insert([{ klient_id: clientToUnregister.id, typ_operacji: 'zajecia_wypis', class_key: classKey, opis: `${clientToUnregister.firstName} ${clientToUnregister.lastName} - Wypisanie z zajęć przez klub.${zwrocicWejscie ? ' Zwrócono 1 wejście.' : ''}` }]);
    
    const pozostaliUczestnicy = aktualni.filter(u => u.id !== clientToUnregister.id);
    const listaGlownaPoWypisie = pozostaliUczestnicy.filter(u => u.status === 'zapisany');
    const rezerwaPoWypisie = pozostaliUczestnicy.filter(u => u.status === 'krzesełko');

    if (listaGlownaPoWypisie.length < limitZajec && rezerwaPoWypisie.length > 0) {
      const pierwszaRezerwa = rezerwaPoWypisie[0];
      await supabase
        .from('zapisy_zajec')
        .update({ status: 'zapisany' })
        .eq('class_key', classKey)
        .eq('klient_id', pierwszaRezerwa.id);

      const awansowanyKlient = klienciList.find(c => c.id === pierwszaRezerwa.id);
      const imieNazwisko = awansowanyKlient ? `${awansowanyKlient.firstName} ${awansowanyKlient.lastName}` : `ID: ${pierwszaRezerwa.id}`;

      await supabase.from('transakcje').insert([{
        klient_id: pierwszaRezerwa.id,
        typ_operacji: 'zajecia_awans_rezerwa',
        class_key: classKey,
        opis: `Automatyczny awans: ${imieNazwisko} przepisany z listy rezerwowej na listę główną.`
      }]);

      await supabase.from('booking_logs').insert([{
        action_type: 'WAITLIST_PROMOTED',
        status: 'SUCCESS',
        reason: `${imieNazwisko} awansował na listę główną w ${classKey}`,
        rule_applied: 'waitlist_auto_promote',
        payload: { klient_id: pierwszaRezerwa.id, class_key: classKey }
      }]);

      // WYSŁANIE POWIADOMIENIA PUSH O AWANSIE Z KRZESEŁKA NA TRENING
      await sendPushNotification(pierwszaRezerwa.id, {
        title: 'Zwolniło się miejsce!',
        body: `Awansowałeś z listy rezerwowej (krzesełko) na listę główną treningu ${selectedClass.title} (${selectedClass.displayDate} ${selectedClass.start})!`,
        url: '/'
      });
    }

    if (blokadaZapisow) {
      const dni = parseInt(dlugoscBlokady) || 3;
      const dataWygaśnięcia = new Date();
      dataWygaśnięcia.setDate(dataWygaśnięcia.getDate() + dni);
      const dataStr = `${dataWygaśnięcia.getFullYear()}-${String(dataWygaśnięcia.getMonth() + 1).padStart(2, '0')}-${String(dataWygaśnięcia.getDate()).padStart(2, '0')}`;
      const powod = `Blokada zapisów na ${dni} dni za brak obecności na treningu ${selectedClass.title} w dniu ${selectedClass.displayDate}.`;
      
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
    setClientToUnregister(null); setBlokadaZapisow(false); loadData();
    showToast("Wypisano klienta z zajęć.");
  };

  const handlePotwierdzNieobecnosc = async () => {
    if (!selectedClass || !clientToMarkAbsent) return;
    const classKey = `${selectedClass.id}_${selectedClass.displayDate}`;
    const { error } = await supabase.from('zapisy_zajec').update({ obecny: false, nieobecny: true }).eq('class_key', classKey).eq('klient_id', clientToMarkAbsent.id);
    if (error) { showToast(`Nie udało się oznaczyć: ${error.message}`, 'error'); return; }
    
    await supabase.from('transakcje').insert([{ klient_id: clientToMarkAbsent.id, typ_operacji: 'zajecia_wypis', class_key: classKey, opis: `${clientToMarkAbsent.firstName} ${clientToMarkAbsent.lastName} - Został oznaczony jako NIEOBECNY na zajęciach ${selectedClass.title}.` }]);
    
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
    setClientToMarkAbsent(null); setBlokadaZapisow(false); loadData();
    showToast(`Oznaczono nieobecność dla ${clientToMarkAbsent.firstName} ${clientToMarkAbsent.lastName}.`);
  };

  const getTopBorderColor = (title: string, isOdwolane: boolean, isUsunięte: boolean) => {
    if (isOdwolane || isUsunięte) return '#fda4af';
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
        if (k.pozostaloWejsc !== undefined && k.pozostaloWejsc !== null) {
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
          const [d, m] = dateStr.split('/').map(Number);
          const stdClass = zapisaneZajecia.find(z => String(z.id) === classId);
          const jednorazClass = jednorazoweZajecia.find(z => String(z.id) === classId);
          let classInfo = stdClass || jednorazClass;
          const override = nadpisaneZajeciaDni[classKey];
          if (override) classInfo = { ...classInfo, ...override };

          if (classInfo) {
            if (appRole === 'klubowicz' && classInfo.isUsunięte) {
              // pomijamy
            } else {
              const [sh = '00', sm = '00'] = (classInfo?.start || '00:00').split(':');
              const classStartDateTime = new Date(now.getFullYear(), m - 1, d, parseInt(sh), parseInt(sm), 0);

              if (classStartDateTime >= now) {
                myUpcomingClasses.push({
                  ...classInfo,
                  classKey,
                  displayDate: dateStr,
                  fullDateObj: new Date(now.getFullYear(), m - 1, d),
                  signupStatus: mojZapis.status || 'zapisany',
                  isKrzeselko: mojZapis.status === 'krzesełko',
                  waitlistCutoffMinutes: mojZapis.waitlist_cutoff_minutes || 30
                });
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

  // FILTROWANIE AKTYWNYCH OGŁOSZEŃ DLA ZALOGOWANEGO UŻYTKOWNIKA
  const userPassNames = (currentUser?.karnetyKlubowicza || []).map((k: any) => k.nazwa);
  if (currentUser?.pass && !userPassNames.includes(currentUser.pass)) {
    userPassNames.push(currentUser.pass);
  }

  const activeOgloszeniaForUser = ogloszeniaList.filter((o: any) => {
    if (o.isVisible === false) return false;
    if (o.dateFrom && o.dateFrom > todayStr) return false;
    if (o.dateTo && o.dateTo < todayStr) return false;
    
    if (o.target === 'Wszystkich' || (Array.isArray(o.targetArray) && o.targetArray.includes('Wszystkich'))) {
      return true;
    }
    
    if (Array.isArray(o.targetArray) && o.targetArray.length > 0) {
      return o.targetArray.some((targetPass: string) => userPassNames.includes(targetPass));
    }
    
    return true;
  });

  const isCurrentUserBlocked = currentUser?.blokadaDo && currentUser.blokadaDo >= todayStr;
  const activePassBlocked = (currentUser?.karnetyKlubowicza || []).find((k: any) => k.blokadaDo && k.blokadaDo >= todayStr);
  const activePassSuspended = (currentUser?.karnetyKlubowicza || []).find((k: any) => k.zawieszonyOd);
  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 font-sans antialiased text-slate-800 relative">
      
      {/* NOWOCZESNE POWIADOMIENIE TOAST */}
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

      {/* SEKCJA: OGŁOSZENIA KLUBU Z SUPABASE */}
      {['klubowicz', 'trener'].includes(appRole) && activeOgloszeniaForUser.length > 0 && (
        <div className="space-y-3">
          {activeOgloszeniaForUser.map((ogloszenie: any) => (
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

      {['klubowicz', 'trener'].includes(appRole) && currentUser && (
        <div className="space-y-10 animate-in fade-in zoom-in-95">
          
          {/* SEKCJA: TWOJE AKTYWNE ZAPISY */}
          <section className="space-y-4">
            <h2 className="text-[13px] font-medium text-slate-500 uppercase tracking-wider pl-1">Twoje aktywne zapisy</h2>
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              
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
                      <div className="w-[45%] pr-2">
                        <div className="text-[10px] font-black text-sky-700 uppercase tracking-wider mb-0.5">
                          {['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'][cls.fullDateObj.getDay()]}
                        </div>
                        <div className="text-[12px] sm:text-[13px] font-bold text-slate-800 font-mono">
                          {`${String(cls.fullDateObj.getDate()).padStart(2, '0')}.${String(cls.fullDateObj.getMonth() + 1).padStart(2, '0')}.${String(cls.fullDateObj.getFullYear()).slice(-2)}`}
                        </div>
                        <div className="text-[11px] sm:text-[12px] text-slate-500 mt-0.5">
                          {cls.start} - {cls.end} ({calculateDuration(cls.start, cls.end)})
                        </div>
                      </div>
                      <div className="w-[40%] pr-2">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[12px] sm:text-[13px] font-bold text-slate-900 truncate">{cls.title}</span>
                          {cls.isKrzeselko && (
                            <span className="bg-blue-100 text-blue-900 border border-blue-200 text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-0.5" title={`Lista rezerwowa (Wypis na ${cls.waitlistCutoffMinutes >= 60 ? `${cls.waitlistCutoffMinutes / 60}h` : `${cls.waitlistCutoffMinutes} min`} przed startem)`}>
                              🪑 Krzesełko ({cls.waitlistCutoffMinutes >= 60 ? `${cls.waitlistCutoffMinutes / 60}h` : `${cls.waitlistCutoffMinutes}m`})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] sm:text-[12px] text-slate-500 mt-0.5 truncate">{cls.trainer || 'Brak trenera'}</div>
                      </div>
                      <div className="w-[15%] flex justify-end items-center pr-1">
                        <button 
                          onClick={() => handleWypiszZListyAktywnych(cls.classKey, cls.title, cls.start, cls.fullDateObj)}
                          className="w-10 h-10 bg-[#ff2a43] hover:bg-rose-600 text-white rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-105 cursor-pointer shrink-0"
                          title="Wypisz się z zajęć"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l4 4m0-4l-4 4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
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
                    {currentUser.karnetyKlubowicza && currentUser.karnetyKlubowicza.length > 0 && currentUser.karnetyKlubowicza[0].pozostaloWejsc !== null && currentUser.karnetyKlubowicza[0].pozostaloWejsc !== undefined && (
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

      {/* SEKCJA: GRAFIK ZAJĘĆ */}
      <section className="space-y-4">
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 ${(appRole === 'admin' || appRole === 'trener') ? 'bg-white border border-sky-200 p-4 rounded-2xl shadow-sm' : 'mt-8'}`}>
          <h2 className={`font-medium uppercase tracking-wider ${['klubowicz', 'trener'].includes(appRole) ? 'text-[13px] text-slate-500 pl-1' : 'text-base sm:text-lg font-black text-sky-950'}`}>
            {['klubowicz', 'trener'].includes(appRole) ? 'Grafik' : 'GRAFIK ZAJĘĆ'}
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
              })
              .filter((item: any) => {
                if (appRole === 'klubowicz' && item.isUsunięte) return false;
                return true;
              });

            const jednorazoweDnia = czyObózAktywny ? [] : jednorazoweZajecia
              .filter((item: any) => item.displayDate === col.date)
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
                  <div key={wydarzenie.id} className="bg-rose-100 border border-rose-300 rounded-xl p-2.5 text-center space-y-1 shadow-sm">
                    <div className="py-1 px-2 bg-rose-200 text-rose-950 font-black rounded-lg text-[11px] uppercase tracking-wider border border-rose-300">
                      {wydarzenie.title}
                    </div>
                    <div className="text-[10px] text-rose-900 font-bold">
                      Odwołano zajęcia z powodu wydarzenia
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

                      return (
                        <div
                          key={classIdx}
                          onClick={() => {
                            if (isClassCancelled || item.isUsunięte) return;
                            if (isLockedForClient) {
                              showToast("Te zajęcia już się odbyły. Zapisy oraz wypisy nie są już możliwe.", 'info');
                              return;
                            }
                            setSelectedClass({
                              ...item,
                              displayDate: col.date,
                              isoDate: col.isoDate, 
                              durationText
                            });
                            setIsSearchingClient(false);
                            setSearchClientQuery('');
                          }}
                          style={{ borderTopWidth: '3.5px', borderTopStyle: 'solid', borderTopColor: topColor }}
                          className={`bg-white border rounded-xl p-2.5 space-y-1.5 shadow-sm transition-all relative ${
                            isClassCancelled || item.isUsunięte
                              ? 'border-rose-200 opacity-80 cursor-default bg-rose-50/20'
                              : isLockedForClient
                              ? 'border-slate-200 opacity-60 cursor-not-allowed grayscale-[30%]'
                              : 'border-sky-100 cursor-pointer hover:border-sky-300 hover:shadow-md'
                          }`}
                        >
                          <div className="flex justify-between items-center gap-1.5">
                            <div className="flex items-baseline gap-1.5 truncate">
                              <span className="text-xs sm:text-sm font-black text-slate-900 shrink-0">{item.start}</span>
                              <h3 className="text-[11px] sm:text-xs font-bold text-slate-800 truncate" title={item.title}>{item.title}</h3>
                            </div>
                            {isLockedForClient && !isClassCancelled && !item.isUsunięte && (
                              <span className="text-slate-400 text-xs shrink-0" title="Zajęcia zablokowane (minęły)">
                                🔒
                              </span>
                            )}
                          </div>
                          
                          {item.isUsunięte ? (
                            <div className="py-0.5 px-2 bg-rose-100 text-rose-800 font-black text-center rounded text-[10px] uppercase tracking-wider border border-rose-200">
                              USUNIĘTE
                            </div>
                          ) : isClassCancelled ? (
                            <div className="py-0.5 px-2 bg-rose-100 text-rose-800 font-black text-center rounded text-[10px] uppercase tracking-wider border border-rose-200 leading-tight">
                              {autoCancelStatus.isAutoCancelled ? autoCancelStatus.reason : 'ODWOŁANE'}
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
                    })
                  )}
                </div>
              </>
            );

            return (
              <div
                key={idx}
                className={`space-y-2 p-2.5 rounded-2xl border transition-all ${
                  isToday
                    ? 'bg-white border-rose-500 shadow-md border-t-4 border-t-rose-600'
                    : 'bg-sky-50/40 border-sky-100'
                }`}
              >
                <div className={`text-xs font-black uppercase tracking-wider border-b pb-1.5 mb-1.5 text-center ${
                  isToday ? 'text-rose-950 border-rose-200' : 'text-sky-900 border-sky-200'
                }`}>
                  <span className={isToday ? 'text-rose-700' : ''}>{col.day}</span>{' '}
                  <span className={`text-[10px] font-normal ${isToday ? 'text-rose-800' : 'text-slate-500'}`}>({col.date})</span>
                </div>
                
                {isOtherDay && hasAnyItems ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => toggleDay(col.isoDate)}
                      className="w-full bg-slate-100 hover:bg-slate-200/80 text-slate-600 font-bold text-[10px] uppercase tracking-wider py-1.5 px-2 rounded-xl flex items-center justify-center transition-colors cursor-pointer border border-slate-200"
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
                            {maKarnet && client.karnetyKlubowicza[0]?.pozostaloWejsc !== null && client.karnetyKlubowicza[0]?.pozostaloWejsc !== undefined && (
                              <span className="bg-sky-100 text-sky-900 text-[10px] font-black px-2 py-0.5 rounded-md border border-sky-200 flex items-center gap-1">
                                <span>🎟️ Wejścia:</span>
                                <span className="text-amber-700">{client.karnetyKlubowicza[0].pozostaloWejsc}</span> / <span>{client.karnetyKlubowicza[0].poczatkoweWejsc || client.karnetyKlubowicza[0].pozostaloWejsc}</span>
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

        // ROZDZIELENIE UCZESTNIKÓW NA LISTĘ GŁÓWNĄ I LISTĘ REZERWOWĄ (KRZESEŁKO)
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
                    {glownaNieposortowana.length}/{limitZajec}
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

                    const isThisUserMe = currentUser && String(osoba.id) === String(currentUser.id);
                    const canSeeThisPersonDetails = canManageClass || isThisUserMe;
                    const displayName = canSeeThisPersonDetails
                      ? `${osoba.firstName} ${osoba.lastName}`
                      : `${osoba.firstName} ${osoba.lastName ? osoba.lastName.charAt(0) + '.' : ''}`;

                    const hasBirthdayToday = isBirthdayOnDate(osoba.birthDate || osoba.Urodziny, selectedClass.displayDate, selectedClass.isoDate);

                    return (
                      <div key={osoba.id} className="bg-white border border-sky-200 rounded-2xl p-4 shadow-sm relative flex flex-col justify-between space-y-4">
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

                      return (
                        <div key={osoba.id} className="bg-blue-50/50 border border-blue-200 rounded-2xl p-4 shadow-sm relative flex flex-col justify-between space-y-4">
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
                                  <div><span className="font-bold text-slate-700">KARNET:</span> {osoba.pass || 'OPEN'}</div>
                                  <div><span className="font-bold text-slate-700">WAŻNOŚĆ:</span> {osoba.expiresDate || '2026-09-01'}</div>
                                  <div><span className="font-bold text-slate-700">LIMIT WYPISU:</span> <strong className="text-blue-900">{cutoffMin >= 60 ? `${cutoffMin / 60}h` : `${cutoffMin} min`} przed startem</strong></div>
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
                          {canManageClass && (
                            <div className="flex items-center justify-between border-t border-blue-100 pt-3 text-xs">
                              <span className="font-bold text-blue-800 text-[11px]">Wypis: {cutoffMin >= 60 ? `${cutoffMin / 60}h` : `${cutoffMin}m`} przed</span>
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

              {['klubowicz', 'trener'].includes(appRole) ? (
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

      {/* NOWY MODAL: WYBÓR CZASU WYPISU Z LISTY REZERWOWEJ (KRZESEŁKO) */}
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
              <div className="grid grid-cols-4 gap-2 text-xs font-bold text-slate-700 text-center">
                <button onClick={() => { openProfile(tableActionClient); setTableActionClient(null); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">✏️</span> Edytuj
                </button>
                <button onClick={() => { showToast("Moduł sprzedaży produktów wkrótce dostępny.", 'info'); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">🛒</span> Sprzedaj produkt
                </button>
                <button onClick={() => { showToast("Moduł zadań wkrótce dostępny.", 'info'); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">➕</span> Dodaj zadanie
                </button>
                <button onClick={() => { showToast("Wygenerowano link do płatności.", 'info'); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">💲</span> Link do płatności
                </button>
                <button onClick={() => { showToast("Wiadomość została wysłana.", 'info'); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">✉️</span> Wyślij wiadomość
                </button>
                <button onClick={() => { showToast("Wysłano link do resetu hasła.", 'info'); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer">
                  <span className="text-base">🔑</span> Resetuj hasło
                </button>
                <button onClick={() => { showToast("Zmieniono konto na profil gościa.", 'info'); }} className="p-3 bg-slate-50 hover:bg-sky-50 hover:text-sky-900 rounded-2xl border border-slate-200 flex flex-col items-center gap-1.5 transition-colors cursor-pointer col-span-2">
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

      {/* MODAL: PROFIL KLUBOWICZA */}
      {profileClient && (() => {
        const continuityInfo = calculateContinuityDiscount(profileClient);
        const hasManualDiscount = Boolean(profileClient.discount && parseFloat(profileClient.discount) > 0);

        return (
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

                {/* SEKCJA RABATÓW: RĘCZNY (NADRZĘDNY) ORAZ SYSTEMOWY (CIĄGŁOŚĆ) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* BOKS 1: RABAT RĘCZNY (NADRZĘDNY) */}
                  <div className="bg-white border-2 border-amber-300/80 rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🏷️</span>
                        <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider">Rabat Ręczny (Nadrzędny)</h4>
                      </div>
                      {hasManualDiscount ? (
                        <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                          AKTYWNY (PRIORYTET)
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">
                          BRAK
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Ręcznie zdefiniowany rabat procentowy dla tego klienta. Jeśli jest wpisany, nadpisuje rabat systemowy.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="np. 15"
                          value={profileManualDiscountInput}
                          onChange={(e) => setProfileManualDiscountInput(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                      </div>
                      <button
                        onClick={handleSaveManualDiscountSubmit}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                      >
                        Zapisz rabat
                      </button>
                    </div>
                  </div>

                  {/* BOKS 2: RABAT SYSTEMOWY (CIĄGŁOŚĆ KARNETU) */}
                  <div className="bg-white border border-sky-200 rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🔄</span>
                        <h4 className="font-black text-xs text-sky-950 uppercase tracking-wider">Rabat Systemowy (Ciągłość)</h4>
                      </div>
                      {continuityInfo.hasContinuity ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                          CIĄGŁOŚĆ ZACHOWANA
                        </span>
                      ) : (
                        <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-200">
                          BRAK CIĄGŁOŚCI
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Automatyczny rabat naliczany przy przedłużaniu karnetu przed jego wygaśnięciem według zasady ciągłości (max 1 dzień po wygaśnięciu).
                    </p>
                    <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-2.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-900">Wartość rabatu systemowego:</span>
                      <span className="text-xs font-black text-sky-950 font-mono bg-white px-3 py-1 rounded-lg border border-sky-200">
                        {continuityInfo.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SEKCJA: KARNETY KLUBOWICZA W PROFILU */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">Karnety klubowicza</h3>
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
                                    {karnet.pozostaloWejsc !== null && karnet.pozostaloWejsc !== undefined && (
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

                {/* SEKCJA: PORTFEL W PROFILU */}
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

                {/* SEKCJA: ZAPISY NA ZAJĘCIA W PROFILU */}
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
        );
      })()}

      {/* MODAL: DODAJ DRUGI KARNET */}
      {isAddSecondPassModalOpen && profileClient && (() => {
        const effectiveDiscount = getEffectiveDiscount(profileClient);
        const selectedPassDef = dostepneKarnety.find(k => k.nazwa === selectedPassToAdd);
        const basePrice = selectedPassDef ? parseFloat(selectedPassDef.cena) : 0;
        const discountedPrice = effectiveDiscount.percent > 0 
          ? basePrice * (1 - effectiveDiscount.percent / 100) 
          : basePrice;

        return (
          <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
              <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🎟️ Przypisz karnet z bazy</h3>
                <button onClick={() => setIsAddSecondPassModalOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
              </div>
              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Wybierz karnet *</label>
                  <select 
                    value={selectedPassToAdd} 
                    onChange={(e) => setSelectedPassToAdd(e.target.value)} 
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold cursor-pointer"
                  >
                    <option value="">-- Wybierz karnet --</option>
                    {dostepneKarnety.map(k => {
                      const kBasePrice = parseFloat(k.cena) || 0;
                      const kFinalPrice = effectiveDiscount.percent > 0 
                        ? (kBasePrice * (1 - effectiveDiscount.percent / 100)).toFixed(2)
                        : k.cena;
                      return (
                        <option key={k.id} value={k.nazwa}>
                          {k.nazwa} ({kFinalPrice} PLN {effectiveDiscount.percent > 0 ? `| Rabat ${effectiveDiscount.percent}%` : ''})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedPassToAdd && selectedPassDef && (
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
                      <span>Kwota końcowa:</span>
                      <span className="text-emerald-700">{discountedPrice.toFixed(2)} PLN</span>
                    </div>
                  </div>
                )}

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
        );
      })()}

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
                    Blokuje możliwość wejścia do klubu oraz zapisu na zajęcia. Wypisuje ze wszystkich nadchodzących zajęć. <strong>NIE przedłuża</strong> ważności karnetu.
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

      {/* MODAL: POTWIERDZENIE WYPISANIA */}
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
                  <span>Nałóż blokadę zapisów (np. za niestawienie się)</span>
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

      {/* MODAL: OZNACZ JAKO NIEOBECNEGO */}
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

      {/* MODAL: EDYTUJ DANE KONTA */}
      {isEditProfileInfoOpen && profileClient && (
        <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">✏️ Edytuj dane klubowicza</h3>
              <button onClick={() => setIsEditProfileInfoOpen(false)} className="text-slate-400 font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSaveProfileInfoSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Imię</label>
                  <input
                    type="text"
                    value={profileClient.firstName || ''}
                    onChange={(e) => setProfileClient({ ...profileClient, firstName: e.target.value })}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nazwisko</label>
                  <input
                    type="text"
                    value={profileClient.lastName || ''}
                    onChange={(e) => setProfileClient({ ...profileClient, lastName: e.target.value })}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2 font-bold"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Telefon</label>
                <input
                  type="text"
                  value={profileClient.phone || ''}
                  onChange={(e) => setProfileClient({ ...profileClient, phone: e.target.value })}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Email</label>
                <input
                  type="email"
                  value={profileClient.email || ''}
                  onChange={(e) => setProfileClient({ ...profileClient, email: e.target.value })}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Płeć</label>
                <select
                  value={profileClient.gender || ''}
                  onChange={(e) => setProfileClient({ ...profileClient, gender: e.target.value })}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2 font-bold cursor-pointer"
                >
                  <option value="">Nie podano</option>
                  <option value="Mężczyzna">Mężczyzna</option>
                  <option value="Kobieta">Kobieta</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsEditProfileInfoOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="bg-sky-900 hover:bg-sky-800 text-white font-black px-6 py-2.5 rounded-xl cursor-pointer">Zapisz dane</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

