import { basename } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { listJsonFiles, performanceOutputPath, readJsonIfExists, resolvePerformancePath } from "./stats";

type AnyReport = {
  kind?: string;
  generatedAt?: string;
  summary?: Array<Record<string, unknown>>;
  summaries?: Array<Record<string, unknown>>;
};

function renderTable(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "_Sin datos._";
  const keys = Object.keys(rows[0]!).slice(0, 10);
  const header = `| ${keys.join(" | ")} |`;
  const separator = `| ${keys.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${keys.map((key) => String(row[key] ?? "")).join(" | ")} |`);
  return [header, separator, ...body].join("\n");
}

async function readExistingDecisionSections(path: string) {
  try {
    const existing = await readFile(path, "utf8");
    const decisionStart = existing.search(/^## Decision Fase /m);

    if (decisionStart === -1) return "";
    return existing.slice(decisionStart).trim();
  } catch {
    return "";
  }
}

async function main() {
  const directory = performanceOutputPath("");
  const reportPath = resolvePerformancePath(performanceOutputPath("PLAN_OPTIMIZACION_INTEGRADOR.md"));
  const preservedDecisionSections = await readExistingDecisionSections(reportPath);
  const files = (await listJsonFiles(directory))
    .filter((file) => !file.endsWith("perf-report-index.json"));
  const sections = [];
  const index = [];

  for (const file of files) {
    const payload = await readJsonIfExists<AnyReport>(file);
    if (!payload) continue;
    const rows = payload.summary ?? payload.summaries ?? [];
    index.push({
      file: basename(file),
      kind: payload.kind ?? "unknown",
      generatedAt: payload.generatedAt ?? ""
    });
    sections.push(`## ${basename(file)}\n\n${renderTable(rows)}`);
  }

  const markdown = `# Reporte Integrador De Performance

Generado: ${new Date().toISOString()}

## Archivos Analizados

${renderTable(index)}

${sections.join("\n\n")}

## Decision Operativa

- Aplicar cambios solo cuando el resultado antes/despues supere el umbral definido en el plan.
- Posponer optimizaciones con mejora menor al 10% salvo que reduzcan deuda operacional clara.
- Revertir cualquier cambio que aumente errores o degrade p95 de escaneo.

${preservedDecisionSections ? `${preservedDecisionSections}\n` : ""}`;

  await writeFile(reportPath, markdown);
  console.info(markdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
