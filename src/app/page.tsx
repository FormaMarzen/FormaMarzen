"use client";

import React, { useState } from 'react';

interface Client {
  id: number;
  name: string;
  phone: string;
  status: 'Aktywny' | 'Wymaga opłaty' | 'Wygasł';
  plan: string;
  nextRenewal: string;
}

export default function Dashboard() {
  const [clients, setClients] = useState<Client[]>([
    { id: 1, name: "Anna Kowalska", phone: "500-111-222", status: "Aktywny", plan: "Treningi 2x/tydz", nextRenewal: "2026-08-15" },
    { id: 2, name: "Michał Nowak", phone: "600-333-444", status: "Wymaga opłaty", plan: "Prowadzenie Online", nextRenewal: "2026-08-01" },
    { id: 3, name: "Piotr Wiśniewski", phone: "700-555-666", status: "Wygasł", plan: "Karnet Open", nextRenewal: "2026-07-20" },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPlan, setNewPlan] = useState('Trening Personalny');

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    const newClient: Client = {
      id: Date.now(),
      name: newName,
      phone: newPhone || 'Brak telefonu',
      status: 'Aktywny',
      plan: newPlan,
      nextRenewal: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
    setClients([...clients, newClient]);
    setNewName('');
    setNewPhone('');
    setShowAddModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/40 p-6 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="text-xl font-black text-amber-500 uppercase tracking-wider mb-8">
            Forma Marzeń
          </div>
          <nav className="space-y-2">
            <a href="#" className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 text-amber-500 rounded-xl font-semibold border border-amber-500/20">
              Podopieczni
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800/50 rounded-xl font-medium transition-all">
              Grafik & Treningi
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800/50 rounded-xl font-medium transition-all">
              Pomiary & Postępy
            </a>
            <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800/50 rounded-xl font-medium transition-all">
              Finanse & Karnety
            </a>
          </nav>
        </div>
        <div className="text-xs text-slate-500 border-t border-slate-800 pt-4">
          System Zarządzania v1.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Baza Podopiecznych</h1>
            <p className="text-slate-400 text-sm mt-1">Zarządzaj aktywnymi karnetami i statusami opłat</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/10"
          >
            + Dodaj Podopiecznego
          </button>
        </header>

        {/* Podsumowanie (Stats) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
            <span className="text-slate-400 text-sm font-medium">Wszyscy Podopieczni</span>
            <div className="text-3xl font-bold mt-2 text-white">{clients.length}</div>
          </div>
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
            <span className="text-slate-400 text-sm font-medium">Aktywne Karnety</span>
            <div className="text-3xl font-bold mt-2 text-emerald-400">
              {clients.filter(c => c.status === 'Aktywny').length}
            </div>
          </div>
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
            <span className="text-slate-400 text-sm font-medium">Do Odnowienia / Wygasłe</span>
            <div className="text-3xl font-bold mt-2 text-rose-400">
              {clients.filter(c => c.status !== 'Aktywny').length}
            </div>
          </div>
        </div>

        {/* Tabela Klientów */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-slate-300">
              <thead className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Podopieczny</th>
                  <th className="px-6 py-4">Kontakt</th>
                  <th className="px-6 py-4">Plan / Pakiet</th>
                  <th className="px-6 py-4">Ważność</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-800/30 transition-all">
                    <td className="px-6 py-4 font-semibold text-white">{client.name}</td>
                    <td className="px-6 py-4 text-slate-400">{client.phone}</td>
                    <td className="px-6 py-4">{client.plan}</td>
                    <td className="px-6 py-4 text-slate-400">{client.nextRenewal}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        client.status === 'Aktywny' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        client.status === 'Wymaga opłaty' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {client.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal dodawania nowego klienta */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Dodaj Nowego Podopiecznego</h2>
            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Imię i Nazwisko</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  placeholder="np. Jan Kowalski"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Telefon</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  placeholder="np. 500-600-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Pakiet</label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                >
                  <option>Trening Personalny</option>
                  <option>Prowadzenie Online</option>
                  <option>Karnet Open</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-bold"
                >
                  Zapisz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
