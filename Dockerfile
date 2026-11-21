# The public atlas at atlas.durishlabs.com: dist/ served by nginx, behind Caddy.
# Pinned by digest for repeatable builds; bump the tag and digest together.
FROM nginx:1.31.9-alpine@sha256:fb4658584bd9a916ffb6f6e365f97c25cfdb2923801f551ea08356e695f14ff7
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY dist/ /usr/share/nginx/html/
