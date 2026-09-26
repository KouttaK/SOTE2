const fs = require('fs');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.output') && !file.includes('.git') && !file.includes('scripts')) {
        results = results.concat(walk(file));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.html') || file.endsWith('.css')) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (/formulário/i.test(line) || /\bforms?\b/i.test(line)) {
          // EXCLUDE INTERNAL IDENTIFIERS:
          if (/import.*form/i.test(line)) return;
          if (/class=".*form/i.test(line)) return;
          if (/id=".*form/i.test(line)) return;
          if (/\bForm(Field)?\b/.test(line)) return;
          if (/\bforms?\./i.test(line)) return; // page.forms, storage.forms, etc
          if (/\.forms?\b/i.test(line)) return; // .forms
          if (/(const|let|var)\s+.*form/i.test(line)) return; // const form
          if (/\bform(:|\s*\))/i.test(line)) return; // form: Form, (form)
          if (/Form(Field)?\[\]/.test(line)) return;
          if (/export.*Form/.test(line)) return;
          if (/return.*form/i.test(line)) return;
          if (/\bform(s)?\s*=/i.test(line)) return; // form = 
          if (/\{.*form.*\}/i.test(line)) return; // { form }
          if (/\(form\)/i.test(line)) return; // (form)
          if (/form\.sites/i.test(line)) return;
          if (/form\.id/i.test(line)) return;
          if (/form\.name/i.test(line)) return;
          if (/form\.fields/i.test(line)) return;
          if (/form\.createdAt/i.test(line)) return;
          if (/form\.updatedAt/i.test(line)) return;
          if (/form\.stats/i.test(line)) return;
          if (/forms\s+as/i.test(line)) return; // forms as Form[]
          if (/forms\s+:\s+/i.test(line)) return; // forms: []
          if (/saveForm/i.test(line)) return;
          if (/deleteForm/i.test(line)) return;
          if (/getForms/i.test(line)) return;
          if (/openEditor/i.test(line)) return;
          if (/form\./i.test(line)) return;
          if (/forms\./i.test(line)) return;
          if (/forms\?.*/i.test(line)) return;
          if (/forms:/.test(line)) return;
          if (/forms\[/i.test(line)) return;
          if (/\(forms\)/i.test(line)) return;
          if (/=>\s*form/i.test(line)) return;
          if (/\bfunction.*form/i.test(line)) return;
          if (/typeof form/i.test(line)) return;
          
          results.push(file + ':' + (i+1) + ': ' + line.trim());
        }
      });
    }
  });
  return results;
}
const res = walk('src');
fs.writeFileSync('form-search-results.txt', res.join('\n'));
console.log('Filtered matches found:', res.length);
