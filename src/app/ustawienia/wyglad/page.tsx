"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../raporty/klienci/supabase';

export default function AppearanceSettingsPage() {
  const [logoUrl, setLogoUrl] = useState('');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [primaryColor, setPrimaryColor] = useState('Blue');
  const [secondaryColor, setSecondaryColor] = useState('Red');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Pobieranie obecnych ustawień przy załadowaniu
  useEffect(() => {
    const savedLogo = localStorage.getItem('forma_marzen_logo');
    if (savedLogo) setLogoUrl(savedLogo);
  }, []);

  // Obsługa wgrywania pliku graficznego jako logo
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoUrl(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    // Zapisujemy logo w localStorage (lub w bazie Supabase, jeśli wolisz)
    if (logoUrl) {
      localStorage.setItem('forma_marzen_logo', logoUrl);
    }
    setTimeout(() => {
      setIsSaving(false);
      setMessage('Zapisano pomyślnie!');
      setTimeout(() => setMessage(''), 3000);
    }, 500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <h1 className="text-xl font-bold text-slate-900 tracking-wider">WYGLĄD</h1>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        
        {message && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold p-3 rounded-xl text-center">
            ✨ {message}
          </div>
        )}

        {/* Sekcja Logo */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center border-b border-slate-100 pb-6">
          <div className="md:col-span-2 text-xs font-bold text-slate-700 uppercase">Logo</div>
          <div className="md:col-span-5 flex justify-center">
            <div className="w-44 h-32 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center p-2 bg-slate-50 relative overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo klubu" className="max-h-full max-w-full object-contain" />
              ) : (
                <div className="text-red-600 font-black text-3xl">🏋️‍♂️</div>
              )}
            </div>
          </div>
          <div className="md:col-span-5 flex flex-col justify-center">
            <label className="cursor-pointer bg-rose-900 hover:bg-rose-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider text-center shadow-sm transition-colors flex items-center justify-center gap-2">
              <span>🖼️</span> WYBIERZ OBRAZEK
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
            <span className="text-[10px] text-slate-400 mt-2 text-center">Zalecany format PNG lub JPG</span>
          </div>
        </div>

        {/* Kolor tła */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center border-b border-slate-100 pb-6 text-xs">
          <div className="md:col-span-2 font-bold text-slate-700">Kolor tła</div>
          <div className="md:col-span-10 flex items-center gap-3">
            <input 
              type="text" 
              value={bgColor} 
              onChange={(e) => setBgColor(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-700 w-32 focus:outline-none" 
            />
          </div>
        </div>

        {/* Kolor przewodni */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center border-b border-slate-100 pb-6 text-xs">
          <div className="md:col-span-2 font-bold text-slate-700">Kolor przewodni: blue</div>
          <div className="md:col-span-10">
            <select 
              value={primaryColor} 
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-full md:w-64 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none"
            >
              <option>Blue</option>
              <option>Indigo</option>
              <option>Sky</option>
            </select>
          </div>
        </div>

        {/* Kolor drugoplanowy */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pb-2 text-xs">
          <div className="md:col-span-2 font-bold text-slate-700">Kolor drugoplanowy: red</div>
          <div className="md:col-span-10">
            <select 
              value={secondaryColor} 
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="w-full md:w-64 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none"
            >
              <option>Red</option>
              <option>Rose</option>
              <option>Amber</option>
            </select>
          </div>
        </div>

        {/* Przycisk Zapisz */}
        <div className="pt-4">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-2.5 px-8 rounded-xl text-xs uppercase tracking-wider shadow-md transition-colors cursor-pointer"
          >
            {isSaving ? 'Zapisywanie...' : 'ZAPISZ'}
          </button>
        </div>

      </div>
    </div>
  );
}
