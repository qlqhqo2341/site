(function(root){
  'use strict';
  const routes=Object.freeze({
    'games.html':'index.html',
    'night-pieces.html':'night-pieces/',
    'train-2048.html':'train-2048/',
    'lights-out.html':'lights-out/',
    'water-sort.html':'water-sort/',
    'number-trail.html':'number-trail/',
    'memory-garden.html':'memory-garden/',
    'star-path.html':'star-path/',
    'moonlit-sort.html':'moonlit-sort/'
  });
  if(typeof module==='object'&&module.exports)module.exports=routes;
  else root.ARCADE_LEGACY_ROUTES=routes;
})(typeof self==='object'?self:globalThis);
