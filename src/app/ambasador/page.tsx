"use client";

import React from "react";

export default function SklepPage() {
  return (
    <div className="max-w-6xl mx-auto flex flex-col items-center justify-center min-h-[70vh] animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl p-12 border border-sky-100 shadow-sm text-center max-w-lg w-full space-y-4">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mx-auto text-3xl font-black shadow-inner">
          🛒
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-sky-950 uppercase tracking-tight">
          Sklep
        </h1>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest pt-2">
          Wkrótce
        </p>
      </div>
    </div>
  );
}