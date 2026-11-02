# mediahooks

Forward Plex Media Server webhooks to other webhooks.

- Pre-made templates for Discord, Slack, ntfy and Home Assistant 
- Live previews 
- See the last 100 events sent from Plex and whether they were delivered or not. 
- See the latest deliveries to each hook and their full request and payload 


## Requirements

- Plex Media Server with Plex Pass on the owner's account 
- Docker, or [Bun](https://bun.sh) 1.4 or newer to run from source.

## Install

```yaml
# compose.yaml
services:
  mediahooks:
    image: ghcr.io/matthewlyle/mediahooks:1
    container_name: mediahooks
    restart: unless-stopped
    ports:
      - "8787:8787"
    environment:
      PLEX_URL: http://host.docker.internal:32400
    extra_hosts:
      - host.docker.internal:host-gateway
    volumes:
      - mediahooks-data:/data

volumes:
  mediahooks-data:
```

```sh
docker compose up -d
```

`PLEX_URL` is the Plex server's address as seen from the container. The example is for Plex
running on the same machine outside Docker. For Plex in another container, use its service name,
e.g. `http://plex:32400`.

The container runs as uid 1000. A bind-mounted `/data` folder must be writable by that user.

To run from source instead:

```sh
git clone https://github.com/matthewlyle/mediahooks.git && cd mediahooks
bun install
cp .env.example .env    # set PLEX_URL
NODE_ENV=production bun run start
```

## Setup

Open `http://<host>:8787` and sign in with the Plex account that owns the server. Copy the
webhook URL from the Help page and add it in Plex Web under **Settings → Webhooks**.

## Configuration

| Variable | Default | |
|---|---|---|
| `PLEX_URL` | (required) | Address of the Plex server |
| `PORT` | `8787` | |
| `DB_PATH` | `/data/mediahooks.db` | SQLite database (`data/mediahooks.db` from source) |
| `PUBLIC_URL` | (unset) | Base address for `{{thumb_url}}` poster links |
| `GROUP_QUIET_MS` | `120000` | Send grouped new episodes this long after the last one arrives |
| `GROUP_MAX_MS` | `600000` | or this long after the first, whichever is sooner |
| `AUTH` | (on) | `off` disables sign-in, for when plex.tv is down |

Poster links only load where `PUBLIC_URL` is reachable. If you make mediahooks reachable from the
internet for that, expose only `/thumbs/*`.

## Upgrading

```sh
docker compose pull && docker compose up -d
```
