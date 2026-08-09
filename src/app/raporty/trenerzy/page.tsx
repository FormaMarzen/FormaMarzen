"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../klienci/supabase'; 

export default function CoachesReportPage() {
  const [coachesData, setCoachesData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stan dla modalu dodawania trenera
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [imie, setImie] = useState('');
  const [nazwisko, setNazwisko] = useState('');
  const [email, setEmail] = useState('');
  const [telefon, setTelefon] = useState('');
  const [rola, setRola] = useState('Trener');
  const [pelnyDostep, setPelnyDostep] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Stan uprawnień (zakładek) dla nowego trenera
  const [permissions, setPermissions] = useState<{ [key: string]: boolean }>({
    panelGlowny: true,
    grafik: true,
    kreatorTreningow: true,
    centrumRaportow: true,
    transakcje: true,
    klienci: true,
    zajeciaZapisy: true,
    aktywnosc: true,
    inwentaryzacja: true,
    automatyczneZapisy: true,
    trenerzy: true,
    ustawieniaZajecia: true,
    zasadyZapisow: true,
    rodzajeZajec: true,
    karnety: true,
    magazyn: true,
    integracjaWww: true,
    platnosciOnline: true,
    wysylkaWiadomosci: true,
    kodyRabatowe: true,
    programAmbasador: true,
    zespol: true,
    wyglad: true,
    moduly: true,
    platnosciZaSystem: true,
    programPartnerski: true,
    kampanie: true,
    automatyzacja: true,
    webhooki: true,
    ogloszenia: true,
    historiaWiadomosci: true,
    wyszukiwarka: true,
    dodawanieKlubowiczow: true,
    edycjaKlubowiczow: true,
    wyslijWiadomosc: true,
    podsumowanieRaportu: true,
    usuwanieTransakcji: true,
    tworzenieZajecJednorazowych: true,
    produkty: true,
    listaZadan: true,
  });

  const handleToggleAll = () => {
    const newState = !pelnyDostep;
    setPelnyDostep(newState);
    const updated: { [key: string]: boolean } = {};
    Object.keys(permissions).forEach((key) => {
      updated[key] = newState;
    });
    setPermissions(updated);
  };

  const handleCheckboxChange = (key: string) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchCoachesReportData = async () => {
    try {
      setIsLoading(true);
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
      const trenerzyLista = dbTrenerzy || [];

      const nadpisania: { [key: string]: any } = {};
      dbNadpisania?.forEach((n: any) => {
        nadpisania[n.class_key] = n;
      });

      const klienciMap: { [key: number]: string } = {};
      dbKlienci?.forEach((c: any) => {
        klienciMap[c.id] = c.pass || (c.karnetyKlubowicza && c.karnetyKlubowicza.length > 0 ? c.karnetyKlubowicza[0].nazwa : 'OPEN');
      });

      const zapisy: { [key: string]: any[] } = {};
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

      // Inicjalizacja wyłącznie na bazie faktycznych wpisów z tabeli 'trenerzy'
      trenerzyLista.forEach((t: any) => {
        const nameKey = t.imie_nazwisko || `${t.imie || ''} ${t.nazwisko || ''}`.trim();
        if (nameKey) {
          stats[nameKey] = { totalClasses: 0, classesCount: {}, attendanceTotal: 0, capacityTotal: 0, classAttendance: {}, passesCount: {} };
        }
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

                const trainer = override?.trainer || item.trainer;
                if (!trainer || !stats[trainer]) return; // Pomijaj, jeśli trenera nie ma w bazie

                const title = item.title || 'Zajęcia';
                const limitNum = Number(override?.limit || item.limit || 12);

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

        const trainer = override?.trainer || item.trainer;
        if (!trainer || !stats[trainer]) return;

        const title = item.title || 'Zajęcia';
        const limitNum = Number(override?.limit || item.limit_miejsc || 12);

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

      // Mapujemy tylko faktycznych trenerów z bazy danych
      const formattedCoaches = trenerzyLista.map((t: any, index: number) => {
        const trainerName = t.imie_nazwisko || `${t.imie || ''} ${t.nazwisko || ''}`.trim();
        const data = stats[trainerName] || { totalClasses: 0, classesCount: {}, attendanceTotal: 0, capacityTotal: 0, classAttendance: {}, passesCount: {} };
        const attendancePercent = data.capacityTotal > 0 ? Math.round((data.attendanceTotal / data.capacityTotal) * 100) : 0;
        
        return {
          id: t.id || index + 1,
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

      setCoachesData(formattedCoaches);
    } catch (e) {
      console.error("Błąd ładowania danych trenerów z Supabase:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCoachesReportData();
  }, []);

  const handleSaveCoach = async () => {
    if (!imie || !nazwisko || !email) {
      alert("Wypełnij wymagane pola (Imię, Nazwisko, E-mail).");
      return;
    }

    setIsSaving(true);
    try {
      const fullName = `${imie} ${nazwisko}`;
      const { error } = await supabase.from('trenerzy').insert([
        {
          imie_nazwisko: fullName,
          imie: imie,
          nazwisko: nazwisko,
          email: email,
          telefon: telefon,
          rola: rola,
          pelny_dostep: pelnyDostep,
          uprawnienia: permissions
        }
      ]);

      if (error) {
        console.error("Błąd zapisu trenera:", error.message);
        alert("Wystąpił błąd podczas zapisywania.");
      } else {
        setIsAddModalOpen(false);
        setImie('');
        setNazwisko('');
        setEmail('');
        setTelefon('');
        fetchCoachesReportData();
      }
    } catch (err) {
      console.error("Błąd:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 font-bold">Generowanie danych z chmury Supabase...</div>;
  }

  return (
    <div className="max-w-[1700px] mx-auto space-y-8 pb-24 relative">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-sky-200 pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-sky-950">
            📊 Raport Trenerów <span className="text-slate-500 font-normal text-sm">(2026)</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>➕</span> DODAJ
          </button>
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
                    {coach.classList.length > 0 ? coach.classList.map((c: any, i: number) => (
                      <div key={i} className="flex justify-between gap-4">
                        <span className="truncate max-w-[140px]">{c.name}</span>
                        <span className="font-bold text-slate-900">x{c.count}</span>
                      </div>
                    )) : <span className="text-slate-400">Brak zajęć</span>}
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
                    {coach.attendanceDetails.length > 0 ? coach.attendanceDetails.map((a: any, i: number) => (
                      <div key={i} className="flex justify-between gap-2 border-b border-amber-100/60 pb-0.5">
                        <span className="truncate max-w-[120px]">{a.name}:</span>
                        <span className="font-bold text-slate-900">{a.ratio}</span>
                      </div>
                    )) : <span className="text-slate-400">Brak danych</span>}
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
                    {coach.passes.length > 0 ? coach.passes.map((p: any, i: number) => (
                      <div key={i} className="flex justify-between gap-2 border-b border-teal-100/60 pb-0.5">
                        <span className="truncate max-w-[120px]">{p.name}</span>
                        <span className="font-bold text-slate-900 shrink-0">x{p.count}</span>
                      </div>
                    )) : <span className="text-slate-400">Brak karnetów</span>}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )) : (
          <div className="bg-white border border-sky-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
            Brak trenerów w bazie danych. Kliknij przycisk „DODAJ”, aby dodać pierwszego trenera.
          </div>
        )}
      </div>

      {/* WYSUWANE MENU BOCZNE (MODAL) Z UPRAWNIENIAMI I ZAKŁADKAMI */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
            
            <div className="flex justify-between items-center pb-6 border-b border-slate-200">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleSaveCoach}
                  disabled={isSaving}
                  className="px-5 py-2 bg-rose-900 hover:bg-rose-800 text-white text-xs font-bold rounded-xl uppercase tracking-wider shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Zapisywanie...' : 'ZAPISZ'}
                </button>
                <button className="px-4 py-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer">
                  <span>❓</span> POMOC
                </button>
              </div>
            </div>

            <div className="space-y-6 pt-6 flex-1">
              
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Podstawowe informacje</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Imię *</label>
                    <input type="text" value={imie} onChange={(e) => setImie(e.target.value)} placeholder="John" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-sky-500" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600">Nazwisko *</label>
                    <input type="text" value={nazwisko} onChange={(e) => setNazwisko(e.target.value)} placeholder="Membersky" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-sky-500" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Adres e-mail *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="johny123@email.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Numer telefonu</label>
                  <input type="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-sky-500" />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ustawienia dostępu</h3>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600">Rola</label>
                  <select value={rola} onChange={(e) => setRola(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none">
                    <option value="Właściciel">Właściciel</option>
                    <option value="Trener">Trener</option>
                    <option value="Recepcja">Recepcja</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-semibold text-slate-700">
                    {pelnyDostep ? 'Pełny dostęp' : 'Ograniczony dostęp'}
                  </span>
                  <button 
                    type="button"
                    onClick={() => setPelnyDostep(!pelnyDostep)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${pelnyDostep ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'}`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
                  </button>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Uprawnienia</h3>
                  <button onClick={handleToggleAll} className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer">
                    <span>☑</span> Przełącz wszystko
                  </button>
                </div>

                <div className="flex flex-wrap gap-4 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={permissions.panelGlowny} onChange={() => handleCheckboxChange('panelGlowny')} className="w-4 h-4 accent-amber-500 rounded" />
                    Panel główny
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={permissions.grafik} onChange={() => handleCheckboxChange('grafik')} className="w-4 h-4 accent-amber-500 rounded" />
                    Grafik
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={permissions.kreatorTreningow} onChange={() => handleCheckboxChange('kreatorTreningow')} className="w-4 h-4 accent-amber-500 rounded" />
                    Kreator treningów
                  </label>
                </div>

                <div className="space-y-2 pt-3">
                  <h4 className="text-[11px] font-bold text-slate-500">Raporty</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.centrumRaportow} onChange={() => handleCheckboxChange('centrumRaportow')} className="accent-amber-500" /> Centrum raportów</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.transakcje} onChange={() => handleCheckboxChange('transakcje')} className="accent-amber-500" /> Transakcje</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.klienci} onChange={() => handleCheckboxChange('klienci')} className="accent-amber-500" /> Klienci</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.zajeciaZapisy} onChange={() => handleCheckboxChange('zajeciaZapisy')} className="accent-amber-500" /> Zajęcia i zapisy</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.aktywnosc} onChange={() => handleCheckboxChange('aktywnosc')} className="accent-amber-500" /> Aktywność</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.inwentaryzacja} onChange={() => handleCheckboxChange('inwentaryzacja')} className="accent-amber-500" /> Inwentaryzacja</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.automatyczneZapisy} onChange={() => handleCheckboxChange('automatyczneZapisy')} className="accent-amber-500" /> Automatyczne zapisy</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.trenerzy} onChange={() => handleCheckboxChange('trenerzy')} className="accent-amber-500" /> Trenerzy</label>
                  </div>
                </div>

                <div className="space-y-2 pt-3">
                  <h4 className="text-[11px] font-bold text-slate-500">Ustawienia</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.ustawieniaZajecia} onChange={() => handleCheckboxChange('ustawieniaZajecia')} className="accent-amber-500" /> Zajęcia</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.zasadyZapisow} onChange={() => handleCheckboxChange('zasadyZapisow')} className="accent-amber-500" /> Zasady zapisów</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.rodzajeZajec} onChange={() => handleCheckboxChange('rodzajeZajec')} className="accent-amber-500" /> Rodzaje zajęć</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.karnety} onChange={() => handleCheckboxChange('karnety')} className="accent-amber-500" /> Karnety</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.magazyn} onChange={() => handleCheckboxChange('magazyn')} className="accent-amber-500" /> Magazyn</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.integracjaWww} onChange={() => handleCheckboxChange('integracjaWww')} className="accent-amber-500" /> Integracja WWW</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.platnosciOnline} onChange={() => handleCheckboxChange('platnosciOnline')} className="accent-amber-500" /> Płatności online</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.wysylkaWiadomosci} onChange={() => handleCheckboxChange('wysylkaWiadomosci')} className="accent-amber-500" /> Wysyłka wiadomości</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.kodyRabatowe} onChange={() => handleCheckboxChange('kodyRabatowe')} className="accent-amber-500" /> Kody rabatowe</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.programAmbasador} onChange={() => handleCheckboxChange('programAmbasador')} className="accent-amber-500" /> Program Ambasador</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.zespol} onChange={() => handleCheckboxChange('zespol')} className="accent-amber-500" /> Zespół</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.wyglad} onChange={() => handleCheckboxChange('wyglad')} className="accent-amber-500" /> Wygląd</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.moduly} onChange={() => handleCheckboxChange('moduly')} className="accent-amber-500" /> Moduły</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.platnosciZaSystem} onChange={() => handleCheckboxChange('platnosciZaSystem')} className="accent-amber-500" /> Płatności za system</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.programPartnerski} onChange={() => handleCheckboxChange('programPartnerski')} className="accent-amber-500" /> Program Partnerski</label>
                  </div>
                </div>

                <div className="space-y-2 pt-3">
                  <h4 className="text-[11px] font-bold text-slate-500">Komunikacja</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.kampanie} onChange={() => handleCheckboxChange('kampanie')} className="accent-amber-500" /> Kampanie</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.automatyzacja} onChange={() => handleCheckboxChange('automatyzacja')} className="accent-amber-500" /> Automatyzacja</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.webhooki} onChange={() => handleCheckboxChange('webhooki')} className="accent-amber-500" /> Webhooki</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.ogloszenia} onChange={() => handleCheckboxChange('ogloszenia')} className="accent-amber-500" /> Ogłoszenia</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.historiaWiadomosci} onChange={() => handleCheckboxChange('historiaWiadomosci')} className="accent-amber-500" /> Historia wiadomości</label>
                  </div>
                </div>

                <div className="space-y-2 pt-3 pb-6">
                  <h4 className="text-[11px] font-bold text-slate-500">Moduły</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.wyszukiwarka} onChange={() => handleCheckboxChange('wyszukiwarka')} className="accent-amber-500" /> Wyszukiwarka</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.dodawanieKlubowiczow} onChange={() => handleCheckboxChange('dodawanieKlubowiczow')} className="accent-amber-500" /> Dodawanie klubowiczów</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.edycjaKlubowiczow} onChange={() => handleCheckboxChange('edycjaKlubowiczow')} className="accent-amber-500" /> Edycja klubowiczów</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.wyslijWiadomosc} onChange={() => handleCheckboxChange('wyslijWiadomosc')} className="accent-amber-500" /> Wyślij wiadomość</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.podsumowanieRaportu} onChange={() => handleCheckboxChange('podsumowanieRaportu')} className="accent-amber-500" /> Podsumowanie raportu transakcji</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.usuwanieTransakcji} onChange={() => handleCheckboxChange('usuwanieTransakcji')} className="accent-amber-500" /> Usuwanie transakcji</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.tworzenieZajecJednorazowych} onChange={() => handleCheckboxChange('tworzenieZajecJednorazowych')} className="accent-amber-500" /> Tworzenie zajęć jednorazowych</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.produkty} onChange={() => handleCheckboxChange('produkty')} className="accent-amber-500" /> Produkty</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.listaZadan} onChange={() => handleCheckboxChange('listaZadan')} className="accent-amber-500" /> Lista zadań</label>
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
