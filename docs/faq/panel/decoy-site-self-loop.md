---
title: Decoy Site = свой домен - бесконечный proxy-loop
description: Если в настройках Hiddify Decoy Site указан собственный VPN-домен, nginx уходит в proxy-loop сам на себя и сервер падает.
tags:
  - panel
  - troubleshooting
  - decoy
---

# Decoy Site = свой домен - бесконечный proxy-loop

В админке Hiddify есть настройка Decoy Site - сайт-обманка, который показывается на корневом пути, чтобы при заходе по голому домену видна была не VPN-панель, а нейтральная страница. Если в эту настройку случайно попасть собственный VPN-домен, сервер начинает проксировать сам на себя по кругу.

## Симптомы

- Сотни-тысячи ESTABLISHED-соединений вида `<own_ip>:* <-> <own_ip>:443`.
- В nginx error.log строки `client: <own_ip>, upstream: "https://<own_ip>:443/...", host: "<own_domain>"`.
- Внешний `curl https://vpn.example.com/` висит. Локальный `curl https://127.0.0.1/` тоже.
- Nginx-воркеры упираются в "Too many open files" даже при правильно поднятом `worker_rlimit_nofile` - просто потому, что соединения создаются быстрее, чем закрываются.

## Почему это происходит

В Hiddify в файле `parts/def-link.conf` (location `/` - Decoy website) генерируется такой блок:

```nginx
proxy_set_header Host {{ hconfigs['decoy_domain'] }};
set $upstream {{ hconfigs['decoy_domain'] }};
proxy_pass https://$upstream;
```

Если `decoy_domain` равно собственному домену сервера, каждый запрос, не попавший в служебные locations панели (`/<proxy_path>/...`, gRPC-эндпоинты и т.п.), уходит на свой публичный IP через DNS → возвращается в haproxy → nginx → снова location `/` → опять upstream → бесконечный цикл. Через минуту-другую исчерпываются file descriptors, дальше OOM.

При первичной настройке через web-визард Hiddify случай встречается часто - инсталлер иногда дефолтит decoy на основной домен.

## Что делать

### 1. Найти, в каком состоянии БД

```bash
mysql -uroot hiddifypanel -e "SELECT value FROM str_config WHERE \`key\`='decoy_domain';"
```

Если значение равно вашему домену (`vpn.example.com`) - это оно.

### 2. Поменять на нейтральный сторонний сайт

```bash
mysql -uroot hiddifypanel -e \
  "UPDATE str_config SET value='www.speedtest.net' WHERE \`key\`='decoy_domain';"
```

### 3. Аварийно перерендерить рабочий конфиг (без apply_configs)

Шаблон `.j2` уже параметризован через `{{ hconfigs['decoy_domain'] }}`, его трогать не нужно. А вот рендеренный `parts/def-link.conf` правится напрямую:

```bash
SELF=vpn.example.com   # ваш домен
sed -i "s|${SELF}|www.speedtest.net|g" /opt/hiddify-manager/nginx/parts/def-link.conf
nginx -t -c /opt/hiddify-manager/nginx/nginx.conf
nginx -s reload -c /opt/hiddify-manager/nginx/nginx.conf
```

Через минуту keep-alive циклы добиваются, счетчик соединений на своем IP падает к нулю.

## Если не помогло

Выбор нового decoy:

- Должен открываться без VPN из стран, где находятся ваши клиенты.
- Отдает 200 на `/`, без cookie-walls и обязательной авторизации.
- Большой стабильный публичный ресурс: `www.bing.com`, `www.speedtest.net`, `www.microsoft.com`.

Правильнее всего ставить через админку Hiddify (Settings → Domain → Decoy Site), прямой SQL быстрее при массовой починке нескольких серверов.

## Источники

На основе опыта автора hiddify-faq.
