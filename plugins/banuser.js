const handler = async (m, {conn, participants, usedPrefix, command}) => {
    const BANtext = `\n*${usedPrefix + command} @${global.suittag}*`;
    if (!m.mentionedJid?.[0] && !m.quoted) return m.reply(BANtext, m.chat, {mentions: conn.parseMention(BANtext)});

    let who;
    if (m.isGroup) who = m.mentionedJid?.[0] || m.quoted?.sender;
    else who = m.chat;

    if (!who || !global.db.data.users[who]) return m.reply("❌ User not found in database.");

    global.db.data.users[who].banned = true;
    m.reply("✅ User has been banned.");
};

handler.command = /^banuser$/i;
handler.rowner = true;
export default handler;
