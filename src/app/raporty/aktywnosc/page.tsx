"use client";

import React, { useState, useEffect, useRef } from 'react';

export default function ActivityReportPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Zakres dat dla kolumny dynamicznej (domyślnie 2026-08-01 do 2026-08-04)
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate] = useState('2026-08-04');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [klubowiczeRaport, setKlubowiczeRaport] = useState<any[]>([]);
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
        const savedKlienci = localStorage.getItem('forma_marzen_klienci');
        const savedZapisy = localStorage.getItem('forma_marzen_zapisy_uczestnicy');

        const klienci = savedKlienci ? JSON.parse(savedKlienci) : [];
        const zapisy = savedZapisy ? JSON.parse(savedZapisy) : {};

        // Dzisiejsza data bazowa do obliczeń (np. 6 sierpnia 2026)
        const bazaData = new Date(2026, 7, 6);

        const processed = klienci.map((klient: any, idx: number) => {
          let lastWorkoutStr = '-';
          let count7 = 0;
          let count14 = 0;
          let count30 = 0;
          let countCustom = 0;

          let maxTime = 0;

          // Przeszukujemy wszystkie zapisy/obecności klubowicza w systemie
          Object.entries(zapisy).forEach(([classKey, uczestnicy]) => {
            // classKey ma format ID_DD/MM
            const parts = classKey.split('_');
            const dateStr = parts[1]; // np. '06/08'
            if (dateStr && Array.isArray(uczestnicy)) {
              const [d, m] = dateStr.split('/').map(Number);
              const classDate = new Date(2026, m - 1, d);
              const timeVal = classDate.getTime();

              const uRecord = uczestnicy.find((u: any) => u.id === klient.id);
              // Sprawdzamy czy użytkownik był obecny lub po prostu zapisany (w zależności od preferencji, tu sprawdzamy obecność lub zapis)
              if (uRecord) {
                // Sprawdzamy ostatni trening
                if (timeVal <= bazaData.getTime() && timeVal > maxTime) {
                  maxTime = timeVal;
                  lastWorkoutStr = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                }

                // Różnica dni od bazy
                const diffDays = Math.floor((bazaData.getTime() - timeVal) / (1000 * 60 * 60 * 24));

                if (diffDays >= 0 && diffDays <= 7) count7++;
                if (diffDays >= 0 && diffDays <= 14) count14++;
                if (diffDays >= 0 && diffDays <= 30) count30++;

                // Sprawdzenie w wybranym zakresie dat (startDate - endDate)
                const yyyyMmDd = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                if (yyyyMmDd >= startDate && yyyyMmDd <= endDate) {
                  countCustom++;
                }
              }
            }
          });

          return {
            id: klient.id || idx + 1,
            firstName: klient.firstName || 'Imię',
            lastName: klient.lastName || 'Nazwisko',
            email: klient.email || 'brak@emaila.com',
            phone: klient.phone || '-',
            pass: klient.pass || 'OPEN',
            lastWorkout: lastWorkoutStr,
            d7: count7,
            d14: count14,
            d30: count30,
            customRange: countCustom
          };
        });

        setKlubowiczeRaport(processed);
      } catch (e) {
        console.error("Błąd ładowania danych aktywności", e);
      }
    }
  }, [startDate, endDate]);

  const filteredData = klubowiczeRaport.filter(item => 
    `${item.firstName} ${item.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 relative">
      
      {/* Pasek Nagłówka */}
      <div className="flex justify-between items-center border-b border-sky-200 pb-4">
        <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
          🏃 Aktywność Klubowiczów
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
            placeholder="Wyszukaj po imieniu, nazwisku lub emailu..."
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
                Wybierz zakres dat raportu aktywności
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

      {/* Tabela Aktywności */}
      <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-sky-50/80 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200">
                <th className="py-3.5 px-3 font-bold">NO.</th>
                <th className="py-3.5 px-3 font-bold">Imię</th>
                <th className="py-3.5 px-3 font-bold">Nazwisko</th>
                <th className="py-3.5 px-3 font-bold">Email</th>
                <th className="py-3.5 px-3 font-bold">Telefon</th>
                <th className="py-3.5 px-3 font-bold">Karnet</th>
                <th className="py-3.5 px-3 font-bold text-center">Ostatni Trening</th>
                <th className="py-3.5 px-3 font-bold text-center">Ostatnie 7 dni</th>
                <th className="py-3.5 px-3 font-bold text-center">14 dni</th>
                <th className="py-3.5 px-3 font-bold text-center">30 dni</th>
                <th className="py-3.5 px-3 font-bold text-center">{startDate} - {endDate}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredData.length > 0 ? (
                filteredData.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-sky-50/40 transition-colors">
                    <td className="py-3.5 px-3 font-mono text-slate-400">{idx + 1}.</td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">{row.firstName}</td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">{row.lastName}</td>
                    <td className="py-3.5 px-3 text-sky-700 font-medium hover:underline cursor-pointer">{row.email}</td>
                    <td className="py-3.5 px-3 font-mono text-slate-600">{row.phone}</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800">{row.pass}</td>
                    <td className="py-3.5 px-3 font-mono text-center text-slate-500">{row.lastWorkout}</td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-900">{row.d7}</td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-900">{row.d14}</td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-900">{row.d30}</td>
                    <td className="py-3.5 px-3 text-center font-bold text-sky-700 bg-sky-50/50">{row.customRange}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 font-medium">
                    Brak klubowiczów spełniających kryteria wyszukiwania.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Dół Tabeli / Paginacja */}
        <div className="bg-sky-50/50 px-4 py-3 border-t border-sky-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>Łącznie: <span className="font-bold text-slate-900">{filteredData.length}</span></div>
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
