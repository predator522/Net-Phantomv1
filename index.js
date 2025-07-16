
const {
  default: makeWASocket,
  useSingleFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const fs = require('fs');

const { state, saveCreds } = useSingleFileAuthState('./auth_info.json');

let users = JSON.parse(fs.readFileSync('./users.json', 'utf-8'));
let shop = JSON.parse(fs.readFileSync('./shop.json', 'utf-8'));

function saveUsers() {
  fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));
}

function getUser(id) {
  if (!users[id]) {
    users[id] = { level: 1, hp: 100, alive: true, inventory: [] };
    saveUsers();
  }
  return users[id];
}

async function startSock() {
  const sock = makeWASocket({
    logger: P({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
    browser: ['NetPhantom', 'Safari', '1.0'],
    getMessage: async () => ''
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, pairingCode } = update;

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startSock();
    } else if (connection === 'open') {
      console.log('✅ Bot is online!');
    } else if (pairingCode) {
      console.log('🔑 Pairing Code:', pairingCode);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;

    const msg = m.message.conversation || m.message.extendedTextMessage?.text;
    const reply = (text) => sock.sendMessage(m.key.remoteJid, { text }, { quoted: m });
    const id = m.key.participant || m.key.remoteJid;
    const user = getUser(id);

    switch (msg?.trim()) {
      case '.menu':
        reply('🎮 Game: .fight, .attack left/right, .shop, .buy <item>, .inventory
🐞 Bugs: .fakecrash, .androidkill <number>, .ioscrash <number>, .invisiblecrash
🎭 Others: .joke, .quote, .love, .bugmenu, .gamemenu');
        break;
      case '.bugmenu':
        reply('🐞 Bug Commands:
.fakecrash
.androidkill <number>
.ioscrash <number>
.invisiblecrash');
        break;
      case '.gamemenu':
        reply('🗝 Shadow Systems:
.fight – Enter a dark dungeon
.attack left/right – Choose your move
.shop – Buy weapons
.buy <item> – Purchase item
.inventory – View your inventory');
        break;
      case '.joke':
        reply('😂 Why did the hacker break up? Too many insecure connections.');
        break;
      case '.quote':
        reply('💬 "Code like a shadow, strike like a phantom." – Net Phantom');
        break;
      case '.love':
        reply('❤️ You + me = root access 🔐');
        break;
      case '.fakecrash':
        sock.sendMessage(m.key.remoteJid, { image: { url: 'https://via.placeholder.com/150' }, caption: '😵 System crashed...' }, { quoted: m });
        break;
      case '.inventory':
        reply('🎒 Inventory: ' + (user.inventory.length ? user.inventory.join(', ') : 'Empty'));
        break;
      case '.shop':
        reply('🛒 Shop:
' + Object.keys(shop).map(item => `${item} - ${shop[item]} coins`).join('
'));
        break;
      case '.fight':
        reply('☠ Entered the Dungeon of Shadows...
Quick! Type `.attack left` or `.attack right` before the monsters get you!');
        break;
      case '.attack left':
      case '.attack right':
        const win = Math.random() < 0.6 + user.level * 0.01;
        if (win) {
          user.level++;
          reply(`⚔ You attacked and won! You are now level ${user.level}`);
        } else {
          user.hp -= 50;
          if (user.hp <= 0) {
            user.alive = false;
            reply('💀 You were slain by the monsters...');
          } else {
            reply(`🩸 You were wounded. HP: ${user.hp}`);
          }
        }
        saveUsers();
        break;
    }
  });
}

startSock();
