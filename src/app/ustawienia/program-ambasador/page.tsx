'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface AmbassadorSettings {
  id: number;
  min_pass_price: number;
  is_active: boolean;
}

interface AmbassadorTier {
  id: number;
  name: string;
  required_referrals: number;
  reward_description: string;
  referee_reward_description: string;
  badge_color: string;
  order_index: number;
  is_active: boolean;
  ambassador_discount_percent: number;
  referee_discount_percent: number;
}

interface ReferralRecord {
  id: number;
  pass_name: string;
  pass_price: number;
  is_qualified: boolean;
  status: string;
  created_at: string;
  referrer: {
    id: number;
    Imię: string | null;
    Nazwisko: string | null;
    'Numer tel.': string | null;
  } | null;
  referred: {
    id: number;
    Imię: string | null;
    Nazwisko: string | null;
    'Numer tel.': string | null;
  } | null;
}

export default function ProgramAmbasadorUstawieniaPage() {
  const [activeTab, setActiveTab] = useState<'tiers' | 'rules' | 'history'>('tiers');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [settings, setSettings] = useState<AmbassadorSettings>({
    id: 1,
    min_pass_price: 200.0,
    is_active: true
  });
  const [tiers, setTiers] = useState<AmbassadorTier[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);

  const [isTierModalOpen, setIsTierModalOpen] = useState<boolean>(false);
  const [editingTierId, setEditingTierId] = useState<number | null>(null);
  const [tierForm, setTierForm] = useState({
    name: '',
    required_referrals: 1,
    reward_description: '',
    referee_reward_description: '',
    badge_color: '#0284c7',
    is_active: true,
    ambassador_discount_percent: 10,
    referee_discount_percent: 10
  });

  const notify = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: settingsData } = await supabase
        .from('ambassador_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (settingsData) setSettings(settingsData);

      const { data: tiersData, error: tiersError } = await supabase
        .from('ambassador_tiers')
        .select('*')
        .order('required_referrals', { ascending: true });

      if (tiersError) throw tiersError;
      setTiers(tiersData || []);

      const { data: refData, error: refError } = await supabase
        .from('referrals')
        .select(`
          id,
          pass_name,
          pass_price,
          is_qualified,
          status,
          created_at,
          referrer:referrer_id (id, "Imię", "Nazwisko", "Numer tel."),
          referred:referred_client_id (id, "Imię", "Nazwisko", "Numer tel.")
        `)
        .order('created_at', { ascending: false });

      if (refError) throw refError;
      setReferrals((refData as unknown as ReferralRecord[]) || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Błąd podczas ładowania danych programu';
      notify('error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setIsSavingSettings(true);
      const { error } = await supabase
        .from('ambassador_settings')
        .upsert({
          id: 1,
          min_pass_price: Number(settings.min_pass_price),
          is_active: settings.is_active,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      notify('success', 'Ustawienia programu ambasador zostały pomyślnie zaktualizowane.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nie udało się zapisać ustawień';
      notify('error', msg);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleOpenAddTier = () => {
    setEditingTierId(null);
    setTierForm({
      name: '',
      required_referrals: tiers.length > 0 ? tiers[tiers.length - 1].required_referrals + 2 : 1,
      reward_description: '',
      referee_reward_description: '',
      badge_color: '#0284c7',
      is_active: true,
      ambassador_discount_percent: 10,
      referee_discount_percent: 10
    });
    setIsTierModalOpen(true);
  };

  const handleOpenEditTier = (tier: AmbassadorTier) => {
    setEditingTierId(tier.id);
    setTierForm({
      name: tier.name,
      required_referrals: tier.required_referrals,
      reward_description: tier.reward_description,
      referee_reward_description: tier.referee_reward_description || '',
      badge_color: tier.badge_color || '#0284c7',
      is_active: tier.is_active,
      ambassador_discount_percent: Number(tier.ambassador_discount_percent) || 0,
      referee_discount_percent: Number(tier.referee_discount_percent) || 0
    });
    setIsTierModalOpen(true);
  };

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tierForm.name.trim() || !tierForm.reward_description.trim()) {
      notify('error', 'Wypełnij nazwę progu oraz opis nagrody.');
      return;
    }

    try {
      const payload = {
        name: tierForm.name.trim(),
        required_referrals: Number(tierForm.required_referrals),
        reward_description: tierForm.reward_description.trim(),
        referee_reward_description: tierForm.referee_reward_description.trim(),
        badge_color: tierForm.badge_color,
        is_active: tierForm.is_active,
        ambassador_discount_percent: Number(tierForm.ambassador_discount_percent) || 0,
        referee_discount_percent: Number(tierForm.referee_discount_percent) || 0
      };

      if (editingTierId) {
        const { error } = await supabase
          .from('ambassador_tiers')
          .update(payload)
          .eq('id', editingTierId);

        if (error) throw error;
        notify('success', 'Poziom został zaktualizowany.');
      } else {
        const { error } = await supabase
          .from('ambassador_tiers')
          .insert({ ...payload, order_index: tiers.length + 1 });

        if (error) throw error;
        notify('success', 'Dodano nowy poziom do programu.');
      }

      setIsTierModalOpen(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Błąd podczas zapisu poziomu';
      notify('error', msg);
    }
  };

  const handleDeleteTier = async (id: number) => {
    if (!confirm('Czy na pewno chcesz trwale usunąć ten poziom nagród?')) return;
    try {
      const { error } = await supabase.from('ambassador_tiers').delete().eq('id', id);
      if (error) throw error;
      notify('success', 'Poziom został usunięty.');
      setTiers(tiers.filter((t) => t.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nie udało się usunąć progu';
      notify('error', msg);
    }
  };

  const handleToggleTierStatus = async (tier: AmbassadorTier) => {
    try {
      const updated = !tier.is_active;
      const { error } = await supabase
        .from('ambassador_tiers')
        .update({ is_active: updated })
        .eq('id', tier.id);

      if (error) throw error;
      setTiers(tiers.map((t) => (t.id === tier.id ? { ...t, is_active: updated } : t)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Błąd zmiany statusu';
      notify('error', msg);
    }
  };

  const totalQualifiedCount = referrals.filter((r) => r.is_qualified).length;
  const totalVolume = referrals
    .filter((r) => r.is_qualified)
    .reduce((acc, curr) => acc + Number(curr.pass_price || 0), 0);

  return (
    <div className="w-full max-w-[1700px] mx-auto space-y-5 sm:space-y-6 pb-24 font-sans antialiased text-slate-800 px-3 sm:px-6 overflow-x-hidden">
      {statusMessage && (
        <div 
          className={`fixed top-4 right-4 left-4 sm:left-auto sm:right-6 sm:top-6 z-50 px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border transition-all max-w-md ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-900 text-emerald-100 border-emerald-700' 
              : 'bg-rose-900 text-rose-100 border-rose-700'
          }`}
        >
          <span className="text-base shrink-0">{statusMessage.type === 'success' ? '✅' : '⚠️'}</span>
          <span className="text-xs font-bold tracking-wide">{statusMessage.text}</span>
        </div>
      )}

      {/* NAGŁÓWEK I KONTROLKI */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-sky-200 p-4 sm:p-5 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
            🏆 PROGRAM AMBASADOR
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Zarządzaj progami, stawkami rabatów (% dla obu stron) oraz warunkami minimalnej ceny karnetu.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-3 bg-sky-50/70 border border-sky-200 px-3.5 py-2 rounded-xl">
            <span className="text-xs font-bold text-sky-950">Status programu:</span>
            <button
              onClick={() => {
                const updated = !settings.is_active;
                setSettings({ ...settings, is_active: updated });
                supabase
                  .from('ambassador_settings')
                  .upsert({ id: 1, is_active: updated })
                  .then(() => notify('success', `Program został ${updated ? 'aktywowany' : 'wyłączony'}.`));
              }}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-colors cursor-pointer ${
                settings.is_active ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
              }`}
            >
              {settings.is_active ? 'WŁĄCZONY' : 'WYŁĄCZONY'}
            </button>
          </div>

          <button
            onClick={handleOpenAddTier}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <span>+ DODAJ NOWY POZIOM</span>
          </button>
        </div>
      </div>

      {/* METRYKI PODSUMOWUJĄCE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-sky-200 rounded-2xl p-4 sm:p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl shrink-0">🏅</div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase text-slate-400 truncate">Aktywne poziomy</div>
            <div className="text-2xl font-black text-slate-900">{tiers.length}</div>
          </div>
        </div>

        <div className="bg-white border border-sky-200 rounded-2xl p-4 sm:p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl shrink-0">🤝</div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase text-slate-400 truncate">Polecenia zaliczone</div>
            <div className="text-2xl font-black text-emerald-800">{totalQualifiedCount}</div>
          </div>
        </div>

        <div className="bg-white border border-sky-200 rounded-2xl p-4 sm:p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-xl shrink-0">💰</div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase text-slate-400 truncate">Wartość sprzedaży</div>
            <div className="text-2xl font-black text-sky-950 truncate">{totalVolume.toFixed(2)} PLN</div>
          </div>
        </div>

        <div className="bg-white border border-sky-200 rounded-2xl p-4 sm:p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-xl shrink-0">🛡️</div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase text-slate-400 truncate">Min. kwota karnetu</div>
            <div className="text-2xl font-black text-purple-950 truncate">{Number(settings.min_pass_price).toFixed(2)} PLN</div>
          </div>
        </div>
      </div>

      {/* ZAKŁADKI RESPONSYWNE */}
      <div className="flex items-center gap-2 border-b border-sky-200 pb-2 overflow-x-auto scrollbar-none -mx-1 px-1">
        <button
          onClick={() => setActiveTab('tiers')}
          className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'tiers' ? 'bg-sky-900 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-sky-50 border border-sky-200'
          }`}
        >
          🏅 Poziomy i Nagrody ({tiers.length})
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'rules' ? 'bg-sky-900 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-sky-50 border border-sky-200'
          }`}
        >
          🛡️ Warunki kwalifikacji
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'history' ? 'bg-sky-900 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-sky-50 border border-sky-200'
          }`}
        >
          👥 Rejestr Poleconych ({referrals.length})
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-500 font-bold uppercase text-xs">Ładowanie danych programu z bazy...</div>
      ) : (
        <>
          {activeTab === 'tiers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tiers.map((tier) => (
                <div key={tier.id} className="bg-white border border-sky-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: tier.badge_color || '#0284c7' }} />
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3 mt-1">
                      <span 
                        className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border truncate max-w-[150px]"
                        style={{ borderColor: tier.badge_color, color: tier.badge_color, backgroundColor: `${tier.badge_color}15` }}
                      >
                        {tier.name}
                      </span>
                      <button
                        onClick={() => handleToggleTierStatus(tier)}
                        className={`text-[10px] font-black px-2 py-0.5 rounded cursor-pointer shrink-0 ${tier.is_active ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {tier.is_active ? 'AKTYWNY' : 'WYŁĄCZONY'}
                      </button>
                    </div>

                    <div className="text-2xl font-black text-slate-900 mb-3">
                      {tier.required_referrals} {tier.required_referrals === 1 ? 'polecenie' : 'poleceń'}
                    </div>

                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 mb-2.5">
                      <div className="text-[10px] font-black uppercase tracking-wider text-amber-900 mb-0.5 flex justify-between items-center gap-2">
                        <span className="truncate">🎁 Nagroda Klubowicza:</span>
                        <span className="bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded font-black text-[9px] shrink-0">
                          -{tier.ambassador_discount_percent || 0}%
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 leading-snug break-words">{tier.reward_description}</div>
                    </div>

                    <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3 mb-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-sky-900 mb-0.5 flex justify-between items-center gap-2">
                        <span className="truncate">👋 Bonus dla Nowego:</span>
                        <span className="bg-sky-200 text-sky-950 px-1.5 py-0.5 rounded font-black text-[9px] shrink-0">
                          -{tier.referee_discount_percent || 10}%
                        </span>
                      </div>
                      <div className="text-xs font-medium text-slate-700 leading-snug break-words">{tier.referee_reward_description || 'Standardowy bonus'}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-sky-100">
                    <button onClick={() => handleOpenEditTier(tier)} className="w-8 h-8 bg-amber-800 hover:bg-amber-900 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm cursor-pointer" title="Edytuj">✏️</button>
                    <button onClick={() => handleDeleteTier(tier.id)} className="w-8 h-8 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center border border-rose-200 transition-colors cursor-pointer" title="Usuń">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="bg-white border border-sky-200 rounded-3xl p-5 sm:p-8 max-w-2xl shadow-sm space-y-6">
              <div className="border-b border-sky-100 pb-3">
                <h3 className="font-black text-sm text-sky-950 uppercase">Zabezpieczenie Minimalnej Wartości Karnetu</h3>
                <p className="text-xs text-slate-500 mt-1">Ustal minimalną kwotę zakupu karnetu, która zalicza polecenie do podniesienia poziomu ambasadora.</p>
              </div>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block text-xs">Minimalna kwota karnetu kwalifikująca (PLN):</label>
                  <div className="flex max-w-xs">
                    <span className="bg-slate-100 border border-r-0 border-sky-200 rounded-l-xl px-3.5 py-2.5 text-slate-600 font-bold flex items-center text-xs">PLN</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={settings.min_pass_price}
                      onChange={(e) => setSettings({ ...settings, min_pass_price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-r-xl px-3.5 py-2.5 text-slate-800 font-bold text-base focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
                <div className="pt-4 border-t border-sky-100 flex justify-end">
                  <button type="submit" disabled={isSavingSettings} className="w-full sm:w-auto bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white font-black px-6 py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer uppercase tracking-wider">
                    {isSavingSettings ? 'Zapisywanie...' : 'Zapisz Regułę'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white border border-sky-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-sky-100 flex items-center justify-between gap-2">
                <h3 className="font-black text-xs sm:text-sm text-sky-950 uppercase truncate">Historia Rejestracji i Zakupów</h3>
                <span className="text-xs bg-sky-50 text-sky-900 border border-sky-200 font-bold px-3 py-1 rounded-full shrink-0">Razem: {referrals.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left border-collapse">
                  <thead>
                    <tr className="bg-sky-50/70 border-b border-sky-200 text-[11px] font-bold text-sky-900 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Ambasador</th>
                      <th className="py-3.5 px-4">Nowy Klubowicz</th>
                      <th className="py-3.5 px-4">Zakupiony Karnet</th>
                      <th className="py-3.5 px-4">Wartość</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100 text-xs">
                    {referrals.map((row) => (
                      <tr key={row.id} className="hover:bg-sky-50/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.referrer ? `${row.referrer.Imię || ''} ${row.referrer.Nazwisko || ''}` : 'Brak danych'}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{row.referred ? `${row.referred.Imię || ''} ${row.referred.Nazwisko || ''}` : 'Nowy klient'}</td>
                        <td className="py-3.5 px-4 font-bold text-sky-950">{row.pass_name}</td>
                        <td className="py-3.5 px-4 font-black text-slate-800">{Number(row.pass_price).toFixed(2)} PLN</td>
                        <td className="py-3.5 px-4 text-center">
                          {row.is_qualified ? (
                            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black px-2.5 py-1 rounded-md uppercase whitespace-nowrap">✓ Zaliczone</span>
                          ) : (
                            <span className="bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-black px-2.5 py-1 rounded-md uppercase whitespace-nowrap">✕ Poniżej minimum</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-500 font-medium whitespace-nowrap">
                          {new Date(row.created_at).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL EDYCJI / DODAWANIA PROGU */}
      {isTierModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-sky-200 rounded-3xl max-w-xl w-full p-5 sm:p-8 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase">
                {editingTierId !== null ? '✏️ Edytuj Poziom Ambasadora' : '🏅 Nowy Poziom Ambasadora'}
              </h3>
              <button type="button" onClick={() => setIsTierModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-lg p-1">✕</button>
            </div>

            <form onSubmit={handleSaveTier} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-800 block">Nazwa Poziomu *</label>
                <input
                  type="text"
                  required
                  placeholder="np. Srebrny"
                  value={tierForm.name}
                  onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 font-bold focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Wymagana liczba poleconych *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={tierForm.required_referrals}
                    onChange={(e) => setTierForm({ ...tierForm, required_referrals: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 font-bold focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Kolor plakietki</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={tierForm.badge_color}
                      onChange={(e) => setTierForm({ ...tierForm, badge_color: e.target.value })}
                      className="w-10 h-10 rounded-xl border border-sky-200 p-1 cursor-pointer bg-white shrink-0"
                    />
                    <input
                      type="text"
                      value={tierForm.badge_color}
                      onChange={(e) => setTierForm({ ...tierForm, badge_color: e.target.value })}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 font-bold uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-sky-50/60 p-3.5 rounded-2xl border border-sky-200">
                <div className="space-y-1">
                  <label className="font-black text-amber-900 block text-[11px] uppercase">
                    Rabat dla Ambasadora (%):
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={tierForm.ambassador_discount_percent}
                      onChange={(e) => setTierForm({ ...tierForm, ambassador_discount_percent: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-sky-200 rounded-l-xl px-3 py-2 text-slate-800 font-black text-sm"
                    />
                    <span className="bg-slate-100 border border-l-0 border-sky-200 rounded-r-xl px-2.5 py-2 text-slate-600 font-bold">%</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-black text-sky-900 block text-[11px] uppercase">
                    Rabat dla Nowego (%):
                  </label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      required
                      value={tierForm.referee_discount_percent}
                      onChange={(e) => setTierForm({ ...tierForm, referee_discount_percent: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-sky-200 rounded-l-xl px-3 py-2 text-slate-800 font-black text-sm"
                    />
                    <span className="bg-slate-100 border border-l-0 border-sky-200 rounded-r-xl px-2.5 py-2 text-slate-600 font-bold">%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 block">Opis nagrody dla Ambasadora (tekst dla klubowicza) *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="np. 25% rabatu na karnet"
                  value={tierForm.reward_description}
                  onChange={(e) => setTierForm({ ...tierForm, reward_description: e.target.value })}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-medium focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800 block">Opis bonusu powitalnego dla nowej osoby (tekst) *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="np. -10% zniżki + bezpłatna analiza składu ciała"
                  value={tierForm.referee_reward_description}
                  onChange={(e) => setTierForm({ ...tierForm, referee_reward_description: e.target.value })}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-medium focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-sky-100">
                <button type="button" onClick={() => setIsTierModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition cursor-pointer">
                  Anuluj
                </button>
                <button type="submit" className="bg-amber-800 hover:bg-amber-900 text-white font-black px-6 py-2.5 rounded-xl transition shadow-sm cursor-pointer uppercase tracking-wider">
                  {editingTierId !== null ? 'Zaktualizuj Poziom' : 'Dodaj Poziom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
