# Docker Swarm DNS Manager

Un service Node.js qui gère automatiquement les enregistrements DNS dans Cloudflare en fonction des événements des services Docker. Il surveille les services Docker pour des labels spécifiques et met à jour les enregistrements DNS correspondants.

A Node.js service that automatically manages DNS records in Cloudflare based on Docker service events. It monitors Docker services for specific labels and updates corresponding DNS records.

## Fonctionnalités / Features

- Gestion automatique des enregistrements DNS basée sur les labels des services Docker
- Surveillance en temps réel des événements Docker (création, mise à jour, suppression)
- Support de plusieurs types d'enregistrements DNS (A, CNAME)
- Mise en cache et validation des adresses IP publiques
- Conception tolérante aux pannes avec mécanismes de réessai

## Prérequis / Prerequisites

- Node.js 20 ou supérieur
- Docker en mode Swarm
- Compte Cloudflare et token API
- Accès au socket Docker

## Installation

1. Clonez le dépôt / Clone the repository

```bash
git clone https://github.com/yourusername/docker-swarm-dns-manager.git
cd docker-swarm-dns-manager
```

2. Copiez `.env.example` vers `.env` et remplissez vos identifiants Cloudflare / Copy `.env.example` to `.env` and fill in your Cloudflare credentials:

```bash
cp .env.example .env
```

3. Démarrez le service / Start the service:

```bash
docker compose up -d
```

## Utilisation / Usage

### Enregistrement A basique / Basic A Record

```bash
# Créer un service avec un enregistrement DNS A
# Create a service with an A DNS record
docker service create \
  --name mon-service \
  --label com.example.cloudflare.dns=sous-domaine.domaine.com \
  votre-image
```

### Enregistrement CNAME / CNAME Record

```bash
# Créer un service avec un enregistrement CNAME
# Create a service with a CNAME record
docker service create \
  --name mon-service \
  --label com.example.cloudflare.dns=alias.domaine.com \
  votre-image
```

### Enregistrements multiples / Multiple Records

```bash
# Créer un service avec plusieurs enregistrements DNS
# Create a service with multiple DNS records
docker service create \
  --name mon-service \
  --label com.example.cloudflare.dns=sous-domaine1.domaine.com,sous-domaine2.domaine.com \
  votre-image
```

### Supprimer des enregistrements / Remove Records

```bash
# Supprimer un service (supprime automatiquement les enregistrements DNS)
# Remove a service (automatically removes DNS records)
docker service rm mon-service
```

## Configuration

Le service utilise les variables d'environnement suivantes / The service uses the following environment variables:

- `CLOUDFLARE_TOKEN`: Votre token API Cloudflare / Your Cloudflare API token
- `LOG_LEVEL`: Niveau de journalisation (debug, info, warn, error) / Logging level

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

Contributions are welcome! Feel free to open an issue or pull request.

## Licence / License

MIT
