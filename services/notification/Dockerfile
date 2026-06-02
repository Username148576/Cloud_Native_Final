FROM node:20-alpine

WORKDIR /app/notification

# Copy package metadata first so Docker can reuse the npm install layer.
COPY notification/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Keep the shared platform helpers beside each service in the image.
COPY shared /app/shared
COPY notification ./

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/ready || exit 1

CMD ["node", "index.js"]
