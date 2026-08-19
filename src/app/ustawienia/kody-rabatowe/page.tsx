"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../raporty/klienci/supabase'; // Upewnij się, że ścieżka jest poprawna

type KodRabatowy = {
  id: string;
  kod: string;
  typ_znizki: string;
  wartosc_znizki: number;
  aktywny: boolean;
  limit_ogolny: number;
  limit_na_osobe: number;
  data_zakonczenia: string | null;
  wszystkie_karnety: boolean;
  wszystkie_produkty: boolean;
  wykorzystano_ogolnie: number;
};

export default function KodyRabatowePage() {
  const [kody, setKody] = useState<KodRabatowy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Stan formularza
  const [formData, setFormData] = useState({
    id: '',
    kod: '',
    typ_znizki: 'procentowa',
    wartosc_znizki: '',
    limit_ogolny: '100',
    limit_na_osobe: '1',
    data_zakonczenia: '',
    wszystkie_karnety: true,
    wszystkie_produkty: true,
    aktywny: true,
  });

  useEffect(() => {
    fetchKody();
  }, []);

  const fetchKody = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('kody_rabatowe')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Błąd pobierania kodów:', error);
    } else {
      setKody(data || []);
    }
    setIsLoading(false);
  };

  const openSidebar = (kod?: KodRabatowy) => {
    if (kod) {
      setFormData({
        id: kod.id,
        kod: kod.kod,
        typ_znizki: kod.typ_znizki,
        wartosc_znizki: kod.wartosc_znizki.toString(),
        limit_ogolny: kod.limit_ogolny.toString(),
        limit_na_osobe: kod.limit_na_osobe.toString(),
        data_zakonczenia: kod.data_zakonczenia || '',
        wszystkie_karnety: kod.wszystkie_karnety,
        wszystkie_produkty: kod.wszystkie_produkty,
        aktywny: kod.aktywny,
      });
    } else {
      setFormData({
        id: '',
        kod: '',
        typ_znizki: 'procentowa',
        wartosc_znizki: '',
        limit_ogolny: '100',
        limit_na_osobe: '1',
        data_zakonczenia: '',
        wszystkie_karnety: true,
        wszystkie_produkty: true,
        aktywny: true,
      });
    }
    setIsSidebarOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      kod: formData.kod.toUpperCase().trim(),
      typ_znizki: formData.typ_znizki,
      wartosc_znizki: parseFloat(formData.wartosc_znizki),
      limit_ogolny: parseInt(formData.limit_ogolny) || 0,
      limit_na_osobe: parseInt(formData.limit_na_osobe) || 1,
      data_zakonczenia: formData.data_zakonczenia || null,
      wszystkie_karnety: formData.wszystkie_karnety,
      wszystkie_produkty: formData.wszystkie_produkty,
      aktywny: formData.aktywny,
    };

    if (formData.id) {
      // Aktualizacja
      const { error } = await supabase
        .from('kody_rabatowe')
        .update(payload)
        .eq('id', formData.id);

      if (error) alert('Błąd podczas aktualizacji: ' + error.message);
      else {
        await fetchKody();
        setIsSidebarOpen(false);
      }
    } else {
      // Nowy kod
      const { error } = await supabase
        .from('kody_rabatowe')
        .insert([payload]);

      if (error) alert('Błąd podczas dodawania: ' + error.message);
      else {
        await fetchKody();
        setIsSidebarOpen(false);
      }
    }
    setIsSaving(false);
  };

  const toggleAktywny = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('kody_rabatowe')
      .update({ aktywny: !currentStatus })
      .eq('id', id);
    if (!error) fetchKody();
  };

  return (
    <div className="bg-white min-h-full rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-100">
        <h1 className="text-xl font-black text-slate-800 uppercase tracking-wider">Kody Rabatowe</h1>
        <button
          onClick={() => openSidebar()}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 uppercase tracking-wider"
        >
          <span>+</span> Dodaj Kod
        </button>
      </div>

      {/* Lista kodów */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs text-slate-400 bg-slate-50 border-b border-slate-100 uppercase font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4">Kod</th>
              <th className="px-6 py-4">Zniżka</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Wygasa / Limity</th>
              <th className="px-6 py-4 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-bold uppercase text-xs">
                  Ładowanie kodów...
                </td>
              </tr>
            ) : kody.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400 font-bold uppercase text-xs">
                  Brak utworzonych kodów rabatowych
                </td>
              </tr>
            ) : (
              kody.map((kod) => (
                <tr key={kod.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-black text-slate-800">{kod.kod}</td>
                  <td className="px-6 py-4 font-semibold">
                    {kod.wartosc_znizki}{kod.typ_znizki === 'procentowa' ? '%' : ' PLN'}
                  </td>
                  <td className="px-6 py-4">
                    <span 
                      onClick={() => toggleAktywny(kod.id, kod.aktywny)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors ${
                        kod.aktywny ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${kod.aktywny ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      {kod.aktywny ? 'Aktywny' : 'Nieaktywny'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-slate-700">Limit użyć: {kod.limit_ogolny} (Zużyto: {kod.wykorzystano_ogolnie})</span>
                      <span className="text-slate-500">
                        Data zakończenia: {kod.data_zakonczenia ? kod.data_zakonczenia : 'Brak'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => openSidebar(kod)}
                      className="text-sky-600 hover:text-sky-800 font-bold text-xs uppercase tracking-wider"
                    >
                      Edytuj
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sidebar (Modal) Dodawania / Edycji */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-slate-50 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200">
            
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0">
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 transition-colors"
              >
                ✕
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-6 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 uppercase tracking-wider disabled:opacity-50"
              >
                <span>💾</span> {isSaving ? 'Zapisywanie...' : 'Zapisz'}
              </button>
            </div>

            {/* Sidebar Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Sekcja: Kod Rabatowy */}
              <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">KOD RABATOWY</h3>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Kod (tylko litery i cyfry) *</label>
                  <input 
                    type="text" 
                    required
                    value={formData.kod}
                    onChange={(e) => setFormData({...formData, kod: e.target.value.toUpperCase()})}
                    placeholder="np. BLACKFRIDAY25"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-black focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 uppercase"
                  />
                </div>
              </section>

              {/* Sekcja: Typ i wielkość zniżki */}
              <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">TYP I WIELKOŚĆ ZNIŻKI</h3>
                
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Rodzaj zniżki *</label>
                  <select 
                    value={formData.typ_znizki}
                    onChange={(e) => setFormData({...formData, typ_znizki: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-semibold focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value="procentowa">Procentowa %</option>
                    <option value="kwotowa">Kwotowa PLN</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Wielkość zniżki *</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      required
                      min="0"
                      step="0.01"
                      value={formData.wartosc_znizki}
                      onChange={(e) => setFormData({...formData, wartosc_znizki: e.target.value})}
                      placeholder="np. 15"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-bold focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      {formData.typ_znizki === 'procentowa' ? '%' : 'PLN'}
                    </span>
                  </div>
                </div>
              </section>

              {/* Sekcja: Limity */}
              <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">LIMITY I CZAS</h3>
                
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Ogólny limit użyć (dla wszystkich) *</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    value={formData.limit_ogolny}
                    onChange={(e) => setFormData({...formData, limit_ogolny: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-semibold focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Limit użyć na użytkownika *</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    value={formData.limit_na_osobe}
                    onChange={(e) => setFormData({...formData, limit_na_osobe: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-semibold focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Data zakończenia (opcjonalnie)</label>
                  <input 
                    type="date" 
                    value={formData.data_zakonczenia}
                    onChange={(e) => setFormData({...formData, data_zakonczenia: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-semibold focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </section>

              {/* Sekcja: Ograniczenia */}
              <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">OGRANICZENIA ZAKUPU</h3>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Obejmuje wszystkie karnety?</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={formData.wszystkie_karnety}
                      onChange={(e) => setFormData({...formData, wszystkie_karnety: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Obejmuje wszystkie produkty w sklepie?</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={formData.wszystkie_produkty}
                      onChange={(e) => setFormData({...formData, wszystkie_produkty: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

              </section>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
