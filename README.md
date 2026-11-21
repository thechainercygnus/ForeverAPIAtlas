# Forever API Atlas

A buildless, snapshot-driven Lua environment reference. There is no live game connection and no inferred function signature database. Topic filters identify research leads by name only. This is deliberately not an OpenAPI document: the source describes Lua symbols, not HTTP operations.

## Refresh the catalog

From the atlas checkout, with ForeverAPIExplorer beside it:

```powershell
python scripts/import_dump.py ../ForeverAPIExplorer/data/ForeverAPIExplorer-20261116-202559.lua dist/catalog.json
```

The importer parses both SavedVariables globals without executing Lua, checks all four discovery record counts and the character status/return counts against captured statistics, and writes catalog.json plus character.json. Environment-only imports write null character evidence to prevent stale results. The character view shows observed arguments and typed returns, and distinguishes learned profession indices from broader skill-line metadata. It rejects unsupported syntax. Keep source dumps outside this site's checkout. The catalog contains all captured values, which can include addon or character state, and the repository is public, so everything in `dist/` is public too.

Preview from this directory with `python -m http.server 8080 --directory dist` and visit localhost:8080. No install or build step is required.

## Host it at atlas.durishlabs.com

The public site runs as a static nginx container on the VPS, behind the Caddy instance that already serves `durishlabs.com` and `planner.durishlabs.com`. Caddy terminates HTTPS; the container sends the atlas's Content-Security-Policy and security headers, compresses responses and sets cache headers (see `nginx.conf` and `security-headers.conf`). Don't add Caddy directives that replace those headers.

### Images

Images are published only for releases, with SemVer tags and `latest`, the same scheme as the Character Planner. `.github/workflows/publish-image.yaml` builds and smoke-tests the image on every pull request and push to `main`, but publishes nothing for those. To release, tag the merge commit on `main` with a stable `vX.Y.Z` and push the tag:

```sh
git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
```

That run publishes `ghcr.io/thechainercygnus/foreverapiatlas` as `1.0.0`, `1.0` and `latest`, and the run summary lists them. Deploy `latest`; to hold a version or roll back, use its `X.Y.Z` tag. Pre-release and other tags are rejected. Use a new version for every release; a tag isn't reused.

The GHCR package is private by default. Check under **Packages** on GitHub that it's private (or make it public if you prefer) and that the account the VPS uses can read it.

### Deploy behind Caddy

On the VPS, as the OS user that runs Docker Compose, log in to GHCR with a classic personal access token that has `read:packages`. If this user already logged in for the portfolio with an account that can read this package too, skip this.

```bash
read -rsp 'GHCR read token: ' ghcr_token
printf '\n'
printf '%s' "$ghcr_token" | docker login ghcr.io --username YOUR_GITHUB_USERNAME --password-stdin
unset ghcr_token
```

#### Caddy in Docker

