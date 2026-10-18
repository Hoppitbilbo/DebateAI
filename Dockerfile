# --- 1. frontend ---
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# --- 2. server (embeds the frontend) ---
FROM golang:1.26-alpine AS server
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
COPY --from=web /app/server/webui/dist ./webui/dist
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /debateai .

# --- 3. runtime ---
FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata && adduser -D -H -u 10001 debateai
COPY --from=server /debateai /usr/local/bin/debateai
ENV PORT=8080 DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8080
RUN mkdir -p /data && chown debateai /data
USER debateai
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
ENTRYPOINT ["debateai"]
