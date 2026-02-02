import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import { uploadToDrive } from "./drive.js";

dotenv.config();
const app = express();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: "10mb" }));
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(origin => origin.trim()).filter(Boolean)
  : "*";
app.use(cors({ origin: corsOrigin }));

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "ok" });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({ ok: false, db: "fail" });
  }
});

app.get("/api/standards", async (req, res) => {
  const standards = await prisma.standard.findMany({
    orderBy: { standardNo: "asc" },
    include: { indicators: { select: { id: true, status: true, progress: true } } }
  });

  const withStats = standards.map(s => {
    const total = s.indicators.length;
    const completed = s.indicators.filter(i => i.status === "COMPLETED").length;
    const avgProgress = total ? Math.round(s.indicators.reduce((a,b)=>a+(b.progress||0),0)/total) : 0;
    return { ...s, stats: { total, completed, avgProgress } };
  });

  res.json(withStats);
});

app.get("/api/standards/:id", async (req, res) => {
  const id = Number(req.params.id);
  const standard = await prisma.standard.findUnique({
    where: { id },
    include: {
      owner: true,
      indicators: { orderBy: [{ code: "asc" }, { id: "asc" }], include: { manager: true } }
    }
  });
  if (!standard) return res.status(404).json({ error: "Not found" });
  res.json(standard);
});

app.patch("/api/standards/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { ownerId, title } = req.body ?? {};
  const updated = await prisma.standard.update({
    where: { id },
    data: {
      ...(title ? { title: String(title) } : {}),
      ...(ownerId !== undefined ? { ownerId: ownerId ? Number(ownerId) : null } : {})
    }
  });
  res.json(updated);
});

app.get("/api/indicators", async (req, res) => {
  const standardId = req.query.standardId ? Number(req.query.standardId) : undefined;
  const where = standardId ? { standardId } : {};
  const indicators = await prisma.indicator.findMany({
    where,
    orderBy: [{ code: "asc" }, { id: "asc" }],
    include: { manager: true, standard: { select: { standardNo: true, title: true } } }
  });
  res.json(indicators);
});

app.get("/api/indicators/:id", async (req, res) => {
  const id = Number(req.params.id);
  const indicator = await prisma.indicator.findUnique({
    where: { id },
    include: {
      manager: true,
      standard: true,
      checklist: { orderBy: { id: "asc" }, include: { assignee: true, evidence: true, comments: true } }
    }
  });
  if (!indicator) return res.status(404).json({ error: "Not found" });
  res.json(indicator);
});

app.patch("/api/indicators/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status, progress, managerId, name } = req.body ?? {};
  const updated = await prisma.indicator.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(progress !== undefined ? { progress: Number(progress) } : {}),
      ...(managerId !== undefined ? { managerId: managerId ? Number(managerId) : null } : {}),
      ...(name ? { name: String(name) } : {})
    }
  });
  res.json(updated);
});

app.patch("/api/checklist-items/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status, assigneeId, text } = req.body ?? {};
  const updated = await prisma.checklistItem.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(assigneeId !== undefined ? { assigneeId: assigneeId ? Number(assigneeId) : null } : {}),
      ...(text ? { text: String(text) } : {})
    }
  });
  res.json(updated);
});

app.post("/api/checklist-items/:id/comments", async (req, res) => {
  const checklistItemId = Number(req.params.id);
  const { authorName, text } = req.body ?? {};
  if (!text) return res.status(400).json({ error: "text is required" });
  const comment = await prisma.comment.create({
    data: { checklistItemId, authorName: authorName ? String(authorName) : "Teacher", text: String(text) }
  });
  res.json(comment);
});

app.post("/api/checklist-items/:id/evidence", upload.single("file"), async (req, res) => {
  const checklistItemId = Number(req.params.id);
  const { uploadedBy } = req.body ?? {};
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "file is required" });
  }
  const missingEnv = ["GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY"].filter((key) => !process.env[key]);
  if (missingEnv.length) {
    return res.status(500).json({ error: `Missing required env vars: ${missingEnv.join(", ")}` });
  }

  try {
    const driveFile = await uploadToDrive({
      buffer: file.buffer,
      mimeType: file.mimetype,
      filename: file.originalname,
      folderId: process.env.DRIVE_FOLDER_ID
    });

    const savedEvidence = await prisma.evidenceFile.create({
      data: {
        checklistItemId,
        filename: file.originalname,
        path: driveFile.webViewLink,
        driveFileId: driveFile.id,
        webViewLink: driveFile.webViewLink,
        uploadedBy: uploadedBy ? String(uploadedBy) : "Teacher"
      }
    });

    res.json({ savedEvidence, driveFile });
  } catch (error) {
    console.error("Evidence upload failed:", error);
    res.status(502).json({ error: "Failed to upload evidence", details: error?.message || "Drive upload error" });
  }
});

app.get("/api/users", async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { id: "asc" }});
  res.json(users);
});

app.post("/api/users", async (req, res) => {
  const { name, role } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const user = await prisma.user.create({ data: { name: String(name), role: role || "TEACHER" }});
  res.json(user);
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`✅ API running on http://localhost:${port}`));
