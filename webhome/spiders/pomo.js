// WebHTV / FongMi QuickJS Spider: Pomo https://pomo.mom/  (emlog 网盘/磁力聚合)
// 原生站源: 首页/分类/搜索/详情/在线播放/网盘/磁力.
//
// 站点配置示例:
// { "key":"pomo", "name":"Pomo", "type":3,
//   "api":"http://your.host/spiders/pomo.js",
//   "searchable":1, "quickSearch":0, "filterable":0 }

var HOST = "https://pomo.mom";
var UA = "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
var CATS = [
  { type_id: "home", type_name: "首页", path: "/" },
  { type_id: "huayurm", type_name: "华语热门", path: "/huayurm" },
  { type_id: "jiating", type_name: "家庭影院", path: "/jiating" },
  { type_id: "donghua", type_name: "动画大电影", path: "/donghuadadiany" },
  { type_id: "lengmen", type_name: "冷门佳片", path: "/lengmenjiapian" },
  { type_id: "top250", type_name: "TOP250", path: "/paihangbang" },
  { type_id: "bluray", type_name: "蓝光原盘", path: "/sort/12" },
  { type_id: "tv", type_name: "剧集", path: "/dianshiju" }
];
var PATH = {};
for (var c = 0; c < CATS.length; c++) PATH[CATS[c].type_id] = CATS[c].path;

function _req(url, headers) {
  var opt = { async: false, headers: headers || {} };
  if (typeof http === "function") return http(url, opt);
  return req(url, opt);
}

function getHtml(url, referer) {
  try {
    var r = _req(url, { "User-Agent": UA, "Referer": referer || HOST + "/" });
    return r && r.content ? String(r.content) : "";
  } catch (e) {
    console.log("pomo getHtml error", e && e.message);
    return "";
  }
}

function txt(rule, html) { try { return (pdfh(html, rule) || "").trim(); } catch (e) { return ""; } }
function arr(rule, html) { try { var a = pdfa(html, rule); return a ? a : []; } catch (e) { return []; } }
function abs(u) {
  if (!u) return "";
  if (/^https?:/i.test(u)) return u;
  if (/^(magnet|ed2k|thunder):/i.test(u)) return u;
  return HOST + (u.charAt(0) === "/" ? u : "/" + u);
}

function parseCards(html) {
  var items = arr("a[href]", html);
  var out = [], seen = {};
  for (var i = 0; i < items.length; i++) {
    var href = txt("a&&href", items[i]);
    var m = href.match(/^https?:\/\/pomo\.mom\/(\d+)\/?$/);
    if (!m || seen[m[1]]) continue;
    seen[m[1]] = 1;
    var name = txt("h3&&Text", items[i]) || txt("h4&&Text", items[i]) || txt("img&&alt", items[i]);
    var pic = abs(txt("img&&src", items[i]));
    out.push({ vod_id: m[1], vod_name: name, vod_pic: pic });
  }
  return out;
}

function classify(url) {
  if (/^magnet:/i.test(url)) return "magnet";
  if (/^ed2k:|^thunder:/i.test(url)) return "magnet";
  if (/pan\.quark\.cn/i.test(url)) return "pan";
  if (/aliyundrive\.com|alipan\.com/i.test(url)) return "pan";
  if (/pan\.baidu\.com/i.test(url)) return "pan";
  if (/drive\.uc\.cn/i.test(url)) return "pan";
  if (/pan\.xunlei\.com/i.test(url)) return "pan";
  if (/cloud\.189\.cn/i.test(url)) return "pan";
  if (/123pan\.|123684\.|123685\.|123912\.|123592\.|123865\./i.test(url)) return "pan";
  if (/115\.com|115cdn\.com/i.test(url)) return "pan";
  if (/yun\.139\.com|caiyun\.139\.com/i.test(url)) return "pan";
  return "";
}

