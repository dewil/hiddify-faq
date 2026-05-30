---
title: Установщик не качается: raw.githubusercontent.com режется в РФ
description: При установке Hiddify через curl с raw.githubusercontent.com рвется TLS-соединение в РФ. Разбираем симптомы и практичные обходы.
tags:
  - install
  - raw.githubusercontent
  - РКН
---

# Установщик не качается: raw.githubusercontent.com режется в РФ

Установка Hiddify-Manager идет одной командой вида `bash <(curl -L https://raw.githubusercontent.com/hiddify/Hiddify-Manager/.../download.sh) release`. Команда тянет скрипт с `raw.githubusercontent.com`, а в РФ доступ к этому хосту нестабилен.

## Симптомы

- `curl: (35) OpenSSL SSL_connect: SSL_ERROR_SYSCALL`.
- TLS handshake обрывается, `Connection reset by peer`.
- Скачался пустой файл, установка падает сразу же.

## Почему это происходит

РКН периодически режет TLS к `raw.githubusercontent.com`. Это внешняя фильтрация, не проблема вашего сервера или Hiddify. Поведение нестабильное: на одном IP-пуле провайдера работает, на другом - нет, и со временем меняется. Релизные ассеты (`release-assets.githubusercontent.com`, бинарники из GitHub Releases) обычно доступны - они отдаются через CDN, а не через `raw`.

## Что делать

- **Повторить попытку.** Блок плавающий - вторая-третья попытка часто проходит.
- **Сменить сеть/провайдера.** Если есть второй аплинк или другой дата-центр, попробуйте оттуда.
- **Скачать репозиторий локально и доставить файлы на сервер.** На машине с доступом клонируете репозиторий, затем заливаете по rsync (`myserver` - это ваш сервер):

  ```bash
  git clone https://github.com/hiddify/Hiddify-Manager.git
  rsync -az --delete --exclude='.git' ./Hiddify-Manager/ myserver:/opt/Hiddify-Manager/
  ssh myserver 'cd /opt/Hiddify-Manager && bash install.sh release --no-gui'
  ```

  То же работает через `scp -r`, если rsync недоступен.
- **Брать релиз-ассеты напрямую.** Если падает только `raw`, скачайте release-архив со страницы Releases - CDN обычно отвечает.
- **Поставить через VPN.** Запуск установки с локальной машины (или прокинутый туннель на сервер) поднимает доступ к `raw.githubusercontent.com`.

## Если не помогло

Если ни один из обходов не дает доступа к GitHub - значит блок жесткий именно на этом IP-пуле. Самый надежный путь: собрать файлы локально и доставить их rsync/scp, минуя `raw` полностью.

## Источники

На основе опыта автора hiddify-faq.
