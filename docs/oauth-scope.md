# Which OAuth scope posts a YouTube comment

*A guide for developers building their own app. This repository is read-only and contains no OAuth or posting code; the notes below come from getting [ReplyDial](https://replydial.com) verified.*

Short answer: `https://www.googleapis.com/auth/youtube.force-ssl`. There is no narrower, comment-only scope.

## The facts

| Method | Purpose | Scope listed in the reference |
|---|---|---|
| [`comments.insert`](https://developers.google.com/youtube/v3/docs/comments/insert) | Reply to an existing comment | `youtube.force-ssl` |
| [`commentThreads.insert`](https://developers.google.com/youtube/v3/docs/commentThreads/insert) | New top-level comment | `youtube.force-ssl` |

`youtube.readonly` cannot write. `youtube` and `youtubepartner` are broader, not narrower. So the same token could technically edit videos or delete comments. You cannot shrink the scope; you can shrink when you ask for it and what you do with it.

## Only the write needs OAuth

Public comments are readable with an API key:

```
GET https://www.googleapis.com/youtube/v3/commentThreads
    ?part=snippet,replies&videoId=VIDEO_ID&maxResults=100&key=API_KEY
```

That is all `yt-comments unanswered` and `yt-comments export` do, which is why this toolkit needs no OAuth at all. Keep the broad scope out of every flow that only reads.

One exception worth knowing: as the signed-in owner, `commentThreads.list?allThreadsRelatedToChannelId=<channel>` returns threads for the whole channel in one paginated call, far cheaper than going video by video.

## Ask for it late

Separate sign-in from YouTube access. Sign-in asks for `openid email profile`. The YouTube scope is requested only when the user decides to connect a channel:

```js
const params = new URLSearchParams({
  client_id,
  redirect_uri,
  response_type: "code",
  state,
  scope: "openid email profile https://www.googleapis.com/auth/youtube.force-ssl",
  access_type: "offline",          // you need a refresh token
  prompt: "consent",               // so Google returns one every time
  include_granted_scopes: "true",  // incremental authorization
});
```

- Without `prompt=consent`, a user who reconnects gets no refresh token and the app stops working for them when the access token expires an hour later.
- Show your own explanation screen before Google's. Reviewers look for it and fewer users cancel.
- For a command-line tool, use the loopback redirect (`http://127.0.0.1:<port>`) with PKCE.

## Sensitive, not restricted

YouTube scopes are in Google's **sensitive** category: you need OAuth app verification (branding, scope justification, a demo video). They are not **restricted** scopes, so the paid third-party security assessment that Gmail or full Drive access requires does not apply.

What was submitted for [ReplyDial](https://replydial.com), and verified two days after the demo video went in:

1. Home page, privacy policy and terms on the verified domain.
2. A scope justification listing the exact endpoints called (`commentThreads.list`, `comments.list`, `channels.list?mine=true`, `videos.list`, `comments.insert`) and the things never done (upload, edit or delete videos, manage playlists, moderate or delete comments).
3. An unlisted demo video: sign-in, the app's own explanation screen, Google's consent screen in English with the client ID readable in the address bar, the feature, the posted reply on youtube.com, and disconnect.

Say plainly why `youtube.readonly` is not enough. That one sentence answers the reviewer's first question.

## Give users a real off switch

```js
await fetch("https://oauth2.googleapis.com/revoke", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ token }),
});
```

Store refresh tokens encrypted, never send them to the browser, delete them on disconnect, and say so in the privacy policy. Users can also remove access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## Checklist

1. Read with an API key wherever the data is public.
2. Sign-in and YouTube consent are separate steps.
3. `access_type=offline`, `prompt=consent`, `include_granted_scopes=true` (web apps).
4. Scope justification = endpoints you call + things you never do.
5. Demo video: consent screen in English, client ID visible.
6. One user action per write; text sent unmodified ([policies.md](policies.md)).
7. A disconnect that calls the revoke endpoint.
8. Budget 50 quota units per posted comment ([quota.md](quota.md)).

Longer version with screenshots: [replydial.com/blog/youtube-api-oauth-scope-post-comments](https://replydial.com/blog/youtube-api-oauth-scope-post-comments)
