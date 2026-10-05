# YouTube API quota for comment tools

Every Google Cloud project that uses the YouTube Data API v3 gets **10,000 units a day** by default. Each call costs a fixed number of units. When the project runs out, every call fails with `quotaExceeded` until the reset at **midnight Pacific time**.

## Costs that matter for comments

| Operation | Method | Units |
|---|---|---|
| Post a reply or a comment | `comments.insert`, `commentThreads.insert` | **50** |
| Read up to 100 threads of a video or channel | `commentThreads.list` | 1 |
| Read up to 100 replies of a thread | `comments.list` | 1 |
| List up to 50 uploads of a channel | `playlistItems.list` | 1 |
| Look up a channel or videos | `channels.list`, `videos.list` | 1 |
| Search | `search.list` | **100** |

Source: [Google's quota cost table](https://developers.google.com/youtube/v3/determine_quota_cost). The constants live in [src/youtube.mjs](../src/youtube.mjs).

## What that means

- **One project can post about 200 replies a day in total** (10,000 ÷ 50), less whatever it spends on reading.
- The quota belongs to the **project, not the user**. A hosted tool shares it across all its users unless Google has granted an extension.
- Reading is cheap. A full check of a channel's last 20 videos is about 22 units.

```bash
yt-comments quota --replies 20 --videos 20 --refreshes 6
# Total per day 1,132 units = 11.3% of 10,000
```

## Reading cheaply

1. **Never use `search.list` to find a channel's videos.** Convert the channel id to its uploads playlist (`UC…` → `UU…`, or read `contentDetails.relatedPlaylists.uploads`) and page through `playlistItems.list` at 1 unit per 50 videos. That is a 100× saving.
2. **Ask for 100 items per page** (`maxResults=100`); the cost is per call, not per item.
3. **Take replies inline** with `part=snippet,replies` (up to five per thread, free) and only call `comments.list` for threads that have more.
4. **As the owner, read the channel in one stream:** `commentThreads.list?allThreadsRelatedToChannelId=…` (needs OAuth).
5. **Cache.** Comment counts do not change by the second. The free checker on replydial.com caches a channel for 24 hours.
6. **Check before you post.** A reply costs 50 units; a 1-unit read to confirm the comment still exists and has not been answered elsewhere is cheap insurance.

## Counting what you spend

The client in this repository adds up units as it goes:

```js
const yt = createClient({ apiKey });
await checkUnanswered(yt, "@RahulWagh");
console.log(yt.units); // 22
```

For real numbers, see **APIs & Services → YouTube Data API v3 → Quotas** in the Cloud Console.

## When you need more

Google raises the limit on request through the [YouTube API Services audit and quota extension form](https://support.google.com/youtube/contact/yt_api_form). It is a compliance review of the whole app, separate from OAuth verification. Expect to show:

- what the app does and each API method it calls
- screenshots or a video of every screen that displays YouTube data
- how users connect and disconnect, and how their data is deleted
- current usage and the number you are asking for, with the arithmetic

Ask for what you can justify. "40 replies a day per creator × 50 units × expected creators" is an answer; "as much as possible" is not.

Interactive calculator: [replydial.com/tools/quota-calculator](https://replydial.com/tools/quota-calculator)
