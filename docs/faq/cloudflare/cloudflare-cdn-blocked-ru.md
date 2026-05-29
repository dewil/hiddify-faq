---
title: Cloudflare CDN режется в РФ - что делать
description: Edge IP Cloudflare попадают под РКН, CDN-сценарий Hiddify ложится у российских клиентов. Как обходить.
tags:
  - cloudflare
  - cdn
  - rkn
  - panel
---

# Cloudflare CDN режется в РФ - что делать

CDN-сценарий через Cloudflare использовался, чтобы спрятать IP сервера. С 2025 года edge-IP массово попадают в реестр РКН, в отдельных регионах (Краснодарский край) Cloudflare выпадает целиком. Это ломает CDN-домены и подписку.

## Симптомы

- CDN-домен в `Settings - Domains` не пингуется, при этом VLESS Reality (TCP direct) работает.
- Подписка по CDN-ссылке не добавляется в клиенте, прямые vless-ссылки из `All Configs` добавляются.
- На мобильном (МТС, Билайн, Yota) ничего не работает, на проводном ок.
- В Cloudflare Worker - 500 ошибка панели, в логе `name '__cf' is not defined` или `Client.__init__() got an unexpected keyword argument 'proxies'`.

## Почему это происходит

РКН точечно банит ASN/подсети крупных хостингов и edge-сети Cloudflare. Edge-IP не статичны, но реестр расширяется; в "белом списке" мобильных операторов Cloudflare часто отсутствует. У 12.3.0 параллельно сломан Apply Config для CDN-доменов (Pydantic-баг). Cloudflare Worker в панели не успевает за изменениями API CF.

## Что делать

- Проверьте, виноват ли CDN: включите тот же сервер через VLESS Reality (TCP direct). Работает - проблема в CDN-цепочке, не в VPS.
- Домены регистрируйте в "не палевных" зонах (`.link`, `.site`), избегая `.eu`, `.de`.
- В Cloudflare - Proxy Status: Proxied (оранжевое облако), не DNS Only.
- В панели: `Admin - Settings - Domains - CDN domain` -> добавить субдомен.
- Если CDN не вытягивает - поднимите relay-VPS в стране клиента (haproxy в tcp на 1 ядре тянет гигабит). В подписке для Reality TCP принудительно укажите IP relay.
- WARP+ "Только заблокированные и локальные сайты" - резервный канал к Google/ChatGPT через ASN Cloudflare WARP.

## Если не помогло

- 12.3.0 -> 12.3.1 чинит silent fail на доменах.
- Cloudflare Worker в 12.x имел открытый баг с устаревшим API - обходится прямым редактом `cf_api.py` в `.venv/lib/.../hiddifypanel/hutils/network/`.

## Источники

Из обсуждений в [@hiddify_board](https://t.me/hiddify_board), русский топик: [434471](https://t.me/hiddify_board/433634/434471), [511751](https://t.me/hiddify_board/433634/511751), [516533](https://t.me/hiddify_board/433634/516533), [522101](https://t.me/hiddify_board/433634/522101), [541519](https://t.me/hiddify_board/433634/541519), [562372](https://t.me/hiddify_board/433634/562372), [565591](https://t.me/hiddify_board/433634/565591).

---

Не помогло или есть уточняющий вопрос - заходите в русское сообщество [@hiddify_rus](https://t.me/hiddify_rus).
