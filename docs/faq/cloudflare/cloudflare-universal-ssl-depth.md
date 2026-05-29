---
title: Cloudflare Universal SSL не покрывает третий уровень поддомена
description: На бесплатном плане Cloudflare wildcard-сертификат идет только на один уровень поддомена - на втором уровне TLS handshake падает.
tags:
  - cloudflare
  - ssl
  - dns
---

# Cloudflare Universal SSL не покрывает третий уровень поддомена

Типичная ситуация: купили домен `example.com`, поставили под Cloudflare с бесплатным планом, ожидаете, что любой поддомен через CF будет автоматически работать по HTTPS. Для `vpn.example.com` работает. А для `node.vpn.example.com` - падает с TLS-ошибкой еще до того, как Cloudflare успевает применить любые правила.

## В чем суть

Cloudflare Free / Universal SSL выдает сертификат только на корень зоны и **один** уровень wildcard - то есть `example.com` и `*.example.com`. Все, что глубже (`*.vpn.example.com` - это третий уровень), бесплатным сертификатом не покрывается.

Браузер при заходе на `node.vpn.example.com` через CF-прокси получает `sslv3 alert handshake failure` или `unable to verify the first certificate` - сам TLS handshake не проходит. Никакие Cloudflare Rules, Workers или Page Rules не применяются, потому что они работают уже после установленного TLS.

## Как с этим жить

Три варианта обхода, по убыванию частоты использования.

### Вариант 1. Свой обратный прокси без CF на этом поддомене

Поставить отдельный VPS с Nginx Proxy Manager или nginx с certbot. В DNS этот поддомен направить на IP прокси без `orange cloud` (grey cloud - DNS-only, без проксирования). На прокси выпустить Let's Encrypt cert через DNS-01 challenge на нужный wildcard. С прокси уже разруливать поддомены любой глубины.

### Вариант 2. Advanced Certificate Manager

В Cloudflare есть Advanced Certificate Manager - 10 USD/мес за зону. Позволяет заказать сертификат на любую глубину поддомена. Покупается через панель CF в разделе SSL/TLS → Edge Certificates → Advanced Certificate Manager.

### Вариант 3. Business-план Cloudflare

Custom SSL и Custom Hostnames в Business-плане позволяют то же самое. Дороже Advanced Certificate Manager, но включает много остального.

## Чего не делать

- Не пытаться добавить третий уровень через Cloudflare Rules - правила применяются после TLS, а здесь падает сам TLS.
- Не пытаться "разрешить" сертификат через DNS-настройки - Universal SSL это не настройка, а лимит плана.
- Не идти в CF Page Rules с редиректами на третьем уровне - редирект не дойдет до выполнения, потому что соединение оборвется раньше.

Когда нужен HTTPS на третьем уровне поддомена (`<что-то>.vpn.example.com`) - сразу проектируйте обход через свой прокси, не пытайтесь добиться этого на edge Cloudflare с бесплатным планом.

## Источники

На основе опыта автора hiddify-faq.

---

Не помогло или есть уточняющий вопрос - заходите в русское сообщество [@hiddify_rus](https://t.me/hiddify_rus).
