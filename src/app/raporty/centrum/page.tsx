"use client";

import React from 'react';

export default function ReportsCenterPage() {
  return (
    <div className="max-w-[1700px] mx-auto space-y-8 pb-24">
      <div className="border-b border-sky-200 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
            📈 Centrum Raportów & Analityki
          </h1>
          <p className="text-xs text-slate-500 mt-1">Podsumowanie stanu klubu, umów, płatności i frekwencji</p>
        </div>
        <select className="bg-white border border-sky-200 text-xs text-slate-700 rounded-xl px-3 py-2 font-semibold shadow-sm">
          <option>Ten miesiąc (sierpień)</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* KOLUMNA 1 */}
        <div className="space-y-6">
          <div className="bg-white border border-sky-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-sky-900 border-b border-sky-100 pb-3">
              👥 Klienci
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Klubowicze:</span>
                <span className="font-bold text-slate-900 underline">38</span>
              </div>
              <div className="flex justify-between py-1 pl-3 text-emerald-700 font-semibold">
                <span>✓ Z ważnym karnetem:</span>
                <span className="font-bold underline">38</span>
              </div>
            </div>
          </div>
        </div>

        {/* KOLUMNA 2 */}
        <div className="space-y-6">
          <div className="bg-white border border-sky-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-sky-900 border-b border-sky-100 pb-3">
              💳 Karnety
            </h2>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 uppercase text-[10px] border-b border-slate-100">
                  <th className="pb-2">Nazwa</th>
                  <th className="pb-2 text-center">Opłacone</th>
                  <th className="pb-2 text-right">Cena</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                <tr>
                  <td className="py-2 font-semibold text-slate-900">OPEN</td>
                  <td className="py-2 text-center font-bold text-emerald-600">11</td>
                  <td className="py-2 text-right">319.00 PLN</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* KOLUMNA 3 */}
        <div className="space-y-6">
          <div className="bg-white border border-sky-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-sky-900 border-b border-sky-100 pb-3">
              🔄 Raport Umów
            </h2>
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-slate-600 uppercase">Aktywne umowy</span>
                <div className="text-3xl font-black text-slate-900 mt-0.5">12</div>
              </div>
              <div className="bg-sky-200/50 border border-sky-300 px-3 py-2 rounded-xl text-right">
                <span className="text-[10px] text-sky-800 font-bold uppercase">Przychód stały</span>
                <div className="text-sm font-black text-sky-900">3 296 PLN/mc</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
