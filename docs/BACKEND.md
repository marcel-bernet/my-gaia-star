# Our own catalogue server: the contract, and how to run it safely

Status 31 October 2026: **not built.** The site is ready for it: set one build variable and it stops calling the public services and calls this server instead. This page is the spec for whoever builds the server.

Read [ARCHITECTURE.md](ARCHITECTURE.md) first, and [DATA_ACCESS.md](DATA_ACCESS.md) for the public services this replaces.

## 1. The shape

```
 visitor's browser ──HTTPS──▶  API gateway (public, small)  ──private link──▶  database (supercomputer)
   static site,                 - fixed endpoints only                          - read-only user
   no secrets                   - validates every parameter                     - not reachable from
                                - owns the SQL, limits, timeouts                  the internet
                                - rate limit, CORS, no logs of positions
```

- **The browser never talks to the database.** It cannot hold a password: everything in the site's JavaScript is public. It talks to a small gateway on a web server, over HTTPS.
- **The gateway is the only thing that holds credentials.** It keeps them in its own environment or secret store, never in this repository and never in a `VITE_*` variable. (The build refuses `VITE_*` names that look like secrets: see `checkPublicEnv` in `src/csp.ts`.)
- **The link to the supercomputer is private:** an SSH tunnel, WireGuard/VPN, or mTLS, whatever the centre's rules allow. The database port is never opened to the internet.
- **The database account is read-only**, can see only the tables the endpoints need, and has a statement timeout. If the gateway is ever compromised, the most an attacker can do is read public catalogue data slowly.

## 2. Switching the site over

```bash
VITE_API_BASE=https://api.example.org npm run build
```

When `VITE_API_BASE` is set:

| Feature | Without it (today) | With it |
|---|---|---|
| Stars around the zenith (`starsAround` in `src/sky/gaia.ts`) | VizieR, then GAVO | `POST /v1/cone` |
| A star by its Gaia ID (`starById`, same file) | VizieR, then GAVO | `GET /v1/stars/{id}` |
| Literature check (`lookUp` in `src/sky/simbad.ts`) | SIMBAD, then the CfA mirror | `GET /v1/literature/{id}` |
| DR4 epoch astrometry (`fetchLive` in `src/dr4/source.ts`) | `VITE_DR4_PROXY` | `GET /v1/epoch-astrometry/{id}` |
| Naked-eye stars | bundled `public/naked-eye.json` | unchanged |
| Place names, map tiles | OpenStreetMap | unchanged (see DATA_ACCESS.md §2) |

Those four functions are the only places that switch. The client is `src/api/client.ts`. The contract is `src/api/contract.ts`: types and checks with no fetching, so a TypeScript server can import the same file.

There is deliberately **no automatic fallback** to the public services when the server is down. The site shows its usual "catalogue unavailable" message instead. Whoever runs the server may have told visitors that their position goes only there. If you want a fallback, add it in those four functions and say so in the privacy note.

The build also writes a Content-Security-Policy that allows `connect-src` to the API's origin (`vite.config.ts`). Nothing else has to change on the site.

## 3. The contract (v1)

Every endpoint is versioned. A breaking change goes to `/v2/` while `/v1/` keeps working until old builds are gone.

### `POST /v1/cone`

Request body (`Content-Type: application/json`):

```json
{ "ra": 349.876543, "dec": 41.5, "depth": "faint" }
```

- `ra` in [0, 360), `dec` in [−90, 90], degrees ICRS, at most 6 decimals.
- `depth` is one of `bright`, `faint`, `all`. **The server decides what each depth means** (radius, magnitude cut). Today's values are in `src/sky/gaia.ts`: `all` = 400″ with no cut, `faint` = 0.3° with G < 19, `bright` = G < 13 with a radius grown until ~400 stars (≤ 1.5°). The client never sends a radius, a magnitude or a limit, so it cannot ask for a huge query.

Response `200`, `Content-Type: application/json`:

```json
{ "stars": [ { "id": "4295806720", "ra": 44.99, "dec": 0.003, "g": 17.6, "bpRp": 1.2,
               "plx": 0.5, "plxErr": 0.1, "pmRa": 1.0, "pmDec": -2.0, "rv": null, "teff": null } ] }
```

- At most **400** stars, nearest first.
- **`id` is a string.** A 19-digit Gaia `source_id` does not survive as a JSON number. Answers with numeric ids are rejected.
- Units as the `Star` type in `src/sky/gaia.ts`: degrees, G mag, mas, mas/yr, km/s, K. Unknown values are `null`.

Why POST: the zenith *is* the visitor's position. Declination equals latitude, and right ascension plus the request time gives longitude. A JSON body stays out of URL access logs, proxy logs and caches. The client sends `cache: 'no-store'`.

### `GET /v1/stars/{id}`

`{id}` matches `^\d{1,19}$`. Response: `{ "star": Star }`, or `{ "star": null }` / `404` when no such source exists. Cacheable: `Cache-Control: public, max-age=31536000, immutable` per data release.

### `GET /v1/literature/{id}`

Response: `{ "known": false }` or `{ "known": true, "name": "HD 1", "papers": 77, "type": "SB?" }`. `name` ≤ 200 characters, `type` ≤ 40 or `null`. Cacheable for about a day: the literature grows.

### `GET /v1/epoch-astrometry/{id}`

