# Final PCSS validation extension

Native WebGPU run 02 passed 20 profiles and 19 numerical assertions: all four map edges and corners for lit/blocked receivers; radius100 equals radius16 exactly; direct production bilinear helper agrees with analytical horizontal and vertical edge visibility at fractional coordinates (maximum absolute error 0.000004882813). The native report records zero WebGL attempts, zero GPU errors, 21 submissions and 41 draws.

The initial wrapper attempt stopped before browser launch because the output parent folder was absent; its log is retained. Run02 used the corrected folder setup and did not overwrite historical regression files. The additional fixture keeps production-generated shader bytes unchanged.

The non-browser packed CLI check also passed using pinned pnpm10.12.1 and lifecycle-owned temporary fixtures, including the standard temporary dependency installation with scripts ignored. No manifest/lockfile or engine source changed. All descendants completed. The post-completion attempt to register the generated pnpm launcher was refused because this helper requires active-run registration. The launcher is preserved and no deletion was attempted.

These checks close the three independent-review coverage gaps and the previously unrun packing check. The previous 4,678-test result is not rerun or inflated by these 19 native assertions. Global lint/formatting limitations concerning cache files and frozen/historical evidence remain disclosed; no full unmodified pnpm run check pass is claimed.
