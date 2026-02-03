import express from "express";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  console.log("GET /");
  res.json({ ok: true });
});

app.listen(3001, () => {
  console.log("✅ Test server on http://localhost:3001");
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});
