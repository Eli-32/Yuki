import { normalizeJid } from '../lib/simple-jid.js';
import { isOwner } from '../lib/owner-check.js';

const handler = async (m, { conn, text }) => {
    // Check if user is owner
    if (!isOwner(m.sender)) {
        return m.reply("❌ هذا الأمر متاح للمالك فقط.");
    }
    
    if (!text && !m.mentionedJid?.[0] && !m.quoted) throw 'Please specify the user to unban';

    let who;
    if (m.isGroup) {
        // Use simplified JID handling
        const mentionedJid = m.mentionedJid?.[0];
        if (mentionedJid) {
            who = normalizeJid(mentionedJid);
        } else {
            who = normalizeJid(m.quoted?.sender);
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
