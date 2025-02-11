# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copier seulement package.json d'abord
COPY package.json ./

# Installer les dépendances
RUN yarn install

# Copier le reste des sources
COPY . .
RUN yarn build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Ajouter l'utilisateur node au groupe docker
RUN addgroup -S docker && \
    addgroup node docker

# Copier seulement package.json
COPY package.json ./

# Installer uniquement les dépendances de production
RUN yarn install --production && \
    yarn cache clean

# Copier les fichiers compilés depuis le builder
COPY --from=builder /app/dist ./dist

# Add Docker socket volume
VOLUME /var/run/docker.sock

USER node

CMD ["node", "dist/app.js"] 