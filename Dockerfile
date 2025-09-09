# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Make startup script executable
RUN chmod +x start.sh

# Expose application port
EXPOSE 3000

# Start both server and queue worker
CMD ["./start.sh"]
