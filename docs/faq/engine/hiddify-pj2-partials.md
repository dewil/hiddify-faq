---
title: Hiddify шаблоны .pj2 - партиалы без парного .json
description: В отличие от пар .json.j2/.json у партиалов .pj2 нет отрендеренного парного файла - правка только в одном месте.
tags:
  - engine
  - templates
  - xray
---

# Hiddify шаблоны .pj2 - партиалы без парного .json

В Hiddify действует правило: при правке `.json`-конфигов всегда править и пару `.json.j2`, иначе следующий рендер затрет изменения. Но для расширения `.pj2` это правило не применяется - это другой класс файлов.

## В чем суть

В `/opt/hiddify-manager/xray/configs/common/streams/` лежат партиалы `grpc.pj2`, `tcp.pj2`, `ws.pj2` и подобные. Они подключаются через `{% include %}` из главного шаблона `05_inbounds_new.json.j2` - для всех VLESS/VMess/Trojan inbound с соответствующим транспортом.

В отличие от пар `.json.j2 → .json`, у `.pj2` парного отрендеренного `.json` НЕТ. Это означает:

- Правка делается в одном месте - в самом `.pj2`.
- Бэкап `cp grpc.pj2 grpc.pj2.bak-$(date +%F)` перед изменением.
- После правки запустить `apply_configs.sh --no-gui --no-log`, чтобы перерендерить `05_inbounds_new.json` с подставленным новым партиалом.

## Как с этим жить

Когда нужно поменять параметры транспорта Xray (idle_timeout у gRPC, ws path, tcp headers, reality settings и подобное):

```bash
cd /opt/hiddify-manager/xray/configs/common/streams
cp grpc.pj2 grpc.pj2.bak-$(date +%F)
# править grpc.pj2

cd /opt/hiddify-manager
bash apply_configs.sh --no-gui --no-log
```

Проверка после рендера:

```bash
jq '.inbounds[] | select(.streamSettings.network == "grpc") | .streamSettings.grpcSettings' \
  /opt/hiddify-manager/xray/configs/05_inbounds_new.json
```

Должны увидеть новые значения параметров.

## Чего не делать

- Не искать пару `<имя>.pj2` + `<имя>.json` - такого парного `.json` для партиалов нет, ничего не "затрется".
- Не править отрендеренный `05_inbounds_new.json` напрямую - его перезапишет `apply_configs`. Только источник - либо главный шаблон `05_inbounds_new.json.j2`, либо подключаемый партиал `*.pj2`.
- Флаги `--no-gui --no-log` у `apply_configs.sh` обязательны: без них запуск через SSH ловит зависший TUI-wrapper. См. [apply_configs.sh - всегда с --no-gui --no-log](apply-configs-no-gui.md).

## Источники

На основе опыта автора hiddify-faq.

---

Не помогло или есть уточняющий вопрос - заходите в русское сообщество [@hiddify_rus](https://t.me/hiddify_rus).
