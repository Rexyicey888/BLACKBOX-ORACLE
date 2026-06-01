import { createHmac, timingSafeEqual } from "node:crypto";
import { hasDatabaseUrl, upsertVerifiedUser } from "../_db.js";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 8;
const verifyBuckets = new Map();

function getSecret() {
  const secret = process.env.APP_AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_AUTH_SECRET must be set to a 32+ character secret.");
  }
  return "blackbox-oracle-local-dev-secret";
}

function sign(payload) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function hashCode(code, salt) {
  return createHmac("sha256", getSecret()).update(`${salt}:${code}`).digest("base64url");
}

function parseChallenge(challenge) {
  const [payload, signature] = String(challenge ?? "").split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    throw new Error("Invalid or expired launch challenge.");
  }

  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] ?? "");
  return forwardedFor.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(key) {
  const now = Date.now();
  const bucket = verifyBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    verifyBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (bucket.count >= MAX_ATTEMPTS_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const code = String(req.body?.code ?? "").trim();
  const challenge = String(req.body?.challenge ?? "");
  const ip = getClientIp(req);

  if (!/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Enter the 6-digit launch code." });
    return;
  }

  if (!checkRateLimit(`ip:${ip}`) || !checkRateLimit(`challenge:${challenge.slice(0, 64)}`)) {
    res.status(429).json({ error: "Too many launch-code attempts. Request a new code later." });
    return;
  }

  try {
    const payload = parseChallenge(challenge);
    if (Date.now() > Number(payload.expiresAt)) {
      res.status(401).json({ error: "Launch code expired. Request a new code." });
      return;
    }

    const codeHash = hashCode(code, payload.salt);
    if (!safeEqual(codeHash, payload.codeHash)) {
      res.status(401).json({ error: "That launch code is not correct." });
      return;
    }

    if (hasDatabaseUrl()) {
      await upsertVerifiedUser(payload.email);
    }

    res.status(200).json({ email: payload.email });
  } catch (error) {
    res.status(401).json({
      error:
        error instanceof Error && error.message.includes("APP_AUTH_SECRET")
          ? error.message
          : "Could not verify launch code.",
    });
  }
}
