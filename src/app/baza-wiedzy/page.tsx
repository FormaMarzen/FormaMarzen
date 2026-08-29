"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../raporty/klienci/supabase";

interface Suplement {
  id: number;
  nazwa: string;
  kategoria: string | string[];
  opis: string;
  dawkowanie?: string;
  dawkowanie_podstawowe?: string;
  dawkowanie_wyzsze?: string;
  grafika_url: string | null;
  created_at?: string;
}

interface ArtykulWiedzy {
  id: number;
  nazwa: string;
  kategoria: string | string[];
  wskazowki?: string;
  opis: string;
  grafika_url: string | null;
  created_at?: string;
}

interface Przepis {
  id: number;
  nazwa: string;
  kategoria: string;
  skladniki: string;
  przygotowanie: string;
  opis: string;
  kalorie?: number;
  bialko?: number;
  tluszcze?: number;
  weglowodany?: number;
  grafika_url?: string | null;
  autor_email?: string;
  autor_nazwa?: string;
  do_weryfikacji?: boolean;
  do_usuniecia?: boolean;
  created_at?: string;
}

interface Sugestia {
  id: number;
  nazwa: string;
  klient_email: string | null;
  status: string;
  created_at: string;
}

type TabType = "suplementy" | "sport" | "odzywianie" | "przepisy";

const KATEGORIE_SUPL = [
  { id: "witaminy", label: "🌱 Witaminy" },
  { id: "suplementy", label: "💊 Suplementy" },
  { id: "wytrzymalosc", label: "⚡ Wytrzymałość" },
  { id: "sila", label: "💥 Siła" },
];

const KATEGORIE_SPORT = [
  { id: "sila", label: "🏋️ Siła i Hipertrofia" },
  { id: "kondycja", label: "🏃 Kondycja i Wytrzymałość" },
  { id: "mobilnosc", label: "🧘 Mobilność i Rozciąganie" },
  { id: "regeneracja", label: "🔋 Regeneracja i Prewencja" },
];

const KATEGORIE_ODZYWIANIE = [
  { id: "dieta", label: "🥗 Zasady i Dieta" },
  { id: "makroskladniki", label: "🥩 Białka / Tłuszcze / Węgle" },
  { id: "nawodnienie", label: "💧 Nawodnienie i Elektrolity" },
  { id: "przepisy", label: "🍳 Porady i Posiłki" },
];

const KATEGORIE_PRZEPISY = [
  { id: "sniadanie", label: "🍳 Śniadanie" },
  { id: "obiad", label: "🍲 Obiad" },
  { id: "kolacja", label: "🌙 Kolacja" },
  { id: "deser", label: "🍰 Deser" },
  { id: "przekaska", label: "🍎 Przekąska" },
  { id: "inne", label: "📌 Inne" },
];

