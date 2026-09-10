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

  // Stan dla panelu administracyjnego zarządzania progami
  const [selectedAdminKarnetId, setSelectedAdminKarnetId] = useState<string | number>('');
  const [editTiers, setEditTiers] = useState<any[]>([]);
  const [newTierThreshold, setNewTierThreshold] = useState('');
  const [newTierReward, setNewTierReward] = useState('');
  const [newTierType, setNewTierType] = useState<'miesiecy' | 'wejsc' | 'cykl'>('miesiecy');
  const [isSavingTier, setIsSavingTier] = useState(false);

  // Domyślne progi awaryjne
  const defaultProgiUmowa = [
    { id: 1, threshold: 3, type: 'miesiecy', reward: '10% zniżki na suplementy w barze + darmowy shake' },
    { id: 2, threshold: 6, type: 'miesiecy', reward: '2 tygodnie zamrożenia ekstra w puli + ręcznik klubowy' },
    { id: 3, threshold: 12, type: 'miesiecy', reward: '1 miesiąc darmowego okresu bonusowego (0 PLN) + koszulka Forma Marzeń' },
  ];

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;

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

      // Pobieranie katalogu karnetów z tabeli katalog_karnetow
      const { data: karnetyData } = await supabase.from('katalog_karnetow').select('*');
      if (karnetyData && karnetyData.length > 0) {
        const parsedKarnety = karnetyData.map((k: any) => {
          let meta: any = {};
          try {
            meta = JSON.parse(k.inne_ustawienia || '{}');
          } catch (e) {}
          return {
            ...k,
            customTiers: meta.customTiers || defaultProgiUmowa
          };
        });
        setKarnetyCennik(parsedKarnety);
        setSelectedAdminKarnetId(parsedKarnety[0].id);
        setEditTiers(parsedKarnety[0].customTiers);
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
            cyklCiaglosci: c.cyklCiaglosci || 1,
          };
        });
        setAllKlienci(mapped);
        if (userEmail) {
          const myUser = mapped.find((u: any) => u.email === userEmail);
          if (myUser) setCurrentUser(myUser);
        }
      }
    } catch (err) {
      console.error("Błąd ładowania danych dla Twoj Bonus:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, []);

  const handleSelectAdminKarnet = (karnetId: string | number) => {
    setSelectedAdminKarnetId(karnetId);
    const found = karnetyCennik.find((k: any) => String(k.id) === String(karnetId));
    if (found) {
      setEditTiers(found.customTiers || defaultProgiUmowa);
    }
  };

  const handleAddTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTierThreshold || !newTierReward.trim()) return;

    const newTier = {
      id: Date.now(),
      threshold: Number(newTierThreshold),
      type: newTierType,
      reward: newTierReward.trim()
    };

    const updatedTiers = [...editTiers, newTier].sort((a, b) => a.threshold - b.threshold);
    setEditTiers(updatedTiers);
    setNewTierThreshold('');
    setNewTierReward('');
  };

  const handleDeleteTier = (tierId: number) => {
    setEditTiers(editTiers.filter((t: any) => t.id !== tierId));
  };

  const handleSaveTiersToDatabase = async () => {
    if (!selectedAdminKarnetId) return;
    setIsSavingTier(true);
    try {
      const karnetObj = karnetyCennik.find((k: any) => String(k.id) === String(selectedAdminKarnetId));
      if (!karnetObj) return;

      let meta: any = {};
      try {
        meta = JSON.parse(karnetObj.inne_ustawienia || '{}');
      } catch (e) {}

      meta.customTiers = editTiers;

      const { error } = await supabase
        .from('katalog_karnetow')
        .update({ inne_ustawienia: JSON.stringify(meta) })
        .eq('id', selectedAdminKarnetId);

      if (error) throw error;

      setKarnetyCennik(karnetyCennik.map((k: any) => {
        if (String(k.id) === String(selectedAdminKarnetId)) {
          return { ...k, customTiers: editTiers };
        }
        return k;
      }));

      alert("Progi i nagrody zostały pomyślnie zapisane w bazie Supabase dla wybranego karnetu!");
    } catch (err: any) {
      console.error("Błąd zapisu progów:", err);
      alert("Nie udało się zapisać w bazie: " + (err.message || ''));
    } finally {
      setIsSavingTier(false);
    }
  };

  if (!isMounted || isLoading) {
    return <div className="p-12 text-center text-slate-500 font-bold uppercase text-xs">Ładowanie programu bonusowego...</div>;
  }

  const aktywnyKarnet = currentUser && currentUser.karnetyKlubowicza?.length > 0 ? currentUser.karnetyKlubowicza[0] : null;
  const typAktualnegoKarnetu = aktywnyKarnet?.typKarnetu || 'Na czas';
  const cyklCiągłościKlienta = currentUser?.cyklCiaglosci || 1;
  const umowaMiesiaceZaliczone = aktywnyKarnet?.rata ? parseInt(String(aktywnyKarnet.rata).match(/(\d+)/)?.[1] || '1', 10) : 1;

  const matchedCennikKarnet = karnetyCennik.find((k: any) => k.nazwa?.trim().toLowerCase() === aktywnyKarnet?.nazwa?.trim().toLowerCase());
  const activeUserTiers = matchedCennikKarnet?.customTiers || defaultProgiUmowa;

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 font-sans antialiased text-slate-800">
      
      {/* NAGŁÓWEK STRONY */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-sky-200 p-6 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
            🎁 TWÓJ BONUS I PROGRAM LOJALNOŚCIOWY
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            System ciągłości karnetów, tabele progów oraz nagrody w klubie Forma Marzeń.
          </p>
        </div>
        {appRole === 'admin' && (
          <div className="bg-amber-100 text-amber-900 px-4 py-2 rounded-2xl text-xs font-black uppercase border border-amber-300">
            👑 Tryb Administratora (Edycja i Baza Supabase)
          </div>
        )}
      </div>

      {/* SEKCJA DLA KLUBOWICZA */}
      {appRole === 'klubowicz' && currentUser && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-sky-200 p-6 rounded-3xl shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase">Twój aktywny karnet</div>
              <div className="text-lg font-black text-slate-900">{aktywnyKarnet ? aktywnyKarnet.nazwa : 'Brak aktywnego karnetu'}</div>
              <div className="text-xs text-sky-800 font-semibold">{typAktualnegoKarnetu}</div>
            </div>

            <div className="bg-white border border-sky-200 p-6 rounded-3xl shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase">Ciągłość i staż (Cykl)</div>
              <div className="text-2xl font-black text-sky-950">{cyklCiągłościKlienta} <span className="text-xs font-normal text-slate-500">miesięcy z rzędu</span></div>
              <div className="text-xs text-emerald-700 font-bold">✓ Zachowana ciągłość płatności</div>
            </div>

            <div className="bg-white border border-sky-200 p-6 rounded-3xl shadow-sm space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase">Status bonusów</div>
              <div className="text-lg font-black text-amber-700">Aktywne progi klubowe</div>
              <div className="text-xs text-slate-500">Automatyczne naliczanie nagród</div>
            </div>
          </div>

          <div className="bg-white border border-sky-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="text-sm font-black text-sky-950 uppercase tracking-wider">
                📋 Tabela progów i nagród dla karnetu: <span className="text-amber-700">{aktywnyKarnet?.nazwa || 'Standard'}</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {activeUserTiers.map((t: any, idx: number) => {
                const userVal = typAktualnegoKarnetu === 'Umowa 12 miesięcy' ? umowaMiesiaceZaliczone : cyklCiągłościKlienta;
                const osiagniety = userVal >= Number(t.threshold);

                return (
                  <div key={t.id || idx} className={`border rounded-2xl p-5 space-y-3 transition-all ${osiagniety ? 'bg-emerald-50/70 border-emerald-300 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-80'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-black text-xs uppercase text-slate-900">
                        Próg: {t.threshold} {t.type === 'miesiecy' ? 'miesięcy' : t.type === 'wejsc' ? 'wejść' : 'cykli'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${osiagniety ? 'bg-emerald-200 text-emerald-900 border border-emerald-300' : 'bg-slate-200 text-slate-700'}`}>
                        {osiagniety ? 'ODBLOKOWANY ✓' : 'W TRAKCIE'}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-700 leading-relaxed">{t.reward}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* WIDOK DLA ADMINISTRATORA / TRENERA - EDYTOR BAZY SUPABASE */}
      {(appRole === 'admin' || appRole === 'trener') && (
        <div className="space-y-6">
          <div className="bg-white border border-sky-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-100 pb-4">
              <div>
                <h3 className="text-sm font-black text-sky-950 uppercase tracking-wider">
                  ⚙️ Zarządzanie tabelami progów i nagród (Supabase)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Wybierz karnet z cennika, dodaj lub usuń progi i zapisz zmiany bezpośrednio w bazie danych.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Wybierz karnet:</span>
                <select
                  value={selectedAdminKarnetId}
                  onChange={(e) => handleSelectAdminKarnet(e.target.value)}
                  className="bg-sky-50 border border-sky-200 rounded-xl px-3.5 py-2 text-xs font-black text-sky-950 focus:outline-none cursor-pointer"
                >
                  {karnetyCennik.map((k: any) => (
                    <option key={k.id} value={k.id}>{k.nazwa} ({k.typ_karnetu})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-extrabold text-xs text-sky-900 uppercase tracking-wider">
                Aktualne progi dla wybranego karnetu:
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {editTiers.map((t: any) => (
                  <div key={t.id} className="bg-sky-50/50 border border-sky-200 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-sm">
                    <div className="flex justify-between items-start">
                      <span className="bg-sky-200 text-sky-950 text-[10px] font-black px-2.5 py-0.5 rounded-lg uppercase">
                        Próg: {t.threshold} {t.type}
                      </span>
                      <button
                        onClick={() => handleDeleteTier(t.id)}
                        className="text-rose-600 hover:text-rose-800 font-bold text-xs cursor-pointer p-1"
                        title="Usuń próg"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-slate-800">{t.reward}</p>
                  </div>
                ))}
                {editTiers.length === 0 && (
                  <div className="col-span-3 text-center py-6 text-slate-400 text-xs italic">
                    Brak zdefiniowanych progów. Dodaj nowy próg poniżej.
                  </div>
                )}
              </div>

              <form onSubmit={handleAddTier} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 mt-4">
                <h5 className="font-black text-xs text-slate-900 uppercase">Dodaj nowy próg i nagrodę</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Wartość progu (np. 3, 6, 12)</label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="np. 6"
                      value={newTierThreshold}
                      onChange={(e) => setNewTierThreshold(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Typ jednostki</label>
                    <select
                      value={newTierType}
                      onChange={(e: any) => setNewTierType(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 cursor-pointer"
                    >
                      <option value="miesiecy">Miesiące</option>
                      <option value="cykl">Cykle</option>
                      <option value="wejsc">Wejścia</option>
                    </select>
                  </div>

                  <div className="space-y-1 sm:col-span-3">
                    <label className="text-[11px] font-bold text-slate-700">Opis nagrody / bonusu</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="np. Darmowy shake białkowy + ręcznik klubowy"
                        value={newTierReward}
                        onChange={(e) => setNewTierReward(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800"
                      />
                      <button
                        type="submit"
                        className="bg-slate-900 hover:bg-slate-800 text-white font-black px-5 py-2 rounded-xl text-xs uppercase tracking-wider cursor-pointer shrink-0 shadow-sm"
                      >
                        + Dodaj próg
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={isSavingTier}
                  onClick={handleSaveTiersToDatabase}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-md transition-colors"
                >
                  {isSavingTier ? 'Zapisywanie w Supabase...' : '💾 Zapisz zmiany w bazie Supabase'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
