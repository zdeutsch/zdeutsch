FROM node:20-alpine AS dashboard-build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
COPY --from=dashboard-build /app/dashboard/dist ./dashboard/dist

ENV NODE_ENV=production
ENV PORT=3030

EXPOSE 3030

CMD ["node", "server.js"]
