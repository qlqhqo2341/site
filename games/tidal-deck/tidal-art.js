(function(root){
  'use strict';
  const paths={
    coral:'M24 43V23m0 9-9-8V13m9 13 10-9V9m-10 9-7-7V6m7 32 13-6 5-9M15 20l-7-4V9m26 7 8-5V5',
    pearl:'M8 33c5-4 27-4 32 0l-6 10H14L8 33Zm2-1L8 18l10 11m20 3 2-14-10 11M17 34a7 7 0 1 1 14 0M18 17l-3-8m15 8 3-8M24 13V3',
    shell:'M24 41C-1 27 3 10 14 13c5-13 15-13 20 0 11-3 15 14-10 28Zm0 0V9m0 32L12 16m12 25 12-25M17 42h14',
    weed:'M24 44C8 30 40 23 24 4m0 40C35 29 7 24 17 12m7 32c8-5 17-8 18-20M24 32C14 31 6 27 6 19m16 2c6-1 13-6 13-13',
    ink:'M24 4C21 14 8 22 8 31a16 16 0 0 0 32 0C40 22 27 14 24 4Zm-8 25c-3 7 1 11 5 12M18 10l-2-5M38 20l5-3',
    lantern:'M16 10a8 8 0 0 1 16 0M12 14h24l4 25H8l4-25Zm5 0v25m14-25v25M8 43h32M23 24l-3 7h8l-3-7',
    jelly:'M8 25a16 16 0 0 1 32 0c-5 4-9-3-16 0s-11 3-16 0Zm7-3c0-9 4-13 9-14m0 0c6 5 9 10 9 14M12 30c-7 8 9 7 1 15m11-15c-8 9 8 6 0 16m12-16c8 7-8 10 0 15',
    crown:'m6 13 10 8 8-13 8 13 10-8-5 24H11L6 13Zm7 29h22M16 29h16M24 6V2M4 10 1 6m43 4 3-4',
    whale:'M7 30c9 9 28 11 32-8l7-9-11 1c-12-13-29-2-28 16Zm0 0-5 9 15-4m7-20v-4m-5-3 5 3 5-3M29 25h.1M11 30c4-1 9 0 10 6',
    compass:'M24 3v6m0 30v6M3 24h6m30 0h6M9 9l4 4m22 22 4 4M9 39l4-4m22-22 4-4M24 9a15 15 0 1 1 0 30 15 15 0 0 1 0-30Zm8 7-5 11-11 5 5-11 11-5Z',
    spiral:'M24 42C0 42 4 8 25 7s23 29 3 29-20-22-5-22 15 15 5 15-8-8-4-8m-6 21-4 4m20-8 5 4',
    anchor:'M24 11V43M17 6a7 7 0 1 1 14 0 7 7 0 0 1-14 0ZM10 17h28M5 27c0 13 12 17 19 17s19-4 19-17M2 32l3-7 7 3m24 0 7-3 3 7',
    bubbles:'M16 19a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm16-15a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm20 32a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM12 23l-2 3M28 8l-2 3',
    moon:'M32 5a19 19 0 1 0 10 29A18 18 0 0 1 32 5ZM8 16l7 5m1-16 4 6M33 19v8m-4-4h8',
    chest:'M8 20h32v22H8V20Zm0 0v-6c0-14 32-14 32 0v6M4 20h40M20 23h8v8h-8v-8ZM14 4v16m20-16v16M24 32v4'
  };
  function icon(id,extra=''){return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="sea-icon ${extra}"><path d="${paths[id]||paths.compass}"/></svg>`;}
  const api={icon};if(typeof module==='object'&&module.exports)module.exports=api;else root.TidalArt=api;
})(typeof window==='object'?window:globalThis);
