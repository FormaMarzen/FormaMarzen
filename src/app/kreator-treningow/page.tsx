"use client";

import React, { useState } from 'react';

interface TrainingPlan {
  id: number;
  day: string;
  title: string;
  type: string;
  notes: string;
  resultStatus: string;
  color: string;
}

export default function WorkoutCreatorPage() {
  const [selectedDate, setSelectedDate] = useState('2026-08-04');
  const [filterPlan, setFilterPlan] = useState('WSZYSTKIE PLANY');
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeDay, setActiveDay] = useState('');

  // Przykładowe zaplanowane treningi
  const [plans, setPlans] = useState<TrainingPlan[]>([
    {
      id: 1,
      day: '07/08', // Piątek
      title: 'Klatka i triceps',
      type: 'Trening SIŁOWY',
      notes: 'Klatka i triceps',
      resultStatus: 'Wynik: Brak pomiaru',
      color: 'bg-pink-500/20 border-pink-500/40 text-pink-200'
    }
  ]);

  const days = [
    { name: 'WTOREK', date: '04/08' },
    { name: 'ŚRODA', date: '05/08' },
    { name: 'CZWARTEK', date: '06/08' },
    { name: 'PIĄTEK', date: '07/08' },
  ];

  const handleOpenAdd = (dateStr: string) => {
    setActiveDay(dateStr);
    setShowAddModal(true);
  };

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-20">
      
      {/* Pasek Wyboru Daty i Filtra */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <span className="text-xl">📅</span>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <select 
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500"
          >
            <option>WSZYSTKIE PLANY</option>
            <option>Trening SIŁOWY</option>
            <option>Trening HYROX / FBW</option>
            <option>Mobilizacja / Cardio</option>
          </select>

          <button 
            onClick={() => handleOpenAdd('04/08')}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-all"
          >
            + NOWY PLAN
          </button>
        </div>
      </div>

      {/* Nagłówek Dni Tygodnia z nawigacją strzałkami */}
      <div className="flex items-center gap-2">
        <button className="w-9 h-9 bg-rose-900/40 text-rose-400 hover:bg-rose-900 border border-rose-500/20 rounded-full flex items-center justify-center font-bold shrink-0">
          ◀
        </button>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
          {days.map((d, i) => (
            <div key={i} className="bg-slate-900/80 border border-slate-800 py-2.5 px-4 rounded-xl text-center">
              <span className="text-xs font-extrabold uppercase text-slate-300 tracking-wider">
                {d.name}
              </span>
              <span className="text-xs font-semibold text-amber-500 ml-2">
                {d.date}
              </span>
            </div>
          ))}
        </div>

        <button className="w-9 h-9 bg-rose-900/40 text-rose-400 hover:bg-rose-900 border border-rose-500/20 rounded-full flex items-center justify-center font-bold shrink-0">
          ▶
        </button>
      </div>

      {/* Kolumny Dni z Treningami i Przyciskami Plus (+) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start min-h-[400px]">
        {days.map((d, i) => {
          const dayPlans = plans.filter(p => p.day === d.date);

          return (
            <div key={i} className="space-y-4 flex flex-col items-center">
              
              {/* Istniejące plany w danym dniu */}
              {dayPlans.map(plan => (
                <div 
                  key={plan.id}
                  className={`w-full border rounded-2xl p-4 space-y-3 shadow-lg ${plan.color}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-sm text-white">{plan.title}</h4>
                      <span className="text-[11px] font-semibold opacity-80">{plan.type}</span>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100">
                      <button className="p-1 hover:text-white">📊</button>
                      <button className="p-1 hover:text-white">✏️</button>
                      <button className="p-1 hover:text-white">⋮</button>
                    </div>
                  </div>

                  <div className="text-xs pt-2 border-t border-white/10 space-y-1">
                    <p className="font-medium">{plan.notes}</p>
                    <p className="text-[11px] text-amber-300 underline decoration-dotted font-semibold cursor-pointer">
                      {plan.resultStatus}
                    </p>
                  </div>
                </div>
              ))}

              {/* Przycisk dodawania planu na dany dzień */}
              <button 
                onClick={() => handleOpenAdd(d.date)}
                className="w-10 h-10 bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/40 rounded-full flex items-center justify-center font-bold text-lg transition-all shadow-md mt-2"
              >
                +
              </button>

            </div>
          );
        })}
      </div>

      {/* Modal Tworzenia Treningu */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Dodaj plan na dzień {activeDay}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Nazwa Treningu</label>
                <input 
                  type="text" 
                  placeholder="np. Klatka i triceps" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Kategoria / Typ</label>
                <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-500">
                  <option>Trening SIŁOWY</option>
                  <option>Trening HYROX</option>
                  <option>FBW / Ogólnorozwojowy</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Opis / Ćwiczenia</label>
                <textarea 
                  rows={3} 
                  placeholder="Wpisz serie, powtórzenia i ciężary..." 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Anuluj</button>
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold">Przypisz Plan</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
