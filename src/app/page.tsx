"use client";

import React, { useState } from 'react';

export default function DashboardPage() {
  const [salesPeriod, setSalesPeriod] = useState('Dziś');
  const [clientSearch, setClientSearch] = useState('');

  // Przykładowe dane zajęć w grafiku
  const scheduleData = [
    {
      day: 'WTOREK',
      date: '04/08',
      classes: [
        { time: '18:00', title: 'Brzuch', enrolled: 7, max: 12, duration: '60 min', trainer: 'Monika Ratajczak', color: 'border-l-rose-500' },
        { time: '19:10', title: 'Rozciąganie i Mobilizacja', enrolled: 3, max: 9, duration: '60 min', trainer: 'Monika Ratajczak', color: 'border-l-emerald-500' },
      ]
    },
    {
      day: 'ŚRODA',
      date: '05/08',
      classes: [
        { time: '16:05', title: 'Ogólnorozwojowe', enrolled: 8, max: 12, duration: '60 min', trainer: 'Maciek Kłaput', color: 'border-l-indigo-500' },
        { time: '17:15', title: 'TRENING PERSONALNY', enrolled: 0, max: 1, duration: '60 min', trainer: 'Monika Ratajczak', color: 'border-l-indigo-500' },
        { time: '18:25', title: 'Ogólnorozwojowe', enrolled: 4, max: 12, duration: '60 min', trainer: 'Maciek Kłaput', color: 'border-l-indigo-500' },
        { time: '19:35', title: 'Ogólnorozwojowe', enrolled: 9, max: 12, duration: '60 min', trainer: 'Maciek Kłaput', color: 'border-l-indigo-500' },
      ]
    },
    {
      day: 'CZWARTEK',
      date: '06/08',
      classes: [
        { time: '18:00', title: 'Nogi i pośladki', enrolled: 10, max: 12, duration: '60 min', trainer: 'Monika Ratajczak', color: 'border-l-amber-500' },
        { time: '19:10', title: 'Rozciąganie i Mobilizacja', enrolled: 4, max: 9, duration: '60 min', trainer: 'Monika Ratajczak', color: 'border-l-emerald-500' },
      ]
    }
  ];

  // Przykładowe dane klientów
  const clientsData = [
    {
      id: 1,
      name: 'Anastazja Sowa',
      email: 'anastazjag@vp.pl',
      phone: '',
      pass: 'OPEN - umowa 12 miesięcy',
      statusText: 'Opłacony do: 2026-07-31',
      installment: 'Rata: 6/12',
      statusType: 'expired', // czerwona etykieta
      avatar: '👧'
    },
    {
      id: 2,
      name: 'Natalia Maćków',
      email: 'nmackow@post.pl',
      phone: '602131262',
      pass: 'Ogólnorozwojowe i Rozciąganie',
      statusText: 'Ważny do: 2026-08-05',
      price: 'Zmieniona cena: 280.00 PLN',
      statusType: 'warning', // żółta etykieta
      avatar: '👤'
    },
    {
      id: 3,
      name: 'Helena Piątek',
      email: 'helena.wojcieszak@gmail.com',
      phone: '536290288',
      pass: '1 wejście',
      statusText: 'Ważny do: 2026-08-06',
      limitText: 'Dostępne zapisy: 0',
      statusType: 'warning',
      avatar: '👩'
    },
    {
      id: 4,
      name: 'Tomasz Piątek',
      email: 'tomek.piatek87@gmail.com',
      phone: '726433086',
      pass: '1 wejście',
      statusText: 'Ważny do: 2026-08-08',
      limitText: 'Dostępne zapisy: 0',
      statusType: 'warning',
      avatar: '👤'
    }
  ];

  const filteredClients = clientsData.filter(c => 
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone.includes(clientSearch)
  );

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-12">
      
      {/* SEKCJA 1: GRAFIK */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-xl font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            GRAFIK ↗
          </h2>
          <div className="flex items-center gap-2">
            <button className="p-2 bg-slate-900 border border-slate-800 rounded-lg hover:border-amber-500/50 text-slate-300">
              ◀
            </button>
            <button className="p-2 bg-slate-900 border border-slate-800 rounded-lg hover:border-amber-500/50 text-slate-300">
              ▶
            </button>
          </div>
        </div>

        {/* Dni tygodnia */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {scheduleData.map((dayCol, idx) => (
            <div key={idx} className="space-y-4">
              <div className="text-center bg-slate-900/80 border border-slate-800 py-2 rounded-xl text-sm font-bold text-slate-300">
                {dayCol.day} <span className="text-amber-500 text-xs font-semibold ml-1">{dayCol.date}</span>
              </div>

              <div className="space-y-3">
                {dayCol.classes.map((item, classIdx) => (
                  <div 
                    key={classIdx}
                    className={`bg-slate-900 border border-slate-800 border-l-4 ${item.color} rounded-xl p-4 space-y-3 hover:border-slate-700 transition-all`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-lg font-black text-white">{item.time}</span>
                        <h4 className="text-sm font-bold text-slate-200 mt-0.5">{item.title}</h4>
                      </div>
                      <button className="text-slate-500 hover:text-slate-300">⋮</button>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/20">
                        👥 {item.enrolled}/{item.max}
                      </span>
                      <span className="text-slate-400">⏱ {item.duration}</span>
                    </div>

                    <div className="text-xs text-slate-400 border-t border-slate-800/60 pt-2 flex items-center gap-1">
                      <span>👤</span> {item.trainer}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* SEKCJA 2: SPRZEDAŻ */}
      <section className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            SPRZEDAŻ ↗
          </h2>
          <select 
            value={salesPeriod}
            onChange={(e) => setSalesPeriod(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
          >
            <option>Dziś</option>
            <option>Ten tydzień</option>
            <option>Ten miesiąc</option>
          </select>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="bg-slate-950/40 p-4 border-b border-slate-800 flex justify-between items-center text-sm">
            <span className="text-slate-400 font-semibold">Łącznie:</span>
            <span className="text-lg font-black text-amber-500">0.00 PLN</span>
          </div>

          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 uppercase tracking-wider border-b border-slate-800">
                  <th className="pb-3 font-semibold">Karnet</th>
                  <th className="pb-3 font-semibold text-center">Ilość</th>
                  <th className="pb-3 font-semibold text-right">Kwota brutto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                <tr>
                  <td className="py-3 font-medium">MEDICOVER sport OPEN</td>
                  <td className="py-3 text-center">1</td>
                  <td className="py-3 text-right font-bold">0.00 PLN</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>


      {/* SEKCJA 3: KLIENCI */}
      <section className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            KLIENCI ↗
          </h2>
          <button className="px-4 py-2.5 bg-rose-900 hover:bg-rose-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md transition-all">
            + NOWY KLUBOWICZ
          </button>
        </div>

        {/* Wyszukiwarka */}
        <div className="relative">
          <span className="absolute left-4 top-3 text-slate-500">🔍</span>
          <input 
            type="text"
            placeholder="Szukaj klienta"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Lista Klientów */}
        <div className="space-y-3">
          {filteredClients.map((client) => (
            <div 
              key={client.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-lg shrink-0">
                  {client.avatar}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">{client.name}</h3>
                  </div>
                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                    <span>✉ {client.email}</span>
                    {client.phone && <span>📞 {client.phone}</span>}
                  </div>
                  <div className="text-xs font-semibold text-slate-300 pt-1">
                    {client.pass}
                  </div>
                  
                  {/* Statusy opłat */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      client.statusType === 'expired' 
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {client.statusText}
                    </span>

                    {client.installment && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {client.installment}
                      </span>
                    )}

                    {client.price && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-amber-400 border border-slate-700">
                        {client.price}
                      </span>
                    )}

                    {client.limitText && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {client.limitText}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Akcje / Ikonki */}
              <div className="flex items-center gap-3 text-slate-400 self-end md:self-center">
                <button className="p-2 hover:bg-slate-800 rounded-lg hover:text-white">✏️</button>
                <button className="p-2 hover:bg-slate-800 rounded-lg hover:text-white">⏱️</button>
                <button className="p-2 hover:bg-slate-800 rounded-lg hover:text-white">⋮</button>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
