"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Bezpieczny parser JSON
const safeJsonParse = (val: any, fallback: any = []) => {
  if (!val) return fallback;
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return parsed !== null ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }
  return fallback;
};

// Normalizacja tekstu do porównań
const cleanStr = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/[ę]/g, 'e')
    .replace(/[ą]/g, 'a')
    .replace(/[ó]/g, 'o')
    .replace(/[ś]/g, 's')
    .replace(/[ł]/g, 'l')
    .replace(/[żź]/g, 'z')
    .replace(/[ć]/g, 'c')
    .replace(/[ń]/g, 'n')
    .replace(/[\u2010-\u2015\u2212\-_/.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Rozpoznawanie umów 12M
const isContractPassCheck = (item: any): boolean => {
  if (!item) return false;
  if (item?.isContract12M === true || item?.isContract12M === 'true') return true;
  const typ = cleanStr(item?.typ_karnetu || item?.typKarnetu || item?.typ || '');
  const nazwa = cleanStr(item?.nazwa || item?.pass || '');
  const rata = String(item?.rata || '');
  return typ.includes('umow') || typ.includes('12') || nazwa.includes('umow') || nazwa.includes('12m') || rata.includes('/ 12') || rata.includes('/12');
};

// Ścisłe, bezbłędne parowanie karnetu klubowicza z tabelą bonusową
const isPassMatchingTable = (pass: any, tabela: any): boolean => {
  if (!pass || !tabela) return false;

  const pName = cleanStr(pass.nazwa || pass.pass || '');
  const tName = cleanStr(tabela.nazwa || '');

  // 1. Dokładne dopasowanie nazwy
  if (pName === tName) return true;

  // 2. Umowa pasuje TYLKO do tabeli umowy
  const pIsContract = pName.includes('umow') || isContractPassCheck(pass);
  const tIsContract = tName.includes('umow') || isContractPassCheck(tabela);
  if (pIsContract !== tIsContract) return false;

  // 3. Karnet 6-miesięczny pasuje TYLKO do tabeli 6-miesięcznej
  const pIs6M = pName.includes('6 m') || pName.includes('6m') || pName.includes('pol roku') || pName.includes('pół roku');
  const tIs6M = tName.includes('6 m') || tName.includes('6m') || tName.includes('pol roku') || tName.includes('pół roku');
  if (pIs6M !== tIs6M) return false;

  // 4. Dopasowanie tematyczne
  const pIsOpen = pName.includes('open');
  const tIsOpen = tName.includes('open');
  if (pIsOpen && tIsOpen) return true;

  const pIsOgolno = pName.includes('ogolno') || pName.includes('rozciag');
  const tIsOgolno = tName.includes('ogolno') || tName.includes('rozciag');
  if (pIsOgolno && tIsOgolno) return true;

  return false;
};

// Precyzyjny odczyt liczby rat z obiektu karnetu
const getInstallmentsFromPass = (pass: any): number => {
  if (!pass) return 0;

  if (pass.rata !== undefined && pass.rata !== null) {
    const raw = String(pass.rata).trim();
    const slashMatch = raw.match(/(\d+)\s*\/\s*(\d+)/);
    if (slashMatch && parseInt(slashMatch[1], 10) > 0) {
      return parseInt(slashMatch[1], 10);
    }
    const singleMatch = raw.match(/(\d+)/);
    if (singleMatch && parseInt(singleMatch[1], 10) > 0) {
      return parseInt(singleMatch[1], 10);
    }
  }

  if (pass.statusTekst) {
    const m = String(pass.statusTekst).match(/rata\s*(\d+)/i) || String(pass.statusTekst).match(/(\d+)\s*\/\s*12/);
    if (m && parseInt(m[1], 10) > 0) {
      return parseInt(m[1], 10);
    }
  }

  const altKeys = ['oplaconeRaty', 'oplacone_raty', 'raty', 'ratyOplacone', 'numerRaty', 'liczbaRat'];
  for (const k of altKeys) {
    if (pass[k] !== undefined && pass[k] !== null) {
      const val = parseInt(String(pass[k]), 10);
      if (!isNaN(val) && val > 0) return val;
    }
  }

  return 0;
};

// Wyliczanie rzeczywistej ciągłości ogólnej
const getClientEffectiveContinuity = (client: any): number => {
  if (!client) return 1;
  const passes = safeJsonParse(client.karnetyKlubowicza || client.KarnetyKlubowicza || client.karnetyklubowicza, []);
  let maxInstallments = 0;

  passes.forEach((p: any) => {
    if (isContractPassCheck(p)) {
      const inst = getInstallmentsFromPass(p);
      if (inst > maxInstallments) maxInstallments = inst;
    }
  });

  const rawContinuity = parseInt(String(client.cyklCiaglosci || client.cyklciaglosci || '1'), 10) || 1;
  return Math.max(rawContinuity, maxInstallments, 1);
};

export default function TwojBonusPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [appRole, setAppRole] = useState<'admin' | 'trener' | 'klubowicz'>('klubowicz');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [allKlienci, setAllKlienci] = useState<any[]>([]);

  // Wyszukiwanie podopiecznego przez administratora
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [inspectedClient, setInspectedClient] = useState<any>(null);

  // Zweryfikowani klubowicze przez administratora
  const [verifiedMemberTiers, setVerifiedMemberTiers] = useState<string[]>([]);

  // Główny status programu
  const [isProgramActive, setIsProgramActive] = useState<boolean>(true);
  const [isSavingStatus, setIsSavingStatus] = useState<boolean>(false);

  // Tabele bonusowe
  const [bonusTables, setBonusTables] = useState<any[]>([]);
  const [selectedRoadmapTier, setSelectedRoadmapTier] = useState<Record<string | number, number | null>>({});
  const [isRulesExpanded, setIsRulesExpanded] = useState<boolean>(false);

  // Warunki kwalifikacji
  const [qualificationRules, setQualificationRules] = useState<any[]>([
    {
      id: 'umowa',
      badge: 'Karnety Cykliczne (Umowa)',
      title: 'Rozliczenie ratalne i kontynuacja (13, 14, 15...)',
      desc: 'Klubowicz zdobywa kolejne poziomy z każdą opłaconą ratą. Przedłużenie umowy po 12 miesiącach kontynuuje naliczanie jako miesiąc 13, 14 itd.'
    },
    {
      id: 'open',
      badge: 'Karnety OPEN (Na czas)',
      title: 'Ciągłość odnowień (np. 6M + 6M = 7, 8, 9...)',
      desc: 'Regularne odnawianie karnetu buduje staż ciągłości. Po karnecie półrocznym kolejny karnet kontynuuje licznik jako 7, 8, 9 miesiąc.'
    },
    {
      id: 'wejscia',
      badge: 'Karnety Ogólnorozwojowe',
      title: 'Pula odbytych treningów',
      desc: 'Poziomy są naliczane na podstawie liczby faktycznie zrealizowanych wejść z aktualnie aktywnego karnetu.'
    }
  ]);
  const [isEditRuleModalOpen, setIsEditRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string>('');
  const [ruleBadge, setRuleBadge] = useState('');
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');

  // Modale tabel
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [isEditTableModalOpen, setIsEditTableModalOpen] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | number>('');
  const [tableNameInput, setTableNameInput] = useState('');
  const [tableTypeInput, setTableTypeInput] = useState('Umowa 12 miesięcy');
  const [tablePriceInput, setTablePriceInput] = useState('199.00');

  // Modale progów
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

  // Szablony progów
  const defaultTiersUmowa = [
    { id: 101, levelName: 'BRĄZOWY', threshold: 2, unit: 'miesięcy', accent: 'amber', rewardTitle: 'Niezmienna cena na przedłużenie umowy w kolejnym okresie', rewardBadge: 'GRATIS', secondaryTitle: '10% zniżki na barze i suplementy', secondaryBadge: '-10%', active: true },
    { id: 102, levelName: 'ZŁOTY', threshold: 6, unit: 'miesięcy', accent: 'yellow', rewardTitle: '+14 dni bezpłatnego zamrożenia do puli karnetu', rewardBadge: '+14 DNI', secondaryTitle: 'Darmowa analiza składu ciała InBody', secondaryBadge: 'GRATIS', active: true },
    { id: 103, levelName: 'TRZYNASTY', threshold: 13, unit: 'miesięcy', accent: 'purple', rewardTitle: 'Darmowy miesiąc bonusowy po przedłużeniu umowy', rewardBadge: '-100%', secondaryTitle: 'Limitowana koszulka klubowa Forma Marzeń', secondaryBadge: 'PREZENT', active: true },
    { id: 104, levelName: 'OSIEMNASTY', threshold: 18, unit: 'miesięcy', accent: 'purple', rewardTitle: 'Trening personalny 1:1 z wybranym trenerem', rewardBadge: 'VIP', secondaryTitle: 'Stały status Ambasadora Klubu', secondaryBadge: 'VIP', active: true }
  ];

  const defaultTiersOpen = [
    { id: 201, levelName: 'BRĄZOWY', threshold: 2, unit: 'cykle', accent: 'amber', rewardTitle: 'Jednorazowa wejściówka dla osoby towarzyszącej gratis.', rewardBadge: 'GRATIS', secondaryTitle: '5% stałego rabatu na odnowienie karnetu.', secondaryBadge: '-5%', active: true },
    { id: 202, levelName: 'SREBRNY', threshold: 4, unit: 'cykle', accent: 'slate', rewardTitle: '20 PLN doładowania do portfela klubowego.', rewardBadge: '+20 PLN', secondaryTitle: '10% rabatu na akcesoria treningowe.', secondaryBadge: '-10%', active: true },
    { id: 203, levelName: 'ZŁOTY', threshold: 6, unit: 'cykli', accent: 'yellow', rewardTitle: '15% zniżki na kolejny karnet OPEN.', rewardBadge: '-15%', secondaryTitle: 'Konsultacja dietetyczno-treningowa gratis.', secondaryBadge: 'GRATIS', active: true }
  ];

  // Pobieranie danych z Supabase
  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;

      const [
        trenerzyResponse,
        rulesResponse,
        katalogResponse,
        klienciResponse,
        transakcjeResponse
      ] = await Promise.all([
        supabase.from('trenerzy').select('*'),
        supabase.from('club_booking_rules').select('*').limit(1).maybeSingle(),
        supabase.from('katalog_karnetow').select('*').order('kolejnosc', { ascending: true }).order('id', { ascending: true }),
        supabase.from('klienci').select('*').order('id', { ascending: false }).range(0, 4999),
        supabase.from('transakcje').select('id, klient_id, typ_operacji, opis, created_at').order('id', { ascending: false }).range(0, 4999)
      ]);

      const trenerzyData = trenerzyResponse.data;
      if (userEmail === 'maciejklaput@gmail.com') {
        setAppRole('admin');
      } else {
        const trenerObj = trenerzyData?.find((t: any) => t.email === userEmail);
        if (trenerObj) setAppRole('trener');
        else setAppRole('klubowicz');
      }

      const rulesData = rulesResponse.data;
      if (rulesData) {
        if (rulesData.bonus_program_active !== undefined) setIsProgramActive(rulesData.bonus_program_active);
        if (rulesData.bonus_qualification_rules) {
          try {
            const parsedRules = typeof rulesData.bonus_qualification_rules === 'string'
              ? JSON.parse(rulesData.bonus_qualification_rules)
              : rulesData.bonus_qualification_rules;
            if (Array.isArray(parsedRules) && parsedRules.length > 0) setQualificationRules(parsedRules);
          } catch (e) {}
        }
      }

      let karnetyData = katalogResponse.data;
      if (!karnetyData || karnetyData.length === 0) {
        const fallback = await supabase.from('karnety').select('*').order('id', { ascending: true });
        karnetyData = fallback.data;
      }

      if (karnetyData && karnetyData.length > 0) {
        const parsed = karnetyData.map((k: any, index: number) => {
          let meta: any = {};
          try { meta = JSON.parse(k.inne_ustawienia || '{}'); } catch (e) {}

          const isContract = isContractPassCheck(k);

          return {
            id: k.id,
            nazwa: k.nazwa,
            typ_karnetu: k.typ_karnetu || (isContract ? 'Umowa 12 miesięcy' : 'Na czas'),
            cena: k.cena_brutto || k.cena || 0,
            kolejnosc: k.kolejnosc !== null && k.kolejnosc !== undefined ? k.kolejnosc : index,
            inne_ustawienia: meta,
            customTiers: meta.customTiers && meta.customTiers.length > 0 ? meta.customTiers : (isContract ? defaultTiersUmowa : defaultTiersOpen)
          };
        });

        parsed.sort((a: any, b: any) => (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0));
        setBonusTables(parsed);
        if (parsed[0]) setTargetTableId(parsed[0].id);
      } else {
        setBonusTables([
          { id: 1, nazwa: 'OPEN - UMOWA 12 MIESIĘCY', typ_karnetu: 'Umowa 12 miesięcy', cena: 289, kolejnosc: 0, customTiers: defaultTiersUmowa },
          { id: 2, nazwa: 'OPEN', typ_karnetu: 'Na czas', cena: 319, kolejnosc: 1, customTiers: defaultTiersOpen }
        ]);
      }

      const transakcjeData = transakcjeResponse.data || [];
      const txMap = new Map<number, any[]>();
      transakcjeData.forEach((tx: any) => {
        if (!txMap.has(tx.klient_id)) txMap.set(tx.klient_id, []);
        txMap.get(tx.klient_id)?.push(tx);
      });

      const klienciData = klienciResponse.data;
      if (klienciData) {
        const mapped = klienciData.map((c: any) => {
          const rawKarnety = c.karnetyKlubowicza || c.KarnetyKlubowicza || c.karnetyklubowicza;
          const parsedKarnety = safeJsonParse(rawKarnety, []);
          const effectiveCont = getClientEffectiveContinuity({ ...c, karnetyKlubowicza: parsedKarnety });
          const rawCont = parseInt(String(c.cyklCiaglosci || c.cyklciaglosci || '1'), 10) || 1;

          if (effectiveCont > rawCont) {
            supabase.from('klienci').update({ cyklCiaglosci: effectiveCont }).eq('id', c.id).then();
          }

          return {
            ...c,
            firstName: c.Imię || c.firstName || '',
            lastName: c.Nazwisko || c.lastName || '',
            email: c['E-mail'] || c.email || '',
            karnetyKlubowicza: parsedKarnety,
            cyklCiaglosci: effectiveCont,
            transactions: txMap.get(c.id) || []
          };
        });
        setAllKlienci(mapped);
        if (userEmail) {
          const myUser = mapped.find((u: any) => u.email === userEmail);
          if (myUser) setCurrentUser(myUser);
        }
      }
    } catch (err) {
      console.error("Błąd ładowania danych w TwojBonus:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, []);

  const handleToggleProgramStatus = async () => {
    const nextStatus = !isProgramActive;
    setIsProgramActive(nextStatus);
    setIsSavingStatus(true);
    try {
      const { data: existingRule } = await supabase.from('club_booking_rules').select('id').limit(1).maybeSingle();
      if (existingRule) {
        await supabase.from('club_booking_rules').update({ bonus_program_active: nextStatus }).eq('id', existingRule.id);
      }
    } catch (e) {} finally {
      setIsSavingStatus(false);
    }
  };

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
      await Promise.all(updatedWithOrder.map((t) => supabase.from('katalog_karnetow').update({ kolejnosc: t.kolejnosc }).eq('id', t.id)));
    } catch (err) {}
  };

  const handleAddNewTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNameInput.trim()) return;

    const isContract = isContractPassCheck({ nazwa: tableNameInput, typ_karnetu: tableTypeInput });
    const defaultNewTiers = isContract ? defaultTiersUmowa : defaultTiersOpen;

    const newTableObj = {
      id: Date.now(),
      nazwa: tableNameInput.trim(),
      typ_karnetu: tableTypeInput,
      cena: parseFloat(tablePriceInput) || 0,
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
        dlugosc: tableTypeInput === 'Umowa 12 miesięcy' ? '12 miesięcy' : '1 miesiąc',
        inne_ustawienia: JSON.stringify({ customTiers: defaultNewTiers })
      };
      const { data: inserted, error } = await supabase.from('katalog_karnetow').insert([payload]).select().single();
      if (!error && inserted) newTableObj.id = inserted.id;
    } catch (err) {} finally {
      setBonusTables(prev => [...prev, newTableObj]);
      setIsAddTableModalOpen(false);
      setTableNameInput('');
      setIsSaving(false);
    }
  };

  const handleOpenEditTableModal = (tabela: any) => {
    setEditingTableId(tabela.id);
    setTableNameInput(tabela.nazwa || '');
    setTableTypeInput(tabela.typ_karnetu || 'Umowa 12 miesięcy');
    setTablePriceInput(String(tabela.cena || '199.00'));
    setIsEditTableModalOpen(true);
  };

  const handleSaveEditTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNameInput.trim() || !editingTableId) return;
    setIsSaving(true);
    const updatedName = tableNameInput.trim();
    const updatedPrice = parseFloat(tablePriceInput) || 0;

    setBonusTables(prev => prev.map(t => {
      if (String(t.id) === String(editingTableId)) return { ...t, nazwa: updatedName, typ_karnetu: tableTypeInput, cena: updatedPrice };
      return t;
    }));

    try {
      await supabase.from('katalog_karnetow').update({ nazwa: updatedName, typ_karnetu: tableTypeInput, cena_brutto: updatedPrice }).eq('id', editingTableId);
    } catch (err) {} finally {
      setIsEditTableModalOpen(false);
      setIsSaving(false);
    }
  };

  const handleDeleteTable = async (tableId: string | number, tableName: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć całą tabelę bonusową dla: "${tableName}"?`)) return;
    try {
      await supabase.from('katalog_karnetow').delete().eq('id', tableId);
      await supabase.from('karnety').delete().eq('id', tableId);
    } catch (err) {}
    setBonusTables(prev => prev.filter(t => String(t.id) !== String(tableId)));
  };

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
              return { ...t, levelName: levelName.toUpperCase(), threshold: Number(thresholdVal), unit: thresholdUnit, rewardTitle: rewardTitle.trim(), rewardBadge: rewardBadge.trim(), secondaryTitle: secondaryTitle.trim(), secondaryBadge: secondaryBadge.trim(), accent: accentColor };
            }
            return t;
          });
        } else {
          updatedTiers.push({ id: Date.now(), levelName: levelName.toUpperCase(), threshold: Number(thresholdVal), unit: thresholdUnit, rewardTitle: rewardTitle.trim(), rewardBadge: rewardBadge.trim(), secondaryTitle: secondaryTitle.trim(), secondaryBadge: secondaryBadge.trim(), accent: accentColor, active: true });
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
      if (String(tbl.id) === String(tableId)) return { ...tbl, customTiers: tbl.customTiers.filter((t: any) => t.id !== tierId) };
      return tbl;
    }));
  };

  const handleSaveTableToSupabase = async (tableId: string | number) => {
    const tableObj = bonusTables.find(t => String(t.id) === String(tableId));
    if (!tableObj) return;
    setIsSaving(true);
    try {
      const meta = { ...(tableObj.inne_ustawienia || {}), customTiers: tableObj.customTiers };
      const res1 = await supabase.from('katalog_karnetow').update({ inne_ustawienia: JSON.stringify(meta), kolejnosc: tableObj.kolejnosc }).eq('id', tableId);
      if (res1.error) await supabase.from('karnety').update({ inne_ustawienia: JSON.stringify(meta) }).eq('id', tableId);
      alert(`Pomyślnie zapisano konfigurację tabeli w bazie!`);
    } catch (error: any) {
      alert("Zapisano lokalnie.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenEditRuleModal = (rule: any) => {
    setEditingRuleId(rule.id);
    setRuleBadge(rule.badge);
    setRuleTitle(rule.title);
    setRuleDesc(rule.desc);
    setIsEditRuleModalOpen(true);
  };

  const handleSaveRuleModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = qualificationRules.map(r => r.id === editingRuleId ? { ...r, badge: ruleBadge, title: ruleTitle, desc: ruleDesc } : r);
    setQualificationRules(updated);
    setIsEditRuleModalOpen(false);
    try {
      const { data: existingRule } = await supabase.from('club_booking_rules').select('id').limit(1).maybeSingle();
      if (existingRule) await supabase.from('club_booking_rules').update({ bonus_qualification_rules: JSON.stringify(updated) }).eq('id', existingRule.id);
    } catch (e) {}
  };

  // OBLICZANIE POSTĘPU
  const calculateMemberProgress = (tabela: any, targetUser: any) => {
    const user = targetUser || inspectedClient || currentUser;
    if (!isProgramActive || !user) return { value: 0, isReset: false, reason: '' };

    const passes = safeJsonParse(user.karnetyKlubowicza || user.KarnetyKlubowicza || user.karnetyklubowicza, []);
    const userPass = passes.find((k: any) => isPassMatchingTable(k, tabela));

    if (!userPass) {
      return { value: 0, isReset: false, reason: '' };
    }

    if (userPass.isPassChangedReset || userPass.changedPassReset) {
      return { value: 0, isReset: true, reason: 'Zmiana karnetu na nowy – naliczanie od początku' };
    }

    const isContract = isContractPassCheck(tabela) || isContractPassCheck(userPass);

    // 1. DLA UMÓW 12M: Liczba rat z pola rata (np. "9 / 12" -> 9)
    if (isContract) {
      const installmentsCount = getInstallmentsFromPass(userPass);
      const effectiveContinuity = getClientEffectiveContinuity(user);
      const finalMonths = Math.max(installmentsCount, effectiveContinuity, 1);
      return { value: finalMonths, isReset: false, reason: '' };
    }

    // 2. DLA KARNETÓW NA WEJŚCIA
    const pName = cleanStr(userPass.nazwa || '');
    const tName = cleanStr(tabela.nazwa || '');
    const isEntries = pName.includes('wejs') || tName.includes('wejs') || tName.includes('ilosc');
    if (isEntries) {
      const pocz = parseInt(userPass.poczatkoweWejsc || userPass.ilosc_wejsc || '10', 10);
      const poz = parseInt(userPass.pozostaloWejsc ?? pocz, 10);
      return { value: Math.max(0, pocz - poz), isReset: false, reason: '' };
    }

    // 3. DLA KARNETÓW CZASOWYCH (OPEN / 6M)
    const continuity = getClientEffectiveContinuity(user);
    return { value: continuity, isReset: false, reason: '' };
  };

  // Wyliczanie daty odblokowania danego progu
  const getTierUnlockDate = (tier: any, tabela: any, user: any): string | null => {
    if (!user) return null;
    const passes = safeJsonParse(user.karnetyKlubowicza || user.KarnetyKlubowicza || user.karnetyklubowicza, []);
    const userPass = passes.find((k: any) => isPassMatchingTable(k, tabela));
    if (!userPass) return null;

    const progress = calculateMemberProgress(tabela, user);
    const thresh = Number(tier.threshold);
    if (progress.value < thresh) return null;

    // 1. Sprawdzenie czy w transakcjach jest zapis raty odpowiadającej progowi
    const userTx: any[] = user.transactions || [];
    const isContract = isContractPassCheck(tabela) || isContractPassCheck(userPass);

    if (isContract) {
      const matchingTx = userTx.find((t: any) => {
        const desc = String(t.opis || '').toLowerCase();
        return (desc.includes(`rata ${thresh}`) || desc.includes(`rata: ${thresh}`) || desc.includes(`${thresh} / 12`)) && !desc.includes('usunięcie');
      });
      if (matchingTx?.created_at) {
        return new Date(matchingTx.created_at).toLocaleDateString('pl-PL');
      }

      // Wyliczenie osi czasu umowy: od waznyDo odejmujemy różnicę miesięcy
      let baseDate = userPass.waznyDo ? new Date(userPass.waznyDo) : new Date();
      if (isNaN(baseDate.getTime())) baseDate = new Date();
      const monthsDiff = Math.max(0, progress.value - thresh);
      const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() - monthsDiff, Math.min(baseDate.getDate(), 28));
      return targetDate.toLocaleDateString('pl-PL');
    } else {
      // Dla karnetów cyklicznych (OPEN / 6M)
      const cycleTx = userTx.filter((t: any) => {
        const desc = String(t.opis || '').toLowerCase();
        const typ = String(t.typ_operacji || '').toLowerCase();
        return (typ.includes('karnet') || desc.includes('karnet') || desc.includes('przedłużenie')) && !desc.includes('usunięcie');
      });

      if (cycleTx.length >= thresh) {
        cycleTx.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const targetTx = cycleTx[thresh - 1];
        if (targetTx?.created_at) return new Date(targetTx.created_at).toLocaleDateString('pl-PL');
      }

      const regDateStr = user.registered || user.Zarejestrowany || user.activated;
      if (regDateStr) {
        const d = new Date(regDateStr);
        if (!isNaN(d.getTime())) {
          d.setMonth(d.getMonth() + Math.max(0, thresh - 1));
          return d.toLocaleDateString('pl-PL');
        }
      }
    }

    return new Date().toLocaleDateString('pl-PL');
  };

  // Płynne skalowanie paska postępu na osi roadmapy
  const getProportionalLeftPercent = (val: number, maxThreshold: number) => {
    if (maxThreshold <= 0) return 0;
    return Math.min(100, Math.max(0, (val / maxThreshold) * 100));
  };

  // Odblokowane poziomy
  const getUnlockedLevelsForClient = (client: any) => {
    if (!client) return [];
    const passes = safeJsonParse(client.karnetyKlubowicza || client.KarnetyKlubowicza || client.karnetyklubowicza, []);
    const clientPass = passes[0];
    if (!clientPass) return [];

    const matchedTable = bonusTables.find(t => isPassMatchingTable(clientPass, t));
    if (!matchedTable || !matchedTable.customTiers) return [];

    const progress = calculateMemberProgress(matchedTable, client);
    if (progress.isReset) return [];

    return matchedTable.customTiers.filter((tier: any) => progress.value >= Number(tier.threshold));
  };

  // Lista oczekujących na weryfikację
  const qualifiedMembersList = allKlienci.map(client => {
    const unlocked = getUnlockedLevelsForClient(client);
    const passes = safeJsonParse(client.karnetyKlubowicza || client.KarnetyKlubowicza || client.karnetyklubowicza, []);
    const pass = passes[0];
    const topLevel = unlocked.length > 0 ? unlocked[unlocked.length - 1] : null;
    const verificationKey = `${client.id}_${topLevel?.id}`;
    const isAlreadyVerified = verifiedMemberTiers.includes(verificationKey);

    const isContract = isContractPassCheck(pass);
    const displayUnit = isContract ? 'MIESIĘCY' : (topLevel?.unit?.toUpperCase() || 'CYKLI');

    return {
      ...client,
      passName: pass?.nazwa || 'Brak',
      unlockedLevels: unlocked,
      topLevel,
      displayUnit,
      verificationKey,
      isAlreadyVerified
    };
  }).filter(c => c.unlockedLevels.length > 0 && !c.isAlreadyVerified);

  // Zatwierdzenie poziomu przez administratora z oknem potwierdzenia
  const handleMarkTierAsVerified = (verificationKey: string, clientName?: string, tierName?: string) => {
    const confirmMessage = clientName && tierName
      ? `Czy na pewno chcesz zatwierdzić osiągnięcie poziomu "${tierName}" dla klubowicza ${clientName}?\n\nPo zatwierdzeniu klubowicz zostanie usunięty z listy oczekujących na weryfikację.`
      : `Czy na pewno chcesz zatwierdzić ten poziom i zdjąć klubowicza z listy oczekujących?`;

    if (!confirm(confirmMessage)) return;

    setVerifiedMemberTiers(prev => [...prev, verificationKey]);
  };

  const searchedMembers = adminSearchQuery.trim().length >= 2
    ? allKlienci.filter(c => {
        const full = `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase();
        return full.includes(adminSearchQuery.toLowerCase());
      })
    : [];

  const currentMemberUnlockedTiers = getUnlockedLevelsForClient(currentUser);
  const hasMemberUnlockedTier = currentMemberUnlockedTiers.length > 0;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (hasMemberUnlockedTier && appRole === 'klubowicz') {
        localStorage.setItem('bonus_has_notification', 'true');
        window.dispatchEvent(new Event('bonus-notification-update'));
      } else {
        localStorage.removeItem('bonus_has_notification');
        window.dispatchEvent(new Event('bonus-notification-update'));
      }
    }
  }, [hasMemberUnlockedTier, appRole]);

  if (!isMounted || isLoading) {
    return (
      <div className="p-16 text-center text-slate-400 font-black uppercase text-xs tracking-wider">
        Ładowanie systemu lojalnościowego Forma Marzeń...
      </div>
    );
  }

  const activeViewingUser = inspectedClient || currentUser;
  const activeViewingPasses = safeJsonParse(activeViewingUser?.karnetyKlubowicza || activeViewingUser?.KarnetyKlubowicza || activeViewingUser?.karnetyklubowicza, []);
  const activeViewingPass = activeViewingPasses[0];
  const activeViewingUserContinuity = getClientEffectiveContinuity(activeViewingUser);

  const totalLevelsCount = bonusTables.reduce((acc, t) => acc + (t.customTiers?.length || 0), 0);
  const countContinuityMembers = allKlienci.filter((k: any) => getClientEffectiveContinuity(k) >= 2).length;
  const avgContinuity = allKlienci.length > 0 
    ? (allKlienci.reduce((acc, curr) => acc + getClientEffectiveContinuity(curr), 0) / allKlienci.length).toFixed(1)
    : '1.0';

  const getAccentBorder = (accent: string) => {
    switch (accent) {
      case 'amber': return 'border-l-4 border-l-amber-500';
      case 'slate': return 'border-l-4 border-l-slate-400';
      case 'yellow': return 'border-l-4 border-l-amber-400';
      case 'purple': return 'border-l-4 border-l-purple-600';
      default: return 'border-l-4 border-l-amber-500';
    }
  };

  // Sortowanie tabel: aktywny karnet na pierwszym miejscu
  const displayedTables = [...bonusTables].sort((a, b) => {
    const aIsUserPass = activeViewingPasses.some((k: any) => isPassMatchingTable(k, a));
    const bIsUserPass = activeViewingPasses.some((k: any) => isPassMatchingTable(k, b));

    if (aIsUserPass && !bIsUserPass) return -1;
    if (!aIsUserPass && bIsUserPass) return 1;
    return (a.kolejnosc ?? 0) - (b.kolejnosc ?? 0);
  });

  return (
    <div className="max-w-[1700px] w-full mx-auto space-y-6 pb-28 px-3 sm:px-6 font-sans antialiased text-slate-800 overflow-x-hidden">
      
      {/* 1. GÓRNY BANER PROGRAMU */}
      {appRole === 'klubowicz' ? (
        <div className="bg-white border border-sky-200 p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black uppercase tracking-wide text-sky-950 flex items-center gap-2.5">
              <span>🏆</span> PROGRAM BONUSOWY
            </h1>
            {hasMemberUnlockedTier && (
              <span className="w-6 h-6 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center animate-pulse shadow-md" title="Masz odblokowany nowy bonus!">
                !
              </span>
            )}
          </div>
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
        <div className="bg-white border border-sky-200 p-5 sm:p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-black uppercase tracking-wide text-sky-950 flex items-center gap-2.5">
              <span>🏆</span> PROGRAM BONUSOWY I TABELE CIĄGŁOŚCI
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Zarządzaj tabelami ciągłości karnetów, weryfikuj odblokowane poziomy klubowiczów i konfiguruj progi nagród.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
              onClick={() => {
                setTableNameInput('');
                setTableTypeInput('Umowa 12 miesięcy');
                setTablePriceInput('199.00');
                setIsAddTableModalOpen(true);
              }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2.5 rounded-2xl text-xs uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
            >
              <span>+</span> DODAJ NOWĄ TABELĘ
            </button>
          </div>
        </div>
      )}

      {/* 2. SEKCJA ADMINISTRATORA: WYSZUKIWARKA ORAZ WERYFIKACJA */}
      {(appRole === 'admin' || appRole === 'trener') && (
        <div className="space-y-4">
          <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm space-y-2.5">
            <label className="text-[11px] font-black text-sky-950 uppercase tracking-wider flex items-center gap-2">
              <span>🔍</span> WYSZUKAJ PODOPIECZNEGO (OPCJONALNIE):
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Wpisz imię, nazwisko lub e-mail (min. 2 znaki), aby przejrzeć podopiecznego..."
                value={adminSearchQuery}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
                className="w-full bg-sky-50/50 border border-sky-200 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
              />
              {adminSearchQuery && (
                <button
                  onClick={() => setAdminSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {searchedMembers.length > 0 && (
              <div className="bg-white border border-sky-200 rounded-2xl p-2 shadow-lg divide-y divide-sky-100 max-h-56 overflow-y-auto mt-2">
                {searchedMembers.map((client) => {
                  const clientPasses = safeJsonParse(client.karnetyKlubowicza || client.KarnetyKlubowicza || client.karnetyklubowicza, []);
                  return (
                    <div
                      key={client.id}
                      onClick={() => {
                        setInspectedClient(client);
                        setAdminSearchQuery('');
                      }}
                      className="p-3 hover:bg-sky-50/80 rounded-xl cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-bold text-slate-900 text-xs">{client.firstName} {client.lastName}</div>
                        <div className="text-[10px] text-slate-500">{client.email} • Karnet: {clientPasses[0]?.nazwa || 'Brak'}</div>
                      </div>
                      <button className="bg-sky-900 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg uppercase">
                        Pokaż naliczenie →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {inspectedClient && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">👁️</span>
                <div>
                  <span className="text-xs font-black text-amber-950 uppercase">
                    Podgląd profilu: {inspectedClient.firstName} {inspectedClient.lastName} ({inspectedClient.email})
                  </span>
                  <p className="text-[11px] text-amber-900 font-medium">
                    Karnet: {activeViewingPass?.nazwa || 'Brak'} • Ciągłość ogólna: {activeViewingUserContinuity} mies.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectedClient(null)}
                className="bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 font-black px-3.5 py-1.5 rounded-xl text-xs uppercase cursor-pointer"
              >
                Zamknij podgląd ✕
              </button>
            </div>
          )}

          {/* TABELA KLUBOWICZÓW: PEŁNA WIDOCZNOŚĆ POZIOMU NA KAŻDYM EKRANIE */}
          {qualifiedMembersList.length > 0 && (
            <div className="bg-rose-50/30 border border-rose-200 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-rose-600 animate-pulse inline-block" />
                  <h3 className="text-xs sm:text-sm font-black text-rose-950 uppercase tracking-wider">
                    KLUBOWICZE Z ODBLOKOWANYM POZIOMEM DO WERYFIKACJI ({qualifiedMembersList.length})
                  </h3>
                </div>
                <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                  Wymagają Twojego sprawdzenia
                </span>
              </div>

              {/* WIDOK DLA SMARTFONÓW */}
              <div className="block sm:hidden space-y-2.5">
                {qualifiedMembersList.map((client) => (
                  <div key={client.id} className="bg-white border border-rose-200 rounded-2xl p-3.5 shadow-xs space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-slate-900 text-xs flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                          <span className="truncate">{client.firstName} {client.lastName}</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-700 truncate mt-0.5">{client.passName}</div>
                      </div>
                      <span className="bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-md text-[9px] uppercase border border-amber-300 shrink-0 whitespace-nowrap">
                        {client.topLevel?.levelName} ({client.topLevel?.threshold} {client.displayUnit})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-rose-100">
                      <button
                        onClick={() => setInspectedClient(client)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-black py-2 rounded-xl text-[10px] uppercase tracking-wider transition-colors shadow-xs text-center cursor-pointer"
                      >
                        SPRAWDŹ →
                      </button>
                      <button
                        onClick={() => handleMarkTierAsVerified(client.verificationKey, `${client.firstName} ${client.lastName}`, client.topLevel?.levelName)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 rounded-xl text-[10px] uppercase tracking-wider transition-colors shadow-xs text-center cursor-pointer"
                      >
                        ✓ ZALICZ
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* WIDOK DLA TABLETÓW I KOMPUTERÓW (DYNAMICZNY ROZMIAR KOLUMN - BRAK UCINANIA) */}
              <div className="hidden sm:block overflow-hidden bg-white border border-rose-200 rounded-2xl">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-rose-900 text-white text-[11px] font-black uppercase tracking-wider sticky top-0 z-10">
                        <th className="py-3 px-4">KLUBOWICZ</th>
                        <th className="py-3 px-4">KARNET</th>
                        <th className="py-3 px-4 whitespace-nowrap">ODBLOKOWANY POZIOM</th>
                        <th className="py-3 px-4 text-right whitespace-nowrap">AKCJA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100 text-xs font-medium">
                      {qualifiedMembersList.map((client) => (
                        <tr key={client.id} className="hover:bg-rose-50/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                              <span>{client.firstName} {client.lastName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">{client.passName}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="bg-amber-100 text-amber-900 font-black px-2.5 py-1 rounded-md text-[10px] uppercase border border-amber-300 inline-block whitespace-nowrap shadow-2xs">
                              {client.topLevel?.levelName} ({client.topLevel?.threshold} {client.displayUnit})
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                              <button
                                onClick={() => setInspectedClient(client)}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-black px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider transition-colors shadow-xs cursor-pointer whitespace-nowrap"
                              >
                                SPRAWDŹ →
                              </button>
                              <button
                                onClick={() => handleMarkTierAsVerified(client.verificationKey, `${client.firstName} ${client.lastName}`, client.topLevel?.levelName)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider transition-colors shadow-xs cursor-pointer whitespace-nowrap"
                                title="Zatwierdź nagrodę i zdejmij z listy"
                              >
                                ✓ ZALICZ
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. DWA KARNETY NA JEDNEJ WYSOKOŚCI (TABELE ROADMAPY) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {displayedTables.map((tabela, tableIndex) => {
          const matchedPass = activeViewingPasses.find((k: any) => isPassMatchingTable(k, tabela));
          const isUserPass = !!matchedPass;

          const progressData = calculateMemberProgress(tabela, activeViewingUser);
          const userVal = progressData.value;

          const maxThreshold = tabela.customTiers && tabela.customTiers.length > 0
            ? Math.max(...tabela.customTiers.map((t: any) => Number(t.threshold) || 1))
            : 18;

          const fillProgressPercent = getProportionalLeftPercent(userVal, maxThreshold);
          const highlightedTierId = selectedRoadmapTier[tabela.id] || null;

          return (
            <div
              key={tabela.id}
              className={`bg-slate-50/80 border rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 transition-all ${
                isUserPass ? 'border-emerald-500 ring-2 ring-emerald-400/40 bg-emerald-50/15' : 'border-sky-200'
              }`}
            >
              {/* A. NAGŁÓWEK TABELI KARNETU */}
              <div className="bg-gradient-to-br from-slate-950 via-sky-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md space-y-3 border border-sky-900/60">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-3 py-1 rounded-lg uppercase tracking-wider shadow-sm">
                      {tabela.typ_karnetu || 'Karnet cykliczny'}
                    </span>
                    {isUserPass && (
                      <span className="bg-emerald-500 text-white font-black text-[10px] px-3 py-1 rounded-lg uppercase tracking-wider shadow-sm flex items-center gap-1.5 border border-emerald-400/40">
                        <span>⭐</span> TWÓJ AKTUALNY KARNET
                        {hasMemberUnlockedTier && (
                          <span className="w-4 h-4 rounded-full bg-rose-600 text-white font-black text-[9px] flex items-center justify-center ml-0.5 animate-pulse">
                            !
                          </span>
                        )}
                      </span>
                    )}
                  </div>

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
                        title="Przesuń tabelę w lewo"
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
                        title="Przesuń tabelę w prawo"
                      >
                        →
                      </button>
                      <button
                        onClick={() => handleOpenEditTableModal(tabela)}
                        className="w-7 h-7 rounded-lg bg-white/20 hover:bg-amber-500 hover:text-slate-950 text-white text-xs flex items-center justify-center cursor-pointer transition-colors ml-1"
                        title="Edytuj nazwę i cenę tej tabeli"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteTable(tabela.id, tabela.nazwa)}
                        className="w-7 h-7 rounded-lg bg-white/10 text-rose-300 hover:bg-rose-600 hover:text-white text-xs flex items-center justify-center cursor-pointer transition-colors"
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

              {/* B. LINIA ROADMAPY Z PASKIEM POSTĘPU */}
              <div className="bg-white border border-sky-200 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-black text-sky-950 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🗺️</span> ROADMAPA CIĄGŁOŚCI
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    Twój staż: <strong className="text-slate-900">{userVal} {tabela.customTiers?.[0]?.unit || (isContractPassCheck(tabela) ? 'miesięcy' : 'cykli')}</strong>
                  </span>
                </div>

                {progressData.isReset && (
                  <div className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-1.5 text-center">
                    ⚠️ {progressData.reason}
                  </div>
                )}

                <div className="relative pt-6 pb-6 px-4">
                  <div className="absolute top-1/2 left-4 right-4 h-2 bg-slate-100 rounded-full -translate-y-1/2" />
                  <div
                    className="absolute top-1/2 left-4 h-2 bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full -translate-y-1/2 transition-all duration-500"
                    style={{ width: `calc((100% - 32px) * ${fillProgressPercent / 100})` }}
                  />

                  <div className="relative h-7" style={{ margin: '0 2px' }}>
                    {tabela.customTiers?.map((tier: any) => {
                      const tierVal = Number(tier.threshold) || 1;
                      const nodePosPercent = getProportionalLeftPercent(tierVal, maxThreshold);
                      const isReached = isProgramActive && !progressData.isReset && userVal >= tierVal;
                      const isSelected = highlightedTierId === tier.id;

                      return (
                        <div
                          key={tier.id}
                          className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer z-10"
                          style={{ left: `${nodePosPercent}%` }}
                          onClick={() => setSelectedRoadmapTier(prev => ({
                            ...prev,
                            [tabela.id]: prev[tabela.id] === tier.id ? null : tier.id
                          }))}
                          title={`Próg: ${tier.levelName} (${tier.threshold} ${tier.unit})`}
                        >
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black transition-all shadow-sm ${
                              isReached
                                ? 'bg-emerald-500 text-white ring-4 ring-emerald-100'
                                : 'bg-white text-slate-600 border-2 border-slate-300 hover:border-amber-400'
                            } ${isSelected ? 'ring-4 ring-amber-400 scale-110' : ''}`}
                          >
                            {isReached ? '✓' : tier.threshold}
                          </div>
                          <span className={`text-[8px] font-black uppercase mt-1 tracking-tight whitespace-nowrap ${
                            isReached ? 'text-emerald-900 font-extrabold' : 'text-slate-400'
                          } ${isSelected ? 'text-amber-900 underline' : ''}`}>
                            {tier.levelName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-sky-50/50 rounded-xl px-3 py-1.5 text-[10px] text-slate-600 font-medium flex items-center justify-between border border-sky-100">
                  <span>Kliknij punkt na osi, aby wyfiltrować próg</span>
                  <span className="font-bold text-sky-950">{Math.round(fillProgressPercent)}% do maksymalnego poziomu</span>
                </div>
              </div>

              {/* C. KOMPAKTOWE POZIOMY NAGRÓD */}
              <div className="space-y-2.5">
                {tabela.customTiers?.map((tier: any) => {
                  const isUnlocked = isProgramActive && isUserPass && !progressData.isReset && userVal >= Number(tier.threshold);
                  const isHighlighted = highlightedTierId === tier.id;
                  const unlockDate = isUnlocked ? getTierUnlockDate(tier, tabela, activeViewingUser) : null;

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
                          <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 ${
                            isUnlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {isUnlocked && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />}
                            {isUnlocked ? (
                              <span className="flex items-center gap-1">
                                <span>ODBLOKOWANY ✓</span>
                                {unlockDate && (
                                  <span className="text-[8px] font-mono opacity-85 font-semibold lowercase">
                                    ({unlockDate})
                                  </span>
                                )}
                              </span>
                            ) : (
                              'W TRAKCIE'
                            )}
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

      {/* 4. WARUNKI KWALIFIKACJI (AKORDEON POD ROADMAPĄ) */}
      <div className="bg-white border border-sky-200 rounded-3xl shadow-sm overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsRulesExpanded(prev => !prev)}
          className="w-full p-5 sm:p-6 flex items-center justify-between gap-4 text-left hover:bg-sky-50/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-900 flex items-center justify-center text-lg shrink-0">
              🛡️
            </div>
            <div>
              <h3 className="text-base font-black text-sky-950 uppercase tracking-wide flex items-center gap-2">
                Warunki kwalifikacji i zasady ciągłości
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Kliknij, aby rozwinąć szczegółowe zasady rozliczeń, odnowień oraz naliczania bonusów
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs font-bold text-sky-900 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl hidden sm:inline-block">
              {isRulesExpanded ? 'Zwiń listę' : 'Rozwiń listę'}
            </span>
            <span className={`w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs transition-transform duration-300 ${
              isRulesExpanded ? 'rotate-180' : 'rotate-0'
            }`}>
              ▼
            </span>
          </div>
        </button>

        {isRulesExpanded && (
          <div className="p-5 sm:p-7 pt-0 border-t border-sky-100 space-y-5 animate-in fade-in duration-200">
            {appRole === 'admin' && (
              <div className="pt-4 flex justify-end">
                <div className="text-[11px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl">
                  ✍️ Jako administrator możesz edytować treść każdego warunku poniżej
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-1">
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
        )}
      </div>

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
                  value={tableNameInput}
                  onChange={(e) => setTableNameInput(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Typ karnetu</label>
                <select
                  value={tableTypeInput}
                  onChange={(e) => setTableTypeInput(e.target.value)}
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
                  value={tablePriceInput}
                  onChange={(e) => setTablePriceInput(e.target.value)}
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

      {/* MODAL 3: EDYCJA PARAMETRÓW TABELI (ADMIN) */}
      {isEditTableModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white border border-sky-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">
                ✏️ Edytuj parametry tabeli
              </h3>
              <button onClick={() => setIsEditTableModalOpen(false)} className="text-slate-400 font-bold text-base cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveEditTable} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nazwa tabeli / karnetu</label>
                <input
                  type="text"
                  required
                  value={tableNameInput}
                  onChange={(e) => setTableNameInput(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Typ karnetu</label>
                <select
                  value={tableTypeInput}
                  onChange={(e) => setTableTypeInput(e.target.value)}
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
                  value={tablePriceInput}
                  onChange={(e) => setTablePriceInput(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-sky-100">
                <button
                  type="button"
                  onClick={() => setIsEditTableModalOpen(false)}
                  className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-slate-900 text-white font-black px-5 py-2 rounded-xl uppercase tracking-wider cursor-pointer shadow-md"
                >
                  {isSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DODAWANIE / EDYCJA PROGU (ADMIN) */}
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
                  <label className="font-bold text-slate-700">Wartość ciągłości / treningów</label>
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
