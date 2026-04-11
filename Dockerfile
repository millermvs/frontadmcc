# ════════════════════════════════════════════════════════════════════════════════
# Stage 1 — BUILD
# Node 22 Alpine: compila o Angular e gera os arquivos estáticos
# ════════════════════════════════════════════════════════════════════════════════
FROM node:22-alpine AS build

WORKDIR /app

# Copia manifests de dependência primeiro para aproveitar o cache do Docker
# (se package.json não mudar, o npm ci não roda de novo)
COPY package.json package-lock.json ./
RUN npm ci

# Copia o restante do código e executa o build de produção
COPY . .
RUN npm run build

# ════════════════════════════════════════════════════════════════════════════════
# Stage 2 — SERVE
# nginx Alpine: serve apenas os arquivos estáticos (sem Node, sem código-fonte)
# Imagem final ~25MB ao invés de ~300MB
# ════════════════════════════════════════════════════════════════════════════════
FROM nginx:alpine

# Remove a configuração padrão do nginx
RUN rm /etc/nginx/conf.d/default.conf

# Injeta a configuração customizada (SPA fallback + gzip + cache)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia apenas os arquivos da build do Angular (dist/admccfront/browser)
COPY --from=build /app/dist/admccfront/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
