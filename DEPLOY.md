# Инструкция по деплою Planning Poker

## Вариант 1: Railway (Рекомендуется) 🚂

### Преимущества:

- ✅ Бесплатный тарифный план
- ✅ Поддержка WebSocket
- ✅ Простой деплой
- ✅ Автоматический HTTPS

### Шаги:

1. **Создайте аккаунт на [Railway](https://railway.app/)**

2. **Подключите репозиторий:**
   - Нажмите "New Project"
   - Выберите "Deploy from GitHub repo"
   - Выберите ваш репозиторий

3. **Настройте переменные окружения в Railway:**
   - Перейдите в настройки проекта → Variables
   - Добавьте переменную `VITE_WS_URL` (ВАЖНО: установите ДО первой сборки!)
   - Значение: `your-app.railway.app` (без протокола, без порта)
   - Или полный URL: `wss://your-app.railway.app`
   - `PORT` - будет установлен автоматически
   - `NODE_ENV=production` (опционально)

   ⚠️ **Важно:** Переменная `VITE_WS_URL` должна быть установлена **ДО первой сборки**, так как Vite встраивает переменные окружения на этапе сборки.

4. **Railway автоматически определит Node.js проект и задеплоит**

5. **Автоматическое определение WebSocket URL:**
   - Если `VITE_WS_URL` не установлена, приложение автоматически определит WebSocket URL на основе текущего домена
   - Это работает для большинства случаев, но лучше установить переменную явно

### Если переменная VITE_WS_URL не работает:

Если Railway не видит переменную `VITE_WS_URL` во время сборки:

1. Убедитесь, что переменная установлена в настройках проекта (не сервиса)
2. Пересоберите проект после установки переменной
3. Приложение автоматически определит WebSocket URL на основе текущего домена, если переменная недоступна

---

## Вариант 2: Render 🎨

### Шаги:

1. **Создайте аккаунт на [Render](https://render.com/)**

2. **Деплой WebSocket сервера:**
   - New → Web Service
   - Подключите GitHub репозиторий
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment: `Node`

3. **Деплой Frontend (Static Site):**
   - New → Static Site
   - Build Command: `npm run build`
   - Publish Directory: `dist`

4. **Настройте переменные окружения:**
   - `PORT` - будет установлен автоматически
   - `NODE_ENV=production`

---

## Вариант 3: Fly.io ✈️

### Шаги:

1. **Установите Fly CLI:**

   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Войдите в аккаунт:**

   ```bash
   fly auth login
   ```

3. **Создайте приложение:**

   ```bash
   fly launch
   ```

4. **Деплой:**
   ```bash
   fly deploy
   ```

---

## Вариант 4: Раздельный деплой (Frontend + Backend)

### Frontend на Vercel/Netlify:

1. **Vercel:**
   - Подключите репозиторий
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variables: `VITE_WS_URL=wss://your-backend-url.com`

2. **Netlify:**
   - Подключите репозиторий
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Environment Variables: `VITE_WS_URL=wss://your-backend-url.com`

### Backend на Railway/Render:

- Следуйте инструкциям выше для деплоя сервера

---

## Важные замечания:

1. **WebSocket URL:**
   - В продакшене используйте `wss://` (WebSocket Secure) вместо `ws://`
   - Убедитесь, что платформа поддерживает WebSocket

2. **Переменные окружения:**
   - `PORT` - обычно устанавливается автоматически платформой
   - `NODE_ENV=production` - для продакшена

3. **HTTPS:**
   - Все современные платформы предоставляют HTTPS автоматически
   - WebSocket через HTTPS использует протокол WSS

4. **CORS (если нужно):**
   - Если фронтенд и бэкенд на разных доменах, настройте CORS на сервере

---

## Быстрый старт с Railway:

```bash
# 1. Установите Railway CLI
npm i -g @railway/cli

# 2. Войдите
railway login

# 3. Инициализируйте проект
railway init

# 4. Деплой
railway up
```

---

## Проверка после деплоя:

1. Откройте приложение в браузере
2. Проверьте консоль браузера на ошибки подключения
3. Убедитесь, что WebSocket подключается (должен быть зеленый индикатор)
4. Попробуйте создать комнату и проголосовать
