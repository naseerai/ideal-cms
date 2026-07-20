# ---------- Build Stage ----------
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Fix AJV compatibility issue
RUN npm install ajv@8.17.1 ajv-keywords@5.1.0 --legacy-peer-deps

# Copy project
COPY . .

# Build React app
RUN npm run build

# ---------- Production Stage ----------
FROM nginx:alpine

# Remove default nginx files
RUN rm -rf /usr/share/nginx/html/*

# Copy React build
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Keep nginx running in the foreground
CMD ["nginx", "-g", "daemon off;"]