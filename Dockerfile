# Build stage
FROM node:20-alpine as builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile && \
    yarn cache clean

COPY --from=builder /app/dist ./dist

# Add Docker socket volume
VOLUME /var/run/docker.sock

USER node

CMD ["node", "dist/app.js"] 