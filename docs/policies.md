# Policies: what a comment tool may automate

Two documents decide this. One binds the tool, one binds the channel.

## For the tool: YouTube API Services Developer Policies

Every app that writes to YouTube through the API agrees to the [Developer Policies](https://developers.google.com/youtube/terms/developer-policies). Three clauses shape a comment tool:

> "API Clients that perform write operations may suggest parameter or property values, but users must have final control over the data that will be published to YouTube Applications." (III.C.3)

> "API Clients must clearly identify any actions that they take to insert, share, update, or delete data or content on the authorizing user's behalf. In addition, the user must expressly consent to those actions prior to their actual execution." (III.E.3.4)

> "You must not automate or trigger views, uploads, comments, likes, dislikes, or other actions without the user's prior specific and express consent." (III.I.2)

Read together:

| The tool may | The tool may not |
|---|---|
| Find, filter, sort and count comments | Post a reply nobody has read |
| Suggest or draft a reply | Change the text the user approved (no appended links, signatures or "sent via") |
| Post a reply the user confirmed | Treat one switch flipped last month as consent for every future reply |

## For the channel: spam, deceptive practices and scams

Whatever tool is used, the channel answers for what is posted under its name. YouTube's [spam policy](https://support.google.com/youtube/answer/2801973) covers comment spam: repetitive, untargeted content. Identical or near-identical replies under hundreds of comments look exactly like that, and enforcement lands on the channel.

## How this repository applies them

It stays on the safe side of the line by construction: **the toolkit is read-only.** It finds, counts and exports. It contains no code that posts, replies, likes or deletes, and the test suite asserts that every request it makes is a GET ([test/tools.test.mjs](../test/tools.test.mjs)).

Posting is where the policies above apply, and doing it properly takes more than an API call: Google's OAuth verification for the `youtube.force-ssl` scope, a consent step per reply, pacing, per-day and per-video caps, duplicate detection, and a quota extension once more than a few people use it. That is the part [ReplyDial](https://replydial.com) exists for.

## Automate the rest

Everything before the Post button is fair game and worth automating:

- **Moderation** in YouTube Studio: hold links, blocked words, hidden users.
- **Finding the backlog:** `yt-comments unanswered`.
- **Mining questions and requests:** `yt-comments export` plus a filter.
- **Drafting:** suggestions the user edits and approves.

That split is how [ReplyDial](https://replydial.com) is built: it finds and drafts automatically, and posts only on a click, paced, with per-day and per-video caps.

Further reading:

- [Automate YouTube comments: what is allowed, what gets channels in trouble](https://replydial.com/blog/automate-youtube-comments-what-is-allowed)
- [Is it allowed to reply to YouTube comments with AI?](https://replydial.com/blog/is-ai-reply-to-youtube-comments-allowed)

*This is a practitioner's reading of public policies, not legal advice. The policy pages are the authority and they change; check them.*
