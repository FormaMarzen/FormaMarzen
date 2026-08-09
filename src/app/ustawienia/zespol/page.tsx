"use client";

import React, { useState } from 'react';

export default function ZespolPage() {
  const [zespol] = useState([
    {
      id: 1,
      nazwa: 'Kłaput Maciej',
      email: 'maciejklaput@gmail.com',
      rola: 'właściciel',
      dostepDo: 'Pełen dostęp',
      status: 'aktywny'
    },
    {
      id: 2,
      nazwa: 'Marzeń Forma',
      email: 'maciejklaput+wodguru@gmail.com',
      rola: 'recepcja',
      dostepDo: 'Panel główny, Grafik',
      status: 'aktywny'
    },
    {
      id: 3,
      nazwa: 'Ratajczak Monika',
      email: 'monika@formamarzen.pl',
      rola: 'trener',
      dostepDo: 'Grafik',
      status: 'Nieaktywowane'
    }
  ]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Górny pasek z nagłówkiem i przyciskami */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-xl font-bold text-gray-700 tracking-wide uppercase">
            Zarządzaj zespołem
          </h1>
          <div className="flex items-center gap-3">
            <button className="bg-[#7A1215] hover:bg-[#630E10] text-white px-5 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition-colors">
              <span>+ DODAJ</span>
            </button>
            <button className="bg-sky-100/70 hover:bg-sky-200/70 text-sky-800 px-4 py-2 rounded-lg font-medium text-sm transition-colors">
              POMOC
            </button>
          </div>
        </div>

        {/* Tabela zespołu */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Nazwa</th>
                  <th className="py-4 px-6">Email</th>
                  <th className="py-4 px-6">Rola</th>
                  <th className="py-4 px-6">Dostęp do</th>
                  <th className="py-4 px-6 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {zespol.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 font-medium text-gray-800 flex items-center gap-3">
                      {item.nazwa}
                      {item.status === 'Nieaktywowane' && (
                        <span className="bg-amber-100/80 text-amber-800 text-xs px-2 py-0.5 rounded font-normal">
                          Nieaktywowane
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-gray-500">{item.email}</td>
                    <td className="py-4 px-6 text-gray-600 capitalize">{item.rola}</td>
                    <td className="py-4 px-6 text-gray-700 font-medium">{item.dostepDo}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Przycisk edycji (czerwone kółko z ołówkiem) */}
                        <button className="w-8 h-8 bg-[#7A1215] hover:bg-[#630E10] text-white rounded-full flex items-center justify-center shadow-sm transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {/* Ikona menu / opcji */}
                        <button className="w-8 h-8 text-gray-400 hover:text-gray-600 rounded-full flex items-center justify-center transition-colors">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="6" r="1.5" />
                            <circle cx="12" cy="12" r="1.5" />
                            <circle cx="12" cy="18" r="1.5" />
                          </svg>
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
    </div>
  );
}
