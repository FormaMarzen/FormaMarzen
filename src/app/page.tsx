"use client";

import React, { useState } from 'react';

export default function DashboardPage() {
  const [salesPeriod, setSalesPeriod] = useState('Dziś');
  const [clientSearch, setClientSearch] = useState('');

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
    }
  ];

  const clientsData = [
    {
      id: 1,
      name: 'Anastazja Sowa',
      email: 'anastazjag@vp.pl',
      pass: 'OPEN - umowa 12 miesięcy',
      statusText: 'Opłacony do: 2026-07-31',
      installment: 'Rata: 6/12',
      statusType: 'expired',
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
      statusType: 'warning',
      avatar: '👤'
    }
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      
      {/* Układ dwukolumnowy (Desktop / iPad Horizontal) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEWA KOLUMNA: GRAFIK (7 z 12 kolumn) */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              GRAFIK <span className="text-xs">↗</span>
            </h2>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scheduleData.map((dayCol, idx) => (
                <div key={idx} className="space-y-3">
                  <div className="flex justify-between items-center bg-slate-950/60 border border-slate-800 py-2 px-3 rounded-xl text-xs font-bold text-slate-300">
                    <span>{dayCol.day}</span>
                    <span className="text-amber-500">{dayCol.date}</span>
                    <button className="text-slate-500">⋮</button>
                  </div>

                  <div className="space-y-3">
                    {dayCol.classes.map((item, classIdx) => (
                      <div 
                        key={classIdx}
                        className={`bg-slate-950/40 border border-slate-800 border-l-4 ${item.color} rounded-xl p-3 space-y-2 hover:border-slate-700 transition-all`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-base font-black text-white">{item.time}</span>
                            <h4 className="text-xs font-bold text-slate-300">{item.title}</h4>
                          </div>
                          <button className="w-6 h-6 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center text-xs">
                            ⋮
                          </button>
                        </div>

                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="bg-emerald-500/10 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/20">
                            👥 {item.enrolled}/{item.max}
                          </span>
                          <span className="text-slate-400">⏱ {item.duration}</span>
                        </div>

                        <div className="text-[11px] text-slate-400 border-t border-slate-800/60 pt-1.5 flex items-center gap-1">
                          <span>👤</span> {item.trainer}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRAWA KOLUMNA: SPRZEDAŻ + KLIENCI (5 z 12 kolumn) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* SPRZEDAŻ */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                SPRZEDAŻ <span className="text-xs">↗</span>
              </h2>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-400 text-sm">
                    $
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-300 uppercase">SPRZEDAŻ</div>
                    <div className="text-[10px] text-slate-500">2026-08-04 - 2026-08-04</div>
                  </div>
                </div>
                <select 
                  value={salesPeriod}
                  onChange={(e) => setSalesPeriod(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
                >
                  <option>Dziś</option>
                  <option>Miesiąc</option>
                </select>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-medium">Łącznie:</span>
                <span className="font-bold text-white">0.00 PLN</span>
              </div>

              <div className="text-[11px]">
                <div className="flex justify-between text-slate-500 pb-2 border-b border-slate-800 font-semibold">
                  <span>Karnet</span>
                  <span>Ilość</span>
                  <span>Kwota brutto</span>
                </div>
                <div className="flex justify-between text-slate-300 py-2 border-b border-slate-800/40">
                  <span>MEDICOVER sport OPEN</span>
                  <span>1</span>
                  <span>0.00 PLN</span>
                </div>
                <div className="flex justify-between text-slate-400 pt-2 font-bold text-xs">
                  <span>Łącznie:</span>
                  <span>0.00 PLN</span>
                </div>
              </div>
            </div>
          </section>

          {/* KLIENCI */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                KLIENCI <span className="text-xs">↗</span>
              </h2>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Szukaj klienta"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                />
                <button className="px-3 py-2 bg-rose-900 hover:bg-rose-800 text-white font-bold rounded-xl text-[11px] uppercase tracking-wider shrink-0">
                  + NOWY KLUBOWICZ
                </button>
              </div>

              <div className="space-y-3">
                {clientsData.map((client) => (
                  <div 
                    key={client.id}
                    className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-sm">
                          {client.avatar}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-xs">{client.name}</h4>
                          <span className="text-[10px] text-slate-400">✉ {client.email}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                        <button className="hover:text-white">✏️</button>
                        <button className="hover:text-white">⏱️</button>
                        <button className="hover:text-white">⋮</button>
                      </div>
                    </div>

                    <div className="text-[11px] font-medium text-slate-300">
                      {client.pass}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        client.statusType === 'expired' 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {client.statusText}
                      </span>
                      {client.installment && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                          {client.installment}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>

      </div>

    </div>
  );
}
