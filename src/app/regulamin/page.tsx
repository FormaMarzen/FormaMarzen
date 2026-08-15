'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../raporty/klienci/supabase';

type Regulation = {
  id: string;
  slug: string;
  title: string;
  content: string;
  force_accept_date?: string;
};

type AcceptanceHistory = {
  id: string;
  regulation_slug: string;
  accepted_at: string;
  regulations: {
    title: string;
  };
};

export default function RegulaminPage() {
  const [regulations, setRegulations] = useState<Regulation[]>([]);
  const [history, setHistory] = useState<AcceptanceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAdmin, setIsAdmin] = useState(false); 
  const [userId, setUserId] = useState<string | null>(null);

  // Stan Modala
  const [selectedRegulation, setSelectedRegulation] = useState<Regulation | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
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
      
      // Sprawdzanie uprawnień administratora - identycznie jak w layout.tsx
      if (user.email === 'maciejklaput@gmail.com') {
        setIsAdmin(true);
      } else {
        const { data: clientData } = await supabase
          .from('klienci')
          .select('rola, role')
          .eq('id', user.id)
          .single();

        const role = clientData?.rola || clientData?.role || user.user_metadata?.role;
        setIsAdmin(role === 'admin' || role === 'administrator');
      }

      // Pobieranie historii dla użytkownika
      const { data: historyData } = await supabase
        .from('regulation_acceptances')
        .select(`
          id,
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
      setForceAccept(false);
    } else if (regulation) {
      setSelectedRegulation(regulation);
      setIsEditMode(edit);
      setIsCreatingNew(false);
      setEditTitle(regulation.title || '');
      setEditContent(regulation.content || '');
      setForceAccept(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedRegulation(null);
    setIsEditMode(false);
    setIsCreatingNew(false);
    setEditTitle('');
    setEditContent('');
    setForceAccept(false);
  };

  const handleSaveRegulation = async () => {
    setIsSaving(true);

    if (isCreatingNew) {
      // Tworzenie nowego regulaminu
      const newSlug = editTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now();
      
      const payload: any = { 
        slug: newSlug, 
        title: editTitle, 
        content: editContent 
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
      // Aktualizacja istniejącego
      const payload: any = { 
        title: editTitle, 
        content: editContent, 
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
      .insert([{ user_id: userId, regulation_slug: slug }]);

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
    return history.some(h => h.regulation_slug === slug);
  };

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
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2.5 rounded-xl transition-colors shadow-sm uppercase tracking-wider text-sm flex items-center gap-2"
          >
            <span>+</span> DODAJ DOKUMENT
          </button>
        )}
      </div>

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
                className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                CZYTAJ
              </button>
              
              {isAdmin && (
                <button 
                  onClick={() => handleOpenModal(reg, true)}
                  className="w-full py-2.5 px-4 bg-orange-50 hover:bg-orange-100 text-orange-600 font-medium rounded-xl border border-orange-200 transition-colors flex items-center justify-center gap-2"
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Historia akceptacji
          </h2>
        </div>
        
        {history.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            Brak historii akceptacji regulaminów w naszym systemie.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-slate-500">Nazwa dokumentu</th>
                  <th className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-slate-500">Data akceptacji</th>
                  <th className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-slate-500 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
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
        )}
      </div>

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
                className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {isEditMode ? (
                <div className="h-full flex flex-col gap-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-600 block mb-1">Tytuł dokumentu</label>
                    <input
                      type="text"
                      className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-slate-800 font-medium bg-white"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Wpisz nazwę, np. Regulamin klubu"
                    />
                  </div>
                  <div className="flex-1 flex flex-col">
                    <label className="text-sm font-semibold text-slate-600 block mb-1">Treść regulaminu</label>
                    <textarea
                      className="w-full flex-1 min-h-[250px] p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none text-slate-700 bg-white"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="Tutaj wpisz treść dokumentu..."
                    />
                  </div>
                  
                  <div className="mt-2 bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-start gap-3">
                    <input 
                      type="checkbox" 
                      id="forceAccept" 
                      checked={forceAccept}
                      onChange={(e) => setForceAccept(e.target.checked)}
                      className="mt-1 w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
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
                <div className="prose prose-slate max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">
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
                    className="px-5 py-2.5 text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl transition-colors font-semibold disabled:opacity-50 flex items-center gap-2"
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
                  className="px-6 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-semibold disabled:opacity-50"
                >
                  Anuluj
                </button>
                
                {isEditMode ? (
                  <button 
                    onClick={handleSaveRegulation}
                    disabled={isSaving || !editTitle.trim()}
                    className="px-6 py-2.5 text-white bg-orange-600 rounded-xl hover:bg-orange-700 transition-colors font-semibold shadow-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                  </button>
                ) : (
                  !isAdmin && selectedRegulation && !isAccepted(selectedRegulation.slug) && (
                    <button 
                      onClick={() => handleAcceptRegulation(selectedRegulation.slug)}
                      disabled={isSaving}
                      className="px-6 py-2.5 text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors font-semibold shadow-sm disabled:opacity-50 flex items-center gap-2"
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