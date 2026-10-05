// Export every comment on a video (top-level comments and, optionally, all replies) as rows.
// Public data only: works with an API key. 1 quota unit per 100 threads, plus 1 per thread whose
// replies are fetched in full.

import { parseVideo, YouTubeError } from "./youtube.mjs";

export const COLUMNS = ["comment_id", "parent_id", "type", "author", "author_channel_id", "text", "likes", "reply_count", "published_at", "updated_at", "url"];

function row(videoId, c, { parentId = "", replyCount = "" } = {}) {
  const s = c.snippet;
  return {
    comment_id: c.id,
    parent_id: parentId,
    type: parentId ? "reply" : "comment",
    author: s.authorDisplayName ?? "",
    author_channel_id: s.authorChannelId?.value ?? "",
    text: s.textOriginal ?? s.textDisplay ?? "",
    likes: s.likeCount ?? 0,
    reply_count: replyCount,
    published_at: s.publishedAt ?? "",
    updated_at: s.updatedAt ?? "",
    url: `https://www.youtube.com/watch?v=${videoId}&lc=${c.id}`,
  };
}

/**
 * Yields comment rows for a video, newest first. `replies`: "none", "inline" (up to five per
 * thread, free) or "all" (complete, 1 extra unit per thread with more than five replies).
 */
export async function* exportComments(client, videoInput, { replies = "inline", limit = Infinity, order = "time" } = {}) {
  const videoId = parseVideo(videoInput);
  if (!videoId) throw new YouTubeError("Enter a video id or a youtube.com / youtu.be link.", { reason: "videoNotFound" });
  let pageToken;
  let sent = 0;
  do {
    const res = await client.call("commentThreads.list", { part: replies === "none" ? "snippet" : "snippet,replies", videoId, maxResults: 100, textFormat: "plainText", order, pageToken });
    for (const t of res.items ?? []) {
      if (sent >= limit) return;
      yield row(videoId, t.snippet.topLevelComment, { replyCount: t.snippet.totalReplyCount ?? 0 });
      sent++;
      if (replies === "none") continue;
      const inline = t.replies?.comments ?? [];
      const list = replies === "all" && (t.snippet.totalReplyCount ?? 0) > inline.length ? await allReplies(client, t.id) : inline;
      // the API returns replies newest first; a spreadsheet reads better oldest first
      for (const r of [...list].sort((a, b) => String(a.snippet.publishedAt).localeCompare(String(b.snippet.publishedAt)))) yield row(videoId, r, { parentId: t.id });
    }
    pageToken = res.nextPageToken;
  } while (pageToken && sent < limit);
}

async function allReplies(client, parentId) {
  const out = [];
  let pageToken;
  do {
    const res = await client.call("comments.list", { part: "snippet", parentId, maxResults: 100, textFormat: "plainText", pageToken });
    out.push(...(res.items ?? []));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return out;
}

/** RFC 4180 CSV cell. Cells starting with = + - @ are prefixed with ' so spreadsheets do not run them as formulas. */
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvLine = (r, columns = COLUMNS) => columns.map((c) => csvCell(r[c])).join(",");
