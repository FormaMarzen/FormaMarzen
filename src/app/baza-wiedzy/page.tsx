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
  kategoria: string | string[];
  skladniki: string;
  przygotowanie: string;
  kalorie?: number;
  bialko?: number;
  tluszcze?: number;
  weglowodany?: number;
  autor_email?: string;
  created_at?: string;
}

interface ProduktSpozywczy {
  id?: number;
  kod_kreskowy?: string;
  nazwa: string;
  kalorie_100g: number;
  bialko_100g: number;
  tluszcze_100g: number;
  weglowodany_100g: number;
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
  { id: "przekaska", label: "🍎 Przekąska" },
  { id: "deser", label: "🍰 Deser" },
  { id: "inne", label: "📌 Inne" },
];

export default function BazaWiedzyPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState("");
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

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [originatingSugestiaId, setOriginatingSugestiaId] = useState<number | null>(null);
  const [originatingSugestiaEmail, setOriginatingSugestiaEmail] = useState<string | null>(null);

  const [form, setForm] = useState({
    nazwa: "",
    kategorie: ["witaminy"] as string[],
    opis: "",
    dawkowanie_podstawowe: "",
    dawkowanie_wyzsze: "",
    wskazowki: "",
    grafika_url: "" as string | null,
    skladniki: "",
    kalorie: 0,
    bialko: 0,
    tluszcze: 0,
    weglowodany: 0,
  });

  // Stan dla Skanera Kodów i Produktów / Open Food Facts
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [produktForm, setProduktForm] = useState<ProduktSpozywczy>({
    nazwa: "",
    kalorie_100g: 0,
    bialko_100g: 0,
    tluszcze_100g: 0,
    weglowodany_100g: 0,
  });
  const [produktSuccessMsg, setProduktSuccessMsg] = useState("");

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

    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email || "";
    setUserEmail(email);

    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail === "maciejklaput@gmail.com" || cleanEmail === "maciejklaput@icloud.com") {
      setIsAdmin(true);
    }

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
    const { data: przData } = await supabase
      .from("baza_przepisow")
      .select("*")
      .order("nazwa", { ascending: true });
    if (przData) setPrzepisy(przData);

    // 5. Propozycje
    const { data: sugData } = await supabase
      .from("sugestie_suplementow")
      .select("*")
      .eq("status", "oczekujace")
      .order("created_at", { ascending: false });
    if (sugData) setSugestie(sugData);

    setIsLoading(false);
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
      return kategoria.split(",").map((k) => k.trim()).filter(Boolean);
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
        const itemCats = parseCategories(item.kategoria);
        const matchesQuery = !cleanQuery || (item.nazwa && item.nazwa.toLowerCase().includes(cleanQuery));
        const matchesKat = selectedKategoria === "wszystkie" || itemCats.includes(selectedKategoria);
        return matchesQuery && matchesKat;
      })
      .sort((a, b) => (a.nazwa || "").localeCompare(b.nazwa || "", "pl"));
  }, [activeTab, suplementy, sportWpisy, odzywianieWpisy, przepisy, searchQuery, selectedKategoria]);

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
        try {
          await fetch("/api/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "📬 Nowa propozycja w Bazie Wiedzy",
              body: `Klubowicz (${zglaszajacyEmail}) poprosił o dodanie: ${nazwaWpisu}`,
              url: "/baza-wiedzy",
              target: "admin",
              target_group: "admin",
            }),
          });
        } catch (pushErr) {
          console.error("Błąd wysyłki powiadomienia push:", pushErr);
        }

        try {
          await supabase.from("historia_powiadomien").insert([
            {
              odbiorca: "Administratorzy (1 urządz.)",
              tytul: "Nowa propozycja suplementu",
              tresc: `Klubowicz (${zglaszajacyEmail}) zgłosił propozycję: ${nazwaWpisu}`,
              created_at: new Date().toISOString(),
            },
          ]);
        } catch (hErr) {
          console.error("Błąd zapisu w historii powiadomień:", hErr);
        }

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
      opis: "",
      dawkowanie_podstawowe: "",
      dawkowanie_wyzsze: "",
      wskazowki: "",
      grafika_url: null,
      skladniki: "",
      kalorie: 0,
      bialko: 0,
      tluszcze: 0,
      weglowodany: 0,
    });
    setIsAdminModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setOriginatingSugestiaId(null);
    setOriginatingSugestiaEmail(null);
    const domyslnaKategoria = currentCategoryList[0]?.id || "ogolne";
    setForm({
      nazwa: "",
      kategorie: [domyslnaKategoria],
      opis: "",
      dawkowanie_podstawowe: "",
      dawkowanie_wyzsze: "",
      wskazowki: "",
      grafika_url: null,
      skladniki: "",
      kalorie: 0,
      bialko: 0,
      tluszcze: 0,
      weglowodany: 0,
    });
    setIsAdminModalOpen(true);
  };

  const handleOpenEdit = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setOriginatingSugestiaId(null);
    setOriginatingSugestiaEmail(null);
    setForm({
      nazwa: item.nazwa,
      kategorie: parseCategories(item.kategoria),
      opis: item.opis || "",
      dawkowanie_podstawowe: item.dawkowanie_podstawowe || item.dawkowanie || "",
      dawkowanie_wyzsze: item.dawkowanie_wyzsze || "",
      wskazowki: item.wskazowki || "",
      grafika_url: item.grafika_url || null,
      skladniki: item.skladniki || "",
      kalorie: item.kalorie || 0,
      bialko: item.bialko || 0,
      tluszcze: item.tluszcze || 0,
      weglowodany: item.weglowodany || 0,
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
    if (!window.confirm("Czy na pewno chcesz usunąć ten wpis z bazy wiedzy?")) return;

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
              width *= MAX_HEIGHT / height;
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

    // Walidacja wymaganych pól dla przepisów
    if (activeTab === "przepisy") {
      if (!form.nazwa.trim() || !form.skladniki.trim() || !form.opis.trim()) {
        alert("Wypełnij wymagane pola: Nazwa, Składniki oraz Sposób przygotowania!");
        return;
      }
    }

    let tableName = "suplementy";
    if (activeTab === "sport") tableName = "baza_sport";
    else if (activeTab === "odzywianie") tableName = "baza_odzywianie";
    else if (activeTab === "przepisy") tableName = "baza_przepisow";

    let payload: any = {
      nazwa: form.nazwa,
      kategoria: form.kategorie.join(","),
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
    } else {
      payload.wskazowki = form.wskazowki;
    }

    if (editingId) {
      await supabase.from(tableName).update(payload).eq("id", editingId);
    } else {
      await supabase.from(tableName).insert([payload]);

      if (originatingSugestiaId && activeTab === "suplementy") {
        await supabase.from("sugestie_suplementow").delete().eq("id", originatingSugestiaId);

        if (originatingSugestiaEmail && !originatingSugestiaEmail.includes("anonim")) {
          try {
            const { data: klientData } = await supabase
              .from("klienci")
              .select("id, imie, email")
              .ilike("email", originatingSugestiaEmail.trim())
              .maybeSingle();

            const wiadomoscTresc = `Cześć! Informacje o suplemencie, o który pytałeś (${form.nazwa}), zostały właśnie opracowane i dodane do Bazy Wiedzy. Sprawdź szczegóły, działanie i dawkowanie w zakładce Baza Wiedzy! 💊`;

            await supabase.from("czat_wiadomosci").insert([
              {
                odbiorca_id: klientData?.id || null,
                nadawca_id: null,
                nadawca_nazwa: "Administrator (Forma Marzeń)",
                nadawca_avatar: null,
                tresc: wiadomoscTresc,
                przeczytana: false,
                created_at: new Date().toISOString(),
              },
            ]);

            await fetch("/api/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: "📚 Baza Wiedzy uzupełniona!",
                body: `Dodano informacje o suplemencie: ${form.nazwa}`,
                url: "/baza-wiedzy",
                user_email: originatingSugestiaEmail,
                klient_id: klientData?.id || null,
              }),
            });
          } catch (chatErr) {
            console.error("Błąd powiadamiania na czacie:", chatErr);
          }
        }
      }
    }

    setIsAdminModalOpen(false);
    fetchData();
  };

  // Obsługa skanera kodów kreskowych i Open Food Facts API
  const handleSearchBarcode = async (barcodeToSearch?: string) => {
    const code = barcodeToSearch || barcodeInput;
    if (!code.trim()) return;

    setIsScanning(true);
    setProduktSuccessMsg("");

    try {
      // 1. Sprawdź najpierw w naszej bazie Supabase
      const { data: localProd } = await supabase
        .from("produkty_spozywcze")
        .select("*")
        .eq("kod_kreskowy", code.trim())
        .maybeSingle();

      if (localProd) {
        setProduktForm({
          kod_kreskowy: localProd.kod_kreskowy,
          nazwa: localProd.nazwa,
          kalorie_100g: localProd.kalorie_100g || 0,
          bialko_100g: localProd.bialko_100g || 0,
          tluszcze_100g: localProd.tluszcze_100g || 0,
          weglowodany_100g: localProd.weglowodany_100g || 0,
        });
        setProduktSuccessMsg("Znaleziono produkt w lokalnej bazie!");
        setIsScanning(false);
        return;
      }

      // 2. Jeśli brak w bazie, odpytaj Open Food Facts API
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code.trim()}.json`);
      const data = await res.json();

      if (data && data.status === 1 && data.product) {
        const p = data.product;
        const nut = p.nutriments || {};
        const kcal = nut["energy-kcal_100g"] || nut["energy-kcal"] || 0;
        const prot = nut["proteins_100g"] || 0;
        const fat = nut["fat_100g"] || 0;
        const carb = nut["carbohydrates_100g"] || 0;

        setProduktForm({
          kod_kreskowy: code.trim(),
          nazwa: p.product_name || p.brands || "Produkt z Open Food Facts",
          kalorie_100g: Number(kcal) || 0,
          bialko_100g: Number(prot) || 0,
          tluszcze_100g: Number(fat) || 0,
          weglowodany_100g: Number(carb) || 0,
        });
        setProduktSuccessMsg("Pobrano dane z Open Food Facts! Możesz edytować makro i zapisać.");
      } else {
        alert("Nie znaleziono produktu o kodzie: " + code + ". Wprowadź dane ręcznie.");
        setProduktForm({
          kod_kreskowy: code.trim(),
          nazwa: "",
          kalorie_100g: 0,
          bialko_100g: 0,
          tluszcze_100g: 0,
          weglowodany_100g: 0,
        });
      }
    } catch (err) {
      console.error("Błąd pobierania produktu:", err);
      alert("Błąd połączenia z bazą produktów.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveCustomProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!produktForm.nazwa.trim()) {
      alert("Podaj nazwę produktu!");
      return;
    }

    try {
      const payload = {
        kod_kreskowy: produktForm.kod_kreskowy || null,
        nazwa: produktForm.nazwa,
        kalorie_100g: Number(produktForm.kalorie_100g) || 0,
        bialko_100g: Number(produktForm.bialko_100g) || 0,
        tluszcze_100g: Number(produktForm.tluszcze_100g) || 0,
        weglowodany_100g: Number(produktForm.weglowodany_100g) || 0,
      };

      const { error } = await supabase.from("produkty_spozywcze").insert([payload]);
      if (!error) {
        alert("Produkt został pomyślnie zapisany w bazie!");
        setIsProductModalOpen(false);
      } else {
        alert("Błąd zapisu produktu: " + error.message);
      }
    } catch (err) {
      console.error("Błąd zapisu:", err);
    }
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setBarcodeInput("");
              setProduktForm({ nazwa: "", kalorie_100g: 0, bialko_100g: 0, tluszcze_100g: 0, weglowodany_100g: 0 });
              setIsProductModalOpen(true);
            }}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>📷</span> Skanuj / Produkty
          </button>

          {(isAdmin || activeTab === "przepisy") && (
            <button
              onClick={handleOpenAdd}
              className="bg-sky-900 hover:bg-sky-950 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-colors shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
            >
              <span>+</span> DODAJ {activeTab === "przepisy" ? "PRZEPIS" : "WPIS"}
            </button>
          )}
        </div>
      </div>

      {/* SYSTEM 4 ZAKŁADEK */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("suplementy")}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === "suplementy"
              ? "bg-sky-900 text-white shadow-md shadow-sky-900/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>💊</span> Suplementy i Witaminy
        </button>

        <button
          onClick={() => setActiveTab("sport")}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === "sport"
              ? "bg-sky-900 text-white shadow-md shadow-sky-900/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>🏃</span> Sport i Trening
        </button>

        <button
          onClick={() => setActiveTab("odzywianie")}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === "odzywianie"
              ? "bg-sky-900 text-white shadow-md shadow-sky-900/20"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>🥗</span> Odżywianie i Dieta
        </button>

        <button
          onClick={() => setActiveTab("przepisy")}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
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
        {/* KLAUZULA MEDYCZNA */}
        {activeTab === "suplementy" && (
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
                <strong className="font-bold text-slate-900">wyłącznie edukacyjny i informacyjny</strong> i nie
                stanowią porady medycznej.
              </p>
            </div>
          </div>
        )}

        {/* SEKCJA PROPOZYCJI DLA ADMINA */}
        {isAdmin && activeTab === "suplementy" && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📬</span>
                <h3 className="font-black text-sky-950 text-sm sm:text-base uppercase tracking-tight">
                  Propozycje od Klubowiczów ({sugestie.length})
                </h3>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-200/70 px-2.5 py-1 rounded-lg">
                Panel Administratora
              </span>
            </div>

            {sugestie.length === 0 ? (
              <p className="text-xs text-slate-500 font-medium">Brak oczekujących propozycji.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {sugestie.map((sug) => (
                  <div
                    key={sug.id}
                    className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="font-black text-slate-900 text-sm">{sug.nazwa}</div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <span>👤</span> {sug.klient_email || "Klubowicz"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleQuickAddFromSugestia(sug)}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] py-1.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                      >
                        <span>+</span> Dodaj do bazy
                      </button>
                      <button
                        onClick={() => handleUsunSugestie(sug.id)}
                        className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 rounded-lg transition-colors cursor-pointer text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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

            <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
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

        {/* TABELA DANYCH (Z WYDZIELENIEM DLA PRZEPISÓW - BEZ ZDJĘCIA W TABELI) */}
        {currentFilteredList.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-sky-100 border-dashed">
            <div className="text-5xl mb-4">
              {activeTab === "suplementy" ? "🧪" : activeTab === "sport" ? "🏋️" : activeTab === "odzywianie" ? "🥗" : "🍳"}
            </div>
            <h3 className="text-lg font-black text-sky-950 mb-1">Brak wyników</h3>
            <p className="text-slate-500 text-sm">Nie znaleziono pozycji spełniających podane kryteria.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-sky-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sky-50/60 border-b border-sky-100 text-[11px] font-black uppercase tracking-wider text-sky-900">
                    <th className="py-4 px-6">{activeTab === "przepisy" ? "Nazwa przepisu" : "Nazwa / Tytuł"}</th>
                    <th className="py-4 px-6 hidden sm:table-cell">Kategoria</th>
                    <th className="py-4 px-6 hidden md:table-cell">
                      {activeTab === "suplementy"
                        ? "Dawkowanie"
                        : activeTab === "przepisy"
                        ? "Makroskładniki (B / T / W / Kcal)"
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

                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(item);
                          setIsViewModalOpen(true);
                        }}
                        className="hover:bg-sky-50/40 transition-colors cursor-pointer group"
                      >
                        {/* Nazwa i miniatura (dla przepisów bez zdjęcia w tabeli) */}
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
                              <div className="font-black text-sky-950 text-base group-hover:text-sky-700 transition-colors">
                                {item.nazwa}
                              </div>
                              {activeTab === "przepisy" && item.autor_email && (
                                <div className="text-[11px] text-slate-400 mt-0.5">Autor: {item.autor_email}</div>
                              )}
                              <div className="sm:hidden mt-1.5 flex flex-wrap gap-1">
                                {itemCats.map((catKey) => {
                                  const b = getKategoriaBadge(catKey);
                                  return (
                                    <span
                                      key={catKey}
                                      className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg border ${b.color}`}
                                    >
                                      <span>{b.icon}</span> {b.label}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Kategorie */}
                        <td className="py-4 px-6 hidden sm:table-cell">
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
                        </td>

                        {/* Dawkowanie / Makro / Wskazówki */}
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
                              {wyzsze && (
                                <div className="text-[11px] text-amber-700 font-bold truncate">⚡ Wyższe: {wyzsze}</div>
                              )}
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

                        {/* Przyciski */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(isAdmin || (activeTab === "przepisy" && item.autor_email === userEmail)) && (
                              <>
                                <button
                                  onClick={(e) => handleOpenEdit(item, e)}
                                  className="w-8 h-8 flex items-center justify-center bg-sky-100 text-sky-800 rounded-lg hover:bg-sky-200 transition-colors cursor-pointer text-xs"
                                  title="Edytuj"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={(e) => handleDelete(item.id, e)}
                                  className="w-8 h-8 flex items-center justify-center bg-rose-100 text-rose-800 rounded-lg hover:bg-rose-200 transition-colors cursor-pointer text-xs"
                                  title="Usuń"
                                >
                                  🗑️
                                </button>
                              </>
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

      {/* MODAL PODGLĄDU WPISU / PRZEPISU */}
      {isViewModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-start justify-center p-2 sm:p-4 md:py-10 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-50 rounded-[2rem] max-w-3xl w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300 my-auto">
            <button
              onClick={() => setIsViewModalOpen(false)}
              className="absolute top-4 right-4 z-20 bg-white hover:bg-slate-100 text-slate-900 w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg cursor-pointer font-black text-lg"
            >
              ✕
            </button>

            {/* Grafika (jeśli dostępna) */}
            {activeTab !== "przepisy" && (
              <div
                className="w-full bg-slate-900 relative flex justify-center items-center overflow-hidden"
                style={{ minHeight: "260px", maxHeight: "50vh" }}
              >
                {selectedItem.grafika_url ? (
                  <>
                    <div
                      className="absolute inset-0 opacity-35 blur-2xl bg-cover bg-center scale-110"
                      style={{ backgroundImage: `url(${selectedItem.grafika_url})` }}
                    ></div>
                    <img
                      src={selectedItem.grafika_url}
                      alt={selectedItem.nazwa}
                      className="relative z-10 w-full h-full object-contain max-h-[50vh] drop-shadow-2xl"
                    />
                  </>
                ) : (
                  <div className="w-full h-full min-h-[260px] bg-gradient-to-br from-sky-900 to-slate-800 flex flex-col items-center justify-center text-sky-100">
                    <span className="text-7xl mb-3 drop-shadow-lg">
                      {activeTab === "suplementy" ? "💊" : activeTab === "sport" ? "🏋️" : "🥗"}
                    </span>
                    <span className="font-black text-lg tracking-widest uppercase opacity-40">Baza Wiedzy</span>
                  </div>
                )}
              </div>
            )}

            {/* Treść podglądu */}
            <div className="p-6 sm:p-10 space-y-6">
              <div className="text-center">
                <div className="flex flex-wrap justify-center gap-1.5 mb-3">
                  {parseCategories(selectedItem.kategoria).map((catKey) => {
                    const badge = getKategoriaBadge(catKey);
                    return (
                      <span
                        key={catKey}
                        className={`inline-flex items-center gap-1.5 text-xs font-black px-4 py-1.5 rounded-full border ${badge.color}`}
                      >
                        <span>{badge.icon}</span> {badge.label}
                      </span>
                    );
                  })}
                </div>
                <h2 className="text-2xl sm:text-4xl font-black text-sky-950 leading-tight uppercase tracking-tight">
                  {selectedItem.nazwa}
                </h2>
                {activeTab === "przepisy" && selectedItem.autor_email && (
                  <div className="text-xs text-slate-400 mt-1">Autor przepisu: {selectedItem.autor_email}</div>
                )}
                <div className="w-16 h-1.5 bg-amber-500 mx-auto mt-4 rounded-full"></div>
              </div>

              {/* Sekcja Makro dla Przepisu */}
              {activeTab === "przepisy" && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl text-center">
                    <div className="text-[11px] font-black uppercase text-sky-900">Białko</div>
                    <div className="text-lg font-black text-sky-950 mt-1">{selectedItem.bialko || 0}g</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-center">
                    <div className="text-[11px] font-black uppercase text-amber-900">Tłuszcze</div>
                    <div className="text-lg font-black text-amber-950 mt-1">{selectedItem.tluszcze || 0}g</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center">
                    <div className="text-[11px] font-black uppercase text-emerald-900">Węglowodany</div>
                    <div className="text-lg font-black text-emerald-950 mt-1">{selectedItem.weglowodany || 0}g</div>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl text-center">
                    <div className="text-[11px] font-black uppercase text-indigo-900">Kalorie</div>
                    <div className="text-lg font-black text-indigo-950 mt-1">{selectedItem.kalorie || 0} kcal</div>
                  </div>
                </div>
              )}

              {/* Składniki dla Przepisu */}
              {activeTab === "przepisy" && selectedItem.skladniki && (
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                  <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>🛒</span> Składniki
                  </h3>
                  <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {selectedItem.skladniki}
                  </div>
                </div>
              )}

              {/* Opis / Przygotowanie */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span>📝</span>{" "}
                  {activeTab === "suplementy"
                    ? "Działanie i właściwości"
                    : activeTab === "przepisy"
                    ? "Sposób przygotowania"
                    : "Szczegółowy opis i metodyka"}
                </h3>
                <div className="text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium">
                  {selectedItem.opis || "Brak szczegółowego opisu."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DODAWANIA / EDYCJI WPISU LUB PRZEPISU */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl relative border-2 border-sky-900 my-8">
            <button
              onClick={() => setIsAdminModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-lg"
            >
              ✕
            </button>

            <div className="mb-6">
              <h3 className="font-black text-2xl text-sky-950 leading-tight">
                {editingId ? "Edytuj wpis" : "Nowy wpis"}: {activeTab.toUpperCase()}
              </h3>
              <p className="text-sm font-medium text-slate-500 mt-1">
                {activeTab === "przepisy"
                  ? "Podaj wymagane informacje o przepisie, aby zachować porządek w bazie."
                  : "Uzupełnij informacje, kategorie i treść artykułu."}
              </p>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-5">
              {/* Zdjęcie (tylko dla nienależących do przepisów) */}
              {activeTab !== "przepisy" && (
                <div className="space-y-2">
                  <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider">
                    Zdjęcie / Grafika
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
              )}

              {/* Kategorie */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider">
                    Kategoria {activeTab === "przepisy" ? "(wybierz posiłek)" : "(możesz wybrać kilka)"}
                  </label>
                  <span className="text-[11px] text-slate-400 font-bold">Wybrano: {form.kategorie.length}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
              </div>

              {/* Tytuł / Nazwa */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider">
                  Tytuł / Nazwa {activeTab === "przepisy" ? "przepisu *" : "wpisu *"}
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

              {/* Pola makro dla Przepisów */}
              {activeTab === "przepisy" && (
                <div className="space-y-4 bg-sky-50/60 p-4 rounded-2xl border border-sky-100">
                  <h4 className="font-black text-xs uppercase text-sky-900 tracking-wider">
                    Makroskładniki i kalorie (szacunkowe na całość porcji)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Białko (g)</label>
                      <input
                        type="number"
                        value={form.bialko}
                        onChange={(e) => setForm({ ...form, bialko: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Tłuszcze (g)</label>
                      <input
                        type="number"
                        value={form.tluszcze}
                        onChange={(e) => setForm({ ...form, tluszcze: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Węglowodany (g)</label>
                      <input
                        type="number"
                        value={form.weglowodany}
                        onChange={(e) => setForm({ ...form, weglowodany: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Kalorie (kcal)</label>
                      <input
                        type="number"
                        value={form.kalorie}
                        onChange={(e) => setForm({ ...form, kalorie: Number(e.target.value) })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 pt-2">
                    <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider">
                      Lista składników *
                    </label>
                    <textarea
                      required
                      value={form.skladniki}
                      onChange={(e) => setForm({ ...form, skladniki: e.target.value })}
                      placeholder="- 50g płatków owsianych&#10;- 30g odżywki białkowej&#10;- 150ml mleka..."
                      rows={4}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              )}

              {/* Pola suplementów lub sportu */}
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

              {/* Opis / Sposób przygotowania */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider">
                  {activeTab === "przepisy" ? "Sposób przygotowania *" : "Treść artykułu / Opis szczegółowy *"}
                </label>
                <textarea
                  required
                  value={form.opis}
                  onChange={(e) => setForm({ ...form, opis: e.target.value })}
                  placeholder={
                    activeTab === "przepisy"
                      ? "Opisz krok po kroku jak przygotować posiłek..."
                      : "Wpisz pełny opis, badania i wskazówki..."
                  }
                  rows={8}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-medium text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Przyciski */}
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

      {/* MODAL SKANERA KODÓW KRESKOWYCH I OPEN FOOD FACTS */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative border-2 border-amber-400 my-8">
            <button
              onClick={() => setIsProductModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 font-bold cursor-pointer text-lg"
            >
              ✕
            </button>

            <div className="mb-6">
              <h3 className="font-black text-xl sm:text-2xl text-sky-950 flex items-center gap-2">
                <span>📷</span> Skaner i Baza Produktów
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Wpisz lub zeskanuj kod kreskowy produktu. System przeszuka Twoją bazę oraz globalną bazę **Open Food Facts**. Możesz w każdej chwili zmodyfikować makro lub dodać własny produkt.
              </p>
            </div>

            <div className="space-y-5">
              {/* Wyszukiwanie kodu kreskowego */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Wpisz kod kreskowy (np. 5900512...)"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => handleSearchBarcode()}
                  className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-slate-950 font-black text-xs px-5 py-3 rounded-xl transition-all shadow-sm uppercase tracking-wider cursor-pointer shrink-0"
                >
                  {isScanning ? "Szukanie..." : "Szukaj produktu"}
                </button>
              </div>

              {produktSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl">
                  {produktSuccessMsg}
                </div>
              )}

              {/* Formularz edycji makro produktu na 100g */}
              <form onSubmit={handleSaveCustomProduct} className="space-y-4 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 text-xs block uppercase tracking-wider">
                    Nazwa produktu *
                  </label>
                  <input
                    type="text"
                    required
                    value={produktForm.nazwa}
                    onChange={(e) => setProduktForm({ ...produktForm, nazwa: e.target.value })}
                    placeholder="np. Serek wiejski Piątnica"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Białko / 100g</label>
                    <input
                      type="number"
                      step="0.1"
                      value={produktForm.bialko_100g}
                      onChange={(e) => setProduktForm({ ...produktForm, bialko_100g: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Tłuszcze / 100g</label>
                    <input
                      type="number"
                      step="0.1"
                      value={produktForm.tluszcze_100g}
                      onChange={(e) => setProduktForm({ ...produktForm, tluszcze_100g: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Węgle / 100g</label>
                    <input
                      type="number"
                      step="0.1"
                      value={produktForm.weglowodany_100g}
                      onChange={(e) => setProduktForm({ ...produktForm, weglowodany_100g: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Kalorie / 100g</label>
                    <input
                      type="number"
                      step="0.1"
                      value={produktForm.kalorie_100g}
                      onChange={(e) => setProduktForm({ ...produktForm, kalorie_100g: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-xl transition-colors cursor-pointer text-sm"
                  >
                    Zamknij
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-sky-900 hover:bg-sky-950 text-white font-black px-4 py-3 rounded-xl transition-colors shadow-sm uppercase tracking-wider cursor-pointer text-sm"
                  >
                    💾 Zapisz produkt w bazie
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
