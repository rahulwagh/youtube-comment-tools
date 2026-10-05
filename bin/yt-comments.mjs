#!/usr/bin/env node
// yt-comments: command-line tools for YouTube comments. See README.md.

import { createWriteStream } from "node:fs";
import { parseArgs } from "node:util";
import { COLUMNS, csvLine, exportComments } from "../src/export.mjs";
import { estimateQuota } from "../src/quota.mjs";
import { checkUnanswered } from "../src/unanswered.mjs";
import { createClient, YouTubeError } from "../src/youtube.mjs";

const HELP = `yt-comments: tools for YouTube comments (YouTube Data API v3)

Usage
  yt-comments unanswered <channel>   Count comments with no reply from the channel
  yt-comments export <video>         Export a video's comments as CSV or JSON
  yt-comments quota                  Estimate daily API quota for a reply workflow

unanswered <@handle | channel id | channel url>
  --videos <n>      how many recent videos to scan (default 20)
  --deep            exact count: fetch all replies on long threads (1 extra unit each)
  --list            also print the unanswered comments
  --json            machine-readable output

export <video id | video url>
  --format <csv|json>         default csv
  --replies <none|inline|all> default inline (up to five per thread)
  --limit <n>                 stop after n top-level comments
  --out <file>                write to a file instead of stdout

quota
  --replies <n>     replies posted per day (default 20)
  --videos <n>      videos read per refresh (default 20)
  --refreshes <n>   refreshes per day (default 6)
  --quota <n>       the project's daily quota (default 10000)
  --json

Environment
  YOUTUBE_API_KEY   API key (public data only; these tools never write to YouTube)

To answer the comments you find, with drafts you approve: https://replydial.com
`;

const fmt = (n) => Number(n).toLocaleString("en-US");
const die = (msg, code = 1) => {
  console.error(`yt-comments: ${msg}`);
  process.exit(code);
};

function readClient() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) die("set YOUTUBE_API_KEY (Google Cloud Console > APIs & Services > Credentials > API key, with YouTube Data API v3 enabled).", 2);
  return createClient({ apiKey });
}

async function unanswered(argv) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { videos: { type: "string", default: "20" }, deep: { type: "boolean", default: false }, list: { type: "boolean", default: false }, json: { type: "boolean", default: false } } });
  if (!positionals[0]) die("unanswered needs a channel, for example: yt-comments unanswered @RahulWagh", 2);
  const r = await checkUnanswered(readClient(), positionals[0], { videos: Math.min(200, Math.max(1, Number(values.videos) || 20)), deep: values.deep });
  if (values.json) return void console.log(JSON.stringify(r, null, 2));

  console.log(`\n${r.channel.title}${r.channel.handle ? ` (${r.channel.handle})` : ""}${r.channel.subscribers ? ` · ${fmt(r.channel.subscribers)} subscribers` : ""}`);
  console.log(`${fmt(r.unanswered)} unanswered of ${fmt(r.scanned)} recent comments (${r.percent}%) on the last ${r.videosChecked} videos\n`);
  const rows = r.videos.filter((v) => v.unanswered > 0).sort((a, b) => b.unanswered - a.unanswered);
  for (const v of rows.slice(0, 10)) console.log(`  ${String(v.unanswered).padStart(4)}  ${v.title.slice(0, 70)}`);
  if (values.list) {
    for (const v of rows) {
      console.log(`\n${v.title}`);
      for (const c of v.comments) console.log(`  - ${c.author}: ${c.text.replace(/\s+/g, " ").slice(0, 160)}\n    ${c.url}`);
    }
  }
  console.log(`\nQuota used: ${r.quotaUnits} units.${r.unanswered ? " Answer them with drafts you approve: https://replydial.com" : ""}`);
}

async function exportCmd(argv) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: { format: { type: "string", default: "csv" }, replies: { type: "string", default: "inline" }, limit: { type: "string" }, out: { type: "string" } } });
  if (!positionals[0]) die("export needs a video, for example: yt-comments export https://youtu.be/DQk8HOVlumI --out comments.csv", 2);
  if (!["csv", "json"].includes(values.format)) die("--format must be csv or json", 2);
  if (!["none", "inline", "all"].includes(values.replies)) die("--replies must be none, inline or all", 2);
  const client = readClient();
  const out = values.out ? createWriteStream(values.out, { encoding: "utf8" }) : process.stdout;
  const write = (s) => new Promise((resolve) => (out.write(s) ? resolve() : out.once("drain", resolve)));
  let n = 0;
  if (values.format === "csv") await write(`﻿${COLUMNS.join(",")}\r\n`); // BOM so Excel reads UTF-8
  else await write("[");
  for await (const r of exportComments(client, positionals[0], { replies: values.replies, limit: values.limit ? Number(values.limit) : Infinity })) {
    await write(values.format === "csv" ? `${csvLine(r)}\r\n` : `${n ? "," : ""}\n  ${JSON.stringify(r)}`);
    n++;
  }
  if (values.format === "json") await write("\n]\n");
  if (values.out) await new Promise((resolve) => out.end(resolve));
  console.error(`Exported ${fmt(n)} rows${values.out ? ` to ${values.out}` : ""}. Quota used: ${client.units} units.`);
}

function quota(argv) {
  const { values } = parseArgs({ args: argv, options: { replies: { type: "string", default: "20" }, videos: { type: "string", default: "20" }, refreshes: { type: "string", default: "6" }, quota: { type: "string", default: "10000" }, json: { type: "boolean", default: false } } });
  const q = estimateQuota({ repliesPerDay: values.replies, videosPerRefresh: values.videos, refreshesPerDay: values.refreshes, dailyQuota: values.quota });
  if (values.json) return void console.log(JSON.stringify(q, null, 2));
  console.log(`\nReading comments   ${fmt(q.reading).padStart(7)} units  (${values.refreshes} refreshes × ${q.perRefresh})`);
  console.log(`Posting replies    ${fmt(q.posting).padStart(7)} units  (${values.replies} × 50)`);
  console.log(`Total per day      ${fmt(q.total).padStart(7)} units  = ${q.percent}% of ${fmt(q.dailyQuota)}${q.withinQuota ? "" : "  ← over quota"}`);
  console.log(`\nWith this reading pattern one project can post at most ${fmt(q.maxRepliesPerDay)} replies a day.\n`);
}

const [cmd, ...rest] = process.argv.slice(2);
const commands = { unanswered, export: exportCmd, quota };

if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
  console.log(HELP);
} else if (!commands[cmd]) {
  die(`unknown command "${cmd}". Run yt-comments --help`, 2);
} else {
  try {
    await commands[cmd](rest);
  } catch (e) {
    die(e instanceof YouTubeError ? e.message : (e?.message ?? String(e)));
  }
}
