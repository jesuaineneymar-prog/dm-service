var j = require('/home/z/my-project/bd-quickstart.json');
var html = (j.data && j.data.html) || j.html || '';
var text = html
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

// Find Browser API zone type
var idx = text.indexOf('Browser API');
if (idx > -1) console.log(text.substring(idx, idx + 6000));
else console.log(text.substring(0, 6000));
