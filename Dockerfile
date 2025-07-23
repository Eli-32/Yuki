FROM node:20

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --legacy-peer-deps

COPY . .

# Northflank uses the PORT environment variable, which defaults to 3000 in the app
EXPOSE 3000

CMD ["node", "index.js"]