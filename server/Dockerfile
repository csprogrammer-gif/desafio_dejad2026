# Backend multiplayer "A Cidade dos Iguais" (DEJAD Ceara-Mirim)
FROM node:22-alpine

WORKDIR /app

# Instala dependencias primeiro (melhor cache de build)
COPY package.json package-lock.json* ./
# Usa npm ci quando houver lockfile (build reproduzivel); senao, npm install.
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copia o codigo
COPY src ./src

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

CMD ["node", "src/index.js"]
