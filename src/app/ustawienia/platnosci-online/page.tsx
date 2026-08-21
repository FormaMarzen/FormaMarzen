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
  const [dateTo, setDateTo] = useState('2026-08-30');
  const [tylkoPomyslne, setTylkoPomyslne] = useState(false);

  // Historia transakcji
  const [historiaTransakcji, setHistoriaTransakcji] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      // Load History
      const saved = localStorage.getItem('forma_marzen_historia_platnosci');
      if (saved) {
        try { setHistoriaTransakcji(JSON.parse(saved)); } catch (e) {}
      }
      // Load Settings
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
    if (typeof window !== 'undefined' && isMounted) {
      localStorage.setItem('forma_marzen_historia_platnosci', JSON.stringify(historiaTransakcji));
    }
  }, [historiaTransakcji, isMounted]);

  const handleSaveSettings = () => {
    const config = { slugsplacenieDlugu, slugObnizycCene, slugDokupicKarnet };
    if (typeof window !== 'undefined') {
      localStorage.setItem('forma_marzen_ustawienia_platnosci', JSON.stringify(config));
    }
    alert("Ustawienia płatności online zostały zapisane!");
  };

  const addMockData = () => {
    const mockItem = {
      id: Date.now(),
      data: new Date().toISOString().substring(0, 10),
      kupiec: "Jan Kowalski",
      produkty: "Karnet OPEN",
      dostawca: "Autopay",
      status: Math.random() > 0.2 ? "ukończono" : "oczekujące",
      kwota: (Math.random() * 300).toFixed(2)
    };
    setHistoriaTransakcji(prev => [mockItem, ...prev]);
  };

  // Filtrowanie i Obliczenia
  const filteredTransakcje = historiaTransakcji.filter(t => {
    const query = searchQuery.toLowerCase();
    const matchQuery = (t.kupiec || '').toLowerCase().includes(query) || (t.produkty || '').toLowerCase().includes(query);
    const transDateStr = (t.data || '').substring(0, 10);
    const matchDate = !dateFrom || !dateTo || (transDateStr >= dateFrom && transDateStr <= dateTo);
    const matchStatus = tylkoPomyslne ? t.status === 'ukończono' : true;
    return matchQuery && matchDate && matchStatus;
  });

  const totalRevenue = filteredTransakcje.reduce((acc, curr) => acc + Number(curr.kwota), 0);

  if (!isMounted) return <div className="p-8 text-center text-slate-500 font-bold">Ładowanie panelu płatności...</div>;

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-24">
      
      {/* NAGŁÓWEK I STATYSTYKI */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-950 uppercase tracking-tight">Płatności Online</h1>
          <p className="text-slate-500 text-xs font-medium">Zarządzaj konfiguracją bramek płatniczych i historią transakcji.</p>
        </div>
        
        <div className="flex gap-3">
          <div className="bg-white border border-sky-100 p-3 rounded-2xl shadow-sm text-center min-w-[120px]">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Wpływy</div>
            <div className="text-lg font-black text-emerald-600">{totalRevenue.toFixed(2)} PLN</div>
          </div>
          <div className="bg-white border border-sky-100 p-3 rounded-2xl shadow-sm text-center min-w-[120px]">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Transakcje</div>
            <div className="text-lg font-black text-sky-900">{filteredTransakcje.length}</div>
          </div>
        </div>
      </div>

      {/* DOSTAWCA PŁATNOŚCI ONLINE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Aktywne bramki</h2>
          
          <div className="bg-gradient-to-br from-white to-sky-50 border border-sky-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-900 rounded-xl flex items-center justify-center text-white font-black text-lg">A</div>
                <div>
                  <div className="font-black text-slate-900">Autopay</div>
                  <div className="text-[10px] font-bold text-emerald-600 uppercase">Aktywny (1.2% prowizji)</div>
                </div>
              </div>
              <button className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-bold transition-colors cursor-pointer">
                KONFIGURUJ
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Standardowa integracja płatności jednorazowych BLIK oraz przelewy natychmiastowe.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Ustawienia systemowe</h2>
          <div className="bg-white border border-sky-200 rounded-2xl p-6 shadow-sm space-y-4">
            {[
              { id: 'dług', label: 'Spłacanie długu z portfela', state: slugsplacenieDlugu, setter: setSlugsplacenieDlugu },
              { id: 'ceny', label: 'Obniżanie ceny karnetu z portfela', state: slugObnizycCene, setter: setSlugObnizycCene },
              { id: 'karnet', label: 'Dokupowanie karnetu przez klubowicza', state: slugDokupicKarnet, setter: setSlugDokupicKarnet },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-sky-50 last:border-0">
                <span className="text-xs font-bold text-slate-700">{item.label}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={item.state} onChange={(e) => item.setter(e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>
            ))}
            <div className="pt-2">
              <button onClick={handleSaveSettings} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer">
                ZAPISZ KONFIGURACJĘ
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* HISTORIA PŁATNOŚCI */}
      <div className="bg-white border border-sky-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-100 pb-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">Historia płatności</h2>
          <div className="flex gap-2">
            <button onClick={addMockData} className="bg-sky-50 text-sky-800 font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer hover:bg-sky-100">+ Generuj test</button>
            <button onClick={() => alert("Eksport...")} className="bg-slate-50 text-slate-600 font-bold text-[10px] px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-100">Eksport CSV</button>
          </div>
        </div>

        {/* Pasek filtrów */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input 
            type="text"
            placeholder="Szukaj po nazwisku..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-amber-500"
          />
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 flex items-center justify-between text-xs">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent py-2.5 outline-none font-bold" />
            <span className="text-slate-300">-</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent py-2.5 outline-none font-bold" />
          </div>
          <label className="flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={tylkoPomyslne} onChange={(e) => setTylkoPomyslne(e.target.checked)} className="accent-amber-600" />
            Tylko sukcesy
          </label>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-sky-100">
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Klubowicz</th>
                <th className="py-3 px-4">Usługa</th>
                <th className="py-3 px-4">Dostawca</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Kwota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-50">
              {filteredTransakcje.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4 text-xs font-medium text-slate-500">{item.data}</td>
                  <td className="py-4 px-4 text-xs font-bold text-slate-900">{item.kupiec}</td>
                  <td className="py-4 px-4 text-xs text-slate-600">{item.produkty}</td>
                  <td className="py-4 px-4 text-xs text-slate-500">{item.dostawca}</td>
                  <td className="py-4 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                      item.status === 'ukończono' ? 'bg-emerald-100 text-emerald-800' : 
                      item.status === 'oczekujące' ? 'bg-amber-100 text-amber-800' : 
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-xs text-right font-black text-slate-900">{Number(item.kwota).toFixed(2)} PLN</td>
                </tr>
              ))}
              {filteredTransakcje.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-bold text-xs">
                    Brak transakcji spełniających kryteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
