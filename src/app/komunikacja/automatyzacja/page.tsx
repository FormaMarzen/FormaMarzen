"use client";

import React, { useState } from 'react';

export default function AutomatyzacjaPage() {
  const [searchQuery, setSearchQuery] = useState('');

  // Przykładowe dane reguł automatyzacji wzorowane na Twoim zrzucie ekranu
  const automations = [
    {
      id: 1,
      title: 'Ostatni odbyty trening',
      timing: '7 dni po',
      actionType: 'WYŚLIJ',
      message: 'EMAIL: Od tygodnia nie możemy sobie znaleźć miejsca 😭 Gdzie jesteś?',
      filters: 'Brak',
      executions: 1154,
      recipient: 'Klubowicz',
      status: 'Aktywny',
      statusType: 'active'
    },
    {
      id: 2,
      title: 'Po pierwszych zajęciach z zapisem',
      timing: 'W dniu wydarzenia',
      actionType: 'WYŚLIJ',
      message: 'EMAIL: Pierwszy trening za Tobą! Gratulujemy 😊',
      filters: 'Brak',
      executions: 178,
      recipient: 'Klubowicz',
      status: 'Aktywny',
      statusType: 'active'
    },
    {
      id: 3,
      title: 'Rejestracja gościa',
      timing: 'Natychmiast',
      actionType: 'WYŚLIJ',
      message: 'EMAIL: Pierwszy raz u nas? Nie możemy się doczekać!',
      filters: 'Brak',
      executions: 54,
      recipient: 'Klubowicz',
      status: 'Aktywny',
      statusType: 'active'
    },
    {
      id: 4,
      title: 'Rejestracja klubowicza',
      timing: 'Natychmiast',
      actionType: 'WYŚLIJ',
      message: 'EMAIL: Witamy w [facility_name]! 😊',
      filters: 'Brak',
      executions: 284,
      recipient: 'Klubowicz',
      status: 'Aktywny',
      statusType: 'active'
    },
    {
      id: 5,
      title: 'Urodziny użytkownika',
      timing: 'W dniu wydarzenia',
      actionType: 'WYŚLIJ',
      message: 'EMAIL: Wpadnij na trening odebrać urodzinowy prezent!',
      filters: 'Brak',
      executions: 86,
      recipient: 'Klubowicz',
      status: 'Aktywny',
      statusType: 'active'
    },
    {
      id: 6,
      title: 'Wygaśnięcie karnetu',
      timing: '3 dni przed',
      actionType: 'WYŚLIJ',
      message: 'EMAIL: Twój bezpłatny dostęp do [facility_name] za chwilę straci wa',
      filters: 'Brak',
      executions: 0,
      recipient: 'Klubowicz',
      status: 'Zatrzymany',
      statusType: 'paused'
    },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      
      {/* GÓRNY PASEK AKCJI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-sky-200 p-5 rounded-2xl shadow-sm">
        <h1 className="text-lg font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
          AUTOMATYZACJA
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm">
            <span>+</span> NOWY AUTOMAT
          </button>
          <button className="flex items-center gap-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors">
            <span>❓</span> Pomoc
          </button>
        </div>
      </div>

      {/* PASEK WYSZUKIWANIA I FILTRÓW */}
      <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-xs">🔍</span>
            <input 
              type="text"
              placeholder="Wyszukaj automatyzację..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-sky-50/50 border border-sky-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>
          <button className="flex items-center justify-center gap-2 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shrink-0">
            <span>🎛</span> Ustaw filtry (0)
          </button>
        </div>
      </div>

      {/* TABELA AUTOMATYZACJI */}
      <div className="bg-white border border-sky-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sky-50/70 border-b border-sky-200 text-[11px] font-bold text-sky-900 uppercase tracking-wider">
                <th className="py-3.5 px-4">Automat</th>
                <th className="py-3.5 px-4">Filtry</th>
                <th className="py-3.5 px-4 text-center">Ilość wykonań</th>
                <th className="py-3.5 px-4">Odbiorca</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100 text-xs">
              {automations.map((item) => (
                <tr key={item.id} className="hover:bg-sky-50/40 transition-colors">
                  
                  {/* Automat & Wiadomość */}
                  <td className="py-4 px-4 space-y-1">
                    <div className="font-bold text-slate-900 text-sm">{item.title}</div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px] border border-slate-200">
                        {item.timing}
                      </span>
                      <span className="bg-sky-100 text-sky-800 font-semibold px-2 py-0.5 rounded text-[10px] border border-sky-200">
                        {item.actionType}
                      </span>
                      <span className="bg-slate-50 text-slate-600 font-medium px-2 py-0.5 rounded text-[10px] border border-slate-200 truncate max-w-[300px]">
                        🔍 {item.message}
                      </span>
                    </div>
                  </td>

                  {/* Filtry */}
                  <td className="py-4 px-4 text-slate-600 font-medium">
                    {item.filters}
                  </td>

                  {/* Ilość wykonań */}
                  <td className="py-4 px-4 text-center font-bold text-slate-800">
                    {item.executions}
                  </td>

                  {/* Odbiorca */}
                  <td className="py-4 px-4 text-slate-700 font-medium">
                    {item.recipient}
                  </td>

                  {/* Status */}
                  <td className="py-4 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      item.statusType === 'active'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {item.status}
                    </span>
                  </td>

                  {/* Akcje */}
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 text-slate-500">
                      <button className="w-7 h-7 bg-sky-50 hover:bg-sky-100 rounded-lg flex items-center justify-center transition-colors border border-sky-200" title="Pauza / Start">
                        ⏸
                      </button>
                      <button className="w-7 h-7 bg-sky-50 hover:bg-sky-100 rounded-lg flex items-center justify-center transition-colors border border-sky-200" title="Edytuj">
                        ✏️
                      </button>
                      <button className="w-7 h-7 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center transition-colors border border-rose-200" title="Usuń">
                        🗑️
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
