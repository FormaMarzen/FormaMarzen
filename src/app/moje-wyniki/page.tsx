"use client";

import React, { useState } from "react";

// Przykładowe dane początkowe - tylko do zaprezentowania designu
const MOCK_DATA = [
  { id: 1, nazwa: "Martwy Ciąg", kategoria: "Siła", jednostka: "kg", najlepszyWynik: "180", dataRekordu: "2026-07-15", typ: "waga" },
  { id: 2, nazwa: "Wyciskanie leżąc", kategoria: "Siła", jednostka: "kg", najlepszyWynik: "120", dataRekordu: "2026-08-01", typ: "waga" },
  { id: 3, nazwa: "Przysiad ze sztangą", kategoria: "Siła", jednostka: "kg", najlepszyWynik: "150", dataRekordu: "2026-06-22", typ: "waga" },
  { id: 4, nazwa: "Bieg 5 km", kategoria: "Kondycja", jednostka: "min", najlepszyWynik: "22:15", dataRekordu: "2026-08-10", typ: "czas" },
  { id: 5, nazwa: "Ergometr wioślarski (2000m)", kategoria: "Kondycja", jednostka: "min", najlepszyWynik: "07:30", dataRekordu: "2026-07-28", typ: "czas" },
  { id: 6, nazwa: "Podciąganie na drążku", kategoria: "Cross", jednostka: "powt.", najlepszyWynik: "15", dataRekordu: "2026-08-12", typ: "ilosc" },
];

const KATEGORIE = ["Wszystkie", "Siła", "Kondycja", "Cross"];

export default function MojeWynikiPage() {
  const [wyniki, setWyniki] = useState(MOCK_DATA);
  const [aktywnaKategoria, setAktywnaKategoria] = useState("Wszystkie");
  
  // Stany dla modala dodawania wyniku
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wybraneCwiczenie, setWybraneCwiczenie] = useState<any>(null);
  const [nowyWynikWartosc, setNowyWynikWartosc] = useState("");
  const [nowyWynikData, setNowyWynikData] = useState(new Date().toISOString().split('T')[0]);

  // Filtrowanie ćwiczeń
  const widoczneWyniki = aktywnaKategoria === "Wszystkie" 
    ? wyniki 
    : wyniki.filter(w => w.kategoria === aktywnaKategoria);

  // Obsługa otwarcia modala
  const handleOpenModal = (cwiczenie: any) => {
    setWybraneCwiczenie(cwiczenie);
    setNowyWynikWartosc("");
    setNowyWynikData(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  // Symulacja zapisu wyniku
  const handleSaveZapis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wybraneCwiczenie || !nowyWynikWartosc) return;

    // Aktualizujemy mockowane dane (w przyszłości tutaj będzie zapis do Supabase)
    const zaktualizowane = wyniki.map(w => {
      if (w.id === wybraneCwiczenie.id) {
        return {
          ...w,
          najlepszyWynik: nowyWynikWartosc,
          dataRekordu: nowyWynikData
        };
      }
      return w;
    });

    setWyniki(zaktualizowane);
    setIsModalOpen(false);
    alert("Wynik został pomyślnie zaktualizowany!");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* NAGŁÓWEK */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-sky-200 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-sky-950 uppercase tracking-tight flex items-center gap-3">
            <span className="p-2 bg-amber-500 rounded-xl shadow-sm text-slate-900">🏆</span>
            Tablica Wyników
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium max-w-2xl">
            Śledź swój progres, aktualizuj rekordy życiowe (PR) i kontroluj swoje osiągnięcia w poszczególnych strefach treningowych.
          </p>
        </div>
      </div>

      {/* FILTRY KATEGORII */}
      <div className="flex flex-wrap gap-2">
        {KATEGORIE.map((kat) => (
          <button
            key={kat}
            onClick={() => setAktywnaKategoria(kat)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-sm cursor-pointer border ${
              aktywnaKategoria === kat
                ? "bg-amber-500 text-slate-950 border-amber-600 scale-105"
                : "bg-white text-slate-600 border-sky-200 hover:bg-sky-50 hover:text-sky-950"
            }`}
          >
            {kat}
          </button>
        ))}
      </div>

      {/* GRID WYNIKÓW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {widoczneWyniki.map((cwiczenie) => (
          <div 
            key={cwiczenie.id} 
            className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm hover:shadow-md hover:border-sky-300 transition-all duration-300 group flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg">
                  {cwiczenie.kategoria}
                </span>
                <span className="text-slate-300 group-hover:text-amber-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </span>
              </div>
              
              <h3 className="font-black text-lg text-sky-950 leading-tight mb-6">
                {cwiczenie.nazwa}
              </h3>

              <div className="space-y-1 mb-6">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aktualny Rekord (PR)</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-slate-800 tracking-tighter">
                    {cwiczenie.najlepszyWynik}
                  </span>
                  <span className="text-sm font-bold text-slate-500">
                    {cwiczenie.jednostka}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-2">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Ustanowiono: {cwiczenie.dataRekordu}
                </div>
              </div>
            </div>

            <button 
              onClick={() => handleOpenModal(cwiczenie)}
              className="w-full py-3 rounded-xl bg-sky-50 text-sky-900 font-bold text-xs uppercase tracking-wider group-hover:bg-sky-900 group-hover:text-white transition-colors duration-300 border border-sky-100 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>+</span> Aktualizuj wynik
            </button>
          </div>
        ))}
      </div>

      {widoczneWyniki.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-sky-100 border-dashed">
          <div className="text-4xl mb-3">🤷‍♂️</div>
          <h3 className="text-lg font-black text-sky-950 mb-1">Brak ćwiczeń w tej kategorii</h3>
          <p className="text-slate-500 text-sm">Wybierz inną kategorię lub dodaj nowe ćwiczenia.</p>
        </div>
      )}

      {/* MODAL AKTUALIZACJI WYNIKU */}
      {isModalOpen && wybraneCwiczenie && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            <button 
              onClick={() => setIsModalOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-2 cursor-pointer"
            >
              ✕
            </button>

            <div className="mb-6 pr-8">
              <h3 className="font-black text-xl text-sky-950 leading-tight">
                Nowy Rekord
              </h3>
              <p className="text-sm font-bold text-amber-600 mt-1">
                {wybraneCwiczenie.nazwa}
              </p>
            </div>

            <form onSubmit={handleSaveZapis} className="space-y-5">
              
              <div className="space-y-2">
                <label className="font-bold text-slate-700 text-xs uppercase tracking-wider block">
                  Twój nowy wynik
                </label>
                <div className="relative">
                  <input 
                    type={wybraneCwiczenie.typ === 'czas' ? "text" : "number"} 
                    step={wybraneCwiczenie.typ === 'waga' ? "0.5" : "1"}
                    required
                    value={nowyWynikWartosc}
                    onChange={(e) => setNowyWynikWartosc(e.target.value)}
                    placeholder={wybraneCwiczenie.typ === 'czas' ? "np. 12:45" : "np. 100"}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-4 py-3 text-2xl font-black text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    {wybraneCwiczenie.jednostka}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-700 text-xs uppercase tracking-wider block">
                  Data uzyskania wyniku
                </label>
                <input 
                  type="date" 
                  required
                  value={nowyWynikData}
                  onChange={(e) => setNowyWynikData(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-4 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  Zapisz wynik
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}