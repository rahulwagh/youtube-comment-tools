# Use cases and recipes

Each recipe uses only the tools in this repository and public data, unless it says otherwise.

## 1. The weekly sweep (creators)

See what is waiting before you sit down to answer.

```bash
yt-comments unanswered @yourchannel --list
```

You get the count, the videos ranked by how many comments are waiting, and a direct link to each comment (`…&lc=<id>` opens the video scrolled to it). Answer the top video first.

Want the same list on your phone with a drafted reply next to each comment? That is [ReplyDial](https://replydial.com).

## 2. Track responsiveness over time

Log one line a week and watch the trend.

```bash
yt-comments unanswered @yourchannel --json \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d);console.log([r.checkedAt.slice(0,10),r.unanswered,r.scanned,r.percent+"%"].join(","))})' \
  >> responsiveness.csv
```

Put it in cron or a scheduled GitHub Action. A check costs about 22 quota units.

## 3. Find the questions in a video's comments

```bash
yt-comments export https://youtu.be/VIDEO_ID --format json > comments.json
node -e '
  const rows = require("./comments.json");
  rows.filter(r => r.type === "comment" && /\?|how (do|can|to)|why |what is/i.test(r.text))
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 20)
      .forEach(r => console.log(r.likes, "|", r.text.replace(/\s+/g, " ").slice(0, 140), "|", r.url));
'
```

Sorting by likes surfaces the questions many viewers share, which are the ones worth a pinned answer.

## 4. Turn requests into your next videos

```bash
yt-comments export https://youtu.be/VIDEO_ID --out comments.csv
```

Open the CSV, filter `text` for phrases like *can you make*, *please cover*, *next video*, *tutorial on*. Paste the matches into your planning doc. Viewers have written your content calendar; it is sitting in the comments.

## 5. Measure a backlog before hiring help

Run the check with a bigger window to size the job:

```bash
yt-comments unanswered @yourchannel --videos 100 --deep
```

`--deep` makes the count exact on long threads. At roughly a minute per thoughtful reply, the number is also your time estimate.

## 6. Check a channel you want to work with (agencies, sponsors)

Responsiveness is a public signal of how a creator treats their audience.

```bash
yt-comments unanswered @theirchannel
```

Everything it reads is visible to anyone on youtube.com.

## 7. Archive a discussion

Before unlisting or deleting a video, keep the conversation:

```bash
yt-comments export VIDEO_ID --replies all --format json > VIDEO_ID-comments.json
```

## 8. Plan an app's quota before writing it

```bash
yt-comments quota --replies 40 --videos 50 --refreshes 12
```

If the answer is over 100%, change the design (cache more, read less often) or prepare the extension request. See [quota.md](quota.md).

## 9. From finding to answering

These tools tell you what is waiting. To answer, either open each comment link and reply on YouTube, or use [ReplyDial](https://replydial.com): the same unanswered list for your whole channel, a drafted reply next to each comment, and one tap to post the ones you approve.

## 10. Build your own tool on top

```js
import { createClient, checkUnanswered } from "youtube-comment-tools";

const yt = createClient({ apiKey: process.env.YOUTUBE_API_KEY });
const { videos } = await checkUnanswered(yt, "@yourchannel");

for (const v of videos) {
  for (const c of v.comments) {
    // send to Slack, a spreadsheet, your CRM…
  }
}
```

If you build something with it, open an issue and tell us; good examples get linked from the README.
