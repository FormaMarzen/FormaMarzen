"use client";

import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../raporty/klienci/supabase";

interface Klient {
  id: number | string;
  Imię: string;
  Nazwisko: string;
  "E-mail": string;
  "Numer tel."?: string;
  Płeć?: string;
  plec?: string;
  gender?: string;
  Urodziny?: string;
  avatarUrl?: string;
  AvatarUrl?: string;
}

interface AnalizaFormyWpis {
  id: number;
  created_at: string;
  klient_id: number;
  email_klienta: string;
  data_pomiaru: string;
  wzrost?: number | null;
  // Obwody
  obwod_pasa?: number | null;
  klatka?: number | null;
  ramie?: number | null;
  talia?: number | null;
  biodra?: number | null;
  udo?: number | null;
  lydka?: number | null;
  // Skład ciała
  waga: number;
  tkanka_tluszczowa?: number | null;
  miesnie?: number | null;
  kosci?: number | null;
  wiek_metaboliczny?: number | null;
  woda?: number | null;
  tluszcz_wisceralny?: number | null;
  // Dieta i Makro
  kcal?: number | null;
  bialko?: number | null;
  tluszcz?: number | null;
  weglowodany?: number | null;
  // Notatki
  uwagi_trenera?: string | null;
  notatki_klubowicza?: string | null;
}

interface RedukcjaEdycja {
  id: number;
  nazwa: string;
  data_start: string;
  data_koniec: string;
  wpisowe_kwota: number;
  opis: string;
  status: 'zapisy' | 'aktywne' | 'zakonczone';
}

interface RedukcjaUczestnik {
  id: number;
  edycja_id: number;
  klient_id: number | string;
  oplacone: boolean;
  metoda_platnosci?: 'autopay' | 'gotowka' | 'inna';
  punkty_calkowite: number;
  data_zapisu: string;
  klient?: Klient;
}

interface RedukcjaPomiar {
  id: number;
  edycja_id: number;
  klient_id: number | string;
  etap: 'start' | 'koniec';
  data_pomiaru: string;
  waga_kg: number;
  fat_proc: number;
  muscle_kg: number;
  visceral_level: number;
}

