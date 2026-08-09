"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../raporty/klienci/supabase'; 

export default function ZarzadzajGrafikiemPage() {
  const [activeTab, setActiveTab] = useState<'cykliczne' | 'jednorazowe'>('cykliczne');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  
  const [dostepneRodzajeZajec, setDostepneRodzajeZajec] = useState<any[]>([]);
  const [listaTrenerow, setListaTrenerow] = useState<any[]>([]);

  // Stany dla klas w grafiku 
  const [cykliczneClasses, setCykliczneClasses] = useState<any[]>([]);
  const [jednorazoweClasses, setJednorazoweClasses] = useState<any[]>([]);

  // Stan modalu i edycji
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [wybranyRodzajZajec, setWybranyRodzajZajec] = useState('');
  const [wybranyTrener, setWybranyTrener] = useState('');
  
  const [startH, setStartH] = useState('08');
  const [startM, setStartM] = useState('00');
  const [koniecH, setKoniecH] = useState('09');
  const [koniecM, setKoniecM] = useState('00');

  const handleStartChange = (newH: string, newM: string) => {
    setStartH(newH);
    setStartM(newM);
    const nextH = String((parseInt(newH, 10) + 1) % 24).padStart(2, '0');
    setKoniecH(nextH);
    setKoniecM(newM);
  };

  const [maxOsob, setMaxOsob] = useState('12');
  const [dataJednorazowa, setDataJednorazowa] = useState(new Date().toISOString().split('T')[0]);
  const [wybraneDni, setWybraneDni] = useState({ pon: true, wt: false, sr: true, czw: false, pt: false, sb: false, nd: false });

  // POBIERANIE WSZYSTKICH DANYCH Z SUPABASE
  const loadData = async () => {
    // 1. Rodzaje zajęć
    const { data: rodzajeData } = await supabase.from('rodzaje_zajec').select('*');
    if (rodzajeData) {
      setDostepneRodzajeZajec(rodzajeData);
      if (rodzajeData.length > 0 && !wybranyRodzajZajec) {
        setWybranyRodzajZajec(rodzajeData[0].nazwa);
      }
    }

    // 2. Trenerzy
    const { data: trenerzyData } = await supabase.from('trenerzy').select('*');
    if (trenerzyData) {
      setListaTrenerow(trenerzyData);
      if (trenerzyData.length > 0 && !wybranyTrener) {
        setWybranyTrener(trenerzyData[0].imie_nazwisko);
      }
    }

    // 3. Cykliczne (Poprawione mapowanie na zgodne ze schematem bazy)
    const { data: szablonyData } = await supabase.from('grafik_zajec').select('*');
    if (szablonyData) {
      setCykliczneClasses(szablonyData.map((s: any) => ({
        id: s.id,
        title: s.title,
        startDate: `Utworzono: ${s.created_at ? s.created_at.split('T')[0] : 'Brak'}`,
        start: s.start || '08:00',
        end: s.end || '09:00',
        limit: s.limit || 12,
        days: s.days || {},
        trainer: s.trainer,
        advanced: ['Powtarzalność: Co tydzień']
      })));
    }

    // 4. Jednorazowe (Zostaje jak było, skoro działało poprawnie)
    const { data: jednorazoweData } = await supabase.from('zajecia_jednorazowe').select('*');
    if (jednorazoweData) {
      setJednorazoweClasses(jednorazoweData.map((j: any) => ({
        id: j.id,
        title: j.title || j.nazwa,
        displayDate: j.display_date || j.data,
        fullDateStr: j.full_date_str || j.data,
        start: j.start_time || (j.godzina ? j.godzina.split(' - ')[0] : '08:00'),
        end: j.end_time || (j.godzina ? j.godzina.split(' - ')[1] : '09:00'),
        limit: j.limit_miejsc || 12,
        trainer: j.trainer || j.prowadzacy,
        isJednorazowe: true,
        advanced: ['Zajęcia jednorazowe']
      })));
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setWybranyRodzajZajec(dostepneRodzajeZajec.length > 0 ? dostepneRodzajeZajec[0].nazwa : '');
    setWybranyTrener(listaTrenerow.length > 0 ? listaTrenerow[0].imie_nazwisko : '');
    setStartH('08');
    setStartM('00');
    setKoniecH('09');
    setKoniecM('00');
    setMaxOsob('12');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setWybranyRodzajZajec(item.title || '');
    setWybranyTrener(item.trainer || '');
    if (item.start) {
      const [sh, sm] = item.start.split(':');
      if (sh) setStartH(sh);
      if (sm) setStartM(sm);
    }
    if (item.end) {
      const [eh, em] = item.end.split(':');
      if (eh) setKoniecH(eh);
      if (em) setKoniecM(em);
    }
    setMaxOsob(String(item.limit || 12));
    if (activeTab === 'cykliczne' && item.days) {
      setWybraneDni(item.days);
    }
    if (activeTab === 'jednorazowe' && item.fullDateStr) {
      setDataJednorazowa(item.fullDateStr);
    }
    setIsModalOpen(true);
  };

  const handleAddOrUpdateZajecia = async (e: React.FormEvent) => {
    e.preventDefault();
    const nazwaDoZapisu = wybranyRodzajZajec || 'Ogólnorozwojowe';
    const startStr = `${startH}:${startM}`;
    const endStr = `${koniecH}:${koniecM}`;
    const limitNum = parseInt(maxOsob) || 12;

    if (activeTab === 'cykliczne') {
      // ✅ Payload w 100% zgodny z tabelą `grafik_zajec`
      const payload = {
        title: nazwaDoZapisu,
        start: startStr,
        end: endStr,
        limit: limitNum,
        trainer: wybranyTrener,
        days: wybraneDni
      };

      let result;
      if (editingId !== null) {
        result = await supabase.from('grafik_zajec').update(payload).eq('id', editingId);
      } else {
        result = await supabase.from('grafik_zajec').insert([payload]);
      }

      if (result.error) {
        alert(`BŁĄD BAZY DANYCH (Cykliczne):\n\nWiadomość: ${result.error.message}\nSzczegóły: ${result.error.details || 'Brak'}\nKod błędu: ${result.error.code}`);
        return;
      }
    } else {
      // Zapis do tabeli: zajecia_jednorazowe (Zostawiamy jak było, skoro działało)
      const [y, m, d] = dataJednorazowa.split('-');
      const displayDateStr = `${d}/${m}`;

      const payload = {
        title: nazwaDoZapisu,
        start_time: startStr,
        end_time: endStr,
        limit_miejsc: limitNum,
        trainer: wybranyTrener,
        display_date: displayDateStr,
        full_date_str: dataJednorazowa
      };

      let result;
      if (editingId !== null) {
        result = await supabase.from('zajecia_jednorazowe').update(payload).eq('id', editingId);
      } else {
        result = await supabase.from('zajecia_jednorazowe').insert([payload]);
      }

      if (result.error) {
        alert(`BŁĄD BAZY DANYCH (Jednorazowe):\n\nWiadomość: ${result.error.message}\nSzczegóły: ${result.error.details || 'Brak'}\nKod błędu: ${result.error.code}`);
        return;
      }
    }

    loadData();
    setIsModalOpen(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Czy na pewno chcesz usunąć te zajęcia? Znikną z grafiku wszystkich użytkowników!")) return;

    if (activeTab === 'cykliczne') {
      const { error } = await supabase.from('grafik_zajec').delete().eq('id', id);
      if (error) {
        alert(`Błąd podczas usuwania: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from('zajecia_jednorazowe').delete().eq('id', id);
      if (error) {
        alert(`Błąd podczas usuwania: ${error.message}`);
        return;
      }
    }
    loadData();
  };

  if (!isMounted) {
    return <div className="p-8 text-center text-slate-500 font-bold">Ładowanie grafiku z bazy...</div>;
  }

  const currentList = activeTab === 'cykliczne' ? cykliczneClasses : jednorazoweClasses;

  const filteredClasses = currentList.filter((item: any) => 
    (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.trainer || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 px-2 sm:px-4 pb-24 overflow-x-hidden">
      
      {/* GÓRNY PASEK AKCJI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-sky-200 p-4 rounded-2xl shadow-sm">
        <h1 className="text-base sm:text-lg font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
          ZARZĄDZAJ GRAFIKIEM
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleOpenAdd}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer" 
          >
            <span>+</span> DODAJ ZAJĘCIA
          </button>
        </div>
      </div>

      {/* PASEK WYSZUKIWANIA */}
      <div className="bg-white border border-sky-200 rounded-2xl p-4 shadow-sm">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">🔍</span>
          <input 
            type="text"
            placeholder="Wyszukaj zajęcia..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-sky-50/50 border border-sky-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* ZAKŁADKI */}
      <div className="flex items-center gap-2 border-b border-sky-200 pb-2.5">
        <button
          onClick={() => setActiveTab('cykliczne')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer ${
            activeTab === 'cykliczne' ? 'bg-rose-900 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-sky-50 border border-sky-200'
          }`}
        >
          <span>🔄</span> CYKLICZNE
        </button>
        <button
          onClick={() => setActiveTab('jednorazowe')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-colors cursor-pointer ${
            activeTab === 'jednorazowe' ? 'bg-rose-900 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-sky-50 border border-sky-200'
          }`}
        >
          <span>📅</span> JEDNORAZOWE
        </button>
      </div>

      {/* TABELA ZAJĘĆ */}
      <div className="bg-white border border-sky-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-sky-50/70 border-b border-sky-200 text-[10px] sm:text-[11px] font-bold text-sky-900 uppercase tracking-wider">
                <th className="py-3 px-3">Zajęcia</th>
                <th className="py-3 px-2">Godziny</th>
                <th className="py-3 px-2 text-center">Limit</th>
                {activeTab === 'cykliczne' && <th className="py-3 px-2 text-center">Dni tygodnia</th>}
                {activeTab === 'jednorazowe' && <th className="py-3 px-2 text-center">Data</th>}
                <th className="py-3 px-3">Trener</th>
                <th className="py-3 px-3">Zaawansowane</th>
                <th className="py-3 px-3 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100 text-xs">
              {filteredClasses.map((item: any) => (
                <tr key={item.id} className="hover:bg-sky-50/40 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">{item.title}</div>
                    <div className="text-[10px] text-slate-400">{item.startDate || `Data: ${item.fullDateStr}`}</div>
                  </td>
                  <td className="py-3 px-2 text-slate-700 font-medium whitespace-nowrap">
                    {item.start} - {item.end}
                  </td>
                  <td className="py-3 px-2 text-center font-bold text-slate-800">{item.limit}</td>

                  {activeTab === 'cykliczne' && (
                    <td className="py-3 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {['pon', 'wt', 'sr', 'czw', 'pt', 'sb', 'nd'].map((day) => {
                          const isActive = (item.days as Record<string, boolean>)?.[day];
                          return (
                            <span key={day} className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold ${
                              isActive ? 'bg-teal-700 text-white shadow-sm' : 'bg-slate-100 text-slate-300'
                            }`} title={day.toUpperCase()}>
                              {day.toUpperCase().slice(0, 1)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  )}

                  {activeTab === 'jednorazowe' && (
                    <td className="py-3 px-2 text-center font-mono font-bold text-sky-900">
                      {item.fullDateStr || item.displayDate}
                    </td>
                  )}

                  <td className="py-3 px-3 text-slate-800 font-medium whitespace-nowrap">{item.trainer}</td>
                  <td className="py-3 px-3 text-slate-500 text-[10px] space-y-0.5 max-w-[220px]">
                    {item.advanced?.map((adv: string, idx: number) => (
                      <div key={idx} className="truncate">• {adv}</div>
                    ))}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => handleOpenEdit(item)}
                        className="w-6 h-6 bg-rose-900 text-white rounded-md flex items-center justify-center shadow-sm hover:bg-rose-800 transition-colors text-[10px] cursor-pointer" 
                        title="Edytuj"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="w-6 h-6 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md flex items-center justify-center border border-rose-200 transition-colors text-[10px] cursor-pointer" 
                        title="Usuń"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClasses.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    Brak zajęć w zakładce {activeTab === 'cykliczne' ? 'Cykliczne' : 'Jednorazowe'}. Dodaj pierwsze za pomocą przycisku powyżej.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DODAWANIA / EDYCJI ZAJĘĆ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-3 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-sky-200 rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-6 my-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-sky-100 pb-3 sticky top-0 bg-white z-10">
              <h3 className="font-black text-sm text-sky-950 uppercase">
                {editingId !== null ? 'Edytuj zajęcia' : `Dodaj zajęcia (${activeTab === 'cykliczne' ? 'Cykliczne' : 'Jednorazowe'})`}
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleAddOrUpdateZajecia}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-black px-4 py-1.5 rounded-lg text-xs transition-colors shadow-sm cursor-pointer"
                >
                  {editingId !== null ? 'ZAKTUALIZUJ' : 'ZAPISZ'}
                </button>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer">✕</button>
              </div>
            </div>

            <form onSubmit={handleAddOrUpdateZajecia} className="space-y-6 text-xs">
              
              <div className="space-y-4">
                <h4 className="font-extrabold text-sky-900 uppercase tracking-wider text-[11px] border-b border-sky-100 pb-1">
                  Podstawowe informacje
                </h4>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Wybierz rodzaj zajęć *</label>
                  <select 
                    value={wybranyRodzajZajec}
                    onChange={(e) => setWybranyRodzajZajec(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2.5 text-slate-800 cursor-pointer focus:border-sky-500 focus:outline-none"
                  >
                    {dostepneRodzajeZajec.length > 0 ? (
                      dostepneRodzajeZajec.map((item: any) => (
                        <option key={item.id} value={item.nazwa}>{item.nazwa}</option>
                      ))
                    ) : (
                      <option value="">Brak rodzajów (dodaj najpierw w Ustawienia ➔ Rodzaje zajęć)</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Wybierz trenera (opcjonalnie)</label>
                  <select 
                    value={wybranyTrener}
                    onChange={(e) => setWybranyTrener(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2.5 text-slate-800 cursor-pointer focus:border-sky-500 focus:outline-none"
                  >
                    {listaTrenerow.length > 0 ? (
                      listaTrenerow.map((t: any) => (
                        <option key={t.id} value={t.imie_nazwisko}>{t.imie_nazwisko}</option>
                      ))
                    ) : (
                      <option value="">Brak trenerów w bazie (dodaj w zespole)</option>
                    )}
                  </select>
                </div>

                {activeTab === 'jednorazowe' && (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">Data zajęć jednorazowych *</label>
                    <input 
                      type="date"
                      value={dataJednorazowa}
                      onChange={(e) => setDataJednorazowa(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">Początek</label>
                    <div className="flex gap-2">
                      <select value={startH} onChange={(e) => handleStartChange(e.target.value, startM)} className="w-1/2 bg-sky-50/50 border border-sky-200 rounded-xl px-2 py-2 text-slate-800 cursor-pointer focus:border-sky-500 focus:outline-none">
                        {Array.from({length: 24}, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <select value={startM} onChange={(e) => handleStartChange(startH, e.target.value)} className="w-1/2 bg-sky-50/50 border border-sky-200 rounded-xl px-2 py-2 text-slate-800 cursor-pointer focus:border-sky-500 focus:outline-none">
                        {Array.from({length: 60}, (_, i) => String(i).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">Koniec</label>
                    <div className="flex gap-2">
                      <select value={koniecH} onChange={(e) => setKoniecH(e.target.value)} className="w-1/2 bg-sky-50/50 border border-sky-200 rounded-xl px-2 py-2 text-slate-800 cursor-pointer focus:border-sky-500 focus:outline-none">
                        {Array.from({length: 24}, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <select value={koniecM} onChange={(e) => setKoniecM(e.target.value)} className="w-1/2 bg-sky-50/50 border border-sky-200 rounded-xl px-2 py-2 text-slate-800 cursor-pointer focus:border-sky-500 focus:outline-none">
                        {Array.from({length: 60}, (_, i) => String(i).padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Maksymalna ilość osób *</label>
                  <input 
                    type="number"
                    value={maxOsob}
                    onChange={(e) => setMaxOsob(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2.5 text-slate-800 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                {activeTab === 'cykliczne' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="font-bold text-slate-800 block">Wybierz dni tygodnia:</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {Object.keys(wybraneDni).map((dayKey) => {
                        const isChecked = (wybraneDni as Record<string, boolean>)[dayKey];
                        return (
                          <button
                            key={dayKey}
                            type="button"
                            onClick={() => setWybraneDni({...wybraneDni, [dayKey]: !isChecked})}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors border cursor-pointer ${
                              isChecked ? 'bg-teal-700 text-white border-teal-800 shadow-sm' : 'bg-sky-50 text-slate-600 border-sky-200 hover:bg-sky-100'
                            }`}
                          >
                            {dayKey}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Przyciski dolne */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-sky-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button 
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-black px-6 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  {editingId !== null ? 'ZAKTUALIZUJ' : 'ZAPISZ'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
