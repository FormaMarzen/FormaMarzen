"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../raporty/klienci/supabase';

export default function MojeZapisyPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zapisyNadchodzace, setZapisyNadchodzace] = useState<any[]>([]);
  const [zapisyPrzeszle, setZapisyPrzeszle] = useState<any[]>([]);
  
  // Stan do modalu potwierdzenia wypisania
  const [itemToUnregister, setItemToUnregister] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userEmail = session?.user?.email;

    if (userEmail) {
      const { data: klientData } = await supabase
        .from('klienci')
        .select('*')
        .eq('E-mail', userEmail)
        .single();
        
      if (klientData) {
        setCurrentUser(klientData);
        
        const nadchodzace = klientData.zapisyNadchodzace || [];
        const przeszle = klientData.zapisyPrzeszle || [];

        setZapisyNadchodzace(nadchodzace);
        setZapisyPrzeszle(przeszle);
      }
    }
    setIsLoading(false);
  };

  const handleConfirmWypisanie = async () => {
    if (!currentUser || !itemToUnregister) return;

    const uaktualnioneNadchodzace = zapisyNadchodzace.filter((z: any) => z.id !== itemToUnregister.id);
    const nowyWypis = { 
      ...itemToUnregister, 
      wypisujacy: 'Wypisany przez klubowicza',
      dataWypisania: new Date().toISOString().split('T')[0]
    };
    const uaktualnioneWypisy = [nowyWypis, ...(currentUser.zapisyWypisy || [])];

    // Zapis w bazie Supabase
    const { error } = await supabase
      .from('klienci')
      .update({ 
        zapisyNadchodzace: uaktualnioneNadchodzace, 
        zapisyWypisy: uaktualnioneWypisy 
      })
      .eq('id', currentUser.id);

    if (error) {
      alert(`Błąd podczas wypisywania: ${error.message}`);
      return;
    }

    // Dodanie wpisu do transakcji / logów
    await supabase.from('transakcje').insert([{
      klient_id: currentUser.id,
      typ_operacji: 'zajecia_wypis',
      kwota: null,
      opis: `Samodzielne wypisanie z zajęć: ${itemToUnregister.zajecia} (${itemToUnregister.data})`
    }]);

    setItemToUnregister(null);
    loadData();
  };

  if (isLoading) {
    return <div className="p-10 flex justify-center text-slate-400 font-bold uppercase text-xs">Ładowanie zapisów...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in pb-20">
      
      {/* SEKCJA 1: AKTYWNE ZAPISY (NADCHODZĄCE) */}
      <div className="space-y-4">
        <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">AKTYWNE ZAPISY NA ZAJĘCIA</h2>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-5 w-12">#</th>
                  <th className="py-4 px-5">DATA ZAJĘĆ</th>
                  <th className="py-4 px-5">ZAJĘCIA</th>
                  <th className="py-4 px-5">KARNET</th>
                  <th className="py-4 px-5 text-right">AKCJA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {zapisyNadchodzace.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">Brak nadchodzących zapisów na zajęcia.</td>
                  </tr>
                ) : (
                  zapisyNadchodzace.map((item: any, index: number) => (
                    <tr key={item.id || index} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-5 font-medium text-slate-400">{index + 1}.</td>
                      <td className="py-4 px-5 font-mono font-bold text-slate-900">{item.data}</td>
                      <td className="py-4 px-5 font-bold text-sky-950">{item.zajecia}</td>
                      <td className="py-4 px-5 font-semibold text-slate-600">{item.karnet || 'OPEN'}</td>
                      <td className="py-4 px-5 text-right">
                        <button 
                          onClick={() => setItemToUnregister(item)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer border border-rose-200 shadow-sm uppercase tracking-wider text-[10px]"
                        >
                          Wypisz się
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SEKCJA 2: HISTORIA ZAPISÓW (PRZESZŁE) */}
      <div className="space-y-4">
        <h2 className="text-[13px] font-black text-slate-400 uppercase tracking-widest">HISTORIA ZAPISÓW</h2>
        
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-5 w-12">#</th>
                  <th className="py-4 px-5">DATA ZAJĘĆ</th>
                  <th className="py-4 px-5">ZAJĘCIA</th>
                  <th className="py-4 px-5">KARNET</th>
                  <th className="py-4 px-5">STATUS / OBECNOŚĆ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {zapisyPrzeszle.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">Brak historii odbytych zajęć.</td>
                  </tr>
                ) : (
                  zapisyPrzeszle.map((item: any, index: number) => (
                    <tr key={item.id || index} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-5 font-medium text-slate-400">{index + 1}.</td>
                      <td className="py-4 px-5 font-mono">{item.data}</td>
                      <td className="py-4 px-5 font-bold text-slate-900">{item.zajecia}</td>
                      <td className="py-4 px-5 text-slate-600">{item.karnet || 'OPEN'}</td>
                      <td className="py-4 px-5">
                        <span className="bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-md border border-emerald-200 text-[10px]">
                          {item.obecnosc || 'Odbyte'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL POTWIERDZENIA WYPISANIA */}
      {itemToUnregister && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-sky-200">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">⚠️ Potwierdź wypisanie</h3>
              <button onClick={() => setItemToUnregister(null)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            
            <div className="space-y-3 text-xs text-slate-700">
              <p>Czy na pewno chcesz wypisać się z zajęć:</p>
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-200 space-y-1">
                <div className="font-black text-sky-950 text-sm">{itemToUnregister.zajecia}</div>
                <div className="font-mono text-sky-800">Termin: {itemToUnregister.data}</div>
              </div>
              <p className="text-[11px] text-slate-500">Operacja ta zwolni Twoje miejsce na liście uczestników.</p>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-sky-100">
              <button 
                onClick={() => setItemToUnregister(null)} 
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button 
                onClick={handleConfirmWypisanie} 
                className="bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-3 rounded-xl uppercase transition-colors shadow-sm cursor-pointer"
              >
                Tak, wypisz się
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
