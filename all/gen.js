const fs = require('fs');
const path = require('path');

const siteRoot = path.resolve(__dirname, '..');

function read(file) {
  return new Promise((res, rej) => {
    fs.readFile(path.resolve(siteRoot, file), 'utf8', (err, data) => err ? rej(err) : res(data));
  });
}
function write(file, contents) {
  return new Promise((res, rej) => {
    fs.writeFile(path.resolve(siteRoot, file), contents, 'utf8', err => err ? rej(err) : res());
  });
}

const folderSymbol = Symbol('folder');

const BASE_URL = 'https://sheeptester.github.io'
const customPaths = [
  // Manually add paths to the sitemap
];

function generateShowBtns() {
  const options = [
    {label: 'HTML', name: 'hidehtml', selector: '.html'},
    {label: 'images', name: 'hideimg', selector: '.img'},
    {label: 'everything else', name: 'hideother', selector: '.other'}
  ];
  const optionNames = options.map(option => option.name);
  const showSelectors = new Set();
  const hideSelectors = new Set();
  const targets = [[]];
  const links = {};
  for (const {name, selector} of options) {
    targets.push(...targets.map(target => [...target, name]));
    hideSelectors.add(`:target[id*="${name}"]~* ${selector}`);
    links[name] = new Set();
  }
  for (const target of targets) {
    const id = target.join('_');
    for (const {name, label} of options) {
      // This variable name is misleading; "checked" just means whether it's
      // non-default state is activated, which in this case actually means being
      // unchecked.
      const checked = target.includes(name);
      const newTarget = target.includes(name)
        ? target
          .filter(n => n !== name)
          .join('_')
        : optionNames
          .filter(n => n === name || target.includes(n))
          .join('_');
      const className = `checkbox-${name}-${newTarget}${checked ? '' : '-checked'}`
      links[name].add(
        `<a href="#${
          newTarget
        }" class="checkbox checkbox-type-${
          name
        } ${className}${
          checked ? '' : ' checked'
        }" role=checkbox aria-checked=${!checked}>${
          label
        }</a>`
      );
      if (id !== '') {
        showSelectors.add(`:target[id="${id}"]~.preamble .${className}`);
      } else {
        showSelectors.add(`.${className}`);
        hideSelectors.add(`:target~.preamble .${className}`);
      }
    }
  }
  return {
    targets: targets
      .filter(target => target.length)
      .map(target => `<a class=target id="${target.join('_')}"></a>`)
      .join(''),
    links: Object.values(links)
      .map(links => Array.from(links).join(''))
      .join(''),
    styles: `${Array.from(showSelectors).join(',')}{display:inline-flex}${Array.from(hideSelectors).join(',')}{display:none}`
  };
}

(async () => {
  console.log('Starting...');
  const paths = JSON.parse(await read('./all/more-everything.json')); // this file is big
  paths.push(...customPaths);
  const pathObj = {};
  function objectception(obj, dirs) {
    if (dirs.length <= 1) {
      if (!obj[folderSymbol]) obj[folderSymbol] = [];
      obj[folderSymbol].push(dirs[0]);
    } else {
      if (!obj[dirs[0]]) obj[dirs[0]] = [];
      objectception(obj[dirs[0]], dirs.slice(1));
    }
  }
  paths.forEach(path => objectception(pathObj, path.split('/').slice(1)));
  const pathLines = [];
  const localeCompare = (a, b) => a.localeCompare(b)
  function splatception(obj) {
    const files = obj[folderSymbol];
    delete obj[folderSymbol];
    Object.keys(obj).sort(localeCompare).forEach(dir => {
      pathLines.push('>' + dir);
      splatception(obj[dir]);
      pathLines.push('<');
    });
    if (files) pathLines.push(...files.sort(localeCompare));
  }
  splatception(pathObj);
  await write('./all/everything.txt', pathLines.join('\n'));
  const template = await read('./all/template-all.html');
  let html = '';
  const tempPath = [''];
  const htmlURLs = [];
  pathLines.forEach(line => {
    if (line[0] === '>') {
      tempPath.push(line.slice(1));
      html += `<details open><summary>${line.slice(1)}</summary><div class="body">`;
    } else if (line === '<') {
      html += `</div></details>`;
      tempPath.pop();
    } else {
      const extension = line.slice(line.lastIndexOf('.') + 1);
      const url = tempPath.join('/') + '/' + (line === 'index.html' || line === 'index.md' ? '' : line);
      let type = 'other';
      switch (extension.toLowerCase()) {
        case 'html':
          type = 'html';
          if (line === 'index.html') type += ' index';
          htmlURLs.push(BASE_URL + url);
          break;
        case 'css':
        case 'scss':
          type = 'other css';
          break;
        case 'js':
        case 'mjs':
        case 'ts':
        case 'gs':
          type = 'other js';
          break;
        case 'svg':
        case 'png':
        case 'gif':
        case 'jpg':
        case 'webp':
          type = 'img';
          break;
        case 'md':
          if (line === 'index.md') {
            type = 'other index';
            htmlURLs.push(BASE_URL + url);
          }
          break;
      }
      html += `<a href="${url}" class="${type}">${decodeURIComponent(line)}</a>`;
    }
  });
  const {targets, links, styles} = generateShowBtns();
  await write(
    './all/index.html',
    template
      .replaceAll('{DATE}', new Date().toISOString().slice(0, 10))
      .replaceAll('{ISO}', new Date().toISOString())
      .replace('{STYLES}', `<style>${styles}</style>`)
      .replace('{TARGETS}', targets)
      .replace('{CHECKBOXES}', links)
      .replace('{FILES}', html)
  );
  await write('./all/sitemap.txt', htmlURLs.join('\n'));
  console.log('Done!');
})();
