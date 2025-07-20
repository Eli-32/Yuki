let handler = async (m, { conn, usedPrefix, command, text }) => {
    if (m.fromMe) {
      return true
    }
  
    let number;
    
    if (text) {
      if (isNaN(text)) {
        if (text.includes('@')) {
          number = text.split`@`[1];
        } else {
          return conn.reply(m.chat, `✳️ Invalid number format`, m);
        }
      } else {
        number = text;
      }
    } else if (m.quoted) {
      number = m.quoted.sender.split`@`[0];
    }
  
    if (!number)
      return conn.reply(
        m.chat,
        `✳️ Use the command \n *${usedPrefix + command}* @tag (or reply to a message)`,
        m
      );
  
    if (number.length > 13 || number.length < 11)
      return conn.reply(m.chat, `✳️ Number incorrect`, m);
  
    try {
      let user = `${number}@s.whatsapp.net`;
      await conn.groupParticipantsUpdate(m.chat, [user], 'promote');
      const promoter = m.sender.split('@')[0];
      const promoted = user.split('@')[0];
      const message = `+${promoter} has promoted +${promoted}`;
      conn.reply(m.chat, message, m);
    } catch (e) {
      console.error(e);
      m.reply(`❌ Failed to promote user`);
    }
  };
  
  handler.help = ['promote'];
  handler.tags = ['group'];
  handler.command = ['ترقيه', 'ترقية'];
  handler.group = true;
  handler.admin = true;
  handler.botAdmin = true;
  handler.fail = null;
  
  export default handler;
  