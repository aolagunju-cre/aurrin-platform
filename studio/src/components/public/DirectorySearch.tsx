'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';

interface DirectoryProfileSummary {
  founder_slug: string;
  founder_name: string | null;
  company: string | null;
  industry: string | null;
  stage: string | null;
  summary: string | null;
  photo: string | null;
  score: number | null;
  event: {
    id: string;
    name: string;
  };
}

interface DirectoryResponse {
  success: boolean;
  message?: string;
  data?: DirectoryProfileSummary[];
}

interface FilterState {
  search: string;
  industry: string;
  stage: string;
  event: string;
  minScore: string;
  maxScore: string;
}

const INITIAL_FILTERS: FilterState = {
  search: '',
  industry: '',
  stage: '',
  event: '',
  minScore: '',
  maxScore: '',
};

function toExcerpt(value: string | null): string {
  if (!value) {
    return 'Summary not available.';
  }

  if (value.length <= 180) {
    return value;
  }

  return `${value.slice(0, 177)}...`;
}

function buildQuery(filters: FilterState): string {
  const params = new URLSearchParams();

  if (filters.search.trim()) {
    params.set('search', filters.search.trim());
  }

  if (filters.industry.trim()) {
    params.set('industry', filters.industry.trim());
  }

  if (filters.stage.trim()) {
    params.set('stage', filters.stage.trim());
  }

  if (filters.event.trim()) {
    params.set('event', filters.event.trim());
  }

  if (filters.minScore.trim()) {
    params.set('minScore', filters.minScore.trim());
  }

  if (filters.maxScore.trim()) {
    params.set('maxScore', filters.maxScore.trim());
  }

  return params.toString();
}

export function DirectorySearch() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [activeFilters, setActiveFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [results, setResults] = useState<DirectoryProfileSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const eventOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const item of results) {
      if (item.event.id && item.event.name) {
        options.set(item.event.id, item.event.name);
      }
    }
    return Array.from(options.entries()).map(([id, name]) => ({ id, name }));
  }, [results]);

  useEffect(() => {
    let isActive = true;

    async function loadDirectory() {
      setIsLoading(true);
      setError('');

      const query = buildQuery(activeFilters);
      const endpoint = query ? `/api/public/directory?${query}` : '/api/public/directory';

      try {
        const response = await fetch(endpoint, { cache: 'no-store' });
        const payload = (await response.json()) as DirectoryResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.message ?? 'Unable to load founder directory.');
        }

        if (!isActive) {
          return;
        }

        setResults(payload.data ?? []);
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        setResults([]);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load founder directory.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadDirectory();

    return () => {
      isActive = false;
    };
  }, [activeFilters]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveFilters(filters);
  };

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
        <label htmlFor="directory-search">Search by company or founder name</label>
        <input
          id="directory-search"
          name="directory-search"
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          placeholder="Search founders"
        />

        <div
          style={{
            display: 'grid',
            gap: '0.75rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          }}
        >
          <label htmlFor="directory-industry" style={{ display: 'grid', gap: '0.25rem' }}>
            Industry
            <input
              id="directory-industry"
              value={filters.industry}
              onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value }))}
              placeholder="e.g. fintech"
            />
          </label>

          <label htmlFor="directory-stage" style={{ display: 'grid', gap: '0.25rem' }}>
            Stage
            <input
              id="directory-stage"
              value={filters.stage}
              onChange={(event) => setFilters((current) => ({ ...current, stage: event.target.value }))}
              placeholder="e.g. seed"
            />
          </label>

          <label htmlFor="directory-event" style={{ display: 'grid', gap: '0.25rem' }}>
            Event
            <select
              id="directory-event"
              value={filters.event}
              onChange={(event) => setFilters((current) => ({ ...current, event: event.target.value }))}
            >
              <option value="">All events</option>
              {eventOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="directory-min-score" style={{ display: 'grid', gap: '0.25rem' }}>
            Min score
            <input
              id="directory-min-score"
              type="number"
              min={0}
              max={100}
              value={filters.minScore}
              onChange={(event) => setFilters((current) => ({ ...current, minScore: event.target.value }))}
            />
          </label>

          <label htmlFor="directory-max-score" style={{ display: 'grid', gap: '0.25rem' }}>
            Max score
            <input
              id="directory-max-score"
              type="number"
              min={0}
              max={100}
              value={filters.maxScore}
              onChange={(event) => setFilters((current) => ({ ...current, maxScore: event.target.value }))}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit">Apply Filters</button>
          <button
            type="button"
            onClick={() => {
              setFilters(INITIAL_FILTERS);
              setActiveFilters(INITIAL_FILTERS);
            }}
          >
            Clear
          </button>
        </div>
      </form>

      {isLoading ? <p>Loading directory...</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {!isLoading && !error && results.length === 0 ? <p>No public founder profiles match your filters.</p> : null}

      <div
        data-testid="directory-grid"
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        }}
      >
        {results.map((item) => (
          <article key={item.founder_slug} style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: '1rem' }}>
            {item.photo ? (
              <img
                src={item.photo}
                alt={`${item.founder_name ?? item.company ?? 'Founder'} profile`}
                style={{ width: '100%', aspectRatio: '3 / 2', objectFit: 'cover', borderRadius: 6 }}
              />
            ) : null}
            <h2 style={{ marginBottom: '0.5rem' }}>{item.founder_name ?? 'Founder'}</h2>
            <p style={{ margin: '0 0 0.5rem' }}><strong>{item.company ?? 'Company unavailable'}</strong></p>
            <p style={{ margin: '0 0 0.25rem' }}>Industry: {item.industry ?? 'Not listed'}</p>
            <p style={{ margin: '0 0 0.25rem' }}>Stage: {item.stage ?? 'Not listed'}</p>
            <p style={{ margin: '0 0 0.25rem' }}>Event: {item.event.name}</p>
            <p style={{ margin: '0 0 0.5rem' }}>Aggregate score: {item.score ?? 'Not published'}</p>
            <p style={{ marginTop: 0 }}>{toExcerpt(item.summary)}</p>
            <Link href={`/public/directory/${encodeURIComponent(item.founder_slug)}`}>View Profile</Link>
          </article>
        ))}
      </div>
    </section>
  );
}
