"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ADMIN_EMAILS = ["maciejklaput@gmail.com", "maciejklaput@icloud.com"];
const SYSTEM_ID = 5000;

// DEFINICJA 21 DOSTĘPNYCH REGUŁ AUTOMATYZACJI
export const REGUŁY_KATALOG = [
  // 1. Treningi i frekwencja
  { id: "TRENINGI_OGOLNE", nazwa: "Dowolny trening (obecność)", kategoria: "Treningi", ikona: "🏋️", opis: "Łączna liczba treningów z potwierdzoną obecnością", domyslnyProg: 10 },
  { id: "TRENINGI_HYROX", nazwa: "Trening HYROX", kategoria: "Treningi", ikona: "⚡", opis: "Obecność na sesjach HYROX", domyslnyProg: 5, parametr: "hyrox" },
  { id: "TRENINGI_OGOLNOROZWOJOWE", nazwa: "Ogólnorozwojowe", kategoria: "Treningi", ikona: "🤸", opis: "Obecność na zajęciach ogólnorozwojowych", domyslnyProg: 5, parametr: "ogólnorozwojowe" },
  { id: "TRENINGI_NOGI_POSLADKI", nazwa: "Nogi i pośladki", kategoria: "Treningi", ikona: "🦵", opis: "Obecność na treningu Nogi i pośladki", domyslnyProg: 5, parametr: "nogi i pośladki" },
  { id: "TRENINGI_BRZUCH", nazwa: "Brzuch", kategoria: "Treningi", ikona: "🍫", opis: "Obecność na treningu brzucha", domyslnyProg: 5, parametr: "brzuch" },
  { id: "TRENINGI_HIIT_TABATA", nazwa: "HIIT / TABATA", kategoria: "Treningi", ikona: "🔥", opis: "Obecność na sesjach HIIT i TABATA", domyslnyProg: 5, parametr: "hiit" },
  { id: "TRENINGI_SILOWE", nazwa: "Trening siłowy", kategoria: "Treningi", ikona: "💪", opis: "Obecność na treningach siłowych", domyslnyProg: 5, parametr: "siłow" },
  { id: "TRENINGI_ROZCIAGANIE", nazwa: "Rozciąganie i mobilizacja", kategoria: "Treningi", ikona: "🧘", opis: "Obecność na mobilizacji i rozciąganiu", domyslnyProg: 5, parametr: "rozciąganie" },
  
  // 2. Częstotliwość i Czas
  { id: "TRENINGI_DZIEN", nazwa: "Treningi w 1 dniu", kategoria: "Częstotliwość", ikona: "⏱️", opis: "Potwierdzona obecność na min. X sesjach jednego dnia", domyslnyProg: 2 },
  { id: "TRENINGI_TYDZIEN", nazwa: "Treningi w 1 tygodniu", kategoria: "Częstotliwość", ikona: "📅", opis: "Liczba potwierdzonych treningów od poniedziałku do niedzieli", domyslnyProg: 4 },
  { id: "TRENINGI_MIESIAC", nazwa: "Treningi w 1 miesiącu", kategoria: "Częstotliwość", ikona: "🗓️", opis: "Liczba potwierdzonych treningów w miesiącu kalendarzowym", domyslnyProg: 16 },
  { id: "TRENINGI_ROK", nazwa: "Treningi w 1 roku", kategoria: "Częstotliwość", ikona: "🌍", opis: "Liczba potwierdzonych treningów w roku", domyslnyProg: 100 },
  { id: "STAZ_DNI", nazwa: "Staż w klubie (Dni)", kategoria: "Częstotliwość", ikona: "⏳", opis: "Dni od momentu założenia konta klubowicza", domyslnyProg: 90 },

  // 3. Pojedynki i Dieta
  { id: "POJEDYNKI_UDZIAL", nazwa: "Udział w pojedynkach", kategoria: "Rywalizacja", ikona: "⚔️", opis: "Liczba stoczonych pojedynków Head-to-Head", domyslnyProg: 5 },
  { id: "POJEDYNKI_WYGRANE", nazwa: "Wygrane pojedynki", kategoria: "Rywalizacja", ikona: "🥇", opis: "Liczba wygranych pojedynków sportowych", domyslnyProg: 3 },
  { id: "POJEDYNKI_SERIA", nazwa: "Wygrane pojedynki z rzędu", kategoria: "Rywalizacja", ikona: "🔥", opis: "Seria kolejnych zwycięstw w pojedynkach sportowych", domyslnyProg: 3 },
  { id: "ZYWIENIE_UDZIAL", nazwa: "Udział w wyzwaniach żywieniowych", kategoria: "Rywalizacja", ikona: "🥗", opis: "Ukończone wyzwania w kategorii żywieniowej", domyslnyProg: 3 },
  { id: "ZYWIENIE_WYGRANE", nazwa: "Wygrane wyzwania żywieniowe", kategoria: "Rywalizacja", ikona: "🥑", opis: "Zwycięstwa w wyzwaniach żywieniowych", domyslnyProg: 2 },
  { id: "ZYWIENIE_SERIA", nazwa: "Wygrane wyzwania żywieniowe z rzędu", kategoria: "Rywalizacja", ikona: "🎯", opis: "Seria kolejnych wygranych wyzwań żywieniowych", domyslnyProg: 3 },

  // 4. Klub i Społeczność
  { id: "REJESTRACJA", nazwa: "Rejestracja w aplikacji", kategoria: "Klub", ikona: "🚀", opis: "Odznaka powitalna za dołączenie do klubu", domyslnyProg: 1 },
  { id: "REDUKCJA_WYGRANA", nazwa: "Wygrana w wyzwaniu redukcji", kategoria: "Klub", ikona: "🏆", opis: "1. miejsce w oficjalnym klubowym wyzwaniu redukcyjnym", domyslnyProg: 1 },
  { id: "RECZNA", nazwa: "Tylko ręczne przyznanie", kategoria: "Klub", ikona: "✋", opis: "Odznaka specjalna nadawana wyłącznie przez Trenera/Admina", domyslnyProg: 1 },
];

