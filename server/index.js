import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";

const dataPath = path.resolve("server", "highscores.json");

const ensureDataFile = () => {
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, "[]\n", "utf8");
  }
};

const readHighScores = () => {
  ensureDataFile();
  const raw = fs.readFileSync(dataPath, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistHighScores = (entries) => {
  fs.writeFileSync(dataPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
};

const sortHighScores = (a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  const completedDelta = Number(b.completed) - Number(a.completed);
  if (completedDelta !== 0) return completedDelta;
  const aTime = new Date(a.earned_at).getTime();
  const bTime = new Date(b.earned_at).getTime();
  return bTime - aTime;
};

const nextId = (scores) => {
  return scores.reduce((max, candidate) => Math.max(max, candidate.id ?? 0), 0) + 1;
};

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/highscores", (_req, res) => {
  try {
    const list = readHighScores().sort(sortHighScores).slice(0, 10);
    res.json(list);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load leaderboard at this time." });
  }
});

app.post("/api/highscores", (req, res) => {
  const { player, score, completed } = req.body;
  if (typeof player !== "string" || player.trim().length === 0) {
    return res.status(400).json({ error: "Player name is required." });
  }
  if (typeof score !== "number" || Number.isNaN(score) || score < 0) {
    return res.status(400).json({ error: "Score must be a non-negative number." });
  }
  const safePlayer = player.trim().slice(0, 32);
  const safeScore = Math.floor(score);
  const safeCompleted = Boolean(completed);
  try {
    const current = readHighScores();
    const entry = {
      id: nextId(current),
      player: safePlayer,
      score: safeScore,
      completed: safeCompleted,
      earned_at: new Date().toISOString()
    };
    const updated = [entry, ...current].sort(sortHighScores).slice(0, 10);
    persistHighScores(updated);
    res.status(201).json(entry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to save score right now." });
  }
});

const port = 5050;
app.listen(port, () => {
  console.log(`Solitaire API listening on http://localhost:${port}`);
});
