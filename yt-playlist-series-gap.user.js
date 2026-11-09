// ==UserScript==
// @name         YT Playlist Series Gap
// @namespace    https://github.com/chirag127
// @version      1.0.2
// @description  Reads episode numbers from playlist titles and reports missing and duplicate episodes within each range.
// @author       chirag127
// @license      MIT
// @match        https://www.youtube.com/*
// @require      https://raw.githubusercontent.com/chirag127/yt-core-lib/main/yt-core-lib-1.4.0.js
// @downloadURL  https://raw.githubusercontent.com/chirag127/yt-playlist-series-gap-userscript/main/yt-playlist-series-gap.user.js
// @updateURL    https://raw.githubusercontent.com/chirag127/yt-playlist-series-gap-userscript/main/yt-playlist-series-gap.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      *
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (typeof Ytk === 'undefined') { console.error('[yt-playlist-series-gap] core did not load'); return; }
  if (!Ytk.featureOn('seriesGap', true)) return;

  const ROW_SEL = 'yt-lockup-view-model, ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer';

  function onPlaylistSurface() {
    return location.pathname === '/playlist' || !!document.querySelector('ytd-playlist-panel-renderer');
  }

  function raw() { return Ytk.storeGet('settings', {}) || {}; }

  function rowRoot() {
    const root = location.pathname === '/playlist'
      ? document.querySelector('ytd-playlist-video-list-renderer') || document.querySelector('ytd-browse[page-subtype="playlist"]')
      : document.querySelector('ytd-playlist-panel-renderer');
    return root || null;
  }

  function titles() {
    const root = rowRoot();
    if (!root) return [];
    return Array.from(root.querySelectorAll(ROW_SEL)).map(function (node) {
      const vm = node.data && node.data.lockupViewModel ? Ytk.lockupToItem(node.data.lockupViewModel) : null;
      const titleEl = node.querySelector('yt-lockup-metadata-view-model h3 a, a#video-title, #video-title');
      return String((vm && vm.title) || (titleEl && (titleEl.getAttribute('title') || titleEl.textContent)) || '').trim();
    }).filter(Boolean);
  }

  /**
   * Group titles by season (or one pool), then report the holes inside each
   * observed range and any episode number that appears twice.
   */
  function analyse(list, minTitles, bySeason) {
    const numbered = list.map(function (title) { return { title: title, ep: Ytk.parseEpisode(title) }; })
      .filter(function (x) { return x.ep; });
    if (numbered.length < minTitles) {
      return { ok: false, numbered: numbered.length, groups: [], reason: 'Only ' + numbered.length + ' title(s) carry an episode number; at least ' + minTitles + ' are needed for a range.' };
    }

    const groups = {};
    numbered.forEach(function (x) {
      const key = bySeason ? 's' + (x.ep.season === null ? '?' : x.ep.season) : 'all';
      (groups[key] = groups[key] || []).push(x);
    });

    const result = [];
    Object.keys(groups).forEach(function (key) {
      const items = groups[key].slice().sort(function (a, b) { return a.ep.episode - b.ep.episode; });
      const have = new Set(items.map(function (x) { return x.ep.episode; }));
      const counts = {};
      items.forEach(function (x) { counts[x.ep.episode] = (counts[x.ep.episode] || 0) + 1; });
      const min = items[0].ep.episode;
      const max = items[items.length - 1].ep.episode;
      const missing = [];
      for (let n = min; n <= max; n++) if (!have.has(n)) missing.push(n);
      const duplicates = Object.keys(counts).filter(function (n) { return counts[n] > 1; })
        .map(Number).sort(function (a, b) { return a - b; });
      const season = key === 'all' ? null : (key === 's?' ? null : Number(key.slice(1)));
      result.push({
        label: key === 'all' ? 'All episodes' : key === 's?' ? 'Season unknown' : 'Season ' + season,
        min: min, max: max, counted: items.length,
        missing: missing, duplicates: duplicates,
        duplicateTitles: items.filter(function (x) { return duplicates.indexOf(x.ep.episode) !== -1; })
      });
    });
    result.sort(function (a, b) { return (a.min - b.min) || String(a.label).localeCompare(String(b.label)); });
    return { ok: true, numbered: numbered.length, groups: result };
  }

  function seriesGap() {
    if (!onPlaylistSurface()) { Ytk.toast('Open a playlist first.'); return; }
    const list = titles();
    const minTitles = Math.max(2, Math.min(50, parseInt(raw().seriesGapMinTitles, 10) || 3));
    const bySeason = raw().seriesGapBySeason === undefined ? true : !!raw().seriesGapBySeason;
    const showUnnumbered = !!raw().seriesGapShowUnnumbered;
    const report = analyse(list, minTitles, bySeason);
    const unnumbered = list.filter(function (title) { return !Ytk.parseEpisode(title); });

    Ytk.panel('Series gaps', function (body) {
      Ytk.kv(body, 'Rows loaded', list.length);
      Ytk.kv(body, 'With an episode number', report.numbered);
      Ytk.note(body, 'Episode numbers come from the title text (S1E2, Episode 4, EP4, Part 2, #7, 第3集, “3. …”). Loaded rows only — scroll the playlist to load more before trusting a gap.', 'ytk2-dim');

      if (!report.ok) {
        Ytk.note(body, report.reason, 'ytk2-warn');
      } else {
        let clean = 0;
        report.groups.forEach(function (g) {
          Ytk.note(body, g.label + ' · ' + g.counted + ' episode(s) · range ' + g.min + '–' + g.max);
          if (!g.missing.length && !g.duplicates.length) {
            clean++;
            Ytk.note(body, 'No gaps between ' + g.min + ' and ' + g.max + '.', 'ytk2-ok');
            return;
          }
          if (g.missing.length) Ytk.note(body, 'Missing: ' + g.missing.join(', '), 'ytk2-warn');
          if (g.duplicates.length) Ytk.note(body, 'Duplicate numbers: ' + g.duplicates.join(', '), 'ytk2-warn');
          g.duplicateTitles.slice(0, 12).forEach(function (x) {
            Ytk.note(body, '  E' + x.ep.episode + ' — ' + x.title, 'ytk2-dim');
          });
          if (g.duplicateTitles.length > 12) Ytk.note(body, '  …and ' + (g.duplicateTitles.length - 12) + ' more duplicate rows.');
        });
        if (clean === report.groups.length) Ytk.note(body, 'Every in-range episode number appears once.');
      }

      if (showUnnumbered && unnumbered.length) {
        Ytk.note(body, unnumbered.length + ' title(s) had no recognisable episode number:');
        unnumbered.slice(0, 20).forEach(function (title) { Ytk.note(body, '  ' + title, 'ytk2-dim'); });
        if (unnumbered.length > 20) Ytk.note(body, '  …and ' + (unnumbered.length - 20) + ' more.');
      }
    });
  }

  const fields = [
    { key: 'seriesGapMinTitles', label: 'Minimum numbered titles for a report', type: 'number', def: parseInt(raw().seriesGapMinTitles, 10) || 3, hint: '2–50. Below this, “no gaps” would be meaningless.' },
    { key: 'seriesGapBySeason', label: 'Group by season when the title has one', type: 'checkbox', def: raw().seriesGapBySeason === undefined ? true : !!raw().seriesGapBySeason },
    { key: 'seriesGapShowUnnumbered', label: 'List titles with no episode number', type: 'checkbox', def: !!raw().seriesGapShowUnnumbered }
  ];

  GM_registerMenuCommand('Settings…', function () {
    const before = raw();
    Ytk.openSettings({
      title: 'YT Playlist Series Gap',
      subtitle: 'Missing and duplicate episode numbers, read from playlist titles.',
      sectionTitle: 'Detection',
      fields: fields,
      // Core 1.3.0 keeps only its own settings keys on save; re-merge this script's keys.
      onSave: function (next) { Ytk.storeSet('settings', Object.assign({}, before, next)); }
    });
  });

  let mounted = false;
  function mount() {
    if (mounted || !onPlaylistSurface()) return;
    mounted = true;
    Ytk.mountToolbar([{ label: 'Series gaps', run: seriesGap }]);
  }
  mount();
  // The sidebar panel often renders after document-idle, and an in-app navigation
  // never reloads the page, so both events retry the idempotent mount.
  document.addEventListener('yt-navigate-finish', mount);
  document.addEventListener('yt-page-data-updated', mount);
})();
