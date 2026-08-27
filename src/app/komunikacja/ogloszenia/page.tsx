"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Bezpośrednia, bezpieczna inicjalizacja klienta Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface KlientItem {
  id: number | string;
  imie: string;
  nazwisko: string;
  email: string;
}

export default function OgloszeniaPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [ogloszenia, setOgloszenia] = useState<any[]>([]);
  const [karnetyBaza, setKarnetyBaza] = useState<string[]>([]);
  const [klienciBaza, setKlienciBaza] = useState<KlientItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stan modalu dodawania / edycji ogłoszenia
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState('2026-09-06');
  const [targetType, setTargetType] = useState<'Wszystkich' | 'Wybrane' | 'Klient'>('Wszystkich');
  const [selectedPasses, setSelectedPasses] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | number | null>(null);
  const [clientFilterQuery, setClientFilterQuery] = useState('');
  const [content, setContent] = useState('');

  // NOWOCZESNY SYSTEM POWIADOMIEŃ TOAST
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // POBIERANIE DANYCH Z SUPABASE
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Pobieranie ogłoszeń z Supabase
      const { data: ogloszeniaData, error: ogloszeniaError } = await supabase
        .from('ogloszenia')
        .select('*')
        .order('id', { ascending: false });

      if (ogloszeniaError) {
        console.error("Błąd pobierania ogłoszeń:", ogloszeniaError);
      } else if (ogloszeniaData) {
        const parsedOgloszenia = ogloszeniaData.map((o: any) => {
          let tArray = ['Wszystkich'];
          if (Array.isArray(o.target_array)) {
            tArray = o.target_array;
          } else if (typeof o.target_array === 'string') {
            try { tArray = JSON.parse(o.target_array); } catch (e) { tArray = [o.target_array]; }
          } else if (o.targetArray) {
            tArray = Array.isArray(o.targetArray) ? o.targetArray : [o.targetArray];
          }

          return {
            id: o.id,
            dateFrom: o.date_from || o.dateFrom || '',
            dateTo: o.date_to || o.dateTo || '',
            target: o.target || 'Wszystkich',
            targetArray: tArray,
            content: o.content || o.tresc || '',
            isVisible: o.is_visible !== undefined ? o.is_visible : (o.isVisible !== undefined ? o.isVisible : true),
            createdAt: o.created_at || o.createdAt || new Date().toISOString()
          };
        });
        setOgloszenia(parsedOgloszenia);
      }

      // 2. Pobieranie listy karnetów z bazy cennika
      const { data: karnetyData } = await supabase
        .from('karnety')
        .select('nazwa')
        .order('nazwa', { ascending: true });

      if (karnetyData && karnetyData.length > 0) {
        setKarnetyBaza(karnetyData.map((k: any) => k.nazwa));
      } else {
        setKarnetyBaza([
          'OPEN',
          'OPEN - umowa 12 miesięcy',
          'OPEN - 6 miesięcy',
          'MEDICOVER sport OPEN',
          '10 wejść',
          'OGÓLNOROZWOJOWE I ROZCIĄGANIE - umowa 12 miesięcy'
        ]);
      }

      // 3. Pobieranie listy klubowiczów z tabeli klienci
      const { data: klienciData, error: klienciError } = await supabase
        .from('klienci')
        .select('id, "Imię", "Nazwisko", "E-mail", imie, nazwisko, email')
        .order('Nazwisko', { ascending: true });

      if (!klienciError && klienciData) {
        const mappedClients: KlientItem[] = klienciData.map((k: any) => ({
          id: k.id,
          imie: k['Imię'] || k.imie || '',
          nazwisko: k['Nazwisko'] || k.nazwisko || '',
          email: k['E-mail'] || k.email || ''
        }));
        setKlienciBaza(mappedClients);
      }
    } catch (err) {
      console.error("Błąd sieci:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddModal = () => {
    setEditingId(null);
    setDateFrom(new Date().toISOString().split('T')[0]);
    setDateTo('2026-09-06');
    setTargetType('Wszystkich');
    setSelectedPasses([]);
    setSelectedClientId(null);
    setClientFilterQuery('');
    setContent('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ogloszenie: any) => {
    setEditingId(ogloszenie.id);
    setDateFrom(ogloszenie.dateFrom || new Date().toISOString().split('T')[0]);
    setDateTo(ogloszenie.dateTo || '2026-09-06');
    setClientFilterQuery('');

    const targetFirst = ogloszenie.targetArray?.[0] || '';

    if (targetFirst === 'Wszystkich' || !targetFirst) {
      setTargetType('Wszystkich');
      setSelectedPasses([]);
      setSelectedClientId(null);
    } else if (typeof targetFirst === 'string' && targetFirst.startsWith('klient:')) {
      setTargetType('Klient');
      const cId = targetFirst.replace('klient:', '');
      setSelectedClientId(cId);
      setSelectedPasses([]);
    } else {
      setTargetType('Wybrane');
      setSelectedPasses(ogloszenie.targetArray || []);
      setSelectedClientId(null);
    }

    setContent(ogloszenie.content || '');
    setIsModalOpen(true);
  };

  const filteredKlienciModal = useMemo(() => {
    if (!clientFilterQuery.trim()) return klienciBaza;
    const q = clientFilterQuery.toLowerCase();
    return klienciBaza.filter(k => 
      `${k.imie} ${k.nazwisko}`.toLowerCase().includes(q) ||
      k.email.toLowerCase().includes(q)
    );
  }, [klienciBaza, clientFilterQuery]);

  const handleSaveOgloszenie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      showToast("Treść ogłoszenia nie może być pusta!", 'error');
      return;
    }

    if (targetType === 'Klient' && !selectedClientId) {
      showToast("Wybierz klubowicza z listy!", 'error');
      return;
    }

    let targetText = 'Wszystkich';
    let targetArr: string[] = ['Wszystkich'];

    if (targetType === 'Wybrane') {
      targetText = selectedPasses.length > 0 ? selectedPasses.join(', ') : 'Wszystkich';
      targetArr = selectedPasses.length > 0 ? selectedPasses : ['Wszystkich'];
    } else if (targetType === 'Klient') {
      const clientObj = klienciBaza.find(k => String(k.id) === String(selectedClientId));
      const clientName = clientObj ? `${clientObj.imie} ${clientObj.nazwisko}`.trim() : 'Klubowicz';
      targetText = `Klubowicz: ${clientName} (${clientObj?.email || ''})`;
      targetArr = [`klient:${selectedClientId}`];
    }

    const payload = {
      date_from: dateFrom,
      date_to: dateTo,
      target: targetText,
      target_array: targetArr,
      content: content,
      is_visible: true
    };

    try {
      if (editingId !== null) {
        const { error } = await supabase
          .from('ogloszenia')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        showToast("Zaktualizowano ogłoszenie!", 'success');
      } else {
        const { error } = await supabase
          .from('ogloszenia')
          .insert([payload]);

        if (error) throw error;
        showToast("Dodano nowe ogłoszenie!", 'success');
      }

      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Błąd zapisu ogłoszenia:", error);
      showToast(`Błąd zapisu: ${error.message || ''}`, 'error');
    }
  };

  const handleToggleVisibility = async (ogloszenie: any) => {
    const newVisibility = !ogloszenie.isVisible;
    try {
      const { error } = await supabase
        .from('ogloszenia')
        .update({ is_visible: newVisibility })
        .eq('id', ogloszenie.id);

      if (error) throw error;
      showToast(newVisibility ? "Ogłoszenie jest teraz widoczne" : "Ukryto ogłoszenie", 'info');
      loadData();
    } catch (error: any) {
      showToast(`Błąd zmiany widoczności: ${error.message}`, 'error');
    }
  };

  const handleDeleteOgloszenie = async (id: number | string) => {
    if (confirm("Czy na pewno chcesz usunąć to ogłoszenie?")) {
      try {
        const { error } = await supabase
          .from('ogloszenia')
          .delete()
          .eq('id', id);

        if (error) throw error;
        showToast("Usunięto ogłoszenie!", 'success');
        loadData();
      } catch (error: any) {
        showToast(`Błąd usuwania: ${error.message}`, 'error');
      }
    }
  };

  const filteredOgloszenia = ogloszenia.filter(o => 
    o.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.target.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const aktywneOgloszenia = filteredOgloszenia.filter(o => o.isVisible !== false);
  const niewidoczneOgloszenia = filteredOgloszenia.filter(o => o.isVisible === false);

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-24 relative font-sans antialiased">
      
      {/* GÓRNY PASEK AKCJI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-sky-200 p-5 rounded-2xl shadow-sm">
        <h1 className="text-lg font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
          OGŁOSZENIA
        </h1>
        <button 
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm w-fit cursor-pointer uppercase"
        >
          <span>+</span> DODAJ OGŁOSZENIE
        </button>
      </div>

      {/* PASEK WYSZUKIWANIA */}
      <div className="bg-white border border-sky-200 rounded-2xl p-5 shadow-sm">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-xs">🔍</span>
          <input 
            type="text" 
            placeholder="Wyszukaj ogłoszenie..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-sky-50/50 border border-sky-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors font-medium"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs">
          Ładowanie ogłoszeń z chmury...
        </div>
      ) : (
        <>
          {/* SEKCJA: AKTYWNE OGŁOSZENIA */}
          {aktywneOgloszenia.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-black text-xs text-slate-500 uppercase tracking-wider">Aktywne ogłoszenia</h3>
              <div className="space-y-4">
                {aktywneOgloszenia.map((ogloszenie) => (
                  <div key={ogloszenie.id} className="bg-white border border-sky-200 rounded-2xl p-5 shadow-sm space-y-3 relative hover:border-sky-300 transition-colors">
                    <div className="flex justify-between items-start border-b border-sky-50 pb-3">
                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-slate-700">
                          Widoczny od dnia: <span className="font-mono text-sky-900">{ogloszenie.dateFrom}</span> do dnia: <span className="font-mono text-sky-900">{ogloszenie.dateTo}</span>
                        </div>
                        <div className="text-slate-500">
                          Widoczne dla: <strong className="text-slate-800">{ogloszenie.target}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase">
                          AKTYWNE NA GÓRZE
                        </span>
                        
                        <button 
                          onClick={() => handleToggleVisibility(ogloszenie)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Ukryj ogłoszenie"
                        >
                          👁️‍🗨️
                        </button>

                        <button 
                          onClick={() => handleDeleteOgloszenie(ogloszenie.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Usuń ogłoszenie"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-800 whitespace-pre-wrap bg-sky-50/30 p-3.5 rounded-xl border border-sky-100/60 leading-relaxed">
                      {ogloszenie.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SEKCJA: NIEWIDOCZNE OGŁOSZENIA */}
          {niewidoczneOgloszenia.length > 0 && (
            <div className="space-y-4 pt-4">
              <h3 className="font-black text-xs text-slate-500 uppercase tracking-wider">Niewidoczne ogłoszenia</h3>
              <div className="space-y-4">
                {niewidoczneOgloszenia.map((ogloszenie) => (
                  <div key={ogloszenie.id} className="bg-slate-200/80 border border-slate-300 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                    
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                      <span className="text-7xl">👁️‍🗨️</span>
                    </div>

                    <div className="flex justify-between items-start border-b border-slate-300 pb-3 relative z-10">
                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-slate-700">
                          Widoczny od dnia: <span className="font-mono text-slate-900">{ogloszenie.dateFrom}</span> do dnia: <span className="font-mono text-slate-900">{ogloszenie.dateTo}</span>
                        </div>
                        <div className="text-slate-600">
                          Widoczne dla: <strong className="text-slate-900">{ogloszenie.target}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleOpenEditModal(ogloszenie)}
                          className="p-1.5 text-rose-900 hover:text-rose-950 rounded-lg hover:bg-slate-300/60 transition-colors cursor-pointer"
                          title="Edytuj i włącz wyświetlanie ogłoszenia"
                        >
                          👁️
                        </button>

                        <button 
                          onClick={() => handleDeleteOgloszenie(ogloszenie.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-700 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
                          title="Usuń ogłoszenie"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-800 whitespace-pre-wrap bg-white/60 p-3.5 rounded-xl border border-slate-300/60 leading-relaxed relative z-10">
                      {ogloszenie.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STAN PUSTY */}
          {filteredOgloszenia.length === 0 && (
            <div className="bg-white border border-sky-200 rounded-2xl p-12 text-center shadow-sm space-y-4 flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-sky-50 rounded-full border border-sky-100 flex items-center justify-center text-3xl shadow-inner">
                📢
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="font-bold text-slate-900 text-sm">Brak ogłoszeń</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Nie masz jeszcze żadnych ogłoszeń. Utwórz pierwsze ogłoszenie, aby poinformować klientów.
                </p>
              </div>
              <div className="pt-2">
                <button 
                  onClick={handleOpenAddModal}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-3 rounded-xl text-xs tracking-wider uppercase transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <span>+</span> Dodaj ogłoszenie
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL DODAWANIA / EDYCJI OGŁOSZENIA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-end p-0 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white h-full max-w-xl w-full p-8 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            
            <div className="space-y-8">
              {/* Nagłówek modalu */}
              <div className="flex items-center justify-between border-b border-sky-100 pb-4">
                <h3 className="font-black text-sm text-sky-950 uppercase">
                  {editingId !== null ? 'Edycja ogłoszenia' : 'Nowe ogłoszenie'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer">✕</button>
              </div>

              {/* SEKCJA: WIDOCZNOŚĆ */}
              <div className="space-y-4">
                <h4 className="font-black text-xs text-sky-950 uppercase tracking-widest border-b border-sky-100 pb-2">Widoczność</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Widoczny od dnia:</label>
                    <input 
                      type="date" 
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Widoczny do dnia:</label>
                    <input 
                      type="date" 
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs pt-2">
                  <label className="font-bold text-slate-700 block">Widoczne dla:</label>
                  <select 
                    value={targetType}
                    onChange={(e) => {
                      const val = e.target.value as 'Wszystkich' | 'Wybrane' | 'Klient';
                      setTargetType(val);
                      if (val === 'Wszystkich') {
                        setSelectedPasses([]);
                        setSelectedClientId(null);
                      } else if (val === 'Wybrane') {
                        setSelectedClientId(null);
                      } else if (val === 'Klient') {
                        setSelectedPasses([]);
                      }
                    }}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="Wszystkich">Wszyscy klubowicze (Publiczne)</option>
                    <option value="Wybrane">Wybrane karnety</option>
                    <option value="Klient">Konkretny klubowicz (z bazy)</option>
                  </select>
                </div>

                {/* OPCJA 1: WYBRANE KARNETY */}
                {targetType === 'Wybrane' && (
                  <div className="space-y-2 pt-2 bg-sky-50/50 p-4 rounded-2xl border border-sky-100 text-xs">
                    <span className="font-bold text-sky-950 block">Zaznacz karnety (jeden lub wiele):</span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                      {karnetyBaza.map((karnet, idx) => {
                        const isChecked = selectedPasses.includes(karnet);
                        return (
                          <label key={idx} className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-sky-200 cursor-pointer hover:bg-sky-50 transition-colors">
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPasses([...selectedPasses, karnet]);
                                } else {
                                  setSelectedPasses(selectedPasses.filter(p => p !== karnet));
                                }
                              }}
                              className="w-4 h-4 accent-rose-900 rounded cursor-pointer"
                            />
                            <span className="font-bold text-slate-800">{karnet}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* OPCJA 2: KONKRETNY KLUBOWICZ */}
                {targetType === 'Klient' && (
                  <div className="space-y-3 pt-2 bg-sky-50/50 p-4 rounded-2xl border border-sky-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-950 block">Wybierz klubowicza z listy:</span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        Łącznie w bazie: {klienciBaza.length}
                      </span>
                    </div>

                    <input 
                      type="text" 
                      placeholder="Filtruj listę (imię, nazwisko, e-mail)..."
                      value={clientFilterQuery}
                      onChange={(e) => setClientFilterQuery(e.target.value)}
                      className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 font-medium"
                    />

                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {filteredKlienciModal.map((k) => {
                        const isSelected = String(selectedClientId) === String(k.id);
                        return (
                          <div 
                            key={k.id}
                            onClick={() => setSelectedClientId(k.id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-amber-50 border-amber-400 shadow-sm' 
                                : 'bg-white border-sky-100 hover:bg-sky-50/80'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] uppercase ${
                                isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-sky-100 text-sky-900'
                              }`}>
                                {k.imie?.[0] || 'K'}{k.nazwisko?.[0] || ''}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">{k.imie} {k.nazwisko}</div>
                                <div className="text-[10px] text-slate-400">{k.email || 'Brak e-mail'}</div>
                              </div>
                            </div>
                            <input 
                              type="radio" 
                              name="selected_client"
                              checked={isSelected}
                              onChange={() => setSelectedClientId(k.id)}
                              className="accent-amber-500 cursor-pointer"
                            />
                          </div>
                        );
                      })}
                      {filteredKlienciModal.length === 0 && (
                        <div className="text-center py-4 text-slate-400 italic">
                          Nie znaleziono klubowicza dla podanej frazy.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SEKCJA: OGŁOSZENIE / TREŚĆ */}
              <div className="space-y-4">
                <h4 className="font-black text-xs text-sky-950 uppercase tracking-widest border-b border-sky-100 pb-2">Ogłoszenie</h4>
                
                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-700 block">TREŚĆ</label>
                  <textarea 
                    rows={8} 
                    placeholder="Wpisz treść ogłoszenia widocznego dla klientów..." 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl p-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm leading-relaxed resize-none font-medium"
                  />
                </div>
              </div>

            </div>

            <div className="pt-6 border-t border-sky-100 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3 rounded-xl uppercase tracking-wider text-xs cursor-pointer"
              >
                Anuluj
              </button>
              <button 
                type="button" 
                onClick={handleSaveOgloszenie}
                className="bg-rose-900 hover:bg-rose-800 text-white font-black px-8 py-3 rounded-xl uppercase tracking-wider text-xs shadow-md cursor-pointer"
              >
                {editingId !== null ? 'Zaktualizuj ogłoszenie' : 'Zapisz ogłoszenie'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* NOWOCZESNY TOAST */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-none">
          <div className={`px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            toast.type === 'error'
              ? 'bg-slate-900 border-rose-500/30 text-white'
              : toast.type === 'info'
              ? 'bg-slate-900 border-sky-500/30 text-white'
              : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
              toast.type === 'error' ? 'bg-rose-600 text-white' :
              toast.type === 'info' ? 'bg-sky-600 text-white' :
              'bg-emerald-600 text-white'
            }`}>
              {toast.type === 'error' ? '✕' : toast.type === 'info' ? 'ℹ' : '✓'}
            </div>
            <span className="text-xs sm:text-sm font-semibold text-white pr-2">
              {toast.message}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
