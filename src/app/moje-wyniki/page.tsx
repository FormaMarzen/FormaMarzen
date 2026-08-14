"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../raporty/klienci/supabase";

// --- INTERFEJSY ---
interface CwiczenieDefinicja {
  id: number;
  nazwa: string;
  kategoria: string;
  jednostka: string;
  typ: "waga" | "czas" | "ilosc";
}

interface WynikUzytkownika {
  id?: number;
  email_klienta: string;
  cwiczenie_id: number;
  najlepszy_wynik: string;
  data_rekordu: string;
}

interface KlientInfo {
  "E-mail"?: string;
  "Imię"?: string;
  "Nazwisko"?: string;
  avatarUrl?: string;
  [key: string]: any;
}

export default function MojeWynikiPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // ZAKŁADKI: moje wyniki vs ranking globalny
  const [aktywnaZakladka, setAktywnaZakladka] = useState<"moje" | "rankingi">("moje");

  // Dane z bazy
  const [definicjeCwiczen, setDefinicjeCwiczen] = useState<CwiczenieDefinicja[]>([]);
  const [wszystkieWyniki, setWszystkieWyniki] = useState<WynikUzytkownika[]>([]);
  const [wynikiUzytkownika, setWynikiUzytkownika] = useState<WynikUzytkownika[]>([]);
  const [klienciList, setKlienciList] = useState<KlientInfo[]>([]);
  
  const [aktywnaKategoria, setAktywnaKategoria] = useState<string>("Wszystkie");

  // --- STANY MODALI ---
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [wybraneCwiczenie, setWybraneCwiczenie] = useState<CwiczenieDefinicja | null>(null);
  const [nowyWynikWartosc, setNowyWynikWartosc] = useState<string>("");
  const [nowyWynikData, setNowyWynikData] = useState<string>(new Date().toISOString().split('T')[0]);

  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [editingCwiczenieId, setEditingCwiczenieId] = useState<number | null>(null);
  const [adminForm, setAdminForm] = useState({
    nazwa: "",
    kategoria: "Siła",
    jednostka: "kg",
    typ: "waga" as "waga" | "czas" | "ilosc"
  });

  // --- INICJALIZACJA DANYCH ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    // 1. Sprawdzenie sesji i roli
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email || "";
    setUserEmail(email);
    
    if (email === "maciejklaput@gmail.com") {
      setIsAdmin(true);
    }

    // 2. Pobranie definicji ćwiczeń
    const { data: cwiczeniaData, error: cwiczeniaError } = await supabase
      .from('cwiczenia_slownik')
      .select('*')
      .order('id', { ascending: true });

    if (!cwiczeniaError && cwiczeniaData) {
      setDefinicjeCwiczen(cwiczeniaData);
    }

    // 3. Pobranie listy klientów (do imion, nazwisk i awatarów)
    const { data: klienciData } = await supabase
      .from('klienci')
      .select('*');

    if (klienciData) {
      setKlienciList(klienciData);
    }

    // 4. Pobranie WSZYSTKICH wyników z bazy
    const { data: wynikiData, error: wynikiError } = await supabase
      .from('wyniki_klubowiczow')
      .select('*');

    if (!wynikiError && wynikiData) {
      setWszystkieWyniki(wynikiData);
      if (email) {
        setWynikiUzytkownika(wynikiData.filter(w => w.email_klienta === email));
      }
    }

    setIsLoading(false);
  };

  // Formatowanie nazwy klubowicza oraz pobieranie awatara
  const pobierzDaneKlubowicza = (email: string) => {
    const klient = klienciList.find(k => k['E-mail'] === email);
    let nazwa = email.split('@')[0];
    let avatar = null;

    if (klient) {
      const imie = klient['Imię'] || '';
      const nazwisko = klient['Nazwisko'] ? ` ${klient['Nazwisko'].charAt(0)}.` : '';
      if (imie) nazwa = `${imie}${nazwisko}`;
      if (klient.avatarUrl) avatar = klient.avatarUrl;
    }

    return { nazwa, avatar };
  };

  const dostepneKategorie = Array.from(new Set(definicjeCwiczen.map(c => c.kategoria)));
  const wygenerowaneKategorie = ["Wszystkie", ...dostepneKategorie];

  const widoczneWyniki = aktywnaKategoria === "Wszystkie" 
    ? definicjeCwiczen 
    : definicjeCwiczen.filter((w) => w.kategoria === aktywnaKategoria);

  // --- OBSŁUGA KLUBOWICZA ---
  const handleOpenModal = (cwiczenie: CwiczenieDefinicja) => {
    setWybraneCwiczenie(cwiczenie);
    const aktualnyWynik = wynikiUzytkownika.find(w => w.cwiczenie_id === cwiczenie.id);
    
    setNowyWynikWartosc(aktualnyWynik ? aktualnyWynik.najlepszy_wynik : "");
    setNowyWynikData(aktualnyWynik ? aktualnyWynik.data_rekordu : new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleSaveZapis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wybraneCwiczenie || !nowyWynikWartosc || !userEmail) return;

    const istniejacyWynik = wynikiUzytkownika.find(w => w.cwiczenie_id === wybraneCwiczenie.id);

    const payload = {
      email_klienta: userEmail,
      cwiczenie_id: wybraneCwiczenie.id,
      najlepszy_wynik: nowyWynikWartosc,
      data_rekordu: nowyWynikData
    };

    if (istniejacyWynik) {
      await supabase
        .from('wyniki_klubowiczow')
        .update(payload)
        .eq('id', istniejacyWynik.id);
    } else {
      await supabase
        .from('wyniki_klubowiczow')
        .insert([payload]);
    }

    await fetchData(); 
    setIsModalOpen(false);
    alert("Wynik został pomyślnie zaktualizowany!");
  };

  // --- OBSŁUGA ADMINA ---
  const handleOpenAdminAddModal = () => {
    setEditingCwiczenieId(null);
    setAdminForm({ nazwa: "", kategoria: "Siła", jednostka: "kg", typ: "waga" });
    setIsAdminModalOpen(true);
  };

  const handleOpenAdminEditModal = (cwiczenie: CwiczenieDefinicja) => {
    setEditingCwiczenieId(cwiczenie.id);
    setAdminForm({
      nazwa: cwiczenie.nazwa,
      kategoria: cwiczenie.kategoria,
      jednostka: cwiczenie.jednostka,
      typ: cwiczenie.typ
    });
    setIsAdminModalOpen(true);
  };

  const handleAdminSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingCwiczenieId) {
      const { error } = await supabase
        .from('cwiczenia_slownik')
        .update({
          nazwa: adminForm.nazwa,
          kategoria: adminForm.kategoria,
          jednostka: adminForm.jednostka,
          typ: adminForm.typ
        })
        .eq('id', editingCwiczenieId);

      if (error) {
        alert("Błąd podczas edycji ćwiczenia: " + error.message);
        return;
      }
      alert("Kafelek został pomyślnie zaktualizowany!");
    } else {
      const { error } = await supabase
        .from('cwiczenia_slownik')
        .insert([{
          nazwa: adminForm.nazwa,
          kategoria: adminForm.kategoria,
          jednostka: adminForm.jednostka,
          typ: adminForm.typ
        }]);

      if (error) {
        alert("Błąd podczas dodawania ćwiczenia: " + error.message);
        return;
      }
      alert("Nowy kafelek ćwiczenia został dodany do bazy!");
    }

    setIsAdminModalOpen(false);
    await fetchData();
  };

  const handleDeleteCwiczenie = async (id: number) => {
    const isConfirmed = window.confirm("Czy na pewno chcesz usunąć ten kafelek z ćwiczeniem? Ta operacja usunie go wszystkim klubowiczom.");
    
    if (isConfirmed) {
      const { error } = await supabase
        .from('cwiczenia_slownik')
        .delete()
        .eq('id', id);

      if (error) {
        alert("Błąd podczas usuwania: " + error.message);
      } else {
        alert("Ćwiczenie zostało usunięte z bazy!");
        await fetchData(); 
      }
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64 text-sky-900 font-bold">Ładowanie wyników...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* NAGŁÓWEK Z ZAKŁADKAMI */}
      <div className="flex flex-col gap-6 border-b border-sky-200 pb-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-sky-950 uppercase tracking-tight flex items-center gap-3">
              <span className="p-2 bg-amber-500 rounded-xl shadow-sm text-slate-900">
                {aktywnaZakladka === "moje" ? "🏆" : "🌍"}
              </span>
              Tablica Wyników
            </h1>
            <p className="text-slate-500 text-sm mt-2 font-medium max-w-2xl">
              Śledź swój progres, aktualizuj rekordy życiowe (PR) lub sprawdzaj globalne rankingi klubu.
            </p>
          </div>
          
          {/* PANEL ADMINA */}
          {isAdmin && (
            <button 
              onClick={handleOpenAdminAddModal}
              className="bg-sky-900 hover:bg-sky-950 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
            >
              <span>+</span> DODAJ ĆWICZENIE
            </button>
          )}
        </div>

        {/* PRZEŁĄCZNIK ZAKŁADEK */}
        <div className="flex p-1.5 bg-sky-100/50 rounded-2xl w-fit">
          <button
            onClick={() => setAktywnaZakladka("moje")}
            className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 ${
              aktywnaZakladka === "moje" 
                ? "bg-white text-sky-950 shadow-sm" 
                : "text-sky-600/70 hover:text-sky-900"
            }`}
          >
            Moje Wyniki
          </button>
          <button
            onClick={() => setAktywnaZakladka("rankingi")}
            className={`px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
              aktywnaZakladka === "rankingi" 
                ? "bg-white text-sky-950 shadow-sm" 
                : "text-sky-600/70 hover:text-sky-900"
            }`}
          >
            Ranking Globalny
          </button>
        </div>
      </div>

      {/* FILTRY KATEGORII */}
      <div className="flex flex-wrap gap-2">
        {wygenerowaneKategorie.map((kat) => (
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

      {/* WIDOK: MOJE WYNIKI */}
      {aktywnaZakladka === "moje" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {widoczneWyniki.map((cwiczenie) => {
            const mojWynik = wynikiUzytkownika.find(w => w.cwiczenie_id === cwiczenie.id);
            
            return (
              <div 
                key={cwiczenie.id} 
                className="relative bg-white rounded-3xl p-6 border border-sky-100 shadow-sm hover:shadow-md hover:border-sky-300 transition-all duration-300 flex flex-col justify-between"
              >
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-1.5 z-10 bg-white/80 p-1 rounded-xl backdrop-blur-sm">
                    <button 
                      onClick={(e) => { e.preventDefault(); handleOpenAdminEditModal(cwiczenie); }}
                      className="w-9 h-9 flex items-center justify-center bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition-colors shadow-sm border border-sky-200 cursor-pointer"
                      title="Edytuj kafelek"
                    >✏️</button>
                    <button 
                      onClick={(e) => { e.preventDefault(); handleDeleteCwiczenie(cwiczenie.id); }}
                      className="w-9 h-9 flex items-center justify-center bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors shadow-sm border border-rose-200 cursor-pointer"
                      title="Usuń kafelek"
                    >🗑️</button>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg">
                      {cwiczenie.kategoria}
                    </span>
                  </div>
                  
                  <h3 className="font-black text-lg text-sky-950 leading-tight mb-6 pr-20">
                    {cwiczenie.nazwa}
                  </h3>

                  <div className="space-y-1 mb-6">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aktualny Rekord (PR)</div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-4xl font-black tracking-tighter ${mojWynik ? 'text-slate-800' : 'text-slate-300'}`}>
                        {mojWynik ? mojWynik.najlepszy_wynik : "--"}
                      </span>
                      <span className="text-sm font-bold text-slate-500">
                        {cwiczenie.jednostka}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Ustanowiono: {mojWynik ? mojWynik.data_rekordu : "Brak wpisu"}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handleOpenModal(cwiczenie)}
                  className="w-full py-3 rounded-xl bg-sky-50 text-sky-900 font-bold text-xs uppercase tracking-wider hover:bg-sky-900 hover:text-white transition-colors duration-300 border border-sky-100 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>+</span> Aktualizuj wynik
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* WIDOK: RANKING GLOBALNY */}
      {aktywnaZakladka === "rankingi" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {widoczneWyniki.map((cwiczenie) => {
            const wynikiDlaCwiczenia = wszystkieWyniki.filter(w => w.cwiczenie_id === cwiczenie.id);
            
            if (wynikiDlaCwiczenia.length === 0) {
              return (
                <div key={cwiczenie.id} className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm flex flex-col opacity-60 grayscale hover:grayscale-0 transition-all duration-300">
                  <span className="text-[10px] w-fit font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg mb-4">
                    {cwiczenie.kategoria}
                  </span>
                  <h3 className="font-black text-xl text-sky-950 leading-tight mb-2">{cwiczenie.nazwa}</h3>
                  <div className="py-6 text-center text-slate-400 text-sm font-bold flex flex-col items-center gap-2">
                    <span className="text-3xl">🤫</span>
                    Jeszcze nikt nie dodał wyniku. Bądź pierwszy!
                  </div>
                </div>
              );
            }

            const posortowane = [...wynikiDlaCwiczenia].sort((a, b) => {
              if (cwiczenie.typ === 'czas') {
                return a.najlepszy_wynik.localeCompare(b.najlepszy_wynik);
              } else {
                const valA = parseFloat(a.najlepszy_wynik) || 0;
                const valB = parseFloat(b.najlepszy_wynik) || 0;
                return valB - valA;
              }
            });

            return (
              <div key={cwiczenie.id} className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg">
                    {cwiczenie.kategoria}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    Osoby: {posortowane.length}
                  </span>
                </div>
                
                <h3 className="font-black text-xl text-sky-950 leading-tight mb-6">{cwiczenie.nazwa}</h3>

                <div className="space-y-3 flex-grow">
                  {posortowane.map((wynik, index) => {
                    const isTop1 = index === 0;
                    const isTop2 = index === 1;
                    const isTop3 = index === 2;
                    const isPodium = isTop1 || isTop2 || isTop3;
                    const isMoje = wynik.email_klienta === userEmail;
                    
                    const { nazwa: nazwaUzytkownika, avatar } = pobierzDaneKlubowicza(wynik.email_klienta);

                    // Dynamiczne style dla poszczególnych miejsc
                    let wrapperClasses = "flex items-center justify-between p-3 rounded-xl transition-all duration-300 ";
                    let textClasses = "font-bold text-sm truncate max-w-[120px] sm:max-w-[180px] ";
                    let valueClasses = "font-black text-lg tracking-tighter ";

                    if (isTop1) {
                      wrapperClasses += "bg-gradient-to-r from-yellow-100 to-yellow-50 border border-yellow-400 shadow-md transform scale-[1.03] my-3";
                      textClasses += "text-yellow-900 text-base";
                      valueClasses += "text-yellow-700 text-xl";
                    } else if (isTop2) {
                      wrapperClasses += "bg-gradient-to-r from-slate-200 to-slate-100 border border-slate-300 shadow-sm transform scale-[1.01] my-2";
                      textClasses += "text-slate-800 text-base";
                      valueClasses += "text-slate-700 text-xl";
                    } else if (isTop3) {
                      wrapperClasses += "bg-gradient-to-r from-orange-100 to-amber-50 border border-orange-300 shadow-sm my-2";
                      textClasses += "text-orange-900 text-base";
                      valueClasses += "text-orange-700 text-xl";
                    } else {
                      wrapperClasses += isMoje ? "bg-sky-50 border border-sky-200 shadow-sm" : "bg-slate-50 border border-slate-100";
                      textClasses += isMoje ? "text-sky-900" : "text-slate-700";
                      valueClasses += isMoje ? "text-sky-700" : "text-sky-950";
                    }

                    // Ikonki miejsc
                    let Pozycja = <span className="w-6 inline-block text-center text-slate-400 text-sm font-bold">{index + 1}.</span>;
                    if (isTop1) Pozycja = <span className="text-3xl drop-shadow-sm">🥇</span>;
                    if (isTop2) Pozycja = <span className="text-3xl drop-shadow-sm">🥈</span>;
                    if (isTop3) Pozycja = <span className="text-3xl drop-shadow-sm">🥉</span>;

                    return (
                      <div key={wynik.id} className={wrapperClasses}>
                        <div className="flex items-center gap-4">
                          <div className="w-8 flex justify-center shrink-0">{Pozycja}</div>
                          
                          {/* Wyświetlanie zdjęcia profilowego tylko dla top 3 */}
                          {isPodium && (
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 shadow-sm shrink-0" style={{ borderColor: isTop1 ? '#fbbf24' : isTop2 ? '#cbd5e1' : '#fdba74' }}>
                              {avatar ? (
                                <img src={avatar} alt={nazwaUzytkownika} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-slate-400 font-bold text-xs uppercase">
                                  {nazwaUzytkownika.substring(0, 2)}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex flex-col">
                            <span className={textClasses}>
                              {nazwaUzytkownika} {isMoje && "(Ty)"}
                            </span>
                            <span className="text-[10px] text-slate-400">{wynik.data_rekordu}</span>
                          </div>
                        </div>
                        <div className="flex items-baseline gap-1.5 pl-2 shrink-0">
                          <span className={valueClasses}>
                            {wynik.najlepszy_wynik}
                          </span>
                          <span className="text-xs font-bold text-slate-500">{cwiczenie.jednostka}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PUSTE STANY */}
      {widoczneWyniki.length === 0 && definicjeCwiczen.length > 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-sky-100 border-dashed animate-in fade-in duration-500">
          <div className="text-4xl mb-3">🤷‍♂️</div>
          <h3 className="text-lg font-black text-sky-950 mb-1">Brak ćwiczeń w tej kategorii</h3>
          <p className="text-slate-500 text-sm">Wybierz inną kategorię z menu powyżej.</p>
        </div>
      )}

      {definicjeCwiczen.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-sky-100 border-dashed animate-in fade-in duration-500">
          <div className="text-4xl mb-3">🏋️‍♂️</div>
          <h3 className="text-lg font-black text-sky-950 mb-1">Baza ćwiczeń jest pusta</h3>
          <p className="text-slate-500 text-sm">Zaloguj się jako administrator, aby dodać pierwsze kafelki ćwiczeń.</p>
        </div>
      )}

      {/* MODAL KLUBOWICZA: AKTUALIZACJA WYNIKU */}
      {isModalOpen && wybraneCwiczenie && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsModalOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-2 cursor-pointer"
            >✕</button>
            <div className="mb-6 pr-8">
              <h3 className="font-black text-xl text-sky-950 leading-tight">Nowy Rekord</h3>
              <p className="text-sm font-bold text-amber-600 mt-1">{wybraneCwiczenie.nazwa}</p>
            </div>
            <form onSubmit={handleSaveZapis} className="space-y-5">
              <div className="space-y-2">
                <label className="font-bold text-slate-700 text-xs uppercase tracking-wider block">Twój nowy wynik</label>
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
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">{wybraneCwiczenie.jednostka}</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="font-bold text-slate-700 text-xs uppercase tracking-wider block">Data uzyskania wyniku</label>
                <input 
                  type="date" 
                  required
                  value={nowyWynikData}
                  onChange={(e) => setNowyWynikData(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 transition-all"
                />
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-4 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  Zapisz wynik
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ADMINA: DODAWANIE / EDYCJA KAFELKA */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 border-2 border-sky-900">
            <button 
              onClick={() => setIsAdminModalOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-2 cursor-pointer"
            >✕</button>
            <div className="mb-6 pr-8">
              <h3 className="font-black text-xl text-sky-950 leading-tight">
                {editingCwiczenieId ? "Edytuj Kafelek" : "Dodaj Kafelek"}
              </h3>
              <p className="text-sm font-bold text-slate-500 mt-1">
                {editingCwiczenieId ? "Zmień dane tego ćwiczenia dla całego klubu" : "Kreator nowego ćwiczenia w bazie"}
              </p>
            </div>
            <form onSubmit={handleAdminSave} className="space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block">Nazwa ćwiczenia</label>
                <input 
                  type="text" required value={adminForm.nazwa}
                  onChange={(e) => setAdminForm({...adminForm, nazwa: e.target.value})}
                  placeholder="np. Wyciskanie leżąc"
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block">Kategoria</label>
                <input 
                  type="text" required list="kategorie-list" value={adminForm.kategoria}
                  onChange={(e) => setAdminForm({...adminForm, kategoria: e.target.value})}
                  placeholder="np. Siła, Kondycja, Cross"
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                />
                <datalist id="kategorie-list">
                  {dostepneKategorie.map((kat) => (
                    <option key={kat} value={kat} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block">Jednostka</label>
                  <input 
                    type="text" required value={adminForm.jednostka}
                    onChange={(e) => setAdminForm({...adminForm, jednostka: e.target.value})}
                    placeholder="np. kg, min"
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block">Typ wprowadzania</label>
                  <select 
                    value={adminForm.typ}
                    onChange={(e) => setAdminForm({...adminForm, typ: e.target.value as any})}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                  >
                    <option value="waga">Waga (liczby)</option>
                    <option value="czas">Czas (tekst)</option>
                    <option value="ilosc">Ilość (liczby)</option>
                  </select>
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" className="w-full bg-sky-900 hover:bg-sky-950 text-white font-black px-6 py-3.5 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer">
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