A BINARY2 VOTable (`application/x-votable+xml`), the same format `proxy/worker.js` returns, or `404`. Immutable per release. The existing Cloudflare Worker, mounted under `/v1`, already satisfies this endpoint.

### Errors

Any non-2xx status (other than the 404s above) means "unavailable" to the site: `429` when rate-limited, `503` when the database is unreachable. Send a short plain-text or JSON body. **Never send stack traces, SQL or hostnames.**

## 4. Security checklist for the gateway

Already enforced on the browser side (`src/api/`, `src/csp.ts`, `vite.config.ts`):

- [x] Typed operations only. No SQL or ADQL ever leaves the browser.
- [x] Ids and positions validated before a request is built. Paths are built only from `^\d{1,19}$`.
- [x] Every answer validated (types, ranges, sizes, string lengths, control characters) before it reaches the page. A bad answer is treated as "unavailable".
- [x] Answers over 2 MB (10 MB for VOTables) refused. 20 s timeout. Redirects refused.
- [x] No cookies, no HTTP auth, no `Referer` sent to the API (`credentials: 'omit'`, `referrerPolicy: 'no-referrer'`).
- [x] Content-Security-Policy: scripts only from the site itself; network calls only to the listed services and the API.
- [x] The build fails if `VITE_API_BASE` is not `https://` (localhost excepted), contains credentials or a query string, or if any `VITE_*` name looks like a secret.

To build into the gateway:

- [ ] **Parameterised queries only.** Never put a request value into SQL by string concatenation, even after validation. Validate again on the server; never trust the client's checks.
- [ ] **Fixed limits server-side:** `LIMIT 400`, a maximum cone radius per depth, and a database statement timeout of a few seconds.
- [ ] **Read-only database role** with `SELECT` on the needed tables only. Use a separate account from any human or batch-job account on the supercomputer.
- [ ] **Credentials** come from the environment or a secret manager. Rotate them, and never commit them (`.env` files are git-ignored in this repository; keep the server's the same).
- [ ] **CORS:** `Access-Control-Allow-Origin` set to the site's exact origin, not `*`. Allow `GET, POST, OPTIONS` and the header `Content-Type`. Set `Access-Control-Max-Age` so the preflight for `POST /v1/cone` is cached. Never allow credentials.
- [ ] **Rate limiting** per IP (in memory, not logged), e.g. 10 requests/s burst and 60/min. Add a global concurrency cap so the supercomputer queue can't be flooded. Answer `429` with `Retry-After`.
- [ ] **Request limits:** cone bodies ≤ 1 kB. Reject anything that is not `application/json`. Reject unknown fields.
- [ ] **TLS** only, with HSTS. Response headers: `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`, `Referrer-Policy: no-referrer`.
- [ ] **No detail in errors.** Log exceptions on the server without request bodies; send the client a status code and a short message.
- [ ] **Dependencies** pinned and updated. Run the gateway as an unprivileged user (or a container) with only the network access it needs: inbound HTTPS, outbound to the private link.

## 5. Privacy

What the site sends today, and with the server:

| Data | Who receives it | Personal? |
|---|---|---|
| Zenith position (ra, dec) | CDS/GAVO today; the gateway later | **Yes:** with the request time, it is the visitor's location to within a few hundred metres |
| A Gaia id (star lookup, literature, DR4) | CDS today; the gateway later | Weakly: the star near someone's zenith at some time |
| Place name typed, or map tap coordinates | OpenStreetMap Nominatim (unchanged) | Yes |
| The page's address (holds lat, lon and time) | Nobody: other sites get only the origin as `Referer`, and the API gets none | — |
| The time of the search, language, place name | Never sent to the catalogue server | — |

What the client does: it sends only position and depth, with no time, place, language, cookies, ids or fingerprinting headers beyond what any browser sends.

What the operator must do (put this in a short privacy note on the site when the server goes live):

- [ ] **Don't log cone bodies.** Access logs may keep method, path, status and duration. For `/v1/cone` the path carries nothing, which is why it is a POST.
- [ ] **Don't keep IPs** beyond the rate limiter's memory window. If logs must contain them, truncate them (IPv4 /24, IPv6 /48) and keep logs ≤ 7 days.
- [ ] **No analytics or third-party scripts** on the API or the site. The CSP blocks third-party scripts on the site anyway.
- [ ] **No caching of cone answers** anywhere (`Cache-Control: no-store` on `/v1/cone`). Do cache `/v1/stars`, `/v1/literature` and `/v1/epoch-astrometry`.
- [ ] If a CDN or reverse proxy sits in front, check that *its* logs follow the same rules. Many keep full URLs and IPs by default.
- [ ] Under the GDPR (the server would be in the EU), position data is personal data. Keeping no logs of it is the simplest compliance. Note the processing in the privacy note, and check with the hosting institution's data-protection officer.

## 6. Testing before switching

- `npx vitest run src/api` checks the client and the contract against a stubbed server.
- For a real server, point a local build at it: `VITE_API_BASE=http://localhost:8080 npm run dev`. `http://` is accepted for localhost only. Then click through a search, a star, *Find a star by its Gaia number*, and the DR4 section.
- A conformance test for the server can reuse `parseCone`, `parseStarById` and `parseLiteratureResponse` from `src/api/contract.ts` on its real answers.
