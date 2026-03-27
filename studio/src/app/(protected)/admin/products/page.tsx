'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/button';

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
    <section className="container mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Products</h1>
        <Button color="secondary" onPress={() => void syncFromStripe()}>Sync from Stripe</Button>
      </div>
      <p className="text-sm text-default-500">Loaded {products.length} product(s) and {totalPrices} price(s).</p>

      {error ? <p role="alert" className="text-danger">{error}</p> : null}
      {isLoading ? <p className="text-default-400">Loading products...</p> : null}

      <form onSubmit={(event) => void createProduct(event)} className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-3">
        <h2 className="text-xl font-semibold text-foreground">Create Product</h2>
        <input
          aria-label="Product name"
          placeholder="Name"
          value={newProduct.name}
          onChange={(event) => setNewProduct((prev) => ({ ...prev, name: event.target.value }))}
          required
          className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground placeholder:text-default-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <input
          aria-label="Product description"
          placeholder="Description"
          value={newProduct.description}
          onChange={(event) => setNewProduct((prev) => ({ ...prev, description: event.target.value }))}
          className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground placeholder:text-default-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <input
          aria-label="Stripe product id"
          placeholder="Stripe product ID"
          value={newProduct.stripe_product_id}
          onChange={(event) => setNewProduct((prev) => ({ ...prev, stripe_product_id: event.target.value }))}
          className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground placeholder:text-default-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <Button type="submit" color="secondary">Create Product</Button>
      </form>

      {products.map((product) => (
        <article key={product.id} className="rounded-2xl border border-default-200 bg-default-50 dark:bg-default-50/5 p-6 space-y-3">
          <input
            aria-label={`Product name ${product.id}`}
            value={product.name}
            onChange={(event) => {
              const value = event.target.value;
              setProducts((prev) => prev.map((row) => (row.id === product.id ? { ...row, name: value } : row)));
            }}
            className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <input
            aria-label={`Product description ${product.id}`}
            value={product.description ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              setProducts((prev) => prev.map((row) => (row.id === product.id ? { ...row, description: value } : row)));
            }}
            className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <input
            aria-label={`Stripe product id ${product.id}`}
            value={product.stripe_product_id ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              setProducts((prev) => prev.map((row) => (row.id === product.id ? { ...row, stripe_product_id: value } : row)));
            }}
            className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" color="secondary" onPress={() => void updateProduct(product)}>Save Product</Button>
            <Button size="sm" color="danger" variant="flat" onPress={() => void deleteProduct(product.id)}>Delete Product</Button>
          </div>

          <h3 className="text-lg font-semibold text-foreground pt-2">Prices</h3>
          {product.prices.map((price) => (
            <div key={price.id} className="rounded-xl border border-default-100 bg-default-50/50 p-4 space-y-2">
              <p className="text-sm text-default-500">{formatMoney(price.amount_cents, price.currency)} / {price.billing_interval}</p>
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
                className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
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
                className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" color="secondary" onPress={() => void updatePrice(price)}>Save Price</Button>
                <Button size="sm" color="danger" variant="flat" onPress={() => void deletePrice(price.id)}>Delete Price</Button>
              </div>
            </div>
          ))}

          <div className="space-y-2 border-t border-dashed border-default-200 pt-4">
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
              className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground placeholder:text-default-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
              className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
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
              className="w-full rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground placeholder:text-default-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <Button size="sm" color="secondary" onPress={() => void createPrice(product.id)}>Create Price</Button>
          </div>
        </article>
      ))}
    </section>
  );
}
