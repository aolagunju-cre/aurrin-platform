'use client';

import React, { useEffect, useMemo, useState } from 'react';

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
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header>
        <h1 style={{ marginBottom: '0.25rem' }}>Digital Products</h1>
        <p style={{ margin: 0 }}>
          Total sales: {totals.sales} | Total revenue: {formatMoney(totals.revenue)}
        </p>
      </header>

      {error ? <p role="alert" style={{ color: '#b00020', margin: 0 }}>{error}</p> : null}
      {isLoading ? <p>Loading digital products...</p> : null}

      <form onSubmit={(event) => void createProduct(event)} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', display: 'grid', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Create Digital Product</h2>
        <input
          aria-label="name"
          placeholder="name"
          value={draft.name}
          onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
          required
        />
        <textarea
          aria-label="description"
          placeholder="description"
          value={draft.description}
          onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
          required
        />
        <input
          aria-label="Stripe price link"
          placeholder="Stripe price link"
          value={draft.stripe_price_link}
          onChange={(event) => setDraft((prev) => ({ ...prev, stripe_price_link: event.target.value }))}
          required
        />
        <select
          aria-label="access type"
          value={draft.access_type}
          onChange={(event) => setDraft((prev) => ({ ...prev, access_type: event.target.value as AccessType }))}
        >
          <option value="perpetual">perpetual</option>
          <option value="time-limited">time-limited</option>
        </select>
        <button type="submit">Create Digital Product</button>
      </form>

      {products.map((product) => (
        <article key={product.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', display: 'grid', gap: '0.5rem' }}>
          <input
            aria-label={`name ${product.id}`}
            value={product.name}
            onChange={(event) => {
              const value = event.target.value;
              setProducts((prev) => prev.map((item) => (item.id === product.id ? { ...item, name: value } : item)));
            }}
          />
          <textarea
            aria-label={`description ${product.id}`}
            value={product.description}
            onChange={(event) => {
              const value = event.target.value;
              setProducts((prev) => prev.map((item) => (item.id === product.id ? { ...item, description: value } : item)));
            }}
          />
          <input
            aria-label={`Stripe price link ${product.id}`}
            value={product.stripe_price_link}
            onChange={(event) => {
              const value = event.target.value;
              setProducts((prev) => prev.map((item) => (item.id === product.id ? { ...item, stripe_price_link: value } : item)));
            }}
          />
          <select
            aria-label={`access type ${product.id}`}
            value={product.access_type}
            onChange={(event) => {
              const value = event.target.value as AccessType;
              setProducts((prev) => prev.map((item) => (item.id === product.id ? { ...item, access_type: value } : item)));
            }}
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
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>

          <p style={{ margin: 0 }}>sales count: {product.sales_count}</p>
          <p style={{ margin: 0 }}>revenue: {formatMoney(product.revenue_cents)}</p>
          <p style={{ margin: 0 }}>status: {product.status}</p>
          <p style={{ margin: 0 }}>file: {product.file_path ?? 'none'}</p>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void saveProduct(product)}>Save</button>
            <button type="button" onClick={() => void deleteProduct(product.id)}>Delete</button>
          </div>

          <div style={{ display: 'grid', gap: '0.5rem', borderTop: '1px dashed #ddd', paddingTop: '0.75rem' }}>
            <label htmlFor={`upload-${product.id}`}>file upload (PDF, ZIP, etc.)</label>
            <input
              id={`upload-${product.id}`}
              aria-label={`file upload ${product.id}`}
              type="file"
              onChange={(event) => {
                setUploadFiles((prev) => ({ ...prev, [product.id]: event.target.files?.[0] ?? null }));
              }}
            />
            <button
              type="button"
              onClick={() => void uploadProductFile(product.id)}
              disabled={uploadingProductId === product.id}
            >
              Upload File
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
