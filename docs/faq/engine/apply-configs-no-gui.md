---
title: apply_configs.sh - всегда с --no-gui --no-log
description: При запуске apply_configs.sh через SSH без флагов --no-gui --no-log процесс зависает в TUI-обертке или съедает CPU.
tags:
  - engine
  - apply-configs
  - hiddify-manager
---

# apply_configs.sh - всегда с --no-gui --no-log

При перерендере конфигов Hiddify через `apply_configs.sh` (или `install.sh apply_configs`) есть нюанс: без специальных флагов запуск через SSH ведет себя плохо. Либо мгновенно падает, либо повисает зомби-процессом, который съедает 97% CPU и не отпускает до `kill -9`.

## Симптомы

- Запустили `bash apply_configs.sh` через SSH - в логе тишина, ничего не применяется.
- В логе ошибка `PermissionError: [Errno 1] Operation not permitted` на `epoll_ctl(register, fd=0)`.
- Или: процесс жив несколько часов после apply, потребляет ~97% CPU, в админке "Apply Configs" висит "in progress".

## Почему это происходит

`install.sh` (а `apply_configs.sh` - тонкая обертка над ним) в строках 199-212 самообертывается в `python -m cli_progress` - это TUI-индикатор прогресса. Этот wrapper делает `epoll_ctl(EPOLL_CTL_ADD, fd=0)` на stdin.

Если запуск через SSH с `nohup ... </dev/null`:
- `/dev/null` это регулярный файл, его нельзя epoll-уведомлять.
- cli_progress падает с `PermissionError`, install.sh из-за этого не запускается, apply вообще не доходит до фактических стадий.

Если запуск через SSH с TTY (`ssh -tt`):
- cli_progress не падает.
- Но если SSH-сессия обрывается во время apply (а apply перезапускает все сервисы и идет минутами), процесс остается висеть зомби-TUI'ем на ~97% CPU. Выкуривается только `kill -9` всей ветке.

Флаг `--no-gui` отключает TUI-wrapper полностью. Флаг `--no-log` дополнительно убирает лог-обертку. С обоими флагами `install.sh` идет прямой веткой, поведение детерминировано.

## Что делать

Канонический запуск через SSH в фоне:

```bash
ssh myserver 'cd /opt/hiddify-manager && \
  nohup bash apply_configs.sh --no-gui --no-log </dev/null >/tmp/apply.log 2>&1 & disown'
```

Признак конца в логе - строка `####100####Applying...####Done####`. Длится 3-10 минут.

Для ручного интерактивного SSH с TTY можно без флагов, но тогда нельзя отключаться до окончания. Для batch/cron/auto-запусков - всегда `--no-gui --no-log`.

## Если не помогло

Если процесс уже висит зомби-TUI:

```bash
pgrep -af "install.sh|cli_progress"
kill -9 <pids>
# и заново с флагами
```

Если apply падает на конкретной стадии - смотрите конкретный лог `/tmp/apply.log` или `/opt/hiddify-manager/log/system/`. Частые отдельные случаи разобраны в [Hiddify Manager 12.3.0 - три грабли](../install/hiddify-install-pitfalls-12-3.md).

## Источники

На основе опыта автора hiddify-faq.
