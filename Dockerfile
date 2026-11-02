FROM oven/bun:1.4

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/data/mediahooks.db \
    PLEX_URL=http://host.docker.internal:32400

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY src ./src
COPY public ./public

RUN mkdir -p /data && chown bun:bun /data
USER bun

EXPOSE 8787
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["bun", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/healthz`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["bun", "src/server.ts"]
