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
      
      {/* Układ dwukolumnowy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEWA KOLUMNA: GRAFIK */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold uppercase tracking-wider text-sky-900 flex items-center gap-2">
              GRAFIK <span className="text-xs">↗</span>
            </h2>
          </div>

          <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scheduleData.map((dayCol, idx) => (
                <div key={idx} className="space-y-3">
                  <div className="flex justify-between items-center bg-sky-100/70 border border-sky-200 py-2 px-3 rounded-xl text-xs font-bold text-sky-900">
                    <span>{dayCol.day}</span>
                    <span className="text-sky-600">{dayCol.date}</span>
                    <button className="text-slate-400 hover:text-slate-600">⋮</button>
                  </div>

                  <div className="space-y-3">
                    {dayCol.classes.map((item, classIdx) => (
                      <div 
                        key={classIdx}
                        className={`bg-white border border-sky-100 border-l-4 ${item.color} rounded-xl p-3.5 space-y-2.5 shadow-sm hover:border-sky-300 transition-all`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-lg font-black text-slate-900">{item.time}</span>
                            <h4 className="text-xs font-bold text-slate-700">{item.title}</h4>
                          </div>
                          <button className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xs">
                            ⋮
                          </button>
                        </div>

                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                            👥 {item.enrolled}/{item.max}
                          </span>
                          <span className="text-slate-500 font-medium">⏱ {item.duration}</span>
                        </div>

                        <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex items-center gap-1">
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

        {/* PRAWA KOLUMNA: SPRZEDAŻ + KLIENCI */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* SPRZEDAŻ */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold uppercase tracking-wider text-sky-900 flex items-center gap-2">
                SPRZEDAŻ <span className="text-xs">↗</span>
              </h2>
            </div>

            <div className="bg-white border border-sky-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-sky-100 rounded-full flex items-center justify-center font-bold text-sky-700 text-sm">
                    $
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 uppercase">SPRZEDAŻ</div>
                    <div className="text-[10px] text-slate-500">2026-08-04 - 2026-08-04</div>
                  </div>
                </div>
                <select 
                  value={salesPeriod}
                  onChange={(e) => setSalesPeriod(e.target.value)}
                  className="bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium focus:outline-none"
                >
                  <option>Dziś</option>
                  <option>Miesiąc</option>
                </select>
              </div>

              <div className="bg-sky-50 p-3 rounded-xl border border-sky-100 flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">Łącznie:</span>
                <span className="font-bold text-slate-900 text-sm">0.00 PLN</span>
              </div>

              <div className="text-[11px]">
                <div className="flex justify-between text-slate-500 pb-2 border-b border-sky-100 font-semibold">
                  <span>Karnet</span>
                  <span>Ilość</span>
                  <span>Kwota brutto</span>
                </div>
                <div className="flex justify-between text-slate-700 py-2 border-b border-slate-100">
                  <span>MEDICOVER sport OPEN</span>
                  <span>1</span>
                  <span>0.00 PLN</span>
                </div>
                <div className="flex justify-between text-slate-900 pt-2 font-bold text-xs">
                  <span>Łącznie:</span>
                  <span>0.00 PLN</span>
                </div>
              </div>
            </div>
          </section>

          {/* KLIENCI */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold uppercase tracking-wider text-sky-900 flex items-center gap-2">
                KLIENCI <span className="text-xs">↗</span>
              </h2>
            </div>

            <div className="bg-white border border-sky-200 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Szukaj klienta"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="flex-1 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                />
                <button className="px-3.5 py-2 bg-rose-800 hover:bg-rose-700 text-white font-bold rounded-xl text-[11px] uppercase tracking-wider shrink-0 shadow-sm">
                  + NOWY KLUBOWICZ
                </button>
              </div>

              <div className="space-y-3">
                {clientsData.map((client) => (
                  <div 
                    key={client.id}
                    className="bg-sky-50/50 border border-sky-100 rounded-xl p-3.5 space-y-2 hover:border-sky-300 transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-sky-200/60 rounded-full flex items-center justify-center text-sm">
                          {client.avatar}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs">{client.name}</h4>
                          <span className="text-[10px] text-slate-500">✉ {client.email}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                        <button className="hover:text-slate-700">✏️</button>
                        <button className="hover:text-slate-700">⏱️</button>
                        <button className="hover:text-slate-700">⋮</button>
                      </div>
                    </div>

                    <div className="text-[11px] font-medium text-slate-700">
                      {client.pass}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        client.statusType === 'expired' 
                          ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {client.statusText}
                      </span>
                      {client.installment && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
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
