# Public Directory Guide

This guide documents how the public founder directory works, how profiles are shared, and the privacy boundaries that must be preserved.

## How to search and find founders

The public directory is available at `/public/directory` and does not require authentication.

Use the search and filters to narrow results:

- Search text: founder name, company name, pitch summary
- Filters: industry, stage, event, aggregate score range (`minScore`, `maxScore`)
- Multiple filters are combined with AND logic

Only founders that are explicitly published to the directory are shown.

## How to share a profile

Each public founder profile has a shareable URL:

- Profile route: `/public/directory/{founderSlug}`
- Slug is unique and URL-safe
- Share flow supports native share where available, with clipboard fallback

To share:

1. Open the founder profile from the public directory card.
2. Use the `Share` action on the profile page.
3. Send the copied profile URL or share intent link.

## Privacy: what data is shown, what is hidden

Shown publicly (when a profile is visible):

- Founder name
- Company
- Industry and stage
- Pitch summary
- Optional profile photo
- Optional deck and social links
- Event metadata and aggregate score (when published)
- Public badges/highlights

Hidden from public directory responses:

- Individual judge scores
- Validation internals
- Non-public workflow state
- Any founder profile not marked visible for directory publishing

## Required End-to-End Validation Scenario

Use this scenario to validate the full public directory workflow from admin controls through public discovery and sharing.

1. Create a founder and founder pitch for an event.
2. Publish event scores and complete event lifecycle prerequisites.
3. In admin event wrap-up, toggle founder visibility to publish in the directory.
4. Verify founder appears in `/public/directory`.
5. Use search/filter to find the founder.
6. Open the founder profile page and confirm the shareable link works.

Expected outcomes:

- Founder appears only after explicit visibility publish.
- Search/filter returns the founder when query conditions match.
- Share URL resolves to the same founder profile.
- No individual judge scores or validation internals are exposed.

## Validation Command Set

Run these commands for implementation and regression validation across the directory stack:

- `bash scripts/validate-implementation.sh`
- `cd studio && npm test -- --runInBand test/public-directory-api.test.ts`
- `cd studio && npm test -- --runInBand test/public-founder-share-card-route.test.ts`
- `cd studio && npm test -- --runInBand test/public-directory-page.test.tsx`
- `cd studio && npm test -- --runInBand test/public-directory-profile-page.test.tsx`
- `cd studio && npm test -- --runInBand test/admin-events-page.test.tsx`
- `cd studio && npm test -- --runInBand test/admin-founders-route.test.ts`
- `cd studio && npm test -- --runInBand test/send-email.test.ts`

Issue-specific minimum checks for this documentation contract:

- `bash scripts/validate-implementation.sh`
- `rg -n "How to search and find founders|How to share a profile|Privacy: what data is shown, what is hidden" studio/docs/PUBLIC_DIRECTORY.md`
- `rg -n "PUBLIC_DIRECTORY.md" studio/docs/README.md`
