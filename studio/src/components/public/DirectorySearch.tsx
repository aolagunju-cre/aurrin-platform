'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';
import { Spinner } from '@heroui/spinner';

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
    <section className="grid gap-6">
      <form onSubmit={onSubmit} className="grid gap-4">
        <Input
          id="directory-search"
          name="directory-search"
          label="Search by company or founder name"
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          placeholder="Search founders"
          variant="bordered"
          classNames={{
            inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Input
            id="directory-industry"
            label="Industry"
            value={filters.industry}
            onChange={(event) => setFilters((current) => ({ ...current, industry: event.target.value }))}
            placeholder="e.g. fintech"
            variant="bordered"
            classNames={{
              inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
            }}
          />

          <Input
            id="directory-stage"
            label="Stage"
            value={filters.stage}
            onChange={(event) => setFilters((current) => ({ ...current, stage: event.target.value }))}
            placeholder="e.g. seed"
            variant="bordered"
            classNames={{
              inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
            }}
          />

          <div className="grid gap-1.5">
            <label htmlFor="directory-event" className="text-sm text-foreground">
              Event
            </label>
            <select
              id="directory-event"
              value={filters.event}
              onChange={(event) => setFilters((current) => ({ ...current, event: event.target.value }))}
              className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground focus:border-violet-500 focus:outline-none"
            >
              <option value="">All events</option>
              {eventOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="directory-min-score"
            label="Min score"
            type="number"
            min={0}
            max={100}
            value={filters.minScore}
            onChange={(event) => setFilters((current) => ({ ...current, minScore: event.target.value }))}
            variant="bordered"
            classNames={{
              inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
            }}
          />

          <Input
            id="directory-max-score"
            label="Max score"
            type="number"
            min={0}
            max={100}
            value={filters.maxScore}
            onChange={(event) => setFilters((current) => ({ ...current, maxScore: event.target.value }))}
            variant="bordered"
            classNames={{
              inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50',
            }}
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" color="primary" className="bg-violet-600 hover:bg-violet-700">
            Apply Filters
          </Button>
          <Button
            type="button"
            color="default"
            variant="bordered"
            onPress={() => {
              setFilters(INITIAL_FILTERS);
              setActiveFilters(INITIAL_FILTERS);
            }}
          >
            Clear
          </Button>
        </div>
      </form>

      {isLoading ? (
        <div className="flex items-center gap-3 py-8">
          <Spinner color="secondary" size="sm" />
          <p className="text-default-500">Loading directory...</p>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-danger text-sm">{error}</p> : null}

      {!isLoading && !error && results.length === 0 ? (
        <p className="text-default-500 py-4">No public founder profiles match your filters.</p>
      ) : null}

      <div
        data-testid="directory-grid"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {results.map((item) => (
          <article
            key={item.founder_slug}
            className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6 transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10"
          >
            {item.photo ? (
              <img
                src={item.photo}
                alt={`${item.founder_name ?? item.company ?? 'Founder'} profile`}
                className="w-full aspect-[3/2] object-cover rounded-xl mb-4"
              />
            ) : null}
            <h2 className="text-lg font-semibold text-foreground mb-2">
              {item.founder_name ?? 'Founder'}
            </h2>
            <p className="font-semibold text-foreground mb-2">
              {item.company ?? 'Company unavailable'}
            </p>
            <p className="text-sm text-default-600 mb-1">
              Industry: {item.industry ?? 'Not listed'}
            </p>
            <p className="text-sm text-default-600 mb-1">
              Stage: {item.stage ?? 'Not listed'}
            </p>
            <p className="text-sm text-default-600 mb-1">
              Event: {item.event.name}
            </p>
            <p className="text-sm text-default-600 mb-3">
              Aggregate score: {item.score ?? 'Not published'}
            </p>
            <p className="text-sm text-default-500 mb-4">{toExcerpt(item.summary)}</p>
            <Link
              href={`/public/directory/${encodeURIComponent(item.founder_slug)}`}
              className="text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors"
            >
              View Profile
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
