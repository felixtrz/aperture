import {
  findApertureReferenceDependents,
  isReferenceNotWarmedError,
  listApertureReferenceComponents,
  listApertureReferenceSystems,
  readApertureReferenceFile,
  searchApertureReferences,
  warmApertureReferences,
} from "../reference.js";
import {
  numberArg,
  optionalNumber,
  optionalReferenceKind,
  referenceKindArg,
  stringArg,
} from "./args.js";

/**
 * De-duplicates concurrent on-demand warmups per project root so parallel
 * reference tool calls trigger a single download instead of racing.
 */
const inFlightWarmups = new Map<string, Promise<void>>();

export async function callReferenceTool(
  cwd: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  try {
    return await dispatchReferenceTool(cwd, name, args);
  } catch (error: unknown) {
    if (!isReferenceNotWarmedError(error)) {
      throw error;
    }

    // The corpus has never been warmed in this project. Warm it on demand —
    // the same versioned payload `aperture reference warmup` downloads — and
    // retry once, reporting the warmup through a structured diagnostic
    // instead of failing the first reference_* call with a manual
    // instruction.
    try {
      await warmReferencesOnce(cwd);
    } catch (warmupError: unknown) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "aperture.reference.notWarmed",
            message: error.message,
          },
          {
            code: "aperture.reference.autoWarmupFailed",
            message: `Automatic reference warmup failed: ${
              warmupError instanceof Error
                ? warmupError.message
                : String(warmupError)
            } Run 'aperture reference warmup' manually.`,
          },
        ],
      };
    }

    const result = await dispatchReferenceTool(cwd, name, args);
    return annotateWarmedOnDemand(result);
  }
}

function warmReferencesOnce(cwd: string): Promise<void> {
  const existing = inFlightWarmups.get(cwd);

  if (existing !== undefined) {
    return existing;
  }

  const warmup = warmApertureReferences({ cwd })
    .then(() => undefined)
    .finally(() => {
      inFlightWarmups.delete(cwd);
    });
  inFlightWarmups.set(cwd, warmup);
  return warmup;
}

function annotateWarmedOnDemand(result: unknown): unknown {
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    return result;
  }

  const record = result as Record<string, unknown>;
  const diagnostics = Array.isArray(record["diagnostics"])
    ? record["diagnostics"]
    : [];

  return {
    ...record,
    warmedOnDemand: true,
    diagnostics: [
      ...diagnostics,
      {
        code: "aperture.reference.warmedOnDemand",
        message:
          "The reference corpus was warmed automatically before serving this call.",
      },
    ],
  };
}

async function dispatchReferenceTool(
  cwd: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "reference_search":
      return searchApertureReferences({
        cwd,
        query: stringArg(args, "query") ?? "",
        ...optionalNumber("limit", numberArg(args, "limit")),
        ...optionalReferenceKind(referenceKindArg(args)),
      });
    case "reference_api_lookup":
      return searchApertureReferences({
        cwd,
        query: stringArg(args, "symbol") ?? stringArg(args, "query") ?? "",
        limit: numberArg(args, "limit") ?? 5,
        kind: "source",
      });
    case "reference_file_content": {
      const file = stringArg(args, "file") ?? "";
      const entry = await readApertureReferenceFile(cwd, file, {
        ...optionalNumber("startLine", numberArg(args, "startLine")),
        ...optionalNumber("endLine", numberArg(args, "endLine")),
      });

      return entry === null
        ? {
            ok: false,
            diagnostic: {
              code: "aperture.reference.fileNotIndexed",
              file,
              message:
                "The requested file is not present in the warmed reference corpus.",
            },
          }
        : { ok: true, entry };
    }
    case "reference_find_examples":
      return searchApertureReferences({
        cwd,
        query: stringArg(args, "query") ?? "",
        ...optionalNumber("limit", numberArg(args, "limit")),
        kind: "example",
      });
    case "reference_list_components":
      return {
        ok: true,
        components: await listApertureReferenceComponents(cwd),
      };
    case "reference_list_systems":
      return {
        ok: true,
        systems: await listApertureReferenceSystems(cwd),
      };
    case "reference_find_dependents":
      return findApertureReferenceDependents({
        cwd,
        symbol: stringArg(args, "symbol") ?? stringArg(args, "query") ?? "",
        ...optionalNumber("limit", numberArg(args, "limit")),
      });
    case "reference_explain_diagnostic":
      return searchApertureReferences({
        cwd,
        query: stringArg(args, "code") ?? stringArg(args, "query") ?? "",
        limit: numberArg(args, "limit") ?? 5,
        sourceCategory: "diagnostic",
      });
    default:
      return unsupportedReferenceTool(name);
  }
}

function unsupportedReferenceTool(name: string): unknown {
  return {
    ok: false,
    diagnostic: {
      code: "aperture.mcp.toolUnsupported",
      tool: name,
      message: "Unknown Aperture reference tool.",
    },
  };
}
