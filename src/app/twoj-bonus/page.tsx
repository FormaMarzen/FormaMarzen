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

  // Główny status programu (włączony / wyłączony)
  const [isProgramActive, setIsProgramActive] = useState<boolean>(true);
  const [isSavingStatus, setIsSavingStatus] = useState<boolean>(false);

  // Tabele bonusowe (karnety z przypisanymi poziomami)
  const [bonusTables, setBonusTables] = useState<any[]>([]);

  // Wybrany/podświetlony poziom z roadmapy
  const [selectedRoadmapTier, setSelectedRoadmapTier] = useState<Record<string | number, number | null>>({});

  // Warunki kwalifikacji (umieszczone bezpośrednio pod roadmapą, edytowalne przez admina)
  const [qualificationRules, setQualificationRules] = useState<any[]>([
    {
      id: 'umowa',
      badge: 'Karnety Cykliczne (Umowa)',
      title: 'Rozliczenie ratalne (1-12)',
      desc: 'Klubowicz zdobywa kolejne poziomy wraz z kolejnymi opłaconymi ratami. Po 12. racie zyskuje darmowy okres bonusowy za dni zamrożenia.'
    },
    {
      id: 'open',
      badge: 'Karnety OPEN (Na czas)',
      title: 'Ciągłość odnowień',
      desc: 'Każde odnowienie przed wygaśnięciem obecnego karnetu zwiększa licznik cyklu ciągłości w tabeli klubowicza o +1.'
    },
    {
      id: 'wejscia',
      badge: 'Karnety Ogólnorozwojowe',
      title: 'Pula wejść treningowych',
      desc: 'Poziomy są naliczane proporcjonalnie do ilości zrealizowanych treningów w klubie Forma Marzeń.'
    }
  ]);
  const [isEditRuleModalOpen, setIsEditRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string>('');
  const [ruleBadge, setRuleBadge] = useState('');
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');

  // Modale: Tabela i Próg
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableType, setNewTableType] = useState('Umowa 12 miesięcy');
  const [newTablePrice, setNewTablePrice] = useState('199.00');

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

  // Domyślne poziomy
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

      // 1. Sprawdzenie roli
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

      // 2. Pobieranie statusu programu oraz zasad z club_booking_rules
      const { data: rulesData } = await supabase.from('club_booking_rules').select('*').limit(1).maybeSingle();
      if (rulesData) {
        if (rulesData.bonus_program_active !== undefined) {
          setIsProgramActive(rulesData.bonus_program_active);
        }
        if (rulesData.bonus_qualification_rules) {
          try {
            const parsedRules = typeof rulesData.bonus_qualification_rules === 'string'
              ? JSON.parse(rulesData.bonus_qualification_rules)
              : rulesData.bonus_qualification_rules;
            if (Array.isArray(parsedRules) && parsedRules.length > 0) {
              setQualificationRules(parsedRules);
            }
          } catch(e) {}
        }
      }

      // 3. Pobieranie tabel karnetów
      let { data: karnetyData } = await supabase
        .from('katalog_karnetow')
        .select('*')
        .order('kolejnosc', { ascending: true })
        .order('id', { ascending: true });

      if (!karnetyData || karnetyData.length === 0) {
        const fallback = await supabase.from('karnety').select('*').order('id', { ascending: true });
        karnetyData = fallback.data;
      }

      if (karnetyData && karnetyData.length > 0) {
        const parsed = karnetyData.map((k: any, index: number) => {
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
            kolejnosc: k.kolejnosc !== null && k.kolejnosc !== undefined ? k.kolejnosc : index,
            inne_ustawienia: meta,
            customTiers: meta.customTiers && meta.customTiers.length > 0 ? meta.customTiers : fallbackTiers
          };
        });

        parsed.sort((a: any, b: any) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0));
        setBonusTables(parsed);
        if (parsed[0]) setTargetTableId(parsed[0].id);
      } else {
        setBonusTables([
          { id: 1, nazwa: 'Karnet Umowa 12M', typ_karnetu: 'Umowa 12 miesięcy', cena: 179, kolejnosc: 0, customTiers: defaultTiersUmowa },
          { id: 2, nazwa: 'Karnet OPEN', typ_karnetu: 'Na czas', cena: 199, kolejnosc: 1, customTiers: defaultTiersOpen },
          { id: 3, nazwa: 'Karnet Ogólnorozwojowy', typ_karnetu: 'Na ilość treningów', cena: 220, kolejnosc: 2, customTiers: defaultTiersWejscia }
        ]);
      }

      // 4. Pobieranie klientów
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

  // Przełączanie statusu programu przez administratora
  const handleToggleProgramStatus = async () => {
    const nextStatus = !isProgramActive;
    setIsProgramActive(nextStatus);
    setIsSavingStatus(true);

    try {
      const { data: existingRule } = await supabase.from('club_booking_rules').select('id').limit(1).maybeSingle();
      if (existingRule) {
        await supabase
          .from('club_booking_rules')
          .update({ bonus_program_active: nextStatus })
          .eq('id', existingRule.id);
      }
    } catch (e) {
      console.warn("Błąd zapisu statusu w Supabase:", e);
    } finally {
      setIsSavingStatus(false);
    }
  };

  // Zmiana kolejności tabel (lewo/prawo)
  const handleMoveTable = async (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= bonusTables.length) return;

    const newTables = [...bonusTables];
    const temp = newTables[index];
    newTables[index] = newTables[targetIndex];
    newTables[targetIndex] = temp;

    const updatedWithOrder = newTables.map((t, idx) => ({ ...t, kolejnosc: idx }));
    setBonusTables(updatedWithOrder);

    try {
      await Promise.all(
        updatedWithOrder.map((t) =>
          supabase
            .from('katalog_karnetow')
            .update({ kolejnosc: t.kolejnosc })
            .eq('id', t.id)
        )
      );
    } catch (err) {
      console.warn("Błąd zapisu kolejności w Supabase:", err);
    }
  };

  // Dodawanie nowej tabeli
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
      kolejnosc: bonusTables.length,
      inne_ustawienia: { customTiers: defaultNewTiers },
      customTiers: defaultNewTiers
    };

    setIsSaving(true);
    try {
      const payload = {
        nazwa: newTableObj.nazwa,
        typ_karnetu: newTableObj.typ_karnetu,
        cena_brutto: newTableObj.cena,
        kolejnosc: newTableObj.kolejnosc,
        dlugosc: newTableType === 'Umowa 12 miesięcy' ? '12 miesięcy' : '1 miesiąc',
        inne_ustawienia: JSON.stringify({ customTiers: defaultNewTiers })
      };

      const { data: inserted, error } = await supabase.from('katalog_karnetow').insert([payload]).select().single();
      if (!error && inserted) {
        newTableObj.id = inserted.id;
      }
    } catch (err) {
      console.warn("Zapisano lokalnie:", err);
    } finally {
      setBonusTables(prev => [...prev, newTableObj]);
      setIsAddTableModalOpen(false);
      setNewTableName('');
      setIsSaving(false);
    }
  };

  // Usuwanie tabeli
  const handleDeleteTable = async (tableId: string | number, tableName: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć całą tabelę bonusową dla: "${tableName}"?`)) return;

    try {
      await supabase.from('katalog_karnetow').delete().eq('id', tableId);
      await supabase.from('karnety').delete().eq('id', tableId);
    } catch (err) {
      console.warn("Błąd usuwania z bazy:", err);
    }

    setBonusTables(prev => prev.filter(t => String(t.id) !== String(tableId)));
  };

  // Dodawanie / Edycja progu
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

  // Zapis tabeli do Supabase
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
        .update({ inne_ustawienia: JSON.stringify(meta), kolejnosc: tableObj.kolejnosc })
        .eq('id', tableId);

      if (res1.error) {
        const res2 = await supabase
          .from('karnety')
          .update({ inne_ustawienia: JSON.stringify(meta) })
          .eq('id', tableId);
        err = res2.error;
      }

      if (err) throw err;
      alert(`Pomyślnie zapisano tabelę dla: "${tableObj.nazwa}" w bazie!`);
    } catch (error: any) {
      console.error("Błąd zapisu w Supabase:", error);
      alert("Zapisano lokalnie. Komunikat bazy: " + (error.message || 'Brak'));
    } finally {
      setIsSaving(false);
    }
  };

  // Edycja warunków kwalifikacji przez administratora
  const handleOpenEditRuleModal = (rule: any) => {
    setEditingRuleId(rule.id);
    setRuleBadge(rule.badge);
    setRuleTitle(rule.title);
    setRuleDesc(rule.desc);
    setIsEditRuleModalOpen(true);
  };

  const handleSaveRuleModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = qualificationRules.map(r => {
      if (r.id === editingRuleId) {
        return { ...r, badge: ruleBadge, title: ruleTitle, desc: ruleDesc };
      }
      return r;
    });
    setQualificationRules(updated);
    setIsEditRuleModalOpen(false);

    try {
      const { data: existingRule } = await supabase.from('club_booking_rules').select('id').limit(1).maybeSingle();
      if (existingRule) {
        await supabase
          .from('club_booking_rules')
          .update({ bonus_qualification_rules: JSON.stringify(updated) })
          .eq('id', existingRule.id);
      }
    } catch (e) {
      console.warn("Błąd zapisu warunków:", e);
    }
  };

  if (!isMounted || isLoading) {
    return (
      <div className="p-16 text-center text-slate-400 font-black uppercase text-xs tracking-wider">
        Ładowanie systemu lojalnościowego Forma Marzeń...
      </div>
    );
  }

  // Statystyki dla administratora
  const totalLevelsCount = bonusTables.reduce((acc, t) => acc + (t.customTiers?.length || 0), 0);
  const countContinuityMembers = allKlienci.filter((k: any) => (k.cyklCiaglosci || 1) >= 2).length;
  const avgContinuity = allKlienci.length > 0 
    ? (allKlienci.reduce((acc, curr) => acc + (curr.cyklCiaglosci || 1), 0) / allKlienci.length).toFixed(1)
    : '1.0';

  const userActivePass = currentUser?.karnetyKlubowicza?.[0];
  const userMonths = currentUser?.cyklCiaglosci || 1;

  const getAccentBorder = (accent: string) => {
    switch (accent) {
      case 'amber': return 'border-l-4 border-l-amber-500';
      case 'slate': return 'border-l-4 border-l-slate-400';
      case 'yellow': return 'border-l-4 border-l-amber-400';
      case 'purple': return 'border-l-4 border-l-purple-600';
      default: return 'border-l-4 border-l-amber-500';
    }
  };

  const getUserValForTable = (tabela: any) => {
    if (!isProgramActive) return 0;
    if (tabela.typ_karnetu === 'Umowa 12 miesięcy') {
      return userActivePass?.rata ? parseInt(String(userActivePass.rata).match(/(\d+)/)?.[1] || '1', 10) : userMonths;
    }
    return userMonths;
  };

  // SORTOWANIE TABEL: DLA KLUBOWICZA JEGO KARNET JEST ZAWSZE PIERWSZY NA STRONIE
  const displayedTables = [...bonusTables].sort((a, b) => {
    if (appRole === 'klubowicz') {
      const aIsUserPass = currentUser?.karnetyKlubowicza?.some(
        (k: any) => k.nazwa?.trim().toLowerCase() === a.nazwa?.trim().toLowerCase()
      ) || (userActivePass?.nazwa?.trim().toLowerCase() === a.nazwa?.trim().toLowerCase());

      const bIsUserPass = currentUser?.karnetyKlubowicza?.some(
        (k: any) => k.nazwa?.trim().toLowerCase() === b.nazwa?.trim().toLowerCase()
      ) || (userActivePass?.nazwa?.trim().toLowerCase() === b.nazwa?.trim().toLowerCase());

      if (aIsUserPass && !bIsUserPass) return -1;
      if (!aIsUserPass && bIsUserPass) return 1;
    }
    return (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0);
  });

  return (
    <div className="max-w-[1700px] w-full mx-auto space-y-6 pb-28 px-3 sm:px-6 font-sans antialiased text-slate-800 overflow-x-hidden">
      
      {/* 1. GÓRNY BANER PROGRAMU */}
      {appRole === 'klubowicz' ? (
        /* DLA KLUBOWICZA: TYLKO NAZWA PROGRAMU I STATUS */
        <div className="bg-white border border-sky-200 p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl font-black uppercase tracking-wide text-sky-950 flex items-center gap-2.5">
            <span>🏆</span> PROGRAM BONUSOWY
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Status programu:</span>
            <span className={`text-[11px] font-black px-3.5 py-1 rounded-xl uppercase tracking-wider shadow-sm text-white ${
              isProgramActive ? 'bg-emerald-600' : 'bg-rose-600'
            }`}>
              {isProgramActive ? 'WŁĄCZONY' : 'WYŁĄCZONY'}
            </span>
          </div>
        </div>
      ) : (
        /* DLA ADMINISTRATORA / TRENERA: PRZEŁĄCZNIK STATUSU ORAZ PRZYCISKI AKCJI */
        <div className="bg-white border border-sky-200 p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-black uppercase tracking-wide text-sky-950 flex items-center gap-2.5">
              <span>🏆</span> PROGRAM BONUSOWY I TABELE CIĄGŁOŚCI
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Zarządzaj tabelami ciągłości karnetów, włączaj lub wyłączaj program lojalnościowy i twórz nowe progi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* PRZEŁĄCZNIK ON / OFF DLA ADMINISTRATORA */}
            <div className="flex items-center gap-3 bg-sky-50/80 border border-sky-200 px-4 py-2 rounded-2xl">
              <span className="text-xs font-black text-slate-700 uppercase">
                {isProgramActive ? 'Program Aktywny' : 'Program Wstrzymany'}
              </span>
              <button
                type="button"
                onClick={handleToggleProgramStatus}
                disabled={isSavingStatus}
                className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isProgramActive ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isProgramActive ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <button
              onClick={() => setIsAddTableModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2.5 rounded-2xl text-xs uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
            >
              <span>+</span> DODAJ NOWĄ TABELĘ
            </button>
          </div>
        </div>
      )}

      {/* INFORMACJA O WYŁĄCZONYM PROGRAMIE */}
      {!isProgramActive && (
        <div className="bg-rose-50 border border-rose-200 text-rose-900 px-5 py-3.5 rounded-2xl text-xs font-bold flex items-center gap-3 shadow-sm">
          <span className="text-lg">⚠️</span>
          <span>
            Program bonusowy jest obecnie <strong>wyłączony przez administratora klubu</strong>. Naliczanie ciągłości i odbiór nagród są czasowo wstrzymane.
          </span>
        </div>
      )}

      {/* 2. 4 KAFELKI STATYSTYCZNE - WIDOCZNE TYLKO DLA ADMINISTRATORA / TRENERA */}
      {(appRole === 'admin' || appRole === 'trener') && (
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
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ŚREDNI CYKL CIĄGŁOŚCI</div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">{avgContinuity} MIES.</div>
            </div>
          </div>

          <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-xl shrink-0">
              🛡️
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">LICZBA KARNETÓW</div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">{bonusTables.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. DWA KARNETY NA JEDNEJ WYSOKOŚCI (TABELE ROADMAPY - Z PRIORYTETEM DLA KARNETU KLUBOWICZA) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {displayedTables.map((tabela, tableIndex) => {
          const isUserPass = currentUser?.karnetyKlubowicza?.some(
            (k: any) => k.nazwa?.trim().toLowerCase() === tabela.nazwa?.trim().toLowerCase()
          ) || (userActivePass?.nazwa?.trim().toLowerCase() === tabela.nazwa?.trim().toLowerCase());

          const userVal = getUserValForTable(tabela);

          const maxThreshold = tabela.customTiers && tabela.customTiers.length > 0
            ? Math.max(...tabela.customTiers.map((t: any) => Number(t.threshold) || 1))
            : 12;
          const progressPercent = Math.min(100, Math.max(0, (userVal / maxThreshold) * 100));
          const highlightedTierId = selectedRoadmapTier[tabela.id] || null;

          return (
            <div
              key={tabela.id}
              className={`bg-slate-50/80 border rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 transition-all ${
                isUserPass ? 'border-emerald-500 ring-2 ring-emerald-400/40 bg-emerald-50/15' : 'border-sky-200'
              }`}
            >
              {/* A. WYRAZISTY, KONTRASTOWY NAGŁÓWEK DANEGO KARNETU */}
              <div className="bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md space-y-3 border border-sky-900/60">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  
                  {/* TYP KARNETU ORAZ INFORMACJA O POSIADANYM KARNECIE PRZEZ KLUBOWICZA */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-3 py-1 rounded-lg uppercase tracking-wider shadow-sm">
                      {tabela.typ_karnetu || 'Karnet cykliczny'}
                    </span>
                    {isUserPass && (
                      <span className="bg-emerald-500 text-white font-black text-[10px] px-3 py-1 rounded-lg uppercase tracking-wider shadow-sm flex items-center gap-1.5 border border-emerald-400/40">
                        <span>⭐</span> TWÓJ AKTUALNY KARNET
                      </span>
                    )}
                  </div>

                  {/* PRZYCISKI SORTOWANIA I USUWANIA DLA ADMINA */}
                  {(appRole === 'admin' || appRole === 'trener') && (
                    <div className="flex items-center gap-1">
                      <button
                        disabled={tableIndex === 0}
                        onClick={() => handleMoveTable(tableIndex, 'left')}
                        className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center transition-colors cursor-pointer ${
                          tableIndex === 0
                            ? 'bg-white/10 text-white/30 cursor-not-allowed'
                            : 'bg-white/20 text-white hover:bg-amber-500 hover:text-slate-950'
                        }`}
                        title="Przesuń tabelę w lewo / wyżej"
                      >
                        ←
                      </button>
                      <button
                        disabled={tableIndex === bonusTables.length - 1}
                        onClick={() => handleMoveTable(tableIndex, 'right')}
                        className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center transition-colors cursor-pointer ${
                          tableIndex === bonusTables.length - 1
                            ? 'bg-white/10 text-white/30 cursor-not-allowed'
                            : 'bg-white/20 text-white hover:bg-amber-500 hover:text-slate-950'
                        }`}
                        title="Przesuń tabelę w prawo / niżej"
                      >
                        →
                      </button>
                      <button
                        onClick={() => handleDeleteTable(tabela.id, tabela.nazwa)}
                        className="w-7 h-7 rounded-lg bg-white/10 text-rose-300 hover:bg-rose-600 hover:text-white text-xs flex items-center justify-center cursor-pointer transition-colors ml-1"
                        title="Usuń tę tabelę"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-white/10">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                      {tabela.nazwa}
                    </h2>
                    <div className="text-xs text-sky-200 font-bold mt-0.5">
                      Cena bazowa: <strong className="text-amber-300">{Number(tabela.cena || 0).toFixed(2)} PLN</strong>
                    </div>
                  </div>

                  {(appRole === 'admin' || appRole === 'trener') && (
                    <button
                      onClick={() => handleOpenAddTierModal(tabela.id)}
                      className="bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-black px-3.5 py-2 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm shrink-0 self-start sm:self-auto"
                    >
                      <span>+</span> DODAJ PRÓG
                    </button>
                  )}
                </div>
              </div>

              {/* B. LINIA ROADMAPY (PASEK POSTĘPU) */}
              <div className="bg-white border border-sky-200 rounded-2xl p-3.5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-black text-sky-950 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🗺️</span> ROADMAPA CIĄGŁOŚCI
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    Twój staż: <strong className="text-slate-900">{userVal} {tabela.customTiers?.[0]?.unit || 'mies.'}</strong>
                  </span>
                </div>

                <div className="relative pt-4 pb-2 px-3">
                  <div className="absolute top-1/2 left-0 right-0 h-1.5 bg-slate-100 rounded-full -translate-y-1/2" />
                  <div
                    className="absolute top-1/2 left-0 h-1.5 bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full -translate-y-1/2 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />

                  <div className="relative flex justify-between items-center z-10">
                    {tabela.customTiers?.map((tier: any) => {
                      const isReached = isProgramActive && userVal >= Number(tier.threshold);
                      const isSelected = highlightedTierId === tier.id;

                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => setSelectedRoadmapTier(prev => ({
                            ...prev,
                            [tabela.id]: prev[tabela.id] === tier.id ? null : tier.id
                          }))}
                          className="group flex flex-col items-center cursor-pointer focus:outline-none"
                          title={`Kliknij, aby podświetlić próg: ${tier.levelName}`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all shadow-sm ${
                              isReached
                                ? 'bg-emerald-500 text-white ring-3 ring-emerald-100'
                                : 'bg-white text-slate-500 border-2 border-slate-300 group-hover:border-amber-400'
                            } ${isSelected ? 'ring-3 ring-amber-400 scale-110' : ''}`}
                          >
                            {isReached ? '✓' : tier.threshold}
                          </div>
                          <span className={`text-[8px] font-black uppercase mt-1 tracking-tight ${
                            isReached ? 'text-emerald-900 font-extrabold' : 'text-slate-400'
                          } ${isSelected ? 'text-amber-900 underline' : ''}`}>
                            {tier.levelName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-sky-50/50 rounded-xl px-3 py-1.5 text-[10px] text-slate-600 font-medium flex items-center justify-between border border-sky-100">
                  <span>Kliknij punkt na osi, aby wyfiltrować próg</span>
                  <span className="font-bold text-sky-950">{Math.round(progressPercent)}% zaliczone</span>
                </div>
              </div>

              {/* C. KOMPAKTOWE POZIOMY NAGRÓD */}
              <div className="space-y-2.5">
                {tabela.customTiers?.map((tier: any) => {
                  const isUnlocked = isProgramActive && isUserPass && userVal >= Number(tier.threshold);
                  const isHighlighted = highlightedTierId === tier.id;

                  return (
                    <div
                      key={tier.id}
                      className={`bg-white border rounded-2xl p-3.5 shadow-sm space-y-2 relative transition-all hover:shadow-md ${
                        isHighlighted ? 'border-amber-500 ring-2 ring-amber-300' : 'border-sky-200'
                      } ${getAccentBorder(tier.accent)}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="border border-amber-300 text-amber-900 bg-amber-50 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                            {tier.levelName}
                          </span>
                          <span className="text-xs font-black text-slate-900">
                            {tier.threshold} {tier.unit}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            isUnlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {appRole === 'klubowicz' ? (isUnlocked ? 'ODBLOKOWANY ✓' : 'W TRAKCIE') : 'AKTYWNY'}
                          </span>

                          {(appRole === 'admin' || appRole === 'trener') && (
                            <div className="flex items-center gap-1 ml-1">
                              <button
                                onClick={() => handleOpenEditTierModal(tabela.id, tier)}
                                className="text-slate-400 hover:text-amber-800 text-xs p-1 cursor-pointer transition-colors"
                                title="Edytuj próg"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteTier(tabela.id, tier.id)}
                                className="text-slate-400 hover:text-rose-600 text-xs p-1 cursor-pointer transition-colors"
                                title="Usuń próg"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Nagroda główna */}
                      <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-[10px]">🎁</span>
                          <span className="font-bold text-slate-800 text-[11px] truncate">{tier.rewardTitle}</span>
                        </div>
                        {tier.rewardBadge && (
                          <span className="bg-amber-200 text-amber-950 text-[9px] font-black px-1.5 py-0.5 rounded shrink-0">
                            {tier.rewardBadge}
                          </span>
                        )}
                      </div>

                      {/* Bonus dodatkowy */}
                      {tier.secondaryTitle && (
                        <div className="bg-sky-50/80 border border-sky-200/80 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-[10px]">👋</span>
                            <span className="font-semibold text-slate-700 text-[11px] truncate">{tier.secondaryTitle}</span>
                          </div>
                          {tier.secondaryBadge && (
                            <span className="bg-sky-200 text-sky-950 text-[9px] font-black px-1.5 py-0.5 rounded shrink-0">
                              {tier.secondaryBadge}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(!tabela.customTiers || tabela.customTiers.length === 0) && (
                  <div className="text-center py-6 text-xs text-slate-400 font-medium italic bg-white rounded-2xl border border-dashed border-sky-200">
                    Brak zdefiniowanych progów w tej tabeli.
                  </div>
                )}
              </div>

              {/* PRZYCISK ZAPISU DO SUPABASE DLA ADMINA */}
              {(appRole === 'admin' || appRole === 'trener') && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveTableToSupabase(tabela.id)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2.5 rounded-2xl text-[11px] uppercase tracking-wider cursor-pointer shadow-sm transition-all text-center"
                >
                  💾 Zapisz konfigurację tabeli: {tabela.nazwa}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. WARUNKI KWALIFIKACJI (UMIESZCZONE POD TABELAMI ROADMAPY, BEZ PRZEWIJANIA W BOK) */}
      <div className="bg-white border border-sky-200 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
        <div className="border-b border-sky-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-sky-950 uppercase tracking-wide flex items-center gap-2">
              <span>🛡️</span> Warunki kwalifikacji i zasady ciągłości
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Zasady kwalifikacji do progów lojalnościowych w klubie Forma Marzeń.
            </p>
          </div>
          {appRole === 'admin' && (
            <div className="text-[11px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl self-start sm:self-auto">
              ✍️ Kliknij „Edytuj treść”, aby zmodyfikować zasady
            </div>
          )}
        </div>

        {/* UKŁAD PIONOWY NA TELEFONIE, 3 KOLUMNY NA EKRANIE KOMPUTERA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {qualificationRules.map((rule) => (
            <div key={rule.id} className="bg-sky-50/60 border border-sky-200 rounded-2xl p-5 space-y-3 relative flex flex-col justify-between">
              <div className="space-y-2">
                <span className="bg-sky-200 text-sky-950 font-black text-[10px] px-2.5 py-1 rounded-md uppercase inline-block">
                  {rule.badge}
                </span>
                <h4 className="font-black text-slate-900 text-sm">{rule.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {rule.desc}
                </p>
              </div>

              {appRole === 'admin' && (
                <div className="pt-3 border-t border-sky-100 flex justify-end">
                  <button
                    onClick={() => handleOpenEditRuleModal(rule)}
                    className="bg-white hover:bg-sky-100 border border-sky-300 text-sky-950 font-bold text-xs px-3 py-1.5 rounded-xl cursor-pointer shadow-sm transition-colors"
                  >
                    ✏️ Edytuj treść
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 5. REJESTR KLUBOWICZÓW (WIDOCZNY TYLKO DLA ADMINISTRATORA I TRENERA NA SAMYM DOLE) */}
      {(appRole === 'admin' || appRole === 'trener') && (
        <div className="bg-white border border-sky-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-sky-100">
            <h3 className="text-sm font-black text-sky-950 uppercase tracking-wider">
              👥 Rejestr ciągłości i statusów klubowiczów
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Podgląd stażu oraz osiągniętych progów klubowiczów z bazy danych Supabase.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sky-50/70 border-b border-sky-200 text-[11px] font-black text-sky-950 uppercase tracking-wider">
                  <th className="py-4 px-6">Klubowicz</th>
                  <th className="py-4 px-6">E-mail</th>
                  <th className="py-4 px-6">Cykl ciągłości</th>
                  <th className="py-4 px-6">Aktywny karnet</th>
                  <th className="py-4 px-6 text-center">Osiągnięty poziom</th>
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

      {/* MODAL 1: EDYCJA WARUNKU KWALIFIKACJI (ADMIN) */}
      {isEditRuleModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-sky-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">
                🛡️ Edytuj treść warunku
              </h3>
              <button onClick={() => setIsEditRuleModalOpen(false)} className="text-slate-400 font-bold text-base cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveRuleModal} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Etykieta (Plakietka)</label>
                <input
                  type="text"
                  required
                  value={ruleBadge}
                  onChange={(e) => setRuleBadge(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Tytuł zasady</label>
                <input
                  type="text"
                  required
                  value={ruleTitle}
                  onChange={(e) => setRuleTitle(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Opis szczegółowy</label>
                <textarea
                  rows={4}
                  required
                  value={ruleDesc}
                  onChange={(e) => setRuleDesc(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 font-medium text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-sky-100">
                <button
                  type="button"
                  onClick={() => setIsEditRuleModalOpen(false)}
                  className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 text-white font-black px-5 py-2 rounded-xl uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Zapisz zmiany
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DODAWANIE NOWEJ TABELI (ADMIN) */}
      {isAddTableModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-sky-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">
                ➕ Dodaj nową tabelę karnetu
              </h3>
              <button onClick={() => setIsAddTableModalOpen(false)} className="text-slate-400 font-bold text-base cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddNewTable} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nazwa tabeli / karnetu</label>
                <input
                  type="text"
                  required
                  placeholder="np. Karnet OPEN Poranny"
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

              <div className="flex justify-end gap-2 pt-2 border-t border-sky-100">
                <button
                  type="button"
                  onClick={() => setIsAddTableModalOpen(false)}
                  className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-slate-900 text-white font-black px-5 py-2 rounded-xl uppercase tracking-wider cursor-pointer shadow-md"
                >
                  {isSaving ? 'Tworzenie...' : 'Utwórz tabelę'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DODAWANIE / EDYCJA PROGU (ADMIN) */}
      {isTierModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-sky-200 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">
                🏆 {editingTierId ? 'Edytuj próg lojalnościowy' : 'Dodaj nowy próg'}
              </h3>
              <button onClick={() => setIsTierModalOpen(false)} className="text-slate-400 font-bold text-base cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveTierModal} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nazwa poziomu</label>
                  <input
                    type="text"
                    required
                    value={levelName}
                    onChange={(e) => setLevelName(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Kolor akcentu</label>
                  <select
                    value={accentColor}
                    onChange={(e: any) => setAccentColor(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="amber">Brąz / Bursztyn</option>
                    <option value="slate">Srebro / Szary</option>
                    <option value="yellow">Złoto / Żółty</option>
                    <option value="purple">VIP / Fiolet</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Wartość ciągłości</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={thresholdVal}
                    onChange={(e) => setThresholdVal(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Jednostka</label>
                  <select
                    value={thresholdUnit}
                    onChange={(e: any) => setThresholdUnit(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="miesięcy">miesięcy</option>
                    <option value="cykli">cykli</option>
                    <option value="wejść">wejść</option>
                  </select>
                </div>
              </div>

              {/* Nagroda klubowicza */}
              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                <h4 className="font-black text-amber-950 uppercase text-[10px]">🎁 Nagroda klubowicza</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <input
                      type="text"
                      required
                      placeholder="Opis nagrody"
                      value={rewardTitle}
                      onChange={(e) => setRewardTitle(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 font-semibold text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="-10%"
                      value={rewardBadge}
                      onChange={(e) => setRewardBadge(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl px-3 py-1.5 font-black text-slate-900 text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Dodatkowy bonus */}
              <div className="bg-sky-50/70 p-3.5 rounded-2xl border border-sky-200 space-y-2">
                <h4 className="font-black text-sky-950 uppercase text-[10px]">👋 Bonus dodatkowy</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <input
                      type="text"
                      placeholder="Opis bonusu"
                      value={secondaryTitle}
                      onChange={(e) => setSecondaryTitle(e.target.value)}
                      className="w-full bg-white border border-sky-300 rounded-xl px-3 py-1.5 font-semibold text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="GRATIS"
                      value={secondaryBadge}
                      onChange={(e) => setSecondaryBadge(e.target.value)}
                      className="w-full bg-white border border-sky-300 rounded-xl px-3 py-1.5 font-black text-slate-900 text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-sky-100">
                <button
                  type="button"
                  onClick={() => setIsTierModalOpen(false)}
                  className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 text-white font-black px-5 py-2 rounded-xl uppercase tracking-wider cursor-pointer shadow-md"
                >
                  {editingTierId ? 'Zaktualizuj' : 'Dodaj'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
