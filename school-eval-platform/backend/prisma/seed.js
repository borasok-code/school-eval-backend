import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load DATABASE_URL from backend/.env no matter where the script is run.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const prisma = new PrismaClient({ errorFormat: "pretty" });

function normalizeSpace(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function requirementsToItems(reqText) {
  const raw = normalizeSpace(reqText);
  if (!raw) return [];

  let parts = raw.split(/\(\s*\)\s*/g).map(p => normalizeSpace(p)).filter(Boolean);

  if (parts.length <= 1 && raw.length > 80) {
    parts = raw.split(/[áŸ”;]|(?:\s-\s)|(?:\sâ€¢\s)/g)
      .map(p => normalizeSpace(p)).filter(p => p.length >= 3);
  }

  return parts.slice(0, 60);
}

async function main() {
  console.log("Seed script starting...");

  const seedPath = path.resolve(__dirname, "..", "..", "school_standards_indicators.json");
  if (!fs.existsSync(seedPath)) throw new Error(`Seed file not found: ${seedPath}`);
  const data = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
  console.log(`Loaded ${data.length} rows from ${seedPath}`);

  const standardTitles = new Map();
  for (const row of data) {
    const standardNo = Number(row.standard_no);
    if (!Number.isFinite(standardNo)) continue;
    standardTitles.set(standardNo, normalizeSpace(row.standard_title));
  }

  for (const [standardNo, title] of standardTitles.entries()) {
    await prisma.standard.upsert({
      where: { standardNo },
      update: { title },
      create: { standardNo, title }
    });
  }

  const standards = await prisma.standard.findMany({
    where: { standardNo: { in: Array.from(standardTitles.keys()) } },
    select: { id: true, standardNo: true }
  });
  const standardByNo = new Map(standards.map(s => [s.standardNo, s]));

  let indicatorsProcessed = 0;
  let checklistAdded = 0;

  for (const row of data) {
    const standardNo = Number(row.standard_no);
    const standard = standardByNo.get(standardNo);
    if (!standard) continue;

    const code = normalizeSpace(row.indicator_code);
    const name = normalizeSpace(row.indicator_name);
    if (!code || !name) continue;

    // Prisma upsert needs a unique key; use the existing id when present.
    const existing = await prisma.indicator.findFirst({
      where: { standardId: standard.id, code },
      select: { id: true }
    });
    const indicator = await prisma.indicator.upsert({
      where: { id: existing?.id ?? -1 },
      update: { name },
      create: { standardId: standard.id, code, name }
    });
    indicatorsProcessed += 1;

    const items = requirementsToItems(row.requirements);
    if (items.length) {
      const existingItems = await prisma.checklistItem.findMany({
        where: { indicatorId: indicator.id },
        select: { text: true }
      });
      const existingTexts = new Set(existingItems.map(i => normalizeSpace(i.text)));
      const newItems = items.filter(text => !existingTexts.has(text));
      if (newItems.length) {
        const result = await prisma.checklistItem.createMany({
          data: newItems.map(text => ({ indicatorId: indicator.id, text }))
        });
        checklistAdded += result.count;
      }
    }
  }

  console.log(`Seed completed. Standards: ${standardTitles.size}, Indicators processed: ${indicatorsProcessed}, Checklist items added: ${checklistAdded}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
