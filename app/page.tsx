import { DataFetcher } from '@/components/data-fetcher';

export default function Home() {
  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 md:px-8 lg:px-12">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">ENTSO-E Energy Data Dashboard</h1>
          <p className="text-muted-foreground">
            Retrieve, visualize, and export energy data from the European Network of Transmission System Operators
          </p>
        </header>
        
        <DataFetcher />
      </div>
    </main>
  );
}