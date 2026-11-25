(function () {
  'use strict';
  const games = [
    {id:'potions',name:'달빛 물약실',en:'MOONLIT SORT',href:'moonlit-sort/',tag:'마법 정렬',group:'slow',accent:'#edc98d',description:'색을 모아, 한 병의 작은 마법을 완성해요.',detail:'36개 스테이지 · 숨은 색 · 마법 도구',key:'little-arcade:potions:v1'},
    {id:'night',name:'밤의 조각',en:'NIGHT PIECES',href:'night-pieces/',tag:'블록 퍼즐',group:'think',accent:'#b9abdf',description:'세 조각을 놓고, 꽉 찬 한 줄을 비워요.',detail:'드래그 · 콤보 · 매일 30수',key:'night-pieces-v1'},
    {id:'water',name:'물빛 정렬',en:'COLOR REVERIE',href:'water-sort/',tag:'색 정렬',group:'slow',accent:'#e8ae91',description:'조금씩 옮겨, 같은 색끼리 한 병에.',detail:'4–6색 · 되돌리기 · 시간 제한 없음',key:'little-arcade:water:v1'},
    {id:'pipes',name:'별의 길',en:'CONSTELLATION',href:'star-path/',tag:'회전 퍼즐',group:'think',accent:'#a7cbb9',description:'길을 돌려 모든 조각에 빛을 보내요.',detail:'회전 · 연결 미리보기 · 한 칸 도움',key:'little-arcade:pipes:v1'},
    {id:'lights',name:'불빛 끄기',en:'LIGHTS AFTER DARK',href:'lights-out/',tag:'논리 퍼즐',group:'quick',accent:'#e1c17e',description:'하나를 누르면 십자로 바뀌는 불빛.',detail:'4×4–6×6 · 풀 수 있는 배치 · 힌트',key:'little-arcade:lights:v1'},
    {id:'memory',name:'잔상의 정원',en:'AFTERIMAGE',href:'memory-garden/',tag:'기억력',group:'quick',accent:'#d5a8b8',description:'뒤집힌 작은 그림의 짝을 찾아요.',detail:'8–12쌍 · 한 번 미리보기 · 기록',key:'little-arcade:memory:v1'},
    {id:'number',name:'숫자 산책',en:'ONE EMPTY SPACE',href:'number-trail/',tag:'슬라이드',group:'think',accent:'#95bbd5',description:'빈칸을 따라 숫자를 차례로 맞춰요.',detail:'3×3 · 4×4 · 스와이프와 방향키',key:'little-arcade:number:v1'},
    {id:'train',name:'귀가선 2048',en:'THE WAY HOME',href:'train-2048/',tag:'숫자 합치기',group:'slow',accent:'#98bba2',description:'같은 숫자를 모으며 집으로 가는 길.',detail:'스와이프 · 자동 저장 · 한 수 되돌리기',key:'way-home-2048-v1'}
  ];
  function preview(id) {
    let shapes='';const rect=(x,y,w,h,fill,rx=4)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
    const text=(x,y,label,color='#f2eee7',size=15)=>`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="${color}" font-family="system-ui,sans-serif" font-size="${size}" font-weight="650">${label}</text>`;
    if(id==='potions') {
      shapes+='<path d="M213 19a18 18 0 1 0 14 26 19 19 0 0 1-14-26Z" fill="#d8bd88" opacity=".85"/><path d="m39 25 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z" fill="#ebd3a2"/>';
      const palette=['#a775ed','#49c9ac','#f3a25f','#62b9ed'];
      [[0,1,2],[2,0,1,0],[1,2,1,2],[]].forEach((tube,i)=>{
        const x=54+i*39;shapes+=`<path d="M${x+8} 46h14v11l7 8v64q0 10-10 10h-8q-11 0-11-10V65l8-8V46Z" fill="#a4d4e50a" stroke="#9cc5d4" stroke-opacity=".8" stroke-width="1.3"/>`;
        tube.forEach((color,j)=>{shapes+=rect(x+2,119-j*18,25,18,palette[color],j?0:3);});
        shapes+=`<path d="M${x+4} 70v51" stroke="white" stroke-width="1.5" stroke-opacity=".25"/><rect x="${x+6}" y="43" width="18" height="5" rx="2" fill="#17283c" stroke="#9cc5d4" stroke-width="1.2"/>`;
      });
    } else if(id==='water') {
      const palette=['#b4a1d5','#8fbea9','#dca47c','#80acc5'];
      [[0,1,2,0],[1,2,0,1],[2,0,1,2],[3,3,3,3],[],[]].forEach((tube,i)=>{
        const x=30+i*34;shapes+=`<path d="M${x} 47v70q0 8 8 8h6q8 0 8-8V47" fill="#1b2a32" stroke="#50616a" stroke-width="2"/>`;
        tube.forEach((c,j)=>{shapes+=rect(x+3,105-j*16,16,16,palette[c],1);});
      });
    } else if(id==='train'||id==='number') {
      const n=id==='train'?4:3,step=id==='train'?31:40,size=step-5,left=(260-n*step+5)/2,top=(170-n*step+5)/2;
      const values=id==='train'?[2,4,0,0,4,8,16,0,0,16,64,0,0,0,128,256]:[1,2,3,4,0,6,7,5,8];
      values.forEach((v,i)=>{shapes+=rect(left+i%n*step,top+Math.floor(i/n)*step,size,size,v?(id==='train'?(v>32?'#d9a26c':'#91b6a1'):'#9cbbcc'):'#263640',5);if(v)shapes+=text(left+i%n*step+size/2,top+Math.floor(i/n)*step+size/2,v,'#1c343b',v>99?10:15);});
    } else if(id==='memory') {
      for(let i=0;i<16;i++){const x=64+i%4*34,y=23+Math.floor(i/4)*34,open=i===5||i===10;shapes+=rect(x,y,29,29,open?'#d3a9b9':'#293842',5);shapes+=open?`<path d="m${x+9} ${y+19}q-2-13 13-12-1 13-13 12Zm0 0 9-9" stroke="#594052" fill="none" stroke-width="1.5"/>`:text(x+14.5,y+15,'✧','#687e8a',15);}
    } else if(id==='pipes') {
      for(let i=0;i<25;i++){const x=63+i%5*28,y=17+Math.floor(i/5)*28;shapes+=rect(x,y,24,24,'#24343c',4);const angle=[0,90,180,270][i%4];shapes+=`<path d="M0-12V0H12" transform="translate(${x+12} ${y+12}) rotate(${angle})" stroke="${[6,7,8,11,12,13,17,18].includes(i)?'#aed6c1':'#566c7a'}" stroke-width="4" fill="none" stroke-linecap="round"/>`;if(i===12)shapes+=`<circle cx="${x+12}" cy="${y+12}" r="4" fill="#e4c38a"/>`;}
    } else {
      const n=id==='lights'?5:8,step=id==='lights'?27:17,size=step-4,left=(260-n*step+4)/2,top=(170-n*step+4)/2;
      for(let i=0;i<n*n;i++){let color='#293942';if(id==='lights'&&[2,6,7,8,10,11,13,14,16,17,18,22].includes(i))color='#dfbd79';if(id==='night'&&[34,42,43,50,51].includes(i))color='#b4a2d5';if(id==='night'&&[37,38,45,46].includes(i))color='#d8ae83';if(id==='night'&&[56,57,58].includes(i))color='#8abca6';shapes+=rect(left+i%n*step,top+Math.floor(i/n)*step,size,size,color,id==='lights'?5:3);if(id==='lights'&&color!=='#293942')shapes+=`<circle cx="${left+i%n*step+size/2}" cy="${top+Math.floor(i/n)*step+size/2}" r="3" fill="#fff1bd"/>`;}
    }
    return `<svg viewBox="0 0 260 170" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${shapes}</svg>`;
  }
  window.ArcadeCatalog=Object.freeze({games,preview});
})();
