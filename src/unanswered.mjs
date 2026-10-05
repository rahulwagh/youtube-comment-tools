// How many recent comments on a channel have no reply from the channel itself.
// Public data only: works with an API key, no sign-in. About (videos + 2) quota units per check.

import { getChannel, listUploads, YouTubeError } from "./youtube.mjs";

/**
 * A thread counts as unanswered when none of its replies were written by the channel owner.
 * Comments written by the owner are not questions to answer and are skipped.
 *
 * Known limit: commentThreads.list returns at most five replies inline. On a thread with more
 * than five replies where the owner answered late, the owner's reply may not be in those five,
 * and the thread is counted as unanswered. Use `deep: true` to fetch all replies for such
 * threads (1 extra unit each) and get an exact count.
 */
export function classifyThread(thread, channelId) {
  const top = thread.snippet.topLevelComment.snippet;
  if (top.authorChannelId?.value === channelId) return "own";
  const replies = thread.replies?.comments ?? [];
  if (replies.some((r) => r.snippet.authorChannelId?.value === channelId)) return "answered";
  return thread.snippet.totalReplyCount > replies.length ? "unknown" : "unanswered";
}

export async function checkUnanswered(client, channelInput, { videos = 20, perVideo = 100, deep = false } = {}) {
  const channel = await getChannel(client, channelInput);
  const uploads = await listUploads(client, channel.uploadsPlaylist, videos);
  const results = [];

  for (const v of uploads) {
    const row = { ...v, scanned: 0, unanswered: 0, commentsDisabled: false, comments: [] };
    try {
      const res = await client.call("commentThreads.list", { part: "snippet,replies", videoId: v.videoId, maxResults: Math.min(100, perVideo), textFormat: "plainText", order: "time" });
      for (const t of res.items ?? []) {
        let kind = classifyThread(t, channel.id);
        if (kind === "own") continue;
        if (kind === "unknown") kind = deep && (await ownerRepliedDeep(client, t.id, channel.id)) ? "answered" : "unanswered";
        row.scanned++;
        if (kind !== "unanswered") continue;
        row.unanswered++;
        const top = t.snippet.topLevelComment.snippet;
        row.comments.push({ id: t.id, author: top.authorDisplayName, text: top.textOriginal ?? top.textDisplay ?? "", likes: top.likeCount ?? 0, publishedAt: top.publishedAt, url: `https://www.youtube.com/watch?v=${v.videoId}&lc=${t.id}` });
      }
    } catch (e) {
      if (e instanceof YouTubeError && (e.reason === "commentsDisabled" || e.status === 403 || e.status === 404)) row.commentsDisabled = true;
      else throw e;
    }
    results.push(row);
  }

  const scanned = results.reduce((n, r) => n + r.scanned, 0);
  const unanswered = results.reduce((n, r) => n + r.unanswered, 0);
  return {
    channel: { id: channel.id, title: channel.title, handle: channel.handle, subscribers: channel.subscribers },
    videosChecked: results.length,
    scanned,
    unanswered,
    percent: scanned ? Math.round((unanswered / scanned) * 100) : 0,
    videos: results,
    quotaUnits: client.units,
    checkedAt: new Date().toISOString(),
  };
}

/** All replies of one thread (comments.list, 1 unit per 100): did the owner answer anywhere in it? */
async function ownerRepliedDeep(client, parentId, channelId) {
  let pageToken;
  do {
    const res = await client.call("comments.list", { part: "snippet", parentId, maxResults: 100, pageToken });
    if ((res.items ?? []).some((r) => r.snippet.authorChannelId?.value === channelId)) return true;
    pageToken = res.nextPageToken;
  } while (pageToken);
  return false;
}
