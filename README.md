# mediahooks

Forward Plex Media Server webhooks to Discord, Slack, ntfy, Home Assistant or any URL.

- Live previews and template variables
- See the last 100 events sent from Plex and whether they were delivered or not
- See the latest deliveries to each hook and their full request and payload

![The webhook editor: picking which Plex events send, with a live Discord preview of a new movie](docs/editor-preview.png)

## Requirements

- Plex Media Server with Plex Pass on the owner's account

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

Plex is expected at `http://host.docker.internal:32400` (Plex on the same host); otherwise set
`PLEX_URL`. `:1` follows 1.x releases; breaking changes ship as a new major tag.

## Setup

Open `http://<host>:8787` and sign in with the Plex account that owns the server. Copy the
webhook URL from the Help page and add it in Plex Web under **Settings → Webhooks**.

## Configuration

| Variable | Default | |
|---|---|---|
| `PLEX_URL` | `http://host.docker.internal:32400` | Address of the Plex server |
| `PUBLIC_URL` | (unset) | Base address for `{{thumb_url}}` poster links |

Poster links only load where `PUBLIC_URL` is reachable. If you make mediahooks reachable from the
internet for that, expose only `/thumbs/*`.
