-- Digital products admin contract for issue #125.
-- Extends the shared commerce products table with digital metadata and reporting fields.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_type') THEN
    CREATE TYPE product_type AS ENUM ('subscription', 'digital');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'digital_access_type') THEN
    CREATE TYPE digital_access_type AS ENUM ('perpetual', 'time-limited');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status') THEN
    CREATE TYPE product_status AS ENUM ('draft', 'active', 'archived');
  END IF;
END $$;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type product_type NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS access_type digital_access_type,
  ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS sales_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status product_status NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS products_product_type_idx ON products(product_type);
CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);
