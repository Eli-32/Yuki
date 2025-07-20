import { spawn } from 'child_process'
let handler = async (m, { conn, isROwner, text }) => {
  // --- TEMPORARY DEBUGGING START (DO NOT REMOVE FOR NOW) ---
  console.log('====================================================');
  console.log('DEBUG: Restart Command Handler Triggered');
  console.log('====================================================');

  console.log('DEBUG: Full Message Object (m) - Start');
  console.log(JSON.stringify(m, null, 2)); // THIS IS THE CRUCIAL LINE
  console.log('DEBUG: Full Message Object (m) - End');

  const actualSenderJid = m.key?.participant || m.key?.remoteJid || m.chat;

  console.log('----------------------------------------------------');
  console.log('DEBUG: Sender Information Analysis');
  console.log('----------------------------------------------------');
  console.log('1. Raw m.key:', m.key);
  console.log('2. Raw m.chat:', m.chat);
  console.log('3. Determined Sender JID (actualSenderJid):', actualSenderJid);
  console.log('4. Your global.owner array (from main.js):', global.owner);
  console.log('5. isROwner passed to handler (from framework):', isROwner);

  let senderNumber = 'COULD_NOT_EXTRACT_NUMBER';
  let isActualOwner = false;

  if (actualSenderJid) {
    try {
      senderNumber = actualSenderJid.split('@')[0];
      isActualOwner = global.owner.includes(senderNumber);
      console.log('6. Extracted Sender Number (from JID):', senderNumber);
      console.log('7. Is extracted number in global.owner?', isActualOwner);
    } catch (e) {
      console.error('ERROR: Failed to extract senderNumber from JID:', e);
      console.log('JID that caused error:', actualSenderJid);
    }
  } else {
    console.warn('WARNING: actualSenderJid was undefined or null!');
  }
  console.log('====================================================');
  // --- TEMPORARY DEBUGGING END ---

  if (!process.send) {
    throw 'Error: Bot process not connected. Make sure you run with `node index.js` or similar process manager.';
  }

  if (isActualOwner) {
    await m.reply('🔄 Restarting Bot...\n Wait a moment');
    process.send('reset');
  } else {
    await m.reply('You are not the owner!');
    console.log(`Command blocked for non-owner: ${senderNumber} (or unable to determine sender).`);
  }
}

handler.help = ['restart']
handler.tags = ['owner']
handler.command = ['restart']
handler.owner = true 
export default handler