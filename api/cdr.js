const DEFAULT_CDR_API_UPSTREAM = "http://172.192.41.96:1317";
const ALLOWED_CDR_PATHS = [
  /^dkg\/latest_active$/,
  /^dkg\/dkg_network$/,
  /^dkg\/global_public_key$/,
  /^dkg\/registrations$/,
  /^dkg\/registrations\/verified$/,
  /^dkg\/cdr_partials$/,
];

function getPath(req) {
  const path = req.query?.path;
  const rawPath = Array.isArray(path) ? path.join("/") : typeof path === "string" ? path : "";
  return rawPath.replace(/^\/+/, "").replace(/\/+$/, "");
}

function isAllowedPath(path) {
  if (!path || path.includes("..") || path.includes("://")) return false;
  return ALLOWED_CDR_PATHS.some((pattern) => pattern.test(path));
}

function copyRequestHeaders(headers) {
  const nextHeaders = {};
  const accept = headers.accept;
  if (typeof accept === "string") nextHeaders.accept = accept;
  if (Array.isArray(accept)) nextHeaders.accept = accept.join(", ");
  return nextHeaders;
}

function copyResponseHeaders(source, res) {
  const contentType = source.headers.get("content-type");
  if (contentType) res.setHeader("content-type", contentType);
  res.setHeader("cache-control", "no-store");
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET,HEAD,OPTIONS");
    res.status(204).end();
    return;
  }

  if (!["GET", "HEAD"].includes(req.method ?? "")) {
    res.setHeader("Allow", "GET,HEAD,OPTIONS");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const upstream = (process.env.CDR_API_UPSTREAM ?? DEFAULT_CDR_API_UPSTREAM).replace(/\/+$/, "");
  const requestPath = getPath(req);
  if (!isAllowedPath(requestPath)) {
    res.status(404).json({ error: "CDR API path not allowed" });
    return;
  }

  const query = new URL(req.url ?? "/api/cdr", "https://blackbox.local").searchParams;
  query.delete("path");
  const queryString = query.toString();
  const url = `${upstream}/${requestPath}${queryString ? `?${queryString}` : ""}`;

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: copyRequestHeaders(req.headers),
    });

    copyResponseHeaders(response, res);
    res.status(response.status);

    if (req.method === "HEAD" || response.status === 204) {
      res.end();
      return;
    }

    const body = Buffer.from(await response.arrayBuffer());
    res.send(body);
  } catch (error) {
    res.status(502).json({
      error: "CDR API proxy failed",
      message: error instanceof Error ? error.message : "Unknown proxy error",
    });
  }
}
