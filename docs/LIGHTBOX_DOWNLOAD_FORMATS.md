# Lightbox Download formats

Advances Milestone 1 / UI-10, content-type preservation and DATA-1.

## Owner direction and behavior

The project owner requested on October 24, 2026: images and slides should default
to PNG, or offer two buttons/options; PDFs should download only as PDF. This
direct request authorizes the following bounded correction under charter Rule 1.

Images and slides show **Download PNG**, followed by **Download PDF**. PNG is
the first download choice and contains the complete image or slide with its
visible layers at export resolution. The explicit PDF choice preserves the
existing PDF capability. PDFs show **Download PDF** only; the complete document
and all its saved layers are included.

The existing Print action stays unchanged. Labels and tooltips are translated.
The existing wrapping toolbar accommodates both choices and keyboard access.
There is no extra confirmation dialog, format setting or wiki-page content.

PNG uses the complete client compositor without JPEG conversion. It preserves
the source background, layer appearance and transparency supported by that
compositor. A failed PNG export reports failure; it never downloads a PDF or an
unmarked original under a PNG filename. Page-owned exports retain exact-revision
reauthorization and refuse stale or closed viewer sessions.

## Verification required

Check image/slide PNG and explicit PDF, PDF-only whole-document Download,
refused/stale exports, reopen, focus and narrow toolbar layout. Verify PNG bytes
and dimensions, preserve prior PDF/Print regressions, and show the native toolbar
before calling the correction complete.

## Recorded qualification

Eighteen focused format cases and all 18,923 client tests across 312 suites pass.
The focused cases verify PNG MIME type, exact lossless bytes and dimensions,
image/slide routing, PDF-only routing, explicit PDF preservation, authorization
and source-change refusal, closed-session suppression, bounded decode failure,
duplicate-export prevention, filenames and focus restoration. Existing whole-PDF
and Print regressions remain unchanged and pass.

On the actual working-copy wiki, saved image PNG and slide PNG/PDF preparation
completed with controls restored. Both format choices remained reachable at a
390-pixel viewport. A three-page PDF offered only PDF Download. This is a browser
viewport check, not physical-device or physical-Print acceptance. Native download
bytes were not independently collected through the previously stalled download
observer; the byte/MIME assertions above are client regression evidence.
