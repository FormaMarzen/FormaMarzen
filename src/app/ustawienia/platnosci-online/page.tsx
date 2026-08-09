"use client";

import React, { useState, useEffect } from 'react';

export default function PlatnosciOnlinePage() {
  const [isMounted, setIsMounted] = useState(false);

  // Ustawienia online z localStorage lub domyślne
  const [slugsplacenieDlugu, setSlugsplacenieDlugu] = useState(true);
  const [slugObnizycCene, setSlugObnizycCene] = useState(true);
  const [slugDokupicKarnet, setSlugDokupicKarnet] = useState(true);

  // Filtry tabeli historii płatności
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-07-31');
  const [dateTo, setDateTo] = useState('2026-08-07');
  const [tylkoPomyslne, setTylkoPomyslne] = useState(true);

  // Prawdziwa historia transakcji (odczytywana z localStorage lub domyślnie pusta)
  const [historiaTransakcji, setHistoriaTransakcji] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('forma_marzen_historia_platnosci');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return [];
  });

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('forma_marzen_ustawienia_platnosci');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSlugsplacenieDlugu(parsed.slugsplacenieDlugu ?? true);
          setSlugObnizycCene(parsed.slugObnizycCene ?? true);
          setSlugDokupicKarnet(parsed.slugDokupicKarnet ?? true);
        } catch (e) {}
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('forma_marzen_historia_platnosci', JSON.stringify(historiaTransakcji));
    }
  }, [historiaTransakcji]);

  const handleSaveSettings = () => {
    const config = { slugsplacenieDlugu, slugObnizycCene, slugDokupicKarnet };
    if (typeof window !== 'undefined') {
      localStorage.setItem('forma_marzen_ustawienia_platnosci', JSON.stringify(config));
    }
    alert("Ustawienia płatności online zostały pomyślnie zapisane!");
  };

  // Filtrowanie historii
  const filteredTransakcje = historiaTransakcji.filter(t => {
    const query = searchQuery.toLowerCase();
    const matchQuery = (t.kupiec || '').toLowerCase().includes(query) || (t.produkty || '').toLowerCase().includes(query);
    
    const transDateStr = (t.data || '').substring(0, 10);
    const matchDate = !dateFrom || !dateTo || (transDateStr >= dateFrom && transDateStr <= dateTo);

    const matchStatus = tylkoPomyslne ? t.status === 'ukończono' : true;

    return matchQuery && matchDate && matchStatus;
  });

  if (!isMounted) {
    return <div className="p-8 text-center text-slate-500 font-bold">Ładowanie płatności online...</div>;
  }

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24">
      
      {/* DOSTAWCA PŁATNOŚCI ONLINE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Dostawca płatności online</h2>
          <button className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer">
            ❓ POMOC
          </button>
        </div>

        {/* Kafel Autopay Aktywny */}
        <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-black text-slate-900 text-sm">Autopay</span>
            <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-md text-xs">Aktywny</span>
          </div>
          <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
            <li>Łatwa i szybka rejestracja konta w Autopay bezpośrednio przez WodGuru</li>
            <li>Gwarantowana niska prowizja: 1,2%</li>
            <li>Szybkie przelewy / blik</li>
          </ul>
        </div>

        {/* Kafel Autopay (Płatności odnawialne) Nieaktywny */}
        <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-sm">Autopay (Płatności odnawialne)</span>
              <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-md text-xs">Nieaktywny</span>
            </div>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              <li>Płatności kartowe</li>
              <li>Klubowicz dodaje kartę raz, system pobiera z niej środki cyklicznie, na podstawie ustawień karnetu.</li>
              <li>Gwarantowana niska prowizja: 1,2%</li>
            </ul>
          </div>
          <button className="bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors shrink-0 cursor-pointer">
            USTAW
          </button>
        </div>

        <button className="bg-white hover:bg-sky-50 text-sky-900 border border-sky-200 font-bold px-5 py-3 rounded-xl text-xs transition-colors shadow-sm cursor-pointer">
          POKAŻ WSZYSTKIE
        </button>
      </div>

      {/* USTAWIENIA */}
      <div className="bg-white border border-sky-200 rounded-2xl p-6 shadow-sm space-y-6">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-sky-100 pb-3">Ustawienia</h2>

        <div className="space-y-5 text-xs">
          
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <span className="font-medium text-slate-800">Klubowicz może spłacać dług z portfela</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${slugsplacenieDlugu ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {slugsplacenieDlugu ? 'Włączono' : 'Wyłączono'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={slugsplacenieDlugu} 
                onChange={(e) => setSlugsplacenieDlugu(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <span className="font-medium text-slate-800">Klubowicz może obniżyć cenę karnetu, wykorzystując kwotę z portfela.</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${slugObnizycCene ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {slugObnizycCene ? 'Włączono' : 'Wyłączono'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={slugObnizycCene} 
                onChange={(e) => setSlugObnizycCene(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <span className="font-medium text-slate-800">Klubowicz może dokupić kolejny karnet lub konto rodzinne</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${slugDokupicKarnet ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {slugDokupicKarnet ? 'Włączono' : 'Wyłączono'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={slugDokupicKarnet} 
                onChange={(e) => setSlugDokupicKarnet(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

        </div>

        <div className="pt-2">
          <button 
            onClick={handleSaveSettings}
            className="bg-[#5c0000] hover:bg-[#7a0000] text-white font-black px-7 py-3 rounded-xl uppercase tracking-wider text-xs shadow-md transition-colors cursor-pointer"
          >
            ZAPISZ
          </button>
        </div>
      </div>

      {/* HISTORIA PŁATNOŚCI */}
      <div className="bg-white border border-sky-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-100 pb-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Historia płatności</h2>
          <button onClick={() => alert("Eksport do pliku Excel/CSV")} className="text-slate-500 hover:text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer">
            <span>📥</span> Eksportuj
          </button>
        </div>

        {/* Pasek filtrów */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-1">
          <div className="relative w-full md:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
            <input 
              type="text"
              placeholder="Wyszukaj..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-sky-50/50 border border-sky-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
            <div className="flex items-center gap-2 bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700">
              <span>📅</span>
              <input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent focus:outline-none font-bold"
              />
              <span>-</span>
              <input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent focus:outline-none font-bold"
              />
            </div>

            <label className="flex items-center gap-2 bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={tylkoPomyslne} 
                onChange={(e) => setTylkoPomyslne(e.target.checked)}
                className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
              />
              <span>Tylko pomyślne</span>
            </label>
          </div>
        </div>

        {/* Tabela historii */}
        <div className="overflow-x-auto text-xs pt-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sky-50/70 border-b border-sky-200 text-[11px] font-bold text-sky-900 uppercase tracking-wider">
                <th className="py-3.5 px-4">Data</th>
                <th className="py-3.5 px-4">Kupiec</th>
                <th className="py-3.5 px-4">Produkty</th>
                <th className="py-3.5 px-4">Dostawca</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Kwota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100">
              {filteredTransakcje.map((item) => (
                <tr key={item.id} className="hover:bg-sky-50/40 transition-colors">
                  <td className="py-4 px-4 font-mono text-slate-500">{item.data}</td>
                  <td className="py-4 px-4 font-bold text-slate-900 underline decoration-dotted cursor-pointer hover:text-sky-700">
                    {item.kupiec}
                  </td>
                  <td className="py-4 px-4 font-medium text-slate-800">{item.produkty}</td>
                  <td className="py-4 px-4 text-slate-600">{item.dostawca}</td>
                  <td className="py-4 px-4">
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                      {item.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-black text-slate-900">
                    {Number(item.kwota).toFixed(2)} PLN
                  </td>
                </tr>
              ))}
              {filteredTransakcje.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 font-medium">
                    Brak transakcji w historii płatności.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Dolny pasek paginacji */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-sky-100 text-xs text-slate-500 gap-3">
          <div>Łącznie: <strong className="text-slate-800">{filteredTransakcje.length}</strong></div>
          <div className="flex items-center gap-2">
            <span>Strona: 1 z 1</span>
            <div className="flex items-center gap-1">
              <button disabled className="px-2 py-1 bg-slate-100 rounded text-slate-300 font-bold">◀</button>
              <button className="px-3 py-1 bg-sky-900 text-white rounded font-bold">1</button>
              <button disabled className="px-2 py-1 bg-slate-100 rounded text-slate-300 font-bold">▶</button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
