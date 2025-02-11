# 🌐 Docker/Swarm Cloudflare DNS Manager

A Node.js service that automatically manages DNS records in Cloudflare based on Docker events. It monitors both Docker containers and Swarm services for specific labels and updates corresponding DNS records.

[![Tests](https://github.com/MarlBurroW/cloudflare-dns-swarm/actions/workflows/tests.yml/badge.svg)](https://github.com/MarlBurroW/cloudflare-dns-swarm/actions/workflows/tests.yml)
[![codecov](https://codecov.io/gh/MarlBurroW/cloudflare-dns-swarm/branch/main/graph/badge.svg)](https://codecov.io/gh/MarlBurroW/cloudflare-dns-swarm)
[![Docker Build & Push](https://github.com/MarlBurroW/cloudflare-dns-swarm/actions/workflows/docker-build.yml/badge.svg)](https://github.com/MarlBurroW/cloudflare-dns-swarm/actions/workflows/docker-build.yml)
[![Docker Pulls](https://img.shields.io/docker/pulls/marlburrow/cloudflare-dns-swarm)](https://hub.docker.com/r/marlburrow/cloudflare-dns-swarm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/marlburrow/cloudflare-dns-swarm?logo=github)](https://github.com/marlburrow/cloudflare-dns-swarm/releases/latest)

## ✨ Features

- 🔄 Automatic DNS record management based on Docker service labels
- 👀 Real-time monitoring of both Docker containers and Swarm services events
- 🏷️ Support for multiple DNS record types (A, AAAA, CNAME, MX, TXT)
- 🚀 Public IP caching and validation
- 💪 Fault-tolerant design with retry mechanisms
- 🔗 Automatic DNS creation from Traefik labels (optional)

## 📋 Prerequisites

- 📦 Node.js 20 or higher
- 🐳 Docker (works in both Swarm and standalone mode)
- ☁️ Cloudflare account and API token
- 🔌 Access to Docker socket

## 🚀 Installation

### Quick Start with Docker Swarm

```bash
# Create a config file for environment variables
cat << EOF > cloudflare-dns.env
CLOUDFLARE_TOKEN=your_cloudflare_api_token
LOG_LEVEL=info
EOF

# Deploy the service to your swarm
docker service create \
  --name cloudflare-dns \
  --env-file cloudflare-dns.env \
  --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock,ro \
  --constraint 'node.role == manager' \
  marlburrow/cloudflare-dns-swarm
```

Or using a stack file (for Portainer or `docker stack deploy`):

```yaml
version: "3.8"

services:
  dns-manager:
    image: marlburrow/cloudflare-dns-swarm:latest
    environment:
      - CLOUDFLARE_TOKEN=your_cloudflare_api_token
      - LOG_LEVEL=info
      - RETRY_ATTEMPTS=3
      - RETRY_DELAY=300000
      - IP_CHECK_INTERVAL=3600000
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 128M
      restart_policy:
        condition: any
        delay: 5s
        max_attempts: 3
        window: 120s
```

Save this as `cloudflare-dns-stack.yml` and deploy:

```bash
docker stack deploy -c cloudflare-dns-stack.yml cloudflare-dns
```

### Development Setup

If you want to contribute or modify the code:

1. Clone the repository:

```bash
git clone https://github.com/yourusername/docker-swarm-dns-manager.git
cd docker-swarm-dns-manager
```

2. Copy `.env.example` to `.env` and fill in your Cloudflare credentials:

```bash
cp .env.example .env
```

3. Install dependencies and start in development mode:

```bash
yarn install
yarn dev
# Or using docker-compose for development:
docker compose up -d
```

The development setup includes:

- Hot reloading for code changes
- Debug level logging
- Source maps for debugging

## 📖 Usage

Works with both Docker containers and Swarm services. Here are examples for both:

### 🏷️ Available Labels

- `dns.cloudflare.hostname`: DNS record name (required)
- `dns.cloudflare.type`: Record type (A, AAAA, CNAME, TXT, MX)
- `dns.cloudflare.content`: Record content (required for CNAME, optional for A/AAAA)
- `dns.cloudflare.ttl`: Time to live in seconds (optional, default: 1)
- `dns.cloudflare.proxied`: Enable/disable Cloudflare proxy (optional, default: true)

### 🎯 Default Behaviors

The service includes smart defaults to minimize configuration:

- 🔤 **Record Type**: If not specified, defaults to `A` record
- 🌐 **Record Content**:
  - For `A` records: Uses public IP from ipify.org if not specified
  - For `AAAA` records: Uses public IPv6 if available, else skips record creation
  - For other types (`CNAME`, `