1. Copy `compose.yaml` to its own directory on the VPS (not the portfolio's). In a `.env` file beside it, set `ATLAS_IMAGE=ghcr.io/thechainercygnus/foreverapiatlas:latest`. If Caddy's Docker network isn't named `caddy`, also set `CADDY_NETWORK`.
2. Run `docker compose up -d --pull always` in that directory. The container joins Caddy's network as `durishlabs-atlas` and publishes no host port.
3. Add this block to the Caddyfile, then validate and reload Caddy as you usually do:

   ```caddyfile
   atlas.durishlabs.com {
       reverse_proxy durishlabs-atlas:80
   }
   ```

#### Caddy on the VPS host

Instead of the Compose steps, run the container on a loopback port (8089 here; pick another if it's taken, such as by the portfolio's 8088):

```sh
ATLAS_IMAGE=ghcr.io/thechainercygnus/foreverapiatlas:latest
docker pull "$ATLAS_IMAGE"
docker run -d --restart unless-stopped --name durishlabs-atlas -p 127.0.0.1:8089:80 "$ATLAS_IMAGE"
```

and use `reverse_proxy 127.0.0.1:8089` in the `atlas.durishlabs.com` block.

#### DNS

Add an `A` record for `atlas` pointing at the VPS's IPv4 address (an `AAAA` record only if Caddy also serves over IPv6). If `planner.durishlabs.com` uses a `CNAME` to the apex instead, do the same for `atlas`. Caddy gets the certificate automatically once the name resolves.

#### Check it

```sh
curl -sI https://atlas.durishlabs.com/ | grep -iE '^(HTTP|content-security-policy|strict-transport-security)'
curl -sI -H 'Accept-Encoding: gzip' https://atlas.durishlabs.com/catalog.json | grep -iE '^(HTTP|content-encoding|cache-control)'
curl -s -o /dev/null -w '%{http_code}\n' https://atlas.durishlabs.com/no-such-page
```

Expect `200` with the CSP and HSTS headers, the catalog with `content-encoding: gzip` and `cache-control: no-cache`, and `404` for the missing page. Then open the site and click through the symbol explorer, Character evidence and API coverage; the browser console should show no errors.

### Update or roll back

To update to a new release, repeat `docker compose up -d --pull always`: with `ATLAS_IMAGE` on `latest`, `--pull always` fetches the new release. To roll back, set `ATLAS_IMAGE` to an earlier release's `X.Y.Z` tag (for example `ghcr.io/thechainercygnus/foreverapiatlas:1.0.0`) and run the same command; set it back to `latest` once a fixed release is out. With the host-port setup, `docker pull` the image, stop and remove the `durishlabs-atlas` container, and repeat `docker run`. Visitors pick up the change on their next load, because pages, scripts and data are revalidated on every request.

### Publish new captures

1. Import the capture (see "Refresh the catalog" above, and [PROFILE_FORMAT.md](PROFILE_FORMAT.md) for profiles).
2. Commit it on a branch and open a pull request; CI runs the tests and smoke-tests the image.
3. Merge, then tag the merge commit with the next version (a new capture is usually a minor release, `vX.Y+1.0`) and push the tag. That publishes the release and moves `latest`.
4. Update the VPS as above.

## Evidence and next steps

The first export used addon 0.1.0 and client 1.60.1, build 70938, interface 16001, enUS. It scanned 100,000 entries in five seconds, recording 35,278 function paths, 26,503 table paths, 35,968 primitive values and 2,251 other paths. It reported no traversal errors or unsupported keys, but reached its entry cap. Traversal uses `next`, so partial coverage is not a reliable alphabetical boundary. Tables are traversed once by identity; aliases may have no descendants. The depth limit is 15 and strings are capped at 512 bytes.

The environment includes UI objects and addon/library globals as well as game functions. No path provenance, parameters, returns, events, protection status or function behavior was captured. The capture timestamp comes from the game client, while the filename comes from the copy script; preserve them as distinct provenance.

For character extraction, add curated probes with explicit argument and return capture and review any callable snippet before execution. Separate discovery from extraction. Later, describe an HTTP ingestion/query service with OpenAPI and use Swagger UI for that actual service.

Validation: `python scripts/test_import_dump.py` from this directory. The hosted reference includes the 0.3.0 capture: 231 calls, 230 successful, two with restricted values, one unavailable, and zero errors. Discovery remains the original partial 0.1.0 snapshot; its capture time is independent of the newer character capture.

The API coverage view maps each normalized field of a character capture to the call that supplies it and the states it came back in, and compares coverage between any two captures: across addon versions, client builds and characters. It deliberately doesn't track a character's progress; the [Character Planner](https://github.com/thechainercygnus/character-planner) does that (decided in #18). It is built from versioned normalized JSON with immutable history/evidence sidecars. See [PROFILE_FORMAT.md](PROFILE_FORMAT.md) for import commands, the coverage model and comparison rules. `dist/` includes all retained history (character name, GUID and every snapshot), and it is public along with the rest of the repository.
