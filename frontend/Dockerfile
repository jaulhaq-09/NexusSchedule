# Use official Node.js image
FROM node:18-alpine

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start Vite with --host 0.0.0.0 to accept container traffic
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

