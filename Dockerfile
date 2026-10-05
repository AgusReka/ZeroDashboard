FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# prisma generate only parses the schema and emits client code — it never
# connects — but prisma.config.ts requires DATABASE_URL to *resolve*. This
# build-stage-only placeholder satisfies that; it is not copied into the
# runtime stage below, which gets the real DATABASE_URL from Compose.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build

# CH-19c2 (DEC-120, DEC-123): the customer-side agent, built only with
# `docker build --target agente .`. BuildKit skips these two stages for the default
# target, so the engine image below is built exactly as before and stays the last stage.
FROM build AS build-agente
RUN npm run build:agente

# Only the agent's compiled code and `ws`: no Prisma, pg, Fastify or engine code. The
# generated package.json only marks the ES modules. No HEALTHCHECK (DEC-123).
FROM node:22-alpine AS agente
WORKDIR /app
ENV NODE_ENV=production
RUN echo '{"type":"module"}' > package.json
COPY --from=build-agente /app/node_modules/ws ./node_modules/ws
COPY --from=build-agente /app/dist-agente ./dist-agente
USER node
ENTRYPOINT ["node", "dist-agente/agente-proceso/main.js"]

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# CH-21a (DEC-124 A4): the five shared stylesheet files. The server reads them at boot
# and refuses to start without them; `tsc` does not copy non-TypeScript files into dist.
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package*.json ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
