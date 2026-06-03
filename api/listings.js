import { ensureSchema, getSql, hasDatabaseUrl } from "./_db.js";

const MAX_TEXT_LENGTH = 1200;
const ALLOW_PUBLIC_WRITES = process.env.NODE_ENV !== "production" && process.env.LISTINGS_PUBLIC_WRITES === "true";
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_RE = /^0x[a-fA-F0-9]{64}$/;
const PRICE_WEI_RE = /^\d+$/;

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim().slice(0, MAX_TEXT_LENGTH);
}

function cleanOptionalText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
}

function cleanAddress(value, field) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) return null;
  if (!ADDRESS_RE.test(cleaned)) throw new Error(`${field} must be a valid EVM address.`);
  return cleaned;
}

function cleanHash(value, field) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) return null;
  if (!TX_RE.test(cleaned)) throw new Error(`${field} must be a valid transaction hash.`);
  return cleaned;
}

function cleanPriceWei(value) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) return null;
  if (!PRICE_WEI_RE.test(cleaned)) throw new Error("priceWei must be a base-10 wei value.");
  return cleaned;
}

function cleanAccessMode(value) {
  const cleaned = cleanOptionalText(value);
  if (!cleaned) return null;
  if (!["owner-only", "paid"].includes(cleaned)) throw new Error("accessMode must be owner-only or paid.");
  return cleaned;
}

function cleanVaultUuid(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanCreatedAt(value) {
  if (!value) return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("createdAt must be a valid date.");
  return date;
}

function toListing(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    publicTease: row.public_tease,
    priceLabel: row.price_label,
    weirdness: row.weirdness,
    owner: row.owner_address || undefined,
    vaultUuid: row.vault_uuid ? Number(row.vault_uuid) : undefined,
    allocateTx: row.allocate_tx || undefined,
    writeTx: row.write_tx || undefined,
    configureTx: row.configure_tx || undefined,
    buyTx: row.buy_tx || undefined,
    conditionContract: row.condition_contract || undefined,
    priceWei: row.price_wei || undefined,
    accessMode: row.access_mode || undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function validateListing(listing) {
  const id = cleanText(listing?.id);
  const title = cleanText(listing?.title);
  const publicTease = cleanText(listing?.publicTease);

  if (!id || !title || !publicTease) {
    throw new Error("Listing requires id, title, and public tease.");
  }

  return {
    id,
    owner: cleanAddress(listing.owner, "owner"),
    title,
    category: cleanText(listing.category, "Private Data"),
    publicTease,
    priceLabel: cleanText(listing.priceLabel, "0.10 IP"),
    weirdness: cleanText(listing.weirdness, "A sealed answer that exists before anyone can see it."),
    vaultUuid: cleanVaultUuid(listing.vaultUuid),
    allocateTx: cleanHash(listing.allocateTx, "allocateTx"),
    writeTx: cleanHash(listing.writeTx, "writeTx"),
    configureTx: cleanHash(listing.configureTx, "configureTx"),
    buyTx: cleanHash(listing.buyTx, "buyTx"),
    conditionContract: cleanAddress(listing.conditionContract, "conditionContract"),
    priceWei: cleanPriceWei(listing.priceWei),
    accessMode: cleanAccessMode(listing.accessMode),
    createdAt: cleanCreatedAt(listing.createdAt),
  };
}

function rejectPublicWrite(res) {
  res.status(403).json({
    error: "Public listing writes are disabled. Use local listings or enable signed/server-side publishing.",
  });
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");

  if (!hasDatabaseUrl()) {
    if (req.method === "GET") {
      res.status(200).json({ listings: [], persistence: "disabled" });
      return;
    }

    if (req.method === "POST") {
      if (!ALLOW_PUBLIC_WRITES) {
        rejectPublicWrite(res);
        return;
      }

      const listing = validateListing(req.body?.listing ?? req.body);
      res.status(200).json({ listing, persistence: "local-only" });
      return;
    }

    if (req.method === "PATCH") {
      if (!ALLOW_PUBLIC_WRITES) {
        rejectPublicWrite(res);
        return;
      }

      res.status(200).json({ listing: null, persistence: "local-only" });
      return;
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    await ensureSchema();
    const sql = getSql();

    if (req.method === "GET") {
      const rows = await sql`
        SELECT *
        FROM blackbox_listings
        ORDER BY created_at DESC
        LIMIT 50
      `;
      res.status(200).json({ listings: rows.map(toListing) });
      return;
    }

    if (req.method === "POST") {
      if (!ALLOW_PUBLIC_WRITES) {
        rejectPublicWrite(res);
        return;
      }

      const listing = validateListing(req.body?.listing ?? req.body);
      const rows = await sql`
        INSERT INTO blackbox_listings (
          id,
          owner_address,
          title,
          category,
          public_tease,
          price_label,
          weirdness,
          vault_uuid,
          allocate_tx,
          write_tx,
          configure_tx,
          buy_tx,
          condition_contract,
          price_wei,
          access_mode,
          created_at,
          updated_at
        )
        VALUES (
          ${listing.id},
          ${listing.owner},
          ${listing.title},
          ${listing.category},
          ${listing.publicTease},
          ${listing.priceLabel},
          ${listing.weirdness},
          ${listing.vaultUuid},
          ${listing.allocateTx},
          ${listing.writeTx},
          ${listing.configureTx},
          ${listing.buyTx},
          ${listing.conditionContract},
          ${listing.priceWei},
          ${listing.accessMode},
          ${listing.createdAt.toISOString()},
          NOW()
        )
        ON CONFLICT (id)
        DO UPDATE SET
          owner_address = EXCLUDED.owner_address,
          title = EXCLUDED.title,
          category = EXCLUDED.category,
          public_tease = EXCLUDED.public_tease,
          price_label = EXCLUDED.price_label,
          weirdness = EXCLUDED.weirdness,
          vault_uuid = EXCLUDED.vault_uuid,
          allocate_tx = EXCLUDED.allocate_tx,
          write_tx = EXCLUDED.write_tx,
          configure_tx = EXCLUDED.configure_tx,
          buy_tx = EXCLUDED.buy_tx,
          condition_contract = EXCLUDED.condition_contract,
          price_wei = EXCLUDED.price_wei,
          access_mode = EXCLUDED.access_mode,
          updated_at = NOW()
        RETURNING *
      `;
      res.status(200).json({ listing: toListing(rows[0]) });
      return;
    }

    if (req.method === "PATCH") {
      if (!ALLOW_PUBLIC_WRITES) {
        rejectPublicWrite(res);
        return;
      }

      const id = cleanText(req.body?.id);
      const buyTx = cleanHash(req.body?.buyTx, "buyTx");

      if (!id) {
        res.status(400).json({ error: "Listing id is required." });
        return;
      }

      const rows = await sql`
        UPDATE blackbox_listings
        SET buy_tx = COALESCE(${buyTx}, buy_tx), updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      if (!rows.length) {
        res.status(404).json({ error: "Listing not found." });
        return;
      }

      res.status(200).json({ listing: toListing(rows[0]) });
      return;
    }

    res.setHeader("Allow", "GET, POST, PATCH");
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Database request failed.",
    });
  }
}
