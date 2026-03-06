module.exports = {
  appId: 'com.kivode.plus',
  productName: 'Kivode+',
  copyright: 'Copyright © 2024 Kivode+. All rights reserved.',
  
  directories: {
    output: 'release',
    buildResources: 'assets',
  },

  files: [
    'dist/**/*',
    'assets/**/*',
    'node_modules/**/*',
    '!**/*.map',
    '!**/*.ts',
    '!**/*.tsx',
    '!**/*.d.ts',
    '!dist/main/**/*.js.map',
    '!dist/renderer/**/*.js.map',
    '!**/{.git,.github,.vscode,docs,test,tests,__tests__}/**/*',
    '!**/{*.md,*.txt,*.log,LICENSE,CHANGELOG}',
    '!node_modules/{typescript,eslint,prettier,@types}/**/*',
    '!node_modules/**/*.d.ts',
    '!node_modules/**/*.map',
    '!node_modules/**/*.md',
  ],

  asar: true,
  asarUnpack: [
    'node_modules/simple-git/**/*',
  ],

  extraResources: [
    {
      from: 'src/main/python',
      to: 'python',
      filter: ['**/*.py'],
    },
  ],
  
  compression: 'maximum',
  removePackageScripts: true,

  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    icon: 'assets/icon.ico',
    publisherName: 'Kivode+',
    verifyUpdateCodeSignature: false,
    requestedExecutionLevel: 'asInvoker',
    legalTrademarks: 'Kivode+',
    fileVersion: '1.0.0.0',
    productVersion: '1.0.0',
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Kivode+',
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    installerHeaderIcon: 'assets/icon.ico',
    deleteAppDataOnUninstall: true,
    runAfterFinish: false,
    artifactName: 'Kivode-Plus-Setup-${version}.exe',
    license: 'LICENSE.txt',
    warningIfNoAdmin: 'Administrator privileges are not required for default installation.',
  },

  portable: {
    artifactName: 'Kivode-Plus-Portable-${version}.exe',
  },

  // Security: Disable publishing
  publish: null,

  // Security: Remove debug files
  afterPack: async (context) => {
    const fs = require('fs');
    const path = require('path');
    
    // Remove source maps
    const removeSourceMaps = (dir) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          removeSourceMaps(fullPath);
        } else if (file.endsWith('.map')) {
          fs.unlinkSync(fullPath);
        }
      }
    };
    
    removeSourceMaps(context.appOutDir);
  },
};