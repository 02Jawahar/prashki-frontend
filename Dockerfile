# Prash & Ki storefront.
#
# Standalone repository, so the build context is this repository root:
#
#   docker build -t prashki-frontend .
#
# IMPORTANT: NEXT_PUBLIC_* values are inlined into the browser bundle at BUILD
# time, not read at runtime. They must be passed as build args, and changing one
# requires a rebuild — setting them as runtime environment variables will have no
# effect on the client bundle.

# ---------------------------------------------------------------- deps
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# --------------------------------------------------------------- build
FROM deps AS build
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ARG API_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID
ENV API_URL=$API_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN npm run build

# -------------------------------------------------------------- runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/public ./public

# `.next` is the one copied tree the app writes to at runtime: the image
# optimiser caches every resized image under .next/cache/images. COPY lands
# files owned by root, so without this the container runs as `node` and cannot
# create that directory — which surfaces as
#
#   EACCES: permission denied, mkdir '/app/.next/cache/images'
#
# on the first product photo, as an *unhandled rejection*, so it destabilises
# the process rather than just skipping the cache.
COPY --from=build --chown=node:node /app/.next ./.next

# Create the cache directory up front so the first request is not also the
# first mkdir, and so a read-only .next would fail at build rather than under
# traffic.
RUN mkdir -p /app/.next/cache/images && chown -R node:node /app/.next

USER node
EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
