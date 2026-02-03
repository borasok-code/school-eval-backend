import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import { uploadToDrive, deleteFromDrive } from "./drive.js";

console.log("=== SERVER STARTUP ===");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env reliably no matter where node is launched from.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const uploadsDir = path.resolve(__dirname, "..", "uploads");

const hasDriveCredentials = () => (
  Boolean(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)
);

const resolveLocalUploadPath = (evidence) => {
  const source = evidence?.webViewLink || evidence?.path || "";
  if (!source) return null;

  const extractFromPathname = (pathname) => {
    if (!pathname || !pathname.startsWith("/uploads/")) return null;
    const filename = path.basename(pathname);
    if (!filename) return null;
    return path.join(uploadsDir, filename);
  };

  if (source.startsWith("http://") || source.startsWith("https://")) {
    try {
      const url = new URL(source);
      return extractFromPathname(url.pathname);
    } catch (err) {
      return null;
    }
  }

  if (source.includes("/uploads/")) {
    const [, tail] = source.split("/uploads/");
    const filename = path.basename(tail || "");
    if (!filename) return null;
    return path.join(uploadsDir, filename);
  }

  return null;
};

const deleteLocalFileIfExists = async (filepath) => {
  if (!filepath) return;
  try {
    await fs.promises.unlink(filepath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
};

async function start() {
  try {
    console.log("Creating Express app...");
    const app = express();
    console.log("Creating Prisma client...");
    const prisma = new PrismaClient({ errorFormat: 'pretty' });
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
    console.log("Setting up middleware...");

    app.use(express.json({ limit: "10mb" }));
    app.use(cors({ origin: "*" }));
    app.use("/uploads", express.static(uploadsDir));
    console.log("Middleware configured");

    // Routes
    app.get("/", (req, res) => {
      res.json({ status: "ok" });
    });

    app.get("/api/health", async (req, res) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
      }
    });

    app.get("/api/standards", async (req, res) => {
      const startedAt = Date.now();
      console.log("[GET] /api/standards");
      try {
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

        console.log(`Returning ${withStats.length} standards in ${Date.now() - startedAt}ms`);
        res.json(withStats);
      } catch (err) {
        console.error("Failed to fetch standards:", err);
        res.status(500).json({ error: err.message });
      }
    });

    app.get("/api/standards/:id", async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid standard id" });
      }
      console.log(`[GET] /api/standards/${id}`);
      try {
        const standard = await prisma.standard.findUnique({
          where: { id },
          include: {
            indicators: {
              orderBy: { code: "asc" },
              select: { id: true, code: true, name: true, status: true, progress: true, managerId: true }
            }
          }
        });
        if (!standard) return res.status(404).json({ error: "Standard not found" });
        res.json(standard);
      } catch (err) {
        console.error("Failed to fetch standard detail:", err);
        res.status(500).json({ error: err.message });
      }
    });

    app.patch("/api/standards/:id", async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid standard id" });
      }
      const ownerIdRaw = req.body?.ownerId;
      const data = {};
      if (ownerIdRaw === null || ownerIdRaw === undefined || ownerIdRaw === "") {
        data.ownerId = null;
      } else {
        const ownerId = Number(ownerIdRaw);
        if (!Number.isFinite(ownerId)) {
          return res.status(400).json({ error: "Invalid ownerId" });
        }
        data.ownerId = ownerId;
      }
      try {
        const updated = await prisma.standard.update({ where: { id }, data });
        res.json(updated);
      } catch (err) {
        console.error("Failed to update standard:", err);
        res.status(500).json({ error: err.message });
      }
    });

    app.get("/api/indicators/:id", async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid indicator id" });
      }
      console.log(`[GET] /api/indicators/${id}`);
      try {
        const indicator = await prisma.indicator.findUnique({
          where: { id },
          include: {
            checklist: {
              orderBy: { id: "asc" },
              include: { evidence: true }
            }
          }
        });
        if (!indicator) return res.status(404).json({ error: "Indicator not found" });
        res.json(indicator);
      } catch (err) {
        console.error("Failed to fetch indicator detail:", err);
        res.status(500).json({ error: err.message });
      }
    });

    app.patch("/api/indicators/:id", async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid indicator id" });
      }
      const data = {};
      if (req.body?.managerId !== undefined) {
        if (req.body.managerId === null || req.body.managerId === "") {
          data.managerId = null;
        } else {
          const managerId = Number(req.body.managerId);
          if (!Number.isFinite(managerId)) {
            return res.status(400).json({ error: "Invalid managerId" });
          }
          data.managerId = managerId;
        }
      }
      if (req.body?.progress !== undefined) {
        const progress = Number(req.body.progress);
        if (!Number.isFinite(progress)) {
          return res.status(400).json({ error: "Invalid progress" });
        }
        data.progress = Math.max(0, Math.min(100, Math.round(progress)));
      }
      if (req.body?.status !== undefined) {
        data.status = req.body.status;
      }
      if (!Object.keys(data).length) {
        return res.status(400).json({ error: "No fields to update" });
      }
      try {
        const updated = await prisma.indicator.update({ where: { id }, data });
        res.json(updated);
      } catch (err) {
        console.error("Failed to update indicator:", err);
        res.status(500).json({ error: err.message });
      }
    });

    app.patch("/api/checklist-items/:id", async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid checklist item id" });
      }
      if (!req.body?.status) {
        return res.status(400).json({ error: "status required" });
      }
      try {
        const updated = await prisma.checklistItem.update({
          where: { id },
          data: { status: req.body.status }
        });
        res.json(updated);
      } catch (err) {
        console.error("Failed to update checklist item:", err);
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/checklist-items/:id/evidence", upload.single("file"), async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid checklist item id" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "file required" });
      }
      try {
        const checklistItem = await prisma.checklistItem.findUnique({
          where: { id },
          select: { id: true, indicatorId: true }
        });
        if (!checklistItem) return res.status(404).json({ error: "Checklist item not found" });

        let driveResult = null;
        if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
          try {
            driveResult = await uploadToDrive({
              buffer: req.file.buffer,
              mimeType: req.file.mimetype,
              filename: req.file.originalname,
              makePublic: String(process.env.DRIVE_PUBLIC || "").toLowerCase() === "true",
              shareWithEmail: process.env.DRIVE_SHARE_EMAIL || ""
            });
          } catch (err) {
            console.error("Drive upload failed, saving locally:", err.message);
          }
        } else {
          console.log("Drive creds missing, saving file locally.");
        }

        let pathValue = "";
        let publicLink = "";
        if (driveResult?.webViewLink) {
          pathValue = driveResult.webViewLink;
          publicLink = driveResult.webViewLink;
        } else {
          fs.mkdirSync(uploadsDir, { recursive: true });
          const safeName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          fs.writeFileSync(path.join(uploadsDir, safeName), req.file.buffer);
          const baseUrl = `${req.protocol}://${req.get("host")}`;
          publicLink = `${baseUrl}/uploads/${safeName}`;
          pathValue = publicLink;
        }

        const evidence = await prisma.evidenceFile.create({
          data: {
            checklistItemId: checklistItem.id,
            indicatorId: checklistItem.indicatorId,
            filename: req.file.originalname,
            path: pathValue,
            driveFileId: driveResult?.id ?? null,
            webViewLink: publicLink || driveResult?.webViewLink || null,
            uploadedBy: req.body?.uploadedBy ?? null
          }
        });

        res.json(evidence);
      } catch (err) {
        console.error("Failed to upload evidence:", err);
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/checklist-items/:id/evidence-link", async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid checklist item id" });
      }

      const url = String(req.body?.url || "").trim();
      if (!url) {
        return res.status(400).json({ error: "url required" });
      }

      let filename = String(req.body?.filename || "").trim();
      if (!filename) {
        try {
          const parsed = new URL(url);
          filename = path.basename(parsed.pathname) || "Evidence link";
        } catch {
          filename = "Evidence link";
        }
      }

      try {
        const checklistItem = await prisma.checklistItem.findUnique({
          where: { id },
          select: { id: true, indicatorId: true }
        });
        if (!checklistItem) return res.status(404).json({ error: "Checklist item not found" });

        const evidence = await prisma.evidenceFile.create({
          data: {
            checklistItemId: checklistItem.id,
            indicatorId: checklistItem.indicatorId,
            filename,
            path: url,
            driveFileId: null,
            webViewLink: url,
            uploadedBy: req.body?.uploadedBy ?? null
          }
        });

        res.json(evidence);
      } catch (err) {
        console.error("Failed to add evidence link:", err);
        res.status(500).json({ error: err.message });
      }
    });

    app.delete("/api/evidence/:id", async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid evidence id" });
      }

      try {
        const evidence = await prisma.evidenceFile.findUnique({ where: { id } });
        if (!evidence) {
          return res.status(404).json({ error: "Evidence not found" });
        }

        if (evidence.driveFileId) {
          if (!hasDriveCredentials()) {
            return res.status(500).json({ error: "Drive credentials missing; cannot delete drive file." });
          }
          try {
            await deleteFromDrive({ fileId: evidence.driveFileId });
          } catch (err) {
            console.error("Failed to delete Drive file:", err);
            return res.status(500).json({ error: "Failed to delete Drive file." });
          }
        } else {
          const localPath = resolveLocalUploadPath(evidence);
          try {
            await deleteLocalFileIfExists(localPath);
          } catch (err) {
            console.error("Failed to delete local file:", err);
            return res.status(500).json({ error: "Failed to delete local file." });
          }
        }

        await prisma.evidenceFile.delete({ where: { id } });
        res.json({ ok: true });
      } catch (err) {
        console.error("Failed to delete evidence:", err);
        res.status(500).json({ error: err.message });
      }
    });

    app.get("/api/users", async (req, res) => {
      try {
        const users = await prisma.user.findMany({ orderBy: { id: "asc" }});
        res.json(users);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post("/api/users", async (req, res) => {
      try {
        const { name, role } = req.body;
        if (!name) return res.status(400).json({ error: "name required" });
        const user = await prisma.user.create({ data: { name, role: role || "TEACHER" }});
        res.json(user);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Error handler
    app.use((err, req, res, next) => {
      console.error("ERROR:", err);
      res.status(500).json({ error: err.message });
    });

    const port = process.env.PORT || 3000;
    console.log(`About to call app.listen on port ${port}`);
    
    const server = app.listen(port, () => {
      console.log(`✅ Listening on port ${port}`);
      console.log(`Server started at: ${new Date().toISOString()}`);
      console.log(`Process ID: ${process.pid}`);
    });
    
    server.on('error', (err) => {
      console.error('SERVER ERROR on listen:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
      }
      process.exit(1);
    });
    
    server.on('clientError', (err) => {
      console.error('CLIENT ERROR:', err.message);
    });
    
    process.on('uncaughtException', (err) => {
      console.error('UNCAUGHT EXCEPTION:', err);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (err) {
    console.error('STARTUP ERROR:', err);
    process.exit(1);
  }
}

start();
