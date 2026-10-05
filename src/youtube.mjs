// Thin read-only client for the YouTube Data API v3: one fetch wrapper that counts quota units and
// turns API errors into something a person can act on. No dependencies; Node 20+ (global fetch).

const API = "https://www.googleapis.com/youtube/v3";

/** Quota cost of the methods this toolkit calls. Source: https://developers.google.com/youtube/v3/determine_quota_cost */
export const COST = {
  "channels.list": 1,
  "playlistItems.list": 1,
  "commentThreads.list": 1,
  "comments.list": 1,
  "videos.list": 1,
  "comments.insert": 50, // listed for the quota calculator; this toolkit never calls it
  "search.list": 100,
};

export class YouTubeError extends Error {
  constructor(message, { status, reason } = {}) {
    super(message);
    this.name = "YouTubeError";
    this.status = status;
    this.reason = reason;
  }
}

const HINTS = {
  quotaExceeded: "The project's daily quota (10,000 units by default) is used up. It resets at midnight Pacific time.",
  dailyLimitExceeded: "The project's daily quota is used up. It resets at midnight Pacific time.",
  commentsDisabled: "Comments are turned off on this video.",
  keyInvalid: "The API key is not valid. Create one in Google Cloud Console > APIs & Services > Credentials.",
  accessNotConfigured: "The YouTube Data API v3 is not enabled for this project. Enable it in Google Cloud Console > APIs & Services > Library.",
  forbidden: "The request was refused. Check that the API key is allowed to use the YouTube Data API v3.",
  videoNotFound: "No video with that id.",
  channelNotFound: "No channel matches that handle or id.",
};

/**
 * Creates a client for public reads with an API key. `client.units` is the quota spent so far.
 */
export function createClient({ apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new YouTubeError("Provide an API key (YOUTUBE_API_KEY).");
  const client = {
    units: 0,
    async call(method, params = {}) {
      const [resource] = method.split(".");
      const url = new URL(`${API}/${resource}`);
      for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      url.searchParams.set("key", apiKey);
      client.units += COST[method] ?? 1;
      const res = await fetchImpl(url, { headers: { accept: "application/json" } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = json?.error?.errors?.[0]?.reason ?? json?.error?.status ?? `http_${res.status}`;
        throw new YouTubeError(HINTS[reason] ?? json?.error?.message ?? `YouTube API error (${reason})`, { status: res.status, reason });
      }
      return json;
    },
  };
  return client;
}

/** Accepts @handle, a bare handle, a UC… channel id, or any youtube.com channel URL. */
export function parseChannel(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  let s = raw;
  try {
    if (/^https?:\/\//i.test(raw) || /^(www\.)?youtube\.com\//i.test(raw)) {
      const u = new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "channel" && parts[1]) return { id: parts[1] };
      if (parts[0]?.startsWith("@")) return { forHandle: parts[0] };
      if ((parts[0] === "c" || parts[0] === "user") && parts[1]) return { forUsername: parts[1] };
      return null;
    }
  } catch {
    return null;
  }
  if (/^UC[\w-]{22}$/.test(s)) return { id: s };
  if (!s.startsWith("@")) s = `@${s}`;
  return /^@[\w.-]{3,30}$/.test(s) ? { forHandle: s } : null;
}

/** Accepts a video id or any youtube.com / youtu.be video URL. */
export function parseVideo(input) {
  const raw = String(input ?? "").trim();
  if (/^[\w-]{11}$/.test(raw)) return raw;
  try {
    const u = new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`);
    if (u.hostname === "youtu.be") return u.pathname.slice(1, 12) || null;
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]{11})/);
    return m ? m[2] : null;
  } catch {
    return null;
  }
}

/** Looks a channel up and returns the fields the tools need. */
export async function getChannel(client, input) {
  const q = parseChannel(input);
  if (!q) throw new YouTubeError("Enter a channel handle like @RahulWagh, a UC… channel id, or a youtube.com channel link.", { reason: "channelNotFound" });
  const res = await client.call("channels.list", { part: "snippet,contentDetails,statistics", maxResults: 1, ...q });
  const c = res.items?.[0];
  if (!c) throw new YouTubeError(HINTS.channelNotFound, { status: 404, reason: "channelNotFound" });
  return {
    id: c.id,
    title: c.snippet.title,
    handle: c.snippet.customUrl ?? null,
    subscribers: c.statistics?.hiddenSubscriberCount ? null : Number(c.statistics?.subscriberCount ?? 0) || null,
    uploadsPlaylist: c.contentDetails.relatedPlaylists.uploads,
  };
}

/** The channel's most recent uploads, newest first (1 unit per 50 videos). */
export async function listUploads(client, uploadsPlaylist, limit = 20) {
  const videos = [];
  let pageToken;
  while (videos.length < limit) {
    const res = await client.call("playlistItems.list", { part: "snippet", playlistId: uploadsPlaylist, maxResults: Math.min(50, limit - videos.length), pageToken });
    for (const i of res.items ?? []) videos.push({ videoId: i.snippet.resourceId.videoId, title: i.snippet.title, publishedAt: i.snippet.publishedAt });
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }
  return videos;
}
