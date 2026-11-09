// ==UserScript==
// @name         YT Playlist Series Gap
// @namespace    https://github.com/chirag127
// @version      1.0.0
// @description  Finds missing and duplicate episode numbers in a playlist by reading the numbers out of video titles. Read-only.
// @author       chirag127
// @license      MIT
// @match        https://www.youtube.com/*
// @icon         https://www.youtube.com/favicon.ico
// @homepageURL  https://github.com/chirag127/yt-playlist-series-gap-userscript
// @supportURL   https://github.com/chirag127/yt-playlist-series-gap-userscript/issues
// @downloadURL  https://github.com/chirag127/yt-playlist-series-gap-userscript/raw/main/yt-playlist-series-gap.user.js
// @updateURL    https://github.com/chirag127/yt-playlist-series-gap-userscript/raw/main/yt-playlist-series-gap.user.js
// @require      https://raw.githubusercontent.com/chirag127/yt-core-lib/main/yt-core-lib-1.2.0.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (typeof Ytk === 'undefined') { console.error('[series-gap] core did not load'); return; }
  if (!Ytk.featureOn('series', true)) return;

  var ROW_SELECTORS = ['yt-lockup-view-model', 'ytd-playlist-video-renderer', 'ytd-playlist-panel-video-renderer'];

  function playlistId() {
    var q = new URLSearchParams(location.search).get('list');
    if (q) return q;
    var panel = document.querySelector('ytd-playlist-panel-renderer[playlist-id]');
    return panel ? panel.getAttribute('playlist-id') : null;
  }

  function rows() {
    for (var i = 0; i < ROW_SELECTORS.length; i++) {
      var found = Array.prototype.slice.call(document.querySelectorAll(ROW_SELECTORS[i]));
      if (found.length) return found;
    }
    return [];
  }

  function titleOf(node) {
    var a = node.querySelector('yt-lockup-metadata-view-model h3 a, a#video-title');
    if (!a) return '';
    return (a.getAttribute('title') || a.textContent || '').trim();
  }

  /** Group parsed titles into seasons and report missing / duplicate numbers. */
  function analyse(videos) {
    var numbered = [];
    for (var i = 0; i < videos.length; i++) {
      var e = Ytk.parseEpisode(videos[i].title);
      if (e) numbered.push({ video: videos[i], episode: e.episode, season: e.season });
    }
    if (numbered.length < 3) {
      return { ok: false, reason: 'Need at least 3 titles that contain an episode number. Found ' + numbered.length + '.' };
    }

    var groups = {};
    numbered.forEach(function (x) {
      var key = x.season === null ? 'unseasoned' : 'season-' + x.season;
      if (!groups[key]) groups[key] = [];
      groups[key].push(x);
    });

    var report = [];
    Object.keys(groups).forEach(function (key) {
      var list = groups[key].slice().sort(function (a, b) { return a.episode - b.episode; });
      var present = {};
      var counts = {};
      list.forEach(function (x) {
        present[x.episode] = true;
        counts[x.episode] = (counts[x.episode] || 0) + 1;
      });
      var min = list[0].episode;
      var max = list[list.length - 1].episode;
      var missing = [];
      for (var n = min; n <= max; n++) if (!present[n]) missing.push(n);
      var duplicated = Object.keys(counts).filter(function (k) { return counts[k] > 1; }).map(Number).sort(function (a, b) { return a - b; });
      report.push({ group: key, min: min, max: max, count: list.length, missing: missing, duplicated: duplicated });
    });

    return { ok: true, total: videos.length, numbered: numbered.length, report: report };
  }

  function show(videosOverride) {
    var videos = videosOverride || rows().map(function (n) { return { title: titleOf(n) }; });
    var result = analyse(videos);

    Ytk.panel('Series gaps', function (body) {
      if (!result.ok) {
        Ytk.note(body, result.reason, 'ytk2-warn');
        Ytk.note(body, 'Episode numbers are read from titles: "S02E07", "Episode 7", "Ep. 7", "Part 7", "第7集", "#7".');
        return;
      }
      Ytk.kv(body, 'Videos on the page', result.total);
      Ytk.kv(body, 'With an episode number', result.numbered);

      result.report.forEach(function (g) {
        body.appendChild(Ytk.h('div', { style: 'height:10px' }));
        Ytk.note(body, (g.group === 'unseasoned' ? 'No season in the title' : g.group) + ' — episodes ' + g.min + '..' + g.max + ', ' + g.count + ' present');
        if (g.missing.length) Ytk.note(body, 'Missing: ' + g.missing.join(', '), 'ytk2-warn');
        if (g.duplicated.length) Ytk.note(body, 'Duplicate numbers: ' + g.duplicated.join(', '), 'ytk2-warn');
        if (!g.missing.length && !g.duplicated.length) Ytk.note(body, 'Nothing missing between ' + g.min + ' and ' + g.max, 'ytk2-ok');
      });

      Ytk.note(body, 'Videos without a number are ignored, so an unnumbered upload will look like a gap.');
    });
  }

  function deepScan() {
    var id = playlistId();
    if (!id) { Ytk.toast('Open a playlist page first'); return; }
    Ytk.panel('Series gaps — scanning', function (body) { Ytk.note(body, 'Asking the API for every video…'); });
    Ytk.enumeratePlaylist(id, function (n) { Ytk.toast(n + ' videos read'); })
      .then(function (items) { show(items); })
      .catch(function (err) { Ytk.panel('Series gaps', function (body) { Ytk.note(body, 'Scan failed: ' + err.message, 'ytk2-err'); }); });
  }

  function settingsPopup() {
    if (typeof Ytk.openSettings !== 'function') {
      alert('The shared core is out of date (v' + Ytk.VERSION + '). Reinstall this script.');
      return;
    }
    Ytk.openSettings({
      title: 'YT Playlist Series Gap',
      subtitle: 'Reads episode numbers out of titles and reports the holes. Read-only.',
      sectionTitle: 'Detection',
      fields: [
        { key: 'seriesMinTitles', label: 'Minimum numbered titles before reporting', type: 'number', def: 3, min: 1 },
        { key: 'seriesIgnoreSpecials', label: 'Ignore episodes numbered 0 (specials)', type: 'checkbox', def: true },
        { key: 'seriesDeepScan', label: 'Use the API by default (slower, covers the whole playlist)', type: 'checkbox', def: false }
      ],
      actions: [
        { label: 'Check this page now', run: function () { show(); } },
        { label: 'Deep scan the whole playlist', run: deepScan }
      ]
    });
  }

  if (!playlistId() && !rows().length) return;

  Ytk.mountToolbar([{ label: 'Gaps', run: function () { show(); } }]);
  if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Settings…', settingsPopup);
})();
