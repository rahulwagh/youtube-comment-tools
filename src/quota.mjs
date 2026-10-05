// What a day of reading and replying costs against the YouTube Data API quota.
// Pure functions: no network, no key.

import { COST } from "./youtube.mjs";

export const DEFAULT_DAILY_QUOTA = 10_000;

/**
 * @param {object} plan
 * @param {number} plan.repliesPerDay      replies posted with comments.insert (50 units each)
 * @param {number} plan.videosPerRefresh   videos whose comments are read on each refresh (1 unit per 100 threads)
 * @param {number} plan.refreshesPerDay    how often the inbox is refreshed
 * @param {number} [plan.searchesPerDay]   search.list calls (100 units each; avoid them)
 * @param {number} [plan.dailyQuota]       the project's quota, 10,000 unless Google raised it
 */
export function estimateQuota({ repliesPerDay = 0, videosPerRefresh = 20, refreshesPerDay = 1, searchesPerDay = 0, dailyQuota = DEFAULT_DAILY_QUOTA } = {}) {
  const n = (x) => Math.max(0, Math.floor(Number(x) || 0));
  const perRefresh = n(videosPerRefresh) * COST["commentThreads.list"] + COST["channels.list"] + COST["playlistItems.list"];
  const reading = n(refreshesPerDay) * perRefresh;
  const posting = n(repliesPerDay) * COST["comments.insert"];
  const searching = n(searchesPerDay) * COST["search.list"];
  const total = reading + posting + searching;
  const quota = n(dailyQuota) || DEFAULT_DAILY_QUOTA;
  return {
    reading,
    posting,
    searching,
    total,
    dailyQuota: quota,
    percent: Math.round((total / quota) * 1000) / 10,
    withinQuota: total <= quota,
    /** The most replies this project can post in a day with this reading pattern. */
    maxRepliesPerDay: Math.max(0, Math.floor((quota - reading - searching) / COST["comments.insert"])),
    perRefresh,
  };
}
