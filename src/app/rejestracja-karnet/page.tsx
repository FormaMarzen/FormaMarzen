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

  // Status, walidacja i modal potwierdzenia e-mail
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

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

  // --- LOGIKA WYKRYWANIA I PRZELICZANIA PRO-RATY DLA UMÓW 12M ---
  const isContractPass = (pass: any) => {
    if (!pass) return false;
    const name = (pass.nazwa || '').toLowerCase();
    const dlugosc = (pass.dlugosc || '').toLowerCase();
    return name.includes('umow') || name.includes('12m') || dlugosc.includes('1 miesi') || dlugosc.includes('1 rok');
  };

  const getPassCalculation = (pass: any) => {
    if (!pass) return { isContract: false, finalPrice: 0, finalPriceStr: '0.00 PLN', basePrice: 0, daysRemaining: 0, daysInMonth: 30, lastDayOfMonthStr: '', expiryDateStr: '' };

    const basePrice = parseFloat(pass.cena) || 0;
    const isContract = isContractPass(pass);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDate();

    // Ostatni dzień bieżącego miesiąca
    const lastDayObj = new Date(year, month + 1, 0);
    const daysInMonth = lastDayObj.getDate();
    const daysRemaining = daysInMonth - currentDay + 1;
    const lastDayOfMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    if (isContract) {
      // Wyliczenie pro-rata za pozostałe dni bieżącego miesiąca
      const proRataPrice = Number(((basePrice / daysInMonth) * daysRemaining).toFixed(2));
      return {
        isContract: true,
        finalPrice: proRataPrice,
        finalPriceStr: `${proRataPrice.toFixed(2)} PLN`,
        basePrice,
        daysRemaining,
        daysInMonth,
        lastDayOfMonthStr,
        expiryDateStr: lastDayOfMonthStr
      };
    }

    // Standardowe karnety (miesięczne, okresowe, wejściowe)
    let dniWażności = 30;
    if (pass.dlugosc) {
      const dlugoscStr = pass.dlugosc.toLowerCase();
      if (dlugoscStr.includes('1 miesiąc') || dlugoscStr.includes('miesiąc')) dniWażności = 30;
      else if (dlugoscStr.includes('3 miesiące')) dniWażności = 90;
      else if (dlugoscStr.includes('6 miesięcy')) dniWażności = 180;
      else if (dlugoscStr.includes('1 rok')) dniWażności = 365;
      else if (dlugoscStr.includes('14 dni')) dniWażności = 14;
      else if (dlugoscStr.includes('7 dni')) dniWażności = 7;
    }

    const dataWygasniecia = new Date();
    dataWygasniecia.setDate(dataWygasniecia.getDate() + dniWażności);
    const standardExpiryDateStr = dataWygasniecia.toISOString().split('T')[0];

    return {
      isContract: false,
      finalPrice: basePrice,
      finalPriceStr: `${basePrice.toFixed(2)} PLN`,
      basePrice,
      daysRemaining,
      daysInMonth,
      lastDayOfMonthStr,
      expiryDateStr: standardExpiryDateStr
    };
  };

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

      // 3. Przygotowanie danych karnetu z uwzględnieniem pro-raty dla umów
      const passCalc = getPassCalculation(selectedPass);
      const limitWejscBaza = selectedPass.ilosc_wejsc || selectedPass.limitWejsc || selectedPass.wejscia || null;
      const lowerBuyName = selectedPass.nazwa.toLowerCase();
      const isTimePass = lowerBuyName.includes('open') || lowerBuyName.includes('miesiąc') || lowerBuyName.includes('miesiac') || lowerBuyName.includes('rok') || lowerBuyName.includes('czasowy') || passCalc.isContract;

      const nowyKarnetObj = {
        id: Date.now(),
        nazwa: selectedPass.nazwa,
        waznyDo: passCalc.expiryDateStr,
        pozostaloWejsc: isTimePass ? null : (limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : null),
        poczatkoweWejsc: isTimePass ? null : (limitWejscBaza !== null ? parseInt(limitWejscBaza, 10) : null),
        cena: passCalc.finalPriceStr,
        znizkaProcentowa: '',
        rata: passCalc.isContract ? '0 / 12' : '1 / 1',
        statusTekst: `Ważny do: ${passCalc.expiryDateStr}`,
        blokadaDo: null,
        powodBlokady: null,
        zawieszonyOd: null,
        zawieszonyDo: null,
        historiaZawieszen: []
      };

      const ujemnyPortfelStr = `-${passCalc.finalPrice.toFixed(2)} PLN`;
      const newClientId = Date.now();

      // 4. Zapis do bazy danych 'klienci' z unikalnym ID numerycznym
      const payload: any = {
        id: newClientId,
        'Imię': firstName,
        'Nazwisko': lastName,
        'E-mail': email,
        'Numer tel.': phone,
        'Zarejestrowany': new Date().toISOString().split('T')[0],
        'karnetyKlubowicza': JSON.stringify([nowyKarnetObj]),
        'Portfel': ujemnyPortfelStr,
        'Cena': passCalc.finalPriceStr,
        'Wygasa': passCalc.expiryDateStr
      };

      const { error: dbError } = await supabase.from('klienci').insert([payload]);

      if (dbError) {
        throw new Error(`Błąd zapisu do bazy klientów: ${dbError.message}`);
      }

      // 5. Dodanie wpisu do tabeli 'transakcje'
      if (passCalc.finalPrice > 0) {
        const opisTransakcji = passCalc.isContract
          ? `Rejestracja z zakupem karnetu (Umowa 12M - wyrównanie pro-rata za ${passCalc.daysRemaining} dni): ${selectedPass.nazwa}`
          : `Rejestracja z zakupem karnetu: ${selectedPass.nazwa}`;

        await supabase.from('transakcje').insert([{
          klient_id: newClientId,
          typ_operacji: 'zakup_karnetu',
          kwota: -passCalc.finalPrice,
          opis: opisTransakcji
        }]);
      } else {
        await supabase.from('transakcje').insert([{
          klient_id: newClientId,
          typ_operacji: 'utworzenie_konta',
          kwota: 0.00,
          opis: `Rejestracja z darmowym karnetem: ${selectedPass.nazwa}`
        }]);
      }

      // 6. Powiadomienie na czacie dla administratora (ID 5000)
      await supabase.from('czat_wiadomosci').insert([
        {
          nadawca_id: 5000,
          nadawca_nazwa: 'System / Administrator',
          odbiorca_id: 5000,
          tresc: `Nowy użytkownik zarejestrowany z zakupem karnetu (${selectedPass.nazwa}): ${firstName} ${lastName} (${email}, tel: ${phone})`,
          przeczytana: false
        }
      ]);

      setIsLoading(false);
      setIsSuccessModalOpen(true);

    } catch (err: any) {
      setErrorMsg(err.message || 'Wystąpił nieoczekiwany błąd.');
      setIsLoading(false);
    }
  };

  const handleModalConfirmRedirect = () => {
    setIsSuccessModalOpen(false);
    router.push('/login');
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
                {dostepneKarnety.map(k => {
                  const isSelected = selectedPass?.id === k.id;
                  const calc = getPassCalculation(k);

                  return (
                    <div 
                      key={k.id} 
                      onClick={() => setSelectedPass(k)} 
                      className={`relative border-2 rounded-2xl p-5 cursor-pointer transition-all shadow-sm flex flex-col justify-between ${isSelected ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 bg-white hover:border-blue-300'}`}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          ✓
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-black text-slate-900 text-sm">{k.nazwa}</h4>
                          {calc.isContract && (
                            <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                              Umowa 12M
                            </span>
                          )}
                        </div>

                        {calc.isContract ? (
                          <div className="mt-2 space-y-1">
                            <div className="text-[11px] text-slate-500 font-medium">
                              Cena abonamentu: <span className="font-bold text-slate-700">{calc.basePrice.toFixed(2)} PLN / mies.</span>
                            </div>
                            <div className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2 mt-1">
                              Wyrównanie za bieżący m-c ({calc.daysRemaining} dni): <span className="text-sm font-black">{calc.finalPriceStr}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="font-black text-blue-700 text-lg mt-2">{calc.finalPriceStr}</p>
                        )}
                      </div>

                      {k.dlugosc && (
                        <div className="text-[10px] text-slate-400 font-semibold mt-3 pt-2 border-t border-slate-100">
                          ⏱ Czas trwania: {k.dlugosc}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="pt-4 flex justify-between border-t border-slate-100">
                <button onClick={() => setStep(1)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-3.5 rounded-xl text-xs cursor-pointer">← Wróć</button>
                <button onClick={handleNextToStep3} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3.5 rounded-xl uppercase text-xs cursor-pointer">Dalej →</button>
              </div>
            </div>
          )}

          {/* KROK 3 */}
          {step === 3 && selectedPass && (() => {
            const passCalc = getPassCalculation(selectedPass);

            return (
              <div className="space-y-6 animate-in slide-in-from-right-4 fade-in">
                <h2 className="text-lg font-black text-slate-950 uppercase tracking-wider mb-2">3. Potwierdzenie i zgody</h2>
                
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-700 flex justify-between items-center">
                      <span>Wybrany karnet:</span>
                      <span className="text-blue-900 font-black text-sm">{selectedPass.nazwa}</span>
                    </div>

                    {passCalc.isContract ? (
                      <div className="bg-white border border-amber-200 rounded-xl p-3.5 space-y-2 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Standardowa opłata miesięczna:</span>
                          <span className="font-bold text-slate-800">{passCalc.basePrice.toFixed(2)} PLN / m-c</span>
                        </div>
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>Wyrównanie pro-rata za bieżący miesiąc ({passCalc.daysRemaining} dni):</span>
                          <span>{passCalc.finalPriceStr}</span>
                        </div>
                        <div className="flex justify-between text-slate-900 font-black text-xs pt-1.5 border-t border-amber-200">
                          <span>Do zapłaty dzisiaj przy rejestracji:</span>
                          <span className="text-emerald-700 text-sm">{passCalc.finalPriceStr}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 italic pt-1">
                          Kolejne pełne opłaty będą naliczane od 1. dnia kolejnego miesiąca.
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between text-xs font-bold text-slate-700 pt-1 border-t border-slate-200">
                        <span>Do zapłaty:</span>
                        <span className="text-blue-700 font-black text-sm">{passCalc.finalPriceStr}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Dynamiczne regulaminy */}
                  <div className="space-y-2.5 pt-2 text-[11px] text-slate-600 border-t border-slate-200 mt-2 pt-4">
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
                  <button onClick={handleFinalSubmit} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-3.5 rounded-xl uppercase text-xs cursor-pointer disabled:opacity-70 shadow-md">
                    {isLoading ? 'Tworzenie konta...' : `Zarejestruj się i kup (${passCalc.finalPriceStr})`}
                  </button>
                </div>
              </div>
            );
          })()}
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

      {/* Modal potwierdzenia rejestracji i weryfikacji e-mail */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 text-center space-y-5 shadow-2xl border border-sky-200">
            <div className="w-16 h-16 bg-sky-100 text-sky-700 border-2 border-sky-300 rounded-full flex items-center justify-center text-3xl mx-auto shadow-inner">
              ✉️
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                Potwierdź swój adres e-mail!
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Twoje konto zostało pomyślnie utworzone. Przed pierwszym zalogowaniem <strong className="text-slate-900">musisz potwierdzić swój adres e-mail</strong>, klikając w link aktywacyjny, który właśnie wysłaliśmy na:
              </p>
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5 font-mono font-bold text-sky-950 text-xs break-all">
                {email}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 font-medium text-left">
              ℹ️ Sprawdź także folder <strong>SPAM</strong> lub <strong>Oferty</strong>, jeśli wiadomość nie pojawi się w skrzynce odbiorczej w ciągu minuty.
            </div>

            <button
              onClick={handleModalConfirmRedirect}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-xl uppercase text-xs tracking-wider transition-colors shadow-md cursor-pointer"
            >
              Rozumiem, przejdź do logowania →
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