// OMIJANIE LIMITU 1000 REKORDÓW W SUPABASE BEZ RYZYKA BŁĘDU SKŁADNIOWEGO
const fetchAllFromSupabase = async (
  table: string, 
  selectQuery: string = '*', 
  orderBy: string = 'id', 
  ascending: boolean = false, 
  maxPages: number = 10
) => {
  let result: any[] = [];
  for (let i = 0; i < maxPages; i++) {
    let query = supabase
      .from(table)
      .select(selectQuery)
      .range(i * 1000, (i + 1) * 1000 - 1);
    
    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }

    const { data, error } = await query;
    
    if (error) {
      console.error(`Błąd pobierania tabeli ${table}:`, error);
      if (orderBy && error.message?.includes('does not exist')) {
        const fallbackRes = await supabase
          .from(table)
          .select(selectQuery)
          .range(i * 1000, (i + 1) * 1000 - 1);
        if (fallbackRes.data && fallbackRes.data.length > 0) {
          result.push(...fallbackRes.data);
          if (fallbackRes.data.length < 1000) break;
          continue;
        }
      }
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

export default function WyzwaniaPage() {
  const [currentUserId, setCurrentUserId] = useState<number | string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'klubowicz'>('klubowicz');

  const [klienci, setKlienci] = useState<any[]>([]);
  const [wyzwania, setWyzwania] = useState<any[]>([]);
  const [odznaki, setOdznaki] = useState<any[]>([]);
  const [odznakiHistoria, setOdznakiHistoria] = useState<any[]>([]);
  const [wszystkieOdznaki, setWszystkieOdznaki] = useState<any[]>([]);
  const [wszystkiePrzydzieloneOdznaki, setWszystkiePrzydzieloneOdznaki] = useState<any[]>([]);
  const [dyscyplinyList, setDyscyplinyList] = useState<any[]>([]);
  const [rankingList, setRankingList] = useState<any[]>([]);
  const [badgeRankingList, setBadgeRankingList] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState(false);
  const [challengeToResolve, setChallengeToResolve] = useState<any | null>(null);
  const [selectedWinnerId, setSelectedWinnerId] = useState<any | null>(null);
  const [selectedMemberForComparison, setSelectedMemberForComparison] = useState<any | null>(null);
  const [selectedBadgeForZoom, setSelectedBadgeForZoom] = useState<any | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOpponent, setSelectedOpponent] = useState<any | null>(null);
  const [dyscyplina, setDyscyplina] = useState("");
  const [opisWyzwania, setOpisWyzwania] = useState("");
  const [modalKategoria, setModalKategoria] = useState<'sport' | 'zywienie'>('sport');
  const [newDyscyplina, setNewDyscyplina] = useState("");

  const [badgeMemberSearchQuery, setBadgeMemberSearchQuery] = useState("");

  // Stany formularza tworzenia nowej odznaki (Admin)
  const [newBadgeNazwa, setNewBadgeNazwa] = useState("");
  const [newBadgeOpis, setNewBadgeOpis] = useState("");
  const [newBadgeWarunek, setNewBadgeWarunek] = useState("");
  const [newBadgeIkona, setNewBadgeIkona] = useState("");
  const [newBadgePunkty, setNewBadgePunkty] = useState("1");
  const [newBadgeKategoria, setNewBadgeKategoria] = useState("Treningi");
  const [newBadgeTypReguly, setNewBadgeTypReguly] = useState("TRENINGI_OGOLNE");
  const [newBadgeWartoscProgowa, setNewBadgeWartoscProgowa] = useState("10");
  const [newBadgeParametrDodatkowy, setNewBadgeParametrDodatkowy] = useState("");
  const [isUploadingNewBadge, setIsUploadingNewBadge] = useState(false);
  const [selectedRuleCategoryFilter, setSelectedRuleCategoryFilter] = useState("Wszystkie");
  const [isGlobalRecalculating, setIsGlobalRecalculating] = useState(false);

  // Stany edycji odznak (Admin)
  const [editingBadgeId, setEditingBadgeId] = useState<number | null>(null);
  const [editBadgeNazwa, setEditBadgeNazwa] = useState("");
  const [editBadgeOpis, setEditBadgeOpis] = useState("");
  const [editBadgeWarunek, setEditBadgeWarunek] = useState("");
  const [editBadgeIkona, setEditBadgeIkona] = useState("");
  const [editBadgePunkty, setEditBadgePunkty] = useState("1");
  const [editBadgeKategoria, setEditBadgeKategoria] = useState("Treningi");
  const [editBadgeTypReguly, setEditBadgeTypReguly] = useState("TRENINGI_OGOLNE");
  const [editBadgeWartoscProgowa, setEditBadgeWartoscProgowa] = useState("10");
  const [editBadgeParametrDodatkowy, setEditBadgeParametrDodatkowy] = useState("");
  const [isUploadingEditBadge, setIsUploadingEditBadge] = useState(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const [activeTab, setActiveTab] = useState<'aktywne' | 'zywienie' | 'odznaki' | 'ranking' | 'admin'>('aktywne');
  const [adminSubTab, setAdminSubTab] = useState<'wyzwania' | 'odznaki' | 'katalog_odznak' | 'dyscypliny'>('wyzwania');
  const [isLoading, setIsLoading] = useState(true);

  const sendPushNotification = async (clientIds: number | string | (number | string)[], payload: { title: string; body: string; url?: string }) => {
    try {
      const rawIds = Array.isArray(clientIds) ? clientIds : [clientIds];
      const validIds = rawIds.filter(id => Number(id) !== SYSTEM_ID && Number(id) !== 999999999);
      if (validIds.length === 0) return;

      const { data: clientsList } = await supabase
        .from("klienci")
        .select("id, push_subscription")
        .in("id", validIds);

      if (!clientsList || clientsList.length === 0) return;

      const subscriptions = clientsList
        .map((c: any) => {
          if (!c.push_subscription) return null;
          try {
            return typeof c.push_subscription === "string" ? JSON.parse(c.push_subscription) : c.push_subscription;
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      if (subscriptions.length === 0) return;

      await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptions,
          payload: {
            title: payload.title || "FORMA MARZEŃ",
            body: payload.body || "",
            url: payload.url || "/wyzwania"
          }
        })
      });
    } catch (err) {
      console.error("Błąd podczas wysyłania powiadomienia Push:", err);
    }
  };

  // SILNIK AUTOMATYCZNEJ WERYFIKACJI I NADAWANIA 21 REGUŁ ODZNAK
  const checkAndAwardAutomatedBadges = async (userId: number | string, allBadgeDefs: any[]) => {
    if (!userId || Number(userId) === SYSTEM_ID || !allBadgeDefs || allBadgeDefs.length === 0) return;

    try {
      const { data: userExistingBadges } = await supabase
        .from("klub_odznaki_klubowicze")
        .select("odznaka_id")
        .eq("klient_id", userId);

      const ownedBadgeIds = new Set((userExistingBadges || []).map((b: any) => Number(b.odznaka_id)));

      const badgesToEvaluate = allBadgeDefs.filter((def: any) => 
        def.typ_reguly && def.typ_reguly !== 'RECZNA' && !ownedBadgeIds.has(Number(def.id))
      );

      if (badgesToEvaluate.length === 0) return;

      const { data: attendancesRaw } = await supabase
        .from("zapisy_zajec")
        .select("id, class_key, obecny, created_at")
        .eq("klient_id", userId)
        .eq("obecny", true);

      const attendances = attendancesRaw || [];

      const [grafikList, jednorazoweList, nadpisaniaList] = await Promise.all([
        fetchAllFromSupabase('grafik_zajec', 'id, title, nazwa', 'id', true, 5),
        fetchAllFromSupabase('zajecia_jednorazowe', 'id, title, nazwa, display_date', 'id', false, 5),
        fetchAllFromSupabase('nadpisania_zajec', 'class_key, title, nazwa', 'id', false, 5),
      ]);

      const classNamesById = new Map<string, string>();
      grafikList.forEach((g: any) => classNamesById.set(String(g.id), (g.title || g.nazwa || '').toLowerCase()));
      jednorazoweList.forEach((j: any) => classNamesById.set(String(j.id), (j.title || j.nazwa || '').toLowerCase()));
      const nadpisaniaMap = new Map<string, string>();
      nadpisaniaList.forEach((n: any) => nadpisaniaMap.set(n.class_key, (n.title || n.nazwa || '').toLowerCase()));

      const userConfirmedClassTitles: { title: string; date: Date; dateStr: string }[] = attendances.map((att: any) => {
        const cKey = String(att.class_key || '');
        const parts = cKey.split('_');
        const cId = parts[0];
        const dPart = parts[1] || '';
        
        let title = nadpisaniaMap.get(cKey) || classNamesById.get(cId) || '';
        
        let dateObj = new Date();
        if (dPart.includes('-')) {
          dateObj = new Date(dPart);
        } else if (dPart.includes('/')) {
          const [d, m] = dPart.split('/').map(Number);
          dateObj = new Date(new Date().getFullYear(), m - 1, d);
        } else if (att.created_at) {
          dateObj = new Date(att.created_at);
        }

        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
        return { title, date: dateObj, dateStr };
      });

      const { data: userChallengesRaw } = await supabase
        .from("klub_wyzwania")
        .select("id, tworca_id, przeciwnik_id, zwyciezca_id, status, kategoria_wyzwania, created_at")
        .or(`tworca_id.eq.${userId},przeciwnik_id.eq.${userId}`);

      const userChallenges = userChallengesRaw || [];
      const verifiedChallenges = userChallenges.filter((c: any) => c.status === 'zweryfikowane');

      const { data: clientInfo } = await supabase
        .from("klienci")
        .select("*")
        .eq("id", userId)
        .single();

      const regDateRaw = clientInfo?.Zarejestrowany || clientInfo?.registered || clientInfo?.created_at || new Date().toISOString();
      const regDate = new Date(regDateRaw);
      const today = new Date();
      const tenureDays = Math.max(0, Math.floor((today.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24)));

      const { data: reductionWinsRaw } = await supabase
        .from("klub_redukcja_uczestnicy")
        .select("id, status_koncowy, miejsce")
        .eq("klient_id", userId)
        .or("miejsce.eq.1,status_koncowy.ilike.%zwycięzca%,status_koncowy.ilike.%wygrana%");
      
      const reductionWinsCount = (reductionWinsRaw || []).length;

      const metricValues: Record<string, number> = {};

      metricValues["TRENINGI_OGOLNE"] = userConfirmedClassTitles.length;
      metricValues["TRENINGI_HYROX"] = userConfirmedClassTitles.filter(c => c.title.includes("hyrox")).length;
      metricValues["TRENINGI_OGOLNOROZWOJOWE"] = userConfirmedClassTitles.filter(c => c.title.includes("ogólnorozwoj")).length;
      metricValues["TRENINGI_NOGI_POSLADKI"] = userConfirmedClassTitles.filter(c => c.title.includes("nogi") || c.title.includes("pośladk")).length;
      metricValues["TRENINGI_BRZUCH"] = userConfirmedClassTitles.filter(c => c.title.includes("brzuch")).length;
      metricValues["TRENINGI_HIIT_TABATA"] = userConfirmedClassTitles.filter(c => c.title.includes("hiit") || c.title.includes("tabata")).length;
      metricValues["TRENINGI_SILOWE"] = userConfirmedClassTitles.filter(c => c.title.includes("siłow")).length;
      metricValues["TRENINGI_ROZCIAGANIE"] = userConfirmedClassTitles.filter(c => c.title.includes("rozciąg") || c.title.includes("mobilizacj")).length;

      const sportChallenges = verifiedChallenges.filter((c: any) => (c.kategoria_wyzwania || 'sport') === 'sport');
      metricValues["POJEDYNKI_UDZIAL"] = sportChallenges.length;
      metricValues["POJEDYNKI_WYGRANE"] = sportChallenges.filter((c: any) => String(c.zwyciezca_id) === String(userId)).length;

      metricValues["REJESTRACJA"] = 1;

      const nutritionChallenges = verifiedChallenges.filter((c: any) => c.kategoria_wyzwania === 'zywienie');
      metricValues["ZYWIENIE_UDZIAL"] = nutritionChallenges.length;
      metricValues["ZYWIENIE_WYGRANE"] = nutritionChallenges.filter((c: any) => String(c.zwyciezca_id) === String(userId)).length;

      const weekCounts: Record<string, number> = {};
      userConfirmedClassTitles.forEach(c => {
        const d = new Date(c.date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const key = `${monday.getFullYear()}-W${Math.ceil(monday.getDate() / 7)}`;
        weekCounts[key] = (weekCounts[key] || 0) + 1;
      });
      metricValues["TRENINGI_TYDZIEN"] = Object.values(weekCounts).length > 0 ? Math.max(...Object.values(weekCounts)) : 0;

      const monthCounts: Record<string, number> = {};
      userConfirmedClassTitles.forEach(c => {
        const key = c.dateStr.substring(0, 7);
        monthCounts[key] = (monthCounts[key] || 0) + 1;
      });
      metricValues["TRENINGI_MIESIAC"] = Object.values(monthCounts).length > 0 ? Math.max(...Object.values(monthCounts)) : 0;

      const yearCounts: Record<string, number> = {};
      userConfirmedClassTitles.forEach(c => {
        const key = c.dateStr.substring(0, 4);
        yearCounts[key] = (yearCounts[key] || 0) + 1;
      });
      metricValues["TRENINGI_ROK"] = Object.values(yearCounts).length > 0 ? Math.max(...Object.values(yearCounts)) : 0;

      const dayCounts: Record<string, number> = {};
      userConfirmedClassTitles.forEach(c => {
        dayCounts[c.dateStr] = (dayCounts[c.dateStr] || 0) + 1;
      });
      metricValues["TRENINGI_DZIEN"] = Object.values(dayCounts).length > 0 ? Math.max(...Object.values(dayCounts)) : 0;

      let maxSportStreak = 0;
      let currentSportStreak = 0;
      sportChallenges.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      sportChallenges.forEach((c: any) => {
        if (String(c.zwyciezca_id) === String(userId)) {
          currentSportStreak++;
          if (currentSportStreak > maxSportStreak) maxSportStreak = currentSportStreak;
        } else {
          currentSportStreak = 0;
        }
      });
      metricValues["POJEDYNKI_SERIA"] = maxSportStreak;

      let maxNutrStreak = 0;
      let currentNutrStreak = 0;
      nutritionChallenges.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      nutritionChallenges.forEach((c: any) => {
        if (String(c.zwyciezca_id) === String(userId)) {
          currentNutrStreak++;
          if (currentNutrStreak > maxNutrStreak) maxNutrStreak = currentNutrStreak;
        } else {
          currentNutrStreak = 0;
        }
      });
      metricValues["ZYWIENIE_SERIA"] = maxNutrStreak;

      metricValues["STAZ_DNI"] = tenureDays;
      metricValues["REDUKCJA_WYGRANA"] = reductionWinsCount;

      for (const badgeDef of badgesToEvaluate) {
        const ruleType = badgeDef.typ_reguly;
        const threshold = Number(badgeDef.wartosc_progowa) || 1;
        const currentMetric = metricValues[ruleType] ?? 0;

        if (currentMetric >= threshold) {
          const { error: assignErr } = await supabase.from("klub_odznaki_klubowicze").insert([{
            klient_id: userId,
            odznaka_id: badgeDef.id
          }]);

          if (!assignErr) {
            ownedBadgeIds.add(Number(badgeDef.id));
            const badgePoints = badgeDef.punkty ? ` (${badgeDef.punkty} pkt)` : "";
            
            await supabase.from("czat_wiadomosci").insert([{
              nadawca_id: SYSTEM_ID,
              nadawca_nazwa: "Forma Marzeń",
              nadawca_avatar: null,
              odbiorca_id: userId,
              tresc: `🏆 Gratulacje! Twoja aktywność została nagrodzona nową odznaką: "${badgeDef.nazwa}"${badgePoints}! Sprawdź Gablotę Odznak.`,
              przeczytana: false
            }]);

            await sendPushNotification(userId, {
              title: "🏆 Zdobyto nową odznakę klubową!",
              body: `Brawo! Spełniłeś warunek i odblokowałeś odznakę "${badgeDef.nazwa}"!`,
              url: "/wyzwania"
            });
          }
        }
      }

      await fetchOdznaki(userId);
      const updated = await fetchWszystkiePrzydzieloneOdznakiDirect();
      await fetchRankings(klienci, updated);
    } catch (error) {
      console.error("Błąd podczas ewaluacji odznak automatycznych:", error);
    }
  };

  // GLOBALNE PRZELICZANIE ODZNAK DLA WSZYSTKICH KLUBOWICZÓW (ADMIN)
  const handleRunGlobalBadgeRecalculation = async () => {
    if (!confirm("Czy na pewno chcesz uruchomić przeliczanie odznak dla wszystkich klubowiczów w bazie? Może to chwilę potrwać.")) return;
    setIsGlobalRecalculating(true);
    try {
      const allDefs = await fetchAllOdznakiDef();
      const { data: allClients } = await supabase.from('klienci').select('id');
      if (allClients && allDefs) {
        let count = 0;
        for (const client of allClients) {
          if (Number(client.id) === SYSTEM_ID) continue;
          await checkAndAwardAutomatedBadges(client.id, allDefs);
          count++;
        }
        alert(`Pomyślnie przeliczono odznaki dla ${count} klubowiczów!`);
        const updatedBadges = await fetchWszystkiePrzydzieloneOdznakiDirect();
        await fetchRankings(klienci, updatedBadges);
      }
    } catch (err) {
      console.error("Błąd masowego przeliczania odznak:", err);
      alert("Wystąpił błąd podczas masowego przeliczania odznak.");
    } finally {
      setIsGlobalRecalculating(false);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        const [sessionRes, klienciData] = await Promise.all([
          supabase.auth.getSession(),
          fetchAllFromSupabase('klienci', '*', 'id', true, 20)
        ]);

        let userEmail = (sessionRes.data.session?.user?.email || "").toLowerCase().trim();
        if (!userEmail && typeof window !== "undefined") {
          const localUser = localStorage.getItem("currentUser") || localStorage.getItem("user");
          if (localUser) {
            try {
              const parsed = JSON.parse(localUser);
              userEmail = (parsed.email || parsed["E-mail"] || "").toLowerCase().trim();
            } catch(e) {}
          }
        }

        // Pomiń konto systemowe Forma Marzeń (ID 5000) z listy zwykłych klubowiczów
        const enriched = (klienciData || [])
          .filter((c: any) => c && c.id && Number(c.id) !== SYSTEM_ID)
          .map((c: any) => {
            const fName = c.Imię || c.imie || c.firstName || "";
            const lName = c.Nazwisko || c.nazwisko || c.lastName || "";
            const fullName = [fName, lName].filter(Boolean).join(" ").trim() || c["E-mail"] || c.email || `Klubowicz #${c.id}`;
            const emailVal = (c["E-mail"] || c.email || "").toLowerCase().trim();
            const avatarVal = c.avatarUrl || c.avatar || null;
            return {
              id: c.id,
              firstName: fName,
              lastName: lName,
              name: fullName,
              email: emailVal,
              phone: c["Numer tel."] || c.phone || c.telefon || "",
              avatar: avatarVal,
              registered: c.Zarejestrowany || c.registered || c.created_at
            };
          });

        setKlienci(enriched);

        const myProfile = enriched.find((c: any) => c.email === userEmail);
        let myId: any = null;

        if (ADMIN_EMAILS.includes(userEmail)) {
          setUserRole('admin');
          if (myProfile) {
            myId = myProfile.id;
            setCurrentUserName(`${myProfile.name} (Admin)`);
            setCurrentUserAvatar(myProfile.avatar);
          } else {
            myId = enriched.length > 0 ? enriched[0].id : 1;
            setCurrentUserName("Maciej Kłaput (Admin)");
          }
        } else if (myProfile) {
          myId = myProfile.id;
          setCurrentUserName(myProfile.name);
          setCurrentUserAvatar(myProfile.avatar);
        } else if (enriched.length > 0) {
          myId = enriched[0].id;
          setCurrentUserName(enriched[0].name);
          setCurrentUserAvatar(enriched[0].avatar);
        }

        if (myId) {
          setCurrentUserId(myId);

          const [assignedBadgesData, allDefs] = await Promise.all([
            fetchWszystkiePrzydzieloneOdznakiDirect(),
            fetchAllOdznakiDef(),
            fetchWyzwania(),
            fetchOdznaki(myId),
            fetchHistoriaOdznak(),
            fetchDyscypliny(),
          ]);

          await fetchRankings(enriched, assignedBadgesData);

          if (allDefs && allDefs.length > 0) {
            await checkAndAwardAutomatedBadges(myId, allDefs);
          }
        }
      } catch (error) {
        console.error("Błąd podczas ładowania modułu wyzwań:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, []);

  const fetchWyzwania = async () => {
    const data = await fetchAllFromSupabase("klub_wyzwania", "*", "created_at", false, 5);
    if (data) setWyzwania(data);
  };

  const fetchDyscypliny = async () => {
    const data = await fetchAllFromSupabase("klub_dyscypliny", "*", "nazwa", true, 2);
    if (data) {
      setDyscyplinyList(data);
      if (data.length > 0 && !dyscyplina) setDyscyplina(data[0].nazwa);
    }
  };

  const fetchOdznaki = async (userId: any) => {
    const { data } = await supabase
      .from("klub_odznaki_klubowicze")
      .select(`id, przyznano_at, klient_id, klub_odznaki_definicje (id, nazwa, opis, ikona, punkty, kategoria, warunek, typ_reguly, wartosc_progowa, parametr_dodatkowy)`)
      .eq("klient_id", userId);
    if (data) setOdznaki(data);
  };

  const fetchAllOdznakiDef = async () => {
    const data = await fetchAllFromSupabase("klub_odznaki_definicje", "*", "punkty", true, 2);
    if (data) {
      setWszystkieOdznaki(data);
      return data;
    }
    return [];
  };

  const fetchWszystkiePrzydzieloneOdznakiDirect = async () => {
    const data = await fetchAllFromSupabase(
      "klub_odznaki_klubowicze", 
      `id, przyznano_at, klient_id, odznaka_id, klub_odznaki_definicje (id, nazwa, opis, ikona, punkty, kategoria, warunek, typ_reguly, wartosc_progowa, parametr_dodatkowy)`, 
      "id", 
      false, 
      10
    );
    if (data) {
      // Wyklucz konto systemowe oraz domyślne wpisy "Klubowicz" z przypisanych odznak
      const filtered = data.filter((item: any) => {
        const uId = Number(item.klient_id);
        const name = (item.klienci?.Imię || "").toLowerCase();
        return uId !== SYSTEM_ID && name !== "klubowicz" && name !== "forma marzeń";
      });
      setWszystkiePrzydzieloneOdznaki(filtered);
      return filtered;
    }
    return [];
  };

  const fetchHistoriaOdznak = async () => {
    const data = await fetchAllFromSupabase(
      "klub_odznaki_klubowicze", 
      `*, klub_odznaki_definicje (nazwa), klienci (Imię, Nazwisko)`, 
      "id", 
      false, 
      5
    );
    if (data) {
      const filtered = data.filter((item: any) => {
        const uId = Number(item.klient_id);
        const name = (item.klienci?.Imię || "").toLowerCase();
        return uId !== SYSTEM_ID && name !== "klubowicz";
      });
      setOdznakiHistoria(filtered);
    }
  };

  // RANKINGI Z CAŁKOWITYM POMINIĘCIEM KONTA SYSTEMOWEGO I NAZWY "KLUBOWICZ"
  const fetchRankings = async (clientsData: any[], badgesData?: any[]) => {
    const challengesData = await fetchAllFromSupabase("klub_wyzwania_historia", "zwyciezca_id", "id", false, 5);
    const clientsMap = new Map<string, any>();
    clientsData.forEach((c: any) => {
      if (Number(c.id) !== SYSTEM_ID) {
        clientsMap.set(String(c.id), c);
      }
    });

    if (challengesData && clientsData.length > 0) {
      const winsCount: { [key: string]: number } = {};
      challengesData.forEach((item: any) => {
        if (item.zwyciezca_id && Number(item.zwyciezca_id) !== SYSTEM_ID) {
          const zId = String(item.zwyciezca_id);
          winsCount[zId] = (winsCount[zId] || 0) + 1;
        }
      });
      const winsRanking = Object.keys(winsCount).map((clientId) => {
        const client = clientsMap.get(clientId);
        return {
          id: clientId,
          name: client ? client.name : "Klubowicz",
          avatar: client ? client.avatar : null,
          wins: winsCount[clientId]
        };
      }).filter(r => r.name.toLowerCase() !== "klubowicz").sort((a, b) => b.wins - a.wins);
      setRankingList(winsRanking);
    }

    const sourceBadges = badgesData || wszystkiePrzydzieloneOdznaki;
    if (clientsData.length > 0 && sourceBadges) {
      const badgeScores: { [key: string]: { points: number; count: number } } = {};
      const seenBadgeAssignments = new Set<string>();
      
      sourceBadges.forEach((item: any) => {
        const uId = String(item.klient_id);
        if (Number(uId) === SYSTEM_ID) return;

        const client = clientsMap.get(uId);
        if (!client || client.name.toLowerCase() === "klubowicz") return;

        const badgeDefId = item.odznaka_id || item.klub_odznaki_definicje?.id;
        const assignmentKey = `${uId}_${badgeDefId}`;

        if (seenBadgeAssignments.has(assignmentKey)) return;
        seenBadgeAssignments.add(assignmentKey);

        const pts = Number(item.klub_odznaki_definicje?.punkty) || 1;
        if (!badgeScores[uId]) {
          badgeScores[uId] = { points: 0, count: 0 };
        }
        badgeScores[uId].points += pts;
        badgeScores[uId].count += 1;
      });

      const bRanking = Object.keys(badgeScores).map((clientId) => {
        const client = clientsMap.get(clientId);
        return {
          id: clientId,
          name: client ? client.name : "Klubowicz",
          avatar: client ? client.avatar : null,
          points: badgeScores[clientId].points,
          count: badgeScores[clientId].count
        };
      }).filter(r => r.name.toLowerCase() !== "klubowicz").sort((a, b) => b.points - a.points || b.count - a.count);
      setBadgeRankingList(bRanking);
    }
  };

  const uploadBadgeImageFile = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `badge_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const filePath = `badges/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);

      if (!uploadError) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
        return data.publicUrl;
      }

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    } catch (err) {
      console.error("Błąd podczas uploadu grafiki odznaki:", err);
      return null;
    }
  };

  const assignBadge = async (userId: any, badgeId: any) => {
    const { error } = await supabase.from("klub_odznaki_klubowicze").insert([{
      klient_id: userId,
      odznaka_id: badgeId
    }]);

    if (!error) {
      const badgeDef = wszystkieOdznaki.find((b: any) => String(b.id) === String(badgeId));
      const badgeName = badgeDef ? badgeDef.nazwa : "Klubowa";
      const badgePoints = badgeDef?.punkty ? ` (${badgeDef.punkty} pkt)` : "";
      
      const chatNotification = `🎖️ Gratulacje! Otrzymałeś nową odznakę klubową: "${badgeName}"${badgePoints}! Sprawdź swoją Gablotę Odznak 🏆.`;

      await supabase.from("czat_wiadomosci").insert([
        {
          nadawca_id: SYSTEM_ID,
          nadawca_nazwa: "Forma Marzeń",
          nadawca_avatar: null,
          odbiorca_id: userId,
          tresc: chatNotification,
          przeczytana: false
        }
      ]);

      await sendPushNotification(userId, {
        title: "🎖️ Nowa odznaka klubowa!",
        body: `Gratulacje! Otrzymałeś nową odznakę: "${badgeName}"${badgePoints}!`,
        url: "/wyzwania"
      });

      alert("Odznaka przyznana pomyślnie!");
      fetchHistoriaOdznak();
      const updated = await fetchWszystkiePrzydzieloneOdznakiDirect();
      if (currentUserId) fetchOdznaki(currentUserId);
      fetchRankings(klienci, updated);
    } else {
      if (error.code === '23505') {
        alert("Ten klubowicz posiada już tę odznakę!");
      } else {
        alert("Błąd przyznawania: " + error.message);
      }
    }
  };

  const handleCreateBadgeDef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBadgeNazwa.trim() || !newBadgeOpis.trim()) {
      alert("Wypełnij nazwę oraz opis odznaki!");
      return;
    }

    const matchedRule = REGUŁY_KATALOG.find(r => r.id === newBadgeTypReguly);

    const { error } = await supabase.from("klub_odznaki_definicje").insert([{
      nazwa: newBadgeNazwa.trim(),
      opis: newBadgeOpis.trim(),
      warunek: newBadgeWarunek.trim() || newBadgeOpis.trim(),
      ikona: newBadgeIkona.trim() || matchedRule?.ikona || "🏆",
      punkty: parseInt(newBadgePunkty) || 1,
      kategoria: newBadgeKategoria.trim() || matchedRule?.kategoria || "Treningi",
      typ_reguly: newBadgeTypReguly,
      wartosc_progowa: parseInt(newBadgeWartoscProgowa) || 1,
      parametr_dodatkowy: newBadgeParametrDodatkowy.trim() || matchedRule?.parametr || null
    }]);

    if (!error) {
      alert("Nowa odznaka została dodana do katalogu reguł!");
      setNewBadgeNazwa("");
      setNewBadgeOpis("");
      setNewBadgeWarunek("");
      setNewBadgeIkona("");
      setNewBadgePunkty("1");
      setNewBadgeKategoria("Treningi");
      setNewBadgeTypReguly("TRENINGI_OGOLNE");
      setNewBadgeWartoscProgowa("10");
      setNewBadgeParametrDodatkowy("");
      const updatedDefs = await fetchAllOdznakiDef();
      if (currentUserId && updatedDefs) {
        checkAndAwardAutomatedBadges(currentUserId, updatedDefs);
      }
    } else {
      alert("Błąd tworzenia odznaki: " + error.message);
    }
  };

  const handleStartEditBadge = (badge: any) => {
    setEditingBadgeId(badge.id);
    setEditBadgeNazwa(badge.nazwa || "");
    setEditBadgeOpis(badge.opis || "");
    setEditBadgeWarunek(badge.warunek || badge.opis || "");
    setEditBadgeIkona(badge.ikona || "");
    setEditBadgePunkty(String(badge.punkty || 1));
    setEditBadgeKategoria(badge.kategoria || "Treningi");
    setEditBadgeTypReguly(badge.typ_reguly || "TRENINGI_OGOLNE");
    setEditBadgeWartoscProgowa(String(badge.wartosc_progowa || 10));
    setEditBadgeParametrDodatkowy(badge.parametr_dodatkowy || "");
  };

  const handleSaveEditBadge = async (id: number) => {
    const matchedRule = REGUŁY_KATALOG.find(r => r.id === editBadgeTypReguly);

    const { error } = await supabase.from("klub_odznaki_definicje").update({
      nazwa: editBadgeNazwa.trim(),
      opis: editBadgeOpis.trim(),
      warunek: editBadgeWarunek.trim(),
      ikona: editBadgeIkona.trim() || "🏆",
      punkty: parseInt(editBadgePunkty) || 1,
      kategoria: editBadgeKategoria.trim() || matchedRule?.kategoria || "Treningi",
      typ_reguly: editBadgeTypReguly,
      wartosc_progowa: parseInt(editBadgeWartoscProgowa) || 1,
      parametr_dodatkowy: editBadgeParametrDodatkowy.trim() || matchedRule?.parametr || null
    }).eq("id", id);

    if (!error) {
      alert("Odznaka została zaktualizowana!");
      setEditingBadgeId(null);
      const updatedDefs = await fetchAllOdznakiDef();
      if (currentUserId) {
        fetchOdznaki(currentUserId);
        if (updatedDefs) checkAndAwardAutomatedBadges(currentUserId, updatedDefs);
      }
      const updated = await fetchWszystkiePrzydzieloneOdznakiDirect();
      fetchRankings(klienci, updated);
    } else {
      alert("Błąd edycji odznaki: " + error.message);
    }
  };

  const handleDeleteBadgeDef = async (id: number) => {
    if (!confirm("Czy na pewno chcesz usunąć tę odznakę z katalogu? Klubowicze stracą do niej dostęp.")) return;
    const { error } = await supabase.from("klub_odznaki_definicje").delete().eq("id", id);
    if (!error) {
      fetchAllOdznakiDef();
      if (currentUserId) fetchOdznaki(currentUserId);
      const updated = await fetchWszystkiePrzydzieloneOdznakiDirect();
      fetchRankings(klienci, updated);
    } else {
      alert("Błąd usuwania odznaki: " + error.message);
    }
  };

  const handleAddDyscyplina = async () => {
    if (!newDyscyplina.trim()) return;
    const { error } = await supabase.from("klub_dyscypliny").insert([{ nazwa: newDyscyplina.trim() }]);
    if (!error) {
      setNewDyscyplina("");
      fetchDyscypliny();
    } else {
      alert("Błąd dodawania: " + error.message);
    }
  };

  const handleUpdateDyscyplina = async (id: number, newName: string) => {
    const { error } = await supabase.from("klub_dyscypliny").update({ nazwa: newName }).eq("id", id);
    if (!error) {
      setEditingIndex(null);
      setEditText("");
      fetchDyscypliny();
    } else {
      alert("Błąd edycji: " + error.message);
    }
  };

  const handleDeleteDyscyplina = async (id: number) => {
    if (dyscyplinyList.length <= 1) {
      alert("Musisz zostawić przynajmniej jedną dyscyplinę.");
      return;
    }
    const { error } = await supabase.from("klub_dyscypliny").delete().eq("id", id);
    if (!error) {
      fetchDyscypliny();
    } else {
      alert("Błąd usuwania: " + error.message);
    }
  };

  const handleDeleteWyzwanie = async (challengeId: number) => {
    if (!confirm("Czy na pewno chcesz usunąć to wyzwanie?")) return;
    const { error } = await supabase.from("klub_wyzwania").delete().eq("id", challengeId);
    if (!error) {
      fetchWyzwania();
      fetchRankings(klienci);
    } else {
      alert("Błąd usuwania wyzwania: " + error.message);
    }
  };

  const openWinnerModal = (challenge: any) => {
    setChallengeToResolve(challenge);
    setSelectedWinnerId(challenge.tworca_id); 
    setIsWinnerModalOpen(true);
  };

  const handleConfirmWinner = async () => {
    if (!challengeToResolve || !selectedWinnerId) return;

    const { error } = await supabase
      .from("klub_wyzwania")
      .update({
        status: "zweryfikowane",
        zwyciezca_id: selectedWinnerId,
        updated_at: new Date().toISOString()
      })
      .eq("id", challengeToResolve.id);

    if (!error) {
      const winnerName = getClientName(selectedWinnerId);
      const participantIds = [challengeToResolve.tworca_id, challengeToResolve.przeciwnik_id];

      await sendPushNotification(participantIds, {
        title: "⚔️ Wynik wyzwania zweryfikowany!",
        body: `Wyzwanie w dyscyplinie "${challengeToResolve.dyscyplina}" wygrywa ${winnerName}!`,
        url: "/wyzwania"
      });

      alert("Wynik zatwierdzony!");
      setIsWinnerModalOpen(false);
      setChallengeToResolve(null);
      fetchWyzwania();
      fetchRankings(klienci);

      if (currentUserId) {
        const defs = await fetchAllOdznakiDef();
        if (defs) checkAndAwardAutomatedBadges(currentUserId, defs);
      }
    } else {
      alert("Błąd: " + error.message);
    }
  };

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpponent || !dyscyplina.trim() || !currentUserId) return;

    const { error: challengeErr } = await supabase
      .from("klub_wyzwania")
      .insert([
        {
          tworca_id: currentUserId,
          przeciwnik_id: selectedOpponent.id,
          dyscyplina: dyscyplina.trim(),
          opis: opisWyzwania.trim() || "Brak dodatkowego opisu",
          status: "oczekujace",
          kategoria_wyzwania: modalKategoria
        }
      ]);

    if (challengeErr) {
      alert("Błąd podczas rzucania wyzwania: " + challengeErr.message);
      return;
    }

    const ikonaKategorii = modalKategoria === 'zywienie' ? '🥗' : '⚔️';
    const chatMessage = `${ikonaKategorii} Rzuciłem Ci wyzwanie w dyscyplinie: "${dyscyplina.trim()}"! Wejdź w zakładkę Wyzwania i Odznaki, aby je przyjąć.`;
    
    await supabase.from("czat_wiadomosci").insert([
      {
        nadawca_id: currentUserId,
        nadawca_nazwa: currentUserName,
        nadawca_avatar: currentUserAvatar,
        odbiorca_id: selectedOpponent.id,
        tresc: chatMessage,
        przeczytana: false
      }
    ]);

    await sendPushNotification(selectedOpponent.id, {
      title: `${ikonaKategorii} Nowe wyzwanie klubowe!`,
      body: `${currentUserName} rzuca Ci wyzwanie w kategorii ${modalKategoria === 'zywienie' ? 'żywieniowej' : 'sportowej'}: "${dyscyplina.trim()}"!`,
      url: "/wyzwania"
    });

    alert("Wyzwanie zostało pomyślnie wysłane!");
    setIsModalOpen(false);
    setOpisWyzwania("");
    setSelectedOpponent(null);
    setSearchQuery("");
    fetchWyzwania();
  };

  const handleUpdateStatus = async (challengeId: number, newStatus: string) => {
    const { error } = await supabase
      .from("klub_wyzwania")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", challengeId);

    if (!error) {
      const challengeObj = wyzwania.find(w => w.id === challengeId);
      if (challengeObj && newStatus === "aktywne") {
        await sendPushNotification(challengeObj.tworca_id, {
          title: "⚔️ Wyzwanie przyjęte!",
          body: `${currentUserName} przyjął Twoje wyzwanie w dyscyplinie: "${challengeObj.dyscyplina}"! Do dzieła!`,
          url: "/wyzwania"
        });
      }

      fetchWyzwania();
      fetchRankings(klienci);
    } else {
      alert("Nie udało się zaktualizować statusu.");
    }
  };

  const filteredOpponents = klienci
    .filter((k: any) => String(k.id) !== String(currentUserId) && Number(k.id) !== SYSTEM_ID)
    .filter((k: any) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return false;
      const fName = (k.firstName || "").toLowerCase();
      const lName = (k.lastName || "").toLowerCase();
      return lName.startsWith(q) || fName.startsWith(q) || k.name.toLowerCase().includes(q);
    });

  const getClientName = (id: any) => {
    if (Number(id) === SYSTEM_ID) return "Forma Marzeń";
    const found = klienci.find((c: any) => String(c.id) === String(id));
    return found ? found.name : "Klubowicz";
  };

  // WSZYSCY KLUBOWICZE WRAZ ZE SWOIMI ODZNAKAMI (BEZ KONTA SYSTEMOWEGO I BEZ NAZWY "KLUBOWICZ")
  const allMembersWithBadgeData = useMemo(() => {
    return (klienci || [])
      .filter((k: any) => Number(k.id) !== SYSTEM_ID && k.name.toLowerCase() !== "klubowicz")
      .map((k: any) => {
        const userBadges = (wszystkiePrzydzieloneOdznaki || []).filter(
          (item: any) => String(item.klient_id) === String(k.id)
        );
        return {
          ...k,
          badgesCount: userBadges.length,
          badges: userBadges
        };
      });
  }, [klienci, wszystkiePrzydzieloneOdznaki]);

  const membersWithBadges = useMemo(() => {
    return allMembersWithBadgeData.filter((k: any) => k.badgesCount > 0 && String(k.id) !== String(currentUserId));
  }, [allMembersWithBadgeData, currentUserId]);

  // WYSZUKIWANIE DOWOLNEGO KLUBOWICZA W GABLOCIE
  const searchedClubMembers = useMemo(() => {
    if (!badgeMemberSearchQuery.trim()) return [];
    const q = badgeMemberSearchQuery.toLowerCase().trim();

    return allMembersWithBadgeData.filter(k => 
      (k.name && k.name.toLowerCase().includes(q)) ||
      (k.firstName && k.firstName.toLowerCase().includes(q)) ||
      (k.lastName && k.lastName.toLowerCase().includes(q)) ||
      (k.email && k.email.toLowerCase().includes(q))
    );
  }, [badgeMemberSearchQuery, allMembersWithBadgeData]);

  const handleSelectMemberToInspect = (member: any) => {
    const userBadges = (wszystkiePrzydzieloneOdznaki || []).filter(
      (item: any) => String(item.klient_id) === String(member.id)
    );
    setSelectedMemberForComparison({
      ...member,
      badgesCount: userBadges.length,
      badges: userBadges
    });
    setBadgeMemberSearchQuery("");
  };

  const renderBadgeGraphic = (iconStr: string | null | undefined, sizeClasses = "w-14 h-14", textClasses = "text-2xl") => {
    if (!iconStr) return <span className={textClasses}>🏆</span>;
    const isImage = iconStr.startsWith("http") || iconStr.startsWith("data:") || iconStr.startsWith("/") || iconStr.includes(".png") || iconStr.includes(".jpg") || iconStr.includes(".jpeg") || iconStr.includes(".svg") || iconStr.includes(".webp");

    if (isImage) {
      return (
        <img 
          src={iconStr} 
          alt="Odznaka" 
          className={`${sizeClasses} object-cover rounded-2xl shadow-sm border border-amber-400/30`} 
        />
      );
    }
    return <span className={textClasses}>{iconStr}</span>;
  };

  const getSortedBadgesForComparison = () => {
    if (!selectedMemberForComparison) return wszystkieOdznaki;

    return [...wszystkieOdznaki].sort((a, b) => {
      const aUser = odznaki.some((o: any) => o.klub_odznaki_definicje?.id === a.id || o.odznaka_id === a.id);
      const aMember = (selectedMemberForComparison.badges || []).some((o: any) => (o.klub_odznaki_definicje?.id === a.id) || (o.odznaka_id === a.id));

      const bUser = odznaki.some((o: any) => o.klub_odznaki_definicje?.id === b.id || o.odznaka_id === b.id);
      const bMember = (selectedMemberForComparison.badges || []).some((o: any) => (o.klub_odznaki_definicje?.id === b.id) || (o.odznaka_id === b.id));

      const aScore = (aUser ? 1 : 0) + (aMember ? 1 : 0);
      const bScore = (bUser ? 1 : 0) + (bMember ? 1 : 0);

      if (bScore !== aScore) return bScore - aScore;
      return (b.punkty || 0) - (a.punkty || 0);
    });
  };

  const formatRegulaLabel = (typ: string, prog?: number) => {
    const matched = REGUŁY_KATALOG.find(r => r.id === typ);
    if (!matched) return `✋ Ręczna (Admin)`;
    if (typ === 'REJESTRACJA') return `🚀 Auto: Za rejestrację`;
    if (typ === 'RECZNA') return `✋ Ręczna (Admin)`;
    return `${matched.ikona} Auto: ${matched.nazwa} (Próg: ${prog || 1})`;
  };

  const renderChallengesList = (kategoria: 'sport' | 'zywienie') => {
    const filteredActive = wyzwania.filter(w => {
      const kat = w.kategoria_wyzwania || 'sport';
      return kat === kategoria && w.status !== 'zweryfikowane' && w.status !== 'odrzucone';
    });

    const filteredCompleted = wyzwania.filter(w => {
      const kat = w.kategoria_wyzwania || 'sport';
      return kat === kategoria && (w.status === 'zweryfikowane' || w.status === 'odrzucone');
    });

    const isSport = kategoria === 'sport';

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredActive.map((w: any) => {
            const przeciwnikName = getClientName(w.przeciwnik_id);
            const tworcaName = getClientName(w.tworca_id);

            return (
              <div key={w.id} className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">{w.status}</span>
                    <h3 className="font-black text-sm text-slate-900 mt-2">{w.dyscyplina}</h3>
                    <p className="text-xs text-slate-600 mt-1">{w.opis}</p>
                  </div>
                  <span className="text-2xl">{isSport ? '🎯' : '🥗'}</span>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 text-xs flex items-center justify-between border border-sky-50">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Rzucający</div>
                    <div className="font-bold text-slate-800">{tworcaName}</div>
                  </div>
                  <span className="font-black text-amber-500 text-sm">VS</span>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Przeciwnik</div>
                    <div className="font-bold text-slate-800">{przeciwnikName}</div>
                  </div>
                </div>

                {w.status === 'oczekujace' && String(w.przeciwnik_id) === String(currentUserId) && (
                  <div className="flex items-center gap-2 pt-2 border-t border-sky-50">
                    <button onClick={() => handleUpdateStatus(w.id, 'aktywne')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer">Przyjmij wyzwanie</button>
                    <button onClick={() => handleUpdateStatus(w.id, 'odrzucone')} className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer">Odrzuć</button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredActive.length === 0 && (
            <div className="col-span-full bg-white rounded-3xl p-8 text-center border border-sky-100 text-slate-400 text-xs italic">
              Brak aktywnych wyzwań w tej sekcji.
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-sky-100">
          <h3 className="font-black text-xs uppercase text-slate-400 mb-4 px-2">Zakończone wyzwania</h3>
          <div className="bg-white rounded-3xl border border-sky-100 overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-sky-100 text-slate-400 uppercase font-bold text-[10px] bg-slate-50">
                  <th className="py-3 px-4">Dyscyplina / Zadanie</th>
                  <th className="py-3 px-4">Uczestnicy</th>
                  <th className="py-3 px-4">Zwycięzca</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompleted.map((w: any) => (
                  <tr key={w.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{w.dyscyplina}</td>
                    <td className="py-3 px-4 text-slate-600">{getClientName(w.tworca_id)} vs {getClientName(w.przeciwnik_id)}</td>
                    <td className="py-3 px-4 font-bold text-amber-600">{w.zwyciezca_id ? getClientName(w.zwyciezca_id) : "-"}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${w.status === 'zweryfikowane' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {w.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredCompleted.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-400 italic">Brak zakończonych wyzwań w tej kategorii.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="p-8 text-center text-sky-900 font-bold animate-pulse">Ładowanie modułu wyzwań...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans antialiased">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-sky-100 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
            <span>⚔️</span> Wyzwania i Odznaki Klubowe
            <button onClick={() => setIsInfoModalOpen(true)} className="text-[10px] bg-sky-100 text-sky-800 px-2.5 py-1 rounded-full cursor-pointer hover:bg-sky-200 transition-colors font-bold">ℹ️ Info</button>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Rzucaj wyzwania sportowe i żywieniowe, rywalizuj z klubowiczami i zdobywaj trofea!</p>
        </div>

        <button
          onClick={() => {
            setModalKategoria(activeTab === 'zywienie' ? 'zywienie' : 'sport');
            setIsModalOpen(true);
          }}
          className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-6 py-3.5 rounded-2xl transition-all shadow-lg uppercase tracking-wider flex items-center gap-2 cursor-pointer"
        >
          <span>⚡</span> Nowe wyzwanie
        </button>
      </div>

      {/* ZAKŁADKI GŁÓWNE */}
      <div className="flex flex-wrap rounded-2xl bg-white p-1 border border-sky-100 text-xs font-bold shadow-sm max-w-2xl gap-1">
        <button
          onClick={() => { setActiveTab('aktywne'); setSelectedMemberForComparison(null); }}
          className={`flex-1 min-w-[110px] py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'aktywne' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Pojedynki ⚔️
        </button>
        <button
          onClick={() => { setActiveTab('zywienie'); setSelectedMemberForComparison(null); }}
          className={`flex-1 min-w-[110px] py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'zywienie' ? 'bg-emerald-600 text-white font-black shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Żywienie 🥗
        </button>
        <button
          onClick={() => { 
            setActiveTab('odznaki'); 
            setSelectedMemberForComparison(null); 
            if (currentUserId && wszystkieOdznaki.length > 0) {
              checkAndAwardAutomatedBadges(currentUserId, wszystkieOdznaki);
            }
          }}
          className={`flex-1 min-w-[110px] py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'odznaki' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Gablota odznak 🏆
        </button>
        <button
          onClick={() => { setActiveTab('ranking'); setSelectedMemberForComparison(null); }}
          className={`flex-1 min-w-[110px] py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'ranking' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Ranking 🌍
        </button>
        {userRole === 'admin' && (
          <button
            onClick={() => { setActiveTab('admin'); setSelectedMemberForComparison(null); }}
            className={`flex-1 min-w-[110px] py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'admin' ? 'bg-rose-600 text-white font-black shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Admin Panel 🛠️
          </button>
        )}
      </div>

      {activeTab === 'aktywne' && renderChallengesList('sport')}
      {activeTab === 'zywienie' && renderChallengesList('zywienie')}

      {/* GABLOTA ODZNAK */}
      {activeTab === 'odznaki' && (
        <div className="space-y-8">
          {selectedMemberForComparison ? (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 text-white space-y-8 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <button 
                  onClick={() => setSelectedMemberForComparison(null)} 
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-2"
                >
                  ← Wróć do mojej gabloty
                </button>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-300">
                  Gablota klubowicza: {selectedMemberForComparison.name}
                </h2>
                <div className="w-20"></div>
              </div>

              {/* Nagłówek profilu oglądanego klubowicza */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-center items-center py-4 bg-slate-950/50 rounded-3xl p-6 border border-slate-800/80">
                <div className="flex flex-col items-center space-y-3">
                  {currentUserAvatar ? (
                    <img src={currentUserAvatar} alt={currentUserName} className="w-20 h-20 rounded-full object-cover border-2 border-amber-500 shadow-md" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-amber-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-md">
                      {currentUserName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="font-black text-sm text-white">{currentUserName} (Ty)</div>
                    <div className="text-xs text-amber-400 font-bold mt-1 flex items-center justify-center gap-1">
                      <span>🏆</span> {odznaki.length} Twoich odznak
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center space-y-3">
                  {selectedMemberForComparison.avatar ? (
                    <img src={selectedMemberForComparison.avatar} alt={selectedMemberForComparison.name} className="w-20 h-20 rounded-full object-cover border-2 border-sky-400 shadow-md" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-sky-500 text-white font-black text-2xl flex items-center justify-center shadow-md">
                      {selectedMemberForComparison.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="font-black text-base text-white">{selectedMemberForComparison.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{selectedMemberForComparison.email || "Brak email"}</div>
                    <div className="text-xs text-sky-400 font-bold mt-1 flex items-center justify-center gap-1">
                      <span>🏆</span> {(selectedMemberForComparison.badges || []).length} zdobytych odznak
                    </div>
                  </div>
                </div>
              </div>

              {/* SEKCJA 1: ODZNAKI ZDOBYTE PRZEZ TEGO KLUBOWICZA */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 px-2 flex items-center gap-2">
                  <span>🎖️</span> Zdobyte odznaki przez: {selectedMemberForComparison.name} ({(selectedMemberForComparison.badges || []).length})
                </h3>

                {(selectedMemberForComparison.badges || []).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedMemberForComparison.badges.map((bItem: any) => {
                      const def = bItem.klub_odznaki_definicje || {};
                      return (
                        <div key={bItem.id} className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 flex items-center gap-4">
                          <div 
                            onClick={() => setSelectedBadgeForZoom(def)}
                            className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-2xl shadow-inner shrink-0 overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                            title="Kliknij, aby powiększyć"
                          >
                            {renderBadgeGraphic(def.ikona, "w-14 h-14", "text-2xl")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-xs uppercase text-white truncate">{def.nazwa}</h4>
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full shrink-0">{def.punkty || 1} pkt</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{def.opis}</p>
                            <div className="text-[9px] text-slate-500 font-mono mt-1 italic">
                              Zdobyto: {bItem.przyznano_at ? new Date(bItem.przyznano_at).toLocaleDateString('pl-PL') : '-'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-slate-950/40 rounded-2xl p-8 text-center border border-slate-800 text-slate-500 text-xs italic">
                    Ten klubowicz nie zdobył jeszcze żadnej odznaki.
                  </div>
                )}
              </div>

              {/* SEKCJA 2: PEŁNE PORÓWNANIE ZE WSZYSTKIMI ODZNAKAMI W KLUBIE */}
              <div className="space-y-4 pt-6 border-t border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 px-2">
                  Porównanie wszystkich odznak w klubie (Zdobyte na górze)
                </h3>
                <div className="space-y-3">
                  {getSortedBadgesForComparison().map((def: any) => {
                    const userHasIt = odznaki.some((o: any) => o.klub_odznaki_definicje?.id === def.id || o.odznaka_id === def.id);
                    const memberHasIt = (selectedMemberForComparison.badges || []).some((o: any) => (o.klub_odznaki_definicje?.id === def.id) || (o.odznaka_id === def.id));

                    return (
                      <div key={def.id} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div 
                            onClick={() => setSelectedBadgeForZoom(def)}
                            className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-400/40 flex items-center justify-center text-2xl shadow-inner shrink-0 overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                            title="Kliknij, aby powiększyć"
                          >
                            {renderBadgeGraphic(def.ikona, "w-14 h-14", "text-2xl")}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-xs uppercase text-white tracking-wider">{def.nazwa}</h4>
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full">{def.punkty || 1} pkt</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{def.opis}</p>
                            {def.warunek && (
                              <p className="text-[9px] text-amber-200/70 mt-1 font-mono">🎯 Warunek: {def.warunek}</p>
                            )}
                            <div className="flex flex-wrap gap-2 items-center mt-1">
                              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Kat: {def.kategoria || 'Wyzwania'}</span>
                              <span className="text-[9px] bg-amber-500/10 text-amber-300 font-semibold px-2 py-0.5 rounded-md border border-amber-400/20">
                                {formatRegulaLabel(def.typ_reguly, def.wartosc_progowa)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 shrink-0">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-slate-500 mb-1">Ty</span>
                            {userHasIt ? (
                              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 text-xs font-bold">✓</div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 text-xs">-</div>
                            )}
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-slate-500 mb-1 truncate max-w-[80px] text-center">{selectedMemberForComparison.firstName || "Klubowicz"}</span>
                            {memberHasIt ? (
                              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 text-xs font-bold">✓</div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 text-xs">-</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Sekcja 1: Twoja gablota odznak */}
              <div className="space-y-4">
                <h3 className="font-black text-xs uppercase text-slate-400 px-2">Twoja gablota odznak</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {odznaki.map((o: any) => {
                    const def = o.klub_odznaki_definicje || {};
                    return (
                      <div key={o.id} className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm flex items-center gap-4">
                        <div 
                          onClick={() => setSelectedBadgeForZoom(def)}
                          className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-400/50 flex items-center justify-center text-3xl shadow-inner shrink-0 overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                          title="Kliknij, aby powiększyć"
                        >
                          {renderBadgeGraphic(def.ikona, "w-16 h-16", "text-3xl")}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-xs uppercase text-slate-900 tracking-wider">{def.nazwa}</h4>
                            <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">{def.punkty || 1} pkt</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">{def.opis}</p>
                          {def.warunek && (
                            <p className="text-[9px] text-amber-800/80 mt-1 font-mono">🎯 {def.warunek}</p>
                          )}
                          <div className="text-[9px] text-slate-400 font-mono mt-2 italic">Zdobyto: {new Date(o.przyznano_at).toLocaleDateString('pl-PL')}</div>
                        </div>
                      </div>
                    );
                  })}

                  {odznaki.length === 0 && (
                    <div className="col-span-full bg-white rounded-3xl p-12 text-center border-2 border-dashed border-sky-100 text-slate-400 text-xs space-y-2">
                      <div className="text-3xl">🏆</div>
                      <div className="font-bold text-slate-700">Brak zdobytych odznak</div>
                      <p>Bierz udział w potwierdzonych treningach oraz wyzwaniach, aby zapełnić swoją gablotę!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* SEKCJA 2: WYSZUKIWARKA KLUBOWICZA ORAZ LISTA PROFILI */}
              <div className="space-y-4 pt-6 border-t border-sky-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
                  <div>
                    <h3 className="font-black text-xs uppercase text-slate-700 tracking-wider flex items-center gap-2">
                      <span>🔍</span> Sprawdź odznaki klubowicza
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Wyszukaj dowolnego zarejestrowanego klubowicza w bazie, aby zobaczyć jego gablotę.</p>
                  </div>
                  <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-3 py-1 rounded-full w-fit">
                    Łącznie w bazie: {klienci.length} osób
                  </span>
                </div>

                {/* Pole wyszukiwarki klubowiczów */}
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-400">🔍</span>
                  <input
                    type="text"
                    placeholder="Wpisz imię, nazwisko lub email klubowicza (np. Izabela Knap)..."
                    value={badgeMemberSearchQuery}
                    onChange={(e) => setBadgeMemberSearchQuery(e.target.value)}
                    className="w-full bg-white border border-sky-200 rounded-2xl pl-11 pr-10 py-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                  />
                  {badgeMemberSearchQuery && (
                    <button
                      onClick={() => setBadgeMemberSearchQuery("")}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Wyniki wyszukiwania na żywo */}
                {badgeMemberSearchQuery.trim().length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase text-slate-400 px-2">
                      Wyniki wyszukiwania ({searchedClubMembers.length}):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {searchedClubMembers.map((member: any) => (
                        <div
                          key={member.id}
                          onClick={() => handleSelectMemberToInspect(member)}
                          className="bg-white hover:bg-sky-50/50 rounded-2xl p-4 border border-sky-200 hover:border-amber-400 shadow-sm transition-all cursor-pointer flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {member.avatar ? (
                              <img src={member.avatar} alt={member.name} className="w-11 h-11 rounded-full object-cover border border-sky-200 shrink-0" />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-sky-100 text-sky-900 flex items-center justify-center font-bold text-sm shrink-0">
                                {member.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-black text-xs text-slate-900 group-hover:text-amber-600 transition-colors truncate">
                                {member.name}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {member.email || "Brak e-maila"}
                              </div>
                              <div className="text-[10px] font-bold text-amber-700 mt-0.5">
                                🏆 Odznaki: {member.badgesCount}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-black bg-amber-100 text-amber-900 px-2.5 py-1 rounded-xl shrink-0 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">
                            Zobacz ➔
                          </span>
                        </div>
                      ))}

                      {searchedClubMembers.length === 0 && (
                        <div className="col-span-full bg-white rounded-2xl p-6 text-center border border-sky-100 text-slate-400 text-xs">
                          Nie znaleziono zarejestrowanego klubowicza o takich danych.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Klubowicze ze zdobytymi odznakami */}
                <div className="space-y-3 pt-2">
                  <div className="text-[10px] font-black uppercase text-slate-400 px-2">
                    Klubowicze ze zdobytymi odznakami ({membersWithBadges.length}):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {membersWithBadges.map((member: any) => (
                      <div 
                        key={member.id} 
                        onClick={() => handleSelectMemberToInspect(member)}
                        className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm flex items-center justify-between hover:border-amber-400 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-full object-cover border border-sky-200 shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-sm shrink-0">
                              {member.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-slate-900 group-hover:text-amber-600 transition-colors truncate">{member.name}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{member.badgesCount} zdobytych odznak</div>
                          </div>
                        </div>
                        <span className="text-xs font-black bg-amber-50 text-amber-700 px-3 py-1.5 rounded-xl group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shrink-0">
                          Gablota ➔
                        </span>
                      </div>
                    ))}

                    {membersWithBadges.length === 0 && (
                      <div className="col-span-full bg-white rounded-3xl p-8 text-center border border-sky-100 text-slate-400 text-xs italic">
                        Brak innych klubowiczów ze zdobytymi odznakami. Wpisz nazwisko klubowicza w wyszukiwarce powyżej, aby zobaczyć jego profil.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RANKINGI */}
      {activeTab === 'ranking' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>⚔️</span> Ranking Pojedynków Head-to-Head
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Liczba wygranych pojedynków przeciwko innym klubowiczom.</p>
            </div>
            
            <div className="overflow-hidden rounded-2xl border border-sky-100">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 uppercase font-bold text-[10px] border-b border-sky-100">
                    <th className="py-3 px-3.5 w-16">Miejsce</th>
                    <th className="py-3 px-3">Klubowicz</th>
                    <th className="py-3 px-3.5 text-right">Wygrane</th>
                  </tr>
                </thead>
                <tbody>
                  {rankingList.map((row, index) => (
                    <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3.5 font-black text-slate-700">
                        {index === 0 ? '🥇 1' : index === 1 ? '🥈 2' : index === 2 ? '🥉 3' : `#${index + 1}`}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-2.5">
                        {row.avatar ? (
                          <img src={row.avatar} alt={row.name} className="w-7 h-7 rounded-full object-cover border border-sky-200" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-[10px]">
                            {row.name.charAt(0)}
                          </div>
                        )}
                        <span className="truncate max-w-[140px]">{row.name}</span>
                      </td>
                      <td className="py-3 px-3.5 text-right font-black text-amber-600 text-xs">{row.wins} ⚔️</td>
                    </tr>
                  ))}
                  {rankingList.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 text-xs italic">Brak rozstrzygniętych pojedynków.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-4">
            <div>
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>🏆</span> Ranking Punktowy Odznak
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Suma punktów ze wszystkich zdobytych odznak klubowych.</p>
            </div>
            
            <div className="overflow-hidden rounded-2xl border border-sky-100">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 uppercase font-bold text-[10px] border-b border-sky-100">
                    <th className="py-3 px-3.5 w-16">Miejsce</th>
                    <th className="py-3 px-3">Klubowicz</th>
                    <th className="py-3 px-3.5 text-right">Punkty (Odznaki)</th>
                  </tr>
                </thead>
                <tbody>
                  {badgeRankingList.map((row, index) => (
                    <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3.5 font-black text-slate-700">
                        {index === 0 ? '🥇 1' : index === 1 ? '🥈 2' : index === 2 ? '🥉 3' : `#${index + 1}`}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-2.5">
                        {row.avatar ? (
                          <img src={row.avatar} alt={row.name} className="w-7 h-7 rounded-full object-cover border border-sky-200" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-[10px]">
                            {row.name.charAt(0)}
                          </div>
                        )}
                        <span className="truncate max-w-[140px]">{row.name}</span>
                      </td>
                      <td className="py-3 px-3.5 text-right font-black text-amber-600 text-xs">
                        {row.points} pkt <span className="text-[10px] text-slate-400 font-normal">({row.count} 🏆)</span>
                      </td>
                    </tr>
                  ))}
                  {badgeRankingList.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400 text-xs italic">Brak zdobytych odznak w klubie.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PANEL */}
      {activeTab === 'admin' && userRole === 'admin' && (
        <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-sm space-y-6">
          <div className="flex flex-wrap gap-2 text-xs font-bold border-b border-rose-100 pb-4">
            <button onClick={() => setAdminSubTab('wyzwania')} className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${adminSubTab === 'wyzwania' ? 'bg-rose-100 text-rose-900' : 'text-slate-600 hover:text-slate-900'}`}>Wyzwania</button>
            <button onClick={() => setAdminSubTab('odznaki')} className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${adminSubTab === 'odznaki' ? 'bg-rose-100 text-rose-900' : 'text-slate-600 hover:text-slate-900'}`}>Przyznaj Odznakę</button>
            <button onClick={() => setAdminSubTab('katalog_odznak')} className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${adminSubTab === 'katalog_odznak' ? 'bg-rose-100 text-rose-900' : 'text-slate-600 hover:text-slate-900'}`}>Katalog Odznak & 21 Reguł</button>
            <button onClick={() => setAdminSubTab('dyscypliny')} className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${adminSubTab === 'dyscypliny' ? 'bg-rose-100 text-rose-900' : 'text-slate-600 hover:text-slate-900'}`}>Dyscypliny</button>
          </div>
          
          {adminSubTab === 'wyzwania' && (
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px]">
                  <th className="py-3 px-2">Kategoria / Dyscyplina</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Akcja</th>
                </tr>
              </thead>
              <tbody>{wyzwania.map(w => (
                <tr key={w.id} className="border-b border-slate-50">
                  <td className="py-4 px-2 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${w.kategoria_wyzwania === 'zywienie' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {w.kategoria_wyzwania === 'zywienie' ? '🥗 Żywienie' : '⚔️ Sport'}
                      </span>
                      <span>{w.dyscyplina}</span>
                    </div>
                    {w.zwyciezca_id && <div className="text-[10px] text-amber-600 font-normal mt-0.5">Zwycięzca: {getClientName(w.zwyciezca_id)}</div>}
                  </td>
                  <td className="py-4 px-2 text-slate-600">{w.status}</td>
                  <td className="py-4 px-2 text-right flex gap-2 justify-end">
                    {w.status !== 'zweryfikowane' && w.status !== 'odrzucone' && (
                      <button onClick={() => openWinnerModal(w)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-colors">Zatwierdź</button>
                    )}
                    <button onClick={() => handleDeleteWyzwanie(w.id)} className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer">Usuń</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}

          {adminSubTab === 'odznaki' && (
            <div className="space-y-6">
              <h3 className="font-black text-xs text-rose-950 uppercase">Ręczne przyznawanie odznaki klubowiczowi:</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <select id="user-select" className="p-3 border border-rose-200 rounded-xl w-full text-xs font-bold bg-white">
                  {klienci.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
                <select id="badge-select" className="p-3 border border-rose-200 rounded-xl w-full text-xs font-bold bg-white">
                  {wszystkieOdznaki.map(o => <option key={o.id} value={o.id}>{o.nazwa} ({o.punkty} pkt)</option>)}
                </select>
                <button onClick={() => {
                  const userId = (document.getElementById('user-select') as HTMLSelectElement).value;
                  const badgeId = (document.getElementById('badge-select') as HTMLSelectElement).value;
                  assignBadge(userId, badgeId);
                }} className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl text-xs font-black transition-colors cursor-pointer shrink-0">Przyznaj</button>
              </div>
            </div>
          )}

          {/* KAFELKOWY KATALOG I KREATOR REGUŁ + PRZYCISK MASOWEGO PRZELICZANIA */}
          {adminSubTab === 'katalog_odznak' && (
            <div className="space-y-8">
              {/* PRZYCISK MASOWEGO PRZELICZANIA ODZNAK */}
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 rounded-3xl text-slate-950 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                    <span>⚡</span> Automatyczny skaner odznak dla całej bazy
                  </h3>
                  <p className="text-xs text-slate-900/80 mt-1">Uruchom jednorazowe przeliczenie wszystkich 21 reguł dla każdego klubowicza w klubie.</p>
                </div>
                <button
                  onClick={handleRunGlobalBadgeRecalculation}
                  disabled={isGlobalRecalculating}
                  className="bg-slate-950 hover:bg-slate-900 text-white font-black px-6 py-3.5 rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer shrink-0 disabled:opacity-50 whitespace-nowrap"
                >
                  {isGlobalRecalculating ? "Przeliczanie..." : "🚀 Przelicz odznaki dla wszystkich"}
                </button>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-6">
                <div>
                  <h3 className="font-black text-sm uppercase text-slate-900 flex items-center gap-2">
                    <span>✨</span> KREATOR ODZNAK - WYBIERZ REGUŁĘ I USTAL PRÓG
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Wybierz jeden z kafelków z gotową automatyczną regułą i wpisz próg, od którego odznaka przyzna się sama.</p>
                </div>

                <form onSubmit={handleCreateBadgeDef} className="space-y-6">
                  {/* KAFELKOWY SELEKTOR 21 REGUŁ */}
                  <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        1. Wybierz regułę automatycznego przyznawania:
                      </label>
                      <div className="flex gap-1 overflow-x-auto">
                        {["Wszystkie", "Treningi", "Częstotliwość", "Rywalizacja", "Klub"].map(kat => (
                          <button
                            type="button"
                            key={kat}
                            onClick={() => setSelectedRuleCategoryFilter(kat)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                              selectedRuleCategoryFilter === kat
                                ? "bg-amber-500 text-slate-950 shadow-xs"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {kat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                      {REGUŁY_KATALOG
                        .filter(r => selectedRuleCategoryFilter === "Wszystkie" || r.kategoria === selectedRuleCategoryFilter)
                        .map(rule => {
                          const isSelected = newBadgeTypReguly === rule.id;
                          return (
                            <div
                              key={rule.id}
                              onClick={() => {
                                setNewBadgeTypReguly(rule.id);
                                setNewBadgeWartoscProgowa(String(rule.domyslnyProg));
                                if (!newBadgeNazwa) setNewBadgeNazwa(rule.nazwa);
                                if (!newBadgeOpis) setNewBadgeOpis(rule.opis);
                                if (!newBadgeIkona) setNewBadgeIkona(rule.ikona);
                                setNewBadgeKategoria(rule.kategoria);
                                setNewBadgeParametrDodatkowy(rule.parametr || "");
                              }}
                              className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 text-left ${
                                isSelected
                                  ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-300 shadow-sm"
                                  : "bg-slate-50/70 border-slate-200 hover:border-amber-300 hover:bg-white"
                              }`}
                            >
                              <span className="text-2xl shrink-0 p-1.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                                {rule.ikona}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="font-black text-xs text-slate-900 truncate">{rule.nazwa}</div>
                                <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{rule.opis}</div>
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                                    {rule.kategoria}
                                  </span>
                                  <span className="text-[9px] font-bold text-amber-800">
                                    Domyślny próg: {rule.domyslnyProg}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* FORMULARZ DANYCH ODZNAKI */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="sm:col-span-2 border-b border-slate-100 pb-2">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        2. Ustal próg i dane graficzne odznaki:
                      </label>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nazwa odznaki *</label>
                      <input type="text" value={newBadgeNazwa} onChange={(e) => setNewBadgeNazwa(e.target.value)} placeholder="np. Mistrz Hyrox" className="w-full p-3 border rounded-xl text-xs font-bold bg-white" required />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-amber-800 uppercase block mb-1">🎯 Wartość progowa (Próg osiągnięcia) *</label>
                      <input 
                        type="number" 
                        min="1" 
                        value={newBadgeWartoscProgowa} 
                        onChange={(e) => setNewBadgeWartoscProgowa(e.target.value)} 
                        disabled={newBadgeTypReguly === 'REJESTRACJA' || newBadgeTypReguly === 'RECZNA'}
                        className="w-full p-3 border-2 border-amber-400 rounded-xl text-xs font-black bg-white disabled:bg-slate-100 disabled:text-slate-400" 
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Grafika / Ikona (Emoji lub URL)</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="file" 
                          accept="image/*" 
                          id="new-badge-file-upload"
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setIsUploadingNewBadge(true);
                              const url = await uploadBadgeImageFile(file);
                              if (url) setNewBadgeIkona(url);
                              setIsUploadingNewBadge(false);
                            }
                          }} 
                        />
                        <label 
                          htmlFor="new-badge-file-upload" 
                          className="bg-slate-900 text-white font-bold text-xs px-4 py-3 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors shrink-0"
                        >
                          {isUploadingNewBadge ? "Wgrywanie..." : "📷 Plik"}
                        </label>
                        <input 
                          type="text" 
                          value={newBadgeIkona} 
                          onChange={(e) => setNewBadgeIkona(e.target.value)} 
                          placeholder="Wpisz Emoji (np. ⚡) lub URL" 
                          className="flex-1 p-3 border rounded-xl text-xs font-bold bg-white" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Punkty (Waga odznaki)</label>
                        <input type="number" min="1" max="10" value={newBadgePunkty} onChange={(e) => setNewBadgePunkty(e.target.value)} className="w-full p-3 border rounded-xl text-xs font-bold bg-white" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Kategoria</label>
                        <input type="text" value={newBadgeKategoria} onChange={(e) => setNewBadgeKategoria(e.target.value)} className="w-full p-3 border rounded-xl text-xs font-bold bg-white" />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Krótki opis motywacyjny</label>
                      <input type="text" value={newBadgeOpis} onChange={(e) => setNewBadgeOpis(e.target.value)} placeholder="np. Zaliczyłeś minimum 10 potwierdzonych treningów HYROX!" className="w-full p-3 border rounded-xl text-xs font-bold bg-white" required />
                    </div>
                    
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Warunek otrzymania (Dla klubowiczów w gablotce)</label>
                      <textarea value={newBadgeWarunek} onChange={(e) => setNewBadgeWarunek(e.target.value)} placeholder="np. Uczestnictwo w min. 10 treningach HYROX potwierdzone obecnością przez trenera." className="w-full p-3 border rounded-xl text-xs font-bold bg-white h-16 resize-none" />
                    </div>

                    <div className="sm:col-span-2">
                      <button type="submit" disabled={isUploadingNewBadge} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md">
                        + Utwórz i aktywuj odznakę w klubie
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* LISTA AKTYWNYCH ODZNAK */}
              <div className="space-y-4">
                <h3 className="font-black text-xs uppercase text-slate-900">Aktualne odznaki w katalogu ({wszystkieOdznaki.length}):</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {wszystkieOdznaki.map((def: any) => (
                    <div key={def.id} className="p-5 bg-white rounded-3xl border border-sky-100 shadow-sm space-y-3 flex flex-col justify-between">
                      {editingBadgeId === def.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Nazwa odznaki</label>
                            <input value={editBadgeNazwa} onChange={(e) => setEditBadgeNazwa(e.target.value)} className="w-full p-2 border rounded-xl text-xs font-bold" />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Zdjęcie / Ikona</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input 
                                type="file" 
                                accept="image/*" 
                                id={`edit-badge-file-${def.id}`} 
                                className="hidden" 
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setIsUploadingEditBadge(true);
                                    const url = await uploadBadgeImageFile(file);
                                    if (url) setEditBadgeIkona(url);
                                    setIsUploadingEditBadge(false);
                                  }
                                }} 
                              />
                              <label htmlFor={`edit-badge-file-${def.id}`} className="bg-slate-800 text-white font-bold text-[10px] px-3 py-2 rounded-xl cursor-pointer shrink-0">
                                {isUploadingEditBadge ? "Wgrywanie..." : "📷 Plik"}
                              </label>
                              <input value={editBadgeIkona} onChange={(e) => setEditBadgeIkona(e.target.value)} className="flex-1 p-2 border rounded-xl text-xs" />
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Opis</label>
                            <input value={editBadgeOpis} onChange={(e) => setEditBadgeOpis(e.target.value)} className="w-full p-2 border rounded-xl text-xs" />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Warunek</label>
                            <textarea value={editBadgeWarunek} onChange={(e) => setEditBadgeWarunek(e.target.value)} className="w-full p-2 border rounded-xl text-xs h-14 resize-none" />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-amber-700 uppercase">Typ reguły</label>
                              <select 
                                value={editBadgeTypReguly} 
                                onChange={(e) => setEditBadgeTypReguly(e.target.value)} 
                                className="w-full p-2 border border-amber-300 rounded-xl text-xs font-bold"
                              >
                                {REGUŁY_KATALOG.map(r => (
                                  <option key={r.id} value={r.id}>{r.nazwa}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-amber-700 uppercase">Próg</label>
                              <input 
                                type="number" 
                                min="1" 
                                value={editBadgeWartoscProgowa} 
                                onChange={(e) => setEditBadgeWartoscProgowa(e.target.value)} 
                                className="w-full p-2 border border-amber-300 rounded-xl text-xs font-bold" 
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Punkty</label>
                              <input type="number" min="1" max="10" value={editBadgePunkty} onChange={(e) => setEditBadgePunkty(e.target.value)} className="w-full p-2 border rounded-xl text-xs font-bold" />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Kategoria</label>
                              <input value={editBadgeKategoria} onChange={(e) => setEditBadgeKategoria(e.target.value)} className="w-full p-2 border rounded-xl text-xs" />
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button onClick={() => handleSaveEditBadge(def.id)} disabled={isUploadingEditBadge} className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs cursor-pointer">Zapisz</button>
                            <button onClick={() => setEditingBadgeId(null)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-2 rounded-xl text-xs cursor-pointer">Anuluj</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-400/40 flex items-center justify-center text-3xl shadow-inner shrink-0 overflow-hidden">
                              {renderBadgeGraphic(def.ikona, "w-16 h-16", "text-3xl")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-black text-xs uppercase text-slate-900 truncate">{def.nazwa}</h4>
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-2 py-0.5 rounded-full shrink-0">{def.punkty || 1} pkt</span>
                              </div>
                              <p className="text-[10px] text-slate-600 mt-1">{def.opis}</p>
                              {def.warunek && (
                                <p className="text-[9px] text-amber-900/80 mt-1 font-mono">🎯 Warunek: {def.warunek}</p>
                              )}
                              <div className="flex flex-wrap gap-2 items-center mt-1.5">
                                <span className="text-[9px] text-sky-600 font-bold uppercase tracking-wider">Kat: {def.kategoria || 'Treningi'}</span>
                                <span className="text-[9px] bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-lg border border-amber-200">
                                  {formatRegulaLabel(def.typ_reguly, def.wartosc_progowa)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-3 border-t border-slate-100 justify-end">
                            <button onClick={() => handleStartEditBadge(def)} className="text-xs font-bold text-sky-600 hover:text-sky-800 px-3 py-1.5 rounded-lg hover:bg-sky-50 transition-colors cursor-pointer">Edytuj</button>
                            <button onClick={() => handleDeleteBadgeDef(def.id)} className="text-xs font-bold text-rose-600 hover:text-rose-800 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer">Usuń</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {adminSubTab === 'dyscypliny' && (
            <div className="space-y-4">
              <h3 className="font-black text-xs uppercase text-slate-900">Zarządzaj dyscyplinami:</h3>
              <div className="flex gap-2">
                <input value={newDyscyplina} onChange={(e) => setNewDyscyplina(e.target.value)} placeholder="Nowa dyscyplina..." className="p-3 border rounded-xl flex-1 text-xs font-bold" />
                <button onClick={handleAddDyscyplina} className="bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-800">Dodaj</button>
              </div>
              
              <div className="space-y-2 pt-2">
                {dyscyplinyList.map((d, i) => (
                  <div key={d.id} className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between text-xs border border-slate-100">
                    {editingIndex === i ? (
                      <div className="flex gap-2 flex-1 mr-2">
                        <input value={editText} onChange={(e) => setEditText(e.target.value)} className="p-2 border rounded-xl flex-1 text-xs font-bold bg-white" />
                        <button onClick={() => handleUpdateDyscyplina(d.id, editText)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-bold cursor-pointer">Zapisz</button>
                        <button onClick={() => {setEditingIndex(null); setEditText("");}} className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold cursor-pointer">Anuluj</button>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-slate-800">{d.nazwa}</span>
                        <div className="flex gap-2">
                          <button onClick={() => {setEditingIndex(i); setEditText(d.nazwa);}} className="text-sky-600 font-bold hover:underline cursor-pointer px-2 py-1">Edytuj</button>
                          <button onClick={() => handleDeleteDyscyplina(d.id)} className="text-rose-600 font-bold hover:underline cursor-pointer px-2 py-1">Usuń</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL ZOOM */}
      {selectedBadgeForZoom && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full p-8 shadow-2xl space-y-6 text-center border border-sky-100 relative">
            <button 
              onClick={() => setSelectedBadgeForZoom(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 font-bold text-base bg-slate-100 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors"
            >
              ✕
            </button>

            <div className="flex justify-center pt-2">
              <div className="w-32 h-32 rounded-3xl bg-amber-500/10 border-2 border-amber-400/60 flex items-center justify-center text-6xl shadow-inner overflow-hidden">
                {renderBadgeGraphic(selectedBadgeForZoom.ikona, "w-32 h-32", "text-6xl")}
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-block bg-amber-100 text-amber-800 font-black text-xs px-3 py-1 rounded-full">
                {selectedBadgeForZoom.punkty || 1} punktów
              </div>
              <h3 className="font-black text-base uppercase text-slate-950 tracking-wider">
                {selectedBadgeForZoom.nazwa}
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                {selectedBadgeForZoom.opis}
              </p>
              {selectedBadgeForZoom.warunek && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-900 font-mono mt-3">
                  🎯 <b>Warunek:</b> {selectedBadgeForZoom.warunek}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button 
                onClick={() => setSelectedBadgeForZoom(null)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 rounded-2xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Zamknij okienko
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ZWYCIĘZCY */}
      {isWinnerModalOpen && challengeToResolve && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-2xl space-y-4 border border-sky-100">
            <h3 className="font-black text-sm text-slate-950">Wybierz zwycięzcę wyzwania</h3>
            <p className="text-xs text-slate-500">Dyscyplina: <span className="font-bold text-slate-800">{challengeToResolve.dyscyplina}</span></p>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 block">Wskaż zwycięzcę:</label>
              <select 
                value={selectedWinnerId || ""} 
                onChange={(e) => setSelectedWinnerId(e.target.value)} 
                className="w-full p-3 border border-sky-100 rounded-2xl text-xs font-bold bg-white"
              >
                <option value={challengeToResolve.tworca_id}>
                  {getClientName(challengeToResolve.tworca_id)} (Rzucający)
                </option>
                <option value={challengeToResolve.przeciwnik_id}>
                  {getClientName(challengeToResolve.przeciwnik_id)} (Przeciwnik)
                </option>
              </select>
            </div>

            <div className="flex gap-2 pt-4">
              <button onClick={() => setIsWinnerModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 font-bold p-3 rounded-2xl text-xs cursor-pointer">Anuluj</button>
              <button onClick={handleConfirmWinner} className="flex-1 bg-emerald-600 text-white font-black p-3 rounded-2xl text-xs cursor-pointer">Zatwierdź wynik</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INSTRUKCJA */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[2rem] max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-black text-lg">Jak robić wyzwania?</h3>
            <ul className="text-xs space-y-3 text-slate-700 list-decimal pl-4">
              <li>Rzuć wyzwanie przeciwnikowi w aplikacji.</li>
              <li>Jeśli wyzwanie odbywa się na treningu, <b>trener potwierdza wynik</b> bezpośrednio w klubie.</li>
              <li>Jeśli wyzwanie to bieg/teren/żywienie, <b>musisz przedstawić dowód</b> (np. zrzut z zegarka lub raport dietetyczny).</li>
              <li>Administrator po sprawdzeniu dowodów zatwierdza wyzwanie i przyznaje status "Zweryfikowane".</li>
            </ul>
            <button onClick={() => setIsInfoModalOpen(false)} className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl text-xs cursor-pointer">Rozumiem</button>
          </div>
        </div>
      )}

      {/* MODAL RZUCANIA WYZWANIA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-2xl space-y-4 border border-sky-100 relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-black text-sm text-sky-950">
              {modalKategoria === 'zywienie' ? '🥗 Rzuć wyzwanie żywieniowe' : '⚔️ Rzuć wyzwanie sportowe'}
            </h3>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModalKategoria('sport')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${modalKategoria === 'sport' ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'}`}
              >
                ⚔️ Sportowe
              </button>
              <button
                type="button"
                onClick={() => setModalKategoria('zywienie')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${modalKategoria === 'zywienie' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                🥗 Żywieniowe
              </button>
            </div>
            
            <div className="relative">
              <input type="text" placeholder="Szukaj przeciwnika..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full p-3 border border-sky-100 rounded-2xl bg-sky-50 text-xs font-bold" />
              {searchQuery.length > 0 && !selectedOpponent && (
                <div className="absolute w-full mt-1 bg-white border border-sky-100 rounded-2xl shadow-lg z-50 p-1">
                  {filteredOpponents.map(opp => (
                    <button key={opp.id} onClick={() => { setSelectedOpponent(opp); setSearchQuery(""); }} className="w-full text-left p-2 hover:bg-sky-50 rounded-xl text-xs font-bold text-slate-700">{opp.name}</button>
                  ))}
                </div>
              )}
              {selectedOpponent && (
                <div className="bg-emerald-50 text-emerald-900 p-3 rounded-2xl text-xs font-bold mt-2">Wybrano: {selectedOpponent.name}</div>
              )}
            </div>

            <select value={dyscyplina} onChange={(e) => setDyscyplina(e.target.value)} className="w-full p-3 border border-sky-100 rounded-2xl text-xs font-bold bg-white">
               {dyscyplinyList.map(d => <option key={d.id} value={d.nazwa}>{d.nazwa}</option>)}
            </select>
            <textarea placeholder="Dodatkowy opis zadania / wyzwania..." value={opisWyzwania} onChange={(e) => setOpisWyzwania(e.target.value)} className="w-full p-3 border border-sky-100 rounded-2xl text-xs font-bold h-20 resize-none" />
            
            <div className="flex gap-2 pt-2">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 font-bold p-3 rounded-2xl text-xs cursor-pointer">Anuluj</button>
              <button onClick={handleCreateChallenge} className="flex-1 bg-amber-500 text-slate-950 font-black p-3 rounded-2xl text-xs cursor-pointer">Wyślij</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
