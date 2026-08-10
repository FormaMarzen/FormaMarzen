"use client";

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../raporty/klienci/supabase';

export default function KarnetyPage() {
  const [karnety, setKarnety] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [dostepneRodzajeZajec, setDostepneRodzajeZajec] = useState<any[]>([]);

  // 1. POBIERANIE DANYCH Z SUPABASE (Karnety + Rodzaje Zajęć)
  const loadData = async () => {
    try {
      // A. Pobieranie karnetów
      const { data: karnetyData, error: karnetyError } = await supabase
        .from('karnety')
        .select('*')
        .order('id', { ascending: false });

      if (karnetyError) {
        console.error("Błąd pobierania karnetów:", karnetyError);
      } else if (karnetyData) {
        const parsedData = karnetyData.map((item: any) => {
          let meta = {};
          try {
            meta = JSON.parse(item.inne_ustawienia || '{}');
          } catch (e) {
            console.log("Brak dodatkowych ustawień dla:", item.nazwa);
          }

          return {
            id: item.id,
            utworzony: item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            nazwa: item.nazwa,
            cena: item.cena_brutto ? item.cena_brutto.toString() : '0',
            typKarnetu: item.typ_karnetu,
            limitCzasowy: item.dlugosc,
            dostepDo: item.dostep_do_zajec,
            dostepnyOnline: item.sprzedaz_online,
            wUzyciu: item.wUzyciu || 0,
            ...meta 
          };
        });
        setKarnety(parsedData);
      }

      // B. Pobieranie rodzajów zajęć z bazy (zamiast localStorage)
      const { data: rodzajeData, error: rodzajeError } = await supabase
        .from('rodzaje_zajec')
        .select('*')
        .order('nazwa', { ascending: true });

      if (rodzajeError) {
        console.error("Błąd pobierania rodzajów zajęć:", rodzajeError);
      } else if (rodzajeData && rodzajeData.length > 0) {
        setDostepneRodzajeZajec(rodzajeData);
      } else {
        // Zabezpieczenie na wypadek pustej bazy
        setDostepneRodzajeZajec([
          { id: 1, nazwa: 'Brak zajęć w bazie (Dodaj w zakładce Rodzaje zajęć)' }
        ]);
      }

    } catch (err) {
      console.error("Błąd sieci podczas pobierania:", err);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    loadData();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Stany formularza
  const [nazwa, setNazwa] = useState('');
  const [cena, setCena] = useState('');
  const [stawkaVat, setStawkaVat] = useState('8%');
  const [typKarnetu, setTypKarnetu] = useState('Na czas');
  const [czasIlosc, setCzasIlosc] = useState('1');
  const [czasJednostka, setCzasJednostka] = useState('Miesiąc');
  const [iloscTreningow, setIloscTreningow] = useState('10');
  const [dodajLimitCzasowy, setDodajLimitCzasowy] = useState(true);
  const [limitIlosc, setLimitIlosc] = useState('1');
  const [limitOkres, setLimitOkres] = useState('Miesiąc');
  const [dostepDo, setDostepDo] = useState('wszystkich zajęć');
  const [zaznaczoneZajecia, setZaznaczoneZajecia] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [limitCzasowyZapisow, setLimitCzasowyZapisow] = useState('Domyślny (14 dni)');
  const [niestandardowyDni, setNiestandardowyDni] = useState('14');
  const [tygodniowyLimit, setTygodniowyLimit] = useState('Bez limitu');
  const [dziennyLimit, setDziennyLimit] = useState('Domyślny (Bez limitu)');
  const [niestandardowyDziennyIlosc, setNiestandardowyDziennyIlosc] = useState('1');
  const [blokujPortfel, setBlokujPortfel] = useState(false);
  const [portfelPrógKwota, setPortfelPrógKwota] = useState('0');
  const [dostepnyOnline, setDostepnyOnline] = useState(false);
  const [ponownyZakup, setPonownyZakup] = useState(true);
  const [zmianaNaInny, setZmianaNaInny] = useState(true);
  const [kupInnyKarnet, setKupInnyKarnet] = useState(true);
  const [opis, setOpis] = useState('');
  const [obrazekUrl, setObrazekUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenAdd = () => {
    setEditingId(null);
    setNazwa('');
    setCena('');
    setStawkaVat('8%');
    setTypKarnetu('Na czas');
    setCzasIlosc('1');
    setCzasJednostka('Miesiąc');
    setIloscTreningow('10');
    setDodajLimitCzasowy(true);
    setLimitIlosc('1');
    setLimitOkres('Miesiąc');
    setDostepDo('wszystkich zajęć');
    setZaznaczoneZajecia([]);
    setLimitCzasowyZapisow('Domyślny (14 dni)');
    setNiestandardowyDni('14');
    setTygodniowyLimit('Bez limitu');
    setDziennyLimit('Domyślny (Bez limitu)');
    setNiestandardowyDziennyIlosc('1');
    setBlokujPortfel(false);
    setPortfelPrógKwota('0');
    setDostepnyOnline(false);
    setPonownyZakup(true);
    setZmianaNaInny(true);
    setKupInnyKarnet(true);
    setOpis('');
    setObrazekUrl(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setNazwa(item.nazwa || '');
    setCena(item.cena || '');
    setStawkaVat(item.stawkaVat || '8%');
    setTypKarnetu(item.typKarnetu || 'Na czas');
    setCzasIlosc(item.czasIlosc || '1');
    setCzasJednostka(item.czasJednostka || 'Miesiąc');
    setIloscTreningow(item.iloscTreningow || item.ilosc_wejsc || '10');
    setDodajLimitCzasowy(item.dodajLimitCzasowy ?? true);
    setLimitIlosc(item.limitIlosc || '1');
    setLimitOkres(item.limitOkres || 'Miesiąc');
    setDostepDo(item.dostepDo || 'wszystkich zajęć');
    setZaznaczoneZajecia(item.zaznaczoneZajecia || []);
    setLimitCzasowyZapisow(item.limitCzasowyZapisow || 'Domyślny (14 dni)');
    setNiestandardowyDni(item.niestandardowyDni || '14');
    setTygodniowyLimit(item.tygodniowyLimit || 'Bez limitu');
    setDziennyLimit(item.dziennyLimit || 'Domyślny (Bez limitu)');
    setNiestandardowyDziennyIlosc(item.niestandardowyDziennyIlosc || '1');
    setBlokujPortfel(item.blokujPortfel ?? false);
    setPortfelPrógKwota(item.portfelPrógKwota || '0');
    setDostepnyOnline(item.dostepnyOnline ?? false);
    setPonownyZakup(item.ponownyZakup ?? true);
    setZmianaNaInny(item.zmianaNaInny ?? true);
    setKupInnyKarnet(item.kupInnyKarnet ?? true);
    setOpis(item.opis || '');
    setObrazekUrl(item.obrazekUrl || null);
    setIsModalOpen(true);
  };

  const handleToggleZajecie = (nazwaZajec: string) => {
    if (zaznaczoneZajecia.includes(nazwaZajec)) {
      setZaznaczoneZajecia(zaznaczoneZajecia.filter(z => z !== nazwaZajec));
    } else {
      setZaznaczoneZajecia([...zaznaczoneZajecia, nazwaZajec]);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 250; 
        const MAX_HEIGHT = 250;
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

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
        setObrazekUrl(compressedDataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 2. ZAPISYWANIE DANYCH DO SUPABASE
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nazwa.trim() || !cena.trim()) return;

    let wyliczonaDlugosc = '';
    let dodanaIloscWejsc = null; // Specjalne pole dla inteligentnego systemu banerów

    if (typKarnetu === 'Na czas') {
      wyliczonaDlugosc = `${czasIlosc} ${czasJednostka.toLowerCase()}${parseInt(czasIlosc) > 1 && czasJednostka === 'Miesiąc' ? 'e' : ''}`;
    } else {
      dodanaIloscWejsc = iloscTreningow; // <-- TUTAJ ZAPISUJEMY LIMIT WEJŚĆ
      if (dodajLimitCzasowy) {
        wyliczonaDlugosc = `${iloscTreningow} wejść / ${limitIlosc} ${limitOkres.toLowerCase()}${parseInt(limitIlosc) > 1 && limitOkres === 'Miesiąc' ? 'e' : ''}`;
      } else {
        wyliczonaDlugosc = `${iloscTreningow} wejść (bez limitu czasu)`;
      }
    }

    const metaDane = {
      stawkaVat,
      czasIlosc,
      czasJednostka,
      iloscTreningow,
      ilosc_wejsc: dodanaIloscWejsc, // <-- To pole jest używane przez stronę główną!
      dodajLimitCzasowy,
      limitIlosc,
      limitOkres,
      zaznaczoneZajecia,
      limitCzasowyZapisow,
      niestandardowyDni,
      tygodniowyLimit,
      dziennyLimit,
      niestandardowyDziennyIlosc,
      blokujPortfel,
      portfelPrógKwota,
      ponownyZakup,
      zmianaNaInny,
      kupInnyKarnet,
      opis,
      obrazekUrl, 
      wUzyciu: 0
    };

    const supabasePayload = {
      nazwa: nazwa,
      cena_brutto: parseFloat(cena) || 0,
      typ_karnetu: typKarnetu,
      dlugosc: wyliczonaDlugosc,
      dostep_do_zajec: dostepDo,
      sprzedaz_online: dostepnyOnline,
      inne_ustawienia: JSON.stringify(metaDane)
    };

    try {
      if (editingId !== null) {
        // AKTUALIZACJA KARNETU
        const { error } = await supabase.from('karnety').update(supabasePayload).eq('id', editingId);
        if (error) throw error;
      } else {
        // NOWY KARNET
        const { error } = await supabase.from('karnety').insert([{ 
          ...supabasePayload
        }]);
        if (error) throw error;
      }

      loadData(); 
      setIsModalOpen(false);
      
    } catch (error: any) {
      console.error("Szczegóły błędu bazy danych:", error);
      alert(`Wystąpił błąd podczas zapisu: ${error.message || JSON.stringify(error)}`);
    }
  };

  // 3. USUWANIE DANYCH Z SUPABASE
  const handleDelete = async (id: number) => {
    if (confirm("Czy na pewno chcesz usunąć ten karnet z cennika?")) {
      try {
        const { error } = await supabase.from('karnety').delete().eq('id', id);
        if (error) throw error;
        loadData();
      } catch (error: any) {
        console.error("Błąd podczas usuwania:", error);
        alert(`Nie udało się usunąć: ${error.message || JSON.stringify(error)}`);
      }
    }
  };

  if (!isMounted) {
    return <div className="p-8 text-center text-slate-500 font-bold">Ładowanie karnetów z chmury...</div>;
  }

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24">
      
      {/* GÓRNY PASEK AKCJI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-sky-200 p-5 rounded-2xl shadow-sm">
        <h1 className="text-lg font-black uppercase tracking-wider text-sky-950 flex items-center gap-2">
          KARNETY
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleOpenAdd}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span>+ DODAJ NOWY KARNET</span>
          </button>
          <button className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer">
            ❓ POMOC
          </button>
        </div>
      </div>

      {/* TABELA KARNETÓW */}
      <div className="bg-white border border-sky-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sky-50/70 border-b border-sky-200 text-[11px] font-bold text-sky-900 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-14"></th>
                <th className="py-3.5 px-4">Nazwa</th>
                <th className="py-3.5 px-4">Cena brutto</th>
                <th className="py-3.5 px-4">Typ karnetu</th>
                <th className="py-3.5 px-4">Długość</th>
                <th className="py-3.5 px-4">Dostęp do zajęć</th>
                <th className="py-3.5 px-4">Inne ustawienia</th>
                <th className="py-3.5 px-4">Sprzedaż online</th>
                <th className="py-3.5 px-4 text-center">W użyciu</th>
                <th className="py-3.5 px-4 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100 text-xs">
              {karnety.map((item) => (
                <tr key={item.id} className="hover:bg-sky-50/40 transition-colors">
                  <td className="py-4 px-4 text-center">
                    {item.obrazekUrl ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-sky-200 shadow-sm mx-auto">
                        <img src={item.obrazekUrl} alt={item.nazwa} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 flex items-center justify-center text-lg mx-auto">
                        🎟️
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-bold text-slate-900 text-sm">{item.nazwa}</div>
                    <div className="text-[10px] text-slate-400">Utworzony: {item.utworzony}</div>
                  </td>
                  <td className="py-4 px-4 font-bold text-slate-800">
                    {Number(item.cena).toFixed(2)} PLN
                    <div className="text-[10px] font-normal text-slate-500">VAT: {item.stawkaVat} (B)</div>
                  </td>
                  <td className="py-4 px-4 font-medium text-sky-900">
                    {item.typKarnetu}
                  </td>
                  <td className="py-4 px-4 font-medium text-slate-700">
                    {item.limitCzasowy}
                  </td>
                  <td className="py-4 px-4 text-slate-600 text-[11px]">
                    <div>• Dostęp do zajęć: <strong className="text-slate-900">{item.dostepDo}</strong></div>
                    {item.dostepDo === 'określonych zajęć' && item.zaznaczoneZajecia?.length > 0 && (
                      <div className="text-[10px] text-sky-800 mt-0.5">({item.zaznaczoneZajecia.join(', ')})</div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-slate-600 text-[11px] space-y-0.5">
                    <div>• Dzienny limit: {item.dziennyLimit === 'Niestandardowy' ? `${item.niestandardowyDziennyIlosc} dziennie` : item.dziennyLimit}</div>
                    {item.blokujPortfel && (
                      <div className="text-rose-700 font-bold">• Blokada portfela: &lt; {item.portfelPrógKwota} PLN</div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">• Rejestracja online:</span> 
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.dostepnyOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {item.dostepnyOnline ? 'Tak' : 'Nie'}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center font-bold text-slate-900">{item.wUzyciu || 0}</td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        onClick={() => handleOpenEdit(item)}
                        className="w-7 h-7 bg-amber-800 hover:bg-amber-900 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm cursor-pointer" 
                        title="Edytuj"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="w-7 h-7 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center border border-rose-200 transition-colors cursor-pointer" 
                        title="Usuń"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {karnety.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400 font-medium">
                    Brak zdefiniowanych karnetów. Kliknij „+ DODAJ NOWY KARNET”, aby dodać swój pierwszy karnet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DODAWANIA / EDYCJI KARNETU */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white border border-sky-200 rounded-3xl max-w-3xl w-full p-8 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            
            {/* Nagłówek modalu */}
            <div className="flex items-center justify-between border-b border-sky-100 pb-4 sticky top-0 bg-white z-10">
              <h3 className="font-black text-sm text-sky-950 uppercase">
                {editingId !== null ? 'Edytuj karnet' : 'Dodaj nowy karnet'}
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleSave}
                  className="bg-amber-800 hover:bg-amber-900 text-white font-black px-6 py-2 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                >
                  ZAPISZ
                </button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-base">✕</button>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6 text-xs">
              
              {/* PODSTAWOWE INFORMACJE */}
              <div className="space-y-4">
                <h4 className="font-extrabold text-sky-900 uppercase tracking-wider text-[11px] border-b border-sky-100 pb-1">
                  Podstawowe informacje
                </h4>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Nazwa *</label>
                  <input 
                    type="text"
                    required
                    placeholder="np. OPEN, 10 wejść"
                    value={nazwa}
                    onChange={(e) => setNazwa(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="font-bold text-slate-800 block">Cena brutto *</label>
                    <div className="flex">
                      <span className="bg-slate-100 border border-r-0 border-sky-200 rounded-l-xl px-3 py-2 text-slate-600 font-bold flex items-center">PLN</span>
                      <input 
                        type="number"
                        step="0.01"
                        required
                        placeholder="0.00"
                        value={cena}
                        onChange={(e) => setCena(e.target.value)}
                        className="w-full bg-sky-50/50 border border-sky-200 rounded-r-xl px-3.5 py-2 text-slate-800 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">Stawka VAT</label>
                    <input 
                      type="text"
                      placeholder="np. 8%, 23%, ZW"
                      value={stawkaVat}
                      onChange={(e) => setStawkaVat(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Typ karnetu *</label>
                  <select 
                    value={typKarnetu}
                    onChange={(e) => setTypKarnetu(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500 font-bold cursor-pointer"
                  >
                    <option value="Na czas">Na czas</option>
                    <option value="Na ilość treningów">Na ilość treningów</option>
                  </select>
                </div>

                {typKarnetu === 'Na czas' ? (
                  <div className="grid grid-cols-2 gap-3 bg-sky-50/60 p-4 rounded-2xl border border-sky-200">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-800 block">Ilość *</label>
                      <input 
                        type="number" 
                        min="1"
                        value={czasIlosc}
                        onChange={(e) => setCzasIlosc(e.target.value)}
                        className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-800 block">Okres *</label>
                      <select 
                        value={czasJednostka}
                        onChange={(e) => setCzasJednostka(e.target.value)}
                        className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold cursor-pointer"
                      >
                        <option value="Dzień">Dzień</option>
                        <option value="Miesiąc">Miesiąc</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="bg-sky-50/60 p-4 rounded-2xl border border-sky-200 space-y-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-800 block">Ilość treningów *</label>
                      <input 
                        type="number" 
                        min="1"
                        placeholder="np. 10"
                        value={iloscTreningow}
                        onChange={(e) => setIloscTreningow(e.target.value)}
                        className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 font-bold"
                      />
                    </div>

                    <div className="space-y-3 pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={dodajLimitCzasowy}
                          onChange={(e) => setDodajLimitCzasowy(e.target.checked)}
                          className="w-4 h-4 accent-amber-700 rounded cursor-pointer"
                        />
                        <span className="font-bold text-slate-900">Dodaj limit czasowy</span>
                      </label>

                      {dodajLimitCzasowy && (
                        <div className="grid grid-cols-2 gap-3 pl-6 pt-1">
                          <div className="space-y-1">
                            <label className="font-bold text-slate-700 block">Ilość *</label>
                            <input 
                              type="number" 
                              min="1"
                              value={limitIlosc}
                              onChange={(e) => setLimitIlosc(e.target.value)}
                              className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="font-bold text-slate-700 block">Okres *</label>
                            <select 
                              value={limitOkres}
                              onChange={(e) => setLimitOkres(e.target.value)}
                              className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold cursor-pointer"
                            >
                              <option value="Dzień">Dzień</option>
                              <option value="Miesiąc">Miesiąc</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* OGRANICZENIA KARNETU */}
              <div className="space-y-4 pt-2">
                <h4 className="font-extrabold text-sky-900 uppercase tracking-wider text-[11px] border-b border-sky-100 pb-1">
                  Ograniczenia karnetu
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 relative">
                    <label className="font-bold text-slate-800 block">Dostęp do:</label>
                    <select 
                      value={dostepDo}
                      onChange={(e) => {
                        setDostepDo(e.target.value);
                        if (e.target.value === 'określonych zajęć') {
                          setIsDropdownOpen(true);
                        } else {
                          setIsDropdownOpen(false);
                          setZaznaczoneZajecia([]);
                        }
                      }}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 font-bold cursor-pointer"
                    >
                      <option value="wszystkich zajęć">wszystkich zajęć</option>
                      <option value="określonych zajęć">określonych zajęć</option>
                    </select>

                    {dostepDo === 'określonych zajęć' && (
                      <div className="mt-2 bg-white border border-sky-300 rounded-2xl p-3 shadow-lg space-y-2 max-h-52 overflow-y-auto">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-sky-100">
                          Zaznacz dostępne zajęcia:
                        </div>
                        {dostepneRodzajeZajec.map((zaj) => (
                          <label key={zaj.id || zaj.nazwa} className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-sky-50 rounded-xl cursor-pointer transition-colors">
                            <input 
                              type="checkbox"
                              checked={zaznaczoneZajecia.includes(zaj.nazwa)}
                              onChange={() => handleToggleZajecie(zaj.nazwa)}
                              className="w-4 h-4 accent-amber-700 rounded cursor-pointer"
                            />
                            <span className="font-semibold text-slate-800 text-xs">{zaj.nazwa}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">Limit czasowy zapisów:</label>
                    <select 
                      value={limitCzasowyZapisow}
                      onChange={(e) => setLimitCzasowyZapisow(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 font-bold cursor-pointer"
                    >
                      <option value="Domyślny (14 dni)">Domyślny (14 dni)</option>
                      <option value="Niestandardowy">Niestandardowy</option>
                    </select>

                    {limitCzasowyZapisow === 'Niestandardowy' && (
                      <div className="mt-3 bg-sky-50/60 p-3.5 rounded-2xl border border-sky-200 space-y-2">
                        <div className="text-[11px] text-slate-600 font-medium">
                          Ile dni przed rozpoczęciem zajęć, klubowicz może się na nie zapisać
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block text-[10px] uppercase">Liczba dni *</label>
                          <input 
                            type="number"
                            min="0"
                            value={niestandardowyDni}
                            onChange={(e) => setNiestandardowyDni(e.target.value)}
                            className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">Tygodniowy limit zapisów:</label>
                    <select 
                      value={tygodniowyLimit}
                      onChange={(e) => setTygodniowyLimit(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 cursor-pointer"
                    >
                      <option value="Bez limitu">Bez limitu</option>
                      <option value="1 raz w tygodniu">1 raz w tygodniu</option>
                      <option value="2 razy w tygodniu">2 razy w tygodniu</option>
                      <option value="3 razy w tygodniu">3 razy w tygodniu</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block">Dzienny limit zapisów:</label>
                    <select 
                      value={dziennyLimit}
                      onChange={(e) => setDziennyLimit(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-2 text-slate-800 font-bold cursor-pointer"
                    >
                      <option value="Domyślny (Bez limitu)">Domyślny (Bez limitu)</option>
                      <option value="Niestandardowy">Niestandardowy</option>
                    </select>

                    {dziennyLimit === 'Niestandardowy' && (
                      <div className="mt-3 bg-sky-50/60 p-3.5 rounded-2xl border border-sky-200 space-y-2">
                        <div className="text-[11px] text-slate-600 font-medium">
                          Na ile zajęć, klubowicz może się zapisać dziennie
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 block text-[10px] uppercase">Numer *</label>
                          <input 
                            type="number"
                            min="1"
                            value={niestandardowyDziennyIlosc}
                            onChange={(e) => setNiestandardowyDziennyIlosc(e.target.value)}
                            className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* BLOKADA ZAPISÓW W ZALEŻNOŚCI OD STANU PORTFELA */}
                <div className="bg-sky-50/60 p-4 rounded-2xl border border-sky-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Blokuj zapisy w zależności od stanu portfela</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={blokujPortfel}
                        onChange={(e) => setBlokujPortfel(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  {blokujPortfel && (
                    <div className="space-y-1 pt-1">
                      <label className="font-bold text-slate-700 block text-[10px] uppercase">Blokuj zapisy gdy stan portfela jest mniejszy niż *</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={portfelPrógKwota}
                        onChange={(e) => setPortfelPrógKwota(e.target.value)}
                        className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-slate-800 font-bold"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* SPRZEDAŻ ONLINE */}
              <div className="space-y-4 pt-2">
                <h4 className="font-extrabold text-sky-900 uppercase tracking-wider text-[11px] border-b border-sky-100 pb-1">
                  Sprzedaż online
                </h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-1">
                    <span className="font-medium text-slate-800">Karnet dostępny do sprzedaży przy rejestracji online:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={dostepnyOnline}
                        onChange={(e) => setDostepnyOnline(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="font-medium text-slate-800">Klubowicz z tym karnetem, może kupić ten karnet ponownie:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={ponownyZakup}
                        onChange={(e) => setPonownyZakup(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="font-medium text-slate-800">Klubowicz z tym karnetem, może zmienić ten karnet na inny:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={zmianaNaInny}
                        onChange={(e) => setZmianaNaInny(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="font-medium text-slate-800">Klubowicz z innym karnetem, może kupić ten karnet:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={kupInnyKarnet}
                        onChange={(e) => setKupInnyKarnet(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* WYGLĄD I OPIS */}
              <div className="space-y-4 pt-2">
                <h4 className="font-extrabold text-sky-900 uppercase tracking-wider text-[11px] border-b border-sky-100 pb-1">
                  Wygląd i opis karnetu
                </h4>

                <div className="space-y-2">
                  <label className="font-bold text-slate-800 block">Obrazek</label>
                  <div className="flex items-center gap-4">
                    {obrazekUrl && (
                      <div className="w-16 h-16 rounded-xl border border-sky-200 overflow-hidden shrink-0 shadow-sm bg-white">
                        <img src={obrazekUrl} alt="Podgląd" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex flex-col items-start gap-1">
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
                        className="bg-sky-50 hover:bg-sky-100 border border-sky-200 px-4 py-2 rounded-xl text-xs font-bold text-sky-900 transition-colors cursor-pointer"
                      >
                        🖼️ Wybierz obrazek
                      </button>
                      {obrazekUrl && (
                        <button 
                          type="button" 
                          onClick={() => setObrazekUrl(null)}
                          className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer ml-1"
                        >
                          Usuń obrazek
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">Opis</label>
                  <textarea 
                    rows={3}
                    placeholder="Opis karnetu..."
                    value={opis}
                    onChange={(e) => setOpis(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Przyciski dolne */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-sky-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button 
                  type="submit"
                  className="bg-amber-800 hover:bg-amber-900 text-white font-black px-6 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  {editingId !== null ? 'ZAKTUALIZUJ' : 'ZAPISZ'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
