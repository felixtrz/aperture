export function parseImportMapFromHtml(html, { file }) {
  const matches = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const importMapScripts = matches.filter((match) =>
    /\btype\s*=\s*["']importmap["']/i.test(match[1] ?? ""),
  );

  if (importMapScripts.length === 0) {
    throw new Error(`${file} is missing a <script type="importmap"> block.`);
  }

  if (importMapScripts.length > 1) {
    throw new Error(`${file} has multiple import map blocks.`);
  }

  const json = importMapScripts[0]?.[2] ?? "";
  let parsed;

  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(
      `${file} has invalid import map JSON: ${messageFromError(error)}`,
      { cause: error },
    );
  }

  if (!isRecord(parsed)) {
    throw new Error(`${file} import map must be a JSON object.`);
  }

  if (!isRecord(parsed.imports)) {
    throw new Error(`${file} import map must contain an object 'imports' map.`);
  }

  return parsed;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
