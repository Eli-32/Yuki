import axios from 'axios';

let cooldown = new Set();

let handler = async (m, { conn }) => {
  if (cooldown.has(m.sender)) {
    return await conn.sendMessage(m.chat, { text: '⏳ يرجى الانتظار ثانيتين قبل استخدام هذا الأمر مرة أخرى.' }, { quoted: m });
  }

  cooldown.add(m.sender);
  setTimeout(() => {
    cooldown.delete(m.sender);
  }, 2000); 

  try {
    let res = (await axios.get(`https://raw.githubusercontent.com/Seiyra/imagesfjsfasfa/refs/heads/main/okay.js`)).data;

    console.log(res);

    if (!Array.isArray(res)) {
      throw new Error('Response is not an array.');
    }

    let url = res[Math.floor(Math.random() * res.length)];

    await conn.sendFile(m.chat, url, 'image.jpg', '', m);
  } catch (error) {
    console.error(error);
    await conn.sendMessage(m.chat, { text: `❌ *Error:* ${error.message}` }, { quoted: m });
  }
};

handler.help = ['messi'];
handler.tags = ['img'];
handler.command = /^(ص)$/i;

export default handler;
