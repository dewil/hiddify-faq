---
title: Hiddify не запускается, ошибка Checking WARP / wgcf-account.toml
description: Что делать, если установка или запуск Hiddify падает с WARP ERROR и "mv: cannot stat 'wgcf-account.toml'".
tags:
  - warp
  - install
  - panel
---

# Hiddify не запускается, ошибка Checking WARP / wgcf-account.toml

Конкретный сбой при установке Hiddify Manager: WARP не поднимается, в логе одна ошибка про `wgcf-account.toml`. Иногда из-за этого панель отдает 503.

## Симптомы

- В выводе установки или `warp status` повторяется:
  ```
  Checking WARP ...
  mv: cannot stat 'wgcf-account.toml': No such file or directory
  Generating WARP config...
  WARP is not working!
  !!!!!!!!!!!!!!! WARP ERROR
  ```
- SSH-проверка возвращает `Error: Key not found: core_type` и `Error: Key not found: warp_mode`.
- Hiddify Panel отдает HTTP 503.
- Параллельно валятся haproxy и база.

## Почему это происходит

`wgcf` регистрирует WARP-аккаунт у Cloudflare и сохраняет его в `wgcf-account.toml`. Hiddify двигает этот файл командой `mv`, но если регистрация не прошла или у процесса нет прав на запись - файла нет, `mv` падает. WARP не настраивается, панель не может проинициализировать `core_type` и `warp_mode`.

Причины: блокировка Cloudflare API с IP хостинга, нехватка прав у `hiddify`, отсутствие пакета `wgcf`, параллельный сбой панели или БД.

## Что делать

### Шаг 1: Пересоздайте профиль WARP

В админ-панели выключите WARP ("Disabled"), apply. Затем на сервере:

```bash
cd /opt/hiddify-manager/other/warp
rm -f wgcf-account.toml wgcf-profile.conf
```

Включите WARP обратно, снова apply. Панель повторит регистрацию у Cloudflare.

### Шаг 2: Если регистрация не проходит

Запросы к Cloudflare API могут резаться провайдером. Повторите через несколько минут. Для Zero Trust положите готовый `wgcf-account.toml` в `/opt/hiddify-manager/other/warp/` руками до apply.

## Если не помогло

- `systemctl status hiddify-haproxy hiddify-panel`. Если они в ошибке - чините их сначала.
- Убедитесь, что пакет `wgcf` установлен и доступен в PATH.

## Источники

!!! note "Ссылки на сообщения не открываются"
    Русский топик в @hiddify_board удалён - прямые ссылки на его сообщения ниже больше не работают. Материал из них сохранён и пересказан на этой странице. Обсуждение - в [@hiddify_rus](https://t.me/hiddify_rus).

Из обсуждений в [@hiddify_board](https://t.me/hiddify_board), русский топик: [505578](https://t.me/hiddify_board/433634/505578), [512297](https://t.me/hiddify_board/433634/512297), [572255](https://t.me/hiddify_board/433634/572255), [580156](https://t.me/hiddify_board/433634/580156), [583922](https://t.me/hiddify_board/433634/583922), [584585](https://t.me/hiddify_board/433634/584585), [584597](https://t.me/hiddify_board/433634/584597), [586659](https://t.me/hiddify_board/433634/586659).

---

Не помогло или есть уточняющий вопрос - заходите в русское сообщество [@hiddify_rus](https://t.me/hiddify_rus).
