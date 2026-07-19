---
title: Восстановление из бэкапа виснет или панель падает с JSONDecodeError
description: Веб-восстановление панели Hiddify зависает, а apply_configs падает с json.decoder.JSONDecodeError - битое поле extra_params у доменов. Диагностика и починка из консоли.
tags:
  - panel
  - бэкап
  - восстановление
  - JSONDecodeError
---

# Восстановление из бэкапа виснет или панель падает с JSONDecodeError

После нажатия "Восстановить" в веб-панели восстановление крутится бесконечно, а сама панель после этого может перестать открываться. Причина - баг восстановления: у доменов с непустыми расширенными параметрами поле `extra_params` записывается в базу в неверном формате, и сборка конфигов падает.

## Симптомы

- Веб-восстановление из бэкапа висит и не завершается (может уйти в "переустановку" и висеть там).
- Панель после попытки восстановления отдает ошибку или не открывается.
- В консоли `apply_configs.sh` или `hiddify-panel-cli all-configs` падает с ошибкой вида:

```
json.decoder.JSONDecodeError: Expecting property name enclosed in double quotes
```

## Почему это происходит

В бэкапе `extra_params` домена хранится как объект, а код восстановления записывает его в базу как python-словарь в одинарных кавычках (`{'key': 'value'}`) вместо JSON (`{"key": "value"}`). Дальше любой пересбор конфигов делает `json.loads` этого поля и падает. Затрагивает домены, у которых `extra_params` непустой - например reality-домены.

Важно: **каждое повторное нажатие "Восстановить" в вебе ломает поле заново**. Если вы уже починили из консоли, а потом снова нажали веб-восстановление - придется чинить еще раз.

## Диагностика

По SSH на сервере - проверка без изменений (ничего не пишет в базу):

```bash
echo '
import json, ast
from hiddifypanel.models import Domain
for d in Domain.query.all():
    v = d.extra_params
    try:
        json.loads(v or "{}")
    except Exception:
        print(d.id, d.domain, repr(v))
print("scan done")
' | hiddify-panel-cli shell
```

Если вывод показал домены со значениями в одинарных кавычках - это оно.

## Починка

1. Нормализовать `extra_params` (скрипт идемпотентный - повторный запуск ничего не портит):

    ```bash
    echo '
    import json, ast
    from hiddifypanel.models import Domain
    from hiddifypanel.database import db
    for d in Domain.query.all():
        v = d.extra_params
        if not v:
            continue
        try:
            json.loads(v)                    # уже валидный JSON - пропускаем
        except Exception:
            try:
                d.extra_params = json.dumps(ast.literal_eval(v))
                print("recovered", d.id, d.domain)
            except Exception:
                d.extra_params = "{}"        # неспасаемое значение - в пустой объект
                print("reset", d.id, d.domain)
    db.session.commit()
    print("done")
    ' | hiddify-panel-cli shell
    ```

2. Пересобрать конфиги (тот шаг, который в вебе висел; занимает несколько минут):

    ```bash
    bash /opt/hiddify-manager/apply_configs.sh
    ```

3. Проверить:

    ```bash
    hiddify-panel-cli all-configs >/dev/null && echo OK
    ```

    Должно напечатать `OK`. Дальше откройте админ-ссылку в браузере и проверьте подключение любым клиентом.

## Как не наступить снова

- Не нажимайте веб-кнопку "Восстановить" повторно "на всякий случай" - она заново пишет битое поле, и починку придется повторять.
- Если веб-восстановление уже зависло - не ждите и не перезапускайте его, доводите из консоли: [Веб-восстановление висит - как довести из консоли](panel-restore-console.md).
- Общий порядок бэкапа и переноса панели - в статье [Бэкап и перенос панели Hiddify](panel-backup-restore-migrate.md).

## Источники

Разбор исходников `hiddifypanel` и реальный кейс восстановления боевой ноды (июль 2026): восстановление зависало, после нормализации `extra_params` и консольного `apply_configs.sh` панель поднялась полностью.

---

Не помогло или есть уточняющий вопрос - заходите в русское сообщество [@hiddify_rus](https://t.me/hiddify_rus).
