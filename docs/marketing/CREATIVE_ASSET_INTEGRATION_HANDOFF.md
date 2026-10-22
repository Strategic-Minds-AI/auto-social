# AUTO SOCIAL — Creative Asset Studio Integration
Status: **UI/code implemented; independent runtime verification and Supabase sync NOT COMPLETE**.
Target app: Base44 AUTO SOCIAL, app id 6ac4dd914af935b8c986b411.
Canonical Supabase project: Strategic Intelligence, project ref jadlpbokfdkonvnfxjzs.
Scope: Preserve existing scheduler, AI gateway, video queue, approval and publishing functions; do not alter the production posting state machine.

## Rehydration facts (2026-10-21)
- Baseline checkpoint: 6ad9810b96c9f6dc0451f163, source SHA bf823daafbb92c73db658a1e03f073512f99573f.
- Existing source of truth: AUTO-SOCIAL-WORKBOOK.md (append new phases there; do not replace).
- Base44 connected: Supabase, Google Drive **read-only**, Facebook Pages.
- Supabase public.auto_social_* tables exist. Generic public.social_media_asset is NOT tenant-isolated to this app in a verified way. Do not use it as the AUTO SOCIAL canonical table without mapping.
- NO new Supabase DDL applied and NO production posting triggered.

## Implemented in Base44 code
- /creative-assets module and navigation.
- MediaAsset entity with owner-or-admin record access.
- Up to 10 photos/videos per batch, capped at 100MB each in UI; upload to existing Base44 Core.UploadFile storage.
- Categories/tags + explicit human correction. Classification is rules based on filename; NO vision model is connected. Confidence deliberately low.
- 14 image/video dimension target presets. Image canvas cover/contain resize exports PNG as download or saved derivative. Video resize/MP4 transcoding NOT YET IMPLEMENTED.
- 10 starter website layout slot recipes; import layout JSON in memory (not a persistent global template overwrite).
- Draft storyboard export JSON (not rendered MP4). Reuse existing /video-studio to render/score videos; existing approvals remain required.
- Reuse existing /intelligence PromptTransformer component. Image generation still consumes integration credits.

## Supabase end state
- Draft DDL in supabase/migrations/20261021_auto_social_creative_assets_DRAFT.sql. It is NOT applied.
- Adopt public.auto_social_media_assets / auto_social_media_collections / auto_social_creative_projects as canonical metadata when authorized.
- Private original media: use private Supabase Storage bucket, createSignedUrl/download only under checked organization membership. Base44-uploaded media URLs may be shareable: do not claim private storage until verified.
- Business authorization should be checked server-side using a stable mapping between Base44 business id and Supabase business id AND trusted caller id; never treat browser-supplied business_id as proof.
- Worker flow: upload -> malware/type sniff -> dedupe content hash -> computer vision labeling with explicit model identity/confidence -> human review -> derivative jobs -> QA -> publish approval -> existing posting queue.
- Idempotency key: business_id + source_asset_id + content_hash + preset/version. Use existing VideoJob queue and publishDuePosts; no duplicate schedulers.
- Sync worker writes with secret in server environment only; record result receipts, retries, and dead-letter queue.
- Google Drive: connection currently includes drive.readonly only. Import/read allowed; export/write and share permissions require separately authorized scopes.
- Local machine share: browser download exists; persistent bidirectional local sync requires explicit desktop agent and constrained folder permissions.

## Next gating items
1. Obtain signoff for applying the three new public Supabase tables and private storage policies, then validate RLS with both tenants.
2. Connect server-side Supabase identity-checked storage/sync adapter; migrate Base44 MediaAsset rows via idempotent import and read-back hashes.
3. Connect real visual recognition provider (AI caption/classify image pixels and extracted video frames); store confidence, version and human overrides.
4. Connect worker FFmpeg/Remotion for frame-accurate MP4 rendering and platform presets; record receipts.
5. Browser-test actual upload, resize, export, approve, publish dry-run, permissions and rollback on desktop/mobile.
6. If needed import user's Universal Website Layout master library; do not invent a 1:1 match.

## Acceptance checklist (OPEN until evidenced)
- [ ] Upload actual 10 image/video fixture files and read back records scoped by business.
- [ ] Cross-business create/read/update and public-media URL leakage negative tests.
- [ ] Vision classification against labeled fixture images with false-positive threshold.
- [ ] One image exported to 14 supported target sizes with dimensions verified.
- [ ] One 15-second MP4 rendered with audio, captions, and platform safe zones.
- [ ] New asset linked to existing Campaign/ScheduledPost without bypassing approval.
- [ ] Supabase write + read-back with exact source id, checksum and no duplicate.
- [ ] Google Drive scoped sharing only after permission review.
- [ ] Independent Guardian browser/security/accessibility/reliability receipt.
- [ ] No unintended live publishing or production deployment.
