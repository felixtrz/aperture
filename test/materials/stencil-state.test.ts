import { describe, expect, it } from "vitest";
import {
  createCustomWgslMaterialAsset,
  createMaterialPipelineKeyInput,
  createStandardMaterialAsset,
  createStencilState,
  createUnlitMaterialAsset,
  materialPipelineKeyInputToKey,
  materialStencilPipelineFeatures,
  materialStencilPipelineToken,
  validateMaterialAsset,
  type StencilStateDescriptor,
} from "@aperture-engine/render";

// D1 (three.js parity plan): per-material stencil state. Analogous to three.js
// Material.stencilWrite / stencilFunc / stencilRef / stencilFuncMask /
// stencilWriteMask / stencilFail / stencilZFail / stencilZPass.

describe("createStencilState (D1)", () => {
  it("fills WebGPU/three.js no-op defaults and full unsigned masks", () => {
    expect(createStencilState()).toEqual({
      readMask: 0xffffffff,
      writeMask: 0xffffffff,
      reference: 0,
      front: {
        compare: "always",
        failOp: "keep",
        depthFailOp: "keep",
        passOp: "keep",
      },
      back: {
        compare: "always",
        failOp: "keep",
        depthFailOp: "keep",
        passOp: "keep",
      },
    });
  });

  it("applies face shorthands to BOTH faces", () => {
    const stencil = createStencilState({
      compare: "equal",
      reference: 1,
      passOp: "replace",
    });

    expect(stencil.front).toEqual({
      compare: "equal",
      failOp: "keep",
      depthFailOp: "keep",
      passOp: "replace",
    });
    expect(stencil.back).toEqual(stencil.front);
    expect(stencil.reference).toBe(1);
  });

  it("lets per-face overrides win over shorthands", () => {
    const stencil = createStencilState({
      compare: "always",
      passOp: "keep",
      front: { compare: "not-equal", passOp: "replace" },
    });

    expect(stencil.front.compare).toBe("not-equal");
    expect(stencil.front.passOp).toBe("replace");
    // Back keeps the shorthand.
    expect(stencil.back.compare).toBe("always");
    expect(stencil.back.passOp).toBe("keep");
  });

  it("clamps non-integer / out-of-range masks to unsigned 32-bit", () => {
    const stencil = createStencilState({
      readMask: 3.9,
      writeMask: -1,
      reference: Number.NaN,
    });

    expect(stencil.readMask).toBe(3);
    expect(stencil.writeMask).toBe(0xffffffff);
    expect(stencil.reference).toBe(0);
  });
});

describe("stencil pipeline-key participation (D1)", () => {
  const stencil = createStencilState({
    compare: "equal",
    reference: 1,
    passOp: "replace",
  });

  it("emits the stencil token ONLY when stencil is authored", () => {
    expect(materialStencilPipelineFeatures(undefined)).toEqual([]);
    expect(materialStencilPipelineFeatures(stencil)).toEqual([
      "stencil:4294967295:4294967295:1:equal:keep:keep:replace:equal:keep:keep:replace",
    ]);
  });

  it("round-trips every field of the stencil token", () => {
    const token = materialStencilPipelineToken(
      createStencilState({
        readMask: 0x0f,
        writeMask: 0xf0,
        reference: 7,
        front: { compare: "greater", passOp: "increment-wrap" },
        back: { compare: "less", failOp: "invert", depthFailOp: "zero" },
      }),
    );

    expect(token).toBe(
      "stencil:15:240:7:greater:keep:keep:increment-wrap:less:invert:zero:keep",
    );
  });

  it("keeps NON-stencil built-in keys byte-identical (pinned pre-change literal)", () => {
    // The pre-D1 key for a plain standard material — must be unchanged.
    expect(
      materialPipelineKeyInputToKey(
        createMaterialPipelineKeyInput(createStandardMaterialAsset({})),
      ),
    ).toBe("standard|opaque|back|less|none");
    expect(
      materialPipelineKeyInputToKey(
        createMaterialPipelineKeyInput(createUnlitMaterialAsset({})),
      ),
    ).toBe("unlit|opaque|back|less|none");
  });

  it("appends the stencil token (as a sorted feature) for a stencil material", () => {
    const material = createStandardMaterialAsset({ renderState: { stencil } });

    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toBe(
      "standard|stencil:4294967295:4294967295:1:equal:keep:keep:replace:equal:keep:keep:replace|opaque|back|less|none",
    );
  });

  it("threads the stencil token through custom-WGSL material keys too", () => {
    const material = createCustomWgslMaterialAsset({
      familyKey: "example/portal",
      label: "Portal",
      shader: { kind: "inline-wgsl", code: "// wgsl" },
      entryPoints: { vertex: "vs", fragment: "fs" },
      renderState: {
        stencil: createStencilState({ reference: 1, passOp: "replace" }),
      },
    });

    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(material)),
    ).toContain(
      "|stencil:4294967295:4294967295:1:always:keep:keep:replace:always:keep:keep:replace|",
    );
  });

  it("distinguishes materials that differ only in stencil reference", () => {
    const a = createStandardMaterialAsset({
      renderState: {
        stencil: createStencilState({ reference: 1, passOp: "replace" }),
      },
    });
    const b = createStandardMaterialAsset({
      renderState: {
        stencil: createStencilState({ reference: 2, passOp: "replace" }),
      },
    });

    expect(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(a)),
    ).not.toBe(
      materialPipelineKeyInputToKey(createMaterialPipelineKeyInput(b)),
    );
  });
});

describe("stencil render-state validation (D1)", () => {
  it("accepts a well-formed stencil state", () => {
    const material = createStandardMaterialAsset({
      renderState: {
        stencil: createStencilState({ reference: 1, passOp: "replace" }),
      },
    });

    expect(validateMaterialAsset(material).valid).toBe(true);
  });

  it("flags a non-integer / out-of-range reference or mask", () => {
    const stencil: StencilStateDescriptor = {
      ...createStencilState({ passOp: "replace" }),
      reference: -1,
      readMask: 2 ** 33,
    };
    const material = createStandardMaterialAsset({ renderState: { stencil } });

    const codes = validateMaterialAsset(material).diagnostics.map(
      (d) => d.code,
    );
    expect(codes).toContain("material.invalidStencilState");
    // Two invalid fields -> two diagnostics.
    expect(
      codes.filter((code) => code === "material.invalidStencilState"),
    ).toHaveLength(2);
  });
});
