# Simultaneous directional and point shadows

The automatic WebGPU shadow path supports **one non-cascaded directional sun
and point lights in the same frame**. Author normal shadow settings on each
light and castShadow / receiveShadow on meshes; no new authoring API is needed.

The receiver variant is directional-point-array. It combines the existing
directional fitting and sampling with a separate point depth array. Three point
lights occupy 18 layers; the sun adds one pass, for 19 caster passes in total.
Point requests share the largest requested point-map resolution in the frame.
The renderer uses per-light metadata even below the usual clustered-light
threshold, so each point samples its own six matrices/layers and its own shadow
strength, depth bias and world-space normal bias. Unshadowed directional fill
lights may appear before or after the sun; the sun alone owns its map and
shadow settings, and fills keep their unshadowed contributions.

The default frame graph encodes all shadow passes with the opaque scene in the
same frame command encoder. Standalone createRenderShadowFrame calls still
work: a composed frame submits the two per-kind command buffers when encoding
is enabled. Standalone composed frames omit GPU timestamps rather than reuse
one query range incorrectly; frame-graph timestamps remain per pass.

## Reports and low-level integration

RenderShadowFrameResult.frames is present on composed results and contains the
complete directional and point subframes. Low-level users who request
encode: false must consume every subframe's attachments and commands, just as
the built-in frame graph does. Existing top-level resource/detail fields retain
the primary directional shape; receiverResources binds both kinds.

Top-level report counts, readiness, diagnostics and resource-reuse counts
summarize both kinds. lightKindReports preserves complete per-kind details in
both full and status serialization. Resource caches distinguish directional and
point world-transform buffers and re-created GPU buffer/texture identities.
requestCoverage accounts for all original requests and the selected union even
when GPU allocation fails; served describes routing, not GPU readiness.
Current-frame submitted draw counts are normalized recursively: graph submission
counts each child, while cache hits or failed graph submissions count zero.
Separate command-buffer submission fields remain unchanged by graph ownership.

## Explicit limits

- Cascaded sun plus point lights and multiple shadow-requesting suns plus point
  lights retain directional precedence; point requests are not rendered
- Spot shadows mixed with directional and/or point shadows are not served;
  spot-only, directional-only and point-only paths remain available
- Unsupported mixed combinations produce a
  renderShadowFrame.omittedShadowRequest warning for each omitted request
- This feature does not add alpha-blended, skinned or morphed caster support;
  existing caster diagnostics and supported geometry remain unchanged
- Multiple point maps in an automatic point frame share an array and resolution;
  manual receiver resources retain their explicit layout contract

## Native verification

Build packages first. In this dot cloud environment, use the established
cleanup lifecycle wrapper and provisioned runtime, then run:

    APERTURE_WEBGPU_RUNTIME=/absolute/provisioned/runtime \
      node scripts/verify-mixed-shadows.mjs /absolute/retained/output

The wrapper must supply APERTURE_TMP_RUN. This script calls only
runVerifiedScene from scripts/verified-webgpu.mjs; it does not install or
launch another browser route.

The common-geometry fixture renders a sun and three RGB point lights. It toggles
one shadow at a time, moves a light/caster, changes map size and biases, removes
and restores lights, and exercises IBL and homogeneous shadow paths. Native
texture-to-buffer copies preserve pixels before canvas presentation; those
readback submissions are test instrumentation, not renderer performance data.
Ground-only probes distinguish real receiver occlusion from self-shadow changes.

CPU tests validate topology, resource/cache identity and generated shader
contracts. They are not GPU proof. Native reports record SwiftShader WebGPU,
real submissions, errors and lifecycle completion; no physical-GPU performance
or full-suite claim follows from a focused render.
