"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TwojBonusPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [appRole, setAppRole] = useState<'admin' | 'trener' | 'klubowicz'>('klubowicz');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [allKlienci, setAllKlienci] = useState<any[]>([]);
  
  // Tabele bonusowe (karnety z przypisanymi poziomami)
  const [bonusTables, setBonusTables] = useState<any[]>([]);

  // Zakładki widoku
  const [activeTab, setActiveTab] = useState<'poziomy' | 'warunki' | 'rejestr'>('poziomy');

  // Modal 1: Dodawanie nowej tabeli
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableType, setNewTableType] = useState('Umowa 12 miesięcy');
  const [newTablePrice, setNewTablePrice] = useState('199.00');

  // Modal 2: Dodawanie / edycja progu
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [targetTableId, setTargetTableId] = useState<string | number>('');
  const [editingTierId, setEditingTierId] = useState<number | null>(null);
  const [levelName, setLevelName] = useState('BRĄZOWY');
  const [thresholdVal, setThresholdVal] = useState('3');
  const [thresholdUnit, setThresholdUnit] = useState<'miesięcy' | 'wejść' | 'cykli'>('miesięcy');
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardBadge, setRewardBadge] = useState('-10%');
  const [secondaryTitle, setSecondaryTitle] = useState('');
  const [secondaryBadge, setSecondaryBadge] = useState('GRATIS');
  const [accentColor, setAccentColor] = useState<'amber' | 'slate' | 'yellow' | 'purple'>('amber');
  const [isSaving, setIsSaving] = useState(false);

  // Szablony startowych progów lojalnościowych
  const defaultTiersUmowa = [
    {
      id: 101,
      levelName: 'BRĄZOWY',
      threshold: 3,
      unit: 'miesiące',
      accent: 'amber',
      rewardTitle: '10% zniżki na barze i suplementy + darmowy shake.',
      rewardBadge: '-10%',
      secondaryTitle: 'Ręcznik klubowy Forma Marzeń w prezencie.',
      secondaryBadge: 'GRATIS',
      active: true
    },
    {
      id: 102,
      levelName: 'SREBRNY',
      threshold: 6,
      unit: 'miesięcy',
      accent: 'slate',
      rewardTitle: '+14 dni bezpłatnego zamrożenia do puli karnetu.',
      rewardBadge: '+14 DNI',
      secondaryTitle: 'Darmowa analiza składu ciała InBody.',
      secondaryBadge: 'GRATIS',
      active: true
    },
    {
      id: 103,
      levelName: 'ZŁOTY',
      threshold: 9,
      unit: 'miesięcy',
      accent: 'yellow',
      rewardTitle: 'Trening personalny 1:1 lub masaż sportowy.',
      rewardBadge: '-100%',
      secondaryTitle: 'Zestaw próbek suplementów treningowych.',
      secondaryBadge: 'PREZENT',
      active: true
    },
    {
      id: 104,
      levelName: 'VIP / DIAMENT',
      threshold: 12,
      unit: 'miesięcy',
      accent: 'purple',
      rewardTitle: 'Darmowy miesiąc bonusowy (0.00 PLN) po 12. racie.',
      rewardBadge: '-100%',
      secondaryTitle: 'Limitowana koszulka klubowa + stały status VIP.',
      secondaryBadge: 'VIP',
      active: true
    }
  ];

  const defaultTiersOpen = [
    {
      id: 201,
      levelName: 'BRĄZOWY',
      threshold: 2,
      unit: 'cykle',
      accent: 'amber',
      rewardTitle: 'Jednorazowa wejściówka dla osoby towarzyszącej gratis.',
      rewardBadge: 'GRATIS',
      secondaryTitle: '5% stałego rabatu na odnowienie karnetu.',
      secondaryBadge: '-5%',
      active: true
    },
    {
      id: 202,
      levelName: 'SREBRNY',
      threshold: 4,
      unit: 'cykle',
      accent: 'slate',
      rewardTitle: '20 PLN doładowania do portfela klubowego.',
      rewardBadge: '+20 PLN',
      secondaryTitle: '10% rabatu na akcesoria treningowe.',
      secondaryBadge: '-10%',
      active: true
    },
    {
      id: 203,
      levelName: 'ZŁOTY',
      threshold: 6,
      unit: 'cykli',
      accent: 'yellow',
      rewardTitle: '15% zniżki na kolejny karnet OPEN.',
      rewardBadge: '-15%',
      secondaryTitle: 'Konsultacja dietetyczno-treningowa gratis.',
      secondaryBadge: 'GRATIS',
      active: true
    }
  ];

  const defaultTiersWejscia = [
    {
      id: 301,
      levelName: 'BRĄZOWY',
      threshold: 10,
      unit: 'wejść',
      accent: 'amber',
      rewardTitle: '+1 dodatkowe wejście do puli karnetu.',
      rewardBadge: '+1 WEJŚCIE',
      secondaryTitle: 'Napój izotoniczny w recepcji gratis.',
      secondaryBadge: 'GRATIS',
      active: true
    },
    {
      id: 302,
      levelName: 'SREBRNY',
      threshold: 25,
      unit: 'wejść',
      accent: 'slate',
      rewardTitle: '+2 darmowe wejścia do puli treningowej.',
      rewardBadge: '+2 WEJŚCIA',
      secondaryTitle: 'Shake białkowy po treningu w prezencie.',
      secondaryBadge: 'GRATIS',
      active: true
    }
  ];

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;

      // 1. Sprawdzenie uprawnień
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

      // 2. Pobieranie karnetów z Supabase
      let { data: karnetyData } = await supabase.from('katalog_karnetow').select('*').order('id', { ascending: true });
      if (!karnetyData || karnetyData.length === 0) {
        const fallback = await supabase.from('karnety').select('*').order('id', { ascending: true });
        karnetyData = fallback.data;
      }

      if (karnetyData && karnetyData.length > 0) {
        const parsed = karnetyData.map((k: any) => {
          let meta: any = {};
          try {
            meta = JSON.parse(k.inne_ustawienia || '{}');
          } catch (e) {}

          let fallbackTiers = defaultTiersUmowa;
          const nazwaLower = (k.nazwa || '').toLowerCase();
          const typLower = (k.typ_karnetu || '').toLowerCase();

          if (typLower.includes('ilość') || nazwaLower.includes('ogólno') || nazwaLower.includes('wejść')) {
            fallbackTiers = defaultTiersWejscia;
          } else if (nazwaLower.includes('open') || typLower.includes('czas')) {
            fallbackTiers = defaultTiersOpen;
          }

          return {
            id: k.id,
            nazwa: k.nazwa,
            typ_karnetu: k.typ_karnetu || 'Na czas',
            cena: k.cena_brutto || k.cena || 0,
            inne_ustawienia: meta,
            customTiers: meta.customTiers && meta.customTiers.length > 0 ? meta.customTiers : fallbackTiers
          };
        });

        setBonusTables(parsed);
        if (parsed[0]) setTargetTableId(parsed[0].id);
      } else {
        // Fallback tabel w przypadku braku rekordów w bazie
        setBonusTables([
          { id: 1, nazwa: 'Karnet Umowa 12M', typ_karnetu: 'Umowa 12 miesięcy', cena: 179, customTiers: defaultTiersUmowa },
          { id: 2, nazwa: 'Karnet OPEN', typ_karnetu: 'Na czas', cena: 199, customTiers: defaultTiersOpen },
          { id: 3, nazwa: 'Karnet Ogólnorozwojowy', typ_karnetu: 'Na ilość treningów', cena: 220, customTiers: defaultTiersWejscia }
        ]);
      }

      // 3. Pobieranie danych klubowiczów
      const { data: klienciData } = await supabase.from('klienci').select('*');
      if (klienciData) {
        const mapped = klienciData.map((c: any) => {
          let parsedKarnety = [];
          if (Array.isArray(c.karnetyKlubowicza)) {
            parsedKarnety = c.karnetyKlubowicza;
          } else if (typeof c.karnetyKlubowicza === 'string') {
            try { parsedKarnety = JSON.parse(c.karnetyKlubowicza); } catch(e) {}
          }
          return {
            ...c,
            firstName: c.Imię || '',
            lastName: c.Nazwisko || '',
            email: c['E-mail'] || c.email || '',
            karnetyKlubowicza: parsedKarnety,
            cyklCiaglosci: c.cyklCiaglosci || 1
          };
        });
        setAllKlienci(mapped);
        if (userEmail) {
          const myUser = mapped.find((u: any) => u.email === userEmail);
          if (myUser) setCurrentUser(myUser);
        }
      }
    } catch (err) {
      console.error("Błąd podczas ładowania danych:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, []);

  // --- ZARZĄDZANIE TABELAMI (DODAWANIE I USUWANIE) ---
  const handleAddNewTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) return;

    let defaultNewTiers = defaultTiersUmowa;
    if (newTableType.includes('ilość') || newTableName.toLowerCase().includes('wejść')) {
      defaultNewTiers = defaultTiersWejscia;
    } else if (newTableType.includes('czas') || newTableName.toLowerCase().includes('open')) {
      defaultNewTiers = defaultTiersOpen;
    }

    const newTableObj = {
      id: Date.now(),
      nazwa: newTableName.trim(),
      typ_karnetu: newTableType,
      cena: parseFloat(newTablePrice) || 0,
      inne_ustawienia: { customTiers: defaultNewTiers },
      customTiers: defaultNewTiers
    };

    setIsSaving(true);
    try {
      // Zapis nowej tabeli jako karnetu w bazie Supabase
      const payload = {
        nazwa: newTableObj.nazwa,
        typ_karnetu: newTableObj.typ_karnetu,
        cena_brutto: newTableObj.cena,
        dlugosc: newTableType === 'Umowa 12 miesięcy' ? '12 miesięcy' : '1 miesiąc',
        inne_ustawienia: JSON.stringify({ customTiers: defaultNewTiers })
      };

      const { data: inserted, error } = await supabase.from('katalog_karnetow').insert([payload]).select().single();
      if (!error && inserted) {
        newTableObj.id = inserted.id;
      }
    } catch (err) {
      console.warn("Zapisano nową tabelę lokalnie:", err);
    } finally {
      setBonusTables(prev => [...prev, newTableObj]);
      setIsAddTableModalOpen(false);
      setNewTableName('');
      setIsSaving(false);
    }
  };

  const handleDeleteTable = async (tableId: string | number, tableName: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć całą tabelę bonusową: "${tableName}"?`)) return;

    try {
      await supabase.from('katalog_karnetow').delete().eq('id', tableId);
      await supabase.from('karnety').delete().eq('id', tableId);
    } catch (err) {
      console.warn("Usuwanie z bazy:", err);
    }

    setBonusTables(prev => prev.filter(t => String(t.id) !== String(tableId)));
  };

  // --- ZARZĄDZANIE PROGAMI W TABELI ---
  const handleOpenAddTierModal = (tableId: string | number) => {
    setTargetTableId(tableId);
    setEditingTierId(null);
    setLevelName('NOWY POZIOM');
    setThresholdVal('3');
    setThresholdUnit('miesięcy');
    setRewardTitle('10% rabatu na kolejny karnet');
    setRewardBadge('-10%');
    setSecondaryTitle('Darmowy shake białkowy po treningu');
    setSecondaryBadge('GRATIS');
    setAccentColor('amber');
    setIsTierModalOpen(true);
  };

  const handleOpenEditTierModal = (tableId: string | number, tier: any) => {
    setTargetTableId(tableId);
    setEditingTierId(tier.id);
    setLevelName(tier.levelName || 'POZIOM');
    setThresholdVal(String(tier.threshold || '1'));
    setThresholdUnit(tier.unit || 'miesięcy');
    setRewardTitle(tier.rewardTitle || '');
    setRewardBadge(tier.rewardBadge || '-10%');
    setSecondaryTitle(tier.secondaryTitle || '');
    setSecondaryBadge(tier.secondaryBadge || 'GRATIS');
    setAccentColor(tier.accent || 'amber');
    setIsTierModalOpen(true);
  };

  const handleSaveTierModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardTitle.trim() || !targetTableId) return;

    setBonusTables(prevTables => prevTables.map(tbl => {
      if (String(tbl.id) === String(targetTableId)) {
        let updatedTiers = [...(tbl.customTiers || [])];

        if (editingTierId !== null) {
          // Edycja istniejącego progu
          updatedTiers = updatedTiers.map(t => {
            if (t.id === editingTierId) {
              return {
                ...t,
                levelName: levelName.toUpperCase(),
                threshold: Number(thresholdVal),
                unit: thresholdUnit,
                rewardTitle: rewardTitle.trim(),
                rewardBadge: rewardBadge.trim(),
                secondaryTitle: secondaryTitle.trim(),
                secondaryBadge: secondaryBadge.trim(),
                accent: accentColor
              };
            }
            return t;
          });
        } else {
          // Dodanie nowego progu
          const newTier = {
            id: Date.now(),
            levelName: levelName.toUpperCase(),
            threshold: Number(thresholdVal),
            unit: thresholdUnit,
            rewardTitle: rewardTitle.trim(),
            rewardBadge: rewardBadge.trim(),
            secondaryTitle: secondaryTitle.trim(),
            secondaryBadge: secondaryBadge.trim(),
            accent: accentColor,
            active: true
          };
          updatedTiers.push(newTier);
        }

        updatedTiers.sort((a, b) => a.threshold - b.threshold);
        return { ...tbl, customTiers: updatedTiers };
      }
      return tbl;
    }));

    setIsTierModalOpen(false);
  };

  const handleDeleteTier = (tableId: string | number, tierId: number) => {
    if (!confirm("Czy na pewno chcesz usunąć ten próg z tabeli?")) return;
    setBonusTables(prevTables => prevTables.map(tbl => {
      if (String(tbl.id) === String(tableId)) {
        return {
          ...tbl,
          customTiers: tbl.customTiers.filter((t: any) => t.id !== tierId)
        };
      }
      return tbl;
    }));
  };

  // Zapis całej tabeli do bazy Supabase
  const handleSaveTableToSupabase = async (tableId: string | number) => {
    const tableObj = bonusTables.find(t => String(t.id) === String(tableId));
    if (!tableObj) return;

    setIsSaving(true);
    try {
      const meta = {
        ...(tableObj.inne_ustawienia || {}),
        customTiers: tableObj.customTiers
      };

      let err = null;
      const res1 = await supabase
        .from('katalog_karnetow')
        .update({ inne_ustawienia: JSON.stringify(meta) })
        .eq('id', tableId);

      if (res1.error) {
        const res2 = await supabase
          .from('karnety')
          .update({ inne_ustawienia: JSON.stringify(meta) })
          .eq('id', tableId);
        err = res2.error;
      }

      if (err) throw err;
      alert(`Pomyślnie zapisano tabelę progów dla: "${tableObj.nazwa}" w Supabase!`);
    } catch (error: any) {
      console.error("Błąd zapisu w Supabase:", error);
      alert("Zapisano stan lokalnie. Komunikat bazy: " + (error.message || 'Brak'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isMounted || isLoading) {
    return (
      <div className="p-16 text-center text-slate-400 font-black uppercase text-xs tracking-wider">
        Ładowanie tabel bonusowych Forma Marzeń...
      </div>
    );
  }

  // Statystyki dla kafelków
  const totalLevelsCount = bonusTables.reduce((acc, t) => acc + (t.customTiers?.length || 0), 0);
  const countContinuityMembers = allKlienci.filter((k: any) => (k.cyklCiaglosci || 1) >= 2).length;
  const avgContinuity = allKlienci.length > 0 
    ? (allKlienci.reduce((acc, curr) => acc + (curr.cyklCiaglosci || 1), 0) / allKlienci.length).toFixed(1)
    : '1.0';

  const userActivePass = currentUser?.karnetyKlubowicza?.[0];
  const userMonths = currentUser?.cyklCiaglosci || 1;

  const getAccentBorder = (accent: string) => {
    switch (accent) {
      case 'amber': return 'border-t-4 border-t-amber-500';
      case 'slate': return 'border-t-4 border-t-slate-400';
      case 'yellow': return 'border-t-4 border-t-amber-400';
      case 'purple': return 'border-t-4 border-t-purple-600';
      default: return 'border-t-4 border-t-amber-500';
    }
  };

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-28 font-sans antialiased text-slate-800">
      
      {/* 1. GÓRNY BANER PROGRAMU (STYLISTYKA PROGRAM AMBASADOR) */}
      <div className="bg-white border border-sky-200 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1">
          <h1 className="text-xl font-black uppercase tracking-wide text-sky-950 flex items-center gap-2.5">
            <span>🏆</span> PROGRAM BONUSOWY I TABELE CIĄGŁOŚCI
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Zarządzaj tabelami ciągłości karnetów, twórz nowe tabele, usuwaj zbędne i dodawaj dowolną liczbę progów z nagrodami.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-sky-50/70 border border-sky-200 px-3.5 py-2 rounded-2xl">
            <span className="text-xs font-bold text-slate-600">Status programu:</span>
            <span className="bg-emerald-600 text-white text-[11px] font-black px-3 py-1 rounded-xl uppercase tracking-wider shadow-sm">
              WŁĄCZONY
            </span>
          </div>

          {(appRole === 'admin' || appRole === 'trener') && (
            <button
              onClick={() => setIsAddTableModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2.5 rounded-2xl text-xs uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span>+</span> DODAJ NOWĄ TABELĘ
            </button>
          )}
        </div>
      </div>

      {/* 2. KAFLOWE METRYKI STATYSTYCZNE (4 KAFELKI W RZĘDZIE) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl shrink-0">
            🥇
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">AKTYWNE POZIOMY</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{totalLevelsCount}</div>
          </div>
        </div>

        <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl shrink-0">
            🤝
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">KLUBOWICZE Z CIĄGŁOŚCIĄ</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{countContinuityMembers}</div>
          </div>
        </div>

        <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-xl shrink-0">
            💰
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ŚREDNI STAŻ KLUBOWICZA</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{avgContinuity} MIES.</div>
          </div>
        </div>

        <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-xl shrink-0">
            🛡️
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">LICZBA TABEL W RZĘDZIE</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{bonusTables.length} TABELE</div>
          </div>
        </div>
      </div>

      {/* 3. BELKA Z ZAKŁADKAMI */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('poziomy')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
            activeTab === 'poziomy'
              ? 'bg-[#1a385c] text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>🥇</span> TABELE KARNETÓW I POZIOMY ({bonusTables.length})
        </button>

        <button
          onClick={() => setActiveTab('warunki')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
            activeTab === 'warunki'
              ? 'bg-[#1a385c] text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>🛡️</span> WARUNKI KWALIFIKACJI
        </button>

        <button
          onClick={() => setActiveTab('rejestr')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
            activeTab === 'rejestr'
              ? 'bg-[#1a385c] text-white shadow-md'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>👥</span> REJESTR KLUBOWICZÓW ({allKlienci.length})
        </button>
      </div>

      {/* 4. GŁÓWNA ZAWARTOŚĆ: 2 DO 3 TABELE W RZĘDZIE */}
      {activeTab === 'poziomy' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {bonusTables.map((tabela) => {
            const isUserPass = userActivePass?.nazwa?.trim().toLowerCase() === tabela.nazwa?.trim().toLowerCase();

            return (
              <div
                key={tabela.id}
                className={`bg-slate-50/70 border rounded-3xl p-5 shadow-sm space-y-5 transition-all ${
                  isUserPass ? 'border-amber-400 ring-2 ring-amber-300/40 bg-amber-50/20' : 'border-sky-200'
                }`}
              >
                {/* NAGŁÓWEK TABELI KARNETU */}
                <div className="bg-white border border-sky-200 rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="bg-sky-100 text-sky-950 font-black text-[10px] px-2.5 py-0.5 rounded-md uppercase">
                      {tabela.typ_karnetu || 'Karnet cykliczny'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isUserPass && (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[9px] px-2 py-0.5 rounded-md uppercase">
                          TWÓJ KARNET ✓
                        </span>
                      )}
                      {(appRole === 'admin' || appRole === 'trener') && (
                        <button
                          onClick={() => handleDeleteTable(tabela.id, tabela.nazwa)}
                          className="text-slate-300 hover:text-rose-600 text-xs p-1 cursor-pointer transition-colors"
                          title="Usuń tę tabelę bonusową"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                        {tabela.nazwa}
                      </h2>
                      <div className="text-[11px] text-slate-500 font-semibold">
                        Cena bazowa: {Number(tabela.cena || 0).toFixed(2)} PLN
                      </div>
                    </div>

                    {(appRole === 'admin' || appRole === 'trener') && (
                      <button
                        onClick={() => handleOpenAddTierModal(tabela.id)}
                        className="bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-[10px] font-black px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors flex items-center gap-1"
                      >
                        <span>+</span> DODAJ PRÓG
                      </button>
                    )}
                  </div>
                </div>

                {/* POZIOMY LOJALNOŚCIOWE W TEJ TABELI (PIONOWY STOS) */}
                <div className="space-y-4">
                  {tabela.customTiers?.map((tier: any) => {
                    const userVal = tabela.typ_karnetu === 'Umowa 12 miesięcy'
                      ? (userActivePass?.rata ? parseInt(String(userActivePass.rata).match(/(\d+)/)?.[1] || '1', 10) : 1)
                      : userMonths;
                    const isUnlocked = isUserPass && userVal >= Number(tier.threshold);

                    return (
                      <div
                        key={tier.id}
                        className={`bg-white border border-sky-200 rounded-3xl p-4 shadow-sm space-y-3.5 relative flex flex-col justify-between transition-all hover:shadow-md ${getAccentBorder(tier.accent)}`}
                      >
                        <div className="space-y-2.5">
                          {/* Plakietka i status odblokowania */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="border border-amber-300 text-amber-900 bg-amber-50/60 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                              {tier.levelName}
                            </span>
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider">
                              {appRole === 'klubowicz' ? (isUnlocked ? 'ODBLOKOWANY ✓' : 'W TRAKCIE') : 'AKTYWNY'}
                            </span>
                          </div>

                          {/* Liczba progu */}
                          <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">
                              {tier.threshold} {tier.unit}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                              Wymagana ciągłość karnetu
                            </p>
                          </div>

                          {/* Boks 1: Nagroda Główna */}
                          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[9px] font-black text-amber-950 uppercase tracking-wide flex items-center gap-1">
                                <span>🎁</span> NAGRODA KLUBOWICZA:
                              </span>
                              {tier.rewardBadge && (
                                <span className="bg-amber-200/90 text-amber-950 text-[9px] font-black px-1.5 py-0.5 rounded">
                                  {tier.rewardBadge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-slate-800 leading-snug">
                              {tier.rewardTitle}
                            </p>
                          </div>

                          {/* Boks 2: Dodatkowy Bonus */}
                          <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-3 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[9px] font-black text-sky-950 uppercase tracking-wide flex items-center gap-1">
                                <span>👋</span> BONUS DODATKOWY:
                              </span>
                              {tier.secondaryBadge && (
                                <span className="bg-sky-200/90 text-sky-950 text-[9px] font-black px-1.5 py-0.5 rounded">
                                  {tier.secondaryBadge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-slate-800 leading-snug">
                              {tier.secondaryTitle}
                            </p>
                          </div>
                        </div>

                        {/* Przyciski edycji i kasowania progu */}
                        {(appRole === 'admin' || appRole === 'trener') && (
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => handleOpenEditTierModal(tabela.id, tier)}
                              className="bg-[#9a542a] hover:bg-[#83431d] text-white w-7 h-7 rounded-xl flex items-center justify-center text-xs shadow-sm transition-colors cursor-pointer"
                              title="Edytuj próg"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteTier(tabela.id, tier.id)}
                              className="bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-600 w-7 h-7 rounded-xl flex items-center justify-center text-xs shadow-sm transition-colors cursor-pointer"
                              title="Usuń próg"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {(!tabela.customTiers || tabela.customTiers.length === 0) && (
                    <div className="text-center py-8 text-xs text-slate-400 font-medium italic bg-white rounded-2xl border border-dashed border-sky-200">
                      Brak progów w tej tabeli. Kliknij "+ DODAJ PRÓG".
                    </div>
                  )}
                </div>

                {/* ZAPIS TEJ TABELI DO SUPABASE */}
                {(appRole === 'admin' || appRole === 'trener') && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveTableToSupabase(tabela.id)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2.5 rounded-2xl text-[11px] uppercase tracking-wider cursor-pointer shadow-sm transition-all text-center"
                  >
                    💾 Zapisz tabelę: {tabela.nazwa}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. ZAKŁADKA 2: WARUNKI KWALIFIKACJI */}
      {activeTab === 'warunki' && (
        <div className="bg-white border border-sky-200 rounded-3xl p-7 shadow-sm space-y-6">
          <div className="border-b border-sky-100 pb-4">
            <h3 className="text-base font-black text-sky-950 uppercase tracking-wide flex items-center gap-2">
              <span>🛡️</span> Zasady kwalifikacji do progów lojalnościowych
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              System przelicza ciągłość automatycznie w bazie Supabase na podstawie opłaconych rat oraz cykli odnowień.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-sky-50/60 border border-sky-200 rounded-2xl p-5 space-y-3">
              <span className="bg-sky-200 text-sky-950 font-black text-[10px] px-2.5 py-1 rounded-md uppercase">
                Karnety Cykliczne (Umowa)
              </span>
              <h4 className="font-black text-slate-900 text-sm">Rozliczenie ratalne (1-12)</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Klubowicz zdobywa kolejne poziomy wraz z kolejnymi opłaconymi ratami. Po 12. racie zyskuje darmowy okres bonusowy za dni zamrożenia.
              </p>
            </div>

            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-3">
              <span className="bg-amber-200 text-amber-950 font-black text-[10px] px-2.5 py-1 rounded-md uppercase">
                Karnety OPEN (Na czas)
              </span>
              <h4 className="font-black text-slate-900 text-sm">Ciągłość odnowień</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Każde odnowienie przed wygaśnięciem obecnego karnetu zwiększa licznik cyklu ciągłości w tabeli klubowicza o +1.
              </p>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 space-y-3">
              <span className="bg-emerald-200 text-emerald-950 font-black text-[10px] px-2.5 py-1 rounded-md uppercase">
                Karnety Ogólnorozwojowe
              </span>
              <h4 className="font-black text-slate-900 text-sm">Pula wejść treningowych</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Poziomy są naliczane proporcjonalnie do ilości zrealizowanych treningów w klubie Forma Marzeń.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 6. ZAKŁADKA 3: REJESTR KLUBOWICZÓW */}
      {activeTab === 'rejestr' && (
        <div className="bg-white border border-sky-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-sky-100">
            <h3 className="text-sm font-black text-sky-950 uppercase tracking-wider">
              👥 Rejestr ciągłości i statusów klubowiczów
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sky-50/70 border-b border-sky-200 text-[11px] font-black text-sky-950 uppercase tracking-wider">
                  <th className="py-4 px-6">Klubowicz</th>
                  <th className="py-4 px-6">E-mail</th>
                  <th className="py-4 px-6">Cykl ciągłości</th>
                  <th className="py-4 px-6">Aktywny karnet</th>
                  <th className="py-4 px-6 text-center">Status bonusu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 text-xs font-medium">
                {allKlienci.map((klient) => {
                  const karnet = klient.karnetyKlubowicza?.[0];
                  const cykl = klient.cyklCiaglosci || 1;
                  return (
                    <tr key={klient.id} className="hover:bg-sky-50/40 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {klient.firstName} {klient.lastName}
                      </td>
                      <td className="py-4 px-6 text-slate-500">{klient.email}</td>
                      <td className="py-4 px-6 font-black text-sky-900">
                        {cykl} {cykl === 1 ? 'miesiąc' : cykl < 5 ? 'miesiące' : 'miesięcy'}
                      </td>
                      <td className="py-4 px-6 text-slate-700 font-semibold">
                        {karnet ? karnet.nazwa : 'Brak'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-xl uppercase ${
                          cykl >= 3 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {cykl >= 12 ? 'VIP / DIAMENT' : cykl >= 9 ? 'ZŁOTY' : cykl >= 6 ? 'SREBRNY' : cykl >= 3 ? 'BRĄZOWY' : 'START'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. MODAL: DODAWANIE NOWEJ TABELI */}
      {isAddTableModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-sky-200 rounded-3xl max-w-md w-full p-7 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-sky-100 pb-4">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider flex items-center gap-2">
                <span>➕</span> Dodaj nową tabelę karnetu
              </h3>
              <button
                type="button"
                onClick={() => setIsAddTableModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewTable} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nazwa tabeli / karnetu</label>
                <input
                  type="text"
                  required
                  placeholder="np. Karnet OPEN Poranny, Pakiet 20 wejść"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Typ karnetu</label>
                <select
                  value={newTableType}
                  onChange={(e) => setNewTableType(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 cursor-pointer"
                >
                  <option value="Umowa 12 miesięcy">Umowa 12 miesięcy (Cykliczna)</option>
                  <option value="Na czas">Na czas (np. OPEN 1 miesiąc)</option>
                  <option value="Na ilość treningów">Na ilość treningów (Wejściowy)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Cena brutto (PLN)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="199.00"
                  value={newTablePrice}
                  onChange={(e) => setNewTablePrice(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-sky-100">
                <button
                  type="button"
                  onClick={() => setIsAddTableModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-black px-6 py-2.5 rounded-xl uppercase tracking-wider cursor-pointer shadow-md transition-colors"
                >
                  {isSaving ? 'Tworzenie...' : 'Utwórz tabelę'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: DODAWANIE / EDYCJA PROGU DLA DANEJ TABELI */}
      {isTierModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-sky-200 rounded-3xl max-w-xl w-full p-7 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-sky-100 pb-4">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider flex items-center gap-2">
                <span>🏆</span> {editingTierId ? 'Edytuj próg lojalnościowy' : 'Dodaj nowy próg do tabeli'}
              </h3>
              <button
                type="button"
                onClick={() => setIsTierModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTierModal} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nazwa poziomu (np. BRĄZOWY, VIP)</label>
                  <input
                    type="text"
                    required
                    value={levelName}
                    onChange={(e) => setLevelName(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Kolor akcentu</label>
                  <select
                    value={accentColor}
                    onChange={(e: any) => setAccentColor(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="amber">Brąz / Bursztyn</option>
                    <option value="slate">Srebro / Szary</option>
                    <option value="yellow">Złoto / Żółty</option>
                    <option value="purple">VIP / Fiolet</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Wymagana wartość ciągłości</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={thresholdVal}
                    onChange={(e) => setThresholdVal(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Jednostka</label>
                  <select
                    value={thresholdUnit}
                    onChange={(e: any) => setThresholdUnit(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="miesięcy">miesięcy</option>
                    <option value="cykli">cykli</option>
                    <option value="wejść">wejść</option>
                  </select>
                </div>
              </div>

              {/* Nagroda klubowicza */}
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 space-y-3">
                <h4 className="font-black text-amber-950 uppercase text-[11px]">🎁 Główna nagroda klubowicza</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="font-bold text-slate-700">Opis nagrody</label>
                    <input
                      type="text"
                      required
                      value={rewardTitle}
                      onChange={(e) => setRewardTitle(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 font-semibold text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Plakietka (Tag)</label>
                    <input
                      type="text"
                      value={rewardBadge}
                      onChange={(e) => setRewardBadge(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 font-black text-slate-900 text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Dodatkowy bonus */}
              <div className="bg-sky-50/60 p-4 rounded-2xl border border-sky-200 space-y-3">
                <h4 className="font-black text-sky-950 uppercase text-[11px]">👋 Dodatkowy bonus</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="font-bold text-slate-700">Opis bonusu</label>
                    <input
                      type="text"
                      value={secondaryTitle}
                      onChange={(e) => setSecondaryTitle(e.target.value)}
                      className="w-full bg-white border border-sky-300 rounded-xl px-3 py-2 font-semibold text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Plakietka (Tag)</label>
                    <input
                      type="text"
                      value={secondaryBadge}
                      onChange={(e) => setSecondaryBadge(e.target.value)}
                      className="w-full bg-white border border-sky-300 rounded-xl px-3 py-2 font-black text-slate-900 text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-sky-100">
                <button
                  type="button"
                  onClick={() => setIsTierModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-black px-6 py-2.5 rounded-xl uppercase tracking-wider cursor-pointer shadow-md transition-colors"
                >
                  {editingTierId ? 'Zaktualizuj próg' : 'Dodaj próg'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
