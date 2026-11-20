(function(root){
  'use strict';
  const polygon=[[31,17],[49,17],[49,34],[64,44],[67,52],[67,145],[61,158],[51,162],[29,162],[19,158],[13,145],[13,52],[16,44],[31,34]];
  function area(points){let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=a[0]*b[1]-b[0]*a[1];}return Math.abs(sum)/2;}
  function below(points,y){const result=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],insideA=a[1]>=y,insideB=b[1]>=y;if(insideA)result.push(a);if(insideA!==insideB){const t=(y-a[1])/(b[1]-a[1]);result.push([a[0]+t*(b[0]-a[0]),y]);}}return result;}
  const unitArea=area(below(polygon,52))/4;
  function height(units,angle=0){
    const radians=angle*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);
    const points=polygon.map(([x,y])=>[(x-40)*c-(y-118)*s,(x-40)*s+(y-118)*c]);
    let low=Math.min(...points.map(p=>p[1]))-1,high=Math.max(...points.map(p=>p[1]))+1;
    if(units<=0)return high+118;
    const target=Math.min(4,units)*unitArea;
    for(let i=0;i<25;i++){const mid=(low+high)/2;if(area(below(points,mid))>target)low=mid;else high=mid;}
    return (low+high)/2+118;
  }
  function svg(tube,known,options={}){
    const E=root.PotionEngine||(typeof require==='function'?require('./potion-engine.js'):null),prefix=options.prefix||'potion',angle=options.angle||0;
    const volumes=tube.map((color,i)=>({color,known:known[i],amount:1}));let drain=options.drain||0;
    for(let i=volumes.length-1;i>=0&&drain>0;i--){const removed=Math.min(drain,volumes[i].amount);volumes[i].amount-=removed;drain-=removed;}
    if(options.incoming?.amount>0){let remaining=options.incoming.amount;while(remaining>0){const amount=Math.min(1,remaining);volumes.push({color:options.incoming.color,known:true,amount});remaining-=amount;}}
    let cumulative=0,liquid='';
    for(const unit of volumes){if(unit.amount<=0)continue;const bottom=height(cumulative,angle),top=height(cumulative+unit.amount,angle),fill=unit.known?E.COLORS[unit.color-1]:'#51627b';cumulative+=unit.amount;liquid+=`<rect x="-160" y="${top}" width="400" height="${bottom-top+.4}" fill="${fill}"/><rect x="-160" y="${top}" width="400" height="1.8" fill="white" opacity=".19"/>`;if(Math.abs(angle)<2&&unit.amount>.7&&!options.moving)liquid+=`<text x="40" y="${(top+bottom)/2+1}" text-anchor="middle" dominant-baseline="central" fill="${unit.known?'#142b44':'#d5ddec'}" opacity="${unit.known ? .65 : .9}" font-family="system-ui,sans-serif" font-size="${unit.known?13:18}" font-weight="650">${unit.known?E.SYMBOLS[unit.color-1]:'?'}</text>`;}
    const path='M31 16H49V34L63 43Q69 48 69 56V145Q69 165 50 165H30Q11 165 11 145V56Q11 48 17 43L31 34Z';
    const cork=options.complete?'<g class="cork"><rect x="28" y="7" width="24" height="13" rx="4" fill="#d7a96a" stroke="#f7d99b" stroke-width="1.2"/><path d="M31 11h18m-16 5h14" stroke="#986b39" stroke-width="1.2" opacity=".65"/><path d="m57 12 2-4 2 4 4 2-4 2-2 4-2-4-4-2Z" fill="#f7d99b"/></g>':'';
    return `<svg class="vial-art" viewBox="0 0 80 176" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="${prefix}-glass" x1="0" x2="1"><stop stop-color="#cceafa" stop-opacity=".13"/><stop offset=".4" stop-color="#b4d7e9" stop-opacity=".035"/><stop offset="1" stop-color="#cceafa" stop-opacity=".15"/></linearGradient><clipPath id="${prefix}-clip"><path d="${path}"/></clipPath></defs><ellipse cx="40" cy="169" rx="27" ry="3" fill="#020917" opacity=".3"/><g clip-path="url(#${prefix}-clip)"><g transform="rotate(${-angle} 40 118)">${liquid}</g></g><path d="${path}" fill="url(#${prefix}-glass)" stroke="#a6d0e0" stroke-opacity=".7" stroke-width="1.5"/><path d="M17 58v81q0 11 5 15" stroke="#e5f4ff" stroke-opacity=".38" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M63 65v54M35 20v12" stroke="#effaff" stroke-opacity=".3" stroke-width="1.5" stroke-linecap="round"/><rect x="28" y="13" width="24" height="6" rx="2.5" fill="#192b43" stroke="#b7d9e7" stroke-opacity=".85" stroke-width="1.5"/>${cork}</svg>`;
  }
  const api={svg,height,unitArea};if(typeof module==='object'&&module.exports)module.exports=api;else root.PotionArt=api;
})(typeof window==='object'?window:globalThis);
