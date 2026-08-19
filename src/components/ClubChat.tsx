"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ClubChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | string | null>(null);
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

  // 1. Identyfikacja zalogowanego użytkownika i pobranie listy klubowiczów
  useEffect(() => {
    const initUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;

      if (!userEmail) return;

      const { data: klienciData } = await supabase.from("klienci").select("*");
      if (klienciData) {
        const enriched = klienciData.map((c: any) => ({
          id: c.id,
          name: `${c.Imię || c.firstName || ""} ${c.Nazwisko || c.lastName || ""}`.trim() || c["E-mail"] || "Klubowicz",
          email: c["E-mail"] || c.email || "",
          avatar: c.avatarUrl || c.avatar || null,
        }));

        setKlienci(enriched);

        const myProfile = enriched.find(
          (c: any) => c.email.toLowerCase().trim() === userEmail.toLowerCase().trim()
        );

        if (myProfile) {
          setCurrentUserId(myProfile.id);
          setCurrentUserName(myProfile.name);
          setCurrentUserAvatar(myProfile.avatar);
        } else if (userEmail.toLowerCase() === "maciejklaput@gmail.com") {
          setCurrentUserId(999999999);
          setCurrentUserName("Maciej Kłaput (Admin)");
          setCurrentUserAvatar(null);
        }
      }
    };

    initUser();
  }, []);

  // 2. Pobieranie wiadomości i zliczanie nieprzeczytanych
  const fetchMessages = async () => {
    if (!currentUserId) return;

    const { data, error } = await supabase
      .from("czat_wiadomosci")
      .select("*")
      .or(`nadawca_id.eq.${currentUserId},odbiorca_id.eq.${currentUserId}`)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
      const unread = data.filter(
        (m: any) => String(m.odbiorca_id) === String(currentUserId) && !m.przeczytana
      ).length;
      setUnreadCount(unread);
    }
  };

  useEffect(() => {
    if (!currentUserId) return;

    fetchMessages();

    // Subskrypcja Realtime
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
  }, [currentUserId]);

  // 3. Oznaczanie wiadomości jako przeczytane po otwarciu czatu z daną osobą
  useEffect(() => {
    if (isOpen && selectedUser && currentUserId) {
      const markAsRead = async () => {
        await supabase
          .from("czat_wiadomosci")
          .update({ przeczytana: true })
          .eq("nadawca_id", selectedUser.id)
          .eq("odbiorca_id", currentUserId);

        fetchMessages();
      };
      markAsRead();
    }
  }, [isOpen, selectedUser, currentUserId]);

  // 4. Wysyłanie nowej wiadomości
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !currentUserId) return;

    const payload = {
      nadawca_id: currentUserId,
      nadawca_nazwa: currentUserName,
      nadawca_avatar: currentUserAvatar,
      odbiorca_id: selectedUser.id,
      tresc: newMessage.trim(),
      przeczytana: false,
    };

    const { error } = await supabase.from("czat_wiadomosci").insert([payload]);

    if (!error) {
      setNewMessage("");
      fetchMessages();
    }
  };

  if (!currentUserId) return null;

  // Filtrowanie rozmowy z aktywnym rozmówcą
  const activeChatMessages = messages.filter((m: any) => {
    if (!selectedUser) return false;
    return (
      (String(m.nadawca_id) === String(currentUserId) && String(m.odbiorca_id) === String(selectedUser.id)) ||
      (String(m.nadawca_id) === String(selectedUser.id) && String(m.odbiorca_id) === String(currentUserId))
    );
  });

  const filteredUsers = klienci
    .filter((k: any) => String(k.id) !== String(currentUserId))
    .filter((k: any) => k.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="fixed bottom-6 right-6 z-[120] font-sans antialiased">
      {/* OKNO CZATU */}
      {isOpen && (
        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-2xl w-[360px] sm:w-[390px] h-[520px] mb-4 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          {/* NAGŁÓWEK OKNA */}
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
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-sky-100 flex items-center justify-center font-bold text-sky-950 text-xs border border-amber-400 shrink-0">
                    {selectedUser.avatar ? (
                      <img src={selectedUser.avatar} alt={selectedUser.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>👤</span>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-bold text-xs truncate max-w-[170px]">{selectedUser.name}</div>
                    <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Klubowicz
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg">💬</span>
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-wider">Czat Klubowiczów</h3>
                    <p className="text-[10px] text-slate-400">Wybierz osobę i napisz wiadomość</p>
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

          {/* WIDOK 1: LISTA I WYSZUKIWARKA KLUBOWICZÓW */}
          {!selectedUser ? (
            <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-3 bg-slate-50/50">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">🔍</span>
                <input
                  type="text"
                  placeholder="Szukaj po imieniu i nazwisku..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {filteredUsers.map((user: any) => {
                  const userUnread = messages.filter(
                    (m: any) =>
                      String(m.nadawca_id) === String(user.id) &&
                      String(m.odbiorca_id) === String(currentUserId) &&
                      !m.przeczytana
                  ).length;

                  return (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className="w-full bg-white hover:bg-sky-50 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between transition-colors shadow-sm cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-sky-100 border border-amber-400 flex items-center justify-center font-bold text-sky-950 text-xs shrink-0">
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>👤</span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900 group-hover:text-sky-950">{user.name}</div>
                          <div className="text-[10px] text-slate-400">{user.email || "Klubowicz"}</div>
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

                {filteredUsers.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Nie znaleziono klubowicza.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* WIDOK 2: OKNO ROZMOWY */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
              {/* WIADOMOŚCI */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeChatMessages.map((msg: any) => {
                  const isMe = String(msg.nadawca_id) === String(currentUserId);
                  const time = msg.created_at
                    ? new Date(msg.created_at).toLocaleTimeString("pl-PL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[78%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                          isMe
                            ? "bg-slate-900 text-white rounded-br-none"
                            : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                        }`}
                      >
                        {msg.tresc}
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 px-1 font-mono">{time}</span>
                    </div>
                  );
                })}

                {activeChatMessages.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                    <div>👋 Rozpocznij rozmowę!</div>
                    <p className="text-[10px]">Napisz pierwszą wiadomość do tego klubowicza.</p>
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
                  placeholder="Napisz wiadomość..."
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

      {/* PŁYWAJĄCY DYMEK W PRAWYM DOLNYM ROGU */}
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
