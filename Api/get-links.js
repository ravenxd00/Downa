const { spawn } = require("child_process");
const path = require("path");

const SCRIPT = path.join(process.cwd(), "getlinks.js");
const TIMEOUT_MS = Number(process.env.RESOLVER_TIMEOUT_MS || 120000);

function parseLinks(stdout) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.match(/^(.+?)(?: \[[^\]]+\]| \([^)]*\)\[[^\]]+\]) :: (https?:\/\/\S+)$/))
    .filter(Boolean)
    .map((match) => ({ label: match[1].trim(), url: match[2].trim() }));
}

function runResolver(tmdbId, season, episode) {
  return new Promise((resolve, reject) => {
    const args = [SCRIPT, String(tmdbId)];
    if (season !== undefined && episode !== undefined) {
      args.push(String(season), String(episode));
    }

    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: { ...process.env, CF_JAR_PATH: "/tmp/getlinks-cfjar.json" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Resolver timed out"));
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout) {
        reject(new Error(stderr.trim() || `Resolver exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function send(res, status, body) {
  res.status(status).setHeader("Access-Control-Allow-Origin", process.env.ALLOW_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
  res.json(body);
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).setHeader("Access-Control-Allow-Origin", process.env.ALLOW_ORIGIN || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
    res.end();
    return;
  }

  if (req.method !== "GET") {
    send(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  if (process.env.API_KEY) {
    const supplied = req.headers["x-api-key"] ||
      (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (supplied !== process.env.API_KEY) {
      send(res, 401, { ok: false, error: "Invalid or missing API key" });
      return;
    }
  }

  const tmdbId = req.query.tmdb_id || req.query.id;
  const season = req.query.season;
  const episode = req.query.episode;

  if (!tmdbId || !/^\d+$/.test(String(tmdbId))) {
    send(res, 400, { ok: false, error: "tmdb_id is required and must be numeric" });
    return;
  }
  if ((season && !episode) || (!season && episode) ||
      (season && !/^\d+$/.test(String(season))) ||
      (episode && !/^\d+$/.test(String(episode)))) {
    send(res, 400, { ok: false, error: "season and episode must be supplied together as numbers" });
    return;
  }

  try {
    const stdout = await runResolver(tmdbId, season, episode);
    const links = parseLinks(stdout);
    send(res, 200, {
      ok: true,
      tmdb_id: Number(tmdbId),
      ...(season ? { season: Number(season), episode: Number(episode) } : {}),
      links,
      count: links.length,
      ...(links.length === 0 ? { message: "No direct links were resolved" } : {}),
    });
  } catch (error) {
    send(res, 502, { ok: false, error: error.message });
  }
};
