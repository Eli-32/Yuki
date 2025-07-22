import { normalizeJid } from '../lib/simple-jid.js';
import { isOwner } from '../lib/owner-check.js';

const handler = async (m, {conn, participants, usedPrefix, command}) => {
    // Check if user is owner
    if (!isOwner(m.sender)) {
        return m.reply("❌ هذا الأمر متاح للمالك فقط.");
    }
    const BANtext = `\n*${usedPrefix + command} @${global.suittag}*`;
    if (!m.mentionedJid?.[0] && !m.quoted) return m.reply(BANtext, m.chat, {mentions: conn.parseMention(BANtext)});

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

    if (!who || !global.db.data.users[who]) return m.reply("❌ User not found in database.");

    global.db.data.users[who].banned = true;
    m.reply("✅ User has been banned.");
};

handler.command = /^banuser$/i;
handler.rowner = true;
export default handler;
