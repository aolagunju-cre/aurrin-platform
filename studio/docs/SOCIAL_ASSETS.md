# Social Assets Guide

This guide covers how social image assets are generated, stored, signed, and exposed for sharing flows.

## Generation Flow

Social assets are generated asynchronously through the outbox jobs pipeline.

1. Admin requests generation:
   - `POST /api/social-assets/generate`
   - Body:
     - `asset_type`: `profile` | `highlight` | `event`
     - `founder_id`: string
     - `event_id`: string
     - `format`: `twitter` | `linkedin` | `og`
2. The route enqueues `generate_social_asset` and returns `202` with:
   - `data.job_id`
3. Worker processing runs the asset handler and writes a PNG to Supabase Storage bucket `social-assets` using:
   - `{asset_type}/{founder_id}/{event_id}/{format}.png`
4. Status polling:
   - `GET /api/social-assets/[jobId]/status`
   - Returns `pending`, `processing`, `completed`, or `failed`
   - On `completed`, response includes signed asset metadata when the file exists

## Formats and Dimensions

Supported formats:

- `twitter`: `1200x628`
- `linkedin`: `1200x627`
- `og`: `1200x630`

All generated assets are PNG files.

## Branding Customization

Branding config file:

- `studio/src/lib/social-assets/config.json`

Required config fields:

- `colors.background`
- `colors.foreground`
- `colors.accent`
- `logo_url`
- `fonts.headline`
- `fonts.body`

Admin APIs:

- `GET /api/admin/social-assets/branding` returns current branding config and fallback/validation metadata.
- `PATCH /api/admin/social-assets/branding` validates and updates branding config.

Template rendering is deterministic and includes branding values so updated config is reflected in subsequent generations.

## Sharing on Social Platforms

To expose generated assets for founder share experiences and Open Graph use:

- `GET /api/public/founders/[founderId]/share-card`
  - Returns `data.assets` derived from previously generated files
  - Includes:
    - `signed_download.url`
    - `signed_download.expires_in`
    - `download_action_label` (`Download Share Card`)
    - `open_graph_image_url` for `og` assets

This endpoint surfaces metadata for already-generated assets and does not trigger regeneration.
