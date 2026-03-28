'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';
import Link from 'next/link';

interface PledgeTier {
  name: string;
  amount_cents: number;
  description: string;
}

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  story: string | null;
  funding_goal_cents: number;
  amount_raised_cents: number;
  donor_count: number;
  e_transfer_email: string | null;
  status: 'draft' | 'active' | 'funded' | 'closed';
  pledge_tiers: PledgeTier[];
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
  }).format(cents / 100);

export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [story, setStory] = useState('');
  const [goalDollars, setGoalDollars] = useState('');
  const [eTransferEmail, setETransferEmail] = useState('');
  const [tiers, setTiers] = useState<PledgeTier[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/founder/campaign/${id}`);
        const payload = await res.json() as { success: boolean; data?: Campaign; message?: string };
        if (!res.ok || !payload.success || !payload.data) throw new Error(payload.message || 'Not found');
        const c = payload.data;
        setCampaign(c);
        setTitle(c.title);
        setDescription(c.description ?? '');
        setStory(c.story ?? '');
        setGoalDollars(String(c.funding_goal_cents / 100));
        setETransferEmail(c.e_transfer_email ?? '');
        setTiers(c.pledge_tiers ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaign');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  const addTier = () => {
    setTiers([...tiers, { name: '', amount_cents: 0, description: '' }]);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof PledgeTier, value: string | number) => {
    setTiers(tiers.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)));
  };

  const onSave = async () => {
    setError('');
    const goalCents = Math.round(parseFloat(goalDollars) * 100);
    if (!title.trim()) { setError('Title is required'); return; }
    if (!goalCents || goalCents < 100) { setError('Goal must be at least $1.00'); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/founder/campaign/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          story: story.trim(),
          funding_goal_cents: goalCents,
          e_transfer_email: eTransferEmail.trim(),
          pledge_tiers: tiers.filter((t) => t.name.trim() && t.amount_cents > 0),
        }),
      });
      const payload = await res.json() as { success: boolean; message?: string };
      if (!res.ok || !payload.success) throw new Error(payload.message || 'Save failed');
      router.push('/founder/campaign');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onStatusChange = async (newStatus: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/founder/campaign/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const payload = await res.json() as { success: boolean; data?: Campaign; message?: string };
      if (!res.ok || !payload.success) throw new Error(payload.message || 'Update failed');
      if (payload.data) setCampaign(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="container mx-auto max-w-3xl px-6 py-8">
        <p className="py-12 text-center text-default-400">Loading campaign...</p>
      </section>
    );
  }

  if (!campaign) {
    return (
      <section className="container mx-auto max-w-3xl px-6 py-8">
        <p role="alert" className="text-danger">{error || 'Campaign not found'}</p>
        <Link href="/founder/campaign" className="text-violet-500 hover:text-violet-400 text-sm mt-4 inline-block">
          ← Back to Campaigns
        </Link>
      </section>
    );
  }

  const progress =
    campaign.funding_goal_cents > 0
      ? Math.min(Math.round((campaign.amount_raised_cents / campaign.funding_goal_cents) * 100), 100)
      : 0;

  return (
    <section className="container mx-auto max-w-3xl px-6 py-8 space-y-6">
      <Link href="/founder/campaign" className="text-violet-500 hover:text-violet-400 text-sm transition-colors">
        ← Back to Campaigns
      </Link>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 text-center">
          <p className="text-2xl font-bold text-violet-400">{formatCurrency(campaign.amount_raised_cents)}</p>
          <p className="text-xs text-default-500">Raised</p>
        </div>
        <div className="p-4 rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 text-center">
          <p className="text-2xl font-bold text-foreground">{formatCurrency(campaign.funding_goal_cents)}</p>
          <p className="text-xs text-default-500">Goal</p>
        </div>
        <div className="p-4 rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 text-center">
          <p className="text-2xl font-bold text-foreground">{campaign.donor_count}</p>
          <p className="text-xs text-default-500">Donors</p>
        </div>
        <div className="p-4 rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 text-center">
          <p className="text-2xl font-bold text-violet-400">{progress}%</p>
          <p className="text-xs text-default-500">Funded</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 rounded-full bg-default-200 dark:bg-default-100/20 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            campaign.status === 'funded' ? 'bg-green-500' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status controls */}
      <div className="flex flex-wrap gap-3">
        {campaign.status === 'draft' && (
          <Button size="sm" color="primary" className="bg-violet-600" isDisabled={isSubmitting} onPress={() => void onStatusChange('active')}>
            Publish Campaign
          </Button>
        )}
        {campaign.status === 'active' && (
          <Button size="sm" variant="bordered" isDisabled={isSubmitting} onPress={() => void onStatusChange('closed')}>
            Close Campaign
          </Button>
        )}
      </div>

      {/* Edit Form */}
      <div className="grid gap-5 pt-4 border-t border-default-200">
        <h2 className="text-xl font-semibold">Edit Campaign</h2>

        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} isRequired variant="bordered"
          classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }} />

        <div className="grid gap-1.5">
          <label htmlFor="edit-description" className="text-sm text-foreground">Short Description</label>
          <textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 min-h-[80px] resize-y" />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="edit-story" className="text-sm text-foreground">Story (Problem / Solution / Use of Funds)</label>
          <textarea id="edit-story" value={story} onChange={(e) => setStory(e.target.value)}
            className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 min-h-[120px] resize-y" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Funding Goal (CAD)" type="number" min={1} value={goalDollars} onChange={(e) => setGoalDollars(e.target.value)}
            variant="bordered" classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }} />
          <Input label="E-Transfer Email" type="email" value={eTransferEmail} onChange={(e) => setETransferEmail(e.target.value)}
            variant="bordered" classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }} />
        </div>

        {/* Pledge Tiers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Pledge Tiers</h3>
            <button type="button" onClick={addTier} className="text-sm text-violet-500 hover:text-violet-400">+ Add Tier</button>
          </div>
          {tiers.map((tier, index) => (
            <div key={index} className="p-4 rounded-xl border border-default-200 dark:border-gray-700 bg-default-50 dark:bg-default-50/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-default-400">Tier {index + 1}</span>
                {tiers.length > 1 && (
                  <button type="button" onClick={() => removeTier(index)} className="text-xs text-danger">Remove</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input size="sm" label="Name" value={tier.name} onChange={(e) => updateTier(index, 'name', e.target.value)} variant="bordered"
                  classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700' }} />
                <Input size="sm" label="Amount (CAD)" type="number" min={1}
                  value={tier.amount_cents > 0 ? String(tier.amount_cents / 100) : ''}
                  onChange={(e) => updateTier(index, 'amount_cents', Math.round(parseFloat(e.target.value || '0') * 100))}
                  variant="bordered" classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700' }} />
              </div>
              <Input size="sm" label="Description" value={tier.description} onChange={(e) => updateTier(index, 'description', e.target.value)}
                variant="bordered" classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700' }} />
            </div>
          ))}
        </div>

        {error && <p role="alert" className="text-danger text-sm">{error}</p>}

        <Button color="primary" className="bg-violet-600 hover:bg-violet-700 max-w-[200px]"
          isDisabled={isSubmitting} isLoading={isSubmitting} onPress={() => void onSave()}>
          Save Changes
        </Button>
      </div>
    </section>
  );
}
