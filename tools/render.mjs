// 追问链题库渲染器：volumes/*.md → site/*.html + site/index.html
// 零依赖，Node >= 18。渲染目标是我们自定义的受限 Markdown 子集。
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const volDir = join(root, 'volumes');
const siteDir = join(root, 'site');
mkdirSync(siteDir, { recursive: true });

const REPO = 'https://github.com/JaleWang-BUPT/ebodied-interview-chains';
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  const math = [];
  s = s.replace(/\$\$[^$]+\$\$|\$[^$\n]+\$/g, m => { math.push(m); return `\u0000M${math.length - 1}\u0000`; });
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\u0000M(\d+)\u0000/g, (_, i) => math[i]);
  return s;
}

function renderBody(md) {
  const out = [];
  let para = [], list = null, note = [];
  const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.t}>` + list.items.join('') + `</${list.t}>`); list = null; } };
  const flushNote = () => { if (note.length) { out.push('<div class="note">' + note.map(inline).join('<br>') + '</div>'); note = []; } };

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/^<details\b/.test(line)) { flushPara(); flushList(); flushNote(); out.push(line); continue; }
    if (/^<\/details>/.test(line)) { flushPara(); flushList(); out.push(line); continue; }
    if (inRaw(line)) { flushPara(); flushList(); out.push(line); continue; }
    if (/^# /.test(line)) { flushPara(); flushList(); flushNote(); out.push('<h1>' + inline(line.slice(2)) + '</h1>'); continue; }
    if (/^## /.test(line)) { flushPara(); flushList(); flushNote(); out.push('<h2>' + inline(line.slice(3)) + '</h2>'); continue; }
    if (/^> /.test(line)) { flushPara(); flushList(); note.push(line.slice(2)); continue; }
    if (/^---+$/.test(line)) { flushPara(); flushList(); flushNote(); out.push('<hr>'); continue; }
    if (/^- /.test(line)) { flushPara(); flushNote(); if (!list || list.t !== 'ul') { flushList(); list = { t: 'ul', items: [] }; } list.items.push('<li>' + inline(line.slice(2)) + '</li>'); continue; }
    if (/^\d+\. /.test(line)) { flushPara(); flushNote(); if (!list || list.t !== 'ol') { flushList(); list = { t: 'ol', items: [] }; } list.items.push('<li>' + inline(line.replace(/^\d+\. /, '')) + '</li>'); continue; }
    if (/^$/.test(line)) { flushPara(); flushList(); flushNote(); continue; }
    flushNote(); para.push(line);
  }
  flushPara(); flushList(); flushNote();
  return out.join('\n');
  function inRaw(l) { return /^<\/?summary>/.test(l) || /^<summary>/.test(l); }
}

function countChains(md) { return (md.match(/<details class="chain">/g) || []).length; }
function countNodes(md) { return (md.match(/<summary>/g) || []).length + (md.match(/^\*\*追问 \d+/gm) || []).length; }

const CSS = `
:root{--bg:#fbfbfa;--fg:#1f2328;--mut:#656d76;--line:#e4e4e0;--acc:#0969da}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.75 -apple-system,"Segoe UI","Microsoft YaHei","PingFang SC",sans-serif}
main{max-width:840px;margin:0 auto;padding:28px 18px 80px}
h1{font-size:26px;line-height:1.4;margin:.4em 0 .2em}
h2{font-size:20px;margin:2em 0 .6em;border-bottom:1px solid var(--line);padding-bottom:.3em}
p{margin:.7em 0}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
code{background:#f0f1f2;border-radius:4px;padding:.1em .35em;font-size:.92em}
hr{border:none;border-top:1px solid var(--line);margin:2.2em 0}
.note{background:#f3f6fb;border-left:4px solid var(--acc);border-radius:6px;padding:10px 16px;margin:14px 0;font-size:15px;color:#33415c}
details.chain{background:#fff;border:1px solid var(--line);border-radius:12px;padding:6px 18px;margin:14px 0;box-shadow:0 1px 2px rgba(0,0,0,.03)}
details.chain[open]{border-color:#d5d8dd}
summary{cursor:pointer;font-weight:600;font-size:16.5px;padding:8px 0;list-style:none;position:relative;padding-right:28px}
summary::-webkit-details-marker{display:none}
summary::after{content:'展开';position:absolute;right:0;top:8px;font-size:12.5px;font-weight:400;color:var(--mut);border:1px solid var(--line);border-radius:20px;padding:1px 10px}
details.chain[open] summary::after{content:'收起'}
details.chain[open]>summary{border-bottom:1px dashed var(--line);margin-bottom:6px}
.lv{display:inline-block;font-size:12px;font-weight:700;border-radius:6px;padding:0 7px;margin-right:4px;vertical-align:2px;color:#fff}
.lv-l1{background:#1a7f37}.lv-l2{background:#0969da}.lv-l3{background:#cf222e}
.freq{color:#9a6700;font-size:14px;margin-right:6px}
.top{border-bottom:1px solid var(--line);margin-bottom:8px}
.top nav{max-width:840px;margin:0 auto;padding:14px 18px;display:flex;gap:18px;align-items:baseline;flex-wrap:wrap}
.top .brand{font-weight:700;color:var(--fg)}
footer{border-top:1px solid var(--line);margin-top:60px}
footer div{max-width:840px;margin:0 auto;padding:18px;color:var(--mut);font-size:13.5px}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px 20px;margin:14px 0}
.card h2{border:none;margin:0 0 6px}
.meta{color:var(--mut);font-size:14px}
@media(max-width:640px){main{padding:18px 12px 60px}summary{font-size:15.5px;padding-right:64px}summary::after{top:4px}}
`;

function page(title, body, rel) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<script>window.MathJax={tex:{inlineMath:[['$','$']],displayMath:[['$$','$$']]},chtml:{displayAlign:'left'}};</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async></script>
<style>${CSS}</style>
</head>
<body>
<div class="top"><nav><span class="brand">具身智能面试追问链</span><a href="${rel}">📚 卷目录</a><a href="${REPO}" target="_blank" rel="noopener">GitHub</a></nav></div>
<main>
${body}
</main>
<footer><div>题目来自公开一手面经，来源见各链「实录」行 · 执行 AI ≠ 审查 AI，审查记录见 research/reviews/ · <a href="${REPO}" target="_blank" rel="noopener">MIT License</a> · 渲染于 ${new Date().toISOString().slice(0, 10)}</div></footer>
</body>
</html>`;
}

const files = readdirSync(volDir).filter(f => f.endsWith('.md')).sort();
const vols = [];
for (const f of files) {
  const md = readFileSync(join(volDir, f), 'utf8');
  const titleLine = (md.match(/^# (.+)$/m) || ['', basename(f, '.md')])[1];
  const chains = countChains(md), nodes = countNodes(md);
  const html = page(titleLine, renderBody(md), './index.html');
  const outName = f.replace(/\.md$/, '.html');
  writeFileSync(join(siteDir, outName), html);
  vols.push({ file: outName, title: titleLine, chains, nodes });
  console.log(`rendered ${outName}: ${chains} 链 / ${nodes} 节点`);
}

const cards = vols.map(v => `<div class="card"><h2><a href="./${v.file}">${inline(v.title)}</a></h2><div class="meta">${v.chains} 条追问链 · ${v.nodes} 个问答节点</div></div>`).join('\n');
const idxBody = `
<h1>具身智能面试追问链</h1>
<div class="note">按面试官真实下钻路径组织：主问 → 追问 → 深挖。先自己答，再展开对照，再合上把整条链讲一遍。<br>题目全部来自公开一手面经（牛客 / CSDN / GitHub 实录），频次独立统计；答案经独立 AI 交叉审查。</div>
${cards}`;
writeFileSync(join(siteDir, 'index.html'), page('具身智能面试追问链 · 卷目录', idxBody, './index.html'));
console.log('rendered index.html');
