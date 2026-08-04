"use client";

import React, { useState } from 'react';

export default function ClassesReportPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('2026-08-01 - 2026-08-04');

  // Dane raportu zapytań i zajęć
  const classesData = [
    { id: 1, date: '2026-08-04 19:10', title: 'Rozciąganie i Mobilizacja', trainer: 'Monika Ratajczak', room: '', enrolled: 3, max: 9 },
    { id: 2, date: '2026-08-04 18:00', title: 'Brzuch', trainer: 'Monika Ratajczak', room: '', enrolled: 7, max: 12 },
    { id: 3, date: '2026-08-03 19:35', title: 'Ogólnorozwojowe', trainer: 'Maciek Kłaput', room: '', enrolled: 5, max: 12 },
    { id: 4, date: '2026-08-03 18:25', title: 'Ogólnorozwojowe', trainer: 'Maciek Kłaput', room: '', enrolled: 10, max: 12 },
    { id: 5, date: '2026-08-03 16:05', title: 'Ogólnorozwojowe', trainer: 'Maciek Kłaput', room: '', enrolled: 8, max: 12 },
  ];

  const filteredClasses = classesData.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.trainer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24">
      
      {/* Pasek Nagłówka */}
      <div className="flex justify-between items-center border-b border-sky-200 pb-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
          📅 Zajęcia i Zapisy
        </h1>
        <button 
          title="Eksportuj"
          className="p-2 bg-white border border-sky-200 text-slate-700 rounded-xl hover:bg-sky-50 shadow-sm transition-all"
        >
          📥
        </button>
      </div>

      {/* Wyszukiwanie i Zakres Dat */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-3 text-slate-400">🔍</span>
          <input 
            type="text"
            placeholder="Wyszukaj zajęcia lub trenera..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-sky-200 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 bg-white border border-sky-200 rounded-xl px-3 py-2.5 shadow-sm text-xs text-slate-700 shrink-0">
          <span>📅</span>
          <input 
            type="text" 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-transparent font-semibold focus:outline-none text-slate-800 w-48"
          />
          <span className="text-slate-400">▾</span>
        </div>
      </div>

      {/* Tabela Zajęć */}
      <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-sky-50/80 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200">
                <th className="py-3.5 px-4 font-bold">Data</th>
                <th className="py-3.5 px-4 font-bold">Zajęcia</th>
                <th className="py-3.5 px-4 font-bold">Trener</th>
                <th className="py-3.5 px-4 font-bold">Sala Treningowa</th>
                <th className="py-3.5 px-4 font-bold text-right">Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredClasses.map((item) => (
                <tr key={item.id} className="hover:bg-sky-50/40 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-500">{item.date}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{item.title}</td>
                  <td className="py-3.5 px-4 text-slate-600">{item.trainer}</td>
                  <td className="py-3.5 px-4 text-slate-400">{item.room || '-'}</td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-md border border-emerald-200 text-xs">
                        {item.enrolled}/{item.max}
                      </span>
                      <button className="text-slate-400 hover:text-sky-600 p-1" title="Podgląd zapisanych">
                        🔍
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dół Tabeli / Paginacja */}
        <div className="bg-sky-50/50 px-4 py-3 border-t border-sky-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>Łącznie: <span className="font-bold text-slate-900">{filteredClasses.length}</span></div>
          <div className="flex items-center gap-3">
            <span>Strona: 1 z 1</span>
            <div className="flex items-center gap-1">
              <button className="p-1 hover:bg-white rounded border border-transparent hover:border-sky-200 disabled:opacity-30" disabled>⏮</button>
              <button className="p-1 hover:bg-white rounded border border-transparent hover:border-sky-200 disabled:opacity-30" disabled>◀</button>
              <span className="px-2.5 py-1 bg-sky-600 text-white font-bold rounded-lg text-xs shadow-sm">1</span>
              <button className="p-1 hover:bg-white rounded border border-transparent hover:border-sky-200 disabled:opacity-30" disabled>▶</button>
              <button className="p-1 hover:bg-white rounded border border-transparent hover:border-sky-200 disabled:opacity-30" disabled>⏭</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
