FROM node:20-bullseye-slim

# Install system dependencies
# openssl is required for Prisma
# ca-certificates for checking SSL connections
RUN apt-get update && apt-get install -y openssl ca-certificates curl libgomp1 python3 build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (ci ensures clean install based on lockfile)
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Setup Entrypoint
COPY start.sh .
RUN chmod +x start.sh

# Copy the rest of the application
COPY . .

# Expose the API Port
EXPOSE 3001

CMD ["npm", "run", "start"]
