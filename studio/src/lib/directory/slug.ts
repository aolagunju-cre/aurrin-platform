export function slugifyCompanyName(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'founder';
}

export function nextSlug(baseInput: string, existingSlugs: Set<string>): string {
  const base = slugifyCompanyName(baseInput);
  if (!existingSlugs.has(base)) {
    return base;
  }

  let suffix = 1;
  while (existingSlugs.has(`${base}-${suffix}`)) {
    suffix += 1;
  }

  return `${base}-${suffix}`;
}
