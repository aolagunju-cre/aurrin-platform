import { slugifyCompanyName } from '../directory/slug';

export function getPublicFounderProfileHref(companyName: string): string {
  return `/public/directory/${encodeURIComponent(slugifyCompanyName(companyName))}`;
}
