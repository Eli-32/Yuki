const handler = async (m, { conn, text }) => {
    if (!text && !m.mentionedJid?.[0] && !m.quoted) throw 'Please specify the user to unban';

    let who;
    if (m.isGroup) {
        // Decode JID to handle @lid format
        const mentionedJid = m.mentionedJid?.[0];
        if (mentionedJid) {
            try {
                who = await conn.decodeJid(mentionedJid);
                console.log('🔍 Debug - Unbanuser: Original JID:', mentionedJid, 'Decoded JID:', who);
            } catch (error) {
                console.log('🔍 Debug - Unbanuser: Failed to decode JID:', error.message);
                who = mentionedJid;
            }
        } else {
            who = m.quoted?.sender;
        }
    } else {
        who = m.chat;
    }

    if (!who || !global.db.data.users[who]) throw 'User not found in database';

    global.db.data.users[who].banned = false;
    conn.reply(m.chat, '✅ User has been unbanned.', m);
};

handler.help = ['unbanuser'];
handler.tags = ['owner'];
handler.command = /^unbanuser$/i;
handler.rowner = true;

export default handler;
