"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../raporty/klienci/supabase';

export default function ZespolPage() {
  const [zespol, setZespol] = useState<any[]>([]);
  const [klienci, setKlienci] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [imie, setImie] = useState('');
  const [nazwisko, setNazwisko] = useState('');
  const [email, setEmail] = useState('');
  const [telefon, setTelefon] = useState('');
  const [rola, setRola] = useState('Trener');
  const [pelnyDostep, setPelnyDostep] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [permissions, setPermissions] = useState<{ [key: string]: boolean }>({
    panelGlowny: true,
    grafik: true,
    kreatorTreningow: true,
    centrumRaportow: true,
    transakcje: true,
    klienci: true,
    zajeciaZapisy: true,
    aktywnosc: true,
    inwentaryzacja: true,
    automatyczneZapisy: true,
    trenerzy: true,
    ustawieniaZajecia: true,
    zasadyZapisow: true,
    rodzajeZajec: true,
    karnety: true,
    magazyn: true,
    integracjaWww: true,
    platnosciOnline: true,
    wysylkaWiadomosci: true,
    kodyRabatowe: true,
    programAmbasador: true,
    zespol: true,
    wyglad: true,
    moduly: true,
    platnosciZaSystem: true,
    programPartnerski: true,
    kampanie: true,
    automatyzacja: true,
    webhooki: true,
    ogloszenia: true,
    historiaWiadomosci: true,
    wyszukiwarka: true,
    dodawanieKlubowiczow: true,
    edycjaKlubowiczow: true,
    wyslijWiadomosc: true,
    podsumowanieRaportu: true,
    usuwanieTransakcji: true,
    tworzenieZajecJednorazowych: true,
    produkty: true,
    listaZadan: true,
  });

  const fetchZespol = async () => {
    try {
      setIsLoading(true);
      const [trenerzyRes, klienciRes] = await Promise.all([
        supabase.from('trenerzy').select('*'),
        supabase.from('klienci').select('*')
      ]);
      
      if (trenerzyRes.data) setZespol(trenerzyRes.data);
      if (klienciRes.data) setKlienci(klienciRes.data);
    } catch (err) {
      console.error("Błąd pobierania zespołu:", err);
      setZespol([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchZespol();
  }, []);

  // NAPRAWIONA FUNKCJA PRZEŁĄCZANIA WSZYSTKICH CHECKBOXÓW
  const handleToggleAll = () => {
    // Sprawdzamy, czy wszystkie uprawnienia są aktualnie zaznaczone na true
    const allChecked = Object.values(permissions).every((val) => val === true);
    
    // Jeśli wszystkie są zaznaczone, odznaczamy je (false). W przeciwnym razie zaznaczamy wszystkie (true).
    const newState = !allChecked;
    
    const updated: { [key: string]: boolean } = {};
    Object.keys(permissions).forEach((key) => {
      updated[key] = newState;
    });
    setPermissions(updated);
  };

  const handleCheckboxChange = (key: string) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveNewMember = async () => {
    if (!imie || !nazwisko || !email) {
      alert("Proszę uzupełnić wymagane pola: Imię, Nazwisko oraz Email.");
      return;
    }

    setIsSaving(true);
    const fullName = `${imie} ${nazwisko}`;

    const { error } = await supabase.from('trenerzy').insert([
      {
        imie_nazwisko: fullName,
        email: email,
        telefon: telefon
      }
    ]);

    setIsSaving(false);

    if (error) {
      console.error("Błąd zapisu:", error.message);
      alert("Wystąpił błąd podczas zapisywania w bazie: " + error.message);
    } else {
      setIsAddModalOpen(false);
      setImie('');
      setNazwisko('');
      setEmail('');
      setTelefon('');
      fetchZespol();
    }
  };

  const handleDeleteTrainer = async (id: number) => {
    if (confirm("Czy na pewno chcesz usunąć tego trenera z zespołu? Ewentualne powiązanie z kontem klubowicza również zostanie rozwiązane.")) {
      const { error } = await supabase.from('trenerzy').delete().eq('id', id);
      if (error) {
        alert("Błąd podczas usuwania: " + error.message);
      } else {
        fetchZespol();
      }
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center text-gray-500 font-bold">Ładowanie zespołu z bazy...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans relative">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-xl font-bold text-gray-700 tracking-wide uppercase">
            Zarządzaj zespołem
          </h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#7A1215] hover:bg-[#630E10] text-white px-5 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <span>+ DODAJ</span>
            </button>
            <button className="bg-sky-100/70 hover:bg-sky-200/70 text-sky-800 px-4 py-2 rounded-lg font-medium text-sm transition-colors cursor-pointer">
              POMOC
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Nazwa</th>
                  <th className="py-4 px-6">Email</th>
                  <th className="py-4 px-6">Rola</th>
                  <th className="py-4 px-6">Dostęp do</th>
                  <th className="py-4 px-6 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {zespol.length > 0 ? (
                  zespol.map((item) => {
                    // Sprawdzamy czy dany trener figuruje w bazie klientów
                    const powiazanyKlient = klienci.find(c => c['E-mail'] === item.email);

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6 font-medium text-gray-800 flex flex-col items-start gap-1">
                          <div className="flex items-center gap-3">
                            {item.imie_nazwisko}
                            <span className="bg-emerald-100/80 text-emerald-800 text-xs px-2 py-0.5 rounded font-normal">
                              Aktywny
                            </span>
                          </div>
                          {powiazanyKlient && (
                            <span className="bg-sky-50 text-sky-700 text-[10px] font-bold px-2 py-0.5 rounded border border-sky-200 inline-block mt-0.5">
                              ⭐ Powiązany z kontem klubowicza
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-gray-500">{item.email}</td>
                        <td className="py-4 px-6 text-gray-600 capitalize">Trener</td>
                        <td className="py-4 px-6 text-gray-700 font-medium">Pełen dostęp</td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="w-8 h-8 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 flex items-center justify-center transition-colors cursor-pointer" title="Edytuj">
                              ✏️
                            </button>
                            <button 
                              onClick={() => handleDeleteTrainer(item.id)}
                              className="w-8 h-8 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 flex items-center justify-center transition-colors cursor-pointer" 
                              title="Usuń"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      Brak trenerów w bazie. Kliknij "+ DODAJ", aby dodać pierwszego członka zespołu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
            
            <div className="flex justify-between items-center pb-6 border-b border-gray-100">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleSaveNewMember}
                  disabled={isSaving}
                  className="bg-[#7A1215] hover:bg-[#630E10] text-white px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Zapisywanie...' : 'ZAPISZ'}
                </button>
                <button className="bg-sky-100/70 hover:bg-sky-200/70 text-sky-800 px-4 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer">
                  POMOC
                </button>
              </div>
            </div>

            <div className="space-y-6 pt-6 flex-1 text-xs">
              
              <div className="space-y-4">
                <h3 className="font-bold text-gray-400 uppercase tracking-wider text-[11px]">Podstawowe informacje</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-gray-600">Imię *</label>
                    <input 
                      type="text" 
                      value={imie} 
                      onChange={(e) => setImie(e.target.value)} 
                      placeholder="John" 
                      className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-600">Nazwisko *</label>
                    <input 
                      type="text" 
                      value={nazwisko} 
                      onChange={(e) => setNazwisko(e.target.value)} 
                      placeholder="Membersky" 
                      className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-gray-600">Adres e-mail *</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="johny123@email.com" 
                    className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-sky-500" 
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-600">Numer telefonu</label>
                  <input 
                    type="tel" 
                    value={telefon} 
                    onChange={(e) => setTelefon(e.target.value)} 
                    className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-sky-500" 
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-bold text-gray-400 uppercase tracking-wider text-[11px]">Ustawienia dostępu</h3>
                <div>
                  <label className="font-semibold text-gray-600">Rola</label>
                  <select 
                    value={rola} 
                    onChange={(e) => setRola(e.target.value)} 
                    className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none"
                  >
                    <option value="Właściciel">Właściciel</option>
                    <option value="Trener">Trener</option>
                    <option value="Recepcja">Recepcja</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="font-semibold text-gray-700">
                    {pelnyDostep ? 'Pełny dostęp' : 'Ograniczony dostęp'}
                  </span>
                  <button 
                    type="button"
                    onClick={() => setPelnyDostep(!pelnyDostep)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${pelnyDostep ? 'bg-amber-500 justify-end' : 'bg-gray-300 justify-start'}`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
                  </button>
                </div>
              </div>

              {!pelnyDostep && (
                <div className="space-y-4 pt-4 border-t border-gray-100 pb-10 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-400 uppercase tracking-wider text-[11px]">Uprawnienia</h3>
                    <button type="button" onClick={handleToggleAll} className="font-bold text-amber-600 hover:text-amber-700 cursor-pointer">
                      ☑ Przełącz wszystko
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-2">
                    <label className="flex items-center gap-2 font-semibold text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={permissions.panelGlowny} onChange={() => handleCheckboxChange('panelGlowny')} className="w-4 h-4 accent-amber-500 rounded" /> Panel główny
                    </label>
                    <label className="flex items-center gap-2 font-semibold text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={permissions.grafik} onChange={() => handleCheckboxChange('grafik')} className="w-4 h-4 accent-amber-500 rounded" /> Grafik
                    </label>
                    <label className="flex items-center gap-2 font-semibold text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={permissions.kreatorTreningow} onChange={() => handleCheckboxChange('kreatorTreningow')} className="w-4 h-4 accent-amber-500 rounded" /> Kreator treningów
                    </label>
                  </div>

                  <div className="space-y-2 pt-3">
                    <h4 className="font-bold text-gray-500 text-[11px]">Raporty</h4>
                    <div className="grid grid-cols-2 gap-2 text-gray-700">
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.centrumRaportow} onChange={() => handleCheckboxChange('centrumRaportow')} className="accent-amber-500" /> Centrum raportów</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.transakcje} onChange={() => handleCheckboxChange('transakcje')} className="accent-amber-500" /> Transakcje</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.klienci} onChange={() => handleCheckboxChange('klienci')} className="accent-amber-500" /> Klienci</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.zajeciaZapisy} onChange={() => handleCheckboxChange('zajeciaZapisy')} className="accent-amber-500" /> Zajęcia i zapisy</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.aktywnosc} onChange={() => handleCheckboxChange('aktywnosc')} className="accent-amber-500" /> Aktywność</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.inwentaryzacja} onChange={() => handleCheckboxChange('inwentaryzacja')} className="accent-amber-500" /> Inwentaryzacja</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.automatyczneZapisy} onChange={() => handleCheckboxChange('automatyczneZapisy')} className="accent-amber-500" /> Automatyczne zapisy</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.trenerzy} onChange={() => handleCheckboxChange('trenerzy')} className="accent-amber-500" /> Trenerzy</label>
                    </div>
                  </div>

                  <div className="space-y-2 pt-3">
                    <h4 className="font-bold text-gray-500 text-[11px]">Ustawienia</h4>
                    <div className="grid grid-cols-2 gap-2 text-gray-700">
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.ustawieniaZajecia} onChange={() => handleCheckboxChange('ustawieniaZajecia')} className="accent-amber-500" /> Zajęcia</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.zasadyZapisow} onChange={() => handleCheckboxChange('zasadyZapisow')} className="accent-amber-500" /> Zasady zapisów</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.rodzajeZajec} onChange={() => handleCheckboxChange('rodzajeZajec')} className="accent-amber-500" /> Rodzaje zajęć</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.karnety} onChange={() => handleCheckboxChange('karnety')} className="accent-amber-500" /> Karnety</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.magazyn} onChange={() => handleCheckboxChange('magazyn')} className="accent-amber-500" /> Magazyn</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.integracjaWww} onChange={() => handleCheckboxChange('integracjaWww')} className="accent-amber-500" /> Integracja WWW</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.platnosciOnline} onChange={() => handleCheckboxChange('platnosciOnline')} className="accent-amber-500" /> Płatności online</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.wysylkaWiadomosci} onChange={() => handleCheckboxChange('wysylkaWiadomosci')} className="accent-amber-500" /> Wysyłka wiadomości</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.kodyRabatowe} onChange={() => handleCheckboxChange('kodyRabatowe')} className="accent-amber-500" /> Kody rabatowe</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.programAmbasador} onChange={() => handleCheckboxChange('programAmbasador')} className="accent-amber-500" /> Program Ambasador</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.zespol} onChange={() => handleCheckboxChange('zespol')} className="accent-amber-500" /> Zespół</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.wyglad} onChange={() => handleCheckboxChange('wyglad')} className="accent-amber-500" /> Wygląd</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.moduly} onChange={() => handleCheckboxChange('moduly')} className="accent-amber-500" /> Moduły</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.platnosciZaSystem} onChange={() => handleCheckboxChange('platnosciZaSystem')} className="accent-amber-500" /> Płatności za system</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.programPartnerski} onChange={() => handleCheckboxChange('programPartnerski')} className="accent-amber-500" /> Program Partnerski</label>
                    </div>
                  </div>

                  <div className="space-y-2 pt-3">
                    <h4 className="font-bold text-gray-500 text-[11px]">Komunikacja</h4>
                    <div className="grid grid-cols-2 gap-2 text-gray-700">
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.kampanie} onChange={() => handleCheckboxChange('kampanie')} className="accent-amber-500" /> Kampanie</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.automatyzacja} onChange={() => handleCheckboxChange('automatyzacja')} className="accent-amber-500" /> Automatyzacja</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.webhooki} onChange={() => handleCheckboxChange('webhooki')} className="accent-amber-500" /> Webhooki</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.ogloszenia} onChange={() => handleCheckboxChange('ogloszenia')} className="accent-amber-500" /> Ogłoszenia</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.historiaWiadomosci} onChange={() => handleCheckboxChange('historiaWiadomosci')} className="accent-amber-500" /> Historia wiadomości</label>
                    </div>
                  </div>

                  <div className="space-y-2 pt-3">
                    <h4 className="font-bold text-gray-500 text-[11px]">Moduły</h4>
                    <div className="grid grid-cols-2 gap-2 text-gray-700">
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.wyszukiwarka} onChange={() => handleCheckboxChange('wyszukiwarka')} className="accent-amber-500" /> Wyszukiwarka</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.dodawanieKlubowiczow} onChange={() => handleCheckboxChange('dodawanieKlubowiczow')} className="accent-amber-500" /> Dodawanie klubowiczów</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.edycjaKlubowiczow} onChange={() => handleCheckboxChange('edycjaKlubowiczow')} className="accent-amber-500" /> Edycja klubowiczów</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.wyslijWiadomosc} onChange={() => handleCheckboxChange('wyslijWiadomosc')} className="accent-amber-500" /> Wyślij wiadomość</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.podsumowanieRaportu} onChange={() => handleCheckboxChange('podsumowanieRaportu')} className="accent-amber-500" /> Podsumowanie raportu transakcji</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.usuwanieTransakcji} onChange={() => handleCheckboxChange('usuwanieTransakcji')} className="accent-amber-500" /> Usuwanie transakcji</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.tworzenieZajecJednorazowych} onChange={() => handleCheckboxChange('tworzenieZajecJednorazowych')} className="accent-amber-500" /> Tworzenie zajęć jednorazowych</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.produkty} onChange={() => handleCheckboxChange('produkty')} className="accent-amber-500" /> Produkty</label>
                      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={permissions.listaZadan} onChange={() => handleCheckboxChange('listaZadan')} className="accent-amber-500" /> Lista zadań</label>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
