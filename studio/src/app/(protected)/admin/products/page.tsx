'use client';

import React, { useEffect, useMemo, useState } from 'react';

type BillingInterval = 'monthly' | 'yearly';

interface Product {
  id: string;
  name: string;
  description: string | null;
  stripe_product_id: string | null;
  active: boolean;
}

interface Price {
  id: string;
  product_id: string;
  stripe_price_id: string | null;
  amount_cents: number;
  currency: string;
  billing_interval: BillingInterval;
  active: boolean;
}

interface ProductWithPrices extends Product {
  prices: Price[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountCents / 100);
}

export default function AdminProductsPage(): React.ReactElement {
  const [products, setProducts] = useState<ProductWithPrices[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', stripe_product_id: '' });
  const [newPrice, setNewPrice] = useState<Record<string, { amount_cents: string; billing_interval: BillingInterval; stripe_price_id: string }>>({});

  const totalPrices = useMemo(() => products.reduce((sum, product) => sum + product.prices.length, 0), [products]);

  async function loadProducts(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const productsResponse = await fetch('/api/commerce/products');
      const productsPayload = await productsResponse.json() as ApiResponse<Product[]>;
      if (!productsResponse.ok || !productsPayload.success) {
        throw new Error(productsPayload.message ?? 'Failed to load products');
      }

      const productRows = productsPayload.data ?? [];
      const pricesByProduct = await Promise.all(
        productRows.map(async (product) => {
          const pricesResponse = await fetch(`/api/commerce/prices?product_id=${encodeURIComponent(product.id)}`);
          const pricesPayload = await pricesResponse.json() as ApiResponse<Price[]>;
          return {
            productId: product.id,
            prices: pricesResponse.ok && pricesPayload.success ? pricesPayload.data ?? [] : [],
          };
        })
      );

      const merged = productRows.map((product) => ({
        ...product,
        prices: pricesByProduct.find((entry) => entry.productId === product.id)?.prices ?? [],
      }));
      setProducts(merged);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  async function createProduct(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const response = await fetch('/api/commerce/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newProduct.name,
        description: newProduct.description || null,
        stripe_product_id: newProduct.stripe_product_id || null,
      }),
    });
    const payload = await response.json() as ApiResponse<Product>;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Could not create product');
      return;
    }
    setNewProduct({ name: '', description: '', stripe_product_id: '' });
    await loadProducts();
  }

  async function updateProduct(product: ProductWithPrices): Promise<void> {
    const response = await fetch(`/api/commerce/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: product.name,
        description: product.description,
        stripe_product_id: product.stripe_product_id,
        active: product.active,
      }),
    });
    const payload = await response.json() as ApiResponse<Product>;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Could not update product');
      return;
    }
    await loadProducts();
  }

  async function deleteProduct(productId: string): Promise<void> {
    const confirmed = window.confirm('Delete this product?');
    if (!confirmed) {
      return;
    }
    const response = await fetch(`/api/commerce/products/${productId}`, { method: 'DELETE' });
    const payload = await response.json() as ApiResponse<unknown>;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Could not delete product');
      return;
    }
    await loadProducts();
  }

  async function createPrice(productId: string): Promise<void> {
    const draft = newPrice[productId];
    if (!draft || Number(draft.amount_cents) <= 0) {
      setError('Price amount must be greater than zero.');
      return;
    }
    const response = await fetch('/api/commerce/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        amount_cents: Number(draft.amount_cents),
        billing_interval: draft.billing_interval,
        stripe_price_id: draft.stripe_price_id || null,
      }),
    });
    const payload = await response.json() as ApiResponse<Price>;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Could not create price');
      return;
    }
    setNewPrice((prev) => ({ ...prev, [productId]: { amount_cents: '', billing_interval: 'monthly', stripe_price_id: '' } }));
    await loadProducts();
  }

  async function updatePrice(price: Price): Promise<void> {
    const response = await fetch(`/api/commerce/prices/${price.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_cents: price.amount_cents,
        billing_interval: price.billing_interval,
        stripe_price_id: price.stripe_price_id,
        active: price.active,
      }),
    });
    const payload = await response.json() as ApiResponse<Price>;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Could not update price');
      return;
    }
    await loadProducts();
  }

  async function deletePrice(priceId: string): Promise<void> {
    const confirmed = window.confirm('Delete this price?');
    if (!confirmed) {
      return;
    }
    const response = await fetch(`/api/commerce/prices/${priceId}`, { method: 'DELETE' });
    const payload = await response.json() as ApiResponse<unknown>;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Could not delete price');
      return;
    }
    await loadProducts();
  }

  async function syncFromStripe(): Promise<void> {
    setError(null);
    const response = await fetch('/api/commerce/products/sync', { method: 'POST' });
    const payload = await response.json() as ApiResponse<unknown>;
    if (!response.ok || !payload.success) {
      setError(payload.message ?? 'Could not sync products from Stripe');
      return;
    }
    await loadProducts();
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Products</h1>
        <button type="button" onClick={() => void syncFromStripe()}>Sync from Stripe</button>
      </div>
      <p style={{ margin: 0 }}>Loaded {products.length} product(s) and {totalPrices} price(s).</p>

      {error ? <p role="alert" style={{ color: '#b00', margin: 0 }}>{error}</p> : null}
      {isLoading ? <p>Loading products...</p> : null}

      <form onSubmit={(event) => void createProduct(event)} style={{ display: 'grid', gap: '0.5rem', border: '1px solid #ddd', padding: '1rem', borderRadius: 8 }}>
        <h2 style={{ margin: 0 }}>Create Product</h2>
        <input
          aria-label="Product name"
          placeholder="Name"
          value={newProduct.name}
          onChange={(event) => setNewProduct((prev) => ({ ...prev, name: event.target.value }))}
          required
        />
        <input
          aria-label="Product description"
          placeholder="Description"
          value={newProduct.description}
          onChange={(event) => setNewProduct((prev) => ({ ...prev, description: event.target.value }))}
        />
        <input
          aria-label="Stripe product id"
          placeholder="Stripe product ID"
          value={newProduct.stripe_product_id}
          onChange={(event) => setNewProduct((prev) => ({ ...prev, stripe_product_id: event.target.value }))}
        />
        <button type="submit">Create Product</button>
      </form>

      {products.map((product) => (
        <article key={product.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '1rem', display: 'grid', gap: '0.5rem' }}>
          <input
            aria-label={`Product name ${product.id}`}
            value={product.name}
            onChange={(event) => {
              const value = event.target.value;
              setProducts((prev) => prev.map((row) => (row.id === product.id ? { ...row, name: value } : row)));
            }}
          />
          <input
            aria-label={`Product description ${product.id}`}
            value={product.description ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              setProducts((prev) => prev.map((row) => (row.id === product.id ? { ...row, description: value } : row)));
            }}
          />
          <input
            aria-label={`Stripe product id ${product.id}`}
            value={product.stripe_product_id ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              setProducts((prev) => prev.map((row) => (row.id === product.id ? { ...row, stripe_product_id: value } : row)));
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => void updateProduct(product)}>Save Product</button>
            <button type="button" onClick={() => void deleteProduct(product.id)}>Delete Product</button>
          </div>

          <h3 style={{ marginBottom: 0 }}>Prices</h3>
          {product.prices.map((price) => (
            <div key={price.id} style={{ display: 'grid', gap: '0.5rem', border: '1px solid #eee', borderRadius: 8, padding: '0.75rem' }}>
              <p style={{ margin: 0 }}>{formatMoney(price.amount_cents, price.currency)} / {price.billing_interval}</p>
              <input
                aria-label={`Price amount ${price.id}`}
                value={String(price.amount_cents)}
                onChange={(event) => {
                  const amount = Number(event.target.value) || 0;
                  setProducts((prev) =>
                    prev.map((row) =>
                      row.id !== product.id
                        ? row
                        : { ...row, prices: row.prices.map((candidate) => (candidate.id === price.id ? { ...candidate, amount_cents: amount } : candidate)) }
                    )
                  );
                }}
              />
              <select
                aria-label={`Billing interval ${price.id}`}
                value={price.billing_interval}
                onChange={(event) => {
                  const interval = event.target.value as BillingInterval;
                  setProducts((prev) =>
                    prev.map((row) =>
                      row.id !== product.id
                        ? row
                        : { ...row, prices: row.prices.map((candidate) => (candidate.id === price.id ? { ...candidate, billing_interval: interval } : candidate)) }
                    )
                  );
                }}
              >
                <option value="monthly">monthly</option>
                <option value="yearly">yearly</option>
              </select>
              <input
                aria-label={`Stripe price id ${price.id}`}
                value={price.stripe_price_id ?? ''}
                onChange={(event) => {
                  const stripePriceId = event.target.value;
                  setProducts((prev) =>
                    prev.map((row) =>
                      row.id !== product.id
                        ? row
                        : { ...row, prices: row.prices.map((candidate) => (candidate.id === price.id ? { ...candidate, stripe_price_id: stripePriceId } : candidate)) }
                    )
                  );
                }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => void updatePrice(price)}>Save Price</button>
                <button type="button" onClick={() => void deletePrice(price.id)}>Delete Price</button>
              </div>
            </div>
          ))}

          <div style={{ display: 'grid', gap: '0.5rem', borderTop: '1px dashed #ccc', paddingTop: '0.5rem' }}>
            <input
              aria-label={`New price amount ${product.id}`}
              placeholder="Amount cents"
              value={newPrice[product.id]?.amount_cents ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setNewPrice((prev) => ({
                  ...prev,
                  [product.id]: {
                    amount_cents: value,
                    billing_interval: prev[product.id]?.billing_interval ?? 'monthly',
                    stripe_price_id: prev[product.id]?.stripe_price_id ?? '',
                  },
                }));
              }}
            />
            <select
              aria-label={`New billing interval ${product.id}`}
              value={newPrice[product.id]?.billing_interval ?? 'monthly'}
              onChange={(event) => {
                const interval = event.target.value as BillingInterval;
                setNewPrice((prev) => ({
                  ...prev,
                  [product.id]: {
                    amount_cents: prev[product.id]?.amount_cents ?? '',
                    billing_interval: interval,
                    stripe_price_id: prev[product.id]?.stripe_price_id ?? '',
                  },
                }));
              }}
            >
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
            <input
              aria-label={`New stripe price id ${product.id}`}
              placeholder="Stripe price ID"
              value={newPrice[product.id]?.stripe_price_id ?? ''}
              onChange={(event) => {
                const stripePriceId = event.target.value;
                setNewPrice((prev) => ({
                  ...prev,
                  [product.id]: {
                    amount_cents: prev[product.id]?.amount_cents ?? '',
                    billing_interval: prev[product.id]?.billing_interval ?? 'monthly',
                    stripe_price_id: stripePriceId,
                  },
                }));
              }}
            />
            <button type="button" onClick={() => void createPrice(product.id)}>Create Price</button>
          </div>
        </article>
      ))}
    </section>
  );
}
