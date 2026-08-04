import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Forma Marzeń - Panel Admina",
  description: "System zarządzania studiem i podopiecznymi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const menuSections = [
    {
      title: "Główne",
      items: [
        { href: '/', label: 'Panel główny', icon: '📊' },
        { href: '/grafik', label: 'Grafik', icon: '📅' },
        { href: '/kreator-treningow', label: 'Kreator treningów', icon: '🛠️' },
      ]
    },
    {
      title: "Raporty",
      items: [
        { href: '/raporty/centrum', label: 'Centrum raportów', icon: '📈' },
        { href: '/raporty/transakcje', label: 'Transakcje', icon: '💳' },
        { href: '/raporty/klienci', label: 'Klienci', icon: '👥' },
        { href: '/raporty/zajecia-i-zapisy', label: 'Zajęcia i zapisy', icon: '🏋️' },
        { href: '/raporty/aktywnosc', label: 'Aktywność', icon: '🏃' },
        { href: '/raporty/inwentaryzacja', label: 'Inwentaryzacja', icon: '📦' },
        { href: '/raporty/automatyczne-zapisy', label: 'Automatyczne zapisy', icon: '⚡' },
        { href: '/raporty/trenerzy', label: 'Trenerzy', icon: '🧢' },
      ]
    },
    {
      title: "Komunikacja",
      items: [
        { href: '/komunikacja/kampanie', label: 'Kampanie', icon: '📣' },
        { href: '/komunikacja/automatyzacja', label: 'Automatyzacja', icon: '🤖' },
        { href: '/komunikacja/ogloszenia', label: 'Ogłoszenia', icon: '📢' },
        { href: '/komunikacja/historia-wiadomosci', label: 'Historia wiadomości', icon: '💬' },
      ]
    },
    {
      title: "Ustawienia",
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
      <body className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased">
        {/* Pasek boczny Admina */}
        <aside className="w-64 border-r border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between shrink-0 hidden md:flex h-screen sticky top-0 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-6 px-2 pt-2">
              <span className="text-lg font-black text-amber-500 uppercase tracking-wider">
                Forma Marzeń <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-400 font-bold ml-1">ADMIN</span>
              </span>
            </div>

            <nav className="space-y-6">
              {menuSections.map((section, idx) => (
                <div key={idx}>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2">
                    {section.title}
                  </div>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-amber-400 transition-all"
                      >
                        <span className="text-sm">{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div className="border-t border-slate-800 pt-4 px-2 flex items-center gap-3 mt-6">
            <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center font-bold text-slate-950 text-xs">
              FM
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-white truncate">Administrator</div>
              <div className="text-[10px] text-slate-400">admin@formamarzen.pl</div>
            </div>
          </div>
        </aside>

        {/* Zawartość właściwej podstrony */}
        <main className="flex-1 p-8 overflow-y-auto min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
