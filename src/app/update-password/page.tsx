"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../raporty/klienci/supabase';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [customLogo, setCustomLogo] = useState('');
  const [logoError, setLogoError] = useState(false);

  const router = useRouter();

  useEffect(() => {
    // Wsparcie dla dynamicznego logotypu z localStorage
    const savedLogo = localStorage.getItem('forma_marzen_logo');
    if (savedLogo) {
      setCustomLogo(savedLogo);
    }
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setMessage('Wprowadzone hasła nie są identyczne.');
      setIsSuccess(false);
      return;
    }

    if (password.length < 6) {
      setMessage('Nowe hasło musi mieć co najmniej 6 znaków.');
      setIsSuccess(false);
      return;
    }

    setIsLoading(true);
    setMessage('');

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    setIsLoading(false);

    if (error) {
      setMessage('Błąd aktualizacji hasła: ' + error.message);
      setIsSuccess(false);
    } else {
      setIsSuccess(true);
      setMessage('Hasło zostało pomyślnie zmienione! Za chwilę nastąpi przekierowanie do logowania...');
      setTimeout(() => {
        router.push('/');
      }, 3500);
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

        {/* Główny formularz zmiany hasła */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <h2 className="text-xl font-black text-slate-950">Ustaw nowe hasło</h2>

          {message && (
            <div className={`p-3 rounded-xl text-xs font-bold text-center border ${
              isSuccess 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              {isSuccess ? '✅ ' : '⚠️ '} {message}
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
            <div className="space-y-1 relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                placeholder="Nowe hasło"
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

            <div className="space-y-1">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                placeholder="Potwierdź nowe hasło"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-sm"
              />
            </div>

            <button 
              type="submit"
              disabled={isLoading || isSuccess}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md text-sm mt-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Zapisywanie...' : 'Zaktualizuj hasło'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
