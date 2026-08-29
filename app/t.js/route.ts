import { NextResponse } from "next/server";

/**
 * Script leve próprio de tracking (Fase 11). Roda no site do operador,
 * primeiro-parte: captura UTMs/ttclid, guarda first/last touch em cookie,
 * e reporta PageView/ViewContent/InitiateCheckout/Purchase pro nosso
 * endpoint de coleta. Não é o pixel oficial do TikTok — esse continua
 * instalado separadamente pelo operador; este script é o que alimenta a
 * atribuição e o funil dentro do LunaAds.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const script = `
(function () {
  var cfg = window.lunaadsConfig || {};
  var token = cfg.token;
  if (!token) return;
  var endpoint = ${JSON.stringify(origin)} + "/api/t/collect";
  var days30 = 30 * 24 * 60 * 60 * 1000;
  var days1 = 24 * 60 * 60 * 1000;

  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : null;
  }
  function setCookie(name, value, maxAgeMs) {
    var expires = new Date(Date.now() + maxAgeMs).toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + "; expires=" + expires + "; path=/; SameSite=Lax";
  }

  var qs = new URLSearchParams(location.search);
  var sessionId = getCookie("_la_sid");
  if (!sessionId) {
    sessionId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    setCookie("_la_sid", sessionId, days1);
  }

  var touch = {
    utmSource: qs.get("utm_source") || undefined,
    utmMedium: qs.get("utm_medium") || undefined,
    utmCampaign: qs.get("utm_campaign") || undefined,
    utmContent: qs.get("utm_content") || undefined,
    utmTerm: qs.get("utm_term") || undefined,
    ttclid: qs.get("ttclid") || undefined,
  };
  var hasTouch = touch.utmCampaign || touch.ttclid;
  if (hasTouch) {
    if (!getCookie("_la_first")) setCookie("_la_first", JSON.stringify(touch), days30);
    setCookie("_la_last", JSON.stringify(touch), days30);
  }

  function send(eventType, extra) {
    var last = {};
    try { last = JSON.parse(getCookie("_la_last") || "{}"); } catch (e) {}
    var body = Object.assign({ token: token, domain: location.hostname, sessionId: sessionId, eventType: eventType }, last, extra || {});
    try {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch (e) {}
  }

  send("PageView");
  window.lunaads = function (cmd, eventType, extra) {
    if (cmd === "track" && eventType) send(eventType, extra);
  };
})();
`.trim();

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
