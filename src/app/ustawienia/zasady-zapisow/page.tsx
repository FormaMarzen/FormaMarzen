"use client";

import React from 'react';

export default function ZasadyZapisowPage() {
  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      
      {/* GÓRNY PASEK AKCJI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-sky-200 p-5 rounded-2xl shadow-sm">
        <h1 className="text-lg font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
          📋 ZASADY ZAPISÓW
        </h1>
        <div className="flex items-center gap-2">
          <button className="bg-rose-900 hover:bg-rose-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm">
            ✏️ EDYTUJ
          </button>
          <button className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors">
            🕒 LOGI ZAPISÓW
          </button>
          <button className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors">
            ❓ POMOC
          </button>
        </div>
      </div>

      {/* SEKCJA GŁÓWNA Z TREŚCIĄ ZASAD */}
      <div className="bg-white border border-sky-200 rounded-2xl p-8 shadow-sm space-y-8">
        
        {/* GRUPA: ZAPISY */}
        <div className="space-y-4">
          <h2 className="text-xs font-black text-sky-900 uppercase tracking-widest border-b border-sky-100 pb-2">
            Zapisy
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-xs text-slate-700">
            <div><span className="font-semibold text-slate-900">Minimalny czas do wypisu z zajęć:</span> 1h 30min</div>
            <div><span className="font-semibold text-slate-900">Na ile przed rozpoczęciem zajęć blokujemy możliwość zapisywania się:</span> Bez limitu</div>
            <div><span className="font-semibold text-slate-900">Ile dni przed rozpoczęciem zajęć, klubowicz może się na nie zapisać:</span> 14 dni</div>
            <div><span className="font-semibold text-slate-900">Ile dni po wygaśnięciu karnetu okresowego, klubowicz może zapisać się na zajęcia:</span> 15 dni</div>
            <div><span className="font-semibold text-slate-900">Na ile zajęć, klubowicz może się zapisać dziennie:</span> Bez limitu</div>
            <div><span className="font-semibold text-slate-900">Na ile zajęć jednego typu klubowicz może się zapisać dziennie:</span> 1</div>
            <div><span className="font-semibold text-slate-900">Widok zajęć w grafiku dla zalogowanych klubowiczów:</span> Wszystkie (dostępne w grafiku publicznym)</div>
            <div><span className="font-semibold text-slate-900">Ukryj widok frekwencji zajęć w aplikacji użytkownika:</span> Nie</div>
            <div><span className="font-semibold text-slate-900">Wyślij dodatkową wiadomość SMS o automatycznym anulowaniu zajęć:</span> Wyłączono</div>
            <div><span className="font-semibold text-slate-900">Nie przywracaj sesji z zapisów ze starego karnetu, po zakupie nowego:</span> Wyłączono</div>
          </div>
        </div>

        {/* GRUPA: NIEOBECNOŚCI */}
        <div className="space-y-4 pt-4 border-t border-sky-100">
          <h2 className="text-xs font-black text-sky-900 uppercase tracking-widest border-b border-sky-100 pb-2">
            Nieobecności
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-xs text-slate-700">
            <div><span className="font-semibold text-slate-900">Opłata za nieobecność:</span> Wyłączono</div>
            <div><span className="font-semibold text-slate-900">Blokada zapisów:</span> 3 dni</div>
          </div>
        </div>

        {/* GRUPA: LISTA REZERWOWA */}
        <div className="space-y-4 pt-4 border-t border-sky-100">
          <h2 className="text-xs font-black text-sky-900 uppercase tracking-widest border-b border-sky-100 pb-2 flex items-center justify-between">
            <span>Lista rezerwowa</span>
            <span className="text-[10px] text-sky-600 font-normal cursor-pointer hover:underline">Jak to działa?</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 text-xs text-slate-700">
            <div><span className="font-semibold text-slate-900">Lista rezerwowa:</span> Włączono</div>
            <div><span className="font-semibold text-slate-900">Wyślij dodatkową wiadomość SMS o przepisaniu z listy rezerwowej na listę główną:</span> Wyłączono</div>
          </div>
        </div>

      </div>

    </div>
  );
}
