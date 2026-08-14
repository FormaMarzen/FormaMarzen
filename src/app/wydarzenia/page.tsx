"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../raporty/klienci/supabase";

interface Wydarzenie {
  id: number;
  tytul: string;
  data_od: string;
  data_do: string;
  cena: string;
  zadatek: string;
  opis: string;
  grafika_url: string | null;
  status: string;
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
    data_od: new Date().toISOString().split('T')[0],
    data_do: new Date().toISOString().split('T')[0],
    cena: "",
    zadatek: "",
    opis: "",
    grafika_url: "" as string | null,
    status: "wkrotce"
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email || "";
    
    if (email === "maciejklaput@gmail.com") {
      setIsAdmin(true);
    }

    const { data, error } = await supabase
      .from('wydarzenia')
      .select('*')
      .order('data_od', { ascending: true });

    if (!error && data) {
      setWydarzenia(data);
    }
    
    setIsLoading(false);
  };

  const dzisiajStr = new Date().toISOString().split('T')[0];

  const przeszle = wydarzenia.filter(w => {
    const dataKoniec = w.data_do || w.data_od;
    return dataKoniec < dzisiajStr;
  }).sort((a, b) => new Date(b.data_od).getTime() - new Date(a.data_od).getTime());

  const przyszle = wydarzenia.filter(w => {
    const dataKoniec = w.data_do || w.data_od;
    return dataKoniec >= dzisiajStr;
  });

  const wkrotce = przyszle
    .filter(w => w.status !== 'planowane')
    .sort((a, b) => new Date(a.data_od).getTime() - new Date(b.data_od).getTime());

  const planowane = przyszle
    .filter(w => w.status === 'planowane')
    .sort((a, b) => new Date(a.data_od).getTime() - new Date(b.data_od).getTime());


  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({ 
      tytul: "", 
      data_od: dzisiajStr, 
      data_do: dzisiajStr, 
      cena: "", 
      zadatek: "", 
      opis: "", 
      grafika_url: null,
      status: "wkrotce"
    });
    setIsAdminModalOpen(true);
  };

  const handleOpenEdit = (w: Wydarzenie, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(w.id);
    setForm({
      tytul: w.tytul,
      data_od: w.data_od,
      data_do: w.data_do || w.data_od,
      cena: w.cena || "",
      zadatek: w.zadatek || "",
      opis: w.opis || "",
      grafika_url: w.grafika_url,
      status: w.status || "wkrotce"
    });
    setIsAdminModalOpen(true);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Czy na pewno chcesz usunąć to wydarzenie? Tej operacji nie można cofnąć.")) return;

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
          const MAX_WIDTH = 800;
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

  const formatTermin = (od: string, doDnia: string) => {
    if (!doDnia || od === doDnia) return od;
    return `${od} — ${doDnia}`;
  };

  const EventCard = ({ w, isPast = false }: { w: Wydarzenie, isPast?: boolean }) => (
    <div 
      onClick={() => !isPast && (setSelectedEvent(w), setIsViewModalOpen(true))}
      className={`relative bg-white rounded-3xl overflow-hidden border border-sky-100 flex flex-col group transition-all duration-300 ${
        isPast ? "opacity-60 grayscale hover:grayscale-0 cursor-default" : "shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-sky-300 cursor-pointer"
      }`}
    >
      {/* Przyciski admina zawsze widoczne dla zalogowanego administratora */}
      {isAdmin && (
        <div className="absolute top-3 right-3 flex gap-2 z-20 bg-white/95 p-1.5 rounded-xl backdrop-blur-md shadow-md border border-slate-100">
          <button onClick={(e) => handleOpenEdit(w, e)} className="w-9 h-9 flex items-center justify-center bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition-colors shadow-sm">✏️</button>
          <button onClick={(e) => handleDelete(w.id, e)} className="w-9 h-9 flex items-center justify-center bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors shadow-sm">🗑️</button>
        </div>
      )}

      <div className="h-48 w-full bg-slate-100 relative overflow-hidden">
        {w.grafika_url ? (
          <img src={w.grafika_url} alt={w.tytul} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-sky-100 to-amber-50 flex items-center justify-center text-4xl opacity-50">🎟️</div>
        )}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-black text-sky-950 shadow-sm flex items-center gap-1.5 z-10 border border-white/50">
          <span>📅</span> {formatTermin(w.data_od, w.data_do)}
        </div>
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <h3 className="font-black text-lg text-sky-950 leading-tight mb-2 line-clamp-2">{w.tytul}</h3>
        <p className="text-sm text-slate-500 line-clamp-2 flex-grow">{w.opis || "Brak dodatkowego opisu."}</p>
        
        <div className="mt-4 pt-4 border-t border-sky-50 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cena wydarzenia</span>
            <span className="font-black text-sky-900 text-base">{w.cena || "Darmowe"}</span>
          </div>
          {w.zadatek && (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Zadatek</span>
              <span className="font-black text-amber-700 text-sm">{w.zadatek}</span>
            </div>
          )}
          {!isPast && !w.zadatek && (
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
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-sky-200 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-sky-950 uppercase tracking-tight flex items-center gap-3">
            <span className="p-2 bg-amber-500 rounded-xl shadow-sm text-slate-900">🎯</span>
            Wydarzenia Klubowe
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium max-w-2xl">
            Sprawdź co planujemy w najbliższym czasie. Zapisz się na warsztaty, obozy lub wspólne treningi!
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

      {wydarzenia.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-sky-100 border-dashed">
          <div className="text-5xl mb-4">🏜️</div>
          <h3 className="text-lg font-black text-sky-950 mb-1">Brak wydarzeń w kalendarzu</h3>
          <p className="text-slate-500 text-sm">Na ten moment nie zaplanowaliśmy żadnych atrakcji. Wróć tu wkrótce!</p>
        </div>
      )}

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

      {planowane.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-sky-950 uppercase tracking-tight">📅 Planowane</h2>
            <div className="h-px bg-sky-200 flex-grow"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {planowane.map(w => <EventCard key={w.id} w={w} />)}
          </div>
        </div>
      )}

      {przeszle.length > 0 && (
        <div className="space-y-6 opacity-90">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-slate-400 uppercase tracking-tight">🕰️ Przeszłe wydarzenia</h2>
            <div className="h-px bg-slate-200 flex-grow"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {przeszle.map(w => <EventCard key={w.id} w={w} isPast={true} />)}
          </div>
        </div>
      )}

      {/* NOWY, PIĘKNY MODAL PODGLĄDU KLUBOWICZA */}
      {isViewModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-start justify-center p-2 sm:p-4 md:py-10 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-50 rounded-[2rem] max-w-3xl w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
            
            {/* Przycisk zamykania */}
            <button 
              onClick={() => setIsViewModalOpen(false)} 
              className="absolute top-4 right-4 z-20 bg-white hover:bg-slate-100 text-slate-900 w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg cursor-pointer font-black text-lg"
            >✕</button>
            
            {/* Sekcja pełnego plakatu z ładnym, kinowym tłem */}
            <div className="w-full bg-slate-900 relative flex justify-center items-center overflow-hidden" style={{ minHeight: '300px', maxHeight: '65vh' }}>
              {selectedEvent.grafika_url ? (
                <>
                  <div 
                    className="absolute inset-0 opacity-40 blur-2xl bg-cover bg-center scale-110" 
                    style={{ backgroundImage: `url(${selectedEvent.grafika_url})` }}
                  ></div>
                  <img 
                    src={selectedEvent.grafika_url} 
                    alt="Plakat wydarzenia" 
                    className="relative z-10 w-full h-full object-contain max-h-[65vh] drop-shadow-2xl" 
                  />
                </>
              ) : (
                <div className="w-full h-full min-h-[300px] bg-gradient-to-br from-sky-900 to-slate-800 flex flex-col items-center justify-center text-sky-100">
                  <span className="text-7xl mb-4 drop-shadow-lg">🎉</span>
                  <span className="font-black text-xl tracking-widest uppercase opacity-50">Brak plakatu</span>
                </div>
              )}
            </div>

            {/* Treść wydarzenia */}
            <div className="p-6 sm:p-10 space-y-8">
              
              {/* Tytuł centralny */}
              <div className="text-center">
                <h2 className="text-3xl sm:text-4xl font-black text-sky-950 leading-tight uppercase tracking-tighter">{selectedEvent.tytul}</h2>
                <div className="w-16 h-1.5 bg-amber-500 mx-auto mt-5 rounded-full"></div>
              </div>

              {/* Kafelki z kluczowymi informacjami */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col items-center justify-center text-center gap-2 bg-white p-5 rounded-3xl shadow-sm border border-sky-100">
                  <span className="text-3xl">📅</span>
                  <div>
                    <div className="text-[10px] font-bold text-sky-500 uppercase tracking-widest">Termin</div>
                    <div className="font-black text-sky-950 text-sm mt-0.5">{formatTermin(selectedEvent.data_od, selectedEvent.data_do)}</div>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center text-center gap-2 bg-white p-5 rounded-3xl shadow-sm border border-amber-100">
                  <span className="text-3xl">💳</span>
                  <div>
                    <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Koszt udziału</div>
                    <div className="font-black text-amber-950 text-sm mt-0.5">{selectedEvent.cena || "Darmowe"}</div>
                  </div>
                </div>
                
                {selectedEvent.zadatek ? (
                  <div className="flex flex-col items-center justify-center text-center gap-2 bg-white p-5 rounded-3xl shadow-sm border border-orange-100">
                    <span className="text-3xl">💰</span>
                    <div>
                      <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Zadatek</div>
                      <div className="font-black text-orange-950 text-sm mt-0.5">{selectedEvent.zadatek}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center gap-2 bg-white p-5 rounded-3xl shadow-sm border border-emerald-100">
                    <span className="text-3xl">✅</span>
                    <div>
                      <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Rezerwacja</div>
                      <div className="font-black text-emerald-950 text-sm mt-0.5">Brak zadatku</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sekcja opisu ze sformatowanym układem */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="font-black text-sm text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                  <span className="text-xl">📝</span> Szczegóły wydarzenia
                </h3>
                <div className="text-slate-700 text-base leading-loose whitespace-pre-wrap font-medium">
                  {selectedEvent.opis || "Organizator nie podał jeszcze szczegółowego opisu tego wydarzenia."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADMINA: DODAJ/EDYTUJ */}
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

              {/* SEKACJA WYBORU STATUSU WYDARZENIA */}
              <div className="space-y-2 pt-2 pb-2">
                <label className="font-bold text-slate-700 text-xs block uppercase">Gdzie wyświetlić wydarzenie?</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 cursor-pointer transition-all ${form.status === 'wkrotce' ? 'border-sky-500 bg-sky-50 text-sky-900' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <input type="radio" name="status" value="wkrotce" checked={form.status === 'wkrotce'} onChange={() => setForm({...form, status: 'wkrotce'})} className="hidden" />
                    <span className="font-black text-sm">⏳ Wkrótce</span>
                  </label>
                  <label className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 cursor-pointer transition-all ${form.status === 'planowane' ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <input type="radio" name="status" value="planowane" checked={form.status === 'planowane'} onChange={() => setForm({...form, status: 'planowane'})} className="hidden" />
                    <span className="font-black text-sm">📅 Planowane</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase">Tytuł wydarzenia</label>
                <input 
                  type="text" required value={form.tytul} onChange={(e) => setForm({...form, tytul: e.target.value})}
                  placeholder="np. Obóz sportowy WAŁCZ"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">Data od (Rozpoczęcie)</label>
                  <input 
                    type="date" required value={form.data_od} onChange={(e) => setForm({...form, data_od: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">Data do (Zakończenie)</label>
                  <input 
                    type="date" required value={form.data_do} onChange={(e) => setForm({...form, data_do: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">Cena wydarzenia</label>
                  <input 
                    type="text" value={form.cena} onChange={(e) => setForm({...form, cena: e.target.value})}
                    placeholder="np. 1080 PLN"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">Zadatek (opcjonalnie)</label>
                  <input 
                    type="text" value={form.zadatek} onChange={(e) => setForm({...form, zadatek: e.target.value})}
                    placeholder="np. 300 PLN"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase">Opis szczegółowy / Link</label>
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
