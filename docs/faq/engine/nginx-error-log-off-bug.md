---
title: nginx error_log off и распухание /etc/nginx/off
description: Директива error_log off в Hiddify-конфиге nginx это не отключение лога, а запись в файл с именем off - он распухает на гигабайты.
tags:
  - engine
  - nginx
  - troubleshooting
---

# nginx error_log off и распухание /etc/nginx/off

В дефолтной конфигурации Hiddify-nginx есть директива `error_log off;`. Она выглядит как "выключить логи", но nginx интерпретирует `off` как имя файла и пишет stderr в `/etc/nginx/off`. На сервере с активным трафиком этот файл может вырасти на десятки гигабайт.

## Симптомы

- `df -h /` показывает рост занятого места, который не виден в `du -sh /`.
- В админке "сервер не отвечает", обрывы соединений.
- В `/etc/nginx/off` гигабайтные строки `Too many open files`.
- После `rm /etc/nginx/off` место не освобождается: старый воркер держит fd на удаленный inode.

## Почему это происходит

`error_log off;` - нерабочий синтаксис: nginx не имеет понятия "выключенный лог", он всегда пишет в файл. Параллельно `worker_rlimit_nofile` нигде не задан, поэтому воркер упирается в системный лимит fd (soft=1024) при `worker_connections 65535;`. Каждое отвергнутое соединение пишется в `/etc/nginx/off`.

## Что делать

### Шаг 1. Освободить место сразу

```bash
sudo lsof 2>/dev/null | awk '/\(deleted\)/ && /\/etc\/nginx\/off/ {print $2,$4}' | sort -u
# для каждого PID/FD из вывода:
sudo truncate -s 0 /proc/<PID>/fd/<FD>
sudo truncate -s 0 /etc/nginx/off
```

### Шаг 2. Починить оба файла - конфиг и шаблон

Hiddify-panel периодически рендерит `.j2` в `.json`/`.conf`, поэтому правка только готового файла откатится:

```bash
sudo sed -i 's|^error_log off;|error_log /dev/null crit;|' \
  /opt/hiddify-manager/nginx/nginx.conf \
  /opt/hiddify-manager/nginx/nginx.conf.j2

sudo sed -i '/^worker_processes/a worker_rlimit_nofile 8192;' \
  /opt/hiddify-manager/nginx/nginx.conf \
  /opt/hiddify-manager/nginx/nginx.conf.j2
```

Если `worker_connections 65535;` - снизить до разумного (2048-4096 на 1-2 GB RAM), иначе при флуде воркер съест всю память.

### Шаг 3. Применить

```bash
sudo nginx -t -c /opt/hiddify-manager/nginx/nginx.conf
sudo nginx -s reload -c /opt/hiddify-manager/nginx/nginx.conf
```

После релоада файл `/etc/nginx/off` больше не должен пересоздаваться.

## Если не помогло

Если файл все равно растет - проверьте `decoy_domain`: при `decoy_domain = свой_домен` каждый запрос уходит в proxy-loop и забивает воркеры. См. [Decoy Site = свой домен: бесконечный proxy-loop](../panel/decoy-site-self-loop.md).

## Источники

На основе опыта автора hiddify-faq.
