// Внешние ссылки открываем в новой вкладке, чтобы пользователь не уходил с сайта.
// document$ - observable от Material for MkDocs: срабатывает и при обычной загрузке,
// и при мгновенной навигации (navigation.instant). rel=noopener закрывает tabnabbing.
document$.subscribe(function () {
  var here = location.hostname;
  document.querySelectorAll("a[href]").forEach(function (a) {
    var url;
    try {
      url = new URL(a.href);
    } catch (e) {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (url.hostname === here) return;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });
});
