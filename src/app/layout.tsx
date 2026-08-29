"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import "./globals.css";

import AuthGuard from "../components/AuthGuard";
import { supabase } from "./raporty/klienci/supabase";
import ClubChat from "../components/ClubChat";

// Pomocnicza funkcja konwertująca klucz VAPID Base64URL na Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

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

  // Stany dla obsługi kalendarza w profilu klubowicza
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  const [calendarAutoSync, setCalendarAutoSync] = useState(false);

  const [appRole, setAppRole] = useState<'admin' | 'trener' | 'klubowicz'>('klubowicz');
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [currentClientId, setCurrentClientId] = useState<number | string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('-');
  const [profileBirth, setProfileBirth] = useState('');
  const [profileGender, setProfileGender] = useState('');
  const [profileHeight, setProfileHeight] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);

  const [dostepneKarnety, setDostepneKarnety] = useState<any[]>([]);

  // Stany dla mechanizmu Pull-to-Refresh
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPage = (() => {
    const cleanPath = (pathname || '').toLowerCase();
    return (
      cleanPath === '/login' || 
      cleanPath.startsWith('/rejestracja') || 
      cleanPath === '/grafik-publiczny' || 
      cleanPath.startsWith('/grafik-publiczny')
    );
  })();

  // Pobieranie ID klienta
  useEffect(() => {
    if (showCalendarSettings && !currentClientId) {
      const fetchClientIdInstantly = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const email = (user?.email || profileEmail || '').toLowerCase().trim();
        
        const { data: clients } = await supabase
          .from('klienci')
          .select('*');

        if (clients && clients.length > 0) {
          let matched = null;
          if (email) {
            matched = clients.find((c: any) => {
              const cEmail = (c['E-mail'] || c.email || '').toLowerCase().trim();
              return cEmail === email;
            });
          }

          if (!matched) {
            matched = clients.find((c: any) => c.Nazwisko && c.Nazwisko.toLowerCase().includes('kłaput'));
          }

          if (matched) {
            setCurrentClientId(matched.id);
            let settings: any = {};
            try {
              settings = typeof matched.ustawienia_kalendarza === 'string'
                ? JSON.parse(matched.ustawienia_kalendarza)
                : (matched.ustawienia_kalendarza || {});
            } catch(e) { settings = {}; }
            setCalendarAutoSync(settings.autoSync ?? false);
          }
        }
      };
      fetchClientIdInstantly();
    }
  }, [showCalendarSettings, currentClientId, profileEmail]);

  // Funkcja Web Push
  const subscribeToPushNotifications = async (clientId: string | number) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) return;
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      if (subscription && clientId) {
        await supabase
          .from('klienci')
          .update({ push_subscription: JSON.stringify(subscription) })
          .eq('id', clientId);
      }
    } catch (err) {
      console.error("Błąd powiadomień Push:", err);
    }
  };

  // Synchronizacja kalendarza
  const handleToggleCalendarSync = async (enabled: boolean) => {
    setCalendarAutoSync(enabled);
    if (!currentClientId) return;
    const newSettings = { autoSync: enabled };
    await supabase
      .from('klienci')
      .update({ ustawienia_kalendarza: newSettings })
      .eq('id', currentClientId);
  };

  // Obsługa Pull-to-Refresh
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1 && window.scrollY <= 0) {
        touchStartY.current = e.touches[0].clientY;
        isPulling.current = true;
      } else {
        isPulling.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshing) return;
      const currentY = e.touches[0].clientY;
      const diffY = currentY - touchStartY.current;
      if (diffY > 0 && window.scrollY <= 0) {
        setPullDistance(Math.min(diffY * 0.25, 120));
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (!isPulling.current || isRefreshing) return;
      if (pullDistance >= 90) {
        setIsRefreshing(true);
        setPullDistance(85);
        setTimeout(() => { window.location.reload(); }, 400);
      } else {
        setPullDistance(0);
      }
      isPulling.current = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing]);

  // Blokada skalowania i pinch-to-zoom
  useEffect(() => {
    const handleGesture = (e: Event) => e.preventDefault();
    const handleTouchStart = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    let lastTouchEnd = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    };

    document.addEventListener('gesturestart', handleGesture, { passive: false });
    document.addEventListener('gesturechange', handleGesture, { passive: false });
    document.addEventListener('gestureend', handleGesture, { passive: false });
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', handleGesture);
      document.removeEventListener('gesturechange', handleGesture);
      document.removeEventListener('gestureend', handleGesture);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
    }

    const checkAuthAndRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (!isPublicPage) {
            router.push('/login');
          } else {
            setIsAuthLoading(false);
          }
          return;
        }

        const userEmail = user.email || '';
        setProfileEmail(userEmail);
        
        const { data: clients } = await supabase
          .from('klienci')
          .select('*');

        let klientData = null;
        if (clients && clients.length > 0) {
          const cleanEmail = userEmail.toLowerCase().trim();
          klientData = clients.find((c: any) => {
            const cEmail = (c['E-mail'] || c.email || '').toLowerCase().trim();
            return cEmail === cleanEmail;
          });

          if (!klientData) {
            if (cleanEmail === 'maciejklaput@gmail.com' || cleanEmail === 'maciejklaput@icloud.com') {
              klientData = clients.find((c: any) => c.Nazwisko && c.Nazwisko.toLowerCase().includes('kłaput'));
            }
          }
        }

        if (klientData) {
          const k = klientData as any;
          setCurrentClientId(k.id);
          if (k.Urodziny) setProfileBirth(k.Urodziny);
          if (k.gender) setProfileGender(k.gender);
          if (k.wzrost !== undefined && k.wzrost !== null) setProfileHeight(k.wzrost.toString());
          if (k['Numer tel.'] && k['Numer tel.'] !== '-') setProfilePhone(k['Numer tel.']);
          if (k.avatarUrl) setProfileAvatar(k.avatarUrl);

          let settings: any = {};
          try {
            settings = typeof k.ustawienia_kalendarza === 'string'
              ? JSON.parse(k.ustawienia_kalendarza)
              : (k.ustawienia_kalendarza || {});
          } catch(e) { settings = {}; }
          setCalendarAutoSync(settings.autoSync ?? false);

          subscribeToPushNotifications(k.id);
        }

        const cleanEmail = userEmail.toLowerCase().trim();
        if (cleanEmail === 'maciejklaput@gmail.com' || cleanEmail === 'maciejklaput@icloud.com') {
          setAppRole('admin');
          setProfileName('Maciej Kłaput');
          if (klientData) subscribeToPushNotifications((klientData as any).id);
        } else {
          const { data: trenerData } = await supabase
            .from('trenerzy')
            .select('*')
            .ilike('email', userEmail.trim())
            .maybeSingle();

          if (trenerData) {
            setAppRole('trener');
            setProfileName(trenerData.imie_nazwisko || (klientData ? `${(klientData as any).Imię} ${(klientData as any).Nazwisko}` : userEmail.split('@')[0]));
            if (trenerData.telefon && trenerData.telefon !== '-') setProfilePhone(trenerData.telefon);
          } else {
            setAppRole('klubowicz');
            if (klientData) {
              const k = klientData as any;
              setProfileName(`${k.Imię || ''} ${k.Nazwisko || ''}`.trim() || userEmail.split('@')[0]);
            } else {
              setProfileName(userEmail.split('@')[0]);
            }
          }
        }
      } catch (err) {
        console.error("Błąd sprawdzania sesji:", err);
      } finally {
        setIsAuthLoading(false);
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

    if (!isPublicPage) {
      checkAuthAndRole();
      fetchKarnetyFromSupabase();
    } else {
      setIsAuthLoading(false);
    }
  }, [pathname, isPublicPage, router]);

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
          if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
          else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d'); 
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setProfileAvatar(compressedDataUrl);
          
          let updateQuery = supabase.from('klienci').update({ avatarUrl: compressedDataUrl });
          if (currentClientId) updateQuery = updateQuery.eq('id', currentClientId);
          else updateQuery = updateQuery.ilike('E-mail', profileEmail.trim());
          await updateQuery;
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
        { href: '/moje-wyniki', label: 'Wyniki klubowiczów', icon: '🏆' },
        { href: '/moje-zapisy?ranking=true', label: 'Ranking Klubowiczów', icon: '👑' },
        { href: '/analiza-formy', label: 'Analiza formy', icon: '⚖️' },
        { href: '/wydarzenia', label: 'Wydarzenia', icon: '🎯' },
        { href: '/wyzwania', label: 'Wyzwania i Odznaki', icon: '⚔️' },
        { href: '/baza-wiedzy', label: 'Baza wiedzy', icon: '📚' },
        { href: '/promocje', label: 'Aktualne promocje', icon: '🎁' },
      ]
    },
    {
      title: "Raporty",
      items: [
        { href: '/raporty/centrum', label: 'Centrum raportów', icon: '📈' },
        { href: '/raporty/transakcje', label: 'Transakcje', icon: '💳' },
        { href: '/raporty/klienci', label: 'Klienci', icon: '👥' },
        { href: '/raporty/zajecia-i-zapisy', label: 'Zajęcia i zapisy', icon: '🏋️' },
        { href: '/raporty/automatyczne-zapisy', label: 'Automatyczne zapisy', icon: '⚡' },
        { href: '/raporty/trenerzy', label: 'Trenerzy', icon: '🧢' },
        { href: '/raporty/kalendarz', label: 'Kalendarz ICS', icon: '📅' },
      ]
    },
    {
      title: "Komunikacja",
      items: [
        { href: '/komunikacja/ogloszenia', label: 'Ogłoszenia', icon: '📢' },
        { href: '/komunikacja/historia-powiadomien', label: 'Historia powiadomień', icon: '💬' },
      ]
    },
    {
      title: "Ustawienia",
      items: [
        { href: '/ustawienia/zajecia', label: 'Zajęcia', icon: '⚙️' },
        { href: '/ustawienia/zasady-zapisow', label: 'Zasady zapisów', icon: '📋' },
        { href: '/ustawienia/rodzaje-zajec', label: 'Rodzaje zajęć', icon: '🏷️' },
        { href: '/ustawienia/karnety', label: 'Karnety', icon: '🎟️' },
        { href: '/oferta-karnetow', label: 'Oferta karnetów', icon: '🎫' },
        { href: '/ustawienia/magazyn', label: 'Magazyn', icon: '🏬' },
        { href: '/ustawienia/kody-rabatowe', label: 'Kody rabatowe', icon: '🏷️' },
        { href: '/ustawienia/program-ambasador', label: 'Program ambasador', icon: '⭐' },
        { href: '/ustawienia/zespol', label: 'Zespół', icon: '👨‍👧‍👦' },
        { href: '/regulamin', label: 'Regulamin klubu', icon: '📋' },
      ]
    }
  ];

  const klientMenuSections = [
    {
      title: "Główne",
      items: [
        { href: '/', label: 'Strona główna', icon: '🏠' },
        { href: '/karnet', label: 'Mój Karnet', icon: '🎟️' },
        { href: '/moje-zapisy', label: 'Moje zapisy', icon: '📅' },
      ]
    },
    {
      title: "Aktywność",
      items: [
        { href: '/moje-wyniki', label: 'Moje wyniki', icon: '🏆' },
        { href: '/analiza-formy', label: 'Analiza formy', icon: '⚖️' },
        { href: '/wydarzenia', label: 'Wydarzenia', icon: '🎯' },
        { href: '/wyzwania', label: 'Wyzwania i Odznaki', icon: '⚔️' },
        { href: '/baza-wiedzy', label: 'Baza wiedzy', icon: '📚' },
      ]
    },
    {
      title: "Klub i Finanse",
      items: [
        { href: '/oferta-karnetow', label: 'Oferta karnetów', icon: '🎫' },
        { href: '/portfel', label: 'Portfel', icon: '💳' },
        { href: '/ambasador', label: 'Ambasador', icon: '👥' },
        { href: '/sklep', label: 'Sklep', icon: '🛒' },
        { href: '/promocje', label: 'Aktualne promocje', icon: '🎁' },
        { href: '/regulamin', label: 'Regulamin klubu', icon: '📋' },
      ]
    }
  ];

  const trenerMenuSections = [
    {
      title: "Strefa Trenera",
      items: [
        { href: '/', label: 'Trener (Grafik)', icon: '📅' },
      ]
    },
    {
      title: "Konto Klubowicza",
      items: [
        { href: '/moje-zapisy', label: 'Moje zapisy', icon: '📅' },
        { href: '/moje-wyniki', label: 'Moje wyniki', icon: '🏆' },
        { href: '/analiza-formy', label: 'Analiza formy', icon: '⚖️' },
        { href: '/wydarzenia', label: 'Wydarzenia', icon: '🎯' },
        { href: '/wyzwania', label: 'Wyzwania i Odznaki', icon: '⚔️' },
        { href: '/baza-wiedzy', label: 'Baza wiedzy', icon: '📚' },
        { href: '/oferta-karnetow', label: 'Oferta karnetów', icon: '🎫' },
        { href: '/portfel', label: 'Portfel', icon: '💳' },
        { href: '/ambasador', label: 'Ambasador', icon: '👥' },
        { href: '/sklep', label: 'Sklep', icon: '🛒' },
        { href: '/promocje', label: 'Aktualne promocje', icon: '🎁' },
        { href: '/regulamin', label: 'Regulamin klubu', icon: '📋' },
      ]
    }
  ];

  const activeMenuSections = appRole === 'admin' 
    ? adminMenuSections 
    : appRole === 'trener' 
      ? trenerMenuSections 
      : klientMenuSections;

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
    window.location.reload();
  };

  if (!isMounted || (!isPublicPage && isAuthLoading)) {
    return (
      <html lang="pl">
        <head>
          <title>Forma Marzeń</title>
          <meta name="description" content="Aplikacja do zarządzania Twoim kontem w klubie Forma Marzeń" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
          <meta name="HandheldFriendly" content="true" />
          <link rel="manifest" href="/manifest.json?v=2" />
          <meta name="theme-color" content="#0284c7" />
        </head>
        <body className="min-h-screen bg-sky-50/50 text-slate-800 flex flex-col items-center justify-center font-sans antialiased h-screen overflow-hidden">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-sky-950 font-black text-sm tracking-wider uppercase animate-pulse">Forma Marzeń</div>
            <div className="text-slate-500 text-xs font-semibold">Ładowanie profilu...</div>
          </div>
        </body>
      </html>
    );
  }

  const avatarInitials = profileName
    ? profileName.split(' ').map(n => n[0]).filter(Boolean).join('').substring(0, 2).toUpperCase()
    : 'FM';

  return (
    <html lang="pl">
      <head>
        <title>Forma Marzeń</title>
        <meta name="description" content="Aplikacja do zarządzania Twoim kontem w klubie Forma Marzeń" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="HandheldFriendly" content="true" />
        <meta property="og:title" content="Forma Marzeń" />
        <meta property="og:description" content="Aplikacja do zarządzania Twoim kontem w klubie Forma Marzeń" />
        <meta property="og:image" content="https://forma-marzen.vercel.app/logo.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://forma-marzen.vercel.app" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Forma Marzeń" />
        <meta name="twitter:description" content="Aplikacja do zarządzania Twoim kontem w klubie Forma Marzeń" />
        <meta name="twitter:image" content="https://forma-marzen.vercel.app/logo.png" />
        <link rel="manifest" href="/manifest.json?v=2" />
        <meta name="theme-color" content="#0284c7" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/logo.png?v=2" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Forma Marzeń" />
      </head>
      <body className="min-h-screen bg-sky-50/50 text-slate-800 flex font-sans antialiased h-screen overflow-hidden">
        
        {/* Wskaźnik gestu Pull-to-Refresh */}
        <div 
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none transition-transform duration-200 ease-out"
          style={{
            transform: `translateY(${pullDistance > 0 ? pullDistance : 0}px)`,
            opacity: pullDistance > 15 ? 1 : 0
          }}
        >
          <div className="bg-sky-950 text-amber-400 px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 border border-sky-800 text-xs font-black">
            <span className={`text-base inline-block ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: isRefreshing ? 'none' : `rotate(${pullDistance * 4}deg)` }}>
              {isRefreshing ? '🔄' : '⬇️'}
            </span>
            <span>{isRefreshing ? 'Odświeżanie danych...' : pullDistance >= 90 ? 'Puść, aby odświeżyć' : 'Pociągnij mocniej w dół...'}</span>
          </div>
        </div>

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
                    <span className="text-sm font-black text-sky-950 uppercase tracking-wider flex items-center flex-wrap">
                      Forma Marzeń 
                      <span className={`text-[9px] px-2 py-0.5 rounded font-bold ml-1 mt-1 ${
                        appRole === 'admin' ? 'bg-amber-500/20 text-amber-800' : 
                        appRole === 'trener' ? 'bg-emerald-500/20 text-emerald-800' : 
                        'bg-sky-500/20 text-sky-800'
                      }`}>
                        {appRole === 'admin' ? 'ADMIN' : appRole === 'trener' ? 'TRENER' : 'KLUBOWICZ'}
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
                      <div key={idx} className="space-y-2">
                        {section.title && (
                          <div className="text-[10px] font-bold text-sky-900/60 uppercase tracking-wider px-3 border-t border-sky-100 pt-3">
                            {section.title}
                          </div>
                        )}
                        <div className="space-y-1">
                          {section.items.map((item) => {
                            const isActive = pathname === item.href.split('?')[0];
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
                      <span className="uppercase">{avatarInitials}</span>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-slate-900 truncate">{profileName || 'Użytkownik'}</div>
                    <div className="text-[10px] text-slate-500">
                      {appRole === 'admin' ? 'Administrator' : appRole === 'trener' ? 'Trener' : 'Klubowicz'}
                    </div>
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
                      {appRole === 'admin' ? 'Panel Zarządzania' : appRole === 'trener' ? 'Panel Trenera' : 'Strefa Klienta'}
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
                            <span className="uppercase">{avatarInitials}</span>
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

        {/* KOMPONENT CZATU KLUBOWICZÓW */}
        {!isPublicPage && <ClubChat />}

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
                    <span className="uppercase">{avatarInitials}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-rose-950 hover:bg-rose-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🖼️</span> Zmień zdjęcie
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      setShowCalendarSettings(true);
                    }}
                    className="bg-sky-100 hover:bg-sky-200 text-sky-900 text-xs font-bold px-4 py-2 rounded-xl border border-sky-300 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>📅</span> Kalendarz ICS
                  </button>
                </div>
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Płeć</label>
                    <select 
                      value={profileGender}
                      onChange={(e) => setProfileGender(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      <option value="">-- Wybierz płeć --</option>
                      <option value="Mężczyzna">Mężczyzna</option>
                      <option value="Kobieta">Kobieta</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 block">Wzrost (cm)</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="np. 175"
                      value={profileHeight}
                      onChange={(e) => setProfileHeight(e.target.value)}
                      className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
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
                    const cleanEmail = (profileEmail || '').trim();
                    if (!cleanEmail) {
                      alert("Brak adresu e-mail.");
                      return;
                    }

                    const parsedHeight = profileHeight ? parseFloat(profileHeight) : null;

                    let updateClientQuery = supabase
                      .from('klienci')
                      .update({
                        'Numer tel.': profilePhone,
                        Urodziny: profileBirth,
                        gender: profileGender,
                        wzrost: parsedHeight
                      });

                    if (currentClientId) {
                      updateClientQuery = updateClientQuery.eq('id', currentClientId);
                    } else {
                      updateClientQuery = updateClientQuery.ilike('E-mail', cleanEmail);
                    }

                    const { data: updatedClients, error: clientErr } = await updateClientQuery.select();

                    if (clientErr) {
                      console.error("Błąd zapisu profilu klienta:", clientErr);
                      alert("Wystąpił błąd zapisu: " + clientErr.message);
                      return;
                    }

                    if (!updatedClients || updatedClients.length === 0) {
                      const { data: existingClient } = await supabase
                        .from('klienci')
                        .select('id')
                        .ilike('E-mail', cleanEmail)
                        .maybeSingle();

                      if (existingClient) {
                        await supabase
                          .from('klienci')
                          .update({
                            'Numer tel.': profilePhone,
                            Urodziny: profileBirth,
                            gender: profileGender,
                            wzrost: parsedHeight
                          })
                          .eq('id', existingClient.id);
                      }
                    }

                    await supabase
                      .from('trenerzy')
                      .update({ telefon: profilePhone })
                      .ilike('email', cleanEmail);

                    alert("Profil, płeć, wzrost oraz data urodzin zostały zapisane pomyślnie!");
                    setIsProfileModalOpen(false);
                    window.location.reload();
                  }}
                  className="bg-rose-950 hover:bg-rose-900 text-white font-black px-6 py-2.5 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer"
                >
                  Zapisz
                </button>
              </div>

            </div>
          </div>
        )}

        {/* MODAL USTAWIENIA KALENDARZA (ICS) */}
        {showCalendarSettings && (
          <div className="fixed inset-0 bg-slate-950/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 border border-sky-200 relative">
              <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">📅 Synchronizacja kalendarza</h3>
                <button onClick={() => setShowCalendarSettings(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
              </div>
              
              <div className="space-y-4 text-xs text-slate-700">
                <p>
                  Dzięki integracji możesz automatycznie dodawać swoje treningi do kalendarza w telefonie. Wybierz odpowiedni link w zależności od używanej aplikacji.
                </p>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">Auto-synchronizacja</div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Zapisy będą widoczne w zewnętrznych aplikacjach.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={calendarAutoSync}
                      onChange={(e) => handleToggleCalendarSync(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {calendarAutoSync && (
                  <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                    {currentClientId ? (
                      <div className="space-y-3">
                        {/* Apple Calendar / iOS */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-900 text-[11px]"> Apple Calendar / iPhone / iPad (webcal):</label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              readOnly 
                              value={`webcal://${typeof window !== 'undefined' ? window.location.host : 'forma-marzen.vercel.app'}/api/calendar?klient_id=${currentClientId}`}
                              className="flex-1 bg-sky-50 border border-sky-200 rounded-xl px-3.5 py-2 font-mono text-[10px] text-slate-600 focus:outline-none"
                            />
                            <button 
                              onClick={() => {
                                const url = `webcal://${typeof window !== 'undefined' ? window.location.host : 'forma-marzen.vercel.app'}/api/calendar?klient_id=${currentClientId}`;
                                navigator.clipboard.writeText(url);
                                alert("Link dla Apple (webcal://) skopiowany do schowka!");
                              }}
                              className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-2 rounded-xl transition-colors shrink-0 cursor-pointer text-xs"
                            >
                              Kopiuj
                            </button>
                          </div>
                        </div>

                        {/* Google Calendar / Inne */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-900 text-[11px]">🌐 Google Calendar / Outlook / Inne (https):</label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="text" 
                              readOnly 
                              value={`https://${typeof window !== 'undefined' ? window.location.host : 'forma-marzen.vercel.app'}/api/calendar?klient_id=${currentClientId}`}
                              className="flex-1 bg-sky-50 border border-sky-200 rounded-xl px-3.5 py-2 font-mono text-[10px] text-slate-600 focus:outline-none"
                            />
                            <button 
                              onClick={() => {
                                const url = `https://${typeof window !== 'undefined' ? window.location.host : 'forma-marzen.vercel.app'}/api/calendar?klient_id=${currentClientId}`;
                                navigator.clipboard.writeText(url);
                                alert("Link standardowy (https://) skopiowany do schowka!");
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl transition-colors shrink-0 cursor-pointer text-xs"
                            >
                              Kopiuj
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-amber-600 font-bold py-2 text-center animate-pulse">
                        Ładowanie Twojego identyfikatora klienta...
                      </div>
                    )}
                    <p className="text-[10px] text-amber-700 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2">
                      Nigdy nie udostępniaj tych linków osobom trzecim. Zawierają one listę Twoich zapisów w klubie.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end border-t border-sky-100">
                <button onClick={() => setShowCalendarSettings(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-2.5 rounded-xl transition-colors cursor-pointer">
                  Zamknij
                </button>
              </div>
            </div>
          </div>
        )}

      </body>
    </html>
  );
}
