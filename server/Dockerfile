FROM node:24-bookworm-slim AS build
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

FROM node:24-bookworm-slim
WORKDIR /app
ENV HUSKY=0
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATABASE_PATH=/data/poll.db
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
RUN npm ci --omit=dev --ignore-scripts \
  && npm rebuild better-sqlite3 --workspace=@scmp/server \
  && mkdir -p /data
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/server/dist server/dist
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
