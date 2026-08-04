"use client";

import React, { useState } from 'react';

export default function WorkoutCreatorPage() {
  const [selectedDate, setSelectedDate] = useState('2026-08-04');
  const [filterPlan, setFilterPlan] = useState('WSZYSTKIE PLANY');

  const days = [
    { name: 'WTOREK', date: '04/08' },
    { name: 'ŚRODA', date: '05/08' },
    { name: 'CZWARTEK', date: '06/08' },
    { name: 'PIĄTEK', date: '07/08' },
  ];

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-sky-200 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl">📅</span>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-sky-50 border border-sky-200 text-slate-800 text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <select 
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
            className="bg-sky-50 border border-sky-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl px-4 py-2.5 focus:outline-none"
          >
            <option>WSZYSTKIE PLANY</option>
            <option>Trening SIŁOWY</option>
            <option>Trening HYROX / FBW</option>
          </select>

          <button className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm">
            + NOWY PLAN
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="w-9 h-9 bg-white text-sky-700 border border-sky-200 rounded-full flex items-center justify-center font-bold shadow-sm">◀</button>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
          {days.map((d, i) => (
            <div key={i} className="bg-sky-100/60 border border-sky-200 py-2.5 px-4 rounded-xl text-center">
              <span className="text-xs font-extrabold uppercase text-slate-800 tracking-wider">{d.name}</span>
              <span className="text-xs font-semibold text-sky-600 ml-2">{d.date}</span>
            </div>
          ))}
        </div>
        <button className="w-9 h-9 bg-white text-sky-700 border border-sky-200 rounded-full flex items-center justify-center font-bold shadow-sm">▶</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start min-h-[400px]">
        {days.map((d, i) => (
          <div key={i} className="space-y-4 flex flex-col items-center">
            {i === 3 && (
              <div className="w-full bg-pink-50 border border-pink-200 rounded-2xl p-4 space-y-3 shadow-sm">
                <h4 className="font-black text-sm text-pink-950">Klatka i triceps</h4>
                <span className="text-[11px] font-semibold text-pink-700">Trening SIŁOWY</span>
                <div className="text-xs pt-2 border-t border-pink-100 text-slate-600">
                  <p className="text-[11px] text-pink-700 font-semibold">Wynik: Brak pomiaru</p>
                </div>
              </div>
            )}
            <button className="w-10 h-10 bg-sky-100 hover:bg-sky-200 text-sky-700 border border-sky-300 rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
              +
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
