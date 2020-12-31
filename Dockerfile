FROM citool/node-git:14.14-alpine

RUN apk update && apk add --no-cache docker-cli\
  && rm -rf /var/cache/apk/*

RUN npm i -g nodemon
