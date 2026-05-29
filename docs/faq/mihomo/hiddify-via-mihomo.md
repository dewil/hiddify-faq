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

## Источники

На основе опыта автора hiddify-faq.

---

Не помогло или есть уточняющий вопрос - заходите в русское сообщество [@hiddify_rus](https://t.me/hiddify_rus).
