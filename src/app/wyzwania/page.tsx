"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../raporty/klienci/supabase";

const ADMIN_EMAILS = ["maciejklaput@gmail.com", "maciejklaput@icloud.com"];

export default function WyzwaniaPage() {
  // Stan użytkownika
  const [currentUserId, setCurrentUserId] = useState<number | string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'klubowicz'>('klubowicz');

  // Dane z bazy
  const [klienci, setKlienci] = useState<any[]>([]);
  const [wyzwania, setWyzwania] = useState<any[]>([]);
  const [odznaki, setOdznaki] = useState<any[]>([]);
  const [odznakiHistoria, setOdznakiHistoria] = useState<any[]>([]);
  const [wszystkieOdznaki, setWszystkieOdznaki] = useState<any[]>([]);
  const [wszystkiePrzydzieloneOdznaki, setWszystkiePrzydzieloneOdznaki] = useState<any[]>([]);
  const [dyscyplinyList, setDyscyplinyList] = useState<any[]>([]);
  const [rankingList, setRankingList] = useState<any[]>([]);
  
  // Stan interfejsu
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState(false);
  const [challengeToResolve, setChallengeToResolve] = useState<any | null>(null);
  const [selectedWinnerId, setSelectedWinnerId] = useState<any | null>(null);
  const [selectedMemberForComparison, setSelectedMemberForComparison] = useState<any | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOpponent, setSelectedOpponent] = useState<any | null>(null);
  const [dyscyplina, setDyscyplina] = useState("");
  const [opisWyzwania, setOpisWyzwania] = useState("");
  const [newDyscyplina, setNewDyscyplina] = useState("");

  // Stany tworzenia nowej odznaki w panelu Admina
  const [newBadgeNazwa, setNewBadgeNazwa] = useState("");
  const [newBadgeOpis, setNewBadgeOpis] = useState("");
  const [newBadgeWarunek, setNewBadgeWarunek] = useState("");
  const [newBadgeIkona, setNewBadgeIkona] = useState("");
  const [newBadgePunkty, setNewBadgePunkty] = useState("1");
  const [newBadgeKategoria, setNewBadgeKategoria] = useState("Wyzwania");
  const [isUploadingNewBadge, setIsUploadingNewBadge] = useState(false);

  // Stany edycji odznak w panelu Admina
  const [editingBadgeId, setEditingBadgeId] = useState<number | null>(null);
  const [editBadgeNazwa, setEditBadgeNazwa] = useState("");
  const [editBadgeOpis, setEditBadgeOpis] = useState("");
  const [editBadgeWarunek, setEditBadgeWarunek] = useState("");
  const [editBadgeIkona, setEditBadgeIkona] = useState("");
  const [editBadgePunkty, setEditBadgePunkty] = useState("1");
  const [editBadgeKategoria, setEditBadgeKategoria] = useState("Wyzwania");
  const [isUploadingEditBadge, setIsUploadingEditBadge] = useState(false);

  // Stany edycji dyscyplin
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const [activeTab, setActiveTab] = useState<'aktywne' | 'odznaki' | 'ranking' | 'admin'>('aktywne');
  const [adminSubTab, setAdminSubTab] = useState<'wyzwania' | 'odznaki' | 'katalog_odznak' | 'dyscypliny'>('wyzwania');
  const [isLoading, setIsLoading] = useState(true);

  // 1. Inicjalizacja użytkownika i pobranie danych
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = (session?.user?.email || "").toLowerCase().trim();

      if (!userEmail) {
        setIsLoading(false);
        return;
      }

      const { data: klienciData } = await supabase.from("klienci").select("*");
      if (klienciData) {
        const enriched = klienciData.map((c: any) => ({
          id: c.id,
          firstName: c.Imię || c.firstName || "",
          lastName: c.Nazwisko || c.lastName || "",
          name: `${c.Imię || c.firstName || ""} ${c.Nazwisko || c.lastName || ""}`.trim() || c["E-mail"] || "Klubowicz",
          email: (c["E-mail"] || c.email || "").toLowerCase().trim(),
          avatar: c.avatarUrl || c.avatar || null,
        }));

        setKlienci(enriched);

        const myProfile = enriched.find((c: any) => c.email === userEmail);

        let myId: any = null;
        if (ADMIN_EMAILS.includes(userEmail)) {
          setUserRole('admin');
          if (myProfile) {
            myId = myProfile.id;
            setCurrentUserName(`${myProfile.name} (Admin)`);
            setCurrentUserAvatar(myProfile.avatar);
          } else {
            myId = enriched.length > 0 ? enriched[0].id : 1;
            setCurrentUserName("Maciej Kłaput (Admin)");
          }
        } else if (myProfile) {
          myId = myProfile.id;
          setCurrentUserName(myProfile.name);
          setCurrentUserAvatar(myProfile.avatar);
        }

        if (myId) {
          setCurrentUserId(myId);
          await fetchWyzwania();
          await fetchOdznaki(myId);
          await fetchAllOdznakiDef();
          await fetchWszystkiePrzydzieloneOdznaki();
          await fetchHistoriaOdznak();
          await fetchDyscypliny();
          await fetchRanking(enriched);
        }
      }
      setIsLoading(false);
    };

    initData();
  }, []);

  // 2. Pobieranie danych z bazy
  const fetchWyzwania = async () => {
    const { data } = await supabase.from("klub_wyzwania").select("*").order("created_at", { ascending: false });
    if (data) setWyzwania(data);
  };

  const fetchDyscypliny = async () => {
    const { data } = await supabase.from("klub_dyscypliny").select("*").order("nazwa");
    if (data) {
      setDyscyplinyList(data);
      if (data.length > 0 && !dyscyplina) setDyscyplina(data[0].nazwa);
    }
  };

  const fetchOdznaki = async (userId: any) => {
    const { data } = await supabase
      .from("klub_odznaki_klubowicze")
      .select(`id, przyznano_at, klient_id, klub_odznaki_definicje (id, nazwa, opis, ikona, punkty, kategoria, warunek)`)
      .eq("klient_id", userId);
    if (data) setOdznaki(data);
  };

  const fetchAllOdznakiDef = async () => {
    const { data } = await supabase.from("klub_odznaki_definicje").select("*").order("punkty", { ascending: true });
    if (data) setWszystkieOdznaki(data);
  };

  const fetchWszystkiePrzydzieloneOdznaki = async () => {
    const { data } = await supabase
      .from("klub_odznaki_klubowicze")
      .select(`id, przyznano_at, klient_id, odznaka_id, klub_odznaki_definicje (id, nazwa, opis, ikona, punkty, kategoria, warunek)`);
    if (data) setWszystkiePrzydzieloneOdznaki(data);
  };

  const fetchHistoriaOdznak = async () => {
    const { data } = await supabase.from("klub_odznaki_klubowicze").select(`*, klub_odznaki_definicje (nazwa), klienci (Imię, Nazwisko)`);
    if (data) setOdznakiHistoria(data);
  };

  const fetchRanking = async (clientsData: any[]) => {
    const { data } = await supabase.from("klub_wyzwania_historia").select("zwyciezca_id");
    if (data && clientsData.length > 0) {
      const winsCount: { [key: string]: number } = {};
      data.forEach((item: any) => {
        if (item.zwyciezca_id) {
          winsCount[item.zwyciezca_id] = (winsCount[item.zwyciezca_id] || 0) + 1;
        }
      });
      const ranking = Object.keys(winsCount).map((clientId) => {
        const client = clientsData.find((c: any) => String(c.id) === String(clientId));
        return {
          id: clientId,
          name: client ? client.name : "Klubowicz",
          avatar: client ? client.avatar : null,
          wins: winsCount[clientId]
        };
      }).sort((a, b) => b.wins - a.wins);
      setRankingList(ranking);
    }
  };

  // Helper do uploadu grafiki odznaki
  const uploadBadgeImageFile = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `badge_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const filePath = `badges/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);

      if (!uploadError) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
        return data.publicUrl;
      }

      // Bezpieczny fallback do Base64, gdyby bucket w storage nie był skonfigurowany
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    } catch (err) {
      console.error("Błąd podczas uploadu grafiki odznaki:", err);
      return null;
    }
  };

  // 3. Logika przypisywania odznaki
  const assignBadge = async (userId: any, badgeId: any) => {
    const { error } = await supabase.from("klub_odznaki_klubowicze").insert([{
      klient_id: userId,
      odznaka_id: badgeId
    }]);
    if (!error) {
      alert("Odznaka przyznana pomyślnie!");
      fetchHistoriaOdznak();
      fetchWszystkiePrzydzieloneOdznaki();
      if (currentUserId) fetchOdznaki(currentUserId);
    } else {
      alert("Błąd przyznawania: " + error.message);
    }
  };

  // 4. Zarządzanie definicjami odznak w Katalogu (Admin)
  const handleCreateBadgeDef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBadgeNazwa.trim() || !newBadgeOpis.trim()) {
      alert("Wypełnij nazwę oraz opis odznaki!");
      return;
    }

    const { error } = await supabase.from("klub_odznaki_definicje").insert([{
      nazwa: newBadgeNazwa.trim(),
      opis: newBadgeOpis.trim(),
      warunek: newBadgeWarunek.trim() || newBadgeOpis.trim(),
      ikona: newBadgeIkona.trim() || "🏆",
      punkty: parseInt(newBadgePunkty) || 1,
      kategoria: newBadgeKategoria.trim() || "Wyzwania"
    }]);

    if (!error) {
      alert("Nowa odznaka została dodana do katalogu!");
      setNewBadgeNazwa("");
      setNewBadgeOpis("");
      setNewBadgeWarunek("");
      setNewBadgeIkona("");
      setNewBadgePunkty("1");
      fetchAllOdznakiDef();
    } else {
      alert("Błąd tworzenia odznaki: " + error.message);
    }
  };

  const handleStartEditBadge = (badge: any) => {
    setEditingBadgeId(badge.id);
    setEditBadgeNazwa(badge.nazwa || "");
    setEditBadgeOpis(badge.opis || "");
    setEditBadgeWarunek(badge.warunek || badge.opis || "");
    setEditBadgeIkona(badge.ikona || "");
    setEditBadgePunkty(String(badge.punkty || 1));
    setEditBadgeKategoria(badge.kategoria || "Wyzwania");
  };

  const handleSaveEditBadge = async (id: number) => {
    const { error } = await supabase.from("klub_odznaki_definicje").update({
      nazwa: editBadgeNazwa.trim(),
      opis: editBadgeOpis.trim(),
      warunek: editBadgeWarunek.trim(),
      ikona: editBadgeIkona.trim() || "🏆",
      punkty: parseInt(editBadgePunkty) || 1,
      kategoria: editBadgeKategoria.trim()
    }).eq("id", id);

    if (!error) {
      alert("Odznaka została zaktualizowana!");
      setEditingBadgeId(null);
      fetchAllOdznakiDef();
      if (currentUserId) fetchOdznaki(currentUserId);
      fetchWszystkiePrzydzieloneOdznaki();
    } else {
      alert("Błąd edycji odznaki: " + error.message);
    }
  };

  const handleDeleteBadgeDef = async (id: number) => {
    if (!confirm("Czy na pewno chcesz usunąć tę odznakę z katalogu? Klubowicze stracą do niej dostęp.")) return;
    const { error } = await supabase.from("klub_odznaki_definicje").delete().eq("id", id);
    if (!error) {
      fetchAllOdznakiDef();
      if (currentUserId) fetchOdznaki(currentUserId);
      fetchWszystkiePrzydzieloneOdznaki();
    } else {
      alert("Błąd usuwania odznaki: " + error.message);
    }
  };

  // 5. Zarządzanie dyscyplinami
  const handleAddDyscyplina = async () => {
    if (!newDyscyplina.trim()) return;
    const { error } = await supabase.from("klub_dyscypliny").insert([{ nazwa: newDyscyplina.trim() }]);
    if (!error) {
      setNewDyscyplina("");
      fetchDyscypliny();
    } else {
      alert("Błąd dodawania: " + error.message);
    }
  };

  const handleUpdateDyscyplina = async (id: number, newName: string) => {
    const { error } = await supabase.from("klub_dyscypliny").update({ nazwa: newName }).eq("id", id);
    if (!error) {
      setEditingIndex(null);
      setEditText("");
      fetchDyscypliny();
    } else {
      alert("Błąd edycji: " + error.message);
    }
  };

  const handleDeleteDyscyplina = async (id: number) => {
    if (dyscyplinyList.length <= 1) {
      alert("Musisz zostawić przynajmniej jedną dyscyplinę.");
      return;
    }
    const { error } = await supabase.from("klub_dyscypliny").delete().eq("id", id);
    if (!error) {
      fetchDyscypliny();
    } else {
      alert("Błąd usuwania: " + error.message);
    }
  };

  // 6. Usuwanie wyzwania przez Admina
  const handleDeleteWyzwanie = async (challengeId: number) => {
    if (!confirm("Czy na pewno chcesz usunąć to wyzwanie?")) return;
    const { error } = await supabase.from("klub_wyzwania").delete().eq("id", challengeId);
    if (!error) {
      fetchWyzwania();
      fetchRanking(klienci);
    } else {
      alert("Błąd usuwania wyzwania: " + error.message);
    }
  };

  // 7. Otwieranie modalu wyboru zwycięzcy
  const openWinnerModal = (challenge: any) => {
    setChallengeToResolve(challenge);
    setSelectedWinnerId(challenge.tworca_id); 
    setIsWinnerModalOpen(true);
  };

  // 8. Zatwierdzenie zwycięzcy i wyzwania
  const handleConfirmWinner = async () => {
    if (!challengeToResolve || !selectedWinnerId) return;

    const { error } = await supabase
      .from("klub_wyzwania")
      .update({
        status: "zweryfikowane",
        zwyciezca_id: selectedWinnerId,
        updated_at: new Date().toISOString()
      })
      .eq("id", challengeToResolve.id);

    if (!error) {
      alert("Wynik zatwierdzony!");
      setIsWinnerModalOpen(false);
      setChallengeToResolve(null);
      fetchWyzwania();
      fetchRanking(klienci);
    } else {
      alert("Błąd: " + error.message);
    }
  };

  // 9. Rzucenie nowego wyzwania
  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpponent || !dyscyplina.trim() || !currentUserId) return;

    const { error: challengeErr } = await supabase
      .from("klub_wyzwania")
      .insert([
        {
          tworca_id: currentUserId,
          przeciwnik_id: selectedOpponent.id,
          dyscyplina: dyscyplina.trim(),
          opis: opisWyzwania.trim() || "Brak dodatkowego opisu",
          status: "oczekujace"
        }
      ]);

    if (challengeErr) {
      alert("Błąd podczas rzucania wyzwania: " + challengeErr.message);
      return;
    }

    const chatMessage = `⚔️ Rzuciłem Ci wyzwanie w dyscyplinie: "${dyscyplina.trim()}"! Wejdź w zakładkę Wyzwania i Odznaki, aby je przyjąć.`;
    await supabase.from("czat_wiadomosci").insert([
      {
        nadawca_id: currentUserId,
        nadawca_nazwa: currentUserName,
        nadawca_avatar: currentUserAvatar,
        odbiorca_id: selectedOpponent.id,
        tresc: chatMessage,
        przeczytana: false
      }
    ]);

    alert("Wyzwanie zostało pomyślnie wysłane!");
    setIsModalOpen(false);
    setOpisWyzwania("");
    setSelectedOpponent(null);
    setSearchQuery("");
    fetchWyzwania();
  };

  // 10. Zmiana statusu wyzwania
  const handleUpdateStatus = async (challengeId: number, newStatus: string) => {
    const { error } = await supabase
      .from("klub_wyzwania")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", challengeId);

    if (!error) {
      fetchWyzwania();
      fetchRanking(klienci);
    } else {
      alert("Nie udało się zaktualizować statusu.");
    }
  };

  // 11. Wyszukiwanie przeciwnika
  const filteredOpponents = klienci
    .filter((k: any) => String(k.id) !== String(currentUserId))
    .filter((k: any) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return false;

      const fName = (k.firstName || "").toLowerCase();
      const lName = (k.lastName || "").toLowerCase();

      const matchSurname = lName.startsWith(q);
      const matchNameInitial = fName.startsWith(q.split(' ')[0]) && (q.includes(' ') ? lName.startsWith(q.split(' ')[1]) : true);
      
      return matchSurname || matchNameInitial;
    });

  const getClientName = (id: any) => {
    const found = klienci.find((c: any) => String(c.id) === String(id));
    return found ? found.name : "Klubowicz";
  };

  // Helper dla członków z odznakami
  const membersWithBadges = klienci
    .filter((k: any) => String(k.id) !== String(currentUserId))
    .map((k: any) => {
      const userBadges = wszystkiePrzydzieloneOdznaki.filter((item: any) => String(item.klient_id) === String(k.id));
      return {
        ...k,
        badgesCount: userBadges.length,
        badges: userBadges
      };
    })
    .filter((k: any) => k.badgesCount > 0);

  // Funkcja pomocnicza do renderowania grafiki/zdjęcia lub emoji odznaki
  const renderBadgeGraphic = (iconStr: string | null | undefined, sizeClasses = "w-14 h-14", textClasses = "text-2xl") => {
    if (!iconStr) return <span className={textClasses}>🏆</span>;
    const isImage = iconStr.startsWith("http") || iconStr.startsWith("data:") || iconStr.startsWith("/") || iconStr.includes(".png") || iconStr.includes(".jpg") || iconStr.includes(".jpeg") || iconStr.includes(".svg") || iconStr.includes(".webp");

    if (isImage) {
      return (
        <img 
          src={iconStr} 
          alt="Odznaka" 
          className={`${sizeClasses} object-cover rounded-2xl shadow-sm border border-amber-400/30`} 
        />
      );
    }
    return <span className={textClasses}>{iconStr}</span>;
  };

  if (isLoading) return <div className="p-8 text-center text-sky-900 font-bold animate-pulse">Ładowanie modułu wyzwań...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans antialiased">
      {/* NAGŁÓWEK STRONY */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-sky-100 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
            <span>⚔️</span> Wyzwania i Odznaki Klubowe
            <button onClick={() => setIsInfoModalOpen(true)} className="text-[10px] bg-sky-100 text-sky-800 px-2.5 py-1 rounded-full cursor-pointer hover:bg-sky-200 transition-colors font-bold">ℹ️ Info</button>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Rzucaj wyzwania innym klubowiczom, rywalizuj w pojedynkach Head-to-Head i zbieraj trofea!</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-6 py-3.5 rounded-2xl transition-all shadow-lg uppercase tracking-wider flex items-center gap-2 cursor-pointer"
        >
          <span>⚡</span> Nowe wyzwanie
        </button>
      </div>

      {/* ZAKŁADKI GŁÓWNE */}
      <div className="flex rounded-2xl bg-white p-1 border border-sky-100 text-xs font-bold shadow-sm max-w-xl">
        <button
          onClick={() => { setActiveTab('aktywne'); setSelectedMemberForComparison(null); }}
          className={`flex-1 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'aktywne' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Pojedynki ⚔️
        </button>
        <button
          onClick={() => { setActiveTab('odznaki'); setSelectedMemberForComparison(null); }}
          className={`flex-1 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'odznaki' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Gablota odznak 🏆
        </button>
        <button
          onClick={() => { setActiveTab('ranking'); setSelectedMemberForComparison(null); }}
          className={`flex-1 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'ranking' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Ranking 🌍
        </button>
        {userRole === 'admin' && (
          <button
            onClick={() => { setActiveTab('admin'); setSelectedMemberForComparison(null); }}
            className={`flex-1 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'admin' ? 'bg-rose-600 text-white font-black shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Admin Panel 🛠️
          </button>
        )}
      </div>

      {/* ZAWARTOŚĆ ZAKŁADKI: WYZWANIA (POJEDYNKI) */}
      {activeTab === 'aktywne' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {wyzwania.filter(w => w.status !== 'zweryfikowane' && w.status !== 'odrzucone').map((w: any) => {
              const przeciwnikName = getClientName(w.przeciwnik_id);
              const tworcaName = getClientName(w.tworca_id);

              return (
                <div key={w.id} className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">{w.status}</span>
                      <h3 className="font-black text-sm text-slate-900 mt-2">{w.dyscyplina}</h3>
                      <p className="text-xs text-slate-600 mt-1">{w.opis}</p>
                    </div>
                    <span className="text-2xl">🎯</span>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 text-xs flex items-center justify-between border border-sky-50">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Rzucający</div>
                      <div className="font-bold text-slate-800">{tworcaName}</div>
                    </div>
                    <span className="font-black text-amber-500 text-sm">VS</span>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Przeciwnik</div>
                      <div className="font-bold text-slate-800">{przeciwnikName}</div>
                    </div>
                  </div>

                  {w.status === 'oczekujace' && String(w.przeciwnik_id) === String(currentUserId) && (
                    <div className="flex items-center gap-2 pt-2 border-t border-sky-50">
                      <button onClick={() => handleUpdateStatus(w.id, 'aktywne')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer">Przyjmij wyzwanie</button>
                      <button onClick={() => handleUpdateStatus(w.id, 'odrzucone')} className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer">Odrzuć</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Zakończone wyzwania (Skompresowana tabela) */}
          <div className="pt-6 border-t border-sky-100">
            <h3 className="font-black text-xs uppercase text-slate-400 mb-4 px-2">Zakończone wyzwania</h3>
            <div className="bg-white rounded-3xl border border-sky-100 overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-sky-100 text-slate-400 uppercase font-bold text-[10px] bg-slate-50">
                    <th className="py-3 px-4">Dyscyplina</th>
                    <th className="py-3 px-4">Uczestnicy</th>
                    <th className="py-3 px-4">Zwycięzca</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {wyzwania.filter(w => w.status === 'zweryfikowane' || w.status === 'odrzucone').map((w: any) => (
                    <tr key={w.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{w.dyscyplina}</td>
                      <td className="py-3 px-4 text-slate-600">{getClientName(w.tworca_id)} vs {getClientName(w.przeciwnik_id)}</td>
                      <td className="py-3 px-4 font-bold text-amber-600">{w.zwyciezca_id ? getClientName(w.zwyciezca_id) : "-"}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${w.status === 'zweryfikowane' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {w.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {wyzwania.filter(w => w.status === 'zweryfikowane' || w.status === 'odrzucone').length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-slate-400 italic">Brak zakończonych wyzwań.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ZAWARTOŚĆ ZAKŁADKI: GABLOTA ODZNAK */}
      {activeTab === 'odznaki' && (
        <div className="space-y-8">
          {selectedMemberForComparison ? (
            // EKRAN PORÓWNANIA ODZNAK (Wzór z Garmin Connect)
            <div className="bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 text-white space-y-8 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <button 
                  onClick={() => setSelectedMemberForComparison(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-2"
                >
                  ← Wróć do gabloty
                </button>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-300">Porównanie odznak</h2>
                <div className="w-20"></div>
              </div>

              {/* Nagłówek z awatarami i punktami */}
              <div className="grid grid-cols-2 gap-6 text-center items-center py-4 bg-slate-950/40 rounded-3xl p-6 border border-slate-800/80">
                {/* Użytkownik (Ty) */}
                <div className="flex flex-col items-center space-y-3">
                  {currentUserAvatar ? (
                    <img src={currentUserAvatar} alt={currentUserName} className="w-20 h-20 rounded-full object-cover border-2 border-amber-500 shadow-md" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-amber-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-md">
                      {currentUserName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="font-black text-sm text-white">{currentUserName}</div>
                    <div className="text-xs text-amber-400 font-bold mt-1 flex items-center justify-center gap-1">
                      <span>🏆</span> {odznaki.length} odznak
                    </div>
                  </div>
                </div>

                {/* Wybrany klubowicz */}
                <div className="flex flex-col items-center space-y-3">
                  {selectedMemberForComparison.avatar ? (
                    <img src={selectedMemberForComparison.avatar} alt={selectedMemberForComparison.name} className="w-20 h-20 rounded-full object-cover border-2 border-sky-400 shadow-md" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-sky-500 text-white font-black text-2xl flex items-center justify-center shadow-md">
                      {selectedMemberForComparison.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="font-black text-sm text-white">{selectedMemberForComparison.name}</div>
                    <div className="text-xs text-sky-400 font-bold mt-1 flex items-center justify-center gap-1">
                      <span>🏆</span> {selectedMemberForComparison.badges.length} odznak
                    </div>
                  </div>
                </div>
              </div>

              {/* Lista wszystkich definicji odznak i porównanie */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 px-2">Wszystkie odznaki w klubie</h3>
                <div className="space-y-3">
                  {wszystkieOdznaki.map((def: any) => {
                    const userHasIt = odznaki.some((o: any) => o.klub_odznaki_definicje?.id === def.id || o.odznaka_id === def.id);
                    const memberHasIt = selectedMemberForComparison.badges.some((o: any) => o.klub_odznaki_definicje?.id === def.id || o.odznaka_id === def.id);

                    return (
                      <div key={def.id} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-400/40 flex items-center justify-center text-2xl shadow-inner shrink-0 overflow-hidden">
                            {renderBadgeGraphic(def.ikona, "w-14 h-14", "text-2xl")}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-xs uppercase text-white tracking-wider">{def.nazwa}</h4>
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full">{def.punkty || 1} pkt</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{def.opis}</p>
                            {def.warunek && (
                              <p className="text-[9px] text-amber-200/70 mt-1 font-mono">🎯 Warunek: {def.warunek}</p>
                            )}
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1 inline-block">Kat: {def.kategoria || 'Wyzwania'}</span>
                          </div>
                        </div>

                        {/* Status posiadania odznaki przez obie osoby */}
                        <div className="flex items-center gap-6 shrink-0">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-slate-500 mb-1">Ty</span>
                            {userHasIt ? (
                              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 text-xs font-bold">✓</div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 text-xs">-</div>
                            )}
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-slate-500 mb-1">Klubowicz</span>
                            {memberHasIt ? (
                              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 text-xs font-bold">✓</div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 text-xs">-</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            // STANDARDOWY WIDOK GABLODY (Twoje na górze + Lista osób poniżej)
            <div className="space-y-8">
              {/* Sekcja 1: Twoje trofea */}
              <div className="space-y-4">
                <h3 className="font-black text-xs uppercase text-slate-400 px-2">Twoja gablota odznak</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {odznaki.map((o: any) => (
                    <div key={o.id} className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-400/50 flex items-center justify-center text-3xl shadow-inner shrink-0 overflow-hidden">
                        {renderBadgeGraphic(o.klub_odznaki_definicje?.ikona, "w-16 h-16", "text-3xl")}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-xs uppercase text-slate-900 tracking-wider">{o.klub_odznaki_definicje?.nazwa}</h4>
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">{o.klub_odznaki_definicje?.punkty || 1} pkt</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">{o.klub_odznaki_definicje?.opis}</p>
                        {o.klub_odznaki_definicje?.warunek && (
                          <p className="text-[9px] text-amber-800/80 mt-1 font-mono">🎯 {o.klub_odznaki_definicje?.warunek}</p>
                        )}
                        <div className="text-[9px] text-slate-400 font-mono mt-2 italic">Zdobyto: {new Date(o.przyznano_at).toLocaleDateString('pl-PL')}</div>
                      </div>
                    </div>
                  ))}

                  {odznaki.length === 0 && (
                    <div className="col-span-full bg-white rounded-3xl p-12 text-center border-2 border-dashed border-sky-100 text-slate-400 text-xs space-y-2">
                      <div className="text-3xl">🏆</div>
                      <div className="font-bold text-slate-700">Brak zdobytych odznak</div>
                      <p>Bierz udział w wyzwaniach i treningach, aby zapełnić swoją gablotę!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sekcja 2: Lista osób z odznakami (kliknięcie otwiera porównanie) */}
              <div className="space-y-4 pt-6 border-t border-sky-100">
                <h3 className="font-black text-xs uppercase text-slate-400 px-2">Klubowicze z odznakami (Kliknij, aby porównać)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {membersWithBadges.map((member: any) => (
                    <div 
                      key={member.id} 
                      onClick={() => setSelectedMemberForComparison(member)}
                      className="bg-white rounded-3xl p-5 border border-sky-100 shadow-sm flex items-center justify-between hover:border-amber-400 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-full object-cover border border-sky-200" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-sm">
                            {member.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-xs text-slate-900 group-hover:text-amber-600 transition-colors">{member.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{member.badgesCount} zdobytych odznak</div>
                        </div>
                      </div>
                      <span className="text-xs font-black bg-amber-50 text-amber-700 px-3 py-1.5 rounded-xl group-hover:bg-amber-500 group-hover:text-slate-950 transition-all">Porównaj ➔</span>
                    </div>
                  ))}

                  {membersWithBadges.length === 0 && (
                    <div className="col-span-full bg-white rounded-3xl p-8 text-center border border-sky-100 text-slate-400 text-xs italic">
                      Brak innych klubowiczów z odznakami.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ZAWARTOŚĆ ZAKŁADKI: RANKING */}
      {activeTab === 'ranking' && (
        <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-4">
          <h3 className="font-black text-sm text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span>🏆</span> Globalny Ranking Zwycięstw
          </h3>
          <p className="text-xs text-slate-500">Zestawienie klubowiczów z największą liczbą wygranych pojedynków w historii.</p>
          
          <div className="overflow-hidden rounded-2xl border border-sky-100">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 uppercase font-bold text-[10px] border-b border-sky-100">
                  <th className="py-3 px-4">Miejsce</th>
                  <th className="py-3 px-4">Klubowicz</th>
                  <th className="py-3 px-4 text-right">Wygrane pojedynki</th>
                </tr>
              </thead>
              <tbody>
                {rankingList.map((row, index) => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-black text-slate-700">
                      {index === 0 ? '🥇 1' : index === 1 ? '🥈 2' : index === 2 ? '🥉 3' : `#${index + 1}`}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-3">
                      {row.avatar ? (
                        <img src={row.avatar} alt={row.name} className="w-7 h-7 rounded-full object-cover border border-sky-200" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-[10px]">
                          {row.name.charAt(0)}
                        </div>
                      )}
                      {row.name}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-amber-600 text-sm">{row.wins} 🏆</td>
                  </tr>
                ))}
                {rankingList.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400 italic">Brak danych w rankingu. Wygrywaj pojedynki, aby pojawić się na liście!</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ZAWARTOŚĆ ZAKŁADKI: ADMIN PANEL */}
      {activeTab === 'admin' && userRole === 'admin' && (
        <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-sm space-y-6">
          <div className="flex flex-wrap gap-2 text-xs font-bold border-b border-rose-100 pb-4">
            <button onClick={() => setAdminSubTab('wyzwania')} className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${adminSubTab === 'wyzwania' ? 'bg-rose-100 text-rose-900' : 'text-slate-600 hover:text-slate-900'}`}>Wyzwania</button>
            <button onClick={() => setAdminSubTab('odznaki')} className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${adminSubTab === 'odznaki' ? 'bg-rose-100 text-rose-900' : 'text-slate-600 hover:text-slate-900'}`}>Przyznaj Odznakę</button>
            <button onClick={() => setAdminSubTab('katalog_odznak')} className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${adminSubTab === 'katalog_odznak' ? 'bg-rose-100 text-rose-900' : 'text-slate-600 hover:text-slate-900'}`}>Katalog Odznak (Garmin)</button>
            <button onClick={() => setAdminSubTab('dyscypliny')} className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${adminSubTab === 'dyscypliny' ? 'bg-rose-100 text-rose-900' : 'text-slate-600 hover:text-slate-900'}`}>Dyscypliny</button>
          </div>
          
          {/* 1. Podzakładka Admina: Wyzwania */}
          {adminSubTab === 'wyzwania' && (
             <table className="w-full text-xs text-left">
               <thead>
                 <tr className="border-b border-slate-100 text-slate-400 uppercase font-bold text-[10px]">
                   <th className="py-3 px-2">Dyscyplina</th>
                   <th className="py-3 px-2">Status</th>
                   <th className="py-3 px-2 text-right">Akcja</th>
                 </tr>
               </thead>
               <tbody>{wyzwania.map(w => <tr key={w.id} className="border-b border-slate-50">
                 <td className="py-4 px-2 font-bold text-slate-900">
                   <div>{w.dyscyplina}</div>
                   {w.zwyciezca_id && <div className="text-[10px] text-amber-600 font-normal">Zwycięzca: {getClientName(w.zwyciezca_id)}</div>}
                 </td>
                 <td className="py-4 px-2 text-slate-600">{w.status}</td>
                 <td className="py-4 px-2 text-right flex gap-2 justify-end">
                    {w.status !== 'zweryfikowane' && w.status !== 'odrzucone' && (
                      <button onClick={() => openWinnerModal(w)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-colors">Zatwierdź</button>
                    )}
                    <button onClick={() => handleDeleteWyzwanie(w.id)} className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer">Usuń</button>
                 </td>
               </tr>)}</tbody>
             </table>
          )}

          {/* 2. Podzakładka Admina: Przyznawanie Odznak */}
          {adminSubTab === 'odznaki' && (
            <div className="space-y-6">
              <h3 className="font-black text-xs text-rose-950 uppercase">Ręczne przyznawanie odznaki klubowiczowi:</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                 <select id="user-select" className="p-3 border border-rose-200 rounded-xl w-full text-xs font-bold bg-white">
                   {klienci.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                 </select>
                 <select id="badge-select" className="p-3 border border-rose-200 rounded-xl w-full text-xs font-bold bg-white">
                   {wszystkieOdznaki.map(o => <option key={o.id} value={o.id}>{o.nazwa} ({o.punkty} pkt)</option>)}
                 </select>
                 <button onClick={() => {
                   const userId = (document.getElementById('user-select') as HTMLSelectElement).value;
                   const badgeId = (document.getElementById('badge-select') as HTMLSelectElement).value;
                   assignBadge(userId, badgeId);
                 }} className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl text-xs font-black transition-colors cursor-pointer shrink-0">Przyznaj</button>
              </div>
            </div>
          )}

          {/* 3. Podzakładka Admina: Katalog Odznak (Garmin) ze zdjęciami/grafikami */}
          {adminSubTab === 'katalog_odznak' && (
            <div className="space-y-8">
              {/* Formularz tworzenia nowej odznaki */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                <h3 className="font-black text-xs uppercase text-slate-900">Stwórz nową odznakę klubową (Własna grafika / Zdjęcie)</h3>
                <form onSubmit={handleCreateBadgeDef} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nazwa odznaki</label>
                    <input type="text" value={newBadgeNazwa} onChange={(e) => setNewBadgeNazwa(e.target.value)} placeholder="np. Mistrz Wioślarstwa" className="w-full p-3 border rounded-xl text-xs font-bold bg-white" required />
                  </div>
                  
                  {/* Wybór grafiki lub upload zdjęcia */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Grafika / Zdjęcie odznaki</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        accept="image/*" 
                        id="new-badge-file-upload"
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setIsUploadingNewBadge(true);
                            const url = await uploadBadgeImageFile(file);
                            if (url) setNewBadgeIkona(url);
                            setIsUploadingNewBadge(false);
                          }
                        }} 
                      />
                      <label 
                        htmlFor="new-badge-file-upload" 
                        className="bg-slate-900 text-white font-bold text-xs px-4 py-3 rounded-xl cursor-pointer hover:bg-slate-800 transition-colors shrink-0"
                      >
                        {isUploadingNewBadge ? "Wgrywanie..." : "📷 Wybierz plik"}
                      </label>
                      <input 
                        type="text" 
                        value={newBadgeIkona} 
                        onChange={(e) => setNewBadgeIkona(e.target.value)} 
                        placeholder="lub wklej URL / Emoji" 
                        className="flex-1 p-3 border rounded-xl text-xs font-bold bg-white" 
                      />
                    </div>
                    {newBadgeIkona && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[9px] text-slate-500">Podgląd:</span>
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-amber-400/50 flex items-center justify-center bg-amber-50">
                          {renderBadgeGraphic(newBadgeIkona, "w-8 h-8", "text-sm")}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Krótki Opis Odznaki</label>
                    <input type="text" value={newBadgeOpis} onChange={(e) => setNewBadgeOpis(e.target.value)} placeholder="np. Pokonaj dystans 5000m na ergometrze wioślarskim." className="w-full p-3 border rounded-xl text-xs font-bold bg-white" required />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Warunek Otrzymania (Kryteria)</label>
                    <textarea value={newBadgeWarunek} onChange={(e) => setNewBadgeWarunek(e.target.value)} placeholder="np. Zarejestruj czas poniżej 20 minut na treningu klubowym i potwierdź u trenera." className="w-full p-3 border rounded-xl text-xs font-bold bg-white h-16 resize-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Punkty (Waga odznaki 1-10)</label>
                    <input type="number" min="1" max="10" value={newBadgePunkty} onChange={(e) => setNewBadgePunkty(e.target.value)} className="w-full p-3 border rounded-xl text-xs font-bold bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Kategoria</label>
                    <input type="text" value={newBadgeKategoria} onChange={(e) => setNewBadgeKategoria(e.target.value)} placeholder="np. Wytrzymałość / Siła / Pojedynki" className="w-full p-3 border rounded-xl text-xs font-bold bg-white" />
                  </div>
                  <div className="sm:col-span-2">
                    <button type="submit" disabled={isUploadingNewBadge} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer">
                      + Dodaj odznakę do systemu
                    </button>
                  </div>
                </form>
              </div>

              {/* Lista wszystkich odznak w katalogu z możliwością edycji i usuwania */}
              <div className="space-y-4">
                <h3 className="font-black text-xs uppercase text-slate-900">Aktualne odznaki w katalogu klubowym ({wszystkieOdznaki.length}):</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {wszystkieOdznaki.map((def: any) => (
                    <div key={def.id} className="p-5 bg-white rounded-3xl border border-sky-100 shadow-sm space-y-3 flex flex-col justify-between">
                      {editingBadgeId === def.id ? (
                        /* Formularz edycji odznaki in-line */
                        <div className="space-y-3">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Nazwa odznaki</label>
                            <input value={editBadgeNazwa} onChange={(e) => setEditBadgeNazwa(e.target.value)} placeholder="Nazwa" className="w-full p-2 border rounded-xl text-xs font-bold" />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Zdjęcie / Grafika odznaki</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input 
                                type="file" 
                                accept="image/*" 
                                id={`edit-badge-file-${def.id}`}
                                className="hidden" 
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setIsUploadingEditBadge(true);
                                    const url = await uploadBadgeImageFile(file);
                                    if (url) setEditBadgeIkona(url);
                                    setIsUploadingEditBadge(false);
                                  }
                                }} 
                              />
                              <label 
                                htmlFor={`edit-badge-file-${def.id}`}
                                className="bg-slate-800 text-white font-bold text-[10px] px-3 py-2 rounded-xl cursor-pointer shrink-0"
                              >
                                {isUploadingEditBadge ? "Wgrywanie..." : "📷 Zmień zdjęcie"}
                              </label>
                              <input value={editBadgeIkona} onChange={(e) => setEditBadgeIkona(e.target.value)} placeholder="URL lub emoji" className="flex-1 p-2 border rounded-xl text-xs" />
                            </div>
                            {editBadgeIkona && (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[9px] text-slate-400">Podgląd:</span>
                                <div className="w-8 h-8 rounded-lg overflow-hidden border border-amber-400/50 flex items-center justify-center bg-amber-50">
                                  {renderBadgeGraphic(editBadgeIkona, "w-8 h-8", "text-sm")}
                                </div>
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Opis</label>
                            <input value={editBadgeOpis} onChange={(e) => setEditBadgeOpis(e.target.value)} placeholder="Opis" className="w-full p-2 border rounded-xl text-xs" />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Warunek</label>
                            <textarea value={editBadgeWarunek} onChange={(e) => setEditBadgeWarunek(e.target.value)} placeholder="Warunek" className="w-full p-2 border rounded-xl text-xs h-14 resize-none" />
                          </div>

                          <div className="flex gap-2">
                            <div className="w-24">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Punkty</label>
                              <input type="number" min="1" max="10" value={editBadgePunkty} onChange={(e) => setEditBadgePunkty(e.target.value)} placeholder="Punkty" className="w-full p-2 border rounded-xl text-xs font-bold" />
                            </div>
                            <div className="flex-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Kategoria</label>
                              <input value={editBadgeKategoria} onChange={(e) => setEditBadgeKategoria(e.target.value)} placeholder="Kategoria" className="w-full p-2 border rounded-xl text-xs" />
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button onClick={() => handleSaveEditBadge(def.id)} disabled={isUploadingEditBadge} className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs cursor-pointer">Zapisz zmiany</button>
                            <button onClick={() => setEditingBadgeId(null)} className="flex-1 bg-slate-100 text-slate-700 font-bold py-2 rounded-xl text-xs cursor-pointer">Anuluj</button>
                          </div>
                        </div>
                      ) : (
                        /* Widok karty odznaki */
                        <>
                          <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-400/40 flex items-center justify-center text-3xl shadow-inner shrink-0 overflow-hidden">
                              {renderBadgeGraphic(def.ikona, "w-16 h-16", "text-3xl")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-black text-xs uppercase text-slate-900 truncate">{def.nazwa}</h4>
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-2 py-0.5 rounded-full shrink-0">{def.punkty || 1} pkt</span>
                              </div>
                              <p className="text-[10px] text-slate-600 mt-1">{def.opis}</p>
                              {def.warunek && (
                                <p className="text-[9px] text-amber-900/80 mt-1 font-mono">🎯 Warunek: {def.warunek}</p>
                              )}
                              <span className="text-[9px] text-sky-600 font-bold uppercase tracking-wider mt-1.5 inline-block">Kat: {def.kategoria || 'Wyzwania'}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-3 border-t border-slate-100 justify-end">
                            <button onClick={() => handleStartEditBadge(def)} className="text-xs font-bold text-sky-600 hover:text-sky-800 px-3 py-1.5 rounded-lg hover:bg-sky-50 transition-colors cursor-pointer">Edytuj</button>
                            <button onClick={() => handleDeleteBadgeDef(def.id)} className="text-xs font-bold text-rose-600 hover:text-rose-800 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer">Usuń</button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. Podzakładka Admina: Dyscypliny */}
          {adminSubTab === 'dyscypliny' && (
             <div className="space-y-4">
               <h3 className="font-black text-xs uppercase text-slate-900">Zarządzaj dyscyplinami:</h3>
               <div className="flex gap-2">
                  <input value={newDyscyplina} onChange={(e) => setNewDyscyplina(e.target.value)} placeholder="Nowa dyscyplina..." className="p-3 border rounded-xl flex-1 text-xs font-bold" />
                  <button onClick={handleAddDyscyplina} className="bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-800">Dodaj</button>
               </div>
               
               <div className="space-y-2 pt-2">
                 {dyscyplinyList.map((d, i) => (
                   <div key={d.id} className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between text-xs border border-slate-100">
                     {editingIndex === i ? (
                       <div className="flex gap-2 flex-1 mr-2">
                         <input value={editText} onChange={(e) => setEditText(e.target.value)} className="p-2 border rounded-xl flex-1 text-xs font-bold bg-white" />
                         <button onClick={() => handleUpdateDyscyplina(d.id, editText)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-bold cursor-pointer">Zapisz</button>
                         <button onClick={() => {setEditingIndex(null); setEditText("");}} className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold cursor-pointer">Anuluj</button>
                       </div>
                     ) : (
                       <>
                         <span className="font-bold text-slate-800">{d.nazwa}</span>
                         <div className="flex gap-2">
                           <button onClick={() => {setEditingIndex(i); setEditText(d.nazwa);}} className="text-sky-600 font-bold hover:underline cursor-pointer px-2 py-1">Edytuj</button>
                           <button onClick={() => handleDeleteDyscyplina(d.id)} className="text-rose-600 font-bold hover:underline cursor-pointer px-2 py-1">Usuń</button>
                         </div>
                       </>
                     )}
                   </div>
                 ))}
               </div>
             </div>
          )}
        </div>
      )}

      {/* MODAL WYBORU ZWYCIĘZCY */}
      {isWinnerModalOpen && challengeToResolve && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-2xl space-y-4 border border-sky-100">
            <h3 className="font-black text-sm text-slate-950">Wybierz zwycięzcę wyzwania</h3>
            <p className="text-xs text-slate-500">Dyscyplina: <span className="font-bold text-slate-800">{challengeToResolve.dyscyplina}</span></p>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 block">Wskaż zwycięzcę:</label>
              <select 
                value={selectedWinnerId || ""} 
                onChange={(e) => setSelectedWinnerId(e.target.value)} 
                className="w-full p-3 border border-sky-100 rounded-2xl text-xs font-bold bg-white"
              >
                <option value={challengeToResolve.tworca_id}>
                  {getClientName(challengeToResolve.tworca_id)} (Rzucający)
                </option>
                <option value={challengeToResolve.przeciwnik_id}>
                  {getClientName(challengeToResolve.przeciwnik_id)} (Przeciwnik)
                </option>
              </select>
            </div>

            <div className="flex gap-2 pt-4">
              <button onClick={() => setIsWinnerModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 font-bold p-3 rounded-2xl text-xs cursor-pointer">Anuluj</button>
              <button onClick={handleConfirmWinner} className="flex-1 bg-emerald-600 text-white font-black p-3 rounded-2xl text-xs cursor-pointer">Zatwierdź wynik</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INSTRUKCJA */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-[2rem] max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="font-black text-lg">Jak robić wyzwania?</h3>
            <ul className="text-xs space-y-3 text-slate-700 list-decimal pl-4">
              <li>Rzuć wyzwanie przeciwnikowi w aplikacji.</li>
              <li>Jeśli wyzwanie odbywa się na treningu, <b>trener potwierdza wynik</b> bezpośrednio w klubie.</li>
              <li>Jeśli wyzwanie to bieg/teren, <b>musisz przedstawić dowód</b> (np. zrzut ekranu z zegarka/aplikacji sportowej).</li>
              <li>Administrator po sprawdzeniu dowodów zatwierdza wyzwanie i przyznaje status "Zweryfikowane".</li>
            </ul>
            <button onClick={() => setIsInfoModalOpen(false)} className="w-full bg-slate-900 text-white font-bold py-3 rounded-2xl text-xs cursor-pointer">Rozumiem</button>
          </div>
        </div>
      )}

      {/* MODAL RZUCANIA WYZWANIA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-2xl space-y-4 border border-sky-100 relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-black text-sm text-sky-950">Rzuć wyzwanie</h3>
            
            <div className="relative">
              <input type="text" placeholder="Szukaj przeciwnika..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full p-3 border border-sky-100 rounded-2xl bg-sky-50 text-xs font-bold" />
              {searchQuery.length > 0 && !selectedOpponent && (
                <div className="absolute w-full mt-1 bg-white border border-sky-100 rounded-2xl shadow-lg z-50 p-1">
                  {filteredOpponents.map(opp => (
                    <button key={opp.id} onClick={() => { setSelectedOpponent(opp); setSearchQuery(""); }} className="w-full text-left p-2 hover:bg-sky-50 rounded-xl text-xs font-bold text-slate-700">{opp.name}</button>
                  ))}
                </div>
              )}
              {selectedOpponent && (
                <div className="bg-emerald-50 text-emerald-900 p-3 rounded-2xl text-xs font-bold mt-2">Wybrano: {selectedOpponent.name}</div>
              )}
            </div>

            <select value={dyscyplina} onChange={(e) => setDyscyplina(e.target.value)} className="w-full p-3 border border-sky-100 rounded-2xl text-xs font-bold bg-white">
               {dyscyplinyList.map(d => <option key={d.id} value={d.nazwa}>{d.nazwa}</option>)}
            </select>
            <textarea placeholder="Dodatkowy opis..." value={opisWyzwania} onChange={(e) => setOpisWyzwania(e.target.value)} className="w-full p-3 border border-sky-100 rounded-2xl text-xs font-bold h-20 resize-none" />
            
            <div className="flex gap-2 pt-2">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 font-bold p-3 rounded-2xl text-xs cursor-pointer">Anuluj</button>
              <button onClick={handleCreateChallenge} className="flex-1 bg-amber-500 text-slate-950 font-black p-3 rounded-2xl text-xs cursor-pointer">Wyślij</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
