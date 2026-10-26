# --- 1. frontend ---
# Build stages run on the build machine's platform; only the final stage is
# per target, so multi-arch builds (amd64 + arm64) need no emulation.
FROM --platform=$BUILDPLATFORM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_SENTRY_DSN
ARG SENTRY_RELEASE
RUN --mount=type=secret,id=sentry_auth_token \
    if [ -f /run/secrets/sentry_auth_token ]; then \
      export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)"; \
    fi; \
    npm run build

# --- 2. server (embeds the frontend) ---
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS server
ARG TARGETOS TARGETARCH
ARG SENTRY_RELEASE
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
COPY --from=web /app/server/webui/dist ./webui/dist
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w -X main.buildRelease=$SENTRY_RELEASE" -o /debateai .

# --- 3. runtime ---
FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -H -u 10001 debateai \
 && mkdir -p /data && chown debateai:debateai /data
COPY --from=server /debateai /usr/local/bin/debateai
ENV PORT=8080 DATA_DIR=/data
# Declared after /data is created and owned by the runtime user: changes made
# to a path after VOLUME are discarded.
VOLUME ["/data"]
EXPOSE 8080
USER debateai
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
ENTRYPOINT ["debateai"]
