"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../raporty/klienci/supabase';

export default function PlatnosciOnlinePage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Ustawienia online z localStorage lub domyślne
  const [slugsplacenieDlugu, setSlugsplacenieDlugu] = useState(true);
  const [slugObnizycCene, setSlugObnizycCene] = useState(true);
  const [slugDokupicKarnet, setSlugDokupicKarnet] = useState(true);

  // Filtry tabeli historii płatności
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('2026-07-01');
  const [dateTo, setDateTo] = useState('2026-08-31');
  const [tylkoPomyslne, setTylkoPomyslne] = useState(false);

  // Prawdziwa historia transakcji z Supabase
  const [historiaTransakcji, setHistoriaTransakcji] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);

    const checkAdminAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.push('/login');
        return;
      }
      const email = (session.user.email || '').toLowerCase().trim();
      if (email !== 'maciejklaput@gmail.com' && email !== 'maciejklaput@icloud.com') {
        alert("Brak uprawnień administratora.");
        router.push('/');
        return;
      }
      setIsAdmin(true);
      await fetchTransakcjeFromSupabase();
      setLoading(false);
    };

    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('forma_marzen_ustawienia_platnosci');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSlugsplacenieDlugu(parsed.slugsplacenieDlugu ?? true);
          setSlugObnizycCene(parsed.slugObnizycCene ?? true);
          setSlugDokupicKarnet(parsed.slugDokupicKarnet ?? true);
        } catch (e) {}
      }
    }

    checkAdminAndFetch();
  }, [router]);

  const fetchTransakcjeFromSupabase = async () => {
    const { data, error } = await supabase
      .from('transakcje')
      .select('*, klienci(Imię, Nazwisko, "E-mail")')
      .order('created_at', { ascending: false });

    if (data && !error) {
      const sformatowane = data.map((t: any) => ({
        id: t.id,
        data: t.created_at ? t.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10),
        pełnaData: t.created_at,
        kupiec: t.klienci ? `${t.klienci.Imię} ${t.klienci.Nazwisko}` : 'Klient anonimowy',
        produkty: t.opis || t.typ_operacji || 'Opłata w klubie',
        dostawca: 'System',
        status: 'ukończono',
        kwota: Number(t.kwota) < 0 ? Math.abs(Number(t.kwota)) : Number(t.kwota)
      }));
      setHistoriaTransakcji(sformatowane);
    }
  };

  const handleSaveSettings = () => {
    const config = { slugsplacenieDlugu, slugObnizycCene, slugDokupicKarnet };
    if (typeof window !== 'undefined') {
      localStorage.setItem('forma_marzen_ustawienia_platnosci', JSON.stringify(config));
    }
    alert("Ustawienia płatności zostały pomyślnie zapisane!");
  };

  const handleGenerujTest = async () => {
    const { data: klienciData } = await supabase.from('klienci').select('id').limit(1);
    if (!klienciData || klienciData.length === 0) {
      alert("Najpierw dodaj przynajmniej jednego klienta w bazie, aby wygenerować testową transakcję.");
      return;
    }

    const testClientId = klienciData[0].id;
    const { error } = await supabase.from('transakcje').insert([{
      klient_id: testClientId,
      typ_operacji: 'zakup_karnetu',
      kwota: 150.00,
      opis: 'Karnet OPEN Miesięczny (Test)'
    }]);

    if (error) {
      alert("Błąd generowania testu: " + error.message);
      return;
    }

    await fetchTransakcjeFromSupabase();
    alert("Wygenerowano testową transakcję w bazie Supabase!");
  };

  // Filtrowanie historii
  const filteredTransakcje = historiaTransakcji.filter(t => {
    const query = searchQuery.toLowerCase();
    const matchQuery = (t.kupiec || '').toLowerCase().includes(query) || (t.produkty || '').toLowerCase().includes(query);
    
    const transDateStr = (t.data || '').substring(0, 10);
    const matchDate = !dateFrom || !dateTo || (transDateStr >= dateFrom && transDateStr <= dateTo);

    const matchStatus = tylkoPomyslne ? t.status === 'ukończono' : true;

    return matchQuery && matchDate && matchStatus;
  });

  const totalRevenue = filteredTransakcje.reduce((acc, curr) => acc + Number(curr.kwota), 0);

  if (!isMounted || loading) {
    return <div className="p-12 text-center text-sky-900 font-bold text-sm">Ładowanie panelu płatności z Supabase...</div>;
  }

  if (!isAdmin) return null;

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-24">
      
      {/* NAGŁÓWEK ORAZ DYNAMICZNE STATYSTYKI Z SUPABASE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-sky-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-sky-950 uppercase tracking-wider">Płatności Online</h1>
          <p className="text-xs text-slate-500 mt-0.5">Zarządzaj ustawieniami płatności i historią transakcji z bazy Supabase.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-sky-50/50 border border-sky-200 px-5 py-2.5 rounded-xl text-center">
            <div className="text-[10px] text-slate-400 font-black uppercase">Wpływy</div>
            <div className="text-base font-black text-emerald-600">{totalRevenue.toFixed(2)} PLN</div>
          </div>
          <div className="bg-sky-50/50 border border-sky-200 px-5 py-2.5 rounded-xl text-center">
            <div className="text-[10px] text-slate-400 font-black uppercase">Transakcje</div>
            <div className="text-base font-black text-sky-900">{filteredTransakcje.length}</div>
          </div>
        </div>
      </div>

      {/* USTAWIENIA */}
      <div className="bg-white border border-sky-200 rounded-2xl p-6 shadow-sm space-y-6">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-sky-100 pb-3">Ustawienia systemowe</h2>

        <div className="space-y-5 text-xs">
          
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <span className="font-medium text-slate-800">Klubowicz może spłacać dług z portfela</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${slugsplacenieDlugu ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {slugsplacenieDlugu ? 'Włączono' : 'Wyłączono'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={slugsplacenieDlugu} 
                onChange={(e) => setSlugsplacenieDlugu(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <span className="font-medium text-slate-800">Klubowicz może obniżyć cenę karnetu, wykorzystując kwotę z portfela.</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${slugObnizycCene ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {slugObnizycCene ? 'Włączono' : 'Wyłączono'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={slugObnizycCene} 
                onChange={(e) => setSlugObnizycCene(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-3">
              <span className="font-medium text-slate-800">Klubowicz może dokupić kolejny karnet lub konto rodzinne</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${slugDokupicKarnet ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {slugDokupicKarnet ? 'Włączono' : 'Wyłączono'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={slugDokupicKarnet} 
                onChange={(e) => setSlugDokupicKarnet(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

        </div>

        <div className="pt-2">
          <button 
            onClick={handleSaveSettings}
            className="bg-[#5c0000] hover:bg-[#7a0000] text-white font-black px-7 py-3 rounded-xl uppercase tracking-wider text-xs shadow-md transition-colors cursor-pointer"
          >
            ZAPISZ KONFIGURACJĘ
          </button>
        </div>
      </div>

      {/* HISTORIA PŁATNOŚCI */}
      <div className="bg-white border border-sky-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-100 pb-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">Historia płatności (Supabase)</h2>
          <div className="flex items-center gap-2">
            <button onClick={handleGenerujTest} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm">
              + Generuj test
            </button>
            <button onClick={() => alert("Eksport historii do pliku CSV...")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer">
              📥 Eksport CSV
            </button>
          </div>
        </div>

        {/* Pasek filtrów */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-1">
          <div className="relative w-full md:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
            <input 
              type="text"
              placeholder="Wyszukaj po klubowiczu lub usłudze..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-sky-50/50 border border-sky-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
            <div className="flex items-center gap-2 bg-sky-50/50 border border-sky-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700">
              <span>📅</span>
              <input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent focus:outline-none font-bold"
              />
              <span>-</span>
              <input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent focus:outline-none font-bold"
              />
            </div>

            <label className="flex items-center gap-2 bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={tylkoPomyslne} 
                onChange={(e) => setTylkoPomyslne(e.target.checked)}
                className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
              />
              <span>Tylko sukcesy</span>
            </label>
          </div>
        </div>

        {/* Tabela historii z bazy */}
        <div className="overflow-x-auto text-xs pt-2">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sky-50/70 border-b border-sky-200 text-[11px] font-bold text-sky-900 uppercase tracking-wider">
                <th className="py-3.5 px-4">Data</th>
                <th className="py-3.5 px-4">Kupiec</th>
                <th className="py-3.5 px-4">Produkty / Usługa</th>
                <th className="py-3.5 px-4">Dostawca</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Kwota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100">
              {filteredTransakcje.map((item) => (
                <tr key={item.id} className="hover:bg-sky-50/40 transition-colors">
                  <td className="py-4 px-4 font-mono text-slate-500">{item.data}</td>
                  <td className="py-4 px-4 font-bold text-slate-900">
                    {item.kupiec}
                  </td>
                  <td className="py-4 px-4 font-medium text-slate-800">{item.produkty}</td>
                  <td className="py-4 px-4 text-slate-600">{item.dostawca}</td>
                  <td className="py-4 px-4">
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px] uppercase">
                      {item.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-black text-emerald-600">
                    +{Number(item.kwota).toFixed(2)} PLN
                  </td>
                </tr>
              ))}
              {filteredTransakcje.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 font-medium">
                    Brak transakcji w bazie danych Supabase spełniających kryteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Dolny pasek paginacji */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-sky-100 text-xs text-slate-500 gap-3">
          <div>Łącznie transakcji: <strong className="text-slate-800">{filteredTransakcje.length}</strong></div>
          <div className="flex items-center gap-2">
            <span>Strona: 1 z 1</span>
            <div className="flex items-center gap-1">
              <button disabled className="px-2 py-1 bg-slate-100 rounded text-slate-300 font-bold">◀</button>
              <button className="px-3 py-1 bg-sky-900 text-white rounded font-bold">1</button>
              <button disabled className="px-2 py-1 bg-slate-100 rounded text-slate-300 font-bold">▶</button>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
