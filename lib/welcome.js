const {JSDOM} = require('jsdom');

const _svg = ''; // Your SVG content here

const {document: svg} = new JSDOM(_svg).window;

/**
 * Generate SVG Welcome
 * @param {object} param0
 * @param {string} param0.wid
 * @param {string} param0.title
 * @param {string} param0.name
 * @param {string} param0.text
 * @return {string}
 */
const genSVG = async ({
  wid = '',
  title = '',
  name = '',
  text = '',
} = {}) => {
  const el = {
    code: ['#_1661899539392 > g:nth-child(6) > image', imageSetter, toBase64(await toImg(barcode(wid.replace(/[^0-9]/g, '')), 'png'), 'image/png')],
    text: ['#_1661899539392 > text.fil1.fnt0', textSetter, text],
    title: ['#_1661899539392 > text.fil2.fnt1', textSetter, title],
    name: ['#_1661899539392 > text.fil2.fnt2', textSetter, name],
  };
  for (const [selector, set, value] of Object.values(el)) {
    set(svg.querySelector(selector), value);
  }
  return svg.body.innerHTML;
};

/**
 * Render SVG Welcome
 * @param {object} param0
 * @param {string} param0.wid
 * @param {string} param0.name
 * @param {string} param0.text
 * @return {Promise<string>}
 */
const render = async ({
  wid = '',
  name = '',
  title = '',
  text = '',
} = {}) => {
  const svg = await genSVG({
    wid, name, text, title,
  });
  return svg;
};

if (require.main === module) {
  render({
    wid: '1234567890',
    name: 'John Doe',
    text: 'Lorem ipsum\ndot sit color',
    title: 'grup testing',
  }).then((result) => {
    process.stdout.write(result);
  });
} else module.exports = render;
