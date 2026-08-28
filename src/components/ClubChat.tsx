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
  const [isAdmin, setIsAdmin] = useState(false);

  // Główne zakładki widoku listy: Prywatne | Grupy | Treningi
  const [activeTab, setActiveTab] = useState<"direct" | "groups" | "trainings">("trainings");
  const [groupFilterTab, setGroupFilterTab] = useState<"my" | "public">("my");

  // Zakładka wewnątrz aktywnej rozmowy / grupy: Czat | Zdjęcia | Uczestnicy
  const [chatInsideTab, setChatInsideTab] = useState<"messages" | "media" | "members">("messages");
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Stan dla menu reakcji / akcji dla konkretnej wiadomości
  const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null);

  const [klienci, setKlienci] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [groupMessages, setGroupMessages] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  
  // Stany dla grafiku zajęć i zapisów
  const [grafikZajec, setGrafikZajec] = useState<any[]>([]);
  const [zapisyZajec, setZapisyZajec] = useState<any[]>([]);

  const [newMessage, setNewMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  // Załączniki do wiadomości
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modale Administratora / Grupy
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<"publiczna" | "zamknieta">("zamknieta");
  const [newGroupIcon, setNewGroupIcon] = useState("🏋️‍♂️");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<(number | string)[]>([]);

  // Modal edycji grupy
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupIcon, setEditGroupIcon] = useState("");

  // Przeciąganie dymka
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const elementStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    if (chatInsideTab === "messages") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, groupMessages, selectedUser, selectedGroup, chatInsideTab]);

  // Reset stanu po zamknięciu czatu
  const handleCloseChat = () => {
    setIsOpen(false);
    setSelectedUser(null);
    setSelectedGroup(null);
    setSelectedFile(null);
    setFilePreview(null);
    setChatInsideTab("messages");
    setFullscreenImage(null);
    setActiveMessageMenuId(null);
  };

  // Inicjalizacja pozycji dymka
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPos = localStorage.getItem("chat_bubble_pos");
      if (savedPos) {
        try {
          const parsed = JSON.parse(savedPos);
          const maxX = window.innerWidth - 70;
          const maxY = window.innerHeight - 70;
          setPosition({
            x: Math.min(Math.max(10, parsed.x), Math.max(10, maxX)),
            y: Math.min(Math.max(10, parsed.y), Math.max(10, maxY)),
          });
          return;
        } catch {
          // fallback
        }
      }
      setPosition({
        x: Math.max(10, window.innerWidth - 80),
        y: Math.max(10, window.innerHeight - 80),
      });
    }
  }, []);

  // Przeciąganie dymka
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest(".no-drag")) return;

    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    if (position) {
      elementStartPos.current = { ...position };
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      elementStartPos.current = { x: rect.left, y: rect.top };
    }

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      hasMovedRef.current = true;
    }

    let newX = elementStartPos.current.x + deltaX;
    let newY = elementStartPos.current.y + deltaY;

    const maxX = window.innerWidth - 65;
    const maxY = window.innerHeight - 65;

    newX = Math.min(Math.max(10, newX), maxX);
    newY = Math.min(Math.max(10, newY), maxY);

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignoruj zwolnienie
    }

    if (position) {
      localStorage.setItem("chat_bubble_pos", JSON.stringify(position));
    }

    if (!hasMovedRef.current) {
      if (isOpen) {
        handleCloseChat();
      } else {
        setSelectedUser(null);
        setSelectedGroup(null);
        setChatInsideTab("messages");
        setIsOpen(true);
      }
    }
  };

  // Aktualizacja znacznika aktywności
  const updateLastSeen = async (userId: number | string) => {
    if (!userId || Number(userId) === SYSTEM_ID || Number(userId) === 999999999) return;
    try {
      await supabase
        .from("klienci")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", userId);
    } catch (err) {
      console.error("Błąd aktualizacji last_seen:", err);
    }
  };

  useEffect(() => {
    if (!currentUserId) return;
    const actualId = secondaryUserId || currentUserId;
    updateLastSeen(actualId);

    const interval = setInterval(() => {
      updateLastSeen(actualId);
    }, 60000);

    return () => clearInterval(interval);
  }, [currentUserId, secondaryUserId]);

  // Powiadomienia Push (1-na-1)
  const sendChatPushNotification = async (recipientId: number | string, senderName: string, messageText: string) => {
    try {
      if (Number(recipientId) === SYSTEM_ID) return;

      let query = supabase.from("klienci").select("id, push_subscription");
      if (Number(recipientId) === 999999999) {
        query = query.in("E-mail", ADMIN_EMAILS);
      } else {
        query = query.eq("id", recipientId);
      }

      const { data: clients, error: clientErr } = await query;
      if (clientErr || !clients || clients.length === 0) return;

      const subscriptions = clients
        .map((c: any) => {
          if (!c.push_subscription) return null;
          try {
            return typeof c.push_subscription === "string"
              ? JSON.parse(c.push_subscription)
              : c.push_subscription;
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      if (subscriptions.length === 0) return;

      const previewText = messageText.length > 80 ? `${messageText.slice(0, 77)}...` : messageText;

      await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptions,
          payload: {
            title: `Wiadomość od: ${senderName}`,
            body: previewText,
            url: "/",
          },
        }),
      });
    } catch (err) {
      console.error("Błąd podczas wysyłania powiadomienia Push:", err);
    }
  };

  // Powiadomienia Push (Grupowe / Treningowe)
  const sendGroupPushNotification = async (groupId: string, senderId: string, senderName: string, groupName: string, messageText: string, trainingId?: any) => {
    try {
      let recipientIds: string[] = [];

      if (trainingId) {
        const { data: signedUp } = await supabase
          .from("zapisy_zajec")
          .select("klient_id")
          .eq("class_key", trainingId);

        if (signedUp) {
          recipientIds = signedUp.map((z: any) => String(z.klient_id));
        }
      } else {
        const { data: groupData } = await supabase
          .from("czat_grupy")
          .select("czlonkowie_ids, wyciszeni_ids")
          .eq("id", groupId)
          .single();

        if (groupData) {
          const members = Array.isArray(groupData.czlonkowie_ids) ? groupData.czlonkowie_ids.map(String) : [];
          const muted = Array.isArray(groupData.wyciszeni_ids) ? groupData.wyciszeni_ids.map(String) : [];
          recipientIds = members.filter((id) => !muted.includes(id));
        }
      }

      recipientIds = recipientIds.filter((id) => id !== String(senderId));
      if (recipientIds.length === 0) return;

      const { data: clients } = await supabase
        .from("klienci")
        .select("id, push_subscription")
        .in("id", recipientIds);

      if (!clients || clients.length === 0) return;

      const subscriptions = clients
        .map((c: any) => {
          if (!c.push_subscription) return null;
          try {
            return typeof c.push_subscription === "string"
              ? JSON.parse(c.push_subscription)
              : c.push_subscription;
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      if (subscriptions.length === 0) return;

      const previewText = messageText.length > 80 ? `${messageText.slice(0, 77)}...` : messageText;

      await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptions,
          payload: {
            title: `${groupName} (${senderName})`,
            body: previewText,
            url: "/",
          },
        }),
      });
    } catch (err) {
      console.error("Błąd wysyłki push grupowego:", err);
    }
  };

  // Identyfikacja użytkownika
  useEffect(() => {
    const initUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userEmail = (session?.user?.email || "").toLowerCase().trim();

      if (!userEmail) return;

      const adminLogged = ADMIN_EMAILS.includes(userEmail);
      setIsAdmin(adminLogged);

      const { data: klienciData } = await supabase.from("klienci").select("*");
      if (klienciData) {
        const enriched = klienciData.map((c: any) => ({
          id: c.id,
          firstName: c.Imię || c.firstName || "",
          lastName: c.Nazwisko || c.lastName || "",
          name: `${c.Imię || c.firstName || ""} ${c.Nazwisko || c.lastName || ""}`.trim() || c["E-mail"] || "Klubowicz",
          email: (c["E-mail"] || c.email || "").toLowerCase().trim(),
          avatar: c.avatarUrl || c.avatar || null,
          last_seen: c.last_seen || null,
          isSystem: Number(c.id) === SYSTEM_ID,
        }));

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
                last_seen: null,
                isSystem: true,
              },
              ...enriched,
            ];

        setKlienci(allUsers);

        const myProfile = enriched.find((c: any) => c.email === userEmail);

        if (adminLogged) {
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
            updateLastSeen(maciejClient.id);
          }
        } else if (myProfile) {
          setCurrentUserId(myProfile.id);
          setCurrentUserName(myProfile.name);
          setCurrentUserAvatar(myProfile.avatar);
          updateLastSeen(myProfile.id);
        }
      }
    };

    initUser();
  }, []);

  // Pobieranie grup, grafiku zajęć oraz zapisów
  const fetchGroupsAndTrainings = async () => {
    if (!currentUserId) return;
    try {
      const { data: groupsData } = await supabase
        .from("czat_grupy")
        .select("*")
        .order("created_at", { ascending: false });

      if (groupsData) setGroups(groupsData);

      const { data: grafikData } = await supabase
        .from("grafik_zajec")
        .select("*")
        .order("start", { ascending: true });

      if (grafikData) setGrafikZajec(grafikData);

      const { data: zapisyData } = await supabase
        .from("zapisy_zajec")
        .select("*");

      if (zapisyData) setZapisyZajec(zapisyData);

    } catch (err) {
      console.error("Błąd pobierania danych grup i treningów:", err);
    }
  };

  // Pobieranie wiadomości z wybranej grupy / treningu
  const fetchGroupMessages = async () => {
    if (!selectedGroup) return;
    try {
      const { data, error } = await supabase
        .from("czat_wiadomosci")
        .select("*")
        .eq("grupa_id", selectedGroup.id)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setGroupMessages(data);
      }
    } catch (err) {
      console.error("Błąd pobierania wiadomości grupy:", err);
    }
  };

  // Pobieranie wiadomości 1-na-1
  const fetchMessages = async () => {
    if (!currentUserId) return;

    let query = supabase.from("czat_wiadomosci").select("*").is("grupa_id", null);

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

  // Subskrypcje Realtime oraz cykliczne odświeżanie
  useEffect(() => {
    if (!currentUserId) return;

    fetchMessages();
    fetchGroupsAndTrainings();

    const channel = supabase
      .channel("realtime-czat-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "czat_wiadomosci" }, () => {
        fetchMessages();
        if (selectedGroup) fetchGroupMessages();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "czat_grupy" }, () => {
        fetchGroupsAndTrainings();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "grafik_zajec" }, () => {
        fetchGroupsAndTrainings();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "zapisy_zajec" }, () => {
        fetchGroupsAndTrainings();
      })
      .subscribe();

    const checkDailyUpdate = () => {
      const now = new Date();
      if (now.getHours() === 1 && now.getMinutes() === 0) {
        fetchGroupsAndTrainings();
      }
    };
    const dailyInterval = setInterval(checkDailyUpdate, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(dailyInterval);
    };
  }, [currentUserId, secondaryUserId, selectedGroup]);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupMessages();
    }
  }, [selectedGroup]);

  // Oznaczanie jako przeczytane dla czatów 1-na-1
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

  // Obsługa plików (wiadomości)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Maksymalny rozmiar pliku to 15MB");
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }
  };

  const uploadFileToSupabase = async (file: File): Promise<{ url: string; type: string; name: string } | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("chat-attachments").upload(filePath, file);
      if (uploadError) {
        console.error("Błąd przesyłania załącznika:", uploadError);
        return null;
      }

      const { data } = supabase.storage.from("chat-attachments").getPublicUrl(filePath);
      return {
        url: data.publicUrl,
        type: file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "file",
        name: file.name,
      };
    } catch (err) {
      console.error("Upload error:", err);
      return null;
    }
  };

  // Wgrywanie własnego obrazka ikony grupy
  const handleGroupIconImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditing: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Maksymalny rozmiar ikony to 5MB");
      return;
    }

    const uploaded = await uploadFileToSupabase(file);
    if (uploaded && uploaded.url) {
      if (isEditing) {
        setEditGroupIcon(uploaded.url);
      } else {
        setNewGroupIcon(uploaded.url);
      }
    }
  };

  // Sprawdzanie czy trening odbywa się dzisiaj
  const isTrainingToday = (training: any) => {
    if (training.is_odwolane || training.is_usuniete) return false;
    if (!training.days) return false;
    const jsDay = new Date().getDay(); // 0 = Niedziela, 1 = Poniedziałek, ... 6 = Sobota
    const isoDay = jsDay === 0 ? 7 : jsDay;
    const dayNames = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
    const dayShortNames = ["nie", "pon", "wt", "śr", "czw", "pt", "sob"];
    const currentDayName = dayNames[jsDay];

    let daysArr: any[] = [];
    if (Array.isArray(training.days)) {
      daysArr = training.days;
    } else if (typeof training.days === "object" && training.days !== null) {
      daysArr = Object.entries(training.days)
        .filter(([_, val]) => val)
        .map(([key]) => key);
    }

    return daysArr.some((d: any) => {
      const dStr = String(d).toLowerCase().trim();
      return (
        Number(d) === jsDay ||
        Number(d) === isoDay ||
        dStr === currentDayName ||
        dStr.includes(dayShortNames[jsDay]) ||
        dStr === String(jsDay) ||
        dStr === String(isoDay)
      );
    });
  };

  // Pobieranie lub automatyczne tworzenie grupy czatu dla danego treningu
  const getOrCreateTrainingGroup = async (training: any) => {
    const todayStr = new Date().toLocaleDateString("pl-PL");
    const groupName = `Trening: ${training.title} (${todayStr} ${training.start})`;
    
    const existing = groups.find((g: any) => g.nazwa === groupName);
    if (existing) return existing;

    const signedUpClients = zapisyZajec
      .filter((z: any) => String(z.class_key) === String(training.id))
      .map((z: any) => z.klient_id);

    const myClientId = secondaryUserId || currentUserId;
    const allMembers = Array.from(new Set([...signedUpClients, myClientId, 999999999]));

    const { data, error } = await supabase
      .from("czat_grupy")
      .insert([
        {
          nazwa: groupName,
          tworca_id: myClientId,
          czlonkowie_ids: allMembers,
          typ: "zamknieta",
          ikona: "🏋️‍♂️",
        },
      ])
      .select();

    if (!error && data && data.length > 0) {
      fetchGroupsAndTrainings();
      return data[0];
    }
    return null;
  };

  // Wysyłanie wiadomości
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || (!selectedUser && !selectedGroup) || !currentUserId) return;

    setIsUploading(true);
    const senderId = secondaryUserId || currentUserId;
    let attachmentData: { url: string; type: string; name: string } | null = null;

    if (selectedFile) {
      attachmentData = await uploadFileToSupabase(selectedFile);
    }

    const messageText = newMessage.trim();

    const payload: any = {
      nadawca_id: senderId,
      nadawca_nazwa: currentUserName,
      nadawca_avatar: currentUserAvatar,
      tresc: messageText,
      attachment_url: attachmentData?.url || null,
      attachment_type: attachmentData?.type || null,
      attachment_name: attachmentData?.name || null,
      przeczytana: false,
      przeczytana_at: null,
      przypinana: false,
      reakcje: {},
    };

    if (selectedGroup) {
      payload.grupa_id = selectedGroup.id;
      payload.odbiorca_id = null;

      const { error } = await supabase.from("czat_wiadomosci").insert([payload]);
      if (error) {
        console.error("Błąd bazy danych przy wysyłce do grupy:", error);
        alert("Nie udało się wysłać wiadomości: " + error.message);
      } else {
        setNewMessage("");
        setSelectedFile(null);
        setFilePreview(null);
        fetchGroupMessages();
        updateLastSeen(senderId);

        const isTrainingChat = selectedGroup.nazwa?.startsWith("Trening:");
        let trainingRefId = null;
        if (isTrainingChat) {
          const matchedTraining = grafikZajec.find((t: any) => selectedGroup.nazwa.includes(t.title));
          if (matchedTraining) trainingRefId = matchedTraining.id;
        }

        sendGroupPushNotification(String(selectedGroup.id), String(senderId), currentUserName, selectedGroup.nazwa, messageText || "📎 Załącznik", trainingRefId);
      }
    } else if (selectedUser) {
      payload.odbiorca_id = selectedUser.id;
      payload.grupa_id = null;

      const { error } = await supabase.from("czat_wiadomosci").insert([payload]);
      if (error) {
        console.error("Błąd bazy danych przy wysyłce 1-na-1:", error);
        alert("Nie udało się wysłać wiadomości: " + error.message);
      } else {
        setNewMessage("");
        setSelectedFile(null);
        setFilePreview(null);
        fetchMessages();
        updateLastSeen(senderId);
        sendChatPushNotification(selectedUser.id, currentUserName, messageText || "📎 Załącznik");
      }
    }

    setIsUploading(false);
  };

  // Przypinanie wiadomości
  const handlePinMessage = async (msg: any) => {
    if (!isAdmin) return;
    const newStatus = !msg.przypinana;

    if (newStatus) {
      if (selectedGroup) {
        await supabase
          .from("czat_wiadomosci")
          .update({ przypinana: false })
          .eq("grupa_id", selectedGroup.id);
      } else if (selectedUser) {
        const targetId = selectedUser.id;
        const effectiveIds = [String(currentUserId), secondaryUserId ? String(secondaryUserId) : null].filter(Boolean);
        await supabase
          .from("czat_wiadomosci")
          .update({ przypinana: false })
          .or(`and(nadawca_id.eq.${effectiveIds[0]},odbiorca_id.eq.${targetId}),and(nadawca_id.eq.${targetId},odbiorca_id.eq.${effectiveIds[0]})`);
      }
    }

    const { error } = await supabase
      .from("czat_wiadomosci")
      .update({ przypinana: newStatus })
      .eq("id", msg.id);

    if (!error) {
      fetchMessages();
      if (selectedGroup) fetchGroupMessages();
    }
    setActiveMessageMenuId(null);
  };

  // Reagowanie emotkami na wiadomość
  const handleToggleReaction = async (msg: any, emoji: string) => {
    const myIdStr = String(secondaryUserId || currentUserId);
    let currentReactions = msg.reakcje || {};
    if (typeof currentReactions === "string") {
      try { currentReactions = JSON.parse(currentReactions); } catch { currentReactions = {}; }
    }

    let usersForEmoji = currentReactions[emoji] || [];
    if (usersForEmoji.map(String).includes(myIdStr)) {
      usersForEmoji = usersForEmoji.filter((id: any) => String(id) !== myIdStr);
      if (usersForEmoji.length === 0) {
        delete currentReactions[emoji];
      } else {
        currentReactions[emoji] = usersForEmoji;
      }
    } else {
      usersForEmoji.push(myIdStr);
      currentReactions[emoji] = usersForEmoji;
    }

    const { error } = await supabase
      .from("czat_wiadomosci")
      .update({ reakcje: currentReactions })
      .eq("id", msg.id);

    if (!error) {
      fetchMessages();
      if (selectedGroup) fetchGroupMessages();
    }
    setActiveMessageMenuId(null);
  };

  // Dołączanie / Opuszczanie grupy publicznej
  const handleToggleGroupMembership = async (group: any, shouldJoin: boolean) => {
    const myId = secondaryUserId || currentUserId;
    if (!myId) return;

    let currentMembers: any[] = Array.isArray(group.czlonkowie_ids) ? [...group.czlonkowie_ids] : [];
    
    if (shouldJoin) {
      if (!currentMembers.map(String).includes(String(myId))) {
        currentMembers.push(myId);
      }
    } else {
      currentMembers = currentMembers.filter((m) => String(m) !== String(myId));
    }

    const { error } = await supabase
      .from("czat_grupy")
      .update({ czlonkowie_ids: currentMembers })
      .eq("id", group.id);

    if (!error) {
      fetchGroupsAndTrainings();
      if (selectedGroup && selectedGroup.id === group.id) {
        if (!shouldJoin && !isAdmin) {
          setSelectedGroup(null);
        } else {
          setSelectedGroup({ ...selectedGroup, czlonkowie_ids: currentMembers });
        }
      }
    }
  };

  // Wyciszenie powiadomień grupy
  const handleToggleMuteGroup = async () => {
    if (!selectedGroup) return;
    const myId = secondaryUserId || currentUserId;
    let mutedList = Array.isArray(selectedGroup.wyciszeni_ids) ? [...selectedGroup.wyciszeni_ids.map(String)] : [];

    if (mutedList.includes(String(myId))) {
      mutedList = mutedList.filter((id) => id !== String(myId));
    } else {
      mutedList.push(String(myId));
    }

    const { error } = await supabase
      .from("czat_grupy")
      .update({ wyciszeni_ids: mutedList })
      .eq("id", selectedGroup.id);

    if (!error) {
      setSelectedGroup({ ...selectedGroup, wyciszeni_ids: mutedList });
      fetchGroupsAndTrainings();
    }
  };

  // Broadcast do wszystkich
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim() && !selectedFile) return;

    setIsSendingBroadcast(true);
    const senderId = secondaryUserId || currentUserId;

    let attachmentData: { url: string; type: string; name: string } | null = null;
    if (selectedFile) {
      attachmentData = await uploadFileToSupabase(selectedFile);
    }

    const eligibleUsers = klienci.filter(
      (k) => Number(k.id) !== SYSTEM_ID && String(k.id) !== String(currentUserId) && String(k.id) !== String(secondaryUserId)
    );

    const payloads = eligibleUsers.map((user) => ({
      nadawca_id: senderId,
      nadawca_nazwa: currentUserName,
      nadawca_avatar: currentUserAvatar,
      odbiorca_id: user.id,
      grupa_id: null,
      tresc: broadcastMessage.trim(),
      attachment_url: attachmentData?.url || null,
      attachment_type: attachmentData?.type || null,
      attachment_name: attachmentData?.name || null,
      przeczytana: false,
      przeczytana_at: null,
      przypinana: false,
      reakcje: {},
    }));

    if (payloads.length > 0) {
      const { error } = await supabase.from("czat_wiadomosci").insert(payloads);
      if (!error) {
        eligibleUsers.forEach((user) => {
          sendChatPushNotification(user.id, currentUserName, broadcastMessage.trim() || "📎 Wysłano załącznik do wszystkich");
        });
        setBroadcastMessage("");
        setSelectedFile(null);
        setFilePreview(null);
        setShowBroadcastModal(false);
        fetchMessages();
      }
    }

    setIsSendingBroadcast(false);
  };

  // Tworzenie nowej grupy
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const senderId = secondaryUserId || currentUserId;
    const allMembers = newGroupType === "publiczna"
      ? [senderId]
      : Array.from(new Set([...selectedGroupMembers, senderId]));

    const { data, error } = await supabase
      .from("czat_grupy")
      .insert([
        {
          nazwa: newGroupName.trim(),
          tworca_id: senderId,
          czlonkowie_ids: allMembers,
          typ: newGroupType,
          ikona: newGroupIcon,
        },
      ])
      .select();

    if (!error && data && data.length > 0) {
      setNewGroupName("");
      setNewGroupType("zamknieta");
      setNewGroupIcon("🏋️‍♂️");
      setSelectedGroupMembers([]);
      setShowCreateGroupModal(false);
      fetchGroupsAndTrainings();
      setSelectedGroup(data[0]);
    }
  };

  // Aktualizacja danych grupy
  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !editGroupName.trim()) return;

    const { error } = await supabase
      .from("czat_grupy")
      .update({
        nazwa: editGroupName.trim(),
        ikona: editGroupIcon,
      })
      .eq("id", selectedGroup.id);

    if (!error) {
      setShowEditGroupModal(false);
      fetchGroupsAndTrainings();
    }
  };

  if (!currentUserId) return null;

  const effectiveIds = [
    String(currentUserId),
    secondaryUserId ? String(secondaryUserId) : null,
  ].filter(Boolean);

  const activeChatMessages = messages.filter((m: any) => {
    if (!selectedUser) return false;
    const isSenderMe = effectiveIds.includes(String(m.nadawca_id));
    const isReceiverMe = effectiveIds.includes(String(m.odbiorca_id));
    const isTargetThem =
      String(m.nadawca_id) === String(selectedUser.id) ||
      String(m.odbiorca_id) === String(selectedUser.id);

    return (isSenderMe && String(m.odbiorca_id) === String(selectedUser.id)) || (isTargetThem && isReceiverMe);
  });

  const currentConversationMessages = selectedGroup ? groupMessages : activeChatMessages;
  const conversationImages = currentConversationMessages.filter(
    (m: any) => m.attachment_url && m.attachment_type === "image"
  );
  const pinnedMessage = currentConversationMessages.find((m: any) => m.przypinana);

  // Pobieranie listy osób w wybranej grupie lub treningu
  const groupMemberIds = selectedGroup && Array.isArray(selectedGroup.czlonkowie_ids) 
    ? selectedGroup.czlonkowie_ids.map(String) 
    : [];

  const groupMembersList = klienci.filter((k: any) => 
    groupMemberIds.includes(String(k.id)) || Number(k.id) === SYSTEM_ID
  );

  const latestMessageMap = new Map();
  const latestMessageTextMap = new Map();

  messages.forEach((m: any) => {
    const otherId = effectiveIds.includes(String(m.nadawca_id)) ? m.odbiorca_id : m.nadawca_id;
    const msgTime = new Date(m.created_at).getTime();
    if (!latestMessageMap.has(otherId) || msgTime > latestMessageMap.get(otherId)) {
      latestMessageMap.set(otherId, msgTime);
      latestMessageTextMap.set(otherId, m.tresc || (m.attachment_url ? "📎 Załącznik" : ""));
    }
  });

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
      if (Number(k.id) === SYSTEM_ID) return true;

      const q = searchQuery.trim().toLowerCase();
      if (!q) {
        return chattedUserIds.has(k.id);
      }

      const fName = (k.firstName || "").toLowerCase();
      const lName = (k.lastName || "").toLowerCase();

      if (lName.startsWith(q)) return true;

      const parts = q.split(/\s+/);
      if (parts.length >= 2) {
        const typedFirst = parts[0];
        const typedLastInitial = parts[1];
        if (fName.startsWith(typedFirst) && lName.startsWith(typedLastInitial)) {
          return true;
        }
      }

      return k.name?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const timeA = latestMessageMap.get(a.id) || 0;
      const timeB = latestMessageMap.get(b.id) || 0;
      return timeB - timeA;
    });

  const formatLastSeen = (lastSeenString: string | null) => {
    if (!lastSeenString) return "Brak danych o aktywności";
    const now = new Date().getTime();
    const seen = new Date(lastSeenString).getTime();
    const diffMinutes = Math.floor((now - seen) / 60000);

    if (diffMinutes < 1) return "Aktywny przed chwilą";
    if (diffMinutes === 1) return "Aktywny 1 min temu";
    if (diffMinutes < 60) return `Aktywny ${diffMinutes} min temu`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return "Aktywny 1 godz. temu";
    if (diffHours < 24) return `Aktywny ${diffHours} godz. temu`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Aktywny wczoraj";
    return `Aktywny ${diffDays} dni temu`;
  };

  const renderAttachment = (msg: any) => {
    if (!msg.attachment_url) return null;

    if (msg.attachment_type === "image") {
      return (
        <button
          type="button"
          onClick={() => setFullscreenImage(msg.attachment_url)}
          className="block mt-2 rounded-xl overflow-hidden border border-slate-700/30 text-left cursor-pointer group"
        >
          <img
            src={msg.attachment_url}
            alt="Załącznik"
            className="max-h-48 w-full object-cover group-hover:scale-105 transition-transform"
          />
        </button>
      );
    }

    return (
      <a
        href={msg.attachment_url}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="mt-2 flex items-center gap-2 p-2 rounded-xl bg-slate-800/20 hover:bg-slate-800/40 border border-slate-300/30 transition-colors text-xs font-semibold"
      >
        <span className="text-base">{msg.attachment_type === "pdf" ? "📄" : "📎"}</span>
        <span className="truncate max-w-[200px]">{msg.attachment_name || "Pobierz załącznik"}</span>
      </a>
    );
  };

  const renderMessageContent = (msg: any, isMe: boolean) => {
    const isSystemSender = Number(msg.nadawca_id) === SYSTEM_ID;
    const isBirthdayNotification = isSystemSender && (msg.tresc?.includes("🎂") || msg.tresc?.includes("urodzin"));
    const isBadgeNotification = isSystemSender && (msg.tresc?.includes("🎖️") || msg.tresc?.includes("odznakę klubową"));
    const isChallengeNotification = msg.tresc?.includes("⚔️") || msg.tresc?.includes("Rzuciłem Ci wyzwanie");

    const reactionsObj = msg.reakcje || {};

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
          {renderAttachment(msg)}
        </div>
      );
    }

    if (isBadgeNotification || (isSystemSender && !isBirthdayNotification && !isChallengeNotification)) {
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
          {renderAttachment(msg)}
        </div>
      );
    }

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
          {renderAttachment(msg)}
        </div>
      );
    }

    const myIdStr = String(secondaryUserId || currentUserId);

    return (
      <div className="relative group flex flex-col">
        {/* DYMEK WIADOMOŚCI - kliknięcie otwiera menu reakcji i przypinania */}
        <div
          onClick={() => setActiveMessageMenuId(activeMessageMenuId === msg.id ? null : msg.id)}
          className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm cursor-pointer select-none ${
            isMe
              ? "bg-slate-900 text-white rounded-br-none ml-auto"
              : "bg-white text-slate-800 border border-slate-200 rounded-bl-none mr-auto"
          }`}
        >
          {selectedGroup && !isMe && (
            <div className="text-[10px] font-bold text-amber-500 mb-1">{msg.nadawca_nazwa}</div>
          )}
          {msg.tresc && <div>{msg.tresc}</div>}
          {renderAttachment(msg)}
        </div>

        {/* POPUP MENU REAKCJI I PRZYPIĘCIA PO KLIKNIĘCIU W WIADOMOŚĆ */}
        {activeMessageMenuId === msg.id && (
          <div className={`absolute z-30 bottom-full mb-1 bg-white border border-slate-200 shadow-xl rounded-2xl p-2 flex flex-col gap-2 ${isMe ? "right-0" : "left-0"}`}>
            <div className="flex items-center gap-1.5 text-base px-1">
              {["👍", "❤️", "🔥", "😂", "💪"].map((emo) => (
                <button
                  key={emo}
                  type="button"
                  onClick={() => handleToggleReaction(msg, emo)}
                  className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-amber-100 flex items-center justify-center transition-colors cursor-pointer"
                >
                  {emo}
                </button>
              ))}
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => handlePinMessage(msg)}
                className="w-full text-left text-[11px] font-bold text-slate-800 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors border-t border-slate-100 flex items-center gap-1.5"
              >
                <span>📌</span> {msg.przypinana ? "Odepnij wiadomość" : "Przypnij wiadomość"}
              </button>
            )}
          </div>
        )}

        {/* WYŚWIETLANIE REAKCJI POD DYMIKIEM */}
        {Object.keys(reactionsObj).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
            {Object.entries(reactionsObj).map(([emoji, userList]: [string, any]) => {
              const count = Array.isArray(userList) ? userList.length : 0;
              if (count === 0) return null;
              const hasReacted = Array.isArray(userList) && userList.map(String).includes(myIdStr);

              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleToggleReaction(msg, emoji)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all cursor-pointer ${
                    hasReacted
                      ? "bg-amber-100 border-amber-400 text-amber-950 font-bold shadow-xs"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{emoji}</span>
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const isPositioned = position !== null;
  const isLeftSide = isPositioned ? position.x < (typeof window !== "undefined" ? window.innerWidth / 2 : 200) : false;
  const isTopSide = isPositioned ? position.y < 540 : false;

  const myGroupsList = groups.filter((g: any) => {
    if (isAdmin) return true;
    const members = Array.isArray(g.czlonkowie_ids) ? g.czlonkowie_ids.map(String) : [];
    return members.some((m: string) => effectiveIds.includes(m)) || effectiveIds.includes(String(g.tworca_id));
  });

  const publicDiscoverGroups = groups.filter((g: any) => {
    const isPublic = g.typ === "publiczna";
    const members = Array.isArray(g.czlonkowie_ids) ? g.czlonkowie_ids.map(String) : [];
    const isAlreadyMember = members.some((m: string) => effectiveIds.includes(m)) || effectiveIds.includes(String(g.tworca_id));
    return isPublic && !isAlreadyMember;
  });

  // Dzisiejsze treningi – TYLKO te, które mają w `days` dzisiejszy dzień tygodnia
  const todayTrainingsList = grafikZajec.filter((training: any) => {
    const isToday = isTrainingToday(training);
    if (!isToday) return false;

    if (isAdmin) return true;

    const myClientId = secondaryUserId || currentUserId;
    const isSignedUp = zapisyZajec.some(
      (z: any) => String(z.class_key) === String(training.id) && String(z.klient_id) === String(myClientId)
    );
    return isSignedUp;
  });

  const renderGroupIcon = (iconValue: string, type: string) => {
    if (!iconValue) return type === "publiczna" ? "🌐" : "👥";
    if (iconValue.startsWith("http")) {
      return <img src={iconValue} alt="Ikona" className="w-full h-full object-cover rounded-full" />;
    }
    return <span>{iconValue}</span>;
  };

  const isCurrentGroupMuted = selectedGroup && Array.isArray(selectedGroup.wyciszeni_ids) && selectedGroup.wyciszeni_ids.map(String).includes(String(secondaryUserId || currentUserId));

  return (
    <div
      ref={containerRef}
      style={
        isPositioned
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              touchAction: "none",
            }
          : {
              right: "24px",
              bottom: "24px",
            }
      }
      className={`fixed z-[120] font-sans antialiased ${!isPositioned ? "hidden" : ""}`}
    >
      {isOpen && (
        <div
          className={`absolute bg-white border border-slate-200 rounded-[2rem] shadow-2xl w-[360px] sm:w-[410px] h-[560px] flex flex-col overflow-hidden animate-in fade-in ${
            isLeftSide ? "left-0" : "right-0"
          } ${isTopSide ? "top-16 slide-in-from-top-4" : "bottom-16 slide-in-from-bottom-4"}`}
        >
          {/* NAGŁÓWEK CZATU */}
          <div className="bg-slate-900 text-white px-3 py-2.5 flex items-center justify-between shadow-sm select-none">
            <div className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0 mr-1">
              {selectedUser || selectedGroup ? (
                <>
                  {/* PRZYCISK POWROTU */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setSelectedUser(null);
                      setSelectedGroup(null);
                      setChatInsideTab("messages");
                      setActiveMessageMenuId(null);
                    }}
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer shadow-md shrink-0 border border-amber-300"
                    title="Wróć do listy"
                  >
                    <span>◀</span> Wróć
                  </button>

                  {selectedGroup ? (
                    <>
                      <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs border border-amber-300 shrink-0 overflow-hidden">
                        {renderGroupIcon(selectedGroup.ikona, selectedGroup.typ)}
                      </div>
                      <div className="overflow-hidden flex items-center gap-1 min-w-0 flex-1">
                        <div className="truncate min-w-0 flex-1">
                          <div className="font-bold text-xs truncate">{selectedGroup.nazwa}</div>
                          <div className="text-[9px] text-amber-400 font-medium truncate">
                            {selectedGroup.typ === "publiczna" ? "Publiczna" : "Zamknięta"} • {Array.isArray(selectedGroup.czlonkowie_ids) ? selectedGroup.czlonkowie_ids.length : 0} os.
                          </div>
                        </div>
                        {(isAdmin || String(selectedGroup.tworca_id) === String(secondaryUserId || currentUserId)) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditGroupName(selectedGroup.nazwa);
                              setEditGroupIcon(selectedGroup.ikona || "🏋️‍♂️");
                              setShowEditGroupModal(true);
                            }}
                            className="text-slate-400 hover:text-amber-400 p-1 text-xs cursor-pointer shrink-0"
                            title="Edytuj nazwę lub ikonę grupy"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shrink-0 border ${Number(selectedUser.id) === SYSTEM_ID ? "bg-amber-400 text-slate-950 border-amber-300" : "bg-sky-100 text-sky-950 border-amber-400"}`}>
                        {selectedUser.avatar ? (
                          <img src={selectedUser.avatar} alt={selectedUser.name} className="w-full h-full object-cover" />
                        ) : Number(selectedUser.id) === SYSTEM_ID ? (
                          <span>👑</span>
                        ) : (
                          <span>👤</span>
                        )}
                      </div>
                      <div className="overflow-hidden min-w-0 flex-1">
                        <div className="font-bold text-xs truncate">{selectedUser.name}</div>
                        <div className="text-[9px] font-medium truncate">
                          {Number(selectedUser.id) === SYSTEM_ID ? (
                            <span className="text-amber-400 font-bold">System</span>
                          ) : (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span> {formatLastSeen(selectedUser.last_seen)}
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg">💬</span>
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-wider">Czat Klubowiczów</h3>
                    <p className="text-[10px] text-slate-400">Forma Marzeń</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {selectedGroup && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleMuteGroup();
                  }}
                  className={`text-xs p-1.5 rounded-lg border transition-colors ${
                    isCurrentGroupMuted
                      ? "bg-rose-950/80 text-rose-300 border-rose-800"
                      : "bg-slate-800 text-slate-300 border-slate-700"
                  }`}
                  title={isCurrentGroupMuted ? "Włącz powiadomienia" : "Wycisz powiadomienia"}
                >
                  {isCurrentGroupMuted ? "🔕" : "🔔"}
                </button>
              )}
              {selectedGroup && selectedGroup.typ === "publiczna" && !isAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleGroupMembership(selectedGroup, false);
                  }}
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-950/40 px-2 py-1.5 rounded-lg border border-rose-800 transition-colors"
                  title="Opuść tę grupę"
                >
                  Opuść
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseChat();
                }}
                className="text-slate-400 hover:text-white w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* PRZEŁĄCZNIK W AKTYWNEJ GRUPIE: Wiadomości | Zdjęcia | Uczestnicy */}
          {selectedGroup && (
            <div className="bg-slate-900 border-t border-slate-800 px-3 py-1.5 flex items-center justify-center gap-1.5 text-xs">
              <button
                onClick={() => setChatInsideTab("messages")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  chatInsideTab === "messages"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                💬 Wiadomości
              </button>
              <button
                onClick={() => setChatInsideTab("media")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  chatInsideTab === "media"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>🖼️ Zdjęcia</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${chatInsideTab === "media" ? "bg-slate-950 text-amber-400 font-black" : "bg-slate-800 text-slate-300"}`}>
                  {conversationImages.length}
                </span>
              </button>
              <button
                onClick={() => setChatInsideTab("members")}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  chatInsideTab === "members"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>👥 Uczestnicy</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${chatInsideTab === "members" ? "bg-slate-950 text-amber-400 font-black" : "bg-slate-800 text-slate-300"}`}>
                  {groupMembersList.length}
                </span>
              </button>
            </div>
          )}

          {/* PRZEŁĄCZNIK W AKTYWNEJ ROZMOWIE 1-NA-1: Wiadomości | Zdjęcia */}
          {selectedUser && (
            <div className="bg-slate-900 border-t border-slate-800 px-4 py-1.5 flex items-center justify-center gap-2 text-xs">
              <button
                onClick={() => setChatInsideTab("messages")}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  chatInsideTab === "messages"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                💬 Wiadomości
              </button>
              <button
                onClick={() => setChatInsideTab("media")}
                className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  chatInsideTab === "media"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>🖼️ Zdjęcia</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${chatInsideTab === "media" ? "bg-slate-950 text-amber-400 font-black" : "bg-slate-800 text-slate-300"}`}>
                  {conversationImages.length}
                </span>
              </button>
            </div>
          )}

          {/* WIDOK GŁÓWNY (LISTA ROZMÓW / GRUP / TRENINGI) */}
          {!selectedUser && !selectedGroup ? (
            <div className="flex-1 flex flex-col overflow-hidden p-3.5 space-y-2.5 bg-slate-50/50">
              
              {/* ZAKŁADKI GŁÓWNE: Prywatne | Grupy | Treningi */}
              <div className="flex items-center justify-between gap-1 border-b border-slate-200 pb-2">
                <div className="flex gap-1 bg-slate-200 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab("direct")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${activeTab === "direct" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    Prywatne
                  </button>
                  <button
                    onClick={() => setActiveTab("groups")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${activeTab === "groups" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    Grupy ({myGroupsList.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("trainings")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${activeTab === "trainings" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                  >
                    Treningi ({todayTrainingsList.length})
                  </button>
                </div>

                {isAdmin && activeTab !== "trainings" && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowBroadcastModal(true)}
                      className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-1.5 rounded-xl shadow-sm transition-all"
                      title="Wszyscy"
                    >
                      📢 Wszyscy
                    </button>
                    {activeTab === "groups" && (
                      <button
                        onClick={() => setShowCreateGroupModal(true)}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] px-2 py-1.5 rounded-xl shadow-sm transition-all"
                        title="Nowa grupa"
                      >
                        + Nowa
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* LISTA ROZMÓW 1-NA-1 */}
              {activeTab === "direct" && (
                <>
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

                      const lastMessageText = latestMessageTextMap.get(user.id);

                      return (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedUser(user);
                            setChatInsideTab("messages");
                          }}
                          className={`w-full p-2.5 rounded-2xl border flex items-center justify-between transition-all shadow-sm cursor-pointer text-left group ${
                            isSys
                              ? "bg-gradient-to-r from-amber-50 to-white border-amber-300 hover:border-amber-400"
                              : "bg-white hover:bg-sky-50 border-slate-200/80"
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div
                              className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shrink-0 border ${
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
                            <div className="overflow-hidden">
                              <div className={`font-bold text-xs truncate ${isSys ? "text-amber-950 font-black" : "text-slate-900 group-hover:text-sky-950"}`}>
                                {user.name}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                {lastMessageText ? (
                                  <span className="italic">{lastMessageText}</span>
                                ) : (
                                  <span>{isSys ? "Oficjalne powiadomienia" : formatLastSeen(user.last_seen)}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {userUnread > 0 && (
                            <span className="bg-rose-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm shrink-0 ml-2">
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
                </>
              )}

              {/* LISTA GRUP */}
              {activeTab === "groups" && (
                <div className="flex-1 flex flex-col overflow-hidden space-y-2">
                  <div className="flex gap-2 border-b border-slate-200 pb-1.5 text-xs font-bold">
                    <button
                      onClick={() => setGroupFilterTab("my")}
                      className={`pb-1 px-1 transition-colors ${groupFilterTab === "my" ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      Moje grupy ({myGroupsList.length})
                    </button>
                    <button
                      onClick={() => setGroupFilterTab("public")}
                      className={`pb-1 px-1 transition-colors ${groupFilterTab === "public" ? "border-b-2 border-amber-500 text-amber-700" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      Odkrywaj otwarte ({publicDiscoverGroups.length})
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                    {groupFilterTab === "my" ? (
                      <>
                        {myGroupsList.map((group: any) => {
                          const isPublic = group.typ === "publiczna";
                          return (
                            <button
                              key={group.id}
                              onClick={() => {
                                setSelectedGroup(group);
                                setChatInsideTab("messages");
                              }}
                              className="w-full p-2.5 rounded-2xl border bg-white hover:bg-amber-50/50 border-slate-200 flex items-center justify-between transition-all shadow-sm cursor-pointer text-left group"
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border overflow-hidden ${isPublic ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-slate-100 text-slate-900 border-slate-300"}`}>
                                  {renderGroupIcon(group.ikona, group.typ)}
                                </div>
                                <div className="overflow-hidden">
                                  <div className="font-bold text-xs text-slate-900 truncate">{group.nazwa}</div>
                                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                    <span className={isPublic ? "text-amber-600 font-semibold" : "text-slate-500"}>
                                      {isPublic ? "Publiczna" : "Zamknięta"}
                                    </span>
                                    <span>•</span>
                                    <span>{Array.isArray(group.czlonkowie_ids) ? group.czlonkowie_ids.length : 0} osób</span>
                                  </div>
                                </div>
                              </div>
                              <span className="text-slate-400 text-xs font-bold group-hover:text-slate-900 transition-colors">→</span>
                            </button>
                          );
                        })}

                        {myGroupsList.length === 0 && (
                          <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                            <div>Nie należysz jeszcze do żadnej grupy.</div>
                            <p className="text-[10px]">Sprawdź zakładkę "Odkrywaj otwarte" lub poczekaj na dodanie przez Trenera.</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {publicDiscoverGroups.map((group: any) => (
                          <div
                            key={group.id}
                            className="w-full p-2.5 rounded-2xl border bg-white border-amber-200 flex items-center justify-between shadow-sm"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                                {renderGroupIcon(group.ikona, group.typ)}
                              </div>
                              <div className="overflow-hidden">
                                <div className="font-bold text-xs text-slate-900 truncate">{group.nazwa}</div>
                                <div className="text-[10px] text-amber-700">
                                  {Array.isArray(group.czlonkowie_ids) ? group.czlonkowie_ids.length : 0} uczestników
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleToggleGroupMembership(group, true)}
                              className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-[10px] px-3 py-1.5 rounded-xl shadow-sm transition-all shrink-0 cursor-pointer"
                            >
                              + Dołącz
                            </button>
                          </div>
                        ))}

                        {publicDiscoverGroups.length === 0 && (
                          <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                            <div>Brak nowych grup publicznych.</div>
                            <p className="text-[10px]">Należysz już do wszystkich otwartych dyskusji!</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* LISTA DZISIEJSZYCH TRENINGÓW */}
              {activeTab === "trainings" && (
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {todayTrainingsList.map((training: any) => (
                    <button
                      key={training.id}
                      onClick={async () => {
                        const trainingGroup = await getOrCreateTrainingGroup(training);
                        if (trainingGroup) {
                          setSelectedGroup(trainingGroup);
                          setChatInsideTab("messages");
                        }
                      }}
                      className="w-full p-3 rounded-2xl border bg-white hover:bg-amber-50/50 border-slate-200 flex items-center justify-between transition-all shadow-sm cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-9 h-9 rounded-full bg-amber-400/20 text-amber-950 border border-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                          🏋️‍♂️
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-bold text-xs text-slate-900 truncate">{training.title}</div>
                          <div className="text-[10px] text-slate-500">
                            Godz: {training.start} {training.trainer ? `• Trener: ${training.trainer}` : ""}
                          </div>
                        </div>
                      </div>
                      <span className="text-slate-400 text-xs font-bold group-hover:text-slate-900 transition-colors">→</span>
                    </button>
                  ))}

                  {todayTrainingsList.length === 0 && (
                    <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                      <div>Brak treningów zaplanowanych na dzisiaj.</div>
                      <p className="text-[10px]">Wszystkie dzisiejsze zajęcia pojawią się tutaj automatycznie.</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : chatInsideTab === "media" ? (
            /* WIDOK GALERII ZDJĘĆ */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Udostępnione Zdjęcia ({conversationImages.length})
                </span>
                <span className="text-[10px] text-slate-500">Kliknij zdjęcie, aby powiększyć</span>
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                {conversationImages.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {conversationImages.map((imgMsg: any) => {
                      const msgDate = imgMsg.created_at
                        ? new Date(imgMsg.created_at).toLocaleDateString("pl-PL", {
                            day: "2-digit",
                            month: "2-digit",
                          })
                        : "";

                      return (
                        <div
                          key={imgMsg.id}
                          onClick={() => setFullscreenImage(imgMsg.attachment_url)}
                          className="relative group aspect-square rounded-xl overflow-hidden border border-slate-300 bg-slate-200 cursor-pointer shadow-sm hover:border-amber-400 transition-all"
                        >
                          <img
                            src={imgMsg.attachment_url}
                            alt={imgMsg.attachment_name || "Zdjęcie"}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1 text-[9px] text-white flex justify-between items-end opacity-90">
                            <span className="truncate max-w-[60px] font-medium">{imgMsg.nadawca_nazwa?.split(" ")[0]}</span>
                            <span className="text-[8px] opacity-75 font-mono">{msgDate}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-20 text-center text-slate-400 text-xs space-y-2">
                    <span className="text-3xl block">🖼️</span>
                    <div>Brak zdjęć w tej rozmowie.</div>
                    <p className="text-[10px]">Zdjęcia przesłane przez uczestników pojawią się tutaj automatycznie.</p>
                  </div>
                )}
              </div>
            </div>
          ) : chatInsideTab === "members" ? (
            /* WIDOK LISTY UCZESTNIKÓW W GRUPIE / TRENINGU */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Uczestnicy grupy ({groupMembersList.length})
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {groupMembersList.map((member: any) => {
                  const isSys = Number(member.id) === SYSTEM_ID;
                  const isMbrAdmin = ADMIN_EMAILS.includes(member.email) || Number(member.id) === 999999999;

                  return (
                    <div
                      key={member.id}
                      className="w-full p-2.5 rounded-2xl border bg-white border-slate-200 flex items-center justify-between shadow-sm"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shrink-0 border ${isSys ? "bg-amber-400 text-slate-950 border-amber-300" : "bg-sky-100 text-sky-950 border-amber-400"}`}>
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                          ) : isSys ? (
                            <span>👑</span>
                          ) : (
                            <span>👤</span>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <div className="font-bold text-xs text-slate-900 truncate">{member.name}</div>
                          <div className="text-[10px] font-medium text-slate-500 truncate mt-0.5">
                            {isSys ? (
                              <span className="text-amber-600 font-bold">System</span>
                            ) : isMbrAdmin ? (
                              <span className="text-amber-700 font-bold">Trener / Admin</span>
                            ) : (
                              <span>Klubowicz</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {groupMembersList.length === 0 && (
                  <div className="py-20 text-center text-slate-400 text-xs space-y-2">
                    <span className="text-3xl block">👥</span>
                    <div>Brak uczestników w tej grupie.</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* WIDOK AKTYWNEJ ROZMOWY (WIADOMOŚCI) */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
              
              {/* BANER PRZYPIĘTEJ WIADOMOŚCI */}
              {pinnedMessage && (
                <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center justify-between text-xs shadow-inner">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-amber-600 font-bold text-sm shrink-0">📌</span>
                    <div className="truncate">
                      <span className="font-bold text-slate-900 mr-1">Przypięta:</span>
                      <span className="text-slate-700 truncate">{pinnedMessage.tresc || (pinnedMessage.attachment_url ? "📎 Załącznik" : "")}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handlePinMessage(pinnedMessage)}
                      className="text-[10px] font-bold text-rose-600 hover:text-rose-800 shrink-0 ml-2 cursor-pointer bg-white px-2 py-0.5 rounded border border-rose-200"
                      title="Odepnij wiadomość"
                    >
                      Odepnij
                    </button>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(selectedGroup ? groupMessages : activeChatMessages).map((msg: any) => {
                  const isMe = effectiveIds.includes(String(msg.nadawca_id));
                  const isSpecial = Number(msg.nadawca_id) === SYSTEM_ID || msg.tresc?.includes("🎖️") || msg.tresc?.includes("⚔️") || msg.tresc?.includes("🎂");
                  
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
                        {isMe && !selectedGroup && (
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

                {(selectedGroup ? groupMessages : activeChatMessages).length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                    <div>👋 Rozpocznij rozmowę!</div>
                    <p className="text-[10px]">
                      {selectedGroup
                        ? "Napisz pierwszą wiadomość do wszystkich uczestników tego treningu."
                        : Number(selectedUser?.id) === SYSTEM_ID
                        ? "Tutaj pojawiać się będą oficjalne powiadomienia o odznakach, urodzinach i wydarzeniach."
                        : "Napisz pierwszą wiadomość do tego klubowicza."}
                    </p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* PODGLĄD ZAŁĄCZNIKA PRZED WYŚLANIEM */}
              {selectedFile && (
                <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate max-w-[260px]">
                    {filePreview ? (
                      <img src={filePreview} alt="Podgląd" className="w-8 h-8 rounded object-cover border" />
                    ) : (
                      <span className="text-lg">📄</span>
                    )}
                    <span className="font-semibold text-slate-800 truncate">{selectedFile.name}</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreview(null);
                    }}
                    className="text-rose-600 hover:text-rose-800 font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* FORMULARZ WYSYŁANIA */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-lg transition-colors cursor-pointer shrink-0"
                  title="Dodaj załącznik"
                >
                  📎
                </button>

                <input
                  type="text"
                  placeholder={
                    selectedGroup
                      ? "Napisz na czacie treningowym..."
                      : Number(selectedUser?.id) === SYSTEM_ID
                      ? "Napisz do administracji..."
                      : "Napisz wiadomość..."
                  }
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500"
                />

                <button
                  type="submit"
                  disabled={isUploading || (!newMessage.trim() && !selectedFile)}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer shrink-0 flex items-center gap-1"
                >
                  {isUploading ? "..." : "Wyślij"}
                </button>
              </form>
            </div>
          )}

          {/* LIGHTBOX / PEŁNOEKRANOWY PODGLĄD ZDJĘCIA */}
          {fullscreenImage && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-[60] flex flex-col items-center justify-between p-4 animate-in fade-in">
              <div className="w-full flex justify-between items-center text-white pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300">Podgląd zdjęcia</span>
                <div className="flex items-center gap-3">
                  <a
                    href={fullscreenImage}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 flex items-center gap-1"
                  >
                    ⬇️ Pobierz
                  </a>
                  <button
                    onClick={() => setFullscreenImage(null)}
                    className="text-slate-400 hover:text-white font-black text-sm bg-slate-800 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center p-2 max-h-[420px] w-full">
                <img
                  src={fullscreenImage}
                  alt="Pełny podgląd"
                  className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
                />
              </div>
            </div>
          )}

          {/* MODAL EDYCJI GRUPY */}
          {showEditGroupModal && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <span>✏️</span> Edytuj Grupę
                  </div>
                  <button onClick={() => setShowEditGroupModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleUpdateGroup} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">Nazwa grupy:</label>
                    <input
                      type="text"
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">Ikona grupy (Emoji lub własny obrazek):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editGroupIcon}
                        onChange={(e) => setEditGroupIcon(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                        placeholder="np. 🏋️‍♂️ lub wgraj plik obok"
                        required
                      />
                      <label className="w-9 h-9 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 flex items-center justify-center text-base cursor-pointer shrink-0 shadow-sm" title="Wgraj własny obrazek z urządzenia">
                        📷
                        <input
                          type="file"
                          onChange={(e) => handleGroupIconImageUpload(e, true)}
                          className="hidden"
                          accept="image/*"
                        />
                      </label>
                      <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-base shrink-0 overflow-hidden">
                        {renderGroupIcon(editGroupIcon, selectedGroup?.typ || "zamknieta")}
                      </div>
                    </div>
                    <div className="flex gap-1 mt-2 text-base">
                      {["🏋️‍♂️", "🚴", "🏕️", "🥇", "🔥", "⚽", "🥊", "💪"].map((emo) => (
                        <button
                          key={emo}
                          type="button"
                          onClick={() => setEditGroupIcon(emo)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-amber-100 flex items-center justify-center cursor-pointer transition-colors"
                        >
                          {emo}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowEditGroupModal(false)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      disabled={!editGroupName.trim()}
                      className="flex-1 py-2 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 shadow-md disabled:opacity-50"
                    >
                      Zapisz zmiany
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL BROADCAST */}
          {showBroadcastModal && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <span>📢</span> Wiadomość do Wszystkich
                  </div>
                  <button onClick={() => setShowBroadcastModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSendBroadcast} className="space-y-3">
                  <textarea
                    rows={4}
                    placeholder="Wpisz treść komunikatu dla każdego klubowicza..."
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                    required={!selectedFile}
                  />

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id="broadcastFile"
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx"
                    />
                    <label
                      htmlFor="broadcastFile"
                      className="cursor-pointer px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1"
                    >
                      📎 Dodaj plik / zdjęcie
                    </label>
                    {selectedFile && <span className="text-[10px] text-slate-600 truncate max-w-[150px]">{selectedFile.name}</span>}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowBroadcastModal(false)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingBroadcast}
                      className="flex-1 py-2 rounded-xl text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-500 shadow-md disabled:opacity-50"
                    >
                      {isSendingBroadcast ? "Wysyłanie..." : "Wyślij wszystkim"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL TWORZENIA GRUPY */}
          {showCreateGroupModal && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <span>👥</span> Nowy Czat Grupowy
                  </div>
                  <button onClick={() => setShowCreateGroupModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateGroup} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nazwa grupy (np. Obóz Wałcz 2026)..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                    required
                  />

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">Ikona grupy (Emoji lub własny obrazek):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newGroupIcon}
                        onChange={(e) => setNewGroupIcon(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                        required
                      />
                      <label className="w-9 h-9 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 flex items-center justify-center text-base cursor-pointer shrink-0 shadow-sm" title="Wgraj własny obrazek z urządzenia">
                        📷
                        <input
                          type="file"
                          onChange={(e) => handleGroupIconImageUpload(e, false)}
                          className="hidden"
                          accept="image/*"
                        />
                      </label>
                      <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-base shrink-0 overflow-hidden">
                        {renderGroupIcon(newGroupIcon, newGroupType)}
                      </div>
                    </div>
                    <div className="flex gap-1 mt-1.5 text-base">
                      {["🏋️‍♂️", "🚴", "🏕️", "🥇", "🔥", "⚽", "🥊", "💪"].map((emo) => (
                        <button
                          key={emo}
                          type="button"
                          onClick={() => setNewGroupIcon(emo)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-amber-100 flex items-center justify-center cursor-pointer transition-colors"
                        >
                          {emo}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setNewGroupType("zamknieta")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${newGroupType === "zamknieta" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      🔒 Zamknięta
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewGroupType("publiczna")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${newGroupType === "publiczna" ? "bg-amber-400 text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      🌐 Publiczna
                    </button>
                  </div>

                  {newGroupType === "zamknieta" ? (
                    <div>
                      <div className="text-[11px] font-bold text-slate-700 mb-1">Wybierz członków grupy:</div>
                      <div className="max-h-28 overflow-y-auto space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
                        {klienci
                          .filter((k) => Number(k.id) !== SYSTEM_ID && String(k.id) !== String(currentUserId))
                          .map((user) => {
                            const isSelected = selectedGroupMembers.includes(user.id);
                            return (
                              <label
                                key={user.id}
                                className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer text-xs select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelectedGroupMembers((prev) =>
                                      isSelected ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                                    );
                                  }}
                                  className="rounded text-amber-500 focus:ring-0"
                                />
                                <span className="font-medium text-slate-800">{user.name}</span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                      ℹ️ Grupa publiczna będzie widoczna dla wszystkich klubowiczów w zakładce <strong>"Odkrywaj otwarte"</strong>.
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateGroupModal(false)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      disabled={!newGroupName.trim() || (newGroupType === "zamknieta" && selectedGroupMembers.length === 0)}
                      className="flex-1 py-2 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 shadow-md disabled:opacity-50"
                    >
                      Stwórz grupę
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {/* PRZYCISK OTWARCIA CZATU (DYMEK) */}
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`w-14 h-14 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-2xl flex items-center justify-center text-2xl cursor-grab active:cursor-grabbing relative border-2 border-amber-400 select-none touch-none ${
          isDragging ? "scale-95 opacity-90" : "transition-transform hover:scale-105"
        }`}
        title="Przeciągnij lub kliknij, aby otworzyć"
      >
        <span className="pointer-events-none">💬</span>

        {unreadCount > 0 && !isOpen && (
          <span className="pointer-events-none absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md border-2 border-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
