---
title: Установка Hiddify на новый сервер - порядок шагов
description: Каноническая последовательность развертывания Hiddify Manager на чистом VPS - от pre-flight до проверки.
tags:
  - install
  - hiddify-manager
  - runbook
---

# Установка Hiddify на новый сервер - порядок шагов

Развертывание новой ноды Hiddify - не одна команда `download.sh`, а цепочка из 6-7 шагов. Если пропустить часть, нода либо не поднимется, либо поднимется со скрытой проблемой, которая всплывет через неделю.

## Что нужно

- VPS с Ubuntu 22.04/24.04, минимум 2 GB RAM и 20 GB диска (на 1 GB установщик ловит OOM при сборке venv).
- DNS A-запись вашего домена (например `vpn.example.com`) уже резолвится на IP сервера. Без проксирования Cloudflare, иначе acme.sh не выпишет cert.
- Свободные порты 80 и 443.
- Доступ root по SSH.

## Шаги

### Шаг 1. Выключить IPv6

Если у хостера нет реального IPv6, отключите его через sysctl (не через GRUB - GRUB-флаг ломает mihomo). Подробности и скрипт - [Отключение IPv6 на Debian/Ubuntu](disable-ipv6-debian.md).

### Шаг 2. Запустить установщик без TTY

```bash
nohup bash -c "curl -L https://raw.githubusercontent.com/hiddify/Hiddify-Manager/refs/heads/main/common/download.sh \
  | bash -s release --no-gui" </dev/null >/root/install.log 2>&1 &
```

Флаг `--no-gui` обязателен: без него установщик пытается рисовать TUI и падает на `PermissionError`. Установка идет 10-20 минут.

### Шаг 3. Прописать свой домен

Установщик не знает про ваш домен. Добавьте его в MariaDB:

```bash
mysql hiddifypanel -e "INSERT INTO domain
  (child_id, domain, mode, extra_params, resolve_ip)
  VALUES (0, 'vpn.example.com', 'direct', '{}', 0);"
```

Затем перерендерить конфиги:

```bash
cd /opt/hiddify-manager && nohup bash apply_configs.sh --no-gui --no-log </dev/null >/root/apply.log 2>&1 &
```

### Шаг 4. Применить nginx-фикс

В свежей установке `error_log off;` приводит к распуханию `/etc/nginx/off`. См. [nginx-fix: error_log off и распухание /etc/nginx/off](../engine/nginx-error-log-off-bug.md). Править оба файла: `nginx.conf` и `nginx.conf.j2`.

### Шаг 5. Проверить decoy_domain

В свежей установке Decoy Site по умолчанию может оказаться вашим же доменом - это создает proxy-loop. См. [Decoy Site = свой домен: бесконечный proxy-loop](../panel/decoy-site-self-loop.md).

## Проверка

```bash
bash /opt/hiddify-manager/status.sh 2>&1 | head -30
```

Все 9 сервисов должны быть `active`. Если "0 пользователей онлайн" - см. [Hiddify: 0 пользователей онлайн](../panel/bg-tasks-pending-rollback.md).

## Источники

На основе опыта автора hiddify-faq.

---

Не помогло или есть уточняющий вопрос - заходите в русское сообщество [@hiddify_rus](https://t.me/hiddify_rus).
