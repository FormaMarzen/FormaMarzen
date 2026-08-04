"use client";

import React, { useState } from 'react';

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  // Przykładowe dane transakcji
  const transactions = [
    {
      id: 1,
      date: '2026-08-04 01:03',
      buyer: 'Elżbieta Nowak',
      seller: '-',
      grossPrice: '0.00 PLN',
      discount: '0.00%',
      paymentMethod: 'online',
      proofOfSale: 'brak',
      products: 'Karnet: MEDICOVER sport OPEN x1',
    }
  ];

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24">
      
      {/* Nagłówek Sekcji */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-slate-200">
          💳 Transakcje
        </h1>
        <button 
          title="Eksportuj dane"
          className="p-2 bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-slate-300 rounded-xl transition-all"
        >
          📥
        </button>
      </div>

      {/* Pasek Wyszukiwania i Filtry */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-3 text-slate-500">🔍</span>
            <input 
              type="text"
              placeholder="Wyszukaj..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button className="px-4 py-2.5 bg-rose-900 hover:bg-rose-800 text-white text-xs font-bold rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 shrink-0">
            <span>🎛️</span> Ustaw filtry (1)
          </button>
        </div>

        {/* Aktywne warunki filtrowania */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-full flex items-center gap-2">
            <span>Data transakcji: 2026-08-04 - 2026-08-04</span>
            <button className="text-slate-500 hover:text-rose-400">✕</button>
          </span>
          <button className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-amber-400 px-3 py-1.5 rounded-full font-semibold transition-all">
            Dodaj nowy warunek +
          </button>
        </div>
      </div>

      {/* Kafelki Podsumowujące (3 sekcje) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Kafelek 1: Podsumowanie */}
        <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Podsumowanie</span>
          <div className="my-4">
            <div className="text-4xl font-black text-white">0 PLN</div>
            <div className="text-xs text-slate-400 font-semibold mt-1">Transakcje: 1</div>
          </div>
        </div>

        {/* Kafelek 2: Sprzedawcy */}
        <div className="bg-teal-950/20 border border-teal-500/20 rounded-2xl p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">Sprzedawcy</span>
          <div className="my-2 space-y-1 text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-300">Online payment</span>
              <span className="font-bold text-white">0.00 PLN</span>
            </div>
          </div>
        </div>

        {/* Kafelek 3: Karnety & Produkty */}
        <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-5 flex flex-col justify-between">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-bold text-amber-400 uppercase tracking-wider block mb-2">Karnety</span>
              <div className="text-slate-300 font-medium">
                MEDICOVER sport OPEN <span className="font-bold text-white ml-1">1</span>
              </div>
            </div>
            <div>
              <span className="font-bold text-amber-400 uppercase tracking-wider block mb-2">Produkty</span>
              <div className="text-slate-500 italic">Brak danych</div>
            </div>
          </div>
        </div>

      </div>

      {/* Tabela Transakcji */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <th className="py-3.5 px-4 font-bold">Data</th>
                <th className="py-3.5 px-4 font-bold">Kupiec</th>
                <th className="py-3.5 px-4 font-bold">Sprzedawca</th>
                <th className="py-3.5 px-4 font-bold">Cena brutto</th>
                <th className="py-3.5 px-4 font-bold">Zniżka</th>
                <th className="py-3.5 px-4 font-bold">Płatność</th>
                <th className="py-3.5 px-4 font-bold">Dowód sprzedaży</th>
                <th className="py-3.5 px-4 font-bold">Produkty</th>
                <th className="py-3.5 px-4 font-bold text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-400">{t.date}</td>
                  <td className="py-3.5 px-4 font-bold text-amber-400 hover:underline cursor-pointer">
                    {t.buyer}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">{t.seller}</td>
                  <td className="py-3.5 px-4 font-bold text-white">{t.grossPrice}</td>
                  <td className="py-3.5 px-4 text-slate-400">{t.discount}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 text-[10px] font-semibold">
                      {t.paymentMethod}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">{t.proofOfSale}</td>
                  <td className="py-3.5 px-4 text-slate-300">{t.products}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button className="text-slate-500 hover:text-white p-1">⋮</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginacja (Dół Tabeli) */}
        <div className="bg-slate-950/40 px-4 py-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>Łącznie: <span className="font-bold text-white">1</span></div>
          <div className="flex items-center gap-3">
            <span>Strona: 1 z 1</span>
            <div className="flex items-center gap-1">
              <button className="p-1 hover:bg-slate-800 rounded disabled:opacity-30" disabled>⏮</button>
              <button className="p-1 hover:bg-slate-800 rounded disabled:opacity-30" disabled>◀</button>
              <span className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs">1</span>
              <button className="p-1 hover:bg-slate-800 rounded disabled:opacity-30" disabled>▶</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
