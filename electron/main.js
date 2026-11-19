// App de desktop da Toca: sobe o servidor (sala + cérebros) e abre a sala numa janela.
//   Ctrl+Alt+T       mostra/esconde a sala de qualquer lugar do Windows
//   Ctrl+Alt+A       chama o Alfred      Ctrl+Alt+N  chama o Nexus
// Fechar a janela só esconde (a Toca fica na bandeja, perto do relógio).
import { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, session, shell } from 'electron';
import { createServer } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ICON = resolve(ROOT, 'assets', 'icon-256.png');
const TRAY_ICON = resolve(ROOT, 'assets', 'icon-32.png');

let win = null;
let tray = null;
let url = null;
let quitting = false;
let toggleKey = null;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showWindow());

async function startServer() {
  process.chdir(ROOT); // o vite.config lê o .env da pasta do projeto
  const server = await createServer({ root: ROOT, configFile: resolve(ROOT, 'vite.config.js'), server: { strictPort: false } });
  await server.listen();
  return server.resolvedUrls.local[0];
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 720, minHeight: 480,
    title: 'Toca',
    icon: ICON,
    backgroundColor: '#120b08',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadURL(url);
  win.once('ready-to-show', () => win.show());
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });
  // links externos abrem no navegador, não dentro da sala
  win.webContents.setWindowOpenHandler(({ url: target }) => { shell.openExternal(target); return { action: 'deny' }; });
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function toggleWindow() {
  if (win.isVisible() && win.isFocused()) win.hide();
  else showWindow();
}

function callAgent(index) {
  showWindow();
  win.webContents.executeJavaScript(`window.__toca?.summon(window.__toca.characters[${index}])`).catch(() => {});
}

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(TRAY_ICON));
  tray.setToolTip('Toca');
  tray.setContextMenu(trayMenu());
  tray.on('click', toggleWindow);
}

function trayMenu() {
  const startsWithWindows = () => app.getLoginItemSettings().openAtLogin;
  return Menu.buildFromTemplate([
    { label: 'Abrir a sala', ...(toggleKey ? { accelerator: toggleKey } : {}), click: showWindow },
    { type: 'separator' },
    { label: 'Chamar o Alfred', accelerator: 'Ctrl+Alt+A', click: () => callAgent(0) },
    { label: 'Chamar o Nexus', accelerator: 'Ctrl+Alt+N', click: () => callAgent(1) },
    { type: 'separator' },
    {
      label: 'Abrir junto com o Windows', type: 'checkbox', checked: startsWithWindows(),
      click: (item) => { app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }); tray.setContextMenu(trayMenu()); },
    },
    { label: 'Sair', click: () => { quitting = true; app.quit(); } },
  ]);
}

app.whenReady().then(async () => {
  app.setAppUserModelId('Toca');
  // libera o microfone só para a própria sala
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(permission === 'media' && wc.getURL().startsWith(url)));
  session.defaultSession.setPermissionCheckHandler((wc, permission, origin) => permission === 'media' && url && origin.startsWith(new URL(url).origin));

  url = await startServer();
  createWindow();
  buildTray();

  // Atalho para abrir a sala: usa o primeiro que estiver livre (o Ctrl+Alt+Espaço costuma ser do app do Claude)
  toggleKey = ['Ctrl+Alt+T', 'Ctrl+Alt+Space', 'Ctrl+Shift+Space'].find((k) => globalShortcut.register(k, toggleWindow)) ?? null;
  if (!toggleKey) console.warn('Nenhum atalho livre para abrir a sala; use o ícone da bandeja.');
  for (const [keys, fn] of Object.entries({ 'Ctrl+Alt+A': () => callAgent(0), 'Ctrl+Alt+N': () => callAgent(1) })) {
    if (!globalShortcut.register(keys, fn)) console.warn(`Atalho ${keys} já está em uso por outro programa.`);
  }
  tray.setContextMenu(trayMenu());
  if (process.argv.includes('--hidden')) win.once('ready-to-show', () => win.hide());
});

app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', (e) => e.preventDefault()); // continua vivo na bandeja
