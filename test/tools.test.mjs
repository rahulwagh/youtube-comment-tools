import assert from "node:assert/strict";
import { test } from "node:test";
import { COLUMNS, csvCell, csvLine, exportComments } from "../src/export.mjs";
import { estimateQuota } from "../src/quota.mjs";
import { checkUnanswered, classifyThread } from "../src/unanswered.mjs";
import { createClient, parseChannel, parseVideo, YouTubeError } from "../src/youtube.mjs";

const OWNER = "UC7p4oXcPbgk_yTSHK7QlkSg";
const comment = (id, author, text, extra = {}) => ({ id, snippet: { authorDisplayName: author, authorChannelId: { value: extra.channel ?? `UCviewer${id}` }, textOriginal: text, likeCount: 0, publishedAt: extra.at ?? "2026-09-01T10:00:00Z", videoId: "vid00000001" } });
const thread = (id, top, replies = [], total = replies.length) => ({ id, snippet: { totalReplyCount: total, topLevelComment: top }, replies: replies.length ? { comments: replies } : undefined });

/** A fake fetch that answers from a table keyed by resource name and records every call. */
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init = {}) => {
    const u = new URL(url);
    const resource = u.pathname.split("/").pop();
    calls.push({ resource, params: Object.fromEntries(u.searchParams), method: init.method ?? "GET" });
    const out = routes[resource]?.(u.searchParams, init);
    if (!out) return new Response(JSON.stringify({ error: { errors: [{ reason: "notFound" }] } }), { status: 404 });
    return new Response(JSON.stringify(out.body ?? out), { status: out.status ?? 200 });
  };
  impl.calls = calls;
  return impl;
}

test("parseChannel accepts handles, ids and links", () => {
  assert.deepEqual(parseChannel("@RahulWagh"), { forHandle: "@RahulWagh" });
  assert.deepEqual(parseChannel("RahulWagh"), { forHandle: "@RahulWagh" });
  assert.deepEqual(parseChannel(OWNER), { id: OWNER });
  assert.deepEqual(parseChannel("https://www.youtube.com/@RahulWagh/videos"), { forHandle: "@RahulWagh" });
  assert.deepEqual(parseChannel(`youtube.com/channel/${OWNER}`), { id: OWNER });
  assert.equal(parseChannel(""), null);
  assert.equal(parseChannel("https://example.com/nothing"), null);
});

test("parseVideo accepts ids and every common link shape", () => {
  for (const s of ["DQk8HOVlumI", "https://youtu.be/DQk8HOVlumI?t=4", "https://www.youtube.com/watch?v=DQk8HOVlumI&lc=abc", "https://www.youtube.com/shorts/DQk8HOVlumI"]) assert.equal(parseVideo(s), "DQk8HOVlumI");
  assert.equal(parseVideo("not a video"), null);
});

test("classifyThread: owner comments are skipped, owner replies count as answered", () => {
  assert.equal(classifyThread(thread("t1", comment("c1", "Owner", "pinned", { channel: OWNER })), OWNER), "own");
  assert.equal(classifyThread(thread("t2", comment("c2", "Ann", "how?"), [comment("r1", "Owner", "like this", { channel: OWNER })]), OWNER), "answered");
  assert.equal(classifyThread(thread("t3", comment("c3", "Bob", "why?"), [comment("r2", "Cid", "same")]), OWNER), "unanswered");
  assert.equal(classifyThread(thread("t4", comment("c4", "Dee", "help")), OWNER), "unanswered");
  // more replies exist than were returned inline: cannot be sure without fetching them
  assert.equal(classifyThread(thread("t5", comment("c5", "Eve", "?"), [comment("r3", "Fay", "+1")], 9), OWNER), "unknown");
});

test("checkUnanswered counts per video and reports quota", async () => {
  const fetchImpl = fakeFetch({
    channels: () => ({ items: [{ id: OWNER, snippet: { title: "Rahul Wagh", customUrl: "@rahulwagh" }, statistics: { subscriberCount: "104000" }, contentDetails: { relatedPlaylists: { uploads: "UU7p4oXcPbgk_yTSHK7QlkSg" } } }] }),
    playlistItems: () => ({ items: [{ snippet: { title: "Video A", publishedAt: "2026-09-01T00:00:00Z", resourceId: { videoId: "vidA0000001" } } }, { snippet: { title: "Video B", publishedAt: "2026-08-01T00:00:00Z", resourceId: { videoId: "vidB0000001" } } }] }),
    commentThreads: (q) =>
      q.get("videoId") === "vidA0000001"
        ? { items: [thread("t1", comment("c1", "Ann", "how do I run this?")), thread("t2", comment("c2", "Bob", "thanks"), [comment("r1", "Owner", "welcome", { channel: OWNER })]), thread("t3", comment("c3", "Owner", "pinned note", { channel: OWNER }))] }
        : { status: 403, body: { error: { errors: [{ reason: "commentsDisabled" }] } } },
  });
  const client = createClient({ apiKey: "k", fetchImpl });
  const r = await checkUnanswered(client, "@RahulWagh", { videos: 2 });
  assert.equal(r.unanswered, 1);
  assert.equal(r.scanned, 2);
  assert.equal(r.percent, 50);
  assert.equal(r.videos[0].comments[0].author, "Ann");
  assert.match(r.videos[0].comments[0].url, /lc=t1$/);
  assert.equal(r.videos[1].commentsDisabled, true);
  assert.equal(r.quotaUnits, 4); // channels + playlistItems + 2 × commentThreads
  assert.ok(fetchImpl.calls.every((c) => c.params.key === "k"));
});

