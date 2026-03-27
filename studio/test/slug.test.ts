import { nextSlug, slugifyCompanyName } from '../src/lib/directory/slug';

describe('slug helpers', () => {
  it('normalizes to lowercase hyphen-separated slugs', () => {
    expect(slugifyCompanyName('  Foo Ventures, Inc.  ')).toBe('foo-ventures-inc');
  });

  it('generates duplicate suffixes deterministically', () => {
    const existing = new Set<string>(['foo', 'foo-1']);
    expect(nextSlug('Foo', existing)).toBe('foo-2');
  });

  it('falls back to founder for empty normalized input', () => {
    expect(slugifyCompanyName('***')).toBe('founder');
  });
});
