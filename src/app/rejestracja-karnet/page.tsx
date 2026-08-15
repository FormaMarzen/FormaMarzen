"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../raporty/klienci/supabase';

interface RegulationItem {
  id: string;
  slug: string;
  title: string;
  content: string;
  checkbox_text?: string;
}

export default function RegistrationPassPage() {
  const router = useRouter();

  // KROK REJESTRACJI: 1 - Dane konta, 2 - Wybór karnetu, 3 - Potwierdzenie
  const [step, setStep] = useState(1);

  // Dane użytkownika
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Dane karnetu
  const [dostepneKarnety, setDostepneKarnety] = useState<any[]>([]);
  const [selectedPass, setSelectedPass] = useState<any | null>(null);

  // Regulaminy
  const [regulations, setRegulations] = useState<RegulationItem[]>([]);
  const [acceptedRegulations, setAcceptedRegulations] = useState<{ [key: string]: boolean }>({});
  const [activeModalReg, setActiveModalReg] = useState<RegulationItem | null>(null);

  // Status i walidacja
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Pobranie karnetów i regulaminów przy załadowaniu
  useEffect(() => {
    const fetchInitialData = async () => {
      // Pobieranie karnetów
      const { data: karnetyData } = await supabase.from('karnety').select('*');
      if (karnetyData) {
        setDostepneKarnety(karnetyData.map((k: any) => ({
          ...k,
          cena: k.cena_brutto || k.cena || '0.00'
        })));
      }

      // Pobieranie regulaminów
      const { data: regData } = await supabase.from('regulations').select('*').order('id', { ascending: true });
      if (regData) {
        setRegulations(regData);
        const initialAccepted: { [key: string]: boolean } = {};
        regData.forEach((reg: RegulationItem) => {
          initialAccepted[reg.slug] = false;
        });
        setAcceptedRegulations(initialAccepted);
      }
    };
    fetchInitialData();
  }, []);

  const handleNextToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !phone || !password) {
      setErrorMsg("Uzupełnij wszystkie wymagane pola.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Hasło musi mieć minimum 6 znaków.");
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleNextToStep3 = () => {
    if (!selectedPass) {
      setErrorMsg("Musisz wybrać karnet, aby przejść dalej.");
      return;
    }
    setErrorMsg('');
    setStep(3);
  };

  const handleCheckboxChange = (slug: string, checked: boolean) => {
    setAcceptedRegulations(prev => ({ ...prev, [slug]: checked }));
  };

  const renderCheckboxTextWithLinks = (reg: RegulationItem) => {
    const text = reg.checkbox_text || `Zapoznałem się i akceptuję [[${reg.title}]]`;
    const parts = text.split(/\[\[(.*?)\]\]/g);

    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <span 
            key={index} 
            onClick={(e) => {
              e.preventDefault();
              setActiveModalReg(reg);
            }}
            className="text-sky-600 font-bold underline cursor-pointer hover:text-sky-700 transition-colors"
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const handleFinalSubmit = async () => {
    // Sprawdzenie regulaminów
    const allAccepted = regulations.every(reg => acceptedRegulations[reg.slug]);
    if (!allAccepted) {
      setErrorMsg("Musisz zaakceptować wszystkie wymagane zgody i regulaminy.");
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // 1. Utworzenie konta Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('Konto z tym adresem e-mail już istnieje! Przejdź do ekranu logowania.');
        }
        throw new Error(`Błąd tworzenia konta: ${authError.message}`);
      }

      // 2. Zapis akceptacji regulaminów (powiązanie z User ID)
      if (authData.user) {
        const acceptanceInserts = regulations.map(reg => ({
          user_id: authData.user!.id,
          user_email: email,
          regulation_slug: reg.slug,
          accepted_at: new Date().toISOString()
        }));
        await supabase.from('regulation_acceptances').insert(acceptanceInserts);
      }

      // 3. Przygotowanie danych karnetu
      let dniWażności = 30;
      if (selectedPass.dlugosc) {
        const dlugoscStr = selectedPass.dlugosc.toLowerCase();
        if (dlugoscStr.includes('1 miesiąc') || dlugoscStr.includes('miesiąc')) dniWażności = 30;
        else if (dlugoscStr.includes('3 miesiące')) dniWażności = 90;
        else if (dlugoscStr.includes('6 miesięcy')) dniWażności = 180;
        else if (dlugoscStr.includes('1 rok')) dniWażności = 365;
        else if (dlugoscStr.includes('14 dni')) dniWażności = 14;
        else if (dlugoscStr.includes('7 dni')) dniWażności = 7;
      }

      const dataWygasniecia = new Date();
      dataWygasniecia.setDate(dataWygasniecia.getDate() + dniWażności);
      const dataWygasnieciaStr = dataWygasniecia.toISOString().split('T')[0];

      const cenaWartosc = parseFloat(selectedPass.cena);
      const cenaStr = `${selectedPass.cena} PLN`;
      const limitWejscBaza = selectedPass.ilosc_wejsc || selectedPass.limitWejsc || selectedPass.wejscia || null;

      const nowyKarnetObj = {
        id: Date.now(),
        nazwa: selectedPass.nazwa,
        waznyDo: dataWygasnieciaStr,
        pozostaloWejsc: limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : null,
        cena: cenaStr,
        znizkaProcentowa: '',
        rata: '1 / 1',
        statusTekst: `Ważny do: ${dataWygasnieciaStr}`,
        blokadaDo: null,
        powodBlokady: null,
        zawieszonyOd: null,
        zawieszonyDo: null,
        historiaZawieszen: []
      };

      const ujemnyPortfelStr = `-${cenaWartosc.toFixed(2)} PLN`;

      // 4. Zapis do bazy danych 'klienci'
      const payload: any = {
        'Imię': firstName,
        'Nazwisko': lastName,
        'E-mail': email,
        'Numer tel.': phone,
        'Zarejestrowany': new Date().toISOString().split('T')[0],
        'karnetyKlubowicza': JSON.stringify([nowyKarnetObj]),
        'Portfel': ujemnyPortfelStr,
        'Cena': cenaStr,
        'Wygasa': dataWygasnieciaStr
      };

      const { error: dbError } = await supabase.from('klienci').insert([payload]);

      if (dbError) {
        throw new Error(`Błąd zapisu do bazy klientów: ${dbError.message}`);
      }

      // 5. Pobranie ID nowo utworzonego klienta w celu dodania rekordu do transakcji
      const { data: newClient } = await supabase.from('klienci').select('id').eq('E-mail', email).single();
      
      if (newClient && cenaWartosc > 0) {
        await supabase.from('transakcje').insert([{
          klient_id: newClient.id,
          typ_operacji: 'zakup_karnetu',
          kwota: -cenaWartosc,
          opis: `Rejestracja z zakupem: ${selectedPass.nazwa}`
        }]);
      }

      alert("Konto zostało pomyślnie utworzone! Możesz się teraz zalogować i uregulować portfel w klubie.");
      router.push('/login');

    } catch (err: any) {
      setErrorMsg(err.message || 'Wystąpił nieoczekiwany błąd.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-8 font-sans antialiased text-slate-800 relative overflow-hidden">
      
      {/* Tło dekoracyjne */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] opacity-10 pointer-events-none">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path fill="#0284c7" d="M44.7,-76.4C58.8,-69.3,71.8,-59.1,81.1,-46C90.4,-32.9,96,-16.5,95.5,-0.6C95,15.3,88.4,30.7,79.1,43.8C69.8,56.9,57.7,67.7,43.9,75.9C30.1,84.1,14.5,89.7,-0.7,90.8C-16,91.9,-31.9,88.4,-45.9,80.3C-59.9,72.2,-71.9,59.5,-80.4,45C-88.9,30.5,-93.8,14.3,-93.2,-1.4C-92.5,-17.1,-86.3,-32.3,-76.7,-44.9C-67.1,-57.5,-54.2,-67.5,-40.1,-74.7C-26,-81.9,-10.8,-86.3,3.3,-91.5C17.4,-96.7,30.6,-83.5,44.7,-76.4Z" transform="translate(100 100)" />
        </svg>
      </div>

      <div className="w-full max-w-2xl space-y-6 z-10">
        
        <div className="flex items-center gap-3 mb-2">
          <Link href="/login" className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors shadow-sm cursor-pointer">
            ←
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-wide">Załóż konto i kup karnet</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Krok {step} z 3</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
          <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
          <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`}></div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xl">
          
          {errorMsg && (
            <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl text-center">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* KROK 1 */}
          {step === 1 && (
            <form onSubmit={handleNextToStep2} className="space-y-5 animate-in fade-in">
              <h2 className="text-lg font-black text-slate-950 uppercase tracking-wider mb-2">1. Twoje dane</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                <div className="space-y-1.5">
                  <label>Imię *</label>
                  <input required type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <label>Nazwisko *</label>
                  <input required type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>
              <div className="space-y-1.5 text-xs font-bold text-slate-700">
                <label>Telefon *</label>
                <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div className="space-y-1.5 text-xs font-bold text-slate-700">
                <label>E-mail *</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div className="space-y-1.5 text-xs font-bold text-slate-700">
                <label>Hasło * (minimum 6 znaków)</label>
                <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors" minLength={6} />
              </div>
              <div className="pt-4 flex justify-end border-t border-slate-100">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3.5 rounded-xl uppercase transition-colors shadow-md text-xs cursor-pointer">
                  Dalej →
                </button>
              </div>
            </form>
          )}

          {/* KROK 2 */}
          {step === 2 && (
            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in">
              <h2 className="text-lg font-black text-slate-950 uppercase tracking-wider mb-2">2. Wybierz swój karnet</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {dostepneKarnety.map(k => (
                  <div key={k.id} onClick={() => setSelectedPass(k)} className={`relative border-2 rounded-2xl p-5 cursor-pointer transition-all shadow-sm ${selectedPass?.id === k.id ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                    {selectedPass?.id === k.id && (<div className="absolute top-3 right-3 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>)}
                    <h4 className="font-black text-slate-900 text-sm">{k.nazwa}</h4>
                    <p className="font-black text-blue-700 text-lg mt-2">{k.cena} PLN</p>
                  </div>
                ))}
              </div>
              <div className="pt-4 flex justify-between border-t border-slate-100">
                <button onClick={() => setStep(1)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3.5 rounded-xl text-xs cursor-pointer">← Wróć</button>
                <button onClick={handleNextToStep3} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3.5 rounded-xl uppercase text-xs cursor-pointer">Dalej →</button>
              </div>
            </div>
          )}

          {/* KROK 3 */}
          {step === 3 && selectedPass && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
              <h2 className="text-lg font-black text-slate-950 uppercase tracking-wider mb-2">3. Potwierdzenie i zgody</h2>
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="text-xs font-bold text-slate-700">Wybrany karnet: <span className="text-blue-700">{selectedPass.nazwa} - {selectedPass.cena} PLN</span></div>
                
                {/* Dynamiczne regulaminy */}
                <div className="space-y-2.5 pt-2 text-[11px] text-slate-600 border-t border-slate-100 mt-2 pt-4">
                  {regulations.length > 0 ? (
                    regulations.map((reg) => (
                      <label key={reg.slug} className="flex items-start gap-2.5 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={!!acceptedRegulations[reg.slug]} 
                          onChange={(e) => handleCheckboxChange(reg.slug, e.target.checked)} 
                          className="mt-0.5 accent-blue-600 shrink-0" 
                        />
                        <span className="leading-relaxed">
                          {renderCheckboxTextWithLinks(reg)}
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className="text-slate-400 italic">Ładowanie wymaganych zgód...</div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-between border-t border-slate-100">
                <button onClick={() => setStep(2)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3.5 rounded-xl text-xs cursor-pointer">← Wróć</button>
                <button onClick={handleFinalSubmit} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-3.5 rounded-xl uppercase text-xs cursor-pointer disabled:opacity-70">
                  {isLoading ? 'Tworzenie konta...' : 'Zarejestruj się i kup'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal regulaminu */}
      {activeModalReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-sm">{activeModalReg.title}</h3>
              <button onClick={() => setActiveModalReg(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-xs text-slate-700 whitespace-pre-wrap">{activeModalReg.content}</div>
            <div className="p-4 border-t flex justify-end">
              <button onClick={() => setActiveModalReg(null)} className="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs cursor-pointer">Zamknij</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
