import React from 'react';
import { Button } from '@heroui/button';

export function PremiumContentNotice(): React.ReactElement {
  return (
    <section
      aria-label="Premium Content Notice"
      className="rounded-2xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 p-6 transition-all duration-300 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10 text-center"
    >
      <h2 className="mt-0 text-lg font-semibold text-foreground">Premium Content</h2>
      <p className="mb-4 text-default-600">Subscribe to access</p>
      <Button color="primary" variant="shadow">
        Subscribe
      </Button>
    </section>
  );
}
