const fs = require('fs');
['src/dashboard/pages/templates.ts', 'src/dashboard/pages/variables.ts'].forEach(f => {
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/\\\$/g, '$').replace(/\\`/g, '`');
  fs.writeFileSync(f, s);
});
