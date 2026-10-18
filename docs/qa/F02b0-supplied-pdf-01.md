# F02b0 field corpus — supplied 10-page scholarly PDF (local fixture #01)

**Use:** acceptance evidence only; do not commit the user's uploaded PDF bytes or clinical images. PDF SHA-256: `accb0e5f3ba86f9de9e2750bd8b5c763c054bd1c07bf8872941edb3aa829ce28`. PDF title: *The Frequency Of Occurrence Of Diabetes Mellitus And Other Autoimmune Diseases In A Sample Of Iraqi Patients With Dermatitis Herpetiformis* (2026), DOI printed on PDF page 1: `10.52338/tajoph.2026.6177`. 10 PDF pages, A4-ish 595.28 × 841.89 pt. Source page 1 states a Creative Commons Attribution licence; keep attribution if independently distributing/reusing materials. The local owner-provided file is **not** shipped in Folio or uploaded to GitHub.

Audit method: independent local PDF inspection (PyMuPDF text blocks, page image XObject placements and graphics operation bounds), plus visual review of embedded full-page renders. Rectangles below are normalized `[left,top,right,bottom]` in original page coordinates. These are **reviewed golden targets for this specific SHA**, not general-recognition rules.

## Expected article structure

- Page 1: journal branding and title, authors, structured abstract; then two-column Introduction. Top-right publisher logo is an image **but must NOT become an article Figure** merely because it is a PDF image.
- Page 2: two-column Introduction, then `Figure 1` (original caption immediately precedes two-panel clinical photo) and `Figure 2` (four-panel clinical photo with a wrapped caption).
- Page 3: full-width text, `Figure 3` clinical diagnostic flowchart embedded as **one image including all labels/lines**, then Aim / Patient and Methods. NEVER attempt to translate chart's baked-in labels as if they were separate source paragraphs; visual remains source asset and text explanation may be requested separately.
- Pages 4–6: seven scientific tables; vector grid lines + separately positioned text, **no embedded image XObject for Tables 1–7**. Extracting only embedded images misses all tables. Always verify cells, digits, merged regions, superscripts/inequality and p-values against original, or render the entire table grid as a source-region visual once in Interleaved.
- Page 6: Figure 4 multi-panel patient-photo collage; page 7: Figure 5 histopathology two-panel image, then two-column Discussion; page 8: two-column Discussion transitioning to Conclusion and two-column References; pages 9–10: two-column References.
- No standalone typeset formula was identified on this specific PDF: formula fidelity must be validated with *another* corpus sample; passing this file does not satisfy the full F02b formula gate.

## Original bitmap figure golden rectangles

| Page | Caption | Original bitmap box [x0,y0,x1,y1] | Expected association |
|---|---|---|---|
| 1 | Publisher branding (not a Figure) | [0.6287,0.0426,0.9397,0.1084] | Exclude as non-scientific branding |
| 2 | Figure 1 | [0.1876,0.4597,0.8135,0.6409] | Figure 1 caption, full two-panel image, source region |
| 2 | Figure 2 | [0.2445,0.7083,0.7564,0.9454] | Figure 2 wrapped caption, full four-panel image |
| 3 | Figure 3 | [0.1575,0.1803,0.8436,0.5664] | Diagnostic flowchart labels + connections remain intact |
| 6 | Figure 4 | [0.0981,0.4925,0.9019,0.9486] | Multi-panel patient-image collage |
| 7 | Figure 5 | [0.1241,0.0972,0.8770,0.2807] | Two-panel histopathology figure |

Figure visuals must remain identical source evidence across reading layouts. In Interleaved, render figure bitmap once with its original and translated caption adjacent; in Parallel, both readers may show the same anchored source asset. Crop includes every panel, axis/embedded label and margin needed, not an individual raster object missing overlays.

## Table golden observations

| Page | Source caption | Table body approx. original points (review target; refine from drawn grid lines, don't infer in code from these values) |
|---|---|---|
| 4 | Table 1, sociodemographics | near [36,74,359,229] pt, 3 columns, age and sex subheadings |
| 4 | Table 2, duration | right-hand column near [304,572,? ,?] pt; preserve neighboring left-column paragraphs |
| 5 | Table 3, lesion sites | near [36,74,406,187] pt |
| 5 | Table 4, disease characteristics | below caption y=257 pt, many drawn rows |
| 5 | Table 5, chronic diseases | below caption y=483 pt |
| 6 | Table 6, age and type-II DM | near y=74–202 pt; merged p-value field and multi-line cells |
| 6 | Table 7, duration and type-II DM | near y=285–385 pt; merged p-value field and multi-line cells |

**Do not convert Table 7's p-value silently:** text alongside Table 7 calls the association non-significant, whereas the displayed table shows `< 0.001` (page 6). Page 5's Table 5 and neighboring prose also contain contradictory counts/percentages. This is original-source content inconsistency. A reliable Folio rendering keeps both verbatim, allows source-backed critical annotations, and does not have translation or model inference silently reconcile them.

## Go/no-go

- Compare actual rendered Fig 1–5 bounds and caption associations against the **local file** when present, ignoring the publisher logo. Tables 1–7 must remain full-grid audit assets or validated structured cells, not flattened lines masquerading as article prose.
- Assert left-column before right-column for pages 2, 4, 7–10 when continuous columns are present; keep explicit full-width figure/table bands and citation/ref numbering.
- The 8–12 file corpus and macOS screenshot verification remain open; **one supplied sample is 1/8–12**, not proof of >=95% paragraph-order quality, multilingual, formula/OCR or comprehensive scientific fidelity.
