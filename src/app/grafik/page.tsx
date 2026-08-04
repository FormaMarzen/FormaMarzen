"use client";

import React, { useState } from 'react';

interface ClassItem {
  id: number;
  time: string;
  title: string;
  enrolled: number;
  max: number;
  duration: string;
  trainer: string;
  topColor: string;
}

export default function SchedulePage() {
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const daysData = [
    {
      day: 'WTOREK',
      date: '04/08',
      active: true,
      classes: [
        { id: 1, time: '18:00', title: 'Brzuch', enrolled: 7, max: 12, duration: '60 min', trainer: 'Monika Ratajczak', topColor: 'border-t-rose-500' },
        { id: 2, time: '19:10', title: 'Rozciąganie i Mobilizacja', enrolled: 3, max: 9, duration: '60 min', trainer: 'Monika Ratajczak', topColor: 'border-t-emerald-400' },
      ]
    },
    {
      day: 'ŚRODA',
      date: '05/08',
      active: false,
      classes: [
        { id: 3, time: '16:05', title: 'Ogólnorozwojowe', enrolled: 8, max: 12, duration: '60 min', trainer: 'Maciek Kłaput', topColor: 'border-t-indigo-500' },
        { id: 4, time: '17:15', title: 'TRENING PERSONALNY', enrolled: 0, max: 1, duration: '60 min', trainer: 'Monika Ratajczak', topColor: 'border-t-indigo-500' },
        { id: 5, time: '18:25', title: 'Ogólnorozwojowe', enrolled: 4, max: 12, duration: '60 min', trainer: 'Maciek Kłaput', topColor: 'border-t-indigo-500' },
        { id: 6, time: '19:35', title: 'Ogólnorozwojowe', enrolled: 9, max: 12, duration: '60 min', trainer: 'Maciek Kłaput', topColor: 'border-t-indigo-500' },
        { id: 7, time: '20:30', title: 'Rozciąganie i Mobilizacja', enrolled: 5, max: 9, duration: '60 min', trainer: 'Monika Ratajczak', topColor: 'border-t-emerald-400' },
      ]
    },
    {
      day: 'CZWARTEK',
      date: '06/08',
      active: false,
      classes: [
        { id: 8, time: '18:00', title: 'Nogi i pośladki', enrolled: 10, max: 12, duration: '60 min', trainer: 'Monika Ratajczak', topColor: 'border-t-amber-400' },
        { id: 9, time: '19:10', title: 'Rozciąganie i Mobilizacja', enrolled: 4, max: 9, duration: '60 min', trainer: 'Monika Ratajczak', topColor: 'border-t-emerald-400' },
      ]
    },
    {
      day: 'PIĄTEK',
      date: '07/08',
      active: false,
      classes: [
        { id: 10, time: '14:15', title: 'Trening SIŁOWY', enrolled: 4, max: 6, duration: '60 min', trainer: 'Maciek Kłaput', topColor: 'border-t-pink-500' },
        { id: 11, time: '16:05', title: 'Ogólnorozwojowe', enrolled: 5, max: 12, duration: '60 min', trainer: 'Maciek Kłaput', topColor: 'border-t-indigo-500' },
        { id: 12, time: '18:25', title: 'Ogólnorozwojowe', enrolled: 2, max: 12, duration: '60 min', trainer: 'Maciek Kłaput', topColor: 'border-t-indigo-500' },
        { id: 13, time: '19:35', title: 'Ogólnorozwojowe', enrolled: 5, max: 12, duration: '60 min', trainer: 'Maciek Kłaput', topColor: 'border-t-indigo-500' },
      ]
    }
  ];

  return (
    <div className="max-w-[1700px] mx-auto space-y-4 pb-24 relative">
      <div className="flex items-center gap-2">
        <button className="w-9 h-9 bg-rose-900/40 text-rose-400 hover:bg-rose-900 border border-rose-500/20 rounded-full flex items-center justify-center font-bold shrink-0 transition-all">
          ◀
        </button>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
          {daysData.map((d, i) => (
            <div 
              key={i} 
              className={`flex justify-between items-center px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                d.active 
                  ? 'bg-slate-900 border-slate-700 text-slate-200 border-b-2 border-b-rose-500' 
                  : 'bg-slate-950/40 border-slate-900 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span>{d.day}</span>
                <span className="text-slate-500 font-normal underline decoration-dotted">{d.date} 📅</span>
              </div>
              <button className="text-slate-500 hover:text-slate-300">⋮</button>
            </div>
          ))}
        </div>

        <button className="w-9 h-9 bg-rose-900/40 text-rose-400 hover:bg-rose-900 border border-rose-500/20 rounded-full flex items-center justify-center font-bold shrink-0 transition-all">
          ▶
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {daysData.map((col, idx) => (
          <div key={idx} className="space-y-3">
            {col.classes.map((item) => (
              <div 
                key={item.id}
                onClick={() => setSelectedClass(item)}
                className={`bg-slate-900 border border-slate-800 border-t-4 ${item.topColor} rounded-2xl p-4 space-y-3 hover:border-slate-700 cursor-pointer transition-all shadow-md`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xl font-black text-white">{item.time}</span>
                    <h3 className="text-xs font-bold text-slate-300 mt-0.5">{item.title}</h3>
                  </div>
                  <button className="w-6 h-6 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center text-xs">
                    ⋮
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className="bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/20">
                    👥 {item.enrolled}/{item.max}
                  </span>
                  <span className="text-slate-400">⏱ {item.duration}</span>
                </div>

                <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 flex items-center gap-1.5">
                  <span>👤</span> {item.trainer}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <button 
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 left-8 w-13 h-13 bg-rose-900 hover:bg-rose-800 text-white rounded-full flex items-center justify-center shadow-2xl text-xl font-bold border border-rose-500/30 z-30"
      >
        ≡
      </button>

      {selectedClass && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-bold text-amber-500">{selectedClass.time} • {selectedClass.duration}</span>
                <h2 className="text-lg font-bold text-white">{selectedClass.title}</h2>
                <p className="text-xs text-slate-400">Prowadzący: {selectedClass.trainer}</p>
              </div>
              <button onClick={() => setSelectedClass(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="text-xs text-slate-400">
              Miejsca: <span className="text-emerald-400 font-bold">{selectedClass.enrolled}/{selectedClass.max}</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setSelectedClass(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold">Zamknij</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
