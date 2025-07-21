import { jidDecode } from '@whiskeysockets/baileys';

const handler = (sock) => {
  // Listen for group participant updates (promote/demote)
  sock.ev.on('group-participants.update', async ({ id: groupJid, participants, action }) => {
    if (action === 'promote' || action === 'demote') {
      const verb = action === 'promote' ? 'promoted' : 'demoted';
      for (let p of participants) {
        const name = p.split('@')[0];
        await sock.sendMessage(groupJid, { text: `${name} was ${verb}.` });
      }
    }
  });

  // Listen for system messages to try to detect the actor
  sock.ev.on('messages.upsert', async (msg) => {
    const m = msg.messages[0];
    if (!m.messageStubType) return;
    // 29 = promote, 30 = demote (see Baileys stub types)
    if ([29, 30].includes(m.messageStubType)) {
      const actor = m.participant || m.key.participant;
      const targets = m.messageStubParameters || [];
      const action = m.messageStubType === 29 ? 'promoted' : 'demoted';
      for (let t of targets) {
        await sock.sendMessage(m.key.remoteJid, { text: `${actor.split('@')[0]} ${action} ${t.split('@')[0]}` });
      }
    }
  });
};

export default handler; 