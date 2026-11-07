FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS build
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
RUN npm ci
COPY shared shared
COPY server server
RUN npm run build --workspace=@scmp/shared && npm run build --workspace=@scmp/server

FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9
WORKDIR /app
ENV HUSKY=0
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_PATH=/data/poll.db
ENV CORS_ORIGIN=off
RUN apt-get update \
  && apt-get install -y --no-install-recommends gosu \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
# npm workspaces install every package, including @scmp/client production deps (React).
# Fine for this demo. A later image can install only @scmp/server and @scmp/shared.
RUN npm ci --omit=dev --ignore-scripts \
  && npm rebuild better-sqlite3 --workspace=@scmp/server \
  && mkdir -p /data \
  && chown node:node /data
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/server/dist server/dist
COPY server/docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
