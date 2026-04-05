'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';

interface SponsorshipTier {
  id: string;
  founder_id: string;
  label: string;
  amount_cents: number;
  perk_description: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface TierFormState {
  label: string;
  amount_dollars: string;
  perk_description: string;
  sort_order: string;
}

const EMPTY_FORM: TierFormState = {
  label: '',
  amount_dollars: '',
  perk_description: '',
  sort_order: '0',
};

export default function FounderTiersPage(): React.ReactElement {
  const [tiers, setTiers] = useState<SponsorshipTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [form, setForm] = useState<TierFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  const [deletingTierId, setDeletingTierId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [togglingTierId, setTogglingTierId] = useState<string | null>(null);

  const loadTiers = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/founder/tiers');
      const payload = (await res.json()) as { success: boolean; data?: SponsorshipTier[]; message?: string };
      if (!res.ok || !payload.success) throw new Error(payload.message ?? 'Failed to load tiers.');
      setTiers(payload.data ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load tiers.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTiers();
  }, [loadTiers]);

  function openAddForm(): void {
    setEditingTierId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEditForm(tier: SponsorshipTier): void {
    setEditingTierId(tier.id);
    setForm({
      label: tier.label,
      amount_dollars: String(tier.amount_cents / 100),
      perk_description: tier.perk_description,
      sort_order: String(tier.sort_order),
    });
    setFormError(null);
    setShowForm(true);
  }

  function closeForm(): void {
    setShowForm(false);
    setEditingTierId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function handleFormSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);

    const dollars = parseFloat(form.amount_dollars);
    if (!form.label.trim()) {
      setFormError('Label is required.');
      return;
    }
    if (isNaN(dollars) || dollars <= 0) {
      setFormError('Amount must be a positive number.');
      return;
    }
    if (!form.perk_description.trim()) {
      setFormError('Perk description is required.');
      return;
    }

    setFormSaving(true);
    try {
      const body = {
        label: form.label.trim(),
        amount_dollars: dollars,
        perk_description: form.perk_description.trim(),
        sort_order: parseInt(form.sort_order, 10) || 0,
      };

      const url = editingTierId ? `/api/founder/tiers/${editingTierId}` : '/api/founder/tiers';
      const method = editingTierId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { success: boolean; message?: string };
      if (!res.ok || !payload.success) throw new Error(payload.message ?? 'Failed to save tier.');

      closeForm();
      await loadTiers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save tier.');
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDelete(tierId: string): Promise<void> {
    if (deleteConfirmId !== tierId) {
      setDeleteConfirmId(tierId);
      return;
    }
    setDeletingTierId(tierId);
    setDeleteConfirmId(null);
    try {
      const res = await fetch(`/api/founder/tiers/${tierId}`, { method: 'DELETE' });
      const payload = (await res.json()) as { success: boolean; message?: string };
      if (!res.ok || !payload.success) throw new Error(payload.message ?? 'Failed to delete tier.');
      await loadTiers();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to delete tier.');
    } finally {
      setDeletingTierId(null);
    }
  }

  async function handleToggleActive(tier: SponsorshipTier): Promise<void> {
    setTogglingTierId(tier.id);
    try {
      const res = await fetch(`/api/founder/tiers/${tier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !tier.active }),
      });
      const payload = (await res.json()) as { success: boolean; message?: string };
      if (!res.ok || !payload.success) throw new Error(payload.message ?? 'Failed to update tier.');
      await loadTiers();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to toggle tier.');
    } finally {
      setTogglingTierId(null);
    }
  }

  function formatDollars(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  return (
    <section className="container mx-auto max-w-3xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/founder/dashboard" className="text-violet-500 hover:text-violet-400 text-sm transition-colors">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mt-4">Sponsorship Tiers</h1>
          <p className="text-default-500 mt-1">Manage the tiers donors can choose when supporting your work.</p>
        </div>
        {!showForm && (
          <Button
            color="primary"
            onPress={openAddForm}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            Add Tier
          </Button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { void handleFormSubmit(e); }}
          className="rounded-xl border border-default-200 bg-default-50 dark:bg-default-100 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-foreground">
            {editingTierId ? 'Edit Tier' : 'Add New Tier'}
          </h2>

          <Input
            label="Label"
            placeholder='e.g. "Bronze Supporter"'
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            isRequired
            variant="bordered"
            classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }}
          />

          <Input
            label="Minimum Amount (dollars)"
            placeholder="e.g. 25"
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount_dollars}
            onChange={(e) => setForm((f) => ({ ...f, amount_dollars: e.target.value }))}
            isRequired
            variant="bordered"
            classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }}
          />

          <div className="grid gap-1.5">
            <label htmlFor="perk_description" className="text-sm text-foreground">
              Perk Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="perk_description"
              value={form.perk_description}
              onChange={(e) => setForm((f) => ({ ...f, perk_description: e.target.value }))}
              placeholder="What does the donor receive at this tier?"
              required
              className="w-full rounded-xl border border-default-200 bg-default-100 px-4 py-2 text-foreground placeholder:text-default-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 min-h-[80px] resize-y"
            />
          </div>

          <Input
            label="Sort Order"
            placeholder="0"
            type="number"
            min="0"
            step="1"
            value={form.sort_order}
            onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
            variant="bordered"
            classNames={{ inputWrapper: 'border-default-200 dark:border-gray-700 hover:border-violet-500/50' }}
          />

          {formError && (
            <p className="text-sm text-red-500">{formError}</p>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              color="primary"
              isLoading={formSaving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {editingTierId ? 'Save Changes' : 'Create Tier'}
            </Button>
            <Button
              type="button"
              variant="flat"
              onPress={closeForm}
              isDisabled={formSaving}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loadError && (
        <p className="text-sm text-red-500">{loadError}</p>
      )}

      {isLoading ? (
        <p className="text-default-500 text-sm">Loading tiers…</p>
      ) : tiers.length === 0 ? (
        <p className="text-default-500 text-sm">No sponsorship tiers yet. Click "Add Tier" to create your first one.</p>
      ) : (
        <ul className="space-y-3">
          {tiers.map((tier) => (
            <li
              key={tier.id}
              className="rounded-xl border border-default-200 bg-default-50 dark:bg-default-100 p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{tier.label}</span>
                    <span className="text-violet-500 font-medium">{formatDollars(tier.amount_cents)}</span>
                    {!tier.active && (
                      <span className="text-xs bg-default-200 text-default-500 rounded px-1.5 py-0.5">Inactive</span>
                    )}
                  </div>
                  <p className="text-sm text-default-500 mt-1">{tier.perk_description}</p>
                  <p className="text-xs text-default-400 mt-0.5">Sort order: {tier.sort_order}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => { void handleToggleActive(tier); }}
                    disabled={togglingTierId === tier.id}
                    aria-label={tier.active ? 'Deactivate tier' : 'Activate tier'}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      tier.active
                        ? 'border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        : 'border-default-300 text-default-500 hover:bg-default-100'
                    } disabled:opacity-50`}
                  >
                    {togglingTierId === tier.id ? '…' : tier.active ? 'Active' : 'Inactive'}
                  </button>

                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => openEditForm(tier)}
                  >
                    Edit
                  </Button>

                  <Button
                    size="sm"
                    variant="flat"
                    color={deleteConfirmId === tier.id ? 'danger' : 'default'}
                    isLoading={deletingTierId === tier.id}
                    onPress={() => { void handleDelete(tier.id); }}
                  >
                    {deleteConfirmId === tier.id ? 'Confirm Delete' : 'Delete'}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
