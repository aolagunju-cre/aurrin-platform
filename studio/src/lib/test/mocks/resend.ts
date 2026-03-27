import { createSpy } from './spy';

export interface ResendMock {
  emails: {
    send: ReturnType<
      typeof createSpy<
        (params: {
          to: string;
          from?: string;
          subject?: string;
          html?: string;
          text?: string;
        }) => Promise<{ id: string }>
      >
    >;
  };
}

export function createResendMock(): ResendMock {
  return {
    emails: {
      send: createSpy(async () => ({
        id: 're_test_mock',
      })),
    },
  };
}

