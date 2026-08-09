"use client";

import React, { useState } from 'react';

export default function InwentaryzacjaPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showWithoutSales, setShowWithoutSales] = useState(false);
  const [dateRange, setDateRange] = useState('2026-08-01 - 2026-08-04');

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      
      {/* GÓRNY PASEK AKCJI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-sky-200 p-5 rounded-2xl shadow-sm">
        <h1 className="text-lg font-black uppercase tracking-wider text-sky-900 flex items-center gap-2">
          INWENTARYZACJA
        </h1>
        <button className="flex items-center gap-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-4 py-2 rounded-xl text-xs font-bold transition-colors w-fit">
          <span>📥</span> Eksportuj
        </button>
      </div>

      {/* PASEK WYSZUKIWANIA I FILTRÓW */}
      <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          
          {/* Wyszukiwarka */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-xs">🔍</span>
            <input 
              type="text"
              placeholder="Wyszukaj"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-sky-50/50 border border-sky-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* Wybór daty */}
          <div className="flex items-center gap-2 bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium shrink-0">
            <span>📅</span>
            <span>{dateRange}</span>
            <span className="text-slate-400 text-[10px] ml-1">▼</span>
          </div>

        </div>

        {/* Przełącznik produktów bez sprzedaży */}
        <div className="flex items-center gap-3 pt-2 border-t border-sky-100">
          <button 
            type="button"
            onClick={() => setShowWithoutSales(!showWithoutSales)}
            className={`w-9 h-5 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
              showWithoutSales ? 'bg-sky-600' : 'bg-slate-300'
            }`}
          >
            <div 
              className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform duration-250 ease-in-out ${
                showWithoutSales ? 'translate-x-4' : 'translate-x-0'
              }`} 
            />
          </button>
          <span className="text-xs font-medium text-slate-700">
            Pokaż produkty bez sprzedaży <span className="text-slate-400">({showWithoutSales ? 'Włączono' : 'Wyłączono'})</span>
          </span>
        </div>
      </div>

      {/* SEKCJA GŁÓWNA: BRAK PRODUKTÓW */}
      <div className="bg-white border border-sky-200 rounded-2xl p-12 text-center shadow-sm space-y-4 flex flex-col items-center justify-center">
        
        {/* Grafika / Ikona z lupą */}
        <div className="w-20 h-20 bg-sky-50 rounded-full border border-sky-100 flex items-center justify-center text-3xl shadow-inner">
          🔍
        </div>

        <div className="space-y-1 max-w-md">
          <h3 className="font-bold text-slate-900 text-sm">Nie znaleziono żadnych produktów</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Nie znaleziono żadnych produktów w tym okresie czasu. Spróbuj zmienić filtry wyszukiwania.
          </p>
        </div>

        {/* Przyciski akcji w stanie pustym */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button className="bg-rose-900 hover:bg-rose-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs tracking-wider uppercase transition-colors shadow-sm">
            📅 Zmień daty
          </button>
          <button className="bg-sky-100 hover:bg-sky-200 text-sky-900 font-bold px-4 py-2.5 rounded-xl text-xs tracking-wider uppercase transition-colors border border-sky-200">
            🏷️ Sprzedaż produktów
          </button>
        </div>

      </div>

    </div>
  );
}
