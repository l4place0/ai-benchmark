const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf-8');
const start = html.lastIndexOf('<script>');
const end = html.lastIndexOf('</script>');
const script = html.substring(start + 8, end);

fs.writeFileSync('temp_script.js', script, 'utf-8');
console.log('Saved temp_script.js');
