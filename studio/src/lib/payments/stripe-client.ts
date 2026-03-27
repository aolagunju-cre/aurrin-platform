import Stripe from 'stripe';
import { getRuntimeEnv } from '../config/env';

export interface StripeEnv {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
}

let cachedStripeClient: Stripe | null = null;

function readRequiredEnv(envKey: string): string {
  const runtimeEnv = getRuntimeEnv();
  const envMap: Record<string, string | null> = {
    STRIPE_SECRET_KEY: runtimeEnv.stripeSecretKey,
    STRIPE_PUBLISHABLE_KEY: runtimeEnv.stripePublishableKey,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: runtimeEnv.stripePublishableKey,
    STRIPE_WEBHOOK_SECRET: runtimeEnv.stripeWebhookSecret,
  };
  const value = envMap[envKey] ?? process.env[envKey];
  if (!value) {
    throw new Error(`Missing required environment variable: ${envKey}`);
  }
  return value;
}

export function getStripeEnv(): StripeEnv {
  return {
    secretKey: readRequiredEnv('STRIPE_SECRET_KEY'),
    publishableKey: readRequiredEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
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
