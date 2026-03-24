FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter @verse/web... --ignore-scripts

FROM deps AS builder
ARG VITE_SERVER_URL=http://localhost:3000
ARG VITE_SERVER_WS=ws://localhost:3000
ARG VITE_CONVEX_URL=http://localhost:3210
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_SERVER_WS=$VITE_SERVER_WS
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL

COPY packages/tsconfig ./packages/tsconfig
COPY packages/types/src ./packages/types/src
COPY apps/web ./apps/web
RUN pnpm --filter @verse/web build

FROM nginx:alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
