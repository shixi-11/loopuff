# Loading resources

The 2026-10-23 browser trace on the public Chinese home recorded a 70.483 s load event, including 66.411 s for the 2,308,069-byte world PNG. App modules and Chinese catalog completed earlier. This is one observed connection, not a global latency benchmark.

The master `public/assets/world.png` is unchanged (SHA-256 a6ae07a2ed5f515603dc9cc20d1517b69df26c5f48947543edd5e8dbb6534ff3). The web runtime uses `world-flight-90.webp`, 286,310 bytes, at the same 1672 × 941 dimensions, encoded with Pillow WebP quality 90 / method 6. It is lossy delivery compression, not new art or a resolution increase. The full runtime image was visually inspected.

HTML preloads this image. Generated route entry points have a static relative base, so the preload scanner resolves styles, scripts and art to the game root on both the standalone host and the personal-site prefix. Previously the base was inserted by JavaScript, and the observed browser trace included incorrect nested-route requests. The initial locale catalog is embedded in the generated HTML; language changes reuse cached catalogs, and a failed request is bounded to ten seconds.

Scope: loading and route resource resolution only. Aircraft, approved background composition, centered heading, green accent, navigation, course and vault behavior are retained. New aircraft art remains a separate candidate pending review.

Checks: 25 automated tests, static build, actual local vault/home navigation. The local vault load was 247 ms; this localhost observation is not a public-network speed claim. Live verification is recorded under `output/loading/` after deployment.

The first public retest loaded in 29.628 s: the compressed image completed in 26.265 s, but tiny independent modules also waited roughly 25 s. The remaining request fan-out was therefore removed: esbuild bundles the browser graph into one ESM file (51,332 bytes before HTTP compression), combines/minifies both stylesheets, and emits content-hashed filenames. Initial navigation links render in the HTML and work without waiting for the module. This is a build dependency only, with its exact version and cross-platform package integrity recorded in package-lock.json. No client framework or extra runtime library is added.
