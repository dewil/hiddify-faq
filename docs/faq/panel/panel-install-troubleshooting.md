---
title: Hiddify Panel не ставится или отдает 503
description: Что делать, если установка падает с ошибками HAProxy/nginx, панель уходит в 503 или Apply Config работает вхолостую.
tags:
  - install
  - panel
  - troubleshooting
  - 503
---

# Hiddify Panel не ставится или отдает 503

Установка Hiddify Manager на VPS - частая боль. Установщик зависает на рендеринге `*.j2`, после установки панель отдает 503, или Apply Config в веб-морде проходит "успешно", но настройки не сохраняются.

## Симптомы

- В консоли установки бесконечный поток `Rendering: nginx.conf.j2`, `install.sh.j2`, `mtg.toml.j2` без выхода в меню.
- `installation failed code 254`, либо консоль зависает, сервер пингуется, но SSH в таймаут.
- Панель отдает HTTP 503; через SSH видно `hiddify-nginx failed` или `hiddify-haproxy activating`.
- Apply Config из веб-морды "сохранено", но домены/протоколы не меняются (silent fail).

## Почему это происходит

- На некоторых хостингах скрипт неправильно подключает репозиторий HAProxy и ловит конфликт версий.
- 12.3.0 несет баг в Pydantic-модели (`idle_timeout` в DnsTT): Apply Config молча падает, Direct/CDN/Relay-домены сохраняются на UI, но не применяются. Лечится 12.3.1.
- 503 - чаще всего последствие смерти `hiddify-nginx` или `hiddify-haproxy`, они тянут панель за собой.

## Что делать

1. Проверьте версию. Если 12.3.0 - обновитесь до 12.3.1 (хотфикс apply-config). Обновление через веб у 12.3.0 ломается; через SSH: меню `hiddify` -> install specific version -> 12.3.1.
2. Ловите состояние сервисов: `systemctl status hiddify-nginx hiddify-haproxy hiddify-panel hiddify-panel-background-tasks` и `/opt/hiddify-manager/status.sh`.
3. Если nginx не поднимается даже после reinstall - чистая переустановка ОС (Ubuntu 22.04) + бэкап. Скрипт подхватит положенный рядом `*.json` бэкап.

## Если не помогло

- Зависание на `Rendering: *.j2` - проверьте свободное место и память, ставьте на Ubuntu 22.04, не 24.04/25.x.
- Если стабильная версия не встает - попробуйте бету, часто баги уже пофикшены.
- WARP-ошибка `mv: cannot stat 'wgcf-account.toml'` - отдельный сюжет, см. [warp-mode-crash-wgcf](../warp/warp-mode-crash-wgcf.md).

## Источники

!!! note "Ссылки на сообщения не открываются"
    Русский топик в @hiddify_board удалён - прямые ссылки на его сообщения ниже больше не работают. Материал из них сохранён и пересказан на этой странице. Обсуждение - в [@hiddify_rus](https://t.me/hiddify_rus).

Из обсуждений в [@hiddify_board](https://t.me/hiddify_board), русский топик: [434471](https://t.me/hiddify_board/433634/434471), [438965](https://t.me/hiddify_board/433634/438965), [457583](https://t.me/hiddify_board/433634/457583), [523009](https://t.me/hiddify_board/433634/523009), [523171](https://t.me/hiddify_board/433634/523171), [572255](https://t.me/hiddify_board/433634/572255), [588056](https://t.me/hiddify_board/433634/588056).

---

Не помогло или есть уточняющий вопрос - заходите в русское сообщество [@hiddify_rus](https://t.me/hiddify_rus).
