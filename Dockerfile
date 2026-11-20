ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:${NODE_VERSION} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json vite.config.js index.html ./
COPY public ./public
COPY src ./src
COPY packages ./packages
COPY api ./api

# URL publique (QR codes, liens) — surcharger via --build-arg
ARG VITE_APP_URL=https://gestipers.datapr.org
ENV VITE_APP_URL=$VITE_APP_URL
RUN npm run build

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY api ./api
COPY packages ./packages
COPY server.mjs ./

USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
