"use client";

import React, { useState } from 'react';

interface AutoClient {
  name: string;
  expires: string;
  limitInfo?: string;
}

interface AutoScheduleItem {
  id: number;
  day: string;
  start: string;
  title: string;
  trainer: string;
  enrolled: number;
  max: number;
  clients: AutoClient[];
}

export default function AutoSignupsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const scheduleData: AutoScheduleItem[] = [
    {
      id: 1,
      day: 'poniedziałek',
      start: '14:15',
      title: 'Przygotowanie pod HY-ROX',
      trainer: 'Maciek Kłaput',
      enrolled: 1,
      max: 4,
      clients: [{ name: 'Maciek Kłaput', expires: '2026-12-31' }]
    },
    {
      id: 2,
      day: 'poniedziałek',
      start: '16:05',
      title: 'Ogólnorozwojowe',
      trainer: 'Maciek Kłaput',
      enrolled: 0,
      max: 12,
      clients: []
    },
    {
      id: 3,
      day: 'poniedziałek',
      start: '18:25',
      title: 'Ogólnorozwojowe',
      trainer: 'Maciek Kłaput',
      enrolled: 0,
      max: 12,
      clients: []
    },
    {
      id: 4,
      day: 'poniedziałek',
      start: '19:35',
      title: 'Ogólnorozwojowe',
      trainer: 'Maciek Kłaput',
      enrolled: 3,
      max: 12,
      clients: [
        { name: 'Aleksandra Marchelak', expires: '2026-08-31', limitInfo: '(8/12)' },
        { name: 'Marta Tymoszewska', expires: '2026-08-18' },
        { name: 'Monika Ratajczak', expires: '2026-12-31' }
      ]
    },
    {
      id: 5,
      day: 'poniedziałek',
      start: '20:30',
      title: 'HIIT / TABATA',
      trainer: 'Maciek Kłaput',
      enrolled: 3,
      max: 10,
      clients: [
        { name: 'Maciek Kłaput', expires: '2026-12-31' },
        { name: 'Marta Tymoszewska', expires: '2026-08-18' },
        { name: 'Monika Ratajczak', expires: '2026-12-31' }
      ]
    },
    {
      id: 6,
      day: 'wtorek',
      start: '18:00',
      title: 'Brzuch',
      trainer: 'Monika Ratajczak',
      enrolled: 0,
      max: 12,
      clients: []
    },
    {
      id: 7,
      day: 'wtorek',
      start: '19:10',
      title: 'Rozciąganie i Mobilizacja',
      trainer: 'Monika Ratajczak',
      enrolled: 0,
      max: 9,
      clients: []
    },
    {
      id: 8,
      day: 'środa',
      start: '16:05',
      title: 'Ogólnorozwojowe',
      trainer: 'Maciek Kłaput',
      enrolled: 0,
      max: 12,
      clients: []
    },
    {
      id: 9,
      day: 'środa',
      start: '20:30',
      title: 'Rozciąganie i Mobilizacja',
      trainer: 'Monika Ratajczak',
      enrolled: 1,
      max: 9,
      clients: [{ name: 'Marta Tymoszewska', expires: '2026-08-18' }]
    },
    {
      id: 10,
      day: 'czwartek',
      start: '18:00',
      title: 'Nogi i pośladki',
      trainer: 'Monika Ratajczak',
      enrolled: 0,
      max: 12,
      clients: []
    },
    {
      id: 11,
      day: 'piątek',
      start: '14:15',
      title: 'Trening SIŁOWY',
      trainer: 'Maciek Kłaput',
      enrolled: 1,
      max: 6,
      clients: [{ name: 'Maciek Kłaput', expires: '2026-12-31' }]
    }
  ];

  const filteredData = scheduleData.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.trainer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.day.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24">
      
      {/* Pasek Nagłówka */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-sky-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
            🤖 Automatyczne Zapisy
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-rose-800 hover:bg-rose-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-sm transition-all flex items-center gap-2">
            <span>🔄</span> Odśwież zapisy
          </button>
          <button className="px-4 py-2 bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5">
            <span>❓</span> Dowiedz się więcej
          </button>
        </div>
      </div>

      {/* Wyszukiwarka i Filtry */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-3 text-slate-400">🔍</span>
          <input 
            type="text"
            placeholder="Wyszukaj zajęcia, trenera lub dzień..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-sky-200 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
          />
        </div>
        <button className="px-4 py-2.5 bg-rose-800 hover:bg-rose-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 shadow-sm transition-all">
          <span>🎛️</span> Ustaw filtry (0)
        </button>
      </div>

      {/* Tabela Automatycznych Zapisów */}
      <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-sky-50/80 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200">
                <th className="py-3.5 px-4 font-bold">Dzień</th>
                <th className="py-3.5 px-4 font-bold">Start</th>
                <th className="py-3.5 px-4 font-bold">Nazwa</th>
                <th className="py-3.5 px-4 font-bold">Trener</th>
                <th className="py-3.5 px-4 font-bold text-center">Limit</th>
                <th className="py-3.5 px-4 font-bold">Klienci</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-sky-50/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold capitalize text-slate-800">{row.day}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-900 font-bold">{row.start}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{row.title}</td>
                  <td className="py-3.5 px-4 text-slate-600">{row.trainer}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-md border border-emerald-200 text-xs">
                      {row.enrolled}/{row.max}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {row.clients.map((c, i) => (
                        <span 
                          key={i} 
                          className="bg-sky-50 border border-sky-200 text-slate-800 text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xs"
                        >
                          <span className="underline font-semibold cursor-pointer hover:text-sky-700">{c.name}</span>
                          <span className="text-slate-400 text-[10px]">| {c.expires}</span>
                          {c.limitInfo && <span className="text-slate-500 font-bold text-[10px]">{c.limitInfo}</span>}
                          <button className="text-slate-400 hover:text-rose-600 font-bold ml-1">✕</button>
                        </span>
                      ))}
                      <button className="w-7 h-7 bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-200 rounded-lg flex items-center justify-center font-bold text-xs transition-all" title="Dodaj stały zapis">
                        👤+
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
