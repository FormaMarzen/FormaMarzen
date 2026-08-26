"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../raporty/klienci/supabase";

interface Suplement {
  id: number;
  nazwa: string;
  kategoria: "witaminy" | "wytrzymalosc" | "sila" | string;
  opis: string;
  dawkowanie: string;
  grafika_url: string | null;
  created_at?: string;
}

type TabType = "suplementy" | "kolejna_zakladka";

export default function BazaWiedzyPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("suplementy");

  // Dane suplementów
  const [suplementy, setSuplementy] = useState<Suplement[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKategoria, setSelectedKategoria] = useState<string>("wszystkie");

  // Modal Podglądu (dla Klubowicza / Podgląd detali)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Suplement | null>(null);

  // Modal Zarządzania Admina (Dodaj / Edytuj)
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    nazwa: "",
    kategoria: "witaminy",
    opis: "",
    dawkowanie: "",
    grafika_url: "" as string | null,
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
      .from("suplementy")
      .select("*")
      .order("nazwa", { ascending: true });

    if (!error && data) {
      setSuplementy(data);
    }

    setIsLoading(false);
  };

  // Sortowanie alfabetyczne i filtrowanie
  const filteredSuplementy = useMemo(() => {
    return suplementy
      .filter((item) => {
        const matchesQuery = item.nazwa.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.opis && item.opis.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesKat = selectedKategoria === "wszystkie" || item.kategoria === selectedKategoria;
        return matchesQuery && matchesKat;
      })
      .sort((a, b) => a.nazwa.localeCompare(b.nazwa, "pl"));
  }, [suplementy, searchQuery, selectedKategoria]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      nazwa: "",
      kategoria: "witaminy",
      opis: "",
      dawkowanie: "",
      grafika_url: null,
    });
    setIsAdminModalOpen(true);
  };

  const handleOpenEdit = (item: Suplement, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setForm({
      nazwa: item.nazwa,
      kategoria: item.kategoria || "witaminy",
      opis: item.opis || "",
      dawkowanie: item.dawkowanie || "",
      grafika_url: item.grafika_url || null,
    });
    setIsAdminModalOpen(true);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Czy na pewno chcesz usunąć ten wpis z bazy wiedzy?")) return;

    await supabase.from("suplementy").delete().eq("id", id);
    if (selectedItem?.id === id) {
      setIsViewModalOpen(false);
      setSelectedItem(null);
    }
    fetchData();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.75);

          setForm((prev) => ({ ...prev, grafika_url: compressed }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await supabase.from("suplementy").update(form).eq("id", editingId);
    } else {
      await supabase.from("suplementy").insert([form]);
    }
    setIsAdminModalOpen(false);
    fetchData();
  };

  const getKategoriaBadge = (kategoria: string) => {
    switch (kategoria) {
      case "witaminy":
        return { label: "Witaminy i Minerały", color: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: "🌱" };
      case "wytrzymalosc":
        return { label: "Wytrzymałość / Kondycja", color: "bg-sky-50 text-sky-800 border-sky-200", icon: "⚡" };
      case "sila":
        return { label: "Siła / Masa", color: "bg-amber-50 text-amber-800 border-amber-200", icon: "💥" };
      default:
        return { label: kategoria, color: "bg-slate-50 text-slate-800 border-slate-200", icon: "📌" };
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64 text-sky-900 font-bold">Ładowanie Bazy Wiedzy...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 px-3 sm:px-0">
      
      {/* NAGŁÓWEK GŁÓWNY */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-sky-200 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-sky-950 uppercase tracking-tight flex items-center gap-3">
            <span className="p-2 bg-amber-500 rounded-xl shadow-sm text-slate-900">📚</span>
            Baza Wiedzy
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium max-w-2xl">
            Kompendium wiedzy, suplementacji i wskazówek treningowych dla członków klubu.
          </p>
        </div>

        {isAdmin && activeTab === "suplementy" && (
          <button
            onClick={handleOpenAdd}
            className="bg-sky-900 hover:bg-sky-950 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>+</span> DODAJ WPIS
          </button>
        )}
      </div>

      {/* SYSTEM ZAKŁADEK (TABS) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("suplementy")}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === "suplementy"
              ? "bg-sky-900 text-white shadow-md shadow-sky-900/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>💊</span> Suplementy i Witaminy
        </button>

        {/* Miejsce na kolejne zakładki w przyszłości */}
      </div>

      {/* ZAWARTOŚĆ ZAKŁADKI: SUPLEMENTY I WITAMINY */}
      {activeTab === "suplementy" && (
        <div className="space-y-6">
          
          {/* PASEK WYSZUKIWANIA I FILTRY KATEGORII */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-sky-100 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              
              {/* Wyszukiwarka */}
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Szukaj witaminy lub suplementu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <span className="absolute left-3.5 top-2.5 text-slate-400">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filtry po kategorii */}
              <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
                <span className="text-[11px] font-black uppercase text-slate-400 mr-1 hidden sm:inline">Kategoria:</span>
                {[
                  { id: "wszystkie", label: "Wszystkie" },
                  { id: "witaminy", label: "🌱 Witaminy" },
                  { id: "wytrzymalosc", label: "⚡ Wytrzymałość" },
                  { id: "sila", label: "💥 Siła" },
                ].map((kat) => (
                  <button
                    key={kat.id}
                    onClick={() => setSelectedKategoria(kat.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedKategoria === kat.id
                        ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {kat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* LISTA / TABELA ALFABETYCZNA */}
          {filteredSuplementy.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-sky-100 border-dashed">
              <div className="text-5xl mb-4">🧪</div>
              <h3 className="text-lg font-black text-sky-950 mb-1">Brak wyników</h3>
              <p className="text-slate-500 text-sm">Nie znaleziono pozycji spełniających podane kryteria.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-sky-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-sky-50/60 border-b border-sky-100 text-[11px] font-black uppercase tracking-wider text-sky-900">
                      <th className="py-4 px-6">Nazwa i Działanie</th>
                      <th className="py-4 px-6 hidden sm:table-cell">Kategoria</th>
                      <th className="py-4 px-6 hidden md:table-cell">Dawkowanie / Wskazówki</th>
                      <th className="py-4 px-6 text-right">Akcja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredSuplementy.map((item) => {
                      const badge = getKategoriaBadge(item.kategoria);
                      return (
                        <tr
                          key={item.id}
                          onClick={() => {
                            setSelectedItem(item);
                            setIsViewModalOpen(true);
                          }}
                          className="hover:bg-sky-50/40 transition-colors cursor-pointer group"
                        >
                          {/* Nazwa i miniatura */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                                {item.grafika_url ? (
                                  <img src={item.grafika_url} alt={item.nazwa} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xl opacity-60">💊</span>
                                )}
                              </div>
                              <div>
                                <div className="font-black text-sky-950 text-base group-hover:text-sky-700 transition-colors">
                                  {item.nazwa}
                                </div>
                                <div className="text-xs text-slate-500 line-clamp-1 max-w-md font-medium mt-0.5">
                                  {item.opis || "Kliknij, aby przeczytać szczegóły..."}
                                </div>
                                <div className="sm:hidden mt-2">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-lg border ${badge.color}`}>
                                    <span>{badge.icon}</span> {badge.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Kategoria */}
                          <td className="py-4 px-6 hidden sm:table-cell">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-xl border ${badge.color}`}>
                              <span>{badge.icon}</span> {badge.label}
                            </span>
                          </td>

                          {/* Dawkowanie */}
                          <td className="py-4 px-6 hidden md:table-cell">
                            <span className="text-xs font-medium text-slate-600 line-clamp-2 max-w-xs">
                              {item.dawkowanie || "—"}
                            </span>
                          </td>

                          {/* Akcje / Przyciski */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isAdmin && (
                                <>
                                  <button
                                    onClick={(e) => handleOpenEdit(item, e)}
                                    className="w-8 h-8 flex items-center justify-center bg-sky-100 text-sky-800 rounded-lg hover:bg-sky-200 transition-colors cursor-pointer text-xs"
                                    title="Edytuj"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={(e) => handleDelete(item.id, e)}
                                    className="w-8 h-8 flex items-center justify-center bg-rose-100 text-rose-800 rounded-lg hover:bg-rose-200 transition-colors cursor-pointer text-xs"
                                    title="Usuń"
                                  >
                                    🗑️
                                  </button>
                                </>
                              )}
                              <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-700 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL PODGLĄDU DLA KLUBOWICZA / UŻYTKOWNIKA */}
      {isViewModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-start justify-center p-2 sm:p-4 md:py-10 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-50 rounded-[2rem] max-w-3xl w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
            
            {/* Przycisk zamykania */}
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="absolute top-4 right-4 z-20 bg-white hover:bg-slate-100 text-slate-900 w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg cursor-pointer font-black text-lg"
            >
              ✕
            </button>

            {/* Nagłówek graficzny */}
            <div className="w-full bg-slate-900 relative flex justify-center items-center overflow-hidden" style={{ minHeight: "260px", maxHeight: "50vh" }}>
              {selectedItem.grafika_url ? (
                <>
                  <div
                    className="absolute inset-0 opacity-35 blur-2xl bg-cover bg-center scale-110"
                    style={{ backgroundImage: `url(${selectedItem.grafika_url})` }}
                  ></div>
                  <img
                    src={selectedItem.grafika_url}
                    alt={selectedItem.nazwa}
                    className="relative z-10 w-full h-full object-contain max-h-[50vh] drop-shadow-2xl"
                  />
                </>
              ) : (
                <div className="w-full h-full min-h-[260px] bg-gradient-to-br from-sky-900 to-slate-800 flex flex-col items-center justify-center text-sky-100">
                  <span className="text-7xl mb-3 drop-shadow-lg">💊</span>
                  <span className="font-black text-lg tracking-widest uppercase opacity-40">Baza Wiedzy</span>
                </div>
              )}
            </div>

            {/* Treść */}
            <div className="p-6 sm:p-10 space-y-6">
              <div className="text-center">
                {(() => {
                  const badge = getKategoriaBadge(selectedItem.kategoria);
                  return (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-black px-4 py-1.5 rounded-full border mb-3 ${badge.color}`}>
                      <span>{badge.icon}</span> {badge.label}
                    </span>
                  );
                })()}
                <h2 className="text-2xl sm:text-4xl font-black text-sky-950 leading-tight uppercase tracking-tight">
                  {selectedItem.nazwa}
                </h2>
                <div className="w-16 h-1.5 bg-amber-500 mx-auto mt-4 rounded-full"></div>
              </div>

              {/* Sekcja Dawkowania */}
              {selectedItem.dawkowanie && (
                <div className="bg-amber-500/10 border border-amber-300/40 rounded-2xl p-5 flex items-start gap-4">
                  <span className="text-2xl">⏰</span>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">Sposób przyjmowania / Dawkowanie</h4>
                    <p className="text-sm font-bold text-slate-800 mt-1 whitespace-pre-wrap">{selectedItem.dawkowanie}</p>
                  </div>
                </div>
              )}

              {/* Opis / Właściwości */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span>📝</span> Działanie i właściwości
                </h3>
                <div className="text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedItem.opis || "Brak szczegółowego opisu dla tej pozycji."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADMINA: DODAJ / EDYTUJ WPIS */}
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
                {editingId ? "Edytuj wpis" : "Nowy suplement / witamina"}
              </h3>
              <p className="text-sm font-medium text-slate-500 mt-1">Uzupełnij informacje dla klubowiczów.</p>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              
              {/* Zdjęcie */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 text-xs block uppercase">Zdjęcie / Grafika</label>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 bg-sky-50 border-2 border-dashed border-sky-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-sky-100 transition-colors overflow-hidden relative"
                >
                  {form.grafika_url ? (
                    <>
                      <img src={form.grafika_url} className="w-full h-full object-cover opacity-60" alt="Preview" />
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

              {/* Kategoria */}
              <div className="space-y-2 pt-1 pb-1">
                <label className="font-bold text-slate-700 text-xs block uppercase">Kategoria</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "witaminy", label: "🌱 Witaminy" },
                    { id: "wytrzymalosc", label: "⚡ Wytrzymałość" },
                    { id: "sila", label: "💥 Siła" },
                  ].map((kat) => (
                    <label
                      key={kat.id}
                      className={`flex items-center justify-center text-center py-2.5 px-2 rounded-xl border-2 cursor-pointer transition-all ${
                        form.kategoria === kat.id
                          ? "border-amber-500 bg-amber-50 text-amber-950 font-black"
                          : "border-slate-200 bg-slate-50 text-slate-600 font-bold"
                      }`}
                    >
                      <input
                        type="radio"
                        name="kategoria"
                        value={kat.id}
                        checked={form.kategoria === kat.id}
                        onChange={() => setForm({ ...form, kategoria: kat.id })}
                        className="hidden"
                      />
                      <span className="text-xs">{kat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Nazwa */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase">Nazwa suplementu / witaminy</label>
                <input
                  type="text"
                  required
                  value={form.nazwa}
                  onChange={(e) => setForm({ ...form, nazwa: e.target.value })}
                  placeholder="np. Kreatyna Monohydrat, Ashwagandha KSM-66..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Dawkowanie */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase">Zalecane dawkowanie / pory dnia</label>
                <input
                  type="text"
                  value={form.dawkowanie}
                  onChange={(e) => setForm({ ...form, dawkowanie: e.target.value })}
                  placeholder="np. 5g rano na czczo lub po treningu z węglowodanami"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Opis */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase">Opis / Działanie / Korzyści</label>
                <textarea
                  required
                  value={form.opis}
                  onChange={(e) => setForm({ ...form, opis: e.target.value })}
                  placeholder="Wpisz pełny opis działania, badania, korzyści dla organizmu..."
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              {/* Przyciski zapisu */}
              <div className="pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer text-sm"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black px-4 py-3 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer text-sm"
                >
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
