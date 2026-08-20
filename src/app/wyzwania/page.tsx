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
  const [dyscyplinyList, setDyscyplinyList] = useState<any[]>([]);
  
  // Stan interfejsu
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState(false);
  const [challengeToResolve, setChallengeToResolve] = useState<any | null>(null);
  const [selectedWinnerId, setSelectedWinnerId] = useState<any | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOpponent, setSelectedOpponent] = useState<any | null>(null);
  const [dyscyplina, setDyscyplina] = useState("");
  const [opisWyzwania, setOpisWyzwania] = useState("");
  const [newDyscyplina, setNewDyscyplina] = useState("");

  // Stany edycji dyscyplin
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const [activeTab, setActiveTab] = useState<'aktywne' | 'odznaki' | 'admin'>('aktywne');
  const [adminSubTab, setAdminSubTab] = useState<'wyzwania' | 'odznaki' | 'dyscypliny'>('wyzwania');
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
          await fetchHistoriaOdznak();
          await fetchDyscypliny();
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
      .select(`id, przyznano_at, klient_id, klub_odznaki_definicje (nazwa, opis, ikona)`)
      .eq("klient_id", userId);
    if (data) setOdznaki(data);
  };

  const fetchAllOdznakiDef = async () => {
    const { data } = await supabase.from("klub_odznaki_definicje").select("*");
    if (data) setWszystkieOdznaki(data);
  };

  const fetchHistoriaOdznak = async () => {
    const { data } = await supabase.from("klub_odznaki_klubowicze").select(`*, klub_odznaki_definicje (nazwa), klienci (Imię, Nazwisko)`);
    if (data) setOdznakiHistoria(data);
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
    } else {
      alert("Błąd przyznawania: " + error.message);
    }
  };

  // 4. Zarządzanie dyscyplinami
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

  // 5. Usuwanie wyzwania przez Admina
  const handleDeleteWyzwanie = async (challengeId: number) => {
    if (!confirm("Czy na pewno chcesz usunąć to wyzwanie?")) return;
    const { error } = await supabase.from("klub_wyzwania").delete().eq("id", challengeId);
    if (!error) {
      fetchWyzwania();
    } else {
      alert("Błąd usuwania wyzwania: " + error.message);
    }
  };

  // 6. Otwieranie modalu wyboru zwycięzcy
  const openWinnerModal = (challenge: any) => {
    setChallengeToResolve(challenge);
    setSelectedWinnerId(challenge.tworca_id); 
    setIsWinnerModalOpen(true);
  };

  // 7. Zatwierdzenie zwycięzcy i wyzwania
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
    } else {
      alert("Błąd: " + error.message);
    }
  };

  // 8. Rzucenie nowego wyzwania
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

  // 9. Zmiana statusu wyzwania
  const handleUpdateStatus = async (challengeId: number, newStatus: string) => {
    const { error } = await supabase
      .from("klub_wyzwania")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", challengeId);

    if (!error) {
      fetchWyzwania();
    } else {
      alert("Błąd: " + error.message);
    }
  };

  // 10. Wyszukiwanie przeciwnika
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

      {/* ZAKŁADKI */}
      <div className="flex rounded-2xl bg-white p-1 border border-sky-100 text-xs font-bold shadow-sm max-w-lg">
        <button
          onClick={() => setActiveTab('aktywne')}
          className={`flex-1 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'aktywne' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Pojedynki ⚔️
        </button>
        <button
          onClick={() => setActiveTab('odznaki')}
          className={`flex-1 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'odznaki' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Gablota odznak 🏆
        </button>
        {userRole === 'admin' && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 py-3 rounded-xl transition-all cursor-pointer ${activeTab === 'admin' ? 'bg-rose-600 text-white font-black shadow-md' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Admin Panel 🛠️
          </button>
        )}
      </div>

      {/* ZAWARTOŚĆ ZAKŁADKI: WYZWANIA */}
      {activeTab === 'aktywne' && (
        <div className="space-y-8">
          {/* Aktywne wyzwania (Kafelki) */}
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
                      <button
                        onClick={() => handleUpdateStatus(w.id, 'aktywne')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Przyjmij wyzwanie
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(w.id, 'odrzucone')}
                        className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Odrzuć
                      </button>
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

      {/* ZAWARTOŚĆ ZAKŁADKI: ODZNAKI */}
      {activeTab === 'odznaki' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {odznaki.map((o: any) => (
            <div key={o.id} className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-400/50 flex items-center justify-center text-3xl shadow-inner">{o.klub_odznaki_definicje?.ikona || '🏆'}</div>
              <div>
                <h4 className="font-black text-xs uppercase text-slate-900 tracking-wider">{o.klub_odznaki_definicje?.nazwa}</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">{o.klub_odznaki_definicje?.opis}</p>
                <div className="text-[9px] text-slate-400 font-mono mt-2 italic">Zdobyto: {new Date(o.przyznano_at).toLocaleDateString('pl-PL')}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ZAWARTOŚĆ ZAKŁADKI: ADMIN PANEL */}
      {activeTab === 'admin' && userRole === 'admin' && (
        <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-sm space-y-6">
          <div className="flex gap-2 text-xs font-bold border-b border-rose-100 pb-4">
            <button onClick={() => setAdminSubTab('wyzwania')} className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${adminSubTab === 'wyzwania' ? 'bg-rose-100 text-rose-900' : 'text-slate-600 hover:text-slate-900'}`}>Wyzwania</button>
            <button onClick={() => setAdminSubTab('dyscypliny')} className={`px-4 py-2 rounded-lg transition-colors cursor-pointer ${adminSubTab === 'dyscypliny' ? 'bg-rose-100 text-rose-900' : 'text-slate-600 hover:text-slate-900'}`}>Dyscypliny</button>
          </div>
          
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
