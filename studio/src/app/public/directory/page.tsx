import { DirectorySearch } from '../../../components/public/DirectorySearch';

export default function PublicDirectoryPage() {
  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '2rem 1rem', display: 'grid', gap: '1rem' }}>
      <h1 style={{ marginBottom: 0 }}>Aurrin Founder Directory</h1>
      <p style={{ marginTop: 0 }}>
        Browse public founder profiles, compare sectors and stages, and open a dedicated profile page for each team.
      </p>
      <DirectorySearch />
    </main>
  );
}
