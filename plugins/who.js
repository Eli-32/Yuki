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
        
        const actionText = action === 'promote' ? 'promoted' : 'demoted';
        const message = `@${adminUser.split('@')[0]} ${actionText} @${affectedUser.split('@')[0]}`;
        
        await sock.sendMessage(id, { text: message, mentions: [adminUser, affectedUser] });
      } catch (err) {
        console.error("Error handling admin change:", err);
      }
    }
  };
  