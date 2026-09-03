"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type TransactionCategory = 'all' | 'karnet' | 'portfel' | 'wyzwanie' | 'odziez' | 'sklep';

interface TransactionItem {
  id: string | number;
  createdAt: string;
  dataOperacji: string;
  godzinaOperacji: string;
  klientId: number | string;
  klientImieNazwisko: string;
  klientEmail: string;
  typOperacji: string;
  typKategoria: 'karnet' | 'portfel' | 'wyzwanie' | 'odziez' | 'sklep' | 'inne';
  kwota: number;
  isRefund: boolean;
  opis: string;
}

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TransactionCategory>('all');
  
  // Domyślny zakres dat - bieżący miesiąc
  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, [today]);
  const defaultEnd = useMemo(() => {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }, [today]);
  
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  
  const datePickerRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

  // Kategoryzacja transakcji na podstawie typu i opisu
  const detectCategory = useCallback((typ: string, opis: string): TransactionItem['typKategoria'] => {
    const raw = `${typ} ${opis}`.toLowerCase();
    if (raw.includes('wyzwan') || raw.includes('challenge')) return 'wyzwanie';
    if (raw.includes('odziez') || raw.includes('odzież') || raw.includes('ubran') || raw.includes('koszulk') || raw.includes('bluz') || raw.includes('leggins')) return 'odziez';
    if (raw.includes('sklep') || raw.includes('produkt') || raw.includes('akcesori') || raw.includes('napój') || raw.includes('baton') || raw.includes('suplement')) return 'sklep';
    if (raw.includes('karnet') || raw.includes('wejsc') || raw.includes('wejść') || raw.includes('karnetu') || raw.includes('rejestracja z zakupem')) return 'karnet';
    if (raw.includes('portfel') || raw.includes('doładowanie') || raw.includes('doladowanie') || raw.includes('uzupelnienie') || raw.includes('splata') || raw.includes('korekta') || raw.includes('wplata') || raw.includes('wpłata')) return 'portfel';
    return 'inne';
  }, []);

  // Inteligentne wyciąganie kwoty z rekordu lub opisu operacji (np. Autopay)
  const extractAmount = (rawKwota: any, opis: string): number | null => {
    let val = rawKwota !== null && rawKwota !== undefined ? parseFloat(String(rawKwota)) : null;
    if (val !== null && !isNaN(val) && Math.abs(val) > 0) {
      return Math.abs(val);
    }
    if (opis) {
      const match = opis.match(/(?:autopay online|kwota|cena|wartość)?[:\s]*(\d+(?:[.,]\d{1,2})?)\s*(?:pln|zł)/i);
      if (match && match[1]) {
        const parsed = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return null;
  };

  const fetchTransactions = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      const [transakcjeRes, klienciRes] = await Promise.all([
        supabase
          .from('transakcje')
          .select('*')
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`)
          .order('created_at', { ascending: false })
          .limit(10000),
        supabase
          .from('klienci')
          .select('*')
          .order('id', { ascending: false })
          .limit(5000)
      ]);

      if (transakcjeRes.error) throw transakcjeRes.error;
      if (klienciRes.error) throw klienciRes.error;

      const clientsMap = new Map<string, any>();
      ((klienciRes.data as any[]) || []).forEach(k => {
        clientsMap.set(String(k.id), k);
      });

      // Czarna lista zdarzeń czysto administracyjnych, technicznych i audytowych
      const ignoredTypes = new Set([
        'zajecia_zapis',
        'zajecia_wypis',
        'zajecia_awans_rezerwa',
        'usuniecie_zajec',
        'odwolanie_zajec',
        'edycja_karnetu',
        'usuniecie_karnetu',
        'utrata_ciaglosci',
        'rezerwacja',
        'obecnosc'
      ]);

      const enriched: TransactionItem[] = [];
      const seenTransactionIds = new Set<string | number>();

      ((transakcjeRes.data as any[]) || []).forEach(t => {
        if (seenTransactionIds.has(t.id)) return;

        const typLower = (t.typ_operacji || '').toLowerCase().trim();
        const opisLower = (t.opis || '').toLowerCase();

        // Wykluczanie logów technicznych
        if (ignoredTypes.has(typLower)) return;
        if (
          opisLower.includes('ręczna modyfikacja') ||
          opisLower.includes('ręczne usunięcie') ||
          opisLower.includes('automatyczne usunięcie') ||
          opisLower.includes('usunięto zajęcia') ||
          opisLower.includes('odwołano zajęcia')
        ) {
          return;
        }

        // Kwota transakcji – sprawdzamy czy to rzeczywista transakcja finansowa
        const parsedKwota = extractAmount(t.kwota, t.opis || '');
        if (parsedKwota === null || parsedKwota <= 0) {
          // Odrzucenie transakcji zerowych i niefinansowych
          return;
        }

        seenTransactionIds.add(t.id);

        const klient = clientsMap.get(String(t.klient_id));
        const imieNazwisko = klient 
          ? `${klient.Imię || klient.firstName || ''} ${klient.Nazwisko || klient.lastName || ''}`.trim() 
          : 'Klubowicz';
        const email = klient ? klient['E-mail'] || klient.email || '' : '';

        const dt = new Date(t.created_at);
        const dataOperacji = isNaN(dt.getTime())
          ? (t.data || '')
          : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        const godzinaOperacji = isNaN(dt.getTime())
          ? ''
          : `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

        const isRefund = typLower.includes('zwrot') || opisLower.includes('zwrot');

        enriched.push({
          id: t.id,
          createdAt: t.created_at,
          dataOperacji,
          godzinaOperacji,
          klientId: t.klient_id,
          klientImieNazwisko: imieNazwisko,
          klientEmail: email,
          typOperacji: t.typ_operacji || 'płatność',
          typKategoria: detectCategory(t.typ_operacji || '', t.opis || ''),
          kwota: parsedKwota,
          isRefund,
          opis: t.opis || 'Transakcja finansowa'
        });
      });

      setTransactions(enriched);
    } catch (err) {
      console.error("Błąd podczas pobierania transakcji:", err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [startDate, endDate, detectCategory]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return transactions.filter(t => {
      const matchesSearch = 
        !query ||
        t.klientImieNazwisko.toLowerCase().includes(query) ||
        t.klientEmail.toLowerCase().includes(query) ||
        t.opis.toLowerCase().includes(query) ||
        t.typOperacji.toLowerCase().includes(query);

      if (!matchesSearch) return false;
      if (categoryFilter !== 'all' && t.typKategoria !== categoryFilter) return false;

      return true;
    });
  }, [transactions, searchQuery, categoryFilter]);

  // Podsumowanie finansowe (wszystkie transakcje przychodzące to zysk klubu)
  const totalRevenue = useMemo(() => {
    return filteredTransactions.reduce((acc, curr) => {
      return curr.isRefund ? acc - curr.kwota : acc + curr.kwota;
    }, 0);
  }, [filteredTransactions]);

  const totalTransactionsCount = filteredTransactions.length;

  const averageTransactionValue = useMemo(() => {
    if (totalTransactionsCount === 0) return 0;
    return totalRevenue / totalTransactionsCount;
  }, [totalRevenue, totalTransactionsCount]);

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      alert("Brak danych do wyeksportowania.");
      return;
    }

    const headers = ["Data", "Godzina", "Klubowicz", "Email", "Kategoria", "Typ operacji", "Wpływ (PLN)", "Opis"];
    const rows = filteredTransactions.map(t => [
      t.dataOperacji,
      t.godzinaOperacji,
      `"${t.klientImieNazwisko.replace(/"/g, '""')}"`,
      `"${t.klientEmail.replace(/"/g, '""')}"`,
      t.typKategoria.toUpperCase(),
      `"${t.typOperacji.replace(/"/g, '""')}"`,
      (t.isRefund ? -t.kwota : t.kwota).toFixed(2),
      `"${t.opis.replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Transakcje_Finansowe_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getBadgeStyle = (category: TransactionItem['typKategoria']) => {
    switch (category) {
      case 'karnet':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'portfel':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'wyzwanie':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'odziez':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'sklep':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getCategoryLabel = (category: TransactionItem['typKategoria']) => {
    switch (category) {
      case 'karnet':
        return '💳 Karnet';
      case 'portfel':
        return '💰 Portfel';
      case 'wyzwanie':
        return '🏆 Wyzwanie';
      case 'odziez':
        return '👕 Odzież';
      case 'sklep':
        return '🛍️ Sklep';
      default:
        return '💵 Finanse';
    }
  };

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 relative font-sans antialiased text-slate-800">
      
      {/* Pasek Nagłówka */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-sky-200 pb-4">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
            <span>💳</span> Rejestr Operacji Finansowych
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Wpływy i rzeczywiste transakcje finansowe klubu: karnety, doładowania portfeli, wyzwania i odzież
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchTransactions}
            title="Odśwież dane"
            className="p-2.5 bg-white border border-sky-200 text-sky-700 rounded-xl hover:bg-sky-50 shadow-sm transition-all cursor-pointer font-bold text-xs flex items-center gap-2"
          >
            <span>🔄</span> Odśwież
          </button>
          <button 
            onClick={handleExportCSV}
            title="Eksportuj do CSV"
            className="p-2.5 bg-sky-900 hover:bg-sky-800 text-white rounded-xl shadow-sm transition-all cursor-pointer font-bold text-xs flex items-center gap-2 uppercase tracking-wider"
          >
            <span>📥</span> Eksport CSV
          </button>
        </div>
      </div>

      {/* Karty podsumowań finansowych */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-full -z-10 opacity-70"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Łączny wpływ w okresie</span>
          <div className="text-3xl font-black text-emerald-600">
            +{totalRevenue.toFixed(2)} PLN
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Rzeczywisty przychód z transakcji
          </div>
        </div>

        <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-sky-50 rounded-bl-full -z-10 opacity-70"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Liczba transakcji</span>
          <div className="text-3xl font-black text-sky-950">
            {totalTransactionsCount}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Zaksięgowane wpłaty i zakupy
          </div>
        </div>

        <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-full -z-10 opacity-70"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Średnia wartość transakcji</span>
          <div className="text-3xl font-black text-sky-900">
            {averageTransactionValue.toFixed(2)} PLN
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Średnia kwota wpłaty na klubowicza
          </div>
        </div>
      </div>

      {/* Wyszukiwanie, Kategorie i Zakres Dat */}
      <div className="bg-white border border-sky-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
          
          {/* Wyszukiwarka */}
          <div className="relative flex-1 w-full">
            <span className="absolute left-4 top-3 text-slate-400">🔍</span>
            <input 
              type="text"
              placeholder="Szukaj po klubowiczu, mailu, opisie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-sky-50 border border-sky-100 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors font-medium"
            />
          </div>

          {/* Zakładki kategorii */}
          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${categoryFilter === 'all' ? 'bg-sky-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Wszystkie
            </button>
            <button
              onClick={() => setCategoryFilter('karnet')}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${categoryFilter === 'karnet' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              💳 Karnety
            </button>
            <button
              onClick={() => setCategoryFilter('portfel')}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${categoryFilter === 'portfel' ? 'bg-sky-700 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              💰 Portfel
            </button>
            <button
              onClick={() => setCategoryFilter('wyzwanie')}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${categoryFilter === 'wyzwanie' ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              🏆 Wyzwanie
            </button>
            <button
              onClick={() => setCategoryFilter('odziez')}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${categoryFilter === 'odziez' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              👕 Odzież
            </button>
            <button
              onClick={() => setCategoryFilter('sklep')}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${categoryFilter === 'sklep' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              🛍️ Sklep
            </button>
          </div>

          {/* Zakres Dat */}
          <div className="relative w-full lg:w-auto" ref={datePickerRef}>
            <button 
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="w-full lg:w-auto flex items-center justify-between gap-3 bg-sky-50 border border-sky-200 hover:border-sky-300 rounded-2xl px-4 py-2.5 shadow-sm text-xs font-black text-sky-900 transition-colors cursor-pointer uppercase tracking-wider"
            >
              <span className="flex items-center gap-2">
                <span>🗓️</span> {startDate} - {endDate}
              </span>
              <span className="text-sky-600">▾</span>
            </button>

            {isDatePickerOpen && (
              <div className="absolute right-0 mt-3 w-80 bg-white border border-sky-200 rounded-3xl shadow-2xl p-6 z-50 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                <h3 className="font-black text-xs text-sky-950 uppercase tracking-wider border-b border-sky-100 pb-3">
                  Wybierz zakres dat
                </h3>
                <div className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Data OD:</label>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Data DO:</label>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
                    />
                  </div>
                </div>
                <div className="pt-4 border-t border-sky-100 flex justify-end">
                  <button 
                    onClick={() => { setIsDatePickerOpen(false); fetchTransactions(); }}
                    className="bg-sky-900 hover:bg-sky-800 text-white font-black px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-sm w-full"
                  >
                    Zastosuj filtr
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Główna Tabela Transakcji */}
      <div className="bg-white border border-sky-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-sky-50/80 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200">
                <th className="py-4 px-6 font-bold whitespace-nowrap w-36">Data</th>
                <th className="py-4 px-6 font-bold whitespace-nowrap">Klubowicz</th>
                <th className="py-4 px-6 font-bold whitespace-nowrap">Kategoria</th>
                <th className="py-4 px-6 font-bold whitespace-nowrap">Wpływ</th>
                <th className="py-4 px-6 font-bold">Opis transakcji</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/50 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                    <div className="mt-4 text-sm font-bold text-sky-900 uppercase tracking-wider">Wczytywanie operacji finansowych...</div>
                  </td>
                </tr>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-sky-50/30 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-700">{t.dataOperacji}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">{t.godzinaOperacji}</div>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="font-black text-sky-950 text-sm">{t.klientImieNazwisko}</div>
                      {t.klientEmail && (
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{t.klientEmail}</div>
                      )}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${getBadgeStyle(t.typKategoria)}`}>
                        {getCategoryLabel(t.typKategoria)}
                      </span>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className={`font-black text-sm ${t.isRefund ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {t.isRefund ? `-${t.kwota.toFixed(2)}` : `+${t.kwota.toFixed(2)}`} PLN
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium text-slate-800 leading-snug">{t.opis}</div>
                      <div className="text-[9px] text-slate-400 font-mono uppercase mt-1">Metoda / Typ: {t.typOperacji}</div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <div className="text-4xl mb-3">💳</div>
                    <div className="font-bold text-slate-600 uppercase tracking-wider">Brak zarejestrowanych wpływów finansowych</div>
                    <div className="text-xs mt-1">Zmień zakres dat lub filtr kategorii.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Stopka tabeli */}
        {!isLoading && (
          <div className="bg-slate-50 px-6 py-4 border-t border-sky-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
            <div>
              Liczba pozycji: <span className="font-black text-sky-900 bg-sky-100 px-2.5 py-0.5 rounded-md border border-sky-200">{filteredTransactions.length}</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-70">
              <span className="px-2.5 py-1 bg-white border border-slate-200 rounded shadow-sm text-[10px] uppercase font-bold text-emerald-700">
                ✓ Tylko transakcje finansowe (wpływy)
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
