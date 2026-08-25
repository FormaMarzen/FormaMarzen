"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

let globalCreatingLock = false;

export default function PortfelPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [transakcjeFinansowe, setTransakcjeFinansowe] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpReason, setTopUpReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;

      if (userEmail) {
        const normalizedEmail = userEmail.toLowerCase().trim();
        
        const { data: klienciList } = await supabase
          .from('klienci')
          .select('*');
          
        let klientData = klienciList ? klienciList.find((c: any) => 
          (c['E-mail'] || '').toLowerCase().trim() === normalizedEmail || 
          (c.email || '').toLowerCase().trim() === normalizedEmail
        ) : null;

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

          // 1. Pobranie historii transakcji Autopay
          const { data: autopayData } = await supabase
            .from('autopay_transakcje')
            .select('*')
            .eq('user_id', rawClient.id)
            .order('created_at', { ascending: false });

          const transactions = autopayData || [];
          setTransakcjeFinansowe(transactions);

          // 2. Automatyczna synchronizacja salda z bazy
          const rawWalletStr = rawClient.Portfel || rawClient.portfel || rawClient.wallet || '0.00 PLN';
          const isNegative = String(rawWalletStr).includes('-');
          let parsedWalletNum = parseFloat(String(rawWalletStr).replace(/[^0-9.]/g, "")) || 0;
          if (isNegative) parsedWalletNum = -Math.abs(parsedWalletNum);

          // Jeśli w historii są transakcje SUCCESS, a portfel jest pusty (0.00), synchronizujemy saldo
          const successfulTopupsTotal = transactions
            .filter((t: any) => t.status === 'success')
            .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);

          if (successfulTopupsTotal > 0 && parsedWalletNum === 0) {
            parsedWalletNum = successfulTopupsTotal;
            const syncedWalletStr = `${parsedWalletNum.toFixed(2)} PLN`;
            
            await supabase
              .from('klienci')
              .update({ Portfel: syncedWalletStr })
              .eq('id', rawClient.id);
          }

          setCurrentUser({
            ...rawClient,
            firstName: rawClient.Imię || rawClient.firstName || '',
            lastName: rawClient.Nazwisko || rawClient.lastName || '',
            wallet: `${parsedWalletNum.toFixed(2)} PLN`,
            rawWalletNum: parsedWalletNum
          });
        }
      }
    } catch (err) {
      console.error("Błąd ładowania danych portfela:", err);
      globalCreatingLock = false;
    } finally {
      setIsLoading(false);
    }
  };

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
    if (!currentUser || !topUpAmount) return;

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
    if (!currentUser) return;
    const currentWalletNum = currentUser.rawWalletNum || 0;
    if (currentWalletNum >= 0) return;

    const kwotaSplaty = Math.abs(currentWalletNum);
    const orderId = `DEBT-${currentUser.id}-${Date.now()}`.substring(0, 32);
    const opisOperacji = `Splata salda ${kwotaSplaty.toFixed(2)} PLN`;

    await redirectToAutopay(kwotaSplaty, orderId, opisOperacji, 'wallet_settlement');
  };

  if (isLoading) {
    return <div className="p-10 flex justify-center text-slate-400 font-bold uppercase text-xs">Ładowanie portfela...</div>;
  }

  const walletVal = currentUser ? currentUser.rawWalletNum : 0;
  const isNegative = walletVal < 0;

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in pb-20 font-sans antialiased text-slate-800">
      
      {/* SEKCJA 1: MÓJ PORTFEL */}
      <div className="space-y-4">
        <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">MÓJ PORTFEL</h2>
        
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-2xl border border-sky-100 shadow-sm">
              💳
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stan portfela</div>
              <div className={`text-2xl font-black ${isNegative ? 'text-rose-600' : walletVal > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                {currentUser?.wallet || '0.00 PLN'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {isNegative && (
              <button 
                onClick={handleSplatPortfela}
                disabled={isProcessingPayment}
                className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-black text-xs px-5 py-3 rounded-xl uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
              >
                {isProcessingPayment ? 'Łączenie...' : 'Spłać zadłużenie (Autopay)'}
              </button>
            )}
            <button 
              onClick={() => setIsTopUpOpen(true)}
              disabled={isProcessingPayment}
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs px-6 py-3 rounded-xl uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span className="text-base leading-none">+</span> Doładuj portfel (Autopay)
            </button>
          </div>
        </div>
      </div>

      {/* BANER PŁATNOŚCI */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-center overflow-hidden">
        <img 
          src="/autopay-banner.png" 
          alt="Dostępne metody płatności Autopay" 
          className="w-full max-h-14 sm:max-h-16 object-contain"
          onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
        />
      </div>

      {/* SEKCJA 2: HISTORIA TRANSAKCJI AUTOPAY */}
      <div className="space-y-4">
        <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">HISTORIA PŁATNOŚCI AUTOPAY</h2>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-5">DATA</th>
                  <th className="py-4 px-5">ID ZAMÓWIENIA</th>
                  <th className="py-4 px-5">KWOTA</th>
                  <th className="py-4 px-5">STATUS</th>
                  <th className="py-4 px-5">TYP / OPIS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {transakcjeFinansowe.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">Brak transakcji Autopay dla tego konta.</td>
                  </tr>
                ) : (
                  transakcjeFinansowe.map((t: any) => {
                    const kwotaNum = Number(t.amount) || 0;
                    const formattedDate = t.created_at ? t.created_at.replace('T', ' ').substring(0, 16) : '-';
                    const statusVal = t.status || 'pending';
                    const gatewayInfo = t.gateway_response;

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-5 font-mono text-slate-600">{formattedDate}</td>
                        <td className="py-4 px-5 font-mono text-slate-500">{t.order_id}</td>
                        <td className="py-4 px-5 font-bold text-slate-900">
                          +{kwotaNum.toFixed(2)} PLN
                        </td>
                        <td className="py-4 px-5 font-bold">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase ${
                            statusVal === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            statusVal === 'failed' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {statusVal}
                          </span>
                        </td>
                        <td className="py-4 px-5 font-medium text-slate-800">
                          {gatewayInfo?.opis || t.type}
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
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer">
                  Przejdź do płatności
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
