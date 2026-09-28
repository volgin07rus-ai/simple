# Simple: IT-офис по подписке

Сайт Simple: сайты, автоматизация, интеграции, боты и AI для компании за 60 000 ₽ в месяц.
Статический сайт без сборки: HTML, CSS и JavaScript без фреймворков.

Живая версия: https://volgin.site/simple/

## Страницы

- `index.html`: главная
- `works.html`: все работы
- `brief.html`: бриф «Обсудить задачу»

## Запуск у себя

Подойдёт любой статический сервер из папки сайта, например:

```bash
npx http-server . -p 5195
```

## Заявки с брифа

Бриф отправляет заявку на `tz.simplemind.ru/api/brief`. Приёмник принимает запросы только со своего домена,
поэтому рабочая отправка возможна, когда страница открыта на tz.simplemind.ru. На других адресах форма
покажет ошибку отправки, а ответы останутся сохранены в браузере.

## Сторонний код

Фоны и эффекты перенесены из [React Bits](https://reactbits.dev) без React (MIT + Commons Clause):
PixelBlast, FaultyTerminal, ShapeWaves, DriftWall, TechText, StaggeredMenu.
Библиотека `vendor/vgpu.js` из [vercel-labs/vgpu](https://github.com/vercel-labs/vgpu), лицензия MIT.
