"use client";

import React, { useState } from 'react';

export default function ActivityReportPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('2026-08-01 - 2026-08-04');

  // Przykładowe dane aktywności klubowiczów odtworzone ze zrzutów
  const activityData = [
    { id: 1, firstName: 'Jolanta', lastName: 'Andryszak', email: 'jandryszak@wp.pl', phone: '691118579', pass: 'Ogólnorozwojowe i Rozciąganie', lastWorkout: '2026-08-03', d7: 3, d14: 4, d30: 10, customRange: 1 },
    { id: 2, firstName: 'Agnieszka', lastName: 'Antczak-Falkowska', email: 'a.antfalk@gmail.com', phone: '509922199', pass: '10 wejść', lastWorkout: '2026-07-28', d7: 2, d14: 2, d30: 5, customRange: 0 },
    { id: 3, firstName: 'Dagmara', lastName: 'Bielicz', email: 'dagma85@googlemail.com', phone: '-', pass: '10 wejść', lastWorkout: '2026-08-03', d7: 1, d14: 1, d30: 1, customRange: 1 },
    { id: 4, firstName: 'Agnieszka', lastName: 'Dolińska', email: 'a.dolinska@op.pl', phone: '797233993', pass: 'OGÓLNOROZWOJOWE I ROZCIĄGANIE - umowa 12 miesięcy', lastWorkout: '2026-08-03', d7: 4, d14: 7, d30: 9, customRange: 1 },
    { id: 5, firstName: 'Justyna', lastName: 'Glaubert', email: 'justynaglaubert35@gmail.com', phone: '505076357', pass: 'OPEN', lastWorkout: '2026-08-03', d7: 3, d14: 4, d30: 10, customRange: 1 },
    { id: 6, firstName: 'Aleksandra', lastName: 'Jaruszewska', email: 'jaruszewska.aleksandra@gmail.com', phone: '0609524297', pass: 'OGÓLNOROZWOJOWE I ROZCIĄGANIE - umowa 12 miesięcy', lastWorkout: '2026-08-03', d7: 3, d14: 5, d30: 11, customRange: 1 },
    { id: 7, firstName: 'Marta', lastName: 'Jaworska', email: 'margie7@onet.eu', phone: '501456848', pass: 'OPEN', lastWorkout: '2026-08-03', d7: 2, d14: 3, d30: 5, customRange: 1 },
    { id: 8, firstName: 'Maciek', lastName: 'Kłaput', email: '-', phone: '-', pass: 'OPEN', lastWorkout: '2026-07-31', d7: 2, d14: 5, d30: 11, customRange: 0 },
  ];

  const filteredData = activityData.filter(item => 
    `${item.firstName} ${item.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24">
      
      {/* Pasek Nagłówka */}
      <div className="flex justify-between items-center border-b border-sky-200 pb-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
          🏃 Aktywność Klubowiczów
        </h1>
        <button 
          title="Eksportuj"
          className="p-2 bg-white border border-sky-200 text-slate-700 rounded-xl hover:bg-sky-50 shadow-sm transition-all"
        >
          📥
        </button>
      </div>

      {/* Wyszukiwanie i Wybór Daty */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-3 text-slate-400">🔍</span>
          <input 
            type="text"
            placeholder="Wyszukaj po imieniu, nazwisku lub emailu..."
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

      {/* Tabela Aktywności */}
      <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-sky-50/80 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200">
                <th className="py-3.5 px-3 font-bold">NO.</th>
                <th className="py-3.5 px-3 font-bold">Imię</th>
                <th className="py-3.5 px-3 font-bold">Nazwisko</th>
                <th className="py-3.5 px-3 font-bold">Email</th>
                <th className="py-3.5 px-3 font-bold">Telefon</th>
                <th className="py-3.5 px-3 font-bold">Karnet</th>
                <th className="py-3.5 px-3 font-bold text-center">Ostatni Trening</th>
                <th className="py-3.5 px-3 font-bold text-center">Ostatnie 7 dni</th>
                <th className="py-3.5 px-3 font-bold text-center">14 dni</th>
                <th className="py-3.5 px-3 font-bold text-center">30 dni</th>
                <th className="py-3.5 px-3 font-bold text-center">{dateRange}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredData.map((row) => (
                <tr key={row.id} className="hover:bg-sky-50/40 transition-colors">
                  <td className="py-3.5 px-3 font-mono text-slate-400">{row.id}.</td>
                  <td className="py-3.5 px-3 font-bold text-slate-900">{row.firstName}</td>
                  <td className="py-3.5 px-3 font-bold text-slate-900">{row.lastName}</td>
                  <td className="py-3.5 px-3 text-sky-700 font-medium hover:underline cursor-pointer">{row.email}</td>
                  <td className="py-3.5 px-3 font-mono text-slate-600">{row.phone}</td>
                  <td className="py-3.5 px-3 font-semibold text-slate-800">{row.pass}</td>
                  <td className="py-3.5 px-3 font-mono text-center text-slate-500">{row.lastWorkout}</td>
                  <td className="py-3.5 px-3 text-center font-bold text-slate-900">{row.d7}</td>
                  <td className="py-3.5 px-3 text-center font-bold text-slate-900">{row.d14}</td>
                  <td className="py-3.5 px-3 text-center font-bold text-slate-900">{row.d30}</td>
                  <td className="py-3.5 px-3 text-center font-bold text-sky-700 bg-sky-50/50">{row.customRange}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dół Tabeli / Paginacja */}
        <div className="bg-sky-50/50 px-4 py-3 border-t border-sky-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>Łącznie: <span className="font-bold text-slate-900">{filteredData.length}</span></div>
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
