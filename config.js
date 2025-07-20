
import { watchFile, unwatchFile } from 'fs';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import fs from 'fs';
import moment from 'moment-timezone';

// Define global variables
global.owner = [['96176337375', 'Elta', true]];
global.xaxa = 'kaneki';
global.suittag = ['96176337375'];
global.prems = ['96176337375'];
global.packname = 'YUKI';
global.author = '';
global.wm = '★𝓝𝓲𝓷𝓸 - 𝑩𝑶𝑻 𝐵𝛩𝑇★';
global.titulowm = '🤖 𝓝𝓲𝓷𝓸 - 𝑩𝑶𝑻 🤖';
global.titulowm2 = '乂 𝓝𝓲𝓷𝓸 - 𝑩𝑶𝑻 乂';
global.igfg = '★𝓝𝓲𝓷𝓸&𝑩𝑶𝑻★';
global.wait = '*⌛ _downloading..._*\n\n*▰▰▰▱▱▱▱▱*';
global.imagen1 = fs.readFileSync('./menu.jpg');
global.imagen2 = fs.readFileSync('./menu.jpg');
global.imagen3 = fs.readFileSync('./menu.jpg');
global.imagen4 = fs.readFileSync('./menu.jpg');
global.mods = [];
global.d = new Date();
global.locale = 'ar';
global.dia = d.toLocaleDateString(locale, { weekday: 'long' });
global.fecha = d.toLocaleDateString(locale, { day: 'numeric', month: 'numeric', year: 'numeric' });
global.mes = d.toLocaleDateString(locale, { month: 'long' });
global.año = d.toLocaleDateString(locale, { year: 'numeric' });
global.tiempo = d.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true });
global.wm2 = `${global.dia} ${global.fecha}\n★𝓝𝓲𝓷𝓸 - 𝑩𝑶𝑻★`;
global.gt = '𝓝𝓲𝓷𝓸 - 𝑩𝑶𝑻★';
global.md = 'https://chat.whatsapp.com/BjrqiXLZKmZ3jW7vEDyV27';
global.waitt = '*⌛ _downloading..._*\n\n*▰▰▰▱▱▱▱▱*';
global.waittt = '*⌛ _downloading ..._*\n\n*▰▰▰▱▱▱▱▱*';
global.waitttt = '*⌛ _downloading..._*\n\n*▰▰▰▱▱▱▱▱*';
global.nomorown = '76337375';
global.pdoc = ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/msword', 'application/pdf', 'text/rtf'];
global.cmenut = '❖––––––『';
global.cmenub = '┊✦ ';
global.cmenuf = '╰━═┅═━––––––๑\n';
global.cmenua = '\n⌕ ❙❘❙❙❘❙❚❙❘❙❙❚❙❘❙❘❙❚❙❘❙❙❚❙❘❙❙❘❙❚❙❘ ⌕\n     ';
global.dmenut = '*❖─┅──┅〈*';
global.dmenub = '*┊»*';
global.dmenub2 = '*┊*';
global.dmenuf = '*╰┅────────┅✦*';
global.htjava = '⫹⫺';
global.htki = '*⭑•̩̩͙⊱•••• ☪*';
global.htka = '*☪ ••••̩̩͙⊰•⭑*';
global.comienzo = '• • ◕◕════';
global.fin = '════◕◕ • •';
global.botdate = `⫹⫺ Date: ${moment.tz('America/Los_Angeles').format('DD/MM/YY')}`;
global.bottime = `𝗧𝗜𝗠𝗘: ${moment.tz('America/Los_Angeles').format('HH:mm:ss')}`;
global.fgif = {
  key: { participant: '0@s.whatsapp.net' },
  message: {
    videoMessage: {
      title: global.wm,
      h: 'Hmm',
      seconds: '999999999',
      gifPlayback: 'true',
      caption: global.bottime,
      jpegThumbnail: fs.readFileSync('./menu.jpg')
    }
  }
};
global.multiplier = 99;
global.flaaa = [
  'https://flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=water-logo&script=water-logo&fontsize=90&doScale=true&scaleWidth=800&scaleHeight=500&fontsize=100&fillTextColor=%23000&shadowGlowColor=%23000&backgroundColor=%23000&text=',
  'https://flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=crafts-logo&fontsize=90&doScale=true&scaleWidth=800&scaleHeight=500&text=',
  'https://flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=amped-logo&doScale=true&scaleWidth=800&scaleHeight=500&text=',
  'https://www6.flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=sketch-name&doScale=true&scaleWidth=800&scaleHeight=500&fontsize=100&fillTextType=1&fillTextPattern=Warning!&text=',
  'https://www6.flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=sketch-name&doScale=true&scaleWidth=800&scaleHeight=500&fontsize=100&fillTextType=1&fillTextPattern=Warning!&fillColor1Color=%23f2aa4c&fillColor2Color=%23f2aa4c&fillColor3Color=%23f2aa4c&fillColor4Color=%23f2aa4c&fillColor5Color=%23f2aa4c&fillColor6Color=%23f2aa4c&fillColor7Color=%23f2aa4c&fillColor8Color=%23f2aa4c&fillColor9Color=%23f2aa4c&fillColor10Color=%23f2aa4c&fillOutlineColor=%23f2aa4c&fillOutline2Color=%23f2aa4c&backgroundColor=%23101820&text='
];

// Watch for changes in the current file and update
const file = fileURLToPath(import.meta.url);
watchFile(file, () => {
  unwatchFile(file);
  console.log(chalk.redBright('Updated main.js'));
  import(`${file}?update=${Date.now()}`);
});
// config.js

export const packname = '𝑬𝒍𝒕𝒂 - 𝑩𝑶𝑻';

// Other exports or global variables if needed

// Message logging configuration
global.enableMessageLogging = true; // Set to false to disable message logging
global.logMessageTypes = ['text', 'image', 'video', 'audio', 'document', 'sticker', 'contact', 'location']; // Types to log