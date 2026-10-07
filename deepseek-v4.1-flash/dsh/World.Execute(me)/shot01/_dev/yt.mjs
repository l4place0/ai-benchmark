// yt.mjs — scrape YouTube search results and a video's description (no API key).
// usage: node yt.mjs search "query"        -> list of id|duration|title
//        node yt.mjs desc <videoId>        -> shortDescription + title + duration
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  let last;
  for (let i = 1; i <= 5; i++) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(45000),
        headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) { last = e; await sleep(1200 * i); }
  }
  throw last;
}

const [, , cmd, arg] = process.argv;

if (cmd === 'search') {
  const html = await get('https://www.youtube.com/results?search_query=' + encodeURIComponent(arg) + '&hl=en&gl=US');
  const out = [];
  const re = /"videoRenderer":\{"videoId":"([\w-]{11})".*?"title":\{"runs":\[\{"text":"(.*?)"\}\].*?"lengthText":\{"accessibility":\{"accessibilityData":\{"label":"(.*?)"\}\}/g;
  let m;
  while ((m = re.exec(html)) && out.length < 15) {
    out.push({ id: m[1], title: JSON.parse('"' + m[2] + '"'), dur: m[3] });
  }
  for (const v of out) console.log(`${v.id} | ${v.dur} | ${v.title}`);
} else if (cmd === 'desc') {
  const html = await get('https://www.youtube.com/watch?v=' + arg + '&hl=en&gl=US');
  const pick = k => {
    const m = html.match(new RegExp('"' + k + '":"((?:[^"\\\\]|\\\\.)*)"'));
    return m ? JSON.parse('"' + m[1] + '"') : null;
  };
  console.log('TITLE: ' + pick('title'));
  console.log('LEN: ' + pick('lengthSeconds'));
  console.log('CHANNEL: ' + (html.match(/"ownerChannelName":"((?:[^"\\]|\\.)*)"/) || [])[1]);
  console.log('--- DESCRIPTION ---');
  console.log(pick('shortDescription'));
} else {
  console.error('usage: node yt.mjs search|desc ...');
  process.exit(2);
}
