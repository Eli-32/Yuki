import fetch from 'node-fetch';
import { addExif, sticker as createBasicSticker } from '../lib/sticker.js';
import { Sticker } from 'wa-sticker-formatter';
import fs from 'fs';
import path from 'path';

let handler = async (m, { conn, args, usedPrefix, command }) => {
  let stiker = false;
  try {
    let [packname, ...author] = args.join(' ').split(/!|\|/);
    author = (author || []).join('|');
    let q = m.quoted ? m.quoted : m;
    let mime = (q.msg || q).mimetype || q.mediaType || '';
    
    // Check if we have media to work with
    if (!q.msg && !q.mediaType && !args[0]) {
      throw `*RESPOND TO AN IMAGE, VIDEO, OR GIF WITH ${usedPrefix + command}*`;
    }

    let img = null;
    if (/webp/g.test(mime)) {
      img = await q.download?.();
      if (!img) throw new Error('Failed to download media');
      stiker = await addExif(img, packname || global.packname, author || global.author);
    } else if (/image/g.test(mime)) {
      img = await q.download?.();
      if (!img) throw new Error('Failed to download media');
      stiker = await createSticker(img, false, packname || global.packname, author || global.author);
    } else if (/video/g.test(mime) || /gif/g.test(mime)) {
      img = await q.download?.();
      if (!img) throw new Error('Failed to download media');
      if ((q.msg || q).seconds > 7) return m.reply('*Video or GIF cannot be longer than 7 seconds*');
      stiker = await createSticker(img, false, packname || global.packname, author || global.author, true); // Animated GIF/video sticker
    } else if (args[0] && isUrl(args[0])) {
      stiker = await createSticker(false, args[0], packname || global.packname, author || global.author);
    } else {
      throw `*RESPOND TO AN IMAGE, VIDEO, OR GIF WITH ${usedPrefix + command}*`;
    }
  } catch (e) {
    console.error('Sticker creation error:', e);
    
    // Fallback to basic sticker creation
    try {
      let q = m.quoted ? m.quoted : m;
      let img = await q.download?.();
      if (img) {
        stiker = await createBasicSticker(img, false, global.packname, global.author);
      } else {
        stiker = '*Failed to create sticker*';
      }
    } catch (fallbackError) {
      console.error('Fallback sticker creation error:', fallbackError);
      stiker = '*Failed to create sticker*';
    }
  } finally {
    if (stiker instanceof Buffer && stiker.length > 0) {
      // Save buffer to temporary file and send as sticker
      let tmpFile = null;
      try {
        const tmpDir = path.join(process.cwd(), 'tmp');
        
        // Ensure tmp directory exists
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        
        // Create unique filename
        tmpFile = path.join(tmpDir, `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.webp`);
        
        // Write the sticker buffer to file
        fs.writeFileSync(tmpFile, stiker);
        
        // Verify the file was written correctly
        if (!fs.existsSync(tmpFile) || fs.statSync(tmpFile).size === 0) {
          throw new Error('Failed to write sticker file');
        }
        
        // Send as sticker
        await conn.sendFile(m.chat, tmpFile, '', '', m, { asSticker: true });
        
      } catch (sendError) {
        console.error('Error sending sticker:', sendError);
        
        // Fallback: try sending as document
        try {
          if (tmpFile && fs.existsSync(tmpFile)) {
            await conn.sendFile(m.chat, tmpFile, 'sticker.webp', '', m, { asDocument: true });
          } else {
            throw new Error('Temp file not found for fallback');
          }
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
          m.reply('*Failed to send sticker*');
        }
      } finally {
        // Clean up temp file
        if (tmpFile && fs.existsSync(tmpFile)) {
          try {
            fs.unlinkSync(tmpFile);
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
          }
        }
      }
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
  try {
    let stickerMetadata = { 
      type: animated ? 'full' : 'default', 
      pack: packName || 'Sticker Pack', 
      author: authorName || 'Bot', 
      quality 
    };
    
    const sticker = new Sticker(img ? img : url, stickerMetadata);
    const buffer = await sticker.toBuffer();
    
    if (!buffer || buffer.length === 0) {
      throw new Error('Generated sticker buffer is empty');
    }
    
    return buffer;
  } catch (error) {
    console.error('Error creating sticker:', error);
    throw new Error('Failed to create sticker');
  }
}