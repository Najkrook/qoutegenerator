import fs from 'fs';
import path from 'path';

function rewriteImportsExact(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      rewriteImportsExact(fullPath);
    } else if (file.match(/\.(js|jsx)$/)) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      let modified = false;

      // In src/, everything is rooted in src/ now.
      // E.g., a file in src/services/calculationEngine.js wants to import src/utils/gridAutoScale.js
      // It was doing `../src/utils/gridAutoScale.js`. Now it should do `../utils/gridAutoScale.js`.
      
      // Let's replace `../src/` with `../`
      content = content.replace(/(['"])\.\.\/src\//g, (match, quote) => {
          modified = true;
          return `${quote}../`;
      });
      content = content.replace(/(['"])\.\/src\//g, (match, quote) => {
          modified = true;
          return `${quote}./`;
      });
      
      // Some files in src/features used to import from ../services/x.js -> now ../services/x.js (no change if they were in root features, but now they are in src/features).
      // Actually, root features was `features/x.js`. To import root `services/y.js`, it did `../services/y.js`. 
      // Now both are in `src/features/x.js` and `src/services/y.js`. `../services/y.js` is correct!
      
      // In src/features/utils.js, it wants `./services/stateManager.js`. Wait, if it was in `features/utils.js`, `./services` would mean `features/services` which doesn't exist. It probably meant `../services/stateManager.js`. Let's check.
      content = content.replace(/(['"])\.\/services\//g, (match, quote) => {
         if (fullPath.includes('src\\features\\') || fullPath.includes('src/features/')) {
             modified = true;
             return `${quote}../services/`;
         }
         return match;
      });
      
      content = content.replace(/(['"])\.\/features\//g, (match, quote) => {
         if (fullPath.includes('src\\services\\') || fullPath.includes('src/services/')) {
             modified = true;
             return `${quote}../features/`;
         }
         return match;
      });
      
      content = content.replace(/(['"])\.\/config\//g, (match, quote) => {
         if (fullPath.includes('src\\features\\') || fullPath.includes('src/features/')) {
             modified = true;
             return `${quote}../config/`;
         }
         return match;
      });

      // Fix `pdfExport.js` looking for `../assets/logoData.js`. Since it's now in `src/features/pdfExport.js`, `../assets` goes to `src/assets`, but `assets` is in `root/assets`!
      // Oh, `assets` is at the root. So `../../assets/logoData.js`.
      content = content.replace(/(['"])\.\.\/assets\//g, (match, quote) => {
          if (fullPath.includes('src\\features\\') || fullPath.includes('src/features/')) {
              modified = true;
              return `${quote}../../assets/`;
          }
          return match;
      });

      // `src/views/Dashboard.jsx` importing `./services/firebase`? Wait, from `src/views/`, `./services/` is `src/views/services/` which is wrong. It should be `../services/firebase`.
      content = content.replace(/(['"])\.\/services\//g, (match, quote) => {
          if (fullPath.includes('src\\views\\') || fullPath.includes('src/views/')) {
              modified = true;
              return `${quote}../services/`;
          }
          return match;
      });

      if (modified) {
          fs.writeFileSync(fullPath, content);
          console.log(`Updated imports in ${fullPath}`);
      }
    }
  }
}

rewriteImportsExact('src');
