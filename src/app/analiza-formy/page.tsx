"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  urodziny?: string;
  wzrost?: number | null;
  avatarUrl?: string;
  AvatarUrl?: string;
  portfel?: number | null;
}

interface AnalizaFormyWpis {
  id: number;
  created_at: string;
  klient_id: number;
  email_klienta: string;
  data_pomiaru: string;
  miejsce_pomiaru?: string | null;
  wzrost?: number | null;
  obwod_pasa?: number | null;
  klatka?: number | null;
  ramie?: number | null;
  talia?: number | null;
  biodra?: number | null;
  udo?: number | null;
  lydka?: number | null;
  waga: number;
  tkanka_tluszczowa?: number | null;
  miesnie?: number | null;
  kosci?: number | null;
  wiek_metaboliczny?: number | null;
  woda?: number | null;
  tluszcz_wisceralny?: number | null;
  kcal?: number | null;
  bialko?: number | null;
  tluszcz?: number | null;
  weglowodany?: number | null;
  uwagi_trenera?: string | null;
  notatki_klubowicza?: string | null;
}

interface RedukcjaEdycja {
  id: number;
  nazwa: string;
  data_start: string;
  data_koniec: string;
  wpisowe_kwota: number;
  min_uczestnikow?: number;
  opis: string;
  status: 'zapisy' | 'aktywne' | 'zakonczone' | 'anulowane';
}

interface RedukcjaUczestnik {
  id: number;
  edycja_id: number;
  klient_id: number | string;
  oplacone: boolean;
  metoda_platnosci?: 'autopay' | 'gotowka' | 'inna';
  brak_pomiaru_koncowego?: boolean;
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

interface RedukcjaNagroda {
  id: number;
  edycja_id: number;
  miejsce: number;
  tytul: string;
  opis?: string;
}

export interface SuplementTrenera {
  nazwa: string;
  dawka: string;
}

export interface SuplementKlubowicza {
  produkt: string;
  dawka: string;
  jednostka: string;
}

export interface BadaniaKrwiWpis {
  id: number;
  klient_id: number | string;
  email_klienta: string;
  data_badania: string;
  plik_pdf_url?: string | null;
  plik_pdf_nazwa?: string | null;
  zdjecia?: string[];
  interpretacja?: string | null;
  zalecenia?: string | null;
  suplementacja_trener?: SuplementTrenera[] | string[];
  suplementacja_klubowicz?: SuplementKlubowicza[];
  nowa_interpretacja?: boolean;
  created_at?: string;
  updated_at?: string;
}

const calculateAge = (birthDateString?: string | null): number | null => {
  if (!birthDateString) return null;
  const birth = new Date(birthDateString);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
};

const fetchAllFromSupabase = async (
  table: string, 
  selectQuery: string = '*', 
  orderBy: string = 'id', 
  ascending: boolean = false, 
  maxPages: number = 5
) => {
  let result: any[] = [];
  try {
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
  } catch (err) {
    console.error(`Wyjątek podczas pobierania tabeli ${table}:`, err);
  }
  return result;
};

export default function AnalizaFormyPage() {
  const [activeTab, setActiveTab] = useState<'pomiary' | 'makro' | 'redukcja' | 'badania'>('pomiary');
  const [appRole, setAppRole] = useState<'admin' | 'trener' | 'klubowicz'>('klubowicz');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<number | string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [klienci, setKlienci] = useState<Klient[]>([]);
  const [selectedKlient, setSelectedKlient] = useState<Klient | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);

