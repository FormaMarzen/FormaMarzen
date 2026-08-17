"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Bezpośrednia, bezpieczna inicjalizacja klienta Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// GLOBALNA BLOKADA (Zabezpieczenie przed podwójnym renderowaniem React Strict Mode)
let globalCreatingLock = false;

export default function PortfelPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [transakcjeFinansowe, setTransakcjeFinansowe] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
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
        
        // Pobieramy wszystkich klientów i filtrujemy ignorując wielkość liter
        const { data: klienciList, error: kError } = await supabase
          .from('klienci')
          .select('*');
          
        let klientData = klienciList ? klienciList.find((c: any) => 
          (c['E-mail'] || '').toLowerCase().trim() === normalizedEmail || 
          (c.email || '').toLowerCase().trim() === normalizedEmail
        ) : null;

        // Jeśli nie ma rekordu dla zalogowanego użytkownika, tworzymy go awaryjnie z użyciem BLOKADY
        if (!klientData) {
          if (globalCreatingLock) {
            console.log("Blokada wyścigu: inne zapytanie właśnie tworzy to konto.");
            return;
          }
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
          
          // Zwalniamy blokadę po zakończeniu
          globalCreatingLock = false;
        }
          
        if (klientData) {
          const rawClient = klientData as any;

          // Pobranie transakcji powiązanych z kontem klienta (informacyjnie do widoku)
          const { data: tData } = await supabase
            .from('transakcje')
            .select('*')
            .eq('klient_id', rawClient.id)
            .order('created_at', { ascending: false });

          const finansowe = tData ? tData.filter((t: any) => {
            const kwota = Number(t.kwota) || 0;
            const typ = (t.typ_operacji || '').toLowerCase();
            return kwota !== 0 || typ.includes('zakup') || typ.includes('uzupelnienie') || typ.includes('splata') || typ.includes('portfel');
          }) : [];

          setTransakcjeFinansowe(finansowe);

          // POBIERANIE SALDA BEZPOŚREDNIO Z TABELI KLIENCI Z AGRESYWNYM PARSOWANIEM MINUSA
          const rawWalletStr = rawClient.Portfel || rawClient.portfel || rawClient.wallet || '0.00 PLN';
          
          const isNegative = String(rawWalletStr).includes('-'); // Sprawdzamy czy gdziekolwiek jest znak ujemny
          let parsedWalletNum = parseFloat(String(rawWalletStr).replace(/[^0-9.]/g, "")) || 0; // Wyciągamy same liczby
          
          if (isNegative) {
            parsedWalletNum = -Math.abs(parsedWalletNum); // Jeśli był minus, wymuszamy wartość ujemną
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
      globalCreatingLock = false; // Zwalniamy blokadę w razie błędu try-catch
    } finally {
      setIsLoading(false);
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

    const currentWalletNum = currentUser.rawWalletNum || 0;
    const nowyStan = currentWalletNum + kwotaZmiany;
    const nowyStanStr = `${nowyStan.toFixed(2)} PLN`;

    const { error } = await supabase
      .from('klienci')
      .update({ Portfel: nowyStanStr })
      .eq('id', currentUser.id);

    if (error) {
      alert(`Błąd doładowania: ${error.message}`);
      return;
    }

    const opisOperacji = topUpReason.trim() || `Doładowanie portfela: +${kwotaZmiany.toFixed(2)} PLN`;

    await supabase.from('transakcje').insert([{
      klient_id: currentUser.id,
      typ_operacji: 'uzupelnienie_portfela',
      kwota: kwotaZmiany,
      opis: opisOperacji
    }]);

    await supabase.from('booking_logs').insert([{
      action_type: 'WALLET_TOPUP',
      status: 'SUCCESS',
      reason: `Doładowano portfel użytkownika ${currentUser.firstName} ${currentUser.lastName}: +${kwotaZmiany.toFixed(2)} PLN`,
      rule_applied: 'wallet_credit',
      payload: { klient_id: currentUser.id, kwota: kwotaZmiany, nowy_stan: nowyStanStr }
    }]);

    alert("Portfel został pomyślnie doładowany!");
    setTopUpAmount('');
    setTopUpReason('');
    setIsTopUpOpen(false);
    loadData();
  };

  const handleSplatPortfela = async () => {
    if (!currentUser) return;
    const currentWalletNum = currentUser.rawWalletNum || 0;
    if (currentWalletNum >= 0) return;

    const kwotaSplaty = Math.abs(currentWalletNum);
    const nowyStanStr = "0.00 PLN";

    const { error } = await supabase
      .from('klienci')
      .update({ Portfel: nowyStanStr })
      .eq('id', currentUser.id);

    if (error) {
      alert(`Błąd spłaty: ${error.message}`);
      return;
    }

    await supabase.from('transakcje').insert([{
      klient_id: currentUser.id,
      typ_operacji: 'splata_portfela',
      kwota: kwotaSplaty,
      opis: `Spłata ujemnego salda portfela (${kwotaSplaty.toFixed(2)} PLN)`
    }]);

    await supabase.from('booking_logs').insert([{
      action_type: 'WALLET_SETTLED',
      status: 'SUCCESS',
      reason: `Uregulowano ujemne saldo portfela użytkownika ${currentUser.firstName} ${currentUser.lastName}`,
      rule_applied: 'wallet_debt_settled',
      payload: { klient_id: currentUser.id, kwota: kwotaSplaty, nowy_stan: nowyStanStr }
    }]);

    alert("Zadłużenie zostało pomyślnie uregulowane! Blokada zapisów z tytułu ujemnego salda została zdjęta.");
    loadData();
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
                className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-5 py-3 rounded-xl uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
              >
                Spłać zadłużenie
              </button>
            )}
            <button 
              onClick={() => setIsTopUpOpen(true)}
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-6 py-3 rounded-xl uppercase tracking-wider shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span className="text-base leading-none">+</span> Doładuj portfel
            </button>
          </div>
        </div>
      </div>

      {/* SEKCJA 2: HISTORIA TRANSAKCJI FINANSOWYCH */}
      <div className="space-y-4">
        <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">HISTORIA TRANSAKCJI FINANSOWYCH</h2>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-5">DATA</th>
                  <th className="py-4 px-5">KWOTA</th>
                  <th className="py-4 px-5">OPIS OPERACJI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {transakcjeFinansowe.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400">Brak historii transakcji finansowych.</td>
                  </tr>
                ) : (
                  transakcjeFinansowe.map((t: any) => {
                    const kwotaNum = Number(t.kwota) || 0;
                    const isPositive = kwotaNum >= 0;
                    const formattedDate = t.created_at ? t.created_at.replace('T', ' ').substring(0, 16) : '-';

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-5 font-mono text-slate-600">{formattedDate}</td>
                        <td className={`py-4 px-5 font-bold flex items-center gap-1.5 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          <span>{isPositive ? '▲' : '▼'}</span> {isPositive ? `+${kwotaNum.toFixed(2)}` : kwotaNum.toFixed(2)} PLN
                        </td>
                        <td className="py-4 px-5 font-medium text-slate-800">{t.opis || t.typ_operacji}</td>
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
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">💳 Doładuj portfel</h3>
              <button onClick={() => setIsTopUpOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleTopUpSubmit} className="space-y-4 text-xs">
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-sky-900 font-medium">
                Wprowadź kwotę, o jaką chcesz zwiększyć środki w swoim portfelu klubowym.
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
                  placeholder="np. Doładowanie online"
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
                  Doładuj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
