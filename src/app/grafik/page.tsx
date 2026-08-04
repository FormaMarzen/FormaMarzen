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

  const daysData = [
    {
      day: 'WTOREK',
      date: '04/08',
      active: true,
      classes: [
        { id: 1, time: '18:00', title: 'Brzuch', enrolled: 7, max: 12, duration: '60 min', trainer: 'Monika Ratajczak', topColor: 'border-t-rose-500' },
        { id: 2, time: '19:10', title: 'Rozciąganie i Mobilizacja', enrolled: 3, max: 9, duration: '60 min', trainer: 'Monika Ratajczak', topColor: 'border-t-emerald-500' },
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
      ]
    },
    {
      day: 'CZWARTEK',
      date: '06/08',
      active: false,
      classes: [
        { id: 7, time: '18:00', title: 'Nogi i pośladki', enrolled: 10, max: 12, duration: '60 min', trainer: 'Monika Ratajczak', topColor: 'border-t-amber-500' },
        { id: 8, time: '19:10', title: 'Rozciąganie i Mobilizacja', enrolled: 4, max: 9, duration: '60 min', trainer: 'Monika Ratajczak', topColor: 'border-t-emerald-500' },
      ]
    },
    {
      day: 'PIĄTEK',
      date: '07/08',
      active: false,
      classes: [
        { id: 9, time: '14:15', title: 'Trening SIŁOWY', enrolled: 4, max: 6, duration: '60 min', trainer: 'Maciek Kłaput', topColor: 'border-t-pink-500' },
        { id: 10, time: '16:05', title: 'Ogólnorozwojowe', enrolled: 5, max: 12, duration: '60 min', trainer: 'Maciek Kłaput', topColor: 'border-t-indigo-500' },
      ]
    }
  ];

  return (
    <div className="max-w-[1700px] mx-auto space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <button className="w-9 h-9 bg-white text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-full flex items-center justify-center font-bold shadow-sm">
          ◀
        </button>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
          {daysData.map((d, i) => (
            <div 
              key={i} 
              className={`flex justify-between items-center px-4 py-2.5 rounded-xl text-xs font-bold border ${
                d.active 
                  ? 'bg-white border-sky-300 text-sky-950 shadow-sm border-b-2 border-b-rose-500' 
                  : 'bg-sky-100/60 border-sky-200 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span>{d.day}</span>
                <span className="text-sky-600 font-normal underline decoration-dotted">{d.date} 📅</span>
              </div>
              <button className="text-slate-400 hover:text-slate-600">⋮</button>
            </div>
          ))}
        </div>

        <button className="w-9 h-9 bg-white text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-full flex items-center justify-center font-bold shadow-sm">
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
                className={`bg-white border border-sky-100 border-t-4 ${item.topColor} rounded-2xl p-4 space-y-3 hover:border-sky-300 cursor-pointer shadow-sm transition-all`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xl font-black text-slate-900">{item.time}</span>
                    <h3 className="text-xs font-bold text-slate-800 mt-0.5">{item.title}</h3>
                  </div>
                  <button className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xs">
                    ⋮
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                    👥 {item.enrolled}/{item.max}
                  </span>
                  <span className="text-slate-500 font-medium">⏱ {item.duration}</span>
                </div>

                <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2 flex items-center gap-1.5">
                  <span>👤</span> {item.trainer}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
