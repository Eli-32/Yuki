import { webp2png } from '../lib/webp2mp4.js'
import fetch from 'node-fetch'

let handler = async (m, { conn, usedPrefix, command }) => {
  const notStickerMessage = `✳️ Reply to a sticker with :\n\n *${usedPrefix + command}*`
  if (!m.quoted) throw notStickerMessage
  const q = m.quoted || m
  let mime = q.mediaType || ''
  if (!/sticker/.test(mime)) throw notStickerMessage
  
  m.reply('⏳ جارٍ تحويل الملصق إلى صورة...')
  
  try {
    let media = await q.download()
    let imageUrl = await webp2png(media).catch(_ => null)
    
    if (!imageUrl) {
      throw new Error('Failed to convert sticker to image')
    }
    
    // Download the actual image data from the URL
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`)
    }
    
    const imageBuffer = await response.buffer()
    
    await conn.sendFile(m.chat, imageBuffer, 'sticker-to-image.png', '*✅ تم تحويل الملصق إلى صورة بنجاح!*', m)
  } catch (error) {
    console.error('ToImg Error:', error)
    await m.reply('❌ حدث خطأ أثناء تحويل الملصق إلى صورة.')
  }
}

handler.help = ['toimg <sticker>']
handler.tags = ['sticker']
handler.command = ['لصورة', 'toimg']

export default handler