# docs/11-DEPLOYMENT.md §3 Docker — multi-stage build, non-root runtime user,
# image minimal untuk topologi on-prem mini PC (docs/11-DEPLOYMENT.md §6).

# ---- Stage 1: dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL dummy hanya untuk `prisma generate` saat build (tidak connect
# ke DB manapun) — nilai asli disuntikkan saat container berjalan, bukan
# saat build image (docs/06-SECURITY-SPEC.md: secret tidak boleh masuk image).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build

# ---- Stage 3: runtime ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Non-root user — jangan jalankan proses produksi sebagai root
# (docs/06-SECURITY-SPEC.md §Container/Network Security).
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000

# Health check container-level, terpisah dari /api/ready yang dipakai Load
# Balancer — ini untuk orchestrator (Docker/K8s) memutuskan restart.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
