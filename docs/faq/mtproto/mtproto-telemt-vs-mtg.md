---
title: Hiddify MTProto - telemt против mtg, два формата конфига
description: Hiddify ставит один из двух MTProto-демонов с разными форматами конфига и моделью секретов - важно понимать, какой работает на ноде.
tags:
  - mtproto
  - telemt
  - mtg
---

# Hiddify MTProto - telemt против mtg, два формата конфига

Под общим юнитом `mtproxy.service` Hiddify-manager на ноде поднимает один из двух MTProto-демонов. У них разные форматы конфига и разная модель секретов - это важно понимать, когда лезете править вручную или дебажить.

## Что нужно

- Понимание, что haproxy на :443 в обоих случаях заворачивает MTProto-трафик на `127.0.0.1:1001`, дальше работает то, что слушает этот порт.
- Доступ root на ноду, чтобы посмотреть, какой именно демон активен.

## Шаги

### Шаг 1. Определить активный демон

```bash
cat /etc/systemd/system/mtproxy.service | grep ExecStart
```

В `ExecStart` либо `mtg`, либо `telemt` - это и есть активный демон. Дополнительный признак: смотреть, в каком из конфигов лежат осмысленные данные:

```bash
head -5 /opt/hiddify-manager/other/telegram/tgo/mtg.toml
head -10 /opt/hiddify-manager/other/telegram/telemt/config.toml
```

Часто оба файла существуют, но один из них - dead/example (первая строка `# This is an example...`), а второй - живой.

### Шаг 2. Понять формат активного

**mtg (legacy)** - single-secret сервер. Конфиг `/opt/hiddify-manager/other/telegram/tgo/mtg.toml`:

```toml
secret = "ee<random_32_hex><faketls_hex>"
```

На ноде валиден ровно один клиентский секрет. Версия настройки - `telegram_lib=tgo` в hconfig.

**telemt (текущий дефолт Hiddify)** - мульти-юзер сервер. Конфиг `/opt/hiddify-manager/other/telegram/telemt/config.toml`:

```toml
[censorship]
tls_domain = "ваш-faketls-домен"

[access.users]
default = "<user_hex>"
<user_hex> = "<user_hex>"
```

Полный клиентский секрет каждого юзера: `ee` + `user_hex` + `hex(tls_domain)`. На ноде одновременно валидны множество секретов - по одному на юзера. `tg://`-ссылка работает, если ее `secret=` соответствует любому юзеру из таблицы.

### Шаг 3. Править правильный файл

Если активен telemt - править `[access.users]` в `telemt/config.toml` (и парный `config.toml.j2`), не трогать `mtg.toml`. И наоборот. После правки запустить `apply_configs.sh --no-gui --no-log`, чтобы шаблон перерендерился (см. [apply_configs.sh - всегда с --no-gui --no-log](../engine/apply-configs-no-gui.md)).

## Проверка

```bash
systemctl is-active mtproxy
ss -tlnp | grep ':1001'
```

Демон должен быть active и слушать :1001. После любых правок секретов протестировать `tg://`-ссылкой из реального Telegram-клиента - внешние мониторинги не всегда ловят расхождение между faketls в конфиге и faketls в секрете. Подробнее про этот класс ошибок: [MTProto faketls-домен дрейфует](mtproto-faketls-drift.md).

## Источники

На основе опыта автора hiddify-faq.
