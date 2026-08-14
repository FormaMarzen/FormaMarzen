"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import "./globals.css";

import AuthGuard from "../components/AuthGuard";
import { supabase } from "./raporty/klienci/supabase";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [activeTabModal, setActiveTabModal] = useState<'klubowicz' | 'gosc' | 'rodzina'>('klubowicz');
  
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [appRole, setAppRole] = useState<'admin' | 'klubowicz'>('klubowicz');
  const [isMounted, setIsMounted] = useState(false);

  const [profileName, setProfileName] = useState('Ładowanie...');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('-');
  const [profileBirth, setProfileBirth] = useState('');
  const [profileLang, setProfileLang] = useState('Polski');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);

  const [dostepneKarnety, setDostepneKarnety] = useState<any[]>([]);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPage = pathname === '/login' || pathname?.startsWith('/rejestracja');

  useEffect(() => {
    setIsMounted(true);

    const checkAuthAndRole = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (!session?.user) {
        if (!isPublicPage) {
          router.push('/login');
        }
        return;
      }

      if (session?.user) {
        const userEmail = session.user.email || '';
        setProfileEmail(userEmail);
        
        if (userEmail === 'maciejklaput@gmail.com') {
          setAppRole('admin');
          setProfileName('Maciej Kłaput');
        } else {
          setAppRole('klubowicz');
          const { data: klientData } = await supabase
            .from('klienci')
            .select('Imię, Nazwisko, "Numer tel.", Urodziny, avatarUrl')
            .eq('E-mail', userEmail)
            .single();

          if (klientData) {
            const k = klientData as any;
            setProfileName(`${k.Imię} ${k.Nazwisko}`);
            setProfilePhone(k['Numer tel.'] || '-');
            setProfileBirth(k.Urodziny || '');
            if (k.avatarUrl) setProfileAvatar(k.avatarUrl);
          } else {
            setProfileName(userEmail.split('@')[0]);
          }
        }
      }
    };

    const fetchKarnetyFromSupabase = async () => {
      const { data, error } = await supabase.from('karnety').select('*');
      if (data && !error) {
        const ustrukturyzowaneKarnety = data.map((k: any) => ({
          ...k,
          cena: k.cena_brutto || k.cena || '0.00',
          limitCzasowy: k.dlugosc || k.limitCzasowy || ''
        }));
        setDostepneKarnety(ustrukturyzowaneKarnety);
      }
    };

    checkAuthAndRole();
    fetchKarnetyFromSupabase();
  }, [pathname, router, isPublicPage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && profileEmail) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 250; const MAX_HEIGHT = 250;
          let width = img.width; let height = img.height;
          
          if (width > height) { 
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } 
          } else { 
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } 
          }
          
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d'); 
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          setProfileAvatar(compressedDataUrl);
          
          const { error } = await supabase
            .from('klienci')
            .update({ avatarUrl: compressedDataUrl })
            .eq('E-mail', profileEmail);
            
          if (error) {
            console.error("Błąd zapisu awatara:", error);
            alert("Nie udało się trwale zapisać zdjęcia.");
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const [formImiwe, setFormImiwe] = useState('');
  const [formNazwisko, setFormNazwisko] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefon, setFormTelefon] = useState('');
  const [formKarnet, setFormKarnet] = useState('');

  const adminMenuSections = [
    {
      title: "Główne",
      items: [
        { href: '/', label: 'Panel główny', icon: '📊' },
        { href: '/grafik', label: 'Grafik', icon: '📅' },
        { href: '/kreator-treningow', label: 'Kreator treningów', icon: '🛠️' },
        { href: '/moje-wyniki', label: 'Wyniki klubowiczów', icon: '🏆' },
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

  const klientMenuSections = [
    {
      title: "",
      items: [
        { href: '/', label: 'Strona główna', icon: '🏠' },
        { href: '/karnet', label: 'Karnet', icon: '🎟️' },
        { href: '/moje-zapisy', label: 'Moje zapisy', icon: '📅' },
        { href: '/moje-wyniki', label: 'Moje wyniki', icon: '🏆' },
        { href: '/portfel', label: 'Portfel', icon: '💳' },
        { href: '/ambasador', label: 'Ambasador', icon: '👥' },
        { href: '/sklep', label: 'Sklep', icon: '🛒' },
        { href: '/regulamin', label: 'Regulamin klubu', icon: '📋' },
      ]
    }
  ];

  const activeMenuSections = appRole === 'admin' ? adminMenuSections : klientMenuSections;

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formImiwe.trim() || !formNazwisko.trim()) return;

    const wybrananyObj = dostepneKarnety.find(k => k.nazwa === formKarnet);
    const cenaWartosc = wybrananyObj ? parseFloat(wybrananyObj.cena) : 0;
    const cenaBrutto = wybrananyObj ? `${cenaWartosc.toFixed(2)} PLN` : '0.00 PLN';

    let poczatkoweKarnety: any[] = [];
    
    if (formKarnet) {
      let dniWażności = 30;
      if (wybrananyObj && wybrananyObj.limitCzasowy) {
        const limit = wybrananyObj.limitCzasowy.toLowerCase();
        if (limit.includes('1 miesiąc') || limit.includes('miesiąc')) dniWażności = 30;
        else if (limit.includes('3 miesiące')) dniWażności = 90;
        else if (limit.includes('6 miesięcy')) dniWażności = 180;
        else if (limit.includes('1 rok')) dniWażności = 365;
        else if (limit.includes('42 dni')) dniWażności = 42;
      }
      
      const dataWygasniecia = new Date();
      dataWygasniecia.setDate(dataWygasniecia.getDate() + dniWażności);
      const dataWygasnieciaStr = dataWygasniecia.toISOString().split('T')[0];

      poczatkoweKarnety.push({
        id: Date.now(),
        nazwa: formKarnet,
        waznyDo: dataWygasnieciaStr,
        cena: cenaBrutto,
        znizkaProcentowa: '',
        rata: '1 / 1',
        statusTekst: `Ważny do: ${dataWygasnieciaStr}`,
        blokadaDo: null,
        powodBlokady: null,
        zawieszonyOd: null,
        zawieszonyDo: null,
        historiaZawieszen: []
      });
    }

    const poczatkowyStanPortfela = -cenaWartosc;
    const poczatkowyStanStr = `${poczatkowyStanPortfela.toFixed(2)} PLN`;
    const newClientId = Date.now();

    const { error } = await supabase.from('klienci').insert([
      {
        id: newClientId,
        Imię: formImiwe,
        Nazwisko: formNazwisko,
        "Numer tel.": formTelefon || '-',
        "E-mail": formEmail || 'brak@email.pl',
        Cena: cenaBrutto,
        Portfel: poczatkowyStanStr,
        Zarejestrowany: new Date().toISOString().split('T')[0],
        karnetyKlubowicza: poczatkoweKarnety
      }
    ]);

    if (!error && formKarnet) {
      await supabase.from('transakcje').insert([{
        klient_id: newClientId,
        typ_operacji: 'zakup_karnetu',
        kwota: -cenaWartosc,
        opis: `Szybki zapis klienta (pasek): ${formKarnet} (Zadłużono portfel)`
      }]);
    }

    if (error) {
      alert("Błąd dodawania klienta: " + error.message);
      return;
    }

    setFormImiwe('');
    setFormNazwisko('');
    setFormEmail('');
    setFormTelefon('');
    setFormKarnet('');
    setIsAddClientModalOpen(false);

    alert("Klubowicz został pomyślnie dodany do chmury!");
    window.location.reload();
  };

  return (
    <html lang="pl">
      <body className="min-h-screen bg-sky-50/50 text-slate-800 flex font-sans antialiased h-screen overflow-hidden">
        
        <AuthGuard>
          {isPublicPage ? (
            <main className="flex-1 w-full h-screen overflow-y-auto bg-slate-50">
              {children}
            </main>
          ) : (
            <>
              {isMenuOpen && (
                <div 
                  className="fixed inset-0 bg-slate-950/60 z-20 transition-opacity backdrop-blur-sm"
                  onClick={() => setIsMenuOpen(false)}
                />
              )}

              <aside className={`fixed inset-y-0 left-0 w-64 border-r border-sky-200 bg-white p-4 flex flex-col justify-between shrink-0 z-30 transition-transform duration-300 ease-in-out h-screen overflow-y-auto ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div>
                  <div className="flex items-center justify-between mb-6 px-2 pt-2">
                    <span className="text-sm font-black text-sky-950 uppercase tracking-wider">
                      Forma Marzeń 
                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold ml-1 ${appRole === 'admin' ? 'bg-amber-500/20 text-amber-800' : 'bg-sky-500/20 text-sky-800'}`}>
                        {appRole === 'admin' ? 'ADMIN' : 'KLUBOWICZ'}
                      </span>
                    </span>
                    <button 
                      className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      ✕
                    </button>
                  </div>

                  <nav className="space-y-6">
                    {activeMenuSections.map((section, idx) => (
                      <div key={idx}>
                        {section.title && (
                          <div className="text-[10px] font-bold text-sky-900/60 uppercase tracking-wider px-3 mb-2">
                            {section.title}
                          </div>
                        )}
                        <div className="space-y-1">
                          {section.items.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsMenuOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                                  isActive
                                    ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                                    : "text-slate-600 hover:bg-sky-50 hover:text-sky-950"
                                }`}
                              >
                                <span className="text-sm">{item.icon}</span>
                                <span>{item.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </nav>
                </div>

                <div className="border-t border-sky-100 pt-4 px-2 flex items-center gap-3 mt-6 shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-sky-100 flex items-center justify-center font-bold text-sky-900 text-xs shrink-0 border border-amber-500">
                    {profileAvatar ? (
                      <img src={profileAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="uppercase">{profileName.substring(0, 2)}</span>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-slate-900 truncate">{profileName}</div>
                    <div className="text-[10px] text-slate-500">{appRole === 'admin' ? 'Administrator' : 'Klubowicz'}</div>
                  </div>
                </div>
              </aside>

              <div className="flex-1 flex flex-col h-screen overflow-hidden">
                
                <header className="h-16 bg-white border-b border-sky-200 flex items-center justify-between px-4 md:px-6 shrink-0 shadow-sm relative">
                  
                  <div className="flex items-center gap-3">
                    <button 
                      className="text-sky-900 hover:text-sky-950 p-2 -ml-2 rounded-lg bg-sky-50 border border-sky-200 cursor-pointer"
                      onClick={() => setIsMenuOpen(true)}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                    <span className="font-black text-sky-950 text-xs sm:text-sm tracking-wider uppercase">
                      {appRole === 'admin' ? 'Panel Zarządzania' : 'Strefa Klienta'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    
                    {appRole === 'admin' && (
                      <button 
                        onClick={() => setIsAddClientModalOpen(true)}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>+</span>
                        <span className="hidden sm:inline">DODAJ KLUBOWICZA</span>
                      </button>
                    )}

                    <div className="relative">
                      <button className="w-9 h-9 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 rounded-xl flex items-center justify-center transition-colors relative cursor-pointer" title="Koszyk">
                        🛒
                        <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                          0
                        </span>
                      </button>
                    </div>

                    <div className="relative" ref={profileMenuRef}>
                      <button 
                        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                        className="relative group block cursor-pointer focus:outline-none"
                        title="Menu użytkownika"
                      >
                        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-amber-500 shadow-sm bg-sky-100 flex items-center justify-center font-black text-sky-900 text-xs">
                          {profileAvatar ? (
                            <img src={profileAvatar} alt="Profil" className="w-full h-full object-cover" />
                          ) : (
                            <span className="uppercase">{profileName.substring(0, 2)}</span>
                          )}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                      </button>

                      {isProfileMenuOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white border border-sky-200 rounded-2xl shadow-xl py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                          <div className="px-4 py-2 border-b border-sky-100">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Zalogowany klub:</div>
                            <div className="font-black text-sky-950 text-sm">Forma Marzeń</div>
                          </div>
                          <button 
                            onClick={() => {
                              setIsProfileMenuOpen(false);
                              setIsProfileModalOpen(true);
                            }}
                            className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-sky-50 font-bold flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <span>👤</span> Mój profil
                          </button>
                          <div className="border-t border-sky-100 my-1"></div>
                          <button 
                            onClick={async () => {
                              setIsProfileMenuOpen(false);
                              await supabase.auth.signOut();
                              router.push("/login");
                            }}
                            className="w-full text-left px-4 py-2.5 text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <span>🚪</span> Wyloguj się
                          </button>
                        </div>
                      )}
                    </div>

                  </div>

                </header>

                <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                  {children}
                </main>
              </div>
            </>
          )}
        </AuthGuard>

        {/* MODAL DODAJ KLUBOWICZA */}
        {isAddClientModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 my-8 border border-sky-200 relative">
              <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">
                  Dodaj nowego klienta
                </h3>
                <button onClick={() => setIsAddClientModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer">✕</button>
              </div>

              <div className="flex rounded-xl bg-sky-50 p-1 border border-sky-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTabModal('klubowicz')}
                  className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${activeTabModal === 'klubowicz' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-600 hover:text-sky-950'}`}
                >
                  Klubowicz
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabModal('gosc')}
                  className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${activeTabModal === 'gosc' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-600 hover:text-sky-950'}`}
                >
                  Gość
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabModal('rodzina')}
                  className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${activeTabModal === 'rodzina' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-600 hover:text-sky-950'}`}
                >
                  Rodzina
                </button>
              </div>

              <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Imię *</label>
                    <input 
                      type="text" 
                      required
                      value={formImiwe}
                      onChange={(e) => setFormImiwe(e.target.value)}
                      placeholder="np. Jan"
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Nazwisko *</label>
                    <input 
                      type="text" 
                      required
                      value={formNazwisko}
                      onChange={(e) => setFormNazwisko(e.target.value)}
                      placeholder="np. Kowalski"
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Adres e-mail</label>
                  <input 
                    type="email" 
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="jan.kowalski@example.com"
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Numer telefonu</label>
                  <input 
                    type="text" 
                    value={formTelefon}
                    onChange={(e) => setFormTelefon(e.target.value)}
                    placeholder="123 456 789"
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Karnet / Usługa początkowa</label>
                  <select 
                    value={formKarnet}
                    onChange={(e) => setFormKarnet(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                  >
                    <option value="">-- Wybierz karnet z bazy --</option>
                    {dostepneKarnety.length > 0 ? (
                      dostepneKarnety.map((karnet) => (
                        <option key={karnet.id} value={karnet.nazwa}>{karnet.nazwa} ({karnet.cena} PLN)</option>
                      ))
                    ) : (
                      <option value="" disabled>Brak karnetów w Ustawienia ➔ Karnety</option>
                    )}
                  </select>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-sky-100">
                  <button 
                    type="button"
                    onClick={() => setIsAddClientModalOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                  >
                    Anuluj
                  </button>
                  <button 
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer"
                  >
                    Zapisz klienta
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL MÓJ PROFIL */}
        {isProfileModalOpen && (
          <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 my-8 border border-sky-200 relative">
              
              <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">
                  {profileName}
                </h3>
                <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer">✕</button>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageChange} 
                accept="image/*" 
                className="hidden" 
              />

              <div className="flex flex-col items-center justify-center space-y-3 pb-2 border-b border-sky-100">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-amber-500 shadow-md bg-sky-100 flex items-center justify-center text-3xl">
                  {profileAvatar ? (
                    <img src={profileAvatar} alt="Profil" className="w-full h-full object-cover" />
                  ) : (
                    <span className="uppercase">{profileName.substring(0, 2)}</span>
                  )}
                </div>
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-rose-950 hover:bg-rose-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🖼️</span> Zmień zdjęcie
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Adres e-mail *</label>
                  <input 
                    type="email" 
                    readOnly
                    value={profileEmail}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-500 focus:outline-none cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Numer telefonu</label>
                  <input 
                    type="text" 
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Urodziny</label>
                  <input 
                    type="date" 
                    value={profileBirth}
                    onChange={(e) => setProfileBirth(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Język</label>
                  <select 
                    value={profileLang}
                    onChange={(e) => setProfileLang(e.target.value)}
                    className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                  >
                    <option value="Polski">Polski</option>
                    <option value="English">English</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-sky-100">
                <button 
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    if (profileEmail && appRole === 'klubowicz') {
                      await supabase.from('klienci').update({
                        'Numer tel.': profilePhone,
                        Urodziny: profileBirth
                      }).eq('E-mail', profileEmail);
                    }
                    alert("Profil został zaktualizowany pomyślnie!");
                    setIsProfileModalOpen(false);
                  }}
                  className="bg-rose-950 hover:bg-rose-900 text-white font-black px-6 py-2.5 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer"
                >
                  Zapisz
                </button>
              </div>

            </div>
          </div>
        )}

      </body>
    </html>
  );
}