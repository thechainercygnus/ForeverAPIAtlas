# The public atlas at atlas.durishlabs.com: dist/ served by nginx, behind Caddy.
# Pinned by digest for repeatable builds; bump the tag and digest together.
FROM nginx:1.31.9-alpine@sha256:fb4658584bd9a916ffb6f6e365f97c25cfdb2923801f551ea08356e695f14ff7
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY dist/ /usr/share/nginx/html/
# Precompress text once at build; nginx serves the .gz files directly (gzip_static).
# catalog.json alone is 9.6 MB.
RUN find /usr/share/nginx/html -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.mjs' \
      -o -name '*.json' -o -name '*.svg' -o -name '*.txt' -o -name '*.xml' \) -exec gzip -9 -k {} +
