"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../raporty/klienci/supabase";

export type PaymentStatus = "nieoplacone" | "zadatek" | "calosc";

interface Uczestnik {
  id?: string | number;
  imie: string;
  nazwisko: string;
  email?: string;
  status_platnosci?: PaymentStatus;
}

interface KlientBaza {
  id: string | number;
  imie: string;
  nazwisko: string;
  email?: string;
}

interface Wydarzenie {
  id: number;
  tytul: string;
  data_od: string;
  data_do: string;
  cena: string;
  zadatek: string;
  zadatek_do?: string | null;
  reszta_do?: string | null;
  opis: string;
  grafika_url: string | null;
  status: string;
  uczestnicy?: Uczestnik[];
  
  // Moduły strefy uczestnika sterowane checkboxami
  pokaz_whatsapp?: boolean;
  whatsapp_url?: string | null;
  
  pokaz_zbiorka?: boolean;
  zbiorka?: string | null;
  google_maps_url?: string | null;
  
  pokaz_ekwipunek?: boolean;
  ekwipunek?: string | null;
  
  pokaz_opis_strefy?: boolean;
  strefa_opis?: string | null;
  
  pokaz_plan_grafika?: boolean;
  plan_grafiki?: string[];

  // Moduł: Koszulki treningowe
  pokaz_koszulki?: boolean;
  koszulki_cena?: string | null;
  koszulki_termin?: string | null;
  koszulki_opis?: string | null;
  koszulki_grafika_glowna?: string | null;
  koszulki_grafiki?: string[];
}

