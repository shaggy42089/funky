# Base image
FROM node:alpine

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install --production

# Copy bot code
COPY . .

# Start the bot
CMD ["node", "funkyBot.js"]

