// WebHTV / FongMi QuickJS Spider: 极速追剧 https://jisuzhuiju.com/
// 原生站源: 首页/分类/搜索/详情/选集/播放, 不加载网页.
// 播放地址由站点接口 /api/play-url?vodId=&playFrom=&index= 解析.
//
// 站点配置示例:
// { "key":"jisuzhuiju", "name":"极速追剧", "type":3,
//   "api":"http://your.host/spiders/jisuzhuiju.js",
//   "searchable":1, "quickSearch":1, "filterable":0 }

var HOST = "https://jisuzhuiju.com";
var UA = "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
var CATS = [
  { type_id: "1", type_name: "电视剧" },
  { type_id: "2", type_name: "电影" },
  { type_id: "3", type_name: "动漫" },
  { type_id: "4", type_name: "综艺" }
];

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
    console.log("jisu getHtml error", e && e.message);
    return "";
  }
}

function txt(rule, html) { try { return (pdfh(html, rule) || "").trim(); } catch (e) { return ""; } }

// 安全版 pdfa: 出错或空时返回 []
function arr(rule, html) {
  try { var a = pdfa(html, rule); return a ? a : []; } catch (e) { return []; }
}

function parseCards(html) {
  var items = arr('a[href^="/detail/"]', html);
  var out = [], seen = {};
  for (var i = 0; i < items.length; i++) {
    var href = txt("a&&href", items[i]);
    var m = href.match(/\/detail\/(\d+)\.html/);
    if (!m || seen[m[1]]) continue;
    seen[m[1]] = 1;
    var name = txt(".vod-title&&Text", items[i]) || txt("img&&alt", items[i]);
    var pic = txt("img&&src", items[i]);
    var remark = txt(".vod-badge&&Text", items[i]) || txt(".vod-subtitle&&Text", items[i]);
    out.push({ vod_id: m[1], vod_name: name, vod_pic: pic, vod_remarks: remark });
  }
  return out;
}

function parseSearch(html) {
  var items = arr(".search-item", html);
  var out = [], seen = {};
  for (var i = 0; i < items.length; i++) {
    var href = txt(".search-item-title&&href", items[i]) || txt("a&&href", items[i]);
    var m = href.match(/\/detail\/(\d+)\.html/);
    if (!m || seen[m[1]]) continue;
    seen[m[1]] = 1;
    out.push({
      vod_id: m[1],
      vod_name: txt(".search-item-title&&Text", items[i]),
      vod_pic: txt(".search-item-poster&&src", items[i]) || txt("img&&src", items[i])
    });
  }
  return out;
}

// 解析某一集真实地址; 返回响应对象或 null
function resolvePlay(pagePath) {
  var m = String(pagePath).match(/\/vodplay\/(\d+)-([A-Za-z0-9_]+)-(\d+)\.html/);
  if (!m) return null;
  var api = HOST + "/api/play-url?vodId=" + m[1] + "&playFrom=" + m[2] + "&index=" + m[3];
  var r = _req(api, { "User-Agent": UA, "Referer": HOST + pagePath });
  if (!r || !r.content) return null;
  var d = null;
  try { d = JSON.parse(r.content); } catch (e) { return null; }
  if (d && d.code === 200 && d.url) return d;
  return null;
}

export function __jsEvalReturn() {
  return {
    init: function () {},

    home: function (filter) {
      return JSON.stringify({ class: CATS, list: parseCards(getHtml(HOST + "/")) });
    },

    homeVod: function () {
      return JSON.stringify({ list: parseCards(getHtml(HOST + "/")) });
    },

    category: function (tid, pg, filter, extend) {
      var url = HOST + "/filter?channel=" + tid + "&area=&year=&sort=hot&page=" + pg;
      var list = parseCards(getHtml(url));
      return JSON.stringify({ page: parseInt(pg, 10), pagecount: list.length ? 9999 : 0, limit: 12, total: 9999, list: list });
    },

    detail: function (id) {
      var html = getHtml(HOST + "/detail/" + id + ".html");
      var name = txt("h1.detail-title&&Text", html) || txt("h1&&Text", html);
      var pic = txt(".detail-cover img&&src", html) || txt("main img&&src", html);
      var content = txt(".detail-desc&&Text", html) || txt(".vod-desc&&Text", html);

      var tabMap = {};
      var tabs = arr(".source-tab", html);
      for (var t = 0; t < tabs.length; t++) {
        var target = txt("button&&data-target", tabs[t]);
        if (target) tabMap[target] = txt("button&&Text", tabs[t]);
      }

      var froms = [], urls = [];
      var panels = arr(".source-panel", html);
      for (var i = 0; i < panels.length; i++) {
        var links = arr("a.episode-btn", panels[i]);
        var eps = [];
        for (var k = 0; k < links.length; k++) {
          var hf = txt("a&&href", links[k]);
          if (!hf) continue;
          eps.push((txt("a&&Text", links[k]) || ("第" + (k + 1) + "集")) + "$" + hf);
        }
        if (!eps.length) continue;
        // 用第一集探测该线路能否原生播放
        var first = resolvePlay(eps[0].split("$")[1] || "");
        if (!first) continue;
        var pid = txt("div&&id", panels[i]);
        froms.push(tabMap[pid] || ("线路" + (i + 1)));
        urls.push(eps.join("#"));
      }

      var vod = {
        vod_id: id, vod_name: name, vod_pic: pic, vod_content: content,
        vod_play_from: froms.join("$$$"), vod_play_url: urls.join("$$$")
      };
      return JSON.stringify({ list: [vod] });
    },

    search: function (key, quick, pg) {
      var url = HOST + "/search?keyword=" + encodeURIComponent(key) + (pg ? "&page=" + pg : "");
      return JSON.stringify({ list: parseSearch(getHtml(url)) });
    },

    play: function (flag, id, flags) {
      var d = resolvePlay(id);
      if (d) {
        var header = d.headers && typeof d.headers === "object" ? d.headers : { "User-Agent": UA, "Referer": HOST + "/" };
        return JSON.stringify({ parse: 0, url: d.url, header: header });
      }
      return JSON.stringify({ parse: 1, url: (String(id).indexOf("http") === 0 ? id : HOST + id), header: { "User-Agent": UA, "Referer": HOST + "/" } });
    },

    destroy: function () {}
  };
}
