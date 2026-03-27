import type { SupabaseClient } from '../../db/client';

type MockDb = Record<string, (...args: any[]) => Promise<{ data?: any; error: Error | null }>>;

export interface SupabaseMockOverrides {
  storage?: Partial<SupabaseClient['storage']>;
  db?: MockDb;
}

function defaultDbResult() {
  return { data: null, error: null };
}

export function createSupabaseMock(overrides: SupabaseMockOverrides = {}): SupabaseClient {
  const storageDefaults: SupabaseClient['storage'] = {
    upload: async () => ({ path: 'mock/path', error: null }),
    remove: async () => ({ error: null }),
    createSignedUrl: async () => ({ signedUrl: 'https://example.test/signed', error: null }),
  };

  const dbProxy = new Proxy({}, {
    get(_target, key) {
      const method = overrides.db?.[String(key)];
      if (method) {
        return method;
      }
      return async () => defaultDbResult();
    },
  }) as SupabaseClient['db'];

  return {
    storage: {
      ...storageDefaults,
      ...overrides.storage,
    },
    db: dbProxy,
  };
}

