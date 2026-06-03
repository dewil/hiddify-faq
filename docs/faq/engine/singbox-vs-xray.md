---
title: Sing-box или Xray в Hiddify - что выбирать
description: Hiddify Manager поднимает оба ядра одновременно. Когда переключаться, что какое ядро тянет лучше, в чем грабли каждого варианта.
tags:
  - singbox
  - xray
  - core
  - panel
---

# Sing-box или Xray в Hiddify - что выбирать

В Hiddify Manager оба ядра (`hiddify-singbox` и `hiddify-xray`) активны одновременно - сервер раздает конфиги под оба. На стороне клиента выбираем одно: разные протоколы поддерживаются только одним из ядер, а нагрузка на CPU и поведение под блокировкой различаются.

## Симптомы

- На ядре xray в какой-то момент CPU уходит в 100%, диск 3000-5000 IOPS, сервер висит до перезагрузки.
- На ядре sing-box CPU спокойный, но мелкие фризы при просмотре видео, иногда зависают рилсы в инсте.
- В клиенте: `decode config: outbounds[N].transport: unknown transport type: xhttp` или `unknown field "tunnel-per-resolver"`.
- На iOS Hiddify работает, на Streisand тот же ключ - нет.

## Почему это происходит

**Xray** - C++/Go-ядро XTLS-проекта, поддерживает экзотические транспорты: `xhttp`, `mieru`, `split http`. Под нагрузкой (UDP, видео) деградирует - известная проблема с раздутыми очередями.

**Sing-box** - ядро SagerNet, лучше держит CPU, но в Hiddify обновляется реже. Некоторые новые транспорты xray не поддерживает в принципе (`xhttp` - только в xray); ломается на полях, которые добавляет свежая панель.

Hiddify-клиент (Android/iOS/Desktop) собран на sing-box; Happ/V2RayTUN - на xray. Конфиг с `xhttp`-транспортом ставится в Happ, но не в Hiddify-app.

## Что делать

- **Стабильность, не нужны экзотические транспорты** - sing-box. В панели: `Settings - General - core`. Hiddify-клиент сразу понимает все.
- **xhttp/mieru критичны для обхода** - xray на сервере + Happ/V2RayTUN на клиенте.
- **CPU 100% на xray** - переключитесь на sing-box. На ядре sing-box WARP заворачивает speedtest через Cloudflare, на xray такого нет.
- Правила маршрутизации для sing-box: `.srs` rule-set от Chocolate4U и runetfreedom; `IR` заменить на `geosite-category-ru.srs`/`geoip-ru.srs`. Шаблон - `base_singbox_config.json.j2`.

## Если не помогло

- `unknown transport type: xhttp` - ядро клиента старее подписки. Обновите клиент или возьмите Happ.
- `tunnel-per-resolver` unknown field после обновления Hiddify - откатите панель до 12.0.0 либо обновите sing-box-клиент.

## Источники

!!! note "Ссылки на сообщения не открываются"
    Русский топик в @hiddify_board удалён - прямые ссылки на его сообщения ниже больше не работают. Материал из них сохранён и пересказан на этой странице. Обсуждение - в [@hiddify_rus](https://t.me/hiddify_rus).

Из обсуждений в [@hiddify_board](https://t.me/hiddify_board), русский топик: [437730](https://t.me/hiddify_board/433634/437730), [437980](https://t.me/hiddify_board/433634/437980), [440743](https://t.me/hiddify_board/433634/440743), [441424](https://t.me/hiddify_board/433634/441424), [517071](https://t.me/hiddify_board/433634/517071), [532032](https://t.me/hiddify_board/433634/532032), [583546](https://t.me/hiddify_board/433634/583546), [586749](https://t.me/hiddify_board/433634/586749).

---

Не помогло или есть уточняющий вопрос - заходите в русское сообщество [@hiddify_rus](https://t.me/hiddify_rus).
