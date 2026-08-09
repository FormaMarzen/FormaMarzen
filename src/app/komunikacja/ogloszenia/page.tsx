"use client";

import React, { useState, useEffect } from 'react';

export default function OgloszeniaPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [ogloszenia, setOgloszenia] = useState<any[]>([]);
  const [karnetyBaza, setKarnetyBaza] = useState<string[]>([]);

  // Stan modalu dodawania / edycji ogłoszenia
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState('2026-09-06');
  const [targetType, setTargetType] = useState('Wszystkich');
  const [selectedPasses, setSelectedPasses] = useState<string[]>([]);
  const [content, setContent] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedOgloszenia = localStorage.getItem('forma_marzen_ogloszenia');
      if (savedOgloszenia) {
        try { setOgloszenia(JSON.parse(savedOgloszenia)); } catch (e) {}
      }

      const savedKarnety = localStorage.getItem('forma_marzen_karnety');
      if (savedKarnety) {
        try {
          const parsed = JSON.parse(savedKarnety);
          if (Array.isArray(parsed)) {
            setKarnetyBaza(parsed.map(k => k.nazwa || k));
          }
        } catch (e) {}
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
    }
  }, []);

  const handleOpenAddModal = () => {
    setEditingId(null);
    setDateFrom(new Date().toISOString().split('T')[0]);
    setDateTo('2026-09-06');
    setTargetType('Wszystkich');
    setSelectedPasses([]);
    setContent('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (ogloszenie: any) => {
    setEditingId(ogloszenie.id);
    setDateFrom(ogloszenie.dateFrom || new Date().toISOString().split('T')[0]);
    setDateTo(ogloszenie.dateTo || '2026-09-06');
    if (ogloszenie.targetArray && ogloszenie.targetArray[0] === 'Wszystkich') {
      setTargetType('Wszystkich');
      setSelectedPasses([]);
    } else {
      setTargetType('Wybrane');
      setSelectedPasses(ogloszenie.targetArray || []);
    }
    setContent(ogloszenie.content || '');
    setIsModalOpen(true);
  };

  const handleSaveOgloszenie = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      alert("Treść ogłoszenia nie może być pusta!");
      return;
    }

    const targetText = targetType === 'Wszystkich' 
      ? 'Wszystkich' 
      : selectedPasses.length > 0 ? selectedPasses.join(', ') : 'Wszystkich';

    let zaktualizowane = [];

    if (editingId !== null) {
      zaktualizowane = ogloszenia.map(o => {
        if (o.id === editingId) {
          return {
            ...o,
            dateFrom,
            dateTo,
            target: targetText,
            targetArray: targetType === 'Wszystkich' ? ['Wszystkich'] : selectedPasses,
            content,
            isVisible: true
          };
        }
        return o;
      });
    } else {
      const noweOgloszenie = {
        id: Date.now(),
        dateFrom,
        dateTo,
        target: targetText,
        targetArray: targetType === 'Wszystkich' ? ['Wszystkich'] : selectedPasses,
        content,
        isVisible: true,
        createdAt: new Date().toISOString()
      };
      zaktualizowane = [noweOgloszenie, ...ogloszenia];
    }

    setOgloszenia(zaktualizowane);
    if (typeof window !== 'undefined') {
      localStorage.setItem('forma_marzen_ogloszenia', JSON.stringify(zaktualizowane));
    }

    setIsModalOpen(false);
  };

  const handleToggleVisibility = (id: number) => {
    const zaktualizowane = ogloszenia.map(o => {
      if (o.id === id) {
        return { ...o, isVisible: !o.isVisible };
      }
      return o;
    });
    setOgloszenia(zaktualizowane);
    if (typeof window !== 'undefined') {
      localStorage.setItem('forma_marzen_ogloszenia', JSON.stringify(zaktualizowane));
    }
  };

  const handleDeleteOgloszenie = (id: number) => {
    if (confirm("Czy na pewno chcesz usunąć to ogłoszenie?")) {
      const zaktualizowane = ogloszenia.filter(o => o.id !== id);
      setOgloszenia(zaktualizowane);
      if (typeof window !== 'undefined') {
        localStorage.setItem('forma_marzen_ogloszenia', JSON.stringify(zaktualizowane));
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
    <div className="max-w-[1600px] mx-auto space-y-8 pb-24 relative">
      
      {/* GÓRNY PASEK AKCJI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-sky-200 p-5 rounded-2xl shadow-sm">
        <h1 className="text-lg font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
          OGŁOSZENIA
        </h1>
        <button 
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm w-fit cursor-pointer"
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
            className="w-full bg-sky-50/50 border border-sky-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

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
                      onClick={() => handleToggleVisibility(ogloszenie.id)}
                      className="p-1.5 text-slate-500 hover:text-amber-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Ukryj ogłoszenie (wyłącz wyświetlanie u użytkowników)"
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

      {/* MODAL DODAWANIA / EDYCJI OGŁOSZENIA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-end p-0 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white h-full max-w-xl w-full p-8 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            
            <div className="space-y-8">
              {/* Nagłówek modalu z samym przyciskiem zamknięcia (zgodnie ze zrzutem) */}
              <div className="flex items-center justify-between border-b border-sky-100 pb-4">
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
                      setTargetType(e.target.value);
                      if (e.target.value === 'Wszystkich') setSelectedPasses([]);
                    }}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-800"
                  >
                    <option value="Wszystkich">Wszystkich</option>
                    <option value="Wybrane">Wybrane karnety</option>
                  </select>
                </div>

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
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl p-4 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm leading-relaxed resize-none"
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

    </div>
  );
}
