# getlinks API

This is a thin HTTP wrapper around the supplied `getlinks.js` script. It does not change the resolver logic; it exposes the command-line output as JSON for a frontend such as Lovable.

## Run locally

```bash
npm start
```

Health check:

```text
http://localhost:3000/health
```

Movie request:

```text
http://localhost:3000/api/get-links?tmdb_id=1423191
```

TV episode request:

```text
http://localhost:3000/api/get-links?tmdb_id=1399&season=1&episode=1
```

Example response:

```json
{
  "ok": true,
  "tmdb_id": 1423191,
  "links": [
    { "label": "1080p", "url": "https://example.com/file" }
  ],
  "count": 1
}
```

## Deploy to Vercel

This project includes a Vercel Function at `api/get-links.js`. Deploy the folder with the Vercel CLI:

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

After deployment, use:

```text
https://YOUR-PROJECT.vercel.app/api/get-links?tmdb_id=1423191
```

Set `API_KEY` and `ALLOW_ORIGIN` in the Vercel project environment variables. The included `vercel.json` includes `getlinks.js` in the function bundle and sets a five-minute maximum duration.

## Optional environment variables

- `PORT`: listening port; hosting platforms usually set this automatically.
- `API_KEY`: if set, clients must send `X-API-Key: <value>` or `Authorization: Bearer <value>`.
- `ALLOW_ORIGIN`: set this to your Lovable site origin instead of `*` for tighter CORS control.
- `RESOLVER_TIMEOUT_MS`: request timeout, default `120000`.

## Important hosting notes

The Vercel version writes its temporary clearance cache to `/tmp`, which is writable but ephemeral. It can disappear when Vercel replaces or moves the function instance, so the first request on a fresh instance may be slower or may be challenged again. Vercel also terminates a function after its configured duration. If the third-party requests become slow or unreliable, use a persistent Node host instead.

Only expose this endpoint for content and sources you are authorized to access. The resolver depends on third-party websites and may stop working when those sites change or block automated requests.
