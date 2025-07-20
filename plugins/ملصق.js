import fetch from 'node-fetch';
import { addExif } from '../lib/sticker.js';
import { Sticker } from 'wa-sticker-formatter';

let handler = async (m, { conn, args, usedPrefix, command }) => {
  let stiker = false;
  try {
    let [packname, ...author] = args.join(' ').split(/!|\|/);
    author = (author || []).join('|');
    let q = m.quoted ? m.quoted : m;
    let mime = (q.msg || q).mimetype || q.mediaType || '';

    if (/webp/g.test(mime)) {
      let img = await q.download?.();
      stiker = await addExif(img, packname || global.packname, author || global.author);
    } else if (/image/g.test(mime)) {
      let img = await q.download?.();
      stiker = await createSticker(img, false, packname || global.packname, author || global.author);
    } else if (/video/g.test(mime) || /gif/g.test(mime)) {
      let img = await q.download?.();
      if ((q.msg || q).seconds > 7) return m.reply('*Video or GIF cannot be longer than 7 seconds*');
      stiker = await createSticker(img, false, packname || global.packname, author || global.author, true); // Animated GIF/video sticker
    } else if (args[0] && isUrl(args[0])) {
      stiker = await createSticker(false, args[0], packname || global.packname, author);
    } else {
      throw `*RESPOND TO AN IMAGE, VIDEO, OR GIF WITH ${usedPrefix + command}*`;
    }
  } catch (e) {
    console.error(e);
    stiker = '*Failed to create sticker*';
  } finally {
    if (stiker instanceof Buffer) {
      await conn.sendMessage(m.chat, { sticker: stiker }, { quoted: m });
    } else {
      m.reply(stiker);
    }
  }
};

handler.help = ['sfull'];
handler.tags = ['sticker'];
handler.command = ['ملصق','ملصقي'];
export default handler;

const isUrl = (text) => {
  return /https?:\/\/\S+\.(jpg|jpeg|png|gif)/i.test(text);
};

async function createSticker(img, url, packName, authorName, animated = false, quality = 20) {
  let stickerMetadata = { type: animated ? 'full' : 'default', pack: packName, author: authorName, quality };
  return new Sticker(img ? img : url, stickerMetadata).toBuffer();
}