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

# Expose application port
EXPOSE 3000

# Start the server
CMD ["node", "dist/index.js"]
