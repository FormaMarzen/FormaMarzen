"use client";

import React, { useState } from 'react';

export default function KampaniePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('wszystkie');

  const tabs = [
    { id: 'wszystkie', label: 'Wszystkie' },
    { id: 'robocze', label: 'Robocze' },
    { id: 'wyslane', label: 'Wysłane' },
    { id: 'w-trakcie', label: 'W trakcie wysyłki' },
    { id: 'zaplanowane', label: 'Zaplanowane' },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      
      {/* GÓRNY PASEK AKCJI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-sky-200 p-5 rounded-2xl shadow-sm">
        <h1 className="text-lg font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
          KAMPANIE
        </h1>
        <button className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm w-fit">
          <span>+</span> DODAJ KAMPANIĘ
        </button>
      </div>

      {/* PASEK WYSZUKIWANIA I ZAKŁADKI STATUSÓW */}
      <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-sm space-y-4">
        
        {/* Wyszukiwarka */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-xs">🔍</span>
          <input 
            type="text"
            placeholder="Wyszukaj kampanię..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-sky-50/50 border border-sky-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Zakładki filtrowania */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-sky-100">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                activeTab === tab.id
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-sky-50/60 text-slate-600 hover:bg-sky-100 border border-sky-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

      </div>

      {/* SEKCJA GŁÓWNA: STAN PUSTY */}
      <div className="bg-white border border-sky-200 rounded-2xl p-12 text-center shadow-sm space-y-4 flex flex-col items-center justify-center">
        
        {/* Ikona kampanii / megafon */}
        <div className="w-20 h-20 bg-sky-50 rounded-full border border-sky-100 flex items-center justify-center text-3xl shadow-inner">
          📣
        </div>

        <div className="space-y-1 max-w-md">
          <h3 className="font-bold text-slate-900 text-sm">Brak kampanii</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Nie masz jeszcze żadnych kampanii. Utwórz pierwszą kampanię, aby dotrzeć do klientów.
          </p>
        </div>

        {/* Przycisk dodawania w stanie pustym */}
        <div className="pt-2">
          <button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-3 rounded-xl text-xs tracking-wider uppercase transition-colors shadow-sm flex items-center gap-2">
            <span>+</span> Dodaj kampanię
          </button>
        </div>

      </div>

    </div>
  );
}
