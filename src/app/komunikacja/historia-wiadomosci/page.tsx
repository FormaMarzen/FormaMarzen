"use client";

import React, { useState } from 'react';

export default function HistoriaWiadomosciPage() {
  const [searchQuery, setSearchQuery] = useState('');

  // Przykładowe dane historii wiadomości wzorowane na Twoim zrzucie ekranu
  const messages = [
    {
      id: 1,
      sendDate: '2026-08-04 05:15',
      deliveryDate: '2026-08-04 05:15',
      type: 'email',
      content: 'Twój karnet został zawieszony',
      recipientName: 'Justyna Glaubert',
      recipientEmail: 'justynaglaubert35@gmail.com',
      status: 'Dostarczono'
    },
    {
      id: 2,
      sendDate: '2026-08-04 01:03',
      deliveryDate: '2026-08-04 01:04',
      type: 'email',
      content: 'Witamy w Forma Marzeń! 😊',
      recipientName: 'Elżbieta Nowak',
      recipientEmail: 'elanowa1972@gmail.com',
      status: 'Dostarczono'
    },
    {
      id: 3,
      sendDate: '2026-08-04 01:03',
      deliveryDate: '2026-08-04 01:03',
      type: 'email',
      content: 'Od teraz jesteś częścią rodziny Forma Marzeń',
      recipientName: 'Elżbieta Nowak',
      recipientEmail: 'elanowa1972@gmail.com',
      status: 'Dostarczono'
    },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      
      {/* GÓRNY PASEK AKCJI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-sky-200 p-5 rounded-2xl shadow-sm">
        <h1 className="text-lg font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
          HISTORIA WIADOMOŚCI
        </h1>
        <button className="flex items-center gap-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors w-fit">
          <span>❔</span> Dowiedz się więcej
        </button>
      </div>

      {/* PASEK WYSZUKIWANIA I FILTRÓW */}
      <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-xs">🔍</span>
            <input 
              type="text"
              placeholder="Wyszukaj..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-sky-50/50 border border-sky-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>
          <button className="flex items-center justify-center gap-2 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shrink-0">
            <span>🎛</span> Ustaw filtry (1)
          </button>
        </div>

        {/* Aktywne filtry */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-sky-100 text-xs">
          <span className="bg-sky-100/70 text-sky-900 border border-sky-200 px-3 py-1.5 rounded-xl font-medium flex items-center gap-2">
            📅 Data wysyłki: 2026-08-04 - 2026-08-04
          </span>
          <button className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-3 py-1.5 rounded-xl font-bold transition-colors">
            + Dodaj nowy warunek
          </button>
        </div>
      </div>

      {/* TABELA HISTORII WIADOMOŚCI */}
      <div className="bg-white border border-sky-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sky-50/70 border-b border-sky-200 text-[11px] font-bold text-sky-900 uppercase tracking-wider">
                <th className="py-3.5 px-4">Data wysyłki</th>
                <th className="py-3.5 px-4">Data dostarczenia</th>
                <th className="py-3.5 px-4">Typ</th>
                <th className="py-3.5 px-4">Treść</th>
                <th className="py-3.5 px-4">Odbiorca</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100 text-xs">
              {messages.map((item) => (
                <tr key={item.id} className="hover:bg-sky-50/40 transition-colors">
                  
                  {/* Data wysyłki */}
                  <td className="py-4 px-4 text-slate-700 font-medium">
                    {item.sendDate}
                  </td>

                  {/* Data dostarczenia */}
                  <td className="py-4 px-4 text-slate-700 font-medium">
                    {item.deliveryDate}
                  </td>

                  {/* Typ */}
                  <td className="py-4 px-4">
                    <span className="bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-md text-[10px] border border-slate-200 uppercase">
                      {item.type}
                    </span>
                  </td>

                  {/* Treść */}
                  <td className="py-4 px-4 text-slate-900 font-semibold">
                    <div className="flex items-center gap-2">
                      <span>{item.content}</span>
                      <button className="w-6 h-6 bg-sky-50 hover:bg-sky-100 rounded-md flex items-center justify-center text-slate-500 border border-sky-200 transition-colors" title="Podgląd">
                        🔍
                      </button>
                    </div>
                  </td>

                  {/* Odbiorca */}
                  <td className="py-4 px-4">
                    <div className="font-bold text-slate-800">{item.recipientName}</div>
                    <div className="text-[11px] text-slate-400">{item.recipientEmail}</div>
                  </td>

                  {/* Status */}
                  <td className="py-4 px-4">
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
                      {item.status}
                    </span>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginacja */}
        <div className="p-4 border-t border-sky-100 flex items-center justify-between text-xs text-slate-500 bg-sky-50/30">
          <div>Łącznie: 3</div>
          <div className="flex items-center gap-2">
            <span>Strona: 1 z 1</span>
            <div className="flex items-center gap-1 ml-4">
              <button disabled className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-300 cursor-not-allowed">⏮</button>
              <button disabled className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-300 cursor-not-allowed">◀</button>
              <button className="w-7 h-7 bg-sky-600 text-white font-bold rounded-lg flex items-center justify-center shadow-sm">1</button>
              <button disabled className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-300 cursor-not-allowed">▶</button>
              <button disabled className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-300 cursor-not-allowed">⏭</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
