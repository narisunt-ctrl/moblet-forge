// Moblet Forge build: inlines src/*.js into one self-contained HTML file.
//   node build.mjs  ->  index.html (GitHub Pages) + dist/moblet-forge.html (same app, no wrapper)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const order = ['engine', 'rl', 'levels', 'quests', 'art', 'app'];
const shell = readFileSync('src/shell.html', 'utf8');
const scripts = order
  .map((n) => `<script data-mf="${n}">\n${readFileSync(`src/${n}.js`, 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`)
  .join('\n');
const body = shell.replace('<!--MF-SCRIPTS-->', () => scripts); // function form: keeps "$$" literal

mkdirSync('dist', { recursive: true });
writeFileSync('dist/moblet-forge.html', body);
const head = body.slice(0, body.indexOf('<div class="app"'));
const rest = body.slice(body.indexOf('<div class="app"'));
writeFileSync(
  'index.html',
  `<!doctype html>\n<html lang="th">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}</head>\n<body>\n${rest}</body>\n</html>\n`
);
console.log('built index.html and dist/moblet-forge.html', (body.length / 1024).toFixed(1) + ' KB');
