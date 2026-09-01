"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function OdziezPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Dane kampanii i zamówień
  const [campaign, setCampaign] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [hasNewDropBadge, setHasNewDropBadge] = useState(false);

  // Formularz zamówienia klubowicza
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState('MĘSKA');
  const [selectedSize, setSelectedSize] = useState('M');
  const [paymentMethod, setPaymentMethod] = useState<'autopay' | 'wallet'>('autopay');

  // Formularz tworzenia / edycji kampanii przez Admina
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('OFICJALNA KOSZULKA TRENINGOWA');
  const [editDescription, setEditDescription] = useState('Pamiątkowa koszulka klubowa dedykowana na to wydarzenie');
  const [editPrice, setEditPrice] = useState('110.00');
  const [editMinOsob, setEditMinOsob] = useState('5');
  const [editImgFront, setEditImgFront] = useState('/koszulka-przod.png');
  const [editImgBack, setEditImgBack] = useState('/koszulka-tyl.png');
  const [editBlik, setEditBlik] = useState('453 229 407');

  // Tabele rozmiarów (zakładki)
  const [activeSizeTab, setActiveSizeTab] = useState<'meska' | 'damska'>('meska');

  // Zegar odliczający
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');

  useEffect(() => {
    initData();
  }, []);

  const initData = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;

      if (!userEmail) {
        setIsLoading(false);
        return;
      }

      const normalizedEmail = userEmail.toLowerCase().trim();

      // Pobranie profilu użytkownika
      const { data: klienciList } = await supabase.from('klienci').select('*');
      let klientData = klienciList?.find((c: any) => 
        (c['E-mail'] || '').toLowerCase().trim() === normalizedEmail || 
        (c.email || '').toLowerCase().trim() === normalizedEmail
      );

      if (klientData) {
        const rawWalletStr = klientData.Portfel || klientData.portfel || '0.00 PLN';
        const isNegative = String(rawWalletStr).includes('-');
        let parsedWalletNum = parseFloat(String(rawWalletStr).replace(/[^0-9.]/g, "")) || 0;
        if (isNegative) parsedWalletNum = -Math.abs(parsedWalletNum);

        const fullName = `${klientData.Imię || klientData.firstName || ''} ${klientData.Nazwisko || klientData.lastName || ''}`.trim();
        const userObj = {
          ...klientData,
          fullName: fullName || userEmail.split('@')[0],
          rawWalletNum: parsedWalletNum,
          wallet: `${parsedWalletNum.toFixed(2)} PLN`
        };
        setCurrentUser(userObj);

        // Weryfikacja roli administratora
        const adminCheck = klientData.rola === 'admin' || 
          klientData.isAdmin === true || 
          normalizedEmail.includes('admin') || 
          normalizedEmail.includes('biuro') ||
          klientData.Imię === 'Maciej';
        setIsAdmin(!!adminCheck);

        // Załaduj kampanię odzieżową
        await loadCampaignAndOrders(userObj, !!adminCheck);
      }
    } catch (err) {
      console.error("Błąd ładowania danych odzieży:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCampaignAndOrders = async (user: any, adminStatus: boolean) => {
    // 1. Pobierz aktywną lub najnowszą kampanię
    const { data: campaigns } = await supabase
      .from('odziez_kampanie')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!campaigns || campaigns.length === 0) {
      setCampaign(null);
      setOrders([]);
      return;
    }

    let currentCamp = campaigns[0];

    // Ustawienie danych do formularza edycji
    setEditTitle(currentCamp.tytul || '');
    setEditDescription(currentCamp.opis || '');
    setEditPrice(String(currentCamp.cena || '110.00'));
    setEditMinOsob(String(currentCamp.min_osob || '5'));
    setEditImgFront(currentCamp.zdjecie_przod || '');
    setEditImgBack(currentCamp.zdjecie_tyl || '');
    setEditBlik(currentCamp.blik_numer || '453 229 407');

    // 2. Pobierz zamówienia dla tej kampanii
    const { data: ordersData } = await supabase
      .from('odziez_zamowienia')
      .select('*')
      .eq('kampania_id', currentCamp.id)
      .order('created_at', { ascending: true });

    const campOrders = ordersData || [];
    setOrders(campOrders);

    // 3. Sprawdzenie statusu wyświetlenia dropu (czerwony wykrzyknik dla klubowicza)
    if (!adminStatus && user) {
      const { data: viewData } = await supabase
        .from('odziez_wyswietlenia')
        .select('*')
        .eq('klient_id', user.id)
        .eq('kampania_id', currentCamp.id)
        .maybeSingle();

      if (!viewData) {
        setHasNewDropBadge(true);
        await supabase.from('odziez_wyswietlenia').insert([{
          klient_id: user.id,
          kampania_id: currentCamp.id
        }]);
      }
    }

    // 4. Automatyczna weryfikacja terminów i reguł biznesowych
    await processCampaignAutomations(currentCamp, campOrders);
  };

  // Automatyzacja limitów, odliczania 7 dni i zwrotów po 30 dniach
  const processCampaignAutomations = async (camp: any, orderList: any[]) => {
    const now = new Date().getTime();
    const paidOrders = orderList.filter(o => o.status_platnosci === 'oplacone');
    const minOrders = camp.min_osob || 5;
    const createdAtTime = new Date(camp.created_at).getTime();
    const expiresAtTime = new Date(camp.expires_at || (createdAtTime + 30 * 24 * 60 * 60 * 1000)).getTime();

    let updatedCamp = { ...camp };

    // SCENARIUSZ A: Osiągnięto próg minimalny (5 osób) -> Start licznika 7 dni
    if (paidOrders.length >= minOrders && !camp.min_osiagniete_at && camp.status === 'aktywny') {
      const minOsiagniete = new Date().toISOString();
      const deadline = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from('odziez_kampanie')
        .update({
          min_osiagniete_at: minOsiagniete,
          koniec_zamowien_at: deadline
        })
        .eq('id', camp.id);

      updatedCamp.min_osiagniete_at = minOsiagniete;
      updatedCamp.koniec_zamowien_at = deadline;
    }

    // SCENARIUSZ B: Minęło 7 dni od osiągnięcia minimum -> Zamknięcie i przekazanie do realizacji
    if (updatedCamp.koniec_zamowien_at && now > new Date(updatedCamp.koniec_zamowien_at).getTime() && updatedCamp.status === 'aktywny') {
      await supabase
        .from('odziez_kampanie')
        .update({ status: 'w_realizacji' })
        .eq('id', camp.id);

      updatedCamp.status = 'w_realizacji';
    }

    // SCENARIUSZ C: Minęło 30 dni bez osiągnięcia minimum -> Anulowanie i 100% zwrotu do portfeli
    if (now > expiresAtTime && paidOrders.length < minOrders && updatedCamp.status === 'aktywny') {
      await executeRefunds(camp.id, paidOrders);
      await supabase
        .from('odziez_kampanie')
        .update({ status: 'anulowany' })
        .eq('id', camp.id);

      updatedCamp.status = 'anulowany';
    }

    setCampaign(updatedCamp);
  };

  // Logika 100% automatycznego zwrotu środków na wirtualne portfele
  const executeRefunds = async (campaignId: string, paidOrders: any[]) => {
    for (const order of paidOrders) {
      if (order.status_platnosci !== 'oplacone') continue;

      const refundAmount = Number(order.kwota);

      const { data: clientData } = await supabase
        .from('klienci')
        .select('*')
        .eq('id', order.klient_id)
        .single();

      if (clientData) {
        const rawWallet = clientData.Portfel || clientData.portfel || '0.00 PLN';
        const isNeg = String(rawWallet).includes('-');
        let currentNum = parseFloat(String(rawWallet).replace(/[^0-9.]/g, "")) || 0;
        if (isNeg) currentNum = -Math.abs(currentNum);

        const newWalletTotal = currentNum + refundAmount;
        const newWalletStr = `${newWalletTotal.toFixed(2)} PLN`;

        await supabase
          .from('klienci')
          .update({ Portfel: newWalletStr })
          .eq('id', order.klient_id);

        await supabase.from('transakcje').insert([{
          klient_id: order.klient_id,
          kwota: refundAmount,
          typ_operacji: 'Zwrot portfel',
          opis: `Zwrot za koszulkę (nieosiągnięte minimum) - ${order.wariant} ${order.rozmiar}`,
          data: new Date().toISOString()
        }]);

        await supabase
          .from('odziez_zamowienia')
          .update({ status_platnosci: 'zwrocone' })
          .eq('id', order.id);
      }
    }
  };

  // Timer odliczający czas
  useEffect(() => {
    if (!campaign) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      let targetTime: number;

      if (campaign.koniec_zamowien_at) {
        targetTime = new Date(campaign.koniec_zamowien_at).getTime();
      } else {
        const created = new Date(campaign.created_at).getTime();
        targetTime = new Date(campaign.expires_at || (created + 30 * 24 * 60 * 60 * 1000)).getTime();
      }

      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeftStr('ZAMKNIĘTE');
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeftStr(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [campaign]);

  // Statystyki zamówień
  const paidOrdersList = useMemo(() => orders.filter(o => o.status_platnosci === 'oplacone'), [orders]);
  const sizeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    paidOrdersList.forEach(o => {
      counts[o.rozmiar] = (counts[o.rozmiar] || 0) + 1;
    });
    return counts;
  }, [paidOrdersList]);

  // Liczba nieodczytanych przez Admina opłaconych zamówień
  const unreadAdminCount = useMemo(() => {
    return orders.filter(o => o.status_platnosci === 'oplacone' && !o.admin_odczytane).length;
  }, [orders]);

  // Złożenie zamówienia
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !campaign) return;

    if (campaign.status !== 'aktywny') {
      alert("Zamówienia na tę koszulkę zostały już zamknięte.");
      return;
    }

    const price = Number(campaign.cena) || 110;

    setIsProcessing(true);
    try {
      if (paymentMethod === 'wallet') {
        if (currentUser.rawWalletNum < price) {
          alert(`Niewystarczające środki w portfelu. Posiadasz: ${currentUser.wallet}. Doładuj portfel lub wybierz AutoPay.`);
          setIsProcessing(false);
          return;
        }

        const newWalletNum = currentUser.rawWalletNum - price;
        const newWalletStr = `${newWalletNum.toFixed(2)} PLN`;

        await supabase
          .from('klienci')
          .update({ Portfel: newWalletStr })
          .eq('id', currentUser.id);

        await supabase.from('transakcje').insert([{
          klient_id: currentUser.id,
          kwota: -price,
          typ_operacji: 'Zakup odzież',
          opis: `Zamówienie koszulki klubowej - ${selectedVariant} (${selectedSize})`,
          data: new Date().toISOString()
        }]);

        const { error: orderErr } = await supabase.from('odziez_zamowienia').insert([{
          kampania_id: campaign.id,
          klient_id: currentUser.id,
          klient_imie_nazwisko: currentUser.fullName,
          klient_email: currentUser["E-mail"] || currentUser.email,
          wariant: selectedVariant,
          rozmiar: selectedSize,
          kwota: price,
          metoda_platnosci: 'wallet',
          status_platnosci: 'oplacone',
          oplacone_at: new Date().toISOString(),
          admin_odczytane: false
        }]);

        if (orderErr) throw orderErr;

        await sendAdminPushNotification(currentUser.fullName, selectedVariant, selectedSize);

        alert("Zamówienie zostało pomyślnie opłacone z portfela!");
        setIsOrderModalOpen(false);
        await loadCampaignAndOrders(currentUser, isAdmin);
      } else {
        const orderId = `TSHIRT-${currentUser.id}-${Date.now()}`.substring(0, 32);

        await supabase.from('odziez_zamowienia').insert([{
          kampania_id: campaign.id,
          klient_id: currentUser.id,
          klient_imie_nazwisko: currentUser.fullName,
          klient_email: currentUser["E-mail"] || currentUser.email,
          wariant: selectedVariant,
          rozmiar: selectedSize,
          kwota: price,
          metoda_platnosci: 'autopay',
          status_platnosci: 'oczekuje',
          autopay_order_id: orderId,
          admin_odczytane: false
        }]);

        const response = await fetch('/api/autopay/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: price,
            orderId: orderId,
            userId: currentUser.id,
            description: `Koszulka klubowa: ${selectedVariant} (${selectedSize})`,
            email: currentUser["E-mail"] || currentUser.email || '',
            type: 'tshirt_purchase',
            kampania_id: campaign.id,
            wariant: selectedVariant,
            rozmiar: selectedSize
          })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Błąd inicjalizacji Autopay');
        }

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.gatewayUrl;
        form.setAttribute('accept-charset', 'UTF-8');

        Object.keys(data.payload).forEach((key) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = data.payload[key];
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      }
    } catch (err: any) {
      console.error("Błąd podczas składania zamówienia:", err);
      alert(`Wystąpił błąd: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Zapisanie / Utworzenie kampanii przez Administratora
  const handleSaveCampaignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const payload = {
        tytul: editTitle,
        opis: editDescription,
        cena: parseFloat(editPrice) || 110.00,
        min_osob: parseInt(editMinOsob, 10) || 5,
        zdjecie_przod: editImgFront,
        zdjecie_tyl: editImgBack,
        blik_numer: editBlik,
        status: 'aktywny'
      };

      if (campaign?.id) {
        const { error } = await supabase
          .from('odziez_kampanie')
          .update(payload)
          .eq('id', campaign.id);

        if (error) throw error;
        alert("Pomyślnie zaktualizowano drop odzieży!");
      } else {
        const { error } = await supabase
          .from('odziez_kampanie')
          .insert([payload]);

        if (error) throw error;

        // Powiadomienie Push do wszystkich klubowiczów o nowym dropie
        await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sendToAll: true,
            title: '👕 Nowy drop odzieży klubowej!',
            body: `${editTitle} jest już dostępna do zamówienia w aplikacji!`,
            url: '/odziez'
          })
        });

        alert("Nowy drop odzieży został pomyślnie utworzony i opublikowany!");
      }

      setIsEditModalOpen(false);
      await loadCampaignAndOrders(currentUser, isAdmin);
    } catch (err: any) {
      console.error("Błąd zapisu kampanii:", err);
      alert("Błąd: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendAdminPushNotification = async (userName: string, variant: string, size: string) => {
    try {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sendToAdmins: true,
          title: '👕 Nowe opłacone zamówienie na koszulkę!',
          body: `${userName} opłacił(a) koszulkę: ${variant} (${size}).`,
          url: '/odziez'
        })
      });
    } catch (e) {
      console.warn("Nie udało się wysłać powiadomienia Push:", e);
    }
  };

  const handleMarkAsRead = async (orderId: string) => {
    if (!isAdmin) return;
    await supabase.from('odziez_zamowienia').update({ admin_odczytane: true }).eq('id', orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, admin_odczytane: true } : o));
  };

  const handleTogglePaymentStatus = async (order: any) => {
    if (!isAdmin) return;
    const nextStatus = order.status_platnosci === 'oplacone' ? 'oczekuje' : 'oplacone';
    await supabase.from('odziez_zamowienia').update({ 
      status_platnosci: nextStatus,
      oplacone_at: nextStatus === 'oplacone' ? new Date().toISOString() : null,
      admin_odczytane: true
    }).eq('id', order.id);

    setOrders(prev => prev.map(o => o.id === order.id ? { 
      ...o, 
      status_platnosci: nextStatus, 
      oplacone_at: nextStatus === 'oplacone' ? new Date().toISOString() : null,
      admin_odczytane: true 
    } : o));
  };

  if (isLoading) {
    return <div className="p-10 flex justify-center text-slate-400 font-bold uppercase text-xs">Ładowanie modułu Odzież...</div>;
  }

  const minRequired = campaign?.min_osob || 5;
  const currentPaidCount = paidOrdersList.length;
  const progressPercent = Math.min(100, Math.round((currentPaidCount / minRequired) * 100));
  const isTargetMet = currentPaidCount >= minRequired;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 font-sans antialiased text-slate-800">
      
      {/* 1. ZASADY ZAMÓWIEŃ (DYNAMICZNY PRÓG = 5 OSÓB) */}
      <div className="bg-gradient-to-br from-blue-900 to-sky-950 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-sky-800 relative overflow-hidden">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <h2 className="text-base sm:text-lg font-black tracking-wider uppercase">
              Zasady i Regulamin Zamówień Odzieży Klubowej
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            {hasNewDropBadge && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1">
                <span>!</span> Nowy Drop
              </span>
            )}
            {isAdmin && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-black px-3.5 py-1.5 rounded-xl uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
              >
                ⚙️ {campaign ? 'Edytuj Drop' : '+ Utwórz Drop'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-sky-100/90 leading-relaxed">
          <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-xs border border-white/10">
            <div className="font-bold text-white mb-1 flex items-center gap-2">
              <span className="bg-blue-500/30 text-sky-300 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">1</span>
              Wybór i Bezpośrednia Płatność
            </div>
            Wybierz wariant oraz rozmiar. Opłać zamówienie przez <strong>AutoPay</strong> lub środkami z <strong>Wirtualnego Portfela</strong>.
          </div>

          <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-xs border border-white/10">
            <div className="font-bold text-white mb-1 flex items-center gap-2">
              <span className="bg-blue-500/30 text-sky-300 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">2</span>
              Próg Minimalny do Realizacji
            </div>
            Zbiórka wymaga zebrania minimum <strong>{minRequired} opłaconych sztuk</strong>, aby partia trafiła do produkcji w szwalni.
          </div>

          <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-xs border border-white/10">
            <div className="font-bold text-white mb-1 flex items-center gap-2">
              <span className="bg-emerald-500/30 text-emerald-300 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">3</span>
              Zegar 7 Dni po Osiągnięciu Progu
            </div>
            Po zebraniu {minRequired} osób startuje <strong>zegar 7 dni</strong>. Po tym czasie możliwość zakupu zostaje zablokowana.
          </div>

          <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-xs border border-white/10">
            <div className="font-bold text-white mb-1 flex items-center gap-2">
              <span className="bg-amber-500/30 text-amber-300 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">4</span>
              Gwarancja 100% Zwrotu (30 dni)
            </div>
            Jeśli w 30 dni nie osiągniemy minimum, <strong>100% wpłaconej kwoty wraca automatycznie do Twojego Wirtualnego Portfela</strong>.
          </div>
        </div>
      </div>

      {/* 2. GŁÓWNA KARTA KOSZULKI */}
      {campaign ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          
          {/* NAGŁÓWEK KOSZULKI */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center text-3xl border border-sky-100 shadow-sm shrink-0">
                👕
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {campaign.tytul || 'OFICJALNA KOSZULKA TRENINGOWA'}
                  </h1>
                  {isAdmin && unreadAdminCount > 0 && (
                    <span className="bg-rose-600 text-white font-black text-[10px] px-2 py-0.5 rounded-full animate-bounce">
                      ! {unreadAdminCount} nowe
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {campaign.opis || 'Pamiątkowa koszulka klubowa dedykowana na to wydarzenie'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="bg-sky-50 border border-sky-100 px-4 py-2 rounded-2xl text-center flex-1 sm:flex-none">
                <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">CENA KOSZULKI</div>
                <div className="text-base sm:text-lg font-black text-sky-950">{campaign.cena || '110.00'} zł</div>
              </div>

              <div className="bg-rose-50 border border-rose-100 px-4 py-2 rounded-2xl text-center flex-1 sm:flex-none">
                <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                  {campaign.min_osiagniete_at ? 'CZAS DO ZAMKNIĘCIA (7 DNI)' : 'ZAPISY DO'}
                </div>
                <div className="text-xs sm:text-sm font-black text-rose-950">
                  {timeLeftStr || 'Trwa odliczanie'}
                </div>
              </div>
            </div>
          </div>

          {/* PASEK POSTĘPU MINIMUM ZAMÓWIEŃ (PROG = 5) */}
          <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-100 space-y-2.5">
            <div className="flex justify-between items-center text-xs font-black">
              <span className="text-slate-600 uppercase tracking-wider flex items-center gap-2">
                Stan zbiórki: <span className="text-slate-900 font-extrabold">{currentPaidCount} / {minRequired} opłaconych</span>
              </span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-black ${isTargetMet ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {isTargetMet ? '✓ Próg osiągnięty (Produkcja potwierdzona)' : `Brakuje jeszcze ${Math.max(0, minRequired - currentPaidCount)} sztuk`}
              </span>
            </div>
            
            <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${isTargetMet ? 'bg-emerald-500' : 'bg-blue-600'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* PRZYCISK ZAMÓWIENIA DLA KLUBOWICZA */}
          {campaign.status === 'aktywny' ? (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setIsOrderModalOpen(true)}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm px-8 py-4 rounded-2xl uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>👕</span> Zamów koszulkę teraz
              </button>
            </div>
          ) : (
            <div className="p-4 bg-slate-100 rounded-2xl text-center text-xs font-bold text-slate-500 uppercase">
              Zamówienia na ten drop zostały zakończone ({campaign.status === 'w_realizacji' ? 'W realizacji w szwalni' : 'Anulowane'}).
            </div>
          )}

          {/* 3. SEKCJA ZAMÓWIEŃ */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">👕</span>
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-900">
                  ZAMÓWIENIA KOSZULEK ({orders.length})
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                {Object.entries(sizeBreakdown).map(([size, count]) => (
                  <span key={size} className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg text-slate-700 font-mono">
                    {size}: {count}
                  </span>
                ))}
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-lg font-bold">
                  Opłacone: {currentPaidCount} / {orders.length}
                </span>
              </div>
            </div>

            {/* WIDOK DLA ADMINA */}
            {isAdmin ? (
              <div className="space-y-2">
                <div className="text-[11px] text-slate-400 italic">
                  💡 Kliknij w status płatności, aby go szybko przełączyć. Wykrzyknik oznacza nowe, nieodczytane zamówienie.
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {orders.map((order) => {
                    const isPaid = order.status_platnosci === 'oplacone';
                    const isUnread = isPaid && !order.admin_odczytane;

                    return (
                      <div 
                        key={order.id}
                        onClick={() => handleMarkAsRead(order.id)}
                        className={`border rounded-2xl p-4 flex items-center justify-between transition-all ${
                          isUnread ? 'bg-rose-50/50 border-rose-300 shadow-sm ring-1 ring-rose-300' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="font-bold text-xs text-slate-900">{order.klient_imie_nazwisko}</span>
                            {isUnread && (
                              <span className="bg-rose-600 text-white font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                                !
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {order.metoda_platnosci === 'wallet' ? '👛 Portfel' : '💳 AutoPay'} • {order.wariant} ({order.rozmiar})
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200 px-2 py-1 rounded-lg uppercase">
                            {order.rozmiar} • {order.wariant}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePaymentStatus(order);
                            }}
                            className={`text-[10px] font-black px-3 py-1.5 rounded-xl uppercase transition-colors cursor-pointer border ${
                              isPaid 
                                ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600' 
                                : order.status_platnosci === 'zwrocone'
                                ? 'bg-slate-200 text-slate-600 border-slate-300'
                                : 'bg-amber-400 text-amber-950 border-amber-500 hover:bg-amber-500'
                            }`}
                          >
                            {isPaid ? '● Opłacone' : order.status_platnosci === 'zwrocone' ? '↺ Zwrócone' : '○ Do wpłaty'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* WIDOK DLA KLUBOWICZA */
              <div className="space-y-3 pt-2">
                <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 text-xs text-sky-950 leading-relaxed">
                  🔒 Ze względów prywatności lista zamawiających jest ukryta. Aktualnie zamówienie opłaciło <strong>{currentPaidCount} osób</strong>.
                </div>

                {orders.filter(o => o.klient_id === currentUser?.id).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Twoje zamówienia:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {orders.filter(o => o.klient_id === currentUser?.id).map(myOrder => (
                        <div key={myOrder.id} className="bg-white border border-slate-200 rounded-2xl p-3.5 flex justify-between items-center shadow-xs">
                          <div>
                            <div className="font-bold text-xs text-slate-900">{myOrder.wariant} • Rozmiar {myOrder.rozmiar}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Kwota: {myOrder.kwota} zł ({myOrder.metoda_platnosci})</div>
                          </div>
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl uppercase ${
                            myOrder.status_platnosci === 'oplacone' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {myOrder.status_platnosci === 'oplacone' ? '✓ Opłacone' : 'Oczekuje na płatność'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600">
              <div className="font-bold text-slate-900 mb-0.5">Płatność BLIK na telefon:</div>
              <div>Numer telefonu: <strong>{campaign.blik_numer || '453 229 407'}</strong></div>
              <div className="text-[11px] text-slate-500 mt-0.5">W opisie: Imię i Nazwisko - rozmiar (męska, damska)</div>
            </div>
          </div>

          {/* 4. WIZUALIZACJA KOSZULKI */}
          <div className="space-y-3 pt-6 border-t border-slate-100">
            <h3 className="font-black text-xs uppercase tracking-wider text-slate-400">
              WIZUALIZACJA KOSZULKI
            </h3>
            
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 flex flex-col sm:flex-row items-center justify-center gap-6 overflow-hidden">
              <div className="text-center space-y-2">
                <img 
                  src={campaign.zdjecie_przod || "/koszulka-przod.png"} 
                  alt="Wizualizacja Przód" 
                  className="max-h-72 object-contain drop-shadow-md rounded-xl"
                  onError={(e: any) => { e.currentTarget.src = "https://placehold.co/400x500/f1f5f9/0284c7?text=Przod+Koszulki"; }}
                />
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Przód</div>
              </div>

              <div className="text-center space-y-2">
                <img 
                  src={campaign.zdjecie_tyl || "/koszulka-tyl.png"} 
                  alt="Wizualizacja Tył" 
                  className="max-h-72 object-contain drop-shadow-md rounded-xl"
                  onError={(e: any) => { e.currentTarget.src = "https://placehold.co/400x500/f1f5f9/0284c7?text=Tyl+Koszulki"; }}
                />
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tył</div>
              </div>
            </div>
          </div>

          {/* 5. TABELA ROZMIARÓW */}
          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <span>📐</span> TABELA ROZMIARÓW & WARIANTY
              </h3>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setActiveSizeTab('meska')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    activeSizeTab === 'meska' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Męski
                </button>
                <button
                  onClick={() => setActiveSizeTab('damska')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    activeSizeTab === 'damska' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Damski
                </button>
              </div>
            </div>

            {activeSizeTab === 'meska' ? (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-sky-50 px-4 py-2 border-b border-sky-100 text-sky-900 font-bold text-xs uppercase">
                  Tabela Męska (Wymiary w cm, tolerancja +/- 1 cm)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3.5">Rozmiar</th>
                        <th className="py-2.5 px-3.5">Klatka</th>
                        <th className="py-2.5 px-3.5">Talia</th>
                        <th className="py-2.5 px-3.5">Pas</th>
                        <th className="py-2.5 px-3.5">Wysokość</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {[
                        { r: 'XS', k: 47, t: 45, p: 47, w: 65 },
                        { r: 'S', k: 49, t: 47, p: 49, w: 68 },
                        { r: 'M', k: 51, t: 49, p: 51, w: 71 },
                        { r: 'L', k: 53, t: 51, p: 53, w: 73 },
                        { r: 'XL', k: 55, t: 54, p: 55, w: 74 },
                        { r: '2XL', k: 58, t: 56, p: 58, w: 77 },
                        { r: '3XL', k: 59, t: 57, p: 59, w: 79 },
                        { r: '4XL', k: 61, t: 59, p: 61, w: 81 },
                      ].map((row) => (
                        <tr key={row.r} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3.5 font-bold font-sans text-slate-900">{row.r}</td>
                          <td className="py-2 px-3.5">{row.k}</td>
                          <td className="py-2 px-3.5">{row.t}</td>
                          <td className="py-2 px-3.5">{row.p}</td>
                          <td className="py-2 px-3.5">{row.w}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-rose-50 px-4 py-2 border-b border-rose-100 text-rose-900 font-bold text-xs uppercase">
                  Tabela Damska (Wymiary w cm, tolerancja +/- 1 cm)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3.5">Rozmiar</th>
                        <th className="py-2.5 px-3.5">Klatka</th>
                        <th className="py-2.5 px-3.5">Talia</th>
                        <th className="py-2.5 px-3.5">Pas</th>
                        <th className="py-2.5 px-3.5">Wysokość</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {[
                        { r: 'XS', k: 41, t: 37, p: 41, w: 60 },
                        { r: 'S', k: 43, t: 39, p: 43, w: 61 },
                        { r: 'M', k: 45, t: 41, p: 45, w: 62 },
                        { r: 'L', k: 47, t: 44, p: 49, w: 64 },
                        { r: 'XL', k: 49, t: 46, p: 51, w: 66 },
                        { r: '2XL', k: 51, t: 47, p: 53, w: 69 },
                        { r: '3XL', k: 53, t: 49, p: 55, w: 71 },
                        { r: '4XL', k: 55, t: 51, p: 57, w: 73 },
                      ].map((row) => (
                        <tr key={row.r} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3.5 font-bold font-sans text-slate-900">{row.r}</td>
                          <td className="py-2 px-3.5">{row.k}</td>
                          <td className="py-2 px-3.5">{row.t}</td>
                          <td className="py-2 px-3.5">{row.p}</td>
                          <td className="py-2 px-3.5">{row.w}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-400 italic">
              * Ważna informacja: Wymiary podane w tabeli mierzone są na płasko. Aby upewnić się, że zamawiasz właściwy rozmiar, zmierz swoją ulubioną koszulkę i porównaj z tabelą.
            </div>
          </div>

        </div>
      ) : (
        /* WIDOK GDY NIE MA JESZCZE KAMPANII */
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-4">
          <div className="text-4xl">👕</div>
          <div className="text-slate-600 font-bold">Brak aktywnej kampanii odzieżowej.</div>
          {isAdmin && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-6 py-3 rounded-2xl uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
            >
              + Utwórz nowy drop odzieży
            </button>
          )}
        </div>
      )}

      {/* 6. MODAL ZAMÓWIENIA KOSZULKI DLA KLUBOWICZA */}
      {isOrderModalOpen && campaign && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5 border border-sky-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>👕</span> Zamówienie koszulki
              </h3>
              <button onClick={() => setIsOrderModalOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleOrderSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Wybierz wariant kroju *</label>
                <div className="grid grid-cols-2 gap-2">
                  {['MĘSKA', 'DAMSKA'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`py-2.5 rounded-xl font-bold uppercase border transition-all cursor-pointer ${
                        selectedVariant === v ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Wybierz rozmiar *</label>
                <div className="grid grid-cols-4 gap-2">
                  {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedSize(s)}
                      className={`py-2 rounded-xl font-black uppercase border transition-all cursor-pointer ${
                        selectedSize === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="font-bold text-slate-700 block">Metoda płatności ({campaign.cena} PLN) *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('autopay')}
                    className={`p-3 rounded-xl font-bold border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'autopay' ? 'bg-blue-50 border-blue-500 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-base">💳</span>
                    <span>Bramka AutoPay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`p-3 rounded-xl font-bold border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      paymentMethod === 'wallet' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-base">👛</span>
                    <span>Portfel ({currentUser?.wallet || '0.00 PLN'})</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] text-slate-500 leading-normal">
                Płatność realizowana jest natychmiastowo. W przypadku nieuzbierania progu {minRequired} osób, środki zostaną automatycznie zwrócone na Twój wirtualny portfel.
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsOrderModalOpen(false)} 
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button 
                  type="submit" 
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black px-6 py-3 rounded-xl uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                >
                  {isProcessing ? 'Przetwarzanie...' : `Opłać ${campaign.cena} zł`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL EDYCJI / TWORZENIA KAMPANII PRZEZ ADMINA */}
      {isEditModalOpen && isAdmin && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-sky-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider">
                ⚙️ {campaign ? 'Edycja Dropu Odzieży' : 'Utwórz Nowy Drop Odzieży'}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 font-bold hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveCampaignAdmin} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Tytuł Dropu / Koszulki *</label>
                <input 
                  type="text" 
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:border-blue-500 text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Krótki opis</label>
                <input 
                  type="text" 
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Cena (PLN) *</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:border-blue-500 text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Próg minimalny (osób) *</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={editMinOsob}
                    onChange={(e) => setEditMinOsob(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:border-blue-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Ścieżka do zdjęcia PRZÓD</label>
                <input 
                  type="text" 
                  value={editImgFront}
                  onChange={(e) => setEditImgFront(e.target.value)}
                  placeholder="/koszulka-przod.png lub link https://"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 text-slate-900 font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Ścieżka do zdjęcia TYŁ</label>
                <input 
                  type="text" 
                  value={editImgBack}
                  onChange={(e) => setEditImgBack(e.target.value)}
                  placeholder="/koszulka-tyl.png lub link https://"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 text-slate-900 font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Numer telefonu do płatności BLIK</label>
                <input 
                  type="text" 
                  value={editBlik}
                  onChange={(e) => setEditBlik(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 text-slate-900"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button 
                  type="submit" 
                  disabled={isProcessing}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-6 py-2.5 rounded-xl uppercase tracking-wider transition-colors shadow-sm cursor-pointer"
                >
                  {isProcessing ? 'Zapisywanie...' : 'Zapisz i Opublikuj'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
