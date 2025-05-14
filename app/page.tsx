import { DataFetcher } from "@/components/data-fetcher";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 md:px-8 lg:px-12">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10">
          {/* Titre principal */}
          <h1 className="text-5xl font-extrabold text-brand-dark mb-4">
            Dashboard des données énergétiques ENTSO-E
          </h1>
          <p className="text-muted-foreground text-xl">
            Récupérez, visualisez et exportez les données énergétiques du Réseau
            Européen des Opérateurs de Système de Transport.
          </p>
        </header>

        {/* Section DataFetcher */}
        <div className="space-y-8">
          <DataFetcher />
        </div>

        {/* Footer discret */}
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>
            Fait par <span className="font-semibold">LG</span>
          </p>
        </footer>
      </div>
    </main>
  );
}
