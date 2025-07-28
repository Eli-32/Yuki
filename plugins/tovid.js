import { ffmpeg } from '../lib/converter.js'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { FormData, Blob } from 'formdata-node'
import { JSDOM } from 'jsdom'
import fetch from 'node-fetch'

let handler = async (m, { conn }) => {
  if (!m.quoted) throw '✳️ Respond to an animated sticker'
  let mime = m.quoted.mimetype || ''
  if (!/webp|audio/.test(mime)) throw '✳️ Respond to an animated sticker'
  
  m.reply('⏳ جارٍ تحويل الملصق إلى فيديو...')
  
  try {
    let media = await m.quoted.download()
    let out = Buffer.alloc(0)
    
    if (/webp/.test(mime)) {
      // Check if ffmpeg is available
      const ffmpegAvailable = await checkFfmpeg()
      
      if (ffmpegAvailable) {
        // Use local ffmpeg for high quality conversion
        const tmpDir = path.join(process.cwd(), 'tmp')
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true })
        }
        
        const webpFile = path.join(tmpDir, `sticker_${Date.now()}.webp`)
        const mp4File = path.join(tmpDir, `video_${Date.now()}.mp4`)
        
        fs.writeFileSync(webpFile, media)
        
        // Convert using ffmpeg with high quality settings
        await new Promise((resolve, reject) => {
          const ffmpegProcess = spawn('ffmpeg', [
            '-i', webpFile,
            '-vf', 'scale=512:512:flags=lanczos',
            '-c:v', 'libx264',
            '-preset', 'slow', // Better quality
            '-crf', '18', // High quality (lower = better)
            '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart',
            mp4File
          ])
          
          ffmpegProcess.on('error', reject)
          ffmpegProcess.on('close', (code) => {
            if (code === 0) {
              resolve()
            } else {
              reject(new Error(`FFmpeg exited with code ${code}`))
            }
          })
        })
        
        out = fs.readFileSync(mp4File)
        
        // Clean up temp files
        try {
          fs.unlinkSync(webpFile)
          fs.unlinkSync(mp4File)
        } catch (cleanupError) {
          // Silent cleanup
        }
      } else {
        // Use fallback method if ffmpeg is not available
        out = await webp2mp4(media)
      }
      
    } else if (/audio/.test(mime)) {
      out = await ffmpeg(
        media,
        [
          '-filter_complex',
          'color',
          '-pix_fmt',
          'yuv420p',
          '-crf',
          '18', // Better quality
          '-c:a',
          'copy',
          '-shortest',
        ],
        'mp3',
        'mp4'
      )
    }
    
    await conn.sendFile(m.chat, out, 'tovid.mp4', '✅ تم تحويل الملصق إلى فيديو بنجاح!', m)
    
  } catch (error) {
    console.error('ToVid Error:', error)
    
    // Fallback to original method if ffmpeg fails
    try {
      let media = await m.quoted.download()
      let out = Buffer.alloc(0)
      
      if (/webp/.test(mime)) {
        out = await webp2mp4(media)
      } else if (/audio/.test(mime)) {
        out = await ffmpeg(
          media,
          [
            '-filter_complex',
            'color',
            '-pix_fmt',
            'yuv420p',
            '-crf',
            '51',
            '-c:a',
            'copy',
            '-shortest',
          ],
          'mp3',
          'mp4'
        )
      }
      
      await conn.sendFile(m.chat, out, 'tovid.mp4', '✅ sticker a video', m)
    } catch (fallbackError) {
      console.error('Fallback ToVid Error:', fallbackError)
      await m.reply('❌ حدث خطأ أثناء تحويل الملصق إلى فيديو.')
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

handler.help = ['tovid']
handler.tags = ['sticker']
handler.command = ['لفيد']

export default handler

// Keep the original webp2mp4 function as fallback
async function webp2mp4(source) {
  let form = new FormData()
  let isUrl = typeof source === 'string' && /https?:\/\//.test(source)
  const blob = !isUrl && new Blob([source.toArrayBuffer()])
  form.append('new-image-url', isUrl ? blob : '')
  form.append('new-image', isUrl ? '' : blob, 'image.webp')
  let res = await fetch('https://ezgif.com/webp-to-mp4', {
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
  let res2 = await fetch('https://ezgif.com/webp-to-mp4/' + obj.file, {
    method: 'POST',
    body: form2,
  })
  let html2 = await res2.text()
  let { document: document2 } = new JSDOM(html2).window
  return new URL(
    document2.querySelector('div#output > p.outfile > video > source').src,
    res2.url
  ).toString()
}