"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

// Bezpośrednia, bezpieczna inicjalizacja klienta Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface AmbassadorTier {
  id: number;
  name: string;
  required_referrals: number;
  reward_description: string;
  referee_reward_description: string;
  badge_color: string;
  order_index: number;
  is_active: boolean;
}

interface AmbassadorSettings {
  min_pass_price: number;
  is_active: boolean;
}

interface ReferralItem {
  id: number;
  pass_name: string;
  pass_price: number;
  is_qualified: boolean;
  status: string;
  created_at: string;
  referred: {
    id: number;
    Imię: string | null;
    Nazwisko: string | null;
  } | null;
}

export default function AmbasadorKlubowiczPage() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralLink, setReferralLink] = useState<string>('');
  
  const [tiers, setTiers] = useState<AmbassadorTier[]>([]);
  const [settings, setSettings] = useState<AmbassadorSettings>({
    min_pass_price: 200.00,
    is_active: true
  });
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  useEffect(() => {
    loadAmbassadorData();
  }, []);

  const loadAmbassadorData = async () => {
    setIsLoading(true);
    try {
      // 1. Pobierz zalogowanego użytkownika
      const { data: { user } } = await supabase.auth.getUser();
      const cleanEmail = (user?.email || '').toLowerCase().trim();

      if (!cleanEmail) {
        setIsLoading(false);
        return;
      }

      // 2. Pobierz rekord klienta z bazy
      const { data: clientData } = await supabase
        .from('klienci')
        .select('*')
        .ilike('E-mail', cleanEmail)
        .maybeSingle();

      if (clientData) {
        setCurrentUser(clientData);
        const code = clientData.referral_code || '';
        setReferralCode(code);

        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://forma-marzen.vercel.app';
        setReferralLink(`${origin}/rejestracja-karnet?ref=${code}`);

        // 3. Pobierz historię poleceń tego klubowicza
        const { data: refData } = await supabase
          .from('referrals')
          .select(`
            id,
            pass_name,
            pass_price,
            is_qualified,
            status,
            created_at,
            referred:referred_client_id (id, "Imię", "Nazwisko")
          `)
          .eq('referrer_id', clientData.id)
          .order('created_at', { ascending: false });

        setReferrals((refData as unknown as ReferralItem[]) || []);
      }

      // 4. Pobierz aktywne progi programu
      const { data: tiersData } = await supabase
        .from('ambassador_tiers')
        .select('*')
        .eq('is_active', true)
        .order('required_referrals', { ascending: true });

      setTiers(tiersData || []);

      // 5. Pobierz ustawienia programu (minimalna kwota)
      const { data: settingsData } = await supabase
        .from('ambassador_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (settingsData) {
        setSettings(settingsData);
      }

    } catch (err) {
      console.error('Błąd wczytywania danych ambasadora:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  const handleShareWhatsApp = () => {
    if (!referralLink) return;
    const text = `Hej! Trenuj ze mną w klubie Forma Marzeń. Zarejestruj się z mojego polecenia i odbierz -10% zniżki na swój pierwszy karnet: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Statystyki poleceń
  const qualifiedReferralsCount = referrals.filter(r => r.is_qualified).length;

  // Wyliczenie aktualnego i następnego progu
  let currentTier: AmbassadorTier | null = null;
  let nextTier: AmbassadorTier | null = null;

  for (let i = 0; i < tiers.length; i++) {
    if (qualifiedReferralsCount >= tiers[i].required_referrals) {
      currentTier = tiers[i];
    } else {
      nextTier = tiers[i];
      break;
    }
  }

  // Obliczenie postępu procentowego do kolejnego poziomu
  let progressPercent = 100;
  let referralsNeeded = 0;

  if (nextTier) {
    const prevThreshold = currentTier ? currentTier.required_referrals : 0;
    const stepSize = nextTier.required_referrals - prevThreshold;
    const currentStepProgress = qualifiedReferralsCount - prevThreshold;
    progressPercent = Math.min(100, Math.max(0, Math.round((currentStepProgress / stepSize) * 100)));
    referralsNeeded = nextTier.required_referrals - qualifiedReferralsCount;
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Ładowanie Twojego konta Ambasadora...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24 font-sans antialiased text-slate-800">
      
      {/* POWIADOMIENIE O SKOPIOWANIU LINKU */}
      {copiedNotification && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-900 text-emerald-100 border border-emerald-700 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
          <span>✅</span>
          <span>Twój unikalny link polecający został skopiowany do schowka!</span>
        </div>
      )}

      {/* GÓRNY BANER POWITALNY */}
      <div className="relative overflow-hidden bg-gradient-to-br from-sky-950 via-sky-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-sky-800">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 border border-amber-400/30 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider">
            ⭐ Program Ambasador • Forma Marzeń
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Polecaj klub znajomym i odbieraj rabaty na karnety!
          </h1>
          <p className="text-xs sm:text-sm text-sky-200 leading-relaxed font-medium">
            Każda osoba, która dołączy do Forma Marzeń z Twojego linku, otrzymuje 
            <strong className="text-amber-300 font-black"> 10% rabatu</strong> na swój pierwszy karnet. 
            Ty zdobywasz kolejne poziomy i zniżki na własne treningi (nawet do 50% rabatu na 18 miesięcy)!
          </p>
        </div>

        <div className="absolute -bottom-10 -right-10 text-9xl opacity-10 pointer-events-none select-none">
          🏆
        </div>
      </div>

      {/* GŁÓWNY MODUŁ: TWÓJ LINK I KOD */}
      <div className="bg-white border border-sky-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-sky-100 pb-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
            🔗 Twój Osobisty Link Polecający
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Wyślij ten link znajomemu. System automatycznie rozpozna Twoje polecenie przy rejestracji i zakupie karnetu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Kod polecający */}
          <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 text-center">
            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Twój Kod Ambasadora
            </div>
            <div className="text-2xl font-black text-sky-950 font-mono tracking-widest mt-1">
              {referralCode || 'GENEROWANIE...'}
            </div>
          </div>

          {/* Pełny link do skopiowania */}
          <div className="md:col-span-2 space-y-2">
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 bg-slate-50 border border-sky-200 rounded-xl px-4 py-3 text-xs font-mono font-bold text-slate-700 select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-5 py-3 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
              >
                <span>📋</span>
                <span>Kopiuj link</span>
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-3 rounded-xl transition-colors shadow-sm cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                title="Wyślij przez WhatsApp"
              >
                <span>💬</span>
                <span className="sm:hidden">WhatsApp</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              * Aby polecenie zostało zaliczone, nowa osoba musi zakupić karnet o wartości min. {settings.min_pass_price} PLN.
            </p>
          </div>
        </div>
      </div>

      {/* STATUS I PASEK POSTĘPU */}
      <div className="bg-white border border-sky-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sky-100 pb-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
              📊 Twój Aktualny Poziom
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Liczba Twoich aktywnych, kwalifikowanych poleceń: <strong className="text-slate-900">{qualifiedReferralsCount}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {currentTier ? (
              <span 
                className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border shadow-sm"
                style={{
                  backgroundColor: `${currentTier.badge_color}15`,
                  color: currentTier.badge_color,
                  borderColor: currentTier.badge_color
                }}
              >
                Poziom: {currentTier.name}
              </span>
            ) : (
              <span className="bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 rounded-xl text-xs font-bold uppercase">
                Status: Początkujący
              </span>
            )}
          </div>
        </div>

        {/* Pasek postępu */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-600">
              {currentTier ? `Aktualnie: ${currentTier.name}` : 'Start'}
            </span>
            <span className="text-sky-950">
              {nextTier ? `Cel: ${nextTier.name} (${referralsNeeded} ${referralsNeeded === 1 ? 'osoba' : 'osoby'} do awansu)` : 'Maksymalny poziom osiągnięty! 👑'}
            </span>
          </div>

          <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden border border-slate-200 p-0.5">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {nextTier && (
            <p className="text-[11px] text-slate-500 pt-1">
              🎁 <strong>Kolejna nagroda:</strong> {nextTier.reward_description}
            </p>
          )}
        </div>
      </div>

      {/* KAFLE POZIOMÓW I NAGRÓD */}
      <div className="space-y-3">
        <div className="px-1">
          <h2 className="text-sm font-black uppercase tracking-wider text-sky-950">
            🏅 Poziomy Programu i Nagrody
          </h2>
          <p className="text-xs text-slate-500">
            Sprawdź, jakie benefity zyskujesz po zaproszeniu kolejnych klubowiczów.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((tier) => {
            const isUnlocked = qualifiedReferralsCount >= tier.required_referrals;

            return (
              <div 
                key={tier.id}
                className={`bg-white border rounded-3xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all ${
                  isUnlocked 
                    ? 'border-emerald-400 ring-2 ring-emerald-400/20' 
                    : 'border-sky-200 opacity-90'
                }`}
              >
                <div 
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: tier.badge_color || '#0284c7' }}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between mt-1">
                    <span 
                      className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border"
                      style={{
                        borderColor: tier.badge_color,
                        color: tier.badge_color,
                        backgroundColor: `${tier.badge_color}15`
                      }}
                    >
                      {tier.name}
                    </span>

                    {isUnlocked ? (
                      <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[9px] font-black px-2 py-0.5 rounded-md uppercase">
                        ✓ Odblokowany
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase">
                        Do zdobycia
                      </span>
                    )}
                  </div>

                  <div className="text-xl font-black text-slate-900">
                    {tier.required_referrals} {tier.required_referrals === 1 ? 'polecenie' : 'poleceń'}
                  </div>

                  {/* Benefit Ambasadora */}
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase text-amber-900 mb-1">
                      🎁 Twoja nagroda:
                    </div>
                    <div className="text-xs font-bold text-slate-800 leading-snug">
                      {tier.reward_description}
                    </div>
                  </div>

                  {/* Benefit Nowej Osoby */}
                  <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase text-sky-900 mb-1">
                      🤝 Dla znajomego:
                    </div>
                    <div className="text-xs font-medium text-slate-700 leading-snug">
                      {tier.referee_reward_description || '10% rabatu na pierwszy karnet'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* HISTORIA OSÓB ZAPROSZONYCH */}
      <div className="bg-white border border-sky-200 rounded-3xl shadow-sm overflow-hidden space-y-0">
        <div className="p-6 border-b border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
              👥 Osoby Zaproszone Przez Ciebie
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Rejestr wszystkich osób, które założyły konto z Twojego linku i kupiły karnet.
            </p>
          </div>
          <span className="text-xs bg-sky-50 text-sky-900 border border-sky-200 font-bold px-3 py-1 rounded-full self-start sm:self-auto">
            Razem: {referrals.length}
          </span>
        </div>

        {referrals.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium space-y-2">
            <div className="text-3xl">🤝</div>
            <p>Nie zaprosiłeś jeszcze żadnego znajomego.</p>
            <p className="text-[11px] text-slate-500">
              Skopiuj swój link powyżej i udostępnij go znajomym, aby zacząć zbierać zniżki!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-sky-50/70 border-b border-sky-200 text-[11px] font-bold text-sky-900 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Imię i Nazwisko</th>
                  <th className="py-3.5 px-5">Kupiony Karnet</th>
                  <th className="py-3.5 px-5">Kwota Karnetu</th>
                  <th className="py-3.5 px-5 text-center">Status Nalizenia</th>
                  <th className="py-3.5 px-5 text-right">Data Rejestracji</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 text-slate-700">
                {referrals.map((item) => {
                  // Formatowanie nazwiska do formatu "Jan K." dla ochrony prywatności
                  const imie = item.referred?.Imię || 'Klubowicz';
                  const nazwisko = item.referred?.Nazwisko ? `${item.referred.Nazwisko.charAt(0)}.` : '';

                  return (
                    <tr key={item.id} className="hover:bg-sky-50/30 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        {imie} {nazwisko}
                      </td>

                      <td className="py-3.5 px-5 font-medium text-sky-950">
                        {item.pass_name}
                      </td>

                      <td className="py-3.5 px-5 font-black text-slate-800">
                        {Number(item.pass_price).toFixed(2)} PLN
                      </td>

                      <td className="py-3.5 px-5 text-center">
                        {item.is_qualified ? (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase">
                            ✓ Zaliczone
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-black px-2.5 py-0.5 rounded-md uppercase" title={`Minimalna kwota karnetu to ${settings.min_pass_price} PLN`}>
                            ✕ Poniżej min. kwoty
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-5 text-right text-slate-500 font-medium">
                        {new Date(item.created_at).toLocaleDateString('pl-PL', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
