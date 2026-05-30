---
title: Отключение IPv6 на Debian/Ubuntu для Hiddify
description: Безопасный способ выключить IPv6 через sysctl без GRUB-флага, совместимый с mihomo.
tags:
  - install
  - ipv6
  - sysctl
---

# Отключение IPv6 на Debian/Ubuntu для Hiddify

Если хостер не дает реальный IPv6 (только link-local `fe80::`), IPv6-стек лучше отключить - иначе haproxy/nginx могут пытаться биндиться на `:::443` и падать. Но способ важен: GRUB-флаг ломает mihomo TUN, а ядерное удаление IPv6-стека вообще делает Hiddify неустанавливаемым на части хостеров.

## Что нужно

- root-доступ.
- Понимание, что hiddify-panel при `apply_configs` все равно временно включит `disable_ipv6=0` в runtime - это нормально, нужно для его внутренней WireGuard-сети.

## Шаги

### Шаг 1. Сохранить настройку в sysctl

```bash
cat > /etc/sysctl.d/99-disable-ipv6.conf <<'EOF'
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1
net.ipv6.conf.lo.disable_ipv6 = 1
EOF
```

Дополнительно записать строки для всех имеющихся интерфейсов:

```bash
for iface in /proc/sys/net/ipv6/conf/*; do
  name=$(basename "$iface")
  echo "net.ipv6.conf.$name.disable_ipv6 = 1" >> /etc/sysctl.d/99-disable-ipv6.conf
done
```

### Шаг 2. Применить в runtime

```bash
sysctl -w net.ipv6.conf.all.disable_ipv6=1
sysctl -w net.ipv6.conf.default.disable_ipv6=1
sysctl -w net.ipv6.conf.lo.disable_ipv6=1
for iface in /proc/sys/net/ipv6/conf/*; do
  name=$(basename "$iface")
  sysctl -w "net.ipv6.conf.$name.disable_ipv6=1"
  ip -6 addr flush dev "$name" 2>/dev/null || true
done
```

### Шаг 3. Проверить

```bash
ip -6 addr show
```

Должно быть пусто или только `::1` на `lo`.

## Чего не делать

Не добавлять `ipv6.disable=1` в `/etc/default/grub`. Это полностью убирает `/proc/sys/net/ipv6/`. Последствия:
- mihomo (если есть в цепочке) принудительно отключает `auto-route` и `auto-redirect` - TUN бесполезен для системного трафика.
- Hiddify-haproxy все равно пытается биндиться на `:::PORT` и падает в crash-loop.

Если уже добавили - убрать строку из GRUB, `update-grub`, перезагрузить.

## Источники

На основе опыта автора hiddify-faq.
