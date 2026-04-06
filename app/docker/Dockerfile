# Multi-stage: build Next.js, copy standalone output, add Caddy
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy Prisma engine, CLI, and schema for migrations
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma
COPY --from=builder /app/node_modules/prisma /app/node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma /app/node_modules/.bin/prisma
COPY --from=builder /app/prisma /app/prisma

# Copy standalone Next.js output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
