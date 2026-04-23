# Paris Cuban Salsa — Photo Gallery Platform (PRD)

## Vision
A mobile-first photo gallery platform for the Paris Cuban Salsa dance community.
Visitors browse events, tag themselves, and share photos on Instagram Stories.
Admins upload and manage galleries via Google login.

## Stack
- Expo SDK 54 (React Native) with expo-router file-based navigation
- FastAPI backend, MongoDB storage (photos as base64 data URIs)
- Emergent-managed Google Auth for admin-only access

## Design
- White background, pure black text, yellow #F5C518 accent
- Playfair Display (headings) + Manrope (body)
- Editorial/brutalist layout: sharp 1px borders, no rounded pills, no soft shadows
- Logo: "Paris Cuban" + italic yellow "Salsa"

## Features Implemented (MVP)
- [x] Public editorial home with event list (cover photo, date, title, description)
- [x] Event detail page with masonry-style photo grid
- [x] Lightbox viewer (prev/next, download, delete if admin)
- [x] Public self-tagging (name or @instagram handle) via bottom sheet
- [x] Tags visible publicly under each photo + count badge on grid
- [x] Instagram Story share (native Web Share API + clipboard fallback with toast)
- [x] Admin dashboard: list events, create event (with cover), delete event
- [x] Admin per-event upload screen with multi-select photo picker
- [x] Admin photo management: delete photo, see tag counts
- [x] Emergent Google Auth flow (fragment session_id → backend exchange → cookie + localStorage bearer)
- [x] `ADMIN_EMAILS` env for allowlist (empty = any Google user is admin, single-owner default)

## API Surface (all /api prefixed)
- `POST /api/auth/session` — exchange session_id for session_token cookie
- `GET /api/auth/me` — current user
- `POST /api/auth/logout`
- `GET /api/events` (public)
- `GET /api/events/{id}` (public)
- `POST /api/events` (admin)
- `DELETE /api/events/{id}` (admin)
- `GET /api/events/{id}/photos` (public, with tags embedded)
- `POST /api/events/{id}/photos` (admin, batch base64)
- `DELETE /api/photos/{id}` (admin)
- `POST /api/photos/{id}/tags` (public)
- `DELETE /api/tags/{id}` (admin)

## Business Smart Enhancement
The `#01 / #02 / #03` yellow badge on each event card and the editorial "VIEW GALLERY"
CTA with underline act as a subtle issue-number system — framing each event as a
collectible "edition" of the community magazine. Combined with the Instagram Story
share button, this drives recurring visits and organic reach every time a dancer
finds themselves tagged in a new "edition".

## Not Yet Implemented (Future)
- Supabase image CDN (currently base64 in MongoDB — fine for small communities)
- Custom domain routing (pcs.photos) — handled at deployment level
- Tag removal by the person who added it (currently admin-only)
- Push/email notifications when someone tags you
