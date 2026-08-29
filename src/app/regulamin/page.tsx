'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../raporty/klienci/supabase';

type Regulation = {
  id: string;
  slug: string;
  title: string;
  content: string;
  force_accept_date?: string;
  checkbox_text?: string;
};

type AcceptanceHistory = {
  id: string;
  user_id: string;
  user_email?: string;
  regulation_slug: string;
  accepted_at: string;
  regulations: {
    title: string;
  };
};

type ClientProfile = {
  Imię: string;
  Nazwisko: string;
  'E-mail': string;
};

export default function RegulaminPage() {
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [history, setHistory] = useState<AcceptanceHistory[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAdmin, setIsAdmin] = useState(false); 
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Stan wyszukiwarki historii dla administratora
  const [adminSearchQuery, setAdminSearchQuery] = useState('');

  // Stan zwijania / rozwijania historii (limit domyślny: 10 pozycji)
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // Stan Modala edycji/tworzenia
  const [selectedRegulation, setSelectedRegulation] = useState<Regulation | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCheckboxText, setEditCheckboxText] = useState('');
  const [forceAccept, setForceAccept] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      setUserId(user.id);
      setUserEmail(user.email || null);
      
      let adminCheck = false;
      if (user.email === 'maciejklaput@gmail.com') {
        adminCheck = true;
      } else {
        const { data: clientData } = await supabase
          .from('klienci')
          .select('rola, role')
          .eq('id', user.id)
          .single();

        const role = clientData?.rola || clientData?.role || user.user_metadata?.role;
        adminCheck = (role === 'admin' || role === 'administrator');
      }
      setIsAdmin(adminCheck);

      if (adminCheck) {
        // Administrator pobiera całą historię akceptacji oraz listę klientów do mapowania nazwisk
        const { data: allHistory } = await supabase
          .from('regulation_acceptances')
          .select(`
            id,
            user_id,
            user_email,
            regulation_slug,
            accepted_at,
            regulations ( title )
          `)
          .order('accepted_at', { ascending: false });

        if (allHistory) setHistory(allHistory as any);

        const { data: allClients } = await supabase
          .from('klienci')
          .select('Imię, Nazwisko, "E-mail"');

        if (allClients) setClients(allClients as any);
      } else {
        // Zwykły klubowicz pobiera tylko swoją historię
        const { data: historyData } = await supabase
          .from('regulation_acceptances')
          .select(`
            id,
            user_id,
            user_email,
            regulation_slug,
            accepted_at,
            regulations ( title )
          `)
          .eq('user_id', user.id)
          .order('accepted_at', { ascending: false });

        if (historyData) {
          setHistory(historyData as any);
        }
      }
    }

    // Pobranie regulaminów
    const { data: regData } = await supabase
      .from('regulations')
      .select('*')
      .order('id', { ascending: true });

    if (regData) {
      setRegulations(regData);
    }

    setLoading(false);
  };

  const handleOpenModal = (regulation: Regulation | null, edit: boolean = false, createNew: boolean = false) => {
    if (createNew) {
      setSelectedRegulation(null);
      setIsEditMode(true);
      setIsCreatingNew(true);
      setEditTitle('');
      setEditContent('');
      setEditCheckboxText('');
      setForceAccept(false);
    } else if (regulation) {
      setSelectedRegulation(regulation);
      setIsEditMode(edit);
      setIsCreatingNew(false);
      setEditTitle(regulation.title || '');
      setEditContent(regulation.content || '');
      setEditCheckboxText(regulation.checkbox_text || '');
      setForceAccept(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedRegulation(null);
    setIsEditMode(false);
    setIsCreatingNew(false);
    setEditTitle('');
    setEditContent('');
    setEditCheckboxText('');
    setForceAccept(false);
  };

  const handleSaveRegulation = async () => {
    setIsSaving(true);

    if (isCreatingNew) {
      const newSlug = editTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now();
      
      const payload: any = { 
        slug: newSlug, 
        title: editTitle, 
        content: editContent, 
        checkbox_text: editCheckboxText 
      };

      if (forceAccept) {
        payload.force_accept_date = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from('regulations')
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        setRegulations([...regulations, data]);
        handleCloseModal();
      } else {
        console.error(error);
        alert('Wystąpił błąd podczas dodawania regulaminu.');
      }
    } else if (selectedRegulation) {
      const payload: any = { 
        title: editTitle, 
        content: editContent, 
        checkbox_text: editCheckboxText,
        updated_at: new Date().toISOString() 
      };

      if (forceAccept) {
        payload.force_accept_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from('regulations')
        .update(payload)
        .eq('id', selectedRegulation.id);

      if (!error) {
        setRegulations(regulations.map(r => r.id === selectedRegulation.id ? { ...r, ...payload } : r));
        handleCloseModal();
      } else {
        console.error(error);
        alert('Wystąpił błąd podczas zapisywania regulaminu.');
      }
    }
    
    setIsSaving(false);
  };

  const handleDeleteRegulation = async () => {
    if (!selectedRegulation) return;
    
    const confirmDelete = window.confirm("Czy na pewno chcesz usunąć ten dokument? Tej operacji nie można cofnąć.");
    if (!confirmDelete) return;

    setIsSaving(true);
    const { error } = await supabase
      .from('regulations')
      .delete()
      .eq('id', selectedRegulation.id);

    if (!error) {
      setRegulations(regulations.filter(r => r.id !== selectedRegulation.id));
      handleCloseModal();
    } else {
      console.error(error);
      alert('Wystąpił błąd podczas usuwania regulaminu.');
    }
    setIsSaving(false);
  };

  const handleAcceptRegulation = async (slug: string) => {
    if (!userId) return;
    setIsSaving(true);
    
    const { error } = await supabase
      .from('regulation_acceptances')
      .insert([{ 
        user_id: userId, 
        user_email: userEmail,
        regulation_slug: slug 
      }]);

    if (!error) {
      await fetchData();
      handleCloseModal();
    } else {
      console.error(error);
      alert('Wystąpił błąd podczas akceptacji.');
    }
    setIsSaving(false);
  };

  const isAccepted = (slug: string) => {
    return history.some(h => h.regulation_slug === slug && h.user_id === userId);
  };

  const renderCheckboxPreview = (text: string) => {
    if (!text) return <span className="text-slate-400">Podgląd pojawi się tutaj...</span>;
    
    const parts = text.split(/\[\[(.*?)\]\]/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <span key={index} className="text-orange-600 font-bold underline cursor-pointer hover:text-orange-700 transition-colors">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Pomocnicza funkcja do znalezienia imienia i nazwiska klienta po adresie email
  const getClientNameByEmail = (email?: string) => {
    if (!email) return 'Klubowicz (brak adresu e-mail w historii)';
    const found = clients.find(c => c['E-mail']?.toLowerCase() === email.toLowerCase());
    if (found) {
      return `${found.Imię} ${found.Nazwisko}`;
    }
    return email; 
  };

  // Filtrowanie historii dla administratora po wpisaniu imienia/nazwiska/emaila
  const filteredHistory = history.filter(item => {
    if (!isAdmin || !adminSearchQuery.trim()) return true;
    const clientName = getClientNameByEmail(item.user_email).toLowerCase();
    const query = adminSearchQuery.toLowerCase();
    return clientName.includes(query) || (item.user_email && item.user_email.toLowerCase().includes(query));
  });

  // Lista przycięta do 10 elementów, jeśli historia nie jest rozwinięta
  const displayedHistory = isHistoryExpanded ? filteredHistory : filteredHistory.slice(0, 10);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full bg-slate-50 min-h-screen rounded-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Regulamin i dokumenty</h1>
          <p className="text-slate-500">Zapoznaj się z naszymi zasadami oraz historią Twoich akceptacji.</p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => handleOpenModal(null, true, true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2.5 rounded-xl transition-colors shadow-sm uppercase tracking-wider text-sm flex items-center gap-2 cursor-pointer"
          >
            <span>+</span> DODAJ DOKUMENT
          </button>
        )}
      </div>

      {/* KAFELKI REGULAMINÓW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {regulations.map((reg) => (
          <div key={reg.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all flex flex-col justify-between">
            <div className="mb-6">
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              </div>
              <h3 className="text-lg font-bold text-slate-800 leading-tight">{reg.title}</h3>
              {isAccepted(reg.slug) && !isAdmin && (
                <div className="flex items-center gap-1 text-green-600 mt-2 text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                  <span>Zaakceptowano</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-2 mt-auto">
              <button 
                onClick={() => handleOpenModal(reg, false)}
                className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                CZYTAJ
              </button>
              
              {isAdmin && (
                <button 
                  onClick={() => handleOpenModal(reg, true)}
                  className="w-full py-2.5 px-4 bg-orange-50 hover:bg-orange-100 text-orange-600 font-medium rounded-xl border border-orange-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                  EDYTUJ
                </button>
              )}
            </div>
          </div>
        ))}
        {regulations.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-100">
            Brak dodanych dokumentów.
          </div>
        )}
      </div>

      {/* SEKCJA HISTORIA AKCEPTACJI */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              {isAdmin ? 'Historia akceptacji wszystkich klubowiczów' : 'Historia akceptacji'}
            </h2>
            {filteredHistory.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Liczba wpisów: {filteredHistory.length}
              </p>
            )}
          </div>

          {/* Wyszukiwarka dla administratora */}
          {isAdmin && (
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="🔍 Szukaj imię i nazwisko..."
                value={adminSearchQuery}
                onChange={(e) => {
                  setAdminSearchQuery(e.target.value);
                  setIsHistoryExpanded(false);
                }}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-orange-500 text-slate-800 font-medium"
              />
            </div>
          )}
        </div>
        
        {filteredHistory.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            {adminSearchQuery ? 'Brak wyników pasujących do wyszukiwanego klubowicza.' : 'Brak historii akceptacji regulaminów w naszym systemie.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    {isAdmin && <th className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-slate-500">Klubowicz</th>}
                    <th className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-slate-500">Nazwa dokumentu</th>
                    <th className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-slate-500">Data akceptacji</th>
                    <th className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-slate-500 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      {isAdmin && (
                        <td className="py-4 px-6 text-sm text-slate-800 font-bold">
                          {getClientNameByEmail(item.user_email)}
                        </td>
                      )}
                      <td className="py-4 px-6 text-sm text-slate-800 font-medium">
                        {item.regulations?.title || item.regulation_slug}
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                          {new Date(item.accepted_at).toLocaleString('pl-PL', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-right">
                        <span className="inline-flex items-center gap-1.5 text-green-700 bg-green-50 px-3 py-1 rounded-full text-xs font-bold border border-green-200">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                          ZAAKCEPTOWANY
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Przycisk rozwijania / zwijania listy od 10 pozycji */}
            {filteredHistory.length > 10 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-center">
                <button
                  onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                  className="px-5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <span>
                    {isHistoryExpanded
                      ? 'Zwiń listę do 10 pozycji'
                      : `Pokaż wszystkie (${filteredHistory.length} pozycji)`}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${isHistoryExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL PODGLĄDU / EDYCJI */}
      {(selectedRegulation || isCreatingNew) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                {isEditMode ? (
                  isCreatingNew ? 'Dodawanie nowego dokumentu' : 'Edycja dokumentu'
                ) : (
                  <>Podgląd dokumentu: {selectedRegulation?.title}</>
                )}
              </h3>
              <button 
                onClick={handleCloseModal} 
                className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 p-2 rounded-full transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {isEditMode ? (
                <div className="h-full flex flex-col gap-5">
                  <div>
                    <label className="text-sm font-semibold text-slate-600 block mb-1">Tytuł dokumentu *</label>
                    <input
                      type="text"
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-slate-800 font-medium bg-white text-xs"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="np. Rezygnacja z prawa do zwrotu"
                    />
                  </div>

                  <div className="bg-sky-50 border border-sky-100 p-4 rounded-xl space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-slate-600 block mb-1">Tekst przy checkboxie (widoczny przy rejestracji) *</label>
                      <input
                        type="text"
                        className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-slate-800 bg-white text-xs"
                        value={editCheckboxText}
                        onChange={(e) => setEditCheckboxText(e.target.value)}
                        placeholder="np. Zapoznałem się i akceptuję [[Regulamin klubu]]"
                      />
                      <p className="text-xs text-sky-700 mt-2 font-medium">
                        Użyj podwójnych nawiasów <strong>[[ ]]</strong>, aby podlinkować dokument w wybranym miejscu.
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-sky-100 shadow-sm">
                      <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Podgląd tekstu przy checkboxie:</p>
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded border-2 border-slate-300 bg-slate-50 shrink-0"></div>
                        <div className="text-xs text-slate-700 select-none">
                          {renderCheckboxPreview(editCheckboxText)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col">
                    <label className="text-sm font-semibold text-slate-600 block mb-1">Treść regulaminu</label>
                    <textarea
                      className="w-full flex-1 min-h-[250px] p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none text-slate-700 bg-white text-xs"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="Tutaj wpisz pełną treść dokumentu..."
                    />
                  </div>
                  
                  <div className="mt-2 bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-start gap-3">
                    <input 
                      type="checkbox" 
                      id="forceAccept" 
                      checked={forceAccept}
                      onChange={(e) => setForceAccept(e.target.checked)}
                      className="mt-1 w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500 cursor-pointer"
                    />
                    <label htmlFor="forceAccept" className="text-sm font-bold text-slate-800 cursor-pointer">
                      Wymuś ponowną akceptację przez wszystkich klubowiczów
                      <span className="block text-xs font-normal text-slate-600 mt-0.5">
                        Jeśli zaznaczysz tę opcję, po zapisaniu zmian każdy klubowicz przy wejściu do aplikacji zobaczy okno blokujące dostęp do momentu akceptacji tego dokumentu.
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="prose prose-slate max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed text-xs">
                  {selectedRegulation?.content || 'Treść tego dokumentu nie została jeszcze uzupełniona.'}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-between gap-3 bg-slate-50 rounded-b-2xl items-center">
              <div>
                {isEditMode && !isCreatingNew && isAdmin && (
                  <button 
                    onClick={handleDeleteRegulation}
                    disabled={isSaving}
                    className="px-5 py-2.5 text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors font-semibold disabled:opacity-50 flex items-center gap-2 cursor-pointer text-xs"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    Usuń dokument
                  </button>
                )}
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={handleCloseModal}
                  disabled={isSaving}
                  className="px-6 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-semibold disabled:opacity-50 cursor-pointer text-xs"
                >
                  Anuluj
                </button>
                
                {isEditMode ? (
                  <button 
                    onClick={handleSaveRegulation}
                    disabled={isSaving || !editTitle.trim()}
                    className="px-6 py-2.5 text-white bg-orange-600 rounded-xl hover:bg-orange-700 transition-colors font-semibold shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer text-xs"
                  >
                    {isSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                  </button>
                ) : (
                  !isAdmin && selectedRegulation && !isAccepted(selectedRegulation.slug) && (
                    <button 
                      onClick={() => handleAcceptRegulation(selectedRegulation.slug)}
                      disabled={isSaving}
                      className="px-6 py-2.5 text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors font-semibold shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer text-xs"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      {isSaving ? 'Przetwarzanie...' : 'Akceptuję regulamin'}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
