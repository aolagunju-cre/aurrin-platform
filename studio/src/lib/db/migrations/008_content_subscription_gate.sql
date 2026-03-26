-- Adds content metadata needed for subscription-gated content APIs.
CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  body TEXT,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  requires_subscription BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_requires_subscription_idx ON content(requires_subscription);
CREATE INDEX IF NOT EXISTS content_product_id_idx ON content(product_id);

DROP TRIGGER IF EXISTS content_update_timestamp ON content;

CREATE TRIGGER content_update_timestamp
BEFORE UPDATE ON content
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
