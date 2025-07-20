import fs from 'fs';

const handler = async (m) => {
  global.db.data.chats[m.chat].isBanned = true;
  m.reply("The chat has been banned."); // Replace with your desired message
};

handler.help = ['banchat'];
handler.tags = ['owner'];
handler.command = /^banchat$/i;
handler.rowner = true;

export default handler;
