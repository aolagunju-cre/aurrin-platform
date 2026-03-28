'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';
import Link from 'next/link';

interface PledgeTier {
  name: string;
  amount_cents: number;
  description: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [story, setStory] = useState('');
  const [goalDollars, setGoalDollars] = useState('');
  const [eTransferEmail, setETransferEmail] = useState('');
  const [tiers, setTiers] = useState<PledgeTier[]>([
    { name: 'Supplies', amount_cents: 2500, description: 'Help cover basic supplies and materials' },
    { name: 'Prototype', amount_cents: 10000, description: 'Fund a working prototype' },
    { name: 'Growth', amount_cents: 50000, description: 'Support travel, marketing, or team building' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const addTier = () => {
    setTiers([...tiers, { name: '', amount_cents: 0, description: '' }]);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof PledgeTier, value: string | number) => {
    setTiers(tiers.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)));
  };

  const onSubmit = async (status: 'draft' | 'active') => {
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    const goalCents = Math.round(parseFloat(goalDollars) * 100);
    if (!goalCents || goalCents < 100) {
      setError('Funding goal must be at least $1.00');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/founder/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          story: story.trim(),
          funding_goal_cents: goalCents,
          e_transfer_email: eTransferEmail.trim(),
          status,
          pledge_tiers: tiers.filter((t) => t.name.trim() && t.amount_cents > 0),
        }),
      });

      const payload = await res.json() as { success: boolean; data?: { id: string }; message?: string };
      if (!res.ok || !payload.success) throw new Error(payload.message || 'Failed to create campaign');

      router.push('/founder/campaign');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="container mx-auto max-w-3xl px-6 py-8 space-y-6">
      <div>
        <Link href="/founder/campaign" className="text-violet-500 hover:text-violet-400 text-sm transition-colors">
          ← Back to Campaigns
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mt-4">Create Campaign</h1>
        <p className="text-default-500 mt-1">Set up your crowdfunding campaign to raise support.</p>
      </div>

      <div className="grid gap-5">
        <Input
          label="Campaign Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          isRequired
          variant="bordered"
          classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }}
        />

        <div className="grid gap-1.5">
          <label htmlFor="description" className="text-sm text-foreground">Short Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief summary of your campaign (1-2 sentences)"
            className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 min-h-[80px] resize-y"
          />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="story" className="text-sm text-foreground">
            Your Story <span className="text-default-400">(Problem, Solution, Use of Funds)</span>
          </label>
          <textarea
            id="story"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="Tell supporters about the problem you're solving, your solution, and how the funds will be used..."
            className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 min-h-[160px] resize-y"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Funding Goal (CAD)"
            type="number"
            min={1}
            step={1}
            value={goalDollars}
            onChange={(e) => setGoalDollars(e.target.value)}
            placeholder="5000"
            isRequired
            variant="bordered"
            classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }}
          />
          <Input
            label="E-Transfer Email (optional)"
            type="email"
            value={eTransferEmail}
            onChange={(e) => setETransferEmail(e.target.value)}
            placeholder="you@example.com"
            variant="bordered"
            classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }}
          />
        </div>

        {/* Pledge Tiers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Pledge Tiers</h2>
            <button
              type="button"
              onClick={addTier}
              className="text-sm text-violet-500 hover:text-violet-400 transition-colors"
            >
              + Add Tier
            </button>
          </div>

          {tiers.map((tier, index) => (
            <div
              key={index}
              className="p-4 rounded-xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-400">Tier {index + 1}</span>
                {tiers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTier(index)}
                    className="text-xs text-danger hover:text-danger/80 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  size="sm"
                  label="Tier Name"
                  value={tier.name}
                  onChange={(e) => updateTier(index, 'name', e.target.value)}
                  variant="bordered"
                  classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700' }}
                />
                <Input
                  size="sm"
                  label="Amount (CAD)"
                  type="number"
                  min={1}
                  value={tier.amount_cents > 0 ? String(tier.amount_cents / 100) : ''}
                  onChange={(e) => updateTier(index, 'amount_cents', Math.round(parseFloat(e.target.value || '0') * 100))}
                  variant="bordered"
                  classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700' }}
                />
              </div>
              <Input
                size="sm"
                label="Description"
                value={tier.description}
                onChange={(e) => updateTier(index, 'description', e.target.value)}
                variant="bordered"
                classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700' }}
              />
            </div>
          ))}
        </div>

        {error && <p role="alert" className="text-danger text-sm">{error}</p>}

        <div className="flex gap-3">
          <Button
            color="primary"
            className="bg-violet-600 hover:bg-violet-700"
            isDisabled={isSubmitting}
            isLoading={isSubmitting}
            onPress={() => void onSubmit('active')}
          >
            Publish Campaign
          </Button>
          <Button
            variant="bordered"
            isDisabled={isSubmitting}
            onPress={() => void onSubmit('draft')}
          >
            Save as Draft
          </Button>
        </div>
      </div>
    </section>
  );
}
