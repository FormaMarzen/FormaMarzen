"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../raporty/klienci/supabase';

export default function KarnetPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [transakcje, setTransakcje] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isBuyPassModalOpen, setIsBuyPassModalOpen] = useState(false);
  const [dostepneKarnety, setDostepneKarnety] = useState<any[]>([]);
  const [selectedBuyPass, setSelectedBuyPass] = useState('');
  
  // Nowy stan do wyboru terminu aktywacji karnetu
  const [activationMode, setActivationMode] = useState<'today' | 'after'>('today');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email;

    if (userEmail) {
      // 1. Pobierz dane klienta z bazy
      const { data: klientData } = await supabase
        .from('klienci')
        .select('*')
        .eq('E-mail', userEmail)
        .single();
        
      if (klientData) {
        // Zabezpieczenie: jeśli baza zwróciła karnety jako tekst (JSON), zamieniamy na tablicę
        if (typeof klientData.karnetyKlubowicza === 'string') {
          try {
            klientData.karnetyKlubowicza = JSON.parse(klientData.karnetyKlubowicza);
          } catch (e) {
            klientData.karnetyKlubowicza = [];
          }
        }
        
        setCurrentUser(klientData);
        
        // 2. Pobierz historię transakcji klienta
        const { data: tData } = await supabase
          .from('transakcje')
          .select('*')
          .eq('klient_id', klientData.id)
          .order('created_at', { ascending: false });
          
        if (tData) setTransakcje(tData);
      }
    }

    // 3. Pobierz listę karnetów dostępnych do zakupu z bazy
    const { data: karnetyData } = await supabase.from('karnety').select('*');
    if (karnetyData) {
      setDostepneKarnety(karnetyData.map((k: any) => ({
        ...k,
        cena: k.cena_brutto || k.cena || '0.00'
      })));
    }
    
    setIsLoading(false);
  };

  // Ustalanie najdalszej daty końca obecnych karnetów
  const karnetyList = Array.isArray(currentUser?.karnetyKlubowicza) ? currentUser.karnetyKlubowicza : [];
  const hasActivePasses = karnetyList.length > 0;
  
  let maxDateStr = '';
  if (hasActivePasses) {
    let maxTime = 0;
    karnetyList.forEach((k: any) => {
      if (k.waznyDo) {
        const parts = k.waznyDo.split('-');
        if (parts.length === 3) {
          const t = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
          if (t > maxTime) {
            maxTime = t;
            maxDateStr = k.waznyDo;
          }
        }
      }
    });
  }

  // OBSŁUGA ZAKUPU KARNETU DLA KLIENTA W ZAKŁADCE 'KARNET'
  const handleBuyPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedBuyPass) return;

    const defKarnetu = dostepneKarnety.find(k => k.nazwa === selectedBuyPass);
    let dniWażności = 30;

    if (defKarnetu && defKarnetu.dlugosc) {
      const dlugoscStr = defKarnetu.dlugosc.toLowerCase();
      if (dlugoscStr.includes('1 miesiąc') || dlugoscStr.includes('miesiąc')) dniWażności = 30;
      else if (dlugoscStr.includes('3 miesiące')) dniWażności = 90;
      else if (dlugoscStr.includes('6 miesięcy')) dniWażności = 180;
      else if (dlugoscStr.includes('1 rok')) dniWażności = 365;
      else if (dlugoscStr.includes('14 dni')) dniWażności = 14;
      else if (dlugoscStr.includes('7 dni')) dniWażności = 7;
    }

    // Ustalanie daty początkowej dla nowego karnetu
    let baseStartDate = new Date(); // Domyślnie dzisiaj
    if (activationMode === 'after' && maxDateStr) {
      const parts = maxDateStr.split('-');
      // Rozpoczynamy liczenie od najdalszej daty zakończenia obecnych karnetów
      baseStartDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }

    // Wyliczanie daty ważności
    const dataWygasniecia = new Date(baseStartDate);
    dataWygasniecia.setDate(dataWygasniecia.getDate() + dniWażności);
    
    // Bezpieczne formatowanie nowej daty ważności (Y-M-D), odporne na strefy czasowe
    const year = dataWygasniecia.getFullYear();
    const month = String(dataWygasniecia.getMonth() + 1).padStart(2, '0');
    const day = String(dataWygasniecia.getDate()).padStart(2, '0');
    const dataWygasnieciaStr = `${year}-${month}-${day}`;

    const cenaWartosc = defKarnetu ? parseFloat(defKarnetu.cena) : 0;
    const cenaStr = defKarnetu ? `${defKarnetu.cena} PLN` : '0.00 PLN';
    const limitWejscBaza = defKarnetu ? (defKarnetu.ilosc_wejsc || defKarnetu.limitWejsc || defKarnetu.wejscia || null) : null;

    // Tekst wyświetlany jako status na liście karnetów
    const statusTekst = activationMode === 'after' 
      ? `Oczekujący (Ważny od: ${maxDateStr} do: ${dataWygasnieciaStr})`
      : `Ważny do: ${dataWygasnieciaStr}`;

    const nowyKarnetObj = {
      id: Date.now(),
      nazwa: selectedBuyPass,
      waznyDo: dataWygasnieciaStr,
      pozostaloWejsc: limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : null,
      cena: cenaStr,
      znizkaProcentowa: '',
      rata: '1 / 1',
      statusTekst: statusTekst,
      blokadaDo: null,
      powodBlokady: null,
      zawieszonyOd: null,
      zawieszonyDo: null,
      historiaZawieszen: []
    };

    const uaktualnioneKarnety = [...karnetyList, nowyKarnetObj];

    const currentWalletNum = parseFloat(currentUser.Portfel?.replace(/[^0-9.-]+/g, "") || "0");
    const nowyStanPortfela = currentWalletNum - cenaWartosc;
    const nowyStanPortfelaStr = `${nowyStanPortfela.toFixed(2)} PLN`;

    const nowaHistoriaEntry = {
      id: Date.now(),
      date: new Date().toISOString().replace('T', ' ').substring(0, 16),
      type: `Zakup karnetu: ${selectedBuyPass}`,
      amount: `-${cenaWartosc.toFixed(2)} PLN`,
      balance: nowyStanPortfelaStr
    };

    const updatedWalletHistory = [nowaHistoriaEntry, ...(currentUser.walletHistory || [])];

    // 1. Aktualizacja profilu
    const { error: updateError } = await supabase.from('klienci').update({
      karnetyKlubowicza: uaktualnioneKarnety,
      Cena: cenaStr,
      Portfel: nowyStanPortfelaStr
    }).eq('id', currentUser.id);

    if (updateError) {
      alert(`Błąd aktualizacji bazy danych: ${updateError.message}`);
      return;
    }

    // 2. Dodanie rekordu transakcji
    if (cenaWartosc > 0) {
      await supabase.from('transakcje').insert([{
        klient_id: currentUser.id,
        typ_operacji: 'zakup_karnetu',
        kwota: -cenaWartosc,
        opis: `Zakup (Zakładka Karnet): ${selectedBuyPass}`
      }]);
    }

    alert(`Twój karnet "${selectedBuyPass}" został pomyślnie wygenerowany.`);
    window.location.reload(); 
  };

  const openBuyModal = () => {
    setActivationMode('today');
    setSelectedBuyPass('');
    setIsBuyPassModalOpen(true);
  };

  if (isLoading) {
    return <div className="p-10 flex justify-center text-slate-400 font-bold uppercase text-xs">Ładowanie danych karnetu...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      
      {/* SEKCJA 1: AKTYWNE KARNETY */}
      <div>
        <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest mb-4">TWOJE KARNETY</h2>
        
        <div className="space-y-4">
          {karnetyList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
              <span className="text-4xl block mb-3">🎟️</span>
              <h3 className="text-slate-800 font-bold mb-1">Brak aktywnych karnetów</h3>
              <p className="text-slate-500 text-xs">Wykup karnet, aby w pełni korzystać z możliwości klubu.</p>
            </div>
          ) : (
            karnetyList.map((karnet: any) => (
              <div key={karnet.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-3">
                    <h3 className="text-xl font-black text-slate-900">{karnet.nazwa}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-slate-100 text-slate-700 font-semibold px-3 py-1 rounded-full text-xs border border-slate-200 shadow-sm">
                        Aktywne zapisy: {karnet.pozostaloWejsc !== null && karnet.pozostaloWejsc !== undefined ? karnet.pozostaloWejsc : 'Bez limitu'}
                      </span>
                      <span className={`font-semibold px-3 py-1 rounded-full text-xs border shadow-sm ${karnet.statusTekst?.includes('Oczekujący') ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {karnet.statusTekst || `Ważny do: ${karnet.waznyDo}`}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-slate-100 pt-4 flex justify-end">
                  <button 
                    onClick={openBuyModal}
                    className="border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-bold text-xs px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer"
                  >
                    $ KUP KARNET
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4">
          <button 
            onClick={openBuyModal}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs px-5 py-2.5 rounded-full shadow-sm transition-colors cursor-pointer flex items-center gap-2"
          >
            <span className="text-lg leading-none rounded-full bg-white/20 w-4 h-4 flex items-center justify-center">+</span> DOKUP DODATKOWY KARNET
          </button>
        </div>
      </div>

      {/* SEKCJA 2: HISTORIA TRANSAKCJI */}
      <div className="pt-4">
        <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest mb-4">HISTORIA TRANSAKCJI</h2>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-5">#</th>
                  <th className="py-4 px-5">DATA TRANSAKCJI</th>
                  <th className="py-4 px-5">PRZEDMIOT</th>
                  <th className="py-4 px-5">CENA</th>
                  <th className="py-4 px-5">RABAT</th>
                  <th className="py-4 px-5">METODA PŁATNOŚCI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {transakcje.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">Brak historii transakcji w bazie.</td>
                  </tr>
                ) : (
                  transakcje.map((t: any, index: number) => {
                    const absKwota = Math.abs(t.kwota).toFixed(2);
                    const formattedDate = t.created_at ? t.created_at.replace('T', ' ').substring(0, 16) : '-';
                    
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-5 font-medium">{index + 1}.</td>
                        <td className="py-4 px-5">{formattedDate}</td>
                        <td className="py-4 px-5 max-w-[200px] truncate" title={t.opis || 'Karnet'}>
                          Karnet: <br/><span className="font-bold text-slate-900">{t.opis ? t.opis.split(': ')[1] || t.opis : 'OPEN'}</span>
                        </td>
                        <td className="py-4 px-5 font-bold text-slate-900">{absKwota} PLN</td>
                        <td className="py-4 px-5">-</td>
                        <td className="py-4 px-5 text-slate-500">Płatność online</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL ZAKUPU KARNETU DLA KLIENTA */}
      {isBuyPassModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">🎟️ Kup nowy karnet</h3>
              <button onClick={() => setIsBuyPassModalOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            
            <form onSubmit={handleBuyPassSubmit} className="space-y-4 text-xs">
              <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-sky-900 font-medium">
                Wybierz karnet, aby przypisać go bezpośrednio do Twojego konta.
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Wybierz karnet *</label>
                <select 
                  required
                  value={selectedBuyPass} 
                  onChange={(e) => setSelectedBuyPass(e.target.value)} 
                  className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-3 font-bold focus:outline-none focus:border-blue-500 cursor-pointer text-slate-800"
                >
                  <option value="" disabled>-- Wybierz karnet --</option>
                  {dostepneKarnety.map(k => (
                    <option key={k.id} value={k.nazwa}>{k.nazwa} (Cena: {k.cena} PLN)</option>
                  ))}
                </select>
              </div>

              {/* OPCJE AKTYWACJI KARNETU WIDOCZNE TYLKO JEŚLI UŻYTKOWNIK MA JUŻ KARNET */}
              {hasActivePasses && maxDateStr && (
                <div className="space-y-2 pt-2 border-t border-sky-100">
                  <label className="font-bold text-slate-700 block mt-2">Kiedy karnet ma zacząć obowiązywać?</label>
                  <div className="space-y-2">
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${activationMode === 'today' ? 'bg-sky-50 border-blue-400' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                      <input 
                        type="radio" 
                        name="activationMode" 
                        value="today" 
                        checked={activationMode === 'today'} 
                        onChange={() => setActivationMode('today')}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">Od dzisiaj</span>
                        <span className="text-[10px] text-slate-500">Karnet zostanie aktywowany natychmiast</span>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${activationMode === 'after' ? 'bg-sky-50 border-blue-400' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                      <input 
                        type="radio" 
                        name="activationMode" 
                        value="after" 
                        checked={activationMode === 'after'} 
                        onChange={() => setActivationMode('after')}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">Przedłużenie (Oczekujący)</span>
                        <span className="text-[10px] text-slate-500">Zacznie obowiązywać od: <strong className="text-blue-700">{maxDateStr}</strong></span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
                <button type="button" onClick={() => setIsBuyPassModalOpen(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer">
                  Anuluj
                </button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer">
                  Kupuję
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
