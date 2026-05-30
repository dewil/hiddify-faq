---
title: Hiddify Manager 12.3.0 - три грабли свежей установки
description: init-db виснет на TLS, баг cmd_in_back в web-апплае, haproxy падает на ядре без IPv6 - три типичные проблемы версии 12.3.
tags:
  - install
  - troubleshooting
  - hiddify-manager
---

# Hiddify Manager 12.3.0 - три грабли свежей установки

При установке Hiddify Manager 12.3.0 на свежий сервер встречаются три отдельных проблемы. Каждая по 20-40 минут отладки, если не знать паттерн.

## Симптомы

- Установщик повис на стадии `init-db`, лог стоит на строке `Updating db from version 0 for node 0`.
- После установки кнопки "Apply Configs" / "Renew Cert" в админке тихо ничего не делают.
- `hiddify-haproxy.service` крутится в crash-loop с `Address family not supported by protocol`.

## Почему это происходит

### 1. init-db виснет на TLS recv

Процесс `python3 -m hiddifypanel init-db` после миграций отправляет серию probe-запросов на внешние CDN (hiddify.com через Cloudflare, fbcdn, и т.д.). На РФ-провайдерах middlebox обрывает TLS recv после handshake, а Hiddify не выставляет socket timeout - повисает навечно.

### 2. cmd_in_back без аргумента

В `hiddifypanel` 12.3.0 в `panel/run_commander.py` забыли передать аргумент:

```python
t = threading.Thread(target=cmd_in_back, daemon=True)   # пропущен args=(base_cmd,)
```

В `panel.err.log` повторяется `TypeError: cmd_in_back() missing 1 required positional argument: 'cmd'`.

### 3. haproxy v4v6 на ядре без IPv6

На хостерах, которые ставят `ipv6.disable=1` в kernel cmdline (cloud-провайдеры с агрессивной кастомизацией ядра), `/proc/sys/net/ipv6/` отсутствует совсем. Haproxy-конфиг Hiddify содержит `bind :443,:::443 v4v6` - попытка биндиться на IPv6 падает.

## Что делать

### Для init-db hang

```bash
PID=$(pgrep -f "hiddifypanel init-db")
[ -n "$PID" ] && kill -9 $PID
```

Установщик ловит смерть python в try/except и продолжает работу. Миграции БД к моменту probe уже отработали.

### Для cmd_in_back

Sed-патч с бэкапом:

```bash
FILE=/opt/hiddify-manager/.venv313/lib/python3.13/site-packages/hiddifypanel/panel/run_commander.py
cp "$FILE" "$FILE.bak-$(date +%F)"
sed -i 's|t = threading.Thread(target=cmd_in_back, daemon=True)|t = threading.Thread(target=cmd_in_back, args=(base_cmd,), daemon=True)|' "$FILE"
systemctl restart hiddify-panel-background-tasks hiddify-panel
```

Патч переживет `update.sh`, но не переживет обновление самого pip-пакета `hiddifypanel`. Альтернатива - запускать `apply_configs.sh --no-gui --no-log` напрямую из shell, не через админку.

### Для haproxy на ядре без IPv6

Убрать `v4v6` и IPv6-биндинги из четырех файлов (рендеренного и трех шаблонов):

```bash
for f in /opt/hiddify-manager/haproxy/haproxy.cfg \
         /opt/hiddify-manager/haproxy/fronts/in_httpmode_quic.cfg.pj2 \
         /opt/hiddify-manager/haproxy/fronts/in_tcpmode.cfg.pj2 \
         /opt/hiddify-manager/haproxy/fronts/sni_proxy.cfg.pj2; do
  cp "$f" "$f.bak-$(date +%F)"
  sed -i 's|bind :80,:::80 v4v6 tfo|bind :80 tfo|g
          s|bind :443,:::443 v4v6 tfo|bind :443 tfo|g
          s|bind quic4@:443,quic6@:443 v4v6 tfo|bind quic4@:443 tfo|g' "$f"
done
systemctl reset-failed hiddify-haproxy && systemctl restart hiddify-haproxy
```

Важно: keyword `v4` в haproxy не существует, удалять `v4v6` целиком - дефолт без него уже чистый IPv4.

## Источники

На основе опыта автора hiddify-faq.
