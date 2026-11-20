'use strict';
importScripts('potion-engine.js');
self.onmessage=event=>{
  const {id,round}=event.data||{};
  try {if(!self.PotionEngine.valid(round))throw Error('Invalid puzzle');self.postMessage({id,move:self.PotionEngine.suggest(round)});}
  catch {self.postMessage({id,move:null,error:true});}
};
