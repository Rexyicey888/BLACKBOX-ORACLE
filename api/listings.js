import { ensureSchema, getSql, hasDatabaseUrl } from "./_db.js";

const MAX_TEXT_LENGTH = 1200;

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim().slice(0, MAX_TEXT_LENGTH);
}

function cleanOptionalText(value) {
  const cleaned = cleanText(value);
  return cleaned || null;
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
    owner: cleanOptionalText(listing.owner),
    title,
    category: cleanText(listing.category, "Private Data"),
    publicTease,
    priceLabel: cleanText(listing.priceLabel, "0.10 IP"),
    weirdness: cleanText(listing.weirdness, "A sealed answer that exists before anyone can see it."),
    vaultUuid: Number.isFinite(Number(listing.vaultUuid)) ? Number(listing.vaultUuid) : null,
    allocateTx: cleanOptionalText(listing.allocateTx),
    writeTx: cleanOptionalText(listing.writeTx),
    configureTx: cleanOptionalText(listing.configureTx),
    buyTx: cleanOptionalText(listing.buyTx),
    conditionContract: cleanOptionalText(listing.conditionContract),
    priceWei: cleanOptionalText(listing.priceWei),
    accessMode: cleanOptionalText(listing.accessMode),
    createdAt: listing.createdAt ? new Date(listing.createdAt) : new Date(),
  };
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");

  if (!hasDatabaseUrl()) {
    res.status(503).json({ error: "DATABASE_URL is not configured." });
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
      const id = cleanText(req.body?.id);
      const buyTx = cleanOptionalText(req.body?.buyTx);

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
