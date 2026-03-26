import Stripe from 'stripe';

export interface StripeEnv {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
}

let cachedStripeClient: Stripe | null = null;

function readRequiredEnv(envKey: string): string {
  const value = process.env[envKey];
  if (!value) {
    throw new Error(`Missing required environment variable: ${envKey}`);
  }
  return value;
}

export function getStripeEnv(): StripeEnv {
  return {
    secretKey: readRequiredEnv('STRIPE_SECRET_KEY'),
    publishableKey: readRequiredEnv('STRIPE_PUBLISHABLE_KEY'),
    webhookSecret: readRequiredEnv('STRIPE_WEBHOOK_SECRET'),
  };
}

export function getStripeClient(): Stripe {
  if (cachedStripeClient) {
    return cachedStripeClient;
  }

  const { secretKey } = getStripeEnv();
  cachedStripeClient = new Stripe(secretKey);
  return cachedStripeClient;
}

export function resetStripeClientForTests(): void {
  cachedStripeClient = null;
}
