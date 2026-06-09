---
title: Hiddify через mihomo - настройка цепочки
description: Как направить исходящий трафик hiddify-singbox и hiddify-xray через локальный mihomo SOCKS и проверить, что цепочка работает.
tags:
  - mihomo
  - outbounds
  - hiddify-manager
---

# Hiddify через mihomo - настройка цепочки

Типичный сценарий: Hiddify стоит на ноде в стране A, но клиентам нужен выход через ноду в стране B. Решение - поднять рядом mihomo с SOCKS-инбаундом, в котором настроена цепочка через зарубежный сервер, и направить outbound singbox/xray на этот локальный SOCKS.

## Что нужно

- `hiddify-manager` уже работает в `/opt/hiddify-manager/`.
- `mihomo` поднят и слушает SOCKS на `127.0.0.1:7890` (или `7891`). Проверка: `ss -tlnp | grep -E ':7890|:7891'`. Готовый настроенный mihomo (установка, конфиг, цепочка) можно взять из проекта [mihomo-cascade](https://github.com/dewil/mihomo-cascade).
- IPv6 отключен через sysctl (см. [Отключение IPv6 на Debian/Ubuntu](../install/disable-ipv6-debian.md)) - mihomo сам это распознает и не пытается включить TUN auto-route.

## Шаги

### Шаг 1. Бэкап

```bash
cp /opt/hiddify-manager/singbox/configs/06_outbounds.json{,.bak}
cp /opt/hiddify-manager/singbox/configs/06_outbounds.json.j2{,.bak}
cp /opt/hiddify-manager/xray/configs/06_outbounds.json{,.bak}
cp /opt/hiddify-manager/xray/configs/06_outbounds.json.j2{,.bak}
```

### Шаг 2. Переписать singbox-outbounds

В `06_outbounds.json` заменить блок `freedom` на SOCKS к mihomo:

```json
{
  "tag": "freedom",
  "type": "socks",
  "version": "5",
  "server": "127.0.0.1",
  "server_port": 7890,
  "udp_over_tcp": false
}
```

Шаблон `.j2` править параллельно - иначе следующий рендер затрет `.json`.

### Шаг 3. Переписать xray-outbounds

В `06_outbounds.json` старый `freedom` (`"protocol": "freedom"`) переименовать в `direct`, а на его место поставить SOCKS:

```json
{
  "tag": "freedom",
  "protocol": "socks",
  "settings": {
    "servers": [{ "address": "127.0.0.1", "port": 7890 }]
  }
}
```

Шаблон `.j2` править параллельно.

### Шаг 4. Перезапуск

```bash
systemctl restart hiddify-singbox hiddify-xray
systemctl is-active hiddify-singbox hiddify-xray
```

## Проверка

Четыре проверки, каждая ловит свою категорию ошибок.

```bash
# 1. Hiddify подключен к mihomo
ss -tnp | grep ':7890' | grep -E 'hiddify-core|xray'

# 2. Реальный IP сервера
curl -s --max-time 8 https://api.ipify.org

# 3. IP через mihomo напрямую
curl -s --max-time 12 --socks5-hostname 127.0.0.1:7890 https://api.ipify.org

# 4. IP через hiddify-инбаунд (главная проверка)
# найти локальный socks-инбаунд hiddify
ss -tlnp | grep -E 'hiddify-core|xray'
# дальше курлить через него
curl -s --max-time 12 --socks5-hostname 127.0.0.1:<port> https://api.ipify.org
```

Ожидание: IP из шага 4 совпадает с IP из шага 3 (это exit mihomo) и НЕ совпадает с шагом 2 (реальный IP сервера).

Чтобы убедиться, что exit-IP цепочки действительно в нужной стране, пробейте его по гео - см. [Как проверить, из какой страны реально выходит нода](../install/verify-node-exit-geo.md).

## Почему правки сбрасываются

Самый частый симптом: "настроил цепочку через mihomo, все работало, а через время отвалилось". Клиенты снова получают реальный IP сервера вместо exit'а mihomo, AI-сервисы возвращают ошибки доступа, мобильный Telegram (особенно звонки по UDP) перестает работать. Это не сетевой сбой - это `hiddify-panel` перерендерил конфиг из шаблона и затер вашу правку.

Механика: `hiddify-panel` периодически рендерит шаблоны `*.json.j2 -> *.json`. Итоговый `06_outbounds.json` для движка - это **результат рендера**, а не первоисточник. Если поправить только `.json`, при следующем рендере (плановом, при `apply_configs`, при обновлении Hiddify) он будет перезаписан содержимым из `.json.j2` - и правка исчезнет.

Поэтому всегда правится **пара** файлов:

- singbox: `/opt/hiddify-manager/singbox/configs/06_outbounds.json` **и** `06_outbounds.json.j2`
- xray: `/opt/hiddify-manager/xray/configs/06_outbounds.json` **и** `06_outbounds.json.j2`

Та же логика - в шагах 2 и 3 выше: править `.json`, не трогая `.json.j2`, бессмысленно, такая конфигурация живет только до ближайшего рендера.

Отдельный нюанс: если выход клиентов раньше шел через TUN auto-route на уровне ядра, неправильный `06_outbounds.json` мог быть "не виден" - TUN перехватывал весь outbound до того, как singbox/xray доходили до своего outbound-этапа. Пара `.json` + `.json.j2` при этом тоже не правилась, потому что от рендера нечего было защищать. После отключения TUN `06_outbounds.json` становится критичным, и обновления Hiddify начинают периодически сбрасывать его в дефолт (`freedom: direct`). Вывод: при любом изменении режима mihomo **первым делом** проверяйте текущее содержимое `06_outbounds.json` (`cat ...`), а не полагайтесь только на `ss -tnp | grep :7890` - при TUN-режиме ESTAB-сокеты на 7890 могут отсутствовать, и это нормально. Надежная проверка - exit-IP через клиентские инбаунды (шаг 4 в разделе "Проверка").

## Источники

На основе опыта автора hiddify-faq.

---

Не помогло или есть уточняющий вопрос - заходите в русское сообщество [@hiddify_rus](https://t.me/hiddify_rus).
