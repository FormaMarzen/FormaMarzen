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
  const [karnetyCennik, setKarnetyCennik] = useState<any[]>([]);

  // Zakładki widoku
  const [activeTab, setActiveTab] = useState<'poziomy' | 'warunki' | 'rejestr'>('poziomy');

  // Wybrany karnet do konfiguracji
  const [selectedAdminKarnetId, setSelectedAdminKarnetId] = useState<string | number>('');
  const [editTiers, setEditTiers] = useState<any[]>([]);
  const [isSavingTier, setIsSavingTier] = useState(false);

  // Modal dodawania / edycji poziomu
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTierId, setEditingTierId] = useState<number | null>(null);
  const [levelName, setLevelName] = useState('BRĄZOWY');
  const [thresholdVal, setThresholdVal] = useState('3');
  const [thresholdUnit, setThresholdUnit] = useState<'miesięcy' | 'wejść' | 'cykli'>('miesięcy');
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardBadge, setRewardBadge] = useState('-10%');
  const [secondaryTitle, setSecondaryTitle] = useState('');
  const [secondaryBadge, setSecondaryBadge] = useState('-10%');
  const [accentColor, setAccentColor] = useState<'amber' | 'slate' | 'yellow' | 'purple'>('amber');

  // Domyślne progi lojalnościowe w stylu Ambasador
  const defaultTiers = [
    {
      id: 1,
      levelName: 'BRĄZOWY',
      threshold: 3,
      unit: 'miesiące',
      accent: 'amber',
      rewardTitle: '10% rabatu na kolejny karnet lub suplementy w barze.',
      rewardBadge: '-10%',
      secondaryTitle: 'Darmowy shake białkowy po każdym wznowieniu.',
      secondaryBadge: 'GRATIS',
      active: true
    },
    {
      id: 2,
      levelName: 'SREBRNY',
      threshold: 6,
      unit: 'miesięcy',
      accent: 'slate',
      rewardTitle: '25% rabatu na dowolny trening personalny lub analizę składu.',
      rewardBadge: '-25%',
      secondaryTitle: '+14 dni bezpłatnego zamrożenia do puli karnetu.',
      secondaryBadge: '+14 DNI',
      active: true
    },
    {
      id: 3,
      levelName: 'ZŁOTY',
      threshold: 9,
      unit: 'miesięcy',
      accent: 'yellow',
      rewardTitle: 'Karnet OPEN na 1 miesiąc z rabatem 50% lub prezent firmowy.',
      rewardBadge: '-50%',
      secondaryTitle: 'Darmowa konsultacja trenerska z planem ćwiczeń.',
      secondaryBadge: 'GRATIS',
      active: true
    },
    {
      id: 4,
      levelName: 'VIP / DIAMENT',
      threshold: 12,
      unit: 'miesięcy',
      accent: 'purple',
      rewardTitle: 'Darmowy miesiąc bonusowy (0.00 PLN) po 12 miesiącach ciągłości.',
      rewardBadge: '-100%',
      secondaryTitle: 'Limitowana koszulka FORMA MARZEŃ + stały status VIP.',
      secondaryBadge: 'VIP',
      active: true
    }
  ];

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;

      // Sprawdzenie roli użytkownika
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

      // Pobieranie karnetów z bazy
      let { data: karnetyData } = await supabase.from('katalog_karnetow').select('*');
      if (!karnetyData || karnetyData.length === 0) {
        const fallback = await supabase.from('karnety').select('*');
        karnetyData = fallback.data;
      }

      if (karnetyData && karnetyData.length > 0) {
        const parsed = karnetyData.map((k: any) => {
          let meta: any = {};
          try {
            meta = JSON.parse(k.inne_ustawienia || '{}');
          } catch (e) {}
          return {
            ...k,
            customTiers: meta.customTiers && meta.customTiers.length > 0 ? meta.customTiers : defaultTiers
          };
        });
        setKarnetyCennik(parsed);
        setSelectedAdminKarnetId(parsed[0].id);
        setEditTiers(parsed[0].customTiers);
      }

      // Pobieranie klientów
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
      console.error("Błąd ładowania danych:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, []);

  const handleSelectPass = (passId: string | number) => {
    setSelectedAdminKarnetId(passId);
    const passObj = karnetyCennik.find((k: any) => String(k.id) === String(passId));
    if (passObj) {
      setEditTiers(passObj.customTiers || defaultTiers);
    }
  };

  const handleOpenAddModal = () => {
    setEditingTierId(null);
    setLevelName('NOWY POZIOM');
    setThresholdVal('3');
    setThresholdUnit('miesięcy');
    setRewardTitle('10% rabatu na kolejny karnet');
    setRewardBadge('-10%');
    setSecondaryTitle('Darmowy shake białkowy');
    setSecondaryBadge('GRATIS');
    setAccentColor('amber');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tier: any) => {
    setEditingTierId(tier.id);
    setLevelName(tier.levelName || 'POZIOM');
    setThresholdVal(String(tier.threshold || '1'));
    setThresholdUnit(tier.unit || 'miesięcy');
    setRewardTitle(tier.rewardTitle || '');
    setRewardBadge(tier.rewardBadge || '-10%');
    setSecondaryTitle(tier.secondaryTitle || '');
    setSecondaryBadge(tier.secondaryBadge || 'GRATIS');
    setAccentColor(tier.accent || 'amber');
    setIsModalOpen(true);
  };

  const handleSaveTierModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardTitle.trim()) return;

    if (editingTierId !== null) {
      const updated = editTiers.map((t: any) => {
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
      setEditTiers(updated);
    } else {
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
      const updated = [...editTiers, newTier].sort((a, b) => a.threshold - b.threshold);
      setEditTiers(updated);
    }
    setIsModalOpen(false);
  };

  const handleDeleteTier = (id: number) => {
    if (confirm("Czy na pewno chcesz usunąć ten poziom nagród?")) {
      setEditTiers(editTiers.filter((t: any) => t.id !== id));
    }
  };

  const handleSaveAllToDatabase = async () => {
    if (!selectedAdminKarnetId) return;
    setIsSavingTier(true);
    try {
      const passObj = karnetyCennik.find((k: any) => String(k.id) === String(selectedAdminKarnetId));
      if (!passObj) return;

      let meta: any = {};
      try {
        meta = JSON.parse(passObj.inne_ustawienia || '{}');
      } catch (e) {}

      meta.customTiers = editTiers;

      // Zapis do tabeli katalog_karnetow lub karnety
      let errorSupabase = null;
      const res1 = await supabase
        .from('katalog_karnetow')
        .update({ inne_ustawienia: JSON.stringify(meta) })
        .eq('id', selectedAdminKarnetId);

      if (res1.error) {
        const res2 = await supabase
          .from('karnety')
          .update({ inne_ustawienia: JSON.stringify(meta) })
          .eq('id', selectedAdminKarnetId);
        errorSupabase = res2.error;
      }

      if (errorSupabase) throw errorSupabase;

      setKarnetyCennik(karnetyCennik.map((k: any) => {
        if (String(k.id) === String(selectedAdminKarnetId)) {
          return { ...k, customTiers: editTiers };
        }
        return k;
      }));

      alert("Wszystkie poziomy nagród zostały pomyślnie zapisane w bazie!");
    } catch (err: any) {
      console.error("Błąd zapisu:", err);
      alert("Nie udało się zapisać zmian: " + (err.message || ''));
    } finally {
      setIsSavingTier(false);
    }
  };

  if (!isMounted || isLoading) {
    return (
      <div className="p-16 text-center text-slate-400 font-bold uppercase text-xs tracking-wider">
        Ładowanie modułu Twój Bonus...
      </div>
    );
  }

  // Statystyki dla kafelków
  const countActiveTiers = editTiers.length;
  const countQualifiedClients = allKlienci.filter((k: any) => (k.cyklCiaglosci || 1) >= 2).length;
  const avgContinuity = allKlienci.length > 0 
    ? (allKlienci.reduce((acc, curr) => acc + (curr.cyklCiaglosci || 1), 0) / allKlienci.length).toFixed(1)
    : '1.0';

  const selectedPass = karnetyCennik.find((k: any) => String(k.id) === String(selectedAdminKarnetId));
  const activeUserPass = currentUser?.karnetyKlubowicza?.[0];
  const userMonths = currentUser?.cyklCiaglosci || 1;

  // Funkcja zwracająca styl obramowania akcentującego kartę
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
      
      {/* 1. GÓRNY BANER: PROGRAM BONUSOWY (Styl jak Program Ambasador) */}
      <div className="bg-white border border-sky-200 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1">
          <h1 className="text-xl font-black uppercase tracking-wide text-sky-950 flex items-center gap-2.5">
            <span>🏆</span> TWÓJ BONUS I SYSTEM CIĄGŁOŚCI
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Zarządzaj progami ciągłości, zniżkami na karnety na umowę, open i ogólnorozwojowe oraz nagrodami lojalnościowymi.
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
              onClick={handleOpenAddModal}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2.5 rounded-2xl text-xs uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span>+</span> DODAJ NOWY POZIOM
            </button>
          )}
        </div>
      </div>

      {/* 2. KAFLOWE METRYKI STATYSTYCZNE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KAFEL 1: AKTYWNE POZIOMY */}
        <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl shrink-0">
            🥇
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">AKTYWNE POZIOMY</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{countActiveTiers}</div>
          </div>
        </div>

        {/* KAFEL 2: KLUBOWICZE Z CIĄGŁOŚCIĄ */}
        <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl shrink-0">
            🤝
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">KLUBOWICZE Z CIĄGŁOŚCIĄ</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{countQualifiedClients}</div>
          </div>
        </div>

        {/* KAFEL 3: ŚREDNI CYKL CIĄGŁOŚCI */}
        <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-xl shrink-0">
            💰
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ŚREDNI CYKL CIĄGŁOŚCI</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">{avgContinuity} MIES.</div>
          </div>
        </div>

        {/* KAFEL 4: MINIMALNY PRÓG DO BONUSU */}
        <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-xl shrink-0">
            🛡️
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">MIN. CZAS DO BONUSU</div>
            <div className="text-2xl font-black text-slate-900 mt-0.5">3 MIESIĄCE</div>
          </div>
        </div>

      </div>

      {/* 3. BELKA Z ZAKŁADKAMI I SELEKTOREM KARNETU */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Zakładki */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('poziomy')}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
              activeTab === 'poziomy'
                ? 'bg-[#1a385c] text-white shadow-md'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>🥇</span> POZIOMY I NAGRODY ({editTiers.length})
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

        {/* Selektor karnetu (Umowa, OPEN, Ogólnorozwojowy) */}
        {(appRole === 'admin' || appRole === 'trener') && (
          <div className="flex items-center gap-2 bg-white border border-sky-200 px-3.5 py-1.5 rounded-2xl shadow-sm">
            <span className="text-xs font-bold text-slate-500">Konfiguracja karnetu:</span>
            <select
              value={selectedAdminKarnetId}
              onChange={(e) => handleSelectPass(e.target.value)}
              className="bg-sky-50/80 border border-sky-200 rounded-xl px-3 py-1.5 text-xs font-black text-sky-950 focus:outline-none cursor-pointer"
            >
              {karnetyCennik.map((k: any) => (
                <option key={k.id} value={k.id}>{k.nazwa} ({k.typ_karnetu})</option>
              ))}
            </select>
          </div>
        )}

      </div>

      {/* 4. GŁÓWNA ZAWARTOŚĆ: ZAKŁADKA 1 - POZIOMY I NAGRODY (KARTY W STYLU AMBASADOR) */}
      {activeTab === 'poziomy' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {editTiers.map((tier: any) => {
              const userVal = activeUserPass?.typKarnetu === 'Umowa 12 miesięcy' 
                ? (activeUserPass?.rata ? parseInt(String(activeUserPass.rata).match(/(\d+)/)?.[1] || '1', 10) : 1)
                : userMonths;
              const isUnlocked = appRole === 'klubowicz' && userVal >= Number(tier.threshold);

              return (
                <div
                  key={tier.id}
                  className={`bg-white border border-sky-200 rounded-3xl p-5 shadow-sm space-y-4 relative flex flex-col justify-between transition-all hover:shadow-md ${getAccentBorder(tier.accent)}`}
                >
                  <div className="space-y-3">
                    {/* Wiersz z plakietką nazwy i statusem */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="border border-amber-300 text-amber-900 bg-amber-50/50 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider">
                        {tier.levelName}
                      </span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-xl uppercase tracking-wider">
                        {appRole === 'klubowicz' ? (isUnlocked ? 'ODBLOKOWANY ✓' : 'W TRAKCIE') : 'AKTYWNY'}
                      </span>
                    </div>

                    {/* Wartość liczbowa progu */}
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                        {tier.threshold} {tier.unit}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">
                        Wymagana ciągłość karnetu
                      </p>
                    </div>

                    {/* Boks 1: Nagroda Klubowicza (żółty/amber) */}
                    <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                          <span>🎁</span> NAGRODA KLUBOWICZA:
                        </span>
                        {tier.rewardBadge && (
                          <span className="bg-amber-200/90 text-amber-950 text-[10px] font-black px-2 py-0.5 rounded-md">
                            {tier.rewardBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 leading-snug">
                        {tier.rewardTitle}
                      </p>
                    </div>

                    {/* Boks 2: Dodatkowy Bonus (błękitny/sky) */}
                    <div className="bg-sky-50/80 border border-sky-200/90 rounded-2xl p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black text-sky-950 uppercase tracking-wide flex items-center gap-1.5">
                          <span>👋</span> BONUS DODATKOWY:
                        </span>
                        {tier.secondaryBadge && (
                          <span className="bg-sky-200/90 text-sky-950 text-[10px] font-black px-2 py-0.5 rounded-md">
                            {tier.secondaryBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 leading-snug">
                        {tier.secondaryTitle}
                      </p>
                    </div>
                  </div>

                  {/* Przyciski edycji i usuwania w stylu Ambasador */}
                  {(appRole === 'admin' || appRole === 'trener') && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleOpenEditModal(tier)}
                        className="bg-[#9a542a] hover:bg-[#83431d] text-white w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-sm transition-colors cursor-pointer"
                        title="Edytuj poziom"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteTier(tier.id)}
                        className="bg-slate-200 hover:bg-rose-100 hover:text-rose-700 text-slate-600 w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-sm transition-colors cursor-pointer"
                        title="Usuń poziom"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Przycisk zapisu do bazy */}
          {(appRole === 'admin' || appRole === 'trener') && (
            <div className="flex justify-end pt-3">
              <button
                type="button"
                disabled={isSavingTier}
                onClick={handleSaveAllToDatabase}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black px-8 py-3.5 rounded-2xl text-xs uppercase tracking-wider cursor-pointer shadow-md transition-all flex items-center gap-2"
              >
                <span>💾</span> {isSavingTier ? 'ZAPISYWANIE W BAZIE...' : 'ZAPISZ KONFIGURACJĘ POZIOMÓW W SUPABASE'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. ZAKŁADKA 2: WARUNKI KWALIFIKACJI I CIĄGŁOŚCI */}
      {activeTab === 'warunki' && (
        <div className="bg-white border border-sky-200 rounded-3xl p-7 shadow-sm space-y-6">
          <div className="border-b border-sky-100 pb-4">
            <h3 className="text-base font-black text-sky-950 uppercase tracking-wide flex items-center gap-2">
              <span>🛡️</span> Warunki ciągłości karnetów i progi bonusowe
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Zasady zaliczania stażu treningowego i przyznawania nagród w klubie Forma Marzeń.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-sky-50/60 border border-sky-200 rounded-2xl p-5 space-y-3">
              <span className="bg-sky-200 text-sky-950 font-black text-[10px] px-2.5 py-1 rounded-md uppercase">
                Karnety na Umowę (12M)
              </span>
              <h4 className="font-black text-slate-900 text-sm">Rozliczenie ratalne</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Klubowicz zyskuje kolejne progi wraz z opłaceniem każdej raty (1/12 do 12/12). Po 12. racie zyskuje darmowy okres bonusowy wynikający z dni zamrożenia.
              </p>
            </div>

            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 space-y-3">
              <span className="bg-amber-200 text-amber-950 font-black text-[10px] px-2.5 py-1 rounded-md uppercase">
                Karnety OPEN
              </span>
              <h4 className="font-black text-slate-900 text-sm">Ciągłość miesięczna</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Wymagane jest odnowienie karnetu przed upływem jego ważności lub w trakcie okresu karencji. Każdy kolejny zakup zwiększa licznik cyklu ciągłości.
              </p>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 space-y-3">
              <span className="bg-emerald-200 text-emerald-950 font-black text-[10px] px-2.5 py-1 rounded-md uppercase">
                Karnety Ogólnorozwojowe
              </span>
              <h4 className="font-black text-slate-900 text-sm">Pula wejść</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Dla karnetów wejściowych liczy się liczba zrealizowanych treningów. Wykorzystanie puli i zakup kolejnego pakietu zachowuje poziom bonusowy.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 6. ZAKŁADKA 3: REJESTR KLUBOWICZÓW */}
      {activeTab === 'rejestr' && (
        <div className="bg-white border border-sky-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-sky-950 uppercase tracking-wider">
                👥 Rejestr ciągłości i statusu klubowiczów
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Baza klubowiczów z przypisanym stażem, cyklem ciągłości oraz odblokowanymi progami.
              </p>
            </div>
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
                        {karnet ? karnet.nazwa : 'Brak aktywnego karnetu'}
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

      {/* 7. MODAL DODAWANIA / EDYCJI POZIOMU */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-sky-200 rounded-3xl max-w-xl w-full p-7 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-sky-100 pb-4">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider flex items-center gap-2">
                <span>🏆</span> {editingTierId ? 'Edytuj poziom bonusowy' : 'Dodaj nowy poziom bonusowy'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTierModal} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nazwa poziomu (Etykieta)</label>
                  <input
                    type="text"
                    required
                    placeholder="np. BRĄZOWY, SREBRNY, ZŁOTY, VIP"
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
                    placeholder="np. 3, 6, 12"
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
                      placeholder="np. 10% rabatu na kolejny karnet"
                      value={rewardTitle}
                      onChange={(e) => setRewardTitle(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 font-semibold text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Plakietka (Tag)</label>
                    <input
                      type="text"
                      placeholder="-10%"
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
                      placeholder="np. Darmowy shake białkowy po treningu"
                      value={secondaryTitle}
                      onChange={(e) => setSecondaryTitle(e.target.value)}
                      className="w-full bg-white border border-sky-300 rounded-xl px-3 py-2 font-semibold text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Plakietka (Tag)</label>
                    <input
                      type="text"
                      placeholder="GRATIS"
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
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-xl cursor-pointer transition-colors"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-black px-6 py-2.5 rounded-xl uppercase tracking-wider cursor-pointer shadow-md transition-colors"
                >
                  {editingTierId ? 'Zaktualizuj poziom' : 'Dodaj poziom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
