"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../raporty/klienci/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [customLogo, setCustomLogo] = useState('');
  const [logoError, setLogoError] = useState(false); 
  
  // Stany dla odzyskiwania hasła
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    // Bezpieczny odczyt dynamicznego logotypu z localStorage
    try {
      const savedLogo = typeof window !== 'undefined' ? localStorage.getItem('forma_marzen_logo') : null;
      if (savedLogo) {
        setCustomLogo(savedLogo);
      }
    } catch (e) {
      console.warn('Brak dostępu do localStorage:', e);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail || !cleanPassword) {
      setErrorMsg('Wprowadź adres e-mail i hasło.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        setErrorMsg('Nieprawidłowy e-mail lub hasło.');
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Asynchroniczna inkrementacja licznika logowań bez blokowania nawigacji
        const currentCount = Number(data.user.user_metadata?.sign_in_count || 0) + 1;
        supabase.auth.updateUser({
          data: { sign_in_count: currentCount }
        }).catch((err) => console.error('Błąd aktualizacji licznika logowań:', err));

        window.location.href = '/';
      }
    } catch (err: any) {
      console.error('Nieoczekiwany błąd logowania:', err);
      setErrorMsg('Wystąpił nieoczekiwany błąd. Spróbuj ponownie.');
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanResetEmail = resetEmail.trim().toLowerCase();

    if (!cleanResetEmail) {
      alert("Wpisz adres e-mail.");
      return;
    }
    
    setIsResetLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanResetEmail, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      
      if (error) {
        alert("Błąd: " + error.message);
      } else {
        alert("Sprawdź skrzynkę e-mail. Wysłaliśmy link do zresetowania hasła.");
        setIsResetModalOpen(false);
        setResetEmail('');
      }
    } catch (err: any) {
      console.error('Błąd resetowania hasła:', err);
      alert("Wystąpił błąd podczas wysyłania linku.");
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-8 font-sans antialiased text-slate-800 relative overflow-hidden">
      
      {/* Tło dekoracyjne */}
      <div className="absolute top-0 right-0 w-96 h-96 opacity-10 pointer-events-none">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <path fill="#0284c7" d="M44.7,-76.4C58.8,-69.3,71.8,-59.1,81.1,-46C90.4,-32.9,96,-16.5,95.5,-0.6C95,15.3,88.4,30.7,79.1,43.8C69.8,56.9,57.7,67.7,43.9,75.9C30.1,84.1,14.5,89.7,-0.7,90.8C-16,91.9,-31.9,88.4,-45.9,80.3C-59.9,72.2,-71.9,59.5,-80.4,45C-88.9,30.5,-93.8,14.3,-93.2,-1.4C-92.5,-17.1,-86.3,-32.3,-76.7,-44.9C-67.1,-57.5,-54.2,-67.5,-40.1,-74.7C-26,-81.9,-10.8,-86.3,3.3,-91.5C17.4,-96.7,30.6,-83.5,44.7,-76.4Z" transform="translate(100 100)" />
        </svg>
      </div>

      <div className="w-full max-w-md space-y-6 z-10">
        
        {/* Logo i nazwa klubu */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-20 h-20 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center p-2 overflow-hidden">
            {customLogo ? (
              <img src={customLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : !logoError ? (
              <img 
                src="/logo.png" 
                alt="Forma Marzeń Logo" 
                className="max-h-full max-w-full object-contain"
                onError={() => setLogoError(true)} 
              />
            ) : (
              <div className="text-red-600 font-black text-2xl flex flex-col items-center">
                <span>🏋️‍♂️</span>
              </div>
            )}
          </div>
          <h1 className="text-base font-bold text-slate-900 tracking-wide">Forma Marzeń</h1>
        </div>

        {/* Główny formularz logowania */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <h2 className="text-xl font-black text-slate-950">Zaloguj się</h2>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3 rounded-xl text-center">
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div className="space-y-1">
              <input 
                type="email" 
                required
                placeholder="Adres email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-sm"
              />
            </div>

            <div className="space-y-1 relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                placeholder="Hasło"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-sm pr-10"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-sky-600 transition-colors cursor-pointer text-base"
                title={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
                <span className="text-slate-600 font-medium">Zapamiętaj mnie</span>
              </label>
              <button 
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="text-sky-600 hover:text-sky-700 font-semibold transition-colors bg-transparent border-none cursor-pointer"
              >
                Zapomniałeś hasła?
              </button>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md text-sm mt-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Logowanie...' : 'Zaloguj'}
            </button>
          </form>
        </div>

        {/* Dolny boks informacyjny */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-2 text-xs text-slate-600">
          <p className="font-medium">Nie posiadasz jeszcze konta? Nie ma problemu:</p>
          <ul className="space-y-1 pl-1">
            <li 
              onClick={() => router.push('/rejestracja')} 
              className="flex items-center gap-2 text-sky-600 hover:underline cursor-pointer transition-colors"
            >
              <span className="w-1.5 h-1.5 bg-sky-600 rounded-full"></span> Zapisz się na pierwsze zajęcia bez kupna karnetu
            </li>
            <li 
              onClick={() => router.push('/rejestracja-karnet')} 
              className="flex items-center gap-2 text-blue-600 font-bold hover:underline cursor-pointer transition-colors"
            >
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span> Zarejestruj konto klubowicza i kup karnet
            </li>
          </ul>
        </div>
      </div>

      {/* MODAL RESETOWANIA HASŁA */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-4 border border-sky-200">
            <h3 className="font-black text-lg text-slate-900">Zresetuj hasło</h3>
            <p className="text-xs text-slate-500 font-medium">Wpisz swój e-mail, a wyślemy Ci instrukcje.</p>
            
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input 
                type="email" 
                required
                placeholder="Twój adres e-mail" 
                value={resetEmail} 
                onChange={(e) => setResetEmail(e.target.value)} 
                className="w-full p-3 border rounded-xl text-sm border-slate-300 focus:outline-none focus:border-sky-500 font-medium" 
              />
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsResetModalOpen(false)} 
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Anuluj
                </button>
                <button 
                  type="submit" 
                  disabled={isResetLoading} 
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black cursor-pointer transition-colors disabled:opacity-50"
                >
                  {isResetLoading ? 'Wysyłanie...' : 'Wyślij link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
