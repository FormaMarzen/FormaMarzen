"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface PowiadomienieItem {
  id: number;
  created_at: string;
  odbiorca: string;
  odbiorca_id?: number;
  tytul: string;
  tresc: string;
  typ: string;
  status: string;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function HistoriaPowiadomienPage() {
  const [historia, setHistoria] = useState<PowiadomienieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  
  // Status subskrypcji push na bieżącym urządzeniu
  const [pushStatus, setPushStatus] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    fetchHistoria();
    checkPushPermission();
  }, []);

  const checkPushPermission = async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    if (Notification.permission === 'granted') {
      setPushStatus('granted');
    } else if (Notification.permission === 'denied') {
      setPushStatus('denied');
    } else {
      setPushStatus('prompt');
    }
  };

  const fetchHistoria = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('historia_powiadomien')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setHistoria(data);
    }
    setLoading(false);
  };

  const enablePushNotifications = async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Powiadomienia Web Push nie są wspierane na tej przeglądarce/urządzeniu.');
      return;
    }

    setIsSubscribing(true);
    setStatusMessage('');

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('denied');
        setStatusMessage('Odmówiono zgody na powiadomienia w przeglądarce.');
        setIsSubscribing(false);
        return;
      }

      setPushStatus('granted');

      // Rejestracja Service Workera
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('Brak zmiennej NEXT_PUBLIC_VAPID_PUBLIC_KEY');
      }

      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      const rawSub = JSON.parse(JSON.stringify(sub));

      // Sprawdzenie czy subskrypcja z tym endpointem już istnieje, aby uniknąć duplikatów
      const { data: existingSubs } = await supabase
        .from('push_subscriptions')
        .select('id, subscription')
        .eq('role', 'admin');

      const isAlreadySaved = existingSubs?.some(
        (s: any) => s.subscription?.endpoint === rawSub.endpoint
      );

      if (!isAlreadySaved) {
        const { error: insertErr } = await supabase
          .from('push_subscriptions')
          .insert([
            {
              user_id: 'admin_device',
              role: 'admin',
              subscription: rawSub
            }
          ]);

        if (insertErr) {
          throw insertErr;
        }
      }

      setStatusMessage('✅ Urządzenie zostało pomyślnie zarejestrowane! Będziesz otrzymywać powiadomienia push.');
    } catch (err: any) {
      console.error('Błąd aktywacji push:', err);
      setStatusMessage(`❌ Błąd rejestracji: ${err.message || 'Nieznany błąd'}`);
    } finally {
      setIsSubscribing(false);
    }
  };

  const filteredHistoria = historia.filter(item => 
    (item.tytul && item.tytul.toLowerCase().includes(filterQuery.toLowerCase())) ||
    (item.tresc && item.tresc.toLowerCase().includes(filterQuery.toLowerCase())) ||
    (item.odbiorca && item.odbiorca.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto font-sans antialiased text-slate-800">
      
      {/* Karta aktywacji urządzenia */}
      <div className="bg-gradient-to-r from-sky-500 to-indigo-600 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-black tracking-wide flex items-center gap-2">
            🔔 Powiadomienia Push Administratora
          </h2>
          <p className="text-xs text-sky-100 max-w-xl leading-relaxed">
            Kliknij poniższy przycisk, aby zarejestrować to urządzenie (tablet / telefon / komputer) do odbierania natychmiastowych powiadomień push o nowych rejestracjach klubowiczów oraz zakupach karnetów.
          </p>
        </div>
        
        <div className="shrink-0 flex flex-col sm:flex-row gap-2 items-center">
          <button
            onClick={enablePushNotifications}
            disabled={isSubscribing}
            className="px-6 py-3.5 bg-white text-sky-700 hover:bg-sky-50 font-black rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-75 cursor-pointer"
          >
            {isSubscribing ? 'Rejestrowanie urządzenia...' : '🔔 Włącz Push na tym urządzeniu'}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="bg-slate-900 text-white text-xs font-bold p-4 rounded-2xl border border-slate-700 shadow-md">
          {statusMessage}
        </div>
      )}

      {/* Nagłówek i wyszukiwarka */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Historia powiadomień</h1>
          <p className="text-xs text-slate-500 mt-0.5">Wszystkie wysłane powiadomienia do klubowiczów i administratorów</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Szukaj powiadomienia..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full sm:w-64 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
          />
          <button
            onClick={fetchHistoria}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Odśwież
          </button>
        </div>
      </div>

      {/* Tabela historii powiadomień */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Data i godzina</th>
                <th className="py-3.5 px-4">Odbiorca</th>
                <th className="py-3.5 px-4">Tytuł</th>
                <th className="py-3.5 px-4">Treść wiadomości</th>
                <th className="py-3.5 px-4">Kanał</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Ładowanie historii powiadomień...
                  </td>
                </tr>
              ) : filteredHistoria.length > 0 ? (
                filteredHistoria.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString('pl-PL')}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {item.odbiorca || 'Administrator'}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-sky-700 whitespace-nowrap">
                      {item.tytul}
                    </td>
                    <td className="py-3.5 px-4 max-w-md break-words text-slate-600">
                      {item.tresc}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200 uppercase tracking-wider">
                        {item.typ || 'PUSH'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                        {item.status || 'Wysłano'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Brak zarejestrowanych powiadomień w historii.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
