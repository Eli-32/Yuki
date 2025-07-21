import { jidDecode } from '@whiskeysockets/baileys';

export default {
    name: "admin_change",
    event: "group-participants.update",
    async handle({ sock, update }) {
      const { id, participants, action } = update;
      if (!['promote', 'demote'].includes(action)) return;
      
      try {
        const metadata = await sock.groupMetadata(id);
        const admins = metadata.participants.filter(p => p.admin).map(p => p.id);
        
        const affectedUser = participants[0];
        const adminUser = update.author || admins.find(a => a !== affectedUser);
        if (!adminUser) return;
        
        // Use jidDecode for proper phone number display
        const adminDecoded = jidDecode(adminUser);
        const affectedDecoded = jidDecode(affectedUser);
        const adminNumber = adminDecoded ? adminDecoded.user : adminUser.split('@')[0];
        const affectedNumber = affectedDecoded ? affectedDecoded.user : affectedUser.split('@')[0];
        
        const actionText = action === 'promote' ? 'promoted' : 'demoted';
        const message = `@${adminNumber} ${actionText} @${affectedNumber}`;
        
        await sock.sendMessage(id, { text: message, mentions: [adminUser, affectedUser] });
      } catch (err) {
        console.error("Error handling admin change:", err);
      }
    }
  };
  