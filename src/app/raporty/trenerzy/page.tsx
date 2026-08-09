"use client";

import React, { useState, useEffect } from 'react';
// 1. NAPRAWIONA ŚCIEŻKA DO SUPABASE
import { supabase } from '../klienci/supabase'; 

export default function CoachesReportPage() {
  const [coachesData, setCoachesData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCoachesReportData = async () => {
      try {
        const [
          { data: dbTrenerzy },
          { data: dbGrafik },
          { data: dbNadpisania },
          { data: dbJednorazowe },
          { data: dbZapisy },
          { data: dbKlienci }
        ] = await Promise.all([
          supabase.from('trenerzy').select('*'),
          supabase.from('grafik_zajec').select('*'),
          supabase.from('nadpisania_zajec').select('*'),
          supabase.from('zajecia_jednorazowe').select('*'),
          supabase.from('zapisy_zajec').select('*'),
          supabase.from('klienci').select('id, pass, karnetyKlubowicza')
        ]);

        const grafik = dbGrafik || [];
        const jednorazowe = dbJednorazowe || [];

        const nadpisania: { [key: string]: any } = {};
        // 2. NAPRAWIONY TYP 'n'
        dbNadpisania?.forEach((n: any) => {
          nadpisania[n.class_key] = n;
        });

        const klienciMap: { [key: number]: string } = {};
        // 3. NAPRAWIONY TYP 'c'
        dbKlienci?.forEach((c: any) => {
          klienciMap[c.id] = c.pass || (c.karnetyKlubowicza && c.karnetyKlubowicza.length > 0 ? c.karnetyKlubowicza[0].nazwa : 'OPEN');
        });

        const zapisy: { [key: string]: any[] } = {};
        // 4. NAPRAWIONY TYP 'z'
        dbZapisy?.forEach((z: any) => {
          if (!zapisy[z.class_key]) zapisy[z.class_key] = [];
          zapisy[z.class_key].push({
            id: z.klient_id,
            obecny: z.obecny,
            pass: klienciMap[z.klient_id] || 'OPEN'
          });
        });

        const stats: { [key: string]: { 
          totalClasses: number, 
          classesCount: { [title: string]: number },
          attendanceTotal: number,
          capacityTotal: number,
          classAttendance: { [title: string]: { present: number, total: number } },
          passesCount: { [passName: string]: number }
        } } = {};

        // 5. NAPRAWIONY TYP 't'
        dbTrenerzy?.forEach((t: any) => {
          stats[t.imie_nazwisko] = { totalClasses: 0, classesCount: {}, attendanceTotal: 0, capacityTotal: 0, classAttendance: {}, passesCount: {} };
        });

        const dayKeyMap: { [key: string]: number } = { 'pon': 1, 'wt': 2, 'sr': 3, 'czw': 4, 'pt': 5 };

        const genStart = new Date(2026, 0, 1);
        const genEnd = new Date(2026, 11, 31);

        for (let d = new Date(genStart); d <= genEnd; d.setDate(d.getDate() + 1)) {
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const displayDate = `${day}/${month}`;
          const jsDay = d.getDay();

          grafik.forEach((item: any) => {
            if (item.days) {
              Object.entries(item.days).forEach(([key, isActive]) => {
                if (isActive && dayKeyMap[key] === jsDay) {
                  const classKey = `${item.id}_${displayDate}`;
                  const override = nadpisania[classKey];
                  
                  if (override?.is_usuniete || override?.is_odwolane) return;

                  const trainer = override?.trainer || item.trainer || 'Klaput Maciej';
                  const title = item.title || 'Zajęcia';
                  const limitNum = Number(override?.limit || item.limit || 12);

                  if (!stats[trainer]) {
                    stats[trainer] = { totalClasses: 0, classesCount: {}, attendanceTotal: 0, capacityTotal: 0, classAttendance: {}, passesCount: {} };
                  }

                  stats[trainer].totalClasses++;
                  stats[trainer].classesCount[title] = (stats[trainer].classesCount[title] || 0) + 1;
                  stats[trainer].capacityTotal += limitNum;

                  if (!stats[trainer].classAttendance[title]) {
                    stats[trainer].classAttendance[title] = { present: 0, total: 0 };
                  }
                  stats[trainer].classAttendance[title].total += limitNum;

                  const uczestnicy = zapisy[classKey] || [];
                  uczestnicy.forEach((u: any) => {
                    if (u.obecny) {
                      stats[trainer].attendanceTotal++;
                      stats[trainer].classAttendance[title].present++;
                    }
                    const passName = u.pass;
                    stats[trainer].passesCount[passName] = (stats[trainer].passesCount[passName] || 0) + 1;
                  });
                }
              });
            }
          });
        }

        jednorazowe.forEach((item: any) => {
          const classKey = `${item.id}_${item.display_date}`;
          const override = nadpisania[classKey];
          if (override?.is_usuniete || override?.is_odwolane) return;

          const trainer = override?.trainer || item.trainer || 'Klaput Maciej';
          const title = item.title || 'Zajęcia';
          const limitNum = Number(override?.limit || item.limit_miejsc || 12);

          if (!stats[trainer]) {
            stats[trainer] = { totalClasses: 0, classesCount: {}, attendanceTotal: 0, capacityTotal: 0, classAttendance: {}, passesCount: {} };
          }

          stats[trainer].totalClasses++;
          stats[trainer].classesCount[title] = (stats[trainer].classesCount[title] || 0) + 1;
          stats[trainer].capacityTotal += limitNum;

          if (!stats[trainer].classAttendance[title]) {
            stats[trainer].classAttendance[title] = { present: 0, total: 0 };
          }
          stats[trainer].classAttendance[title].total += limitNum;

          const uczestnicy = zapisy[classKey] || [];
          uczestnicy.forEach((u: any) => {
            if (u.obecny) {
              stats[trainer].attendanceTotal++;
              stats[trainer].classAttendance[title].present++;
            }
            const passName = u.pass;
            stats[trainer].passesCount[passName] = (stats[trainer].passesCount[passName] || 0) + 1;
          });
        });

        const formattedCoaches = Object.keys(stats)
          .filter(trainerName => stats[trainerName].totalClasses > 0)
          .map((trainerName, index) => {
            const data = stats[trainerName];
            const attendancePercent = data.capacityTotal > 0 ? Math.round((data.attendanceTotal / data.capacityTotal) * 100) : 0;
            
            return {
              id: index + 1,
              name: trainerName,
              avatar: index % 2 === 0 ? '👨‍💼' : '👩‍💼',
              totalClasses: data.totalClasses,
              classList: Object.entries(data.classesCount).map(([name, count]) => ({ name, count })),
              attendancePercent: `${attendancePercent}%`,
              attendanceRatio: `${data.attendanceTotal} / ${data.capacityTotal}`,
              attendanceDetails: Object.entries(data.classAttendance).map(([name, att]: [string, any]) => ({ name, ratio: `${att.present}/${att.total}` })),
              passes: Object.entries(data.passesCount).map(([name, count]) => ({ name, count }))
            };
        });

        formattedCoaches.sort((a, b) => b.totalClasses - a.totalClasses);

        setCoachesData(formattedCoaches);
      } catch (e) {
        console.error("Błąd ładowania danych trenerów z Supabase:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCoachesReportData();
  }, []);

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 font-bold">Generowanie danych z chmury Supabase...</div>;
  }

  return (
    <div className="max-w-[1700px] mx-auto space-y-8 pb-24">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-sky-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
            📊 Raport Trenerów <span className="text-slate-500 font-normal text-sm">(2026)</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-rose-800 hover:bg-rose-700 text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 cursor-pointer">
            <span>⚙️</span> Pokaż filtry
          </button>
          <button className="px-4 py-2 bg-sky-100 hover:bg-sky-200 text-sky-800 border border-sky-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer">
            <span>❓</span> Dowiedz się więcej
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {coachesData.length > 0 ? coachesData.map((coach) => (
          <div key={coach.id} className="bg-white border border-sky-200 rounded-2xl p-6 space-y-6 shadow-sm">
            
            <div className="flex justify-between items-center border-b border-sky-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-sky-100 border border-sky-200 rounded-full flex items-center justify-center text-2xl">
                  {coach.avatar}
                </div>
                <h2 className="text-lg font-black text-slate-900">{coach.name}</h2>
              </div>

              <button className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs cursor-pointer">
                <span>📥</span> Ewidencja godzin
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-5 space-y-4">
                <span className="text-xs font-bold text-slate-700 bg-white/80 px-2.5 py-1 rounded-md border border-rose-200/60 inline-block">
                  Wszystkie zajęcia
                </span>
                
                <div className="flex items-baseline gap-6">
                  <div className="text-5xl font-black text-slate-900">{coach.totalClasses}</div>
                  <div className="space-y-1 text-xs text-slate-700 w-full">
                    {coach.classList.map((c: any, i: number) => (
                      <div key={i} className="flex justify-between gap-4">
                        <span className="truncate max-w-[140px]">{c.name}</span>
                        <span className="font-bold text-slate-900">x{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-5 space-y-4">
                <span className="text-xs font-bold text-slate-700 bg-white/80 px-2.5 py-1 rounded-md border border-amber-200/60 inline-block">
                  Frekwencja
                </span>

                <div className="flex items-baseline gap-6">
                  <div>
                    <div className="text-4xl font-black text-slate-900">{coach.attendancePercent}</div>
                    <div className="text-[11px] font-bold text-slate-500 mt-1">{coach.attendanceRatio}</div>
                  </div>
                  <div className="space-y-1 text-xs text-slate-700 flex-1">
                    {coach.attendanceDetails.map((a: any, i: number) => (
                      <div key={i} className="flex justify-between gap-2 border-b border-amber-100/60 pb-0.5">
                        <span className="truncate max-w-[120px]">{a.name}:</span>
                        <span className="font-bold text-slate-900">{a.ratio}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-teal-50/50 border border-teal-100 rounded-2xl p-5 space-y-3">
                <span className="text-xs font-bold text-slate-700 bg-white/80 px-2.5 py-1 rounded-md border border-teal-200/60 inline-block mb-1">
                  Karnety uczestników
                </span>

                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full border-4 border-indigo-500 border-t-amber-500 border-r-teal-500 border-l-rose-500 shrink-0"></div>
                  
                  <div className="space-y-1 text-[11px] text-slate-700 max-h-36 overflow-y-auto w-full pr-1">
                    {coach.passes.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between gap-2 border-b border-teal-100/60 pb-0.5">
                        <span className="truncate max-w-[120px]">{p.name}</span>
                        <span className="font-bold text-slate-900 shrink-0">x{p.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            <div className="pt-2 text-center">
              <button className="text-xs font-bold text-slate-500 hover:text-sky-700 flex items-center justify-center gap-1 mx-auto cursor-pointer">
                <span>∨</span> SZCZEGÓŁY
              </button>
            </div>

          </div>
        )) : (
          <div className="bg-white border border-sky-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
            Brak zajęć w bazie dla wybranego okresu lub brak trenerów z zaplanowanymi treningami.
          </div>
        )}
      </div>

    </div>
  );
}
