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

// POBIERANIE PEŁNE I OD NAJNOWSZYCH (BEZ LIMITU 1000 REKORDÓW SUPABASE)
const fetchAllFromSupabase = async (
  table: string,
  orderBy: string = 'created_at',
  ascending: boolean = false,
  maxPages: number = 50
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

// KALKULATOR PRZEDŁUŻENIA DO OSTATNIEGO DNIA MIESIĄCA KALENDARZOWEGO (DLA UMÓW 12M)
const getContractEndOfMonthDate = (baseDateStr?: string | null): string => {
  const today = new Date();
  let base = today;
  if (baseDateStr && baseDateStr !== '-') {
    const [y, m, d] = baseDateStr.split('-').map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const parsed = new Date(y, m - 1, d);
      if (parsed > today) base = parsed;
    }
  }
  const targetYear = base.getFullYear();
  const targetMonth = base.getMonth() + 1;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const resMonth = String(targetMonth + 1).padStart(2, '0');
  return `${targetYear}-${resMonth}-${String(lastDay).padStart(2, '0')}`;
};

// PRECYZYJNY PARSER DATY Z CLASS_KEY
const parseDateFromClassKey = (classKey: string): Date => {
  const parts = classKey ? String(classKey).split('_') : [];
  const datePart = parts[1] || '';
  const currentYear = new Date().getFullYear();

  if (!datePart) return new Date();

  if (datePart.includes('/')) {
    const segments = datePart.split('/');
    if (segments.length === 2) {
      const [d, m] = segments;
      return new Date(currentYear, parseInt(m, 10) - 1, parseInt(d, 10));
    } else if (segments.length === 3) {
      const [d, m, y] = segments;
      const fullYear = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
      return new Date(fullYear, parseInt(m, 10) - 1, parseInt(d, 10));
    }
  } else if (datePart.includes('-')) {
    const segments = datePart.split('-');
    if (segments.length === 3) {
      if (segments[0].length === 4) {
        const [y, m, d] = segments;
        return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      } else {
        const [d, m, y] = segments;
        return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
      }
    } else if (segments.length === 2) {
      const [d, m] = segments;
      return new Date(currentYear, parseInt(m, 10) - 1, parseInt(d, 10));
    }
  }
  return new Date();
};

