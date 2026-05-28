export interface ApertureReferenceToolContract {
  readonly name:
    | "reference_api_lookup"
    | "reference_explain_diagnostic"
    | "reference_file_content"
    | "reference_find_dependents"
    | "reference_find_examples"
    | "reference_list_components"
    | "reference_list_systems"
    | "reference_search";
  readonly description: string;
  readonly properties?: Record<string, unknown>;
}

export const APERTURE_REFERENCE_TOOL_CONTRACT: readonly ApertureReferenceToolContract[] =
  [
    {
      name: "reference_search",
      description: "Search the Aperture RAG reference corpus.",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
        kind: {
          enum: [
            "doc",
            "source",
            "example",
            "test",
            "reference",
            "other",
            "any",
          ],
        },
      },
    },
    {
      name: "reference_api_lookup",
      description: "Look up exported Aperture API symbols.",
      properties: {
        symbol: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
      },
    },
    {
      name: "reference_file_content",
      description: "Read indexed Aperture reference file content.",
      properties: {
        file: { type: "string" },
        startLine: { type: "number" },
        endLine: { type: "number" },
      },
    },
    {
      name: "reference_find_examples",
      description: "Find Aperture examples related to a query.",
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
      },
    },
    {
      name: "reference_list_components",
      description: "List indexed Aperture components.",
    },
    {
      name: "reference_list_systems",
      description: "List indexed Aperture systems.",
    },
    {
      name: "reference_find_dependents",
      description: "Find indexed dependents of a symbol or file.",
      properties: {
        symbol: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
      },
    },
    {
      name: "reference_explain_diagnostic",
      description: "Explain an indexed diagnostic code.",
      properties: {
        code: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
      },
    },
  ];
