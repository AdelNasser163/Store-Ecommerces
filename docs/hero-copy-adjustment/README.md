# Hero copy adjustment

- Arabic heading uses balanced lines, a matching font for its green phrase, and more comfortable line height. English line breaks and typography remain as before.
- Delivery badge moves 28px physically right in Arabic (12px on mobile). Added only the complete delivery phrase to the existing translation dictionary, removing the duplicated Arabic delivery word.
- Product names/prices are visually hidden and excluded from accessibility in the floating showcase. Their layout space stays reserved so the images, card shapes, gradients and float animations keep their geometry. Image alternative text, product links and discount badge remain.

Verified English/Arabic at 1440/820/390px, language switching, no horizontal overflow or JavaScript errors. Compared against the preceding commit: card/image dimensions and horizontal positions match; desktop positions match as well. On smaller Arabic layouts the visual column follows the shorter heading's normal document flow.

- [Arabic desktop](ar-1440.png) / [Arabic mobile](ar-390.png)
- [English desktop](en-1440.png)
- [Results](results.json) / [Geometry comparison](geometry.json)

No commerce logic or other page sections changed. No push.

Follow-up: removed the reserved caption space at the user's request. The main frame is now 316px tall around the unchanged 290px image, keeping only its 12px padding and border. Side cards similarly fit their unchanged images. Verified English/Arabic at 1440/820/390px with no horizontal overflow. [Compact desktop](ar-1440-tight.png) / [Compact mobile](ar-390-tight.png).

Latest proportion adjustment: main image height is now 350px with a fitted 376px frame; side images are 175px tall. Their existing `object-fit` preserves image proportions without stretching. No caption gap returns. Verified both languages at 1440/820/390px. [Taller desktop](ar-1440-tall.png) / [Taller mobile](ar-390-tall.png).

Full-image follow-up: all three floating images now use centered `object-fit: contain`, so the complete source image appears without cropping. The taller frame dimensions remain. Checked computed image fitting and no horizontal overflow at 1440/820/390px. The preceding screenshots show the earlier cover fit.

Latest image selection: replaced the scene-based photos with a portrait iPhone image and clear MacBook/PS5 product views, on consistent light image surfaces. Existing card dimensions, product links, hidden captions and animations remain. [Image sources and latest previews](IMAGE-SOURCES.md).
