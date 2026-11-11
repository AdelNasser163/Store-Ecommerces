# Showcase frame polish

Kept the user's current orange iPhone, Sony earbuds and secondary iPhone artwork. The central product now fills more of its frame; side cards sit farther apart with fitted photo proportions. Frames share a quieter navy glass background, lighter borders, consistent corner radii and softer shadows. No white backdrop, captions, prices or product rotation were added.

The orange iPhone source includes wide transparent margins. A source-specific 1.48 scale uses those margins without clipping the device itself; the framed area clips only the empty canvas. The Sony photo keeps its native 4:3 aspect ratio and the secondary iPhone keeps its square canvas. Original float animation and reduced-motion rules remain.

Optimized the selected artwork into local WebP assets, preserving alpha where present and leaving the original files intact:

| Source | Optimized file | Bytes |
| --- | --- | --- |
| `iPhone_17_Pro_Max.jpg` | `assets/images/iPhone_17_Pro_Max-hero.webp` | 34,708 |
| `sony-wf-2.jpg` | `assets/images/sony-wf-hero.webp` | 43,052 |
| `accessory-iphone.jpg` | `assets/images/iphone-15-showcase.webp` | 37,446 |

Combined transfer size drops from 4,392,167 to 115,206 bytes (about 97%). Only resizing/compression was applied; product artwork was not regenerated.

Validation: English/Arabic at 1440/820/390px, complete device alpha-bound projection inside the frame, transparency, image URLs, no page overflow, no JavaScript errors. Main image remains eager/high priority; side images remain lazy.

The existing product IDs, links and computed discount badge remain as they were. Those logical slots currently differ from the selected artwork (for example, the orange iPhone image still uses the existing iPhone 15 slot); this visual change does not retarget product data or navigation.

- [English desktop](en-1440.png) / [Arabic desktop](ar-1440.png)
- [English mobile](en-390.png) / [Arabic mobile](ar-390.png)
- [Check results](results.json)

No changes to main.js, catalog data, cart logic or the user's other pending styles. No push.
