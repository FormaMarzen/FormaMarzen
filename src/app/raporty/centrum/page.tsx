"use client";

import React from 'react';

export default function ReportsCenterPage() {
  return (
    <div className="max-w-[1700px] mx-auto space-y-8 pb-24">
      
      {/* Nagłówek Sekcji */}
      <div className="border-b border-slate-800 pb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-slate-200">
            📈 Centrum Raportów & Analityki
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Podsumowanie stanu klubu, umów, płatności i frekwencji
          </p>
        </div>
        <select className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 font-semibold focus:outline-none">
          <option>Ostatnie 30 dni</option>
          <option>Ten miesiąc (sierpień)</option>
          <option>Ten rok (2026)</option>
        </select>
      </div>

      {/* Główny Układ 3-Kolumnowy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* ================= KOLUMNA 1: KLIENCI & FREKWENCJA ================= */}
        <div className="space-y-6">
          
          {/* Widget 1: KLIENCI */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                👥 Klienci
              </h2>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/40">
                <span className="text-slate-400 font-medium">Klubowicze:</span>
                <span className="font-bold text-white underline">38</span>
              </div>
              <div className="flex justify-between py-1 pl-3 text-emerald-400">
                <span>✓ Z ważnym karnetem:</span>
                <span className="font-bold underline">38</span>
              </div>
              <div className="flex justify-between py-1 pl-6 text-slate-400">
                <span>Darmowy karnet:</span>
                <span className="font-bold underline text-slate-200">3</span>
              </div>
              <div className="flex justify-between py-1 pl-6 text-slate-400">
                <span>Płatny karnet:</span>
                <span className="font-bold underline text-slate-200">35</span>
              </div>
              <div className="flex justify-between py-1 pl-3 text-rose-400">
                <span>✕ Z nieważnym karnetem:</span>
                <span className="font-bold underline">0</span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-800/40 pt-2 text-slate-400 font-medium">
                <span>Goście:</span>
                <span className="font-bold text-white underline">127</span>
              </div>
            </div>

            {/* Wykres: Nowi klienci */}
            <div className="pt-3 border-t border-slate-800">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase mb-3">Nowi klienci w czasie</h3>
              <div className="h-32 bg-slate-950/60 rounded-xl p-3 flex items-end justify-between gap-1">
                {[40, 65, 30, 80, 50, 45, 90, 60, 75, 85].map((val, idx) => (
                  <div key={idx} className="w-full bg-emerald-500/20 rounded-t hover:bg-emerald-500/40 transition-all flex flex-col justify-end" style={{ height: `${val}%` }}>
                    <div className="bg-emerald-400 h-1/2 rounded-t"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Widget 2: ZAPISY */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                ☑ Zapisy
              </h2>
              <span className="text-[10px] text-slate-500 font-semibold">Ostatnie 7 dni</span>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
              <span className="text-xs font-semibold text-slate-400 uppercase">Łącznie zapisów</span>
              <div className="text-4xl font-black text-amber-500 mt-1">101</div>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase mb-2">Najczęściej odwiedzane zajęcia</h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">Wt 18:00 Brzuch</span>
                      <span className="text-amber-400 font-bold">17</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full w-[85%]"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">Pt 18:25 Ogólnorozwojowe</span>
                      <span className="text-amber-400 font-bold">11</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full w-[55%]"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase mb-2">Średnia ilość klubowiczów na dzień</h3>
                <div className="h-24 bg-slate-950/60 rounded-xl p-2 flex items-end justify-between gap-2">
                  {['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'].map((day, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-teal-500/40 rounded-t" style={{ height: `${(idx % 3 + 1) * 25}%` }}></div>
                      <span className="text-[9px] text-slate-500">{day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ================= KOLUMNA 2: KARNETY & NADCHODZĄCE PŁATNOŚCI ================= */}
        <div className="space-y-6">
          
          {/* Widget 1: KARNETY */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                💳 Karnety
              </h2>
              <span className="text-[10px] text-slate-500">Na podstawie aktywnych karnetów</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                    <th className="pb-2">Nazwa</th>
                    <th className="pb-2 text-center">Wszystkie</th>
                    <th className="pb-2 text-center">Opłacone</th>
                    <th className="pb-2 text-right">Cena</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300 text-[11px]">
                  <tr>
                    <td className="py-2 font-semibold text-white">OPEN</td>
                    <td className="py-2 text-center underline font-bold">11</td>
                    <td className="py-2 text-center font-bold text-emerald-400">11</td>
                    <td className="py-2 text-right">319.00 PLN</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-semibold text-white">OPEN - 12 miesięcy</td>
                    <td className="py-2 text-center underline font-bold">8</td>
                    <td className="py-2 text-center font-bold text-emerald-400">7</td>
                    <td className="py-2 text-right">289.00 PLN</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-semibold text-white">OPEN - 6 miesięcy</td>
                    <td className="py-2 text-center underline font-bold">5</td>
                    <td className="py-2 text-center font-bold text-emerald-400">5</td>
                    <td className="py-2 text-right">1720.00 PLN</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-semibold text-white">10 wejść</td>
                    <td className="py-2 text-center underline font-bold">5</td>
                    <td className="py-2 text-center font-bold text-emerald-400">5</td>
                    <td className="py-2 text-right">289.00 PLN</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Wykres Kołowy */}
            <div className="pt-3 border-t border-slate-800 flex justify-center">
              <div className="w-32 h-32 rounded-full border-8 border-indigo-500 border-t-amber-500 border-r-emerald-500 border-l-rose-500 flex items-center justify-center font-bold text-xs text-slate-400">
                Rozkład
              </div>
            </div>
          </div>

          {/* Widget 2: NADCHODZĄCE PŁATNOŚCI */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                💲 Nadchodzące Płatności
              </h2>
              <span className="text-[10px] text-slate-500">Na podstawie odnawialnych karnetów</span>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-center space-y-1">
              <div className="text-[11px] font-bold text-amber-500">2026-08-04 - 2026-08-11</div>
              <div className="text-2xl font-black text-white">0 PLN</div>
              <div className="text-[10px] text-slate-500">Brak planowanych pobrań w tym tygodniu</div>
            </div>
          </div>

        </div>

        {/* ================= KOLUMNA 3: UMOWY, PŁATNOŚCI & PRZYCHÓD ================= */}
        <div className="space-y-6">
          
          {/* Widget 1: RAPORT UMÓW */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                🔄 Raport Umów
              </h2>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase">Aktywnych umów</span>
                <div className="text-3xl font-black text-white mt-0.5">12</div>
              </div>
              <div className="bg-sky-500/20 border border-sky-500/30 px-3 py-2 rounded-xl text-right">
                <span className="text-[10px] text-sky-400 font-bold uppercase">Przychód stały</span>
                <div className="text-sm font-black text-sky-300">📈 3 296 PLN/mc</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Nowych umów</span>
                <div className="text-xl font-black text-emerald-400 mt-1">0</div>
                <span className="text-[9px] text-emerald-500">+0 PLN/mc</span>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Wypowiedzeń</span>
                <div className="text-xl font-black text-rose-400 mt-1">0</div>
                <span className="text-[9px] text-rose-500">0 PLN/mc</span>
              </div>
            </div>
          </div>

          {/* Widget 2: PŁATNOŚCI (sierpień) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                💳 Płatności <span className="text-slate-500 text-xs font-normal">(sierpień)</span>
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-center">
                <span className="text-[9px] font-bold text-emerald-400 uppercase">Opłacone</span>
                <div className="text-xs font-black text-white mt-1">1 088 PLN</div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-center">
                <span className="text-[9px] font-bold text-amber-400 uppercase">Nadchodzące</span>
                <div className="text-xs font-black text-white mt-1">2 732 PLN</div>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">
                <span className="text-[9px] font-bold text-rose-400 uppercase">Przeterminowane</span>
                <div className="text-xs font-black text-white mt-1">289 PLN</div>
              </div>
            </div>
          </div>

          {/* Widget 3: PRZYCHÓD W CZASIE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-lg">
            <h3 className="text-xs font-bold text-slate-300 uppercase">📈 Przychód w czasie</h3>
            <div className="h-28 bg-slate-950/60 rounded-xl p-3 flex items-end justify-between gap-1">
              {[30, 45, 60, 40, 75, 90, 80, 95].map((h, i) => (
                <div key={i} className="w-full bg-sky-500/30 rounded-t hover:bg-sky-400 transition-all" style={{ height: `${h}%` }}></div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
