import { areJidsSameUser } from '@whiskeysockets/baileys';
let handler = async (_0x3568ae, {
  conn: _0x6b64c5,
  text: _0x2a62cd,
  participants: _0x3dfdea
}) => {
  const _0x5eeb3a = _0x3dfdea.find(_0x1da3b3 => areJidsSameUser(_0x1da3b3.id, _0x3568ae.sender) && _0x1da3b3.admin);
  if (!_0x5eeb3a) {
    return _0x3568ae.reply("فقط المشرفين يمكنهم استخدام هذا الأمر");
  }
  let _0x129e0d;
  if (_0x3568ae.quoted) {
    _0x129e0d = [_0x3568ae.quoted.sender];
  } else {
    if (_0x3568ae.mentionedJid[0x0]) {
      _0x129e0d = _0x3568ae.mentionedJid.filter(_0xa27727 => !areJidsSameUser(_0xa27727, _0x6b64c5.user.id));
    } else {
      if (!_0x2a62cd) {
        return _0x3568ae.reply("الرجاء الرد/الإشارة إلى عضو");
      } else {
        _0x129e0d = _0x2a62cd.split(/\s+/);
      }
    }
  }
  let _0x15588f = [];
  if (_0x3568ae.quoted) {
    await _0x6b64c5.groupParticipantsUpdate(_0x3568ae.chat, _0x129e0d, "remove");
    _0x15588f = _0x129e0d;
  } else {
    for (let _0x1940e6 of _0x129e0d) {
      if (_0x1940e6.endsWith("@s.whatsapp.net") && !_0x3dfdea.find(_0xbc08ce => areJidsSameUser(_0xbc08ce.id, _0x1940e6) && _0xbc08ce.admin)) {
        try {
          _0x15588f.push(_0x1940e6);
          await delay(1000);
        } catch (_0x346f53) {
          console.error("Error removing user:", _0x346f53);
        }
      }
    }
  }
  _0x3568ae.reply("*نجاح في إخراج* " + (_0x15588f.length > 0x0 ? _0x15588f.map(_0x334232 => '@' + _0x334232.split('@')[0x0]).join(", ") : "لم يتم العثور على مستخدمين"), null, {
    'mentions': _0x15588f
  });
};
handler.help = ["kick", '-'];
handler.tags = ["owner"];
handler.command = /^(طرد|دزمها|انقلع|بنعالي)$/i;
handler.admin = true;
handler.group = true;
handler.botAdmin = true;
export default handler;
const delay = _0x3bfb8d => new Promise(_0x1ef2af => setTimeout(_0x1ef2af, _0x3bfb8d));