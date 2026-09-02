"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Bezpośrednia, bezpieczna inicjalizacja klienta Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ActivityReportPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Dynamiczne domyślne daty dla wybranego zakresu (początek bieżącego miesiąca do dzisiaj)
  const today = new Date();
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const defaultEnd = today.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [rawKlienci, setRawKlienci] = useState<any[]>([]);
  const [rawZapisy, setRawZapisy] = useState<any[]>([]);
  const [klubowiczeRaport, setKlubowiczeRaport] = useState<any[]>([]);

  const datePickerRef = useRef<HTMLDivElement>(null);

  // Bezpieczny parser daty z formatu class_key (np. 7_07/09, 7_07/09/2026, 7_2026-09-07)
  const parseDateFromClassKey = useCallback((classKey: string): Date => {
    const parts = classKey ? String(classKey).split('_') : [];
    const datePart = parts[1] || '';
    const currentYear = new Date().getFullYear();

    if (!datePart) return new Date();

    if (datePart.includes('/')) {
      const segments = datePart.split('/');
      if (segments.length === 2) {
        const [d, m] = segments;
        return new Date(currentYear, parseInt(m, 10) - 1, parseInt(d, 10));
      } else if (segments.length === 3) {
        const [d, m, y] = segments;
        const fullYear = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
        return new Date(fullYear, parseInt(m, 10) - 1, parseInt(d, 10));
      }
    } else if (datePart.includes('-')) {
      const segments = datePart.split('-');
      if (segments.length === 3) {
        if (segments[0].length === 4) {
          const [y, m, d] = segments;
          return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
        } else {
          const [d, m, y] = segments;
          return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
        }
      } else if (segments.length === 2) {
        const [d, m] = segments;
        return new Date(currentYear, parseInt(m, 10) - 1, parseInt(d, 10));
      }
    }
    return new Date();
  }, []);

  // Zamknięcie kalendarza po kliknięciu poza obszar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pobieranie danych z Supabase bez limitu 1000 wierszy
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ data: klienciData }, { data: zapisyData }] = await Promise.all([
        supabase.from('klienci').select('*').order('id', { ascending: false }).limit(5000),
        supabase.from('zapisy_zajec').select('*').order('id', { ascending: false }).limit(10000)
      ]);

      setRawKlienci(klienciData || []);
      setRawZapisy(zapisyData || []);
    } catch (err) {
      console.error("Błąd pobierania danych raportu aktywności:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Przeliczanie raportu aktywności (ochrona przed dublowaniem wpisów)
  useEffect(() => {
    if (!rawKlienci.length) {
      setKlubowiczeRaport([]);
      return;
    }

    const todayDate = new Date();
    todayDate.setHours(23, 59, 59, 999);
    const nowTime = todayDate.getTime();

    // Mapowanie unikalnych zapisów per klubowicz: Map<klient_id, Set<class_key>>
    const clientZapisyMap = new Map<string, any[]>();
    const seenRecords = new Set<string>();

    rawZapisy.forEach((z: any) => {
      if (!z.klient_id) return;
      const kId = String(z.klient_id);
      const uniqueRecordKey = `${kId}_${z.class_key || z.id}`;
      
      if (seenRecords.has(uniqueRecordKey)) return;
      seenRecords.add(uniqueRecordKey);

      if (!clientZapisyMap.has(kId)) {
        clientZapisyMap.set(kId, []);
      }
      clientZapisyMap.get(kId)!.push(z);
    });

    const startFilterTime = new Date(`${startDate}T00:00:00`).getTime();
    const endFilterTime = new Date(`${endDate}T23:59:59`).getTime();

    const processed = rawKlienci.map((klient: any, idx: number) => {
      const kId = String(klient.id);
      const userZapisy = clientZapisyMap.get(kId) || [];

      let lastWorkoutStr = '-';
      let maxTime = 0;
      let count7 = 0;
      let count14 = 0;
      let count30 = 0;
      let countCustom = 0;

      userZapisy.forEach((z: any) => {
        // Pomijamy anulowane lub nieobecności
        if (z.nieobecny === true || String(z.nieobecny).toLowerCase() === 'true') return;

        const classDateObj = parseDateFromClassKey(z.class_key);
        const timeVal = classDateObj.getTime();

        // Ostatni trening (nie z przyszłości)
        if (timeVal <= nowTime && timeVal > maxTime) {
          maxTime = timeVal;
          const y = classDateObj.getFullYear();
          const m = String(classDateObj.getMonth() + 1).padStart(2, '0');
          const d = String(classDateObj.getDate()).padStart(2, '0');
          lastWorkoutStr = `${y}-${m}-${d}`;
        }

        // Różnica dni od dzisiaj
        const diffDays = Math.floor((nowTime - timeVal) / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 7) count7++;
        if (diffDays >= 0 && diffDays <= 14) count14++;
        if (diffDays >= 0 && diffDays <= 30) count30++;

        // Wybrany zakres dat
        if (timeVal >= startFilterTime && timeVal <= endFilterTime) {
          countCustom++;
        }
      });

      // Wyciągnięcie aktywnego karnetu
      let passName = 'Brak karnetu';
      let karnetyArray: any[] = [];
      if (Array.isArray(klient.karnetyKlubowicza)) {
        karnetyArray = klient.karnetyKlubowicza;
      } else if (typeof klient.karnetyKlubowicza === 'string') {
        try { karnetyArray = JSON.parse(klient.karnetyKlubowicza); } catch(e) {}
      }

      if (karnetyArray.length > 0) {
        passName = karnetyArray[0]?.nazwa || 'OPEN';
      } else if (klient.Cena && klient.Cena !== '0.00 PLN') {
        passName = 'OPEN';
      }

      return {
        id: klient.id || idx + 1,
        firstName: klient['Imię'] || klient.Imię || klient.firstName || 'Imię',
        lastName: klient['Nazwisko'] || klient.Nazwisko || klient.lastName || 'Nazwisko',
        email: klient['E-mail'] || klient.email || 'brak@emaila.com',
        phone: klient['Numer tel.'] || klient.telefon || klient.phone || '-',
        pass: passName,
        lastWorkout: lastWorkoutStr,
        d7: count7,
        d14: count14,
        d30: count30,
        customRange: countCustom
      };
    });

    setKlubowiczeRaport(processed);
  }, [rawKlienci, rawZapisy, startDate, endDate, parseDateFromClassKey]);

  // Filtrowanie wyszukiwarki
  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return klubowiczeRaport.filter(item => 
      `${item.firstName} ${item.lastName}`.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      item.phone.includes(q)
    );
  }, [klubowiczeRaport, searchQuery]);

  // Funkcja eksportu do pliku CSV
  const handleExportCSV = () => {
    if (filteredData.length === 0) {
      alert("Brak danych do wyeksportowania.");
      return;
    }

    const headers = ["Lp", "Imie", "Nazwisko", "Email", "Telefon", "Karnet", "Ostatni Trening", "Ostatnie 7 dni", "14 dni", "30 dni", `${startDate} do ${endDate}`];
    const rows = filteredData.map((row, idx) => [
      idx + 1,
      `"${row.firstName}"`,
      `"${row.lastName}"`,
      `"${row.email}"`,
      `"${row.phone}"`,
      `"${row.pass}"`,
      row.lastWorkout,
      row.d7,
      row.d14,
      row.d30,
      row.customRange
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Raport_Aktywnosci_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 relative font-sans antialiased text-slate-800">
      
      {/* Pasek Nagłówka */}
      <div className="flex justify-between items-center border-b border-sky-200 pb-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
            🏃 Aktywność Klubowiczów
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Raport frekwencji i obecności klubowiczów pobierany bezpośrednio z grafiku.</p>
        </div>
        <button 
          onClick={handleExportCSV}
          title="Eksportuj do CSV"
          className="p-2.5 bg-white border border-sky-200 text-slate-700 rounded-xl hover:bg-sky-50 shadow-sm transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
        >
          <span>📥</span>
          <span className="hidden sm:inline">Eksportuj CSV</span>
        </button>
      </div>

      {/* Wyszukiwanie i Interaktywny Kalendarz Zakresu Dat */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center relative">
        <div className="relative flex-1 w-full">
          <span className="absolute left-4 top-3 text-slate-400">🔍</span>
          <input 
            type="text"
            placeholder="Wyszukaj po imieniu, nazwisku, telefonie lub emailu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-sky-200 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
          />
        </div>

        {/* PRZYCISK KALENDARZA ZAKRESU DAT */}
        <div className="relative" ref={datePickerRef}>
          <button 
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className="flex items-center gap-2 bg-white border border-sky-200 hover:border-sky-300 rounded-xl px-4 py-2.5 shadow-sm text-xs font-bold text-slate-800 transition-colors cursor-pointer whitespace-nowrap"
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
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead>
              <tr className="bg-sky-50/80 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200">
                <th className="py-3.5 px-3 font-bold w-12 whitespace-nowrap">NO.</th>
                <th className="py-3.5 px-3 font-bold whitespace-nowrap">Imię</th>
                <th className="py-3.5 px-3 font-bold whitespace-nowrap">Nazwisko</th>
                <th className="py-3.5 px-3 font-bold whitespace-nowrap">Email</th>
                <th className="py-3.5 px-3 font-bold whitespace-nowrap">Telefon</th>
                <th className="py-3.5 px-3 font-bold whitespace-nowrap">Karnet</th>
                <th className="py-3.5 px-3 font-bold text-center whitespace-nowrap">Ostatni Trening</th>
                <th className="py-3.5 px-3 font-bold text-center whitespace-nowrap">Ostatnie 7 dni</th>
                <th className="py-3.5 px-3 font-bold text-center whitespace-nowrap">14 dni</th>
                <th className="py-3.5 px-3 font-bold text-center whitespace-nowrap">30 dni</th>
                <th className="py-3.5 px-3 font-bold text-center whitespace-nowrap bg-sky-100/60">{startDate} - {endDate}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 font-bold uppercase tracking-wider">
                    Ładowanie raportu aktywności z bazy danych...
                  </td>
                </tr>
              ) : filteredData.length > 0 ? (
                filteredData.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-sky-50/40 transition-colors">
                    <td className="py-3.5 px-3 font-mono text-slate-400">{idx + 1}.</td>
                    <td className="py-3.5 px-3 font-bold text-slate-900 whitespace-nowrap">{row.firstName}</td>
                    <td className="py-3.5 px-3 font-bold text-slate-900 whitespace-nowrap">{row.lastName}</td>
                    <td className="py-3.5 px-3 text-sky-700 font-medium hover:underline cursor-pointer whitespace-nowrap">{row.email}</td>
                    <td className="py-3.5 px-3 font-mono text-slate-600 whitespace-nowrap">{row.phone}</td>
                    <td className="py-3.5 px-3 font-semibold text-slate-800 whitespace-nowrap">{row.pass}</td>
                    <td className="py-3.5 px-3 font-mono text-center text-slate-600 whitespace-nowrap font-medium">{row.lastWorkout}</td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-900">{row.d7}</td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-900">{row.d14}</td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-900">{row.d30}</td>
                    <td className="py-3.5 px-3 text-center font-bold text-sky-800 bg-sky-50/50">{row.customRange}</td>
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

        {/* Dół Tabeli / Podsumowanie */}
        <div className="bg-sky-50/50 px-4 py-3 border-t border-sky-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>Łącznie klubowiczów: <span className="font-bold text-slate-900">{filteredData.length}</span></div>
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
