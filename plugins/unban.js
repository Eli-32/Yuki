const handler = async (m, { conn, isOwner }) => {
  try {
    // Check if user is owner
    if (!isOwner) {
      return m.reply('❌ *Access Denied*\nOnly bot owners can unban chats.');
    }

    // Initialize chat data if it doesn't exist
    if (!global.db.data.chats[m.chat]) {
      global.db.data.chats[m.chat] = {
        isBanned: false,
        // Add other default chat properties as needed
      };
    }

    // Check if chat is already unbanned
    if (!global.db.data.chats[m.chat].isBanned) {
      return m.reply('ℹ️ *Chat Status*\nThis chat is not currently banned.');
    }

    // Unban the chat
    global.db.data.chats[m.chat].isBanned = false;
    
    // Database automatically saves when data is modified

    // Send confirmation message
    const unbanMessage = `✅ *Chat Unbanned Successfully!*

📝 *Chat Info:*
• *Chat ID:* ${m.chat}
• *Chat Name:* ${m.isGroup ? m.chat.split('@')[0] : 'Private Chat'}
• *Unbanned By:* @${m.sender.split('@')[0]}
• *Unbanned At:* ${new Date().toLocaleString()}

🎉 *Note:* This chat can now use bot commands again.`;

    await m.reply(unbanMessage);

    // Log the unban action
    // console.log(`[UNBANCHAT] Chat ${m.chat} unbanned by ${m.sender}`);

  } catch (error) {
    // console.error('[UNBANCHAT ERROR]:', error);
    await m.reply('❌ *Error occurred while unbanning chat*\nPlease try again or contact the bot owner.');
  }
};

handler.help = ['unbanchat'];
handler.tags = ['owner'];
handler.command = /^unbanchat$/i;
handler.rowner = true;
handler.owner = true;

export default handler;
