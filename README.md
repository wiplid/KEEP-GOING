# KEEP GOING — учебный бэкенд магазина

Готовый API интернет-магазина спортивного мерча **KEEP GOING**. Ваша задача — сделать к нему фронтенд по макету.

- 📄 **Документация API для фронтенда:** [API.md](API.md)
- **Задание:** [TASK.md](TASK.md)
- **Макет:** (https://www.figma.com/design/SQey5yydzUUxo2BEWVv4wZ/KEEP-GOING-%E2%80%94-%D0%BC%D0%B0%D0%B3%D0%B0%D0%B7%D0%B8%D0%BD?node-id=0-1&t=KARsjQu432GkDcX4-1)

## Запуск

Нужен только **Node.js 22.13 или новее** (`node -v`). Устанавливать пакеты не нужно — проект без зависимостей, база данных SQLite встроена в Node.

```bash
npm start
```

Сервер поднимется на `http://localhost:3000`. Проверьте в браузере: http://localhost:3000/api/products

При первом запуске создаётся файл `data/store.db` с 12 товарами.

## Команды

| Команда | Что делает |
|---|---|
| `npm start` | Запустить сервер |
| `npm run dev` | Запустить с автоперезапуском при изменении кода |
| `npm run reset` | Удалить базу и залить товары заново (если всё раскупили или намусорили) |
| `npm test` | Прогнать проверки API |

## Настройки

Через переменные окружения:

```bash
PORT=4000 npm start          # другой порт
DELAY_MS=800 npm start       # задержка каждого ответа — проверить лоадеры и скелетоны
DB_PATH=/tmp/my.db npm start # другой файл базы
```

На Windows (PowerShell): `$env:DELAY_MS=800; npm start`.

## Что внутри

```
src/
  server.js          HTTP-сервер, маршруты, CORS, раздача картинок
  router.js          мини-роутер
  db.js              схема SQLite
  seed.js            начальные товары — можно добавить свои
  handlers/          логика эндпоинтов: catalog, cart, orders, auth, newsletter
public/images/       картинки товаров (SVG)
test/smoke.mjs       проверки API
```

## Если что-то не работает

- **`Cannot find module 'node:sqlite'`** или `SyntaxError` — старый Node. Обновитесь до 22.13+.
- **`EADDRINUSE`** — порт 3000 занят. Запустите с `PORT=4000` и поменяйте адрес на фронте.
- **Корзина вернула `CART_NOT_FOUND`** после `npm run reset` — это нормально, удалите `cartId` из `localStorage` (подробнее в API.md).
- **CORS-ошибка в консоли** — скорее всего, сервер просто не запущен или упал: посмотрите в терминал.
