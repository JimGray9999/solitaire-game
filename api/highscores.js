import fs from "node:fs";
import path from "node:path";

// Vercel serverless functions have a read-only filesystem except /tmp.
// We seed /tmp/highscores.json from the bundled seed file on cold start.
const TMP_PATH = "/tmp/highscores.json";
const SEED_PATH = path.resolve("server/highscores.json");

const readScores = () => {
  if (!fs.existsSync(TMP_PATH)) {
    try {
      const seed = fs.readFileSync(SEED_PATH, "utf8");
      fs.writeFileSync(TMP_PATH, seed, "utf8");
    } catch {
      fs.writeFileSync(TMP_PATH, "[]\n", "utf8");
    }
  }
  try {
    const raw = fs.readFileSync(TMP_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeScores = (entries) => {
  fs.writeFileSync(TMP_PATH, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
};

const sortScores = (a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  const completedDelta = Number(b.completed) - Number(a.completed);
  if (completedDelta !== 0) return completedDelta;
  return new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime();
};

const nextId = (scores) =>
  scores.reduce((max, c) => Math.max(max, c.id ?? 0), 0) + 1;

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    try {
      const list = readScores().sort(sortScores).slice(0, 10);
      return res.status(200).json(list);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Unable to load leaderboard." });
    }
  }

  if (req.method === "POST") {
    const { player, score, completed } = req.body ?? {};
    if (typeof player !== "string" || player.trim().length === 0) {
      return res.status(400).json({ error: "Player name is required." });
    }
    if (typeof score !== "number" || Number.isNaN(score) || score < 0) {
      return res.status(400).json({ error: "Score must be a non-negative number." });
    }
    try {
      const current = readScores();
      const entry = {
        id: nextId(current),
        player: player.trim().slice(0, 32),
        score: Math.floor(score),
        completed: Boolean(completed),
        earned_at: new Date().toISOString()
      };
      const updated = [entry, ...current].sort(sortScores).slice(0, 10);
      writeScores(updated);
      return res.status(201).json(entry);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Unable to save score." });
    }
  }

  return res.status(405).json({ error: "Method not allowed." });
}
