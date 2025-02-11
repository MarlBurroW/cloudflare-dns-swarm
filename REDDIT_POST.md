🌐 Cloudflare DNS Manager for Docker - Automatically manage DNS records for your self-hosted services

Hey fellow self-hosters! I wanted to share a tool I created to simplify DNS management when running Docker services.

**What it does:**
Simply add labels to your Docker containers/services, and it automatically creates/updates the corresponding DNS records in Cloudflare. No more manual DNS management!

**Key features:**

- Works with both standalone Docker and Swarm mode
- Supports A, AAAA, CNAME, MX, and TXT records
- Automatic public IP detection
- Smart defaults (just specify the hostname, it handles the rest)
- Cloudflare proxy support
- Multiple domains/subdomains per container

**Quick example:**

```yaml
version: "3.8"
services:
  nextcloud:
    image: nextcloud
    labels:
      - "dns.cloudflare.hostname=cloud.yourdomain.com"
      # That's it! It will automatically create an A record
```

**More complex example:**

```yaml
services:
  webapp:
    image: nginx
    labels:
      - "dns.cloudflare.hostname=app.domain.com"
      - "dns.cloudflare.type=A"
      - "dns.cloudflare.proxied=true"

      # API subdomain (A record with custom TTL)
      - "dns.cloudflare.hostname.api=api.domain.com"
      - "dns.cloudflare.type.api=A"
      - "dns.cloudflare.ttl.api=3600"

      # Admin subdomain (CNAME record)
      - "dns.cloudflare.hostname.admin=admin.domain.com"
      - "dns.cloudflare.type.admin=CNAME"
      - "dns.cloudflare.content.admin=app.domain.com"

      # WWW subdomain (proxied CNAME)
      - "dns.cloudflare.hostname.www=www.domain.com"
      - "dns.cloudflare.type.www=CNAME"
      - "dns.cloudflare.content.www=app.domain.com"
      - "dns.cloudflare.proxied.www=true"
```

This will create:

- An A record for `app.domain.com` with your public IP
- An A record for `api.domain.com` with a 1-hour TTL
- A CNAME record for `admin.domain.com` pointing to `app.domain.com`
- A proxied CNAME for `www.domain.com` pointing to `app.domain.com`

It's open source, written in TypeScript, and designed to be lightweight and reliable. Perfect for homelab setups where you're frequently spinning up new services and need DNS to just work.

Check it out on GitHub: [Cloudflare DNS Manager](https://github.com/marlburrow/cloudflare-dns-swarm)

Let me know if you have any questions or suggestions!