export const parsePrice = (val?: string | null): number => {
  if (!val) return 0;
  const cleaned = val.replace(/[^0-9.,]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
};

export const obliczReszteKwoty = (cena?: string | null, zadatek?: string | null): string => {
  const c = parsePrice(cena);
  const z = parsePrice(zadatek);
  if (c <= 0) return "0 PLN";
  const roznica = Math.max(0, c - z);
  return `${roznica} PLN`;
};

export default function WydarzeniaPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [wydarzenia, setWydarzenia] = useState<Wydarzenie[]>([]);
  const [klienciBaza, setKlienciBaza] = useState<KlientBaza[]>([]);
  const [hasUnreadEvents, setHasUnreadEvents] = useState(false);

  // Stany dla Modala Podglądu Klubowicza
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Wydarzenie | null>(null);

  // Stan dla pełnoekranowego powiększenia obrazka (Lightbox)
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Stany dla Modala Edycji / Dodawania Admina
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [form, setForm] = useState({
    tytul: "",
    data_od: new Date().toISOString().split("T")[0],
    data_do: new Date().toISOString().split("T")[0],
    cena: "",
    zadatek: "",
    zadatek_do: "",
    reszta_do: "",
    opis: "",
    grafika_url: "" as string | null,
    status: "wkrotce",
    uczestnicy: [] as Uczestnik[],
    
    // Checkboxy i pola modułów
    pokaz_whatsapp: false,
    whatsapp_url: "",
    
    pokaz_zbiorka: false,
    zbiorka: "",
    google_maps_url: "",
    
    pokaz_ekwipunek: false,
    ekwipunek: "",
    
    pokaz_opis_strefy: false,
    strefa_opis: "",
    
    pokaz_plan_grafika: false,
    plan_grafiki: [] as string[],

    // Koszulki treningowe
    pokaz_koszulki: false,
    koszulki_cena: "",
    koszulki_termin: "",
    koszulki_opis: "",
    koszulki_grafika_glowna: "" as string | null,
    koszulki_grafiki: [] as string[]
  });

  const [klientSearch, setKlientSearch] = useState("");
  const [manualImie, setManualImie] = useState("");
  const [manualNazwisko, setManualNazwisko] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const planFileInputRef = useRef<HTMLInputElement>(null);
  const koszulkaMainFileInputRef = useRef<HTMLInputElement>(null);
  const koszulkaExtraFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewImage) {
          setPreviewImage(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewImage]);

  const dzisiajStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const checkUnreadEvents = (events: Wydarzenie[]) => {
    if (typeof window === "undefined") return;
    const futureEvents = events.filter(w => {
      const dataKoniec = w.data_do || w.data_od;
      return dataKoniec >= dzisiajStr;
    });

    const hasAnyUnread = futureEvents.some(
      w => !localStorage.getItem(`seen_event_${w.id}`)
    );
    setHasUnreadEvents(hasAnyUnread);
  };

  const markEventAsSeen = (eventId: number) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`seen_event_${eventId}`, "true");
    checkUnreadEvents(wydarzenia);
  };

  const isEventUnread = (eventId: number) => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(`seen_event_${eventId}`);
  };

  // Automatyczny system powiadomień wpisujący do czat_wiadomosci z konta nadawca_id: 5000 ("Forma Marzeń")
  const sprawdzIwyslijPrzypomnieniaPlatnosci = async (events: Wydarzenie[], bazaKlubowiczow: KlientBaza[]) => {
    const dzisiaj = new Date();
    dzisiaj.setHours(0, 0, 0, 0);

    for (const w of events) {
      if (!w.reszta_do || !Array.isArray(w.uczestnicy) || w.uczestnicy.length === 0) continue;

      const terminReszty = new Date(w.reszta_do);
      terminReszty.setHours(0, 0, 0, 0);

      const diffTime = terminReszty.getTime() - dzisiaj.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // Sprawdzenie czy przypada termin 5 dni lub 2 dni przed końcem
      if (diffDays === 5 || diffDays === 2) {
        const nieoplaceni = w.uczestnicy.filter(u => u.status_platnosci !== "calosc");
        const kwotaReszty = obliczReszteKwoty(w.cena, w.zadatek);
        const formatTerminu = formatDatePL(w.reszta_do);

        for (const u of nieoplaceni) {
          let recipientId: number | null = u.id ? Number(u.id) : null;
          
          if (!recipientId && u.email) {
            const foundClient = bazaKlubowiczow.find(k => k.email && k.email.toLowerCase() === u.email?.toLowerCase());
            if (foundClient) {
              recipientId = Number(foundClient.id);
            }
          }

          if (!recipientId) continue;

          const tresc = diffDays === 5
            ? `⚠️ Przypomnienie o płatności: Zbliża się termin uregulowania reszty kwoty (${kwotaReszty}) za wydarzenie "${w.tytul}". Ostateczny termin mija za 5 dni (${formatTerminu}). Prosimy o wpłatę.`
            : `🚨 PILNE Przypomnienie: Za 2 dni (${formatTerminu}) upływa ostateczny termin dopłaty reszty kwoty (${kwotaReszty}) za udział w wydarzeniu "${w.tytul}".`;

          try {
            const { data: existing } = await supabase
              .from("czat_wiadomosci")
              .select("id")
              .eq("nadawca_id", 5000)
              .eq("odbiorca_id", recipientId)
              .ilike("tresc", `%${w.tytul}%`)
              .gte("created_at", `${dzisiajStr}T00:00:00.000Z`)
              .limit(1);

            if (!existing || existing.length === 0) {
              await supabase.from("czat_wiadomosci").insert([
                {
                  nadawca_id: 5000,
                  nadawca_nazwa: "Forma Marzeń",
                  odbiorca_id: recipientId,
                  tresc: tresc,
                  przeczytana: false,
                  created_at: new Date().toISOString()
                }
              ]);
            }
          } catch (notifErr) {
            console.error("Błąd podczas wysyłania wiadomości w czacie:", notifErr);
          }
        }
      }
    }
  };

  const fetchData = async () => {
    setIsLoading(true);

    try {
      const [sessionRes, wydarzeniaRes, klienciRes] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from("wydarzenia").select("*").order("data_od", { ascending: true }),
        supabase.from("klienci").select('id, "Imię", "Nazwisko", "E-mail"')
      ]);

      const email = sessionRes.data.session?.user?.email || "";
      setCurrentUserEmail(email);
      if (email === "maciejklaput@gmail.com" || email === "maciejklaput@icloud.com") {
        setIsAdmin(true);
      }

      let mappedKlienci: KlientBaza[] = [];
      if (!klienciRes.error && klienciRes.data) {
        mappedKlienci = klienciRes.data.map((k: any) => ({
          id: k.id,
          imie: (k["Imię"] || k.imie || "").trim(),
          nazwisko: (k["Nazwisko"] || k.nazwisko || "").trim(),
          email: (k["E-mail"] || k.email || "").trim()
        }));
        setKlienciBaza(mappedKlienci);
      }

      if (!wydarzeniaRes.error && wydarzeniaRes.data) {
        setWydarzenia(wydarzeniaRes.data);
        checkUnreadEvents(wydarzeniaRes.data);
        if (selectedEvent) {
          const refreshed = wydarzeniaRes.data.find((w: Wydarzenie) => w.id === selectedEvent.id);
          if (refreshed) setSelectedEvent(refreshed);
        }
        sprawdzIwyslijPrzypomnieniaPlatnosci(wydarzeniaRes.data, mappedKlienci);
      }
    } catch (err) {
      console.error("Błąd podczas pobierania danych:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const przeszle = useMemo(() => {
    return wydarzenia.filter(w => {
      const dataKoniec = w.data_do || w.data_od;
      return dataKoniec < dzisiajStr;
    }).sort((a, b) => new Date(b.data_od).getTime() - new Date(a.data_od).getTime());
  }, [wydarzenia, dzisiajStr]);

  const przyszle = useMemo(() => {
    return wydarzenia.filter(w => {
      const dataKoniec = w.data_do || w.data_od;
      return dataKoniec >= dzisiajStr;
    });
  }, [wydarzenia, dzisiajStr]);

  const wkrotce = useMemo(() => {
    return przyszle
      .filter(w => w.status !== "planowane")
      .sort((a, b) => new Date(a.data_od).getTime() - new Date(b.data_od).getTime());
  }, [przyszle]);

  const planowane = useMemo(() => {
    return przyszle
      .filter(w => w.status === "planowane")
      .sort((a, b) => new Date(a.data_od).getTime() - new Date(b.data_od).getTime());
  }, [przyszle]);

  const isZapisyZamkniete = (w: Wydarzenie) => {
    if (!w.zadatek_do) return false;
    return w.zadatek_do < dzisiajStr;
  };

  const isUserZapisany = (w: Wydarzenie | null) => {
    if (!w || !w.uczestnicy) return false;
    if (isAdmin) return true;
    if (!currentUserEmail) return false;
    return w.uczestnicy.some(u => u.email && u.email.toLowerCase() === currentUserEmail.toLowerCase());
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({ 
      tytul: "", 
      data_od: dzisiajStr, 
      data_do: dzisiajStr, 
      cena: "", 
      zadatek: "", 
      zadatek_do: "", 
      reszta_do: "",
      opis: "", 
      grafika_url: null, 
      status: "wkrotce", 
      uczestnicy: [], 
      pokaz_whatsapp: false, 
      whatsapp_url: "", 
      pokaz_zbiorka: false, 
      zbiorka: "", 
      google_maps_url: "", 
      pokaz_ekwipunek: false, 
      ekwipunek: "", 
      pokaz_opis_strefy: false, 
      strefa_opis: "", 
      pokaz_plan_grafika: false, 
      plan_grafiki: [], 
      pokaz_koszulki: false, 
      koszulki_cena: "", 
      koszulki_termin: "", 
      koszulki_opis: "", 
      koszulki_grafika_glowna: null, 
      koszulki_grafiki: [] 
    });
    setKlientSearch("");
    setIsAdminModalOpen(true);
  };

  const handleOpenEdit = (w: Wydarzenie, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(w.id);
    setForm({
      tytul: w.tytul || "",
      data_od: w.data_od || dzisiajStr,
      data_do: w.data_do || w.data_od || dzisiajStr,
      cena: w.cena || "",
      zadatek: w.zadatek || "",
      zadatek_do: w.zadatek_do || "",
      reszta_do: w.reszta_do || "",
      opis: w.opis || "",
      grafika_url: w.grafika_url || null,
      status: w.status || "wkrotce",
      uczestnicy: Array.isArray(w.uczestnicy) ? w.uczestnicy.map(u => ({ ...u, status_platnosci: u.status_platnosci || "nieoplacone" })) : [],
      
      pokaz_whatsapp: !!w.pokaz_whatsapp,
      whatsapp_url: w.whatsapp_url || "",
      
      pokaz_zbiorka: !!w.pokaz_zbiorka,
      zbiorka: w.zbiorka || "",
      google_maps_url: w.google_maps_url || "",
      
      pokaz_ekwipunek: !!w.pokaz_ekwipunek,
      ekwipunek: w.ekwipunek || "",
      
      pokaz_opis_strefy: !!w.pokaz_opis_strefy,
      strefa_opis: w.strefa_opis || "",
      
      pokaz_plan_grafika: !!w.pokaz_plan_grafika,
      plan_grafiki: Array.isArray(w.plan_grafiki) ? w.plan_grafiki : [],

      pokaz_koszulki: !!w.pokaz_koszulki,
      koszulki_cena: w.koszulki_cena || "",
      koszulki_termin: w.koszulki_termin || "",
      koszulki_opis: w.koszulki_opis || "",
      koszulki_grafika_glowna: w.koszulki_grafika_glowna || null,
      koszulki_grafiki: Array.isArray(w.koszulki_grafiki) ? w.koszulki_grafiki : []
    });
    setKlientSearch("");
    setIsAdminModalOpen(true);
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Czy na pewno chcesz usunąć to wydarzenie? Tej operacji nie można cofnąć.")) return;

    setWydarzenia(prev => prev.filter(w => w.id !== id));
    if (selectedEvent?.id === id) {
      setSelectedEvent(null);
      setIsViewModalOpen(false);
    }

    await supabase.from("wydarzenia").delete().eq("id", id);
  };

  const handleImageCompress = (file: File, callback: (compressed: string) => void) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1400;
        const MAX_HEIGHT = 1400;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d"); 
        ctx?.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.8);
        callback(compressed);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageCompress(file, (compressed) => setForm(prev => ({ ...prev, grafika_url: compressed })));
    }
  };

  const handlePlanImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      handleImageCompress(file, (compressed) => {
        setForm(prev => ({
          ...prev,
          plan_grafiki: [...prev.plan_grafiki, compressed]
        }));
      });
    });
  };

  const handleRemovePlanImage = (indexToRemove: number) => {
    setForm(prev => ({
      ...prev,
      plan_grafiki: prev.plan_grafiki.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleKoszulkaMainUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageCompress(file, (compressed) => setForm(prev => ({ ...prev, koszulki_grafika_glowna: compressed })));
    }
  };

  const handleKoszulkaExtraUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      handleImageCompress(file, (compressed) => {
        setForm(prev => ({
          ...prev,
          koszulki_grafiki: [...prev.koszulki_grafiki, compressed]
        }));
      });
    });
  };

  const handleRemoveKoszulkaExtraImage = (indexToRemove: number) => {
    setForm(prev => ({
      ...prev,
      koszulki_grafiki: prev.koszulki_grafiki.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleAddParticipantFromDB = (k: KlientBaza) => {
    if (form.uczestnicy.some(u => (u.id && u.id === k.id) || (u.email && u.email.toLowerCase() === k.email?.toLowerCase()))) {
      return;
    }
    setForm(prev => ({
      ...prev,
      uczestnicy: [...prev.uczestnicy, { 
        id: k.id, 
        imie: k.imie, 
        nazwisko: k.nazwisko, 
        email: k.email, 
        status_platnosci: "nieoplacone" 
      }]
    }));
    setKlientSearch("");
  };

  const handleAddManualParticipant = () => {
    if (!manualImie.trim()) return;
    setForm(prev => ({
      ...prev,
      uczestnicy: [...prev.uczestnicy, { 
        imie: manualImie.trim(), 
        nazwisko: manualNazwisko.trim(), 
        status_platnosci: "nieoplacone" 
      }]
    }));
    setManualImie("");
    setManualNazwisko("");
  };

  const handleRemoveParticipant = (indexToRemove: number) => {
    setForm(prev => ({
      ...prev,
      uczestnicy: prev.uczestnicy.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleUpdateParticipantPayment = (index: number, status: PaymentStatus) => {
    setForm(prev => {
      const updated = [...prev.uczestnicy];
      updated[index] = { ...updated[index], status_platnosci: status };
      return { ...prev, uczestnicy: updated };
    });
  };

  const handleQuickPaymentToggle = async (participantIndex: number) => {
    if (!isAdmin || !selectedEvent || !selectedEvent.uczestnicy) return;

    const currentUczestnicy = [...selectedEvent.uczestnicy];
    const target = currentUczestnicy[participantIndex];
    const nextStatusMap: Record<PaymentStatus, PaymentStatus> = {
      nieoplacone: "zadatek",
      zadatek: "calosc",
      calosc: "nieoplacone"
    };
    const nextStatus: PaymentStatus = nextStatusMap[target.status_platnosci || "nieoplacone"];
    
    const updatedUczestnicy = currentUczestnicy.map((u, idx) => 
      idx === participantIndex ? { ...u, status_platnosci: nextStatus } : u
    );

    setSelectedEvent({ ...selectedEvent, uczestnicy: updatedUczestnicy });
    setWydarzenia(prev => prev.map(w => w.id === selectedEvent.id ? { ...w, uczestnicy: updatedUczestnicy } : w));

    const { error } = await supabase
      .from("wydarzenia")
      .update({ uczestnicy: updatedUczestnicy })
      .eq("id", selectedEvent.id);

    if (error) {
      console.error("Błąd aktualizacji statusu płatności:", error);
      setSelectedEvent({ ...selectedEvent, uczestnicy: currentUczestnicy });
      setWydarzenia(prev => prev.map(w => w.id === selectedEvent.id ? { ...w, uczestnicy: currentUczestnicy } : w));
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      tytul: form.tytul,
      data_od: form.data_od,
      data_do: form.data_do,
      cena: form.cena,
      zadatek: form.zadatek,
      zadatek_do: form.zadatek_do || null,
      reszta_do: form.reszta_do || null,
      opis: form.opis,
      grafika_url: form.grafika_url,
      status: form.status,
      uczestnicy: form.uczestnicy,
      
      pokaz_whatsapp: form.pokaz_whatsapp,
      whatsapp_url: form.pokaz_whatsapp ? form.whatsapp_url : null,
      
      pokaz_zbiorka: form.pokaz_zbiorka,
      zbiorka: form.pokaz_zbiorka ? form.zbiorka : null,
      google_maps_url: form.pokaz_zbiorka ? form.google_maps_url : null,
      
      pokaz_ekwipunek: form.pokaz_ekwipunek,
      ekwipunek: form.pokaz_ekwipunek ? form.ekwipunek : null,
      
      pokaz_opis_strefy: form.pokaz_opis_strefy,
      strefa_opis: form.pokaz_opis_strefy ? form.strefa_opis : null,
      
      pokaz_plan_grafika: form.pokaz_plan_grafika,
      plan_grafiki: form.pokaz_plan_grafika ? form.plan_grafiki : [],

      pokaz_koszulki: form.pokaz_koszulki,
      koszulki_cena: form.pokaz_koszulki ? form.koszulki_cena : null,
      koszulki_termin: form.pokaz_koszulki ? (form.koszulki_termin || null) : null,
      koszulki_opis: form.pokaz_koszulki ? form.koszulki_opis : null,
      koszulki_grafika_glowna: form.pokaz_koszulki ? form.koszulki_grafika_glowna : null,
      koszulki_grafiki: form.pokaz_koszulki ? form.koszulki_grafiki : []
    };

    try {
      if (editingId) {
        await supabase.from("wydarzenia").update(payload).eq("id", editingId);
      } else {
        await supabase.from("wydarzenia").insert([payload]);
      }
      setIsAdminModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error("Błąd podczas zapisywania wydarzenia:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDatePL = (dateString?: string | null) => {
    if (!dateString) return "";
    const parts = dateString.split("-");
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateString;
  };

  const formatTermin = (od: string, doDnia: string) => {
    const sOd = formatDatePL(od);
    const sDo = formatDatePL(doDnia);
    if (!doDnia || od === doDnia) return sOd;
    return `${sOd} — ${sDo}`;
  };

  const formatUczestnikName = (u: Uczestnik, userIsEnrolled: boolean) => {
    if (userIsEnrolled || isAdmin) {
      return `${u.imie} ${u.nazwisko || ""}`.trim();
    }
    const firstLetter = u.nazwisko ? `${u.nazwisko.charAt(0)}.` : "";
    return `${u.imie} ${firstLetter}`.trim();
  };

  const getGoogleMapsLink = (mapsUrl?: string | null, textLocation?: string | null) => {
    if (mapsUrl && mapsUrl.trim().length > 0) {
      return mapsUrl.trim();
    }
    if (textLocation && textLocation.trim().length > 0) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(textLocation.trim())}`;
    }
    return null;
  };

  const filteredKlienci = useMemo(() => {
    if (!klientSearch.trim()) return [];
    const search = klientSearch.toLowerCase();
    return klienciBaza.filter(k => 
      `${k.imie} ${k.nazwisko} ${k.email || ""}`.toLowerCase().includes(search)
    );
  }, [klienciBaza, klientSearch]);

  const getPaymentBadge = (status?: PaymentStatus) => {
    switch (status) {
      case "calosc":
        return { text: "Całość", bg: "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100", icon: "🟢" };
      case "zadatek":
        return { text: "Zadatek", bg: "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100", icon: "🟡" };
      case "nieoplacone":
      default:
        return { text: "Oczekuje", bg: "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100", icon: "⭕" };
    }
  };

  const formResztaKwoty = useMemo(() => {
    return obliczReszteKwoty(form.cena, form.zadatek);
  }, [form.cena, form.zadatek]);

  const handleOpenEventModal = (w: Wydarzenie) => {
    markEventAsSeen(w.id);
    setSelectedEvent(w);
    setIsViewModalOpen(true);
  };

  const EventCard = ({ w, isPast = false }: { w: Wydarzenie; isPast?: boolean }) => {
    const zamkniete = isZapisyZamkniete(w);
    const unread = !isPast && isEventUnread(w.id);
    const uczestnicyCount = Array.isArray(w.uczestnicy) ? w.uczestnicy.length : 0;
    const oplaconeZadatekCount = Array.isArray(w.uczestnicy) ? w.uczestnicy.filter(u => u.status_platnosci === "zadatek").length : 0;
    const oplaconeCaloscCount = Array.isArray(w.uczestnicy) ? w.uczestnicy.filter(u => u.status_platnosci === "calosc").length : 0;

    return (
      <div 
        onClick={() => !isPast && handleOpenEventModal(w)}
        className={`relative bg-white rounded-3xl overflow-hidden border border-sky-100 flex flex-col group transition-all duration-300 ${
          isPast ? "opacity-60 grayscale hover:grayscale-0 cursor-default" : "shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-sky-300 cursor-pointer"
        }`}
      >
        {isAdmin && (
          <div className="absolute top-3 right-3 flex gap-2 z-20 bg-white/95 p-1.5 rounded-xl backdrop-blur-md shadow-md border border-slate-100">
            <button onClick={(e) => handleOpenEdit(w, e)} className="w-9 h-9 flex items-center justify-center bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 transition-colors shadow-sm cursor-pointer" title="Edytuj">✏️</button>
            <button onClick={(e) => handleDelete(w.id, e)} className="w-9 h-9 flex items-center justify-center bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors shadow-sm cursor-pointer" title="Usuń">🗑️</button>
          </div>
        )}

        {unread && (
          <div className="absolute top-3 right-3 z-10 flex h-6 w-6">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-6 w-6 bg-rose-600 text-xs font-black text-white items-center justify-center shadow-lg">
              !
            </span>
          </div>
        )}

        <div className="h-48 w-full bg-slate-100 relative overflow-hidden">
          {w.grafika_url ? (
            <img src={w.grafika_url} alt={w.tytul} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-sky-100 to-amber-50 flex items-center justify-center text-4xl opacity-50">🎟️</div>
          )}

          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-black text-sky-950 shadow-sm flex items-center gap-1.5 z-10 border border-white/50">
            <span>📅</span> {formatTermin(w.data_od, w.data_do)}
          </div>

          {zamkniete && !isPast && (
            <div className="absolute top-3 left-3 bg-rose-600 text-white px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 z-10 animate-pulse">
              <span>🔒</span> Zapisy zamknięte
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col flex-grow">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-black text-lg text-sky-950 leading-tight line-clamp-2">{w.tytul}</h3>
          </div>

          <p className="text-sm text-slate-500 line-clamp-2 flex-grow">{w.opis || "Brak dodatkowego opisu."}</p>
          
          {uczestnicyCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 items-center">
              <div className="py-1 px-2.5 bg-sky-50 rounded-lg text-[11px] font-bold text-sky-800 flex items-center gap-1.5">
                <span>👥</span>
                <span>Zapisanych: <strong className="font-black">{uczestnicyCount}</strong></span>
              </div>

              {isAdmin && (oplaconeZadatekCount > 0 || oplaconeCaloscCount > 0) && (
                <div className="py-1 px-2.5 bg-emerald-50 rounded-lg text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                  <span>💰</span>
                  <span>Wpłaty: <strong>{oplaconeCaloscCount} pełne</strong> {oplaconeZadatekCount > 0 && `• ${oplaconeZadatekCount} zadatek`}</span>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-sky-50 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cena wydarzenia</span>
              <span className="font-black text-sky-900 text-base">{w.cena || "Darmowe"}</span>
            </div>

            {w.zadatek && (
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider leading-tight">
                  Zadatek
                </span>
                {w.zadatek_do && (
                  <span className="text-[9px] font-semibold text-amber-500/90 leading-tight">
                    (do {formatDatePL(w.zadatek_do)})
                  </span>
                )}
                <span className="font-black text-amber-700 text-sm mt-0.5">{w.zadatek}</span>
              </div>
            )}

            {!isPast && !w.zadatek && (
              <div className="w-10 h-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64 text-sky-900 font-bold">Ładowanie wydarzeń...</div>;
  }

  const selectedIsClosed = selectedEvent ? isZapisyZamkniete(selectedEvent) : false;
  const enrolledInSelected = isUserZapisany(selectedEvent);
  const mapsLink = selectedEvent ? getGoogleMapsLink(selectedEvent.google_maps_url, selectedEvent.zbiorka) : null;

  const hasAnyParticipantModule = selectedEvent && (
    (selectedEvent.pokaz_whatsapp && selectedEvent.whatsapp_url) ||
    (selectedEvent.pokaz_zbiorka && selectedEvent.zbiorka) ||
    (selectedEvent.pokaz_ekwipunek && selectedEvent.ekwipunek) ||
    (selectedEvent.pokaz_opis_strefy && selectedEvent.strefa_opis) ||
    (selectedEvent.pokaz_plan_grafika && selectedEvent.plan_grafiki && selectedEvent.plan_grafiki.length > 0) ||
    (selectedEvent.pokaz_koszulki && (selectedEvent.koszulki_grafika_glowna || selectedEvent.koszulki_cena || (selectedEvent.koszulki_grafiki && selectedEvent.koszulki_grafiki.length > 0)))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-500 pb-12 w-full px-2 sm:px-4">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-sky-200 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-sky-950 uppercase tracking-tight flex items-center gap-3">
            <span className="p-2 bg-amber-500 rounded-xl shadow-sm text-slate-900">🎯</span>
            <span>Wydarzenia Klubowe</span>
            {hasUnreadEvents && !isAdmin && (
              <span className="relative flex h-5 w-5 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-rose-600 text-xs font-black text-white items-center justify-center shadow">
                  !
                </span>
              </span>
            )}
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium max-w-2xl">
            Sprawdź co planujemy w najbliższym czasie. Zapisz się na warsztaty, obozy lub wspólne treningi!
          </p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={handleOpenAdd}
            className="bg-sky-900 hover:bg-sky-950 text-white px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>+</span> DODAJ WYDARZENIE
          </button>
        )}
      </div>

      {wydarzenia.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-sky-100 border-dashed">
          <div className="text-5xl mb-4">🏜️</div>
          <h3 className="text-lg font-black text-sky-950 mb-1">Brak wydarzeń w kalendarzu</h3>
          <p className="text-slate-500 text-sm">Na ten moment nie zaplanowaliśmy żadnych atrakcji. Wróć tu wkrótce!</p>
        </div>
      )}

      {wkrotce.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-sky-950 uppercase tracking-tight">⏳ Wkrótce</h2>
            <div className="h-px bg-sky-200 flex-grow"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wkrotce.map(w => <EventCard key={w.id} w={w} />)}
          </div>
        </div>
      )}

      {planowane.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-sky-950 uppercase tracking-tight">📅 Planowane</h2>
            <div className="h-px bg-sky-200 flex-grow"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {planowane.map(w => <EventCard key={w.id} w={w} />)}
          </div>
        </div>
      )}

      {przeszle.length > 0 && (
        <div className="space-y-6 opacity-90">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-slate-400 uppercase tracking-tight">🕰️ Przeszłe wydarzenia</h2>
            <div className="h-px bg-slate-200 flex-grow"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {przeszle.map(w => <EventCard key={w.id} w={w} isPast={true} />)}
          </div>
        </div>
      )}

      {/* MODAL PODGLĄDU KLUBOWICZA / UCZESTNIKA */}
      {isViewModalOpen && selectedEvent && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-start justify-center p-2 sm:p-4 md:py-10 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-50 rounded-2xl sm:rounded-[2rem] max-w-3xl w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
            
            <button 
              onClick={() => setIsViewModalOpen(false)} 
              className="absolute top-4 right-4 z-20 bg-white hover:bg-slate-100 text-slate-900 w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg cursor-pointer font-black text-lg"
            >✕</button>
            
            {/* Plakat główny */}
            <div className="w-full bg-slate-900 relative flex justify-center items-center overflow-hidden group min-h-[220px] max-h-[60vh]">
              {selectedEvent.grafika_url ? (
                <>
                  <div 
                    className="absolute inset-0 opacity-40 blur-2xl bg-cover bg-center scale-110" 
                    style={{ backgroundImage: `url(${selectedEvent.grafika_url})` }}
                  ></div>
                  <img 
                    src={selectedEvent.grafika_url} 
                    alt="Plakat wydarzenia" 
                    onClick={() => setPreviewImage(selectedEvent.grafika_url)}
                    className="relative z-10 w-full h-full object-contain max-h-[60vh] drop-shadow-2xl cursor-zoom-in hover:scale-[1.02] transition-transform duration-300" 
                    title="Kliknij, aby powiększyć plakat"
                  />
                  <div className="absolute bottom-3 right-3 z-20 bg-black/60 backdrop-blur-sm text-white text-[11px] font-bold px-3 py-1 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    🔍 Kliknij, aby powiększyć
                  </div>
                </>
              ) : (
                <div className="w-full h-full min-h-[220px] bg-gradient-to-br from-sky-900 to-slate-800 flex flex-col items-center justify-center text-sky-100 p-6">
                  <span className="text-6xl mb-3 drop-shadow-lg">🎉</span>
                  <span className="font-black text-lg tracking-widest uppercase opacity-50">Brak plakatu</span>
                </div>
              )}
            </div>

            {/* Treść */}
            <div className="p-4 sm:p-8 md:p-10 space-y-6 sm:space-y-8">
              
              <div className="text-center">
                {selectedIsClosed && (
                  <div className="inline-block bg-rose-100 text-rose-800 border border-rose-200 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-3">
                    🔒 Zapisy zostały zakończone
                  </div>
                )}
                <h2 className="text-2xl sm:text-4xl font-black text-sky-950 leading-tight uppercase tracking-tighter break-words">{selectedEvent.tytul}</h2>
                <div className="w-16 h-1.5 bg-amber-500 mx-auto mt-4 rounded-full"></div>
              </div>

              {/* Kafelki z informacjami */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="flex flex-col items-center justify-between text-center min-h-[105px] bg-white p-3.5 rounded-2xl shadow-sm border border-sky-100">
                  <span className="text-2xl">📅</span>
                  <div className="w-full">
                    <div className="text-[10px] font-bold text-sky-500 uppercase tracking-widest leading-tight">Termin</div>
                    <div className="h-3.5"></div>
                    <div className="font-black text-sky-950 text-xs sm:text-sm mt-0.5">{formatTermin(selectedEvent.data_od, selectedEvent.data_do)}</div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-between text-center min-h-[105px] bg-white p-3.5 rounded-2xl shadow-sm border border-amber-100">
                  <span className="text-2xl">💳</span>
                  <div className="w-full">
                    <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest leading-tight">Cena całkowita</div>
                    <div className="h-3.5"></div>
                    <div className="font-black text-amber-950 text-xs sm:text-sm mt-0.5">{selectedEvent.cena || "Darmowe"}</div>
                  </div>
                </div>
                
                {selectedEvent.zadatek ? (
                  <div className="flex flex-col items-center justify-between text-center min-h-[105px] bg-white p-3.5 rounded-2xl shadow-sm border border-orange-100">
                    <span className="text-2xl">🟡</span>
                    <div className="w-full">
                      <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest leading-tight">Zadatek</div>
                      {selectedEvent.zadatek_do ? (
                        <div className="text-[9px] font-semibold text-orange-400 mt-0.5 leading-tight">
                          (do {formatDatePL(selectedEvent.zadatek_do)})
                        </div>
                      ) : (
                        <div className="h-3.5"></div>
                      )}
                      <div className="font-black text-orange-950 text-xs sm:text-sm mt-0.5">{selectedEvent.zadatek}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-between text-center min-h-[105px] bg-white p-3.5 rounded-2xl shadow-sm border border-emerald-100">
                    <span className="text-2xl">✅</span>
                    <div className="w-full">
                      <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest leading-tight">Rezerwacja</div>
                      <div className="h-3.5"></div>
                      <div className="font-black text-emerald-950 text-xs sm:text-sm mt-0.5">Brak zadatku</div>
                    </div>
                  </div>
                )}

                {/* Pole Dopłaty Reszty Kwoty */}
                <div className="flex flex-col items-center justify-between text-center min-h-[105px] bg-white p-3.5 rounded-2xl shadow-sm border border-indigo-100">
                  <span className="text-2xl">🟢</span>
                  <div className="w-full">
                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-tight">Reszta kwoty</div>
                    {selectedEvent.reszta_do ? (
                      <div className="text-[9px] font-semibold text-indigo-400 mt-0.5 leading-tight">
                        (do {formatDatePL(selectedEvent.reszta_do)})
                      </div>
                    ) : (
                      <div className="h-3.5"></div>
                    )}
                    <div className="font-black text-indigo-950 text-xs sm:text-sm mt-0.5">
                      {obliczReszteKwoty(selectedEvent.cena, selectedEvent.zadatek)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Opis ogólny */}
              <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200">
                <h3 className="font-black text-xs sm:text-sm text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="text-lg">📝</span> Informacje ogólne
                </h3>
                <div className="text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium break-words">
                  {selectedEvent.opis || "Organizator nie podał jeszcze szczegółowego opisu tego wydarzenia."}
                </div>
              </div>

              {/* KOMPAKTOWA LISTA UCZESTNIKÓW */}
              {selectedEvent.uczestnicy && selectedEvent.uczestnicy.length > 0 && (
                <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-sky-100 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-50 pb-3">
                    <div>
                      <h3 className="font-black text-xs sm:text-sm text-sky-950 uppercase tracking-widest flex items-center gap-2">
                        <span>👥</span> Lista uczestników ({selectedEvent.uczestnicy.length})
                      </h3>
                      {isAdmin && (
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          💡 Kliknij w status płatności, aby go szybko przełączyć.
                        </p>
                      )}
                    </div>

                    {!enrolledInSelected && !isAdmin && (
                      <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium italic">
                        Anonimizacja nazwisk dla osób niezapisanych
                      </span>
                    )}

                    {isAdmin && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                          Zadatek: {selectedEvent.uczestnicy.filter(u => u.status_platnosci === "zadatek").length}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200">
                          Całość: {selectedEvent.uczestnicy.filter(u => u.status_platnosci === "calosc").length}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedEvent.uczestnicy.map((u, idx) => {
                      const badge = getPaymentBadge(u.status_platnosci);
                      const isMe = currentUserEmail && u.email && u.email.toLowerCase() === currentUserEmail.toLowerCase();

                      return (
                        <div key={idx} className="bg-sky-50/70 border border-sky-100/90 px-3 py-2 rounded-xl flex items-center justify-between gap-2 transition-all">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
                            <span className="text-xs font-bold text-sky-950 truncate" title={formatUczestnikName(u, enrolledInSelected)}>
                              {formatUczestnikName(u, enrolledInSelected)} {isMe && "(Ty)"}
                            </span>
                          </div>

                          {isAdmin ? (
                            <button
                              onClick={() => handleQuickPaymentToggle(idx)}
                              title="Kliknij, aby przełączyć: Oczekuje -> Zadatek -> Całość"
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-black border transition-all cursor-pointer flex items-center gap-1 shadow-xs hover:scale-105 shrink-0 ${badge.bg}`}
                            >
                              <span className="text-[9px]">{badge.icon}</span>
                              <span>{badge.text}</span>
                            </button>
                          ) : isMe ? (
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border flex items-center gap-1 shrink-0 ${badge.bg}`}>
                              <span className="text-[9px]">{badge.icon}</span>
                              <span>{badge.text}</span>
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STREFA DLA ZAPISANYCH KLUBOWICZÓW */}
              {enrolledInSelected && hasAnyParticipantModule && (
                <div className="bg-gradient-to-br from-amber-500/10 via-sky-500/10 to-indigo-500/10 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border-2 border-amber-400 shadow-md space-y-6">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-4">
                    <div>
                      <span className="bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md">
                        Tylko dla zapisanych
                      </span>
                      <h3 className="text-lg sm:text-xl font-black text-sky-950 mt-1 flex items-center gap-2">
                        🌟 Twoja Strefa Uczestnika
                      </h3>
                    </div>
                    {isAdmin && (
                      <span className="text-xs bg-sky-950 text-white font-bold px-2 py-1 rounded-lg shrink-0">Podgląd Admina</span>
                    )}
                  </div>

                  {/* Moduł WhatsApp */}
                  {selectedEvent.pokaz_whatsapp && selectedEvent.whatsapp_url && (
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl shrink-0">💬</span>
                        <div>
                          <div className="font-black text-emerald-950 text-sm">Oficjalna grupa wyjazdu na WhatsApp</div>
                          <div className="text-emerald-700 text-xs font-medium">Bądź na bieżąco z komunikatami i kontaktem z grupą</div>
                        </div>
                      </div>
                      <a 
                        href={selectedEvent.whatsapp_url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="w-full sm:w-auto text-center bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2.5 rounded-xl text-xs transition-colors shadow-sm uppercase tracking-wider shrink-0"
                      >
                        Dołącz do grupy 📲
                      </a>
                    </div>
                  )}

                  {/* Moduł Zbiórka / Lokalizacja z Google Maps */}
                  {selectedEvent.pokaz_zbiorka && selectedEvent.zbiorka && (
                    <div className="bg-white p-5 rounded-2xl border border-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-2">
                          <span>📍</span> Miejsce i czas zbiórki / Wyjazd
                        </h4>
                        <p className="text-sm font-bold text-slate-800 leading-snug">{selectedEvent.zbiorka}</p>
                      </div>
                      {mapsLink && (
                        <a 
                          href={mapsLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="w-full sm:w-auto text-center bg-sky-900 hover:bg-sky-950 text-white text-xs font-black px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm shrink-0 transition-colors uppercase tracking-wider"
                        >
                          <span>🗺️</span> Nawiguj w Google Maps
                        </a>
                      )}
                    </div>
                  )}

                  {/* Moduł Ekwipunek */}
                  {selectedEvent.pokaz_ekwipunek && selectedEvent.ekwipunek && (
                    <div className="bg-white p-5 rounded-2xl border border-sky-100">
                      <h4 className="text-xs font-black text-sky-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <span>🎒</span> Co należy ze sobą zabrać (Ekwipunek)
                      </h4>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed break-words">
                        {selectedEvent.ekwipunek}
                      </div>
                    </div>
                  )}

                  {/* Moduł Opis Strefy */}
                  {selectedEvent.pokaz_opis_strefy && selectedEvent.strefa_opis && (
                    <div className="bg-white p-5 rounded-2xl border border-sky-100">
                      <h4 className="text-xs font-black text-sky-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <span>📋</span> Szczegółowy plan wyjazdu & wytyczne
                      </h4>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed break-words">
                        {selectedEvent.strefa_opis}
                      </div>
                    </div>
                  )}

                  {/* Moduł Plany / Harmonogram Graficzny */}
                  {selectedEvent.pokaz_plan_grafika && selectedEvent.plan_grafiki && selectedEvent.plan_grafiki.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black text-sky-900 uppercase tracking-wider flex items-center gap-2">
                        <span>🗺️</span> Graficzny harmonogram wyjazdu ({selectedEvent.plan_grafiki.length})
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {selectedEvent.plan_grafiki.map((imgUrl, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => setPreviewImage(imgUrl)} 
                            className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm p-2 cursor-zoom-in group relative"
                          >
                            <img 
                              src={imgUrl} 
                              alt={`Plan wyjazdu ${idx + 1}`} 
                              className="w-full h-auto object-contain max-h-[400px] rounded-xl group-hover:opacity-95 transition-opacity" 
                              loading="lazy" 
                            />
                            <div className="absolute inset-2 rounded-xl bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[2px]">
                              <span>🔍</span> Kliknij, aby powiększyć
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Moduł Koszulki Treningowe */}
                  {selectedEvent.pokaz_koszulki && (
                    <div className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border-2 border-indigo-200 shadow-sm space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-50 pb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl shrink-0">👕</span>
                          <div>
                            <h4 className="text-sm sm:text-base font-black text-indigo-950 uppercase tracking-tight">
                              Oficjalna koszulka treningowa
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">Pamiątkowa koszulka klubowa dedykowana na to wydarzenie</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {selectedEvent.koszulki_cena && (
                            <div className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl text-center">
                              <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">Cena koszulki</div>
                              <div className="font-black text-indigo-950 text-xs">{selectedEvent.koszulki_cena}</div>
                            </div>
                          )}
                          {selectedEvent.koszulki_termin && (
                            <div className="bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl text-center">
                              <div className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">Płatność do</div>
                              <div className="font-black text-rose-950 text-xs">{formatDatePL(selectedEvent.koszulki_termin)}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      {selectedEvent.koszulki_opis && (
                        <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium break-words">
                          {selectedEvent.koszulki_opis}
                        </div>
                      )}

                      {selectedEvent.koszulki_grafika_glowna && (
                        <div className="space-y-2">
                          <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">Wizualizacja koszulki</span>
                          <div 
                            onClick={() => setPreviewImage(selectedEvent.koszulki_grafika_glowna!)} 
                            className="bg-slate-50 rounded-2xl overflow-hidden border border-indigo-100 p-2 max-w-md mx-auto shadow-sm cursor-zoom-in group relative"
                          >
                            <img 
                              src={selectedEvent.koszulki_grafika_glowna} 
                              alt="Koszulka treningowa" 
                              className="w-full h-auto object-contain max-h-[350px] rounded-xl group-hover:opacity-95 transition-opacity" 
                              loading="lazy" 
                            />
                            <div className="absolute inset-2 rounded-xl bg-indigo-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[2px]">
                              <span>🔍</span> Kliknij, aby powiększyć
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedEvent.koszulki_grafiki && selectedEvent.koszulki_grafiki.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-indigo-50">
                          <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider block">
                            📐 Tabela rozmiarów & Warianty ({selectedEvent.koszulki_grafiki.length})
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedEvent.koszulki_grafiki.map((imgUrl, idx) => (
                              <div 
                                key={idx} 
                                onClick={() => setPreviewImage(imgUrl)} 
                                className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 p-2 cursor-zoom-in group relative shadow-sm"
                              >
                                <img 
                                  src={imgUrl} 
                                  alt={`Tabela rozmiarów ${idx + 1}`} 
                                  className="w-full h-auto object-contain max-h-[300px] rounded-xl group-hover:opacity-95 transition-opacity" 
                                  loading="lazy" 
                                />
                                <div className="absolute inset-2 rounded-xl bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[2px]">
                                  <span>🔍</span> Kliknij, aby powiększyć
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* PEŁNOEKRANOWY LIGHTBOX / ZOOM OBRAZKA */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)} 
          className="fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center p-3 sm:p-6 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 cursor-zoom-out"
        >
          <button 
            onClick={() => setPreviewImage(null)} 
            className="absolute top-5 right-5 z-20 bg-white/10 hover:bg-white text-white hover:text-slate-950 w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-2xl cursor-pointer font-black text-xl border border-white/20"
          >
            ✕
          </button>
          <div className="relative max-w-[95vw] max-h-[92vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img 
              src={previewImage} 
              alt="Powiększenie" 
              className="max-w-full max-h-[92vh] object-contain rounded-2xl shadow-2xl border border-white/10" 
            />
          </div>
        </div>
      )}

      {/* MODAL ADMINA: DODAJ / EDYTUJ WYDARZENIE */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-3xl w-full p-4 sm:p-8 shadow-2xl relative border-2 border-sky-900 my-4 sm:my-8 max-h-[92vh] overflow-y-auto overflow-x-hidden">
            
            <button 
              onClick={() => setIsAdminModalOpen(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 w-8 h-8 rounded-full flex items-center justify-center font-bold text-base cursor-pointer z-10 transition-colors"
            >
              ✕
            </button>
            
            <div className="mb-6 pr-8">
              <h3 className="font-black text-xl sm:text-2xl text-sky-950 leading-tight">
                {editingId ? "Edytuj wydarzenie" : "Kreator nowego wydarzenia"}
              </h3>
              <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
                Uzupełnij informacje ogólne, termin zadatku i dopłaty oraz zarządzaj listą uczestników i statusem ich wpłat.
              </p>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-6">
              
              {/* PLAKAT GŁÓWNY */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 text-xs block uppercase">Plakat główny wydarzenia</label>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full h-36 bg-sky-50 border-2 border-dashed border-sky-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-sky-100 transition-colors overflow-hidden relative"
                >
                  {form.grafika_url ? (
                    <>
                      <img src={form.grafika_url} className="w-full h-full object-cover opacity-60" alt="Preview" />
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-sky-900 drop-shadow-md text-xs sm:text-sm bg-white/40">
                        Kliknij, aby zmienić zdjęcie
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl mb-1">📸</span>
                      <span className="text-xs font-bold text-sky-700">Wybierz plakat z dysku</span>
                    </>
                  )}
                </div>
              </div>

              {/* STATUS WYŚWIETLANIA */}
              <div className="space-y-2">
                <label className="font-bold text-slate-700 text-xs block uppercase">Gdzie wyświetlić wydarzenie?</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <label className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 cursor-pointer transition-all ${form.status === "wkrotce" ? "border-sky-500 bg-sky-50 text-sky-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                    <input type="radio" name="status" value="wkrotce" checked={form.status === "wkrotce"} onChange={() => setForm({...form, status: "wkrotce"})} className="hidden" />
                    <span className="font-black text-xs sm:text-sm">⏳ Wkrótce</span>
                  </label>
                  <label className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 cursor-pointer transition-all ${form.status === "planowane" ? "border-amber-500 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                    <input type="radio" name="status" value="planowane" checked={form.status === "planowane"} onChange={() => setForm({...form, status: "planowane"})} className="hidden" />
                    <span className="font-black text-xs sm:text-sm">📅 Planowane</span>
                  </label>
                </div>
              </div>

              {/* TYTUŁ */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase">Tytuł wydarzenia</label>
                <input 
                  type="text" 
                  required 
                  value={form.tytul} 
                  onChange={(e) => setForm({...form, tytul: e.target.value})} 
                  placeholder="np. Obóz sportowy Świeradów-Zdrój" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500" 
                />
              </div>

              {/* TERMINY WYJAZDU */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">Data rozpoczęcia</label>
                  <input 
                    type="date" 
                    required 
                    value={form.data_od} 
                    onChange={(e) => setForm({...form, data_od: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">Data zakończenia</label>
                  <input 
                    type="date" 
                    required 
                    value={form.data_do} 
                    onChange={(e) => setForm({...form, data_do: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500" 
                  />
                </div>
              </div>

              {/* CENA, ZADATEK I TERMIN ZADATKU */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">Cena całkowita</label>
                  <input 
                    type="text" 
                    value={form.cena} 
                    onChange={(e) => setForm({...form, cena: e.target.value})} 
                    placeholder="np. 1080 PLN" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">Zadatek (kwota)</label>
                  <input 
                    type="text" 
                    value={form.zadatek} 
                    onChange={(e) => setForm({...form, zadatek: e.target.value})} 
                    placeholder="np. 400 PLN" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">Zadatek płatny do</label>
                  <input 
                    type="date" 
                    value={form.zadatek_do} 
                    onChange={(e) => setForm({...form, zadatek_do: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500" 
                  />
                </div>
              </div>

              {/* DOPŁATA RESZTY KWOTY - WYLICZANA + TERMIN RESZTY */}
              <div className="p-4 bg-sky-50/70 rounded-2xl border border-sky-200 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="space-y-1">
                  <label className="font-bold text-sky-950 text-xs block uppercase">
                    Pozostała kwota (wyliczona automatycznie)
                  </label>
                  <div className="w-full bg-white border border-sky-300 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-black text-sky-900 flex items-center justify-between">
                    <span>{formResztaKwoty}</span>
                    <span className="text-[10px] font-bold text-sky-600 bg-sky-100 px-2 py-0.5 rounded-md">Cena - Zadatek</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase">
                    Termin płatności reszty kwoty
                  </label>
                  <input 
                    type="date" 
                    value={form.reszta_do} 
                    onChange={(e) => setForm({...form, reszta_do: e.target.value})} 
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500" 
                  />
                </div>
              </div>

              {/* OPIS OGÓLNY */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase">Opis ogólny wydarzenia (publiczny)</label>
                <textarea 
                  required 
                  value={form.opis} 
                  onChange={(e) => setForm({...form, opis: e.target.value})} 
                  placeholder="Wpisz punkty oferty, co zawiera cena, dla kogo jest wyjazd..." 
                  rows={4} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:border-sky-500 resize-none" 
                />
              </div>

              {/* ZARZĄDZANIE UCZESTNIKAMI */}
              <div className="p-4 sm:p-5 bg-sky-50/60 rounded-2xl border border-sky-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="font-black text-sky-950 text-xs uppercase tracking-wider block">
                    👥 Lista uczestników & Płatności ({form.uczestnicy.length})
                  </label>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                    <span className="text-amber-800">🟡 Zadatek: {form.uczestnicy.filter(u => u.status_platnosci === "zadatek").length}</span>
                    <span className="text-emerald-800">🟢 Całość: {form.uczestnicy.filter(u => u.status_platnosci === "calosc").length}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <input 
                    type="text" 
                    value={klientSearch} 
                    onChange={(e) => setKlientSearch(e.target.value)} 
                    placeholder="🔍 Szukaj klubowicza z bazy po nazwisku..." 
                    className="w-full bg-white border border-sky-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500" 
                  />
                  {klientSearch.length > 0 && (
                    <div className="max-h-40 overflow-y-auto bg-white border border-sky-200 rounded-xl p-2 space-y-1 shadow-md">
                      {filteredKlienci.slice(0, 10).map(k => (
                        <div 
                          key={k.id} 
                          onClick={() => handleAddParticipantFromDB(k)} 
                          className="p-2 hover:bg-sky-100 rounded-lg text-xs font-bold text-sky-950 flex justify-between items-center cursor-pointer transition-colors"
                        >
                          <span className="truncate pr-2">{k.imie} {k.nazwisko} <span className="text-slate-400 font-normal">({k.email || "brak e-mail"})</span></span>
                          <span className="text-emerald-600 font-black shrink-0">+ Dodaj</span>
                        </div>
                      ))}
                      {filteredKlienci.length === 0 && (
                        <div className="text-xs text-slate-400 p-2 text-center">Brak klubowiczów pasujących do wyszukiwania</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Formularz dopisania ręcznego */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="text" 
                    placeholder="Imię" 
                    value={manualImie} 
                    onChange={(e) => setManualImie(e.target.value)} 
                    className="w-full sm:flex-1 min-w-0 bg-white border border-sky-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500" 
                  />
                  <input 
                    type="text" 
                    placeholder="Nazwisko" 
                    value={manualNazwisko} 
                    onChange={(e) => setManualNazwisko(e.target.value)} 
                    className="w-full sm:flex-1 min-w-0 bg-white border border-sky-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500" 
                  />
                  <button 
                    type="button" 
                    onClick={handleAddManualParticipant} 
                    className="w-full sm:w-auto bg-sky-900 hover:bg-sky-950 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer transition-colors shrink-0"
                  >
                    Dopisz
                  </button>
                </div>

                {/* Lista zapisanych */}
                {form.uczestnicy.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-sky-200/60 max-h-60 overflow-y-auto pr-1">
                    {form.uczestnicy.map((u, index) => {
                      const currentStatus: PaymentStatus = u.status_platnosci || "nieoplacone";
                      return (
                        <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white border border-sky-200 p-2.5 rounded-xl text-xs font-bold text-sky-950 shadow-sm">
                          <span className="truncate">{u.imie} {u.nazwisko}</span>
                          
                          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateParticipantPayment(index, "nieoplacone")}
                                className={`px-2 py-1 rounded-md text-[10px] font-black cursor-pointer transition-all ${
                                  currentStatus === "nieoplacone" 
                                    ? "bg-slate-200 text-slate-800 shadow-xs" 
                                    : "text-slate-400 hover:text-slate-700"
                                }`}
                              >
                                Oczekuje
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleUpdateParticipantPayment(index, "zadatek")}
                                className={`px-2 py-1 rounded-md text-[10px] font-black cursor-pointer transition-all ${
                                  currentStatus === "zadatek" 
                                    ? "bg-amber-500 text-slate-950 shadow-xs" 
                                    : "text-amber-700/60 hover:text-amber-800"
                                }`}
                              >
                                🟡 Zadatek
                              </button>

                              <button
                                type="button"
                                onClick={() => handleUpdateParticipantPayment(index, "calosc")}
                                className={`px-2 py-1 rounded-md text-[10px] font-black cursor-pointer transition-all ${
                                  currentStatus === "calosc" 
                                    ? "bg-emerald-600 text-white shadow-xs" 
                                    : "text-emerald-700/60 hover:text-emerald-800"
                                }`}
                              >
                                🟢 Całość
                              </button>
                            </div>

                            <button 
                              type="button" 
                              onClick={() => handleRemoveParticipant(index)} 
                              className="text-rose-500 hover:text-rose-700 p-1 font-black cursor-pointer ml-1" 
                              title="Usuń uczestnika"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SEKCJA: STREFA DLA ZAPISANYCH */}
              <div className="p-4 sm:p-5 bg-amber-500/10 rounded-2xl border border-amber-300 space-y-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl">🌟</span>
                    <label className="font-black text-amber-950 text-xs sm:text-sm uppercase tracking-wider block">
                      Strefa Uczestnika (Włączaj potrzebne opcje)
                    </label>
                  </div>
                  <p className="text-[11px] sm:text-xs text-amber-800 mt-0.5">Zaznacz checkboxy przy modułach, które mają być aktywne dla tego wydarzenia.</p>
                </div>

                {/* 1. WHATSAPP */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-amber-200 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.pokaz_whatsapp} 
                      onChange={(e) => setForm({...form, pokaz_whatsapp: e.target.checked})} 
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0" 
                    />
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wider">💬 Grupa WhatsApp</span>
                  </label>

                  {form.pokaz_whatsapp && (
                    <div className="pl-0 sm:pl-7 space-y-1">
                      <label className="font-bold text-slate-600 text-[11px] block uppercase">Link z zaproszeniem do grupy WhatsApp</label>
                      <input 
                        type="url" 
                        value={form.whatsapp_url} 
                        onChange={(e) => setForm({...form, whatsapp_url: e.target.value})} 
                        placeholder="https://chat.whatsapp.com/..." 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" 
                      />
                    </div>
                  )}
                </div>

                {/* 2. MIEJSCE ZBIÓRKI I GOOGLE MAPS */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-amber-200 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.pokaz_zbiorka} 
                      onChange={(e) => setForm({...form, pokaz_zbiorka: e.target.checked})} 
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0" 
                    />
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wider">📍 Miejsce zbiórki & Nawigacja Google Maps</span>
                  </label>

                  {form.pokaz_zbiorka && (
                    <div className="pl-0 sm:pl-7 space-y-3">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600 text-[11px] block uppercase">Opis miejsca i czas zbiórki</label>
                        <input 
                          type="text" 
                          value={form.zbiorka} 
                          onChange={(e) => setForm({...form, zbiorka: e.target.value})} 
                          placeholder="np. Parking pod klubem, godz. 06:30" 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-600 text-[11px] block uppercase">Dokładny link do lokalizacji na Google Maps (opcjonalnie)</label>
                        <input 
                          type="url" 
                          value={form.google_maps_url} 
                          onChange={(e) => setForm({...form, google_maps_url: e.target.value})} 
                          placeholder="https://maps.app.goo.gl/... lub https://google.com/maps/..." 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" 
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. EKWIPUNEK */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-amber-200 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.pokaz_ekwipunek} 
                      onChange={(e) => setForm({...form, pokaz_ekwipunek: e.target.checked})} 
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0" 
                    />
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wider">🎒 Co zabrać ze sobą (Ekwipunek / Checklista)</span>
                  </label>

                  {form.pokaz_ekwipunek && (
                    <div className="pl-0 sm:pl-7 space-y-1">
                      <textarea 
                        value={form.ekwipunek} 
                        onChange={(e) => setForm({...form, ekwipunek: e.target.value})} 
                        placeholder="- Buty do biegania w terenie&#10;- Strój kąpielowy i klapki&#10;- Wygodny strój sportowy" 
                        rows={3} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-amber-500 resize-none" 
                      />
                    </div>
                  )}
                </div>

                {/* 4. SZCZEGÓŁOWY PLAN */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-amber-200 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.pokaz_opis_strefy} 
                      onChange={(e) => setForm({...form, pokaz_opis_strefy: e.target.checked})} 
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0" 
                    />
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wider">📋 Szczegółowy plan wyjazdu & wytyczne</span>
                  </label>

                  {form.pokaz_opis_strefy && (
                    <div className="pl-0 sm:pl-7 space-y-1">
                      <textarea 
                        value={form.strefa_opis} 
                        onChange={(e) => setForm({...form, strefa_opis: e.target.value})} 
                        placeholder="Harmonogram poszczególnych dni, wytyczne, podział pokoi..." 
                        rows={3} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-amber-500 resize-none" 
                      />
                    </div>
                  )}
                </div>

                {/* 5. WIELE OBRAZKÓW PLANU WYJAZDU */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-amber-200 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.pokaz_plan_grafika} 
                      onChange={(e) => setForm({...form, pokaz_plan_grafika: e.target.checked})} 
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0" 
                    />
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wider">🗺️ Wiele grafik / plakatów planu wyjazdu</span>
                  </label>

                  {form.pokaz_plan_grafika && (
                    <div className="pl-0 sm:pl-7 space-y-3">
                      <input 
                        type="file" 
                        ref={planFileInputRef} 
                        onChange={handlePlanImagesUpload} 
                        accept="image/*" 
                        multiple 
                        className="hidden" 
                      />
                      <button 
                        type="button" 
                        onClick={() => planFileInputRef.current?.click()} 
                        className="w-full py-3 bg-amber-50 hover:bg-amber-100 border-2 border-dashed border-amber-300 rounded-xl font-bold text-xs text-amber-900 transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span>📁</span> Wybierz i dodaj zdjęcia planu (możesz zaznaczyć kilka)
                      </button>

                      {form.plan_grafiki.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                          {form.plan_grafiki.map((imgUrl, index) => (
                            <div key={index} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 h-24 group">
                              <img src={imgUrl} alt={`Plan ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                              <button 
                                type="button" 
                                onClick={() => handleRemovePlanImage(index)} 
                                className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black shadow-md cursor-pointer hover:bg-rose-700 transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 6. KOSZULKI TRENINGOWE */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-indigo-200 space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.pokaz_koszulki} 
                      onChange={(e) => setForm({...form, pokaz_koszulki: e.target.checked})} 
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0" 
                    />
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wider">👕 Koszulki treningowe (zamówienia / rozmiary)</span>
                  </label>

                  {form.pokaz_koszulki && (
                    <div className="pl-0 sm:pl-7 space-y-4">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600 text-[11px] block uppercase">Cena koszulki</label>
                          <input 
                            type="text" 
                            value={form.koszulki_cena} 
                            onChange={(e) => setForm({...form, koszulki_cena: e.target.value})} 
                            placeholder="np. 99 PLN" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600 text-[11px] block uppercase">Płatność do kiedy (termin)</label>
                          <input 
                            type="date" 
                            value={form.koszulki_termin} 
                            onChange={(e) => setForm({...form, koszulki_termin: e.target.value})} 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500" 
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-600 text-[11px] block uppercase">Informacje / instrukcja zamawiania</label>
                        <textarea 
                          value={form.koszulki_opis} 
                          onChange={(e) => setForm({...form, koszulki_opis: e.target.value})} 
                          placeholder="Wpisz wytyczne (np. rozmiary prosimy zgłaszać na recepcji lub w wiadomości)..." 
                          rows={2} 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500 resize-none" 
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-600 text-[11px] block uppercase">Obrazek główny koszulki (Wizualizacja)</label>
                        <input type="file" ref={koszulkaMainFileInputRef} onChange={handleKoszulkaMainUpload} accept="image/*" className="hidden" />
                        
                        <div 
                          onClick={() => koszulkaMainFileInputRef.current?.click()} 
                          className="w-full h-24 bg-slate-50 border-2 border-dashed border-indigo-200 rounded-xl flex items-center justify-center cursor-pointer hover:bg-indigo-50/50 transition-colors overflow-hidden relative p-2"
                        >
                          {form.koszulki_grafika_glowna ? (
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 text-center">
                              <span>✅</span> Grafika główna wgrana (kliknij, aby zmienić)
                            </div>
                          ) : (
                            <div className="text-xs font-bold text-indigo-700 text-center">
                              👕 Kliknij, aby wgrać główne zdjęcie koszulki
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="font-bold text-slate-600 text-[11px] block uppercase">Tabele rozmiarów / dodatkowe warianty</label>
                        <input 
                          type="file" 
                          ref={koszulkaExtraFileInputRef} 
                          onChange={handleKoszulkaExtraUpload} 
                          accept="image/*" 
                          multiple 
                          className="hidden" 
                        />
                        <button 
                          type="button" 
                          onClick={() => koszulkaExtraFileInputRef.current?.click()} 
                          className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 border-2 border-dashed border-indigo-300 rounded-xl font-bold text-xs text-indigo-900 transition-colors cursor-pointer flex items-center justify-center gap-2"
                        >
                          <span>📐</span> Dodaj tabele rozmiarów / warianty (wiele zdjęć)
                        </button>

                        {form.koszulki_grafiki.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                            {form.koszulki_grafiki.map((imgUrl, index) => (
                              <div key={index} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 h-24 group">
                                <img src={imgUrl} alt={`Rozmiar ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveKoszulkaExtraImage(index)} 
                                  className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black shadow-md cursor-pointer hover:bg-rose-700 transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>

              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={() => setIsAdminModalOpen(false)} className="w-full sm:flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer text-sm">
                  Anuluj
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className={`w-full sm:flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black px-4 py-3 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer text-sm flex items-center justify-center gap-2 ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isSaving ? "Zapisywanie..." : "Zapisz do bazy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
