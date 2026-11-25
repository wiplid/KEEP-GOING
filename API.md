# API для фронтенда

Документация для тех, кто верстает и собирает фронтенд магазина. Бэкенд уже готов: запусти его локально (см. [README](README.md)) и ходи в него `fetch`-ем.

**Базовый адрес:** `http://localhost:3000`
Все эндпоинты начинаются с `/api`. Список всех маршрутов: `GET /api`.

## Общие правила

- Запросы и ответы — **JSON**. Для `POST` и `PATCH` с телом передавай заголовок `Content-Type: application/json`.
- **Цены — целые числа в рублях**: `2490` → «2 490 ₽». Форматируй сам: `new Intl.NumberFormat('ru-RU').format(price) + ' ₽'`.
- **Картинки** приходят полными URL (`http://localhost:3000/images/tee-black.svg`) — можно сразу класть в `<img src>`.
- **Даты** — строки ISO 8601 в UTC: `"2026-09-16T10:00:00.000Z"`.
- **CORS открыт** для всех источников — фронт можно запускать на любом порту (Vite, Live Server и т. д.).
- Если в ответе поле `null` — значения нет (например, `oldPrice: null` значит «скидки нет»).

---

## Ошибки

Любая ошибка приходит в одном формате:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Проверьте правильность заполнения полей",
    "details": {
      "customer.email": "Некорректный email",
      "delivery.address": "Укажите адрес доставки"
    }
  }
}
```

- `code` — машинный код, по нему удобно ветвить логику.
- `message` — текст на русском, можно показывать пользователю.
- `details` — есть не всегда. При ошибке валидации это объект **«поле → текст ошибки»**: подсвечивай нужные инпуты.

| HTTP | `code` | Когда |
|---|---|---|
| 400 | `INVALID_JSON` | Тело — не JSON или не объект |
| 400 | `BAD_QUERY` | Неверный параметр в строке запроса (например, `sort`) |
| 401 | `UNAUTHORIZED` | Нет токена или токен устарел |
| 401 | `INVALID_CREDENTIALS` | Неверный email или пароль |
| 404 | `NOT_FOUND`, `PRODUCT_NOT_FOUND`, `CART_NOT_FOUND`, `CART_ITEM_NOT_FOUND`, `ORDER_NOT_FOUND` | Нет такого ресурса |
| 405 | `METHOD_NOT_ALLOWED` | Маршрут есть, но не с этим методом |
| 409 | `OUT_OF_STOCK` | Не хватает товара на складе. В `details.available` — сколько есть |
| 409 | `CART_EMPTY` | Попытка оформить пустую корзину |
| 409 | `EMAIL_TAKEN` | Email уже зарегистрирован |
| 409 | `ALREADY_SUBSCRIBED` | Email уже подписан на рассылку |
| 422 | `VALIDATION_ERROR` | Поля заполнены неверно, см. `details` |
| 500 | `INTERNAL_ERROR` | Ошибка на сервере |

> `fetch` **не бросает исключение** на 4xx/5xx. Проверяй `response.ok` сам — см. [шпаргалку](#шпаргалка-обёртка-над-fetch).

---

## Каталог

### Объект «Товар» (Product)

| Поле | Тип | Описание |
|---|---|---|
| `id` | number | ID товара. Нужен для добавления в корзину |
| `slug` | string | Человекочитаемый идентификатор для URL: `/product/kg-tee-black` |
| `name` | string | Название |
| `description` | string | Описание |
| `price` | number | Цена, ₽ |
| `oldPrice` | number \| null | Цена до скидки. Если есть — показывай зачёркнутой |
| `category` | `{ slug, name }` | Категория |
| `image` | string | Главная картинка (то же, что `images[0]`) |
| `images` | string[] | Все картинки — для галереи на странице товара |
| `sizes` | string[] \| null | Доступные размеры. `null` — у товара нет размеров, выбор не показываем |
| `stock` | number | Сколько осталось на складе |
| `inStock` | boolean | Есть ли в наличии (`stock > 0`) |
| `isNew` | boolean | Новинка — можно показать бейдж NEW |
| `createdAt` | string | Дата добавления |

---

### `GET /api/categories` — категории для фильтра

Для чипсов над сеткой товаров: «All (12)», «Band (3)», …

**Ответ 200**

```json
{
  "total": 12,
  "items": [
    { "slug": "bands",      "name": "Band",             "productsCount": 3 },
    { "slug": "challenges", "name": "30 day challenge", "productsCount": 2 },
    { "slug": "t-shirts",   "name": "T-shirt",          "productsCount": 3 },
    { "slug": "hoodies",    "name": "Hoodie",           "productsCount": 1 },
    { "slug": "towels",     "name": "Towel",            "productsCount": 2 },
    { "slug": "bottles",    "name": "Bottle",           "productsCount": 1 }
  ]
}
```

`total` — общее число товаров, для чипса «All».

---

### `GET /api/products` — список товаров

Все параметры необязательные, их можно комбинировать.

| Параметр | Пример | Описание |
|---|---|---|
| `category` | `bands` | `slug` категории |
| `search` | `tee` | Поиск по названию и описанию |
| `sort` | `price_asc` | `newest` (по умолчанию), `price_asc`, `price_desc`, `name` |
| `page` | `2` | Номер страницы, с 1 |
| `limit` | `6` | Товаров на странице: 1–50, по умолчанию 12 |
| `minPrice`, `maxPrice` | `1000` | Диапазон цены, ₽ |
| `inStock` | `true` | Только товары в наличии |
| `isNew` | `true` | Только новинки |

**Пример:** `GET /api/products?category=bands&limit=2`

**Ответ 200**

```json
{
  "items": [
    {
      "id": 3,
      "slug": "keep-going-band-3-pack",
      "name": "KEEP GOING BAND® 3-Pack",
      "description": "Три браслета: себе, другу и тому, кто бросит первым. Выгоднее, чем по одному.",
      "price": 1490,
      "oldPrice": 1770,
      "category": { "slug": "bands", "name": "Band" },
      "image": "http://localhost:3000/images/band-pack.svg",
      "images": ["http://localhost:3000/images/band-pack.svg"],
      "sizes": ["S", "M", "L"],
      "stock": 40,
      "inStock": true,
      "isNew": true,
      "createdAt": "2026-09-07T10:00:00.000Z"
    }
  ],
  "total": 3,
  "page": 1,
  "limit": 2,
  "pages": 2
}
```

- `total` — сколько товаров нашлось **с учётом фильтров** (это число в кружке рядом с заголовком «ALL»).
- `pages` — сколько всего страниц. Для кнопки «Показать ещё»: грузи, пока `page < pages`.
- Ничего не нашлось → `items: []`, `total: 0`. Это не ошибка: покажи пустое состояние.

**Ошибки:** `400 BAD_QUERY` — неизвестный `sort`.

> Поиск делай с задержкой (debounce ~300 мс), чтобы не слать запрос на каждую букву.

---

### `GET /api/products/:slug` — карточка товара

Вместо `slug` можно передать числовой `id`: `/api/products/6`.

**Пример:** `GET /api/products/kg-tee-black`

**Ответ 200** — объект Product плюс поле `related` (до 4 товаров из той же категории):

```json
{
  "id": 6,
  "slug": "kg-tee-black",
  "name": "KG TEE Black",
  "description": "Плотная футболка 220 г/м², 100% хлопок. Принт KEEP GOING на груди и на спине.",
  "price": 2490,
  "oldPrice": null,
  "category": { "slug": "t-shirts", "name": "T-shirt" },
  "image": "http://localhost:3000/images/tee-black.svg",
  "images": [
    "http://localhost:3000/images/tee-black.svg",
    "http://localhost:3000/images/tee-black-back.svg"
  ],
  "sizes": ["XS", "S", "M", "L", "XL", "XXL"],
  "stock": 60,
  "inStock": true,
  "isNew": false,
  "createdAt": "2026-09-16T10:00:00.000Z",
  "related": [ { "id": 8, "slug": "kg-tee-oversize", "name": "KG OVERSIZE TEE", "...": "..." } ]
}
```

**Ошибки:** `404 PRODUCT_NOT_FOUND`.

---

## Корзина

Корзина живёт на сервере и **не требует авторизации**. Схема такая:

1. При первом добавлении товара создай корзину: `POST /api/cart` → получишь `id`.
2. Сохрани `id` в `localStorage` (например, под ключом `cartId`).
3. Дальше все запросы — с этим `id` в адресе.
4. Если сервер вернул `404 CART_NOT_FOUND` (например, базу пересоздали) — удали `cartId` из `localStorage` и создай корзину заново.

Все эндпоинты корзины **возвращают корзину целиком** — просто перерисуй её из ответа.

### Объект «Корзина» (Cart)

```json
{
  "id": "8e022ee7-d36a-4dac-be9d-35d48bc95e77",
  "items": [
    {
      "id": 1,
      "quantity": 2,
      "size": "M",
      "lineTotal": 4980,
      "product": {
        "id": 6,
        "slug": "kg-tee-black",
        "name": "KG TEE Black",
        "price": 2490,
        "image": "http://localhost:3000/images/tee-black.svg",
        "stock": 60,
        "inStock": true
      }
    }
  ],
  "totalQuantity": 2,
  "total": 4980,
  "updatedAt": "2026-11-12T09:04:00.928Z"
}
```

| Поле | Описание |
|---|---|
| `items[].id` | ID **позиции в корзине** (не товара!). Нужен для изменения/удаления |
| `items[].size` | Выбранный размер или `null` |
| `items[].lineTotal` | `price × quantity` |
| `items[].product.stock` | Можно ограничить кнопку «+» этим числом |
| `totalQuantity` | Сумма количеств — число на иконке корзины в шапке: `CART (2)` |
| `total` | Сумма корзины, ₽ (без доставки) |

> Одинаковый товар **с одинаковым размером** — это одна позиция: повторное добавление увеличивает `quantity`. Футболка M и футболка L — две разные позиции.

---

### `POST /api/cart` — создать корзину

Тело не нужно. **Ответ 201** — пустая корзина (`items: []`, `total: 0`).

### `GET /api/cart/:cartId` — получить корзину

**Ответ 200** — Cart. **Ошибки:** `404 CART_NOT_FOUND`.

### `POST /api/cart/:cartId/items` — добавить товар

```json
{ "productId": 6, "size": "M", "quantity": 2 }
```

| Поле | Обязательно | Описание |
|---|---|---|
| `productId` | да | `id` товара (число) |
| `size` | если у товара есть `sizes` | Одно из значений `product.sizes` |
| `quantity` | нет | 1–99, по умолчанию 1 |

**Ответ 200** — обновлённая Cart.

**Ошибки:**
- `422 VALIDATION_ERROR` — не выбран размер: `details.size = "Доступные размеры: XS, S, M, L, XL, XXL"`
- `409 OUT_OF_STOCK` — не хватает на складе:
  ```json
  { "error": { "code": "OUT_OF_STOCK", "message": "В наличии только 3 шт.", "details": { "available": 3 } } }
  ```
- `404 PRODUCT_NOT_FOUND`, `404 CART_NOT_FOUND`

### `PATCH /api/cart/:cartId/items/:itemId` — изменить количество

```json
{ "quantity": 3 }
```

`quantity: 0` удаляет позицию. **Ответ 200** — Cart. **Ошибки:** `409 OUT_OF_STOCK`, `404 CART_ITEM_NOT_FOUND`, `422`.

### `DELETE /api/cart/:cartId/items/:itemId` — удалить позицию

**Ответ 200** — Cart.

### `DELETE /api/cart/:cartId` — очистить корзину

Удаляет все позиции, сама корзина остаётся. **Ответ 200** — пустая Cart.

---

## Доставка и заказы

### `GET /api/delivery` — способы доставки

```json
{
  "options": [
    { "type": "pickup",  "name": "Самовывоз", "price": 0 },
    { "type": "courier", "name": "Курьер",    "price": 300, "freeFrom": 5000 }
  ]
}
```

Курьер стоит 300 ₽, **бесплатно от 5000 ₽**. Посчитай это на фронте для блока «Итого», а финальную сумму всё равно бери из ответа сервера при оформлении.

---

### `POST /api/orders` — оформить заказ

Авторизация **не обязательна**. Если передать заголовок `Authorization: Bearer <token>`, заказ привяжется к пользователю и появится в его истории.

```json
{
  "cartId": "8e022ee7-d36a-4dac-be9d-35d48bc95e77",
  "customer": {
    "name": "Аня",
    "email": "anya@mail.ru",
    "phone": "+7 900 123-45-67"
  },
  "delivery": {
    "type": "courier",
    "address": "Челябинск, ул. Ленина, 1"
  },
  "comment": "Позвонить за час"
}
```

| Поле | Правило |
|---|---|
| `cartId` | обязательно |
| `customer.name` | минимум 2 символа |
| `customer.email` | валидный email |
| `customer.phone` | 10–15 цифр, любые скобки/пробелы/дефисы допустимы |
| `delivery.type` | `pickup` или `courier` |
| `delivery.address` | обязателен при `courier`, минимум 5 символов |
| `comment` | необязательно, до 500 символов |

**Ответ 201** — заказ. Корзина после этого **очищается** (её `id` остаётся рабочим).

```json
{
  "id": "e8a62221-cb0f-439b-bc12-9a59ce738258",
  "number": "KG-00001",
  "status": "new",
  "statusLabel": "Новый",
  "customer": { "name": "Аня", "email": "anya@mail.ru", "phone": "+7 900 123-45-67" },
  "delivery": { "type": "courier", "address": "Челябинск, ул. Ленина, 1", "price": 300 },
  "comment": "Позвонить за час",
  "items": [
    {
      "productId": 6,
      "slug": "kg-tee-black",
      "name": "KG TEE Black",
      "image": "http://localhost:3000/images/tee-black.svg",
      "price": 2490,
      "size": "M",
      "quantity": 2,
      "lineTotal": 4980
    }
  ],
  "subtotal": 4980,
  "deliveryPrice": 300,
  "total": 5280,
  "createdAt": "2026-11-12T09:04:00.975Z"
}
```

- `id` — для ссылки на страницу «Спасибо за заказ»: `/order/e8a62221-...`
- `number` — номер, который показываем человеку: «Заказ KG-00001 оформлен».
- `status`: `new`, `paid`, `shipped`, `done`, `cancelled`. Готовый русский текст — в `statusLabel`.

**Ошибки:**
- `422 VALIDATION_ERROR` — ключи в `details` совпадают с путями полей: `customer.name`, `customer.email`, `customer.phone`, `delivery.type`, `delivery.address`, `comment`, `cartId`.
- `409 CART_EMPTY` — корзина пуста.
- `409 OUT_OF_STOCK` — пока человек думал, товар раскупили. В `details.items` список проблемных позиций:
  ```json
  { "items": [ { "itemId": 4, "productId": 8, "name": "KG OVERSIZE TEE", "available": 1 } ] }
  ```
- `404 CART_NOT_FOUND`.

### `GET /api/orders/:id` — заказ по id

Для страницы «Спасибо за заказ». **Ответ 200** — заказ. **Ошибки:** `404 ORDER_NOT_FOUND`.

### `GET /api/orders` — мои заказы 

Нужен токен. **Ответ 200:** `{ "items": [ Order, ... ] }`, новые сверху. **Ошибки:** `401 UNAUTHORIZED`.

---

## Авторизация

Токен-авторизация. После регистрации или входа приходит `token` — сохрани его в `localStorage` и передавай в заголовке:

```
Authorization: Bearer c8df7dfca658d59a21a11a7e0fe59f70af2b87ef8c611be5
```

Эндпоинты с 🔒 без токена отвечают `401 UNAUTHORIZED`. Получил 401 на защищённом запросе — удали токен и покажи форму входа.

### Объект «Пользователь» (User)

```json
{ "id": 1, "name": "Аня", "email": "anya@mail.ru", "createdAt": "2026-11-12T09:04:01.055Z" }
```

### `POST /api/auth/register` — регистрация

```json
{ "name": "Аня", "email": "anya@mail.ru", "password": "secret1" }
```

Правила: имя от 2 символов, валидный email, пароль от 6 символов.

**Ответ 201:**

```json
{
  "token": "c8df7dfca658d59a21a11a7e0fe59f70af2b87ef8c611be5",
  "user": { "id": 1, "name": "Аня", "email": "anya@mail.ru", "createdAt": "2026-11-12T09:04:01.055Z" }
}
```

**Ошибки:** `422 VALIDATION_ERROR` (поля `name`, `email`, `password`), `409 EMAIL_TAKEN`.

### `POST /api/auth/login` — вход

```json
{ "email": "anya@mail.ru", "password": "secret1" }
```

**Ответ 200** — как у регистрации: `{ token, user }`. **Ошибки:** `401 INVALID_CREDENTIALS`, `422`.

### `GET /api/auth/me` — текущий пользователь 🔒

Вызывай при загрузке приложения, если в `localStorage` есть токен. **Ответ 200** — User.

### `POST /api/auth/logout` — выход 🔒

Делает токен недействительным. **Ответ 204** без тела.

---

## Подписка на рассылку

### `POST /api/newsletter`

Форма «Sign up to our newsletter» в подвале.

```json
{ "email": "anya@mail.ru" }
```

**Ответ 201:** `{ "email": "anya@mail.ru", "subscribed": true }`
**Ошибки:** `422 VALIDATION_ERROR` (поле `email`), `409 ALREADY_SUBSCRIBED`.

---

## Какой экран — какие запросы

| Экран | Запросы |
|---|---|
| **Шапка** (на всех страницах) | `GET /api/cart/:cartId` → `totalQuantity` для `CART (n)`; `GET /api/auth/me`, если есть токен |
| **Каталог** | `GET /api/categories` → чипсы; `GET /api/products?category=&search=&sort=&page=` → сетка и число в кружке |
| **Товар** | `GET /api/products/:slug` → галерея, размеры, наличие, `related`; кнопка «В корзину» → `POST /api/cart/:cartId/items` |
| **Корзина** | `GET /api/cart/:cartId`; ± → `PATCH .../items/:itemId`; удалить → `DELETE .../items/:itemId` |
| **Оформление** | `GET /api/delivery`; отправка формы → `POST /api/orders`; затем редирект на `/order/:id` |
| **Спасибо за заказ** | `GET /api/orders/:id` |
| **Вход / регистрация** | `POST /api/auth/login`, `POST /api/auth/register` |
| **Личный кабинет** | `GET /api/auth/me`, `GET /api/orders`, `POST /api/auth/logout` |
| **Подвал** | `POST /api/newsletter` |

Не забудь про состояния: **загрузка** (скелетоны), **пусто** («Ничего не нашлось», «Корзина пуста»), **ошибка** (сервер недоступен), **нет в наличии** (`inStock: false` — кнопка неактивна).

---

## Шпаргалка: обёртка над fetch

```js
const API_URL = 'http://localhost:3000';

