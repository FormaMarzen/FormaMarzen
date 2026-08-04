"use client";

import React, { useState } from "react";
import "./globals.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuSections = [
    {
      title: "GŁÓWNE",
      items: [
        { href: '/', label: 'Panel główny', icon: '🏠' },
        { href: '/grafik', label: 'Grafik', icon: '📅' },
        { href: '/kreator-treningow', label: 'Kreator treningów', icon: '📝' },
      ]
    },
    {
      title: "RAPORTY",
      items: [
        { href: '/raporty/centrum', label: 'Centrum raportów', icon: '📈' },
        { href: '/raporty/transakcje', label: 'Transakcje', icon: '💳' },
        { href: '/raporty/klienci', label: 'Klienci', icon: '👥' },
        { href: '/raporty/zajecia-i-zapisy', label: 'Zajęcia i zapisy', icon: '📅' },
        { href: '/raporty/aktywnosc', label: 'Aktywność', icon: '🏃' },
        { href: '/raporty/inwentaryzacja', label: 'Inwentaryzacja', icon: '🚚' },
        { href: '/raporty/automatyczne-zapisy', label: 'Automatyczne zapisy', icon: '🤖' },
        { href: '/raporty/trenerzy', label: 'Trenerzy', icon: '👨‍💼' },
      ]
    },
    {
      title: "KOMUNIKACJA",
      items: [
        { href: '/komunikacja/kampanie', label: 'Kampanie', icon: '✈️' },
        { href: '/komunikacja/automatyzacja', label: 'Automatyzacja', icon: '⚡' },
        { href: '/komunikacja/ogloszenia', label: 'Ogłoszenia', icon: '📢' },
        { href: '/komunikacja/historia-wiadomosci', label: 'Historia wiadomości', icon: '💬' },
      ]
    },
    {
      title: "USTAWIENIA",
      items: [
        { href: '/ustawienia/zajecia', label: 'Zajęcia', icon: '⚙️' },
        { href: '/ustawienia/zasady-zapisow', label: 'Zasady zapisów', icon: '📋' },
        { href: '/ustawienia/rodzaje-zajec', label: 'Rodzaje zajęć', icon: '🏷️' },
        { href: '/ustawienia/karnety', label: 'Karnety', icon: '🎟️' },
        { href: '/ustawienia/magazyn', label: 'Magazyn', icon: '🏬' },
        { href: '/ustawienia/integracja-www', label: 'Integracja WWW', icon: '🌐' },
        { href: '/ustawienia/platnosci-online', label: 'Płatności online', icon: '💳' },
        { href: '/ustawienia/wysylka-wiadomosci', label: 'Wysyłka wiadomości', icon: '✉️' },
        { href: '/ustawienia/kody-rabatowe', label: 'Kody rabatowe', icon: '🏷️' },
        { href: '/ustawienia/program-ambasador', label: 'Program ambasador', icon: '⭐' },
        { href: '/ustawienia/zespol', label: 'Zespół', icon: '👨‍👧‍👦' },
        { href: '/ustawienia/wyglad', label: 'Wygląd', icon: '🎨' },
        { href: '/ustawienia/moduly', label: 'Moduły', icon: '🧩' },
        { href: '/ustawienia/platnosc-za-system', label: 'Płatność za system', icon: '🔒' },
      ]
    }
  ];

  return (
    <html lang="pl">
      <body className="min-h-screen bg-sky-50 text-slate-900 flex flex-col font-sans antialiased">
        
        {/* Górny Pasek */}
        <header className="h-16 border-b border-sky-200 bg-white/90 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-slate-700 hover:text-sky-600 rounded-lg hover:bg-sky-100 transition-all text-xl"
            >
              ☰
            </button>
            <span className="text-base font-black text-sky-600 uppercase tracking-wider">
              Forma Marzeń
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-600 text-sm">
            <button className="p-2 hover:bg-sky-100 rounded-lg">🔍</button>
            <button className="p-2 hover:bg-sky-100 rounded-lg">👤+</button>
            <button className="p-2 hover:bg-sky-100 rounded-lg">📅</button>
            <div className="w-8 h-8 bg-sky-600 rounded-full flex items-center justify-center font-bold text-white text-xs ml-2">
              FM
            </div>
          </div>
        </header>

        {/* Overlay */}
        {isMenuOpen && (
          <div 
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 transition-opacity"
          />
        )}

        {/* Wysuwane Menu Boczne */}
        <aside className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-sky-200 p-5 z-50 transform transition-transform duration-300 overflow-y-auto shadow-2xl ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex justify-between items-center pb-4 border-b border-sky-100 mb-4">
            <span className="text-lg font-black text-sky-600 uppercase tracking-wider">
              Menu Systemu
            </span>
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg text-lg"
            >
              ✕
            </button>
          </div>

          <nav className="space-y-6">
            {menuSections.map((section, idx) => (
              <div key={idx}>
                <div className="text-[10px] font-bold text-sky-800/60 uppercase tracking-wider px-2 mb-2">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-sky-100 hover:text-sky-700 transition-all"
                    >
                      <span className="text-sm">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Treść podstrony */}
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>

      </body>
    </html>
  );
}
