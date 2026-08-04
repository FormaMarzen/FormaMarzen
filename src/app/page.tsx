export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-900 text-white font-sans">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-blue-500">
          Forma Marzeń
        </h1>
        <p className="text-slate-300 text-lg">
          Witaj w nowej aplikacji! Środowisko jest gotowe do budowania projektu.
        </p>
        <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all shadow-lg">
          Rozpoczynamy!
        </button>
      </div>
    </main>
  );
}
