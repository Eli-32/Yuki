// Simple test plugin to verify command system
const handler = async (m, { conn, command, text, args, usedPrefix }) => {
    try {
        console.log('=== TEST PLUGIN TRIGGERED ===');
        console.log('Command:', command);
        console.log('Text:', m.text);
        console.log('Chat:', m.chat);
        console.log('Sender:', m.sender);
        console.log('=============================');
        
        return m.reply(`✅ Test plugin working!\n\nCommand: ${command}\nText: ${m.text}\nChat: ${m.chat}\nSender: ${m.sender}`);
        
    } catch (error) {
        console.error('Error in test plugin:', error);
        return m.reply('❌ Test plugin error: ' + error.message);
    }
};

handler.help = ['test'];
handler.tags = ['test'];
handler.command = ['test', 'testadmin'];

export default handler; 