# Replacement hero photographs

The showcase keeps the same three product IDs, links, card sizes and float animations. Product names/prices remain hidden. New images use centered `contain` on a shared light backdrop, with a small internal inset, so complete product views fit the taller frames.

| Product | Local image | Source |
| --- | --- | --- |
| iPhone 15 Pro Max | `assets/images/accessory-iphone-3.png` | Existing project portrait image, 718 × 941px. Original file retained. |
| MacBook Pro M3 | `assets/images/macbook-m3-hero.jpg` | [Apple product image](https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp16-spaceblack-select-202310?wid=400&hei=400&fmt=jpeg), 24,466 bytes. See also [Apple's M3 MacBook Pro announcement](https://www.apple.com/newsroom/2023/10/apple-unveils-new-macbook-pro-featuring-m3-chips/). |
| PS5 Slim | `assets/images/ps5-slim-hero.png` | [PlayStation product image](https://gmedia.playstation.com/is/image/SIEPDC/ps5-slim-edition-left-image-block-01-en-24jun24?$400px--t$), 99,450 bytes, from the [official PS5 page](https://www.playstation.com/en-us/ps5/). |

The two new files total about 121KiB and are served locally; the page does not request images from external sites. The iPhone remains eager/high priority; side images remain lazy. No original images were deleted or overwritten, and product/catalog data were not changed.

Verified English/Arabic at 1440/820/390px: expected image URLs, original product links, complete `contain` fitting, no horizontal overflow or JavaScript errors.

- [Arabic desktop](new-photos-ar-1440.png) / [Arabic mobile](new-photos-ar-390.png)
- [English desktop](new-photos-en-1440.png) / [English mobile](new-photos-en-390.png)

## Transparent-background revision

Removed the light CSS image backdrop; the existing iPhone/PS5 PNG transparency now shows the navy glass cards. The MacBook JPEG was replaced by `assets/images/macbook-m3-cutout.png` (480 × 320px, 140,874 bytes), derived from the same official Apple product view. Original assets remain intact. New previews: [desktop](transparent-1440.png) / [mobile](transparent-390.png).

Tool mode: built-in **image_gen** edit with `transparent_background: true`, following the local imagegen skill. The generated alpha image was copied into the project and downscaled for the small card. The full-resolution original remains in the tool's generated-images location. No external images are fetched at runtime.

Final prompt:

> Edit the referenced MacBook product photo ONLY by removing the light gray/off-white rectangular background completely, making it genuine transparent alpha. Preserve the exact same front-facing space-black MacBook, laptop silhouette, proportions, base, screen bezel, notch, screen artwork and every product detail. Keep the entire laptop visible, at the same composition and angle. Do not redraw, stylize, recolor, add objects, reflections, glow, labels, shadows or text. Everything outside the physical laptop silhouette must be fully transparent, including the light gray area above and below the laptop and around its screen. Output a clean tightly bounded product cutout suitable for a small ecommerce hero card on a dark navy background.

Verified transparency in the saved image and centered `contain` fitting/background transparency on all three images in English/Arabic at 1440/820/390px. No horizontal overflow or JavaScript errors.
