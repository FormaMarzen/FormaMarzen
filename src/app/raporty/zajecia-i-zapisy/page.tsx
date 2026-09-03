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
  zajeciaDzienTygodnia: string;
  zajeciaDataSesji: string;
  zajeciaGodzina: string;
  zajeciaCzasTrwania: string;
  statusZapisu: 'lista_glowna' | 'krzeselko' | 'wypis' | 'nieobecnosc';
  statusLabel: string;
  typAkcji: 'ZAPIS' | 'WYPIS' | 'AWANS' | 'OBECNOŚĆ' | 'NIEOBECNOŚĆ';
  opis: string;
  zrodlo: string;
  kolor: string;
}

// Funkcja omijająca domyślny limit 1000 rekordów Supabase
const fetchAllFromSupabase = async (
  table: string,
  orderBy: string = 'created_at',
  ascending: boolean = false,
  maxPages: number = 30
) => {
  let result: any[] = [];
  for (let i = 0; i < maxPages; i++) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending })
      .range(i * 1000, (i + 1) * 1000 - 1);

    if (error) {
      if (orderBy !== 'id' && error.message?.includes('does not exist')) {
        return fetchAllFromSupabase(table, 'id', ascending, maxPages);
      }
      console.error(`Błąd pobierania tabeli ${table}:`, error);
      break;
    }
    if (data && data.length > 0) {
      result.push(...data);
      if (data.length < 1000) break;
    } else {
      break;
    }
  }
  return result;
};

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

  // Kalkulacja czasu trwania treningu
  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return "60 min";
    try {
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const diffMins = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMins > 0) return `${diffMins} min`;
    } catch (e) {}
    return "60 min";
  };

  // Rozwiązywanie szczegółów treningu na podstawie class_key
  const resolveClassDetails = (
    classKey: string | null | undefined,
    createdDate: Date,
    grafikList: any[],
    jednorazoweList: any[],
    nadpisaniaList: any[]
  ) => {
    if (!classKey || !classKey.includes('_')) return null;

    const [classIdRaw, datePartRaw] = classKey.split('_');
    if (!datePartRaw) return null;

    let d = 1, m = 1;
    let yr = createdDate.getFullYear();

    if (datePartRaw.includes('-')) {
      const p = datePartRaw.split('-').map(Number);
      if (p.length === 3) {
        yr = p[0];
        m = p[1];
        d = p[2];
      }
    } else if (datePartRaw.includes('/')) {
      const p = datePartRaw.split('/').map(Number);
      d = p[0];
      m = p[1];
    }

    const sessionDate = new Date(yr, m - 1, d);
    const dayKeys = ['nd', 'pon', 'wt', 'sr', 'czw', 'pt', 'sob'];
    const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const dayKey = dayKeys[sessionDate.getDay()];
    const dayName = dayNames[sessionDate.getDay()];
    const displayDateStr = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
    const isoDateStr = `${yr}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const fullDateFormatted = `${dayName}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${yr}`;

    // Szukanie w jednorazowych
    const jednoraz = jednorazoweList.find(j => 
      (String(j.id) === String(classIdRaw) || `j_${j.id}` === classIdRaw) &&
      (j.full_date_str === isoDateStr || j.display_date === displayDateStr || j.display_date === datePartRaw)
    );

    // Szukanie w grafiku stałym
    const std = grafikList.find(g => 
      String(g.id) === String(classIdRaw) && g.days && g.days[dayKey] === true
    );

    const baseClass = jednoraz || std;
    if (!baseClass) {
      return {
        nazwa: 'Trening grupowy',
        dzienTygodnia: dayName,
        dataSesji: fullDateFormatted,
        start: '',
        end: '',
        czasTrwania: '60 min'
      };
    }

    // Nadpisania
    const override = nadpisaniaList.find(n => n.class_key === classKey || n.class_key === `${baseClass.id}_${isoDateStr}` || n.class_key === `${baseClass.id}_${displayDateStr}`);

    const finalStart = override?.start || baseClass.start || baseClass.start_time || '08:00';
    const finalEnd = override?.end || baseClass.end || baseClass.end_time || '09:00';
    const finalTitle = baseClass.title || baseClass.nazwa || 'Trening grupowy';

    return {
      nazwa: finalTitle,
      dzienTygodnia: dayName,
      dataSesji: fullDateFormatted,
      start: finalStart,
      end: finalEnd,
      czasTrwania: calculateDuration(finalStart, finalEnd)
    };
  };

  const parseSzczegolyTransakcji = (
    t: any,
    grafikList: any[],
    jednorazoweList: any[],
    nadpisaniaList: any[]
  ) => {
    const opis: string = t.opis || '';
    const typOryginalny: string = t.typ_operacji || '';
    const opDate = t.created_at ? new Date(t.created_at) : new Date();

    // 1. Detekcja typu akcji
    let typZnormalizowany: AuditLogEntry['typAkcji'] = 'ZAPIS';
    let zrodlo = 'Klubowicz (Aplikacja)';

    if (opis.toLowerCase().includes('nieobecny')) {
      typZnormalizowany = 'NIEOBECNOŚĆ';
      zrodlo = 'Trener / Zarządca (Panel)';
    } else if (typOryginalny === 'awans_z_krzesełka' || opis.toLowerCase().includes('awans')) {
      typZnormalizowany = 'AWANS';
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

    // 2. Wykrywanie statusu zapisu (Lista główna vs Krzesełko)
    let statusZapisu: AuditLogEntry['statusZapisu'] = 'lista_glowna';
    let statusLabel = '✅ Lista główna';

    if (typZnormalizowany === 'NIEOBECNOŚĆ') {
      statusZapisu = 'nieobecnosc';
      statusLabel = '🚫 Nieobecny';
    } else if (typZnormalizowany === 'WYPIS') {
      statusZapisu = 'wypis';
      statusLabel = '❌ Wypisany';
    } else if (opis.toLowerCase().includes('krzesełko') || opis.toLowerCase().includes('rezerwow')) {
      statusZapisu = 'krzeselko';
      statusLabel = '🪑 Krzesełko (Rezerwa)';
    } else if (typZnormalizowany === 'AWANS') {
      statusZapisu = 'lista_glowna';
      statusLabel = '✅ Awans na listę główną';
    }

    // 3. Dynamiczne rozwiązywanie danych treningu z bazy grafiku
    const resolved = resolveClassDetails(t.class_key, opDate, grafikList, jednorazoweList, nadpisaniaList);

    let nazwaZajec = resolved?.nazwa || '';
    let dzienTygodnia = resolved?.dzienTygodnia || '';
    let dataSesji = resolved?.dataSesji || '';
    let godzinaZajec = resolved?.start && resolved?.end ? `${resolved.start} - ${resolved.end}` : '';
    let czasTrwania = resolved?.czasTrwania || '60 min';

    // 4. Fallback: Ekstrakcja danych z tekstu pola opis (jeśli brak w grafiku)
    if (!nazwaZajec || nazwaZajec === 'Trening grupowy') {
      const matchNazwa = opis.match(/(?:zajęcia|zajęciach|zajęć|trening:|zajęcia:)\s*[:\-]?\s*([^,\-|.(]+)/i);
      if (matchNazwa && matchNazwa[1] && !matchNazwa[1].toLowerCase().includes('obłożenie')) {
        nazwaZajec = matchNazwa[1].trim();
      } else {
        nazwaZajec = 'Trening grupowy';
      }
    }

    if (!dataSesji) {
      const matchData = opis.match(/(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}|\d{2}\/\d{2})/);
      if (matchData) {
        dataSesji = matchData[1];
      }
    }

    if (!godzinaZajec) {
      const matchGodzina = opis.match(/(?:godz\.?|o\s+)?(\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?)/i);
      if (matchGodzina) {
        godzinaZajec = matchGodzina[1];
      }
    }

    return {
      typZnormalizowany,
      zrodlo,
      nazwaZajec,
      dzienTygodnia,
      dataSesji,
      godzinaZajec,
      czasTrwania,
      statusZapisu,
      statusLabel
    };
  };

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      // Równoległe pobieranie z ominięciem limitu 1000 wierszy
      const [
        transakcjeDataRaw,
        klienciDataRaw,
        grafikDataRaw,
        jednorazoweDataRaw,
        nadpisaniaDataRaw
      ] = await Promise.all([
        supabase
          .from('transakcje')
          .select('*')
          .in('typ_operacji', ['zajecia_zapis', 'zajecia_wypis', 'awans_z_krzesełka', 'odwolanie_zajec'])
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`)
          .order('created_at', { ascending: false })
          .range(0, 9999),
        fetchAllFromSupabase('klienci', 'id', true, 20),
        fetchAllFromSupabase('grafik_zajec', 'id', true, 20),
        fetchAllFromSupabase('zajecia_jednorazowe', 'id', false, 20),
        fetchAllFromSupabase('nadpisania_zajec', 'id', false, 30)
      ]);

      const transakcjeData = (transakcjeDataRaw.data || []) as any[];
      const klienciData = klienciDataRaw || [];
      const grafikList = grafikDataRaw || [];
      const jednorazoweList = jednorazoweDataRaw || [];
      const nadpisaniaList = nadpisaniaDataRaw || [];

      // Deduplikacja rekordów transakcji
      const dedupedTransactions = Array.from(new Map(transakcjeData.map(t => [t.id, t])).values());

      const logsToSet: AuditLogEntry[] = dedupedTransactions.map((t: any) => {
        const klient = klienciData.find((k: any) => String(k.id) === String(t.klient_id));
        const imie = klient ? (klient['Imię'] || klient.imie || klient.firstName || '') : '';
        const nazwisko = klient ? (klient['Nazwisko'] || klient.nazwisko || klient.lastName || '') : '';
        const imieNazwisko = [imie, nazwisko].filter(Boolean).join(' ').trim() || 'Klubowicz';
        const email = klient ? (klient['E-mail'] || klient.email || '') : '';
        
        const dt = new Date(t.created_at);
        const dataOperacji = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        const godzinaOperacji = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

        const { 
          typZnormalizowany, 
          zrodlo, 
          nazwaZajec, 
          dzienTygodnia,
          dataSesji, 
          godzinaZajec,
          czasTrwania,
          statusZapisu,
          statusLabel
        } = parseSzczegolyTransakcji(t, grafikList, jednorazoweList, nadpisaniaList);

        let kolor = 'text-slate-600 bg-slate-100 border-slate-200';
        if (typZnormalizowany === 'ZAPIS') kolor = 'text-emerald-800 bg-emerald-100 border-emerald-200';
        if (typZnormalizowany === 'AWANS') kolor = 'text-blue-800 bg-blue-100 border-blue-200';
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
          zajeciaDzienTygodnia: dzienTygodnia,
          zajeciaDataSesji: dataSesji,
          zajeciaGodzina: godzinaZajec,
          zajeciaCzasTrwania: czasTrwania,
          zajeciaInfo: `${nazwaZajec} (${dataSesji})`,
          statusZapisu,
          statusLabel,
          typAkcji: typZnormalizowany,
          opis: t.opis || '',
          zrodlo,
          kolor
        };
      });

      setAuditLogs(logsToSet);
    } catch (err) {
      console.error("Błąd pobierania historii audytu:", err);
    } finally {
      setIsLoading(false);
    }
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
      log.klientEmail.toLowerCase().includes(query) ||
      log.zajeciaNazwa.toLowerCase().includes(query) ||
      log.zajeciaDataSesji.toLowerCase().includes(query) ||
      log.zajeciaGodzina.toLowerCase().includes(query) ||
      log.opis.toLowerCase().includes(query)
    );
  });

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24 relative font-sans antialiased text-slate-800">
      
      {/* NAGŁÓWEK STRONY */}
      <div className="flex justify-between items-center border-b border-sky-200 pb-4">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
            <span>📅</span> HISTORIA ZAPISÓW I OBECNOŚCI
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Pełny rejestr audytowy aktywności klubowiczów na zajęciach.
          </p>
        </div>
        <button 
          onClick={fetchLogs}
          title="Odśwież dane"
          className="p-2.5 bg-white border border-sky-200 text-sky-700 rounded-xl hover:bg-sky-50 shadow-sm transition-all cursor-pointer font-bold text-xs flex items-center gap-2 active:scale-95"
        >
          <span>🔄</span> Odśwież
        </button>
      </div>

      {/* PASEK WYSZUKIWANIA I FILTROWANIA DAT */}
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

      {/* GŁÓWNA TABELA OPERACJI */}
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
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-600 border-r-transparent align-[-0.125em]"></div>
                    <div className="mt-4 text-sm font-bold text-sky-900 uppercase tracking-wider">Pobieranie historii z bazy...</div>
                  </td>
                </tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-sky-50/30 transition-colors">
                    
                    {/* 1. DATA OPERACJI */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="font-mono text-slate-700 font-bold">{log.dataOperacji}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{log.godzinaOperacji}</div>
                    </td>

                    {/* 2. KLUBOWICZ */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="font-black text-sky-950 text-sm">{log.klientImieNazwisko}</div>
                      {log.klientEmail && <div className="text-[11px] text-slate-400">{log.klientEmail}</div>}
                    </td>

                    {/* 3. AKCJA */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${log.kolor}`}>
                        {log.typAkcji}
                      </span>
                    </td>

                    {/* 4. ZAJĘCIA I SZCZEGÓŁY - PRECYZYJNA PREZENTACJA */}
                    <td className="py-4 px-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                            <span className="text-rose-600 font-bold">📌</span>
                            <span>{log.zajeciaNazwa}</span>
                          </span>
                          
                          {/* Status zapisu: Lista główna vs Krzesełko */}
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                            log.statusZapisu === 'krzeselko'
                              ? 'bg-blue-100 text-blue-900 border-blue-200'
                              : log.statusZapisu === 'wypis'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}>
                            {log.statusLabel}
                          </span>
                        </div>

                        {/* Data odbywania się zajęć oraz godziny z czasem trwania */}
                        <div className="flex flex-wrap items-center gap-2">
                          {log.zajeciaDataSesji && (
                            <span className="inline-flex items-center gap-1 bg-sky-50 border border-sky-200 text-sky-950 font-bold text-[10px] px-2 py-0.5 rounded-md">
                              <span>🗓️</span> {log.zajeciaDataSesji}
                            </span>
                          )}
                          {log.zajeciaGodzina && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-950 font-bold text-[10px] px-2 py-0.5 rounded-md">
                              <span>⏰</span> {log.zajeciaGodzina} ({log.zajeciaCzasTrwania})
                            </span>
                          )}
                        </div>

                        {/* Oryginalny opis z bazy */}
                        {log.opis && (
                          <div className="text-[10px] text-slate-400 mt-1 leading-snug">
                            {log.opis}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 5. ŹRÓDŁO OPERACJI */}
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
                    <div className="text-xs mt-1">Zmień zakres dat lub zapytanie w wyszukiwarce.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && (
          <div className="bg-slate-50 px-6 py-4 border-t border-sky-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
            <div>
              Łącznie zarejestrowanych operacji: <span className="font-black text-sky-900 bg-sky-100 px-2.5 py-0.5 rounded-md border border-sky-200">{filteredLogs.length}</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-60">
              <span className="px-2.5 py-1 bg-white border border-slate-200 rounded shadow-sm text-[10px] uppercase font-bold">Tryb: Audyt Szczegółowy</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
