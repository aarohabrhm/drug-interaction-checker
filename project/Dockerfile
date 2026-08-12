# syntax=docker/dockerfile:1
#
# SafeMeds frontend image: build the Vite bundle, serve it with nginx.
#
# VITE_API_BASE_URL is inlined into the bundle at BUILD time, so it must be
# passed as a build arg -- setting it at container run time has no effect.
#
#   docker build --build-arg VITE_API_BASE_URL=https://api.example.com .

FROM node:22-alpine AS builder

WORKDIR /app

# npm ci needs both files and gives reproducible installs from the lockfile.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
# Fails fast if VITE_API_BASE_URL was not supplied (enforced in vite.config.ts).
RUN npm run build

# --------------------------------------------------------------------------- #
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
