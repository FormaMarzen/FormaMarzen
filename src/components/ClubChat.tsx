"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const ADMIN_EMAILS = ["maciejklaput@gmail.com", "maciejklaput@icloud.com"];
const SYSTEM_ID = 5000;

const DEFAULT_GROUP_CATEGORIES = [
  "Ogólne",
  "Odżywiania i Suplementacja",
  "Sport",
  "Wydarzenia i Wyjazdy",
  "Wyzwania",
];

// Nowoczesna ikona SVG dla galerii zdjęć/mediów
const ImageIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

export default function ClubChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | string | null>(null);
  const [secondaryUserId, setSecondaryUserId] = useState<number | string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Główne zakładki widoku listy: Prywatne | Grupy | Treningi (z pamięcią stanu)
  const [activeTab, setActiveTab] = useState<"direct" | "groups" | "trainings">("trainings");
  const [groupFilterTab, setGroupFilterTab] = useState<"my" | "public" | "closed">("my");

  // Rozwijanie sekcji czatów grupowych w zakładce Prywatne (gdy > 3)
  const [isDirectGroupsExpanded, setIsDirectGroupsExpanded] = useState(false);

  // Zakładka wewnątrz aktywnej rozmowy / grupy: Czat | Zdjęcia | Uczestnicy
  const [chatInsideTab, setChatInsideTab] = useState<"messages" | "media" | "members">("messages");
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Stan odpowiadania na wiadomość (Swipe-to-Reply)
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);

  // Stan dla menu reakcji / akcji dla konkretnej wiadomości
  const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null);

  // Menu opcji w nagłówku aktywnej rozmowy (...)
  const [showChatOptionsMenu, setShowChatOptionsMenu] = useState(false);

  // Stan archiwizacji rozmów (tylko dla Admina)
  const [archivedChatIds, setArchivedChatIds] = useState<string[]>([]);
  const [showArchivedDirect, setShowArchivedDirect] = useState(false);
  const [showArchivedGroups, setShowArchivedGroups] = useState(false);

  // Stan przypiętych czatów i grup (direct_{id} lub group_{id})
  const [pinnedChatIds, setPinnedChatIds] = useState<string[]>([]);

  // Znaczniki czasu usunięcia czatu 1:1 przez użytkownika
  const [deletedDirectChatTimestamps, setDeletedDirectChatTimestamps] = useState<Record<string, number>>({});

  // Kolejność i zarządzanie kategoriami grup
  const [categoriesOrder, setCategoriesOrder] = useState<string[]>(DEFAULT_GROUP_CATEGORIES);
  const [showCategoryManagerModal, setShowCategoryManagerModal] = useState(false);
  const [editingCategoryOldName, setEditingCategoryOldName] = useState<string | null>(null);
  const [editingCategoryNewName, setEditingCategoryNewName] = useState("");
  const [newCategoryInput, setNewCategoryInput] = useState("");

  const [klienci, setKlienci] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);

  // Referencje zapobiegające wyścigom asynchronicznym
  const selectedGroupRef = useRef<any>(null);
  const selectedUserRef = useRef<any>(null);

  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  const [messages, setMessages] = useState<any[]>([]);
  const [groupMessages, setGroupMessages] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  // Stany dla grafiku zajęć i zapisów
  const [grafikZajec, setGrafikZajec] = useState<any[]>([]);
  const [zapisyZajec, setZapisyZajec] = useState<any[]>([]);

  const [newMessage, setNewMessage] = useState("");

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
  const [newGroupCategory, setNewGroupCategory] = useState("Ogólne");
  const [newGroupType, setNewGroupType] = useState<"publiczna" | "zamknieta">("zamknieta");
  const [newGroupIcon, setNewGroupIcon] = useState("🏋️‍♂️");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<(number | string)[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Modal edycji grupy
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupCategory, setEditGroupCategory] = useState("Ogólne");
  const [editGroupIcon, setEditGroupIcon] = useState("");

  // Modal zapraszania / dodawania członków do istniejącej grupy
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [selectedInviteMembers, setSelectedInviteMembers] = useState<(number | string)[]>([]);

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

  // Wczytywanie zarchiwizowanych, przypiętych, usuniętych rozmów oraz zapamiętanej zakładki
  useEffect(() => {
    if (!currentUserId) return;
    const uid = secondaryUserId || currentUserId;

    const savedActiveTab = localStorage.getItem(`chat_last_tab_${uid}`);
    if (savedActiveTab === "direct" || savedActiveTab === "groups" || savedActiveTab === "trainings") {
      setActiveTab(savedActiveTab);
    }

    const savedArchived = localStorage.getItem(`chat_archived_${uid}`);
    if (savedArchived) {
      try {
        setArchivedChatIds(JSON.parse(savedArchived));
      } catch {
        setArchivedChatIds([]);
      }
    }

    const savedPinned = localStorage.getItem(`chat_pinned_${uid}`);
    if (savedPinned) {
      try {
        setPinnedChatIds(JSON.parse(savedPinned));
      } catch {
        setPinnedChatIds([]);
      }
    }

    const savedDeleted = localStorage.getItem(`chat_deleted_${uid}`);
    if (savedDeleted) {
      try {
        setDeletedDirectChatTimestamps(JSON.parse(savedDeleted));
      } catch {
        setDeletedDirectChatTimestamps({});
      }
    }

    const savedOrder = localStorage.getItem("group_categories_order");
    if (savedOrder) {
      try {
        setCategoriesOrder(JSON.parse(savedOrder));
      } catch {
        setCategoriesOrder(DEFAULT_GROUP_CATEGORIES);
      }
    }
  }, [currentUserId, secondaryUserId]);

  // Zmiana i zapamiętanie aktywnej zakładki
  const handleTabChange = (tab: "direct" | "groups" | "trainings") => {
    setActiveTab(tab);
    const uid = secondaryUserId || currentUserId;
    if (uid) {
      localStorage.setItem(`chat_last_tab_${uid}`, tab);
    }
  };

  // Przełączanie statusu archiwizacji (Tylko Admin)
  const toggleArchiveChat = (id: string | number, type: "direct" | "group", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    const key = `${type}_${id}`;
    const uid = secondaryUserId || currentUserId;
    const isCurrentlyArchived = archivedChatIds.includes(key);

    const updated = isCurrentlyArchived
      ? archivedChatIds.filter((k) => k !== key)
      : [...archivedChatIds, key];

    setArchivedChatIds(updated);
    if (uid) {
      localStorage.setItem(`chat_archived_${uid}`, JSON.stringify(updated));
    }
  };

  // Usuwanie czatu 1:1 z widoku
  const handleDeleteDirectChat = (targetUserId: string | number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmed = confirm("Czy na pewno chcesz usunąć tę rozmowę z listy? Wątek pojawi się ponownie po otrzymaniu nowej wiadomości.");
    if (!confirmed) return;

    const uid = secondaryUserId || currentUserId;
    const targetKey = String(targetUserId);
    const updated = {
      ...deletedDirectChatTimestamps,
      [targetKey]: Date.now(),
    };

    setDeletedDirectChatTimestamps(updated);
    if (uid) {
      localStorage.setItem(`chat_deleted_${uid}`, JSON.stringify(updated));
    }

    if (selectedUserRef.current && String(selectedUserRef.current.id) === targetKey) {
      handleExitCurrentChat();
    }
    setShowChatOptionsMenu(false);
  };

  // Przełączanie statusu przypięcia
  const togglePinChat = (id: string | number, type: "direct" | "group", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const key = `${type}_${id}`;
    const uid = secondaryUserId || currentUserId;
    const isCurrentlyPinned = pinnedChatIds.includes(key);

    const updated = isCurrentlyPinned
      ? pinnedChatIds.filter((k) => k !== key)
      : [...pinnedChatIds, key];

    setPinnedChatIds(updated);
    if (uid) {
      localStorage.setItem(`chat_pinned_${uid}`, JSON.stringify(updated));
    }
  };

  // Reset stanu po wyjściu z czatu
  const handleExitCurrentChat = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    selectedGroupRef.current = null;
    selectedUserRef.current = null;
    setSelectedUser(null);
    setSelectedGroup(null);
    setChatInsideTab("messages");
    setActiveMessageMenuId(null);
    setShowChatOptionsMenu(false);
    setReplyingToMessage(null);
  };

  // Całkowite zamknięcie okna czatu
  const handleCloseChat = () => {
    setIsOpen(false);
    selectedGroupRef.current = null;
    selectedUserRef.current = null;
    setSelectedUser(null);
    setSelectedGroup(null);
    setSelectedFile(null);
    setFilePreview(null);
    setChatInsideTab("messages");
    setFullscreenImage(null);
    setActiveMessageMenuId(null);
    setShowInviteModal(false);
    setShowCategoryManagerModal(false);
    setShowChatOptionsMenu(false);
    setReplyingToMessage(null);
  };

  // Zmiana kolejności kategorii
  const handleMoveCategory = (index: number, direction: "up" | "down") => {
    const newOrder = [...categoriesOrder];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setCategoriesOrder(newOrder);
    localStorage.setItem("group_categories_order", JSON.stringify(newOrder));
  };

  // Zmiana nazwy kategorii
  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName.trim()) {
      setEditingCategoryOldName(null);
      return;
    }
    const trimmedNew = newName.trim();

    try {
      const { error } = await supabase
        .from("czat_grupy")
        .update({ kategoria: trimmedNew })
        .eq("kategoria", oldName);

      if (error && !error.message?.includes("kategoria")) {
        alert("Błąd podczas aktualizacji nazwy kategorii w bazie: " + error.message);
        return;
      }

      const updatedOrder = categoriesOrder.map((c) => (c === oldName ? trimmedNew : c));
      setCategoriesOrder(updatedOrder);
      localStorage.setItem("group_categories_order", JSON.stringify(updatedOrder));

      setEditingCategoryOldName(null);
      setEditingCategoryNewName("");
      fetchGroupsAndTrainings();
    } catch (err) {
      console.error("Błąd edycji kategorii:", err);
    }
  };

  // Dodawanie nowej kategorii
  const handleAddNewCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (!categoriesOrder.includes(trimmed)) {
      const updated = [...categoriesOrder, trimmed];
      setCategoriesOrder(updated);
      localStorage.setItem("group_categories_order", JSON.stringify(updated));
    }
    setNewCategoryInput("");
  };

  // Usuwanie kategorii z listy
  const handleDeleteCategoryFromList = (catName: string) => {
    if (catName === "Ogólne") {
      alert("Nie można usunąć domyślnej kategorii 'Ogólne'.");
      return;
    }
    const updated = categoriesOrder.filter((c) => c !== catName);
    setCategoriesOrder(updated);
    localStorage.setItem("group_categories_order", JSON.stringify(updated));
  };

  // Trwałe usuwanie czatu grupowego (Admin)
  const handleDeleteGroup = async (groupId: string | number, groupName: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!isAdmin) return;

    const isConfirmed = confirm(`Czy na pewno chcesz bezpowrotnie usunąć grupę "${groupName}" oraz wszystkie jej wiadomości?`);
    if (!isConfirmed) return;

    try {
      await supabase.from("czat_wiadomosci").delete().eq("grupa_id", groupId);
      const { error } = await supabase.from("czat_grupy").delete().eq("id", groupId);
      if (error) {
        alert("Błąd podczas usuwania grupy: " + error.message);
        return;
      }

      const key = `group_${groupId}`;
      const uid = secondaryUserId || currentUserId;
      const newPinned = pinnedChatIds.filter((k) => k !== key);
      const newArchived = archivedChatIds.filter((k) => k !== key);
      setPinnedChatIds(newPinned);
      setArchivedChatIds(newArchived);
      if (uid) {
        localStorage.setItem(`chat_pinned_${uid}`, JSON.stringify(newPinned));
        localStorage.setItem(`chat_archived_${uid}`, JSON.stringify(newArchived));
      }

      if (selectedGroupRef.current?.id === groupId) {
        handleExitCurrentChat();
      }
      setShowEditGroupModal(false);
      setShowChatOptionsMenu(false);
      fetchGroupsAndTrainings();
    } catch (err) {
      console.error("Błąd usuwania grupy:", err);
    }
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
      // Ignoruj
    }

    if (position) {
      localStorage.setItem("chat_bubble_pos", JSON.stringify(position));
    }

    if (!hasMovedRef.current) {
      if (isOpen) {
        handleCloseChat();
      } else {
        selectedGroupRef.current = null;
        selectedUserRef.current = null;
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
  const sendGroupPushNotification = async (groupId: string, senderId: string, senderName: string, groupName: string, messageText: string, trainingObj?: any) => {
    try {
      let recipientIds: string[] = [];

      if (trainingObj) {
        const signups = getSignupsForTraining(trainingObj);
        recipientIds = signups.map((z: any) => String(z.klient_id));
      } else {
        const { data: groupData } = await supabase
          .from("czat_grupy")
          .select("czlonkowie_ids, wyciszeni_ids, zbanowani_ids")
          .eq("id", groupId)
          .single();

        if (groupData) {
          const members = Array.isArray(groupData.czlonkowie_ids) ? groupData.czlonkowie_ids.map(String) : [];
          const muted = Array.isArray(groupData.wyciszeni_ids) ? groupData.wyciszeni_ids.map(String) : [];
          const banned = Array.isArray(groupData.zbanowani_ids) ? groupData.zbanowani_ids.map(String) : [];
          recipientIds = members.filter((id) => !muted.includes(id) && !banned.includes(id));
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

      if (groupsData) {
        setGroups(groupsData);
        if (selectedGroupRef.current) {
          const freshSelected = groupsData.find((g: any) => g.id === selectedGroupRef.current.id);
          if (freshSelected) {
            setSelectedGroup(freshSelected);
          }
        }
      }

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

  // Pobieranie wiadomości z wybranej grupy
  const fetchGroupMessages = async (groupId?: string | number) => {
    const targetGroupId = groupId || selectedGroupRef.current?.id;
    if (!targetGroupId) return;
    try {
      const { data, error } = await supabase
        .from("czat_wiadomosci")
        .select("*")
        .eq("grupa_id", targetGroupId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setGroupMessages(data);
      }
    } catch (err) {
      console.error("Błąd pobierania wiadomości grupy:", err);
    }
  };

  // Pobieranie wszystkich wiadomości
  const fetchMessages = async () => {
    if (!currentUserId) return;

    let query = supabase.from("czat_wiadomosci").select("*");
    const { data, error } = await query.order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
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
        if (selectedGroupRef.current) {
          fetchGroupMessages(selectedGroupRef.current.id);
        }
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
  }, [currentUserId, secondaryUserId]);

  useEffect(() => {
    if (selectedGroup?.id) {
      fetchGroupMessages(selectedGroup.id);
    }
  }, [selectedGroup?.id]);

  // Oznaczanie wiadomości 1-na-1 jako przeczytane
  useEffect(() => {
    if (isOpen && selectedUser && currentUserId) {
      const markAsRead = async () => {
        const targetId = secondaryUserId || currentUserId;
        const isSys = Number(selectedUser.id) === SYSTEM_ID;

        if (isSys) {
          await supabase
            .from("czat_wiadomosci")
            .update({
              przeczytana: true,
              przeczytana_at: new Date().toISOString(),
            })
            .eq("odbiorca_id", targetId)
            .is("nadawca_id", null)
            .eq("przeczytana", false);

          await supabase
            .from("czat_wiadomosci")
            .update({
              przeczytana: true,
              przeczytana_at: new Date().toISOString(),
            })
            .eq("odbiorca_id", targetId)
            .eq("nadawca_id", SYSTEM_ID)
            .eq("przeczytana", false);
        } else {
          await supabase
            .from("czat_wiadomosci")
            .update({
              przeczytana: true,
              przeczytana_at: new Date().toISOString(),
            })
            .eq("nadawca_id", selectedUser.id)
            .eq("odbiorca_id", targetId)
            .eq("przeczytana", false);
        }

        fetchMessages();
      };
      markAsRead();
    }
  }, [isOpen, selectedUser, currentUserId, secondaryUserId]);

  // Oznaczanie wiadomości w grupie/treningu jako przeczytane
  useEffect(() => {
    if (isOpen && selectedGroup && currentUserId) {
      const markGroupAsRead = async () => {
        const myEffective = [String(currentUserId), secondaryUserId ? String(secondaryUserId) : null].filter(Boolean);
        await supabase
          .from("czat_wiadomosci")
          .update({
            przeczytana: true,
            przeczytana_at: new Date().toISOString(),
          })
          .eq("grupa_id", selectedGroup.id)
          .not("nadawca_id", "in", `(${myEffective.join(",")})`)
          .eq("przeczytana", false);

        fetchGroupMessages(selectedGroup.id);
        fetchMessages();
      };
      markGroupAsRead();
    }
  }, [isOpen, selectedGroup?.id, currentUserId, secondaryUserId]);

  // Obsługa plików
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

  // Wgrywanie ikony grupy
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
    const jsDay = new Date().getDay();
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

  // Dopasowanie aktywnych zapisów dla treningu
  const getSignupsForTraining = (training: any) => {
    if (!training) return [];
    const tId = String(training.id || "").trim();
    const tTitle = String(training.title || "").toLowerCase().trim();
    const tStart = String(training.start || "").trim();
    const todayIso = new Date().toISOString().split("T")[0];
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = String(now.getFullYear());
    const todayPl = `${day}.${month}.${year}`;
    const todayDash = `${day}-${month}-${year}`;

    return zapisyZajec.filter((z: any) => {
      if (!z) return false;
      const st = String(z.status || "").toLowerCase();
      if (st === "odwolany" || st === "odwołany" || st === "anulowany" || st === "cancelled") {
        return false;
      }

      const ck = String(z.class_key || "").trim();
      if (!ck) return false;

      if (ck === tId) return true;

      const tokens = ck.split(/[_:-]/);
      if (tokens.includes(tId)) {
        const hasTodayDate = ck.includes(todayIso) || ck.includes(todayPl) || ck.includes(todayDash);
        const hasAnyDate = /\d{4}-\d{2}-\d{2}/.test(ck) || /\d{2}\.\d{2}\.\d{4}/.test(ck);
        if (hasAnyDate) {
          return hasTodayDate;
        }
        return true;
      }

      const ckLower = ck.toLowerCase();
      const matchesTitle = tTitle && ckLower.includes(tTitle);
      const matchesStart = tStart && (ck.includes(tStart) || ck.includes(tStart.replace(":", "-")));
      const matchesDate = ck.includes(todayIso) || ck.includes(todayPl) || ck.includes(todayDash);

      if (matchesTitle && matchesStart && matchesDate) {
        return true;
      }

      return false;
    });
  };

  // Tworzenie lub pobieranie grupy czatu treningu
  const getOrCreateTrainingGroup = async (training: any) => {
    const todayStr = new Date().toLocaleDateString("pl-PL");
    const groupName = `Trening: ${training.title} (${todayStr} ${training.start})`;

    const signups = getSignupsForTraining(training);
    const signedClientIds = signups.map((z: any) => String(z.klient_id));

    const rawSenderId = secondaryUserId || currentUserId;
    const parsedCreatorId = !isNaN(Number(rawSenderId)) ? Number(rawSenderId) : null;

    const myClientId = String(secondaryUserId || currentUserId);
    const adminIds = klienci
      .filter((k: any) => ADMIN_EMAILS.includes(k.email) || Number(k.id) === SYSTEM_ID || Number(k.id) === 999999999)
      .map((k: any) => String(k.id));

    const allMembers = Array.from(new Set([...signedClientIds, myClientId, ...adminIds, "999999999", String(SYSTEM_ID)]));

    const existing = groups.find((g: any) => g.nazwa === groupName || (g.typ === "trening" && g.nazwa?.includes(training.title) && g.nazwa?.includes(training.start)));
    if (existing) {
      const currentStored = Array.isArray(existing.czlonkowie_ids) ? existing.czlonkowie_ids.map(String) : [];
      const newCalculated = allMembers.map(String);

      if (currentStored.length !== newCalculated.length || !newCalculated.every((id) => currentStored.includes(id))) {
        await supabase
          .from("czat_grupy")
          .update({ czlonkowie_ids: allMembers })
          .eq("id", existing.id);
        existing.czlonkowie_ids = allMembers;
      }
      return existing;
    }

    const { data, error } = await supabase
      .from("czat_grupy")
      .insert([
        {
          nazwa: groupName,
          kategoria: "Treningi",
          tworca_id: parsedCreatorId,
          czlonkowie_ids: allMembers,
          typ: "trening",
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

  // Wysyłanie wiadomości wraz z obsługą cytowania i powiadomień Push
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || (!selectedUser && !selectedGroup) || !currentUserId) return;

    const senderId = secondaryUserId || currentUserId;

    if (selectedGroup) {
      const bannedList = Array.isArray(selectedGroup.zbanowani_ids) ? selectedGroup.zbanowani_ids.map(String) : [];
      if (bannedList.includes(String(senderId)) && !isAdmin) {
        alert("Zostałeś zablokowany w tej grupie i nie możesz wysyłać wiadomości.");
        return;
      }
    }

    setIsUploading(true);
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
      reply_to_id: replyingToMessage?.id || null,
      reply_to_text: replyingToMessage ? (replyingToMessage.tresc || (replyingToMessage.attachment_url ? "📎 Załącznik" : "Wiadomość")) : null,
      reply_to_sender: replyingToMessage?.nadawca_nazwa || null,
    };

    const targetReplyAuthorId = replyingToMessage?.nadawca_id;

    if (selectedGroup) {
      payload.grupa_id = selectedGroup.id;
      payload.odbiorca_id = null;

      let { error } = await supabase.from("czat_wiadomosci").insert([payload]);
      
      // Fallback jeśli kolumny reply_to nie zostały jeszcze dodane do bazy Supabase
      if (error && (error.message?.includes("reply_to") || error.code === "PGRST204" || error.code === "42703")) {
        delete payload.reply_to_id;
        delete payload.reply_to_text;
        delete payload.reply_to_sender;
        const retry = await supabase.from("czat_wiadomosci").insert([payload]);
        error = retry.error;
      }

      if (error) {
        console.error("Błąd bazy danych przy wysyłce do grupy:", error);
        alert("Nie udało się wysłać wiadomości: " + error.message);
      } else {
        setNewMessage("");
        setSelectedFile(null);
        setFilePreview(null);
        setReplyingToMessage(null);
        fetchGroupMessages(selectedGroup.id);
        updateLastSeen(senderId);

        const isTrainingChat = selectedGroup.typ === "trening" || selectedGroup.nazwa?.startsWith("Trening:");
        let matchedTraining = null;
        if (isTrainingChat) {
          matchedTraining =
            grafikZajec.find((t: any) => selectedGroup.nazwa.includes(t.title) && selectedGroup.nazwa.includes(t.start)) ||
            grafikZajec.find((t: any) => selectedGroup.nazwa.includes(t.title));
        }

        // Standardowy Push grupowy
        sendGroupPushNotification(String(selectedGroup.id), String(senderId), currentUserName, selectedGroup.nazwa, messageText || "📎 Załącznik", matchedTraining);
        
        // Specjalne powiadomienie Push o odpowiedzi do autora oryginalnej wiadomości
        if (targetReplyAuthorId && String(targetReplyAuthorId) !== String(senderId)) {
          sendChatPushNotification(targetReplyAuthorId, currentUserName, `↩ Odpowiedział(a) na Twoją wiadomość w grupie "${selectedGroup.nazwa}": "${messageText || "📎 Załącznik"}"`);
        }
      }
    } else if (selectedUser) {
      payload.odbiorca_id = selectedUser.id;
      payload.grupa_id = null;

      let { error } = await supabase.from("czat_wiadomosci").insert([payload]);

      // Fallback jeśli kolumny reply_to nie zostały jeszcze dodane
      if (error && (error.message?.includes("reply_to") || error.code === "PGRST204" || error.code === "42703")) {
        delete payload.reply_to_id;
        delete payload.reply_to_text;
        delete payload.reply_to_sender;
        const retry = await supabase.from("czat_wiadomosci").insert([payload]);
        error = retry.error;
      }

      if (error) {
        console.error("Błąd bazy danych przy wysyłce 1-na-1:", error);
        alert("Nie udało się wysłać wiadomości: " + error.message);
      } else {
        const targetKey = String(selectedUser.id);
        if (deletedDirectChatTimestamps[targetKey]) {
          const updatedDeleted = { ...deletedDirectChatTimestamps };
          delete updatedDeleted[targetKey];
          setDeletedDirectChatTimestamps(updatedDeleted);
          const uid = secondaryUserId || currentUserId;
          if (uid) {
            localStorage.setItem(`chat_deleted_${uid}`, JSON.stringify(updatedDeleted));
          }
        }

        setNewMessage("");
        setSelectedFile(null);
        setFilePreview(null);
        setReplyingToMessage(null);
        fetchMessages();
        updateLastSeen(senderId);

        const pushBody = targetReplyAuthorId && String(targetReplyAuthorId) === String(selectedUser.id)
          ? `↩ Odpowiedział(a) na Twoją wiadomość: "${messageText || "📎 Załącznik"}"`
          : messageText || "📎 Załącznik";

        sendChatPushNotification(selectedUser.id, currentUserName, pushBody);
      }
    }

    setIsUploading(false);
  };

  // Przypinanie wiadomości wewnątrz czatu
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
        const effective = [String(currentUserId), secondaryUserId ? String(secondaryUserId) : null].filter(Boolean);
        await supabase
          .from("czat_wiadomosci")
          .update({ przypinana: false })
          .or(`and(nadawca_id.eq.${effective[0]},odbiorca_id.eq.${targetId}),and(nadawca_id.eq.${targetId},odbiorca_id.eq.${effective[0]})`);
      }
    }

    const { error } = await supabase
      .from("czat_wiadomosci")
      .update({ przypinana: newStatus })
      .eq("id", msg.id);

    if (!error) {
      fetchMessages();
      if (selectedGroup) fetchGroupMessages(selectedGroup.id);
    }
    setActiveMessageMenuId(null);
  };

  // Reakcje emoji
  const handleToggleReaction = async (msg: any, emoji: string) => {
    const myIdStr = String(secondaryUserId || currentUserId);
    let currentReactions = msg.reakcje || {};
    if (typeof currentReactions === "string") {
      try {
        currentReactions = JSON.parse(currentReactions);
      } catch {
        currentReactions = {};
      }
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
      if (selectedGroup) fetchGroupMessages(selectedGroup.id);
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
          handleExitCurrentChat();
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

  // Zaproszenie / Prośba o dołączenie do grupy zamkniętej
  const handleRequestJoinGroup = async (group: any) => {
    const myId = String(secondaryUserId || currentUserId);
    let pendingRequests: string[] = Array.isArray(group.prosby_ids) ? group.prosby_ids.map(String) : [];

    if (!pendingRequests.includes(myId)) {
      pendingRequests.push(myId);
    }

    const { error } = await supabase
      .from("czat_grupy")
      .update({ prosby_ids: pendingRequests })
      .eq("id", group.id);

    if (!error) {
      alert("Wysłano prośbę o dołączenie do grupy. Poczekaj na akceptację przez Administratora.");
      fetchGroupsAndTrainings();
    }
  };

  // Akceptacja prośby o dołączenie do grupy
  const handleAcceptJoinRequest = async (group: any, targetUserId: string | number) => {
    let currentMembers: any[] = Array.isArray(group.czlonkowie_ids) ? [...group.czlonkowie_ids] : [];
    let pendingRequests: any[] = Array.isArray(group.prosby_ids) ? [...group.prosby_ids] : [];

    const uIdStr = String(targetUserId);
    if (!currentMembers.map(String).includes(uIdStr)) {
      currentMembers.push(targetUserId);
    }
    pendingRequests = pendingRequests.filter((id) => String(id) !== uIdStr);

    const { error } = await supabase
      .from("czat_grupy")
      .update({
        czlonkowie_ids: currentMembers,
        prosby_ids: pendingRequests,
      })
      .eq("id", group.id);

    if (!error) {
      fetchGroupsAndTrainings();
    }
  };

  // Odrzucenie prośby o dołączenie do grupy
  const handleRejectJoinRequest = async (group: any, targetUserId: string | number) => {
    let pendingRequests: any[] = Array.isArray(group.prosby_ids) ? [...group.prosby_ids] : [];
    pendingRequests = pendingRequests.filter((id) => String(id) !== String(targetUserId));

    const { error } = await supabase
      .from("czat_grupy")
      .update({ prosby_ids: pendingRequests })
      .eq("id", group.id);

    if (!error) {
      fetchGroupsAndTrainings();
    }
  };

  // Dodawanie zaproszonych członków do grupy
  const handleAddMembersToGroup = async () => {
    if (!selectedGroup || selectedInviteMembers.length === 0) return;

    let currentMembers = Array.isArray(selectedGroup.czlonkowie_ids) ? [...selectedGroup.czlonkowie_ids] : [];
    let currentBanned = Array.isArray(selectedGroup.zbanowani_ids) ? [...selectedGroup.zbanowani_ids] : [];

    selectedInviteMembers.forEach((id) => {
      if (!currentMembers.map(String).includes(String(id))) {
        currentMembers.push(id);
      }
      currentBanned = currentBanned.filter((bId) => String(bId) !== String(id));
    });

    const { error } = await supabase
      .from("czat_grupy")
      .update({
        czlonkowie_ids: currentMembers,
        zbanowani_ids: currentBanned,
      })
      .eq("id", selectedGroup.id);

    if (!error) {
      setSelectedInviteMembers([]);
      setShowInviteModal(false);
      fetchGroupsAndTrainings();
    }
  };

  // Usunięcie członka z grupy
  const handleRemoveMemberFromGroup = async (memberId: string | number) => {
    if (!selectedGroup) return;
    const confirmRemove = confirm("Czy na pewno chcesz usunąć tego użytkownika z grupy?");
    if (!confirmRemove) return;

    let currentMembers = Array.isArray(selectedGroup.czlonkowie_ids) ? [...selectedGroup.czlonkowie_ids] : [];
    currentMembers = currentMembers.filter((m) => String(m) !== String(memberId));

    const { error } = await supabase
      .from("czat_grupy")
      .update({ czlonkowie_ids: currentMembers })
      .eq("id", selectedGroup.id);

    if (!error) {
      fetchGroupsAndTrainings();
    }
  };

  // Zbanowanie użytkownika w grupie
  const handleBanUserFromGroup = async (memberId: string | number) => {
    if (!selectedGroup) return;
    const confirmBan = confirm("Czy na pewno chcesz zbanować tego użytkownika w grupie? Zostanie usunięty i zablokowany przed dołączeniem.");
    if (!confirmBan) return;

    let currentMembers = Array.isArray(selectedGroup.czlonkowie_ids) ? [...selectedGroup.czlonkowie_ids] : [];
    let currentBanned = Array.isArray(selectedGroup.zbanowani_ids) ? [...selectedGroup.zbanowani_ids] : [];

    currentMembers = currentMembers.filter((m) => String(m) !== String(memberId));
    if (!currentBanned.map(String).includes(String(memberId))) {
      currentBanned.push(memberId);
    }

    const { error } = await supabase
      .from("czat_grupy")
      .update({
        czlonkowie_ids: currentMembers,
        zbanowani_ids: currentBanned,
      })
      .eq("id", selectedGroup.id);

    if (!error) {
      fetchGroupsAndTrainings();
    }
  };

  // Odbanowanie użytkownika w grupie
  const handleUnbanUserFromGroup = async (memberId: string | number) => {
    if (!selectedGroup) return;

    let currentBanned = Array.isArray(selectedGroup.zbanowani_ids) ? [...selectedGroup.zbanowani_ids] : [];
    currentBanned = currentBanned.filter((m) => String(m) !== String(memberId));

    const { error } = await supabase
      .from("czat_grupy")
      .update({ zbanowani_ids: currentBanned })
      .eq("id", selectedGroup.id);

    if (!error) {
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

  // Otwarcie modalu tworzenia grupy z domyślną kategorią
  const handleOpenCreateGroupModal = (defaultCategory: string = "Ogólne") => {
    setNewGroupName("");
    setNewGroupCategory(defaultCategory);
    setNewGroupType("zamknieta");
    setNewGroupIcon("🏋️‍♂️");
    setSelectedGroupMembers([]);
    setShowCreateGroupModal(true);
  };

  // Tworzenie nowej grupy (dla Admina oraz Klubowiczów)
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || isCreatingGroup) return;

    setIsCreatingGroup(true);
    try {
      const rawSenderId = secondaryUserId || currentUserId;
      const parsedCreatorId = !isNaN(Number(rawSenderId)) ? Number(rawSenderId) : null;
      const allMembers = newGroupType === "publiczna"
        ? [rawSenderId]
        : Array.from(new Set([...selectedGroupMembers, rawSenderId]));

      const payload: any = {
        nazwa: newGroupName.trim(),
        kategoria: newGroupCategory.trim() || "Ogólne",
        tworca_id: parsedCreatorId,
        czlonkowie_ids: allMembers,
        typ: newGroupType,
        ikona: newGroupIcon,
      };

      let { data, error } = await supabase
        .from("czat_grupy")
        .insert([payload])
        .select();

      if (error && (error.message?.includes("kategoria") || error.code === "PGRST204" || error.code === "42703")) {
        delete payload.kategoria;
        const retry = await supabase.from("czat_grupy").insert([payload]).select();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error("Błąd tworzenia grupy w Supabase:", error);
        alert("Nie udało się stworzyć grupy: " + (error.message || "Błąd zapisu w bazie danych"));
        return;
      }

      if (data && data.length > 0) {
        const createdGroup = data[0];
        setNewGroupName("");
        setNewGroupCategory("Ogólne");
        setNewGroupType("zamknieta");
        setNewGroupIcon("🏋️‍♂️");
        setSelectedGroupMembers([]);
        setShowCreateGroupModal(false);
        await fetchGroupsAndTrainings();
        selectedGroupRef.current = createdGroup;
        setSelectedGroup(createdGroup);
        setChatInsideTab("messages");
      }
    } catch (err: any) {
      console.error("Błąd krytyczny tworzenia grupy:", err);
      alert("Wystąpił błąd: " + (err.message || err));
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Aktualizacja danych grupy
  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !editGroupName.trim()) return;

    try {
      const payload: any = {
        nazwa: editGroupName.trim(),
        kategoria: editGroupCategory.trim() || "Ogólne",
        ikona: editGroupIcon,
      };

      let { error } = await supabase
        .from("czat_grupy")
        .update(payload)
        .eq("id", selectedGroup.id);

      if (error && (error.message?.includes("kategoria") || error.code === "42703")) {
        delete payload.kategoria;
        const retry = await supabase.from("czat_grupy").update(payload).eq("id", selectedGroup.id);
        error = retry.error;
      }

      if (error) {
        alert("Nie udało się zaktualizować grupy: " + error.message);
        return;
      }

      setShowEditGroupModal(false);
      fetchGroupsAndTrainings();
    } catch (err: any) {
      console.error("Błąd aktualizacji grupy:", err);
    }
  };

  if (!currentUserId) return null;

  const effectiveIds = [
    String(currentUserId),
    secondaryUserId ? String(secondaryUserId) : null,
  ].filter(Boolean);

  // Filtrowanie wiadomości 1-na-1
  const activeChatMessages = messages.filter((m: any) => {
    if (!selectedUser) return false;
    const isSenderMe = effectiveIds.includes(String(m.nadawca_id));
    const isReceiverMe = effectiveIds.includes(String(m.odbiorca_id));
    const isSelectedUserSystem = Number(selectedUser.id) === SYSTEM_ID;

    if (isSelectedUserSystem) {
      const isSystemMessage = m.nadawca_id === null || Number(m.nadawca_id) === SYSTEM_ID;
      return (isSystemMessage && isReceiverMe) || (isSenderMe && Number(m.odbiorca_id) === SYSTEM_ID);
    }

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

  // Dynamiczne pobieranie uczestników grupy
  let groupMemberIds: string[] = [];
  let groupBannedIds: string[] = [];
  let groupPendingRequestIds: string[] = [];

  if (selectedGroup) {
    groupBannedIds = Array.isArray(selectedGroup.zbanowani_ids) ? selectedGroup.zbanowani_ids.map(String) : [];
    groupPendingRequestIds = Array.isArray(selectedGroup.prosby_ids) ? selectedGroup.prosby_ids.map(String) : [];

    const isTraining = selectedGroup.typ === "trening" || selectedGroup.nazwa?.startsWith("Trening:");
    if (isTraining) {
      const matchedTraining =
        grafikZajec.find((t: any) =>
          selectedGroup.nazwa.includes(t.title) &&
          (selectedGroup.nazwa.includes(t.start) || !selectedGroup.nazwa.includes(":"))
        ) || grafikZajec.find((t: any) => selectedGroup.nazwa.includes(t.title));

      if (matchedTraining) {
        const signups = getSignupsForTraining(matchedTraining);
        const signedClientIds = signups.map((z: any) => String(z.klient_id));
        const adminIds = klienci
          .filter((k: any) => ADMIN_EMAILS.includes(k.email) || Number(k.id) === SYSTEM_ID || Number(k.id) === 999999999)
          .map((k: any) => String(k.id));
        const creatorAndMe = [String(selectedGroup.tworca_id), String(secondaryUserId || currentUserId), "999999999", String(SYSTEM_ID)];
        groupMemberIds = Array.from(new Set([...signedClientIds, ...adminIds, ...creatorAndMe]));
      } else {
        groupMemberIds = Array.isArray(selectedGroup.czlonkowie_ids) ? selectedGroup.czlonkowie_ids.map(String) : [];
      }
    } else {
      groupMemberIds = Array.isArray(selectedGroup.czlonkowie_ids) ? selectedGroup.czlonkowie_ids.map(String) : [];
    }
  }

  const groupMembersList = klienci.filter((k: any) =>
    groupMemberIds.includes(String(k.id)) || Number(k.id) === SYSTEM_ID
  );

  const groupBannedList = klienci.filter((k: any) =>
    groupBannedIds.includes(String(k.id))
  );

  const groupPendingRequestsList = klienci.filter((k: any) =>
    groupPendingRequestIds.includes(String(k.id))
  );

  // Mapowanie czasu i treści ostatniej wiadomości 1-na-1
  const latestMessageMap = new Map();
  const latestMessageTextMap = new Map();

  // Mapowanie czasu ostatniej wiadomości w czacie grupowym
  const latestGroupMessageTimeMap = new Map<string, number>();

  messages.forEach((m: any) => {
    const msgTime = new Date(m.created_at).getTime();

    if (m.grupa_id) {
      const gId = String(m.grupa_id);
      if (!latestGroupMessageTimeMap.has(gId) || msgTime > latestGroupMessageTimeMap.get(gId)!) {
        latestGroupMessageTimeMap.set(gId, msgTime);
      }
    } else {
      let otherId = effectiveIds.includes(String(m.nadawca_id)) ? m.odbiorca_id : m.nadawca_id;
      if (otherId === null || otherId === undefined) otherId = SYSTEM_ID;

      if (!latestMessageMap.has(otherId) || msgTime > latestMessageMap.get(otherId)) {
        latestMessageMap.set(otherId, msgTime);
        latestMessageTextMap.set(otherId, m.tresc || (m.attachment_url ? "📎 Załącznik" : ""));
      }
    }
  });

  const chattedUserIds = new Set<string | number>();
  messages.forEach((m: any) => {
    if (effectiveIds.includes(String(m.nadawca_id))) {
      chattedUserIds.add(m.odbiorca_id);
    } else if (effectiveIds.includes(String(m.odbiorca_id))) {
      chattedUserIds.add(m.nadawca_id ?? SYSTEM_ID);
    }
  });

  const displayedUsers = klienci
    .filter((k: any) => !effectiveIds.includes(String(k.id)))
    .filter((k: any) => {
      if (Number(k.id) === SYSTEM_ID) return true;

      const q = searchQuery.trim().toLowerCase();
      if (!q) {
        const deletedTimestamp = deletedDirectChatTimestamps[String(k.id)];
        const lastMsgTime = latestMessageMap.get(k.id) || 0;
        if (deletedTimestamp && lastMsgTime <= deletedTimestamp) {
          return false;
        }

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

  const activeDirectUsers = displayedUsers.filter((u) => !archivedChatIds.includes(`direct_${u.id}`));
  const pinnedDirectUsers = activeDirectUsers.filter((u) => pinnedChatIds.includes(`direct_${u.id}`));
  const regularDirectUsers = activeDirectUsers.filter((u) => !pinnedChatIds.includes(`direct_${u.id}`));
  const archivedDirectUsers = isAdmin ? displayedUsers.filter((u) => archivedChatIds.includes(`direct_${u.id}`)) : [];

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

  // Komponent pojedynczej wiadomości z obsługą Swipe-to-Reply
  const MessageItem = ({ msg, isMe }: { msg: any; isMe: boolean }) => {
    const isSystemSender = Number(msg.nadawca_id) === SYSTEM_ID || msg.nadawca_id === null;
    const isBirthdayNotification = isSystemSender && (msg.tresc?.includes("🎂") || msg.tresc?.includes("urodzin"));
    const isBadgeNotification = isSystemSender && (msg.tresc?.includes("🎖️") || msg.tresc?.includes("odznakę klubową"));
    const isChallengeNotification = msg.tresc?.includes("⚔️") || msg.tresc?.includes("Rzuciłem Ci wyzwanie");
    const isKnowledgeBaseNotification = isSystemSender && (msg.tresc?.includes("Bazy Wiedzy") || msg.tresc?.includes("Baza Wiedzy") || msg.tresc?.includes("suplemencie"));

    const isSpecial = isSystemSender || isBirthdayNotification || isBadgeNotification || isChallengeNotification || isKnowledgeBaseNotification;
    const reactionsObj = msg.reakcje || {};
    const myIdStr = String(secondaryUserId || currentUserId);

    // Gest Swipe-to-Reply
    const [dragOffset, setDragOffset] = useState(0);
    const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const isSwipingMessage = useRef(false);

    const handleTouchStart = (e: React.TouchEvent) => {
      if (isSpecial) return;
      touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isSwipingMessage.current = true;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (!isSwipingMessage.current || isSpecial) return;
      const deltaX = e.touches[0].clientX - touchStartPos.current.x;
      const deltaY = e.touches[0].clientY - touchStartPos.current.y;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        // Pozwalamy na przesunięcie w lewo lub w prawo do max 65px
        const bounded = Math.max(-65, Math.min(65, deltaX));
        setDragOffset(bounded);
      }
    };

    const handleTouchEnd = () => {
      if (!isSwipingMessage.current || isSpecial) return;
      if (Math.abs(dragOffset) >= 40) {
        setReplyingToMessage(msg);
      }
      setDragOffset(0);
      isSwipingMessage.current = false;
    };

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

    if (isKnowledgeBaseNotification) {
      return (
        <div className="w-full bg-gradient-to-br from-sky-50 to-amber-50/60 border-2 border-amber-400 rounded-3xl p-4 shadow-md text-slate-900 space-y-2">
          <div className="flex items-center justify-between border-b border-amber-300/50 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">📚</span>
              <span className="font-black text-[11px] uppercase tracking-wider text-sky-950">
                Baza Wiedzy Uzupełniona!
              </span>
            </div>
            <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
              Administrator
            </span>
          </div>
          <p className="text-xs leading-relaxed font-semibold text-slate-800">{msg.tresc}</p>
          {renderAttachment(msg)}
        </div>
      );
    }

    if (isBadgeNotification || (isSystemSender && !isBirthdayNotification && !isChallengeNotification && !isKnowledgeBaseNotification)) {
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

    return (
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${dragOffset}px)` }}
        className="relative group flex flex-col transition-transform duration-75"
      >
        {/* Wizualna ikona strzałki odpowiedzi pojawiająca się przy przeciąganiu */}
        {Math.abs(dragOffset) > 20 && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 text-amber-400 text-base font-bold transition-opacity ${
              dragOffset > 0 ? "-left-6" : "-right-6"
            }`}
          >
            ↩
          </div>
        )}

        {/* DYMEK WIADOMOŚCI */}
        <div
          onClick={() => setActiveMessageMenuId(activeMessageMenuId === msg.id ? null : msg.id)}
          className={`max-w-[85%] min-w-[130px] p-3 rounded-2xl text-xs leading-relaxed shadow-sm cursor-pointer select-none ${
            isMe
              ? "bg-slate-900 text-white rounded-br-none ml-auto"
              : "bg-white text-slate-800 border border-slate-200 rounded-bl-none mr-auto"
          }`}
        >
          {/* SEKCJA CYTATU / ODPOWIEDZI W TLE WIADOMOŚCI */}
          {msg.reply_to_sender && (
            <div
              className={`mb-1.5 p-2 rounded-xl border-l-2 text-[10px] leading-tight select-none ${
                isMe
                  ? "bg-white/10 border-amber-400 text-slate-200"
                  : "bg-slate-100 border-amber-500 text-slate-700"
              }`}
            >
              <div className="font-bold flex items-center gap-1 text-amber-400">
                <span>↩</span>
                <span>
                  {String(msg.reply_to_sender).toLowerCase() === String(currentUserName).toLowerCase()
                    ? "Odpowiedź na Twoją wiadomość"
                    : `Odpowiedź dla: ${msg.reply_to_sender}`}
                </span>
              </div>
              <div className="truncate mt-0.5 opacity-90 italic">
                {msg.reply_to_text || "📎 Załącznik"}
              </div>
            </div>
          )}

          {selectedGroup && !isMe && msg.nadawca_nazwa && (
            <div className="text-[11px] font-bold text-amber-600 leading-tight mb-1 whitespace-normal break-words">
              {msg.nadawca_nazwa}
            </div>
          )}
          {msg.tresc && <div className="break-words">{msg.tresc}</div>}
          {renderAttachment(msg)}
        </div>

        {/* POPUP MENU REAKCJI, ODPOWIEDZI I PRZYPIĘCIA */}
        {activeMessageMenuId === msg.id && (
          <div className={`absolute z-30 bottom-full mb-1 bg-white border border-slate-200 shadow-xl rounded-2xl p-2 flex flex-col gap-1.5 ${isMe ? "right-0" : "left-0"}`}>
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
            
            <div className="pt-1 border-t border-slate-100 flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setReplyingToMessage(msg);
                  setActiveMessageMenuId(null);
                }}
                className="w-full text-left text-[11px] font-bold text-slate-800 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>↩</span> Odpowiedz
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handlePinMessage(msg)}
                  className="w-full text-left text-[11px] font-bold text-slate-800 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📌</span> {msg.przypinana ? "Odepnij treść" : "Przypnij treść"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* WYŚWIETLANIE REAKCJI */}
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

  // FILTROWANIE GRUP: Moje, Otwarte, Zamknięte
  const allMyGroups = groups.filter((g: any) => {
    const isTraining = g.typ === "trening" || g.nazwa?.startsWith("Trening:");
    if (isTraining) return false;

    if (isAdmin) return true;
    const members = Array.isArray(g.czlonkowie_ids) ? g.czlonkowie_ids.map(String) : [];
    return members.some((m: string) => effectiveIds.includes(m)) || effectiveIds.includes(String(g.tworca_id));
  });

  const activeMyGroups = allMyGroups.filter((g) => !archivedChatIds.includes(`group_${g.id}`));
  
  // Czaty grupowe użytkowników w zakładce Prywatne
  const directTabGroupChats = activeMyGroups
    .filter((g) => g.kategoria === "Czaty grupowe")
    .sort((a, b) => {
      const timeA = latestGroupMessageTimeMap.get(String(a.id)) || new Date(a.created_at || 0).getTime();
      const timeB = latestGroupMessageTimeMap.get(String(b.id)) || new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

  // Sortowanie przypiętych grup w zakładce Grupy
  const pinnedMyGroups = activeMyGroups
    .filter((g) => pinnedChatIds.includes(`group_${g.id}`))
    .sort((a, b) => {
      const timeA = latestGroupMessageTimeMap.get(String(a.id)) || new Date(a.created_at || 0).getTime();
      const timeB = latestGroupMessageTimeMap.get(String(b.id)) || new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

  const unpinnedMyGroups = activeMyGroups.filter((g) => !pinnedChatIds.includes(`group_${g.id}`));
  const archivedMyGroups = isAdmin ? allMyGroups.filter((g) => archivedChatIds.includes(`group_${g.id}`)) : [];

  // Podział na kategorie z automatycznym sortowaniem grup wg najnowszej wiadomości wewnątrz każdej kategorii
  const myGroupsByCategory = unpinnedMyGroups.reduce((acc: Record<string, any[]>, group: any) => {
    const cat = group.kategoria?.trim() || group.category?.trim() || "Ogólne";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(group);
    return acc;
  }, {});

  Object.keys(myGroupsByCategory).forEach((cat) => {
    myGroupsByCategory[cat].sort((a, b) => {
      const timeA = latestGroupMessageTimeMap.get(String(a.id)) || new Date(a.created_at || 0).getTime();
      const timeB = latestGroupMessageTimeMap.get(String(b.id)) || new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });
  });

  const sortedCategoryNames = Array.from(
    new Set([
      ...categoriesOrder.filter((cat) => myGroupsByCategory[cat]),
      ...Object.keys(myGroupsByCategory),
    ])
  );

  const publicDiscoverGroups = groups.filter((g: any) => {
    const isTraining = g.typ === "trening" || g.nazwa?.startsWith("Trening:");
    if (isTraining) return false;

    const isPublic = g.typ === "publiczna";
    const members = Array.isArray(g.czlonkowie_ids) ? g.czlonkowie_ids.map(String) : [];
    const isAlreadyMember = members.some((m: string) => effectiveIds.includes(m)) || effectiveIds.includes(String(g.tworca_id));
    return isPublic && !isAlreadyMember;
  });

  const closedDiscoverGroups = groups.filter((g: any) => {
    const isTraining = g.typ === "trening" || g.nazwa?.startsWith("Trening:");
    if (isTraining) return false;

    const isClosed = g.typ === "zamknieta" || !g.typ;
    const members = Array.isArray(g.czlonkowie_ids) ? g.czlonkowie_ids.map(String) : [];
    const isAlreadyMember = members.some((m: string) => effectiveIds.includes(m)) || effectiveIds.includes(String(g.tworca_id));
    return isClosed && !isAlreadyMember;
  });

  // DZISIEJSZE TRENINGI
  const todayTrainingsList = grafikZajec.filter((training: any) => {
    const isToday = isTrainingToday(training);
    if (!isToday) return false;

    if (isAdmin) return true;

    const myClientId = String(secondaryUserId || currentUserId);
    const signups = getSignupsForTraining(training);
    return signups.some((z: any) => String(z.klient_id) === myClientId);
  });

  const myGroupIds = new Set(allMyGroups.map((g: any) => String(g.id)));
  const trainingGroupIds = new Set(
    groups
      .filter((g: any) => g.typ === "trening" || g.nazwa?.startsWith("Trening:"))
      .map((g: any) => String(g.id))
  );

  const directTabGroupIds = new Set(directTabGroupChats.map((g: any) => String(g.id)));

  const unreadDirect1on1Count = messages.filter(
    (m: any) => effectiveIds.includes(String(m.odbiorca_id)) && !m.grupa_id && !m.przeczytana
  ).length;

  const unreadDirectGroupsCount = messages.filter(
    (m: any) => m.grupa_id && directTabGroupIds.has(String(m.grupa_id)) && !effectiveIds.includes(String(m.nadawca_id)) && !m.przeczytana
  ).length;

  const unreadDirectCount = unreadDirect1on1Count + unreadDirectGroupsCount;

  const unreadGroupsCount = messages.filter(
    (m: any) => m.grupa_id && myGroupIds.has(String(m.grupa_id)) && !effectiveIds.includes(String(m.nadawca_id)) && !m.przeczytana
  ).length;

  const unreadTrainingsCount = messages.filter(
    (m: any) => m.grupa_id && trainingGroupIds.has(String(m.grupa_id)) && !effectiveIds.includes(String(m.nadawca_id)) && !m.przeczytana
  ).length;

  const totalUnreadCount = unreadDirect1on1Count + unreadGroupsCount + unreadTrainingsCount;

  const renderGroupIcon = (iconValue: string, type: string) => {
    if (!iconValue) return type === "publiczna" ? "🌐" : "👥";
    if (iconValue.startsWith("http")) {
      return <img src={iconValue} alt="Ikona" className="w-full h-full object-cover rounded-full" />;
    }
    return <span>{iconValue}</span>;
  };

  const isCurrentGroupMuted = selectedGroup && Array.isArray(selectedGroup.wyciszeni_ids) && selectedGroup.wyciszeni_ids.map(String).includes(String(secondaryUserId || currentUserId));
  
  const isCurrentChatArchived = selectedGroup
    ? archivedChatIds.includes(`group_${selectedGroup.id}`)
    : selectedUser
    ? archivedChatIds.includes(`direct_${selectedUser.id}`)
    : false;

  const isCurrentChatPinned = selectedGroup
    ? pinnedChatIds.includes(`group_${selectedGroup.id}`)
    : selectedUser
    ? pinnedChatIds.includes(`direct_${selectedUser.id}`)
    : false;

  // Czysty render kafelka czatu 1-na-1
  const renderDirectUserItem = (user: any, isPinnedItem: boolean = false) => {
    const isSys = Number(user.id) === SYSTEM_ID;
    const userUnread = messages.filter((m: any) => {
      if (!effectiveIds.includes(String(m.odbiorca_id)) || m.grupa_id || m.przeczytana) return false;
      if (isSys) {
        return m.nadawca_id === null || Number(m.nadawca_id) === SYSTEM_ID;
      }
      return String(m.nadawca_id) === String(user.id);
    }).length;

    const lastMessageText = latestMessageTextMap.get(user.id);

    return (
      <div
        key={user.id}
        className={`w-full p-2.5 rounded-2xl border flex items-center justify-between transition-all shadow-sm group ${
          isPinnedItem
            ? "bg-amber-50/70 border-amber-300 hover:border-amber-400"
            : isSys
            ? "bg-gradient-to-r from-amber-50 to-white border-amber-300 hover:border-amber-400"
            : "bg-white hover:bg-sky-50 border-slate-200/80"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            selectedUserRef.current = user;
            setSelectedUser(user);
            setChatInsideTab("messages");
          }}
          className="flex items-center gap-3 overflow-hidden flex-1 text-left cursor-pointer"
        >
          <div
            className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shrink-0 border relative ${
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
            {isPinnedItem && (
              <span className="absolute bottom-0 right-0 text-[10px] leading-none bg-amber-400 rounded-full p-0.5 shadow">📌</span>
            )}
          </div>
          <div className="overflow-hidden flex-1">
            <div className={`font-bold text-xs truncate flex items-center gap-1.5 ${isSys ? "text-amber-950 font-black" : "text-slate-900 group-hover:text-sky-950"}`}>
              <span>{user.name}</span>
              {isPinnedItem && <span className="text-[10px]" title="Przypięty czat">📌</span>}
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-0.5">
              {lastMessageText ? (
                <span className="italic">{lastMessageText}</span>
              ) : (
                <span>{isSys ? "Oficjalne powiadomienia" : formatLastSeen(user.last_seen)}</span>
              )}
            </div>
          </div>
        </button>

        {userUnread > 0 && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <span className="bg-rose-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm">
              {userUnread}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Czysty render kafelka grupy
  const renderGroupItem = (group: any, isPinnedItem: boolean = false) => {
    const isPublic = group.typ === "publiczna";
    const groupUnread = messages.filter(
      (m: any) => String(m.grupa_id) === String(group.id) && !effectiveIds.includes(String(m.nadawca_id)) && !m.przeczytana
    ).length;

    return (
      <div
        key={group.id}
        className={`w-full p-2.5 rounded-2xl border flex items-center justify-between transition-all shadow-sm group ${
          isPinnedItem
            ? "bg-amber-50/70 border-amber-300 hover:border-amber-400"
            : "bg-white hover:bg-amber-50/50 border-slate-200"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            selectedGroupRef.current = group;
            setSelectedGroup(group);
            setChatInsideTab("messages");
          }}
          className="flex items-center gap-3 overflow-hidden flex-1 text-left cursor-pointer"
        >
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border overflow-hidden relative ${isPublic ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-slate-100 text-slate-900 border-slate-300"}`}>
            {renderGroupIcon(group.ikona, group.typ)}
            {isPinnedItem && (
              <span className="absolute bottom-0 right-0 text-[10px] leading-none bg-amber-400 rounded-full p-0.5 shadow">📌</span>
            )}
          </div>
          <div className="overflow-hidden">
            <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
              <span>{group.nazwa}</span>
              {isPinnedItem && <span className="text-[10px]" title="Przypięta grupa">📌</span>}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
              <span className={isPublic ? "text-amber-600 font-semibold" : "text-slate-500"}>
                {isPublic ? "Publiczna" : "Zamknięta"}
              </span>
              <span>•</span>
              <span>{Array.isArray(group.czlonkowie_ids) ? group.czlonkowie_ids.length : 0} osób</span>
            </div>
          </div>
        </button>

        {groupUnread > 0 && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <span className="bg-rose-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm">
              {groupUnread}
            </span>
          </div>
        )}
      </div>
    );
  };

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
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={`absolute bg-white border border-slate-200 rounded-[2rem] shadow-2xl w-[360px] sm:w-[410px] h-[560px] flex flex-col overflow-hidden animate-in fade-in ${
            isLeftSide ? "left-0" : "right-0"
          } ${isTopSide ? "top-16 slide-in-from-top-4" : "bottom-16 slide-in-from-bottom-4"}`}
        >
          {/* NAGŁÓWEK CZATU */}
          <div className="bg-slate-900 text-white px-3 py-2.5 flex items-center justify-between shadow-sm select-none relative">
            <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 mr-1">
              {selectedUser || selectedGroup ? (
                <>
                  <button
                    type="button"
                    onClick={handleExitCurrentChat}
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer shadow-md shrink-0 border border-amber-300"
                    title="Wróć do listy"
                  >
                    <span>◀</span> Wróć
                  </button>

                  {selectedGroup ? (
                    <>
                      <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs border border-amber-300 shrink-0 overflow-hidden">
                        {renderGroupIcon(selectedGroup.ikona, selectedGroup.typ)}
                      </div>
                      <div className="overflow-hidden min-w-0 flex-1">
                        <div className="font-bold text-xs truncate flex items-center gap-1 text-white">
                          <span className="truncate">{selectedGroup.nazwa}</span>
                          {isCurrentChatPinned && <span title="Przypięta grupa" className="text-[10px] shrink-0">📌</span>}
                        </div>
                        <div className="text-[9px] text-amber-400 font-medium truncate">
                          {selectedGroup.kategoria ? `${selectedGroup.kategoria} • ` : ""}
                          {selectedGroup.typ === "publiczna" ? "Publiczna" : selectedGroup.typ === "trening" ? "Trening" : "Zamknięta"} • {groupMembersList.length} os.
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shrink-0 border ${Number(selectedUser.id) === SYSTEM_ID ? "bg-amber-400 text-slate-950 border-amber-300" : "bg-sky-100 text-sky-950 border-amber-400"}`}>
                        {selectedUser.avatar ? (
                          <img src={selectedUser.avatar} alt={selectedUser.name} className="w-full h-full object-cover" />
                        ) : Number(selectedUser.id) === SYSTEM_ID ? (
                          <span>👑</span>
                        ) : (
                          <span>👤</span>
                        )}
                      </div>
                      <div className="overflow-hidden min-w-0 flex-1">
                        <div className="font-bold text-xs truncate flex items-center gap-1 text-white">
                          <span className="truncate">{selectedUser.name}</span>
                          {isCurrentChatPinned && <span title="Przypięty czat" className="text-[10px] shrink-0">📌</span>}
                        </div>
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

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Przycisk trzech kropek (Opcje) */}
              {(selectedUser || selectedGroup) && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowChatOptionsMenu(!showChatOptionsMenu);
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-sm transition-all cursor-pointer border ${
                      showChatOptionsMenu
                        ? "bg-amber-400 text-slate-950 border-amber-300"
                        : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700"
                    }`}
                    title="Więcej opcji"
                  >
                    •••
                  </button>

                  {/* Rozwijane menu opcji */}
                  {showChatOptionsMenu && (
                    <div className="absolute right-0 top-9 w-48 bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 space-y-0.5">
                      {/* Przypnij / Odepnij */}
                      <button
                        type="button"
                        onClick={(e) => {
                          if (selectedGroup) togglePinChat(selectedGroup.id, "group", e);
                          else if (selectedUser) togglePinChat(selectedUser.id, "direct", e);
                          setShowChatOptionsMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                      >
                        <span className="text-amber-400 text-sm">📌</span>
                        <span>{isCurrentChatPinned ? "Odepnij z góry" : "Przypnij na górze"}</span>
                      </button>

                      {/* Zarchiwizuj / Przywróć (Tylko Admin) */}
                      {isAdmin && (!selectedGroup || selectedGroup.typ !== "trening") && (
                        <button
                          type="button"
                          onClick={(e) => {
                            if (selectedGroup) toggleArchiveChat(selectedGroup.id, "group", e);
                            else if (selectedUser) toggleArchiveChat(selectedUser.id, "direct", e);
                            setShowChatOptionsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                        >
                          <span className="text-sm">📦</span>
                          <span>{isCurrentChatArchived ? "Przywróć z archiwum" : "Zarchiwizuj"}</span>
                        </button>
                      )}

                      {/* Usuń rozmowę 1:1 (dla klubowicza) */}
                      {selectedUser && !isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteDirectChat(selectedUser.id, e)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <span className="text-sm">🗑️</span>
                          <span>Usuń rozmowę</span>
                        </button>
                      )}

                      {/* Wycisz / Włącz powiadomienia (Grupa) */}
                      {selectedGroup && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleMuteGroup();
                            setShowChatOptionsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                        >
                          <span className="text-sm">{isCurrentGroupMuted ? "🔔" : "🔕"}</span>
                          <span>{isCurrentGroupMuted ? "Włącz powiadomienia" : "Wycisz grupę"}</span>
                        </button>
                      )}

                      {/* Edytuj grupę (Admin / Twórca) */}
                      {selectedGroup && (isAdmin || String(selectedGroup.tworca_id) === String(secondaryUserId || currentUserId)) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditGroupName(selectedGroup.nazwa);
                            setEditGroupCategory(selectedGroup.kategoria || "Ogólne");
                            setEditGroupIcon(selectedGroup.ikona || "🏋️‍♂️");
                            setShowEditGroupModal(true);
                            setShowChatOptionsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                        >
                          <span className="text-sm">✏️</span>
                          <span>Edytuj grupę</span>
                        </button>
                      )}

                      {/* Opuść grupę (Klubowicz w grupie publicznej) */}
                      {selectedGroup && selectedGroup.typ === "publiczna" && !isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleGroupMembership(selectedGroup, false);
                            setShowChatOptionsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <span className="text-sm">🚪</span>
                          <span>Opuść grupę</span>
                        </button>
                      )}

                      {/* Usuń grupę (Admin) */}
                      {selectedGroup && isAdmin && selectedGroup.typ !== "trening" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            handleDeleteGroup(selectedGroup.id, selectedGroup.nazwa, e);
                            setShowChatOptionsMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs font-semibold text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer border-t border-slate-800 mt-1"
                        >
                          <span className="text-sm">🗑️</span>
                          <span>Usuń grupę</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Zamknięcie okna czatu */}
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

          {/* PRZEŁĄCZNIK W AKTYWNEJ GRUPIE: TYLKO IKONY */}
          {selectedGroup && (
            <div className="bg-slate-900 border-t border-slate-800 px-3 py-1.5 flex items-center justify-center gap-3 text-base">
              <button
                type="button"
                onClick={() => setChatInsideTab("messages")}
                className={`w-10 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  chatInsideTab === "messages"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
                title="Wiadomości"
              >
                💬
              </button>
              <button
                type="button"
                onClick={() => setChatInsideTab("media")}
                className={`px-2.5 h-8 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  chatInsideTab === "media"
                    ? "bg-amber-400 text-slate-950 shadow-sm font-bold text-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
                }`}
                title="Zdjęcia"
              >
                <ImageIcon className="w-4 h-4" />
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${chatInsideTab === "media" ? "bg-slate-950 text-amber-400 font-black" : "bg-slate-800 text-slate-300"}`}>
                  {conversationImages.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setChatInsideTab("members")}
                className={`px-2.5 h-8 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  chatInsideTab === "members"
                    ? "bg-amber-400 text-slate-950 shadow-sm font-bold text-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
                }`}
                title="Uczestnicy"
              >
                <span>👥</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${chatInsideTab === "members" ? "bg-slate-950 text-amber-400 font-black" : "bg-slate-800 text-slate-300"}`}>
                  {groupMembersList.length}
                </span>
              </button>
            </div>
          )}

          {/* PRZEŁĄCZNIK W AKTYWNEJ ROZMOWIE 1-NA-1: TYLKO IKONY */}
          {selectedUser && (
            <div className="bg-slate-900 border-t border-slate-800 px-4 py-1.5 flex items-center justify-center gap-3 text-base">
              <button
                type="button"
                onClick={() => setChatInsideTab("messages")}
                className={`w-10 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  chatInsideTab === "messages"
                    ? "bg-amber-400 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
                title="Wiadomości"
              >
                💬
              </button>
              <button
                type="button"
                onClick={() => setChatInsideTab("media")}
                className={`px-2.5 h-8 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  chatInsideTab === "media"
                    ? "bg-amber-400 text-slate-950 shadow-sm font-bold text-xs"
                    : "text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
                }`}
                title="Zdjęcia"
              >
                <ImageIcon className="w-4 h-4" />
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${chatInsideTab === "media" ? "bg-slate-950 text-amber-400 font-black" : "bg-slate-800 text-slate-300"}`}>
                  {conversationImages.length}
                </span>
              </button>
            </div>
          )}

          {/* WIDOK GŁÓWNY (LISTA ROZMÓW / GRUP / TRENINGI) */}
          {!selectedUser && !selectedGroup ? (
            <div className="flex-1 flex flex-col overflow-hidden p-3.5 space-y-2.5 bg-slate-50/50">
              
              {/* ZAKŁADKI GŁÓWNE ORAZ PRZYCISKI ADMINISTRATORA */}
              <div className="flex items-center justify-between gap-1.5 border-b border-slate-200 pb-2">
                <div className="flex-1 grid grid-cols-3 gap-1 bg-slate-200/90 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => handleTabChange("direct")}
                    className={`py-1 rounded-lg text-[11px] font-bold transition-all relative flex items-center justify-center gap-1 ${
                      activeTab === "direct" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Prywatne</span>
                    {unreadDirectCount > 0 && (
                      <span className="bg-rose-500 text-white font-black text-[9px] px-1.5 py-0.2 rounded-full animate-pulse shadow-sm">
                        {unreadDirectCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange("groups")}
                    className={`py-1 rounded-lg text-[11px] font-bold transition-all relative flex items-center justify-center gap-1 ${
                      activeTab === "groups" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Grupy ({activeMyGroups.length})</span>
                    {unreadGroupsCount > 0 && (
                      <span className="bg-rose-500 text-white font-black text-[9px] px-1.5 py-0.2 rounded-full animate-pulse shadow-sm">
                        {unreadGroupsCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange("trainings")}
                    className={`py-1 rounded-lg text-[11px] font-bold transition-all relative flex items-center justify-center gap-1 ${
                      activeTab === "trainings" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>Treningi ({todayTrainingsList.length})</span>
                    {unreadTrainingsCount > 0 && (
                      <span className="bg-rose-500 text-white font-black text-[9px] px-1.5 py-0.2 rounded-full animate-pulse shadow-sm">
                        {unreadTrainingsCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* PRZYCISKI ADMINISTRATORA */}
                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowBroadcastModal(true)}
                      className="w-8 h-8 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-base flex items-center justify-center shadow-xs transition-all cursor-pointer border border-amber-300 active:scale-95"
                      title="Wiadomość do wszystkich (Broadcast)"
                    >
                      +
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenCreateGroupModal("Ogólne")}
                      className="w-8 h-8 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-black text-base flex items-center justify-center shadow-xs transition-all cursor-pointer border border-sky-400 active:scale-95"
                      title="Nowa grupa"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              {/* LISTA ROZMÓW 1-NA-1 ORAZ CZATÓW GRUPOWYCH W PRYWATNYCH */}
              {activeTab === "direct" && (
                <>
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">🔍</span>
                      <input
                        type="text"
                        placeholder="Szukaj: imię, nazwisko..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
                      />
                    </div>
                    {/* Przycisk tworzenia czatu grupowego dla każdego klubowicza */}
                    <button
                      type="button"
                      onClick={() => handleOpenCreateGroupModal("Czaty grupowe")}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 flex items-center gap-1"
                      title="Utwórz nowy czat grupowy ze znajomymi"
                    >
                      <span>👥+</span>
                      <span className="hidden sm:inline text-[11px]">Grupa</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                    {/* SEKCJA: CZATY GRUPOWE W ZAKŁADCE PRYWATNE */}
                    {directTabGroupChats.length > 0 && (
                      <div className="space-y-1 mb-2 bg-slate-100/60 p-2 rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between px-1 pb-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                            <span>👥</span> Czaty grupowe ({directTabGroupChats.length})
                          </span>
                          {directTabGroupChats.length > 3 && (
                            <button
                              type="button"
                              onClick={() => setIsDirectGroupsExpanded(!isDirectGroupsExpanded)}
                              className="text-[10px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer"
                            >
                              {isDirectGroupsExpanded ? "Zwiń ▲" : `Pokaż wszystkie (${directTabGroupChats.length}) ▼`}
                            </button>
                          )}
                        </div>

                        {(isDirectGroupsExpanded ? directTabGroupChats : directTabGroupChats.slice(0, 3)).map((group: any) =>
                          renderGroupItem(group, pinnedChatIds.includes(`group_${group.id}`))
                        )}
                      </div>
                    )}

                    {/* PRZYPIĘTE ROZMOWY 1-NA-1 */}
                    {pinnedDirectUsers.length > 0 && (
                      <div className="space-y-1 mb-2">
                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-700 px-1 flex items-center gap-1">
                          <span>📌</span> Przypięte rozmowy ({pinnedDirectUsers.length})
                        </div>
                        {pinnedDirectUsers.map((user: any) => renderDirectUserItem(user, true))}
                      </div>
                    )}

                    {/* POZOSTAŁE ROZMOWY 1-NA-1 */}
                    {regularDirectUsers.length > 0 && (
                      <div className="space-y-1">
                        {(pinnedDirectUsers.length > 0 || directTabGroupChats.length > 0) && (
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 mt-2">
                            Rozmowy prywatne
                          </div>
                        )}
                        {regularDirectUsers.map((user: any) => renderDirectUserItem(user, false))}
                      </div>
                    )}

                    {activeDirectUsers.length === 0 && archivedDirectUsers.length === 0 && directTabGroupChats.length === 0 && (
                      <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                        <div>Brak wyników wyszukiwania.</div>
                        <p className="text-[10px]">Wpisz nazwisko lub imię w wyszukiwarce powyżej.</p>
                      </div>
                    )}

                    {/* SEKCJA ARCHIWUM TYLKO DLA ADMINA */}
                    {isAdmin && archivedDirectUsers.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => setShowArchivedDirect(!showArchivedDirect)}
                          className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-800 py-1 px-1 transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <span>📦</span> Zarchiwizowane rozmowy ({archivedDirectUsers.length})
                          </span>
                          <span className="text-[10px]">{showArchivedDirect ? "▲ Ukryj" : "▼ Pokaż"}</span>
                        </button>

                        {showArchivedDirect && (
                          <div className="space-y-1.5 mt-2">
                            {archivedDirectUsers.map((user: any) => (
                              <div
                                key={user.id}
                                className="w-full p-2.5 rounded-2xl border bg-slate-100/70 border-slate-200 flex items-center justify-between shadow-xs"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    selectedUserRef.current = user;
                                    setSelectedUser(user);
                                    setChatInsideTab("messages");
                                  }}
                                  className="flex items-center gap-2.5 overflow-hidden flex-1 text-left cursor-pointer"
                                >
                                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                    {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : <span>👤</span>}
                                  </div>
                                  <div className="overflow-hidden">
                                    <div className="font-bold text-xs text-slate-700 truncate">{user.name}</div>
                                    <div className="text-[9px] text-slate-400">Zarchiwizowane</div>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => toggleArchiveChat(user.id, "direct", e)}
                                  className="text-[10px] font-bold text-slate-600 bg-white hover:bg-slate-200 px-2 py-1 rounded-lg border border-slate-200 shadow-xs cursor-pointer shrink-0"
                                  title="Przywróć do aktywnych"
                                >
                                  Przywróć ↩
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* LISTA GRUP: Moje grupy | Otwarte | Zamknięte */}
              {activeTab === "groups" && (
                <div className="flex-1 flex flex-col overflow-hidden space-y-2">
                  <div className="flex items-center justify-between gap-1.5 border-b border-slate-200 pb-1.5 text-xs font-bold">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setGroupFilterTab("my")}
                        className={`pb-1 px-1 transition-colors ${groupFilterTab === "my" ? "border-b-2 border-slate-900 text-slate-900 font-black" : "text-slate-400 hover:text-slate-600"}`}
                      >
                        Moje grupy ({activeMyGroups.length})
                      </button>
                      <button
                        onClick={() => setGroupFilterTab("public")}
                        className={`pb-1 px-1 transition-colors ${groupFilterTab === "public" ? "border-b-2 border-amber-500 text-amber-700 font-black" : "text-slate-400 hover:text-slate-600"}`}
                      >
                        Otwarte ({publicDiscoverGroups.length})
                      </button>
                      <button
                        onClick={() => setGroupFilterTab("closed")}
                        className={`pb-1 px-1 transition-colors ${groupFilterTab === "closed" ? "border-b-2 border-slate-700 text-slate-800 font-black" : "text-slate-400 hover:text-slate-600"}`}
                      >
                        Zamknięte ({closedDiscoverGroups.length})
                      </button>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowCategoryManagerModal(true)}
                        className="text-[10px] font-black text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-300 transition-all cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
                        title="Ustal kolejność i edytuj nazwy kategorii"
                      >
                        <span>⚙️</span> Kategorie
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {groupFilterTab === "my" && (
                      <>
                        {pinnedMyGroups.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-black uppercase tracking-wider text-amber-700 px-1 flex items-center gap-1">
                              <span>📌</span> Przypięte grupy ({pinnedMyGroups.length})
                            </div>
                            {pinnedMyGroups.map((group: any) => renderGroupItem(group, true))}
                          </div>
                        )}

                        {sortedCategoryNames.map((categoryName) => {
                          const groupList = myGroupsByCategory[categoryName] || [];
                          if (groupList.length === 0) return null;

                          return (
                            <div key={categoryName} className="space-y-1.5 pt-1">
                              <div className="text-[11px] font-bold text-slate-400 px-1 flex items-center justify-between">
                                <span>{categoryName}</span>
                              </div>
                              {groupList.map((group: any) => renderGroupItem(group, false))}
                            </div>
                          );
                        })}

                        {activeMyGroups.length === 0 && archivedMyGroups.length === 0 && (
                          <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                            <div>Nie należysz jeszcze do żadnej grupy.</div>
                            <p className="text-[10px]">Sprawdź zakładkę "Otwarte" lub "Zamknięte".</p>
                          </div>
                        )}

                        {/* ARCHIWUM GRUP TYLKO DLA ADMINA */}
                        {isAdmin && archivedMyGroups.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-200">
                            <button
                              type="button"
                              onClick={() => setShowArchivedGroups(!showArchivedGroups)}
                              className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-800 py-1 px-1 transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <span>📦</span> Zarchiwizowane grupy ({archivedMyGroups.length})
                              </span>
                              <span className="text-[10px]">{showArchivedGroups ? "▲ Ukryj" : "▼ Pokaż"}</span>
                            </button>

                            {showArchivedGroups && (
                              <div className="space-y-1.5 mt-2">
                                {archivedMyGroups.map((group: any) => (
                                  <div
                                    key={group.id}
                                    className="w-full p-2.5 rounded-2xl border bg-slate-100/70 border-slate-200 flex items-center justify-between shadow-xs"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        selectedGroupRef.current = group;
                                        setSelectedGroup(group);
                                        setChatInsideTab("messages");
                                      }}
                                      className="flex items-center gap-2.5 overflow-hidden flex-1 text-left cursor-pointer"
                                    >
                                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                        {renderGroupIcon(group.ikona, group.typ)}
                                      </div>
                                      <div className="overflow-hidden">
                                        <div className="font-bold text-xs text-slate-700 truncate">{group.nazwa}</div>
                                        <div className="text-[9px] text-slate-400">Zarchiwizowane</div>
                                      </div>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => toggleArchiveChat(group.id, "group", e)}
                                      className="text-[10px] font-bold text-slate-600 bg-white hover:bg-slate-200 px-2 py-1 rounded-lg border border-slate-200 shadow-xs cursor-pointer shrink-0"
                                      title="Przywróć grupę"
                                    >
                                      Przywróć ↩
                                    </button>
                                    {group.typ !== "trening" && (
                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteGroup(group.id, group.nazwa, e)}
                                        className="text-slate-400 hover:text-rose-600 p-1 text-xs transition-colors cursor-pointer rounded-lg"
                                        title="Usuń grupę na stałe"
                                      >
                                        🗑️
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {groupFilterTab === "public" && (
                      <>
                        {publicDiscoverGroups.map((group: any) => (
                          <div
                            key={group.id}
                            className="w-full p-2.5 rounded-2xl border bg-white border-amber-200 flex items-center justify-between shadow-sm gap-2"
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden min-w-0 flex-1">
                              <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                                {renderGroupIcon(group.ikona, group.typ)}
                              </div>
                              <div className="overflow-hidden min-w-0 flex-1">
                                <div className="font-bold text-xs text-slate-900 truncate">{group.nazwa}</div>
                                <div className="text-[10px] text-amber-700 truncate">
                                  {group.kategoria ? `${group.kategoria} • ` : ""}
                                  {Array.isArray(group.czlonkowie_ids) ? group.czlonkowie_ids.length : 0} uczestników
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleToggleGroupMembership(group, true)}
                              className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-[10px] px-3 py-1.5 rounded-xl shadow-sm transition-all shrink-0 cursor-pointer whitespace-nowrap"
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

                    {/* ZOPTYMALIZOWANY UKŁAD ZAKŁADKI ZAMKNIĘTE */}
                    {groupFilterTab === "closed" && (
                      <>
                        {closedDiscoverGroups.map((group: any) => {
                          const myIdStr = String(secondaryUserId || currentUserId);
                          const pendingList = Array.isArray(group.prosby_ids) ? group.prosby_ids.map(String) : [];
                          const hasRequested = pendingList.includes(myIdStr);

                          return (
                            <div
                              key={group.id}
                              className="w-full p-2.5 rounded-2xl border bg-white border-slate-200 flex items-center justify-between shadow-sm gap-2"
                            >
                              <div className="flex items-center gap-2.5 overflow-hidden min-w-0 flex-1">
                                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-800 border border-slate-300 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                                  {renderGroupIcon(group.ikona, group.typ)}
                                </div>
                                <div className="overflow-hidden min-w-0 flex-1">
                                  <div className="font-bold text-xs text-slate-900 truncate flex items-center gap-1">
                                    <span className="shrink-0">🔒</span>
                                    <span className="truncate">{group.nazwa}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {group.kategoria ? `${group.kategoria} • ` : ""}Zamknięta • {Array.isArray(group.czlonkowie_ids) ? group.czlonkowie_ids.length : 0} osób
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {isAdmin ? (
                                  <button
                                    onClick={() => {
                                      selectedGroupRef.current = group;
                                      setSelectedGroup(group);
                                      setChatInsideTab("messages");
                                    }}
                                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] px-3 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
                                  >
                                    Zarządzaj
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => !hasRequested && handleRequestJoinGroup(group)}
                                    disabled={hasRequested}
                                    className={`font-black text-[10px] px-3 py-1.5 rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap ${
                                      hasRequested
                                        ? "bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed"
                                        : "bg-slate-900 hover:bg-slate-800 text-white"
                                    }`}
                                  >
                                    {hasRequested ? "Oczekuje ⏳" : "Poproś o dołączenie"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {closedDiscoverGroups.length === 0 && (
                          <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                            <div>Brak innych grup zamkniętych.</div>
                            <p className="text-[10px]">Wszystkie grupy zamknięte są w Twojej liście.</p>
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
                  {todayTrainingsList.map((training: any) => {
                    const matchedGroup = groups.find((g: any) => g.nazwa?.includes(training.title) && g.nazwa?.includes(training.start));
                    const trainingUnread = matchedGroup
                      ? messages.filter((m: any) => String(m.grupa_id) === String(matchedGroup.id) && !effectiveIds.includes(String(m.nadawca_id)) && !m.przeczytana).length
                      : 0;

                    return (
                      <button
                        key={training.id}
                        onClick={async () => {
                          const trainingGroup = await getOrCreateTrainingGroup(training);
                          if (trainingGroup) {
                            selectedGroupRef.current = trainingGroup;
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

                        <div className="flex items-center gap-2">
                          {trainingUnread > 0 && (
                            <span className="bg-rose-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full shadow-sm shrink-0">
                              {trainingUnread}
                            </span>
                          )}
                          <span className="text-slate-400 text-xs font-bold group-hover:text-slate-900 transition-colors">→</span>
                        </div>
                      </button>
                    );
                  })}

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
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-amber-500" /> Udostępnione Zdjęcia ({conversationImages.length})
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
                    <div className="w-10 h-10 mx-auto rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>Brak zdjęć w tej rozmowie.</div>
                    <p className="text-[10px]">Zdjęcia przesłane przez uczestników pojawią się tutaj automatycznie.</p>
                  </div>
                )}
              </div>
            </div>
          ) : chatInsideTab === "members" ? (
            /* WIDOK LISTY UCZESTNIKÓW W GRUPIE / TRENINGU */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 p-3 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Uczestnicy grupy ({groupMembersList.length})
                </span>
                {(isAdmin || String(selectedGroup?.tworca_id) === String(secondaryUserId || currentUserId)) && selectedGroup?.typ !== "trening" && (
                  <button
                    onClick={() => {
                      setSelectedInviteMembers([]);
                      setShowInviteModal(true);
                    }}
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    + Zaproś klubowicza
                  </button>
                )}
              </div>

              {/* PROŚBY O DOŁĄCZENIE (DLA ADMINA) */}
              {isAdmin && groupPendingRequestsList.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-2.5 space-y-2 shadow-sm">
                  <div className="text-[11px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>⏳</span> Oczekujące prośby ({groupPendingRequestsList.length})
                  </div>
                  <div className="space-y-1.5">
                    {groupPendingRequestsList.map((pendingUser: any) => (
                      <div key={pendingUser.id} className="flex items-center justify-between bg-white p-2 rounded-xl border border-amber-200 text-xs">
                        <span className="font-bold text-slate-900 truncate max-w-[150px]">{pendingUser.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleAcceptJoinRequest(selectedGroup, pendingUser.id)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-lg cursor-pointer"
                          >
                            Akceptuj
                          </button>
                          <button
                            onClick={() => handleRejectJoinRequest(selectedGroup, pendingUser.id)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded-lg cursor-pointer"
                          >
                            Odrzuć
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LISTA AKTYWNYCH UCZESTNIKÓW */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {groupMembersList.map((member: any) => {
                  const isSys = Number(member.id) === SYSTEM_ID;
                  const isMbrAdmin = ADMIN_EMAILS.includes(member.email) || Number(member.id) === 999999999;
                  const isMe = effectiveIds.includes(String(member.id));
                  const canManage = (isAdmin || String(selectedGroup?.tworca_id) === String(secondaryUserId || currentUserId)) && !isMbrAdmin && !isSys && !isMe;

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

                      {canManage && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleRemoveMemberFromGroup(member.id)}
                            className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg cursor-pointer"
                            title="Usuń z grupy"
                          >
                            Usuń
                          </button>
                          <button
                            onClick={() => handleBanUserFromGroup(member.id)}
                            className="text-[10px] font-black text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded-lg cursor-pointer"
                            title="Zbanuj w grupie"
                          >
                            Zbanuj
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {isAdmin && groupBannedList.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 space-y-1.5">
                    <div className="text-[10px] font-black text-rose-600 uppercase tracking-wider">
                      🚫 Zbanowani w tej grupie ({groupBannedList.length})
                    </div>
                    {groupBannedList.map((bannedUser: any) => (
                      <div
                        key={bannedUser.id}
                        className="w-full p-2 rounded-xl border bg-rose-50/50 border-rose-200 flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-800 font-semibold truncate">{bannedUser.name}</span>
                        <button
                          onClick={() => handleUnbanUserFromGroup(bannedUser.id)}
                          className="bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 font-bold text-[10px] px-2 py-0.5 rounded-lg cursor-pointer"
                        >
                          Odbanuj
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* WIDOK AKTYWNEJ ROZMOWY (WIADOMOŚCI) */
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
              
              {/* Baner archiwalny (Tylko Admin) */}
              {isAdmin && isCurrentChatArchived && (
                <div className="bg-slate-200/90 border-b border-slate-300 px-3 py-1.5 flex items-center justify-between text-[11px] font-medium text-slate-700 shadow-inner">
                  <div className="flex items-center gap-1.5 truncate">
                    <span>📦</span>
                    <span>Ta rozmowa jest zarchiwizowana.</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      if (selectedGroup) toggleArchiveChat(selectedGroup.id, "group", e);
                      else if (selectedUser) toggleArchiveChat(selectedUser.id, "direct", e);
                    }}
                    className="font-bold text-slate-900 bg-white hover:bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-300 text-[10px] shadow-2xs shrink-0 cursor-pointer"
                  >
                    Przywróć ↩
                  </button>
                </div>
              )}

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
                  const isSpecial = Number(msg.nadawca_id) === SYSTEM_ID || msg.nadawca_id === null || msg.tresc?.includes("🎖️") || msg.tresc?.includes("⚔️") || msg.tresc?.includes("🎂") || msg.tresc?.includes("Bazy Wiedzy");

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
                      <MessageItem msg={msg} isMe={isMe} />

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
                        ? "Napisz pierwszą wiadomość do wszystkich uczestników tej grupy."
                        : Number(selectedUser?.id) === SYSTEM_ID
                        ? "Tutaj pojawiać się będą oficjalne powiadomienia o odznakach, suplementach, urodzinach i wydarzeniach."
                        : "Napisz pierwszą wiadomość do tego klubowicza."}
                    </p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* PODGLĄD ODPOWIADANIA NA WIADOMOŚĆ (SWIPE-TO-REPLY) */}
              {replyingToMessage && (
                <div className="px-3.5 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2 select-none">
                  <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 mr-2">
                    <span className="text-amber-400 text-sm font-bold shrink-0">↩</span>
                    <div className="overflow-hidden min-w-0">
                      <div className="text-[11px] font-bold text-amber-400 truncate">
                        Odpowiadanie: {replyingToMessage.nadawca_nazwa || "Klubowicz"}
                      </div>
                      <div className="text-[10px] text-slate-300 truncate opacity-90">
                        {replyingToMessage.tresc || (replyingToMessage.attachment_url ? "📎 Załącznik" : "Wiadomość")}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingToMessage(null)}
                    className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer shrink-0 transition-colors"
                    title="Anuluj odpowiadanie"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* PODGLĄD ZAŁĄCZNIKA */}
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
                    replyingToMessage
                      ? `Napisz odpowiedź do: ${replyingToMessage.nadawca_nazwa}...`
                      : selectedGroup
                      ? "Napisz na czacie grupowym..."
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

          {/* MODAL ZARZĄDZANIA KATEGORIAMI */}
          {showCategoryManagerModal && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <span>⚙️</span> Zarządzanie Kategoriami
                  </div>
                  <button onClick={() => setShowCategoryManagerModal(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">
                    ✕
                  </button>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Nowa nazwa kategorii..."
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewCategory}
                    disabled={!newCategoryInput.trim()}
                    className="bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    + Dodaj
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  {categoriesOrder.map((catName, index) => {
                    const isEditing = editingCategoryOldName === catName;

                    return (
                      <div
                        key={catName}
                        className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-xs shadow-2xs gap-1.5"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="text"
                              value={editingCategoryNewName}
                              onChange={(e) => setEditingCategoryNewName(e.target.value)}
                              className="flex-1 bg-slate-50 border border-amber-400 rounded-lg px-2 py-0.5 text-xs text-slate-900 font-bold focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleRenameCategory(catName, editingCategoryNewName)}
                              className="text-emerald-600 hover:text-emerald-700 font-black p-1 text-xs cursor-pointer"
                              title="Zapisz"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategoryOldName(null)}
                              className="text-slate-400 hover:text-slate-600 font-bold p-1 text-xs cursor-pointer"
                              title="Anuluj"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="font-bold text-slate-800 truncate flex-1">{catName}</span>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategoryOldName(catName);
                                  setEditingCategoryNewName(catName);
                                }}
                                className="text-slate-400 hover:text-slate-700 p-1 text-xs cursor-pointer"
                                title="Zmień nazwę kategorii"
                              >
                                ✏️
                              </button>

                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveCategory(index, "up")}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 font-bold text-[10px] flex items-center justify-center cursor-pointer"
                                title="Przesuń w górę"
                              >
                                ▲
                              </button>

                              <button
                                type="button"
                                disabled={index === categoriesOrder.length - 1}
                                onClick={() => handleMoveCategory(index, "down")}
                                className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 font-bold text-[10px] flex items-center justify-center cursor-pointer"
                                title="Przesuń w dół"
                              >
                                ▼
                              </button>

                              {catName !== "Ogólne" && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategoryFromList(catName)}
                                  className="text-slate-300 hover:text-rose-600 p-1 text-xs cursor-pointer"
                                  title="Usuń z listy"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowCategoryManagerModal(false)}
                    className="w-full py-2 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 shadow-md cursor-pointer"
                  >
                    Gotowe
                  </button>
                </div>
              </div>
            </div>
          )}

          {showInviteModal && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <span>👥</span> Zaproś do grupy
                  </div>
                  <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Filtruj klubowiczów..."
                    value={inviteSearchQuery}
                    onChange={(e) => setInviteSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                  />

                  <div className="max-h-48 overflow-y-auto space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    {klienci
                      .filter((k) => {
                        if (Number(k.id) === SYSTEM_ID) return false;
                        const isMember = groupMemberIds.includes(String(k.id));
                        if (isMember) return false;
                        const q = inviteSearchQuery.trim().toLowerCase();
                        if (!q) return true;
                        return k.name?.toLowerCase().includes(q) || k.email?.toLowerCase().includes(q);
                      })
                      .map((user) => {
                        const isSelected = selectedInviteMembers.includes(user.id);
                        return (
                          <label
                            key={user.id}
                            className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer text-xs select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedInviteMembers((prev) =>
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

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                    >
                      Anuluj
                    </button>
                    <button
                      type="button"
                      onClick={handleAddMembersToGroup}
                      disabled={selectedInviteMembers.length === 0}
                      className="flex-1 py-2 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      Dodaj ({selectedInviteMembers.length})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showEditGroupModal && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <span>✏️</span> Edytuj Grupę
                  </div>
                  <button onClick={() => setShowEditGroupModal(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">
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
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">Kategoria grupy:</label>
                    <div className="space-y-1.5">
                      <select
                        value={categoriesOrder.includes(editGroupCategory) ? editGroupCategory : "Inna"}
                        onChange={(e) => {
                          if (e.target.value !== "Inna") {
                            setEditGroupCategory(e.target.value);
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                      >
                        {categoriesOrder.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="Czaty grupowe">Czaty grupowe (Prywatne)</option>
                        <option value="Inna">Wpisz własną kategorię...</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Nazwa kategorii (np. Dieta, Wyjazdy)..."
                        value={editGroupCategory}
                        onChange={(e) => setEditGroupCategory(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 mb-1 block">Ikona grupy (Emoji lub własny obrazek):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editGroupIcon}
                        onChange={(e) => setEditGroupIcon(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                        placeholder="np. 🏋️‍♂️ lub wgraj plik"
                        required
                      />
                      <label className="w-9 h-9 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 flex items-center justify-center text-base cursor-pointer shrink-0 shadow-sm" title="Wgraj własny obrazek">
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
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      disabled={!editGroupName.trim()}
                      className="flex-1 py-2 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      Zapisz zmiany
                    </button>
                  </div>

                  {isAdmin && selectedGroup?.typ !== "trening" && (
                    <div className="pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteGroup(selectedGroup.id, selectedGroup.nazwa, e)}
                        className="w-full py-2 rounded-xl text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>🗑️</span> Usuń grupę bezpowrotnie
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {showBroadcastModal && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <span>📢</span> Wiadomość do Wszystkich
                  </div>
                  <button onClick={() => setShowBroadcastModal(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">
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
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingBroadcast}
                      className="flex-1 py-2 rounded-xl text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-500 shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {isSendingBroadcast ? "Wysyłanie..." : "Wyślij wszystkim"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showCreateGroupModal && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="font-black text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <span>👥</span> Nowy Czat Grupowy
                  </div>
                  <button onClick={() => setShowCreateGroupModal(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateGroup} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nazwa grupy (np. Trening Siłowy / Znajomi)..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                    required
                  />

                  {isAdmin && (
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 mb-1 block">Kategoria / Grupowanie:</label>
                      <div className="space-y-1.5">
                        <select
                          value={categoriesOrder.includes(newGroupCategory) ? newGroupCategory : "Inna"}
                          onChange={(e) => {
                            if (e.target.value !== "Inna") {
                              setNewGroupCategory(e.target.value);
                            }
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                        >
                          {categoriesOrder.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          <option value="Czaty grupowe">Czaty grupowe (Prywatne)</option>
                          <option value="Inna">Wpisz własną kategorię...</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Nazwa kategorii..."
                          value={newGroupCategory}
                          onChange={(e) => setNewGroupCategory(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                          required
                        />
                      </div>
                    </div>
                  )}

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
                      <label className="w-9 h-9 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 flex items-center justify-center text-base cursor-pointer shrink-0 shadow-sm" title="Wgraj własny obrazek">
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

                  {isAdmin && (
                    <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setNewGroupType("zamknieta")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${newGroupType === "zamknieta" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                      >
                        🔒 Zamknięta
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewGroupType("publiczna")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${newGroupType === "publiczna" ? "bg-amber-400 text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                      >
                        🌐 Publiczna
                      </button>
                    </div>
                  )}

                  <div>
                    <div className="text-[11px] font-bold text-slate-700 mb-1">Wybierz uczestników grupy:</div>
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

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateGroupModal(false)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      disabled={!newGroupName.trim() || isCreatingGroup}
                      className="flex-1 py-2 rounded-xl text-xs font-black text-white bg-slate-900 hover:bg-slate-800 shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {isCreatingGroup ? "Tworzenie..." : "Stwórz grupę"}
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

        {totalUnreadCount > 0 && !isOpen && (
          <span className="pointer-events-none absolute -top-1 -right-1 bg-rose-500 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md border-2 border-white animate-pulse">
            {totalUnreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
