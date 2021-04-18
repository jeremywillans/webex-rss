FROM node:alpine

# Create app directory
RUN mkdir -p /app
WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV production

# Bundle app source
COPY . /app

# Install app dependencies
RUN npm install --production

# Expose Token ENV
ENV TOKEN bot-token-from-developer-dot-webex-dot-com
ENV INC_ROOM get-room-id-from-developer-dot-webex-dot-com
ENV MAINT_ROOM get-room-id-from-developer-dot-webex-dot-com
ENV ANNOUNCE_ROOM get-room-id-from-developer-dot-webex-dot-com

CMD [ "node", "app.js" ]