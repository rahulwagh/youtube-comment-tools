# Contributing

Thanks for looking. This is a small, focused toolkit; the bar for changes is "does it help someone work with YouTube comments, and does it stay simple".

## Run it

```bash
git clone https://github.com/rahulwagh/youtube-comment-tools.git
cd youtube-comment-tools
npm test                      # Node's built-in test runner; the API is faked, no key needed
node bin/yt-comments.mjs --help
```

Node 20 or newer. There is nothing to install: the project has no dependencies, and that is a feature.

## What fits

- Bug fixes, clearer error messages, better docs and examples
- Read-only tools that use public data (see the roadmap in the README)
- More accurate counting, cheaper quota use
- Tests for anything you touch

## What does not fit

- Anything that writes to YouTube: posting, replying, liking, deleting. This toolkit is read-only on purpose. See [docs/policies.md](docs/policies.md); pull requests that add a write path will be closed.
- Scraping youtube.com instead of using the API
- New runtime dependencies, unless there is a strong reason
- Anything that stores other people's comment data by default

## Style

- Plain ES modules, no build step. Match the code around your change.
- Every API call goes through `createClient().call()` so quota is counted.
- Errors a user can act on are `YouTubeError` with a plain-language message.
- Add or update a test in `test/tools.test.mjs`. Tests use a fake `fetch`; do not call the real API from tests.

## Pull requests

1. Open an issue first for anything larger than a small fix, so we agree on the shape.
2. Keep the pull request to one change.
3. `npm test` must pass.
4. Describe what you changed and how you checked it.

## Questions

Use [issues](https://github.com/rahulwagh/youtube-comment-tools/issues). For the hosted product, write to contact@replydial.com.
