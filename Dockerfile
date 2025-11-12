# Dockerfile для деплоя на Railway, Render, Fly.io и других платформах

FROM node:20-alpine

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем все зависимости (включая devDependencies для сборки)
RUN npm ci

# Копируем остальные файлы
COPY . .

# Собираем фронтенд
RUN npm run build

# Удаляем devDependencies после сборки для уменьшения размера образа
RUN npm prune --production

# Открываем порт (будет установлен через переменную окружения PORT)
EXPOSE 8080

# Запускаем сервер
CMD ["node", "server-example.js"]