// ROZWIĄZANIE PROBLEMU LIMITU 1000 REKORDÓW SUPABASE Z OBSŁUGĄ WYBRANYCH KOLUMN
const fetchAllFromSupabase = async (
  table: string, 
  selectQuery: string = '*', 
  orderBy: string = 'id', 
  ascending: boolean = false, 
  maxPages: number = 5
) => {
  let result: any[] = [];
  for (let i = 0; i < maxPages; i++) {
    const { data, error } = await supabase
      .from(table)
      .select(selectQuery)
      .order(orderBy, { ascending })
      .range(i * 1000, (i + 1) * 1000 - 1);
    
    if (error) {
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

export default function AnalizaFormyPage() {
  const [activeTab, setActiveTab] = useState<'pomiary' | 'makro' | 'redukcja'>('pomiary');
  const [appRole, setAppRole] = useState<'admin' | 'trener' | 'klubowicz'>('klubowicz');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<number | string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Wyszukiwarka i wybór klienta dla Admina / Trenera
  const [klienci, setKlienci] = useState<Klient[]>([]);
  const [selectedKlient, setSelectedKlient] = useState<Klient | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);

  // Pomiary ogólne i formularze (Zakładka 1 & 2)
  const [measurements, setMeasurements] = useState<AnalizaFormyWpis[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingMeasurementId, setEditingMeasurementId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Stany dla Modułu Wyzwania Redukcji (Zakładka 3)
  const [edycjeRedukcji, setEdycjeRedukcji] = useState<RedukcjaEdycja[]>([]);
  const [selectedEdycjaId, setSelectedEdycjaId] = useState<number | null>(null);
  const [uczestnicyRedukcji, setUczestnicyRedukcji] = useState<RedukcjaUczestnik[]>([]);
  const [pomiaryRedukcji, setPomiaryRedukcji] = useState<RedukcjaPomiar[]>([]);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  
  // Modale dla Redukcji
  const [isNewEdycjaModalOpen, setIsNewEdycjaModalOpen] = useState<boolean>(false);
  const [isRedukcjaPomiarModalOpen, setIsRedukcjaPomiarModalOpen] = useState<boolean>(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'autopay' | 'gotowka'>('autopay');
  const [targetPomiarEtap, setTargetPomiarEtap] = useState<'start' | 'koniec'>('start');
  const [targetPomiarKlientId, setTargetPomiarKlientId] = useState<number | string | null>(null);

  // Formularz nowej edycji wyzwania
  const [edycjaFormData, setEdycjaFormData] = useState({
    nazwa: "Wyzwanie Redukcji Tkanki Tłuszczowej",
    data_start: new Date().toISOString().split('T')[0],
    data_koniec: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    wpisowe_kwota: "30.00",
    opis: "Wspólne wyzwanie utraty tkanki tłuszczowej. Pomiary na analizatorze na początku i końcu wyzwania. Pula nagród finansowana z wpisowego!",
    status: 'aktywne'
  });

  // Formularz pomiaru analizy składu ciała w wyzwaniu (Tylko Admin)
  const [redukcjaPomiarForm, setRedukcjaPomiarForm] = useState({
    data_pomiaru: new Date().toISOString().split('T')[0],
    waga_kg: '',
    fat_proc: '',
    muscle_kg: '',
    visceral_level: ''
  });

  // Stan formularza nowego / edytowanego pomiaru ogólnego
  const [formData, setFormData] = useState({
    data_pomiaru: new Date().toISOString().split('T')[0],
    wzrost: '',
    waga: '',
    obwod_pasa: '',
    klatka: '',
    ramie: '',
    talia: '',
    biodra: '',
    udo: '',
    lydka: '',
    tkanka_tluszczowa: '',
    miesnie: '',
    kosci: '',
    wiek_metaboliczny: '',
    woda: '',
    tluszcz_wisceralny: '',
    kcal: '',
    bialko: '',
    tluszcz: '',
    weglowodany: '',
    uwagi_trenera: '',
    notatki_klubowicza: ''
  });

  // Stany dla Kalkulatora Katch-McArdle
  const [calcWeight, setCalcWeight] = useState<string>('');
  const [calcFat, setCalcFat] = useState<string>('');
  const [calcGender, setCalcGender] = useState<string>('mezczyzna');
  const [calcPal, setCalcPal] = useState<string>('1.4');
  const [calcGoal, setCalcGoal] = useState<string>('-0.2');
  const [calcResult, setCalcResult] = useState<{
    bmr: number;
    tdee: number;
    targetKcal: number;
    protein: number;
    fat: number;
    carbs: number;
  } | null>(null);

  // 1. Sprawdzanie uprawnień i sesji użytkownika
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const email = session.user.email || '';
        const cleanEmail = email.toLowerCase().trim();
        setCurrentUserEmail(cleanEmail);

        const clientsData = await fetchAllFromSupabase('klienci', '*', 'Nazwisko', true, 10);
        const mappedClients = (clientsData || []) as unknown as Klient[];
        setKlienci(mappedClients);

        const myClientProfile = mappedClients.find(c => (c['E-mail'] || '').toLowerCase().trim() === cleanEmail);
        if (myClientProfile) {
          setCurrentUserId(myClientProfile.id);
        }

        if (cleanEmail === 'maciejklaput@gmail.com' || cleanEmail === 'maciejklaput@icloud.com') {
          setAppRole('admin');
        } else {
          const { data: trenerData } = await supabase
            .from('trenerzy')
            .select('*')
            .ilike('email', cleanEmail)
            .maybeSingle();

          if (trenerData) {
            setAppRole('trener');
            if (myClientProfile) {
              setSelectedKlient(myClientProfile);
              const g = (myClientProfile.gender || myClientProfile.Płeć || myClientProfile.plec || '').toLowerCase();
              if (g.includes('kobieta') || g === 'k') setCalcGender('kobieta');
              else if (g.includes('mężczyzna') || g.includes('mezczyzna') || g === 'm') setCalcGender('mezczyzna');
              await fetchMeasurements(myClientProfile.id, cleanEmail);
            }
          } else {
            setAppRole('klubowicz');
            if (myClientProfile) {
              setSelectedKlient(myClientProfile);
              const g = (myClientProfile.gender || myClientProfile.Płeć || myClientProfile.plec || '').toLowerCase();
              if (g.includes('kobieta') || g === 'k') setCalcGender('kobieta');
              else if (g.includes('mężczyzna') || g.includes('mezczyzna') || g === 'm') setCalcGender('mezczyzna');
              await fetchMeasurements(myClientProfile.id, cleanEmail);
            }
          }
        }

        await fetchRedukcjaData();
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // 2. Pobieranie danych modułu redukcji
  const fetchRedukcjaData = async () => {
    try {
      const edycjeData = await fetchAllFromSupabase('klub_redukcja_edycje', '*', 'id', false, 2);
      if (edycjeData && edycjeData.length > 0) {
        setEdycjeRedukcji(edycjeData as RedukcjaEdycja[]);
        const active = edycjeData.find((e: any) => e.status === 'aktywne') || edycjeData[0];
        setSelectedEdycjaId(active.id);
        await loadEdycjaDetails(active.id);
      }
    } catch (err) {
      console.error("Błąd ładowania wyzwań redukcji:", err);
    }
  };

  const loadEdycjaDetails = async (edycjaId: number) => {
    try {
      const [uczestnicyRes, pomiaryRes] = await Promise.all([
        supabase.from('klub_redukcja_uczestnicy').select('*').eq('edycja_id', edycjaId),
        supabase.from('klub_redukcja_pomiary').select('*').eq('edycja_id', edycjaId)
      ]);

      if (uczestnicyRes.data) {
        setUczestnicyRedukcji(uczestnicyRes.data as RedukcjaUczestnik[]);
      }
      if (pomiaryRes.data) {
        setPomiaryRedukcji(pomiaryRes.data as RedukcjaPomiar[]);
      }
    } catch (err) {
      console.error("Błąd ładowania szczegółów edycji:", err);
    }
  };

  useEffect(() => {
    if (selectedEdycjaId) {
      loadEdycjaDetails(selectedEdycjaId);
    }
  }, [selectedEdycjaId]);

  // 3. Pobieranie pomiarów ogólnych dla wybranego użytkownika
  const fetchMeasurements = async (klientId: number | string, email: string) => {
    let query = supabase
      .from('analiza_formy')
      .select('*')
      .order('data_pomiaru', { ascending: false });

    if (klientId) {
      query = query.or(`klient_id.eq.${klientId},email_klienta.ilike.${email.trim()}`);
    } else {
      query = query.ilike('email_klienta', email.trim());
    }

    const { data, error } = await query;
    if (data && !error) {
      setMeasurements(data as AnalizaFormyWpis[]);
    } else {
      setMeasurements([]);
    }
  };

  const handleSelectClient = (klient: Klient) => {
    setSelectedKlient(klient);
    setSearchQuery(`${klient.Imię} ${klient.Nazwisko}`);
    setIsSearchFocused(false);

    const g = (klient.gender || klient.Płeć || klient.plec || '').toLowerCase();
    if (g.includes('kobieta') || g === 'k') setCalcGender('kobieta');
    else if (g.includes('mężczyzna') || g.includes('mezczyzna') || g === 'm') setCalcGender('mezczyzna');

    fetchMeasurements(klient.id, klient['E-mail']);
  };

  // Obsługa zapisu pomiaru ogólnego (Zakładka 1)
  const handleSubmitMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetKlientId = selectedKlient ? selectedKlient.id : null;
    const targetEmail = selectedKlient ? selectedKlient['E-mail'] : currentUserEmail;

    if (!formData.waga) {
      alert("Waga jest polem wymaganym.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      klient_id: targetKlientId,
      email_klienta: targetEmail,
      data_pomiaru: formData.data_pomiaru,
      wzrost: formData.wzrost ? parseFloat(formData.wzrost) : null,
      waga: parseFloat(formData.waga),
      obwod_pasa: formData.obwod_pasa ? parseFloat(formData.obwod_pasa) : null,
      klatka: formData.klatka ? parseFloat(formData.klatka) : null,
      ramie: formData.ramie ? parseFloat(formData.ramie) : null,
      talia: formData.talia ? parseFloat(formData.talia) : null,
      biodra: formData.biodra ? parseFloat(formData.biodra) : null,
      udo: formData.udo ? parseFloat(formData.udo) : null,
      lydka: formData.lydka ? parseFloat(formData.lydka) : null,
      tkanka_tluszczowa: formData.tkanka_tluszczowa ? parseFloat(formData.tkanka_tluszczowa) : null,
      miesnie: formData.miesnie ? parseFloat(formData.miesnie) : null,
      kosci: formData.kosci ? parseFloat(formData.kosci) : null,
      wiek_metaboliczny: formData.wiek_metaboliczny ? parseInt(formData.wiek_metaboliczny) : null,
      woda: formData.woda ? parseFloat(formData.woda) : null,
      tluszcz_wisceralny: formData.tluszcz_wisceralny ? parseInt(formData.tluszcz_wisceralny) : null,
      kcal: formData.kcal ? parseInt(formData.kcal) : null,
      bialko: formData.bialko ? parseFloat(formData.bialko) : null,
      tluszcz: formData.tluszcz ? parseFloat(formData.tluszcz) : null,
      weglowodany: formData.weglowodany ? parseFloat(formData.weglowodany) : null,
      uwagi_trenera: formData.uwagi_trenera || null,
      notatki_klubowicza: formData.notatki_klubowicza || null
    };

    let error = null;

    if (editingMeasurementId) {
      const res = await supabase
        .from('analiza_formy')
        .update(payload)
        .eq('id', editingMeasurementId);
      error = res.error;
    } else {
      const res = await supabase
        .from('analiza_formy')
        .insert([payload]);
      error = res.error;
    }

    setIsSubmitting(false);

    if (error) {
      alert("Błąd zapisu pomiaru: " + error.message);
    } else {
      alert(editingMeasurementId ? "Pomiar został pomyślnie zaktualizowany!" : "Nowy pomiar został pomyślnie dodany!");
      setIsAddModalOpen(false);
      setEditingMeasurementId(null);

      if (selectedKlient) {
        fetchMeasurements(selectedKlient.id, selectedKlient['E-mail']);
      } else {
        fetchMeasurements(0, currentUserEmail);
      }
    }
  };

  const handleDeleteMeasurement = async (id: number) => {
    if (!confirm("Czy na pewno chcesz trwale usunąć ten pomiar?")) return;
    const { error } = await supabase.from('analiza_formy').delete().eq('id', id);
    if (!error) {
      setMeasurements(prev => prev.filter(m => m.id !== id));
    } else {
      alert("Błąd podczas usuwania: " + error.message);
    }
  };

  // =========================================================================
  // LOGIKA PŁATNOŚCI AUTOPAY ORAZ GOTÓWKĄ DLA WYZWANIA REDUKCJI (ZAKŁADKA 3)
  // =========================================================================

  const handleCreateEdycja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edycjaFormData.nazwa.trim()) return;

    const { data, error } = await supabase.from('klub_redukcja_edycje').insert([{
      nazwa: edycjaFormData.nazwa.trim(),
      data_start: edycjaFormData.data_start,
      data_koniec: edycjaFormData.data_koniec,
      wpisowe_kwota: parseFloat(edycjaFormData.wpisowe_kwota) || 30.00,
      opis: edycjaFormData.opis.trim(),
      status: edycjaFormData.status
    }]).select();

    if (!error && data) {
      alert("Nowa edycja wyzwania została utworzona!");
      setIsNewEdycjaModalOpen(false);
      await fetchRedukcjaData();
    } else {
      alert("Błąd tworzenia edycji: " + error?.message);
    }
  };

  // Inicjacja dołączenia i wyboru metody płatności
  const handleConfirmJoinWithPayment = async () => {
    const kId = selectedKlient?.id || currentUserId;
    if (!kId || !selectedEdycjaId) {
      alert("Nie można zidentyfikować profilu klubowicza.");
      return;
    }

    const edycja = edycjeRedukcji.find(e => e.id === selectedEdycjaId);
    const kwota = edycja?.wpisowe_kwota || 30.00;

    // 1. PŁATNOŚĆ ONLINE (AUTOPAY)
    if (selectedPaymentMethod === 'autopay') {
      setIsProcessingPayment(true);
      try {
        const response = await fetch('/api/autopay/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: kId,
            email: selectedKlient ? selectedKlient['E-mail'] : currentUserEmail,
            title: `Wpisowe: ${edycja?.nazwa || 'Wyzwanie Redukcji'}`,
            amount: kwota,
            service_type: 'redukcja',
            edycja_id: selectedEdycjaId
          })
        });

        const data = await response.json();

        // Dodajemy wstępny rekord uczestnika
        await supabase.from('klub_redukcja_uczestnicy').upsert([{
          edycja_id: selectedEdycjaId,
          klient_id: kId,
          oplacone: false,
          metoda_platnosci: 'autopay',
          punkty_calkowite: 0.00
        }], { onConflict: 'edycja_id,klient_id' });

        if (data && (data.paymentUrl || data.url)) {
          window.location.href = data.paymentUrl || data.url;
          return;
        } else {
          // Fallback symulacyjny jeśli endpoint nie zwraca zewnętrznego URL
          alert("Zapisano do wyzwania z metodą Autopay! Jeśli płatność się powiodła, odśwież stronę.");
          setIsJoinModalOpen(false);
          await loadEdycjaDetails(selectedEdycjaId);
        }
      } catch (err) {
        console.error("Błąd inicjowania płatności Autopay:", err);
        alert("Wystąpił problem z połączeniem z Autopay. Spróbuj ponownie lub wybierz gotówkę.");
      } finally {
        setIsProcessingPayment(false);
      }
    } 
    // 2. PŁATNOŚĆ GOTÓWKĄ NA RECEPCJI
    else {
      const { error } = await supabase.from('klub_redukcja_uczestnicy').upsert([{
        edycja_id: selectedEdycjaId,
        klient_id: kId,
        oplacone: false,
        metoda_platnosci: 'gotowka',
        punkty_calkowite: 0.00
      }], { onConflict: 'edycja_id,klient_id' });

      if (!error) {
        alert("Zostałeś pomyślnie zarejestrowany! Wybrałeś płatność gotówką na recepcji — poproś trenera o potwierdzenie wpłaty w systemie.");
        setIsJoinModalOpen(false);
        await loadEdycjaDetails(selectedEdycjaId);
      } else {
        alert("Błąd zapisu: " + error.message);
      }
    }
  };

  // Bezpośredni checkbox / przełącznik opłacenia przez Admina / Trenera
  const handleCheckboxPaymentToggle = async (uczestnikId: number, newStatus: boolean) => {
    const { error } = await supabase
      .from('klub_redukcja_uczestnicy')
      .update({ oplacone: newStatus })
      .eq('id', uczestnikId);

    if (!error && selectedEdycjaId) {
      await loadEdycjaDetails(selectedEdycjaId);
    } else if (error) {
      alert("Błąd aktualizacji statusu płatności: " + error.message);
    }
  };

  const handleOpenRedukcjaPomiarModal = (etap: 'start' | 'koniec', klientId: number | string) => {
    setTargetPomiarEtap(etap);
    setTargetPomiarKlientId(klientId);

    const existing = pomiaryRedukcji.find(p => String(p.klient_id) === String(klientId) && p.etap === etap);

    setRedukcjaPomiarForm({
      data_pomiaru: existing ? existing.data_pomiaru : new Date().toISOString().split('T')[0],
      waga_kg: existing ? String(existing.waga_kg) : '',
      fat_proc: existing ? String(existing.fat_proc) : '',
      muscle_kg: existing ? String(existing.muscle_kg) : '',
      visceral_level: existing ? String(existing.visceral_level) : ''
    });

    setIsRedukcjaPomiarModalOpen(true);
  };

  const handleSaveRedukcjaPomiar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEdycjaId || !targetPomiarKlientId) return;

    const payload = {
      edycja_id: selectedEdycjaId,
      klient_id: targetPomiarKlientId,
      etap: targetPomiarEtap,
      data_pomiaru: redukcjaPomiarForm.data_pomiaru,
      waga_kg: parseFloat(redukcjaPomiarForm.waga_kg),
      fat_proc: parseFloat(redukcjaPomiarForm.fat_proc),
      muscle_kg: parseFloat(redukcjaPomiarForm.muscle_kg),
      visceral_level: parseInt(redukcjaPomiarForm.visceral_level)
    };

    const { error } = await supabase
      .from('klub_redukcja_pomiary')
      .upsert(payload, { onConflict: 'edycja_id,klient_id,etap' });

    if (!error) {
      await supabase.rpc('fn_przelicz_wynik_redukcji', {
        p_edycja_id: selectedEdycjaId,
        p_klient_id: targetPomiarKlientId
      });

      alert(`Pomiar ${targetPomiarEtap === 'start' ? 'POCZĄTKOWY' : 'KOŃCOWY'} został pomyślnie zapisany!`);
      setIsRedukcjaPomiarModalOpen(false);
      await loadEdycjaDetails(selectedEdycjaId);
    } else {
      alert("Błąd zapisu pomiaru: " + error.message);
    }
  };

  const activeEdycjaObj = edycjeRedukcji.find(e => e.id === selectedEdycjaId) || null;
  const activeUserKlientId = selectedKlient?.id || currentUserId;
  const isCurrentUserJoined = uczestnicyRedukcji.some(u => String(u.klient_id) === String(activeUserKlientId));
  const activeUserParticipant = uczestnicyRedukcji.find(u => String(u.klient_id) === String(activeUserKlientId));

  const rankingRedukcji = useMemo(() => {
    return uczestnicyRedukcji.map(uczestnik => {
      const klientObj = klienci.find(k => String(k.id) === String(uczestnik.klient_id));
      const startP = pomiaryRedukcji.find(p => String(p.klient_id) === String(uczestnik.klient_id) && p.etap === 'start');
      const koniecP = pomiaryRedukcji.find(p => String(p.klient_id) === String(uczestnik.klient_id) && p.etap === 'koniec');

      let pktWaga = 0;
      let pktFat = 0;
      let pktMuscle = 0;
      let pktVisceral = 0;
      let totalPkt = 0;
      let hasBoth = false;

      let deltaWagaKg = 0;
      let deltaWagaProc = 0;
      let deltaFatProc = 0;
      let deltaMuscleKg = 0;
      let deltaMuscleProc = 0;
      let deltaVisceral = 0;

      if (startP && koniecP) {
        hasBoth = true;
        deltaWagaKg = koniecP.waga_kg - startP.waga_kg;
        deltaWagaProc = ((startP.waga_kg - koniecP.waga_kg) / startP.waga_kg) * 100;
        deltaFatProc = startP.fat_proc - koniecP.fat_proc;
        deltaMuscleKg = koniecP.muscle_kg - startP.muscle_kg;
        deltaMuscleProc = ((koniecP.muscle_kg - startP.muscle_kg) / startP.muscle_kg) * 100;
        deltaVisceral = startP.visceral_level - koniecP.visceral_level;

        pktWaga = deltaWagaProc;
        pktFat = deltaFatProc * 1.5;
        pktMuscle = deltaMuscleProc * 1.2;
        pktVisceral = deltaVisceral * 2.0;

        totalPkt = parseFloat((pktWaga + pktFat + pktMuscle + pktVisceral).toFixed(2));
      }

      return {
        ...uczestnik,
        klientName: klientObj ? `${klientObj.Imię} ${klientObj.Nazwisko}` : 'Klubowicz',
        klientAvatar: klientObj?.avatarUrl || klientObj?.AvatarUrl || null,
        startP,
        koniecP,
        hasBoth,
        deltaWagaKg,
        deltaWagaProc,
        deltaFatProc,
        deltaMuscleKg,
        deltaMuscleProc,
        deltaVisceral,
        totalPkt
      };
    }).sort((a, b) => b.totalPkt - a.totalPkt);
  }, [uczestnicyRedukcji, pomiaryRedukcji, klienci]);

  const renderTrendIndicator = (val: number, isGoodWhenLower = true, unit = "") => {
    if (val === 0) return <span className="text-slate-400 font-bold">0.0 {unit}</span>;
    const isPositive = val > 0;
    const isGood = isGoodWhenLower ? !isPositive : isPositive;

    return (
      <span className={`inline-flex items-center gap-0.5 font-black text-xs ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
        <span>{isPositive ? '↑' : '↓'}</span>
        <span>{Math.abs(val).toFixed(1)}{unit}</span>
      </span>
    );
  };

  const searchResults = useMemo(() => {
    if (searchQuery.trim().length < 2) return [];
    return klienci.filter(k => 
      `${k.Imię || ''} ${k.Nazwisko || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k['E-mail']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k['Numer tel.'] && k['Numer tel.'].includes(searchQuery))
    ).slice(0, 8);
  }, [klienci, searchQuery]);

  const latestMeasurement = measurements[0] || null;
  const previousMeasurement = measurements[1] || null;

  const calculateDiff = (current?: number | null, previous?: number | null) => {
    if (current === undefined || current === null || previous === undefined || previous === null) return null;
    const diff = current - previous;
    return diff > 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`;
  };

  const chartData24Months = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 24);
    
    return [...measurements]
      .filter(m => new Date(m.data_pomiaru) >= cutoffDate)
      .sort((a, b) => new Date(a.data_pomiaru).getTime() - new Date(b.data_pomiaru).getTime());
  }, [measurements]);

  const calculateKatchMcArdle = () => {
    const w = parseFloat(calcWeight || (latestMeasurement ? String(latestMeasurement.waga) : '0'));
    const bf = parseFloat(calcFat || (latestMeasurement?.tkanka_tluszczowa ? String(latestMeasurement.tkanka_tluszczowa) : '0'));
    const pal = parseFloat(calcPal);
    const goalModifier = parseFloat(calcGoal);

    if (!w || w <= 0 || !bf || bf <= 0) {
      alert("Wprowadź prawidłową wagę (kg) oraz poziom tkanki tłuszczowej (%).");
      return;
    }

    const lbm = w * (1 - bf / 100);
    let bmr = 370 + (21.6 * lbm);

    if (calcGender === 'kobieta') {
      bmr *= 0.96;
    }

    const tdee = bmr * pal;
    const targetKcal = tdee * (1 + goalModifier);

    const proteinG = Math.round(lbm * 2.2);
    const fatG = Math.round(w * 0.9);
    const proteinKcal = proteinG * 4;
    const fatKcal = fatG * 9;
    const remainingKcal = Math.max(0, targetKcal - proteinKcal - fatKcal);
    const carbsG = Math.round(remainingKcal / 4);

    setCalcResult({
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      targetKcal: Math.round(targetKcal),
      protein: proteinG,
      fat: fatG,
      carbs: carbsG
    });
  };

  const renderLineChart = (
    title: string, 
    dataKey: keyof AnalizaFormyWpis, 
    unit: string, 
    strokeColor: string, 
    fillGradient: string
  ) => {
    const validPoints = chartData24Months
      .map(item => ({
        date: item.data_pomiaru,
        val: item[dataKey] !== null && item[dataKey] !== undefined ? Number(item[dataKey]) : null
      }))
      .filter((p): p is { date: string; val: number } => p.val !== null);

    if (validPoints.length < 2) {
      return (
        <div className="bg-white p-4 rounded-2xl border border-sky-200 shadow-sm flex flex-col justify-between">
          <div className="text-xs font-black text-sky-950 uppercase tracking-wider">{title} ({unit})</div>
          <div className="h-40 flex items-center justify-center text-xs text-slate-400 font-bold">
            Wymagane min. 2 pomiary w okresie 24 msc do wygenerowania wykresu.
          </div>
        </div>
      );
    }

    const minVal = Math.min(...validPoints.map(p => p.val));
    const maxVal = Math.max(...validPoints.map(p => p.val));
    const padding = (maxVal - minVal) === 0 ? 2 : (maxVal - minVal) * 0.15;
    const yMin = Math.max(0, minVal - padding);
    const yMax = maxVal + padding;

    const width = 360;
    const height = 150;
    const margin = { top: 15, right: 20, bottom: 25, left: 35 };

    const points = validPoints.map((p, index) => {
      const x = margin.left + (index / (validPoints.length - 1)) * (width - margin.left - margin.right);
      const y = height - margin.bottom - ((p.val - yMin) / (yMax - yMin)) * (height - margin.top - margin.bottom);
      return { x, y, val: p.val, date: p.date };
    });

    const pathD = points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x},${p.y}`, '');
    const areaD = `${pathD} L ${points[points.length - 1].x},${height - margin.bottom} L ${points[0].x},${height - margin.bottom} Z`;

    return (
      <div className="bg-white p-4 rounded-2xl border border-sky-200 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-sky-100 pb-2 mb-2">
          <div className="text-xs font-black text-sky-950 uppercase tracking-wider">{title}</div>
          <div className="text-xs font-black" style={{ color: strokeColor }}>
            Ost: {validPoints[validPoints.length - 1].val} {unit}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
            <defs>
              <linearGradient id={`grad-${String(dataKey)}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={fillGradient} stopOpacity="0.4" />
                <stop offset="100%" stopColor={fillGradient} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            <line x1={margin.left} y1={margin.top} x2={width - margin.right} y2={margin.top} stroke="#f1f5f9" strokeWidth="1" />
            <line x1={margin.left} y1={(height - margin.bottom + margin.top) / 2} x2={width - margin.right} y2={(height - margin.bottom + margin.top) / 2} stroke="#f1f5f9" strokeWidth="1" />
            <line x1={margin.left} y1={height - margin.bottom} x2={width - margin.right} y2={height - margin.bottom} stroke="#e2e8f0" strokeWidth="1" />

            <path d={areaD} fill={`url(#grad-${String(dataKey)})`} />
            <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {points.map((p, idx) => (
              <g key={idx}>
                <circle cx={p.x} cy={p.y} r="3.5" fill="#ffffff" stroke={strokeColor} strokeWidth="2" />
                <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#0f172a">
                  {p.val}
                </text>
                {(idx === 0 || idx === points.length - 1 || idx === Math.floor(points.length / 2)) && (
                  <text x={p.x} y={height - 8} textAnchor="middle" fontSize="8" fill="#64748b">
                    {p.date.substring(5)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sky-900 font-black text-sm tracking-wider uppercase animate-pulse flex items-center gap-2">
          <span>⚖️</span> Ładowanie Analizy Formy...
        </div>
      </div>
    );
  }

  const clientGenderDisplay = selectedKlient ? (selectedKlient.gender || selectedKlient.Płeć || selectedKlient.plec || 'Nie podano') : '';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* NAGŁÓWEK STRONY */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl border border-sky-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚖️</span>
            <h1 className="text-xl md:text-2xl font-black text-sky-950 uppercase tracking-wider">
              Analiza Formy i Pomiary
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {appRole === 'admin' 
              ? "Panel administratora: Wyszukaj podopiecznego, zarządzaj pomiarami, edytuj karty i plany makro" 
              : appRole === 'trener'
                ? "Twoje konto trenera: Zobacz swoje wyniki, pomiary oraz dietę lub wyszukaj podopiecznego"
                : "Twój dziennik postępów: Pomiary, skład ciała oraz wytyczne dietetyczne"}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {activeTab === 'pomiary' && ((appRole === 'admin' || (appRole === 'trener' && selectedKlient)) || appRole === 'klubowicz') && (
            <button
              onClick={() => {
                setEditingMeasurementId(null);
                setFormData({
                  data_pomiaru: new Date().toISOString().split('T')[0],
                  wzrost: measurements[0]?.wzrost ? String(measurements[0].wzrost) : '',
                  waga: '',
                  obwod_pasa: '',
                  klatka: '',
                  ramie: '',
                  talia: '',
                  biodra: '',
                  udo: '',
                  lydka: '',
                  tkanka_tluszczowa: '',
                  miesnie: '',
                  kosci: '',
                  wiek_metaboliczny: '',
                  woda: '',
                  tluszcz_wisceralny: '',
                  kcal: measurements[0]?.kcal ? String(measurements[0].kcal) : '',
                  bialko: measurements[0]?.bialko ? String(measurements[0].bialko) : '',
                  tluszcz: measurements[0]?.tluszcz ? String(measurements[0].tluszcz) : '',
                  weglowodany: measurements[0]?.weglowodany ? String(measurements[0].weglowodany) : '',
                  uwagi_trenera: '',
                  notatki_klubowicza: ''
                });
                setIsAddModalOpen(true);
              }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <span>+</span> {appRole === 'klubowicz' || appRole === 'trener' ? 'Dodaj swój pomiar' : 'Dodaj pomiar'}
            </button>
          )}

          {activeTab === 'redukcja' && appRole === 'admin' && (
            <button
              onClick={() => setIsNewEdycjaModalOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <span>+</span> Nowa edycja wyzwania
            </button>
          )}
        </div>
      </div>

      {/* PASEK ZAKŁADEK */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-sky-100/60 p-1.5 border border-sky-200 text-[11px] sm:text-xs font-bold shadow-inner">
        <button
          onClick={() => setActiveTab('pomiary')}
          className={`py-2.5 px-2 sm:py-3 sm:px-4 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center cursor-pointer ${
            activeTab === 'pomiary'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
              : 'text-slate-600 hover:text-sky-950 hover:bg-white/50'
          }`}
        >
          <span>📏</span> <span>1. Pomiary</span>
        </button>
        <button
          onClick={() => setActiveTab('makro')}
          className={`py-2.5 px-2 sm:py-3 sm:px-4 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center cursor-pointer ${
            activeTab === 'makro'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
              : 'text-slate-600 hover:text-sky-950 hover:bg-white/50'
          }`}
        >
          <span>🥗</span> <span>2. Dieta i Makro</span>
        </button>
        <button
          onClick={() => setActiveTab('redukcja')}
          className={`py-2.5 px-2 sm:py-3 sm:px-4 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center cursor-pointer ${
            activeTab === 'redukcja'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
              : 'text-slate-600 hover:text-sky-950 hover:bg-white/50'
          }`}
        >
          <span>🔥</span> <span>3. Redukcja</span>
        </button>
      </div>

      {/* WYSZUKIWARKA KLUBOWICZA TYLKO DLA ADMINA / TRENERA */}
      {(appRole === 'admin' || appRole === 'trener') && (
        <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm space-y-3 relative">
          <label className="text-xs font-black text-sky-950 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2"><span>🔍</span> Wyszukaj podopiecznego (opcjonalnie):</span>
            {appRole === 'trener' && selectedKlient && selectedKlient['E-mail']?.toLowerCase() === currentUserEmail && (
              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Obecnie wyświetlasz swoje własne dane
              </span>
            )}
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Wpisz imię, nazwisko lub e-mail (min. 2 znaki), aby przejrzeć podopiecznego..."
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchFocused(true);
              }}
              className="w-full bg-sky-50/60 border border-sky-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500 font-semibold"
            />
            {searchQuery && (
              <button
                onClick={async () => {
                  setSearchQuery('');
                  const myProfile = klienci.find(c => c['E-mail']?.toLowerCase().trim() === currentUserEmail);
                  if (myProfile) {
                    setSelectedKlient(myProfile);
                    fetchMeasurements(myProfile.id, currentUserEmail);
                  } else {
                    setSelectedKlient(null);
                    setMeasurements([]);
                  }
                }}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
              >
                ✕ Wróć do moich danych
              </button>
            )}

            {isSearchFocused && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-sky-200 rounded-2xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-sky-100">
                {searchResults.map((klient) => {
                  const avatar = klient.avatarUrl || klient.AvatarUrl;
                  const plecTxt = klient.gender || klient.Płeć || klient.plec || 'Nie podano';
                  return (
                    <div
                      key={klient.id}
                      onClick={() => handleSelectClient(klient)}
                      className="p-3 hover:bg-sky-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-sky-100 flex items-center justify-center font-bold text-sky-900 text-xs shrink-0 border border-amber-500">
                          {avatar ? (
                            <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="uppercase">{klient.Imię?.[0] || 'K'}{klient.Nazwisko?.[0] || ''}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sky-950">{klient.Imię} {klient.Nazwisko} <span className="text-[10px] text-slate-400 font-normal">({plecTxt})</span></div>
                          <div className="text-[10px] text-slate-500">{klient['E-mail']}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                        Wybierz ➔
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* KARTA WYBRANEGO PODOPIECZNEGO */}
      {selectedKlient ? (
        <div className="bg-gradient-to-r from-sky-950 to-slate-900 p-4 rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-400 bg-sky-900 flex items-center justify-center text-amber-300 font-black text-sm shrink-0">
              {(selectedKlient.avatarUrl || selectedKlient.AvatarUrl) ? (
                <img src={selectedKlient.avatarUrl || selectedKlient.AvatarUrl} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <span className="uppercase">{selectedKlient.Imię?.[0] || ''}{selectedKlient.Nazwisko?.[0] || ''}</span>
              )}
            </div>
            <div>
              <div className="text-sm font-black tracking-wide text-amber-400 uppercase flex items-center gap-2 flex-wrap">
                <span>{selectedKlient.Imię} {selectedKlient.Nazwisko}</span>
                <span className="bg-sky-900 text-sky-200 text-[10px] px-2 py-0.5 rounded-full border border-sky-700 font-bold">
                  Płeć: {clientGenderDisplay}
                </span>
              </div>
              <div className="text-xs text-sky-200/80">
                {selectedKlient['E-mail']} • {selectedKlient['Numer tel.'] || 'Brak tel.'}
              </div>
            </div>
          </div>

          {latestMeasurement && (
            <div className="flex items-center gap-4 bg-sky-900/50 px-4 py-2 rounded-xl border border-sky-800 text-xs">
              <div>
                <span className="text-[10px] text-sky-300 block uppercase font-bold">Ostatni pomiar</span>
                <span className="font-black text-white">{latestMeasurement.data_pomiaru}</span>
              </div>
              <div className="border-l border-sky-700 pl-4">
                <span className="text-[10px] text-sky-300 block uppercase font-bold">Waga</span>
                <span className="font-black text-amber-400">{latestMeasurement.waga} kg</span>
              </div>
              {latestMeasurement.tkanka_tluszczowa && (
                <div className="border-l border-sky-700 pl-4">
                  <span className="text-[10px] text-sky-300 block uppercase font-bold">Tk. tłuszczowa</span>
                  <span className="font-black text-emerald-400">{latestMeasurement.tkanka_tluszczowa}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        appRole === 'admin' && (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-8 text-center text-slate-500 text-xs font-bold space-y-1">
            <span className="text-2xl block mb-2">👤</span>
            Użyj powyższego pola wyszukiwania, aby wybrać klubowicza i załadować jego historię pomiarów.
          </div>
        )
      )}

      {/* ========================================================================= */}
      {/* ZAKŁADKA 1: POMIARY CENTYMETREM, SKŁAD CIAŁA I WYKRESY 24 MSC */}
      {/* ========================================================================= */}
      {activeTab === 'pomiary' && (selectedKlient || appRole === 'klubowicz' || appRole === 'trener') && (
        <div className="space-y-6">
          {latestMeasurement ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-sm text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Waga</div>
                <div className="text-lg font-black text-sky-950 mt-1">{latestMeasurement.waga} kg</div>
                {previousMeasurement && (
                  <div className="text-[10px] font-bold text-amber-600">
                    {calculateDiff(latestMeasurement.waga, previousMeasurement.waga)} kg
                  </div>
                )}
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-sm text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Tk. tłuszczowa</div>
                <div className="text-lg font-black text-sky-950 mt-1">{latestMeasurement.tkanka_tluszczowa || '-'} %</div>
                {previousMeasurement && (
                  <div className="text-[10px] font-bold text-amber-600">
                    {calculateDiff(latestMeasurement.tkanka_tluszczowa, previousMeasurement.tkanka_tluszczowa)} %
                  </div>
                )}
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-sm text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Mięśnie</div>
                <div className="text-lg font-black text-sky-950 mt-1">{latestMeasurement.miesnie || '-'} kg</div>
                {previousMeasurement && (
                  <div className="text-[10px] font-bold text-emerald-600">
                    {calculateDiff(latestMeasurement.miesnie, previousMeasurement.miesnie)} kg
                  </div>
                )}
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-sm text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Obw. Pasa</div>
                <div className="text-lg font-black text-sky-950 mt-1">{latestMeasurement.obwod_pasa || '-'} cm</div>
                {previousMeasurement && (
                  <div className="text-[10px] font-bold text-amber-600">
                    {calculateDiff(latestMeasurement.obwod_pasa, previousMeasurement.obwod_pasa)} cm
                  </div>
                )}
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-sm text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Klatka</div>
                <div className="text-lg font-black text-sky-950 mt-1">{latestMeasurement.klatka || '-'} cm</div>
                {previousMeasurement && (
                  <div className="text-[10px] font-bold text-amber-600">
                    {calculateDiff(latestMeasurement.klatka, previousMeasurement.klatka)} cm
                  </div>
                )}
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-sm text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Talia</div>
                <div className="text-lg font-black text-sky-950 mt-1">{latestMeasurement.talia || '-'} cm</div>
                {previousMeasurement && (
                  <div className="text-[10px] font-bold text-amber-600">
                    {calculateDiff(latestMeasurement.talia, previousMeasurement.talia)} cm
                  </div>
                )}
              </div>
              <div className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-sm text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Biodra</div>
                <div className="text-lg font-black text-sky-950 mt-1">{latestMeasurement.biodra || '-'} cm</div>
                {previousMeasurement && (
                  <div className="text-[10px] font-bold text-amber-600">
                    {calculateDiff(latestMeasurement.biodra, previousMeasurement.biodra)} cm
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-6 text-center text-xs text-slate-600 font-bold">
              Brak zarejestrowanych pomiarów dla wybranego profilu.
            </div>
          )}

          {/* TABELA HISTORII POMIARÓW OGÓLNYCH */}
          <div className="bg-white rounded-2xl border border-sky-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-sky-100 flex items-center justify-between">
              <h3 className="font-black text-xs text-sky-950 uppercase tracking-wider flex items-center gap-2">
                <span>📋</span> Karta Pomiarów i Składu Ciała (Historia)
              </h3>
              <span className="text-[10px] font-bold text-slate-500">
                Liczba wpisów: {measurements.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-sky-950 text-amber-400 font-black uppercase text-[10px] tracking-wider">
                    <th className="p-3 border-r border-sky-900 sticky left-0 bg-sky-950 z-10">Data</th>
                    <th className="p-3 border-r border-sky-900 bg-sky-900/40 text-center" colSpan={7}>
                      Obwody Centymetrem (cm)
                    </th>
                    <th className="p-3 border-r border-sky-900 bg-slate-800/60 text-center" colSpan={7}>
                      Analiza Składu Ciała
                    </th>
                    <th className="p-3 text-center">Akcje / Edycja</th>
                  </tr>
                  <tr className="bg-sky-50 text-slate-700 font-bold border-b border-sky-200 text-[11px]">
                    <th className="p-2.5 border-r border-sky-200 sticky left-0 bg-sky-50 z-10">Data pomiaru</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Obw. pasa</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Klatka</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Ramię</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Talia</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Biodra</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Udo</th>
                    <th className="p-2.5 border-r border-sky-200 text-center">Łydka</th>
                    <th className="p-2.5 border-r border-sky-100 text-center font-black text-sky-950">Waga (kg)</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Tk. tłuszcz. (%)</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Mięśnie (kg)</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Kości (kg)</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Wiek metab.</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Woda (%)</th>
                    <th className="p-2.5 border-r border-sky-200 text-center">Tł. wiscer.</th>
                    <th className="p-2.5 text-center">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {measurements.length > 0 ? (
                    measurements.map((m) => (
                      <tr key={m.id} className="hover:bg-sky-50/50 transition-colors">
                        <td className="p-3 font-black text-sky-950 border-r border-sky-100 sticky left-0 bg-white z-10 whitespace-nowrap">
                          {m.data_pomiaru}
                        </td>
                        <td className="p-3 text-center border-r border-sky-100">{m.obwod_pasa || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.klatka || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.ramie || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.talia || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.biodra || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.udo || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.lydka || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100 font-black text-sky-950">{m.waga}</td>
                        <td className="p-3 text-center border-r border-sky-100 font-semibold">{m.tkanka_tluszczowa ? `${m.tkanka_tluszczowa}%` : '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.miesnie || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.kosci || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.wiek_metaboliczny || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.woda ? `${m.woda}%` : '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.tluszcz_wisceralny || '-'}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingMeasurementId(m.id);
                                setFormData({
                                  data_pomiaru: m.data_pomiaru || new Date().toISOString().split('T')[0],
                                  wzrost: m.wzrost !== null && m.wzrost !== undefined ? String(m.wzrost) : '',
                                  waga: m.waga !== null && m.waga !== undefined ? String(m.waga) : '',
                                  obwod_pasa: m.obwod_pasa !== null && m.obwod_pasa !== undefined ? String(m.obwod_pasa) : '',
                                  klatka: m.klatka !== null && m.klatka !== undefined ? String(m.klatka) : '',
                                  ramie: m.ramie !== null && m.ramie !== undefined ? String(m.ramie) : '',
                                  talia: m.talia !== null && m.talia !== undefined ? String(m.talia) : '',
                                  biodra: m.biodra !== null && m.biodra !== undefined ? String(m.biodra) : '',
                                  udo: m.udo !== null && m.udo !== undefined ? String(m.udo) : '',
                                  lydka: m.lydka !== null && m.lydka !== undefined ? String(m.lydka) : '',
                                  tkanka_tluszczowa: m.tkanka_tluszczowa !== null && m.tkanka_tluszczowa !== undefined ? String(m.tkanka_tluszczowa) : '',
                                  miesnie: m.miesnie !== null && m.miesnie !== undefined ? String(m.miesnie) : '',
                                  kosci: m.kosci !== null && m.kosci !== undefined ? String(m.kosci) : '',
                                  wiek_metaboliczny: m.wiek_metaboliczny !== null && m.wiek_metaboliczny !== undefined ? String(m.wiek_metaboliczny) : '',
                                  woda: m.woda !== null && m.woda !== undefined ? String(m.woda) : '',
                                  tluszcz_wisceralny: m.tluszcz_wisceralny !== null && m.tluszcz_wisceralny !== undefined ? String(m.tluszcz_wisceralny) : '',
                                  kcal: m.kcal !== null && m.kcal !== undefined ? String(m.kcal) : '',
                                  bialko: m.bialko !== null && m.bialko !== undefined ? String(m.bialko) : '',
                                  tluszcz: m.tluszcz !== null && m.tluszcz !== undefined ? String(m.tluszcz) : '',
                                  weglowodany: m.weglowodany !== null && m.weglowodany !== undefined ? String(m.weglowodany) : '',
                                  uwagi_trenera: m.uwagi_trenera || '',
                                  notatki_klubowicza: m.notatki_klubowicza || ''
                                });
                                setIsAddModalOpen(true);
                              }}
                              className="bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-bold p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Edytuj ten wpis"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteMeasurement(m.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Usuń wpis"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={16} className="p-6 text-center text-slate-400 font-bold">
                        Brak wpisów pomiarowych do wyświetlenia.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* WYKRESY */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between border-b border-sky-200 pb-2">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider flex items-center gap-2">
                <span>📈</span> Wykresy Progresu (Ostatnie 24 Miesiące)
              </h3>
              <span className="text-xs text-slate-500 font-bold">
                Liczba pomiarów: {chartData24Months.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {renderLineChart("Waga", "waga", "kg", "#0284c7", "#0284c7")}
              {renderLineChart("Tkanka Tłuszczowa", "tkanka_tluszczowa", "%", "#f59e0b", "#f59e0b")}
              {renderLineChart("Masa Mięśniowa", "miesnie", "kg", "#10b981", "#10b981")}
              {renderLineChart("Wiek Metaboliczny", "wiek_metaboliczny", "lat", "#8b5cf6", "#8b5cf6")}
              {renderLineChart("Tłuszcz Wisceralny", "tluszcz_wisceralny", "lvl", "#ef4444", "#ef4444")}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZAKŁADKA 2: DIETA, MAKROSKŁADNIKI I KALKULATOR KATCH-MCARDLE */}
      {/* ========================================================================= */}
      {activeTab === 'makro' && (selectedKlient || appRole === 'klubowicz' || appRole === 'trener') && (
        <div className="space-y-6">
          {latestMeasurement ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 p-5 rounded-2xl shadow-sm">
                <div className="text-xs font-black uppercase tracking-wider text-slate-900/80">Cel Kaloryczny</div>
                <div className="text-3xl font-black mt-2">{latestMeasurement.kcal || '---'} <span className="text-sm font-bold">kcal</span></div>
                <div className="text-[11px] font-bold text-slate-900/70 mt-1">Zalecenie z dnia: {latestMeasurement.data_pomiaru}</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Białko</span>
                  <span className="text-rose-600 font-bold">🥩</span>
                </div>
                <div className="text-2xl font-black text-sky-950 mt-2">{latestMeasurement.bialko || '---'} <span className="text-sm font-bold">g</span></div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  {latestMeasurement.bialko ? `${(latestMeasurement.bialko * 4).toFixed(0)} kcal` : 'Brak danych'}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Tłuszcze</span>
                  <span className="text-amber-500 font-bold">🥑</span>
                </div>
                <div className="text-2xl font-black text-sky-950 mt-2">{latestMeasurement.tluszcz || '---'} <span className="text-sm font-bold">g</span></div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  {latestMeasurement.tluszcz ? `${(latestMeasurement.tluszcz * 9).toFixed(0)} kcal` : 'Brak danych'}
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm">
                <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Węglowodany</span>
                  <span className="text-sky-600 font-bold">🍚</span>
                </div>
                <div className="text-2xl font-black text-sky-950 mt-2">{latestMeasurement.weglowodany || '---'} <span className="text-sm font-bold">g</span></div>
                <div className="text-[11px] text-slate-500 font-medium mt-1">
                  {latestMeasurement.weglowodany ? `${(latestMeasurement.weglowodany * 4).toFixed(0)} kcal` : 'Brak danych'}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-6 text-center text-xs text-slate-600 font-bold">
              Brak zaleceń dietetycznych dla tego profilu.
            </div>
          )}

          {/* HISTORIA ZALECEN */}
          <div className="bg-white rounded-2xl border border-sky-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-sky-100 flex items-center justify-between">
              <h3 className="font-black text-xs text-sky-950 uppercase tracking-wider flex items-center gap-2">
                <span>🥗</span> Historia Zaleceń Kalorycznych i Makroskładników
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-sky-950 text-amber-400 font-black uppercase text-[10px] tracking-wider">
                    <th className="p-3 border-r border-sky-900">Data</th>
                    <th className="p-3 border-r border-sky-900 text-center">Kcal</th>
                    <th className="p-3 border-r border-sky-900 text-center">Białko (g)</th>
                    <th className="p-3 border-r border-sky-900 text-center">Tłuszcz (g)</th>
                    <th className="p-3 border-r border-sky-900 text-center">Węglowodany (g)</th>
                    <th className="p-3">Zalecenia i Wskazówki Trenera</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {measurements.filter(m => m.kcal || m.bialko || m.uwagi_trenera).length > 0 ? (
                    measurements.filter(m => m.kcal || m.bialko || m.uwagi_trenera).map((m) => (
                      <tr key={m.id} className="hover:bg-sky-50/50 transition-colors">
                        <td className="p-3 font-black text-sky-950 border-r border-sky-100 whitespace-nowrap">
                          {m.data_pomiaru}
                        </td>
                        <td className="p-3 text-center border-r border-sky-100 font-black text-amber-600">
                          {m.kcal ? `${m.kcal} kcal` : '-'}
                        </td>
                        <td className="p-3 text-center border-r border-sky-100 font-bold">
                          {m.bialko ? `${m.bialko} g` : '-'}
                        </td>
                        <td className="p-3 text-center border-r border-sky-100 font-bold">
                          {m.tluszcz ? `${m.tluszcz} g` : '-'}
                        </td>
                        <td className="p-3 text-center border-r border-sky-100 font-bold">
                          {m.weglowodany ? `${m.weglowodany} g` : '-'}
                        </td>
                        <td className="p-3 text-slate-700 font-medium">
                          {m.uwagi_trenera || 'Brak dodatkowych uwag.'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                        Brak historii planów dietetycznych.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* KALKULATOR */}
          <div className="bg-white p-6 rounded-2xl border border-sky-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-sky-100 pb-3 gap-2">
              <div>
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider flex items-center gap-2">
                  <span>🧮</span> Kalkulator Katch-McArdle (BMR & TDEE)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Precyzyjna metoda oparta na beztłuszczowej masie ciała (LBM) uwzględniająca płeć oraz cel procentowy.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Płeć *</label>
                <select
                  value={calcGender}
                  onChange={(e) => setCalcGender(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none font-bold text-sky-950 cursor-pointer"
                >
                  <option value="mezczyzna">👨 Mężczyzna</option>
                  <option value="kobieta">👩 Kobieta</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Waga ciała (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder={latestMeasurement ? String(latestMeasurement.waga) : "np. 75"}
                  value={calcWeight}
                  onChange={(e) => setCalcWeight(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Tkanka tłuszczowa (%)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder={latestMeasurement?.tkanka_tluszczowa ? String(latestMeasurement.tkanka_tluszczowa) : "np. 15"}
                  value={calcFat}
                  onChange={(e) => setCalcFat(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Aktywność (PAL)</label>
                <select
                  value={calcPal}
                  onChange={(e) => setCalcPal(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none font-medium cursor-pointer"
                >
                  <option value="1.2">1.2 – Siedzący tryb</option>
                  <option value="1.375">1.375 – Lekka (1-3 treng.)</option>
                  <option value="1.55">1.55 – Umiarkowana (3-5 treng.)</option>
                  <option value="1.725">1.725 – Duża (6-7 treng.)</option>
                  <option value="1.9">1.9 – Bardzo duża</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Cel procentowy</label>
                <select
                  value={calcGoal}
                  onChange={(e) => setCalcGoal(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none font-medium cursor-pointer"
                >
                  <option value="-0.2">🔥 -20% kcal (Głęboka redukcja)</option>
                  <option value="-0.1">📉 -10% kcal (Lekka redukcja)</option>
                  <option value="0">⚖️ 0% kcal (Utrzymanie / Zero)</option>
                  <option value="0.1">📈 +10% kcal (Lekka masa)</option>
                  <option value="0.2">💪 +20% kcal (Budowa masy)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={calculateKatchMcArdle}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl shadow-sm text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Przelicz zapotrzebowanie Katch-McArdle ➔
              </button>
            </div>

            {calcResult && (
              <div className="bg-gradient-to-br from-sky-950 to-slate-900 p-5 rounded-2xl text-white space-y-4 shadow-md">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                  <div className="bg-sky-900/40 p-3 rounded-xl border border-sky-800">
                    <span className="text-[10px] text-sky-300 block uppercase font-bold">BMR (Podstawowe)</span>
                    <span className="text-lg font-black text-white">{calcResult.bmr} kcal</span>
                  </div>
                  <div className="bg-sky-900/40 p-3 rounded-xl border border-sky-800">
                    <span className="text-[10px] text-sky-300 block uppercase font-bold">TDEE (Całkowite)</span>
                    <span className="text-lg font-black text-white">{calcResult.tdee} kcal</span>
                  </div>
                  <div className="bg-amber-500 text-slate-950 p-3 rounded-xl font-black shadow">
                    <span className="text-[10px] text-slate-900/80 block uppercase">Cel Kalorii</span>
                    <span className="text-xl font-black">{calcResult.targetKcal} kcal</span>
                  </div>
                  <div className="bg-sky-900/40 p-3 rounded-xl border border-sky-800">
                    <span className="text-[10px] text-rose-400 block uppercase font-bold">Białko</span>
                    <span className="text-lg font-black text-white">{calcResult.protein} g</span>
                  </div>
                  <div className="bg-sky-900/40 p-3 rounded-xl border border-sky-800">
                    <span className="text-[10px] text-amber-300 block uppercase font-bold">Tłuszcze</span>
                    <span className="text-lg font-black text-white">{calcResult.fat} g</span>
                  </div>
                  <div className="bg-sky-900/40 p-3 rounded-xl border border-sky-800">
                    <span className="text-[10px] text-sky-300 block uppercase font-bold">Węglowodany</span>
                    <span className="text-lg font-black text-white">{calcResult.carbs} g</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ZAKŁADKA 3: WYZWANIE REDUKCJI (AUTOPAY, GOTÓWKA, CHECKBOXY ADMINA) */}
      {/* ========================================================================= */}
      {activeTab === 'redukcja' && (
        <div className="space-y-6">
          
          {/* BANERY INFORMACYJNE O DOŁĄCZANIU I UMAWIANIU POMIARÓW */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
              <span className="text-xl">📅</span>
              <div className="text-xs text-emerald-950">
                <span className="font-black uppercase block mb-0.5">Dołącz w dowolnym momencie</span>
                Do trwającego wyzwania redukcji możesz przystąpić w każdym momencie! Twój czas na realizację celu liczy się od Twojego pomiaru startowego do finału.
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
              <span className="text-xl">⚠️</span>
              <div className="text-xs text-amber-950">
                <span className="font-black uppercase block mb-0.5">Wcześniejsze umówienie pomiarów</span>
                Analizę składu ciała (zarówno <b>startową</b>, jak i <b>finałową</b>) wykonujemy <b>po wcześniejszym umówieniu się z trenerem</b> (przed treningiem lub w osobnym terminie).
              </div>
            </div>
          </div>

          {/* GŁÓWNY BANER EDYCJI WYBRANEGO WYZWANIA */}
          {activeEdycjaObj ? (
            <div className="bg-gradient-to-br from-slate-900 via-sky-950 to-slate-950 text-white p-6 rounded-3xl shadow-xl space-y-6 border border-sky-900/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🔥</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black uppercase tracking-wider text-amber-400">
                        {activeEdycjaObj.nazwa}
                      </h2>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-bold px-2.5 py-0.5 rounded-full uppercase">
                        {activeEdycjaObj.status}
                      </span>
                    </div>
                    <p className="text-xs text-sky-200/90 mt-0.5">{activeEdycjaObj.opis}</p>
                  </div>
                </div>

                {edycjeRedukcji.length > 1 && (
                  <select
                    value={selectedEdycjaId || ""}
                    onChange={(e) => setSelectedEdycjaId(Number(e.target.value))}
                    className="bg-sky-900/80 border border-sky-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer"
                  >
                    {edycjeRedukcji.map(ed => (
                      <option key={ed.id} value={ed.id}>{ed.nazwa} ({ed.data_start} - {ed.data_koniec})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* KAFLE PODSUMOWUJĄCE: TERMIN, WPISOWE, PULA NAGRÓD, STATUS ZAPISU */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-sky-950/60 p-4 rounded-2xl border border-sky-800/60">
                  <span className="text-[10px] text-sky-300 uppercase font-bold block">Termin Wyzwania</span>
                  <span className="text-xs font-black text-white mt-1 block">
                    {activeEdycjaObj.data_start} ➔ {activeEdycjaObj.data_koniec}
                  </span>
                </div>

                <div className="bg-sky-950/60 p-4 rounded-2xl border border-sky-800/60">
                  <span className="text-[10px] text-sky-300 uppercase font-bold block">Wpisowe</span>
                  <span className="text-lg font-black text-amber-400 mt-0.5 block">
                    {activeEdycjaObj.wpisowe_kwota} zł
                  </span>
                </div>

                <div className="bg-sky-950/60 p-4 rounded-2xl border border-sky-800/60">
                  <span className="text-[10px] text-emerald-300 uppercase font-bold block">Pula Nagród</span>
                  <span className="text-lg font-black text-emerald-400 mt-0.5 block">
                    {(uczestnicyRedukcji.filter(u => u.oplacone).length * activeEdycjaObj.wpisowe_kwota).toFixed(0)} zł
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">({uczestnicyRedukcji.filter(u => u.oplacone).length} opłaconych)</span>
                </div>

                <div className="bg-sky-950/60 p-4 rounded-2xl border border-sky-800/60 flex flex-col justify-center items-center">
                  <span className="text-[10px] text-sky-300 uppercase font-bold block">Twój Status</span>
                  {isCurrentUserJoined ? (
                    <div className="mt-1">
                      <span className="text-xs font-black text-emerald-400 flex items-center justify-center gap-1">
                        ✓ Zapisany
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${activeUserParticipant?.oplacone ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                        {activeUserParticipant?.oplacone ? 'Opłacone' : 'Oczekuje na wpłatę'}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsJoinModalOpen(true)}
                      className="mt-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow transition-all cursor-pointer uppercase tracking-wider"
                    >
                      Dołącz do gry ➔
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-3xl border border-sky-200 text-center space-y-3">
              <span className="text-4xl block">🔥</span>
              <h3 className="font-black text-base text-sky-950 uppercase">Brak aktywnych edycji wyzwania redukcji</h3>
              <p className="text-xs text-slate-500">Administrator może utworzyć nowe wyzwanie redukcji za pomocą przycisku powyżej.</p>
            </div>
          )}

          {/* TABELA 1: DEDYKOWANA KARTA SKŁADU CIAŁA DLA WYBRANEGO KLUBOWICZA */}
          {(selectedKlient || currentUserId) && activeEdycjaObj && (
            <div className="bg-white rounded-3xl border border-sky-200 shadow-sm overflow-hidden space-y-3 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-100 pb-3">
                <div>
                  <h3 className="font-black text-xs uppercase tracking-wider text-sky-950 flex items-center gap-2">
                    <span>⚖️</span> Karta Analizy Składu Ciała (Wyzwanie Redukcji)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Uczestnik: <span className="font-bold text-slate-800">{selectedKlient ? `${selectedKlient.Imię} ${selectedKlient.Nazwisko}` : 'Twój Profil'}</span>
                  </p>
                </div>

                {appRole === 'admin' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenRedukcjaPomiarModal('start', selectedKlient ? selectedKlient.id : currentUserId!)}
                      className="bg-sky-100 hover:bg-sky-200 text-sky-950 font-black text-[11px] px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                    >
                      + Pomiar Początkowy (Start)
                    </button>
                    <button
                      onClick={() => handleOpenRedukcjaPomiarModal('koniec', selectedKlient ? selectedKlient.id : currentUserId!)}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                    >
                      + Pomiar Końcowy (Finał)
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-sky-100">
                      <th className="p-3">Etap Pomiaru</th>
                      <th className="p-3">Data</th>
                      <th className="p-3 text-center">Waga (kg)</th>
                      <th className="p-3 text-center">Tk. tłuszczowa (%)</th>
                      <th className="p-3 text-center">Masa mięśniowa (kg)</th>
                      <th className="p-3 text-center">Tłuszcz wisceralny (lvl)</th>
                      <th className="p-3 text-right">Wynik Punktowy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-50">
                    {(() => {
                      const sP = pomiaryRedukcji.find(p => String(p.klient_id) === String(activeUserKlientId) && p.etap === 'start');
                      const kP = pomiaryRedukcji.find(p => String(p.klient_id) === String(activeUserKlientId) && p.etap === 'koniec');
                      
                      return (
                        <>
                          <tr className="hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-sky-900 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span>
                              <span>Pomiar Początkowy (START)</span>
                            </td>
                            <td className="p-3 text-slate-600">{sP ? sP.data_pomiaru : 'Brak pomiaru'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{sP ? `${sP.waga_kg} kg` : '-'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{sP ? `${sP.fat_proc}%` : '-'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{sP ? `${sP.muscle_kg} kg` : '-'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{sP ? sP.visceral_level : '-'}</td>
                            <td className="p-3 text-right text-slate-400 font-bold">---</td>
                          </tr>

                          <tr className="hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-amber-700 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                              <span>Pomiar Końcowy (FINAŁ)</span>
                            </td>
                            <td className="p-3 text-slate-600">{kP ? kP.data_pomiaru : 'Oczekuje na finał'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{kP ? `${kP.waga_kg} kg` : '-'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{kP ? `${kP.fat_proc}%` : '-'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{kP ? `${kP.muscle_kg} kg` : '-'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{kP ? kP.visceral_level : '-'}</td>
                            <td className="p-3 text-right text-slate-400 font-bold">---</td>
                          </tr>

                          {sP && kP && (
                            <tr className="bg-amber-50/40 font-black border-t-2 border-amber-200">
                              <td className="p-3 text-slate-950 uppercase tracking-wider">
                                Bilans Postępów (Zmiana):
                              </td>
                              <td className="p-3 text-slate-500 font-normal">Różnica</td>
                              <td className="p-3 text-center">
                                {renderTrendIndicator(kP.waga_kg - sP.waga_kg, true, " kg")}
                              </td>
                              <td className="p-3 text-center">
                                {renderTrendIndicator(kP.fat_proc - sP.fat_proc, true, " %")}
                              </td>
                              <td className="p-3 text-center">
                                {renderTrendIndicator(kP.muscle_kg - sP.muscle_kg, false, " kg")}
                              </td>
                              <td className="p-3 text-center">
                                {renderTrendIndicator(kP.visceral_level - sP.visceral_level, true, " lvl")}
                              </td>
                              <td className="p-3 text-right text-amber-700 font-black text-sm">
                                {activeUserParticipant?.punkty_calkowite || 0} pkt 🏆
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABELA 2: GŁÓWNY RANKING UCZESTNIKÓW Z CHECKBOXEM ADMINA */}
          {activeEdycjaObj && (
            <div className="bg-white rounded-3xl border border-sky-200 shadow-sm overflow-hidden space-y-4 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-100 pb-3">
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider text-sky-950 flex items-center gap-2">
                    <span>🏆</span> Oficjalny Ranking Wyzwania Redukcji
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Punkty liczone procentowo względem wagi wyjściowej dla pełnej sprawiedliwości.
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  Uczestników: {rankingRedukcji.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[950px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-sky-100">
                      <th className="p-3 w-16">Miejsce</th>
                      <th className="p-3">Klubowicz</th>
                      <th className="p-3 text-center">Wpisowe / Status</th>
                      <th className="p-3 text-center">Start ➔ Koniec (Waga)</th>
                      <th className="p-3 text-center">Tk. Tłuszczowa</th>
                      <th className="p-3 text-center">Masa Mięśniowa</th>
                      <th className="p-3 text-center">Wisceralny</th>
                      <th className="p-3 text-right">Punkty Procentowe</th>
                      {appRole === 'admin' && <th className="p-3 text-center">Pomiary (Admin)</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-50">
                    {rankingRedukcji.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-black text-slate-800">
                          {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                        </td>
                        <td className="p-3 font-bold text-slate-900 flex items-center gap-2.5">
                          {row.klientAvatar ? (
                            <img src={row.klientAvatar} alt="Avatar" className="w-7 h-7 rounded-full object-cover border border-amber-400" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-900 font-bold text-[10px] flex items-center justify-center">
                              {row.klientName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div>{row.klientName}</div>
                            <div className="text-[9px] text-slate-400 font-normal">
                              Metoda: {row.metoda_platnosci === 'autopay' ? '⚡ Autopay' : '💵 Gotówka'}
                            </div>
                          </div>
                        </td>

                        {/* CHECKBOX OPŁACENIA DLA ADMINA / STATUS DLA KLUBOWICZA */}
                        <td className="p-3 text-center">
                          {appRole === 'admin' ? (
                            <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition-all">
                              <input
                                type="checkbox"
                                checked={row.oplacone}
                                onChange={(e) => handleCheckboxPaymentToggle(row.id, e.target.checked)}
                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                              />
                              <span className={`text-[10px] font-black uppercase ${row.oplacone ? 'text-emerald-700' : 'text-rose-600'}`}>
                                {row.oplacone ? 'Opłacone' : 'Do opłacenia'}
                              </span>
                            </label>
                          ) : (
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${row.oplacone ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                              {row.oplacone ? '✓ Opłacone' : '⏳ Oczekuje na potwierdzenie'}
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-center font-bold text-slate-800">
                          {row.startP && row.koniecP ? (
                            <div>
                              <span>{row.startP.waga_kg} ➔ {row.koniecP.waga_kg} kg</span>
                              <div className="text-[10px]">{renderTrendIndicator(row.deltaWagaKg, true, " kg")} ({row.deltaWagaProc.toFixed(1)}%)</div>
                            </div>
                          ) : row.startP ? (
                            <span>{row.startP.waga_kg} kg (Start)</span>
                          ) : (
                            <span className="text-slate-400 font-normal">Brak startu</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {row.startP && row.koniecP ? (
                            <div>
                              <span>{row.startP.fat_proc}% ➔ {row.koniecP.fat_proc}%</span>
                              <div className="text-[10px]">{renderTrendIndicator(row.koniecP.fat_proc - row.startP.fat_proc, true, " %")}</div>
                            </div>
                          ) : row.startP ? (
                            <span>{row.startP.fat_proc}%</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {row.startP && row.koniecP ? (
                            <div>
                              <span>{row.startP.muscle_kg} ➔ {row.koniecP.muscle_kg} kg</span>
                              <div className="text-[10px]">{renderTrendIndicator(row.deltaMuscleKg, false, " kg")}</div>
                            </div>
                          ) : row.startP ? (
                            <span>{row.startP.muscle_kg} kg</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {row.startP && row.koniecP ? (
                            <div>
                              <span>{row.startP.visceral_level} ➔ {row.koniecP.visceral_level}</span>
                              <div className="text-[10px]">{renderTrendIndicator(row.koniecP.visceral_level - row.startP.visceral_level, true, " lvl")}</div>
                            </div>
                          ) : row.startP ? (
                            <span>{row.startP.visceral_level}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-black text-sm text-amber-600">
                          {row.hasBoth ? `${row.totalPkt} pkt` : <span className="text-slate-400 font-normal text-xs">W trakcie</span>}
                        </td>
                        {appRole === 'admin' && (
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenRedukcjaPomiarModal('start', row.klient_id)}
                                className="bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold px-2 py-1 rounded text-[10px] cursor-pointer"
                                title="Edytuj pomiar startowy"
                              >
                                Start
                              </button>
                              <button
                                onClick={() => handleOpenRedukcjaPomiarModal('koniec', row.klient_id)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold px-2 py-1 rounded text-[10px] cursor-pointer"
                                title="Edytuj pomiar końcowy"
                              >
                                Finał
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {rankingRedukcji.length === 0 && (
                      <tr>
                        <td colSpan={appRole === 'admin' ? 9 : 8} className="p-8 text-center text-slate-400 italic">
                          Brak zapisanych uczestników w tej edycji wyzwania.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: WYBÓR METODY PŁATNOŚCI (AUTOPAY / GOTÓWKA) */}
      {/* ========================================================================= */}
      {isJoinModalOpen && activeEdycjaObj && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-100">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider text-sky-950">
                  Dołącz do Wyzwania Redukcji
                </h3>
                <p className="text-[11px] text-slate-500">
                  Wpisowe do puli nagród: <span className="font-bold text-amber-600">{activeEdycjaObj.wpisowe_kwota} zł</span>
                </p>
              </div>
              <button onClick={() => setIsJoinModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">Wybierz sposób opłacenia wpisowego:</label>
              
              <div 
                onClick={() => setSelectedPaymentMethod('autopay')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${selectedPaymentMethod === 'autopay' ? 'border-amber-500 bg-amber-50/50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <div className="font-black text-xs text-slate-900">Płatność Online (Autopay / BLIK)</div>
                    <div className="text-[10px] text-slate-500">Szybki przelew, BLIK lub karta – natychmiastowe potwierdzenie</div>
                  </div>
                </div>
                <input type="radio" checked={selectedPaymentMethod === 'autopay'} onChange={() => setSelectedPaymentMethod('autopay')} className="text-amber-500" />
              </div>

              <div 
                onClick={() => setSelectedPaymentMethod('gotowka')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${selectedPaymentMethod === 'gotowka' ? 'border-amber-500 bg-amber-50/50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💵</span>
                  <div>
                    <div className="font-black text-xs text-slate-900">Gotówka w klubie (Recepcja)</div>
                    <div className="text-[10px] text-slate-500">Wpłać 30 zł u trenera na sali, a trener odznaczy wpisowe</div>
                  </div>
                </div>
                <input type="radio" checked={selectedPaymentMethod === 'gotowka'} onChange={() => setSelectedPaymentMethod('gotowka')} className="text-amber-500" />
              </div>
            </div>

            <div className="bg-sky-50 border border-sky-200 p-3 rounded-xl text-[11px] text-sky-900">
              ℹ️ Pamiętaj, aby po zapisaniu umówić się z trenerem na wykonanie <b>początkowej analizy składu ciała</b> na analizatorze.
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => setIsJoinModalOpen(false)} 
                className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl text-xs cursor-pointer"
              >
                Anuluj
              </button>
              <button 
                type="button" 
                disabled={isProcessingPayment}
                onClick={handleConfirmJoinWithPayment}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow disabled:opacity-50"
              >
                {isProcessingPayment ? 'Łączenie z bankiem...' : selectedPaymentMethod === 'autopay' ? 'Opłać wpisowe ➔' : 'Potwierdź zapis ➔'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TWORZENIE NOWEJ EDYCJI WYZWANIA (ADMIN) */}
      {/* ========================================================================= */}
      {isNewEdycjaModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-sky-100">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm uppercase tracking-wider text-sky-950">
                Utwórz Nową Edycję Wyzwania Redukcji
              </h3>
              <button onClick={() => setIsNewEdycjaModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateEdycja} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nazwa Wyzwania</label>
                <input
                  type="text"
                  required
                  value={edycjaFormData.nazwa}
                  onChange={(e) => setEdycjaFormData({...edycjaFormData, nazwa: e.target.value})}
                  className="w-full p-3 border rounded-xl font-bold bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Data Rozpoczęcia</label>
                  <input
                    type="date"
                    required
                    value={edycjaFormData.data_start}
                    onChange={(e) => setEdycjaFormData({...edycjaFormData, data_start: e.target.value})}
                    className="w-full p-3 border rounded-xl font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Data Zakończenia (Finał)</label>
                  <input
                    type="date"
                    required
                    value={edycjaFormData.data_koniec}
                    onChange={(e) => setEdycjaFormData({...edycjaFormData, data_koniec: e.target.value})}
                    className="w-full p-3 border rounded-xl font-bold bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Kwota Wpisowego (zł)</label>
                  <input
                    type="number"
                    step="5"
                    required
                    value={edycjaFormData.wpisowe_kwota}
                    onChange={(e) => setEdycjaFormData({...edycjaFormData, wpisowe_kwota: e.target.value})}
                    className="w-full p-3 border rounded-xl font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Status Edycji</label>
                  <select
                    value={edycjaFormData.status}
                    onChange={(e) => setEdycjaFormData({...edycjaFormData, status: e.target.value})}
                    className="w-full p-3 border rounded-xl font-bold bg-white"
                  >
                    <option value="aktywne">Aktywne</option>
                    <option value="zapisy">Otwarte Zapisy</option>
                    <option value="zakonczone">Zakończone</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Opis / Zasady dla uczestników</label>
                <textarea
                  rows={3}
                  value={edycjaFormData.opis}
                  onChange={(e) => setEdycjaFormData({...edycjaFormData, opis: e.target.value})}
                  className="w-full p-3 border rounded-xl font-medium bg-white resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsNewEdycjaModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-xl uppercase tracking-wider cursor-pointer">Utwórz Wyzwanie</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: WPROWADZANIE POMIARU ANALIZY SKŁADU CIAŁA (START / KONIEC - ADMIN) */}
      {/* ========================================================================= */}
      {isRedukcjaPomiarModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-sky-100">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider text-sky-950">
                  {targetPomiarEtap === 'start' ? '📊 Pomiar Początkowy (START)' : '🏆 Pomiar Końcowy (FINAŁ)'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dla: <span className="font-bold text-slate-800">{klienci.find(k => String(k.id) === String(targetPomiarKlientId))?.Imię || 'Klubowicz'}</span>
                </p>
              </div>
              <button onClick={() => setIsRedukcjaPomiarModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveRedukcjaPomiar} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Data Wykonania Analizy *</label>
                <input
                  type="date"
                  required
                  value={redukcjaPomiarForm.data_pomiaru}
                  onChange={(e) => setRedukcjaPomiarForm({...redukcjaPomiarForm, data_pomiaru: e.target.value})}
                  className="w-full p-3 border rounded-xl font-bold bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Waga (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="np. 82.4"
                    value={redukcjaPomiarForm.waga_kg}
                    onChange={(e) => setRedukcjaPomiarForm({...redukcjaPomiarForm, waga_kg: e.target.value})}
                    className="w-full p-3 border rounded-xl font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tk. Tłuszczowa (%) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="np. 24.5"
                    value={redukcjaPomiarForm.fat_proc}
                    onChange={(e) => setRedukcjaPomiarForm({...redukcjaPomiarForm, fat_proc: e.target.value})}
                    className="w-full p-3 border rounded-xl font-bold bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Masa Mięśniowa (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="np. 34.2"
                    value={redukcjaPomiarForm.muscle_kg}
                    onChange={(e) => setRedukcjaPomiarForm({...redukcjaPomiarForm, muscle_kg: e.target.value})}
                    className="w-full p-3 border rounded-xl font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tłuszcz Wisceralny (lvl) *</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    required
                    placeholder="poziom (1-20)"
                    value={redukcjaPomiarForm.visceral_level}
                    onChange={(e) => setRedukcjaPomiarForm({...redukcjaPomiarForm, visceral_level: e.target.value})}
                    className="w-full p-3 border rounded-xl font-bold bg-white"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsRedukcjaPomiarModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-xl uppercase tracking-wider cursor-pointer shadow">Zapisz Pomiar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DODAWANIE I EDYCJA POMIARU OGÓLNEGO (ZAKŁADKA 1) */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8 border border-sky-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div>
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">
                  {editingMeasurementId ? "Edycja Pomiaru i Karty Formy" : "Nowy Pomiar i Karta Formy"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dla: {selectedKlient ? `${selectedKlient.Imię} ${selectedKlient.Nazwisko}` : currentUserEmail}
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingMeasurementId(null);
                }}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitMeasurement} className="space-y-6 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-sky-50/50 p-3.5 rounded-xl border border-sky-100">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Data pomiaru *</label>
                  <input
                    type="date"
                    required
                    value={formData.data_pomiaru}
                    onChange={(e) => setFormData({...formData, data_pomiaru: e.target.value})}
                    className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Waga (kg) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="np. 78.5"
                    value={formData.waga}
                    onChange={(e) => setFormData({...formData, waga: e.target.value})}
                    className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Wzrost (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="np. 180"
                    value={formData.wzrost}
                    onChange={(e) => setFormData({...formData, wzrost: e.target.value})}
                    className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-black text-sky-950 uppercase text-[11px] tracking-wider border-b border-sky-100 pb-1">
                  📏 Obwody Ciała (cm)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Obwód pasa</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="cm"
                      value={formData.obwod_pasa}
                      onChange={(e) => setFormData({...formData, obwod_pasa: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Klatka</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="cm"
                      value={formData.klatka}
                      onChange={(e) => setFormData({...formData, klatka: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Ramię</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="cm"
                      value={formData.ramie}
                      onChange={(e) => setFormData({...formData, ramie: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Talia</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="cm"
                      value={formData.talia}
                      onChange={(e) => setFormData({...formData, talia: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Biodra</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="cm"
                      value={formData.biodra}
                      onChange={(e) => setFormData({...formData, biodra: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Udo</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="cm"
                      value={formData.udo}
                      onChange={(e) => setFormData({...formData, udo: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Łydka</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="cm"
                      value={formData.lydka}
                      onChange={(e) => setFormData({...formData, lydka: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-black text-sky-950 uppercase text-[11px] tracking-wider border-b border-sky-100 pb-1">
                  ⚖️ Analiza Składu Ciała
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Tk. tłuszczowa (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="%"
                      value={formData.tkanka_tluszczowa}
                      onChange={(e) => setFormData({...formData, tkanka_tluszczowa: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Mięśnie (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="kg"
                      value={formData.miesnie}
                      onChange={(e) => setFormData({...formData, miesnie: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Kości (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="kg"
                      value={formData.kosci}
                      onChange={(e) => setFormData({...formData, kosci: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Wiek metaboliczny</label>
                    <input
                      type="number"
                      placeholder="lat"
                      value={formData.wiek_metaboliczny}
                      onChange={(e) => setFormData({...formData, wiek_metaboliczny: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Woda (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="%"
                      value={formData.woda}
                      onChange={(e) => setFormData({...formData, woda: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Tłuszcz wisceralny</label>
                    <input
                      type="number"
                      placeholder="poziom (1-20)"
                      value={formData.tluszcz_wisceralny}
                      onChange={(e) => setFormData({...formData, tluszcz_wisceralny: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-black text-sky-950 uppercase text-[11px] tracking-wider border-b border-sky-100 pb-1">
                  🥗 Dieta i Makroskładniki
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Kalorie (Kcal)</label>
                    <input
                      type="number"
                      placeholder="np. 2200"
                      value={formData.kcal}
                      onChange={(e) => setFormData({...formData, kcal: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Białko (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="g"
                      value={formData.bialko}
                      onChange={(e) => setFormData({...formData, bialko: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Tłuszcz (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="g"
                      value={formData.tluszcz}
                      onChange={(e) => setFormData({...formData, tluszcz: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Węglowodany (g)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="g"
                      value={formData.weglowodany}
                      onChange={(e) => setFormData({...formData, weglowodany: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Zalecenia i uwagi trenera</label>
                <textarea
                  rows={2}
                  placeholder="np. Zwiększamy podaż wody do 3l, utrzymujemy obecny bilans kaloryczny..."
                  value={formData.uwagi_trenera}
                  onChange={(e) => setFormData({...formData, uwagi_trenera: e.target.value})}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-sky-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingMeasurementId(null);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Zapisywanie...' : editingMeasurementId ? 'Zapisz zmiany' : 'Dodaj pomiar'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
