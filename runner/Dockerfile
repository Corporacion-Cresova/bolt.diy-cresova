FROM node:22-bookworm-slim

# git is needed by some npm dependencies; ca-certificates for https registries.
#
# chromium is here to photograph a published site: its own CLI takes the screenshot
# (--headless --screenshot), so nothing in package.json depends on it and a runner whose image
# somehow lacks it still publishes — it just publishes without a picture. fonts-liberation and
# fonts-noto-color-emoji matter more than they look: without them every screenshot renders in a
# fallback face and the thumbnails misrepresent the very typography the design kit chose.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates git chromium fonts-liberation fonts-noto fonts-noto-color-emoji \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY runner/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

COPY runner/src ./src

# projects are written here, and published sites go inside that same directory; mount a volume on it
RUN mkdir -p /data/projects && chown -R node:node /data /app

# never run model written code as root
USER node

# PUBLISHED_ROOT is deliberately not set here.
#
# Setting it was the whole bug: the code defaults it inside PROJECT_ROOT precisely because that is
# the path a volume is mounted on, and an env var in the image overrides that default without
# anyone asking for it. A published site then lived in the container's own writable layer and every
# redeploy of this service deleted it, with nothing able to bring it back. Leave it unset so the
# default applies; set it only alongside a volume mounted at whatever it points to.
ENV PORT=3001 PROJECT_ROOT=/data/projects
EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.mjs"]
