"use client";

import React, { useState, useEffect, useRef } from 'react';

export default function ClassesReportPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Domyślny zakres dat obejmujący bieżący okres sierpnia 2026
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate] = useState('2026-08-14');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [allGeneratedClasses, setAllGeneratedClasses] = useState<any[]>([]);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedGrafik = localStorage.getItem('forma_marzen_grafik_zajec');
        const savedNadpisania = localStorage.getItem('forma_marzen_nadpisane_zajecia_dni');
        const savedJednorazowe = localStorage.getItem('forma_marzen_jednorazowe_zajecia');
        const savedZapisy = localStorage.getItem('forma_marzen_zapisy_uczestnicy');

        const grafik = savedGrafik ? JSON.parse(savedGrafik) : [];
        const nadpisania = savedNadpisania ? JSON.parse(savedNadpisania) : {};
        const jednorazowe = savedJednorazowe ? JSON.parse(savedJednorazowe) : [];
        const zapisy = savedZapisy ? JSON.parse(savedZapisy) : {};

        let generated: any[] = [];
        const dayKeyMap: { [key: string]: number } = {
          'pon': 1,
          'wt': 2,
          'sr': 3,
          'czw': 4,
          'pt': 5
        };

        const genStart = new Date(2026, 0, 1);
        const genEnd = new Date(2026, 11, 31);

        for (let d = new Date(genStart); d <= genEnd; d.setDate(d.getDate() + 1)) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const dateStringFull = `${year}-${month}-${day}`;
          const displayDate = `${day}/${month}`;
          const jsDay = d.getDay();

          grafik.forEach((item: any) => {
            if (item.days) {
              Object.entries(item.days).forEach(([key, isActive]) => {
                if (isActive && dayKeyMap[key] === jsDay) {
                  const classKey = `${item.id}_${displayDate}`;
                  const override = nadpisania[classKey];

                  if (override?.isUsunięte) return; // Pomijamy usunięte zajęcia

                  const finalStart = override?.start || item.start || '08:00';
                  const finalTrainer = override?.trainer || item.trainer || 'Brak trenera';
                  const finalLimit = override?.limit || item.limit || 12;
                  const finalTitle = item.title || 'Zajęcia';

                  const zapisaniLista = zapisy[classKey] || [];
                  const enrolledCount = zapisaniLista.length;

                  generated.push({
                    id: `${item.id}_${dateStringFull}`,
                    dateSort: `${dateStringFull} ${finalStart}`,
                    dateStr: `${dateStringFull} ${finalStart}`,
                    title: finalTitle,
                    trainer: finalTrainer,
                    room: '',
                    enrolled: enrolledCount,
                    max: finalLimit,
                    pureDate: dateStringFull,
                    isOdwołane: override?.isOdwołane || false
                  });
                }
              });
            }
          });
        }

        jednorazowe.forEach((item: any) => {
          if (item.isUsunięte) return;

          const classKey = `${item.id}_${item.displayDate}`;
          const zapisaniLista = zapisy[classKey] || [];
          const enrolledCount = zapisaniLista.length;
          const fullDateStr = item.fullDateStr || '2026-08-06';
          const finalStart = item.start || '14:00';

          generated.push({
            id: `jedr_${item.id}`,
            dateSort: `${fullDateStr} ${finalStart}`,
            dateStr: `${fullDateStr} ${finalStart}`,
            title: item.title,
            trainer: item.trainer || 'Brak trenera',
            room: '',
            enrolled: enrolledCount,
            max: item.limit || 12,
            pureDate: fullDateStr,
            isOdwołane: item.isOdwołane || false
          });
        });

        generated.sort((a, b) => a.dateSort.localeCompare(b.dateSort));
        setAllGeneratedClasses(generated);
      } catch (e) {
        console.error("Błąd generowania raportu", e);
      }
    }
  }, []);

  const filteredClasses = allGeneratedClasses.filter(c => {
    const matchesSearch = 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.trainer.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    return c.pureDate >= startDate && c.pureDate <= endDate;
  });

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 relative">
      
      {/* Pasek Nagłówka */}
      <div className="flex justify-between items-center border-b border-sky-200 pb-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
          📅 Zajęcia i Zapisy
        </h1>
        <button 
          title="Eksportuj"
          className="p-2 bg-white border border-sky-200 text-slate-700 rounded-xl hover:bg-sky-50 shadow-sm transition-all"
        >
          📥
        </button>
      </div>

      {/* Wyszukiwanie i Interaktywny Kalendarz Zakresu Dat */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center relative">
        <div className="relative flex-1 w-full">
          <span className="absolute left-4 top-3 text-slate-400">🔍</span>
          <input 
            type="text"
            placeholder="Wyszukaj zajęcia lub trenera..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-sky-200 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
          />
        </div>

        {/* PRZYCISK KALENDARZA ZAKRESU DAT */}
        <div className="relative" ref={datePickerRef}>
          <button 
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className="flex items-center gap-2 bg-white border border-sky-200 hover:border-sky-300 rounded-xl px-4 py-2.5 shadow-sm text-xs font-bold text-slate-800 transition-colors cursor-pointer"
          >
            <span>📅</span>
            <span>{startDate} - {endDate}</span>
            <span className="text-slate-400">▾</span>
          </button>

          {/* ROZWIWANE OKNO KALENDARZA */}
          {isDatePickerOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-sky-200 rounded-2xl shadow-2xl p-5 z-50 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <h3 className="font-black text-xs text-sky-950 uppercase tracking-wider border-b border-sky-100 pb-2">
                Wybierz zakres dat raportu
              </h3>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 block">DATA OD:</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 font-bold text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600 block">DATA DO:</label>
                  <input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-sky-100 flex justify-end gap-2">
                <button 
                  onClick={() => setIsDatePickerOpen(false)}
                  className="bg-sky-900 hover:bg-sky-800 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-sm"
                >
                  Zastosuj
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabela Zajęć */}
      <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-sky-50/80 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200">
                <th className="py-3.5 px-4 font-bold">Data</th>
                <th className="py-3.5 px-4 font-bold">Zajęcia</th>
                <th className="py-3.5 px-4 font-bold">Trener</th>
                <th className="py-3.5 px-4 font-bold">Sala Treningowa</th>
                <th className="py-3.5 px-4 font-bold text-right">Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredClasses.length > 0 ? (
                filteredClasses.map((item) => (
                  <tr key={item.id} className="hover:bg-sky-50/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-500 flex items-center gap-2">
                      {item.dateStr}
                      {item.isOdwołane && (
                        <span className="bg-rose-100 text-rose-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-rose-200 uppercase">
                          Odwołane
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{item.title}</td>
                    <td className="py-3.5 px-4 text-slate-600">{item.trainer}</td>
                    <td className="py-3.5 px-4 text-slate-400">{item.room || '-'}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`font-bold px-2.5 py-1 rounded-md border text-xs ${
                          item.enrolled >= item.max 
                            ? 'bg-rose-100 text-rose-900 border-rose-200' 
                            : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        }`}>
                          {item.enrolled}/{item.max}
                        </span>
                        <button className="text-slate-400 hover:text-sky-600 p-1" title="Podgląd zapisanych">
                          🔍
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                    Brak zajęć w wybranym zakresie dat lub dla podanych kryteriów wyszukiwania.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Dół Tabeli / Paginacja */}
        <div className="bg-sky-50/50 px-4 py-3 border-t border-sky-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>Łącznie: <span className="font-bold text-slate-900">{filteredClasses.length}</span></div>
          <div className="flex items-center gap-3">
            <span>Strona: 1 z 1</span>
            <div className="flex items-center gap-1">
              <button className="p-1 hover:bg-white rounded border border-transparent hover:border-sky-200 disabled:opacity-30" disabled>⏮</button>
              <button className="p-1 hover:bg-white rounded border border-transparent hover:border-sky-200 disabled:opacity-30" disabled>◀</button>
              <span className="px-2.5 py-1 bg-sky-600 text-white font-bold rounded-lg text-xs shadow-sm">1</span>
              <button className="p-1 hover:bg-white rounded border border-transparent hover:border-sky-200 disabled:opacity-30" disabled>▶</button>
              <button className="p-1 hover:bg-white rounded border border-transparent hover:border-sky-200 disabled:opacity-30" disabled>⏭</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
