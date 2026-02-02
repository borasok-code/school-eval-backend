import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeSpace(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function requirementsToItems(reqText) {
  const raw = normalizeSpace(reqText);
  if (!raw) return [];

  let parts = raw.split(/\(\s*\)\s*/g).map(p => normalizeSpace(p)).filter(Boolean);

  if (parts.length <= 1 && raw.length > 80) {
    parts = raw.split(/[។;]|(?:\s-\s)|(?:\s•\s)/g)
      .map(p => normalizeSpace(p)).filter(p => p.length >= 3);
  }

  return parts.slice(0, 60);
}

async function main() {
  const seedPath = path.resolve(process.cwd(), "../school_standards_indicators.json");
  if (!fs.existsSync(seedPath)) throw new Error(`Seed file not found: ${seedPath}`);
  const data = JSON.parse(fs.readFileSync(seedPath, "utf-8"));

  const standardTitles = new Map();
  for (const row of data) standardTitles.set(row.standard_no, normalizeSpace(row.standard_title));

  for (const [standardNo, title] of standardTitles.entries()) {
    await prisma.standard.upsert({
      where: { standardNo: Number(standardNo) },
      update: { title },
      create: { standardNo: Number(standardNo), title }
    });
  }

  for (const row of data) {
    const standardNo = Number(row.standard_no);
    const standard = await prisma.standard.findUnique({ where: { standardNo }});
    if (!standard) continue;

    const code = normalizeSpace(row.indicator_code);
    const name = normalizeSpace(row.indicator_name);

    const existing = await prisma.indicator.findFirst({ where: { standardId: standard.id, code, name }});
    if (existing) continue;

    const indicator = await prisma.indicator.create({ data: { standardId: standard.id, code, name }});

    const items = requirementsToItems(row.requirements);
    if (items.length) {
      await prisma.checklistItem.createMany({
        data: items.map(text => ({ indicatorId: indicator.id, text }))
      });
    }
  }

  console.log("✅ Seed completed.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
