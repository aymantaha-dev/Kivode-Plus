import { BrowserWindow, ipcMain } from 'electron';

export interface InputDialogOptions {
  title: string;
  label: string;
  placeholder?: string;
  buttonLabel?: string;
  inputType?: 'text' | 'password';
}

export function showInputDialog(
  parentWindow: BrowserWindow,
  options: InputDialogOptions
): Promise<string | null> {
  return new Promise((resolve) => {
    const dialogWindow = new BrowserWindow({
      width: 500,
      height: 200,
      parent: parentWindow,
      modal: true,
      show: false,
      frame: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #1e1e1e;
            color: #fff;
          }
          .container {
            display: flex;
            flex-direction: column;
            gap: 15px;
          }
          h3 {
            margin: 0 0 10px 0;
            font-size: 16px;
          }
          input {
            padding: 10px;
            border: 1px solid #444;
            border-radius: 4px;
            background: #2d2d2d;
            color: #fff;
            font-size: 14px;
          }
          .buttons {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 10px;
          }
          button {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .cancel {
            background: #444;
            color: #fff;
          }
          .confirm {
            background: #0066cc;
            color: #fff;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h3>${options.title}</h3>
          <label>${options.label}</label>
          <input type="${options.inputType || 'text'}" id="input" placeholder="${options.placeholder || ''}" />
          <div class="buttons">
            <button class="cancel" onclick="cancel()">Cancel</button>
            <button class="confirm" onclick="confirm()">${options.buttonLabel || 'OK'}</button>
          </div>
        </div>
        <script>
          const { ipcRenderer } = require('electron');
          
          function cancel() {
            ipcRenderer.send('dialog-response', null);
            window.close();
          }
          
          function confirm() {
            const value = document.getElementById('input').value;
            ipcRenderer.send('dialog-response', value);
            window.close();
          }
          
          document.getElementById('input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') confirm();
          });
          
          document.getElementById('input').focus();
        </script>
      </body>
      </html>
    `;

    dialogWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    ipcMain.once('dialog-response', (_event: Electron.IpcMainEvent, value: string | null) => {
      resolve(value);
      dialogWindow.destroy();
    });

    dialogWindow.once('ready-to-show', () => {
      dialogWindow.show();
    });

    dialogWindow.on('closed', () => {
      resolve(null);
    });
  });
}