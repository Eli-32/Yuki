let handler = async (_0x3631d4, { conn }) => {
    // Extract owner information from global.owner
    const ownerInfo = global.owner[0]; // Assuming you want to get the first owner's info
    const ownerNumber = ownerInfo[0];
    const ownerName = ownerInfo[1];
  
    // Reply with the owner's information
    _0x3631d4.reply(`👤 مالك البوت هو: ${ownerName} \n📞 رقم الهاتف: ${ownerNumber}`);
  };
  
  handler.help = ['owner'];
  handler.tags = ['info'];
  handler.command = ['owner'];
  
  export default handler;
  