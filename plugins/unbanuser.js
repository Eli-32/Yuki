const handler = async (m, { conn, text }) => {
    if (!text && !m.mentionedJid?.[0] && !m.quoted) throw 'Please specify the user to unban';

    let who;
    if (m.isGroup) who = m.mentionedJid?.[0] || m.quoted?.sender;
    else who = m.chat;

    if (!who || !global.db.data.users[who]) throw 'User not found in database';

    global.db.data.users[who].banned = false;
    conn.reply(m.chat, '✅ User has been unbanned.', m);
};

handler.help = ['unbanuser'];
handler.tags = ['owner'];
handler.command = /^unbanuser$/i;
handler.rowner = true;

export default handler;
