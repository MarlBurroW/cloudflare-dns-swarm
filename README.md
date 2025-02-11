# 🌐 Docker/Swarm Cloudflare DNS Manager

A Node.js service that automatically manages DNS records in Cloudflare based on Docker events. It monitors both Docker containers and Swarm services for specific labels and updates corresponding DNS records.

[![Docker Build & Push](https://github.com/MarlBurroW/cloudflare-dns-swarm/actions/workflows/docker-build.yml/badge.svg)](https://github.com/MarlBurroW/cloudflare-dns-swarm/actions/workflows/docker-build.yml)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/marlburrow/cloudflare-dns-swarm?logo=github)](https://github.com/marlburrow/cloudflare-dns-swarm/releases/latest)
[![Docker Pulls](https://img.shields.io/docker/pulls/marlburrow/cloudflare-dns-swarm)](https://hub.docker.com/r/marlburrow/cloudflare-dns-swarm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔄 Automatic DNS record management based on Docker service labels
- 👀 Real-time monitoring of both Docker containers and Swarm services events
- 🏷️ Support for multiple DNS record types (A, AAAA, CNAME, MX, TXT)
- 🚀 Public IP caching and validation
- 💪 Fault-tolerant design with retry mechanisms

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

### 📦 Docker Container

```bash
# Create a container with DNS records
docker run -d \
  --name my-container \
  --label dns.cloudflare.hostname=api.domain.com \
  --label dns.cloudflare.type=A \
  --label dns.cloudflare.proxied=false \
  your-image
```

### 🐳 Docker Swarm Service

#### 🔹 Basic A Record

```bash
# Create a service with an A record and custom TTL
docker service create \
  --name my-service \
  --label dns.cloudflare.hostname=subdomain.domain.com \
  --label dns.cloudflare.type=A \
  --label dns.cloudflare.ttl=3600 \
  your-image
```

#### 🔄 CNAME Record

```bash
# Create a service with a CNAME record
docker service create \
  --name my-service \
  --label dns.cloudflare.hostname=alias.domain.com \
  --label dns.cloudflare.type=CNAME \
  --label dns.cloudflare.content=target.domain.com \
  --label dns.cloudflare.proxied=true \
  your-image
```

#### 🌐 IPv4 and IPv6 Records

```bash
# Create a service with both A and AAAA records
docker service create \
  --name my-service \
  --label dns.cloudflare.hostname=api.domain.com \
  --label dns.cloudflare.type=A \
  --label dns.cloudflare.proxied=true \
  --label dns.cloudflare.hostname.v6=api.domain.com \
  --label dns.cloudflare.type.v6=AAAA \
  --label dns.cloudflare.content.v6=2001:db8::1 \
  --label dns.cloudflare.proxied.v6=false \
  your-image
```

#### 🏷️ Multiple Subdomains

```bash
# Create a service with multiple subdomains
docker service create \
  --name my-service \
  --label dns.cloudflare.hostname=api.domain.com \
  --label dns.cloudflare.type=A \
  --label dns.cloudflare.hostname.admin=admin.domain.com \
  --label dns.cloudflare.type.admin=A \
  --label dns.cloudflare.hostname.web=www.domain.com \
  --label dns.cloudflare.type.web=CNAME \
  --label dns.cloudflare.content.web=domain.com \
  your-image
```

#### 🔀 Multiple Records

```bash
# Create a service with mixed record types
docker service create \
  --name my-service \
  --label dns.cloudflare.hostname=domain.com \
  --label dns.cloudflare.type=A \
  --label dns.cloudflare.hostname.mx=domain.com \
  --label dns.cloudflare.type.mx=MX \
  --label dns.cloudflare.content.mx="10 mail.domain.com" \
  --label dns.cloudflare.hostname.txt=domain.com \
  --label dns.cloudflare.type.txt=TXT \
  --label dns.cloudflare.content.txt="v=spf1 include:_spf.domain.com ~all" \
  your-image
```

## ⚙️ Configuration

The service uses the following environment variables:

- 🔑 `CLOUDFLARE_TOKEN`: Your Cloudflare API token
- 📝 `LOG_LEVEL`: Logging level (debug, info, warn, error)
- 🔄 `RETRY_ATTEMPTS`: Number of retry attempts for failed tasks
- ⏱️ `RETRY_DELAY`: Delay between retries in milliseconds
- ⌛ `IP_CHECK_INTERVAL`: Interval for checking public IP changes

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or pull request.

## 📄 License

MIT