export default function BazaWiedzyPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userImieNazwisko, setUserImieNazwisko] = useState("Klubowicz");
  const [klienciMap, setKlienciMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("suplementy");

  // Tablice danych
  const [suplementy, setSuplementy] = useState<Suplement[]>([]);
  const [sportWpisy, setSportWpisy] = useState<ArtykulWiedzy[]>([]);
  const [odzywianieWpisy, setOdzywianieWpisy] = useState<ArtykulWiedzy[]>([]);
  const [przepisy, setPrzepisy] = useState<Przepis[]>([]);

  // Filtry i wyszukiwarka
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKategoria, setSelectedKategoria] = useState<string>("wszystkie");

  // Propozycje klubowiczów
  const [sugestie, setSugestie] = useState<Sugestia[]>([]);
  const [nowaSugestiaNazwa, setNowaSugestiaNazwa] = useState("");
  const [isSendingSugestia, setIsSendingSugestia] = useState(false);
  const [sugestiaSuccess, setSugestiaSuccess] = useState(false);

  // Modale podglądu i edycji
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [originatingSugestiaId, setOriginatingSugestiaId] = useState<number | null>(null);
  const [originatingSugestiaEmail, setOriginatingSugestiaEmail] = useState<string | null>(null);

  const [form, setForm] = useState({
    nazwa: "",
    kategorie: ["witaminy"] as string[],
    kategoriaPojedyncza: "sniadanie",
    opis: "",
    dawkowanie_podstawowe: "",
    dawkowanie_wyzsze: "",
    wskazowki: "",
    grafika_url: "" as string | null,
    skladniki: "",
    kalorie: "" as string | number,
    bialko: "" as string | number,
    tluszcze: "" as string | number,
    weglowodany: "" as string | number,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setSelectedKategoria("wszystkie");
    setSearchQuery("");
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const email = session?.user?.email || "";
    setUserEmail(email);

    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail === "maciejklaput@gmail.com" || cleanEmail === "maciejklaput@icloud.com") {
      setIsAdmin(true);
    }

    // Pobranie tabeli klientów z mapowaniem na imię i nazwisko
    const { data: klienciData } = await supabase.from("klienci").select("*");

    const newKlienciMap: Record<string, string> = {};
    let currentFullName = "";

    if (klienciData && Array.isArray(klienciData)) {
      klienciData.forEach((row: any) => {
        let imie = "";
        let nazwisko = "";
        let mail = "";

        Object.keys(row).forEach((colName) => {
          const lower = colName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          if (lower.includes("imi") || lower === "imie" || lower === "name") {
            imie = String(row[colName] || "").trim();
          }
          if (lower.includes("nazw") || lower === "nazwisko" || lower === "surname") {
            nazwisko = String(row[colName] || "").trim();
          }
          if (lower.includes("mail")) {
            mail = String(row[colName] || "").toLowerCase().trim();
          }
        });

        const full = `${imie} ${nazwisko}`.trim();
        if (mail && full) {
          newKlienciMap[mail] = full;
          if (mail === cleanEmail) {
            currentFullName = full;
          }
        }
      });
    }

    if (!currentFullName && (cleanEmail.includes("maciejklaput") || cleanEmail.includes("maciej"))) {
      currentFullName = "Maciej Kłaput";
      newKlienciMap["maciejklaput@gmail.com"] = "Maciej Kłaput";
      newKlienciMap["maciejklaput@icloud.com"] = "Maciej Kłaput";
    }

    setKlienciMap(newKlienciMap);
    setUserImieNazwisko(currentFullName || "Klubowicz");

    // 1. Suplementy
    const { data: suplData } = await supabase
      .from("suplementy")
      .select("*")
      .order("nazwa", { ascending: true });
    if (suplData) setSuplementy(suplData);

    // 2. Sport
    const { data: sportData } = await supabase
      .from("baza_sport")
      .select("*")
      .order("nazwa", { ascending: true });
    if (sportData) setSportWpisy(sportData);

    // 3. Odżywianie
    const { data: odzData } = await supabase
      .from("baza_odzywianie")
      .select("*")
      .order("nazwa", { ascending: true });
    if (odzData) setOdzywianieWpisy(odzData);

    // 4. Przepisy
    const { data: przData } = await supabase.from("baza_przepisow").select("*");
    if (przData) {
      const sortedPrzepisy = przData.sort((a, b) => {
        if (a.do_weryfikacji && !b.do_weryfikacji) return -1;
        if (!a.do_weryfikacji && b.do_weryfikacji) return 1;
        return (a.nazwa || "").localeCompare(b.nazwa || "", "pl");
      });
      setPrzepisy(sortedPrzepisy);
    }

    // 5. Propozycje oczekujące
    const { data: sugData } = await supabase
      .from("sugestie_suplementow")
      .select("*")
      .eq("status", "oczekujace")
      .order("created_at", { ascending: false });
    if (sugData) setSugestie(sugData);

    setIsLoading(false);
  };

  const getAutorDisplay = (item: Przepis) => {
    const emailKey = (item.autor_email || "").toLowerCase().trim();
    if (emailKey && klienciMap[emailKey]) {
      return klienciMap[emailKey];
    }
    if (emailKey.includes("maciejklaput")) {
      return "Maciej Kłaput";
    }
    if (item.autor_nazwa && !item.autor_nazwa.includes("@") && item.autor_nazwa !== "Klubowicz") {
      return item.autor_nazwa;
    }
    return "Klubowicz";
  };

  const parseCategories = (kategoria: string | string[] | undefined | null): string[] => {
    if (!kategoria) return [];
    if (Array.isArray(kategoria)) return kategoria;
    if (typeof kategoria === "string") {
      try {
        if (kategoria.startsWith("[")) {
          const parsed = JSON.parse(kategoria);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
      return kategoria
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
    }
    return [];
  };

  const currentCategoryList = useMemo(() => {
    if (activeTab === "suplementy") return KATEGORIE_SUPL;
    if (activeTab === "sport") return KATEGORIE_SPORT;
    if (activeTab === "odzywianie") return KATEGORIE_ODZYWIANIE;
    return KATEGORIE_PRZEPISY;
  }, [activeTab]);

  const currentFilteredList = useMemo(() => {
    let sourceList: any[] = [];
    if (activeTab === "suplementy") sourceList = suplementy;
    else if (activeTab === "sport") sourceList = sportWpisy;
    else if (activeTab === "odzywianie") sourceList = odzywianieWpisy;
    else sourceList = przepisy;

    const cleanQuery = searchQuery.toLowerCase().trim();

    return sourceList
      .filter((item) => {
        if (activeTab === "przepisy") {
          const matchesQuery = !cleanQuery || (item.nazwa && item.nazwa.toLowerCase().includes(cleanQuery));
          const matchesKat = selectedKategoria === "wszystkie" || item.kategoria === selectedKategoria;
          return matchesQuery && matchesKat;
        } else {
          const itemCats = parseCategories(item.kategoria);
          const matchesQuery = !cleanQuery || (item.nazwa && item.nazwa.toLowerCase().includes(cleanQuery));
          const matchesKat = selectedKategoria === "wszystkie" || itemCats.includes(selectedKategoria);
          return matchesQuery && matchesKat;
        }
      })
      .sort((a, b) => {
        if (activeTab === "przepisy") {
          if (a.do_weryfikacji && !b.do_weryfikacji) return -1;
          if (!a.do_weryfikacji && b.do_weryfikacji) return 1;
        }
        return (a.nazwa || "").localeCompare(b.nazwa || "", "pl");
      });
  }, [activeTab, suplementy, sportWpisy, odzywianieWpisy, przepisy, searchQuery, selectedKategoria]);

  const sendPushNotification = async (email: string, title: string, body: string, url: string = "/baza-wiedzy") => {
    try {
      const cleanTargetEmail = email.toLowerCase().trim();

      // 1. Zapis powiadomienia w tabeli bazy Supabase
      await supabase.from("powiadomienia").insert([
        {
          odbiorca_email: cleanTargetEmail,
          tytul: title,
          tresc: body,
          przeczytane: false,
          typ: "suplement_dodany",
          link: url,
        },
      ]);

      // 2. Wysłanie push przez webhook/endpoint API aplikacji (jeśli aktywny WebPush)
      await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanTargetEmail,
          title,
          body,
          url,
        }),
      }).catch(() => {});
    } catch (e) {
      console.error("Błąd wysyłania powiadomienia:", e);
    }
  };

  const handleWyslijSugestie = async (e: React.FormEvent) => {
    e.preventDefault();
    const nazwaWpisu = nowaSugestiaNazwa.trim();
    if (!nazwaWpisu) return;

    setIsSendingSugestia(true);
    const zglaszajacyEmail = userEmail || "anonim@klubowicz.pl";

    try {
      const { error } = await supabase.from("sugestie_suplementow").insert([
        {
          nazwa: nazwaWpisu,
          klient_email: zglaszajacyEmail,
          status: "oczekujace",
        },
      ]);

      if (!error) {
        setNowaSugestiaNazwa("");
        setSugestiaSuccess(true);
        setTimeout(() => setSugestiaSuccess(false), 5000);
        fetchData();
      } else {
        alert("Błąd podczas wysyłania: " + error.message);
      }
    } catch (err: any) {
      console.error("Błąd ogólny zgłaszania propozycji:", err);
    } finally {
      setIsSendingSugestia(false);
    }
  };

  const handleUsunSugestie = async (id: number) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tę propozycję?")) return;
    await supabase.from("sugestie_suplementow").delete().eq("id", id);
    setSugestie((prev) => prev.filter((s) => s.id !== id));
  };

  const handleQuickAddFromSugestia = (sugestia: Sugestia) => {
    setEditingId(null);
    setOriginatingSugestiaId(sugestia.id);
    setOriginatingSugestiaEmail(sugestia.klient_email || null);
    setForm({
      nazwa: sugestia.nazwa,
      kategorie: ["suplementy"],
      kategoriaPojedyncza: "sniadanie",
      opis: "",
      dawkowanie_podstawowe: "",
      dawkowanie_wyzsze: "",
      wskazowki: "",
      grafika_url: null,
      skladniki: "",
      kalorie: "",
      bialko: "",
      tluszcze: "",
      weglowodany: "",
    });
    setIsAdminModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setOriginatingSugestiaId(null);
    setOriginatingSugestiaEmail(null);
    const domyslnaKategoria = currentCategoryList[0]?.id || "sniadanie";
    setForm({
      nazwa: "",
      kategorie: [domyslnaKategoria],
      kategoriaPojedyncza: domyslnaKategoria,
      opis: "",
      dawkowanie_podstawowe: "",
      dawkowanie_wyzsze: "",
      wskazowki: "",
      grafika_url: null,
      skladniki: "",
      kalorie: "",
      bialko: "",
      tluszcze: "",
      weglowodany: "",
    });
    setIsAdminModalOpen(true);
  };

  const handleOpenEdit = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTab === "przepisy" && item.autor_email && item.autor_email !== userEmail && !isAdmin) {
      alert("Możesz edytować tylko przepisy dodane przez siebie!");
      return;
    }

    setEditingId(item.id);
    setOriginatingSugestiaId(null);
    setOriginatingSugestiaEmail(null);
    setForm({
      nazwa: item.nazwa,
      kategorie: parseCategories(item.kategoria),
      kategoriaPojedyncza: item.kategoria || "sniadanie",
      opis: item.opis || "",
      dawkowanie_podstawowe: item.dawkowanie_podstawowe || item.dawkowanie || "",
      dawkowanie_wyzsze: item.dawkowanie_wyzsze || "",
      wskazowki: item.wskazowki || "",
      grafika_url: item.grafika_url || null,
      skladniki: item.skladniki || "",
      kalorie: item.kalorie ?? "",
      bialko: item.bialko ?? "",
      tluszcze: item.tluszcze ?? "",
      weglowodany: item.weglowodany ?? "",
    });
    setIsAdminModalOpen(true);
  };

  const handleToggleCategory = (catId: string) => {
    setForm((prev) => {
      const exists = prev.kategorie.includes(catId);
      if (exists) {
        const updated = prev.kategorie.filter((c) => c !== catId);
        return { ...prev, kategorie: updated.length > 0 ? updated : [catId] };
      } else {
        return { ...prev, kategorie: [...prev.kategorie, catId] };
      }
    });
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) {
      alert("Tylko administrator może usuwać wpisy z bazy!");
      return;
    }
    if (!window.confirm("Czy na pewno chcesz trwale usunąć ten wpis?")) return;

    let tableName = "suplementy";
    if (activeTab === "sport") tableName = "baza_sport";
    else if (activeTab === "odzywianie") tableName = "baza_odzywianie";
    else if (activeTab === "przepisy") tableName = "baza_przepisow";

    await supabase.from(tableName).delete().eq("id", id);

    if (selectedItem?.id === id) {
      setIsViewModalOpen(false);
      setSelectedItem(null);
    }
    fetchData();
  };

  const handleZaznaczDoUsuniecia = async (id: number) => {
    const { error } = await supabase.from("baza_przepisow").update({ do_usuniecia: true }).eq("id", id);

    if (!error) {
      alert("Przepis został zgłoszony do usunięcia przez administratora.");
      setIsViewModalOpen(false);
      fetchData();
    } else {
      alert("Błąd: " + error.message);
    }
  };

  const handleZglosBlad = async (id: number) => {
    const { error } = await supabase.from("baza_przepisow").update({ do_weryfikacji: true }).eq("id", id);

    if (!error) {
      alert("Zgłoszono błąd w przepisie. Otrzymał on status 'Do weryfikacji' i został przeniesiony na górę listy.");
      setIsViewModalOpen(false);
      fetchData();
    } else {
      alert("Błąd: " + error.message);
    }
  };

  const handleZweryfikuj = async (id: number) => {
    const { error } = await supabase
      .from("baza_przepisow")
      .update({ do_weryfikacji: false, do_usuniecia: false })
      .eq("id", id);

    if (!error) {
      alert("Przepis został zweryfikowany i zatwierdzony!");
      setIsViewModalOpen(false);
      fetchData();
    } else {
      alert("Błąd: " + error.message);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              height *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.75);

          setForm((prev) => ({ ...prev, grafika_url: compressed }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTab === "przepisy") {
      if (!form.nazwa.trim()) {
        alert("Podaj nazwę przepisu!");
        return;
      }
      const b = Number(form.bialko) || 0;
      const t = Number(form.tluszcze) || 0;
      const w = Number(form.weglowodany) || 0;
      const k = Number(form.kalorie) || 0;

      const wyliczoneKcal = Math.round(b * 4 + t * 9 + w * 4);
      if (Math.abs(wyliczoneKcal - k) > 15) {
        alert(
          `Wpisane kalorie (${k} kcal) nie zgadzają się z wyliczonymi z makroskładników na porcję (${wyliczoneKcal} kcal: białko*4 + tłuszcz*9 + węgle*4). Sprawdź poprawność danych!`
        );
        return;
      }

      const maTekst = form.skladniki.trim().length > 0 && form.opis.trim().length > 0;
      const maZdjecie = Boolean(form.grafika_url);
      if (!maTekst && !maZdjecie) {
        alert("Musisz uzupełnić listę składników i sposób przygotowania LUB dodać zdjęcie przepisu!");
        return;
      }
    }

    let tableName = "suplementy";
    if (activeTab === "sport") tableName = "baza_sport";
    else if (activeTab === "odzywianie") tableName = "baza_odzywianie";
    else if (activeTab === "przepisy") tableName = "baza_przepisow";

    let payload: any = {
      nazwa: form.nazwa,
      kategoria: activeTab === "przepisy" ? form.kategoriaPojedyncza : form.kategorie.join(","),
      opis: form.opis,
      grafika_url: form.grafika_url,
    };

    if (activeTab === "suplementy") {
      payload.dawkowanie_podstawowe = form.dawkowanie_podstawowe;
      payload.dawkowanie_wyzsze = form.dawkowanie_wyzsze;
    } else if (activeTab === "przepisy") {
      payload.skladniki = form.skladniki;
      payload.kalorie = Number(form.kalorie) || 0;
      payload.bialko = Number(form.bialko) || 0;
      payload.tluszcze = Number(form.tluszcze) || 0;
      payload.weglowodany = Number(form.weglowodany) || 0;
      payload.autor_email = userEmail || "klubowicz@formamarzen.pl";
      payload.autor_nazwa = userImieNazwisko || "Klubowicz";
    } else {
      payload.wskazowki = form.wskazowki;
    }

    let error = null;
    if (editingId) {
      const res = await supabase.from(tableName).update(payload).eq("id", editingId);
      error = res.error;
    } else {
      const res = await supabase.from(tableName).insert([payload]);
      error = res.error;
    }

    if (error) {
      alert("Błąd zapisu do bazy Supabase: " + error.message);
      return;
    }

    // JEŚLI DODANO WPIS Z PROPOZYCJI KLUBOWICZA -> WYŚLIJ POWIADOMIENIE I ZMIEŃ STATUS
    if (originatingSugestiaId && originatingSugestiaEmail) {
      await supabase
        .from("sugestie_suplementow")
        .update({ status: "zaakceptowane" })
        .eq("id", originatingSugestiaId);

      await sendPushNotification(
        originatingSugestiaEmail,
        "Twój suplement został dodany! 💊",
        `Proponowany przez Ciebie suplement "${form.nazwa}" został zweryfikowany i dodany do Bazy Wiedzy!`
      );

      setOriginatingSugestiaId(null);
      setOriginatingSugestiaEmail(null);
    }

    setIsAdminModalOpen(false);
    fetchData();
  };

  const getKategoriaBadge = (kategoria: string) => {
    const all = [...KATEGORIE_SUPL, ...KATEGORIE_SPORT, ...KATEGORIE_ODZYWIANIE, ...KATEGORIE_PRZEPISY];
    const found = all.find((k) => k.id === kategoria);
    if (found) {
      return {
        label: found.label.replace(/^[\p{Emoji}\s]+/u, ""),
        icon: found.label.split(" ")[0],
        color: "bg-sky-50 text-sky-900 border-sky-200",
      };
    }
    return { label: kategoria, icon: "📌", color: "bg-slate-50 text-slate-800 border-slate-200" };
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64 text-sky-900 font-bold">Ładowanie Bazy Wiedzy...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 px-3 sm:px-0 font-sans antialiased">
      {/* NAGŁÓWEK GŁÓWNY */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-sky-200 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-sky-950 uppercase tracking-tight flex items-center gap-3">
            <span className="p-2 bg-amber-500 rounded-xl shadow-sm text-slate-900">📚</span>
            Baza Wiedzy
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium max-w-2xl">
            Kompendium wiedzy treningowej, suplementacji, zdrowego odżywiania oraz przepisów dla klubowiczów.
          </p>
        </div>

        {(isAdmin || activeTab === "przepisy") && (
          <button
            onClick={handleOpenAdd}
            className="bg-sky-900 hover:bg-sky-950 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>+</span> DODAJ {activeTab === "przepisy" ? "PRZEPIS" : "WPIS"}
          </button>
        )}
      </div>

      {/* SYSTEM 4 ZAKŁADEK */}
      <div className="flex items-center gap-2 flex-wrap border-b border-slate-200 pb-4">
        <button
          onClick={() => setActiveTab("suplementy")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === "suplementy"
              ? "bg-sky-900 text-white shadow-md shadow-sky-900/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>💊</span> Suplementy i Witaminy
        </button>

        <button
          onClick={() => setActiveTab("sport")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === "sport"
              ? "bg-sky-900 text-white shadow-md shadow-sky-900/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>🏋️</span> Sport i Trening
        </button>

        <button
          onClick={() => setActiveTab("odzywianie")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === "odzywianie"
              ? "bg-sky-900 text-white shadow-md shadow-sky-900/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>🥗</span> Odżywianie i Dieta
        </button>

        <button
          onClick={() => setActiveTab("przepisy")}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === "przepisy"
              ? "bg-sky-900 text-white shadow-md shadow-sky-900/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>🍳</span> Przepisy
        </button>
      </div>

      {/* ZAWARTOŚĆ STRONY */}
      <div className="space-y-6">
        {activeTab === "suplementy" && (
          <>
            <div className="bg-amber-50 border-2 border-amber-300/80 rounded-3xl p-5 sm:p-6 shadow-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-xl shrink-0 shadow-sm">
                ⚠️
              </div>
              <div className="space-y-1.5 text-xs text-amber-950 leading-relaxed">
                <h4 className="font-black uppercase tracking-wider text-[11px] text-amber-900 flex items-center gap-1.5">
                  Ważna informacja prawno-medyczna
                </h4>
                <p className="font-medium text-slate-700">
                  Informacje publikowane w Bazie Wiedzy mają charakter{" "}
                  <strong className="font-bold text-slate-900">wyłącznie edukacyjny i informacyjny</strong> i nie stanowią porady medycznej.
                </p>
              </div>
            </div>

            {/* PANEL DLA ADMINISTRATORA - OCZEKUJĄCE PROPOZYCJE */}
            {isAdmin && sugestie.length > 0 && (
              <div className="bg-sky-950 text-white rounded-3xl p-5 sm:p-6 shadow-md space-y-4 border border-sky-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🔔</span>
                    <h3 className="font-black text-sm sm:text-base uppercase tracking-wider text-amber-400">
                      Oczekujące propozycje suplementów od Klubowiczów ({sugestie.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-300">Po kliknięciu „Dodaj” klubowicz otrzyma Push!</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sugestie.map((sug) => {
                    const cleanMail = (sug.klient_email || "").toLowerCase().trim();
                    const zglaszajacy = klienciMap[cleanMail] || sug.klient_email || "Klubowicz";
                    return (
                      <div
                        key={sug.id}
                        className="bg-slate-900/90 border border-sky-800/80 p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-inner"
                      >
                        <div>
                          <div className="font-black text-amber-400 text-base">{sug.nazwa}</div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Zgłosił: <span className="text-slate-200 font-bold">{zglaszajacy}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-sky-900">
                          <button
                            onClick={() => handleQuickAddFromSugestia(sug)}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-2 px-3 rounded-xl transition-all shadow-sm cursor-pointer text-center"
                          >
                            + Dodaj do bazy
                          </button>
                          <button
                            onClick={() => handleUsunSugestie(sug.id)}
                            className="bg-rose-900/50 hover:bg-rose-900 text-rose-300 p-2 rounded-xl text-xs transition-colors cursor-pointer"
                            title="Odrzuć propozycję"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* FORMULARZ ZGŁASZANIA DLA KLUBOWICZÓW */}
            <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200/80 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center md:text-left">
                <h4 className="font-black text-sky-950 text-sm uppercase tracking-wide flex items-center justify-center md:justify-start gap-2">
                  <span>💡</span> Nie znalazłeś suplementu na liście?
                </h4>
                <p className="text-xs text-slate-600 font-medium">
                  Zaproponuj nazwę – po dodaniu przez trenera otrzymasz natychmiastowe powiadomienie Push!
                </p>
              </div>
              <form onSubmit={handleWyslijSugestie} className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="text"
                  required
                  placeholder="Wpisz nazwę suplementu..."
                  value={nowaSugestiaNazwa}
                  onChange={(e) => setNowaSugestiaNazwa(e.target.value)}
                  className="bg-white border border-sky-300 rounded-xl px-4 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-600 w-full md:w-64"
                />
                <button
                  type="submit"
                  disabled={isSendingSugestia}
                  className="bg-sky-900 hover:bg-sky-950 text-white text-xs font-black px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isSendingSugestia ? "Wysyłanie..." : "Zaproponuj"}
                </button>
              </form>
            </div>
            {sugestiaSuccess && (
              <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-2xl text-center animate-in fade-in">
                ✅ Dziękujemy! Twoja propozycja została przesłana. Otrzymasz powiadomienie, gdy tylko pojawi się w Bazie Wiedzy.
              </div>
            )}
          </>
        )}

        {/* WYSZUKIWARKA I KATEGORIE */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-sky-100 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder={
                  activeTab === "suplementy"
                    ? "Szukaj suplementu..."
                    : activeTab === "sport"
                    ? "Szukaj ćwiczenia..."
                    : activeTab === "odzywianie"
                    ? "Szukaj artykułu..."
                    : "Szukaj przepisu po nazwie..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500 transition-colors"
              />
              <span className="absolute left-3.5 top-2.5 text-slate-400">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap justify-center w-full md:w-auto">
              <span className="text-[11px] font-black uppercase text-slate-400 mr-1 hidden sm:inline">Kategoria:</span>
              <button
                onClick={() => setSelectedKategoria("wszystkie")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedKategoria === "wszystkie"
                    ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Wszystkie
              </button>
              {currentCategoryList.map((kat) => (
                <button
                  key={kat.id}
                  onClick={() => setSelectedKategoria(kat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedKategoria === kat.id
                      ? "bg-amber-500 text-slate-950 font-black shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {kat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TABELA DANYCH */}
        {currentFilteredList.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-sky-100 border-dashed">
            <div className="text-5xl mb-4">
              {activeTab === "suplementy" ? "🧪" : activeTab === "sport" ? "🏋️" : "🥗"}
            </div>
            <h3 className="text-lg font-black text-sky-950 mb-1">Brak wyników</h3>
            <p className="text-slate-500 text-sm">Nie znaleziono pozycji spełniających podane kryteria.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-sky-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-sky-50/60 border-b border-sky-100 text-[11px] font-black uppercase tracking-wider text-sky-900">
                    <th className="py-4 px-6">{activeTab === "przepisy" ? "Nazwa przepisu" : "Nazwa / Tytuł"}</th>
                    <th className="py-4 px-6 hidden sm:table-cell">Kategoria</th>
                    <th className="py-4 px-6 hidden md:table-cell">
                      {activeTab === "suplementy"
                        ? "Dawkowanie"
                        : activeTab === "przepisy"
                        ? "Makro na porcję (B / T / W / Kcal)"
                        : "Kluczowe wskazówki"}
                    </th>
                    <th className="py-4 px-6 text-right">Akcja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {currentFilteredList.map((item) => {
                    const itemCats = parseCategories(item.kategoria);
                    const podstawowe = item.dawkowanie_podstawowe || item.dawkowanie || "";
                    const wyzsze = item.dawkowanie_wyzsze || "";
                    const wskazowki = item.wskazowki || "";
                    const autorWyswietlany = activeTab === "przepisy" ? getAutorDisplay(item) : "";

                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(item);
                          setIsViewModalOpen(true);
                        }}
                        className={`hover:bg-sky-50/40 transition-colors cursor-pointer group ${
                          item.do_weryfikacji ? "bg-amber-50/60" : ""
                        }`}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-4">
                            {activeTab !== "przepisy" && (
                              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                                {item.grafika_url ? (
                                  <img src={item.grafika_url} alt={item.nazwa} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xl opacity-60">
                                    {activeTab === "suplementy" ? "💊" : activeTab === "sport" ? "🏋️" : "🥗"}
                                  </span>
                                )}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="font-black text-sky-950 text-base group-hover:text-sky-700 transition-colors">
                                  {item.nazwa}
                                </div>
                                {item.do_weryfikacji && (
                                  <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse">
                                    ⚠️ Do weryfikacji
                                  </span>
                                )}
                                {item.do_usuniecia && (
                                  <span className="bg-rose-500 text-white font-black text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider">
                                    🗑️ Do usunięcia
                                  </span>
                                )}
                              </div>
                              {activeTab === "przepisy" && (
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Dodane przez: <span className="font-bold text-slate-600">{autorWyswietlany}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6 hidden sm:table-cell">
                          {activeTab === "przepisy" ? (
                            <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-xl border bg-sky-50 text-sky-900 border-sky-200">
                              {getKategoriaBadge(item.kategoria).label}
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-w-xs">
                              {itemCats.map((catKey) => {
                                const badge = getKategoriaBadge(catKey);
                                return (
                                  <span
                                    key={catKey}
                                    className={`inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-xl border ${badge.color}`}
                                  >
                                    <span>{badge.icon}</span> {badge.label}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-6 hidden md:table-cell">
                          {activeTab === "suplementy" ? (
                            <div className="space-y-1 max-w-xs">
                              <div className="text-xs font-medium text-slate-700 truncate">
                                {podstawowe ? (
                                  <span>
                                    <strong className="text-slate-900 font-bold">Podstawowe:</strong> {podstawowe}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </div>
                            </div>
                          ) : activeTab === "przepisy" ? (
                            <div className="text-xs font-bold text-slate-700">
                              <span className="text-sky-900">B: {item.bialko || 0}g</span> |{" "}
                              <span className="text-amber-700">T: {item.tluszcze || 0}g</span> |{" "}
                              <span className="text-emerald-700">W: {item.weglowodany || 0}g</span> |{" "}
                              <span className="text-slate-900 font-black">{item.kalorie || 0} kcal</span>
                            </div>
                          ) : (
                            <div className="text-xs font-medium text-slate-600 line-clamp-2 max-w-xs">
                              {wskazowki || "—"}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(isAdmin || (activeTab === "przepisy" && item.autor_email === userEmail)) && (
                              <button
                                onClick={(e) => handleOpenEdit(item, e)}
                                className="w-8 h-8 flex items-center justify-center bg-sky-100 text-sky-800 rounded-lg hover:bg-sky-200 transition-colors cursor-pointer text-xs"
                                title="Edytuj"
                              >
                                ✏️
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={(e) => handleDelete(item.id, e)}
                                className="w-8 h-8 flex items-center justify-center bg-rose-100 text-rose-800 rounded-lg hover:bg-rose-200 transition-colors cursor-pointer text-xs"
                                title="Usuń"
                              >
                                🗑️
                              </button>
                            )}
                            <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-700 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-900 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL PODGLĄDU */}
      {isViewModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-50 rounded-[2rem] max-w-3xl w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 my-auto max-h-[90vh] flex flex-col">
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="absolute top-4 right-4 z-30 bg-white hover:bg-slate-100 text-slate-900 w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg cursor-pointer font-black text-lg"
            >
              ✕
            </button>

            <div className="overflow-y-auto p-6 sm:p-10 space-y-6 flex-1">
              {activeTab === "przepisy" && selectedItem.grafika_url && (
                <div
                  onClick={() => setZoomedImage(selectedItem.grafika_url)}
                  className="w-full bg-slate-900 rounded-2xl relative flex justify-center items-center overflow-hidden mb-4 cursor-zoom-in group shadow-md"
                  style={{ minHeight: "220px", maxHeight: "40vh" }}
                  title="Kliknij, aby powiększyć zdjęcie"
                >
                  <img
                    src={selectedItem.grafika_url}
                    alt={selectedItem.nazwa}
                    className="w-full h-full object-contain max-h-[40vh] group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-3 right-3 bg-slate-950/70 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl backdrop-blur-sm flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                    <span>🔍</span> Kliknij, aby powiększyć
                  </div>
                </div>
              )}

              <div className="text-center">
                <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
                  {selectedItem.do_weryfikacji && (
                    <span className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1 rounded-lg uppercase tracking-wider">
                      ⚠️ Wymaga weryfikacji (Zgłoszono błąd)
                    </span>
                  )}
                  {selectedItem.do_usuniecia && (
                    <span className="bg-rose-500 text-white font-black text-xs px-3 py-1 rounded-lg uppercase tracking-wider">
                      🗑️ Zgłoszono do usunięcia
                    </span>
                  )}
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-sky-950 leading-tight uppercase tracking-tight">
                  {selectedItem.nazwa}
                </h2>
                {activeTab === "przepisy" && (
                  <div className="text-xs text-slate-500 mt-1 font-medium">
                    Dodane przez: <span className="font-bold text-slate-800">{getAutorDisplay(selectedItem)}</span>
                  </div>
                )}
                <div className="w-16 h-1.5 bg-amber-500 mx-auto mt-4 rounded-full"></div>
              </div>

              {activeTab === "przepisy" && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl text-center">
                      <div className="text-[11px] font-black uppercase text-sky-900">Białko / porcja</div>
                      <div className="text-lg font-black text-sky-950 mt-1">{selectedItem.bialko || 0}g</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-center">
                      <div className="text-[11px] font-black uppercase text-amber-900">Tłuszcze / porcja</div>
                      <div className="text-lg font-black text-sky-950 mt-1">{selectedItem.tluszcze || 0}g</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center">
                      <div className="text-[11px] font-black uppercase text-emerald-900">Węgle / porcja</div>
                      <div className="text-lg font-black text-sky-950 mt-1">{selectedItem.weglowodany || 0}g</div>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl text-center">
                      <div className="text-[11px] font-black uppercase text-indigo-900">Kalorie / porcja</div>
                      <div className="text-lg font-black text-sky-950 mt-1">{selectedItem.kalorie || 0} kcal</div>
                    </div>
                  </div>

                  {selectedItem.skladniki && (
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                      <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span>🛒</span> Składniki
                      </h3>
                      <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                        {selectedItem.skladniki}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span>📝</span> {activeTab === "przepisy" ? "Sposób przygotowania" : "Opis"}
                </h3>
                <div className="text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedItem.opis || "Brak opisu."}
                </div>
              </div>

              {/* PRZYCISKI AKCJI DLA PRZEPISÓW */}
              {activeTab === "przepisy" && (
                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 pb-2">
                  <button
                    type="button"
                    onClick={() => handleZglosBlad(selectedItem.id)}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-black text-xs px-5 py-3 rounded-xl transition-all shadow-sm uppercase tracking-wider cursor-pointer flex items-center gap-2"
                  >
                    <span>🚨</span> BŁĄD W PRZEPISIE
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    {isAdmin && selectedItem.do_weryfikacji && (
                      <button
                        type="button"
                        onClick={() => handleZweryfikuj(selectedItem.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-3 rounded-xl transition-all shadow-sm uppercase tracking-wider cursor-pointer flex items-center gap-2"
                      >
                        <span>✅</span> Zweryfikuj / Zatwierdź
                      </button>
                    )}

                    {selectedItem.autor_email === userEmail && !selectedItem.do_usuniecia && (
                      <button
                        type="button"
                        onClick={() => handleZaznaczDoUsuniecia(selectedItem.id)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-xs px-4 py-3 rounded-xl transition-colors cursor-pointer"
                      >
                        🗑️ Zaznacz do usunięcia
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(selectedItem.id, e)}
                        className="bg-rose-100 hover:bg-rose-200 text-rose-800 font-black text-xs px-4 py-3 rounded-xl transition-colors cursor-pointer"
                      >
                        🗑️ Usuń całkowicie
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL POWIĘKSZONEGO ZDJĘCIA */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-slate-950/95 z-[60] flex items-center justify-center p-3 sm:p-6 backdrop-blur-md cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <button
            onClick={() => setZoomedImage(null)}
            className="absolute top-5 right-5 bg-white/10 hover:bg-white/20 text-white w-11 h-11 rounded-full flex items-center justify-center transition-colors font-black text-xl cursor-pointer"
          >
            ✕
          </button>
          <img
            src={zoomedImage}
            alt="Powiększone zdjęcie przepisu"
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* MODAL DODAWANIA / EDYCJI */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative border-2 border-sky-900 my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAdminModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-lg z-10 bg-white/90 w-8 h-8 rounded-full flex items-center justify-center shadow"
            >
              ✕
            </button>

            <div className="mb-6">
              <h3 className="font-black text-2xl text-sky-950 leading-tight">
                {editingId ? "Edytuj wpis" : "Nowy wpis"}: {activeTab.toUpperCase()}
              </h3>
              {originatingSugestiaEmail && (
                <p className="text-xs text-amber-700 font-bold mt-1">
                  💡 Dodajesz pozycję z propozycji klubowicza ({originatingSugestiaEmail}). Po zapisaniu otrzyma on powiadomienie push.
                </p>
              )}
            </div>

            <form onSubmit={handleSaveItem} className="space-y-5">
              <div className="space-y-2">
                <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider">
                  Zdjęcie / Grafika {activeTab === "przepisy" ? "(opcjonalnie zamiast tekstu składników/przygotowania)" : ""}
                </label>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-36 bg-sky-50 border-2 border-dashed border-sky-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-sky-100 transition-colors overflow-hidden relative"
                >
                  {form.grafika_url ? (
                    <>
                      <img src={form.grafika_url} className="w-full h-full object-cover opacity-60" alt="Preview" />
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-sky-900 drop-shadow-md">
                        Kliknij, aby zmienić zdjęcie
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl mb-1">📸</span>
                      <span className="text-xs font-bold text-sky-700">Wybierz zdjęcie z dysku</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider text-center sm:text-left">
                  Kategoria {activeTab === "przepisy" ? "(wybierz jedną)" : ""}
                </label>
                {activeTab === "przepisy" ? (
                  <div className="flex flex-wrap justify-center gap-2.5">
                    {KATEGORIE_PRZEPISY.map((kat) => {
                      const isSelected = form.kategoriaPojedyncza === kat.id;
                      return (
                        <button
                          type="button"
                          key={kat.id}
                          onClick={() => setForm({ ...form, kategoriaPojedyncza: kat.id })}
                          className={`py-3 px-4 rounded-2xl border-2 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 w-[calc(50%-6px)] sm:w-[calc(33%-10px)] max-w-[200px] ${
                            isSelected
                              ? "border-amber-500 bg-amber-50 text-amber-950 shadow-sm"
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <span>{kat.label}</span>
                          {isSelected && <span className="text-amber-600">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {currentCategoryList.map((kat) => {
                      const isSelected = form.kategorie.includes(kat.id);
                      return (
                        <button
                          type="button"
                          key={kat.id}
                          onClick={() => handleToggleCategory(kat.id)}
                          className={`py-3 px-3 rounded-2xl border-2 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                            isSelected
                              ? "border-amber-500 bg-amber-50 text-amber-950 shadow-sm"
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <span>{kat.label}</span>
                          {isSelected && <span className="text-amber-600">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider">
                  Tytuł / Nazwa *
                </label>
                <input
                  type="text"
                  required
                  value={form.nazwa}
                  onChange={(e) => setForm({ ...form, nazwa: e.target.value })}
                  placeholder={activeTab === "przepisy" ? "np. Owsianka wysokobiałkowa z bananem" : "np. Kreatyna Monohydrat"}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              {activeTab === "przepisy" && (
                <div className="space-y-4 bg-sky-50/60 p-4 rounded-2xl border border-sky-100">
                  <h4 className="font-black text-xs uppercase text-sky-900 tracking-wider">
                    Makroskładniki i kalorie (wartości podawane na porcję)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Białko (g) / porcja</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.bialko}
                        onFocus={(e) => {
                          if (e.target.value === "0") setForm({ ...form, bialko: "" });
                        }}
                        onChange={(e) => setForm({ ...form, bialko: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Tłuszcze (g) / porcja</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.tluszcze}
                        onFocus={(e) => {
                          if (e.target.value === "0") setForm({ ...form, tluszcze: "" });
                        }}
                        onChange={(e) => setForm({ ...form, tluszcze: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Węgle (g) / porcja</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.weglowodany}
                        onFocus={(e) => {
                          if (e.target.value === "0") setForm({ ...form, weglowodany: "" });
                        }}
                        onChange={(e) => setForm({ ...form, weglowodany: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Kalorie (kcal) / porcja</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.kalorie}
                        onFocus={(e) => {
                          if (e.target.value === "0") setForm({ ...form, kalorie: "" });
                        }}
                        onChange={(e) => setForm({ ...form, kalorie: e.target.value === "" ? "" : Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-sky-900 font-medium">
                    * System weryfikuje poprawność (Białko×4 + Tłuszcz×9 + Węgle×4 = Kalorie).
                  </p>

                  <div className="space-y-1 pt-2">
                    <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider">
                      Lista składników (lub zdjęcie powyżej)
                    </label>
                    <textarea
                      value={form.skladniki}
                      onChange={(e) => setForm({ ...form, skladniki: e.target.value })}
                      placeholder="- 50g płatków owsianych&#10;- 30g odżywki białkowej..."
                      rows={3}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              )}

              {activeTab === "suplementy" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider">
                      1. Dawkowanie podstawowe
                    </label>
                    <input
                      type="text"
                      value={form.dawkowanie_podstawowe}
                      onChange={(e) => setForm({ ...form, dawkowanie_podstawowe: e.target.value })}
                      placeholder="np. 1 kapsułka rano"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider">
                      2. Dawkowanie wyższe
                    </label>
                    <input
                      type="text"
                      value={form.dawkowanie_wyzsze}
                      onChange={(e) => setForm({ ...form, dawkowanie_wyzsze: e.target.value })}
                      placeholder="np. 10g w dni treningowe"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800"
                    />
                  </div>
                </div>
              )}

              {activeTab === "sport" && (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider">
                    Kluczowe wskazówki / Podsumowanie
                  </label>
                  <input
                    type="text"
                    value={form.wskazowki}
                    onChange={(e) => setForm({ ...form, wskazowki: e.target.value })}
                    placeholder="np. 3-4 serie po 6-8 powtórzeń"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider">
                  {activeTab === "przepisy" ? "Sposób przygotowania (lub zdjęcie powyżej)" : "Treść artykułu / Opis szczegółowy *"}
                </label>
                <textarea
                  required={activeTab !== "przepisy"}
                  value={form.opis}
                  onChange={(e) => setForm({ ...form, opis: e.target.value })}
                  placeholder={
                    activeTab === "przepisy"
                      ? "Opisz krok po kroku jak przygotować posiłek..."
                      : "Wpisz pełny opis, badania i wskazówki..."
                  }
                  rows={6}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3.5 rounded-xl transition-colors cursor-pointer text-sm"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black px-4 py-3.5 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer text-sm"
                >
                  Zapisz do bazy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
