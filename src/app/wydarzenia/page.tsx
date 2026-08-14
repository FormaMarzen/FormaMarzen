"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../raporty/klienci/supabase";

interface Wydarzenie {
  id: number;
  tytul: string;
  data_wydarzenia: string;
  cena: string;
  opis: string;
  grafika_url: string | null;
}

export default function WydarzeniaPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [wydarzenia, setWydarzenia] = useState<Wydarzenie[]>([]);

  // Stany dla Modala Podglądu Klubowicza
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Wydarzenie | null>(null);

  // Stany dla Modala Edycji/Dodawania Admina
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    tytul: "",
    data_wydarzenia: "",
    cena: "",
    opis: "",
    grafika_url: "" as string | null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Sprawdzenie sesji i roli
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email || "";
    
    if (email === "maciejklaput@gmail.com") {
      setIsAdmin(true);
    }

    // Pobranie wydarzeń
    const { data, error } = await supabase
      .from('wydarzenia')
      .select('*')
      .order('data_wydarzenia', { ascending: true });

    if (!error && data) {
      setWydarzenia(data);
    }
    
    setIsLoading(false);
  };

  // Logika sortowania wydarzeń na sekcje
  const dzisiajStr = new Date().toISOString().split('T')[0];
  const dzisiajTime = new Date(dzisiajStr).getTime();

  const przeszle = wydarzenia.filter(w => w.data_wydarzenia < dzisiajStr).sort((a, b) => new Date(b.data_wydarzenia).getTime() - new Date(a.data_wydarzenia).getTime());
  const przyszle = wydarzenia.filter(w => w.data_wydarzenia >= dzisiajStr);

  const najblizsze = przyszle.filter(w => {
    const czasWydarzenia = new Date(w.data_wydarzenia).getTime();
    const roznicaDni = (czasWydarzenia - dzisiajTime) / (1000 * 3600 * 24);
    return roznicaDni <= 14;
  });

  const wkrotce = przyszle.filter(w => {
    const czasWydarzenia = new Date(w.data_wydarzenia).getTime();
    const roznicaDni = (czasWydarzenia - dzisiajTime) / (1000 * 3600 * 24);
    return roznicaDni > 14;
  });

  // --- FUNKCJE ADMINA ---
  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({ tytul: "", data_wydarzenia: dzisiajStr, cena: "", opis: "", grafika_url: null });
    setIsAdminModalOpen(true);
  };

  const handleOpenEdit = (w: Wydarzenie, e: React.MouseEvent) => {
    e.stopPropagation(); // Blokuje otwarcie modala podglądu
    setEditingId(w.id);
    setForm({
      tytul: w.tytul,
      data_wydarzenia: w.data_wydarzenia,
      cena: w.cena || "",
      opis: w.opis || "",
      grafika_url: w.grafika_url
    });
    setIsAdminModalOpen(true);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Czy na pewno chcesz usunąć to wydarzenie?")) return;

    await supabase.from('wydarzenia').delete().eq('id', id);
    fetchData();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; // Dobra jakość na baner, mniejszy rozmiar bazy
          const MAX_HEIGHT = 800;
          let width = img.width; let height = img.height;
          
          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d'); 
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          
          setForm({ ...form, grafika_url: compressed });
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await supabase.from('wydarzenia').update(form).eq('id', editingId);
    } else {
      await supabase.from('wydarzenia').insert([form]);
    }
    setIsAdminModalOpen(false);
    fetchData();
  };

  // --- WIDOK KARTY WYDARZENIA ---
  const EventCard = ({ w, isPast = false }: { w: Wydarzenie, isPast?: boolean }) => (
    <div 
      onClick={() => !isPast && (setSelectedEvent(w), setIsViewModalOpen(true))}
      className={`relative bg-white rounded-3xl overflow-hidden border border-sky-100 flex flex-col group transition-all duration-300 ${
        isPast ? "opacity-50 grayscale hover:grayscale-0 cursor-default" : "shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-sky-300 cursor-pointer"
      }`}
    >
      {/* Opcje Admina */}
      {isAdmin && (
        <div className="absolute top-3 right-3 flex gap-1.5 z-10 bg-white/90 p-1.5 rounded-xl backdrop-blur-md shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => handleOpenEdit(w, e)} className="w-8 h-8 flex items-center justify-center bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition-colors">✏️</button>
          <button onClick={(e) => handleDelete(w.id, e)} className="w-8 h-8 flex items-center justify-center bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors">🗑️</button>
        </div>
      )}

      {/* Grafika */}
      <div className="h-48 w-full bg-slate-100 relative overflow-hidden">
        {w.grafika_url ? (
          <img src={w.grafika_url} alt={w.tytul} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-sky-100 to-amber-50 flex items-center justify-center text-4xl opacity-50">🎟️</div>
        )}
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-black text-sky-950 shadow-sm flex items-center gap-1.5">
          <span>📅</span> {w.data_wydarzenia}
        </div>
      </div>

      {/* Treść dolna */}
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="font-black text-lg text-sky-950 leading-tight mb-2 line-clamp-2">{w.tytul}</h3>
        <p className="text-sm text-slate-500 line-clamp-2 flex-grow">{w.opis || "Brak dodatkowego opisu."}</p>
        
        <div className="mt-4 pt-4 border-t border-sky-50 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cena wejściówki</span>
            <span className="font-black text-sky-900 text-base">{w.cena || "Darmowe"}</span>
          </div>
          {!isPast && (
            <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="flex justify-center items-center h-64 text-sky-900 font-bold">Ładowanie wydarzeń...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-500 pb-12">
      
      {/* NAGŁÓWEK */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-sky-200 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-sky-950 uppercase tracking-tight flex items-center gap-3">
            <span className="p-2 bg-amber-500 rounded-xl shadow-sm text-slate-900">🎯</span>
            Wydarzenia Klubowe
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium max-w-2xl">
            Sprawdź co planujemy w najbliższym czasie. Zapisz się na warsztaty, zawody lub wspólne integracje!
          </p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={handleOpenAdd}
            className="bg-sky-900 hover:bg-sky-950 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>+</span> DODAJ WYDARZENIE
          </button>
        )}
      </div>

      {/* PUSTY STAN GŁÓWNY */}
      {wydarzenia.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-sky-100 border-dashed">
          <div className="text-5xl mb-4">🏜️</div>
          <h3 className="text-lg font-black text-sky-950 mb-1">Brak wydarzeń w kalendarzu</h3>
          <p className="text-slate-500 text-sm">Na ten moment nie zaplanowaliśmy żadnych atrakcji. Wróć tu wkrótce!</p>
        </div>
      )}

      {/* SEKCJA: NAJBLIŻSZE (<= 14 dni) */}
      {najblizsze.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-sky-950 uppercase tracking-tight">🔥 Najbliższe</h2>
            <div className="h-px bg-sky-200 flex-grow"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {najblizsze.map(w => <EventCard key={w.id} w={w} />)}
          </div>
        </div>
      )}

      {/* SEKCJA: WKRÓTCE (> 14 dni) */}
      {wkrotce.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-sky-950 uppercase tracking-tight">⏳ Wkrótce</h2>
            <div className="h-px bg-sky-200 flex-grow"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wkrotce.map(w => <EventCard key={w.id} w={w} />)}
          </div>
        </div>
      )}

      {/* SEKCJA: PRZESZŁE */}
      {przeszle.length > 0 && (
        <div className="space-y-6 opacity-80">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-slate-400 uppercase tracking-tight">🕰️ Przeszłe wydarzenia</h2>
            <div className="h-px bg-slate-200 flex-grow"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {przeszle.map(w => <EventCard key={w.id} w={w} isPast={true} />)}
          </div>
        </div>
      )}


      {/* --- MODAL KLUBOWICZA: SZCZEGÓŁY WYDARZENIA --- */}
      {isViewModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 my-8">
            <button 
              onClick={() => setIsViewModalOpen(false)} 
              className="absolute top-4 right-4 z-20 bg-slate-900/50 hover:bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
            >✕</button>
            
            <div className="w-full h-64 sm:h-80 bg-slate-100 relative">
              {selectedEvent.grafika_url ? (
                <img src={selectedEvent.grafika_url} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-sky-100 to-amber-100 flex items-center justify-center text-6xl">🎉</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent"></div>
              <div className="absolute bottom-6 left-6 right-6">
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">{selectedEvent.tytul}</h2>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap gap-4 border-b border-slate-100 pb-6">
                <div className="flex items-center gap-3 bg-sky-50 px-4 py-2.5 rounded-2xl">
                  <span className="text-2xl">📅</span>
                  <div>
                    <div className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Termin</div>
                    <div className="font-black text-sky-950">{selectedEvent.data_wydarzenia}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-amber-50 px-4 py-2.5 rounded-2xl">
                  <span className="text-2xl">💳</span>
                  <div>
                    <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Koszt udziału</div>
                    <div className="font-black text-amber-950">{selectedEvent.cena || "Wstęp darmowy"}</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-black text-sm text-slate-400 uppercase tracking-wider mb-3">Opis wydarzenia</h3>
                <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedEvent.opis || "Organizator nie podał jeszcze szczegółowego opisu tego wydarzenia."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* --- MODAL ADMINA: DODAJ/EDYTUJ --- */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl relative border-2 border-sky-900 my-8">
            <button onClick={() => setIsAdminModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold cursor-pointer">✕</button>
            
            <div className="mb-6">
              <h3 className="font-black text-xl text-sky-950 leading-tight">
                {editingId ? "Edytuj wydarzenie" : "Kreator wydarzenia"}
              </h3>
              <p className="text-sm font-medium text-slate-500 mt-1">Uzupełnij informacje, które zobaczą klubowicze.</p>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              
              {/* Sekcja grafiki */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 text-xs block uppercase">Grafika główna</label>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 bg-sky-50 border-2 border-dashed border-sky-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-sky-100 transition-colors overflow-hidden relative"
                >
                  {form.grafika_url ? (
                    <>
                      <img src={form.grafika_url} className="w-full h-full object-cover opacity-60" alt="Preview" />
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-sky-900 drop-shadow-md">Kliknij, aby zmienić zdjęcie</div>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl mb-1">📸</span>
                      <span className="text-xs font-bold text-sky-700">Wybierz zdjęcie z dysku</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase mt-4">Tytuł wydarzenia</label>
                <input 
                  type="text" required value={form.tytul} onChange={(e) => setForm({...form, tytul: e.target.value})}
                  placeholder="np. Warsztaty Kettlebell dla początkujących"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">Data</label>
                  <input 
                    type="date" required value={form.data_wydarzenia} onChange={(e) => setForm({...form, data_wydarzenia: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">Cena (np. 50 PLN)</label>
                  <input 
                    type="text" value={form.cena} onChange={(e) => setForm({...form, cena: e.target.value})}
                    placeholder="np. Darmowe, 100 PLN"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase">Opis szczegółowy</label>
                <textarea 
                  required value={form.opis} onChange={(e) => setForm({...form, opis: e.target.value})}
                  placeholder="Wpisz szczegóły, harmonogram, co należy zabrać ze sobą..."
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div className="pt-4 flex gap-2">
                <button type="button" onClick={() => setIsAdminModalOpen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3.5 rounded-xl transition-colors cursor-pointer text-sm">
                  Anuluj
                </button>
                <button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black px-4 py-3.5 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer text-sm">
                  Zapisz do bazy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}