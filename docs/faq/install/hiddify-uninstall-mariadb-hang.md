---
title: Hiddify uninstall.sh виснет на mariadb purge
description: При сносе Hiddify через uninstall.sh purge зависает apt-purge mariadb из-за debconf-prompt о удалении БД.
tags:
  - install
  - troubleshooting
  - mariadb
---

# Hiddify uninstall.sh виснет на mariadb purge

При попытке снести Hiddify через `bash uninstall.sh purge` процесс виснет на стадии `mariadb-server.postrm` и не двигается. SSH-сессия молчит, в логе ничего нового. Если запускать через пайп в `tail` - можно вообще не заметить, что висит.

## Симптомы

- `uninstall.sh purge` стоит минутами/часами на одной точке.
- `pgrep -af "apt|dpkg|mariadb"` показывает живые процессы apt → dpkg → debconf → postrm.
- Директория `/opt/hiddify-manager/` уже пустая (uninstall.sh успел сделать `rm -rf` до зависания), повисает именно хвост.

## Почему это происходит

В postrm-скрипте `mariadb-server` есть строка `db_input high "mariadb-server-*/postrm_remove_databases" && db_go` - вопрос "удалить ли данные БД?". Debconf-frontend приоритета high пытается показать prompt через whiptail, для этого ему нужен `/dev/tty`. Если SSH запущен без `-t` или stdout запайплен в `tail`/`tee` - prompt не может отрисоваться и висит бесконечно. Флаг `apt -y` это не покрывает: он про apt, а не про debconf.

## Что делать

### Профилактика

Запускать снос с TTY и без пайпов:

```bash
ssh -t myserver 'cd /opt/hiddify-manager && bash uninstall.sh purge'
```

Или предзаполнить ответ debconf ДО запуска uninstall:

```bash
echo "mariadb-server-10.6 mariadb-server-10.6/postrm_remove_databases boolean true" | debconf-set-selections
```

### Лечение уже зависшего uninstall

```bash
# найти и прибить дерево процессов
pgrep -af "apt|dpkg|mariadb-server.*postrm"
kill -9 <pids>

# снять dpkg-локи
rm -f /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/cache/apt/archives/lock

# preseed ответа и догнать noninteractive
echo "mariadb-server-10.6 mariadb-server-10.6/postrm_remove_databases boolean true" | debconf-set-selections
DEBIAN_FRONTEND=noninteractive dpkg --configure -a
DEBIAN_FRONTEND=noninteractive apt-get purge -y mariadb-server-10.6 mariadb-server-core-10.6 mariadb-common
DEBIAN_FRONTEND=noninteractive apt-get autoremove -y
```

## Если не помогло

Перед сносом всегда сначала забрать снапшот данных: `/opt/hiddify-manager/current.json` содержит полную копию (users, domains, конфиг), `/opt/hiddify-manager/hiddify-panel/backup/` - бэкапы панели. Если БД уже снесена без бэкапа - восстанавливать настройки придется руками.

Сторонние сервисы вроде mihomo живут в `/etc/mihomo` и `/usr/local/bin/mihomo` отдельно - uninstall.sh их не трогает.

## Источники

На основе опыта автора hiddify-faq.

---

Не помогло или есть уточняющий вопрос - заходите в русское сообщество [@hiddify_rus](https://t.me/hiddify_rus).