// POWIADOMIENIA DLA TRENERÓW (ŚCIŚLE 1X NA 5 MIN PRZED I 1X PO OSTATNIM TRENINGU, BEZ DUBLETIW)
const checkAndSendTrainerReminders = async (
  classes: any[],
  jednorazowe: any[],
  overridesMap: { [key: string]: any },
  trenerzyList: any[],
  allClientsList: any[],
  currentRole: string,
  currentUserEmail?: string
) => {
  try {
    // BLOKADA: Zwykli klubowicze przeglądający grafik nie mogą triggerować alertów trenera
    if (currentRole === 'klubowicz') return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    const pad = (n: number) => String(n).padStart(2, '0');
    const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const todayDisplay = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}`;
    const dayKeys = ['nd', 'pon', 'wt', 'sr', 'czw', 'pt', 'sob'];
    const dayKey = dayKeys[now.getDay()];

    if (dayKey === 'nd' || dayKey === 'sob') return;

    const todaysClasses: any[] = [];

    classes
      .filter((item: any) => item.days && item.days[dayKey])
      .forEach((item: any) => {
        const classKey = `${item.id}_${todayDisplay}`;
        const override = overridesMap[classKey];
        const cls = override ? { ...item, ...override, classKey } : { ...item, classKey };
        if (!cls.isOdwołane && !cls.isUsunięte && cls.start && cls.trainer) {
          todaysClasses.push(cls);
        }
      });

    jednorazowe
      .filter((item: any) => item.displayDate === todayDisplay || item.fullDateStr === todayIso)
      .forEach((item: any) => {
        const classKey = `${item.id}_${todayDisplay}`;
        const override = overridesMap[classKey];
        const cls = override ? { ...item, ...override, classKey } : { ...item, classKey };
        if (!cls.isOdwołane && !cls.isUsunięte && cls.start && cls.trainer) {
          todaysClasses.push(cls);
        }
      });

    if (todaysClasses.length === 0) return;

    const trainerClassesMap = new Map<string, any[]>();
    todaysClasses.forEach(cls => {
      const tName = (cls.trainer || '').trim();
      if (!tName) return;
      if (!trainerClassesMap.has(tName)) trainerClassesMap.set(tName, []);
      trainerClassesMap.get(tName)?.push(cls);
    });

    for (const [trainerName, trainerClassList] of trainerClassesMap.entries()) {
      const trainerObj = (trenerzyList || []).find((t: any) => 
        (t.imie_nazwisko || t.nazwa || '').trim().toLowerCase() === trainerName.toLowerCase() ||
        trainerName.toLowerCase().includes((t.imie_nazwisko || '').toLowerCase())
      );

      const trainerEmail = (trainerObj?.email || '').trim().toLowerCase();

      // Wykluczenie administratora z powiadomień
      if (!trainerEmail || trainerEmail === 'maciejklaput@gmail.com') {
        continue;
      }

      // Trener sprawdza i wysyła powiadomienia wyłącznie dla samego siebie
      if (currentRole === 'trener' && currentUserEmail && trainerEmail !== currentUserEmail.toLowerCase().trim()) {
        continue;
      }

      const trainerClientObj = (allClientsList || []).find((c: any) => 
        (c.email || c['E-mail'] || '').trim().toLowerCase() === trainerEmail
      );

      // A. POWIADOMIENIE DOKŁADNIE 5 MINUT PRZED KAŻDYM TRENINGIEM
      for (const cls of trainerClassList) {
        const [sh = '00', sm = '00'] = cls.start.split(':').map(Number);
        const classStartMinutes = sh * 60 + sm;
        const diffMinutes = classStartMinutes - currentTotalMinutes;

        // Okno czasowe: od 5 minut przed startem do momentu rozpoczęcia (0 min)
        if (diffMinutes <= 5 && diffMinutes >= 0) {
          const tag5min = `REMINDER_5MIN_${cls.classKey}_${todayIso}`;
          const storageKey = `fm_trainer_rem_5min_${cls.classKey}_${todayIso}`;

          if (typeof window !== 'undefined' && localStorage.getItem(storageKey)) {
            continue;
          }

          // Weryfikacja bazy danych zapobiegająca duplikacji
          const { data: existingLog } = await supabase
            .from('booking_logs')
            .select('id')
            .eq('action_type', 'TRAINER_REMINDER_5MIN')
            .eq('rule_applied', tag5min)
            .limit(1);

          if (!existingLog || existingLog.length === 0) {
            // Natychmiastowa rezerwacja w logach
            await supabase.from('booking_logs').insert([{
              action_type: 'TRAINER_REMINDER_5MIN',
              status: 'SUCCESS',
              reason: `Wysłano przypomnienie 5 min przed zajęciami do trenera ${trainerEmail}`,
              rule_applied: tag5min,
              payload: { class_key: cls.classKey, trainer_email: trainerEmail }
            }]);

            const messageContent = `Cześć ${trainerObj.imie_nazwisko || trainerName}! Za 5 minut rozpoczyna się Twój trening: ${cls.title} (${cls.start} - ${cls.end || ''}). Pamiętaj o sprawdzeniu listy obecności uczestników w aplikacji! [${tag5min}]`;

            await supabase.from('czat_wiadomosci').insert([{
              nadawca: 'Aplikacja FORMA MARZEŃ',
              nadawca_email: 'system@formamarzen.pl',
              nadawca_rola: 'system',
              odbiorca: trainerObj.imie_nazwisko || trainerName,
              odbiorca_email: trainerEmail,
              odbiorca_rola: 'trener',
              tresc: messageContent,
              created_at: new Date().toISOString()
            }]);

            if (typeof window !== 'undefined') {
              localStorage.setItem(storageKey, 'true');
            }

            if (trainerClientObj?.id) {
              try {
                await fetch('/api/push/send', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    clientIds: [trainerClientObj.id],
                    payload: {
                      title: `Sprawdź obecność: ${cls.title}`,
                      body: `Twój trening rozpoczyna się za 5 minut (${cls.start}). Pamiętaj o sprawdzeniu obecności!`,
                      url: '/',
                      typ: 'TRAINER_ATTENDANCE_REMINDER'
                    }
                  })
                });
              } catch (e) {}
            }
          }
        }
      }

      // B. POWIADOMIENIE PO ZAKOŃCZENIU OSTATNIEGO TRENINGU DNIA
      let latestEndMinutes = 0;
      trainerClassList.forEach(cls => {
        const [eh = '00', em = '00'] = (cls.end || cls.start).split(':').map(Number);
        const endMin = eh * 60 + em;
        if (endMin > latestEndMinutes) {
          latestEndMinutes = endMin;
        }
      });

      // Okno: od razu po zakończeniu ostatniego treningu (do 120 minut po)
      const minutesAfterLastClass = currentTotalMinutes - latestEndMinutes;
      if (minutesAfterLastClass >= 0 && minutesAfterLastClass <= 120) {
        const tagEndOfDay = `REMINDER_END_OF_DAY_${trainerEmail}_${todayIso}`;
        const storageKeyEnd = `fm_trainer_rem_end_${trainerEmail}_${todayIso}`;

        if (typeof window !== 'undefined' && localStorage.getItem(storageKeyEnd)) {
          continue;
        }

        const { data: existingEndLog } = await supabase
          .from('booking_logs')
          .select('id')
          .eq('action_type', 'TRAINER_REMINDER_END_OF_DAY')
          .eq('rule_applied', tagEndOfDay)
          .limit(1);

        if (!existingEndLog || existingEndLog.length === 0) {
          // Natychmiastowa rezerwacja w logach
          await supabase.from('booking_logs').insert([{
            action_type: 'TRAINER_REMINDER_END_OF_DAY',
            status: 'SUCCESS',
            reason: `Wysłano podsumowanie dnia do trenera ${trainerEmail}`,
            rule_applied: tagEndOfDay,
            payload: { trainer_email: trainerEmail, classes_count: trainerClassList.length }
          }]);

          const messageContent = `Cześć ${trainerObj.imie_nazwisko || trainerName}! Zakończyłeś już wszystkie swoje dzisiejsze treningi (${trainerClassList.length} ${trainerClassList.length === 1 ? 'trening' : 'treningi'}). Czy sprawdziłeś i oznaczyłeś wszystkie obecności na dzisiejszych zajęciach? Prosimy o weryfikację list w grafiku. Dziękujemy za wykonaną pracę! [${tagEndOfDay}]`;

          await supabase.from('czat_wiadomosci').insert([{
            nadawca: 'Aplikacja FORMA MARZEŃ',
            nadawca_email: 'system@formamarzen.pl',
            nadawca_rola: 'system',
            odbiorca: trainerObj.imie_nazwisko || trainerName,
            odbiorca_email: trainerEmail,
            odbiorca_rola: 'trener',
            tresc: messageContent,
            created_at: new Date().toISOString()
          }]);

          if (typeof window !== 'undefined') {
            localStorage.setItem(storageKeyEnd, 'true');
          }

          if (trainerClientObj?.id) {
            try {
              await fetch('/api/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  clientIds: [trainerClientObj.id],
                  payload: {
                    title: 'Weryfikacja obecności z dzisiejszego dnia',
                    body: `Zakończyłeś dzisiejsze treningi. Upewnij się, że uzupełniłeś obecności na wszystkich swoich zajęciach!`,
                    url: '/',
                    typ: 'TRAINER_DAY_COMPLETION'
                  }
                })
              });
            } catch (e) {}
          }
        }
      }
    }
  } catch (err) {
    console.error('Błąd w module przypomnień dla trenerów:', err);
  }
};

export default function DashboardPage() {
  const nowLocal = new Date();
  const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
  const todayDateOnly = todayStr;
  const currentTimeStr = `${String(nowLocal.getHours()).padStart(2, '0')}:${String(nowLocal.getMinutes()).padStart(2, '0')}`;
  
  // SYSTEM POWIADOMIEŃ TOAST
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ZABEZPIECZENIE PRZED WIELOKROTNYM SZYBKIM KLIKNIĘCIEM
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const isSubmittingRef = useRef(false);

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

      if (validIds.length === 0) return;

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

  // AUTOMATYCZNY AWANS Z LISTY REZERWOWEJ I WYSYŁKA PUSH
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

  // MODAL WYDARZEŃ
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
                const currentRemaining = parseInt(parsedKarnety[passIndex].pozostaloWejsc, 10) || 0;
                parsedKarnety[passIndex] = {
                  ...parsedKarnety[passIndex],
                  pozostaloWejsc: currentRemaining + 1,
                  zeroEntriesGraceUntil: null
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
                    const currentRemaining = parseInt(parsedKarnety[passIndex].pozostaloWejsc, 10) || 0;
                    parsedKarnety[passIndex] = {
                      ...parsedKarnety[passIndex],
                      pozostaloWejsc: currentRemaining + 1,
                      zeroEntriesGraceUntil: null
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
                const currentRemaining = parseInt(parsedKarnety[passIndex].pozostaloWejsc, 10) || 0;
                parsedKarnety[passIndex] = {
                  ...parsedKarnety[passIndex],
                  pozostaloWejsc: currentRemaining + 1,
                  zeroEntriesGraceUntil: null
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

  // NALICZANIE CIĄGŁOŚCI: WYKLUCZAMY KARNETY <= 150 ZŁ
  const calculateContinuityDiscount = (client: any, basePriceToCheck?: number) => {
    if (!client) return { hasContinuity: false, percent: 0, label: '0% (Brak)' };
    if (client.hasLostContinuity === true || client.hasLostContinuity === 'true') {
      return { hasContinuity: false, percent: 0, label: '0% (Ciągłość przerwana)' };
    }
    if (basePriceToCheck !== undefined && basePriceToCheck <= 150) {
      return { hasContinuity: false, percent: 0, label: '0% (Karnet ≤ 150 zł - brak rabatu ciągłości)' };
    }
    const karnety = client.karnetyKlubowicza || [];
    if (karnety.length === 0) return { hasContinuity: false, percent: 0, label: '0% (Pierwszy zakup)' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIsoDate = today.toISOString().split('T')[0];

    let isContinuous = false;
    for (const k of karnety) {
      const passPrice = parseFloat(String(k.cena || '0').replace(/[^0-9.-]/g, '')) || 0;
      if (passPrice <= 150) continue;

      if (k.waznyDo) {
        const expDate = new Date(k.waznyDo);
        expDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today.getTime() - expDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 1) {
          if (isQuantityPass(k) && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined && k.pozostaloWejsc <= 0) {
            if (k.zeroEntriesGraceUntil && todayIsoDate <= k.zeroEntriesGraceUntil) {
              isContinuous = true;
            } else if (diffDays <= 1) {
              isContinuous = true;
            }
          } else {
            isContinuous = true;
          }
        }
      }
    }

    if (!isContinuous) {
      return { hasContinuity: false, percent: 0, label: '0% (Brak ciągłości - zresetowano)' };
    }

    const validPassesForCount = karnety.filter((k: any) => {
      const price = parseFloat(String(k.cena || '0').replace(/[^0-9.-]/g, '')) || 0;
      return price > 150;
    });
    const liczbaKarnetow = validPassesForCount.length || 1;
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

  const getEffectiveDiscount = (client: any, isContract: boolean = false, basePriceToCheck?: number) => {
    if (!client) return { percent: 0, label: '', type: 'none' };
    if (basePriceToCheck !== undefined && basePriceToCheck <= 150) {
      return { percent: 0, label: '', type: 'none' };
    }
    const manualDiscountVal = client.discount ? parseFloat(String(client.discount).replace(/[^0-9.]/g, '')) : 0;
    if (manualDiscountVal > 0) {
      return { percent: manualDiscountVal, label: `(-${manualDiscountVal}% rabat ręczny)`, type: 'manual' };
    }
    if (isContract) return { percent: 0, label: '', type: 'none' };
    const continuityInfo = calculateContinuityDiscount(client, basePriceToCheck);
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

  const isFetchingRef = useRef(false);

  const checkContractPaymentEnforcement = async (allClients: any[]) => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const currentYear = today.getFullYear();
    const currentMonthNum = today.getMonth() + 1;
    const firstDayOfCurrentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}-01`;
    const endOfCurrentMonthStr = getContractEndOfMonthDate(todayStr);

    if (dayOfMonth < 4) return;

    for (const client of allClients) {
      const hasContract = client.karnetyKlubowicza && client.karnetyKlubowicza.some((k: any) => isContractPass(k));
      if (!hasContract) continue;

      const oplaconaDo = client.umowa_oplacona_do || client.umowaOplaconaDo;
      const czyOplaconyBiezacyMiesiac = oplaconaDo && String(oplaconaDo) >= firstDayOfCurrentMonthStr;

      if (!czyOplaconyBiezacyMiesiac) {
        const powod = "Nieopłacenie karnetu na umowę (brak wpłaty do 3. dnia miesiąca)";

        const juzMaBlokadeUmowy = client.blokadaDo && client.powodBlokady === powod;
        if (!juzMaBlokadeUmowy) {
          const updatedClientKarnety = (client.karnetyKlubowicza || []).map((k: any) => ({
            ...k,
            blokadaDo: isContractPass(k) ? endOfCurrentMonthStr : k.blokadaDo,
            powodBlokady: isContractPass(k) ? powod : k.powodBlokady
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

        if (dayOfMonth >= 7) {
          await handleAutoWypiszPoZablokowaniu(client.id, client, powod, undefined);
        }
      }
    }
  };

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
            dostep_do_zajec: k.dostep_do_zajec || 'wszystkich zajęć',
            isContract12M: k.typ_karnetu === 'Umowa 12 miesięcy' || meta.isContract12M === true
          };
        });
        setDostepneKarnety(ustrukturyzowaneKarnetyDef);
      }

      let matchedCurrentClient: any = null;
      if (klienciData) {
        const todayDateOnly = new Date().toISOString().split('T')[0];
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

        // Zmapowanie liczby i dat przyszłych rezerwacji dla każdego klienta w celu ochrony i auto-przedłużenia
        const nowBeginning = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
        const clientFutureBookingsMap = new Map<number, number>();
        const clientFutureDatesMap = new Map<number, string[]>();

        if (zapisyData && zapisyData.length > 0) {
          zapisyData.forEach((s: any) => {
            if (!s.klient_id) return;
            const classDate = parseDateFromClassKey(s.class_key);
            const classDateIso = `${classDate.getFullYear()}-${String(classDate.getMonth() + 1).padStart(2, '0')}-${String(classDate.getDate()).padStart(2, '0')}`;
            
            if (classDate >= nowBeginning) {
              const kId = Number(s.klient_id);
              const prevCount = clientFutureBookingsMap.get(kId) || 0;
              clientFutureBookingsMap.set(kId, prevCount + 1);

              const prevDates = clientFutureDatesMap.get(kId) || [];
              prevDates.push(classDateIso);
              clientFutureDatesMap.set(kId, prevDates);
            }
          });
        }

        const enriched = await Promise.all(klienciData.map(async (c: any) => {
          let parsedKarnety = [];
          if (Array.isArray(c.karnetyKlubowicza)) {
            parsedKarnety = c.karnetyKlubowicza;
          } else if (typeof c.karnetyKlubowicza === 'string') {
            try { parsedKarnety = JSON.parse(c.karnetyKlubowicza); } catch(e) {}
          }

          const futureDates = clientFutureDatesMap.get(Number(c.id)) || [];
          const hasFutureBookings = futureDates.length > 0;
          let karnetyZmienione = false;
          let walletChanged = false;

          let currentWalletNum = parseFloat(String(c.Portfel ?? c.portfel ?? c.wallet ?? '0').replace(/[^0-9.-]+/g, '')) || 0;
          let continuityBroken = c.hasLostContinuity === true || c.hasLostContinuity === 'true';

          let continuityNotice = c.continuityBreakNotice || c.continuity_break_notice || null;
          if (typeof continuityNotice === 'string') {
            try { continuityNotice = JSON.parse(continuityNotice); } catch(e) {}
          }
          if (continuityNotice?.expiresAt && continuityNotice.expiresAt < todayDateOnly) {
            continuityNotice = null;
          }

          // 1. ZEROWANIE WEJŚĆ PO TERMINIE I KOREKTA BUFORA
          parsedKarnety = parsedKarnety.map((k: any) => {
            const pasujacyDef = ustrukturyzowaneKarnetyDef.find(dk => (dk.nazwa || '').trim().toLowerCase() === (k.nazwa || '').trim().toLowerCase());
            const isContract = isContractPass(k) || (pasujacyDef && isContractPass(pasujacyDef));
            const isTime = isTimePass(k) || (pasujacyDef && isTimePass(pasujacyDef));
            const isQuantity = isQuantityPass(k) || (pasujacyDef && isQuantityPass(pasujacyDef));

            if (isContract) {
              k.isContract12M = true;
              k.pozostaloWejsc = null;
              k.poczatkoweWejsc = null;
            } else if (isTime) {
              k.pozostaloWejsc = null;
              k.poczatkoweWejsc = null;
            } else if (k.pozostaloWejsc === undefined || k.pozostaloWejsc === null) {
              if (pasujacyDef && pasujacyDef.ilosc_wejsc !== null) {
                const valWejsc = parseInt(pasujacyDef.ilosc_wejsc, 10);
                k.pozostaloWejsc = isNaN(valWejsc) ? null : valWejsc;
                k.poczatkoweWejsc = isNaN(valWejsc) ? null : valWejsc;
              }
            }

            // Zerowanie wejść w dniu po terminie wygaśnięcia
            const isExpiredDate = k.waznyDo && k.waznyDo < todayDateOnly;
            if (!isContract && isExpiredDate && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined && k.pozostaloWejsc > 0) {
              k.pozostaloWejsc = 0;
              k.statusTekst = 'Karnet wygasł (wejścia wyzerowane)';
              karnetyZmienione = true;
            }

            // OBSŁUGA WYKORZYSTANIA WSZYSTKICH WEJŚĆ
            if (isQuantity && k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined && k.pozostaloWejsc <= 0) {
              const passPriceNum = parseFloat(String(k.cena || '0').replace(/[^0-9.-]/g, '')) || 0;
              const isLowPrice = passPriceNum <= 150;

              if (isLowPrice) {
                const labelWejsc = (k.poczatkoweWejsc === 1 || (k.nazwa || '').toLowerCase().includes('1 wejście') || (k.nazwa || '').toLowerCase().includes('pojedyncz'))
                  ? 'Wykorzystano wejście'
                  : 'Wykorzystano wejścia';

                if (k.zeroEntriesGraceUntil !== null || k.statusTekst !== labelWejsc) {
                  karnetyZmienione = true;
                  k.zeroEntriesGraceUntil = null;
                  k.statusTekst = labelWejsc;
                }
              } else if (hasFutureBookings) {
                // Jeśli wejścia zostały zarezerwowane w grafiku na przyszłość, bufor 24h NIE MOŻE się włączyć!
                if (k.zeroEntriesGraceUntil !== null) {
                  k.zeroEntriesGraceUntil = null;
                  karnetyZmienione = true;
                }
                k.statusTekst = `Zarezerwowano wejścia (wygasa ${k.waznyDo})`;
              } else {
                // Bufor 24h włącza się tylko przy faktycznym braku wejść i braku przyszłych rezerwacji
                const tomorrowDate = new Date();
                tomorrowDate.setDate(tomorrowDate.getDate() + 1);
                const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

                if (!k.zeroEntriesGraceUntil) {
                  karnetyZmienione = true;
                  k.zeroEntriesGraceUntil = tomorrowStr;
                  if (!k.waznyDo || k.waznyDo < tomorrowStr) {
                    k.waznyDo = tomorrowStr;
                  }
                  k.statusTekst = `Wykorzystano wejścia (wygasa ${tomorrowStr} - bufor ciągłości)`;
                }
              }
            }

            k.dostepDo = k.dostepDo || k.dostep_do_zajec || pasujacyDef?.dostep_do_zajec || 'wszystkich zajęć';
            k.zaznaczoneZajecia = k.zaznaczoneZajecia || k.wybraneZajecia || pasujacyDef?.zaznaczoneZajecia || [];

            return k;
          });

          // 2. AUTOMATYCZNA ROTACJA LUB AUTO-PRZEDŁUŻENIE (TYLKO DLA KARNETÓW CZASOWYCH!)
          const waitingPassIndex = parsedKarnety.findIndex((k: any, idx: number) =>
            idx > 0 && (k.statusTekst?.includes('Oczekujący') || (k.waznyDo && k.waznyDo >= todayDateOnly))
          );

          let primaryPass = parsedKarnety[0];
          if (primaryPass && !isContractPass(primaryPass)) {
            const defPrimary = ustrukturyzowaneKarnetyDef.find(dk => (dk.nazwa || '').trim().toLowerCase() === (primaryPass.nazwa || '').trim().toLowerCase());
            const isTimeBased = defPrimary?.typ_karnetu === 'Na czas' || isTimePass(primaryPass);

            const isPrimaryFinished = (primaryPass.waznyDo && primaryPass.waznyDo < todayDateOnly) ||
                                       (isTimeBased && primaryPass.pozostaloWejsc !== null && primaryPass.pozostaloWejsc <= 0);

            // Rotacja na kolejny zakupiony karnet
            if (isPrimaryFinished && waitingPassIndex !== -1) {
              const nextPass = parsedKarnety[waitingPassIndex];
              const defNext = ustrukturyzowaneKarnetyDef.find(dk => (dk.nazwa || '').trim().toLowerCase() === (nextPass.nazwa || '').trim().toLowerCase());
              
              let dniWaznosciNext = 30;
              if (defNext && defNext.dlugosc) {
                const dlugoscStr = defNext.dlugosc.toLowerCase();
                if (dlugoscStr.includes('3 miesiące')) dniWaznosciNext = 90;
                else if (dlugoscStr.includes('6 miesięcy')) dniWaznosciNext = 180;
                else if (dlugoscStr.includes('1 rok')) dniWaznosciNext = 365;
                else if (dlugoscStr.includes('14 dni')) dniWaznosciNext = 14;
                else if (dlugoscStr.includes('7 dni')) dniWaznosciNext = 7;
              }
              const nextExpDate = new Date();
              nextExpDate.setDate(nextExpDate.getDate() + dniWaznosciNext);
              const nextNewExpiry = nextExpDate.toISOString().split('T')[0];

              parsedKarnety = parsedKarnety.filter((_: any, idx: number) => idx !== 0);
              parsedKarnety[waitingPassIndex - 1] = {
                ...nextPass,
                waznyDo: nextNewExpiry,
                statusTekst: `Ważny do: ${nextNewExpiry}`
              };
              karnetyZmienione = true;
              primaryPass = parsedKarnety[0];
            }
            // Auto-przedłużenie: WYŁĄCZNIE dla karnetów czasowych (OPEN)! Karnety ilościowe NIGDY nie są auto-przedłużane do debetu!
            else if (isPrimaryFinished && waitingPassIndex === -1 && isTimeBased) {
              const hasBookingsAfterExpiry = futureDates.some(bDate => bDate > (primaryPass.waznyDo || todayDateOnly));
              if (hasBookingsAfterExpiry) {
                const defKarnetu = ustrukturyzowaneKarnetyDef.find(dk => (dk.nazwa || '').trim().toLowerCase() === (primaryPass.nazwa || '').trim().toLowerCase());
                const basePrice = defKarnetu ? parseFloat(defKarnetu.cena) : (parseFloat(String(primaryPass.cena).replace(/[^0-9.-]/g, '')) || 0);

                const effDisc = getEffectiveDiscount(c, false, basePrice);
                const priceAfterDiscount = basePrice * (1 - effDisc.percent / 100);

                const extExpDate = new Date();
                extExpDate.setDate(extExpDate.getDate() + 30);
                const extendedExpiry = extExpDate.toISOString().split('T')[0];

                currentWalletNum -= priceAfterDiscount;
                walletChanged = true;
                continuityBroken = true;

                const noticeExpiry = new Date();
                noticeExpiry.setDate(noticeExpiry.getDate() + 21);

                continuityNotice = {
                  brokenAt: todayDateOnly,
                  expiresAt: noticeExpiry.toISOString().split('T')[0],
                  extendedPassName: primaryPass.nazwa,
                  reason: `Karnet ${primaryPass.nazwa} wygasł w dniu ${primaryPass.waznyDo}, lecz klubowicz posiadał aktywne zapisy w grafiku. Karnet został automatycznie przedłużony, naliczono zadłużenie w portfelu (${priceAfterDiscount.toFixed(2)} PLN), a ciągłość została przerwana.`
                };

                parsedKarnety[0] = {
                  ...primaryPass,
                  waznyDo: extendedExpiry,
                  pozostaloWejsc: null,
                  statusTekst: `Ważny do: ${extendedExpiry} (Auto-przedłużenie)`
                };
                karnetyZmienione = true;

                await supabase.from('transakcje').insert([{
                  klient_id: c.id,
                  typ_operacji: 'auto_przedluzenie_karnetu',
                  kwota: -priceAfterDiscount,
                  opis: `Automatyczne przedłużenie karnetu: ${primaryPass.nazwa} z powodu przyszłych rezerwacji w grafiku. Obciążono portfel kwotą ${priceAfterDiscount.toFixed(2)} PLN. Ciągłość przerwana.`
                }]);
              }
            }
          }

          parsedKarnety = parsedKarnety.filter((k: any) => {
            if (isContractPass(k)) return true;
            if (k.pozostaloWejsc !== null && k.pozostaloWejsc !== undefined && hasFutureBookings) {
              return true;
            }

            const passPriceNum = parseFloat(String(k.cena || '0').replace(/[^0-9.-]/g, '')) || 0;
            const isLowPriceExpired = k.pozostaloWejsc !== null && k.pozostaloWejsc <= 0 && passPriceNum <= 150 && k.waznyDo && k.waznyDo < todayDateOnly;
            const isZeroGraceExpired = k.pozostaloWejsc !== null && k.pozostaloWejsc <= 0 && k.zeroEntriesGraceUntil && k.zeroEntriesGraceUntil < todayDateOnly;

            if (isZeroGraceExpired || isLowPriceExpired) {
              karnetyZmienione = true;
              return false;
            }

            if (k.waznyDo && k.waznyDo < yesterdayStr && !k.isContract12M) {
              karnetyZmienione = true;
              return false;
            }
            return true;
          });

          if (karnetyZmienione || walletChanged) {
            const updatePayload: any = { 
              karnetyKlubowicza: parsedKarnety,
              hasLostContinuity: continuityBroken,
              continuityBreakNotice: continuityNotice
            };
            if (walletChanged) {
              updatePayload.Portfel = `${currentWalletNum.toFixed(2)} PLN`;
              updatePayload.portfel = currentWalletNum;
            }
            await supabase.from('klienci').update(updatePayload).eq('id', c.id);
          }

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
            wallet: `${currentWalletNum.toFixed(2)} PLN`,
            avatarUrl: c.avatarUrl || c.avatar || null,
            gender: c.płeć || c.gender || '',
            phone: c['Numer tel.'] || c.telefon || c.phone || '',
            email: c['E-mail'] || c.email || '',
            birthDate: c.Urodziny || c.birthDate || '',
            blokadaDo: c.blokadaDo || c.blokada_do || (parsedKarnety[0]?.blokadaDo) || null,
            powodBlokady: c.powodBlokady || c.powod_blokady || (parsedKarnety[0]?.powodBlokady) || null,
            umowa_oplacona_do: c.umowa_oplacona_do || null,
            hasLostContinuity: continuityBroken,
            continuityBreakNotice: continuityNotice,
            karnetyKlubowicza: parsedKarnety,
            walletHistory: c.walletHistory || [],
            transakcje: clientTransakcje,
            isTrainer: !!powiazanyTrener,
            zapisyNadchodzace: c.zapisyNadchodzace || [],
            zapisyPrzeszle: c.zapisyPrzeszle || [],
            zapisyWypisy: c.zapisyWypisy || []
          };
        }));

        setKlienciList(enriched);
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

      // CYKLICZNE SPRAWDZENIE I WYSYŁKA POWIADOMIEŃ DO TRENERÓW (ŚCIŚLE 1X PRZED I 1X PO OSTATNIM TRENINGU DNIA)
      await checkAndSendTrainerReminders(
        mappedSzablony,
        mappedJednorazowe,
        nadpisaniaMap,
        trenerzyData || [],
        klienciData || [],
        determinedRole,
        userEmail
      );

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

    // Wykluczenie tabeli czat_wiadomosci zapobiega nieskończonej pętli i wielokrotnym powiadomieniom
    const channel = supabase
      .channel('realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zapisy_zajec' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automatyczne_zapisy' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'klienci' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nadpisania_zajec' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wydarzenia_kilkudniowe' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'indywidualne_limity_zapisow' }, () => loadData())
      .subscribe();

    const reminderInterval = setInterval(() => {
      loadData();
    }, 60000);

    window.addEventListener('storage', loadData);
    return () => {
      clearInterval(reminderInterval);
      supabase.removeChannel(channel);
      window.removeEventListener('storage', loadData);
    };
  }, [selectedWeekDate]);
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
                const currentRemaining = parseInt(parsedKarnety[passIndex].pozostaloWejsc, 10) || 0;
                parsedKarnety[passIndex] = {
                  ...parsedKarnety[passIndex],
                  pozostaloWejsc: currentRemaining + 1,
                  zeroEntriesGraceUntil: null
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
            const currentRemaining = parseInt(parsedKarnety[passIndex].pozostaloWejsc, 10) || 0;
            parsedKarnety[passIndex] = {
              ...parsedKarnety[passIndex],
              pozostaloWejsc: currentRemaining + 1,
              zeroEntriesGraceUntil: null
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
            const currentRemaining = parseInt(parsedKarnety[passIndex].pozostaloWejsc, 10) || 0;
            parsedKarnety[passIndex] = {
              ...parsedKarnety[passIndex],
              pozostaloWejsc: currentRemaining + 1,
              zeroEntriesGraceUntil: null
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
        updatedKarnety[passIndex] = {
          ...updatedKarnety[passIndex],
          pozostaloWejsc: currentRemaining + cancelledCount,
          zeroEntriesGraceUntil: null
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
          updatedKarnety[passIndex] = {
            ...updatedKarnety[passIndex],
            pozostaloWejsc: currentRemaining + cancelledCount,
            zeroEntriesGraceUntil: null
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
    
    const defKarnetu = dostepneKarnety.find(k => k.nazwa === extendSelectedNewPassName);
    const isContract = isContractPass(extendPassTarget) || isContractPass(defKarnetu);
    const targetDateStr = isContract ? getContractEndOfMonthDate(extendPassTarget.waznyDo) : extendNewDate;

    if (!confirm(`Czy na pewno chcesz przedłużyć ten karnet do dnia ${targetDateStr}?`)) return;
    
    let bazowaCenaNum = defKarnetu ? parseFloat(defKarnetu.cena) : parseFloat(extendPassTarget.cena.replace(/[^0-9.]/g, '')) || 0;
    const allowedClasses = defKarnetu?.zaznaczoneZajecia || [];
    const dostepDo = defKarnetu?.dostep_do_zajec || 'wszystkich zajęć';
    
    // WYKLUCZENIE Z CIĄGŁOŚCI DLA <= 150 ZŁ
    const effectiveDiscount = getEffectiveDiscount(profileClient, isContract, bazowaCenaNum);
    const finalPriceNum = (effectiveDiscount.percent > 0 && !isContract && bazowaCenaNum > 150)
      ? bazowaCenaNum * (1 - effectiveDiscount.percent / 100) 
      : bazowaCenaNum;
    const nowaCena = `${finalPriceNum.toFixed(2)} PLN`;

    let updatedRata = extendPassTarget.rata;
    if (isContract) {
      const currentRataMatch = (extendPassTarget.rata || '0 / 12').match(/(\d+)\s*\/\s*(\d+)/);
      const currentRataNum = currentRataMatch ? parseInt(currentRataMatch[1], 10) : 0;
      const totalRat = currentRataMatch ? parseInt(currentRataMatch[2], 10) : 12;
      updatedRata = `${Math.min(totalRat, currentRataNum + 1)} / ${totalRat}`;
    }

    const uaktualnioneKarnety = (profileClient.karnetyKlubowicza || []).map((k: any) => {
      if (k.id === extendPassTarget.id) {
        return { 
          ...k, 
          nazwa: extendSelectedNewPassName || k.nazwa, 
          waznyDo: targetDateStr, 
          cena: nowaCena, 
          rata: isContract ? updatedRata : k.rata,
          zaznaczoneZajecia: extendSelectedNewPassName ? allowedClasses : k.zaznaczoneZajecia,
          dostepDo: extendSelectedNewPassName ? dostepDo : k.dostepDo,
          znizkaProcentowa: (isContract || bazowaCenaNum <= 150) ? '' : effectiveDiscount.label,
          statusTekst: isContract ? `Umowa 12M (Rata ${updatedRata || '0/12'} • Ważny do: ${targetDateStr})` : `Ważny do: ${targetDateStr}`,
          zeroEntriesGraceUntil: null,
          blokadaDo: isContract ? null : k.blokadaDo,
          powodBlokady: isContract ? null : k.powodBlokady
        };
      }
      return k;
    });

    const updatedClient = { 
      ...profileClient, 
      karnetyKlubowicza: uaktualnioneKarnety, 
      pass: uaktualnioneKarnety.map((k: any) => k.nazwa).join(', '), 
      price: nowaCena, 
      expiresDate: targetDateStr,
      ...(isContract ? { umowa_oplacona_do: targetDateStr, blokadaDo: null, powodBlokady: null } : {})
    };

    const dbPayload: any = { karnetyKlubowicza: uaktualnioneKarnety, expiresDate: targetDateStr };
    if (isContract) {
      dbPayload.umowa_oplacona_do = targetDateStr;
      dbPayload.blokadaDo = null;
      dbPayload.powodBlokady = null;
    }
    if (profileClient.Cena !== undefined) dbPayload.Cena = nowaCena;
    else if (profileClient.cena !== undefined) dbPayload.cena = nowaCena;

    const success = await updateSupabaseClient(updatedClient, dbPayload);
    if (success) { 
      showToast(`Karnet przedłużony do ${targetDateStr}! Cena: ${nowaCena}`); 
      setIsExtendPassModalOpen(false); 
    }
  };

  const handleBuyPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedBuyPass) return;
    if (!confirm(`Czy na pewno chcesz kupić karnet: ${selectedBuyPass}?`)) return;
    
    const defKarnetu = dostepneKarnety.find(k => k.nazwa === selectedBuyPass);
    const isContract = isContractPass(defKarnetu) || isContractPass({ nazwa: selectedBuyPass });

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
    
    // WYKLUCZENIE Z CIĄGŁOŚCI DLA <= 150 ZŁ
    const effectiveDiscount = getEffectiveDiscount(currentUser, isContract, basePriceNum);
    const cenaWartosc = (effectiveDiscount.percent > 0 && !isContract && basePriceNum > 150)
      ? basePriceNum * (1 - effectiveDiscount.percent / 100) 
      : basePriceNum;
    const cenaStr = `${cenaWartosc.toFixed(2)} PLN`;

    const allowedClasses = defKarnetu?.zaznaczoneZajecia || [];
    const dostepDo = defKarnetu?.dostep_do_zajec || 'wszystkich zajęć';
    
    const isTimePassBuy = isTimePass(defKarnetu) || isTimePass({ nazwa: selectedBuyPass });
    const isQuantityPassBuy = isQuantityPass(defKarnetu) || isQuantityPass({ nazwa: selectedBuyPass });
    const limitWejscBaza = (!isTimePassBuy && defKarnetu) ? (defKarnetu.ilosc_wejsc || null) : null;
    const parsedLimitWejsc = limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : 10;

    let updatedKarnety = [];
    let nowaDataWygasnieciaStr = '';

    if (isContract) {
      nowaDataWygasnieciaStr = getContractEndOfMonthDate(todayStr);
      const nowyKarnetObj = {
        id: Date.now(), 
        nazwa: selectedBuyPass, 
        waznyDo: nowaDataWygasnieciaStr, 
        pozostaloWejsc: null,
        poczatkoweWejsc: null,
  