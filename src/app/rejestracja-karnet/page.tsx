"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../raporty/klienci/supabase';

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

  // Status i walidacja
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Pobranie karnetów przy załadowaniu
  useEffect(() => {
    const fetchKarnety = async () => {
      const { data } = await supabase.from('karnety').select('*');
      if (data) {
        setDostepneKarnety(data.map((k: any) => ({
          ...k,
          cena: k.cena_brutto || k.cena || '0.00'
        })));
      }
    };
    fetchKarnety();
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

  const handleFinalSubmit = async () => {
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

      // 2. Przygotowanie danych wybranego karnetu
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

      // 3. Obliczanie ujemnego portfela
      const ujemnyPortfelStr = `-${cenaWartosc.toFixed(2)} PLN`;

      // 4. Zapis do bazy danych 'klienci' z poprawną nazwą kolumny 'karnetyKlubowicza'
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
        
        {/* Nawigacja "Wstecz" */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/login" className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors shadow-sm cursor-pointer">
            ←
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-wide">Załóż konto i kup karnet</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Krok {step} z 3</p>
          </div>
        </div>

        {/* Pasek postępu */}
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

          {/* KROK 1: DANE OSOBOWE */}
          {step === 1 && (
            <form onSubmit={handleNextToStep2} className="space-y-5 animate-in fade-in">
              <h2 className="text-lg font-black text-slate-950 uppercase tracking-wider mb-2">1. Twoje dane</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                <div className="space-y-1.5">
                  <label>Imię *</label>
                  <input required type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="Wpisz imię..." />
                </div>
                <div className="space-y-1.5">
                  <label>Nazwisko *</label>
                  <input required type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="Wpisz nazwisko..." />
                </div>
              </div>

              <div className="space-y-1.5 text-xs font-bold text-slate-700">
                <label>Telefon *</label>
                <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="Twój numer telefonu..." />
              </div>

              <div className="space-y-1.5 text-xs font-bold text-slate-700">
                <label>E-mail *</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="Twój adres e-mail..." />
              </div>

              <div className="space-y-1.5 text-xs font-bold text-slate-700">
                <label>Hasło * (minimum 6 znaków)</label>
                <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors" placeholder="Wpisz tajne hasło..." minLength={6} />
              </div>

              <div className="pt-4 flex justify-end border-t border-slate-100">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3.5 rounded-xl uppercase transition-colors shadow-md text-xs cursor-pointer">
                  Dalej →
                </button>
              </div>
            </form>
          )}

          {/* KROK 2: WYBÓR KARNETU */}
          {step === 2 && (
            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in">
              <h2 className="text-lg font-black text-slate-950 uppercase tracking-wider mb-2">2. Wybierz swój karnet</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {dostepneKarnety.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-slate-400 text-xs font-bold">Ładowanie karnetów...</div>
                ) : (
                  dostepneKarnety.map(k => (
                    <div 
                      key={k.id}
                      onClick={() => setSelectedPass(k)}
                      className={`relative border-2 rounded-2xl p-5 cursor-pointer transition-all shadow-sm flex flex-col justify-between h-full min-h-[140px]
                        ${selectedPass?.id === k.id 
                          ? 'border-blue-600 bg-blue-50/50' 
                          : 'border-slate-200 bg-white hover:border-blue-300'
                        }`}
                    >
                      {selectedPass?.id === k.id && (
                        <div className="absolute top-3 right-3 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
                      )}
                      <div>
                        <h4 className="font-black text-slate-900 text-base leading-tight mb-1 pr-6">{k.nazwa}</h4>
                        <div className="text-[11px] text-slate-500 font-medium space-y-0.5">
                          <p>Długość: <span className="font-bold text-slate-700">{k.dlugosc || 'Brak danych'}</span></p>
                          <p>Wejścia: <span className="font-bold text-slate-700">{k.ilosc_wejsc || k.limitWejsc || k.wejscia ? `${k.ilosc_wejsc || k.limitWejsc || k.wejscia}` : 'Bez limitu (OPEN)'}</span></p>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-200/70 flex justify-between items-end">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cena:</span>
                        <span className="font-black text-blue-700 text-lg">{k.cena} PLN</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 flex justify-between border-t border-slate-100">
                <button onClick={() => setStep(1)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3.5 rounded-xl transition-colors text-xs cursor-pointer">
                  ← Wróć
                </button>
                <button onClick={handleNextToStep3} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3.5 rounded-xl uppercase transition-colors shadow-md text-xs cursor-pointer">
                  Dalej →
                </button>
              </div>
            </div>
          )}

          {/* KROK 3: PODSUMOWANIE I FINALIZACJA */}
          {step === 3 && selectedPass && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
              <h2 className="text-lg font-black text-slate-950 uppercase tracking-wider mb-2">3. Podsumowanie</h2>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-6">
                
                {/* Info o koncie */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Twoje konto:</h4>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-full border border-slate-200 flex items-center justify-center text-xl shadow-sm">👤</div>
                    <div className="text-sm">
                      <p className="font-black text-slate-900">{firstName} {lastName}</p>
                      <p className="text-slate-500 font-medium text-xs">{email}</p>
                    </div>
                  </div>
                </div>

                {/* Info o karnecie */}
                <div className="space-y-2 pt-4 border-t border-slate-200">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wybrany pakiet:</h4>
                  <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">{selectedPass.nazwa}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Aktywacja nastąpi dzisiaj.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Do zapłaty:</p>
                      <p className="font-black text-rose-600 text-lg">{selectedPass.cena} PLN</p>
                    </div>
                  </div>
                </div>

                {/* Informacja o płatności */}
                <div className="bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-medium p-4 rounded-xl flex gap-3 leading-relaxed">
                  <span className="text-lg leading-none">💡</span>
                  <p>Po kliknięciu przycisku poniżej, Twoje konto zostanie natychmiast utworzone, a wybrany karnet dodany do profilu. Ze względu na to, że nie pobieramy jeszcze płatności online, <strong>Twoje saldo portfela będzie na minusie</strong>. Opłać zadłużenie u nas w recepcji przy pierwszej wizycie, aby móc zapisywać się na zajęcia!</p>
                </div>

              </div>

              <div className="pt-4 flex justify-between border-t border-slate-100">
                <button onClick={() => setStep(2)} disabled={isLoading} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3.5 rounded-xl transition-colors text-xs cursor-pointer disabled:opacity-50">
                  ← Wróć
                </button>
                <button onClick={handleFinalSubmit} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-3.5 rounded-xl uppercase transition-colors shadow-md text-xs cursor-pointer disabled:opacity-70 flex items-center gap-2">
                  {isLoading ? 'Tworzenie konta...' : 'Zarejestruj się i kup'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

