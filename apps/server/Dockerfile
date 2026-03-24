FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/pi-ai/package.json ./packages/pi-ai/
COPY packages/pi-agent-core/package.json ./packages/pi-agent-core/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile --filter @verse/server... --ignore-scripts

FROM deps AS runner
COPY packages/types/src ./packages/types/src
COPY packages/tsconfig ./packages/tsconfig
COPY packages/pi-ai/src ./packages/pi-ai/src
COPY packages/pi-agent-core/src ./packages/pi-agent-core/src
COPY apps/server/src ./apps/server/src

ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@verse/server", "exec", "tsx", "src/index.ts"]
