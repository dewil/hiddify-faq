---
title: Hiddify - 0 пользователей онлайн в админке
description: Виснет celery-воркер hiddify-panel-background-tasks с PendingRollbackError - лечится перезапуском двух сервисов.
tags:
  - panel
  - troubleshooting
  - celery
---

# Hiddify - 0 пользователей онлайн в админке

В админке Hiddify в счетчике "Подключено пользователей" висит 0, хотя клиенты реально подключены и трафик идет. Часто рядом кажется, что не обновляется срок SSL-сертификата - это тот же симптом, обе цифры пишет один и тот же воркер.

## Симптомы

- В админке "Подключено пользователей: 0" при реально идущем трафике.
- `ss -tn state established | wc -l` показывает десятки/сотни соединений на 443.
- В логе `/opt/hiddify-manager/log/system/hiddify_panel_background_tasks.err.log` каждую минуту появляется `sqlalchemy.exc.PendingRollbackError`.

## Почему это происходит

Сервис `hiddify-panel-background-tasks` крутит celery-воркер с beat-шедулером. Раз в минуту он запускает задачу `update_local_usage`, которая дергает stats-API singbox/xray и пишет в БД счетчики и `last_online`.

При временном сбое связи с MariaDB (OOM, swap, deadlock) SQLAlchemy-сессия celery-воркера переходит в состояние invalid transaction. С этого момента каждый запуск задачи падает на первом же `db.session.query(...)` с `PendingRollbackError`. Воркер сам не лечится - SQLAlchemy ждет явный `rollback()`, которого в этом месте кода нет. Systemd `Restart=on-failure` не срабатывает: процесс жив, просто все задачи валятся. Может висеть так неделями. Чаще встречается на серверах с 1 GB RAM.

## Что делать

```bash
systemctl restart hiddify-panel-background-tasks hiddify-panel
```

Этого достаточно. Воркер пересоздает SQLAlchemy engine с нуля, со следующей минуты `update_local_usage` снова отрабатывает. Через 2-3 минуты счетчик в админке оживает.

Убедиться, что не возобновилось:

```bash
sleep 80
tail -50 /opt/hiddify-manager/log/system/hiddify_panel_background_tasks.err.log \
  | grep -c PendingRollbackError
# ожидаем 0
```

## Воркер завис или beat не тикает

У сервиса две части, и ломаются они по-разному. Различать важно, потому что симптом в админке одинаковый (0 онлайн), а причина и проверка - разные:

- **Воркер завис** (типичный случай выше) - в `*.err.log` каждую минуту капают `PendingRollbackError`. Beat исправно диспатчит задачу, но та валится на первом же запросе к БД.
- **Beat не диспатчит** (реже) - в логе тихо, ошибок нет вообще, но и периодические задачи не запускаются. Тогда смотреть не на ошибки, а на факт тиков. Beat дергает `commander.py` через sudo, поэтому считать вызовы:

```bash
# Сколько раз beat запустил периодические таски за 5 минут
journalctl --no-pager --since "5 min ago" -t sudo | grep -c commander
# 0 за 5 минут после рестарта - beat-шедуль битый, не диспатчит
```

Если тиков 0 - это beat-ветка, простой рестарт двух сервисов ее не вылечит, переходите к разделу ниже.

## Если не помогло

Реже встречающийся вариант: воркер `active`, потребляет 1-2% CPU, но beat-шедулер вообще не тикает (`journalctl -t sudo` за 5 минут после рестарта пусто, см. проверку выше). Причина - битый shelve-файл `celerybeat-schedule` (sqlite-формат, рядом `.shm`/`.wal`): после жесткого падения процесса (OOM, kill -9, питание) beat не может его разобрать и молча не запускает задачи. Чиним сносом шедуля - celery пересоздаст его с нуля из определений в коде:

```bash
systemctl stop hiddify-panel-background-tasks
cd /opt/hiddify-manager/hiddify-panel
for f in celerybeat-schedule celerybeat-schedule-shm celerybeat-schedule-wal; do
  [ -e "$f" ] && mv "$f" "$f.bak.$(date +%s)"
done
systemctl restart hiddify-redis
sleep 3
systemctl start hiddify-panel-background-tasks hiddify-panel
```

Проверка через 90 секунд - в `journalctl -t sudo` должны пойти вызовы `commander.py update-*`, а в админке вернуться онлайн и трафик. Бэкапы `*.bak.<ts>` через сутки можно снести.

Если повторяется часто на одном сервере - добавить памяти (1 GB для Hiddify тесно) или поставить watchdog на проверку `max(last_online)`.

## Источники

!!! note "Ссылки на сообщения не открываются"
    Русский топик в @hiddify_board удалён - прямые ссылки на его сообщения ниже больше не работают. Материал из них сохранён и пересказан на этой странице. Обсуждение - в [@hiddify_rus](https://t.me/hiddify_rus).

Из обсуждений в [@hiddify_board](https://t.me/hiddify_board), русский топик: [436208](https://t.me/hiddify_board/433634/436208) (дашборд показывает 0 после обновления), [582467](https://t.me/hiddify_board/433634/582467) (свежий сервер 12.0.0, трафик идет, в панели 0). На основе опыта автора hiddify-faq.

---

Не помогло или есть уточняющий вопрос - заходите в русское сообщество [@hiddify_rus](https://t.me/hiddify_rus).
