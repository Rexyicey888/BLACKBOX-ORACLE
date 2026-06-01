import { createHmac, randomInt } from "node:crypto";

const CODE_TTL_MS = 10 * 60 * 1000;
const FROM_EMAIL = process.env.AUTH_FROM_EMAIL ?? "BlackBox Oracle <onboarding@resend.dev>";
const ALLOW_DEMO_CODES = process.env.AUTH_DEMO_CODES === "true" || process.env.NODE_ENV !== "production";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const rateLimitBuckets = new Map();

function getSecret() {
  const secret = process.env.APP_AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_AUTH_SECRET must be set to a 32+ character secret.");
  }
  return "blackbox-oracle-local-dev-secret";
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function makeChallenge(params) {
  const payload = base64url(JSON.stringify(params));
  return `${payload}.${sign(payload)}`;
}

function hashCode(code, salt) {
  return createHmac("sha256", getSecret()).update(`${salt}:${code}`).digest("base64url");
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] ?? "");
  return forwardedFor.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
}

function checkRateLimit(key) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) return false;
  bucket.count += 1;
  return true;
}

async function sendEmailCode(email, code) {
  if (!process.env.RESEND_API_KEY) {
    if (ALLOW_DEMO_CODES) return false;
    throw new Error("Email delivery is not configured. Set RESEND_API_KEY before launch.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: "Your BlackBox Oracle launch code",
      text: `Your BlackBox Oracle launch code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your BlackBox Oracle launch code is <strong>${code}</strong>.</p><p>It expires in 10 minutes.</p>`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider failed: ${detail}`);
  }

  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!isEmail(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(`ip:${ip}`) || !checkRateLimit(`email:${email}`)) {
    res.status(429).json({ error: "Too many launch-code requests. Try again in a few minutes." });
    return;
  }

  try {
    const code = String(randomInt(100000, 999999));
    const salt = randomInt(100000000, 999999999).toString();
    const expiresAt = Date.now() + CODE_TTL_MS;
    const challenge = makeChallenge({
      email,
      expiresAt,
      salt,
      codeHash: hashCode(code, salt),
    });
    const sent = await sendEmailCode(email, code);
    res.status(200).json({
      challenge,
      sent,
      expiresAt,
      demoCode: !sent && ALLOW_DEMO_CODES ? code : undefined,
      message: sent
        ? "Launch code sent."
        : "Email provider is not configured. Demo code returned for local/hackathon testing.",
    });
  } catch (error) {
    res.status(502).json({
      error:
        error instanceof Error && error.message.includes("APP_AUTH_SECRET")
          ? error.message
          : "Could not send launch code.",
    });
  }
}
