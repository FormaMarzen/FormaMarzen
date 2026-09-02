"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../klienci/supabase';

interface AuditLogEntry {
  id: string | number;
  dataOperacji: string;
  godzinaOperacji: string;
  klientId: number | string;
  klientImieNazwisko: string;
  klientEmail: string;
  zajeciaNazwa: string;
  zajeciaDzien: string;
  zajeciaGodzina: string;
  zajeciaInfo: string;
  typAkcji: 'ZAPIS' | 'WYPIS' | 'OBECNOŚĆ' | 'NIEOBECNOŚĆ';
  opis: string;
  zrodlo: string;
  kolor: string;
}

export default function ClassesReportPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  const today = new Date();
  const defaultStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
  
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  
  const datePickerRef = useRef<HTMLDivElement>(null);

  const parseSzczegolyTransakcji = (t: any): { 
    typZnormalizowany: AuditLogEntry['typAkcji'];
    zrodlo: string;
    nazwaZajec: string;
    dzienZajec: string;
    godzinaZajec: string;
    pelneInfo: string;
  } => {
    const opis: string = t.opis || '';
    const typOryginalny: string = t.typ_operacji || '';

    // 1. Detekcja typu akcji
    let typZnormalizowany: AuditLogEntry['typAkcji'] = 'ZAPIS';
    let zrodlo = 'Klubowicz (Aplikacja)';

    if (opis.toLowerCase().includes('nieobecny')) {
      typZnormalizowany = 'NIEOBECNOŚĆ';
      zrodlo = 'Trener / Zarządca';
    } else if (opis.toLowerCase().includes('wypis') || typOryginalny === 'zajecia_wypis') {
      typZnormalizowany = 'WYPIS';
    } else if (opis.toLowerCase().includes('zapis') || typOryginalny === 'zajecia_zapis') {
      typZnormalizowany = 'ZAPIS';
    } else {
      typZnormalizowany = 'OBECNOŚĆ';
    }

    if (opis.includes('Zarządcę') || opis.includes('Trener') || opis.includes('przez klub') || typZnormalizowany === 'NIEOBECNOŚĆ') {
      zrodlo = 'Trener / Zarządca (Panel)';
    }

    // 2. Pobieranie danych z kolumn bezpośrednich tabeli transakcje (jeśli istnieją w Supabase)
    let nazwaZajec = t.nazwa_zajec || t.zajecia_nazwa || t.tytul || '';
    let dzienZajec = t.data_zajec || t.zajecia_data || t.dzien || '';
    let godzinaZajec = t.godzina_zajec || t.zajecia_godzina || t.godzina || '';

    // 3. Fallback: Ekstrakcja danych z tekstu pola opis
    // Przykłady formatów:
    // "Zapisano na zajęcia: Tabata, 2026-09-04 18:00"
    // "Zapisano na: Trening Obwodowy | Dzień: 2026-09-05 | Godz: 19:00"
    if (!nazwaZajec) {
      const matchNazwa = opis.match(/(?:zajęcia|zajęciach|zajęć|na:)\s*[:\-]?\s*([^,\-|.(]+)/i);
      if (matchNazwa && matchNazwa[1] && !matchNazwa[1].toLowerCase().includes('obłożenie')) {
        nazwaZajec = matchNazwa[1].trim();
      }
    }

    if (!dzienZajec) {
      const matchData = opis.match(/(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/);
      if (matchData) {
        dzienZajec = matchData[1];
      }
    }

    if (!godzinaZajec) {
      const matchGodzina = opis.match(/(?:godz\.?|o\s+)?(\d{1,2}:\d{2})/i);
      if (matchGodzina) {
        godzinaZajec = matchGodzina[1];
      }
    }

    // Jeżeli opis to starszy format (np. "Izabela - Zapisano na zajęcia. Obłożenie: 4/6")
    if (!nazwaZajec) {
      if (opis.includes('Obłożenie:')) {
        nazwaZajec = 'Zajęcia grupowe';
      } else {
        nazwaZajec = opis.split('-')[1]?.trim() || opis || 'Zajęcia fitness';
      }
    }

    let pelneInfo = nazwaZajec;
    if (dzienZajec) pelneInfo += ` (${dzienZajec}`;
    if (godzinaZajec) pelneInfo += ` ${godzinaZajec})`;
    else if (dzienZajec) pelneInfo += `)`;

    return {
      typZnormalizowany,
      zrodlo,
      nazwaZajec,
      dzienZajec,
      godzinaZajec,
      pelneInfo
    };
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data: transakcjeDataRaw, error: transakcjeError } = await supabase
        .from('transakcje')
        .select('*')
        .in('typ_operacji', ['zajecia_zapis', 'zajecia_wypis'])
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: false });

      if (transakcjeError) throw transakcjeError;

      const { data: klienciDataRaw, error: klienciError } = await supabase
        .from('klienci')
        .select('*');

      if (klienciError) throw klienciError;

      const transakcjeData = transakcjeDataRaw as any[] | null;
      const klienciData = klienciDataRaw as any[] | null;

      let logsToSet: AuditLogEntry[] = [];

      if (transakcjeData && klienciData) {
        logsToSet = transakcjeData.map((t: any) => {
          const klient = klienciData.find((k: any) => String(k.id) === String(t.klient_id));
          const imieNazwisko = klient ? `${klient.Imię || ''} ${klient.Nazwisko || ''}`.trim() : 'Nieznany klient';
          const email = klient ? klient['E-mail'] || '' : '';
          
          const dt = new Date(t.created_at);
          const dataOperacji = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
          const godzinaOperacji = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

          const { 
            typZnormalizowany, 
            zrodlo, 
            nazwaZajec, 
            dzienZajec, 
            godzinaZajec, 
            pelneInfo 
          } = parseSzczegolyTransakcji(t);

          let kolor = 'text-slate-600 bg-slate-100 border-slate-200';
          if (typZnormalizowany === 'ZAPIS') kolor = 'text-emerald-800 bg-emerald-100 border-emerald-200';
          if (typZnormalizowany === 'WYPIS') kolor = 'text-rose-800 bg-rose-100 border-rose-200';
          if (typZnormalizowany === 'NIEOBECNOŚĆ') kolor = 'text-amber-800 bg-amber-100 border-amber-300';
          if (typZnormalizowany === 'OBECNOŚĆ') kolor = 'text-blue-800 bg-blue-100 border-blue-200';

          return {
            id: t.id,
            dataOperacji,
            godzinaOperacji,
            klientId: t.klient_id,
            klientImieNazwisko: imieNazwisko,
            klientEmail: email,
            zajeciaNazwa: nazwaZajec,
            zajeciaDzien: dzienZajec,
            zajeciaGodzina: godzinaZajec,
            zajeciaInfo: pelneInfo,
            typAkcji: typZnormalizowany,
            opis: t.opis || '',
            zrodlo,
            kolor
          };
        });
      }

      setAuditLogs(logsToSet);
    } catch (err) {
      console.error("Błąd pobierania historii zapisów:", err);
    }
    setIsLoading(false);
  };

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
    fetchLogs();
  }, [startDate, endDate]);

  const filteredLogs = auditLogs.filter(log => {
    const query = searchQuery.toLowerCase();
    return (
      log.klientImieNazwisko.toLowerCase().includes(query) ||
      log.zajeciaNazwa.toLowerCase().includes(query) ||
      log.zajeciaDzien.toLowerCase().includes(query) ||
      log.zajeciaGodzina.toLowerCase().includes(query) ||
      log.opis.toLowerCase().includes(query)
    );
  });

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 relative">
      
      <div className="flex justify-between items-center border-b border-sky-200 pb-4">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-sky-950">
            📅 Historia Zapisów i Obecności
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Pełny rejestr audytowy aktywności klubowiczów na zajęciach.</p>
        </div>
        <button 
          onClick={fetchLogs}
          title="Odśwież dane"
          className="p-2.5 bg-white border border-sky-200 text-sky-700 rounded-xl hover:bg-sky-50 shadow-sm transition-all cursor-pointer font-bold text-xs flex items-center gap-2"
        >
          <span>🔄</span> Odśwież
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center relative bg-white p-4 rounded-2xl border border-sky-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <span className="absolute left-4 top-3 text-slate-400">🔍</span>
          <input 
            type="text"
            placeholder="Szukaj po nazwisku, zajęciach, dacie lub godzinie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-sky-50 border border-sky-100 rounded-xl pl-11 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <div className="relative" ref={datePickerRef}>
          <button 
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className="flex items-center gap-2 bg-sky-50 border border-sky-200 hover:border-sky-300 rounded-xl px-4 py-2.5 shadow-sm text-xs font-black text-sky-900 transition-colors cursor-pointer whitespace-nowrap uppercase tracking-wider"
          >
            <span>🗓️</span>
            <span>{startDate} - {endDate}</span>
            <span className="text-sky-600">▾</span>
          </button>

          {isDatePickerOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-white border border-sky-200 rounded-3xl shadow-2xl p-6 z-50 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <h3 className="font-black text-xs text-sky-950 uppercase tracking-wider border-b border-sky-100 pb-3">
                Wybierz zakres dat
              </h3>

              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Data OD:</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Data DO:</label>
                  <input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-sky-100 flex justify-end">
                <button 
                  onClick={() => { setIsDatePickerOpen(false); fetchLogs(); }}
                  className="bg-sky-900 hover:bg-sky-800 text-white font-black px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-sm w-full"
                >
                  Zastosuj i filtruj
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-sky-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-sky-50/80 text-sky-900 uppercase text-[10px] tracking-wider border-b border-sky-200">
                <th className="py-4 px-6 font-bold whitespace-nowrap w-40">Data Operacji</th>
                <th className="py-4 px-6 font-bold whitespace-nowrap">Klubowicz</th>
                <th className="py-4 px-6 font-bold whitespace-nowrap">Akcja</th>
                <th className="py-4 px-6 font-bold">Zajęcia i Szczegóły</th>
                <th className="py-4 px-6 font-bold whitespace-nowrap">Źródło Operacji</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/50 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                    <div className="mt-4 text-sm font-bold text-sky-900 uppercase tracking-wider">Pobieranie historii z chmury...</div>
                  </td>
                </tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-sky-50/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-mono text-slate-600 font-bold">{log.dataOperacji}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{log.godzinaOperacji}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-black text-sky-950 text-sm">{log.klientImieNazwisko}</div>
                      {log.klientEmail && <div className="text-[10px] text-slate-400">{log.klientEmail}</div>}
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${log.kolor}`}>
                        {log.typAkcji}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                        <span className="text-sky-600 font-bold">📌</span>
                        <span>{log.zajeciaNazwa}</span>
                      </div>

                      {(log.zajeciaDzien || log.zajeciaGodzina) ? (
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {log.zajeciaDzien && (
                            <span className="inline-flex items-center gap-1 bg-sky-50 border border-sky-200 text-sky-900 font-bold text-[10px] px-2 py-0.5 rounded-md">
                              <span>🗓️</span> {log.zajeciaDzien}
                            </span>
                          )}
                          {log.zajeciaGodzina && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 font-bold text-[10px] px-2 py-0.5 rounded-md">
                              <span>⏰</span> {log.zajeciaGodzina}
                            </span>
                          )}
                        </div>
                      ) : null}

                      <div className="text-[10px] text-slate-400 mt-1.5 leading-snug">
                        {log.opis}
                      </div>
                    </td>
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{log.zrodlo.includes('Trener') || log.zrodlo.includes('Zarządca') ? '🛡️' : '📱'}</span>
                        <span className="font-semibold text-slate-600 text-[11px]">{log.zrodlo}</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <div className="text-4xl mb-3">📭</div>
                    <div className="font-bold text-slate-600 uppercase tracking-wider">Brak danych do wyświetlenia</div>
                    <div className="text-xs mt-1">Zmień filtry dat lub zapytanie, aby znaleźć operacje.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && (
          <div className="bg-slate-50 px-6 py-4 border-t border-sky-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
            <div>
              Znaleziono logów operacji: <span className="font-black text-sky-900 bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200">{filteredLogs.length}</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-50">
              <span className="px-2.5 py-1 bg-white border border-slate-200 rounded shadow-sm text-[10px] uppercase font-bold">Tryb: Audyt Historyczny</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
