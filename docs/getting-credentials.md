# Getting an API key

The tools read public data, so all they need is an API key. It takes about two minutes. `yt-comments quota` needs nothing at all.

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create a project (or pick one).
2. **APIs & Services → Library**, search for **YouTube Data API v3**, press **Enable**.
3. **APIs & Services → Credentials → Create credentials → API key**.
4. Restrict it (recommended): **API restrictions → Restrict key → YouTube Data API v3**.
5. Give it to the tools:

```bash
export YOUTUBE_API_KEY=AIza...            # macOS / Linux
$env:YOUTUBE_API_KEY = "AIza..."          # Windows PowerShell
```

An API key can only read public data. It cannot post, delete or see anything private. Still, treat it as a secret: it spends your project's quota (10,000 units a day by default; a channel check costs about 22). Do not commit it; `.env` is in `.gitignore`.

## What an API key cannot see

- Comments held for review or marked as spam
- Private and members-only videos
- Anything that needs the channel owner's sign-in

Those need OAuth as the channel owner. This toolkit does not include an OAuth flow; if you are building one, [oauth-scope.md](oauth-scope.md) explains which scope you need and how Google's verification works. If you just want the result for your own channel, [ReplyDial](https://replydial.com) is already verified by Google for it.
