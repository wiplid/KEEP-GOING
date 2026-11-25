const CATEGORIES = [
  ['bands', 'Band'],
  ['challenges', '30 day challenge'],
  ['t-shirts', 'T-shirt'],
  ['hoodies', 'Hoodie'],
  ['towels', 'Towel'],
  ['bottles', 'Bottle'],
];

const TEE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const BAND_SIZES = ['S', 'M', 'L'];

const PRODUCTS = [
  ['keep-going-band-black', 'KEEP GOING BAND® Black', 'bands', 590, null,
    ['band-black.svg'], BAND_SIZES, 120, 0,
    'Силиконовый браслет-напоминание. Надеваешь утром — и весь день помнишь, зачем начинал. Гравировка, не стирается.'],
  ['keep-going-band-white', 'KEEP GOING BAND® White', 'bands', 590, null,
    ['band-white.svg'], BAND_SIZES, 80, 0,
    'Тот же браслет, только белый. Мягкий силикон, не натирает на тренировке.'],
  ['keep-going-band-3-pack', 'KEEP GOING BAND® 3-Pack', 'bands', 1490, 1770,
    ['band-pack.svg'], BAND_SIZES, 40, 1,
    'Три браслета: себе, другу и тому, кто бросит первым. Выгоднее, чем по одному.'],
  ['30-day-challenge', '30 DAY CHALLENGE', 'challenges', 990, null,
    ['challenge.svg'], null, 999, 0,
    'Цифровая программа на 30 дней: ежедневные задания, трекер привычек и чек-лист. Ссылка приходит на почту после оплаты.'],
  ['keep-going-method', 'KEEP GOING METHOD', 'challenges', 1490, null,
    ['method.svg'], null, 999, 1,
    'Гайд о том, как не бросать: 12 глав, рабочие тетради и шаблоны планирования недели. PDF.'],
  ['kg-tee-black', 'KG TEE Black', 't-shirts', 2490, null,
    ['tee-black.svg', 'tee-black-back.svg'], TEE_SIZES, 60, 0,
    'Плотная футболка 220 г/м², 100% хлопок. Принт KEEP GOING на груди и на спине.'],
  ['kg-tee-white', 'KG TEE White', 't-shirts', 2490, null,
    ['tee-white.svg', 'tee-white-back.svg'], TEE_SIZES, 45, 0,
    'Белая версия базовой футболки. Не просвечивает, держит форму после стирок.'],
  ['kg-tee-oversize', 'KG OVERSIZE TEE', 't-shirts', 2990, null,
    ['tee-oversize.svg'], TEE_SIZES, 3, 1,
    'Свободный крой со спущенным плечом. Осталось совсем немного.'],
  ['kg-hoodie', 'KG HOODIE', 'hoodies', 5490, 6290,
    ['hoodie.svg'], TEE_SIZES, 25, 0,
    'Худи из трёхнитки с начёсом. Капюшон с двойным слоем, карман-кенгуру.'],
  ['kg-towel', 'KG TOWEL', 'towels', 1290, null,
    ['towel.svg'], null, 70, 0,
    'Спортивное полотенце из микрофибры 40×90 см. Быстро сохнет, помещается в любую сумку.'],
  ['kg-towel-xl', 'KG GYM TOWEL XL', 'towels', 1890, null,
    ['towel-xl.svg'], null, 0, 0,
    'Большое полотенце 70×140 см. Сейчас нет в наличии — ждём новую партию.'],
  ['kg-bottle', 'KG BOTTLE 750 ML', 'bottles', 1190, null,
    ['bottle.svg'], null, 90, 1,
    'Бутылка из тритана без BPA, 750 мл. Шкала литража сбоку — видно, сколько выпил за день.'],
];

export function seed(db) {
  const insCat = db.prepare('INSERT INTO categories (slug, name, position) VALUES (?, ?, ?)');
  const insProd = db.prepare(`
    INSERT INTO products (slug, name, description, price, old_price, category_id, images, sizes, stock, is_new, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  const catIds = {};
  CATEGORIES.forEach(([slug, name], i) => {
    catIds[slug] = Number(insCat.run(slug, name, i).lastInsertRowid);
  });

  const start = Date.parse('2026-09-01T10:00:00Z');
  PRODUCTS.forEach(([slug, name, cat, price, oldPrice, images, sizes, stock, isNew, description], i) => {
    const createdAt = new Date(start + i * 3 * 24 * 3600 * 1000).toISOString();
    insProd.run(
      slug, name, description, price, oldPrice, catIds[cat],
      JSON.stringify(images), sizes ? JSON.stringify(sizes) : null,
      stock, isNew, createdAt,
    );
  });
  db.exec('COMMIT');
}
