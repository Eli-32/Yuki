const handler = async (m, {conn, participants, usedPrefix, command}) => {
    const BANtext = `\n*${usedPrefix + command} @${global.suittag}*`;
    if (!m.mentionedJid?.[0] && !m.quoted) return m.reply(BANtext, m.chat, {mentions: conn.parseMention(BANtext)});

    let who;
    if (m.isGroup) {
        // Decode JID to handle @lid format
        const mentionedJid = m.mentionedJid?.[0];
        if (mentionedJid) {
            try {
                who = await conn.decodeJid(mentionedJid);
                console.log('🔍 Debug - Banuser: Original JID:', mentionedJid, 'Decoded JID:', who);
            } catch (error) {
                console.log('🔍 Debug - Banuser: Failed to decode JID:', error.message);
                who = mentionedJid;
            }
        } else {
            who = m.quoted?.sender;
        }
    } else {
        who = m.chat;
    }

    if (!who || !global.db.data.users[who]) return m.reply("❌ User not found in database.");

    global.db.data.users[who].banned = true;
    m.reply("✅ User has been banned.");
};

handler.command = /^banuser$/i;
handler.rowner = true;
export default handler;
