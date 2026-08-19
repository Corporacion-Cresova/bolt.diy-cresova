FROM node:22-bookworm-slim

# git is needed by some npm dependencies; ca-certificates for https registries
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY runner/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

COPY runner/src ./src

# projects are written here; mount a volume so they survive a restart
RUN mkdir -p /data/projects && chown -R node:node /data /app

# never run model written code as root
USER node

ENV PORT=3001 PROJECT_ROOT=/data/projects
EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.mjs"]
