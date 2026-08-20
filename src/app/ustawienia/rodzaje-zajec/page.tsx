"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Bezpośrednia, bezpieczna inicjalizacja klienta Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function RodzajeZajecPage() {
  const [rodzaje, setRodzaje] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // 1. POBIERANIE DANYCH Z SUPABASE
  const loadRodzaje = async () => {
    try {
      const { data, error } = await supabase
        .from('rodzaje_zajec')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;

      if (data) {
        const parsedData = data.map((item: any) => {
          let parsedUstawienia: any = {};
          try {
            parsedUstawienia = typeof item.ustawienia === 'string' ? JSON.parse(item.ustawienia) : (item.ustawienia || {});
          } catch (e) {
            parsedUstawienia = {};
          }

          return {
            id: item.id,
            nazwa: item.nazwa || '',
            kolor: item.kolor || '#7bc043',
            utworzony: item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            limit_miejsc: item.limit_miejsc || 12,
            ...parsedUstawienia
          };
        });
        setRodzaje(parsedData);
      }
    } catch (err: any) {
      console.error("Błąd pobierania rodzajów zajęć z Supabase:", err);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadRodzaje();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Stany formularza
  const [nazwa, setNazwa] = useState('');
  const [kolor, setKolor] = useState('#7bc043');
  
  // Ustawienia zaawansowane
  const [autoZapisy, setAutoZapisy] = useState(false);
  const [autoZapisyUmowa, setAutoZapisyUmowa] = useState(false);
  const [niewidoczneWGrafiku, setNiewidoczneWGrafiku] = useState(false);
  const [autoOdwolanie, setAutoOdwolanie] = useState(false);
  const [iloscKlubowiczow, setIloscKlubowiczow] = useState('');
  const [czasDoKompletuIlosc, setCzasDoKompletuIlosc] = useState('');
  const [czasDoKompletuJednostka, setCzasDoKompletuJednostka] = useState('Minuty');
  const [rownyPodzial, setRownyPodzial] = useState(false);

  // Widoczność w grafiku publicznym
  const [opis, setOpis] = useState('');
  const [obrazekUrl, setObrazekUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Programowanie treningów i lista rotacyjna
  const [programowanieTreningow, setProgramowanieTreningow] = useState(false);
  const [programowanieList, setProgramowanieList] = useState<any[]>([]);
  const [newTreningTytul, setNewTreningTytul] = useState('');
  const [newTreningOpis, setNewTreningOpis] = useState('');

  const handleOpenAdd = () => {
    setEditingId(null);
    setNazwa('');
    setKolor('#7bc043');
    setAutoZapisy(false);
    setAutoZapisyUmowa(false);
    setNiewidoczneWGrafiku(false);
    setAutoOdwolanie(false);
    setIloscKlubowiczow('');
    setCzasDoKompletuIlosc('');
    setCzasDoKompletuJednostka('Minuty');
    setRownyPodzial(false);
    setOpis('');
    setObrazekUrl(null);
    setProgramowanieTreningow(false);
    setProgramowanieList([]);
    setNewTreningTytul('');
    setNewTreningOpis('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setNazwa(item.nazwa || '');
    setKolor(item.kolor || '#7bc043');
    setAutoZapisy(item.autoZapisy || false);
    setAutoZapisyUmowa(item.autoZapisyUmowa || false);
    setNiewidoczneWGrafiku(item.niewidoczneWGrafiku || false);
    setAutoOdwolanie(item.autoOdwolanie || false);
    setIloscKlubowiczow(item.iloscKlubowiczow || '');
    setCzasDoKompletuIlosc(item.czasDoKompletuIlosc || '');
    setCzasDoKompletuJednostka(item.czasDoKompletuJednostka || 'Minuty');
    setRownyPodzial(item.rownyPodzial || false);
    setOpis(item.opis || '');
    setObrazekUrl(item.obrazekUrl || null);
    setProgramowanieTreningow(item.programowanieTreningow || false);
    setProgramowanieList(item.programowanieList || []);
    setNewTreningTytul('');
    setNewTreningOpis('');
    setIsModalOpen(true);
  };

  // Obsługa wyboru zdjęcia z komputera/telefonu
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400; 
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setObrazekUrl(compressedDataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 2. ZAPIS DO SUPABASE (NOWY LUB AKTUALIZACJA) Z SYNCHRONIZACJĄ ZASAD NADRZĘDNYCH
  const handleAddOrUpdateRodzaj = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nazwa.trim()) return;

    const metaDane = {
      autoZapisy,
      autoZapisyUmowa,
      niewidoczneWGrafiku,
      autoOdwolanie,
      iloscKlubowiczow,
      czasDoKompletuIlosc,
      czasDoKompletuJednostka,
      rownyPodzial,
      opis,
      obrazekUrl,
      programowanieTreningow,
      programowanieList,
      etykiety: [] as string[]
    };

    if (autoZapisy) metaDane.etykiety.push(autoZapisyUmowa ? 'Auto-zapisy (do końca umowy)' : 'Automatyczne zapisy');
    if (niewidoczneWGrafiku) metaDane.etykiety.push('Niewidoczne w grafiku');
    if (autoOdwolanie) metaDane.etykiety.push(`Auto-odwołanie (< ${iloscKlubowiczow || 0} os.)`);
    if (rownyPodzial) metaDane.etykiety.push('Równy podział płci');
    if (programowanieTreningow) {
      metaDane.etykiety.push(programowanieList.length > 0 ? `Programowanie (${programowanieList.length} treng.)` : 'Programowanie treningów');
    }
    
    if (metaDane.etykiety.length === 0) metaDane.etykiety.push('Brak dodatkowych ustawień');

    const payload: any = {
      nazwa: nazwa.trim(),
      kolor: kolor,
      limit_miejsc: 12,
      ustawienia: metaDane
    };

    try {
      if (editingId !== null) {
        // AKTUALIZACJA
        const { error } = await supabase
          .from('rodzaje_zajec')
          .update(payload)
          .eq('id', editingId);
        
        if (error) throw error;
      } else {
        // NOWY WPIS
        const { error } = await supabase
          .from('rodzaje_zajec')
          .insert([payload]);
          
        if (error) throw error;

        // Synchronizacja z nadrzędnymi zasadami zapisu
        const { data: rulesData } = await supabase
          .from('club_booking_rules')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rulesData) {
          const currentCancelMap = rulesData.cancel_deadline_per_class || {};
          const currentCutoffMap = rulesData.booking_cutoff_per_class || {};

          await supabase.from('club_booking_rules').update({
            cancel_deadline_per_class: {
              ...currentCancelMap,
              [nazwa.trim()]: rulesData.cancel_deadline_minutes ?? 90
            },
            booking_cutoff_per_class: {
              ...currentCutoffMap,
              [nazwa.trim()]: rulesData.booking_cutoff_minutes ?? null
            }
          }).eq('id', rulesData.id);
        }
      }

      loadRodzaje(); 
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Błąd zapisu:", error);
      alert(`Wystąpił błąd podczas zapisu: ${error.message || JSON.stringify(error)}`);
    }
  };

  // 3. USUWANIE Z SUPABASE
  const handleDelete = async (id: number) => {
    if (confirm("Czy na pewno chcesz usunąć ten rodzaj zajęć?")) {
      try {
        const { error } = await supabase
          .from('rodzaje_zajec')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        loadRodzaje();
      } catch (error: any) {
        console.error("Błąd podczas usuwania:", error);
        alert(`Nie udało się usunąć: ${error.message || JSON.stringify(error)}`);
      }
    }
  };

  if (!isMounted) {
    return <div className="p-8 text-center text-slate-500 font-bold">Ładowanie rodzajów zajęć z bazy...</div>;
  }

  // Komponent pomocniczy przełącznika toggle
  const ToggleRow = ({ label, state, setState }: { label: string, state: boolean, setState: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-slate-700 font-medium text-xs">{label}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${state ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          {state ? 'Włączono' : 'Wyłączono'}
        </span>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input 
          type="checkbox" 
          checked={state}
          onChange={(e) => setState(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
      </label>
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-24 font-sans antialiased text-slate-800">
      
      {/* GÓRNY PASEK AKCJI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-sky-200 p-5 rounded-2xl shadow-sm">
        <h1 className="text-lg font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
          RODZAJE ZAJĘĆ
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleOpenAdd}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span>+ DODAJ NOWY</span>
          </button>
        </div>
      </div>

      {/* SEKCJA TABELI */}
      <div className="bg-white border border-sky-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sky-50/70 border-b border-sky-200 text-[11px] font-bold text-sky-900 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12"></th>
                <th className="py-3.5 px-4">Nazwa</th>
                <th className="py-3.5 px-4">Utworzony</th>
                <th className="py-3.5 px-4">Kolor</th>
                <th className="py-3.5 px-4">Ustawienia</th>
                <th className="py-3.5 px-4 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100 text-xs">
              {rodzaje.map((item: any) => (
                <tr key={item.id} className="hover:bg-sky-50/40 transition-colors">
                  <td className="py-4 px-4">
                    {item.obrazekUrl ? (
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200">
                        <img src={item.obrazekUrl} alt={item.nazwa} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                        📄
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 font-bold text-slate-900">{item.nazwa}</td>
                  <td className="py-4 px-4 text-slate-500 font-mono">{item.utworzony}</td>
                  <td className="py-4 px-4">
                    <span 
                      className="inline-block w-6 h-6 rounded-full shadow-sm border border-black/10" 
                      style={{ backgroundColor: item.kolor }}
                    />
                  </td>
                  <td className="py-4 px-4 text-slate-600 space-y-1">
                    {(item.etykiety || ['Brak dodatkowych ustawień']).map((opt: string, idx: number) => (
                      <div key={idx} className="text-[11px] flex items-center gap-1.5">
                        <div className="w-1 h-1 bg-sky-400 rounded-full"></div> {opt}
                      </div>
                    ))}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => handleOpenEdit(item)}
                        className="w-8 h-8 bg-sky-50 hover:bg-sky-100 rounded-xl flex items-center justify-center border border-sky-200 transition-colors text-slate-600 cursor-pointer shadow-sm" 
                        title="Edytuj"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="w-8 h-8 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center border border-rose-200 transition-colors cursor-pointer shadow-sm" 
                        title="Usuń"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rodzaje.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    Brak zdefiniowanych rodzajów zajęć. Kliknij „+ DODAJ NOWY”, aby utworzyć pierwsze zajęcia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL / OKNO DODAWANIA / EDYCJI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-0 shadow-2xl my-8 max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Nagłówek Modalu */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-10 shrink-0">
              <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider">
                {editingId !== null ? 'EDYCJA RODZAJU ZAJĘĆ' : 'DODAJ RODZAJ ZAJĘĆ'}
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleAddOrUpdateRodzaj}
                  className="bg-amber-700 hover:bg-amber-800 text-white font-black px-5 py-2 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  {editingId !== null ? 'ZAKTUALIZUJ' : 'ZAPISZ'}
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer">✕</button>
              </div>
            </div>

            {/* Ciało Formularza (Przewijane) */}
            <div className="p-6 overflow-y-auto space-y-8 bg-slate-50/50">
              
              {/* Sekcja: PODSTAWOWE INFORMACJE */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
                <h4 className="font-normal text-slate-400 uppercase tracking-wider text-[11px] pb-2 border-b border-slate-100">
                  Podstawowe informacje
                </h4>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block text-xs">Nazwa *</label>
                  <input 
                    type="text"
                    required
                    placeholder="Na przykład: Boks, Zumba, Joga"
                    value={nazwa}
                    onChange={(e) => setNazwa(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500 font-medium transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block text-xs">Kolor tła:</label>
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-slate-200 shadow-sm shrink-0">
                      <input 
                        type="color"
                        value={kolor}
                        onChange={(e) => setKolor(e.target.value)}
                        className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer border-0 p-0"
                      />
                    </div>
                    <input 
                      type="text"
                      value={kolor}
                      onChange={(e) => setKolor(e.target.value)}
                      className="w-32 bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono text-sm uppercase text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Sekcja: USTAWIENIA ZAAWANSOWANE */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
                <h4 className="font-normal text-slate-400 uppercase tracking-wider text-[11px] pb-2 border-b border-slate-100 mb-2">
                  Ustawienia zaawansowane
                </h4>

                <div>
                  <ToggleRow label="Automatyczne zapisy:" state={autoZapisy} setState={setAutoZapisy} />
                  {autoZapisy && (
                    <div className="border-l-2 border-slate-300 pl-4 ml-2 my-1">
                      <ToggleRow label="Automatyczne zapisy do końca trwania umowy:" state={autoZapisyUmowa} setState={setAutoZapisyUmowa} />
                    </div>
                  )}
                </div>

                <ToggleRow label="Niewidoczne w grafiku:" state={niewidoczneWGrafiku} setState={setNiewidoczneWGrafiku} />
                
                <div>
                  <ToggleRow label="Automatyczne odwołanie zajęć:" state={autoOdwolanie} setState={setAutoOdwolanie} />
                  {autoOdwolanie && (
                    <div className="border-l-2 border-slate-300 pl-4 ml-2 mt-2 mb-4 space-y-6">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-600 font-medium">Ile klubowiczów musi się zapisać, aby zajęcia się odbyły?</label>
                        <input 
                          type="number"
                          min="1"
                          placeholder="Ilość klubowiczów *"
                          value={iloscKlubowiczow}
                          onChange={(e) => setIloscKlubowiczow(e.target.value)}
                          className="w-full bg-transparent border-b border-slate-300 px-1 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] text-slate-600 font-medium">Na jak długo przed rozpoczęciem zajęć grupa musi być kompletna?</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="number"
                            min="1"
                            placeholder="Ilość *"
                            value={czasDoKompletuIlosc}
                            onChange={(e) => setCzasDoKompletuIlosc(e.target.value)}
                            className="w-24 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-amber-500 transition-colors"
                          />
                          <select
                            value={czasDoKompletuJednostka}
                            onChange={(e) => setCzasDoKompletuJednostka(e.target.value)}
                            className="w-32 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
                          >
                            <option value="Minuty">Minuty</option>
                            <option value="Godziny">Godziny</option>
                            <option value="Dni">Dni</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <ToggleRow label="Równy podział wg płci:" state={rownyPodzial} setState={setRownyPodzial} />
              </div>

              {/* Sekcja: WIDOCZNOŚĆ W GRAFIKU PUBLICZNYM */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="font-normal text-slate-400 uppercase tracking-wider text-[11px]">
                    Widoczność w grafiku publicznym
                  </h4>
                </div>

                <div className="space-y-2">
                  <label className="font-bold text-slate-700 block text-xs">Obrazek:</label>
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
                      {obrazekUrl ? (
                        <img src={obrazekUrl} alt="Podgląd" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl text-slate-300">🖼️</span>
                      )}
                    </div>
                    <div className="space-y-2 pt-1">
                      <input 
                        type="file" 
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white hover:bg-slate-50 border border-slate-300 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 shadow-sm transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        WYBIERZ OBRAZEK
                      </button>
                      {obrazekUrl && (
                        <div className="block">
                          <button 
                            type="button" 
                            onClick={() => setObrazekUrl(null)}
                            className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer uppercase tracking-wider"
                          >
                            Usuń obrazek
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <label className="font-bold text-slate-700 block text-xs">Opis:</label>
                  <textarea 
                    rows={4}
                    placeholder="Opis zajęć"
                    value={opis}
                    onChange={(e) => setOpis(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Sekcja: PROGRAMOWANIE TRENINGÓW */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2 mb-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                  <h4 className="font-normal text-slate-400 uppercase tracking-wider text-[11px]">
                    Programowanie treningów
                  </h4>
                </div>
                
                <ToggleRow label="Programowanie treningów:" state={programowanieTreningow} setState={setProgramowanieTreningow} />

                {programowanieTreningow && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                    <div className="text-xs font-bold text-slate-700">Lista zaplanowanych treningów (rotacja):</div>
                    
                    {/* Formularz dodawania nowego treningu do listy */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                      <div className="text-[11px] font-bold text-slate-600 uppercase">Dodaj trening do rotacji</div>
                      <input 
                        type="text"
                        placeholder="Nazwa treningu (np. Trening 1 - Klatka + Triceps)"
                        value={newTreningTytul}
                        onChange={(e) => setNewTreningTytul(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                      />
                      <textarea 
                        placeholder="Szczegóły / Partie / Ćwiczenia (opcjonalnie)"
                        value={newTreningOpis}
                        onChange={(e) => setNewTreningOpis(e.target.value)}
                        rows={2}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newTreningTytul.trim()) return;
                          setProgramowanieList([...programowanieList, { id: Date.now().toString(), tytul: newTreningTytul.trim(), opis: newTreningOpis.trim() }]);
                          setNewTreningTytul('');
                          setNewTreningOpis('');
                        }}
                        className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        + Dodaj do listy treningów
                      </button>
                    </div>

                    {/* Lista dodanych treningów */}
                    <div className="space-y-2">
                      {programowanieList.map((tr: any, idx: number) => (
                        <div key={tr.id || idx} className="flex items-start justify-between bg-white border border-slate-200 p-3 rounded-xl shadow-sm text-xs">
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-800">#{idx + 1}. {tr.tytul}</div>
                            {tr.opis && <div className="text-slate-500 text-[11px]">{tr.opis}</div>}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setProgramowanieList(programowanieList.filter((_, i) => i !== idx));
                            }}
                            className="text-rose-600 hover:text-rose-800 font-bold p-1 cursor-pointer"
                            title="Usuń z listy"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {programowanieList.length === 0 && (
                        <div className="text-center py-4 text-slate-400 text-xs italic">
                          Brak zdefiniowanych treningów w rotacji. Dodaj przynajmniej jeden powyżej.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Dolny Pasek Akcji Modalu */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white shrink-0">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 font-bold px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button 
                type="button" 
                onClick={handleAddOrUpdateRodzaj}
                className="bg-amber-700 hover:bg-amber-800 text-white font-black px-6 py-2.5 rounded-xl transition-colors shadow-md cursor-pointer"
              >
                {editingId !== null ? 'ZAKTUALIZUJ' : 'ZAPISZ'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
