---
title: MTProto faketls-домен дрейфует - Telegram не подключается
description: Hiddify хранит faketls-домен в БД и в config.toml; смена в БД без apply_configs приводит к разъезду - ссылка показывает зеленый статус, но не работает.
tags:
  - mtproto
  - faketls
  - troubleshooting
---

# MTProto faketls-домен дрейфует - Telegram не подключается

Поставили MTProto-прокси через Hiddify, дали клиенту `tg://`-ссылку. Внешний мониторинг рапортует ноду зеленой (сервис активен, секрет в конфиге, IP резолвится правильно), но реально Telegram через эту ссылку подключиться не может.

## Симптомы

- В админке Hiddify MTProto включен, секрет показан.
- На сервере `mtproxy.service` в `active`, haproxy перенаправляет SNI на :443 куда нужно.
- Клиент Telegram пробует подключиться по ссылке - "сервер не отвечает" или вечный коннект.

## Почему это происходит

Hiddify хранит faketls-домен MTProto в двух местах:

1. `str_config.telegram_fakedomain` в MariaDB `hiddifypanel` - источник правды, его меняет панель.
2. Рендеренный `/opt/hiddify-manager/other/telegram/telemt/config.toml`, поле `[censorship] tls_domain` - то, что реально читает telemt-демон и из чего собирается haproxy SNI-роут.

Шаблон `config.toml.j2` правильный (`tls_domain = "{{ hconfigs['telegram_fakedomain'] }}"`), но рендер запускается только командой `apply_configs.sh`. Смена `telegram_fakedomain` через панель или прямой SQL не триггерит re-render автоматически. До следующего ручного apply нода живет с тем faketls, который был при последнем apply - часто это случайный дефолт из встроенного списка Hiddify.

Полный клиентский секрет MTProto = `ee` + `user_hex` + `hex(faketls_domain)`. Если faketls на ноде отличается от того, под который сгенерирован клиентский секрет:

- Клиент строит SNI по faketls из секрета.
- Haproxy на ноде сверяет SNI с тем faketls, что у него в конфиге.
- SNI клиента в backend telemt не попадает - уходит в decoy.
- Handshake MTProto не происходит.

## Что делать

### 1. Найти расхождение

```bash
# что в БД (источник правды)
mysql hiddifypanel -e "SELECT value FROM str_config WHERE \`key\`='telegram_fakedomain';"

# что в рендеренном конфиге telemt
grep tls_domain /opt/hiddify-manager/other/telegram/telemt/config.toml
```

Эти два значения должны совпадать. Если в БД пусто или не то, что вы ожидали - сначала исправьте там через панель или SQL.

### 2. Запустить apply_configs

```bash
cd /opt/hiddify-manager
nohup bash apply_configs.sh --no-gui --no-log </dev/null >/tmp/apply.log 2>&1 & disown
```

Флаги обязательны - см. [apply_configs.sh - всегда с --no-gui --no-log](../engine/apply-configs-no-gui.md). Длится 1-3 минуты.

### 3. Проверить

```bash
grep tls_domain /opt/hiddify-manager/other/telegram/telemt/config.toml
systemctl is-active mtproxy hiddify-haproxy
grep "ssl_sni" /opt/hiddify-manager/haproxy/haproxy.cfg | head -1
```

Все три должны быть консистентны с тем faketls, что вы ставили в БД.

## Если не помогло

Иногда после apply у `mtproxy` статус `failed (203/EXEC)`: отсутствует бинарь telemt. Apply иногда не доустанавливает модуль:

```bash
cd /opt/hiddify-manager/other/telegram/telemt
bash install.sh
systemctl restart mtproxy
```

## Источники

На основе опыта автора hiddify-faq.

---

Не помогло или есть уточняющий вопрос - заходите в русское сообщество [@hiddify_rus](https://t.me/hiddify_rus).