function collectResources(html) {
  var pans = [], magnets = [], seen = {};
  function push(arr, u) { if (u && !seen[u]) { seen[u] = 1; arr.push(u); } }
  // DOM 里的下载项 / 快捷入口
  var nodes = arr(".x-dbjs-download-link[data-url], .x-dbjs-download-btn[data-url], .x-dbjs-actions a[href]", html);
  for (var i = 0; i < nodes.length; i++) {
    var u = abs(txt(".x-dbjs-download-link&&data-url", nodes[i]) || txt(".x-dbjs-download-btn&&data-url", nodes[i]) || txt("a&&href", nodes[i]));
    if (!u) continue;
    var k = classify(u);
    if (k === "magnet") push(magnets, u);
    else if (k === "pan") push(pans, u);
  }
  // 页面脚本里内联注入的网盘链接 (夸克等)
  var panRe = /https?:\/\/(?:pan\.quark\.cn\/s|drive\.uc\.cn\/s|pan\.baidu\.com\/s|www\.aliyundrive\.com\/s|alipan\.com\/s|115\.com\/s|cloud\.189\.cn\/t|123pan\.com\/s)\/[A-Za-z0-9_\-]+/g;
  var mm;
  while ((mm = panRe.exec(html)) !== null) push(pans, mm[0]);
  return { pans: pans, magnets: magnets };
}

function onlineRoutes(id) {
  var html = getHtml(HOST + "/?plugin=plyr_player&gid=" + id, HOST + "/" + id);
  var lines = [];
  var re = /const\s+route(\d+)Data\s*=\s*(\[[\s\S]*?\])\s*;/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var arr = null;
    try { arr = JSON.parse(m[2]); } catch (e) { continue; }
    if (!arr || !arr.length) continue;
    lines.push(arr.join("#"));
  }
  return lines;
}

export function __jsEvalReturn() {
  return {
    init: function () {},

    home: function () {
      return JSON.stringify({ class: CATS, list: parseCards(getHtml(HOST + "/")) });
    },

    homeVod: function () {
      return JSON.stringify({ list: parseCards(getHtml(HOST + "/")) });
    },

    category: function (tid, pg, filter, extend) {
      var base = PATH[tid] || "/";
      var url = HOST + (pg && parseInt(pg, 10) > 1 ? base.replace(/\/$/, "") + "/page/" + pg : base);
      var list = parseCards(getHtml(url));
      return JSON.stringify({ page: parseInt(pg, 10), pagecount: list.length ? 9999 : 0, limit: list.length, total: 9999, list: list });
    },

    search: function (key, quick, pg) {
      var url = HOST + "/?keyword=" + encodeURIComponent(key) + (pg && parseInt(pg, 10) > 1 ? "&page=" + pg : "");
      return JSON.stringify({ list: parseCards(getHtml(url)) });
    },

    detail: function (id) {
      var html = getHtml(HOST + "/" + id);
      var name = txt(".x-dbjs-title&&Text", html) || txt("h1&&Text", html) || (document && document.title);
      var pic = abs(txt(".x-dbjs-poster&&img&&src", html) || txt("main img&&src", html));
      var content = txt(".x-dbjs-desc-block p&&Text", html);

      var froms = [], urls = [];
      var online = onlineRoutes(id);
      for (var i = 0; i < online.length; i++) {
        froms.push("在线" + (online.length > 1 ? (i + 1) : ""));
        urls.push(online[i]);
      }
      var res = collectResources(html);
      if (res.pans.length) { froms.push("网盘"); urls.push(res.pans.map(function (u) { return "网盘$" + u; }).join("#")); }
      if (res.magnets.length) { froms.push("磁力"); urls.push(res.magnets.map(function (u) { return "磁力$" + u; }).join("#")); }

      var vod = {
        vod_id: id, vod_name: name, vod_pic: pic, vod_content: content,
        vod_play_from: froms.join("$$$"), vod_play_url: urls.join("$$$")
      };
      return JSON.stringify({ list: [vod] });
    },

    play: function (flag, id, flags) {
      // id 可能是 m3u8/mp4 直链, 也可能是 magnet/网盘链接
      if (/^https?:/i.test(id)) return JSON.stringify({ parse: 0, url: id, header: { "User-Agent": UA, "Referer": HOST + "/" } });
      // 网盘/磁力交给 App 自身的推送/解析链路
      return JSON.stringify({ parse: 0, url: id, header: { "User-Agent": UA } });
    },

    destroy: function () {}
  };
}
