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
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public

USER node
EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]
