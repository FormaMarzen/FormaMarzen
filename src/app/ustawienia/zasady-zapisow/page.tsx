"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Bezpośrednia, bezpieczna inicjalizacja klienta Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Typy danych
interface RodzajZajec {
  id: string | number;
  nazwa: string;
  kolor?: string;
}

interface KarnetDef {
  id: string | number;
  nazwa: string;
}

interface Klubowicz {
  id: string | number;
  imie?: string;
  nazwisko?: string;
  name?: string;
  email?: string;
  telefon?: string;
}

interface IndywidualnyLimitZapisow {
  id: string;
  klubowicz_id: string;
  klubowicz_nazwa: string;
  dni_w_przod: number;
  notatka?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface BookingRules {
  id?: string;
  // Domyślne wartości ogólne
  cancel_deadline_minutes: number;
  booking_cutoff_minutes: number | null;
  booking_window_days: number;
  expired_pass_grace_days: number;
  max_daily_bookings: number | null;
  max_daily_same_type_bookings: number;
  min_participants: number | null;
  auto_cancel_deadline_minutes: number | null;
  // Mapy indywidualne (klucz: nazwa treningu / karnetu)
  cancel_deadline_per_class: Record<string, number>;
  booking_cutoff_per_class: Record<string, number | null>;
  booking_window_per_pass: Record<string, number>;
  expired_pass_grace_per_pass: Record<string, number>;
  min_participants_per_class: Record<string, number | null>;
  auto_cancel_deadline_per_class: Record<string, number | null>;
  updated_at?: string;
}

interface BookingLog {
  id: string;
  action_type: string;
  status: 'SUCCESS' | 'BLOCKED' | 'ERROR';
  reason: string | null;
  rule_applied: string | null;
  created_at: string;
}

const DEFAULT_RULES: BookingRules = {
  cancel_deadline_minutes: 90,
  booking_cutoff_minutes: null,
  booking_window_days: 14,
  expired_pass_grace_days: 15,
  max_daily_bookings: null,
  max_daily_same_type_bookings: 1,
  min_participants: null,
  auto_cancel_deadline_minutes: null,
  cancel_deadline_per_class: {},
  booking_cutoff_per_class: {},
  booking_window_per_pass: {},
  expired_pass_grace_per_pass: {},
  min_participants_per_class: {},
  auto_cancel_deadline_per_class: {},
};

export default function ZasadyZapisowPage() {
  const [rules, setRules] = useState<BookingRules>(DEFAULT_RULES);
  const [formData, setFormData] = useState<BookingRules>(DEFAULT_RULES);
  const [rodzajeZajec, setRodzajeZajec] = useState<RodzajZajec[]>([]);
  const [karnety, setKarnety] = useState<KarnetDef[]>([]);
  const [klubowicze, setKlubowicze] = useState<Klubowicz[]>([]);
  const [indywidualneLimity, setIndywidualneLimity] = useState<IndywidualnyLimitZapisow[]>([]);
  const [logs, setLogs] = useState<BookingLog[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savingLimit, setSavingLimit] = useState<boolean>(false);
  
  // Wyszukiwarka na liście wyjątków
  const [limitSearchQuery, setLimitSearchQuery] = useState<string>('');

  // Modale
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState<boolean>(false);

  // Formularz limitu klubowicza
  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<{
    klubowicz_id: string;
    klubowicz_nazwa: string;
    dni_w_przod: number;
    notatka: string;
  }>({
    klubowicz_id: '',
    klubowicz_nazwa: '',
    dni_w_przod: 14,
    notatka: '',
  });

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Pobieranie danych z bazy Supabase
  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Pobierz rodzaje zajęć (treningi)
      const { data: rodzajeData } = await supabase.from('rodzaje_zajec').select('*');
      if (rodzajeData) {
        setRodzajeZajec(rodzajeData);
      }

      // 2. Pobierz karnety
      const { data: karnetyData } = await supabase.from('karnety').select('*');
      if (karnetyData) {
        setKarnety(karnetyData);
      }

      // 3. Pobierz listę klubowiczów do wyboru w formularzu
      const { data: klubowiczeData } = await supabase
        .from('klubowicze')
        .select('*')
        .order('nazwisko', { ascending: true });

      if (klubowiczeData && klubowiczeData.length > 0) {
        setKlubowicze(klubowiczeData);
      } else {
        // Fallback do tabeli profiles jeśli klubowicze są inaczej nazwani
        const { data: profilesData } = await supabase.from('profiles').select('*');
        if (profilesData) {
          setKlubowicze(profilesData);
        }
      }

      // 4. Pobierz indywidualne reguły zapisu klubowiczów
      const { data: limitsData, error: limitsError } = await supabase
        .from('indywidualne_limity_zapisow')
        .select('*')
        .order('created_at', { ascending: false });

      if (!limitsError && limitsData) {
        setIndywidualneLimity(limitsData);
      }

      // 5. Pobierz zasady nadrzędne
      const { data: rulesData, error } = await supabase
        .from('club_booking_rules')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Błąd pobierania zasad:', error);
      } else if (rulesData) {
        const parsedRules: BookingRules = {
          ...DEFAULT_RULES,
          ...rulesData,
          cancel_deadline_per_class: rulesData.cancel_deadline_per_class || {},
          booking_cutoff_per_class: rulesData.booking_cutoff_per_class || {},
          booking_window_per_pass: rulesData.booking_window_per_pass || {},
          expired_pass_grace_per_pass: rulesData.expired_pass_grace_per_pass || {},
          min_participants_per_class: rulesData.min_participants_per_class || {},
          auto_cancel_deadline_per_class: rulesData.auto_cancel_deadline_per_class || {},
        };
        setRules(parsedRules);
        setFormData(parsedRules);
      }
    } catch (err) {
      console.error('Nieoczekiwany błąd ładowania danych:', err);
    } finally {
      setLoading(false);
    }
  };

  // Pobieranie logów operacji
  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('booking_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        setLogs(data);
      }
    } catch (err) {
      console.error('Błąd pobierania logów:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenEdit = () => {
    setFormData(JSON.parse(JSON.stringify(rules)));
    setIsEditModalOpen(true);
  };

  const handleOpenLogs = () => {
    fetchLogs();
    setIsLogsModalOpen(true);
  };

  // Otwarcie modala dodawania/edycji limitu klubowicza
  const handleOpenAddLimit = () => {
    setEditingLimitId(null);
    setMemberForm({
      klubowicz_id: klubowicze.length > 0 ? String(klubowicze[0].id) : '',
      klubowicz_nazwa: klubowicze.length > 0 ? getKlubowiczFullName(klubowicze[0]) : '',
      dni_w_przod: 14,
      notatka: '',
    });
    setIsLimitModalOpen(true);
  };

  const handleOpenEditLimit = (item: IndywidualnyLimitZapisow) => {
    setEditingLimitId(item.id);
    setMemberForm({
      klubowicz_id: item.klubowicz_id,
      klubowicz_nazwa: item.klubowicz_nazwa,
      dni_w_przod: item.dni_w_przod,
      notatka: item.notatka || '',
    });
    setIsLimitModalOpen(true);
  };

  // Pomocnicze pobieranie pełnego imienia i nazwiska
  const getKlubowiczFullName = (k: Klubowicz) => {
    if (k.imie || k.nazwisko) {
      return `${k.imie || ''} ${k.nazwisko || ''}`.trim();
    }
    return k.name || k.email || `Klubowicz #${k.id}`;
  };

  // Zapis indywidualnego limitu klubowicza
  const handleSaveMemberLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.klubowicz_nazwa) {
      showToast('Wybierz lub podaj klubowicza', 'error');
      return;
    }

    try {
      setSavingLimit(true);
      const payload = {
        klubowicz_id: memberForm.klubowicz_id,
        klubowicz_nazwa: memberForm.klubowicz_nazwa,
        dni_w_przod: Number(memberForm.dni_w_przod) || 1,
        notatka: memberForm.notatka || null,
        updated_at: new Date().toISOString(),
      };

      if (editingLimitId) {
        const { data, error } = await supabase
          .from('indywidualne_limity_zapisow')
          .update(payload)
          .eq('id', editingLimitId)
          .select()
          .single();

        if (error) throw error;

        setIndywidualneLimity((prev) =>
          prev.map((item) => (item.id === editingLimitId ? data : item))
        );
        showToast('Zaktualizowano indywidualny czas zapisu');
      } else {
        const { data, error } = await supabase
          .from('indywidualne_limity_zapisow')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        setIndywidualneLimity((prev) => [data, ...prev]);
        showToast('Dodano indywidualny czas zapisu dla klubowicza');
      }

      await supabase.from('booking_logs').insert([
        {
          action_type: editingLimitId ? 'USER_RULE_UPDATED' : 'USER_RULE_CREATED',
          status: 'SUCCESS',
          reason: `Ustawiono indywidualny czas zapisu ${memberForm.dni_w_przod} dni dla: ${memberForm.klubowicz_nazwa}`,
          rule_applied: 'INDYWIDUALNY_LIMIT_ZAPISOW',
        },
      ]);

      setIsLimitModalOpen(false);
    } catch (err: any) {
      console.error('Błąd zapisu indywidualnego limitu:', err);
      showToast('Błąd zapisu: ' + (err.message || ''), 'error');
    } finally {
      setSavingLimit(false);
    }
  };

  // Usunięcie indywidualnego limitu
  const handleDeleteMemberLimit = async (id: string, name: string) => {
    if (!window.confirm(`Czy na pewno chcesz usunąć indywidualny limit dla: ${name}? Osoba ta powróci do standardowych zasad.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('indywidualne_limity_zapisow')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setIndywidualneLimity((prev) => prev.filter((item) => item.id !== id));
      showToast(`Przywrócono domyślne zasady dla ${name}`);

      await supabase.from('booking_logs').insert([
        {
          action_type: 'USER_RULE_DELETED',
          status: 'SUCCESS',
          reason: `Usunięto indywidualny limit dla: ${name}. Powrót do domyślnych zasad.`,
          rule_applied: 'INDYWIDUALNY_LIMIT_ZAPISOW',
        },
      ]);
    } catch (err: any) {
      console.error('Błąd usuwania limitu:', err);
      showToast('Błąd podczas usuwania: ' + (err.message || ''), 'error');
    }
  };

  // Zapis ogólnego formularza zasad do Supabase
  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      let res;
      const payloadToSave = {
        cancel_deadline_minutes: formData.cancel_deadline_minutes,
        booking_cutoff_minutes: formData.booking_cutoff_minutes,
        booking_window_days: formData.booking_window_days,
        expired_pass_grace_days: formData.expired_pass_grace_days,
        max_daily_bookings: formData.max_daily_bookings,
        max_daily_same_type_bookings: formData.max_daily_same_type_bookings,
        min_participants: formData.min_participants,
        auto_cancel_deadline_minutes: formData.auto_cancel_deadline_minutes,
        cancel_deadline_per_class: formData.cancel_deadline_per_class,
        booking_cutoff_per_class: formData.booking_cutoff_per_class,
        booking_window_per_pass: formData.booking_window_per_pass,
        expired_pass_grace_per_pass: formData.expired_pass_grace_per_pass,
        min_participants_per_class: formData.min_participants_per_class,
        auto_cancel_deadline_per_class: formData.auto_cancel_deadline_per_class,
        updated_at: new Date().toISOString(),
      };

      if (rules.id) {
        res = await supabase
          .from('club_booking_rules')
          .update(payloadToSave)
          .eq('id', rules.id)
          .select()
          .single();
      } else {
        res = await supabase
          .from('club_booking_rules')
          .insert([payloadToSave])
          .select()
          .single();
      }

      if (res.error) throw res.error;

      await supabase.from('booking_logs').insert([
        {
          action_type: 'RULES_UPDATED',
          status: 'SUCCESS',
          reason: 'Zaktualizowano nadrzędne reguły, limity oraz warunki autoodwoływania',
          rule_applied: 'ZASADY_ZAPISOW',
          payload: formData,
        },
      ]);

      setRules(res.data);
      setIsEditModalOpen(false);
      showToast('Zasady zapisów zostały pomyślnie zapisane!');
    } catch (err: any) {
      console.error('Błąd zapisu:', err);
      showToast('Wystąpił błąd podczas zapisu: ' + (err.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Pomocnicze formatowanie minut
  const formatMinutes = (minutes: number | null | undefined) => {
    if (minutes === null || minutes === undefined || minutes === 0) return 'Bez limitu';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}min`;
    if (hours > 0) return `${hours}h`;
    return `${mins}min`;
  };

  // Filtrowana lista klubowiczów z indywidualnymi limitami
  const filteredLimits = indywidualneLimity.filter((item) =>
    item.klubowicz_nazwa.toLowerCase().includes(limitSearchQuery.toLowerCase()) ||
    (item.notatka && item.notatka.toLowerCase().includes(limitSearchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="max-w-[1250px] mx-auto p-12 text-center text-slate-500 font-bold text-xs animate-pulse">
        Ładowanie reguł i parametrów klubu...
      </div>
    );
  }

  return (
    <div className="max-w-[1250px] mx-auto space-y-6 pb-16 font-sans antialiased text-slate-800">
      
      {/* POWIADOMIENIE TOAST */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl border flex items-center gap-3 transition-all duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          <span className="text-base">{toastMessage.type === 'success' ? '✅' : '⚠️'}</span>
          <p className="text-xs font-bold tracking-wide">{toastMessage.text}</p>
        </div>
      )}

      {/* GÓRNY PASEK AKCJI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-sky-950 via-slate-900 to-sky-900 border border-sky-800/60 p-6 rounded-3xl shadow-lg text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
            </span>
            <span className="text-[11px] font-black tracking-widest text-sky-300 uppercase">
              Silnik Reguł Nadrzędnych
            </span>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-white flex items-center gap-3">
            📋 ZASADY ZAPISÓW
          </h1>
          <p className="text-xs text-sky-200/80 font-medium">
            Ustalaj nadrzędne limity, czasy anulowania, indywidualne okna wyprzedzenia oraz warunki frekwencji.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenEdit}
            className="flex items-center gap-2 bg-gradient-to-r from-rose-700 to-rose-900 hover:from-rose-600 hover:to-rose-800 text-white px-5 py-3 rounded-2xl text-xs font-extrabold transition-all shadow-md shadow-rose-950/40 active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            EDYTUJ ZASADY
          </button>
          
          <button
            onClick={handleOpenLogs}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white border border-white/20 px-4 py-3 rounded-2xl text-xs font-bold transition-all backdrop-blur-sm active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            LOGI ZAPISÓW
          </button>
          
          <button
            onClick={() => setIsHelpModalOpen(true)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white border border-white/20 px-4 py-3 rounded-2xl text-xs font-bold transition-all backdrop-blur-sm active:scale-95 cursor-pointer"
          >
            <svg className="w-4 h-4 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            POMOC
          </button>
        </div>
      </div>

      {/* SEKCJA GŁÓWNA */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8">
        
        {/* SEKCJA 1: MINIMALNY CZAS DO WYPISU Z ZAJĘĆ (LISTA TRENINGÓW) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sky-50 text-sky-700 rounded-xl border border-sky-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                  Minimalny czas do wypisu z zajęć (wg treningu)
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">Czas przed rozpoczęciem, do którego klubowicz może bezpłatnie anulować rezerwację.</p>
              </div>
            </div>
            <span className="text-[11px] font-black text-sky-900 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
              Domyślnie: {formatMinutes(rules.cancel_deadline_minutes)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rodzajeZajec.map((trening) => {
              const val = rules.cancel_deadline_per_class?.[trening.nazwa] ?? rules.cancel_deadline_minutes;
              return (
                <div
                  key={trening.id}
                  className="flex items-center justify-between p-3.5 bg-slate-50/70 border border-slate-200/60 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: trening.kolor || '#0284c7' }}
                    />
                    <span className="text-xs font-bold text-slate-800">{trening.nazwa}</span>
                  </div>
                  <span className="text-xs font-black text-sky-950 bg-sky-100/70 px-3 py-1 rounded-xl border border-sky-200">
                    {formatMinutes(val)}
                  </span>
                </div>
              );
            })}
            {rodzajeZajec.length === 0 && (
              <div className="col-span-full py-4 text-center text-xs text-slate-400">
                Brak zdefiniowanych rodzajów zajęć w bazie.
              </div>
            )}
          </div>
        </div>

        {/* SEKCJA 2: BLOKADA ZAPISÓW PRZED ROZPOCZĘCIEM (LISTA TRENINGÓW) */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                  Blokada zapisów przed rozpoczęciem (wg treningu)
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">Na ile minut przed startem zamyka się możliwość dołączenia do listy.</p>
              </div>
            </div>
            <span className="text-[11px] font-black text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              Domyślnie: {formatMinutes(rules.booking_cutoff_minutes)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rodzajeZajec.map((trening) => {
              const val = rules.booking_cutoff_per_class?.[trening.nazwa] !== undefined
                ? rules.booking_cutoff_per_class[trening.nazwa]
                : rules.booking_cutoff_minutes;
              return (
                <div
                  key={trening.id}
                  className="flex items-center justify-between p-3.5 bg-slate-50/70 border border-slate-200/60 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: trening.kolor || '#d97706' }}
                    />
                    <span className="text-xs font-bold text-slate-800">{trening.nazwa}</span>
                  </div>
                  <span className="text-xs font-black text-slate-800 bg-white px-3 py-1 rounded-xl border border-slate-200">
                    {formatMinutes(val)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SEKCJA 3: AUTOMATYCZNE ODWOŁYWANIE PRZY BRAKU MINIMALNEJ LICZBY OSÓB */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-50 text-purple-700 rounded-xl border border-purple-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                  Automatyczne odwoływanie zajęć (Min. frekwencja)
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">Minimalna liczba klubowiczów oraz czas weryfikacji kompletu przed startem treningu.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-purple-950 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                Min. osób: {rules.min_participants ?? 'Brak'}
              </span>
              <span className="text-[11px] font-black text-purple-950 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                Weryfikacja: {formatMinutes(rules.auto_cancel_deadline_minutes)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rodzajeZajec.map((trening) => {
              const minOs = rules.min_participants_per_class?.[trening.nazwa] !== undefined
                ? rules.min_participants_per_class[trening.nazwa]
                : rules.min_participants;
              const cutMins = rules.auto_cancel_deadline_per_class?.[trening.nazwa] !== undefined
                ? rules.auto_cancel_deadline_per_class[trening.nazwa]
                : rules.auto_cancel_deadline_minutes;

              return (
                <div
                  key={trening.id}
                  className="flex items-center justify-between p-3.5 bg-slate-50/70 border border-slate-200/60 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: trening.kolor || '#9333ea' }}
                    />
                    <span className="text-xs font-bold text-slate-800">{trening.nazwa}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-purple-950 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                      👥 {minOs ? `Min: ${minOs}` : 'Brak'}
                    </span>
                    <span className="text-[11px] font-black text-slate-800 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                      ⏱️ {formatMinutes(cutMins)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SEKCJA 4: ILE DNI PRZED ZAJĘCIAMI MOŻNA SIĘ ZAPISAĆ (LISTA KARNETÓW) */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                  Ile dni przed rozpoczęciem można się zapisać (wg karnetu)
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">Wyprzedzenie czasowe otwierania zapisów w grafiku dla poszczególnych karnetów.</p>
              </div>
            </div>
            <span className="text-[11px] font-black text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              Domyślnie: {rules.booking_window_days} dni
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {karnety.map((karnet) => {
              const val = rules.booking_window_per_pass?.[karnet.nazwa] ?? rules.booking_window_days;
              return (
                <div
                  key={karnet.id}
                  className="flex items-center justify-between p-3.5 bg-slate-50/70 border border-slate-200/60 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs">💳</span>
                    <span className="text-xs font-bold text-slate-800">{karnet.nazwa}</span>
                  </div>
                  <span className="text-xs font-black text-emerald-950 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                    {val} dni
                  </span>
                </div>
              );
            })}
            {karnety.length === 0 && (
              <div className="col-span-full py-4 text-center text-xs text-slate-400">
                Brak zdefiniowanych karnetów w bazie.
              </div>
            )}
          </div>
        </div>

        {/* SEKCJA 5: INDYWIDUALNY CZAS ZAPISU DLA KLUBOWICZÓW (NOWA TABELA / WYJĄTKI) */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  Indywidualne okno zapisu dla klubowiczów
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full lowercase">
                    {indywidualneLimity.length} {indywidualneLimity.length === 1 ? 'osoba' : 'osób'}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">
                  Ustalaj krótszy lub dłuższy czas zapisu w przód dla wybranych klubowiczów (np. 14 dni), by uniknąć blokowania miejsc.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenAddLimit}
              className="flex items-center gap-1.5 self-start sm:self-auto bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              DODAJ KLUBOWICZA
            </button>
          </div>

          {/* Wyszukiwarka na liście reguł */}
          {indywidualneLimity.length > 0 && (
            <div className="flex items-center justify-between gap-4">
              <div className="relative w-full max-w-xs">
                <input
                  type="text"
                  placeholder="Szukaj klubowicza..."
                  value={limitSearchQuery}
                  onChange={(e) => setLimitSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                Domyślna zasada dla pozostałych: <b>{rules.booking_window_days} dni</b>
              </span>
            </div>
          )}

          {/* Tabela limitów */}
          {indywidualneLimity.length === 0 ? (
            <div className="text-center py-8 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
              <p className="text-xs text-slate-500 font-bold mb-1">Brak przypisanych reguł indywidualnych</p>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto mb-4">
                Wszyscy klubowicze korzystają obecnie z globalnego okna zapisu lub przypisanego do posiadanego karnetu.
              </p>
              <button
                type="button"
                onClick={handleOpenAddLimit}
                className="text-xs text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
              >
                + Dodaj pierwsze ograniczenie dla klubowicza
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200/70 rounded-2xl shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Klubowicz</th>
                    <th className="py-3 px-4">Czas zapisu w przód</th>
                    <th className="py-3 px-4">Powód / Notatka</th>
                    <th className="py-3 px-4 text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredLimits.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center font-black text-[11px]">
                            {item.klubowicz_nazwa.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-900">{item.klubowicz_nazwa}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-black text-blue-950 bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl text-xs">
                          ⏱️ {item.dni_w_przod} {item.dni_w_przod === 1 ? 'dzień' : 'dni'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {item.notatka || <span className="text-slate-300 italic">Brak notatki</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditLimit(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edytuj limit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMemberLimit(item.id, item.klubowicz_nazwa)}
                            className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Usuń limit i przywróć domyślny"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredLimits.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                        Brak klubowiczów pasujących do frazy &quot;{limitSearchQuery}&quot;
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SEKCJA 6: DNI ZAPISU PO ZAKOŃCZENIU KARNETU (LISTA KARNETÓW) */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                  Dni zapisu po zakończeniu karnetu - Karencja (wg karnetu)
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">Ile dni po dacie wygaśnięcia klubowicz może dokonać rezerwacji.</p>
              </div>
            </div>
            <span className="text-[11px] font-black text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
              Domyślnie: {rules.expired_pass_grace_days} dni
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {karnety.map((karnet) => {
              const val = rules.expired_pass_grace_per_pass?.[karnet.nazwa] ?? rules.expired_pass_grace_days;
              return (
                <div
                  key={karnet.id}
                  className="flex items-center justify-between p-3.5 bg-slate-50/70 border border-slate-200/60 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs">⏳</span>
                    <span className="text-xs font-bold text-slate-800">{karnet.nazwa}</span>
                  </div>
                  <span className="text-xs font-black text-indigo-950 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200">
                    {val} dni
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* SEKCJA 7: LIMIT ZAJĘĆ JEDNEGO TYPU I DZIENNE */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="p-2 bg-rose-50 text-rose-700 rounded-xl border border-rose-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Limity Ilościowe Zapisów
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">Nadrzędne ograniczenia liczby wejść w ciągu doby.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="flex items-center justify-between p-4 bg-slate-50/70 border border-slate-200/60 rounded-2xl">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Limit zajęć jednego typu dziennie:</span>
                <span className="text-[11px] text-slate-500">Maks. zapisów na ten sam rodzaj treningu w 1 dniu</span>
              </div>
              <span className="text-xs font-black text-sky-950 bg-sky-100/70 px-4 py-1.5 rounded-xl border border-sky-200">
                {rules.max_daily_same_type_bookings}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50/70 border border-slate-200/60 rounded-2xl">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Maksymalna liczba wszystkich zajęć dziennie:</span>
                <span className="text-[11px] text-slate-500">Globalny limit wejść na dobę dla każdego klubowicza</span>
              </div>
              <span className="text-xs font-black text-slate-800 bg-white px-4 py-1.5 rounded-xl border border-slate-200">
                {rules.max_daily_bookings !== null ? `${rules.max_daily_bookings}` : 'Bez limitu'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* MODAL: DODAJ / EDYTUJ INDYWIDUALNY LIMIT DLA KLUBOWICZA */}
      {isLimitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            
            <div className="p-6 bg-gradient-to-r from-blue-950 to-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                  👤 {editingLimitId ? 'Edytuj Limit Klubowicza' : 'Nowy Indywidualny Czas Zapisu'}
                </h3>
                <p className="text-xs text-blue-200">
                  Ustal wyprzedzenie czasowe z jakim ta osoba może dokonywać rezerwacji.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLimitModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMemberLimit} className="p-6 space-y-4 text-xs text-slate-700">
              
              {/* Wybór klubowicza */}
              <div>
                <label className="block font-bold text-slate-900 mb-1">
                  Wybierz Klubowicza <span className="text-rose-500">*</span>
                </label>
                {klubowicze.length > 0 ? (
                  <select
                    value={memberForm.klubowicz_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const found = klubowicze.find((k) => String(k.id) === selectedId);
                      setMemberForm({
                        ...memberForm,
                        klubowicz_id: selectedId,
                        klubowicz_nazwa: found ? getKlubowiczFullName(found) : '',
                      });
                    }}
                    disabled={!!editingLimitId}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">-- Wybierz klubowicza --</option>
                    {klubowicze.map((k) => (
                      <option key={k.id} value={String(k.id)}>
                        {getKlubowiczFullName(k)} {k.email ? `(${k.email})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Wpisz imię i nazwisko klubowicza"
                    value={memberForm.klubowicz_nazwa}
                    onChange={(e) => setMemberForm({ ...memberForm, klubowicz_nazwa: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                )}
              </div>

              {/* Liczba dni w przód */}
              <div>
                <label className="block font-bold text-slate-900 mb-1">
                  Maksymalne okno zapisu w przód (w dniach) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={memberForm.dni_w_przod}
                    onChange={(e) => setMemberForm({ ...memberForm, dni_w_przod: parseInt(e.target.value) || 1 })}
                    className="w-28 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 font-black text-center text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                  <span className="text-xs text-slate-500 font-medium">
                    (np. <b>14 dni</b> zapobiegnie rezerwacjom na miesiąc do przodu)
                  </span>
                </div>
              </div>

              {/* Notatka / Powód */}
              <div>
                <label className="block font-bold text-slate-900 mb-1">
                  Powód / Notatka (opcjonalnie)
                </label>
                <input
                  type="text"
                  placeholder="np. Zapomina odwoływać treningi przy dłuższym wyprzedzeniu"
                  value={memberForm.notatka}
                  onChange={(e) => setMemberForm({ ...memberForm, notatka: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Przyciski */}
              <div className="pt-4 border-t flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsLimitModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={savingLimit}
                  className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {savingLimit ? 'Zapisywanie...' : editingLimitId ? 'Zapisz Zmiany' : 'Dodaj Ograniczenie'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL: EDYCJA ZASAD OGÓLNYCH */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            
            <div className="p-6 bg-gradient-to-r from-sky-950 to-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                  ✏️ Konfiguracja Zasad Zapisów
                </h3>
                <p className="text-xs text-sky-200">Ustaw nadrzędne reguły dla poszczególnych treningów i karnetów.</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRules} className="p-6 overflow-y-auto space-y-8 text-xs text-slate-700">
              
              {/* 1. Minimalny czas do wypisu */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-black text-sky-950 uppercase tracking-wider">
                    1. Minimalny czas do wypisu (w minutach)
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-bold">Wartość domyślna:</span>
                    <input
                      type="number"
                      value={formData.cancel_deadline_minutes}
                      onChange={(e) => setFormData({ ...formData, cancel_deadline_minutes: parseInt(e.target.value) || 0 })}
                      className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-bold text-center"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {rodzajeZajec.map((trening) => (
                    <div key={trening.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800">{trening.nazwa}</span>
                      <input
                        type="number"
                        placeholder={String(formData.cancel_deadline_minutes)}
                        value={formData.cancel_deadline_per_class?.[trening.nazwa] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({
                            ...formData,
                            cancel_deadline_per_class: {
                              ...formData.cancel_deadline_per_class,
                              [trening.nazwa]: val === '' ? formData.cancel_deadline_minutes : parseInt(val) || 0,
                            },
                          });
                        }}
                        className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-center text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Blokada zapisów przed rozpoczęciem */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-black text-amber-950 uppercase tracking-wider">
                    2. Blokada zapisów przed rozpoczęciem zajęć (w minutach)
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-bold">Wartość domyślna:</span>
                    <input
                      type="number"
                      placeholder="0 = Bez limitu"
                      value={formData.booking_cutoff_minutes ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, booking_cutoff_minutes: val === '' ? null : parseInt(val) });
                      }}
                      className="w-24 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-bold text-center"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {rodzajeZajec.map((trening) => (
                    <div key={trening.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800">{trening.nazwa}</span>
                      <input
                        type="number"
                        placeholder="0 = Brak"
                        value={formData.booking_cutoff_per_class?.[trening.nazwa] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({
                            ...formData,
                            booking_cutoff_per_class: {
                              ...formData.booking_cutoff_per_class,
                              [trening.nazwa]: val === '' ? null : parseInt(val),
                            },
                          });
                        }}
                        className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-center text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Automatyczne odwołanie zajęć (Min. frekwencja) */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-2 gap-2">
                  <h4 className="font-black text-purple-950 uppercase tracking-wider">
                    3. Automatyczne odwołanie przy braku minimalnej liczby osób
                  </h4>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-bold">Domyślna min. liczba osób:</span>
                      <input
                        type="number"
                        placeholder="Brak"
                        value={formData.min_participants ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({ ...formData, min_participants: val === '' ? null : parseInt(val) });
                        }}
                        className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-bold text-center"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-bold">Czas weryfikacji (min):</span>
                      <input
                        type="number"
                        placeholder="Brak"
                        value={formData.auto_cancel_deadline_minutes ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({ ...formData, auto_cancel_deadline_minutes: val === '' ? null : parseInt(val) });
                        }}
                        className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-bold text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {rodzajeZajec.map((trening) => (
                    <div key={trening.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: trening.kolor || '#9333ea' }}
                        />
                        <span className="font-bold text-slate-800">{trening.nazwa}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Min. osób:</label>
                          <input
                            type="number"
                            placeholder={formData.min_participants ? String(formData.min_participants) : 'Brak'}
                            value={formData.min_participants_per_class?.[trening.nazwa] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData({
                                ...formData,
                                min_participants_per_class: {
                                  ...formData.min_participants_per_class,
                                  [trening.nazwa]: val === '' ? null : parseInt(val),
                                },
                              });
                            }}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-center text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Czas (min):</label>
                          <input
                            type="number"
                            placeholder={formData.auto_cancel_deadline_minutes ? String(formData.auto_cancel_deadline_minutes) : 'Brak'}
                            value={formData.auto_cancel_deadline_per_class?.[trening.nazwa] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData({
                                ...formData,
                                auto_cancel_deadline_per_class: {
                                  ...formData.auto_cancel_deadline_per_class,
                                  [trening.nazwa]: val === '' ? null : parseInt(val),
                                },
                              });
                            }}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-center text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Okno zapisu z wyprzedzeniem */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-black text-emerald-950 uppercase tracking-wider">
                    4. Okno zapisu z wyprzedzeniem (w dniach)
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-bold">Wartość domyślna:</span>
                    <input
                      type="number"
                      value={formData.booking_window_days}
                      onChange={(e) => setFormData({ ...formData, booking_window_days: parseInt(e.target.value) || 1 })}
                      className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-bold text-center"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {karnety.map((karnet) => (
                    <div key={karnet.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800">{karnet.nazwa}</span>
                      <input
                        type="number"
                        placeholder={String(formData.booking_window_days)}
                        value={formData.booking_window_per_pass?.[karnet.nazwa] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({
                            ...formData,
                            booking_window_per_pass: {
                              ...formData.booking_window_per_pass,
                              [karnet.nazwa]: val === '' ? formData.booking_window_days : parseInt(val) || 1,
                            },
                          });
                        }}
                        className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-center text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. Dni na zapis po wygaśnięciu karnetu */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-black text-indigo-950 uppercase tracking-wider">
                    5. Dni na zapis po wygaśnięciu karnetu (Karencja w dniach)
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-bold">Wartość domyślna:</span>
                    <input
                      type="number"
                      value={formData.expired_pass_grace_days}
                      onChange={(e) => setFormData({ ...formData, expired_pass_grace_days: parseInt(e.target.value) || 0 })}
                      className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-bold text-center"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {karnety.map((karnet) => (
                    <div key={karnet.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800">{karnet.nazwa}</span>
                      <input
                        type="number"
                        placeholder={String(formData.expired_pass_grace_days)}
                        value={formData.expired_pass_grace_per_pass?.[karnet.nazwa] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({
                            ...formData,
                            expired_pass_grace_per_pass: {
                              ...formData.expired_pass_grace_per_pass,
                              [karnet.nazwa]: val === '' ? formData.expired_pass_grace_days : parseInt(val) || 0,
                            },
                          });
                        }}
                        className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-center text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Nadrzędne Limity Dzienne */}
              <div className="space-y-3 pt-2">
                <h4 className="font-black text-slate-900 uppercase tracking-wider border-b pb-2">
                  6. Nadrzędne Limity Dzienne
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">
                      Limit zajęć jednego typu dziennie:
                    </label>
                    <select
                      value={formData.max_daily_same_type_bookings}
                      onChange={(e) => setFormData({ ...formData, max_daily_same_type_bookings: parseInt(e.target.value) || 1 })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer"
                    >
                      <option value="1">1 trening tego samego typu dziennie</option>
                      <option value="2">2 treningi tego samego typu dziennie</option>
                      <option value="3">3 treningi tego samego typu dziennie</option>
                      <option value="4">4 treningi tego samego typu dziennie</option>
                      <option value="999">Bez limitu</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">
                      Maks. liczba wszystkich zajęć dziennie:
                    </label>
                    <input
                      type="number"
                      placeholder="Puste = Bez limitu"
                      value={formData.max_daily_bookings ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, max_daily_bookings: val === '' ? null : parseInt(val) });
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500">Zostaw puste dla braku limitu globalnego.</span>
                  </div>
                </div>
              </div>

              {/* Przyciski akcji */}
              <div className="pt-4 border-t flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-sky-900 hover:bg-sky-800 text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Zapisywanie...' : 'Zapisz Wszystkie Zasady'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL: LOGI ZAPISÓW */}
      {isLogsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                  🕒 Logi Zapisów i Zasad
                </h3>
                <p className="text-xs text-slate-300">Historia egzekwowania reguł.</p>
              </div>
              <button
                onClick={() => setIsLogsModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Brak zarejestrowanych zdarzeń w tabeli `booking_logs`.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {logs.map((log) => (
                    <div key={log.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              log.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.status === 'BLOCKED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {log.status}
                          </span>
                          <span className="font-bold text-slate-900">{log.action_type}</span>
                        </div>
                        <p className="text-slate-600 mt-1">{log.reason || 'Operacja wykonana poprawnie'}</p>
                      </div>
                      <div className="text-right text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('pl-PL')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: POMOC */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-6 bg-sky-950 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
                  ❓ Jak Działają Zasady Zapisów?
                </h3>
                <p className="text-xs text-sky-200">Hierarchia reguł w systemie.</p>
              </div>
              <button
                onClick={() => setIsHelpModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-2">
                <h4 className="font-black text-blue-950 uppercase">Indywidualne Limity Klubowiczów (Priorytet)</h4>
                <p>
                  Jeżeli klubowicz posiada zdefiniowaną indywidualną regułę, system traktuje ją jako nadrzędną wobec ogólnego okna karnetu. Pozwala to na skrócenie okna do np. 14 dni osobom nagminnie blokującym miejsca w przód.
                </p>
              </div>

              <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 space-y-2">
                <h4 className="font-black text-sky-950 uppercase">Ustawienia Treningów i Karnetów</h4>
                <p>
                  Możesz zdefiniować inny czas wypisu, blokadę startu oraz minimalną liczbę uczestników dla każdego treningu z osobna.
                </p>
                <p>
                  Podobnie domyślne okno zapisu w przód oraz okres karencji po wygaśnięciu można różnicować w zależności od typu posiadanego karnetu.
                </p>
              </div>

              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-1">
                <h4 className="font-black text-purple-950 uppercase">Automatyczne Odwoływanie</h4>
                <p>
                  Jeśli do ustalonego czasu przed zajęciami nie zgłosi się minimalna liczba osób, system może automatycznie anulować sesję i zwolnić blokady.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <h4 className="font-black text-slate-900 uppercase">Limit Zajęć Tego Samego Typu</h4>
                <p>
                  Chroni przed blokowaniem miejsc na wielu sesjach tego samego formatu w ciągu jednego dnia przez tę samą osobę.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
