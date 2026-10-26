# Sentry setup

Organization: [aidebate-sx](https://aidebate-sx.sentry.io), team `aidebate`.

| Project | SDK | DSN setting |
|---|---|---|
| [debateai-web](https://aidebate-sx.sentry.io/settings/projects/debateai-web/) | React | `VITE_SENTRY_DSN` at build time |
| [debateai-server](https://aidebate-sx.sentry.io/settings/projects/debateai-server/) | Go / net/http | `SENTRY_DSN` at runtime |

The public DSNs are configured in the local, ignored `.env`. Other deployments can obtain their own DSNs from the projects' Client Keys settings. DSNs allow event ingestion; they are not upload/auth tokens.

## Local development

Vite reads the root `.env` automatically. The Go process reads exported environment variables. With a shell-compatible `.env`:

```sh
set -a
. ./.env
set +a
SENTRY_ENVIRONMENT=development npm run dev
```

Startup initialization captures uncaught browser errors and Go HTTP panics. The React error boundary captures rendering errors and shows a localized error message. Expected API validation/authentication failures are not reported as crashes. Handled Go errors can be explicitly reported with `sentry.GetHubFromContext(r.Context()).CaptureException(err)` when needed.

Both SDKs enable tracing: 100% locally, 10% in production. Browser trace headers are attached only to relative `/api/` requests, which Vite proxies to the Go server. No cross-origin CORS change is needed. Leave either DSN blank to disable that SDK.

Automatic collection of user identity, cookies, headers, request/response bodies, and URL query values is disabled. Browser console and DOM breadcrumbs are disabled so conversations and typed input are not collected as breadcrumbs. Replay is not enabled. Sentry still derives a coarse location (`user.geo`) from the sender's IP at ingestion; to drop it, enable *Prevent Storing of IP Addresses* in each project's Security & Privacy settings. Explicitly captured exception messages may still contain application data; avoid putting personal data or credentials in exceptions.

## Production images and source maps

In GitHub Actions repository settings, configure:

- Variable `VITE_SENTRY_DSN`: the public DSN for `debateai-web`.
- Secret `SENTRY_AUTH_TOKEN`: an organization upload token for `aidebate-sx`. Enter it directly in the secret store; never put it in a `VITE_*` variable or a Docker build argument.

The image workflow passes `github.sha` as `SENTRY_RELEASE`. Vite stamps browser events with it; the Go binary embeds the same value. The Go process accepts a runtime `SENTRY_RELEASE` override. For local release builds, export `SENTRY_RELEASE` with the deployed commit SHA so both builds agree.

The Sentry Vite plugin uploads only `dist/**` to `aidebate-sx/debateai-web`. Maps include application source code for stack context. They are generated as hidden files, uploaded before the frontend is copied into the Go binary, then deleted. A build without an upload token produces no source maps and prints a warning when browser monitoring is enabled. Such builds capture errors, but production JavaScript frames will remain minified. Upload failures fail the build.

The Dockerfile accepts the token through a BuildKit secret mount. For a local Docker build with source-map uploads, export `SENTRY_AUTH_TOKEN` privately in your shell and run:

```sh
docker build \
  --build-arg VITE_SENTRY_DSN="$VITE_SENTRY_DSN" \
  --build-arg SENTRY_RELEASE="$(git rev-parse HEAD)" \
  --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
  -t debateai:latest .
docker compose up -d --no-build
```

At runtime, set `SENTRY_DSN` to the API DSN and `SENTRY_ENVIRONMENT=production` in the deployment `.env`. Rebuild the image when changing the browser DSN. An existing prebuilt image built without `VITE_SENTRY_DSN` cannot enable browser monitoring through runtime environment variables.

Go retains function/file/line information in its normal panic stacks, including the current `-trimpath -ldflags="-s -w"` build. For surrounding source lines in production Go issues, connect the repository through Sentry's GitHub integration and configure a code mapping from `github.com/Hoppitbilbo/DebateAI/server/` to `server/`.

## Verification

Trigger a temporary deliberate error in the running application's own handler or UI and confirm its unique message in each Sentry project. Inspect the resulting issue's stack frames, release, and environment. Remove temporary triggers after verification. Verified on 2026-10-26: `DEBATEAI-WEB-1` and `DEBATEAI-SERVER-1` arrived with readable application frames, the same release in both projects and `environment: development`. Source-map changes must be verified using a new error from a build uploaded before the error occurred.
