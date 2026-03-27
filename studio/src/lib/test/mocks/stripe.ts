import { createSpy } from './spy';

export interface StripeMock {
  checkout: {
    sessions: {
      create: ReturnType<typeof createSpy<(params?: Record<string, unknown>) => Promise<{ id: string; url: string }>>>;
    };
  };
  webhooks: {
    constructEvent: ReturnType<
      typeof createSpy<(payload: string | Buffer, signature: string, secret: string) => { id: string; type: string }>
    >;
  };
  subscriptions: {
    retrieve: ReturnType<typeof createSpy<(id: string) => Promise<{ id: string; status: string }>>>;
  };
}

export function createStripeMock(): StripeMock {
  return {
    checkout: {
      sessions: {
        create: createSpy(async () => ({
          id: 'cs_test_mock',
          url: 'https://checkout.stripe.test/session/cs_test_mock',
        })),
      },
    },
    webhooks: {
      constructEvent: createSpy(() => ({
        id: 'evt_test_mock',
        type: 'payment_intent.succeeded',
      })),
    },
    subscriptions: {
      retrieve: createSpy(async (id: string) => ({
        id,
        status: 'active',
      })),
    },
  };
}

