import { hasDatabaseUrl, upsertUserEmail } from "./_db.js";

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

  if (hasDatabaseUrl()) {
    await upsertUserEmail(email);
  }

  res.status(200).json({
    email,
    persisted: hasDatabaseUrl(),
  });
}
