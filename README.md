# Hiddify FAQ

Русскоязычный FAQ по установке, настройке и эксплуатации [Hiddify VPN](https://github.com/hiddify/Hiddify-Manager). Решения повторяющихся проблем из обсуждений сообщества.

**Сайт**: https://dewil.github.io/hiddify-faq/

## О чем

Чат разработчиков [@hiddify_board](https://t.me/hiddify_board) - мультиязычный (фарси, английский, русский), материала много, но он растворен в потоке сообщений. Здесь собраны и пересказаны на русском типовые сюжеты: симптом, причина, что делать.

Каждая страница - один сюжет, читается за минуту. В конце страницы - ссылки на исходные сообщения чата.

## Локальный просмотр

Требуется Python 3.10+.

```bash
git clone git@github.com:dewil/hiddify-faq.git
cd hiddify-faq
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/mkdocs serve
```

Открыть http://127.0.0.1:8000/.

## Сборка и публикация

При каждом push в `main` GitHub Action собирает сайт через `mkdocs gh-deploy` и обновляет ветку `gh-pages`. Готовый сайт раздается через GitHub Pages.

Ручной деплой при необходимости:

```bash
.venv/bin/mkdocs gh-deploy --force
```

## Как помочь

- Нашли ошибку, устаревший шаг или непонятную формулировку - [issue](https://github.com/dewil/hiddify-faq/issues).
- Есть готовая поправка - PR в `main`.
- Хотите добавить новый сюжет - открывайте issue с описанием симптома и ссылкой на обсуждение в чате, либо сразу PR.

## Лицензия

Контент - CC BY 4.0. Используйте, цитируйте, переводите со ссылкой на источник.
