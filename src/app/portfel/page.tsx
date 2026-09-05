"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let globalCreatingLock = false;

// Pomocnik do identyfikacji karnetu na umowę
const isContractPass = (k: any) => {
  if (!k) return false;
  const lower = (k.nazwa || k.pass || '').toLowerCase();
  const typ = (k.typKarnetu || k.typ_karnetu || '').toLowerCase();
  return k.isContract12M === true || typ.includes('umowa') || lower.includes('umowa');
};

export default function PortfelPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [historiaWszystkichOperacji, setHistoriaWszystkichOperacji] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'autopay' | 'wallet'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpReason, setTopUpReason] = useState('');

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;

      if (userEmail) {
        const normalizedEmail = userEmail.toLowerCase().trim();
        
        // Bezpośrednie wyszukiwanie klienta po e-mailu
        let { data: directClient } = await supabase
          .from('klienci')
          .select('*')
          .or(`E-mail.ilike.${normalizedEmail},email.ilike.${normalizedEmail}`)
          .maybeSingle();

        let klientData = directClient;

        // Fallback z limitem 5000 i sortowaniem od najnowszych
        if (!klientData) {
          const { data: klienciList } = await supabase
            .from('klienci')
            .select('*')
            .order('id', { ascending: false })
            .limit(5000);
            
          klientData = klienciList ? klienciList.find((c: any) => 
            (c['E-mail'] || '').toLowerCase().trim() === normalizedEmail || 
            (c.email || '').toLowerCase().trim() === normalizedEmail
          ) : null;
        }

        if (!klientData) {
          if (globalCreatingLock) return;
          globalCreatingLock = true;

          const newClientId = Date.now();
          const defaultClient = {
            id: newClientId,
            Imię: userEmail.split('@')[0],
            Nazwisko: 'Klubowicz',
            "E-mail": userEmail,
            "Numer tel.": '-',
            Portfel: '0.00 PLN',
            Zarejestrowany: new Date().toISOString().split('T')[0],
            karnetyKlubowicza: []
          };

          const { error: insertErr } = await supabase.from('klienci').insert([defaultClient]);
          if (!insertErr) {
            klientData = defaultClient;
          }
          globalCreatingLock = false;
        }
          
        if (klientData) {
          const rawClient = klientData as any;

          // Równoległe pobranie transakcji online Autopay oraz operacji ogólnych
          const [{ data: autopayData }, { data: localTransData }] = await Promise.all([
            supabase
              .from('autopay_transakcje')
              .select('*')
              .eq('user_id', rawClient.id)
              .order('created_at', { ascending: false })
              .limit(2000),
            supabase
              .from('transakcje')
              .select('*')
              .eq('klient_id', rawClient.id)
              .order('created_at', { ascending: false })
              .limit(2000)
          ]);

          // Połączenie i selekcja transakcji finansowych z ochroną przed duplikatami
          const combinedHistory: any[] = [];
          const processedOrderIds = new Set<string>();
          const processedUniqueSignatures = new Set<string>();

          // A. Filtrowanie tabeli ogólnej transakcje
          if (localTransData && localTransData.length > 0) {
            localTransData.forEach((t: any) => {
              const kwotaVal = Number(t.kwota);
              const typ = (t.typ_operacji || '').toLowerCase();
              const opis = (t.opis || '').toLowerCase();

              const isNonFinancialLog = 
                (typ.includes('zajecia') ||
                typ.includes('zapis') ||
                typ.includes('wypis') ||
                typ.includes('usuniecie') ||
                typ.includes('blokada') ||
                opis.includes('zapisano na zajęcia') ||
                opis.includes('wypisanie z zajęć') ||
                opis.includes('wypisano z') ||
                opis.includes('usunięcie karnetu') ||
                opis.includes('auto-blokada') ||
                opis.includes('obłożenie:')) &&
                !typ.includes('oplata_umowa') &&
                !opis.includes('umow');

              if (isNonFinancialLog) return;
              if (isNaN(kwotaVal) || kwotaVal === 0) return;

              const isAutopayType = typ.includes('autopay');
              const uniqueSig = `${t.created_at || t.data}_${kwotaVal}_${t.opis}`;
              if (processedUniqueSignatures.has(uniqueSig)) return;
              processedUniqueSignatures.add(uniqueSig);
              
              combinedHistory.push({
                id: `loc-${t.id}`,
                data: t.created_at || t.data || new Date().toISOString(),
                opis: t.opis || (kwotaVal < 0 ? 'Wypłata / Zakup z portfela' : 'Uznanie portfela'),
                zrodlo: isAutopayType ? 'Bramka Autopay' : 'Saldo Portfela',
                kategoria: isAutopayType ? 'autopay' : 'wallet',
                kwota: kwotaVal,
                status: 'success',
                statusTekst: 'Zrealizowana',
                kodRabatowy: t.kod_rabatowy || null
              });
            });
          }

          // B. Dołączanie transakcji z tabeli autopay_transakcje bez duplikacji
          if (autopayData && autopayData.length > 0) {
            autopayData.forEach((a: any) => {
              const kwotaVal = Number(a.amount) || 0;
              const statusVal = a.status || 'pending';
              const gatewayInfo = a.gateway_response;

              if (a.type === 'pass_purchase' || a.type === 'pass_extend' || a.type === 'contract_installment') {
                if (processedOrderIds.has(a.order_id)) return;
                processedOrderIds.add(a.order_id);
              }

              let defaultOpis = 'Doładowanie portfela Autopay';
              if (a.type === 'wallet_settlement') defaultOpis = 'Spłata zadłużenia portfela (Autopay)';
              else if (a.type === 'pass_purchase') defaultOpis = 'Zakup karnetu (Płatność Autopay)';
              else if (a.type === 'pass_extend') defaultOpis = 'Przedłużenie karnetu (Płatność Autopay)';
              else if (a.type === 'contract_installment') defaultOpis = 'Opłata za karnet na umowę (Płatność Autopay)';

              const itemOpis = gatewayInfo?.opis || defaultOpis;
              const uniqueSig = `${a.created_at}_${kwotaVal}_${itemOpis}`;
              if (processedUniqueSignatures.has(uniqueSig)) return;
              processedUniqueSignatures.add(uniqueSig);

              combinedHistory.push({
                id: `ap-${a.id}`,
                data: a.created_at || new Date().toISOString(),
                opis: itemOpis,
                zrodlo: 'Bramka Autopay',
                kategoria: 'autopay',
                kwota: a.type === 'wallet_topup' || a.type === 'wallet_settlement' ? Math.abs(kwotaVal) : (statusVal === 'success' ? Math.abs(kwotaVal) : kwotaVal),
                status: statusVal,
                statusTekst: statusVal === 'success' ? 'Opłacona' : statusVal === 'failed' ? 'Nieudana' : 'Oczekuje',
                orderId: a.order_id
              });
            });
          }

          combinedHistory.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
          setHistoriaWszystkichOperacji(combinedHistory);

          // Formatowanie stanu salda portfela
          const rawWalletStr = rawClient.Portfel || rawClient.portfel || rawClient.wallet || '0.00 PLN';
          const isNegativeWallet = String(rawWalletStr).includes('-');
          let parsedWalletNum = parseFloat(String(rawWalletStr).replace(/[^0-9.]/g, "")) || 0;
          if (isNegativeWallet) parsedWalletNum = -Math.abs(parsedWalletNum);

          let parsedKarnety = [];
          if (Array.isArray(rawClient.karnetyKlubowicza)) {
            parsedKarnety = rawClient.karnetyKlubowicza;
          } else if (typeof rawClient.karnetyKlubowicza === 'string') {
            try { parsedKarnety = JSON.parse(rawClient.karnetyKlubowicza); } catch(e) {}
          }

          setCurrentUser({
            ...rawClient,
            firstName: rawClient.Imię || rawClient.firstName || '',
            lastName: rawClient.Nazwisko || rawClient.lastName || '',
            wallet: `${parsedWalletNum.toFixed(2)} PLN`,
            rawWalletNum: parsedWalletNum,
            karnetyKlubowicza: parsedKarnety,
            umowa_oplacona_do: rawClient.umowa_oplacona_do || null
          });
        }
      }
    } catch (err) {
      console.error("Błąd ładowania danych portfela:", err);
      globalCreatingLock = false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('status') === 'success') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [loadData]);

  const redirectToAutopay = async (amount: number, orderId: string, description: string, type: string) => {
    setIsProcessingPayment(true);
    try {
      const response = await fetch('/api/autopay/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          orderId: orderId,
          userId: currentUser.id,
          description: description,
          email: currentUser["E-mail"] || currentUser.email || '',
          type: type
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

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !topUpAmount || isProcessingPayment) return;

    const kwotaZmiany = parseFloat(topUpAmount);
    if (isNaN(kwotaZmiany) || kwotaZmiany <= 0) {
      alert("Wprowadź poprawną kwotę większą od zera.");
      return;
    }

    const orderId = `TOP-${currentUser.id}-${Date.now()}`.substring(0, 32);
    const opisOperacji = topUpReason.trim() || `Doladowanie portfela ${kwotaZmiany.toFixed(2)} PLN`;

    setIsTopUpOpen(false);
    await redirectToAutopay(kwotaZmiany, orderId, opisOperacji, 'wallet_topup');
  };

  const handleSplatPortfela = async () => {
    if (!currentUser || isProcessingPayment) return;
    const currentWalletNum = currentUser.rawWalletNum || 0;
    if (currentWalletNum >= 0) return;

    const kwotaSplaty = Math.abs(currentWalletNum);
    const orderId = `DEBT-${currentUser.id}-${Date.now()}`.substring(0, 32);
    const opisOperacji = `Splata zadluzenia portfela ${kwotaSplaty.toFixed(2)} PLN`;

    await redirectToAutopay(kwotaSplaty, orderId, opisOperacji, 'wallet_settlement');
  };

  const walletVal = useMemo(() => {
    return currentUser ? currentUser.rawWalletNum : 0;
  }, [currentUser]);

  const isNegative = useMemo(() => walletVal < 0, [walletVal]);

  // Karnet na umowę i kalkulacja rozliczenia
  const activeContractPass = useMemo(() => {
    if (!currentUser?.karnetyKlubowicza) return null;
    return currentUser.karnetyKlubowicza.find((k: any) => isContractPass(k)) || null;
  }, [currentUser]);

  const contractMonthlyFee = useMemo(() => {
    if (!activeContractPass) return 0;
    const cenaStr = String(activeContractPass.cena || '0');
    return parseFloat(cenaStr.replace(/[^0-9.]/g, '')) || 0;
  }, [activeContractPass]);

  const contractBillingInfo = useMemo(() => {
    if (!activeContractPass) return null;
    const now = new Date();
    const day = now.getDate();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const firstDayOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const endOfMonthStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
    
    const oplaconaDo = currentUser?.umowa_oplacona_do || null;
    const isPaidThisMonth = oplaconaDo && String(oplaconaDo) >= firstDayOfMonthStr;

    let statusType: 'paid' | 'pending' | 'blocked' | 'cancelled' = 'pending';
    let statusMessage = '';

    if (isPaidThisMonth) {
      statusType = 'paid';
      statusMessage = `Opłacony za bieżący miesiąc (do ${oplaconaDo})`;
    } else if (day <= 3) {
      statusType = 'pending';
      statusMessage = `Termin płatności do 3. dnia miesiąca (pozostało ${Math.max(0, 3 - day)} dni)`;
    } else if (day < 7) {
      statusType = 'blocked';
      statusMessage = `Zaległość! Zapisy na zajęcia zostały zablokowane (brak wpłaty do 3. dnia miesiąca).`;
    } else {
      statusType = 'cancelled';
      statusMessage = `Zaległość krytyczna! 7. dnia nastąpiło automatyczne wypisanie ze wszystkich zajęć.`;
    }

    return {
      isPaidThisMonth,
      oplaconaDo,
      statusType,
      statusMessage,
      endOfMonthStr,
      year,
      month
    };
  }, [activeContractPass, currentUser]);

  // OPŁATA RATY UMOWY ZE ŚRODKÓW W PORTFELU
  const handlePayContractFromWallet = async () => {
    if (!currentUser || !activeContractPass || !contractBillingInfo || isProcessingPayment) return;

    if (walletVal < contractMonthlyFee) {
      alert(`Niewystarczające środki w portfelu! Doładuj portfel kwotą min. ${(contractMonthlyFee - walletVal).toFixed(2)} PLN lub opłać przez Autopay.`);
      return;
    }

    if (!confirm(`Czy na pewno chcesz opłacić ratę za karnet na umowę (${contractMonthlyFee.toFixed(2)} PLN) z salda portfela?`)) {
      return;
    }

    setIsProcessingPayment(true);
    try {
      // Wyznaczenie daty opłacenia
      let targetPaidUntil = contractBillingInfo.endOfMonthStr;
      if (contractBillingInfo.isPaidThisMonth && contractBillingInfo.oplaconaDo) {
        // Jeśli już opłacone za ten miesiąc, przedłużamy o kolejny miesiąc
        const nextMonthDate = new Date(contractBillingInfo.year, contractBillingInfo.month, 1);
        const lastDayNextMonth = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 0).getDate();
        targetPaidUntil = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(lastDayNextMonth).padStart(2, '0')}`;
      }

      const newWalletNum = walletVal - contractMonthlyFee;
      const newWalletStr = `${newWalletNum.toFixed(2)} PLN`;

      // Aktualizacja raty w karnecie
      let updatedKarnety = (currentUser.karnetyKlubowicza || []).map((k: any) => {
        if (isContractPass(k)) {
          let updatedRata = k.rata || '1 / 12';
          if (typeof updatedRata === 'string' && updatedRata.includes('/')) {
            const parts = updatedRata.split('/');
            const currentRataNum = parseInt(parts[0].trim(), 10) || 1;
            const maxRata = parts[1].trim();
            updatedRata = `${Math.min(parseInt(maxRata, 10) || 12, currentRataNum + 1)} / ${maxRata}`;
          }
          return {
            ...k,
            rata: updatedRata,
            blokadaDo: null,
            powodBlokady: null,
            statusTekst: `Umowa 12M (Rata ${updatedRata} • Ważny do: ${k.waznyDo})`
          };
        }
        return k;
      });

      const updatePayload: any = {
        Portfel: newWalletStr,
        umowa_oplacona_do: targetPaidUntil,
        karnetyKlubowicza: updatedKarnety
      };

      // Jeżeli blokada konta była spowodowana brakiem wpłaty za umowę, zdejmujemy ją
      const isBlockedForContract = currentUser.powodBlokady?.toLowerCase().includes('umow') || currentUser.powodBlokady?.toLowerCase().includes('umowę');
      if (isBlockedForContract) {
        updatePayload.blokadaDo = null;
        updatePayload.powodBlokady = null;
      }

      const { error: clientErr } = await supabase
        .from('klienci')
        .update(updatePayload)
        .eq('id', currentUser.id);

      if (clientErr) throw clientErr;

      // Zapis w tabeli transakcje
      await supabase.from('transakcje').insert([{
        klient_id: currentUser.id,
        typ_operacji: 'oplata_umowa',
        kwota: -contractMonthlyFee,
        opis: `Opłata za karnet na umowę: ${activeContractPass.nazwa} (opłacono do ${targetPaidUntil}) - Portfel`
      }]);

      await supabase.from('booking_logs').insert([{
        action_type: 'CONTRACT_PAID_WALLET',
        status: 'SUCCESS',
        reason: `Klubowicz ID:${currentUser.id} opłacił ratę umowy z portfela do ${targetPaidUntil}.`,
        rule_applied: 'contract_wallet_settlement',
        payload: { klient_id: currentUser.id, amount: contractMonthlyFee, paid_until: targetPaidUntil }
      }]);

      alert(`Pomyślnie opłacono ratę umowy (${contractMonthlyFee.toFixed(2)} PLN)! Ważność opłacenia przedłużona do ${targetPaidUntil}.`);
      await loadData();
    } catch (err: any) {
      console.error("Błąd opłaty umowy z portfela:", err);
      alert(`Wystąpił błąd podczas opłacania umowy: ${err.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // OPŁATA RATY UMOWY PRZEZ AUTOPAY ONLINE
  const handlePayContractViaAutopay = async () => {
    if (!currentUser || !activeContractPass || isProcessingPayment) return;

    const orderId = `CON-${currentUser.id}-${Date.now()}`.substring(0, 32);
    const opis = `Rata karnetu na umowe: ${activeContractPass.nazwa}`.substring(0, 100);

    await redirectToAutopay(contractMonthlyFee, orderId, opis, 'contract_installment');
  };

  const filteredHistory = useMemo(() => {
    return historiaWszystkichOperacji.filter((item) => {
      if (activeFilter === 'autopay') return item.kategoria === 'autopay';
      if (activeFilter === 'wallet') return item.kategoria === 'wallet';
      return true;
    });
  }, [historiaWszystkichOperacji, activeFilter]);

  if (isLoading) {
    return <div className="p-10 flex justify-center text-slate-400 font-bold uppercase text-xs">Ładowanie portfela...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in pb-20 font-sans antialiased text-slate-800">
      
      {/* SEKCJA 1: MÓJ PORTFEL */}
      <div className="space-y-4">
        <h2 className="text-[12px] font-black text-slate-400 uppercase tracking-widest">MÓJ PORTFEL</h2>
        
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-sky-50 rounded-2xl flex items-center justify-center text-xl border border-sky-100 shadow-sm shrink-0">
              💳
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Stan portfela</div>
              <div className={`text-xl sm:text-2xl font-black ${isNegative ? 'text-rose-600' : walletVal > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                {currentUser?.wallet || '0.00 PLN'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {isNegative && (
              <button 
                onClick={handleSplatPortfela}
                disabled={isProcessingPayment}
                className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-[11px] sm:text-xs px-4 py-2.5 rounded-xl uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
              >
                {isProcessingPayment ? 'Łączenie...' : 'Spłać zadłużenie (Autopay)'}
              </button>
            )}
            <button 
              onClick={() => setIsTopUpOpen(true)}
              disabled={isProcessingPayment}
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-[11px] sm:text-xs px-5 py-2.5 rounded-xl uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="text-sm leading-none">+</span> Doładuj portfel (Autopay)
            </button>
          </div>
        </div>
      </div>

      {/* SEKCJA ROZLICZENIA UMOWY 12M */}
      {activeContractPass && contractBillingInfo && (
        <div className="space-y-4">
          <h2 className="text-[12px] font-black text-slate-400 uppercase tracking-widest">
            ROZLICZENIE UMOWY (12 MIESIĘCY)
          </h2>

          <div className={`rounded-2xl p-5 sm:p-6 shadow-sm border space-y-4 ${
            contractBillingInfo.statusType === 'paid' 
              ? 'bg-emerald-50/50 border-emerald-200' 
              : contractBillingInfo.statusType === 'blocked' || contractBillingInfo.statusType === 'cancelled'
              ? 'bg-rose-50/60 border-rose-300'
              : 'bg-amber-50/50 border-amber-200'
          }`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">📄</span>
                  <span className="font-black text-sm text-slate-900 uppercase">
                    {activeContractPass.nazwa}
                  </span>
                  <span className="bg-slate-900 text-white text-[10px] font-mono px-2 py-0.5 rounded-md font-bold">
                    Rata: {activeContractPass.rata || '1 / 12'}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-600">
                  {contractBillingInfo.statusMessage}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-[10px] uppercase font-bold text-slate-500">Miesięczna rata:</div>
                <div className="text-lg font-black text-slate-900">
                  {contractMonthlyFee.toFixed(2)} PLN
                </div>
              </div>
            </div>

            {/* Ostrzeżenie dyscypliny płatności */}
            <div className="bg-white/80 rounded-xl p-3 text-[11px] text-slate-600 leading-relaxed border border-slate-200/60">
              💡 <strong>Zasady rozliczenia:</strong> Płatność za dany miesiąc kalendarzowy należy uregulować do <strong>3. dnia miesiąca</strong>. W przypadku braku opłaty, 4. dnia system automatycznie nakłada blokadę zapisów na treningi, a 7. dnia następuje automatyczne wypisanie ze wszystkich zajęć.
            </div>

            {/* Przyciski opłacenia raty */}
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                onClick={handlePayContractFromWallet}
                disabled={isProcessingPayment}
                className={`flex-1 sm:flex-none font-black text-[11px] sm:text-xs px-5 py-2.5 rounded-xl uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  walletVal >= contractMonthlyFee
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                }`}
                title={walletVal < contractMonthlyFee ? "Niewystarczające saldo w portfelu" : "Opłać ratę ze środków w portfelu"}
              >
                <span>👛</span> Opłać z portfela ({contractMonthlyFee.toFixed(2)} PLN)
              </button>

              <button
                onClick={handlePayContractViaAutopay}
                disabled={isProcessingPayment}
                className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] sm:text-xs px-5 py-2.5 rounded-xl uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>💳</span> Opłać online (Autopay)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BANER METOD PŁATNOŚCI */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-sm flex items-center justify-center overflow-hidden">
        <img 
          src="/autopay-banner.png" 
          alt="Dostępne metody płatności Autopay" 
          className="w-full max-h-12 sm:max-h-14 object-contain"
          onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      {/* SEKCJA 2: HISTORIA TRANSAKCJI FINANSOWYCH */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-[12px] font-black text-slate-400 uppercase tracking-widest">
            HISTORIA TRANSAKCJI FINANSOWYCH
          </h2>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Wszystkie ({historiaWszystkichOperacji.length})
            </button>
            <button
              onClick={() => setActiveFilter('autopay')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeFilter === 'autopay' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Autopay Online
            </button>
            <button
              onClick={() => setActiveFilter('wallet')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeFilter === 'wallet' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Operacje Portfela
            </button>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="w-full">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[9px] sm:text-[10px]">
                  <th className="py-2.5 sm:py-3 px-2 sm:px-3.5 w-28 sm:w-32">DATA</th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-3.5">OPIS TRANSAKCJI</th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-3.5 w-28 sm:w-36 text-center">METODA</th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-3.5 w-24 sm:w-28 text-right">KWOTA</th>
                  <th className="py-2.5 sm:py-3 px-2 sm:px-3.5 w-20 sm:w-24 text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px] sm:text-xs">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                      Brak transakcji finansowych w wybranej kategorii.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item: any) => {
                    const kwotaNum = Number(item.kwota) || 0;
                    const formattedDate = item.data ? item.data.replace('T', ' ').substring(0, 16) : '-';
                    const isPositive = (kwotaNum > 0 && item.kategoria === 'autopay') || item.opis.includes('Doładowanie') || item.opis.includes('Spłata');
                    const isNegativeAmount = kwotaNum < 0 || (!isPositive && item.kategoria === 'wallet');

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 sm:py-3 px-2 sm:px-3.5 font-mono text-slate-500 text-[10px] sm:text-[11px] whitespace-nowrap align-top">
                          {formattedDate}
                        </td>
                        <td className="py-2.5 sm:py-3 px-2 sm:px-3.5 font-medium text-slate-900 align-top">
                          <div className="font-bold leading-tight break-words text-[11px] sm:text-xs">{item.opis}</div>
                          {item.orderId && (
                            <div className="text-[9px] font-mono text-slate-400 mt-0.5 break-all">ID: {item.orderId}</div>
                          )}
                          {item.kodRabatowy && (
                            <div className="text-[9px] text-emerald-600 font-bold mt-0.5">Kod: {item.kodRabatowy}</div>
                          )}
                        </td>
                        <td className="py-2.5 sm:py-3 px-2 sm:px-3.5 text-center align-top whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold uppercase ${
                            item.zrodlo === 'Bramka Autopay' 
                              ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {item.zrodlo === 'Bramka Autopay' ? '💳 Autopay' : '👛 Portfel'}
                          </span>
                        </td>
                        <td className="py-2.5 sm:py-3 px-2 sm:px-3.5 font-black text-right whitespace-nowrap align-top text-[11px] sm:text-xs">
                          <span className={isPositive ? 'text-emerald-600' : isNegativeAmount ? 'text-rose-600' : 'text-slate-900'}>
                            {isPositive ? `+${Math.abs(kwotaNum).toFixed(2)}` : `-${Math.abs(kwotaNum).toFixed(2)}`} PLN
                          </span>
                        </td>
                        <td className="py-2.5 sm:py-3 px-2 sm:px-3.5 text-right font-bold whitespace-nowrap align-top">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase ${
                            item.status === 'success' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            item.status === 'failed' 
                              ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {item.statusTekst}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL DOŁADOWANIA PORTFELA */}
      {isTopUpOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">💳 Doładuj portfel (Autopay)</h3>
              <button onClick={() => setIsTopUpOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleTopUpSubmit} className="space-y-4 text-xs">
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-sky-900 font-medium">
                Wprowadź kwotę doładowania portfela realizowanego przez bramkę płatności Autopay.
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Kwota doładowania (PLN) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="1"
                  required
                  placeholder="np. 50.00"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-3 font-bold focus:outline-none focus:border-blue-500 text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Tytuł / Opis (opcjonalnie)</label>
                <input 
                  type="text" 
                  placeholder="np. Doladowanie online"
                  value={topUpReason}
                  onChange={(e) => setTopUpReason(e.target.value)}
                  className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-3 font-bold focus:outline-none focus:border-blue-500 text-slate-800"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsTopUpOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer">
                  Anuluj
                </button>
                <button 
                  type="submit" 
                  disabled={isProcessingPayment}
                  className={`bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer ${
                    isProcessingPayment ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isProcessingPayment ? 'Łączenie...' : 'Przejdź do płatności'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
