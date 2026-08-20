"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ADMIN_EMAILS = ["maciejklaput@gmail.com", "maciejklaput@icloud.com"];
const SYSTEM_ID = 5000;

export default function ClubChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | string | null>(null);
  const [secondaryUserId, setSecondaryUserId] = useState<number | string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);

  const [klienci, setKlienci] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Identyfikacja użytkownika
  useEffect(() => {
    const initUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
          isSystem: Number(c.id) === SYSTEM_ID,
        }));

        // Zapewniamy obecność oficjalnego konta systemowego w liście kontaktów
        const hasSystemAccount = enriched.some((c: any) => Number(c.id) === SYSTEM_ID);
        const allUsers = hasSystemAccount
          ? enriched
          : [
              {
                id: SYSTEM_ID,
                firstName: "Forma",
                lastName: "Marzeń",
                name: "Forma Marzeń (System)",
                email: "system@formamarzen.pl",
                avatar: null,
                isSystem: true,
              },
              ...enriched,
            ];

        setKlienci(allUsers);

        const myProfile = enriched.find((c: any) => c.email === userEmail);

        if (ADMIN_EMAILS.includes(userEmail)) {
          setCurrentUserId(999999999);
          setCurrentUserName("Maciej Kłaput (Admin)");
          setCurrentUserAvatar(null);

          const maciejClient = enriched.find(
            (c: any) =>
              ADMIN_EMAILS.includes(c.email) ||
              c.name.toLowerCase().includes("maciej kłaput")
          );
          if (maciejClient) {
            setSecondaryUserId(maciejClient.id);
          }
        } else if (myProfile) {
          setCurrentUserId(myProfile.id);
          setCurrentUserName(myProfile.name);
          setCurrentUserAvatar(myProfile.avatar);
        }
      }
    };

    initUser();
  }, []);

  // 2. Pobieranie wiadomości
  const fetchMessages = async () => {
    if (!currentUserId) return;

    let query = supabase.from("czat_wiadomosci").select("*");

    if (secondaryUserId) {
      query = query.or(
        `nadawca_id.eq.${currentUserId},odbiorca_id.eq.${currentUserId},nadawca_id.eq.${secondaryUserId},odbiorca_id.eq.${secondaryUserId}`
      );
    } else {
      query = query.or(`nadawca_id.eq.${currentUserId},odbiorca_id.eq.${currentUserId}`);
    }

    const { data, error } = await query.order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
      const effectiveIds = [
        String(currentUserId),
        secondaryUserId ? String(secondaryUserId) : null,
      ].filter(Boolean);

      const unread = data.filter(
        (m: any) => effectiveIds.includes(String(m.odbiorca_id)) && !m.przeczytana
      ).length;
      setUnreadCount(unread);
    }
  };

  useEffect(() => {
    if (!currentUserId) return;

    fetchMessages();

    const channel = supabase
      .channel("realtime-czat")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "czat_wiadomosci" },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, secondaryUserId]);

  // 3. Oznaczanie wiadomości jako przeczytane wraz z zapisem daty i godziny
  useEffect(() => {
    if (isOpen && selectedUser && currentUserId) {
      const markAsRead = async () => {
        const targetId = secondaryUserId || currentUserId;
        await supabase
          .from("czat_wiadomosci")
          .update({
            przeczytana: true,
            przeczytana_at: new Date().toISOString(),
          })
          .eq("nadawca_id", selectedUser.id)
          .eq("odbiorca_id", targetId)
          .eq("przeczytana", false);

        fetchMessages();
      };
      markAsRead();
    }
  }, [isOpen, selectedUser, currentUserId, secondaryUserId]);

  // 4. Wysyłanie nowej wiadomości
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !currentUserId) return;

    const senderId = secondaryUserId || currentUserId;

    const payload = {
      nadawca_id: senderId,
      nadawca_nazwa: currentUserName,
      nadawca_avatar: currentUserAvatar,
      odbiorca_id: selectedUser.id,
      tresc: newMessage.trim(),
      przeczytana: false,
      przeczytana_at: null,
    };

    const { error } = await supabase.from("czat_wiadomosci").insert([payload]);

    if (!error) {
      setNewMessage("");
      fetchMessages();
    }
  };

  if (!currentUserId) return null;

  const effectiveIds = [
    String(currentUserId),
    secondaryUserId ? String(secondaryUserId) : null,
  ].filter(Boolean);

  // Filtrowanie aktywnej konwersacji (uwzględnia również konto Systemowe 5000)
  const activeChatMessages = messages.filter((m: any) => {
    if (!selectedUser) return false;
    const isSenderMe = effectiveIds.includes(String(m.nadawca_id));
    const isReceiverMe = effectiveIds.includes(String(m.odbiorca_id));
    const isTargetThem =
      String(m.nadawca_id) === String(selectedUser.id) ||
      String(m.odbiorca_id) === String(selectedUser.id);

    return (isSenderMe && String(m.odbiorca_id) === String(selectedUser.id)) || (isTargetThem && isReceiverMe);
  });

  // Zbieranie ID osób z historią konwersacji
  const chattedUserIds = new Set<string | number>();
  messages.forEach((m: any) => {
    if (effectiveIds.includes(String(m.nadawca_id))) {
      chattedUserIds.add(m.odbiorca_id);
    } else if (effectiveIds.includes(String(m.odbiorca_id))) {
      chattedUserIds.add(m.nadawca_id);
    }
  });

  const displayedUsers = klienci
    .filter((k: any) => !effectiveIds.includes(String(k.id)))
    .filter((k: any) => {
      // Konto systemowe jest zawsze dostępne na liście kontaktów
      if (Number(k.id) === SYSTEM_ID) return true;

      const q = searchQuery.trim().toLowerCase();
      if (!q) {
        return chattedUserIds.has(k.id);
      }

      const fName = (k.firstName || "").toLowerCase();
      const lName = (k.lastName || "").toLowerCase();

      if (lName.startsWith(q)) {
        return true;
      }

      const parts = q.split(/\s+/);
      if (parts.length >= 2) {
        const typedFirst = parts[0];
        const typedLastInitial = parts[1];
        if (fName.startsWith(typedFirst) && lName.startsWith(typedLastInitial)) {
          return true;
        }
      }

      return k.name?.toLowerCase().includes(q);
    });

  // Renderowanie kart powiadomień: urodziny, odznaki, wyzwania i standardowe wiadomości
  const renderMessageContent = (msg: any, isMe: boolean) => {
    const isBirthdayNotification = msg.tresc?.includes("🎂") || msg.tresc?.includes("urodzin");
    const isBadgeNotification = msg.tresc?.includes("🎖️") || msg.tresc?.includes("odznakę klubową");
    const isChallengeNotification = msg.tresc?.includes("⚔️") || msg.tresc?.includes("Rzuciłem Ci wyzwanie");
    const isSystemSender = Number(msg.nadawca_id) === SYSTEM_ID;

    // Styl dla życzeń urodzinowych
    if (isBirthdayNotification) {
      return (
        <div className="w-full bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-purple-600/15 border-2 border-amber-400 rounded-3xl p-4 shadow-md text-slate-900 space-y-2.5">
          <div className="flex items-center justify-between border-b border-amber-300/40 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-bounce">🎂</span>
              <span className="font-black text-[11px] uppercase tracking-wider text-rose-700">
                Prezent Urodzinowy: -20%
              </span>
            </div>
            <span className="text-[9px] bg-rose-500 text-white font-black px-2 py-0.5 rounded-full uppercase shadow-sm">
              FORMA MARZEŃ
            </span>
          </div>
          <p className="text-xs leading-relaxed font-semibold text-slate-800">{msg.tresc}</p>
        </div>
      );
    }

    // Styl dla ogólnych powiadomień systemowych/odznak
    if (isBadgeNotification || isSystemSender) {
      return (
        <div className="w-full bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-slate-900/40 border-2 border-amber-400/70 rounded-3xl p-4 shadow-md text-slate-900 space-y-2">
          <div className="flex items-center justify-between border-b border-amber-300/40 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <span className="font-black text-[11px] uppercase tracking-wider text-amber-900">
                Oficjalne Powiadomienie Klubowe
              </span>
            </div>
            <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
              System
            </span>
          </div>
          <p className="text-xs leading-relaxed font-semibold text-slate-800">{msg.tresc}</p>
        </div>
      );
    }

    // Styl dla wyzwań
    if (isChallengeNotification) {
      return (
        <div className="w-full bg-gradient-to-br from-slate-950 to-slate-900 border-2 border-amber-500 rounded-3xl p-4 shadow-md text-white space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚔️</span>
              <span className="font-black text-[11px] uppercase tracking-wider text-amber-400">
                Pojedynek Head-to-Head
              </span>
            </div>
            <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
              Wyzwanie
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-200">{msg.tresc}</p>
        </div>
      );
    }

    return (
      <div
        className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
          isMe
            ? "bg-slate-900 text-white rounded-br-none"
            : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
        }`}
      >
        {msg.tresc}
      </div>
    );
  };

  return (
    <div className="fixed bottom-6 right-6 z-[120] font-sans antialiased">
      {isOpen && (
        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-2xl w-[360px] sm:w-[390px] h-[520px] mb-4 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          {/* NAGŁÓWEK CZATU */}
          <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              {selectedUser ? (
                <>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="text-slate-300 hover:text-white p-1 cursor-pointer transition-colors"
                    title="Wróć do listy"
                  >
                    ←
                  </button>
                  <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shrink-0 border ${Number(selectedUser.id) === SYSTEM_ID ? "bg-amber-400 text-slate-950 border-amber-300" : "bg-sky-100 text-sky-950 border-amber-400"}`}>
                    {selectedUser.avatar ? (
                      <img src={selectedUser.avatar} alt={selectedUser.name} className="w-full h-full object-cover" />
                    ) : Number(selectedUser.id) === SYSTEM_ID ? (
                      <span>👑</span>
                    ) : (
                      <span>👤</span>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-bold text-xs truncate max-w-[170px]">{selectedUser.name}</div>
                    <div className="text-[10px] font-medium flex items-center gap-1">
                      {Number(selectedUser.id) === SYSTEM_ID ? (
                        <span className="text-amber-400 font-bold">Konto Systemowe</span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Klubowicz
                        </span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg">💬</span>
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-wider">Czat Klubowiczów</h3>
                    <p className="text-[10px] text-slate-400">Wybierz osobę lub komunikaty systemowe</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>

          {/* WIDOK LISTY UŻYTKOWNIKÓW */}
          {!selectedUser ? (
            <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3 bg-slate-50/50">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">🔍</span>
                <input
                  type="text"
                  placeholder="Szukaj: imię, nazwisko..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {displayedUsers.map((user: any) => {
                  const isSys = Number(user.id) === SYSTEM_ID;
                  const userUnread = messages.filter(
                    (m: any) =>
                      String(m.nadawca_id) === String(user.id) &&
                      effectiveIds.includes(String(m.odbiorca_id)) &&
                      !m.przeczytana
                  ).length;

                  return (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all shadow-sm cursor-pointer text-left group ${
                        isSys
                          ? "bg-gradient-to-r from-amber-50 to-white border-amber-300 hover:border-amber-400"
                          : "bg-white hover:bg-sky-50 border-slate-200/80"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shrink-0 border ${
                            isSys
                              ? "bg-amber-400 text-slate-950 border-amber-300 shadow-sm"
                              : "bg-sky-100 text-sky-950 border-amber-400"
                          }`}
                        >
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                          ) : isSys ? (
                            <span>👑</span>
                          ) : (
                            <span>👤</span>
                          )}
                        </div>
                        <div>
                          <div className={`font-bold text-xs ${isSys ? "text-amber-950 font-black" : "text-slate-900 group-hover:text-sky-950"}`}>
                            {user.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {isSys ? "Oficjalne powiadomienia" : "Klubowicz"}
                          </div>
                        </div>
                      </div>

                      {userUnread > 0 && (
                        <span className="bg-rose-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm">
                          {userUnread}
                        </span>
                      )}
                    </button>
                  );
                })}

                {displayedUsers.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                    <div>Brak wyników wyszukiwania.</div>
                    <p className="text-[10px]">Wpisz nazwisko lub imię w wyszukiwarce powyżej.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* WIDOK AKTYWNEJ ROZMOWY */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeChatMessages.map((msg: any) => {
                  const isMe = effectiveIds.includes(String(msg.nadawca_id));
                  const isSys = Number(msg.nadawca_id) === SYSTEM_ID;
                  const isSpecial = isSys || msg.tresc?.includes("🎖️") || msg.tresc?.includes("⚔️") || msg.tresc?.includes("🎂");
                  
                  const time = msg.created_at
                    ? new Date(msg.created_at).toLocaleTimeString("pl-PL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  const readTime = msg.przeczytana_at
                    ? new Date(msg.przeczytana_at).toLocaleString("pl-PL", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : null;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isSpecial ? "items-center w-full my-1.5" : isMe ? "items-end" : "items-start"}`}
                    >
                      {renderMessageContent(msg, isMe)}

                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-[9px] text-slate-400 font-mono">{time}</span>
                        {isMe && (
                          <span className="text-[9px] text-slate-400 font-medium">
                            {msg.przeczytana && readTime
                              ? `✓✓ Przeczytano: ${readTime}`
                              : "✓ Wysłano"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {activeChatMessages.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                    <div>👋 Rozpocznij rozmowę!</div>
                    <p className="text-[10px]">
                      {Number(selectedUser.id) === SYSTEM_ID
                        ? "Tutaj pojawiać się będą oficjalne powiadomienia o odznakach, urodzinach i wydarzeniach."
                        : "Napisz pierwszą wiadomość do tego klubowicza."}
                    </p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* FORMULARZ WYSYŁANIA */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder={Number(selectedUser.id) === SYSTEM_ID ? "Napisz do administracji..." : "Napisz wiadomość..."}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer"
                >
                  Wyślij
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* PRZYCISK OTWARCIA CZATU */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-2xl flex items-center justify-center text-2xl transition-transform hover:scale-105 cursor-pointer relative border-2 border-amber-400"
        title="Otwórz czat"
      >
        <span>💬</span>

        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md border-2 border-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
