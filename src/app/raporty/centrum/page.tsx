"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../klienci/supabase';

interface ChartData {
  monthKey: string;
  label: string;
  value: number;
}

export default function ReportsCenterPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalKlubowicze: 0,
    zWaznymKarnetem: 0,
    karnetyZestawienie: [] as { nazwa: string, ilosc: number, lacznaWartosc: number }[],
    aktywneUmowy: 0,
    przychodStaly: 0,
    chartData: [] as ChartData[]
  });

  useEffect(() => {
    const fetchReportData = async () => {
      setIsLoading(true);
      try {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const todayStr = todayDate.toISOString().split('T')[0];

        // 1. Pobieranie danych o KLIENTACH
        const { data: klienciDataRaw, error: klienciError } = await supabase.from('klienci').select('*');
        if (klienciError) throw klienciError;

        const klienciData = klienciDataRaw as any[] | null;
        
        let totalKlubowicze = 0;
        let zWaznymKarnetem = 0;
        let aktywneUmowy = 0;
        let przychodStaly = 0;
        const karnetyMap: Record<string, { ilosc: number, sumaCen: number }> = {};

        if (klienciData) {
          totalKlubowicze = klienciData.length;

          klienciData.forEach(klient => {
            let parsedKarnety = [];
            if (Array.isArray(klient.karnetyKlubowicza)) {
              parsedKarnety = klient.karnetyKlubowicza;
            } else if (typeof klient.karnetyKlubowicza === 'string') {
              try { parsedKarnety = JSON.parse(klient.karnetyKlubowicza); } catch(e) {}
            }

            let maAktywnyKarnet = false;

            parsedKarnety.forEach((karnet: any) => {
              if (karnet.waznyDo && karnet.waznyDo >= todayStr && !karnet.zawieszonyOd && !karnet.statusTekst?.includes('Oczekujący')) {
                maAktywnyKarnet = true;
                aktywneUmowy++;
                
                const cenaNum = parseFloat(String(karnet.cena || '0').replace(/[^0-9.-]+/g, "")) || 0;
                przychodStaly += cenaNum;

                const nazwaKarnetu = karnet.nazwa || 'Inny karnet';
                if (!karnetyMap[nazwaKarnetu]) {
                  karnetyMap[nazwaKarnetu] = { ilosc: 0, sumaCen: 0 };
                }
                karnetyMap[nazwaKarnetu].ilosc++;
                karnetyMap[nazwaKarnetu].sumaCen += cenaNum;
              }
            });

            if (maAktywnyKarnet) {
              zWaznymKarnetem++;
            }
          });
        }

        const karnetyZestawienie = Object.entries(karnetyMap).map(([nazwa, data]) => ({
          nazwa,
          ilosc: data.ilosc,
          lacznaWartosc: data.sumaCen
        })).sort((a, b) => b.ilosc - a.ilosc);

        // 2. Pobieranie danych o TRANSAKCJACH dla wykresu (Ostatnie 24 miesiące)
        const twentyFourMonthsAgo = new Date();
        twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 23);
        twentyFourMonthsAgo.setDate(1);
        
        const { data: transakcjeRaw, error: tErr } = await supabase
          .from('transakcje')
          .select('created_at, kwota, typ_operacji, opis')
          .gte('created_at', twentyFourMonthsAgo.toISOString());
          
        if (tErr) console.error("Błąd pobierania transakcji do wykresu", tErr);

        const monthlyData: Record<string, ChartData> = {};
        for(let i = 23; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = `${d.getMonth() + 1}/${d.getFullYear()}`;
            monthlyData[key] = { monthKey: key, label, value: 0 };
        }

        if (transakcjeRaw) {
          transakcjeRaw.forEach((t: any) => {
             const isKarnet = t.typ_operacji === 'zakup_karnetu' || (t.opis && t.opis.toLowerCase().includes('karnet'));
             if (isKarnet && t.kwota) {
                 const d = new Date(t.created_at);
                 const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                 if (monthlyData[key]) {
                     monthlyData[key].value += Math.abs(Number(t.kwota));
                 }
             }
          });
        }

        const chartData = Object.values(monthlyData);

        setStats({
          totalKlubowicze,
          zWaznymKarnetem,
          karnetyZestawienie,
          aktywneUmowy,
          przychodStaly,
          chartData
        });

      } catch (err) {
        console.error("Błąd podczas pobierania danych analitycznych:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, []);

  const maxChartValue = Math.max(...stats.chartData.map(d => d.value), 1);

  return (
    <div className="max-w-[1700px] mx-auto space-y-8 pb-24 relative">
      <div className="border-b border-sky-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
            <span>📈</span> Centrum Raportów & Analityki
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Podsumowanie stanu klubu, umów, płatności i frekwencji na żywo</p>
        </div>
        <select className="bg-white border border-sky-200 text-xs text-slate-700 rounded-xl px-4 py-2.5 font-bold shadow-sm focus:outline-none cursor-pointer">
          <option>Ten miesiąc na żywo</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-pulse">
          <div className="w-12 h-12 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
          <div className="text-sm font-bold text-sky-900 uppercase tracking-wider">Synchronizacja z bazą...</div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* KOLUMNA 1 - KLIENCI */}
            <div className="space-y-6">
              <div className="bg-white border border-sky-200 rounded-3xl p-6 space-y-5 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-sky-50 rounded-bl-full -z-10 opacity-50"></div>
                <h2 className="text-sm font-black uppercase tracking-wider text-sky-900 border-b border-sky-100 pb-3 flex items-center gap-2">
                  <span>👥</span> Klienci w bazie
                </h2>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-slate-600 font-bold uppercase tracking-wider text-[10px]">Wszyscy klubowicze:</span>
                    <span className="font-black text-slate-900 text-base">{stats.totalKlubowicze}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 pl-3 text-emerald-700 bg-emerald-50/50 rounded-lg px-3 border border-emerald-100">
                    <span className="font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Z ważnym karnetem:
                    </span>
                    <span className="font-black text-emerald-700 text-base">{stats.zWaznymKarnetem}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* KOLUMNA 2 - KARNETY */}
            <div className="space-y-6">
              <div className="bg-white border border-sky-200 rounded-3xl p-6 space-y-4 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-wider text-sky-900 border-b border-sky-100 pb-3 flex items-center gap-2">
                  <span>💳</span> Aktywne Karnety
                </h2>
                <div className="max-h-[300px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-slate-400 uppercase text-[9px] tracking-wider border-b border-slate-100">
                        <th className="pb-3 font-bold">Nazwa karnetu</th>
                        <th className="pb-3 text-center font-bold">Sztuk</th>
                        <th className="pb-3 text-right font-bold">Wartość</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                      {stats.karnetyZestawienie.length > 0 ? (
                        stats.karnetyZestawienie.map((karnet, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 font-bold text-sky-950">{karnet.nazwa}</td>
                            <td className="py-3 text-center">
                              <span className="bg-slate-100 text-slate-700 font-black px-2 py-0.5 rounded-md border border-slate-200">
                                {karnet.ilosc}
                              </span>
                            </td>
                            <td className="py-3 text-right font-bold text-emerald-600">
                              {karnet.lacznaWartosc.toFixed(2)} PLN
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-slate-400 font-medium">Brak aktywnych karnetów w systemie.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* KOLUMNA 3 - RAPORT UMÓW */}
            <div className="space-y-6">
              <div className="bg-white border border-sky-200 rounded-3xl p-6 space-y-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-wider text-sky-900 border-b border-sky-100 pb-3 flex items-center gap-2">
                  <span>🔄</span> Raport Umów
                </h2>
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-sky-100 pb-4">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Aktywne umowy (Karnety)</span>
                    <div className="text-2xl font-black text-sky-900">{stats.aktywneUmowy}</div>
                  </div>
                  <div className="bg-white border border-sky-200 px-4 py-3 rounded-xl flex justify-between items-center shadow-sm">
                    <span className="text-[10px] text-sky-800 font-black uppercase tracking-wider">Przychód stały z karnetów</span>
                    <div className="text-sm font-black text-emerald-600">
                      {stats.przychodStaly.toFixed(2)} PLN/mc
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* SEKCJA - WYKRES PRZYCHODÓW (24 MIESIĄCE) */}
          <div className="bg-white border border-sky-200 rounded-3xl p-6 md:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <div>
                <h2 className="text-base font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
                  <span>📊</span> Przychód z karnetów (Ostatnie 24 miesiące)
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">Podsumowanie łącznej sprzedaży abonamentów na przestrzeni lat</p>
              </div>
              <div className="bg-sky-50 px-4 py-2 rounded-xl border border-sky-100 shadow-sm text-center shrink-0">
                <span className="block text-[10px] font-bold text-sky-700 uppercase tracking-wider">Łącznie (24msc)</span>
                <span className="text-sm font-black text-sky-900">
                  {stats.chartData.reduce((acc, curr) => acc + curr.value, 0).toFixed(2)} PLN
                </span>
              </div>
            </div>

            <div className="w-full overflow-x-auto pb-6 custom-scrollbar">
              <div className="relative h-64 min-w-[800px] flex items-end justify-between gap-1 sm:gap-2 pt-10">
                
                {/* Linie siatki tła */}
                <div className="absolute inset-0 z-0 flex flex-col justify-between pointer-events-none pb-8 pt-10">
                  <div className="w-full border-t border-slate-100 flex-1"></div>
                  <div className="w-full border-t border-slate-100 flex-1"></div>
                  <div className="w-full border-t border-slate-100 flex-1"></div>
                  <div className="w-full border-t border-slate-100 flex-1"></div>
                  <div className="w-full border-t-2 border-slate-200 h-0"></div>
                </div>

                {/* Słupki wykresu */}
                {stats.chartData.map((data, idx) => {
                  const heightPercentage = (data.value / maxChartValue) * 100;
                  
                  return (
                    <div key={idx} className="relative z-10 flex-1 flex flex-col items-center justify-end h-full group">
                      
                      {/* Kwota nad słupkiem */}
                      <div className="absolute bottom-full mb-1 w-full text-center pointer-events-none">
                        <span className={`text-[8px] sm:text-[9px] font-black whitespace-nowrap transition-colors duration-300 ${data.value > 0 ? 'text-sky-800 group-hover:text-sky-600' : 'text-slate-300'}`}>
                          {data.value > 0 ? data.value.toFixed(0) : '0'}
                        </span>
                      </div>
                      
                      {/* Słupek */}
                      <div className="w-full max-w-[32px] sm:max-w-[40px] bg-sky-50 rounded-t-md overflow-hidden relative flex items-end border border-sky-100 transition-all duration-300 group-hover:bg-sky-100 group-hover:border-sky-300" style={{ height: 'calc(100% - 32px)' }}>
                         <div 
                           className="w-full bg-gradient-to-t from-sky-400 to-sky-500 rounded-t-md transition-all duration-1000 ease-out shadow-sm"
                           style={{ height: `${heightPercentage}%` }}
                         ></div>
                      </div>
                      
                      {/* Etykieta Miesiąca */}
                      <div className="mt-2 h-8 flex items-start justify-center overflow-visible">
                        <span className="text-[9px] font-bold text-slate-500 transform -rotate-45 origin-top-left mt-1 whitespace-nowrap">
                          {data.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9; 
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1; 
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8; 
        }
      `}} />
    </div>
  );
}
