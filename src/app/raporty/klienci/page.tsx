"use client";

import React, { useState } from 'react';

export default function ClientsReportPage() {
  const [searchQuery, setSearchQuery] = useState('');

  // Przykładowe dane klientów odtworzone ze zrzutów ekranu
  const clients = [
    { id: 1, firstName: 'Jolanta', lastName: 'Andryszak', registered: '2026-05-24', activated: '2026-06-05', email: 'jandryszak@wp.pl', phone: '691118579', pass: 'Ogólnorozwojowe i Rozciąganie', status: '2026-08-05 (aktywny)', type: 'active' },
    { id: 2, firstName: 'Agnieszka', lastName: 'Antczak-Falkowska', registered: '2026-06-22', activated: '2026-06-22', email: 'a.antfalk@gmail.com', phone: '509922199', pass: '10 wejść', status: '3 sesje', type: 'warning' },
    { id: 3, firstName: 'Ewelina', lastName: 'Bańka', registered: '2024-10-29', activated: '2024-10-29', email: 'ewelina.kolska33@gmail.com', phone: '886075079', pass: '-', status: 'GOŚĆ', type: 'guest' },
    { id: 4, firstName: 'Małgorzata', lastName: 'Berezowska', registered: '2026-05-31', activated: '-', email: 'marga.berezowski@gmail.com', phone: '790500147', pass: '-', status: 'GOŚĆ', type: 'guest' },
    { id: 5, firstName: 'Dagmara', lastName: 'Bielicz', registered: '2024-02-10', activated: '2024-02-12', email: 'dagma85@googlemail.com', phone: '-', pass: '10 wejść', status: '9 sesji do 2026-08-13', type: 'warning' },
    { id: 6, firstName: 'Aleksandra', lastName: 'Bladt', registered: '2025-01-16', activated: '2025-01-16', email: 'aleksandra.pawliczek@gmail.com', phone: '501122210', pass: '-', status: 'GOŚĆ', type: 'guest' },
    { id: 7, firstName: 'Aleksandra', lastName: 'Błażowska', registered: '2026-02-23', activated: '-', email: 'o.blazowska@op.pl', phone: '512621175', pass: '-', status: 'GOŚĆ', type: 'guest' },
  ];

  const filteredClients = clients.filter(c => 
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24">
      
      {/* Pasek Nagłówka */}
      <div className="flex justify-between items-center border-b border-sky-200 pb-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
          👥 Klienci
        </h1>
        <div className="flex items-center gap-2">
          <button className="p-2 bg-white border border-sky-200 text-slate-700 rounded-xl hover:bg-sky-50 shadow-sm transition-all" title="Ustawienia tabeli">
            ⚙️
          </button>
          <button className="p-2 bg-white border border-sky-200 text-slate-700 rounded-xl hover:bg-sky-50 shadow-sm transition-all" title="Eksportuj">
            📥
          </button>
        </div>
      </div>

      {/* Wyszukiwanie i Filtry */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-3 text-slate-400">🔍</span>
            <input 
              type="text"
              placeholder="Wyszukaj po imieniu, nazwisku, emailu lub telefonie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-sky-200 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
            />
          </div>
          <button className="px-4 py-2.5 bg-rose-800 hover:bg-rose-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 shadow-sm transition-all">
            <span>🎛️</span> Ustaw filtry
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-white border border-sky-200 text-slate-500 text-xs px-3 py-1 rounded-lg">
            Brak filtrów
          </span>
        </div>
      </div>

      {/* Tabela Klientów */}
      <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-sky-50/80 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200">
                <th className="py-3 px-3 text-center"><input type="checkbox" className="rounded border-sky-300" /></th>
                <th className="py-3 px-3 font-bold">Imię ↕</th>
                <th className="py-3 px-3 font-bold">Nazwisko ↕</th>
                <th className="py-3 px-3 font-bold">Zarejestrowany ↕</th>
                <th className="py-3 px-3 font-bold">Aktywowany ↕</th>
                <th className="py-3 px-3 font-bold">Email ↕</th>
                <th className="py-3 px-3 font-bold">Telefon ↕</th>
                <th className="py-3 px-3 font-bold">Karnet ↕</th>
                <th className="py-3 px-3 font-bold">Wygaśnie / Status ↕</th>
                <th className="py-3 px-3 text-right font-bold">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-sky-50/40 transition-colors">
                  <td className="py-3.5 px-3 text-center">
                    <input type="checkbox" className="rounded border-sky-300" />
                  </td>
                  <td className="py-3.5 px-3 font-bold text-slate-900">{client.firstName}</td>
                  <td className="py-3.5 px-3 font-bold text-slate-900">{client.lastName}</td>
                  <td className="py-3.5 px-3 font-mono text-slate-500">{client.registered}</td>
                  <td className="py-3.5 px-3 font-mono text-slate-500">{client.activated}</td>
                  <td className="py-3.5 px-3 text-sky-700 font-medium hover:underline cursor-pointer">
                    {client.email}
                  </td>
                  <td className="py-3.5 px-3 font-mono text-slate-600">{client.phone}</td>
                  <td className="py-3.5 px-3 font-semibold text-slate-800">{client.pass}</td>
                  <td className="py-3.5 px-3">
                    {client.type === 'guest' && (
                      <span className="px-2.5 py-1 bg-sky-100 text-sky-800 font-bold rounded-md text-[10px] border border-sky-200">
                        {client.status}
                      </span>
                    )}
                    {client.type === 'warning' && (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-md text-[10px] border border-amber-200">
                        {client.status}
                      </span>
                    )}
                    {client.type === 'active' && (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-md text-[10px] border border-emerald-200">
                        {client.status}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1 text-slate-400">
                      <button className="p-1 hover:text-slate-800 rounded">✏️</button>
                      <button className="p-1 hover:text-slate-800 rounded">⋮</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dół Tabeli / Paginacja */}
        <div className="bg-sky-50/50 px-4 py-3 border-t border-sky-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>Łącznie: <span className="font-bold text-slate-900">167</span></div>
          <div className="flex items-center gap-3">
            <span>Strona: 1 z 4</span>
            <div className="flex items-center gap-1">
              <button className="p-1 hover:bg-white rounded border border-transparent hover:border-sky-200 disabled:opacity-30" disabled>⏮</button>
              <button className="p-1 hover:bg-white rounded border border-transparent hover:border-sky-200 disabled:opacity-30" disabled>◀</button>
              <span className="px-2.5 py-1 bg-sky-600 text-white font-bold rounded-lg text-xs shadow-sm">1</span>
              <button className="p-1 hover:bg-white rounded border border-transparent hover:border-sky-200">▶</button>
              <button className="p-1 hover:bg-white rounded border border-transparent hover:border-sky-200">⏭</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
