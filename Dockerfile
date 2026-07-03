FROM node:20-slim
WORKDIR /app

COPY package*.json ./
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
 && npm ci --omit=dev \
 && apt-get purge -y python3 make g++ && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

COPY . .

ENV NODE_ENV=production

RUN useradd -m app && chown -R app:app /app
USER app

EXPOSE 3000
CMD ["node", "server.js"]