test("checkUnanswered --deep finds an owner reply beyond the five inline ones", async () => {
  const fetchImpl = fakeFetch({
    channels: () => ({ items: [{ id: OWNER, snippet: { title: "T" }, statistics: {}, contentDetails: { relatedPlaylists: { uploads: "UUx" } } }] }),
    playlistItems: () => ({ items: [{ snippet: { title: "V", resourceId: { videoId: "vidA0000001" } } }] }),
    commentThreads: () => ({ items: [thread("t9", comment("c9", "Ann", "long thread"), [comment("r1", "Bob", "+1")], 8)] }),
    comments: () => ({ items: [comment("r7", "Owner", "answered late", { channel: OWNER })] }),
  });
  assert.equal((await checkUnanswered(createClient({ apiKey: "k", fetchImpl }), OWNER, { videos: 1 })).unanswered, 1);
  assert.equal((await checkUnanswered(createClient({ apiKey: "k", fetchImpl }), OWNER, { videos: 1, deep: true })).unanswered, 0);
});

test("csvCell quotes, escapes and defuses spreadsheet formulas", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell("@mention first"), "'@mention first");
  assert.equal(csvCell(null), "");
});

test("exportComments pages through threads and puts replies under their comment", async () => {
  let page = 0;
  const fetchImpl = fakeFetch({
    commentThreads: () => (page++ === 0 ? { nextPageToken: "p2", items: [thread("t1", comment("t1", "Ann", "first"), [comment("t1.b", "Bob", "later", { at: "2026-09-03T00:00:00Z" }), comment("t1.a", "Cid", "earlier", { at: "2026-09-02T00:00:00Z" })])] } : { items: [thread("t2", comment("t2", "Dee", "second"))] }),
  });
  const rows = [];
  for await (const r of exportComments(createClient({ apiKey: "k", fetchImpl }), "https://youtu.be/vid00000001")) rows.push(r);
  assert.deepEqual(rows.map((r) => [r.type, r.author, r.parent_id]), [["comment", "Ann", ""], ["reply", "Cid", "t1"], ["reply", "Bob", "t1"], ["comment", "Dee", ""]]);
  assert.equal(csvLine(rows[0]).split(",").length, COLUMNS.length);
  assert.equal(fetchImpl.calls[1].params.pageToken, "p2");
});

test("estimateQuota matches the documented costs", () => {
  const q = estimateQuota({ repliesPerDay: 20, videosPerRefresh: 20, refreshesPerDay: 6 });
  assert.equal(q.reading, 132);
  assert.equal(q.posting, 1000);
  assert.equal(q.total, 1132);
  assert.equal(q.percent, 11.3);
  assert.equal(q.maxRepliesPerDay, 197);
  assert.equal(estimateQuota({ repliesPerDay: 300 }).withinQuota, false);
  assert.equal(estimateQuota({ repliesPerDay: 0, refreshesPerDay: 0 }).maxRepliesPerDay, 200);
});

test("the client only ever reads", async () => {
  const fetchImpl = fakeFetch({
    channels: () => ({ items: [{ id: OWNER, snippet: { title: "T" }, statistics: {}, contentDetails: { relatedPlaylists: { uploads: "UUx" } } }] }),
    playlistItems: () => ({ items: [{ snippet: { title: "V", resourceId: { videoId: "vidA0000001" } } }] }),
    commentThreads: () => ({ items: [thread("t1", comment("c1", "Ann", "hello?"))] }),
  });
  const client = createClient({ apiKey: "k", fetchImpl });
  await checkUnanswered(client, OWNER, { videos: 1 });
  for await (const _ of exportComments(client, "vid00000001")) void _;
  assert.ok(fetchImpl.calls.length >= 4);
  assert.ok(fetchImpl.calls.every((c) => c.method === "GET"), "no write requests, ever");
});

test("API errors come back as readable messages", async () => {
  const fetchImpl = fakeFetch({ channels: () => ({ status: 403, body: { error: { errors: [{ reason: "quotaExceeded" }] } } }) });
  await assert.rejects(() => checkUnanswered(createClient({ apiKey: "k", fetchImpl }), "@RahulWagh"), (e) => e instanceof YouTubeError && e.reason === "quotaExceeded" && /resets at midnight Pacific/.test(e.message));
  assert.throws(() => createClient({}), /API key/);
});
