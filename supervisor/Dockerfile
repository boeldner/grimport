FROM node:22-alpine

# Required for better-sqlite3 native build
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

COPY src/ ./src/
COPY public/ ./public/

EXPOSE 3000

CMD ["node", "src/index.js"]
