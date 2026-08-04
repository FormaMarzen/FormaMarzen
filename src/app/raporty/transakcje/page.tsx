"use client";

import React from 'react';

export default function TransactionsPage() {
  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24">
      <div className="flex justify-between items-center border-b border-sky-200 pb-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
          💳 Transakcje
        </h1>
        <button className="p-2 bg-white border border-sky-200 text-slate-700 rounded-xl shadow-sm">
          📥
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
          <span className="text-xs font-bold text-rose-800 uppercase">Podsumowanie</span>
          <div className="text-3xl font-black text-slate-900 mt-2">0 PLN</div>
          <div className="text-xs text-slate-500 mt-1">Transakcje: 1</div>
        </div>
      </div>

      <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-sky-50 text-sky-900 uppercase text-[10px] border-b border-sky-200">
              <th className="py-3 px-4 font-bold">Data</th>
              <th className="py-3 px-4 font-bold">Kupiec</th>
              <th className="py-3 px-4 font-bold">Cena brutto</th>
              <th className="py-3 px-4 font-bold">Produkty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            <tr>
              <td className="py-3 px-4 font-mono text-slate-500">2026-08-04 01:03</td>
              <td className="py-3 px-4 font-bold text-sky-700">Elżbieta Nowak</td>
              <td className="py-3 px-4 font-bold text-slate-900">0.00 PLN</td>
              <td className="py-3 px-4 text-slate-600">Karnet: MEDICOVER sport OPEN x1</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
