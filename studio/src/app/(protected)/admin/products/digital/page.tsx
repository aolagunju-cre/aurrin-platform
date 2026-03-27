'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/button';

type AccessType = 'perpetual' | 'time-limited';
type ProductStatus = 'draft' | 'active' | 'archived';

interface DigitalProduct {
  id: string;
  name: string;
  description: string;
  stripe_price_link: string;
  access_type: AccessType;
  file_id: string | null;
  file_path: string | null;
  sales_count: number;
  revenue_cents: number;
  status: ProductStatus;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

function formatMoney(amountCents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountCents / 100);
}

export default function AdminDigitalProductsPage(): React.ReactElement {
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<Record<string, File | null>>({});
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    stripe_price_link: '',
    access_type: 'perpetual' as AccessType,
  });

  const totals = useMemo(() => products.reduce((acc, item) => {
    acc.sales += item.sales_count;
    acc.revenue += item.revenue_cents;
    return acc;
  }, { sales: 0, revenue: 0 }), [products]);

  async function loadProducts(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/commerce/products/digital');
      const payload = await response.json() as ApiResponse<DigitalProduct[]>;
      if (!response.ok || !payload.success) {
        throw new Error(payload.message ?? 'Could not load digital products.');
      }
      setProducts(payload.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load digital products.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  async function createProduct(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    const response = await fetch('/api/commerce/products/digital', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const payload = await response.json() as ApiResponse<DigitalProduct>;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Could not create digital product.');
      return;
    }

    setDraft({ name: '', description: '', stripe_price_link: '', access_type: 'perpetual' });
    await loadProducts();
  }

  async function saveProduct(product: DigitalProduct): Promise<void> {
    setError(null);
    const response = await fetch(`/api/commerce/products/digital/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: product.name,
        description: product.description,
        stripe_price_link: product.stripe_price_link,
        access_type: product.access_type,
        status: product.status,
      }),
    });

    const payload = await response.json() as ApiResponse<DigitalProduct>;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Could not save digital product.');
      return;
    }

    await loadProducts();
  }

  async function deleteProduct(productId: string): Promise<void> {
    const confirmed = window.confirm('Delete this digital product?');
    if (!confirmed) {
      return;
    }

    setError(null);
    const response = await fetch(`/api/commerce/products/digital/${productId}`, {
      method: 'DELETE',
    });
    const payload = await response.json() as ApiResponse<unknown>;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Could not delete digital product.');
      return;
    }

    await loadProducts();
  }

  async function uploadProductFile(productId: string): Promise<void> {
    const file = uploadFiles[productId];
    if (!file) {
      setError('Select a file before uploading.');
      return;
    }

    setError(null);
    setUploadingProductId(productId);
    try {
      const formData = new FormData();
      formData.append('product_id', productId);
      formData.append('file', file);

      const response = await fetch('/api/commerce/products/digital/upload', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json() as ApiResponse<{ file_id: string; file_path: string }>;
      if (!response.ok || !payload.success) {
        setError(payload.message ?? 'Could not upload file.');
        return;
      }

      setUploadFiles((prev) => ({ ...prev, [productId]: null }));
      await loadProducts();
    } finally {
      setUploadingProductId(null);
    }
  }

  return (
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Digital Products</h1>
        <p className="text-sm text-default-500 mt-1">
          Total sales: {totals.sales} | Total revenue: {formatMoney(totals.revenue)}
        </p>
      </header>

      {error ? <p role="alert" className="text-danger">{error}</p> : null}
      {isLoading ? <p className="text-default-400">Loading digital products...</p> : null}

      <form onSubmit={(event) => void createProduct(event)} className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Create Digital Product</h2>
        <input
          aria-label="name"
          placeholder="name"
          value={draft.name}
          onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
          required
          className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground placeholder:text-default-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <textarea
          aria-label="description"
          placeholder="description"
          value={draft.description}
          onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
          required
          className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground placeholder:text-default-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <input
          aria-label="Stripe price link"
          placeholder="Stripe price link"
          value={draft.stripe_price_link}
          onChange={(event) => setDraft((prev) => ({ ...prev, stripe_price_link: event.target.value }))}
          required
          className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground placeholder:text-default-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <select
          aria-label="access type"
          value={draft.access_type}
          onChange={(event) => setDraft((prev) => ({ ...prev, access_type: event.target.value as AccessType }))}
          className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="perpetual">perpetual</option>
          <option value="time-limited">time-limited</option>
        </select>
        <Button type="submit" color="secondary">Create Digital Product</Button>
      </form>

      {products.map((product) => (
        <article key={product.id} className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-3">
          <input
            aria-label={`name ${product.id}`}
            value={product.name}
            onChange={(event) => {
              const value = event.target.value;
              setProducts((prev) => prev.map((item) => (item.id === product.id ? { ...item, name: value } : item)));
            }}
            className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <textarea
            aria-label={`description ${product.id}`}
            value={product.description}
            onChange={(event) => {
              const value = event.target.value;
              setProducts((prev) => prev.map((item) => (item.id === product.id ? { ...item, description: value } : item)));
            }}
            className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <input
            aria-label={`Stripe price link ${product.id}`}
            value={product.stripe_price_link}
            onChange={(event) => {
              const value = event.target.value;
              setProducts((prev) => prev.map((item) => (item.id === product.id ? { ...item, stripe_price_link: value } : item)));
            }}
            className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <select
            aria-label={`access type ${product.id}`}
            value={product.access_type}
            onChange={(event) => {
              const value = event.target.value as AccessType;
              setProducts((prev) => prev.map((item) => (item.id === product.id ? { ...item, access_type: value } : item)));
            }}
            className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="perpetual">perpetual</option>
            <option value="time-limited">time-limited</option>
          </select>
          <select
            aria-label={`status ${product.id}`}
            value={product.status}
            onChange={(event) => {
              const value = event.target.value as ProductStatus;
              setProducts((prev) => prev.map((item) => (item.id === product.id ? { ...item, status: value } : item)));
            }}
            className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>

          <div className="space-y-1 text-sm text-default-500">
            <p>sales count: {product.sales_count}</p>
            <p>revenue: {formatMoney(product.revenue_cents)}</p>
            <p>status: <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-default-100 text-default-600">{product.status}</span></p>
            <p>file: {product.file_path ?? 'none'}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" color="secondary" onPress={() => void saveProduct(product)}>Save</Button>
            <Button size="sm" color="danger" variant="flat" onPress={() => void deleteProduct(product.id)}>Delete</Button>
          </div>

          <div className="space-y-2 border-t border-dashed border-default-200 pt-4">
            <label htmlFor={`upload-${product.id}`} className="text-sm text-default-500">file upload (PDF, ZIP, etc.)</label>
            <input
              id={`upload-${product.id}`}
              aria-label={`file upload ${product.id}`}
              type="file"
              onChange={(event) => {
                setUploadFiles((prev) => ({ ...prev, [product.id]: event.target.files?.[0] ?? null }));
              }}
              className="block w-full text-sm text-default-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-500/10 file:text-violet-400 hover:file:bg-violet-500/20"
            />
            <Button
              size="sm"
              color="secondary"
              onPress={() => void uploadProductFile(product.id)}
              isDisabled={uploadingProductId === product.id}
            >
              Upload File
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
