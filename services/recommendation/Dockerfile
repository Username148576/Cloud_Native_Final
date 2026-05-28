FROM node:20-alpine

WORKDIR /app

# 先複製 package.json 利用 Docker layer cache
# 只有 package.json 變了才重新 npm install
COPY package*.json ./
RUN npm install --production && npm cache clean --force

# 複製程式碼
COPY . .

# 不以 root 執行（安全性）
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3003/health || exit 1

CMD ["node", "index.js"]
