import fs from 'fs';
import path from 'path';

console.log('Starting refactor...');

// 1. Move directories
fs.cpSync('features', 'src/features', { recursive: true });
fs.cpSync('config', 'src/config', { recursive: true });

const servicesToKeep = [
  'calculationEngine.js',
  'exportDataBuilders.js',
  'notificationService.js',
  'quoteRepository.js',
  'stateManager.js'
];
for (const file of servicesToKeep) {
  if (fs.existsSync(`services/${file}`)) {
    fs.cpSync(`services/${file}`, `src/services/${file}`);
  }
}

fs.rmSync('features', { recursive: true, force: true });
fs.rmSync('config', { recursive: true, force: true });
fs.rmSync('services', { recursive: true, force: true });

console.log('Directories moved.');

// 2. Rewrite imports
function rewriteImports(dir, isTests) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      rewriteImports(fullPath, isTests);
    } else if (file.match(/\.(js|jsx)$/)) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      let modified = false;
      const targetDirs = ['features', 'config', 'services'];
      
      targetDirs.forEach(target => {
          const regex = new RegExp(`(['"])((?:\\.\\.\\/)+)(${target}\\/)`, 'g');
          content = content.replace(regex, (match, quote, dotdots, folder) => {
              modified = true;
              if (isTests) {
                  return `${quote}${dotdots}src/${folder}`;
              } else {
                  const count = dotdots.split('../').length - 1;
                  if (count === 1) {
                      return `${quote}./${folder}`;
                  } else {
                      return `${quote}${ '../'.repeat(count - 1) }${folder}`;
                  }
              }
          });
      });
      
      if (modified) {
          fs.writeFileSync(fullPath, content);
          console.log(`Updated imports in ${fullPath}`);
      }
    }
  }
}

rewriteImports('src', false);
if (fs.existsSync('tests')) {
    rewriteImports('tests', true);
}

console.log('Refactoring complete.');
