"use client";

import React from 'react';

export default function CoachesReportPage() {
  const coaches = [
    {
      id: 1,
      name: 'Kłaput Maciek',
      avatar: '👨‍💼',
      totalClasses: 53,
      classList: [
        { name: 'Ogólnorozwojowe', count: 39 },
        { name: 'HIIT / TABATA', count: 5 },
        { name: 'Trening SIŁOWY', count: 5 },
        { name: 'TRENING PERSONALNY', count: 2 },
        { name: 'Przygotowanie pod HY-ROX', count: 2 },
      ],
      attendancePercent: '58%',
      attendanceRatio: '321 / 558 (+4)',
      attendanceDetails: [
        { name: 'Ogólnorozwojowe', ratio: '256/468' },
        { name: 'HIIT / TABATA', ratio: '34/50' },
        { name: 'Trening SIŁOWY', ratio: '22/30 (+3)' },
        { name: 'Przygotowanie pod HY-ROX', ratio: '7/8' },
        { name: 'TRENING PERSONALNY', ratio: '2/2 (+1)' },
      ],
      passes: [
        { name: 'OPEN - umowa 12 miesięcy', count: 94 },
        { name: 'OPEN', count: 71 },
        { name: 'OPEN - 6 miesięcy', count: 47 },
        { name: 'MEDICOVER sport OPEN', count: 39 },
        { name: 'OGÓLNOROZWOJOWE I ROZCIĄGANIE - umowa 12 miesięcy', count: 28 },
        { name: '10 wejść', count: 24 },
        { name: 'Ogólnorozwojowe i Rozciąganie', count: 15 },
        { name: '1 wejście', count: 6 },
        { name: '5 wejść', count: 1 },
      ]
    },
    {
      id: 2,
      name: 'Ratajczak Monika',
      avatar: '👩‍💼',
      totalClasses: 14,
      classList: [
        { name: 'Rozciąganie i Mobilizacja', count: 6 },
        { name: 'Brzuch', count: 4 },
        { name: 'Nogi i pośladki', count: 4 },
      ],
      attendancePercent: '59%',
      attendanceRatio: '88 / 150',
      attendanceDetails: [
        { name: 'Brzuch', ratio: '42/48' },
        { name: 'Nogi i pośladki', ratio: '25/48' },
        { name: 'Rozciąganie i Mobilizacja', ratio: '21/54' },
      ],
      passes: [
        { name: 'OPEN', count: 25 },
        { name: 'OPEN - umowa 12 miesięcy', count: 24 },
        { name: 'OPEN - 6 miesięcy', count: 17 },
        { name: 'MEDICOVER sport OPEN', count: 9 },
        { name: '10 wejść', count: 6 },
        { name: '1 wejście', count: 4 },
        { name: 'OGÓLNOROZWOJOWE I ROZCIĄGANIE - umowa 12 miesięcy', count: 3 },
      ]
    }
  ];

  return (
    <div className="max-w-[1700px] mx-auto space-y-8 pb-24">
      
      {/* Pasek Nagłówka */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-sky-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
            📊 Raport Trenerów <span className="text-slate-500 font-normal text-sm">(LIPIEC 2026)</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-rose-800 hover:bg-rose-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-sm transition-all flex items-center gap-2">
            <span>⚙️</span> Pokaż filtry
          </button>
          <button className="px-4 py-2 bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5">
            <span>❓</span> Dowiedz się więcej
          </button>
        </div>
      </div>

      {/* Lista Kart Trenerów */}
      <div className="space-y-8">
        {coaches.map((coach) => (
          <div key={coach.id} className="bg-white border border-sky-200 rounded-2xl p-6 space-y-6 shadow-sm">
            
            {/* Nagłówek Trenera */}
            <div className="flex justify-between items-center border-b border-sky-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-sky-100 border border-sky-200 rounded-full flex items-center justify-center text-2xl">
                  {coach.avatar}
                </div>
                <h2 className="text-lg font-black text-slate-900">{coach.name}</h2>
              </div>

              <button className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs">
                <span>📥</span> Ewidencja godzin
              </button>
            </div>

            {/* Grid 3 Metryk */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Metryka 1: WSZYSTKIE ZAJĘCIA */}
              <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 space-y-4">
                <span className="text-xs font-bold text-slate-700 bg-white/80 px-2.5 py-1 rounded-md border border-rose-200/60 inline-block">
                  Wszystkie zajęcia
                </span>
                
                <div className="flex items-baseline gap-6">
                  <div className="text-5xl font-black text-slate-900">{coach.totalClasses}</div>
                  <div className="space-y-1 text-xs text-slate-700">
                    {coach.classList.map((c, i) => (
                      <div key={i} className="flex justify-between gap-4">
                        <span>{c.name}</span>
                        <span className="font-bold text-slate-900">x{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Metryka 2: FREKWENCJA */}
              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 space-y-4">
                <span className="text-xs font-bold text-slate-700 bg-white/80 px-2.5 py-1 rounded-md border border-amber-200/60 inline-block">
                  Frekwencja
                </span>

                <div className="flex items-baseline gap-6">
                  <div>
                    <div className="text-4xl font-black text-slate-900">{coach.attendancePercent}</div>
                    <div className="text-[11px] font-bold text-slate-500 mt-1">{coach.attendanceRatio}</div>
                  </div>
                  <div className="space-y-1 text-xs text-slate-700 flex-1">
                    {coach.attendanceDetails.map((a, i) => (
                      <div key={i} className="flex justify-between gap-2 border-b border-amber-100/60 pb-0.5">
                        <span className="truncate max-w-[120px]">{a.name}:</span>
                        <span className="font-bold text-slate-900">{a.ratio}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Metryka 3: KARNETY */}
              <div className="bg-teal-50/50 border border-teal-100 rounded-2xl p-5 space-y-3">
                <span className="text-xs font-bold text-slate-700 bg-white/80 px-2.5 py-1 rounded-md border border-teal-200/60 inline-block mb-1">
                  Karnety
                </span>

                <div className="flex items-center gap-4">
                  {/* Wykres Kołowy */}
                  <div className="w-20 h-20 rounded-full border-4 border-indigo-500 border-t-amber-500 border-r-teal-500 border-l-rose-500 shrink-0"></div>
                  
                  {/* Lista Karnetów */}
                  <div className="space-y-1 text-[11px] text-slate-700 max-h-36 overflow-y-auto w-full pr-1">
                    {coach.passes.map((p, i) => (
                      <div key={i} className="flex justify-between gap-2 border-b border-teal-100/60 pb-0.5">
                        <span className="truncate">{p.name}</span>
                        <span className="font-bold text-slate-900 shrink-0">x{p.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Rozwijane Szczegóły */}
            <div className="pt-2 text-center">
              <button className="text-xs font-bold text-slate-500 hover:text-sky-700 flex items-center justify-center gap-1 mx-auto">
                <span>∨</span> SZCZEGÓŁY
              </button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
