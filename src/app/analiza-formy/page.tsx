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

export default function AnalizaFormyPage() {
  const [activeTab, setActiveTab] = useState<'pomiary' | 'makro' | 'redukcja'>('pomiary');
  const [appRole, setAppRole] = useState<'admin' | 'trener' | 'klubowicz'>('klubowicz');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Wyszukiwarka i wybór klienta dla Admina / Trenera
  const [klienci, setKlienci] = useState<Klient[]>([]);
  const [selectedKlient, setSelectedKlient] = useState<Klient | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);

  // Pomiary i formularze
  const [measurements, setMeasurements] = useState<AnalizaFormyWpis[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingMeasurementId, setEditingMeasurementId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Stan formularza nowego / edytowanego pomiaru
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

  // Stany dla Kalkulatora (uwzględniającego płeć i cele procentowe)
  const [calcWeight, setCalcWeight] = useState<string>('');
  const [calcHeight, setCalcHeight] = useState<string>('');
  const [calcAge, setCalcAge] = useState<string>('30');
  const [calcGender, setCalcGender] = useState<string>('mezczyzna'); // 'mezczyzna' lub 'kobieta'
  const [calcPal, setCalcPal] = useState<string>('1.4');
  const [calcGoal, setCalcGoal] = useState<string>('-0.2'); // domyślnie -20%
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

        if (cleanEmail === 'maciejklaput@gmail.com' || cleanEmail === 'maciejklaput@icloud.com') {
          setAppRole('admin');
          await fetchClientsList();
        } else {
          const { data: trenerData } = await supabase
            .from('trenerzy')
            .select('*')
            .ilike('email', cleanEmail)
            .maybeSingle();

          if (trenerData) {
            setAppRole('trener');
            await fetchClientsList();
          } else {
            setAppRole('klubowicz');
            const { data: klientData } = await supabase
              .from('klienci')
              .select('*')
              .ilike('E-mail', cleanEmail)
              .maybeSingle();

            if (klientData) {
              const k = klientData as unknown as Klient;
              setSelectedKlient(k);
              const g = (k.Płeć || k.plec || k.gender || '').toLowerCase();
              if (g.includes('kobieta') || g === 'k') setCalcGender('kobieta');
              else if (g.includes('mężczyzna') || g.includes('mezczyzna') || g === 'm') setCalcGender('mezczyzna');

              await fetchMeasurements(k.id, cleanEmail);
            }
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // 2. Pobieranie bazy klientów dla autouzupełniania wyszukiwarki (Admin/Trener)
  const fetchClientsList = async () => {
    const { data, error } = await supabase
      .from('klienci')
      .select('*')
      .order('Nazwisko', { ascending: true });

    if (data && !error) {
      setKlienci(data as unknown as Klient[]);
    }
  };

  // 3. Pobieranie pomiarów dla wybranego użytkownika
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

  // Zmiana wybranego klienta z wyszukiwarki
  const handleSelectClient = (klient: Klient) => {
    setSelectedKlient(klient);
    setSearchQuery(`${klient.Imię} ${klient.Nazwisko}`);
    setIsSearchFocused(false);

    const g = (klient.Płeć || klient.plec || klient.gender || '').toLowerCase();
    if (g.includes('kobieta') || g === 'k') setCalcGender('kobieta');
    else if (g.includes('mężczyzna') || g.includes('mezczyzna') || g === 'm') setCalcGender('mezczyzna');

    if (klient.Urodziny) {
      const birthYear = new Date(klient.Urodziny).getFullYear();
      if (!isNaN(birthYear)) {
        const currentYear = new Date().getFullYear();
        setCalcAge(String(currentYear - birthYear));
      }
    }

    fetchMeasurements(klient.id, klient['E-mail']);
  };

  // Otwarcie modala dodawania nowego pomiaru
  const handleOpenAddModal = () => {
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
  };

  // Otwarcie modala w trybie edycji istniejącego pomiaru
  const handleOpenEditModal = (m: AnalizaFormyWpis) => {
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
  };

  // Obsługa zapisu (dodanie lub aktualizacja)
  const handleSubmitMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKlient && appRole !== 'klubowicz') {
      alert("Proszę najpierw wyszukać i wybrać podopiecznego.");
      return;
    }

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

  // Usuwanie wpisu
  const handleDeleteMeasurement = async (id: number) => {
    if (!confirm("Czy na pewno chcesz trwale usunąć ten pomiar?")) return;
    const { error } = await supabase.from('analiza_formy').delete().eq('id', id);
    if (!error) {
      setMeasurements(prev => prev.filter(m => m.id !== id));
    } else {
      alert("Błąd podczas usuwania: " + error.message);
    }
  };

  // Filtr podpowiedzi dla wyszukiwarki (po min. 2 znakach)
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

  // Filtrowanie pomiarów z ostatnich 24 miesięcy i sortowanie rosnąco chronologicznie do wykresów
  const chartData24Months = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 24);
    
    return [...measurements]
      .filter(m => new Date(m.data_pomiaru) >= cutoffDate)
      .sort((a, b) => new Date(a.data_pomiaru).getTime() - new Date(b.data_pomiaru).getTime());
  }, [measurements]);

  // Kalkulator uwzględniający płeć (Mifflin-St Jeor / wzory płciowe) oraz cele procentowe
  const calculateCaloriesWithGender = () => {
    const w = parseFloat(calcWeight || (latestMeasurement ? String(latestMeasurement.waga) : '0'));
    const h = parseFloat(calcHeight || (latestMeasurement?.wzrost ? String(latestMeasurement.wzrost) : '175'));
    const a = parseFloat(calcAge || '30');
    const pal = parseFloat(calcPal);
    const goalModifier = parseFloat(calcGoal); // np. -0.2, -0.1, 0, 0.1, 0.2

    if (!w || w <= 0 || !h || h <= 0) {
      alert("Wprowadź prawidłową wagę (kg) oraz wzrost (cm).");
      return;
    }

    // Wzór Mifflin-St Jeor uwzględniający płeć:
    // Mężczyźni: BMR = (10 * waga) + (6.25 * wzrost) - (5 * wiek) + 5
    // Kobiety: BMR = (10 * waga) + (6.25 * wzrost) - (5 * wiek) - 161
    let bmr = (10 * w) + (6.25 * h) - (5 * a);
    if (calcGender === 'mezczyzna') {
      bmr += 5;
    } else {
      bmr -= 161;
    }

    const tdee = bmr * pal;
    const targetKcal = tdee * (1 + goalModifier);

    // Makroskładniki: Białko zależne od wagi i celu (np. 2.0g/kg), tłuszcze 1.0g/kg, reszta węglowodany
    const proteinG = Math.round(w * 2.0);
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

  // Komponent renderujący pojedynczy wykres SVG
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

  const clientGenderDisplay = selectedKlient ? (selectedKlient.Płeć || selectedKlient.plec || selectedKlient.gender || 'Nie podano') : '';

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
            {appRole === 'admin' || appRole === 'trener' 
              ? "Panel trenerski: Wyszukaj podopiecznego, zarządzaj pomiarami, edytuj karty i plany makro" 
              : "Twój dziennik postępów: Pomiary, skład ciała oraz wytyczne dietetyczne"}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {(appRole === 'admin' || appRole === 'trener') && selectedKlient && (
            <button
              onClick={handleOpenAddModal}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <span>+</span> Dodaj pomiar
            </button>
          )}
        </div>
      </div>

      {/* PASEK ZAKŁADEK */}
      <div className="flex rounded-2xl bg-sky-100/60 p-1.5 border border-sky-200 text-xs font-bold gap-1.5 shadow-inner">
        <button
          onClick={() => setActiveTab('pomiary')}
          className={`flex-1 py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'pomiary'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
              : 'text-slate-600 hover:text-sky-950 hover:bg-white/50'
          }`}
        >
          <span>📏</span> 1. Pomiary i Skład Ciała
        </button>
        <button
          onClick={() => setActiveTab('makro')}
          className={`flex-1 py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'makro'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
              : 'text-slate-600 hover:text-sky-950 hover:bg-white/50'
          }`}
        >
          <span>🥗</span> 2. Dieta i Makroskładniki
        </button>
        <button
          onClick={() => setActiveTab('redukcja')}
          className={`flex-1 py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'redukcja'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
              : 'text-slate-600 hover:text-sky-950 hover:bg-white/50'
          }`}
        >
          <span>🔥</span> 3. Wyzwanie Redukcji
        </button>
      </div>

      {/* WYSZUKIWARKA KLUBOWICZA TYLKO DLA ADMINA / TRENERA */}
      {(appRole === 'admin' || appRole === 'trener') && (
        <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm space-y-3 relative">
          <label className="text-xs font-black text-sky-950 uppercase tracking-wider flex items-center gap-2">
            <span>🔍</span> Wyszukaj podopiecznego:
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Wpisz imię, nazwisko lub e-mail (min. 2 znaki)..."
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
                onClick={() => {
                  setSearchQuery('');
                  setSelectedKlient(null);
                  setMeasurements([]);
                }}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                ✕ Wyczyść
              </button>
            )}

            {/* Lista rozwijana wyników wyszukiwania z obsługą awatara */}
            {isSearchFocused && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-sky-200 rounded-2xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-sky-100">
                {searchResults.map((klient) => {
                  const avatar = klient.avatarUrl || klient.AvatarUrl;
                  const plecTxt = klient.Płeć || klient.plec || klient.gender || 'Nie podano';
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

      {/* KARTA WYBRANEGO PODOPIECZNEGO Z INFORMACJĄ O PŁCI */}
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
              <div className="text-sm font-black tracking-wide text-amber-400 uppercase flex items-center gap-2">
                <span>{selectedKlient.Imię} {selectedKlient.Nazwisko}</span>
                <span className="bg-sky-900 text-sky-200 text-[10px] px-2 py-0.5 rounded-full border border-sky-700 font-bold">
                  {clientGenderDisplay}
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
        (appRole === 'admin' || appRole === 'trener') && (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-8 text-center text-slate-500 text-xs font-bold space-y-1">
            <span className="text-2xl block mb-2">👤</span>
            Użyj powyższego pola wyszukiwania, aby wybrać klubowicza i załadować jego historię pomiarów.
          </div>
        )
      )}

      {/* ========================================================================= */}
      {/* ZAKŁADKA 1: POMIARY CENTYMETREM, SKŁAD CIAŁA I WYKRESY 24 MSC */}
      {/* ========================================================================= */}
      {activeTab === 'pomiary' && (selectedKlient || appRole === 'klubowicz') && (
        <div className="space-y-6">
          
          {/* KAFLE OSTATNIEGO POMIARU */}
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

          {/* TABELA POMIARÓW Z MOŻLIWOŚCIĄ EDYCJI */}
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
                          {(appRole === 'admin' || appRole === 'trener') ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(m)}
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
                          ) : (
                            <span className="text-slate-400 font-bold">-</span>
                          )}
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

          {/* ========================================================================= */}
          {/* SEKCJA WYKRESÓW ZA OSTATNIE 24 MIESIĄCE */}
          {/* ========================================================================= */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between border-b border-sky-200 pb-2">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider flex items-center gap-2">
                <span>📈</span> Wykresy Progresu (Ostatnie 24 Miesiące)
              </h3>
              <span className="text-xs text-slate-500 font-bold">
                Liczba pomiarów na osi: {chartData24Months.length}
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
      {/* ZAKŁADKA 2: DIETA, MAKROSKŁADNIKI I KALKULATOR UWZGLĘDNIAJĄCY PŁEĆ */}
      {/* ========================================================================= */}
      {activeTab === 'makro' && (selectedKlient || appRole === 'klubowicz') && (
        <div className="space-y-6">
          
          {/* GŁÓWNE KARTY KALORII I MAKRO */}
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

          {/* HISTORIA ZALECEN DIETETYCZNYCH */}
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
                    {(appRole === 'admin' || appRole === 'trener') && <th className="p-3 text-center">Edycja</th>}
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
                        {(appRole === 'admin' || appRole === 'trener') && (
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleOpenEditModal(m)}
                              className="bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-bold p-1.5 rounded-lg transition-colors cursor-pointer"
                              title="Edytuj ten plan"
                            >
                              ✏️
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-400 font-bold">
                        Brak historii planów dietetycznych.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* KALKULATOR ZAPOTRZEBOWANIA UWZGLĘDNIAJĄCY PŁEĆ I PROCENTY */}
          {/* ========================================================================= */}
          <div className="bg-white p-6 rounded-2xl border border-sky-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-sky-100 pb-3 gap-2">
              <div>
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider flex items-center gap-2">
                  <span>🧮</span> Kalkulator Zapotrzebowania (Mifflin-St Jeor)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Precyzyjna metoda uwzględniająca płeć, wagę, wzrost, wiek oraz procentowy cel kaloryczny.
                </p>
              </div>
              <span className="bg-amber-100 text-amber-950 text-[10px] font-black px-3 py-1 rounded-full uppercase border border-amber-300">
                Wzór z uwzględnieniem płci
              </span>
            </div>

            {/* INFORMACJA O WYMAGANEJ PŁCI */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>W celu prawidłowego i dokładnego obliczenia zapotrzebowania kalorycznego niezbędna jest płeć podopiecznego (różnice w metabolizmie kobiet i mężczyzn).</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Płeć *</label>
                <select
                  value={calcGender}
                  onChange={(e) => setCalcGender(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none font-bold text-sky-950"
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
                <label className="font-bold text-slate-700 block">Wzrost (cm)</label>
                <input
                  type="number"
                  placeholder={measurements[0]?.wzrost ? String(measurements[0].wzrost) : "np. 175"}
                  value={calcHeight}
                  onChange={(e) => setCalcHeight(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Wiek (lata)</label>
                <input
                  type="number"
                  placeholder="np. 30"
                  value={calcAge}
                  onChange={(e) => setCalcAge(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Aktywność (PAL)</label>
                <select
                  value={calcPal}
                  onChange={(e) => setCalcPal(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none font-medium"
                >
                  <option value="1.2">1.2 – Siedzący tryb</option>
                  <option value="1.375">1.375 – Lekka (1-3 treng.)</option>
                  <option value="1.55">1.55 – Umiarkowana (3-5 treng.)</option>
                  <option value="1.725">1.725 – Duża (6-7 treng.)</option>
                  <option value="1.9">1.9 – Bardzo duża</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Cel procentowy (Modyfikator)</label>
                <select
                  value={calcGoal}
                  onChange={(e) => setCalcGoal(e.target.value)}
                  className="w-full bg-sky-50/40 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none font-medium"
                >
                  <option value="-0.2">🔥 -20% kcal (Głęboka redukcja)</option>
                  <option value="-0.1">📉 -10% kcal (Lekka redukcja)</option>
                  <option value="0">⚖️ 0% kcal (Utrzymanie / Zero)</option>
                  <option value="0.1">📈 +10% kcal (Lekka masa)</option>
                  <option value="0.2">💪 +20% kcal (Budowa masy)</option>
                </select>
              </div>

              <div className="flex items-end justify-end">
                <button
                  type="button"
                  onClick={calculateCaloriesWithGender}
                  className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl shadow-sm text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Przelicz zapotrzebowanie z uwzględnieniem płci ➔
                </button>
              </div>
            </div>

            {/* WYNIK KALKULATORA */}
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

                {(appRole === 'admin' || appRole === 'trener') && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          kcal: String(calcResult.targetKcal),
                          bialko: String(calcResult.protein),
                          tluszcz: String(calcResult.fat),
                          weglowodany: String(calcResult.carbs)
                        }));
                        setIsAddModalOpen(true);
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black px-4 py-2 rounded-xl transition-all shadow cursor-pointer uppercase tracking-wider"
                    >
                      Przepisz wyliczone makro do karty pomiaru ➔
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* ZAKŁADKA 3: WYZWANIE REDUKCJI */}
      {/* ========================================================================= */}
      {activeTab === 'redukcja' && (selectedKlient || appRole === 'klubowicz') && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-900 to-sky-950 text-white p-6 rounded-2xl shadow-md space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔥</span>
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-amber-400">
                  Wyzwanie Redukcji – Forma Marzeń
                </h2>
                <p className="text-xs text-sky-200">
                  Monitoruj progres redukcji tkanki tłuszczowej, realizuj zadania treningowe i zdobywaj nagrody.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-sky-950 uppercase">📉 Spadek Wagi</span>
                <span className="text-xs font-bold text-amber-500">Etap 1</span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {measurements.length >= 2 ? (
                  `${(measurements[0].waga - measurements[measurements.length - 1].waga).toFixed(1)} kg`
                ) : (
                  '0.0 kg'
                )}
              </div>
              <p className="text-[11px] text-slate-500">Całkowity bilans od pierwszego zarejestrowanego pomiaru.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-sky-950 uppercase">🎯 Cel Redukcyjny</span>
                <span className="text-xs font-bold text-emerald-600">Aktywny</span>
              </div>
              <div className="text-2xl font-black text-slate-900">-5.0 kg</div>
              <p className="text-[11px] text-slate-500">Indywidualny cel wyznaczony wspólnie z trenerem.</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-sky-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-sky-950 uppercase">🏆 Status Wyzwania</span>
                <span className="text-xs font-bold text-sky-600">W trakcie</span>
              </div>
              <div className="text-2xl font-black text-amber-500">W grze!</div>
              <p className="text-[11px] text-slate-500">Kolejny pomiar kontrolny w wyznaczonym terminie.</p>
            </div>
          </div>

          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-6 text-center space-y-2">
            <h4 className="font-black text-xs text-sky-950 uppercase tracking-wider">
              Podkład pod moduł wyzwania redukcji
            </h4>
            <p className="text-xs text-slate-600 max-w-xl mx-auto">
              W tym miejscu możemy dodać ranking klubowiczów, punkty za regularność treningów, zadania specjalne lub cotygodniowy progres procentowy. Sprecyzuj szczegóły, a rozbudujemy tę zakładkę.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DODAWANIA I EDYCJI POMIARU */}
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
              
              {/* Data i dane podstawowe */}
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

              {/* Sekcja: Obwody Centymetrem */}
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

              {/* Sekcja: Skład Ciała */}
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

              {/* Sekcja: Dieta i Makro */}
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

              {/* Uwagi trenera */}
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

              {/* Przyciski */}
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
