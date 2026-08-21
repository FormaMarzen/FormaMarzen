"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../raporty/klienci/supabase";

interface Klient {
  id: number | string;
  Imię: string;
  Nazwisko: string;
  "E-mail": string;
  "Numer tel."?: string;
  avatarUrl?: string;
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

  // Lista podopiecznych dla Admina / Trenera
  const [klienci, setKlienci] = useState<Klient[]>([]);
  const [selectedKlient, setSelectedKlient] = useState<Klient | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pomiary
  const [measurements, setMeasurements] = useState<AnalizaFormyWpis[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Stan formularza nowego pomiaru
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
              await fetchMeasurements(k.id, cleanEmail);
            }
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // 2. Pobieranie listy klientów (dla Admina i Trenera)
  const fetchClientsList = async () => {
    const { data, error } = await supabase
      .from('klienci')
      .select('*')
      .order('Nazwisko', { ascending: true });

    if (data && !error) {
      const formatted = data as unknown as Klient[];
      setKlienci(formatted);
      if (formatted.length > 0) {
        setSelectedKlient(formatted[0]);
        await fetchMeasurements(formatted[0].id, formatted[0]['E-mail']);
      }
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

  // Zmiana wybranego klienta z listy
  const handleSelectClient = (klient: Klient) => {
    setSelectedKlient(klient);
    fetchMeasurements(klient.id, klient['E-mail']);
  };

  // Obsługa zapisu nowego pomiaru
  const handleSubmitMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKlient && appRole !== 'klubowicz') {
      alert("Proszę wybrać podopiecznego.");
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

    const { error } = await supabase.from('analiza_formy').insert([payload]);

    setIsSubmitting(false);

    if (error) {
      alert("Błąd zapisu pomiaru: " + error.message);
    } else {
      alert("Pomiar został pomyślnie dodany!");
      setIsAddModalOpen(false);
      setFormData({
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

      if (selectedKlient) {
        fetchMeasurements(selectedKlient.id, selectedKlient['E-mail']);
      } else {
        fetchMeasurements(0, currentUserEmail);
      }
    }
  };

  // Usuwanie wpisu
  const handleDeleteMeasurement = async (id: number) => {
    if (!confirm("Czy na pewno chcesz usunąć ten pomiar?")) return;
    const { error } = await supabase.from('analiza_formy').delete().eq('id', id);
    if (!error) {
      setMeasurements(prev => prev.filter(m => m.id !== id));
    } else {
      alert("Błąd podczas usuwania: " + error.message);
    }
  };

  const filteredKlienci = klienci.filter(k => 
    `${k.Imię || ''} ${k.Nazwisko || ''}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k['E-mail']?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const latestMeasurement = measurements[0] || null;
  const previousMeasurement = measurements[1] || null;

  const calculateDiff = (current?: number | null, previous?: number | null) => {
    if (current === undefined || current === null || previous === undefined || previous === null) return null;
    const diff = current - previous;
    return diff > 0 ? `+${diff.toFixed(1)}` : `${diff.toFixed(1)}`;
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* NAGŁÓWEK STRONY & GŁÓWNE ZAKŁADKI */}
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
              ? "Panel trenerski: Zarządzanie obwodami, składem ciała i dietą podopiecznych" 
              : "Twój dziennik postępów: Pomiary, skład ciała oraz wytyczne dietetyczne"}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {(appRole === 'admin' || appRole === 'trener') && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <span>+</span> Dodaj pomiar
            </button>
          )}
        </div>
      </div>

      {/* PASEK WYBORU PODSTAWOWYCH ZAKŁADEK */}
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

      {/* WYBÓR KLUBOWICZA DLA ADMINA / TRENERA */}
      {(appRole === 'admin' || appRole === 'trener') && (
        <div className="bg-white p-4 rounded-2xl border border-sky-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs font-black text-sky-950 uppercase tracking-wider flex items-center gap-2">
              <span>👥</span> Wybierz podopiecznego:
            </div>
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Szukaj po nazwisku lub e-mailu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-sky-50/60 border border-sky-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {filteredKlienci.map((klient) => {
              const isSelected = selectedKlient?.id === klient.id;
              return (
                <button
                  key={klient.id}
                  onClick={() => handleSelectClient(klient)}
                  className={`shrink-0 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-sky-950 text-amber-400 border-sky-900 shadow-sm'
                      : 'bg-sky-50/50 text-slate-700 border-sky-100 hover:bg-sky-100'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-900 flex items-center justify-center text-[10px] font-black">
                    {klient.Imię?.[0] || 'K'}
                  </div>
                  <span>{klient.Imię} {klient.Nazwisko}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PODSUMOWANIE PROFILU AKTUALNIE WYBRANEJ OSOBY */}
      {selectedKlient && (
        <div className="bg-gradient-to-r from-sky-950 to-slate-900 p-4 rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-amber-400 bg-sky-900 flex items-center justify-center text-amber-300 font-black text-lg">
              {selectedKlient.Imię?.[0] || ''}{selectedKlient.Nazwisko?.[0] || ''}
            </div>
            <div>
              <div className="text-sm font-black tracking-wide text-amber-400 uppercase">
                {selectedKlient.Imię} {selectedKlient.Nazwisko}
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
      )}

      {/* ========================================================================= */}
      {/* ZAKŁADKA 1: POMIARY CENTYMETREM I ANALIZA SKŁADU CIAŁA */}
      {/* ========================================================================= */}
      {activeTab === 'pomiary' && (
        <div className="space-y-6">
          
          {/* SZYBKIE KAFLE OSTATNIEGO POMIARU */}
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

          {/* PEŁNA TABELA POMIARÓW TRENINGOWYCH */}
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
              <table className="w-full text-xs text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="bg-sky-950 text-amber-400 font-black uppercase text-[10px] tracking-wider">
                    <th className="p-3 border-r border-sky-900 sticky left-0 bg-sky-950 z-10">Data</th>
                    <th className="p-3 border-r border-sky-900 bg-sky-900/40 text-center" colSpan={7}>
                      Obwody Centymetrem (cm)
                    </th>
                    <th className="p-3 border-r border-sky-900 bg-slate-800/60 text-center" colSpan={7}>
                      Analiza Składu Ciała
                    </th>
                    <th className="p-3 text-center">Akcje</th>
                  </tr>
                  <tr className="bg-sky-50 text-slate-700 font-bold border-b border-sky-200 text-[11px]">
                    <th className="p-2.5 border-r border-sky-200 sticky left-0 bg-sky-50 z-10">Data pomiaru</th>
                    {/* Obwody */}
                    <th className="p-2.5 border-r border-sky-100 text-center">Obw. pasa</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Klatka</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Ramię</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Talia</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Biodra</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Udo</th>
                    <th className="p-2.5 border-r border-sky-200 text-center">Łydka</th>
                    {/* Skład Ciała */}
                    <th className="p-2.5 border-r border-sky-100 text-center font-black text-sky-950">Waga (kg)</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Tk. tłuszcz. (%)</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Mięśnie (kg)</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Kości (kg)</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Wiek metab.</th>
                    <th className="p-2.5 border-r border-sky-100 text-center">Woda (%)</th>
                    <th className="p-2.5 border-r border-sky-200 text-center">Tł. wiscer.</th>
                    {/* Opcje */}
                    <th className="p-2.5 text-center">Opcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100">
                  {measurements.length > 0 ? (
                    measurements.map((m) => (
                      <tr key={m.id} className="hover:bg-sky-50/50 transition-colors">
                        <td className="p-3 font-black text-sky-950 border-r border-sky-100 sticky left-0 bg-white z-10 whitespace-nowrap">
                          {m.data_pomiaru}
                        </td>
                        {/* Obwody */}
                        <td className="p-3 text-center border-r border-sky-100">{m.obwod_pasa || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.klatka || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.ramie || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.talia || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.biodra || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.udo || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.lydka || '-'}</td>
                        {/* Skład Ciała */}
                        <td className="p-3 text-center border-r border-sky-100 font-black text-sky-950">{m.waga}</td>
                        <td className="p-3 text-center border-r border-sky-100 font-semibold">{m.tkanka_tluszczowa ? `${m.tkanka_tluszczowa}%` : '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.miesnie || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.kosci || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.wiek_metaboliczny || '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.woda ? `${m.woda}%` : '-'}</td>
                        <td className="p-3 text-center border-r border-sky-100">{m.tluszcz_wisceralny || '-'}</td>
                        {/* Akcje */}
                        <td className="p-3 text-center">
                          {(appRole === 'admin' || appRole === 'trener') && (
                            <button
                              onClick={() => handleDeleteMeasurement(m.id)}
                              className="text-rose-600 hover:text-rose-800 font-bold p-1 rounded transition-colors"
                              title="Usuń wpis"
                            >
                              🗑️
                            </button>
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

        </div>
      )}

      {/* ========================================================================= */}
      {/* ZAKŁADKA 2: DIETA I MAKROSKŁADNIKI */}
      {/* ========================================================================= */}
      {activeTab === 'makro' && (
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
            <div className="p-4 bg-slate-50 border-b border-sky-100">
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

        </div>
      )}

      {/* ========================================================================= */}
      {/* ZAKŁADKA 3: WYZWANIE REDUKCJI */}
      {/* ========================================================================= */}
      {activeTab === 'redukcja' && (
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
      {/* MODAL DODAWANIA NOWEGO POMIARU (ADMIN / TRENER) */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8 border border-sky-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div>
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">
                  Nowy Pomiar i Karta Formy
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dla: {selectedKlient ? `${selectedKlient.Imię} ${selectedKlient.Nazwisko}` : 'Wybierz podopiecznego'}
                </p>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
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
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Zapisywanie...' : 'Zapisz pomiar'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
