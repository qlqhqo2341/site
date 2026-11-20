#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),routes=require('../games/legacy-routes.js');
function redirect(file,target){
  const href='games/'+target;
  // This host also serves games.html for /games/ before looking for a directory index.
  const base=file==='games.html'?"const base=new URL(document.baseURI);if(base.pathname.endsWith('/games/'))base.pathname=base.pathname.slice(0,-6);":'';
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${href}">
  <link rel="canonical" href="${href}">
  <title>게임의 새 주소로 이동합니다</title>
  <script>${base}const target=new URL(${JSON.stringify(href)},${base?'base':'document.baseURI'});target.search=location.search;target.hash=location.hash;location.replace(target.href);</script>
</head>
<body style="margin:0;padding:32px;font:16px/1.8 system-ui,sans-serif"><p>게임을 새 보관함으로 옮겼어요. <a href="${href}">게임 열기</a></p></body>
</html>
`;
}
if(require.main===module)for(const[file,target]of Object.entries(routes)){
  const output=path.join(root,file),expected=redirect(file,target);
  if(process.argv.includes('--check')){if(!fs.existsSync(output)||fs.readFileSync(output,'utf8')!==expected){console.error(`Stale compatibility redirect: ${file}`);process.exitCode=1;}}
  else fs.writeFileSync(output,expected);
}
module.exports={redirect,routes};
