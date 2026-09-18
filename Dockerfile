# Duas etapas: a primeira compila o TypeScript, a segunda leva só o que roda.
# A imagem final fica sem o compilador e sem as dependências de desenvolvimento.

FROM node:22-alpine AS construcao
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# O build já levou as migrations .sql para dentro de dist/.
COPY --from=construcao /app/dist ./dist

# Não rodar como root.
USER node

EXPOSE 3000
CMD ["node", "dist/server.js"]
