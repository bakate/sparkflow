FROM node:24.15.0-alpine

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @sparkflow/challenge-service build

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@sparkflow/challenge-service", "start"]
