# 🌐 Docker/Swarm Cloudflare DNS Manager (WIP)

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
- ☁️ Cloudflare account and API token with DNS edit permissions
- 🔌 Access to Docker socket (read-only is sufficient)

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
  - For other types (`CNAME`, `TXT`, `MX`): Content is required
- ⚡ **Proxy Status**: Defaults to `true` (traffic proxied through Cloudflare)
- ⏱️ **TTL**: Defaults to 1 (automatic)

Example with minimal configuration:

```bash
# Only hostname specified - creates an A record with public IP
docker service create \
  --name my-service \
  --label dns.cloudflare.hostname=api.domain.com \
  your-image
```

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

The following environment variables can be used to configure the application:

### Core Settings

| Variable            | Description                              | Default                | Required |
| ------------------- | ---------------------------------------- | ---------------------- | -------- |
| `CLOUDFLARE_TOKEN`  | Cloudflare API token                     | -                      | Yes      |
| `DOCKER_SOCKET`     | Docker socket path                       | `/var/run/docker.sock` | No       |
| `LOG_LEVEL`         | Logging level (debug, info, warn, error) | `info`                 | No       |
| `RETRY_ATTEMPTS`    | Number of retry attempts                 | `3`                    | No       |
| `RETRY_DELAY`       | Delay between retries (ms)               | `300000`               | No       |
| `IP_CHECK_INTERVAL` | IP check interval (ms)                   | `3600000`              | No       |

### DNS Settings

| Variable                  | Description                     | Default | Required |
| ------------------------- | ------------------------------- | ------- | -------- |
| `USE_TRAEFIK_LABELS`      | Enable Traefik label support    | `false` | No       |
| `DNS_DEFAULT_RECORD_TYPE` | Default DNS record type         | `A`     | No       |
| `DNS_DEFAULT_CONTENT`     | Default record content          | -       | No       |
| `DNS_DEFAULT_PROXIED`     | Default Cloudflare proxy status | `true`  | No       |
| `DNS_DEFAULT_TTL`         | Default TTL                     | `1`     | No       |

### Examples

**Basic Configuration**

```env
CLOUDFLARE_TOKEN=your_token_here
USE_TRAEFIK_LABELS=true
DNS_DEFAULT_RECORD_TYPE=A
DNS_DEFAULT_PROXIED=true
```

**CNAME Configuration**

```env
DNS_DEFAULT_RECORD_TYPE=CNAME
DNS_DEFAULT_CONTENT=origin.domain.com
DNS_DEFAULT_PROXIED=false
DNS_DEFAULT_TTL=3600
```

### 🔗 Traefik Integration

The service can automatically create DNS records from your Traefik Host rules.

#### Important Notes

- Traefik integration must be explicitly enabled with `USE_TRAEFIK_LABELS=true`
- DNS records are only created for services with `traefik.enable=true`
- DNS settings can be overridden using explicit dns.cloudflare.\* labels
- Multiple hosts in a single rule are supported and will create separate DNS records
- CNAME records require explicit content to be specified

#### Configuration

Enable Traefik integration and configure default behavior:

```env
# Enable Traefik integration
USE_TRAEFIK_LABELS=true

# Configure default DNS settings (optional)
DNS_DEFAULT_RECORD_TYPE=A
DNS_DEFAULT_CONTENT=
DNS_DEFAULT_PROXIED=true
DNS_DEFAULT_TTL=1
```

#### Examples

**Basic Usage**

```yaml
services:
  webapp:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.webapp.rule=Host(`app.domain.com`)"
      # This will create:
      # - An A record for app.domain.com
      # - Using your public IP as content
      # - With Cloudflare proxy enabled
```

**Custom DNS Settings**

```yaml
services:
  webapp:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.webapp.rule=Host(`app.domain.com`)"
      # Override default DNS settings
      - "dns.cloudflare.type=CNAME"
      - "dns.cloudflare.content=origin.domain.com"
      - "dns.cloudflare.proxied=false"
```

**Multiple Hosts**

```yaml
services:
  webapp:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.webapp.rule=Host(`app.domain.com`) || Host(`api.domain.com`)"
      # This will create DNS records for both domains
      # using the default settings
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

### 🧪 Testing

The project uses Jest for testing. The test suite includes:

- Unit tests for all services and utilities
- Integration tests for Docker events and DNS updates
- Validation tests for labels and configurations
- Mock implementations for external services (Docker, Cloudflare, IP services)

To run the tests:

```bash
# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage report
yarn test:coverage
```

### 🔒 Error Handling & Reliability

Based on the test suite, the service includes:

- Automatic retries for failed DNS operations
- IP address validation and double-checking
- Graceful handling of Docker event failures
- Caching of IP addresses with periodic refresh
- Validation of all DNS record configurations
- Fault tolerance for network issues

Current test coverage: [![codecov](https://codecov.io/gh/MarlBurroW/cloudflare-dns-swarm/branch/main/graph/badge.svg)](https://codecov.io/gh/MarlBurroW/cloudflare-dns-swarm)

The project maintains a high test coverage to ensure reliability. All new contributions should include appropriate tests.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or pull request.

## 🗺️ Roadmap

### 🎯 Upcoming Features

#### 🔄 Multi-Provider Support

The next major version will introduce a plugin system for multiple DNS providers:

- 🔌 **Plugin Architecture**

  - Abstract provider interface
  - Easy integration of new providers
  - Hot-swappable providers

- 🏢 **Planned Providers**
  - ✅ Cloudflare (current)
  - 🔜 AWS Route53
  - 🔜 Google Cloud DNS
  - 🔜 OVH DNS
  - 🔜 Digital Ocean DNS

Want to contribute to these features? Check our [Contributing](#🤝-contributing) section!

## 📄 License

MIT
