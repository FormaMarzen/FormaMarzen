"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../raporty/klienci/supabase';

export default function FreeRegistrationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [customLogo, setCustomLogo] = useState('');
  
  const [selectedClass, setSelectedClass] = useState<{ title: string; time: string; date: string } | null>(null);
  const [classesList, setClassesList] = useState<any[]>([]);

  // Stan formularza danych (Krok 2)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPay, setAcceptPay] = useState(false);
  const [acceptReturn, setAcceptReturn] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const savedLogo = localStorage.getItem('forma_marzen_logo');
    if (savedLogo) setCustomLogo(savedLogo);

    fetchGrafik();
  }, []);

  // Pobieranie zajęć wyłącznie z bazy danych Supabase
  const fetchGrafik = async () => {
    const { data, error } = await supabase.from('grafik').select('*');
    if (data && !error) {
      setClassesList(data);
    } else {
      setClassesList([]);
    }
  };

  const handleSelectClass = (cls: { title: string; time: string }) => {
    setSelectedClass({
      title: cls.title || cls.nazwa,
      time: cls.time || cls.godzina,
      date: '10.08.2026'
    });
    setStep(2);
  };

  const handleRegisterAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms || !acceptPay || !acceptReturn) {
      setErrorMsg('Musisz zaakceptować wszystkie wymagane zgody.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: tempPassword,
      options: {
        data: { first_name: firstName, last_name: lastName, phone: phone }
      }
    });

    if (authError) {
      setErrorMsg(authError.message);
      setIsLoading(false);
      return;
    }

    await supabase.from('klienciData').insert([
      {
        name: `${firstName} ${lastName}`,
        email: email,
        phone: phone,
        pass: `Pierwsze bezpłatne zajęcia: ${selectedClass?.title}`,
        statusText: `Zapisano na: ${selectedClass?.date} ${selectedClass?.time}`,
        statusType: 'warning'
      }
    ]);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email,
      password: tempPassword,
    });

    setIsLoading(false);

    if (loginError) {
      router.push('/login');
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start p-4 sm:p-8 font-sans antialiased text-slate-800">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-xl p-6 sm:p-8 space-y-6 my-auto">
        
        <div className="flex flex-col items-center space-y-3 text-center border-b border-slate-100 pb-6">
          <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center p-2 overflow-hidden">
            {customLogo ? (
              <img src={customLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-red-600 font-black text-xl">🏋️‍♂️</span>
            )}
          </div>
          <p className="text-xs text-slate-600 font-medium">
            Cześć, zapraszam Cię na zajęcia.<br />Myślę, że znajdziesz coś dla siebie.
          </p>

          <div className="w-full grid grid-cols-2 pt-4 text-xs font-bold border-b border-slate-200">
            <div className={`pb-2 border-b-2 ${step === 1 ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400'}`}>
              1. WYBIERZ ZAJĘCIA
            </div>
            <div className={`pb-2 border-b-2 ${step === 2 ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400'}`}>
              2. PRZEDSTAW SIĘ
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl text-center">
            ⚠️ {errorMsg}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-900 font-medium text-center">
              Cześć! Bardzo się cieszymy, że chcesz do nas dołączyć! Wybierz datę i zajęcia, na które chcesz się zapisać.
            </div>

            <div className="flex justify-between items-center bg-slate-100 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-800">
              <button className="w-7 h-7 bg-sky-500 text-white rounded-full flex items-center justify-center shadow-sm">‹</button>
              <div className="text-center">
                <div className="uppercase tracking-wider text-[11px] text-slate-600">PONIEDZIAŁEK</div>
                <div className="text-sky-600 font-black text-sm">10.08.2026</div>
              </div>
              <button className="w-7 h-7 bg-sky-500 text-white rounded-full flex items-center justify-center shadow-sm">›</button>
            </div>

            <div className="space-y-2.5 pt-2">
              {classesList.length > 0 ? (
                classesList.map((cls, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleSelectClass(cls)}
                    className="bg-white border border-slate-200 hover:border-sky-400 rounded-xl p-3.5 flex justify-between items-center cursor-pointer transition-all shadow-sm group"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-sky-600">{cls.title || cls.nazwa}</h4>
                      <span className="text-[11px] text-slate-500">• Prowadzący: {cls.trainer || cls.prowadzacy || 'Brak'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-700">{cls.time || cls.godzina}</span>
                      <span className="text-slate-400 group-hover:text-sky-600">→</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  Brak dostępnych zajęć w bazie grafiku.
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleRegisterAndLogin} className="space-y-4 text-xs">
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-900 font-medium text-center">
              Wybrane zajęcia: <span className="font-bold">{selectedClass?.title}</span>, {selectedClass?.date} o {selectedClass?.time}. Świetnie! Teraz daj nam proszę znać trochę o sobie i widzimy się na zajęciach!
            </div>

            <div className="space-y-3">
              <input 
                type="text" required placeholder="Imię *"
                value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-sky-500"
              />
              <input 
                type="text" required placeholder="Nazwisko *"
                value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-sky-500"
              />
              <input 
                type="email" required placeholder="Adres e-mail *"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-sky-500"
              />
              <input 
                type="tel" required placeholder="Numer telefonu *"
                value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-2 pt-2 text-[11px] text-slate-600">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={acceptPay} onChange={(e) => setAcceptPay(e.target.checked)} className="mt-0.5 accent-blue-600" />
                <span>Zapoznałem się i akceptuję <strong>Płatności online</strong></span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5 accent-blue-600" />
                <span>Zapoznałem się i akceptuję <strong>Regulamin klubu</strong></span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={acceptReturn} onChange={(e) => setAcceptReturn(e.target.checked)} className="mt-0.5 accent-blue-600" />
                <span>„Zapoznałem się i akceptuję rezygnację z 14-dniowego prawa do zwrotu”</span>
              </label>
            </div>

            <div className="flex gap-2 pt-3">
              <button 
                type="button" onClick={() => setStep(1)}
                className="px-4 py-3 bg-slate-200 hover:bg-slate-300 font-bold rounded-xl text-slate-700"
              >
                Wstecz
              </button>
              <button 
                type="submit" disabled={isLoading}
                className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 rounded-xl shadow-md transition-colors disabled:opacity-70"
              >
                {isLoading ? 'Zapisywanie i logowanie...' : '📅 ZAPISZ NA ZAJĘCIA'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