export class ApiError extends Error {
  constructor(status, error) {
    super(error.message);
    this.status = status;
    this.code = error.code;
    this.details = error.details ?? {};
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(API_URL + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error);
  return data;
}

// Корзина: создаём при первом обращении и переживаем пересоздание базы
export async function getCartId() {
  let id = localStorage.getItem('cartId');
  if (!id) {
    id = (await api('/api/cart', { method: 'POST' })).id;
    localStorage.setItem('cartId', id);
  }
  return id;
}

export async function addToCart(productId, size, quantity = 1) {
  const send = async () =>
    api(`/api/cart/${await getCartId()}/items`, { method: 'POST', body: { productId, size, quantity } });
  try {
    return await send();
  } catch (e) {
    if (e.code !== 'CART_NOT_FOUND') throw e;
    localStorage.removeItem('cartId');
    return send();
  }
}
```

Использование с ошибками валидации:

```js
try {
  const order = await api('/api/orders', { method: 'POST', body: form });
  location.href = `/order/${order.id}`;
} catch (e) {
  if (e.code === 'VALIDATION_ERROR') {
    for (const [field, message] of Object.entries(e.details)) {
      showFieldError(field, message); // 'customer.email' → инпут name="customer.email"
    }
  } else {
    showToast(e.message);
  }
}
```
