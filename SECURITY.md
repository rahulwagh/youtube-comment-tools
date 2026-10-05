# Security

## Reporting a vulnerability

Please do not open a public issue for a security problem. Email **contact@replydial.com** with:

- what you found and where (file and line if you can)
- how to reproduce it
- what an attacker could do with it

You will get a reply within three working days. Once it is fixed you are welcome to be credited in the release notes.

## Scope

- The code in this repository.
- For the hosted service at replydial.com, use the same address.

## How this toolkit handles secrets

- The API key is read from an environment variable. Nothing is written to disk.
- The tools are read-only: they make GET requests for public data and never write to YouTube. There is no OAuth and no token to leak.
- CSV output defuses cells that start with `=`, `+`, `-` or `@` to prevent formula injection in spreadsheets.

## Good practice for your own keys

- Restrict API keys to the YouTube Data API v3 in the Cloud Console.
- Never commit `.env`; it is in `.gitignore`.
- If a key leaks, delete it in the Cloud Console and create a new one.
