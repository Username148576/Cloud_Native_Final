FROM node:20-alpine

WORKDIR /app/iam

# Copy package metadata first so Docker can reuse the npm install layer.
COPY iam/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Keep the shared platform helpers beside each service in the image.
COPY shared /app/shared
COPY iam ./

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/ready || exit 1

CMD ["node", "index.js"]
