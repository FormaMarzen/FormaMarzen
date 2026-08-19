"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../raporty/klienci/supabase";

const ADMIN_EMAILS = ["maciejklaput@gmail.com", "maciejklaput@icloud.com"];

export default function WyzwaniaPage() {
  const [currentUserId, setCurrentUserId] = useState<number | string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);

  const [klienci, setKlienci] = useState<any[]>([]);
  const [wyzwania, setWyzwania] = useState<any[]>([]);
  const [odznaki, setOdznaki] = useState<any[]>([]);
  
  // Stan modalu rzucania wyzwania
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOpponent, setSelectedOpponent] = useState<any | null>(null);
  const [dyscyplina, setDyscyplina] = useState("");
  const [opisWyzwania, setOpisWyzwania] = useState("");

  const [activeTab, setActiveTab] = useState<'aktywne' | 'odznaki'>('aktywne');

  // 1. Inicjalizacja użytkownika i pobranie danych
  useEffect(() => {
    const initData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = (session?.user?.email || "").toLowerCase().trim();

      if (!userEmail) return;

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
          myId = 999999999;
          setCurrentUserId(myId);
          setCurrentUserName("Maciej Kłaput (Admin)");
          const maciejClient = enriched.find((c: any) => ADMIN_EMAILS.includes(c.email) || c.name.toLowerCase().includes("maciej kłaput"));
          if (maciejClient) myId = maciejClient.id; // przypisz realne ID jeśli jest w bazie
        } else if (myProfile) {
          myId = myProfile.id;
          setCurrentUserId(myId);
          setCurrentUserName(myProfile.name);
          setCurrentUserAvatar(myProfile.avatar);
        }

        if (myId) {
          fetchWyzwania(myId);
          fetchOdznaki(myId);
        }
      }
    };

    initData();
  }, []);

  // 2. Pobieranie wyzwań z bazy
  const fetchWyzwania = async (userId: any) => {
    const { data, error } = await supabase
      .from("klub_wyzwania")
      .select("*")
      .or(`tworca_id.eq.${userId},przeciwnik_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setWyzwania(data);
    }
  };

  // 3. Pobieranie odznak użytkownika
  const fetchOdznaki = async (userId: any) => {
    const { data, error } = await supabase
      .from("klub_odznaki_klubowicze")
      .select(`
        id,
        przyznano_at,
        klub_odznaki_definicje (
          nazwa,
          opis,
          ikona
        )
      `)
      .eq("klient_id", userId);

    if (!error && data) {
      setOdznaki(data);
    }
  };

  // 4. Rzucenie nowego wyzwania (zapis do bazy + powiadomienie na czacie)
  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpponent || !dyscyplina.trim() || !currentUserId) return;

    // A. Zapisz wyzwanie w tabeli wyzwań
    const { data: newChallenge, error: challengeErr } = await supabase
      .from("klub_wyzwania")
      .insert([
        {
          tworca_id: currentUserId,
          przeciwnik_id: selectedOpponent.id,
          dyscyplina: dyscyplina.trim(),
          opis: opisWyzwania.trim() || "Brak dodatkowego opisu",
          status: "oczekujace"
        }
      ])
      .select()
      .single();

    if (challengeErr) {
      alert("Błąd podczas rzucania wyzwania: " + challengeErr.message);
      return;
    }

    // B. Wyślij automatyczną wiadomość powiadamiającą na czat klubowiczów
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

    alert("Wyzwanie zostało pomyślnie wysłane do klubowicza oraz powiadomienie trafiło na czat!");
    setIsModalOpen(false);
    setDyscyplina("");
    setOpisWyzwania("");
    setSelectedOpponent(null);
    setSearchQuery("");
    fetchWyzwania(currentUserId);
  };

  // 5. Zmiana statusu wyzwania (np. akceptacja lub odrzucenie)
  const handleUpdateStatus = async (challengeId: number, newStatus: string) => {
    const { error } = await supabase
      .from("klub_wyzwania")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", challengeId);

    if (!error) {
      fetchWyzwania(currentUserId);
    } else {
      alert("Nie udało się zaktualizować statusu.");
    }
  };

  // Filtrowanie przeciwników w wyszukiwarce (imię + litera lub nazwisko)
  const filteredOpponents = klienci
    .filter((k: any) => String(k.id) !== String(currentUserId))
    .filter((k: any) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return false;

      const fName = (k.firstName || "").toLowerCase();
      const lName = (k.lastName || "").toLowerCase();

      if (lName.startsWith(q)) return true;

      const parts = q.split(/\s+/);
      if (parts.length >= 2) {
        if (fName.startsWith(parts[0]) && lName.startsWith(parts[1])) return true;
      }
      return false;
    });

  const getClientName = (id: any) => {
    const found = klienci.find((c: any) => String(c.id) === String(id));
    return found ? found.name : "Klubowicz";
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* NAGŁÓWEK STRONY */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-sky-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-sky-950 uppercase tracking-wider flex items-center gap-2">
            <span>⚔️</span> Wyzwania i Odznaki Klubowe
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Rzucaj wyzwania innym klubowiczom, rywalizuj w pojedynkach Head-to-Head i zbieraj trofea!
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-5 py-3 rounded-2xl transition-all shadow-md uppercase tracking-wider flex items-center gap-2 cursor-pointer"
        >
          <span>⚡</span> Rzuć wyzwanie
        </button>
      </div>

      {/* ZAKŁADKI */}
      <div className="flex rounded-2xl bg-white p-1 border border-sky-200 text-xs font-bold max-w-xs shadow-sm">
        <button
          onClick={() => setActiveTab('aktywne')}
          className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'aktywne' ? 'bg-slate-900 text-white font-black shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Pojedynki ⚔️
        </button>
        <button
          onClick={() => setActiveTab('odznaki')}
          className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'odznaki' ? 'bg-slate-900 text-white font-black shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Gablota odznak 🏆
        </button>
      </div>

      {/* ZAWARTOŚĆ ZAKŁADKI: WYZWANIA */}
      {activeTab === 'aktywne' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {wyzwania.map((w: any) => {
            const isCreator = String(w.tworca_id) === String(currentUserId);
            const przeciwnikName = getClientName(w.przeciwnik_id);
            const tworcaName = getClientName(w.tworca_id);

            return (
              <div key={w.id} className="bg-white rounded-3xl p-6 border border-sky-200 shadow-sm flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                      w.status === 'aktywne' ? 'bg-emerald-500/20 text-emerald-800' :
                      w.status === 'zakonczone' ? 'bg-slate-200 text-slate-700' :
                      'bg-amber-500/20 text-amber-800'
                    }`}>
                      {w.status}
                    </span>
                    <h3 className="font-black text-sm text-slate-900 mt-2">{w.dyscyplina}</h3>
                    <p className="text-xs text-slate-600 mt-1">{w.opis}</p>
                  </div>
                  <span className="text-2xl">🎯</span>
                </div>

                <div className="bg-sky-50/60 rounded-2xl p-3 text-xs flex items-center justify-between border border-sky-100">
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Rzucający</div>
                    <div className="font-bold text-slate-800">{tworcaName}</div>
                  </div>
                  <span className="font-black text-amber-600 text-sm">VS</span>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Przeciwnik</div>
                    <div className="font-bold text-slate-800">{przeciwnikName}</div>
                  </div>
                </div>

                {/* Akcje dla przeciwnika, jeśli wyzwanie oczekuje */}
                {w.status === 'oczekujace' && !isCreator && (
                  <div className="flex items-center gap-2 pt-2 border-t border-sky-100">
                    <button
                      onClick={() => handleUpdateStatus(w.id, 'aktywne')}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Przyjmij wyzwanie
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(w.id, 'odrzucone')}
                      className="flex-1 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Odrzuć
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {wyzwania.length === 0 && (
            <div className="col-span-full bg-white rounded-3xl p-12 text-center border border-sky-200 text-slate-400 text-xs space-y-2">
              <div className="text-3xl">⚔️</div>
              <div className="font-bold text-slate-700">Brak aktywnych wyzwań</div>
              <p>Kliknij „Rzuć wyzwanie”, aby wyzwać klubowicza na pojedynek!</p>
            </div>
          )}
        </div>
      )}

      {/* ZAWARTOŚĆ ZAKŁADKI: ODZNAKI */}
      {activeTab === 'odznaki' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {odznaki.map((o: any) => {
            const def = o.klub_odznaki_definicje;
            return (
              <div key={o.id} className="bg-white rounded-3xl p-6 border border-sky-200 shadow-sm flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-400/50 flex items-center justify-center text-3xl shrink-0 shadow-inner">
                  {def?.ikona || '🏆'}
                </div>
                <div>
                  <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider">{def?.nazwa}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{def?.opis}</p>
                  <div className="text-[9px] text-slate-400 mt-2 font-mono">
                    Zdobyto: {new Date(o.przyznano_at).toLocaleDateString('pl-PL')}
                  </div>
                </div>
              </div>
            );
          })}

          {odznaki.length === 0 && (
            <div className="col-span-full bg-white rounded-3xl p-12 text-center border border-sky-200 text-slate-400 text-xs space-y-2">
              <div className="text-3xl">🏆</div>
              <div className="font-bold text-slate-700">Brak zdobytych odznak</div>
              <p>Bierz udział w wyzwaniach i treningach, aby zapełnić swoją gablotę!</p>
            </div>
          )}
        </div>
      )}

      {/* MODAL: RZUĆ WYZWANIE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2rem] max-w-lg w-full p-6 shadow-2xl space-y-6 border border-sky-200 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <h3 className="font-black text-sm text-sky-950 uppercase tracking-wider flex items-center gap-2">
                <span>⚔️</span> Nowy pojedynek Head-to-Head
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateChallenge} className="space-y-4 text-xs">
              {/* Wybór przeciwnika */}
              <div className="space-y-1.5 relative">
                <label className="font-bold text-slate-700 block">Wybierz przeciwnika (Imię + litera nazwiska lub nazwisko)</label>
                <input
                  type="text"
                  placeholder="np. Kowalski lub Jan K..."
                  value={selectedOpponent ? selectedOpponent.name : searchQuery}
                  onChange={(e) => {
                    setSelectedOpponent(null);
                    setSearchQuery(e.target.value);
                  }}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                />

                {/* Podpowiedzi wyszukiwania */}
                {!selectedOpponent && searchQuery.trim().length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-sky-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-20 p-1 space-y-1">
                    {filteredOpponents.map((opp: any) => (
                      <button
                        key={opp.id}
                        type="button"
                        onClick={() => {
                          setSelectedOpponent(opp);
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-sky-50 rounded-xl font-bold flex items-center gap-3 transition-colors cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center font-bold text-xs text-sky-950 border border-amber-400 overflow-hidden">
                          {opp.avatar ? <img src={opp.avatar} alt="" className="w-full h-full object-cover" /> : <span>👤</span>}
                        </div>
                        <span>{opp.name}</span>
                      </button>
                    ))}
                    {filteredOpponents.length === 0 && (
                      <div className="p-3 text-center text-slate-400">Nie znaleziono klubowicza.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Dyscyplina / Zadanie */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Dyscyplina / Zadanie *</label>
                <input
                  type="text"
                  required
                  placeholder="np. Wioślarz 500m / Wyciskanie sztangi"
                  value={dyscyplina}
                  onChange={(e) => setDyscyplina(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Opis */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Opis i zasady pojedynku</label>
                <textarea
                  rows={3}
                  placeholder="np. Kto szybciej przepłynie 500m na ergometrze w tym tygodniu!"
                  value={opisWyzwania}
                  onChange={(e) => setOpisWyzwania(e.target.value)}
                  className="w-full bg-sky-50/50 border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-sky-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={!selectedOpponent || !dyscyplina.trim()}
                  className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-black px-6 py-2.5 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer"
                >
                  Wyślij wyzwanie
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
