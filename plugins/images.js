import axios from 'axios';

let cooldown = new Set();

let handler = async (m, { conn }) => {
  if (cooldown.has(m.sender)) {
    return await conn.sendMessage(m.chat, { text: '⏳ يرجى الانتظار ثانيتين قبل استخدام هذا الأمر مرة أخرى.' }, { quoted: m });
  }

  cooldown.add(m.sender);
  setTimeout(() => {
    cooldown.delete(m.sender);
  }, 2000); 

  try {
    // Use the provided image URLs for instant response
    const imageUrls = [
      'https://i.postimg.cc/YqGjJ49Z/WhatsApp-Image-2025-02-19-at-18-09-51-04b49def.jpg',
      'https://i.postimg.cc/t4FJ4LFz/WhatsApp-Image-2025-02-19-at-18-09-51-06f9d754.jpg',
      'https://i.postimg.cc/Zqcqrp7B/WhatsApp-Image-2025-02-19-at-18-09-51-684a0ad4.jpg',
      'https://i.postimg.cc/7LD6GmVr/WhatsApp-Image-2025-02-19-at-18-09-51-f7c6f1e8.jpg',
      'https://i.postimg.cc/C1rL2YVw/WhatsApp-Image-2025-02-19-at-18-09-52-304455ba.jpg',
      'https://i.postimg.cc/Tw33Q1Fk/WhatsApp-Image-2025-02-19-at-18-09-52-47e40183.jpg',
      'https://i.postimg.cc/X7RX3VBJ/WhatsApp-Image-2025-02-19-at-18-09-52-4b3473dc.jpg',
      'https://i.postimg.cc/Fzfs5q93/WhatsApp-Image-2025-02-19-at-18-09-52-ffbe4f30.jpg',
      'https://i.postimg.cc/prgV2ZT7/WhatsApp-Image-2025-02-19-at-18-09-53-0de49ad9.jpg',
      'https://i.postimg.cc/qBYvXkLL/WhatsApp-Image-2025-02-19-at-18-09-53-4038b543.jpg',
      'https://i.postimg.cc/15q5vL7Z/WhatsApp-Image-2025-02-19-at-18-09-53-f63f248e.jpg',
      'https://i.postimg.cc/NjvGSpZ2/WhatsApp-Image-2025-02-19-at-18-09-54-62cc8dee.jpg',
      'https://i.postimg.cc/kgNMmWd1/WhatsApp-Image-2025-02-19-at-18-09-54-71ff97ca.jpg',
      'https://i.postimg.cc/63qBnS4g/WhatsApp-Image-2025-02-19-at-18-09-54-a64c5f40.jpg',
      'https://i.postimg.cc/k5fnV9GW/WhatsApp-Image-2025-02-19-at-18-09-54-eb773713.jpg',
      'https://i.postimg.cc/nrQZwDk1/WhatsApp-Image-2025-02-19-at-18-09-55-082abd0e.jpg',
      'https://i.postimg.cc/V6hmRRj6/WhatsApp-Image-2025-02-19-at-18-09-55-31b99eb7.jpg',
      'https://i.postimg.cc/K4SFX8ph/WhatsApp-Image-2025-02-19-at-18-09-55-b8924fe6.jpg',
      'https://i.postimg.cc/DfWXKppx/WhatsApp-Image-2025-02-19-at-18-09-56-5f25abbb.jpg',
      'https://i.postimg.cc/bNkSZDhb/WhatsApp-Image-2025-02-19-at-18-09-56-ac19fba6.jpg',
      'https://i.postimg.cc/mZ0FZ30B/WhatsApp-Image-2025-02-19-at-18-09-56-af654c6e.jpg',
      'https://i.postimg.cc/RZm6KSSY/WhatsApp-Image-2025-02-19-at-18-09-56-f45f1115.jpg',
      'https://i.postimg.cc/65rT9krf/WhatsApp-Image-2025-02-19-at-18-09-57-2537286e.jpg',
      'https://i.postimg.cc/52mHmhj2/WhatsApp-Image-2025-02-19-at-18-09-57-3d83b90e.jpg',
      'https://i.postimg.cc/RF2qF9pX/WhatsApp-Image-2025-02-19-at-18-09-57-86352d91.jpg',
      'https://i.postimg.cc/XYnqXsxS/WhatsApp-Image-2025-02-19-at-18-09-57-bbb34417.jpg',
      'https://i.postimg.cc/P5KxD1FL/WhatsApp-Image-2025-02-19-at-18-09-58-76ef56a9.jpg',
      'https://i.postimg.cc/Jhnh5t9p/WhatsApp-Image-2025-02-19-at-18-09-58-af7101b1.jpg',
      'https://i.postimg.cc/qR6MWSBn/WhatsApp-Image-2025-02-19-at-18-09-58-b9880533.jpg',
      'https://i.postimg.cc/5ycNJgjr/WhatsApp-Image-2025-02-19-at-18-09-58-f07f2c08.jpg',
      'https://i.postimg.cc/j2zqSf7S/WhatsApp-Image-2025-02-19-at-18-09-59-206dfc53.jpg',
      'https://i.postimg.cc/mr5gXB4B/WhatsApp-Image-2025-02-19-at-18-09-59-6f1374d2.jpg',
      'https://i.postimg.cc/mZMgwv5W/WhatsApp-Image-2025-02-19-at-18-09-59-a6cec910.jpg',
      'https://i.postimg.cc/Kv2vs06k/WhatsApp-Image-2025-02-19-at-18-09-59-c5a7baba.jpg',
      'https://i.postimg.cc/X7k7MwW2/WhatsApp-Image-2025-02-19-at-18-10-00-ba64fb11.jpg',
      'https://i.postimg.cc/L844mn6m/WhatsApp-Image-2025-02-19-at-18-10-00-c4becce4.jpg',
      'https://i.postimg.cc/y8f1xskc/WhatsApp-Image-2025-02-19-at-18-10-00-c9a60d37.jpg',
      'https://i.postimg.cc/N05grSHV/WhatsApp-Image-2025-02-19-at-18-10-01-0a5529b5.jpg',
      'https://i.postimg.cc/HnCHRLhD/WhatsApp-Image-2025-02-19-at-18-10-01-25318d5d.jpg',
      'https://i.postimg.cc/hjmc2mM1/WhatsApp-Image-2025-02-19-at-18-10-01-5422a63a.jpg',
      'https://i.postimg.cc/SK3mLdLK/WhatsApp-Image-2025-02-19-at-18-10-01-6b87e434.jpg',
      'https://i.postimg.cc/J0cmLWfy/WhatsApp-Image-2025-02-19-at-18-10-02-23e6a40e.jpg',
      'https://i.postimg.cc/NG1QT1Kg/WhatsApp-Image-2025-02-19-at-18-10-02-69417b41.jpg',
      'https://i.postimg.cc/sDssJvW5/WhatsApp-Image-2025-02-19-at-18-10-02-f19c255c.jpg',
      'https://i.postimg.cc/65cwbtVg/WhatsApp-Image-2025-02-19-at-18-10-03-0ee0b1db.jpg',
      'https://i.postimg.cc/zGfN960B/WhatsApp-Image-2025-02-19-at-18-10-03-229a76b2.jpg',
      'https://i.postimg.cc/3xJgFhhr/017cf1887b461a1cadd6903aa4831fa2.jpg',
      'https://i.postimg.cc/Y9qQH0BD/1f275bc4501655f9b9d790f927bb422f.jpg',
      'https://i.postimg.cc/C598k4B9/f7ed6ed115daea80119a49d6e80fa716.jpg',
      'https://i.postimg.cc/hP7TgNNn/e9dab0f3b76c0fb5022818bf6098a247.jpg',
      'https://i.postimg.cc/W1GZqg2f/c2b01147395346e972352ee81c545c2d.jpg',
      'https://i.postimg.cc/xd9zv88j/ef2d9a6faead11bb68a986fdefcc4185.jpg',
      'https://i.postimg.cc/vBBxKK5p/c9b8d034f911fb387a0ba6ace66704b3.jpg',
      'https://i.postimg.cc/4xbQ27YJ/774bd711b583083aaa324ce8f4a03fe2.jpg',
      'https://i.postimg.cc/Gty54LqH/04d4e320d7a20603017b44ab89e3d080.jpg',
      'https://i.postimg.cc/JzW9BXwm/0535bfb879b7f6a4c0dc431bf2e0f09b.jpg',
      'https://i.postimg.cc/HxLzyYsT/0c595a9a7ecc8bc4da203faa2fdd257b.jpg',
      'https://i.postimg.cc/rF4BmJPQ/195097691cc9c72aa9f02a89bfae50e8.jpg',
      'https://i.postimg.cc/SR3g4B4k/2814d3f4b243a87d2150363729f3d732.jpg',
      'https://i.postimg.cc/qBhYbw44/293cc117ede324354b8f1eb9d1cc683f.jpg',
      'https://i.postimg.cc/9XD53Vt3/2e2cfee439d431f17f67bd13bce4c49a.jpg',
      'https://i.postimg.cc/fRx84qrQ/306f39ef97e6a8538882c51f4f0aa449.jpg',
      'https://i.postimg.cc/Sx7HLKq9/3e896cf0559c4e5d426925d51e0d9506.jpg',
      'https://i.postimg.cc/qBWf4YjN/6075745c3aeb523ab4e406859f69d045.jpg',
      'https://i.postimg.cc/sxk4q5P2/676b5cb8d9e3c0b27dbaeacf339ab980.jpg',
      'https://i.postimg.cc/W45KKfdb/752eeb4ac73925dae238d9053a1c26b2.jpg',
      'https://i.postimg.cc/vHxPhZ7B/7f067d4bd80467ef2fc716f917c03c7d.jpg',
      'https://i.postimg.cc/gJr5Pqhy/a72c89a94ff19c682a69a6691c6bb9a4.jpg',
      'https://i.postimg.cc/gjXKggZ5/adbd10bec5c6da469e48dfdfbcfe485c.jpg',
      'https://i.postimg.cc/HxP20qVX/b46f10d8650f18503e021ca01e10d786.jpg',
      'https://i.postimg.cc/8C4wcJGy/ca0796c3ef851afa0529a25461fd1b14.jpg',
      'https://i.postimg.cc/cHjz1g7p/d1d343e61eb866b2e3d6baf79671d305.jpg',
      'https://i.postimg.cc/T38t4vQc/d27fe9ccc9ebc3aa12d6bebd9c5bf306.jpg',
      'https://i.postimg.cc/tRMSFxxw/f37896c54355b9ad4a6d1c8d43fabb25.jpg',
      'https://i.postimg.cc/SKS3gpNv/f500ec847eab0f02b1ef0f368e219a8d.jpg',
      'https://i.postimg.cc/Bv4MJ5rL/f7b53b830cb12606495529d4503b48c0.jpg',
      'https://i.postimg.cc/mDxsBqmT/4bb74d3f9eb497a06358c3b9c1164bc2.jpg'
    ];

    // Select a random image instantly
    const randomImage = imageUrls[Math.floor(Math.random() * imageUrls.length)];

    // Send the image immediately without any delays
    await conn.sendFile(m.chat, randomImage, 'image.jpg', '', m, { 
      mimetype: 'image/jpeg',
      asDocument: false 
    });

  } catch (error) {
    console.error('Images plugin error:', error);
    
    // Fallback: Send a simple text message if image fails
    await conn.sendMessage(m.chat, { 
      text: '❌ Failed to load image. Please try again.' 
    }, { quoted: m });
  }
};

handler.help = ['ص (صور عشوائية، أرسل .ص للحصول على صورة عشوائية)'];
handler.tags = ['img'];
handler.command = /^(ص)$/i;

export default handler;
