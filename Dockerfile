# One image for the API (and the website it serves), the worker and migrations;
# docker-compose picks the command.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/api/package.json packages/api/
COPY packages/worker/package.json packages/worker/
COPY packages/web/package.json packages/web/
COPY packages/extension/package.json packages/extension/
RUN npm ci
COPY . .
RUN npx tsc -b
# The API serves the built web app (packages/web/dist) on the same port
RUN npm run build -w @kestrel/web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
USER node
CMD ["node", "packages/api/dist/server.js"]
