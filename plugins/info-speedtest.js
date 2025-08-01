import cp from 'child_process';
import { promisify } from 'util';
const exec = promisify(cp.exec).bind(cp);

const handler = async (m) => {
    let o;
    try {
        o = await exec('python ./src/libraries/ookla-speedtest.py --secure --share');
        const {stdout, stderr} = o;
        if (stdout.trim()) {
            const match = stdout.match(/http[^"]+\.png/);
            const urlImagen = match ? match[0] : null;
            await conn.sendMessage(m.chat, {imageMessage: {url: urlImagen, caption: stdout.trim()}});
        }
        if (stderr.trim()) { 
            const match2 = stderr.match(/http[^"]+\.png/);
            const urlImagen2 = match2 ? match2[0] : null;    
            await conn.sendMessage(m.chat, {imageMessage: {url: urlImagen2, caption: stderr.trim()}});
        }
    } catch (e) {
        o = e.message;
        return m.reply(o)
    }
};
handler.help = ['speedtest'];
handler.tags = ['info'];
handler.command = /^(speedtest?|test?speed)$/i;
export default handler;