  const [measurements, setMeasurements] = useState<AnalizaFormyWpis[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingMeasurementId, setEditingMeasurementId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Stany Wyzwania Redukcji
  const [edycjeRedukcji, setEdycjeRedukcji] = useState<RedukcjaEdycja[]>([]);
  const [selectedEdycjaId, setSelectedEdycjaId] = useState<number | null>(null);
  const [uczestnicyRedukcji, setUczestnicyRedukcji] = useState<RedukcjaUczestnik[]>([]);
  const [pomiaryRedukcji, setPomiaryRedukcji] = useState<RedukcjaPomiar[]>([]);
  const [nagrodyRedukcji, setNagrodyRedukcji] = useState<RedukcjaNagroda[]>([]);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [hasUnreadChallenge, setHasUnreadChallenge] = useState<boolean>(false);
  
  // Modale Redukcji
  const [isNewEdycjaModalOpen, setIsNewEdycjaModalOpen] = useState<boolean>(false);
  const [isRedukcjaPomiarModalOpen, setIsRedukcjaPomiarModalOpen] = useState<boolean>(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState<boolean>(false);
  const [isAddNagrodaModalOpen, setIsAddNagrodaModalOpen] = useState<boolean>(false);
  const [isManualAddModalOpen, setIsManualAddModalOpen] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'autopay' | 'gotowka'>('autopay');
  const [targetPomiarEtap, setTargetPomiarEtap] = useState<'start' | 'koniec'>('start');
  const [targetPomiarKlientId, setTargetPomiarKlientId] = useState<number | string | null>(null);

  // Formularze
  const [manualAddKlientId, setManualAddKlientId] = useState<string>('');
  const [manualAddSearchQuery, setManualAddSearchQuery] = useState<string>('');
  const [isManualSearchFocused, setIsManualSearchFocused] = useState<boolean>(false);
  const [manualAddOplacone, setManualAddOplacone] = useState<boolean>(true);
  const [manualAddMetoda, setManualAddMetoda] = useState<'gotowka' | 'autopay' | 'inna'>('gotowka');
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  // Stany Badania Krwi
  const [badaniaList, setBadaniaList] = useState<BadaniaKrwiWpis[]>([]);
  const [selectedBadanieDetail, setSelectedBadanieDetail] = useState<BadaniaKrwiWpis | null>(null);
  const [isBadaniaModalOpen, setIsBadaniaModalOpen] = useState<boolean>(false);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState<boolean>(false);
  const [editingBadanieId, setEditingBadanieId] = useState<number | null>(null);

  const [isUploadingPdf, setIsUploadingPdf] = useState<boolean>(false);
  const [isUploadingImages, setIsUploadingImages] = useState<boolean>(false);
  const [isSavingBadanie, setIsSavingBadanie] = useState<boolean>(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // Formularz Badania Krwi
  const [badanieFormData, setBadanieFormData] = useState({
    data_badania: new Date().toISOString().split('T')[0],
    plik_pdf_url: '' as string,
    plik_pdf_nazwa: '' as string,
    zdjecia: [] as string[],
    interpretacja: '',
    zalecenia: '',
    suplementacja_trener: [{ nazwa: '', dawka: '' }] as SuplementTrenera[],
    suplementacja_klubowicz: [] as SuplementKlubowicza[]
  });

  const [nagrodaFormData, setNagrodaFormData] = useState({
    miejsce: "1",
    tytul: "",
    opis: ""
  });

  const [edycjaFormData, setEdycjaFormData] = useState({
    nazwa: "Wyzwanie Redukcji Tkanki Tłuszczowej",
    data_start: new Date().toISOString().split('T')[0],
    data_koniec: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    wpisowe_kwota: "30.00",
    min_uczestnikow: "5",
    opis: "Wspólne wyzwanie utraty tkanki tłuszczowej. Pomiary na analizatorze na początku i końcu wyzwania.",
    status: 'zapisy' as 'aktywne' | 'zapisy' | 'zakonczone' | 'anulowane'
  });

  const [redukcjaPomiarForm, setRedukcjaPomiarForm] = useState({
    data_pomiaru: new Date().toISOString().split('T')[0],
    waga_kg: '',
    fat_proc: '',
    muscle_kg: '',
    visceral_level: ''
  });

  const [formData, setFormData] = useState({
    data_pomiaru: new Date().toISOString().split('T')[0],
    miejsce_typ: 'STUDIO' as 'STUDIO' | 'INNE',
    miejsce_inne_opis: '',
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

  // Stany kalkulatora dietetycznego
  const [calcWeight, setCalcWeight] = useState<string>('');
  const [calcFat, setCalcFat] = useState<string>('');
  const [calcHeight, setCalcHeight] = useState<string>('');
  const [calcAge, setCalcAge] = useState<string>('');
  const [calcGender, setCalcGender] = useState<string>('mezczyzna');
  const [calcPal, setCalcPal] = useState<string>('1.4');
  const [calcGoal, setCalcGoal] = useState<string>('-0.2');
  const [calcResult, setCalcResult] = useState<{
    bmr: number;
    bmrMifflin?: number | null;
    tdee: number;
    targetKcal: number;
    protein: number;
    fat: number;
    carbs: number;
    water: number;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const hasUnreadInterpretation = useMemo(() => {
    return badaniaList.some(b => b.nowa_interpretacja === true);
  }, [badaniaList]);

  const markChallengeAsRead = (edycjaId?: number | null) => {
    if (typeof window === 'undefined') return;
    const targetId = edycjaId || selectedEdycjaId;
    if (targetId) {
      localStorage.setItem(`seen_challenge_${targetId}`, 'true');
    }
    setHasUnreadChallenge(false);
  };

  const verifyAndAutoActivateChallenge = async (
    edycjaId: number, 
    uczestnicyList: RedukcjaUczestnik[], 
    edycjeList?: RedukcjaEdycja[]
  ) => {
    const listToSearch = edycjeList || edycjeRedukcji;
    const currentEdycja = listToSearch.find(e => e.id === edycjaId);
    if (!currentEdycja) return;

    if (currentEdycja.status === 'zapisy') {
      const minRequired = currentEdycja.min_uczestnikow || 5;
      const paidCount = uczestnicyList.filter(u => u.oplacone).length;

      if (paidCount >= minRequired) {
        await supabase
          .from('klub_redukcja_edycje')
          .update({ status: 'aktywne' })
          .eq('id', edycjaId);

        setEdycjeRedukcji(prev => prev.map(e => e.id === edycjaId ? { ...e, status: 'aktywne' } : e));
      }
    }
  };

  const fetchBadaniaKrwi = async (klientId: number | string | null, email: string) => {
    try {
      let query = supabase.from('klub_badania_krwi').select('*').order('data_badania', { ascending: false });
      if (klientId) {
        query = query.or(`klient_id.eq.${klientId},email_klienta.ilike.${email.trim()}`);
      } else {
        query = query.ilike('email_klienta', email.trim());
      }

      const { data, error } = await query;
      if (data && !error) {
        setBadaniaList(data as BadaniaKrwiWpis[]);
      } else {
        setBadaniaList([]);
      }
    } catch (err) {
      console.error("Błąd pobierania badań krwi:", err);
      setBadaniaList([]);
    }
  };

  const markInterpretationAsRead = async (badanieId?: number) => {
    if (appRole !== 'klubowicz') return;
    
    try {
      if (badanieId) {
        await supabase.from('klub_badania_krwi').update({ nowa_interpretacja: false }).eq('id', badanieId);
        setBadaniaList(prev => prev.map(b => b.id === badanieId ? { ...b, nowa_interpretacja: false } : b));
      } else {
        const unreadIds = badaniaList.filter(b => b.nowa_interpretacja).map(b => b.id);
        if (unreadIds.length > 0) {
          await supabase.from('klub_badania_krwi').update({ nowa_interpretacja: false }).in('id', unreadIds);
          setBadaniaList(prev => prev.map(b => ({ ...b, nowa_interpretacja: false })));
        }
      }
    } catch (err) {
      console.error("Błąd oznaczania odczytania interpretacji:", err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
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
                
                if (myClientProfile.wzrost) setCalcHeight(String(myClientProfile.wzrost));
                const age = calculateAge(myClientProfile.Urodziny || myClientProfile.urodziny);
                if (age) setCalcAge(String(age));

                await fetchMeasurements(myClientProfile.id, cleanEmail);
                await fetchBadaniaKrwi(myClientProfile.id, cleanEmail);
              }
            } else {
              setAppRole('klubowicz');
              if (myClientProfile) {
                setSelectedKlient(myClientProfile);
                const g = (myClientProfile.gender || myClientProfile.Płeć || myClientProfile.plec || '').toLowerCase();
                if (g.includes('kobieta') || g === 'k') setCalcGender('kobieta');
                else if (g.includes('mężczyzna') || g.includes('mezczyzna') || g === 'm') setCalcGender('mezczyzna');
                
                if (myClientProfile.wzrost) setCalcHeight(String(myClientProfile.wzrost));
                const age = calculateAge(myClientProfile.Urodziny || myClientProfile.urodziny);
                if (age) setCalcAge(String(age));

                await fetchMeasurements(myClientProfile.id, cleanEmail);
                await fetchBadaniaKrwi(myClientProfile.id, cleanEmail);
              }
            }
          }

          await fetchRedukcjaData();
        }
      } catch (err) {
        console.error("Błąd podczas inicjalizacji widoku Analizy Formy:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const fetchRedukcjaData = async () => {
    try {
      const edycjeData = await fetchAllFromSupabase('klub_redukcja_edycje', '*', 'data_koniec', false, 2);
      if (edycjeData && edycjeData.length > 0) {
        const sorted = (edycjeData as RedukcjaEdycja[]).sort((a, b) => 
          new Date(b.data_koniec).getTime() - new Date(a.data_koniec).getTime()
        );
        setEdycjeRedukcji(sorted);
        
        const active = sorted.find((e: any) => e.status !== 'zakonczone' && e.status !== 'anulowane') || sorted[0];
        
        if (active && (active.status === 'aktywne' || active.status === 'zapisy')) {
          if (typeof window !== 'undefined') {
            const hasSeen = localStorage.getItem(`seen_challenge_${active.id}`);
            if (!hasSeen) {
              setHasUnreadChallenge(true);
            }
          }
        }

        if (!selectedEdycjaId) {
          setSelectedEdycjaId(active.id);
          await loadEdycjaDetails(active.id, sorted);
        } else {
          await loadEdycjaDetails(selectedEdycjaId, sorted);
        }
      }
    } catch (err) {
      console.error("Błąd ładowania wyzwań redukcji:", err);
    }
  };

  const loadEdycjaDetails = async (edycjaId: number, optionalEdycjeList?: RedukcjaEdycja[]) => {
    try {
      const [uczestnicyRes, pomiaryRes, nagrodyRes] = await Promise.all([
        supabase.from('klub_redukcja_uczestnicy').select('*').eq('edycja_id', edycjaId),
        supabase.from('klub_redukcja_pomiary').select('*').eq('edycja_id', edycjaId),
        supabase.from('klub_redukcja_nagrody').select('*').eq('edycja_id', edycjaId).order('miejsce', { ascending: true })
      ]);

      let loadedParticipants: RedukcjaUczestnik[] = [];
      if (uczestnicyRes?.data) {
        loadedParticipants = uczestnicyRes.data as RedukcjaUczestnik[];
        setUczestnicyRedukcji(loadedParticipants);
      }
      if (pomiaryRes?.data) {
        setPomiaryRedukcji(pomiaryRes.data as RedukcjaPomiar[]);
      }
      if (nagrodyRes?.data) {
        setNagrodyRedukcji(nagrodyRes.data as RedukcjaNagroda[]);
      }

      if (loadedParticipants.length > 0) {
        await verifyAndAutoActivateChallenge(edycjaId, loadedParticipants, optionalEdycjeList);
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

  const fetchMeasurements = async (klientId: number | string, email: string) => {
    try {
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
    } catch (err) {
      console.error("Błąd pobierania pomiarów:", err);
      setMeasurements([]);
    }
  };

  const handleSelectClient = (klient: Klient) => {
    setSelectedKlient(klient);
    setSearchQuery(`${klient.Imię || ''} ${klient.Nazwisko || ''}`.trim());
    setIsSearchFocused(false);

    const g = (klient.gender || klient.Płeć || klient.plec || '').toLowerCase();
    if (g.includes('kobieta') || g === 'k') setCalcGender('kobieta');
    else if (g.includes('mężczyzna') || g.includes('mezczyzna') || g === 'm') setCalcGender('mezczyzna');

    if (klient.wzrost) setCalcHeight(String(klient.wzrost));
    const age = calculateAge(klient.Urodziny || klient.urodziny);
    if (age) setCalcAge(String(age));

    fetchMeasurements(klient.id, klient['E-mail']);
    fetchBadaniaKrwi(klient.id, klient['E-mail']);
  };

  const handleSubmitMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetKlientId = selectedKlient ? selectedKlient.id : null;
    const targetEmail = selectedKlient ? selectedKlient['E-mail'] : currentUserEmail;

    if (!formData.waga) {
      alert("Waga jest polem wymaganym.");
      return;
    }

    setIsSubmitting(true);

    const computedMiejsce = formData.miejsce_typ === 'STUDIO' 
      ? 'STUDIO' 
      : (formData.miejsce_inne_opis.trim() || 'Inne');

    const payload = {
      klient_id: targetKlientId,
      email_klienta: targetEmail,
      data_pomiaru: formData.data_pomiaru,
      miejsce_pomiaru: computedMiejsce,
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
      alert(editingMeasurementId ? "Pomiar został zaktualizowany!" : "Nowy pomiar został dodany!");
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
    if (!confirm("Czy na pewno chcesz usunąć ten pomiar?")) return;
    const { error } = await supabase.from('analiza_formy').delete().eq('id', id);
    if (!error) {
      setMeasurements(prev => prev.filter(m => m.id !== id));
    } else {
      alert("Błąd podczas usuwania: " + error.message);
    }
  };

  const normalizeCoachSupplements = (items: any): SuplementTrenera[] => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return [{ nazwa: '', dawka: '' }];
    }
    return items.map((item: any) => {
      if (typeof item === 'string') {
        return { nazwa: item, dawka: '' };
      }
      return {
        nazwa: item?.nazwa || '',
        dawka: item?.dawka || ''
      };
    });
  };

  // --- OBSŁUGA BADAŃ KRWI ---
  const handleOpenNewBadanieModal = () => {
    setEditingBadanieId(null);
    setBadanieFormData({
      data_badania: new Date().toISOString().split('T')[0],
      plik_pdf_url: '',
      plik_pdf_nazwa: '',
      zdjecia: [],
      interpretacja: '',
      zalecenia: '',
      suplementacja_trener: [{ nazwa: '', dawka: '' }],
      suplementacja_klubowicz: []
    });
    setIsBadaniaModalOpen(true);
  };

  const handleEditBadanie = (badanie: BadaniaKrwiWpis) => {
    setEditingBadanieId(badanie.id);
    setBadanieFormData({
      data_badania: badanie.data_badania || new Date().toISOString().split('T')[0],
      plik_pdf_url: badanie.plik_pdf_url || '',
      plik_pdf_nazwa: badanie.plik_pdf_nazwa || '',
      zdjecia: badanie.zdjecia || [],
      interpretacja: badanie.interpretacja || '',
      zalecenia: badanie.zalecenia || '',
      suplementacja_trener: normalizeCoachSupplements(badanie.suplementacja_trener),
      suplementacja_klubowicz: (badanie.suplementacja_klubowicz || []).map((k: any) => ({
        produkt: k.produkt || k.nazwa || '',
        dawka: k.dawka || '',
        jednostka: k.jednostka || 'mg'
      }))
    });
    setIsBadaniaModalOpen(true);
  };

  const handleDeleteBadanie = async (badanieId: number) => {
    if (!confirm("Czy na pewno chcesz bezpowrotnie usunąć ten wpis badań krwi?")) return;
    try {
      const { error } = await supabase.from('klub_badania_krwi').delete().eq('id', badanieId);
      if (!error) {
        setBadaniaList(prev => prev.filter(b => b.id !== badanieId));
        if (selectedBadanieDetail?.id === badanieId) {
          setIsDetailViewOpen(false);
          setSelectedBadanieDetail(null);
        }
        alert("Wpis badań krwi został usunięty.");
      } else {
        alert("Błąd podczas usuwania: " + error.message);
      }
    } catch (err: any) {
      alert("Błąd: " + err.message);
    }
  };

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert("Proszę wybrać plik PDF.");
      return;
    }

    setIsUploadingPdf(true);
    try {
      const tKlientId = selectedKlient?.id || currentUserId || 'klient';
      const fileName = `badania_${tKlientId}_${Date.now()}.pdf`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('badania')
        .upload(fileName, file, { upsert: true });

      let publicUrl = '';
      if (!uploadErr && uploadData) {
        const { data: urlData } = supabase.storage.from('badania').getPublicUrl(fileName);
        publicUrl = urlData.publicUrl;
      } else {
        publicUrl = URL.createObjectURL(file);
      }

      setBadanieFormData(prev => ({
        ...prev,
        plik_pdf_url: publicUrl,
        plik_pdf_nazwa: file.name
      }));
    } catch (err: any) {
      alert("Błąd wgrywania PDF: " + err.message);
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    try {
      const tKlientId = selectedKlient?.id || currentUserId || 'klient';
      const newUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = `skan_${tKlientId}_${Date.now()}_${i}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('badania')
          .upload(fileName, file, { upsert: true });

        if (!uploadErr && uploadData) {
          const { data: urlData } = supabase.storage.from('badania').getPublicUrl(fileName);
          newUrls.push(urlData.publicUrl);
        } else {
          newUrls.push(URL.createObjectURL(file));
        }
      }

      setBadanieFormData(prev => ({
        ...prev,
        zdjecia: [...prev.zdjecia, ...newUrls]
      }));
    } catch (err: any) {
      alert("Błąd podczas dodawania zdjęć: " + err.message);
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleAddCoachSupplementRow = () => {
    setBadanieFormData(prev => ({
      ...prev,
      suplementacja_trener: [...prev.suplementacja_trener, { nazwa: '', dawka: '' }]
    }));
  };

  const handleUpdateCoachSupplementRow = (index: number, field: keyof SuplementTrenera, value: string) => {
    const updated = [...badanieFormData.suplementacja_trener];
    updated[index] = { ...updated[index], [field]: value };
    setBadanieFormData(prev => ({ ...prev, suplementacja_trener: updated }));
  };

  const handleRemoveCoachSupplementRow = (index: number) => {
    const updated = badanieFormData.suplementacja_trener.filter((_, i) => i !== index);
    setBadanieFormData(prev => ({ 
      ...prev, 
      suplementacja_trener: updated.length > 0 ? updated : [{ nazwa: '', dawka: '' }] 
    }));
  };

  const handleAddMemberSupplementRow = () => {
    setBadanieFormData(prev => ({
      ...prev,
      suplementacja_klubowicz: [
        ...prev.suplementacja_klubowicz,
        { produkt: '', dawka: '', jednostka: 'mg' }
      ]
    }));
  };

  const handleUpdateMemberSupplementRow = (index: number, field: keyof SuplementKlubowicza, value: string) => {
    const updated = [...badanieFormData.suplementacja_klubowicz];
    updated[index] = { ...updated[index], [field]: value };
    setBadanieFormData(prev => ({ ...prev, suplementacja_klubowicz: updated }));
  };

  const handleRemoveMemberSupplementRow = (index: number) => {
    const updated = badanieFormData.suplementacja_klubowicz.filter((_, i) => i !== index);
    setBadanieFormData(prev => ({ ...prev, suplementacja_klubowicz: updated }));
  };

  const handleSaveBadanieFull = async (e: React.FormEvent) => {
    e.preventDefault();
    const tKlientId = selectedKlient ? selectedKlient.id : currentUserId;
    const tEmail = selectedKlient ? selectedKlient['E-mail'] : currentUserEmail;

    if (!tEmail) {
      alert("Nie można zidentyfikować profilu klubowicza.");
      return;
    }

    setIsSavingBadanie(true);

    const isTrainerOrAdmin = appRole === 'admin' || appRole === 'trener';
    
    // Filtrowanie suplementów
    const filteredCoachSupplements = badanieFormData.suplementacja_trener
      .filter(s => s.nazwa.trim() !== '' || s.dawka.trim() !== '');

    const filteredMemberSupplements = badanieFormData.suplementacja_klubowicz
      .filter(s => s.produkt.trim() !== '' || s.dawka.trim() !== '');

    // Jeśli edytuje klubowicz, nie nadpisujemy pustymi wartościami zaleceń trenera
    const existingBadanie = editingBadanieId ? badaniaList.find(b => b.id === editingBadanieId) : null;

    const payload = {
      klient_id: tKlientId,
      email_klienta: tEmail,
      data_badania: badanieFormData.data_badania,
      plik_pdf_url: badanieFormData.plik_pdf_url || null,
      plik_pdf_nazwa: badanieFormData.plik_pdf_nazwa || null,
      zdjecia: isTrainerOrAdmin ? (badanieFormData.zdjecia || []) : (existingBadanie?.zdjecia || []),
      interpretacja: isTrainerOrAdmin ? (badanieFormData.interpretacja || null) : (existingBadanie?.interpretacja || null),
      zalecenia: isTrainerOrAdmin ? (badanieFormData.zalecenia || null) : (existingBadanie?.zalecenia || null),
      suplementacja_trener: isTrainerOrAdmin ? filteredCoachSupplements : (existingBadanie?.suplementacja_trener || []),
      suplementacja_klubowicz: filteredMemberSupplements,
      nowa_interpretacja: isTrainerOrAdmin && Boolean(badanieFormData.interpretacja && badanieFormData.interpretacja.trim().length > 0),
      updated_at: new Date().toISOString()
    };

    try {
      let error = null;
      if (editingBadanieId) {
        const res = await supabase.from('klub_badania_krwi').update(payload).eq('id', editingBadanieId);
        error = res.error;
      } else {
        const res = await supabase.from('klub_badania_krwi').insert([payload]);
        error = res.error;
      }

      if (!error) {
        alert(editingBadanieId ? "Wpis badań został zaktualizowany!" : "Nowy wpis badań został zapisany!");
        setIsBadaniaModalOpen(false);
        setEditingBadanieId(null);
        await fetchBadaniaKrwi(tKlientId, tEmail);
      } else {
        alert("Błąd zapisu badania: " + error.message);
      }
    } catch (err: any) {
      alert("Błąd zapisu: " + err.message);
    } finally {
      setIsSavingBadanie(false);
    }
  };

  const handleCreateEdycja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edycjaFormData.nazwa.trim()) return;

    const { data, error } = await supabase.from('klub_redukcja_edycje').insert([{
      nazwa: edycjaFormData.nazwa.trim(),
      data_start: edycjaFormData.data_start,
      data_koniec: edycjaFormData.data_koniec,
      wpisowe_kwota: parseFloat(edycjaFormData.wpisowe_kwota) || 30.00,
      min_uczestnikow: parseInt(edycjaFormData.min_uczestnikow) || 5,
      opis: edycjaFormData.opis.trim(),
      status: edycjaFormData.status
    }]).select();

    if (!error && data) {
      alert("Nowe wyzwanie redukcji zostało utworzone!");
      setIsNewEdycjaModalOpen(false);
      await fetchRedukcjaData();
    } else {
      alert("Błąd tworzenia wyzwania: " + error?.message);
    }
  };

  const handleArchiveEdycja = async (id: number) => {
    if (!confirm("Czy na pewno chcesz zakończyć tę edycję i przenieść ją do archiwum?")) return;
    const { error } = await supabase
      .from('klub_redukcja_edycje')
      .update({ status: 'zakonczone' })
      .eq('id', id);

    if (!error) {
      await fetchRedukcjaData();
    }
  };

  const handleCancelAndRefundEdycja = async (edycja: RedukcjaEdycja) => {
    const oplaceniUczestnicy = (uczestnicyRedukcji || []).filter(u => u.oplacone);
    const kwotaZwrotu = Number(edycja.wpisowe_kwota) || 30.00;

    const potw = confirm(
      `Minimalna liczba osób (${edycja.min_uczestnikow || 0}) nie została osiągnięta.\n\nCzy chcesz odwołać to wyzwanie i automatycznie zwrócić wpisowe (${kwotaZwrotu} zł) do portfela każdego z ${oplaceniUczestnicy.length} opłaconych uczestników?`
    );
    if (!potw) return;

    setIsLoading(true);
    try {
      for (const u of oplaceniUczestnicy) {
        const { data: klientData } = await supabase
          .from('klienci')
          .select('id, portfel, "E-mail"')
          .eq('id', u.klient_id)
          .maybeSingle();

        if (klientData) {
          const currentWallet = Number(klientData.portfel) || 0;
          await supabase
            .from('klienci')
            .update({ portfel: currentWallet + kwotaZwrotu })
            .eq('id', u.klient_id);

          await supabase.from('powiadomienia').insert([{
            klient_id: u.klient_id,
            email: klientData['E-mail'] || '',
            tytul: `Zwrot wpisowego: ${edycja.nazwa}`,
            tresc: `Wyzwanie "${edycja.nazwa}" nie osiągnęło minimalnej liczby uczestników (${edycja.min_uczestnikow || 0} osób). Kwota wpisowego (${kwotaZwrotu} zł) została zwrócona do Twojego portfela klubowicza.`,
            przeczytane: false
          }]);
        }
      }

      await supabase
        .from('klub_redukcja_edycje')
        .update({ status: 'anulowane' })
        .eq('id', edycja.id);

      alert(`Wyzwanie zostało odwołane. Zwrócono środki do portfeli ${oplaceniUczestnicy.length} klubowiczów oraz wysłano powiadomienia.`);
      await fetchRedukcjaData();
    } catch (err: any) {
      console.error("Błąd podczas procedury zwrotu:", err);
      alert("Wystąpił błąd podczas zwrotu środków: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEdycja = async (id: number) => {
    if (!confirm("Czy na pewno chcesz CAŁKOWICIE USUNĄĆ to wyzwanie oraz wszystkich jego uczestników i pomiary? Operacji tej nie można cofnąć!")) return;
    const { error } = await supabase
      .from('klub_redukcja_edycje')
      .delete()
      .eq('id', id);

    if (!error) {
      alert("Wyzwanie zostało trwale usunięte.");
      setSelectedEdycjaId(null);
      await fetchRedukcjaData();
    } else {
      alert("Błąd usuwania wyzwania: " + error.message);
    }
  };

  const handleDeleteParticipant = async (uczestnikId: number) => {
    if (!confirm("Czy na pewno chcesz usunąć tego uczestnika z wyzwania?")) return;
    const { error } = await supabase
      .from('klub_redukcja_uczestnicy')
      .delete()
      .eq('id', uczestnikId);

    if (!error && selectedEdycjaId) {
      alert("Uczestnik został usunięty z wyzwania.");
      await loadEdycjaDetails(selectedEdycjaId);
    } else if (error) {
      alert("Błąd usuwania uczestnika: " + error.message);
    }
  };

  const handleManualAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEdycjaId || !manualAddKlientId) {
      alert("Wybierz klubowicza z listy!");
      return;
    }

    const { error } = await supabase.from('klub_redukcja_uczestnicy').insert([{
      edycja_id: selectedEdycjaId,
      klient_id: manualAddKlientId,
      oplacone: manualAddOplacone,
      metoda_platnosci: manualAddMetoda,
      brak_pomiaru_koncowego: false,
      punkty_calkowite: 0.00
    }]);

    if (!error) {
      alert("Klubowicz został pomyślnie dodany do wyzwania! (Kwota wpisowego trafia do kasy klubu)");
      setIsManualAddModalOpen(false);
      setManualAddKlientId('');
      setManualAddSearchQuery('');
      await loadEdycjaDetails(selectedEdycjaId);
    } else {
      if (error.code === '23505') {
        alert("Ten klubowicz jest już zapisany w tej edycji!");
      } else {
        alert("Błąd dodawania: " + error.message);
      }
    }
  };

  const handleAddNagroda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEdycjaId || !nagrodaFormData.tytul.trim()) return;

    const { error } = await supabase.from('klub_redukcja_nagrody').insert([{
      edycja_id: selectedEdycjaId,
      miejsce: parseInt(nagrodaFormData.miejsce) || 1,
      tytul: nagrodaFormData.tytul.trim(),
      opis: nagrodaFormData.opis.trim() || null
    }]);

    if (!error) {
      alert("Nagroda została dodana do tego wyzwania!");
      setNagrodaFormData({ miejsce: "1", tytul: "", opis: "" });
      setIsAddNagrodaModalOpen(false);
      await loadEdycjaDetails(selectedEdycjaId);
    } else {
      alert("Błąd dodawania nagrody: " + error.message);
    }
  };

  const handleDeleteNagroda = async (nagrodaId: number) => {
    if (!confirm("Czy na pewno chcesz usunąć tę nagrodę?")) return;
    const { error } = await supabase.from('klub_redukcja_nagrody').delete().eq('id', nagrodaId);
    if (!error && selectedEdycjaId) {
      await loadEdycjaDetails(selectedEdycjaId);
    }
  };

  const redirectToAutopay = async (amount: number, orderId: string, description: string, type: string) => {
    setIsProcessingPayment(true);
    try {
      const response = await fetch('/api/autopay/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          orderId: orderId,
          userId: selectedKlient?.id || currentUserId,
          description: description,
          email: selectedKlient ? selectedKlient['E-mail'] : currentUserEmail,
          type: type,
          edycja_id: selectedEdycjaId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Nie udało się zainicjalizować płatności w Autopay');
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.gatewayUrl;
      form.setAttribute('accept-charset', 'UTF-8');

      Object.keys(data.payload).forEach((key) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = data.payload[key];
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();

    } catch (err: any) {
      console.error("Błąd przekierowania do Autopay:", err);
      alert(`Wystąpił błąd: ${err.message}`);
      setIsProcessingPayment(false);
    }
  };

  const handleConfirmJoinWithPayment = async () => {
    const kId = selectedKlient?.id || currentUserId;
    if (!kId || !selectedEdycjaId) {
      alert("Nie można zidentyfikować profilu klubowicza.");
      return;
    }

    const edycja = edycjeRedukcji.find(e => e.id === selectedEdycjaId);
    const kwota = Number(edycja?.wpisowe_kwota) || 30.00;

    if (selectedPaymentMethod === 'autopay') {
      const orderId = `RED-${selectedEdycjaId}-${kId}-${Date.now()}`.substring(0, 32);
      const opisOperacji = `Wpisowe: ${edycja?.nazwa || 'Wyzwanie Redukcji'}`;

      await supabase.from('klub_redukcja_uczestnicy').upsert([{
        edycja_id: selectedEdycjaId,
        klient_id: kId,
        oplacone: false,
        metoda_platnosci: 'autopay',
        brak_pomiaru_koncowego: false,
        punkty_calkowite: 0.00
      }], { onConflict: 'edycja_id,klient_id' });

      await redirectToAutopay(kwota, orderId, opisOperacji, 'redukcja_fee');
    } else {
      const { error } = await supabase.from('klub_redukcja_uczestnicy').upsert([{
        edycja_id: selectedEdycjaId,
        klient_id: kId,
        oplacone: false,
        metoda_platnosci: 'gotowka',
        brak_pomiaru_koncowego: false,
        punkty_calkowite: 0.00
      }], { onConflict: 'edycja_id,klient_id' });

      if (!error) {
        alert("Zostałeś zarejestrowany! Wybrałeś płatność gotówką na recepcji — wpłata trafia do kasy klubu po zatwierdzeniu przez trenera.");
        setIsJoinModalOpen(false);
        await loadEdycjaDetails(selectedEdycjaId);
      } else {
        alert("Błąd zapisu: " + error.message);
      }
    }
  };

  const handleCheckboxPaymentToggle = async (uczestnikId: number, newStatus: boolean) => {
    const updatedParticipants = uczestnicyRedukcji.map(u => u.id === uczestnikId ? { ...u, oplacone: newStatus } : u);
    setUczestnicyRedukcji(updatedParticipants);

    const { error } = await supabase
      .from('klub_redukcja_uczestnicy')
      .update({ oplacone: newStatus })
      .eq('id', uczestnikId);

    if (error) {
      alert("Błąd aktualizacji statusu płatności: " + error.message);
      if (selectedEdycjaId) await loadEdycjaDetails(selectedEdycjaId);
    } else if (selectedEdycjaId) {
      await verifyAndAutoActivateChallenge(selectedEdycjaId, updatedParticipants);
    }
  };

  const handleToggleBrakPomiaru = async (uczestnikId: number, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setUczestnicyRedukcji(prev => prev.map(u => u.id === uczestnikId ? { ...u, brak_pomiaru_koncowego: newStatus } : u));

    const { error } = await supabase
      .from('klub_redukcja_uczestnicy')
      .update({ brak_pomiaru_koncowego: newStatus })
      .eq('id', uczestnikId);

    if (error) {
      alert("Błąd aktualizacji: " + error.message);
      if (selectedEdycjaId) await loadEdycjaDetails(selectedEdycjaId);
    }
  };

  const handleOpenRedukcjaPomiarModal = (etap: 'start' | 'koniec', klientId: number | string) => {
    setTargetPomiarEtap(etap);
    setTargetPomiarKlientId(klientId);

    const existing = (pomiaryRedukcji || []).find(p => String(p.klient_id) === String(klientId) && p.etap === etap);

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
      waga_kg: parseFloat(redukcjaPomiarForm.waga_kg) || 0,
      fat_proc: parseFloat(redukcjaPomiarForm.fat_proc) || 0,
      muscle_kg: parseFloat(redukcjaPomiarForm.muscle_kg) || 0,
      visceral_level: parseInt(redukcjaPomiarForm.visceral_level) || 0
    };

    const { error } = await supabase
      .from('klub_redukcja_pomiary')
      .upsert(payload, { onConflict: 'edycja_id,klient_id,etap' });

    if (!error) {
      await supabase.rpc('fn_przelicz_wynik_redukcji', {
        p_edycja_id: selectedEdycjaId,
        p_klient_id: targetPomiarKlientId
      });

      alert(`Pomiar ${targetPomiarEtap === 'start' ? 'POCZĄTKOWY' : 'KOŃCOWY'} został zapisany!`);
      setIsRedukcjaPomiarModalOpen(false);
      await loadEdycjaDetails(selectedEdycjaId);
    } else {
      alert("Błąd zapisu pomiaru: " + error.message);
    }
  };

  const activeEdycjaObj = edycjeRedukcji.find(e => e.id === selectedEdycjaId) || null;
  const activeUserKlientId = selectedKlient?.id || currentUserId;
  const isCurrentUserJoined = (uczestnicyRedukcji || []).some(u => String(u.klient_id) === String(activeUserKlientId));
  const activeUserParticipant = (uczestnicyRedukcji || []).find(u => String(u.klient_id) === String(activeUserKlientId));

  const formatParticipantDisplayName = (fullName: string) => {
    if (appRole === 'admin' || isCurrentUserJoined) {
      return fullName;
    }
    const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1].charAt(0)}.`;
    }
    return parts[0] || "Klubowicz";
  };

  const rankingRedukcji = useMemo(() => {
    return (uczestnicyRedukcji || []).map(uczestnik => {
      const klientObj = (klienci || []).find(k => String(k.id) === String(uczestnik.klient_id));
      const startP = (pomiaryRedukcji || []).find(p => String(p.klient_id) === String(uczestnik.klient_id) && p.etap === 'start');
      const koniecP = (pomiaryRedukcji || []).find(p => String(p.klient_id) === String(uczestnik.klient_id) && p.etap === 'koniec');

      let totalPkt = 0;
      let hasBoth = false;
      let deltaWagaKg = 0;
      let deltaWagaProc = 0;
      let deltaFatProc = 0;
      let deltaMuscleKg = 0;

      if (startP && koniecP) {
        hasBoth = true;
        const sW = Number(startP.waga_kg) || 0;
        const kW = Number(koniecP.waga_kg) || 0;
        const sF = Number(startP.fat_proc) || 0;
        const kF = Number(koniecP.fat_proc) || 0;
        const sM = Number(startP.muscle_kg) || 0;
        const kM = Number(koniecP.muscle_kg) || 0;
        const sV = Number(startP.visceral_level) || 0;
        const kV = Number(koniecP.visceral_level) || 0;

        deltaWagaKg = kW - sW;
        deltaWagaProc = sW > 0 ? ((sW - kW) / sW) * 100 : 0;
        deltaFatProc = sF - kF;
        deltaMuscleKg = kM - sM;
        const deltaMuscleProc = sM > 0 ? ((kM - sM) / sM) * 100 : 0;
        const deltaVisceral = sV - kV;

        const pktWaga = deltaWagaProc;
        const pktFat = deltaFatProc * 1.5;
        const pktMuscle = deltaMuscleProc * 1.2;
        const pktVisceral = deltaVisceral * 2.0;

        totalPkt = parseFloat((pktWaga + pktFat + pktMuscle + pktVisceral).toFixed(2)) || 0;
      }

      const clientRawName = klientObj ? `${klientObj.Imię || ''} ${klientObj.Nazwisko || ''}`.trim() : 'Klubowicz';

      return {
        ...uczestnik,
        rawName: clientRawName,
        klientName: formatParticipantDisplayName(clientRawName),
        klientAvatar: klientObj?.avatarUrl || klientObj?.AvatarUrl || null,
        startP,
        koniecP,
        hasBoth,
        deltaWagaKg,
        deltaWagaProc,
        deltaFatProc,
        deltaMuscleKg,
        totalPkt
      };
    }).sort((a, b) => {
      if (a.brak_pomiaru_koncowego !== b.brak_pomiaru_koncowego) {
        return a.brak_pomiaru_koncowego ? 1 : -1;
      }
      if (a.hasBoth !== b.hasBoth) {
        return a.hasBoth ? -1 : 1;
      }
      return b.totalPkt - a.totalPkt;
    });
  }, [uczestnicyRedukcji, pomiaryRedukcji, klienci, appRole, isCurrentUserJoined]);

  const renderTrendIndicator = (val: number, isGoodWhenLower = true, unit = "") => {
    if (val === 0 || isNaN(val) || val === null || val === undefined) {
      return <span className="text-slate-400 font-bold">0.0 {unit}</span>;
    }
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
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    return (klienci || []).filter(k => 
      `${k.Imię || ''} ${k.Nazwisko || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (k['E-mail'] && k['E-mail'].toLowerCase().includes(searchQuery.toLowerCase())) ||
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
    
    return [...(measurements || [])]
      .filter(m => m.data_pomiaru && new Date(m.data_pomiaru) >= cutoffDate)
      .sort((a, b) => new Date(a.data_pomiaru).getTime() - new Date(b.data_pomiaru).getTime());
  }, [measurements]);

  const calculateKatchMcArdle = () => {
    const w = parseFloat(calcWeight || (latestMeasurement ? String(latestMeasurement.waga) : '0'));
    const bf = parseFloat(calcFat || (latestMeasurement?.tkanka_tluszczowa ? String(latestMeasurement.tkanka_tluszczowa) : '0'));
    const h = parseFloat(calcHeight || (selectedKlient?.wzrost ? String(selectedKlient.wzrost) : (latestMeasurement?.wzrost ? String(latestMeasurement.wzrost) : '0')));
    const a = parseFloat(calcAge || (calculateAge(selectedKlient?.Urodziny || selectedKlient?.urodziny)?.toString() || '0'));
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

    let bmrMifflin: number | null = null;
    if (h > 0 && a > 0) {
      if (calcGender === 'kobieta') {
        bmrMifflin = Math.round((10 * w) + (6.25 * h) - (5 * a) - 161);
      } else {
        bmrMifflin = Math.round((10 * w) + (6.25 * h) - (5 * a) + 5);
      }
    }

    const tdee = bmr * pal;
    const targetKcal = tdee * (1 + goalModifier);

    const proteinG = Math.round(lbm * 2.2);
    const fatG = Math.round(w * 0.9);
    const proteinKcal = proteinG * 4;
    const fatKcal = fatG * 9;
    const remainingKcal = Math.max(0, targetKcal - proteinKcal - fatKcal);
    const carbsG = Math.round(remainingKcal / 4);
    const waterMl = Math.round(w * 35);

    setCalcResult({
      bmr: Math.round(bmr),
      bmrMifflin: bmrMifflin,
      tdee: Math.round(tdee),
      targetKcal: Math.round(targetKcal),
      protein: proteinG,
      fat: fatG,
      carbs: carbsG,
      water: waterMl
    });
  };

  const renderLineChart = (
    title: string, 
    dataKey: keyof AnalizaFormyWpis, 
    unit: string, 
    strokeColor: string, 
    fillGradient: string
  ) => {
    const validPoints = (chartData24Months || [])
      .map(item => ({
        date: item.data_pomiaru,
        val: item[dataKey] !== null && item[dataKey] !== undefined ? Number(item[dataKey]) : null
      }))
      .filter((p): p is { date: string; val: number } => p.val !== null && !isNaN(p.val));

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
      const y = height - margin.bottom - ((p.val - yMin) / (yMax - yMin || 1)) * (height - margin.top - margin.bottom);
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
                    {p.date ? p.date.substring(5) : ''}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  const clientGenderDisplay = selectedKlient ? (selectedKlient.gender || selectedKlient.Płeć || selectedKlient.plec || 'Nie podano') : '';
  const clientHeightDisplay = selectedKlient?.wzrost ? `${selectedKlient.wzrost} cm` : (latestMeasurement?.wzrost ? `${latestMeasurement.wzrost} cm` : 'Brak');
  const clientCalculatedAge = selectedKlient ? calculateAge(selectedKlient.Urodziny || selectedKlient.urodziny) : null;

  const niezapisaniKlienci = useMemo(() => {
    return (klienci || []).filter(k => !(uczestnicyRedukcji || []).some(u => String(u.klient_id) === String(k.id)));
  }, [klienci, uczestnicyRedukcji]);

  const filteredNiezapisaniKlienci = useMemo(() => {
    if (!manualAddSearchQuery.trim()) return niezapisaniKlienci;
    const query = manualAddSearchQuery.toLowerCase().trim();
    return niezapisaniKlienci.filter(k => 
      `${k.Imię || ''} ${k.Nazwisko || ''}`.toLowerCase().includes(query) ||
      (k['E-mail'] && k['E-mail'].toLowerCase().includes(query)) ||
      (k['Numer tel.'] && k['Numer tel.'].includes(query))
    );
  }, [niezapisaniKlienci, manualAddSearchQuery]);

  const selectedManualKlientObj = useMemo(() => {
    if (!manualAddKlientId) return null;
    return (klienci || []).find(k => String(k.id) === String(manualAddKlientId)) || null;
  }, [klienci, manualAddKlientId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sky-900 font-black text-sm tracking-wider uppercase animate-pulse flex items-center gap-2">
          <span>⚖️</span> Ładowanie Analizy Formy...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans antialiased">
      
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
              ? "Panel administratora: Wyszukaj podopiecznego, zarządzaj pomiarami, badaniami krwi i planami" 
              : appRole === 'trener'
                ? "Twoje konto trenera: Zobacz swoje wyniki, pomiary, badania krwi oraz dietę lub wyszukaj podopiecznego"
                : "Twój dziennik postępów: Pomiary, skład ciała, badania krwi oraz wytyczne dietetyczne"}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {activeTab === 'pomiary' && ((appRole === 'admin' || (appRole === 'trener' && selectedKlient)) || appRole === 'klubowicz') && (
            <button
              onClick={() => {
                setEditingMeasurementId(null);
                setFormData({
                  data_pomiaru: new Date().toISOString().split('T')[0],
                  miejsce_typ: 'STUDIO',
                  miejsce_inne_opis: '',
                  wzrost: selectedKlient?.wzrost ? String(selectedKlient.wzrost) : (measurements[0]?.wzrost ? String(measurements[0].wzrost) : ''),
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

          {activeTab === 'badania' && (
            <button
              onClick={handleOpenNewBadanieModal}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <span>+</span> {appRole === 'klubowicz' ? 'Dodaj Wyniki Krwi (PDF)' : 'Dodaj Wyniki / Analizę Krwi'}
            </button>
          )}

          {activeTab === 'redukcja' && appRole === 'admin' && (
            <button
              onClick={() => setIsNewEdycjaModalOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <span>+</span> Nowe Wyzwanie Redukcji
            </button>
          )}
        </div>
      </div>

      {/* PASEK ZAKŁADEK */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-2xl bg-sky-100/60 p-1.5 border border-sky-200 text-[11px] sm:text-xs font-bold shadow-inner">
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
          onClick={() => {
            setActiveTab('redukcja');
            markChallengeAsRead();
          }}
          className={`py-2.5 px-2 sm:py-3 sm:px-4 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center cursor-pointer relative ${
            activeTab === 'redukcja'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
              : 'text-slate-600 hover:text-sky-950 hover:bg-white/50'
          }`}
        >
          <span>🔥</span> 
          <span>3. Redukcja</span>

          {hasUnreadChallenge && appRole === 'klubowicz' && (
            <span className="relative flex h-4 w-4 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-[10px] font-black text-white items-center justify-center shadow">
                !
              </span>
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('badania');
            markInterpretationAsRead();
          }}
          className={`py-2.5 px-2 sm:py-3 sm:px-4 rounded-xl transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center cursor-pointer relative ${
            activeTab === 'badania'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
              : 'text-slate-600 hover:text-sky-950 hover:bg-white/50'
          }`}
        >
          <span>🩸</span> 
          <span>4. Badania Krwi</span>

          {hasUnreadInterpretation && appRole === 'klubowicz' && (
            <span className="relative flex h-4 w-4 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-[10px] font-black text-white items-center justify-center shadow">
                !
              </span>
            </span>
          )}
        </button>
      </div>

      {/* WYSZUKIWARKA KLUBOWICZA */}
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
                  const myProfile = (klienci || []).find(c => (c['E-mail'] || '').toLowerCase().trim() === currentUserEmail);
                  if (myProfile) {
                    setSelectedKlient(myProfile);
                    fetchMeasurements(myProfile.id, currentUserEmail);
                    fetchBadaniaKrwi(myProfile.id, currentUserEmail);
                  } else {
                    setSelectedKlient(null);
                    setMeasurements([]);
                    setBadaniaList([]);
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
                  const wTxt = klient.wzrost ? `${klient.wzrost} cm` : 'Brak wzrostu';
                  const kAge = calculateAge(klient.Urodziny || klient.urodziny);
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
                          <div className="font-bold text-sky-950">
                            {klient.Imię} {klient.Nazwisko} 
                            <span className="text-[10px] text-slate-400 font-normal ml-1">
                              ({plecTxt} • {wTxt} {kAge ? `• ${kAge} lat` : ''})
                            </span>
                          </div>
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
                <span className="bg-sky-900 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-sky-700 font-bold">
                  Wzrost: {clientHeightDisplay}
                </span>
                <span className="bg-sky-900 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full border border-sky-700 font-bold">
                  Wiek: {clientCalculatedAge ? `${clientCalculatedAge} lat` : 'Brak'}
                </span>
              </div>
              <div className="text-xs text-sky-200/80 mt-0.5">
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
            Użyj powyższego pola wyszukiwania, aby wybrać klubowicza i załadować jego historię pomiarów oraz badań krwi.
          </div>
        )
      )}

      {/* ZAKŁADKA 1: POMIARY */}
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
              <table className="w-full text-xs text-left border-collapse min-w-[1100px]">
                <thead>
                  <tr className="bg-sky-950 text-amber-400 font-black uppercase text-[10px] tracking-wider">
                    <th className="p-3 border-r border-sky-900 sticky left-0 bg-sky-950 z-10">Data i Miejsce</th>
                    <th className="p-3 border-r border-sky-900 bg-sky-900/40 text-center" colSpan={7}>Obwody Centymetrem (cm)</th>
                    <th className="p-3 border-r border-sky-900 bg-slate-800/60 text-center" colSpan={7}>Analiza Składu Ciała</th>
                    <th className="p-3 text-center">Akcje / Edycja</th>
                  </tr>
                  <tr className="bg-sky-50 text-slate-700 font-bold border-b border-sky-200 text-[11px]">
                    <th className="p-2.5 border-r border-sky-200 sticky left-0 bg-sky-50 z-10">Data / Lokalizacja</th>
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
                    measurements.map((m) => {
                      const isStudio = !m.miejsce_pomiaru || m.miejsce_pomiaru.toUpperCase() === 'STUDIO';

                      return (
                        <tr key={m.id} className="hover:bg-sky-50/50 transition-colors">
                          <td className="p-3 font-black text-sky-950 border-r border-sky-100 sticky left-0 bg-white z-10 whitespace-nowrap">
                            <div>{m.data_pomiaru}</div>
                            <div className="mt-1">
                              {isStudio ? (
                                <span className="inline-flex items-center gap-1 bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded shadow-xs uppercase tracking-wider">
                                  🏢 STUDIO
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded border border-slate-300" title={m.miejsce_pomiaru || ''}>
                                  📍 {m.miejsce_pomiaru || 'Inne'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-center border-r border-sky-100">{m.obwod_pasa || '-'}</td>
                          <td className="p-3 text-center border-r border-sky-100">{m.klatka || '-'}</td>
                          <td className="p-3 text-center border-r border-sky-100">{m.ramie || '-'}</td>
                          <td className="p-3 text-center border-r border-sky-100">{m.talia || '-'}</td>
                          <td className="p-3 text-center border-r border-sky-100">{m.biodra || '-'}</td>
                          <td className="p-3 text-center border-r border-sky-100">{m.udo || '-'}</td>
                          <td className="p-3 text-center border-r border-sky-200">{m.lydka || '-'}</td>
                          <td className="p-3 text-center border-r border-sky-100 font-black text-sky-950">{m.waga}</td>
                          <td className="p-3 text-center border-r border-sky-100 font-semibold">{m.tkanka_tluszczowa ? `${m.tkanka_tluszczowa}%` : '-'}</td>
                          <td className="p-3 text-center border-r border-sky-100">{m.miesnie || '-'}</td>
                          <td className="p-3 text-center border-r border-sky-100">{m.kosci || '-'}</td>
                          <td className="p-3 text-center border-r border-sky-100">{m.wiek_metaboliczny || '-'}</td>
                          <td className="p-3 text-center border-r border-sky-100">{m.woda ? `${m.woda}%` : '-'}</td>
                          <td className="p-3 text-center border-r border-sky-200">{m.tluszcz_wisceralny || '-'}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingMeasurementId(m.id);
                                  const isMStudio = !m.miejsce_pomiaru || m.miejsce_pomiaru.toUpperCase() === 'STUDIO';
                                  setFormData({
                                    data_pomiaru: m.data_pomiaru || new Date().toISOString().split('T')[0],
                                    miejsce_typ: isMStudio ? 'STUDIO' : 'INNE',
                                    miejsce_inne_opis: isMStudio ? '' : (m.miejsce_pomiaru || ''),
                                    wzrost: m.wzrost !== null && m.wzrost !== undefined ? String(m.wzrost) : (selectedKlient?.wzrost ? String(selectedKlient.wzrost) : ''),
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
                      );
                    })
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

      {/* ZAKŁADKA 2: DIETA I MAKRO */}
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

          <div className="bg-white p-6 rounded-2xl border border-sky-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-sky-100 pb-3 gap-2">
              <div>
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider flex items-center gap-2">
                  <span>🧮</span> Kalkulator Katch-McArdle & Metabolizmu (BMR & TDEE)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Precyzyjna metoda oparta na beztłuszczowej masie ciała (LBM), uwzględniająca wiek, wzrost, płeć oraz cel kaloryczny.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Płeć *</label>
                <select
                  value={calcGender}
                  onChange={(e) => setCalcGender(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none font-bold text-sky-950 cursor-pointer"
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
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Tkanka tł. (%)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder={latestMeasurement?.tkanka_tluszczowa ? String(latestMeasurement.tkanka_tluszczowa) : "np. 15"}
                  value={calcFat}
                  onChange={(e) => setCalcFat(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Wzrost (cm)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="np. 175"
                  value={calcHeight}
                  onChange={(e) => setCalcHeight(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Wiek (lat)</label>
                <input
                  type="number"
                  placeholder="np. 35"
                  value={calcAge}
                  onChange={(e) => setCalcAge(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Aktywność (PAL)</label>
                <select
                  value={calcPal}
                  onChange={(e) => setCalcPal(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none font-medium cursor-pointer"
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
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-2.5 py-2 text-slate-800 focus:outline-none font-medium cursor-pointer"
                >
                  <option value="-0.2">🔥 -20% (Głęboka redukcja)</option>
                  <option value="-0.1">📉 -10% (Lekka redukcja)</option>
                  <option value="0">⚖️ 0% (Utrzymanie)</option>
                  <option value="0.1">📈 +10% (Lekka masa)</option>
                  <option value="0.2">💪 +20% (Budowa masy)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={calculateKatchMcArdle}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl shadow-sm text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Przelicz zapotrzebowanie ➔
              </button>
            </div>

            {calcResult && (
              <div className="bg-gradient-to-br from-sky-950 to-slate-900 p-5 rounded-2xl text-white space-y-4 shadow-md">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 text-center">
                  <div className="bg-sky-900/40 p-3 rounded-xl border border-sky-800">
                    <span className="text-[10px] text-sky-300 block uppercase font-bold">BMR (Katch-McArdle)</span>
                    <span className="text-lg font-black text-white">{calcResult.bmr} kcal</span>
                    {calcResult.bmrMifflin && (
                      <span className="text-[9px] text-sky-300 block mt-0.5">Mifflin: {calcResult.bmrMifflin} kcal</span>
                    )}
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
                  <div className="bg-sky-900/40 p-3 rounded-xl border border-sky-800">
                    <span className="text-[10px] text-cyan-300 block uppercase font-bold">Podaż Wody</span>
                    <span className="text-lg font-black text-cyan-300">{(calcResult.water / 1000).toFixed(2)} L</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ZAKŁADKA 3: REDUKCJA */}
      {activeTab === 'redukcja' && (
        <div className="space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
              <span className="text-xl">📅</span>
              <div className="text-xs text-emerald-950">
                <span className="font-black uppercase block mb-0.5">Dołącz w dowolnym momencie</span>
                Do trwającego wyzwania redukcji możesz przystąpić w każdym momencie trwania edycji! Twój wynik jest liczony od Twojego pierwszego pomiaru do finału.
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
              <span className="text-xl">⚠️</span>
              <div className="text-xs text-amber-950">
                <span className="font-black uppercase block mb-0.5">Wcześniejsze umówienie pomiarów</span>
                Analizę składu ciała (zarówno <b>startową</b>, jak i <b>finałową</b>) wykonujemy <b>po wcześniejszym umówieniu terminu z trenerem</b> (przed treningiem lub w osobnym terminie).
              </div>
            </div>
          </div>

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
                      <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                        activeEdycjaObj.status === 'zakonczone' 
                          ? 'bg-slate-800 text-slate-300 border-slate-700' 
                          : activeEdycjaObj.status === 'anulowane' 
                            ? 'bg-rose-950/80 text-rose-300 border-rose-800' 
                            : activeEdycjaObj.status === 'zapisy' 
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      }`}>
                        {activeEdycjaObj.status === 'zakonczone' 
                          ? 'Archiwum / Zakończona' 
                          : activeEdycjaObj.status === 'anulowane' 
                            ? 'Odwołane (Zwrócono wpisowe)' 
                            : activeEdycjaObj.status === 'zapisy' 
                              ? 'Otwarte Zapisy' 
                              : 'Wyzwanie Aktywne'}
                      </span>
                    </div>
                    <p className="text-xs text-sky-200/90 mt-0.5">{activeEdycjaObj.opis}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {appRole === 'admin' && activeEdycjaObj.status !== 'zakonczone' && activeEdycjaObj.status !== 'anulowane' && (
                    <>
                      <button
                        onClick={() => {
                          setManualAddKlientId('');
                          setManualAddSearchQuery('');
                          setIsManualAddModalOpen(true);
                        }}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow cursor-pointer uppercase tracking-wider"
                      >
                        + Dodaj Klubowicza
                      </button>
                      <button
                        onClick={() => handleArchiveEdycja(activeEdycjaObj.id)}
                        className="bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Zamknij wyzwanie ➔
                      </button>
                      <button
                        onClick={() => handleCancelAndRefundEdycja(activeEdycjaObj)}
                        className="bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/50 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        title="Zwróć wpisowe do portfeli klubowiczów i odwołaj wyzwanie"
                      >
                        Anuluj i zwróć środki ↩️
                      </button>
                      <button
                        onClick={() => handleDeleteEdycja(activeEdycjaObj.id)}
                        className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        title="Usuń całe wyzwanie"
                      >
                        Usuń wyzwanie 🗑️
                      </button>
                    </>
                  )}

                  {edycjeRedukcji.length > 0 && (
                    <select
                      value={selectedEdycjaId || ""}
                      onChange={(e) => setSelectedEdycjaId(Number(e.target.value))}
                      className="bg-sky-900/80 border border-sky-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none cursor-pointer max-w-[200px] sm:max-w-xs truncate"
                    >
                      <option value="" disabled>Wybierz edycję wyzwania</option>
                      {edycjeRedukcji.map(ed => (
                        <option key={ed.id} value={ed.id}>
                          {ed.nazwa} ({ed.data_start} ➔ {ed.data_koniec}) {ed.status === 'zakonczone' ? '[ARCHIWUM]' : ed.status === 'anulowane' ? '[ODWOŁANE]' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-sky-950/60 p-4 rounded-2xl border border-sky-800/60">
                  <span className="text-[10px] text-sky-300 uppercase font-bold block">Termin Wyzwania</span>
                  <span className="text-xs font-black text-white mt-1 block">
                    {activeEdycjaObj.data_start} ➔ {activeEdycjaObj.data_koniec}
                  </span>
                </div>

                <div className="bg-sky-950/60 p-4 rounded-2xl border border-sky-800/60">
                  <span className="text-[10px] text-sky-300 uppercase font-bold block">Wpisowe (Kasa Klubu)</span>
                  <span className="text-lg font-black text-amber-400 mt-0.5 block">
                    {activeEdycjaObj.wpisowe_kwota || 30} zł
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">
                    Min. osób do startu: <b className="text-amber-300">{activeEdycjaObj.min_uczestnikow || 5}</b>
                  </span>
                </div>

                <div className="bg-sky-950/60 p-4 rounded-2xl border border-sky-800/60">
                  {appRole === 'admin' ? (
                    <>
                      <span className="text-[10px] text-emerald-300 uppercase font-bold block">Pula Nagród (Admin)</span>
                      <span className="text-lg font-black text-emerald-400 mt-0.5 block">
                        {((uczestnicyRedukcji || []).filter(u => u.oplacone).length * (activeEdycjaObj.wpisowe_kwota || 30)).toFixed(0)} zł
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">
                        ({(uczestnicyRedukcji || []).filter(u => u.oplacone).length} z min. {activeEdycjaObj.min_uczestnikow || 5} opłaconych)
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[10px] text-emerald-300 uppercase font-bold block">Zapisani Klubowicze</span>
                      <span className="text-lg font-black text-emerald-400 mt-0.5 block">
                        {(uczestnicyRedukcji || []).length} osób
                      </span>
                      <span className="text-[9px] text-slate-400 font-medium">
                        {(uczestnicyRedukcji || []).filter(u => u.oplacone).length >= (activeEdycjaObj.min_uczestnikow || 5) 
                          ? '✓ Warunek startu spełniony' 
                          : `Wymagane min. ${activeEdycjaObj.min_uczestnikow || 5} osób`}
                      </span>
                    </>
                  )}
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
                  ) : activeEdycjaObj.status !== 'zakonczone' && activeEdycjaObj.status !== 'anulowane' ? (
                    <button
                      onClick={() => setIsJoinModalOpen(true)}
                      className="mt-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow transition-all cursor-pointer uppercase tracking-wider"
                    >
                      Dołącz do gry ➔
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-bold mt-1">
                      {activeEdycjaObj.status === 'anulowane' ? 'Wyzwanie Odwołane' : 'Edycja Zakończona'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-3xl border border-sky-200 text-center space-y-3">
              <span className="text-4xl block">🔥</span>
              <h3 className="font-black text-base text-sky-950 uppercase">Brak aktywnych wyzwań redukcji</h3>
              <p className="text-xs text-slate-500">Administrator może utworzyć nowe wyzwanie redukcji za pomocą przycisku powyżej.</p>
            </div>
          )}

          {/* NAGRODY */}
          {activeEdycjaObj && (
            <div className="bg-white rounded-3xl border border-sky-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎁</span>
                  <h3 className="font-black text-xs uppercase tracking-wider text-sky-950">
                    Nagrody w tej Edycji ({activeEdycjaObj.nazwa})
                  </h3>
                </div>
                {appRole === 'admin' && activeEdycjaObj.status !== 'zakonczone' && activeEdycjaObj.status !== 'anulowane' && (
                  <button
                    onClick={() => setIsAddNagrodaModalOpen(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl cursor-pointer"
                  >
                    + Dodaj Nagrodę
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(nagrodyRedukcji || []).map((n) => (
                  <div key={n.id} className="bg-gradient-to-br from-amber-50/60 to-amber-100/40 border border-amber-200 p-4 rounded-2xl flex items-start justify-between relative group">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">
                        {n.miejsce === 1 ? '🥇' : n.miejsce === 2 ? '🥈' : n.miejsce === 3 ? '🥉' : '🎖️'}
                      </span>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                          {n.miejsce === 1 ? '1. Miejsce' : n.miejsce === 2 ? '2. Miejsce' : n.miejsce === 3 ? '3. Miejsce' : 'Wyróżnienie'}
                        </div>
                        <div className="font-black text-xs text-slate-900 mt-0.5">{n.tytul}</div>
                        {n.opis && <div className="text-[10px] text-slate-600 mt-1">{n.opis}</div>}
                      </div>
                    </div>

                    {appRole === 'admin' && (
                      <button
                        onClick={() => handleDeleteNagroda(n.id)}
                        className="text-rose-500 hover:text-rose-700 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-pointer"
                        title="Usuń tę nagrodę"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {(nagrodyRedukcji || []).length === 0 && (
                  <div className="col-span-full text-center text-slate-400 text-xs py-4 italic">
                    Brak zdefiniowanych nagród w tej edycji wyzwania.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TABELA SKŁADU CIAŁA */}
          {(selectedKlient || currentUserId) && activeEdycjaObj && (appRole !== 'klubowicz' || isCurrentUserJoined) ? (
            <div className="bg-white rounded-3xl border border-sky-200 shadow-sm overflow-hidden space-y-3 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-100 pb-3">
                <div>
                  <h3 className="font-black text-xs uppercase tracking-wider text-sky-950 flex items-center gap-2">
                    <span>⚖️</span> Tabela Pomiarów Składu Ciała ({activeEdycjaObj.nazwa})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Uczestnik: <span className="font-bold text-slate-800">{selectedKlient ? `${selectedKlient.Imię || ''} ${selectedKlient.Nazwisko || ''}` : 'Twój Profil'}</span>
                  </p>
                </div>

                {appRole === 'admin' && activeEdycjaObj.status !== 'zakonczone' && activeEdycjaObj.status !== 'anulowane' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenRedukcjaPomiarModal('start', selectedKlient ? selectedKlient.id : currentUserId!)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-sm flex items-center gap-1"
                    >
                      <span>+</span> Start
                    </button>
                    <button
                      onClick={() => handleOpenRedukcjaPomiarModal('koniec', selectedKlient ? selectedKlient.id : currentUserId!)}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-sm flex items-center gap-1"
                    >
                      <span>+</span> Finał
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
                      const sP = (pomiaryRedukcji || []).find(p => String(p.klient_id) === String(activeUserKlientId) && p.etap === 'start');
                      const kP = (pomiaryRedukcji || []).find(p => String(p.klient_id) === String(activeUserKlientId) && p.etap === 'koniec');
                      
                      return (
                        <>
                          <tr className="hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-sky-900 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                              <span>Pomiar Początkowy (START)</span>
                            </td>
                            <td className="p-3 text-slate-600">{sP ? sP.data_pomiaru : 'Brak pomiaru'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{sP ? `${sP.waga_kg} kg` : '-'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{sP ? `${sP.fat_proc}%` : '-'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{sP ? `${sP.muscle_kg} kg` : '-'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{sP ? `${sP.visceral_level}` : '-'}</td>
                            <td className="p-3 text-right text-slate-400 font-bold">---</td>
                          </tr>

                          <tr className="hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-rose-700 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                              <span>Pomiar Końcowy (FINAŁ)</span>
                            </td>
                            <td className="p-3 text-slate-600">{kP ? kP.data_pomiaru : 'Oczekuje na finał'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{kP ? `${kP.waga_kg} kg` : '-'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{kP ? `${kP.fat_proc}%` : '-'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{kP ? `${kP.muscle_kg} kg` : '-'}</td>
                            <td className="p-3 text-center font-black text-slate-900">{kP ? `${kP.visceral_level}` : '-'}</td>
                            <td className="p-3 text-right text-slate-400 font-bold">---</td>
                          </tr>

                          {sP && kP && (
                            <tr className="bg-amber-50/40 font-black border-t-2 border-amber-200">
                              <td className="p-3 text-slate-950 uppercase tracking-wider">Bilans Zmian:</td>
                              <td className="p-3 text-slate-500 font-normal">Różnica</td>
                              <td className="p-3 text-center">{renderTrendIndicator(Number(kP.waga_kg) - Number(sP.waga_kg), true, " kg")}</td>
                              <td className="p-3 text-center">{renderTrendIndicator(Number(kP.fat_proc) - Number(sP.fat_proc), true, " %")}</td>
                              <td className="p-3 text-center">{renderTrendIndicator(Number(kP.muscle_kg) - Number(sP.muscle_kg), false, " kg")}</td>
                              <td className="p-3 text-center">{renderTrendIndicator(Number(kP.visceral_level) - Number(sP.visceral_level), true, " lvl")}</td>
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
          ) : (appRole === 'klubowicz' && activeEdycjaObj && !isCurrentUserJoined) ? (
            <div className="bg-sky-50 border border-sky-200 rounded-3xl p-6 text-center space-y-3">
              <span className="text-3xl">🔒</span>
              <h4 className="font-black text-xs uppercase text-sky-950">Tabela pomiarów jest zablokowana</h4>
              <p className="text-xs text-slate-600">Dołącz do tego wyzwania, aby odblokować swoją kartę pomiarów składu ciała!</p>
              <button
                onClick={() => setIsJoinModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow transition-all cursor-pointer uppercase tracking-wider inline-block"
              >
                Dołącz do wyzwania ➔
              </button>
            </div>
          ) : null}

          {/* GŁÓWNY RANKING */}
          {activeEdycjaObj && (
            <div className="bg-white rounded-3xl border border-sky-200 shadow-sm overflow-hidden space-y-4 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-100 pb-3">
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider text-sky-950 flex items-center gap-2">
                    <span>🏆</span> Ranking Uczestników ({activeEdycjaObj.nazwa})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isCurrentUserJoined || appRole === 'admin' 
                      ? "Jako uczestnik widzisz pełne nazwiska rywali." 
                      : "Nazwiska uczestników są zanonimizowane dla osób spoza wyzwania."}
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
                      {appRole === 'admin' && <th className="p-3 text-center w-36">Zarządzanie (Admin)</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-50">
                    {rankingRedukcji.map((row, idx) => (
                      <tr key={row.id} className={`transition-colors ${row.brak_pomiaru_koncowego ? 'bg-slate-100/60 opacity-60' : 'hover:bg-slate-50/60'}`}>
                        <td className="p-3 font-black text-slate-800">
                          {row.brak_pomiaru_koncowego ? (
                            <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">DNF</span>
                          ) : (
                            idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-900 flex items-center gap-2.5">
                          {row.klientAvatar && (isCurrentUserJoined || appRole === 'admin') ? (
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
                          {row.brak_pomiaru_koncowego ? (
                            <span className="text-rose-600 font-bold text-xs">Brak finału</span>
                          ) : row.startP && row.koniecP ? (
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
                          {row.brak_pomiaru_koncowego ? (
                            <span className="text-slate-400">-</span>
                          ) : row.startP && row.koniecP ? (
                            <div>
                              <span>{row.startP.fat_proc}% ➔ {row.koniecP.fat_proc}%</span>
                              <div className="text-[10px]">{renderTrendIndicator(Number(row.koniecP.fat_proc) - Number(row.startP.fat_proc), true, " %")}</div>
                            </div>
                          ) : row.startP ? (
                            <span>{row.startP.fat_proc}%</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {row.brak_pomiaru_koncowego ? (
                            <span className="text-slate-400">-</span>
                          ) : row.startP && row.koniecP ? (
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
                          {row.brak_pomiaru_koncowego ? (
                            <span className="text-slate-400">-</span>
                          ) : row.startP && row.koniecP ? (
                            <div>
                              <span>{row.startP.visceral_level} ➔ {row.koniecP.visceral_level}</span>
                              <div className="text-[10px]">{renderTrendIndicator(Number(row.koniecP.visceral_level) - Number(row.startP.visceral_level), true, " lvl")}</div>
                            </div>
                          ) : row.startP ? (
                            <span>{row.startP.visceral_level}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-black text-sm">
                          {row.brak_pomiaru_koncowego ? (
                            <span className="text-rose-600 text-[10px] font-bold uppercase">Brak pomiaru (DNF)</span>
                          ) : row.hasBoth ? (
                            <span className="text-amber-600">{row.totalPkt} pkt</span>
                          ) : (
                            <span className="text-slate-400 font-normal text-xs">W trakcie</span>
                          )}
                        </td>

                        {appRole === 'admin' && (
                          <td className="p-3 text-center relative">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenRedukcjaPomiarModal('start', row.klient_id)}
                                className="w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
                                title="Dodaj / Edytuj pomiar początkowy (Start)"
                              >
                                +
                              </button>

                              <button
                                onClick={() => handleOpenRedukcjaPomiarModal('koniec', row.klient_id)}
                                className="w-8 h-8 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-base flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
                                title="Dodaj / Edytuj pomiar końcowy (Finał)"
                              >
                                +
                              </button>

                              <button
                                onClick={() => handleToggleBrakPomiaru(row.id, !!row.brak_pomiaru_koncowego)}
                                className={`w-8 h-8 rounded-xl font-black text-base flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 ${
                                  row.brak_pomiaru_koncowego 
                                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-600' 
                                    : 'bg-amber-400 hover:bg-amber-500 text-slate-950'
                                }`}
                                title={row.brak_pomiaru_koncowego ? "Przywróć klubowicza do rankingu" : "Oznacz: Nie przystąpił do pomiarów (DNF)"}
                              >
                                -
                              </button>

                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDropdownId(openDropdownId === row.id ? null : row.id);
                                  }}
                                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center transition-all cursor-pointer border border-slate-200 active:scale-95"
                                  title="Więcej opcji"
                                >
                                  •••
                                </button>

                                {openDropdownId === row.id && (
                                  <div 
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-2xl shadow-2xl py-1.5 z-50 text-left animate-in fade-in zoom-in-95 duration-100"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        handleDeleteParticipant(row.id);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                                    >
                                      <span>🗑️</span> Usuń z wyzwania
                                    </button>
                                  </div>
                                )}
                              </div>
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

          {/* ARCHIWUM */}
          {edycjeRedukcji.filter(e => e.status === 'zakonczone' || e.status === 'anulowane').length > 0 && (
            <div className="pt-6 border-t border-sky-200 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">📁</span>
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-700">
                  Poprzednie Edycje i Archiwum Wyników
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {edycjeRedukcji.filter(e => e.status === 'zakonczone' || e.status === 'anulowane').map(ed => (
                  <div
                    key={ed.id}
                    onClick={() => setSelectedEdycjaId(ed.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${selectedEdycjaId === ed.id ? 'bg-amber-50 border-amber-400 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="font-black text-xs text-slate-900">{ed.nazwa}</div>
                        {appRole === 'admin' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEdycja(ed.id);
                            }}
                            className="text-rose-500 hover:text-rose-700 text-xs font-bold p-1 cursor-pointer"
                            title="Usuń to archiwalne wyzwanie"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        Status: <b className="uppercase">{ed.status}</b> • Termin: {ed.data_start} ➔ {ed.data_koniec}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 mt-3 block">
                      {selectedEdycjaId === ed.id ? '● Aktualnie wyświetlane' : 'Zobacz wyniki archiwalne ➔'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ZAKŁADKA 4: BADANIA KRWI */}
      {activeTab === 'badania' && (selectedKlient || appRole === 'klubowicz' || appRole === 'trener') && (
        <div className="space-y-6">

          {/* DISCLAIMER */}
          <div className="bg-gradient-to-r from-amber-50 via-rose-50/40 to-sky-50 p-5 rounded-3xl border border-amber-200/80 shadow-sm space-y-2">
            <div className="flex items-center gap-2.5 text-amber-950 font-black text-xs uppercase tracking-wider">
              <span className="text-xl">🩺</span>
              <span>Ważna Informacja i Zastrzeżenie Prawne</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              Przedstawione analizy, interpretacje parametrów krwi oraz propozycje suplementacyjne mają charakter wyłącznie edukacyjno-informacyjny, profilaktyczny i sportowy. <b>Nie jestem lekarzem</b>, a zawarte tu wskazówki <b>nie stanowią porady lekarskiej, diagnozy medycznej ani leczenia</b>. Wszelkie niepokojące objawy, nieprawidłowe wartości wskaźników lub wątpliwości dotyczące Twojego stanu zdrowia należy bezwzględnie skonsultować z lekarzem medycyny.
            </p>
          </div>

          {/* KAFEL INFORMACYJNY */}
          <div className="bg-gradient-to-br from-sky-950 to-slate-900 text-white p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <span>💬</span> Instrukcja dla Klubowicza
              </div>
              <p className="text-xs text-sky-200 font-medium">
                Po dodaniu pliku PDF z wynikami badań krwi, <b>wyślij do mnie wiadomość</b> na czacie lub SMS, że pliki zostały wgrane i prosisz o przygotowanie analizy.
              </p>
            </div>
            <button
              onClick={handleOpenNewBadanieModal}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl uppercase tracking-wider shadow-sm transition-all shrink-0 cursor-pointer"
            >
              + {appRole === 'klubowicz' ? 'Dodaj Wyniki Krwi (PDF)' : 'Dodaj Wpis Badań'}
            </button>
          </div>

          {/* TABELA LISTY BADAŃ */}
          <div className="bg-white rounded-3xl border border-sky-200 shadow-sm overflow-hidden space-y-3">
            <div className="p-4 bg-slate-50 border-b border-sky-100 flex items-center justify-between">
              <h3 className="font-black text-xs text-sky-950 uppercase tracking-wider flex items-center gap-2">
                <span>📋</span> Historia Badań Krwi i Interpretacji Trenera
              </h3>
              <span className="text-[10px] font-bold text-slate-500">
                Liczba wpisów: {badaniaList.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-sky-950 text-amber-400 font-black uppercase text-[10px] tracking-wider">
                    <th className="p-3 w-28">Data Badania</th>
                    <th className="p-3 w-40">Dokument PDF</th>
                    <th className="p-3 w-28 text-center">Skany / Zdjęcia</th>
                    <th className="p-3">Główne Wnioski / Interpretacja</th>
                    <th className="p-3 w-36 text-center">Suplementacja</th>
                    <th className="p-3 text-center w-36">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {badaniaList.length > 0 ? (
                    badaniaList.map((b) => (
                      <tr key={b.id} className="hover:bg-sky-50/50 transition-colors">
                        <td className="p-3 font-black text-sky-950 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {b.nowa_interpretacja && appRole === 'klubowicz' && (
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                              </span>
                            )}
                            <span>{b.data_badania}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          {b.plik_pdf_url ? (
                            <a
                              href={b.plik_pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-700 hover:text-sky-900 font-bold underline flex items-center gap-1.5"
                            >
                              <span>📄</span> {b.plik_pdf_nazwa || "Wyniki.pdf"}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">Brak pliku PDF</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-700">
                          {(b.zdjecia || []).length > 0 ? (
                            <span className="bg-sky-100 text-sky-900 px-2 py-0.5 rounded-full text-[10px]">
                              📷 {b.zdjecia?.length} szt.
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-700 font-medium max-w-xs truncate">
                          {b.interpretacja || <span className="text-slate-400 italic">Oczekuje na interpretację trenera...</span>}
                        </td>
                        <td className="p-3 text-center">
                          <div className="space-y-0.5 text-[10px]">
                            <span className="block font-bold text-emerald-700">
                              Trener: {(b.suplementacja_trener || []).length} poz.
                            </span>
                            <span className="block font-bold text-sky-700">
                              Klubowicz: {(b.suplementacja_klubowicz || []).length} poz.
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedBadanieDetail(b);
                                setIsDetailViewOpen(true);
                                markInterpretationAsRead(b.id);
                              }}
                              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-2.5 py-1.5 rounded-xl transition-all shadow-xs text-xs cursor-pointer"
                              title="Otwórz szczegóły"
                            >
                              🔍 Podgląd
                            </button>

                            <button
                              onClick={() => handleEditBadanie(b)}
                              className="bg-sky-100 hover:bg-sky-200 text-sky-900 font-bold p-1.5 rounded-xl transition-colors cursor-pointer border border-sky-200"
                              title="Edytuj wpis"
                            >
                              ✏️
                            </button>

                            <button
                              onClick={() => handleDeleteBadanie(b.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold p-1.5 rounded-xl transition-colors cursor-pointer border border-rose-200"
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
                      <td colSpan={6} className="p-8 text-center text-slate-400 italic font-bold">
                        Brak zarejestrowanych badań krwi dla wybranego profilu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* MODAL 1: FORMULARZ BADAŃ KRWI */}
      {isBadaniaModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-6 my-8 border border-sky-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider text-sky-950 flex items-center gap-2">
                  <span>🩸</span> {editingBadanieId ? "Edycja Wpisu Badań Krwi" : "Nowy Wpis Badań Krwi"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dla: <span className="font-bold text-slate-800">{selectedKlient ? `${selectedKlient.Imię || ''} ${selectedKlient.Nazwisko || ''}` : currentUserEmail}</span>
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsBadaniaModalOpen(false);
                  setEditingBadanieId(null);
                }} 
                className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBadanieFull} className="space-y-6 text-xs">
              
              {/* DATA BADANIA */}
              <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <label className="font-bold text-slate-700">Data wykonania badania krwi *</label>
                <input
                  type="date"
                  required
                  value={badanieFormData.data_badania}
                  onChange={(e) => setBadanieFormData({...badanieFormData, data_badania: e.target.value})}
                  className="bg-white border border-sky-200 rounded-xl px-4 py-2 font-bold text-slate-800 focus:outline-none"
                />
              </div>

              {/* PLIK PDF */}
              <div className="bg-white p-4 rounded-2xl border border-sky-200 space-y-3">
                <label className="font-black text-sky-950 uppercase tracking-wider block">
                  📄 Wyniki Badań w Pliku PDF (Wgrywane przez Klubowicza)
                </label>
                
                {badanieFormData.plik_pdf_url ? (
                  <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-xl">📑</span>
                      <span className="font-bold text-slate-900 truncate">{badanieFormData.plik_pdf_nazwa || 'Plik_badan.pdf'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBadanieFormData(prev => ({ ...prev, plik_pdf_url: '', plik_pdf_nazwa: '' }))}
                      className="text-rose-600 hover:text-rose-800 text-xs font-bold bg-white px-3 py-1 rounded-lg border border-rose-200 cursor-pointer"
                    >
                      Usuń plik ✕
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-sky-200 hover:border-amber-400 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-sky-50/20">
                    <span className="text-2xl mb-1">📤</span>
                    <span className="font-bold text-slate-700">{isUploadingPdf ? 'Wgrywanie pliku PDF...' : 'Kliknij, aby wgrać plik PDF z wynikami'}</span>
                    <input type="file" accept="application/pdf" disabled={isUploadingPdf} onChange={handleUploadPdf} className="hidden" />
                  </label>
                )}
              </div>

              {/* SEKCJE DLA TRENERA / ADMINA (UKRYTE DLA KLUBOWICZA) */}
              {(appRole === 'admin' || appRole === 'trener') && (
                <>
                  {/* SKANY / ZDJĘCIA */}
                  <div className="bg-white p-4 rounded-2xl border border-sky-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-black text-sky-950 uppercase tracking-wider">
                        📷 Zdjęcia / Skany Wyników (Trener)
                      </label>
                      <label className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] px-3 py-1.5 rounded-xl cursor-pointer">
                        + Dodaj zdjęcia
                        <input type="file" accept="image/*" multiple disabled={isUploadingImages} onChange={handleUploadImages} className="hidden" />
                      </label>
                    </div>

                    {badanieFormData.zdjecia.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {badanieFormData.zdjecia.map((imgUrl, idx) => (
                          <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-sky-200 bg-slate-100 group">
                            <img src={imgUrl} alt="Skan" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setBadanieFormData(prev => ({ ...prev, zdjecia: prev.zdjecia.filter((_, i) => i !== idx) }))}
                              className="absolute top-1 right-1 bg-rose-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic text-[11px]">Brak dodanych zdjęć.</div>
                    )}
                  </div>

                  {/* INTERPRETACJA */}
                  <div className="space-y-1.5">
                    <label className="font-black text-sky-950 uppercase tracking-wider block">
                      INTERPRETACJA WYNIKÓW BADAŃ{" "}
                      <span className="text-[10px] text-slate-500 font-normal normal-case">
                        (są to rzeczy, które powtarzają się w różnych wynikach, ale nie musi to oznaczać, że to występuje)
                      </span>
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Wpisz interpretację wskaźników krwi..."
                      value={badanieFormData.interpretacja}
                      onChange={(e) => setBadanieFormData({...badanieFormData, interpretacja: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-2xl p-3.5 text-slate-800 font-medium focus:outline-none"
                    />
                  </div>

                  {/* ZALECENIA */}
                  <div className="space-y-1.5">
                    <label className="font-black text-sky-950 uppercase tracking-wider block">
                      OGÓLNE ZALECENIA DIETETYCZNE I STYLU ŻYCIA
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Wpisz zalecenia dotyczące diety, nawodnienia, regeneracji, snu itp..."
                      value={badanieFormData.zalecenia}
                      onChange={(e) => setBadanieFormData({...badanieFormData, zalecenia: e.target.value})}
                      className="w-full bg-sky-50/40 border border-sky-200 rounded-2xl p-3.5 text-slate-800 font-medium focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* SEKCJA SUPLEMENTACJI */}
              <div className={`grid grid-cols-1 ${appRole === 'klubowicz' ? 'lg:grid-cols-1' : 'lg:grid-cols-2'} gap-4 pt-2 border-t border-sky-100`}>
                
                {/* 1. PROTOKÓŁ TRENERA (WIDOCZNY TYLKO DLA TRENERA / ADMINA) */}
                {(appRole === 'admin' || appRole === 'trener') && (
                  <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-black text-amber-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <span>💊</span> Dedykowany Protokół Suplementacyjny (Trener)
                      </label>
                      <button
                        type="button"
                        onClick={handleAddCoachSupplementRow}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-2.5 py-1 rounded-xl text-[10px] uppercase cursor-pointer shadow-xs"
                      >
                        + Dodaj suplement
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {badanieFormData.suplementacja_trener.map((sup, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-amber-200 shadow-xs">
                          <span className="font-black text-amber-900 text-xs w-4">{sIdx + 1}.</span>
                          <input
                            type="text"
                            placeholder="Nazwa suplementu (np. B-complex)"
                            value={sup.nazwa}
                            onChange={(e) => handleUpdateCoachSupplementRow(sIdx, 'nazwa', e.target.value)}
                            className="flex-1 bg-slate-50 border border-amber-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Dawka (np. 500 mg)"
                            value={sup.dawka}
                            onChange={(e) => handleUpdateCoachSupplementRow(sIdx, 'dawka', e.target.value)}
                            className="w-32 bg-slate-50 border border-amber-200 rounded-lg px-2.5 py-1.5 font-bold text-amber-700 focus:outline-none text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveCoachSupplementRow(sIdx)}
                            className="text-rose-500 hover:text-rose-700 font-bold p-1 cursor-pointer"
                            title="Usuń pozycję"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. SUPLEMENTACJA KLUBOWICZA (DOSTĘPNA DLA KAŻDEGO) */}
                <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-sky-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <span>🙋‍♂️</span> Suplementy Przyjmowane przez Klubowicza
                    </label>
                    <button
                      type="button"
                      onClick={handleAddMemberSupplementRow}
                      className="bg-sky-900 hover:bg-slate-800 text-white font-black px-2.5 py-1 rounded-xl text-[10px] uppercase cursor-pointer shadow-xs"
                    >
                      + Dodaj swój suplement
                    </button>
                  </div>

                  {badanieFormData.suplementacja_klubowicz.length > 0 ? (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                      {badanieFormData.suplementacja_klubowicz.map((item, mIdx) => (
                        <div key={mIdx} className="bg-white p-2.5 rounded-xl border border-sky-200 space-y-2 relative group shadow-xs">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Nazwa Suplementu / Substancji</span>
                            <input
                              type="text"
                              placeholder="np. Magnez Cytrynian / Witamina D3"
                              value={item.produkt}
                              onChange={(e) => handleUpdateMemberSupplementRow(mIdx, 'produkt', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-xs"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 block uppercase">Dawka dzienna (wartość)</span>
                              <input
                                type="text"
                                placeholder="np. 400"
                                value={item.dawka}
                                onChange={(e) => handleUpdateMemberSupplementRow(mIdx, 'dawka', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-800 text-xs"
                              />
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 block uppercase">Jednostka</span>
                              <select
                                value={item.jednostka}
                                onChange={(e) => handleUpdateMemberSupplementRow(mIdx, 'jednostka', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-800 text-xs cursor-pointer"
                              >
                                <option value="mg">mg</option>
                                <option value="g">gramy (g)</option>
                                <option value="mcg (µg)">mcg (µg)</option>
                                <option value="IU">IU (j.m.)</option>
                                <option value="ml">ml</option>
                              </select>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveMemberSupplementRow(mIdx)}
                            className="absolute top-1 right-1 text-rose-500 hover:text-rose-700 font-bold text-xs p-1 cursor-pointer"
                            title="Usuń pozycję"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-[11px] p-3 bg-white rounded-xl text-center border border-sky-100">
                      Brak wpisanych suplementów przez klubowicza.
                    </div>
                  )}
                </div>

              </div>

              {appRole === 'klubowicz' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 font-medium">
                  ℹ️ Trener po zapoznaniu się z wynikami z dokumentu PDF przygotuje dla Ciebie szczegółową interpretację, zalecenia oraz dedykowany protokół suplementacyjny.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-sky-100">
                <button
                  type="button"
                  onClick={() => setIsBadaniaModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSavingBadanie}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl uppercase tracking-wider cursor-pointer shadow disabled:opacity-50"
                >
                  {isSavingBadanie ? "Zapisywanie..." : editingBadanieId ? "Zapisz Zmiany" : "Utwórz Wpis Badania"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL 2: PODGLĄD SZCZEGÓŁÓW BADANIA */}
      {isDetailViewOpen && selectedBadanieDetail && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 md:p-8 shadow-2xl space-y-6 my-8 border border-sky-100 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-sky-100 gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-2xl shadow-sm">
                  🩸
                </div>
                <div>
                  <h3 className="font-black text-base text-sky-950 uppercase tracking-wider">
                    Szczegółowa Karta Wyników Badań Krwi
                  </h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Data wykonania badania: <b className="text-slate-900">{selectedBadanieDetail.data_badania}</b>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsDetailViewOpen(false);
                    handleEditBadanie(selectedBadanieDetail);
                  }}
                  className="bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer"
                >
                  ✏️ Edytuj
                </button>
                <button
                  onClick={() => setIsDetailViewOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer"
                >
                  ✕ Zamknij
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-sky-900 uppercase block">Oryginalny Dokument PDF</span>
                  <div className="text-xs font-black text-sky-950 mt-0.5">
                    {selectedBadanieDetail.plik_pdf_nazwa || "Wyniki_Badań.pdf"}
                  </div>
                </div>
                {selectedBadanieDetail.plik_pdf_url ? (
                  <a
                    href={selectedBadanieDetail.plik_pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    Otwórz PDF ↗
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 italic">Brak pliku</span>
                )}
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Dołączone Skany / Zdjęcia</span>
                  <div className="text-xs font-black text-slate-900 mt-0.5">
                    Liczba zdjęć: {(selectedBadanieDetail.zdjecia || []).length}
                  </div>
                </div>
                {(selectedBadanieDetail.zdjecia || []).length > 0 && (
                  <span className="text-[11px] font-bold text-sky-700">Kliknij zdjęcie poniżej</span>
                )}
              </div>
            </div>

            {/* GALERIA ZDJĘĆ */}
            {(selectedBadanieDetail.zdjecia || []).length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-black text-sky-950 uppercase tracking-wider block">
                  📷 Galeria Zdjęć i Skanów Parametrów
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                  {selectedBadanieDetail.zdjecia?.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      onClick={() => setEnlargedImage(imgUrl)}
                      className="aspect-square rounded-2xl overflow-hidden border border-sky-200 bg-slate-100 cursor-pointer hover:scale-105 transition-transform relative group shadow-xs"
                    >
                      <img src={imgUrl} alt="Skan" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                        🔍 Powiększ
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MIGAJĄCY CZERWONY KOMUNIKAT */}
            <div className="animate-pulse bg-rose-50 border border-rose-300 p-3.5 rounded-2xl text-center shadow-xs">
              <span className="text-xs font-black text-rose-600 uppercase tracking-wider flex items-center justify-center gap-2">
                <span>⚠️</span> poniżej znajdują sie wypunktowane najważniejsze informacje które należy omówić na treningu.
              </span>
            </div>

            {/* INTERPRETACJA */}
            <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
                <span>🔬</span> INTERPRETACJA WYNIKÓW BADAŃ{" "}
                <span className="text-[10px] text-slate-400 font-normal normal-case">
                  (są to rzeczy, które powtarzają się w różnych wynikach, ale nie musi to oznaczać, że to występuje)
                </span>
              </div>
              <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-medium bg-sky-50/30 p-4 rounded-xl border border-sky-100">
                {selectedBadanieDetail.interpretacja || "Brak wprowadzonej interpretacji."}
              </div>
            </div>

            {/* ZALECENIA */}
            <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
                <span>🎯</span> OGÓLNE ZALECENIA DIETETYCZNE I STYLU ŻYCIA
              </div>
              <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-medium bg-sky-50/30 p-4 rounded-xl border border-sky-100">
                {selectedBadanieDetail.zalecenia || "Brak dodatkowych zaleceń."}
              </div>
            </div>

            {/* PORÓWNANIE SUPLEMENTACJI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 p-5 rounded-2xl border border-amber-200 shadow-sm space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-2 border-b border-amber-200 pb-2">
                  <span>💊</span> Dedykowany Protokół Suplementacyjny (Trener)
                </div>
                {(selectedBadanieDetail.suplementacja_trener || []).length > 0 ? (
                  <ul className="space-y-2 text-xs">
                    {normalizeCoachSupplements(selectedBadanieDetail.suplementacja_trener).map((sup, sIdx) => (
                      <li key={sIdx} className="flex items-center justify-between bg-white/80 p-2.5 rounded-xl border border-amber-200 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-amber-800">{sIdx + 1}.</span>
                          <span className="font-bold text-slate-900">{sup.nazwa}</span>
                        </div>
                        {sup.dawka && (
                          <span className="bg-amber-200/60 text-amber-900 font-bold px-2 py-0.5 rounded-lg text-[11px]">
                            {sup.dawka}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-500 italic">Brak zaleceń suplementacyjnych.</div>
                )}
              </div>

              <div className="bg-sky-50/60 p-5 rounded-2xl border border-sky-200 shadow-sm space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-sky-950 flex items-center gap-2 border-b border-sky-200 pb-2">
                  <span>🙋‍♂️</span> Suplementy Przyjmowane przez Klubowicza
                </div>
                {(selectedBadanieDetail.suplementacja_klubowicz || []).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-sky-100">
                          <th className="pb-1.5">Nazwa Suplementu</th>
                          <th className="pb-1.5 text-right">Dawka Dzienna</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sky-100">
                        {selectedBadanieDetail.suplementacja_klubowicz?.map((item, mIdx) => (
                          <tr key={mIdx}>
                            <td className="py-2 font-black text-slate-900">{item.produkt}</td>
                            <td className="py-2 text-right font-black text-amber-600">{item.dawka} {item.jednostka}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">Klubowicz nie wprowadził swoich suplementów.</div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* LIGHTBOX ZDJĘĆ */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md cursor-pointer"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-amber-400 font-black text-xl p-2 cursor-pointer"
            >
              ✕ Zamknij podgląd
            </button>
            <img 
              src={enlargedImage} 
              alt="Powiększony skan" 
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* MODAL: RĘCZNE DODAWANIE KLUBOWICZA DO WYZWANIA REDUKCJI */}
      {isManualAddModalOpen && activeEdycjaObj && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-sky-100">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider text-sky-950">
                  Dodaj Klubowicza do Wyzwania
                </h3>
                <p className="text-[11px] text-slate-500">Edycja: {activeEdycjaObj.nazwa}</p>
              </div>
              <button 
                onClick={() => {
                  setIsManualAddModalOpen(false);
                  setManualAddKlientId('');
                  setManualAddSearchQuery('');
                  setIsManualSearchFocused(false);
                }} 
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualAddParticipant} className="space-y-4 text-xs">
              
              <div className="relative space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  Wyszukaj i wybierz klubowicza * ({niezapisaniKlienci.length} dostępnych)
                </label>

                {selectedManualKlientObj ? (
                  <div className="flex items-center justify-between p-3 bg-sky-50 border-2 border-sky-300 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-sky-200 text-sky-950 font-black text-xs flex items-center justify-center overflow-hidden shrink-0 border border-sky-400">
                        {selectedManualKlientObj.avatarUrl || selectedManualKlientObj.AvatarUrl ? (
                          <img src={selectedManualKlientObj.avatarUrl || selectedManualKlientObj.AvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <span className="uppercase">{selectedManualKlientObj.Imię?.[0] || 'K'}{selectedManualKlientObj.Nazwisko?.[0] || ''}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-black text-xs text-sky-950">
                          {selectedManualKlientObj.Imię} {selectedManualKlientObj.Nazwisko}
                        </div>
                        <div className="text-[10px] text-slate-500">{selectedManualKlientObj['E-mail']}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setManualAddKlientId('');
                        setManualAddSearchQuery('');
                        setIsManualSearchFocused(true);
                      }}
                      className="text-rose-600 hover:text-rose-800 font-bold text-xs bg-white px-2.5 py-1 rounded-lg border border-rose-200 transition-colors"
                    >
                      ✕ Zmień
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative flex items-center">
                      <span className="absolute left-3 text-slate-400 text-sm pointer-events-none">🔍</span>
                      <input
                        type="text"
                        required={!manualAddKlientId}
                        placeholder="Wpisz imię, nazwisko lub e-mail klubowicza..."
                        value={manualAddSearchQuery}
                        onFocus={() => setIsManualSearchFocused(true)}
                        onChange={(e) => {
                          setManualAddSearchQuery(e.target.value);
                          setIsManualSearchFocused(true);
                        }}
                        className="w-full bg-slate-50 border border-sky-200 rounded-xl pl-9 pr-8 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white"
                      />
                      {manualAddSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setManualAddSearchQuery('')}
                          className="absolute right-3 text-slate-400 hover:text-slate-600 font-bold text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {isManualSearchFocused && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-sky-200 rounded-2xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-sky-50">
                        {filteredNiezapisaniKlienci.length > 0 ? (
                          filteredNiezapisaniKlienci.map((klient) => {
                            const avatar = klient.avatarUrl || klient.AvatarUrl;
                            return (
                              <div
                                key={klient.id}
                                onClick={() => {
                                  setManualAddKlientId(String(klient.id));
                                  setManualAddSearchQuery('');
                                  setIsManualSearchFocused(false);
                                }}
                                className="p-2.5 hover:bg-sky-50 cursor-pointer flex items-center justify-between transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-900 font-bold text-[10px] flex items-center justify-center shrink-0 border border-sky-300">
                                    {avatar ? (
                                      <img src={avatar} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                      <span className="uppercase">{klient.Imię?.[0] || 'K'}{klient.Nazwisko?.[0] || ''}</span>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 text-xs">{klient.Imię} {klient.Nazwisko}</div>
                                    <div className="text-[10px] text-slate-500">{klient['E-mail']}</div>
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  Wybierz
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center text-slate-400 italic text-xs">
                            Nie znaleziono klubowicza pasującego do frazy "{manualAddSearchQuery}".
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Metoda Płatności (Wpłata do Kasy Klubu)</label>
                <select
                  value={manualAddMetoda}
                  onChange={(e) => setManualAddMetoda(e.target.value as any)}
                  className="w-full p-3 border rounded-xl font-bold bg-white"
                >
                  <option value="gotowka">💵 Gotówka na recepcji (Kasa Klubu)</option>
                  <option value="autopay">⚡ Autopay / Przelew</option>
                  <option value="inna">Inna forma</option>
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manualAddOplacone}
                    onChange={(e) => setManualAddOplacone(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="font-black text-slate-900">Oznacz wpisowe jako opłacone ({activeEdycjaObj.wpisowe_kwota || 30} zł)</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsManualAddModalOpen(false);
                    setManualAddKlientId('');
                    setManualAddSearchQuery('');
                    setIsManualSearchFocused(false);
                  }} 
                  className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl cursor-pointer"
                >
                  Anuluj
                </button>
                <button 
                  type="submit" 
                  disabled={!manualAddKlientId}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-xl uppercase tracking-wider cursor-pointer shadow disabled:opacity-40"
                >
                  Dodaj do Gry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DODAWANIE NAGRODY */}
      {isAddNagrodaModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-sky-100">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm uppercase tracking-wider text-sky-950">
                Dodaj Nagrodę do Wyzwania
              </h3>
              <button onClick={() => setIsAddNagrodaModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddNagroda} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Miejsce / Kategoria *</label>
                <select
                  value={nagrodaFormData.miejsce}
                  onChange={(e) => setNagrodaFormData({...nagrodaFormData, miejsce: e.target.value})}
                  className="w-full p-3 border rounded-xl font-bold bg-white"
                >
                  <option value="1">🥇 1. Miejsce</option>
                  <option value="2">🥈 2. Miejsce</option>
                  <option value="3">🥉 3. Miejsce</option>
                  <option value="0">🎖️ Wyróżnienie / Nagroda Specjalna</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Tytuł Nagrody *</label>
                <input
                  type="text"
                  required
                  placeholder="np. Puchar + 500 zł + Zestaw Suplementów"
                  value={nagrodaFormData.tytul}
                  onChange={(e) => setNagrodaFormData({...nagrodaFormData, tytul: e.target.value})}
                  className="w-full p-3 border rounded-xl font-bold bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Dodatkowy Opis / Szczegóły</label>
                <textarea
                  rows={2}
                  placeholder="np. Karnet VIP na 3 miesiące oraz pakiet gadżetów klubowych"
                  value={nagrodaFormData.opis}
                  onChange={(e) => setNagrodaFormData({...nagrodaFormData, opis: e.target.value})}
                  className="w-full p-3 border rounded-xl font-medium bg-white resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsAddNagrodaModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl cursor-pointer">Anuluj</button>
                <button type="submit" className="flex-1 bg-slate-900 text-white font-black py-3 rounded-xl uppercase tracking-wider cursor-pointer">Zapisz Nagrodę</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: WYBÓR PŁATNOŚCI */}
      {isJoinModalOpen && activeEdycjaObj && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-100">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider text-sky-950">
                  Dołącz do Wyzwania Redukcji
                </h3>
                <p className="text-[11px] text-slate-500">
                  Wpisowe do wyzwania: <span className="font-bold text-amber-600">{activeEdycjaObj.wpisowe_kwota || 30} zł</span>
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
                    <div className="text-[10px] text-slate-500">Szybki przelew, BLIK lub karta – wpisowe zasila pulę wyzwania</div>
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
                    <div className="text-[10px] text-slate-500">Wpłać 30 zł u trenera na sali, a trener potwierdzi wpłatę w kasie klubu</div>
                  </div>
                </div>
                <input type="radio" checked={selectedPaymentMethod === 'gotowka'} onChange={() => setSelectedPaymentMethod('gotowka')} className="text-amber-500" />
              </div>
            </div>

            <div className="bg-sky-50 border border-sky-200 p-3 rounded-xl text-[11px] text-sky-900 space-y-1">
              <div>ℹ️ Pamiętaj, aby po zapisaniu umówić się z trenerem na wykonanie <b>początkowej analizy składu ciała</b> na analizatorze.</div>
              <div className="text-slate-500 text-[10px]">W przypadku nieosiągnięcia minimalnej liczby uczestników ({activeEdycjaObj.min_uczestnikow || 5} osób), wpisowe zostanie w całości zwrócone do Twojego portfela w aplikacji.</div>
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
                {isProcessingPayment ? 'Łączenie...' : selectedPaymentMethod === 'autopay' ? 'Opłać wpisowe ➔' : 'Potwierdź zapis ➔'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TWORZENIE NOWEJ EDYCJI */}
      {isNewEdycjaModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-sky-100">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm uppercase tracking-wider text-sky-950">
                Utwórz Nowe Wyzwanie Redukcji
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Wpisowe (zł)</label>
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
                  <label className="font-bold text-slate-700 block mb-1">Min. osób do startu *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={edycjaFormData.min_uczestnikow}
                    onChange={(e) => setEdycjaFormData({...edycjaFormData, min_uczestnikow: e.target.value})}
                    className="w-full p-3 border rounded-xl font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Status Początkowy</label>
                  <select
                    value={edycjaFormData.status}
                    onChange={(e) => setEdycjaFormData({...edycjaFormData, status: e.target.value as any})}
                    className="w-full p-3 border rounded-xl font-bold bg-white"
                  >
                    <option value="zapisy">Otwarte Zapisy (Auto-aktywacja)</option>
                    <option value="aktywne">Od razu Aktywne</option>
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
                <button type="submit" className="flex-1 bg-slate-900 text-white font-black py-3 rounded-xl uppercase tracking-wider cursor-pointer">Utwórz Wyzwanie</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: POMIAR REDUKCJI */}
      {isRedukcjaPomiarModalOpen && (() => {
        const targetClient = (klienci || []).find(k => String(k.id) === String(targetPomiarKlientId));
        const targetAge = targetClient ? calculateAge(targetClient.Urodziny || targetClient.urodziny) : null;
        const targetHeight = targetClient?.wzrost ? `${targetClient.wzrost} cm` : 'Brak';
        const targetGender = targetClient?.gender || targetClient?.Płeć || targetClient?.plec || 'Nie podano';

        return (
          <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-sky-100">
              <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider text-sky-950">
                    {targetPomiarEtap === 'start' ? '📊 Pomiar Początkowy (START)' : '🏆 Pomiar Końcowy (FINAŁ)'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Dla: <span className="font-bold text-slate-800">{targetClient ? `${targetClient.Imię} ${targetClient.Nazwisko}` : 'Klubowicz'}</span>
                  </p>
                </div>
                <button onClick={() => setIsRedukcjaPomiarModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer">✕</button>
              </div>

              <div className="bg-sky-50 border border-sky-200 p-3 rounded-2xl flex items-center justify-between text-xs text-sky-950">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Płeć</span>
                  <span className="font-black">{targetGender}</span>
                </div>
                <div className="border-l border-sky-200 pl-3">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Wzrost</span>
                  <span className="font-black text-amber-600">{targetHeight}</span>
                </div>
                <div className="border-l border-sky-200 pl-3">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Wiek</span>
                  <span className="font-black text-emerald-600">{targetAge ? `${targetAge} lat` : 'Brak'}</span>
                </div>
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
        );
      })()}

      {/* MODAL: POMIAR OGÓLNY */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8 border border-sky-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div>
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">
                  {editingMeasurementId ? "Edycja Pomiaru i Karty Formy" : "Nowy Pomiar i Karta Formy"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dla: {selectedKlient ? `${selectedKlient.Imię || ''} ${selectedKlient.Nazwisko || ''}` : currentUserEmail}
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
              
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 space-y-3">
                <label className="font-black text-amber-950 uppercase tracking-wider block text-[11px]">
                  📍 Gdzie został wykonany pomiar?
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, miejsce_typ: 'STUDIO'})}
                    className={`p-3 rounded-xl border-2 font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      formData.miejsce_typ === 'STUDIO'
                        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <span>🏢</span> STUDIO FORMA MARZEŃ
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, miejsce_typ: 'INNE'})}
                    className={`p-3 rounded-xl border-2 font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      formData.miejsce_typ === 'INNE'
                        ? 'bg-slate-900 text-white border-slate-950 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <span>📍</span> INNE MIEJSCE
                  </button>
                </div>

                {formData.miejsce_typ === 'INNE' && (
                  <div className="pt-2">
                    <label className="font-bold text-slate-700 block mb-1">Opis miejsca (np. Waga domowa, Klub zewnętrzny):</label>
                    <input
                      type="text"
                      required={formData.miejsce_typ === 'INNE'}
                      placeholder="Wpisz gdzie wykonano pomiar..."
                      value={formData.miejsce_inne_opis}
                      onChange={(e) => setFormData({...formData, miejsce_inne_opis: e.target.value})}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none focus:border-sky-500"
                    />
                  </div>
                )}
              </div>

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
