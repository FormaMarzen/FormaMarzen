"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/app/raporty/klienci/supabase";

export default function AdminCalendarReportPage() {
  const [trainers, setTrainers] = useState<string[]>([]);
  const [classTypes, setClassTypes] = useState<string[]>([]);
  
  const [selectedTrainer, setSelectedTrainer] = useState("Wszyscy");
  const [selectedType, setSelectedType] = useState("Wszystkie");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: grafik } = await supabase.from('grafik_zajec').select('trainer, title');
    const { data: jednorazowe } = await supabase.from('zajecia_jednorazowe').select('trainer, title');
    const { data: trenerzyList } = await supabase.from('trenerzy').select('imie_nazwisko');

    const trainerSet = new Set<string>();
    const typeSet = new Set<string>();

    trenerzyList?.forEach((t: any) => { if (t.imie_nazwisko) trainerSet.add(t.imie_nazwisko); });
    grafik?.forEach((g: any) => {
      if (g.trainer) trainerSet.add(g.trainer);
      if (g.title) typeSet.add(g.title);
    });
    jednorazowe?.forEach((j: any) => {
      if (j.trainer) trainerSet.add(j.trainer);
      if (j.title) typeSet.add(j.title);
    });

    setTrainers(Array.from(trainerSet));
    setClassTypes(Array.from(typeSet));
  };

  const icsUrl = `${origin}/api/calendar?admin=true&trainer=${encodeURIComponent(selectedTrainer)}&type=${encodeURIComponent(selectedType)}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(icsUrl);
    alert("Link ICS został skopiowany do schowka!");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white border border-sky-200 rounded-3xl p-6 md:p-8 shadow-sm">
        <h1 className="text-base font-black text-sky-950 uppercase tracking-wider mb-2 flex items-center gap-2">
          <span>📅</span> Eksport kalendarza ICS (Administrator)
        </h1>
        <p className="text-xs text-slate-500 mb-6">
          Tutaj możesz wygenerować spersonalizowany link subskrypcji kalendarza dla administratora, przefiltrowany według wybranego trenera lub konkretnego rodzaju zajęć na najbliższe 30 dni.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6">
          <div className="space-y-1">
            <label className="font-bold text-slate-700 block">Filtruj po trenerze:</label>
            <select
              value={selectedTrainer}
              onChange={(e) => setSelectedTrainer(e.target.value)}
              className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="Wszyscy">Wszyscy trenerzy</option>
              {trainers.map((t, idx) => (
                <option key={idx} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 block">Filtruj po rodzaju zajęć:</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="Wszystkie">Wszystkie rodzaje zajęć</option>
              {classTypes.map((ct, idx) => (
                <option key={idx} value={ct}>{ct}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-sky-100">
          <label className="font-bold text-slate-900 text-xs">Wygenerowany link subskrypcji (URL ICS):</label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input 
              type="text" 
              readOnly 
              value={icsUrl}
              className="flex-1 bg-sky-50 border border-sky-200 rounded-xl px-3.5 py-2.5 font-mono text-xs text-slate-700 focus:outline-none"
            />
            <button 
              onClick={copyToClipboard}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2.5 rounded-xl transition-colors shadow-sm text-xs uppercase tracking-wider cursor-pointer shrink-0"
            >
              Kopiuj link
            </button>
            <a 
              href={icsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-sky-900 hover:bg-sky-950 text-white font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm text-xs cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
            >
              <span>📥</span> Pobierz .ics
            </a>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Wklej ten link do aplikacji kalendarza w telefonie lub komputerze (np. Apple Calendar, Google Calendar), aby subskrybować wybrane zajęcia w czasie rzeczywistym.
          </p>
        </div>
      </div>
    </div>
  );
}
