import Jimp from 'jimp';

let handler = async (m, { conn, usedPrefix, command }) => {
  let q = m.quoted ? m.quoted : m;
  let mime = (q.msg || q).mimetype || q.mediaType || '';
  if (!mime) return m.reply('❌ أرسل صورة أو رد على صورة لاستخدام التحسين.');
  if (!/image\/(jpe?g|png)/.test(mime)) return m.reply('❌ فقط الصور بصيغة JPG أو PNG مدعومة.');

  m.reply('⏳ جارٍ تحسين الصورة محلياً...');

  try {
    const buffer = await q.download();
    const image = await Jimp.read(buffer);

    // Local HDR-like enhancement: contrast, brightness, normalize, sharpen
    image
      .contrast(0.3)
      .brightness(0.12)
      .normalize()
      .quality(95);
    image.convolute([
      [ 0, -1,  0 ],
      [-1,  5, -1 ],
      [ 0, -1,  0 ]
    ]);

    const out = await image.getBufferAsync(Jimp.MIME_JPEG);
    await conn.sendFile(m.chat, out, 'enhanced.jpg', '✅ تمت معالجة الصورة محلياً (تحسين)!');
  } catch (e) {
    await m.reply('❌ حدث خطأ أثناء معالجة الصورة.');
  }
};

handler.help = ['تحسين (تحسين جودة الصورة محلياً، أرسل صورة أو رد على صورة)'];
handler.tags = ['tools', 'image'];
handler.command = /^تحسين|hdr$/i;

export default handler;