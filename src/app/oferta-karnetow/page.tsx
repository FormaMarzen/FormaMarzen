"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../raporty/klienci/supabase";

export interface KarnetKatalog {
  id: number;
  nazwa: string;
  opis: string | null;
  cena: number | string;
  typ_karnetu: 'czas' | 'wejscia' | 'umowa';
  dlugosc: string;
  ilosc_wejsc?: string | null;
  dostep_zajecia: string[] | null;
  grafika_url: string | null;
  wyrozniony: boolean;
  tag_wyroznienia: string | null;
  kolejnosc: number;
  aktywny: boolean;
  utworzono_at?: string;
}

export default function OfertaKarnetowPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [karnety, setKarnety] = useState<KarnetKatalog[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'czas' | 'wejscia' | 'umowa'>('all');

  // Stany dla Modala Podglądu Klubowicza
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedKarnet, setSelectedKarnet] = useState<KarnetKatalog | null>(null);

  // Stany dla Modala Edycji / Dodawania Admina
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    nazwa: "",
    opis: "",
    cena: "199.00",
    typ_karnetu: "czas" as 'czas' | 'wejscia' | 'umowa',
    dlugosc: "30 dni",
    ilosc_wejsc: "Bez limitu",
    dostep_zajecia_text: "Wszystkie zajęcia grupowe, Strefa Siłowa, Open Gym, Sauna",
    grafika_url: "" as string | null,
    wyrozniony: false,
    tag_wyroznienia: "Bestseller",
    kolejnosc: 1,
    aktywny: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email || "";

    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail === "maciejklaput@gmail.com" || cleanEmail === "maciejklaput@icloud.com") {
      setIsAdmin(true);
    }

    const { data, error } = await supabase
      .from('katalog_karnetow')
      .select('*')
      .order('kolejnosc', { ascending: true })
      .order('id', { ascending: true });

    if (!error && data) {
      setKarnety(data as KarnetKatalog[]);
    }

    setIsLoading(false);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      nazwa: "",
      opis: "",
      cena: "199.00",
      typ_karnetu: "czas",
      dlugosc: "30 dni",
      ilosc_wejsc: "Bez limitu",
      dostep_zajecia_text: "Wszystkie zajęcia grupowe, Strefa Siłowa, Open Gym, Sauna",
      grafika_url: null,
      wyrozniony: false,
      tag_wyroznienia: "Polecany",
      kolejnosc: karnety.length + 1,
      aktywny: true,
    });
    setIsAdminModalOpen(true);
  };

  const handleOpenEdit = (k: KarnetKatalog, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(k.id);
    
    const zajeciaString = Array.isArray(k.dostep_zajecia) 
      ? k.dostep_zajecia.join(', ') 
      : (typeof k.dostep_zajecia === 'string' ? k.dostep_zajecia : '');

    setForm({
      nazwa: k.nazwa || "",
      opis: k.opis || "",
      cena: String(k.cena || "0.00"),
      typ_karnetu: k.typ_karnetu || "czas",
      dlugosc: k.dlugosc || "",
      ilosc_wejsc: k.ilosc_wejsc || "",
      dostep_zajecia_text: zajeciaString,
      grafika_url: k.grafika_url,
      wyrozniony: !!k.wyrozniony,
      tag_wyroznienia: k.tag_wyroznienia || "",
      kolejnosc: k.kolejnosc || 1,
      aktywny: k.aktywny !== false,
    });
    setIsAdminModalOpen(true);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Czy na pewno chcesz usunąć ten karnet z oferty? Tej operacji nie można cofnąć.")) return;

    await supabase.from('katalog_karnetow').delete().eq('id', id);
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
          const compressed = canvas.toDataURL('image/jpeg', 0.75);

          setForm((prev) => ({ ...prev, grafika_url: compressed }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveKarnet = async (e: React.FormEvent) => {
    e.preventDefault();

    const zajeciaArray = form.dostep_zajecia_text
      .split(/,|\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const parsedCena = parseFloat(String(form.cena).replace(',', '.')) || 0;

    const payload = {
      nazwa: form.nazwa.trim(),
      opis: form.opis.trim(),
      cena: parsedCena,
      typ_karnetu: form.typ_karnetu,
      dlugosc: form.dlugosc.trim(),
      ilosc_wejsc: form.ilosc_wejsc.trim(),
      dostep_zajecia: zajeciaArray,
      grafika_url: form.grafika_url,
      wyrozniony: form.wyrozniony,
      tag_wyroznienia: form.tag_wyroznienia.trim(),
      kolejnosc: Number(form.kolejnosc) || 1,
      aktywny: form.aktywny,
    };

    if (editingId) {
      await supabase.from('katalog_karnetow').update(payload).eq('id', editingId);
    } else {
      await supabase.from('katalog_karnetow').insert([payload]);
    }
    setIsAdminModalOpen(false);
    fetchData();
  };

  const getTypBadge = (typ: string) => {
    switch (typ) {
      case 'czas':
        return { label: 'Czasowy', color: 'bg-sky-100 text-sky-900 border-sky-200' };
      case 'wejscia':
        return { label: 'Pakiet wejść', color: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
      case 'umowa':
        return { label: 'Umowa cykliczna', color: 'bg-purple-100 text-purple-900 border-purple-200' };
      default:
        return { label: 'Karnet', color: 'bg-slate-100 text-slate-900 border-slate-200' };
    }
  };

  const formatCenaDisplay = (cena: number | string) => {
    const num = typeof cena === 'number' ? cena : parseFloat(String(cena)) || 0;
    return `${num.toFixed(2)} PLN`;
  };

  const widoczneKarnety = karnety.filter((k) => isAdmin || k.aktywny);

  const filteredKarnety = widoczneKarnety.filter((k) => {
    if (selectedFilter === 'all') return true;
    return k.typ_karnetu === selectedFilter;
  });

  const wyroznione = filteredKarnety.filter((k) => k.wyrozniony);
  const standardowe = filteredKarnety.filter((k) => !k.wyrozniony);

  const KarnetCard = ({ k }: { k: KarnetKatalog }) => {
    const badge = getTypBadge(k.typ_karnetu);
    const zajeciaList = Array.isArray(k.dostep_zajecia)
      ? k.dostep_zajecia
      : typeof k.dostep_zajecia === 'string' && k.dostep_zajecia
      ? (k.dostep_zajecia as string).split(',').map((s) => s.trim())
      : [];

    return (
      <div
        onClick={() => {
          setSelectedKarnet(k);
          setIsViewModalOpen(true);
        }}
        className={`relative bg-white rounded-3xl overflow-hidden border flex flex-col justify-between group transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 cursor-pointer ${
          !k.aktywny
            ? 'opacity-60 grayscale hover:grayscale-0 border-slate-200'
            : k.wyrozniony
            ? 'border-amber-400 ring-2 ring-amber-400/20 hover:border-amber-500'
            : 'border-sky-100 hover:border-sky-300'
        }`}
      >
        {/* Przyciski admina */}
        {isAdmin && (
          <div className="absolute top-3 right-3 flex gap-2 z-20 bg-white/95 p-1.5 rounded-xl backdrop-blur-md shadow-md border border-slate-100">
            <button
              onClick={(e) => handleOpenEdit(k, e)}
              className="w-9 h-9 flex items-center justify-center bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition-colors shadow-sm cursor-pointer"
              title="Edytuj karnet"
            >
              ✏️
            </button>
            <button
              onClick={(e) => handleDelete(k.id, e)}
              className="w-9 h-9 flex items-center justify-center bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors shadow-sm cursor-pointer"
              title="Usuń karnet"
            >
              🗑️
            </button>
          </div>
        )}

        {/* Etykieta wyróżnienia */}
        {k.wyrozniony && (
          <div className="absolute top-3 left-3 bg-amber-500 text-slate-950 font-black text-[10px] uppercase px-3 py-1.5 rounded-xl shadow-md z-10 border border-amber-600/30 flex items-center gap-1.5">
            <span>⭐</span>
            <span>{k.tag_wyroznienia || "Bestseller"}</span>
          </div>
        )}

        <div>
          {/* Grafika karnetu */}
          <div className="h-48 w-full bg-slate-900 relative overflow-hidden flex items-center justify-center">
            {k.grafika_url ? (
              <img
                src={k.grafika_url}
                alt={k.nazwa}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-sky-900 via-sky-950 to-slate-950 flex flex-col items-center justify-center text-sky-200">
                <span className="text-5xl mb-2 opacity-80">🎟️</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-sky-300/60">
                  Forma Marzeń
                </span>
              </div>
            )}

            {/* CZYTELNE OZNACZENIA NA GRAFICE */}
            <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2 z-10">
              {/* Ważność / Czas */}
              {k.dlugosc && (
                <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-black text-sky-950 shadow-md flex items-center gap-1.5 border border-white/60">
                  <span className="text-sm">📅</span>
                  <span>{k.dlugosc}</span>
                </div>
              )}

              {/* Ilość wejść */}
              {k.ilosc_wejsc && (
                <div className="bg-amber-400 text-slate-950 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 border border-amber-300">
                  <span className="text-sm">🎟️</span>
                  <span>{k.ilosc_wejsc}</span>
                </div>
              )}
            </div>
          </div>

          {/* Treść kafelka */}
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${badge.color}`}>
                {badge.label}
              </span>
              {!k.aktywny && (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300">
                  Ukryty dla klubowiczów
                </span>
              )}
            </div>

            <h3 className="font-black text-lg text-sky-950 leading-tight">
              {k.nazwa}
            </h3>

            {/* Opis linijka po linijce */}
            <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-medium">
              {k.opis || "Nielimitowany dostęp do stref treningowych w ramach oferty."}
            </div>

            {/* Dostępne strefy / zajęcia */}
            {zajeciaList.length > 0 && (
              <div className="pt-2 border-t border-sky-50 flex flex-wrap gap-1">
                {zajeciaList.map((zajecie, i) => (
                  <span
                    key={i}
                    className="bg-sky-50 text-sky-900 text-[10px] font-bold px-2 py-0.5 rounded-md border border-sky-100"
                  >
                    ✓ {zajecie}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stopka z ceną */}
        <div className="p-5 pt-0">
          <div className="pt-4 border-t border-sky-50 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Cena karnetu
              </span>
              <span className="font-black text-sky-950 text-lg">
                {formatCenaDisplay(k.cena)}
              </span>
            </div>

            <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 text-sky-900 font-bold">
        Ładowanie oferty karnetów...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-12">
      
      {/* NAGŁÓWEK STRONY */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-sky-200 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-sky-950 uppercase tracking-tight flex items-center gap-3">
            <span className="p-2 bg-amber-500 rounded-xl shadow-sm text-slate-900">🎟️</span>
            Karnety
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium max-w-2xl">
            Poznaj naszą aktualną ofertę. Wybierz dogodny karnet czasowy, pakiet elastycznych wejść lub członkostwo klubowe.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* PRZEŁĄCZNIK FILTRÓW */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-sky-200 shadow-sm overflow-x-auto">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                selectedFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-sky-950 hover:bg-sky-50'
              }`}
            >
              Wszystkie ({widoczneKarnety.length})
            </button>
            <button
              onClick={() => setSelectedFilter('czas')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                selectedFilter === 'czas'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-sky-950 hover:bg-sky-50'
              }`}
            >
              Czasowe
            </button>
            <button
              onClick={() => setSelectedFilter('wejscia')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                selectedFilter === 'wejscia'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-sky-950 hover:bg-sky-50'
              }`}
            >
              Wejściówki
            </button>
            <button
              onClick={() => setSelectedFilter('umowa')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                selectedFilter === 'umowa'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-sky-950 hover:bg-sky-50'
              }`}
            >
              Umowy
            </button>
          </div>

          {/* PRZYCISK DLA ADMINA */}
          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="bg-sky-900 hover:bg-sky-950 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
            >
              <span>+</span> DODAJ KARNET
            </button>
          )}
        </div>
      </div>

      {/* BRAK KARNETÓW */}
      {filteredKarnety.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-sky-100 border-dashed">
          <div className="text-5xl mb-4">🎫</div>
          <h3 className="text-lg font-black text-sky-950 mb-1">Brak karnetów w tej kategorii</h3>
          <p className="text-slate-500 text-sm">Skontaktuj się z recepcją klubu lub wybierz inną zakładkę filtrów.</p>
        </div>
      )}

      {/* SEKCJA: WYRÓŻNIONE / NAJPOPULARNIEJSZE */}
      {wyroznione.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-sky-950 uppercase tracking-tight">⭐ Polecane i Bestsellery</h2>
            <div className="h-px bg-amber-300 flex-grow"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wyroznione.map((k) => (
              <KarnetCard key={k.id} k={k} />
            ))}
          </div>
        </div>
      )}

      {/* SEKCJA: POZOSTAŁA OFERTA */}
      {standardowe.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-sky-950 uppercase tracking-tight">📋 POZOSTAŁE KARNETY </h2>
            <div className="h-px bg-sky-200 flex-grow"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {standardowe.map((k) => (
              <KarnetCard key={k.id} k={k} />
            ))}
          </div>
        </div>
      )}

      {/* MODAL PODGLĄDU SZCZEGÓŁÓW KARNETU DLA KLUBOWICZA */}
      {isViewModalOpen && selectedKarnet && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-start justify-center p-2 sm:p-4 md:py-10 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-50 rounded-[2rem] max-w-3xl w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
            {/* Przycisk zamykania */}
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="absolute top-4 right-4 z-20 bg-white hover:bg-slate-100 text-slate-900 w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg cursor-pointer font-black text-lg"
            >
              ✕
            </button>

            {/* Plakat / Baner główny */}
            <div
              className="w-full bg-slate-900 relative flex justify-center items-center overflow-hidden"
              style={{ minHeight: '260px', maxHeight: '55vh' }}
            >
              {selectedKarnet.grafika_url ? (
                <>
                  <div
                    className="absolute inset-0 opacity-40 blur-2xl bg-cover bg-center scale-110"
                    style={{ backgroundImage: `url(${selectedKarnet.grafika_url})` }}
                  ></div>
                  <img
                    src={selectedKarnet.grafika_url}
                    alt={selectedKarnet.nazwa}
                    className="relative z-10 w-full h-full object-contain max-h-[55vh] drop-shadow-2xl"
                  />
                </>
              ) : (
                <div className="w-full h-full min-h-[260px] bg-gradient-to-br from-sky-900 via-sky-950 to-slate-900 flex flex-col items-center justify-center text-sky-100 p-8">
                  <span className="text-7xl mb-4 drop-shadow-lg">🎟️</span>
                  <span className="font-black text-xl tracking-widest uppercase opacity-60">
                    Forma Marzeń • Oferta
                  </span>
                </div>
              )}
            </div>

            {/* Treść karnetu */}
            <div className="p-6 sm:p-10 space-y-8">
              {/* Tytuł centralny */}
              <div className="text-center">
                {selectedKarnet.wyrozniony && (
                  <span className="inline-block bg-amber-500 text-slate-950 font-black text-xs uppercase px-4 py-1 rounded-full mb-3 shadow-sm border border-amber-600/30">
                    ⭐ {selectedKarnet.tag_wyroznienia || "Bestseller"}
                  </span>
                )}
                <h2 className="text-3xl sm:text-4xl font-black text-sky-950 leading-tight uppercase tracking-tighter">
                  {selectedKarnet.nazwa}
                </h2>
                <div className="w-16 h-1.5 bg-amber-500 mx-auto mt-4 rounded-full"></div>
              </div>

              {/* Kafelki z kluczowymi informacjami */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col items-center justify-center text-center gap-2 bg-white p-4 rounded-3xl shadow-sm border border-sky-100">
                  <span className="text-2xl">📋</span>
                  <div>
                    <div className="text-[10px] font-bold text-sky-500 uppercase tracking-widest">
                      Typ karnetu
                    </div>
                    <div className="font-black text-sky-950 text-xs sm:text-sm mt-0.5">
                      {getTypBadge(selectedKarnet.typ_karnetu).label}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center text-center gap-2 bg-white p-4 rounded-3xl shadow-sm border border-amber-100">
                  <span className="text-2xl">📅</span>
                  <div>
                    <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                      Ważność
                    </div>
                    <div className="font-black text-amber-950 text-xs sm:text-sm mt-0.5">
                      {selectedKarnet.dlugosc || "Standard"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center text-center gap-2 bg-white p-4 rounded-3xl shadow-sm border border-sky-100">
                  <span className="text-2xl">🎟️</span>
                  <div>
                    <div className="text-[10px] font-bold text-sky-600 uppercase tracking-widest">
                      Ilość wejść
                    </div>
                    <div className="font-black text-sky-950 text-xs sm:text-sm mt-0.5">
                      {selectedKarnet.ilosc_wejsc || "Bez limitu"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center text-center gap-2 bg-white p-4 rounded-3xl shadow-sm border border-emerald-100">
                  <span className="text-2xl">💳</span>
                  <div>
                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                      Cena
                    </div>
                    <div className="font-black text-emerald-950 text-xs sm:text-sm mt-0.5">
                      {formatCenaDisplay(selectedKarnet.cena)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dostęp do zajęć i stref */}
              {selectedKarnet.dostep_zajecia && (Array.isArray(selectedKarnet.dostep_zajecia) ? selectedKarnet.dostep_zajecia.length > 0 : Boolean(selectedKarnet.dostep_zajecia)) && (
                <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-4">
                  <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2.5">
                    <span className="text-xl">🏋️</span> Dostępne zajęcia i strefy
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {(Array.isArray(selectedKarnet.dostep_zajecia) 
                      ? selectedKarnet.dostep_zajecia 
                      : String(selectedKarnet.dostep_zajecia).split(',')
                    ).map((zajecie, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2.5 text-xs font-bold text-slate-800 bg-sky-50/60 p-3 rounded-2xl border border-sky-100"
                      >
                        <span className="text-emerald-500 text-sm font-black">✓</span>
                        <span>{zajecie.trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Opis ze sformatowanym podziałem wierszy */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2.5">
                  <span className="text-xl">📝</span> Szczegółowy opis
                </h3>
                <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-line font-medium">
                  {selectedKarnet.opis ||
                    "Zapraszamy do zakupu w recepcji klubu lub kontaktu z naszym zespołem."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADMINA: DODAJ / EDYTUJ KARNET */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl relative border-2 border-sky-900 my-8">
            <button
              onClick={() => setIsAdminModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="mb-6">
              <h3 className="font-black text-xl text-sky-950 leading-tight">
                {editingId ? "Edytuj karnet w ofercie" : "Kreator nowego karnetu"}
              </h3>
              <p className="text-sm font-medium text-slate-500 mt-1">
                Uzupełnij parametry, które zostaną wyświetlone klubowiczom w kafelkach.
              </p>
            </div>

            <form onSubmit={handleSaveKarnet} className="space-y-4">
              {/* Grafika główna */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 text-xs block uppercase">
                  Grafika karnetu / baner
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 bg-sky-50 border-2 border-dashed border-sky-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-sky-100 transition-colors overflow-hidden relative"
                >
                  {form.grafika_url ? (
                    <>
                      <img
                        src={form.grafika_url}
                        className="w-full h-full object-cover opacity-60"
                        alt="Preview"
                      />
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-sky-900 drop-shadow-md">
                        Kliknij, aby zmienić zdjęcie
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl mb-1">📸</span>
                      <span className="text-xs font-bold text-sky-700">Wybierz zdjęcie z dysku</span>
                    </>
                  )}
                </div>
              </div>

              {/* Wybór typu karnetu */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 text-xs block uppercase">Typ karnetu</label>
                <div className="grid grid-cols-3 gap-2">
                  <label
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                      form.typ_karnetu === 'czas'
                        ? 'border-sky-500 bg-sky-50 text-sky-900'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="typ_karnetu"
                      value="czas"
                      checked={form.typ_karnetu === 'czas'}
                      onChange={() => setForm({ ...form, typ_karnetu: 'czas' })}
                      className="hidden"
                    />
                    <span className="font-black text-xs">⏳ Czasowy</span>
                  </label>

                  <label
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                      form.typ_karnetu === 'wejscia'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="typ_karnetu"
                      value="wejscia"
                      checked={form.typ_karnetu === 'wejscia'}
                      onChange={() => setForm({ ...form, typ_karnetu: 'wejscia' })}
                      className="hidden"
                    />
                    <span className="font-black text-xs">🔢 Wejścia</span>
                  </label>

                  <label
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                      form.typ_karnetu === 'umowa'
                        ? 'border-purple-500 bg-purple-50 text-purple-900'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="typ_karnetu"
                      value="umowa"
                      checked={form.typ_karnetu === 'umowa'}
                      onChange={() => setForm({ ...form, typ_karnetu: 'umowa' })}
                      className="hidden"
                    />
                    <span className="font-black text-xs">📜 Umowa</span>
                  </label>
                </div>
              </div>

              {/* Nazwa karnetu */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase">
                  Nazwa karnetu *
                </label>
                <input
                  type="text"
                  required
                  value={form.nazwa}
                  onChange={(e) => setForm({ ...form, nazwa: e.target.value })}
                  placeholder="np. Karnet Open 1 Miesiąc"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Długość, Ilość Wejść i Cena */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">
                    Długość / Ważność *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.dlugosc}
                    onChange={(e) => setForm({ ...form, dlugosc: e.target.value })}
                    placeholder="np. 30 dni"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">
                    Ilość wejść
                  </label>
                  <input
                    type="text"
                    value={form.ilosc_wejsc}
                    onChange={(e) => setForm({ ...form, ilosc_wejsc: e.target.value })}
                    placeholder="np. 10 wejść / Bez limitu"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">
                    Cena (PLN) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.cena}
                    onChange={(e) => setForm({ ...form, cena: e.target.value })}
                    placeholder="199.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Dostęp do zajęć */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase">
                  Dostęp do zajęć i stref (oddziel przecinkami)
                </label>
                <input
                  type="text"
                  value={form.dostep_zajecia_text}
                  onChange={(e) => setForm({ ...form, dostep_zajecia_text: e.target.value })}
                  placeholder="np. Wszystkie zajęcia grupowe, Open Gym, Sauna"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Ustawienia widoczności, wyróżnienia i kolejności */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-sky-50/60 rounded-2xl border border-sky-100 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="aktywnyCheck"
                    checked={form.aktywny}
                    onChange={(e) => setForm({ ...form, aktywny: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                  />
                  <label htmlFor="aktywnyCheck" className="font-bold text-slate-800 text-xs cursor-pointer">
                    Widoczny
                  </label>
                </div>

                <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="wyroznionyCheck"
                    checked={form.wyrozniony}
                    onChange={(e) => setForm({ ...form, wyrozniony: e.target.checked })}
                    className="w-4 h-4 text-amber-500 rounded cursor-pointer"
                  />
                  <label htmlFor="wyroznionyCheck" className="font-bold text-slate-800 text-xs cursor-pointer">
                    Wyróżniony
                  </label>
                </div>

                <div className="space-y-1">
                  <input
                    type="number"
                    value={form.kolejnosc}
                    onChange={(e) => setForm({ ...form, kolejnosc: parseInt(e.target.value, 10) || 1 })}
                    placeholder="Kolejność (np. 1)"
                    title="Kolejność wyświetlania kafelka"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {form.wyrozniony && (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">
                    Etykieta wyróżnienia (np. Bestseller, Polecany)
                  </label>
                  <input
                    type="text"
                    value={form.tag_wyroznienia}
                    onChange={(e) => setForm({ ...form, tag_wyroznienia: e.target.value })}
                    placeholder="np. Bestseller"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
              )}

              {/* Opis */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase">
                  Opis szczegółowy
                </label>
                <textarea
                  value={form.opis}
                  onChange={(e) => setForm({ ...form, opis: e.target.value })}
                  placeholder="Wpisz opis, np.:
Wejście 1x dziennie.
Zapisy na 21 dni do przodu.
Ważny wyłącznie z aktywną kartą MEDICOVER SPORT."
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              {/* Przyciski modala */}
              <div className="pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3.5 rounded-xl transition-colors cursor-pointer text-sm"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black px-4 py-3.5 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer text-sm"
                >
                  Zapisz karnet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
