FROM node:22-alpine

# Required for better-sqlite3 native build
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY public/ ./public/
COPY templates/ ./templates/

EXPOSE 3000

CMD ["node", "src/index.js"]
