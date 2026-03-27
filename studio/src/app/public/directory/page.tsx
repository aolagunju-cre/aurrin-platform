import { DirectorySearch } from '../../../components/public/DirectorySearch';

export default function PublicDirectoryPage() {
  return (
    <main className="container mx-auto max-w-7xl px-6 py-8 grid gap-4">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Aurrin Founder Directory</h1>
      <p className="text-lg text-default-500 mt-1">
        Browse public founder profiles, compare sectors and stages, and open a dedicated profile page for each team.
      </p>
      <DirectorySearch />
    </main>
  );
}
