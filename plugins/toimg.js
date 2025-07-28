import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { FormData, Blob } from 'formdata-node'
import { JSDOM } from 'jsdom'

let handler = async (m, { conn, usedPrefix, command }) => {
  const notStickerMessage = `✳️ Reply to a sticker with :\n\n *${usedPrefix + command}*`
  if (!m.quoted) throw notStickerMessage
  const q = m.quoted || m
  let mime = q.mediaType || ''
  if (!/sticker/.test(mime)) throw notStickerMessage
  
  m.reply('⏳ جارٍ تحويل الملصق إلى صورة...')
  
  try {
    let media = await q.download()
    
    // Check if ffmpeg is available
    const ffmpegAvailable = await checkFfmpeg()
    
    if (ffmpegAvailable) {
      // Use local ffmpeg for high quality conversion
      const tmpDir = path.join(process.cwd(), 'tmp')
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true })
      }
      
      const webpFile = path.join(tmpDir, `sticker_${Date.now()}.webp`)
      const pngFile = path.join(tmpDir, `image_${Date.now()}.png`)
      
      fs.writeFileSync(webpFile, media)
      
      // Convert using ffmpeg with high quality settings
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
          '-i', webpFile,
          '-vf', 'scale=512:512:flags=lanczos',
          '-q:v', '1', // High quality
          '-compression_level', '0', // No compression
          pngFile
        ])
        
        ffmpeg.on('error', reject)
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`FFmpeg exited with code ${code}`))
          }
        })
      })
      
      // Read the converted image
      const imageBuffer = fs.readFileSync(pngFile)
      
      // Send the high quality image
      await conn.sendFile(m.chat, imageBuffer, 'sticker-to-image.png', '*✅ تم تحويل الملصق إلى صورة بنجاح!*', m)
      
      // Clean up temp files
      try {
        fs.unlinkSync(webpFile)
        fs.unlinkSync(pngFile)
      } catch (cleanupError) {
        // Silent cleanup
      }
    } else {
      // Use fallback method if ffmpeg is not available
      let imageUrl = await webp2png(media).catch(_ => null)
      
      if (!imageUrl) {
        throw new Error('Failed to convert sticker to image')
      }
      
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`)
      }
      
      const imageBuffer = await response.buffer()
      await conn.sendFile(m.chat, imageBuffer, 'sticker-to-image.png', '*✅ تم تحويل الملصق إلى صورة بنجاح!*', m)
    }
    
  } catch (error) {
    console.error('ToImg Error:', error)
    
    // Final fallback to original method
    try {
      let media = await q.download()
      let imageUrl = await webp2png(media).catch(_ => null)
      
      if (!imageUrl) {
        throw new Error('Failed to convert sticker to image')
      }
      
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`)
      }
      
      const imageBuffer = await response.buffer()
      await conn.sendFile(m.chat, imageBuffer, 'sticker-to-image.png', '*✅ تم تحويل الملصق إلى صورة بنجاح!*', m)
    } catch (fallbackError) {
      console.error('Fallback ToImg Error:', fallbackError)
      await m.reply('❌ حدث خطأ أثناء تحويل الملصق إلى صورة.')
    }
  }
}

// Function to check if ffmpeg is available
async function checkFfmpeg() {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version'])
    ffmpeg.on('error', () => resolve(false))
    ffmpeg.on('close', (code) => resolve(code === 0))
  })
}

handler.help = ['toimg <sticker>']
handler.tags = ['sticker']
handler.command = ['لصورة', 'toimg']

export default handler

// Keep the original webp2png function as fallback
async function webp2png(source) {
  let form = new FormData()
  let isUrl = typeof source === 'string' && /https?:\/\//.test(source)
  const blob = !isUrl && new Blob([source.toArrayBuffer()])
  form.append('new-image-url', isUrl ? blob : '')
  form.append('new-image', isUrl ? '' : blob, 'image.webp')
  let res = await fetch('https://ezgif.com/webp-to-png', {
    method: 'POST',
    body: form,
  })
  let html = await res.text()
  let { document } = new JSDOM(html).window
  let form2 = new FormData()
  let obj = {}
  for (let input of document.querySelectorAll('form input[name]')) {
    obj[input.name] = input.value
    form2.append(input.name, input.value)
  }
  let res2 = await fetch('https://ezgif.com/webp-to-png/' + obj.file, {
    method: 'POST',
    body: form2,
  })
  let html2 = await res2.text()
  let { document: document2 } = new JSDOM(html2).window
  return new URL(document2.querySelector('div#output > p.outfile > img').src, res2.url).toString()
}