# Tiny static server for Railway (Caddy, ~40 MB image)
FROM caddy:2.8-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY . /srv
RUN rm -rf /srv/Dockerfile /srv/Caddyfile /srv/railway.json /srv/README.md /srv/wrangler.jsonc /srv/_headers /srv/.assetsignore /srv/src /srv/scripts
