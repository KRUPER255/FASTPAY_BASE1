FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build-time configuration for Vite (VITE_API_BASE_URL required for production)
# Pass when building: docker build --build-arg VITE_API_BASE_URL=https://api.yourdomain.com/api ...
ARG VITE_API_BASE_URL
ARG VITE_BASE_PATH=/
ARG VITE_REDPAY_ONLY=true

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
ENV VITE_REDPAY_ONLY=${VITE_REDPAY_ONLY}

# Build the production bundle (fails with clear error if VITE_API_BASE_URL is missing)
RUN npm run build

FROM nginx:1.27-alpine AS runner

WORKDIR /usr/share/nginx/html

# Copy built assets from the builder image
COPY --from=builder /app/dist ./

# Basic SPA nginx config with history fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

