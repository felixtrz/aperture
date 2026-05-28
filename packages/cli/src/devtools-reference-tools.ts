import {
  findApertureReferenceDependents,
  listApertureReferenceComponents,
  listApertureReferenceSystems,
  readApertureReferenceFile,
  searchApertureReferences,
} from "./reference.js";
import {
  numberArg,
  optionalNumber,
  optionalReferenceKind,
  referenceKindArg,
  stringArg,
} from "./devtools-args.js";

export async function callReferenceTool(
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
