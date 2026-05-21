FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Light dev or production server mount
EXPOSE 3000
CMD ["npm", "run", "dev"]
