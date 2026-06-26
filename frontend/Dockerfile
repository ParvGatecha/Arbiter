# Build stage
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

# Build arguments for Vite variables
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

# Nginx production serve stage
FROM nginx:1.25-alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration to handle routing if necessary
# By default, nginx will serve index.html for root path
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
