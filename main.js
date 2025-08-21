const readline = require("readline");
const fs = require("fs");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");
const fetchFn = typeof fetch === "function" ? fetch : require("node-fetch");
const { exec } = require("child_process");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getUserAgents() {
  const data = fs.readFileSync('user-agents.txt', 'utf-8');
  return data
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('http'));
}
const userAgents = getUserAgents();

async function checkProxy(proxyObject) {
  const { proxy, type } = proxyObject;
  let agent;
  if (type === "http" || type === "https") {
    agent = new HttpsProxyAgent(`http://${proxy}`);
  } else if (type === "socks4" || type === "socks5") {
    agent = new SocksProxyAgent(`${type}://${proxy}`);
  } else {
    return { alive: false, working: false };
  }

  const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

  async function tryFetch(url, options, timeout = 7000) {
    try {
      const res = await fetchFn(url, { ...options, agent, timeout });
      return res;
    } catch {
      return null;
    }
  }

  try {
    // 1) test ว่า proxy ยังมีชีวิต (httpbin)
    const aliveRes = await tryFetch("https://httpbin.org/ip", {
      method: "GET",
      headers: { "User-Agent": randomUA }
    });
    if (!aliveRes || !aliveRes.ok) return { alive: false, working: false };

    // 2) test ยิงจริงไปที่ ngl.link
    const body = new URLSearchParams({
      username: "testdummy",
      question: "proxycheck",
      deviceId: Math.random().toString(36).substring(2, 15),
    });

    const apiRes = await tryFetch("https://ngl.link/api/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": randomUA,
        "Origin": "https://ngl.link",
        "Referer": "https://ngl.link/testdummy"
      },
      body
    }, 2000);

    if (apiRes && apiRes.ok) {
      const text = await apiRes.text();
      if (text.includes("success") || text.includes("true") || apiRes.status === 200) {
        return { alive: true, working: true };
      }
    }

    return { alive: true, working: false };
  } catch {
    return { alive: false, working: false };
  }
}

(async () => {
  console.log("🔄 กำลังโหลด proxy list จาก apiproxy.json...");
  let allProxies = [];
  try {
    const proxyConfig = JSON.parse(fs.readFileSync('apiproxy.json', 'utf8'));
    const SOURCES = proxyConfig.sources;
    const proxyLists = await Promise.all(
      SOURCES.map(async (source) => {
        const { type, url } = source;
        try {
          const res = await fetchFn(url, { timeout: 7000 });
          if (res.ok) {
            const text = await res.text();
            let proxies;
            try {
              // Try to parse as JSON
              const arr = JSON.parse(text);
              if (Array.isArray(arr)) {
                proxies = arr.map(obj => {
                  // If it's an object with ip/port, format as "ip:port"
                  if (obj.ip && obj.port) return `${obj.ip}:${obj.port}`;
                  // If it's a string, use as is
                  if (typeof obj === 'string') return obj.trim();
                  return null;
                }).filter(Boolean);
              } else {
                proxies = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
              }
            } catch {
              // Fallback: treat as plain text list
              proxies = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            }
            // Only keep valid IP:PORT format
            return proxies
              .filter(p => /^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(p))
              .map(p => ({ proxy: p, type: type }));
          }
          return [];
        } catch {
          return [];
        }
      })
    );
    allProxies = [...new Map(proxyLists.flat().map(item => [item.proxy, item])).values()];
  } catch {}
  console.log(`✅ โหลด proxy ทั้งหมด ${allProxies.length} ตัวเรียบร้อย`);
  if (allProxies.length === 0) {
    console.log("⚠️ ไม่พบ proxy เลย โปรแกรมจะปิดตัวลง");
    return;
  }

  const shuffledProxies = shuffle(allProxies);
  const toCheck = shuffledProxies;
  console.log(`🚀 เตรียมเช็ค proxy ทั้งหมด ${toCheck.length} ตัว...`);

  const BATCH_SIZE = 200; // จำนวน proxy ที่เช็คพร้อมกันในแต่ละรอบ

  let workingProxies = [];
  let aliveProxies = [];
  let checkedCount = 0;

  for (let i = 0; i < toCheck.length; i += BATCH_SIZE) {
    const batch = toCheck.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (proxyObject) => {
        const result = await checkProxy(proxyObject);
        checkedCount++;
        if (result.alive && result.working) {
          workingProxies.push(proxyObject);
        } else if (result.alive) {
          aliveProxies.push(proxyObject);
        }
        process.stdout.write(`[${checkedCount}/${toCheck.length}] 🟢 ใช้ได้จริง ${workingProxies.length} | 🌐 ออนไลน์ ${aliveProxies.length}\r`);
      })
    );
    if (workingProxies.length >= 100) {
      console.log(`\n🛑 พบ proxy ใช้ได้จริงครบ 100 ตัวแล้ว หยุดการค้นหา`);
      break;
    }
  }

  console.log(`\n✅ เช็คเสร็จสิ้น: ใช้ได้จริง ${workingProxies.length} ตัว, ออนไลน์ ${aliveProxies.length} ตัว`);
  if (workingProxies.length === 0 && aliveProxies.length === 0) {
    console.log("⚠️ ไม่พบ proxy ที่ใช้งานได้ โปรแกรมจะปิดตัวลง");
    return;
  }

  // เล่นเสียง beep-sound.mp3
  exec('start beep-sound.mp3');

  const username = (await ask("\nusername (ngl.link/xxxx): ")).trim();
  const durationSec = parseInt(await ask("\nระบุเวลายิง (วินาที): "), 10);
  let message = (await ask("\nmessage: ")).trim();
  if (message === "") {
    message = ""; // กำหนดให้ว่างไว้ เพื่อสุ่มใน sendMessage ทุกครั้ง
  }
  const randomMessages = [
  "คิดถึงนะ 💖",
  "สวัสดีครับ",
  "ขอให้โชคดี!",
  "วันนี้เป็นยังไงบ้าง?",
  "ส่งกำลังใจให้เสมอ",
  "ขอบคุณที่อยู่ด้วยกัน",
  "ยิ้มเข้าไว้ 😊",
  "ขอให้มีความสุขทุกวัน",
  "รักนะ",
  "ดูแลตัวเองด้วยนะ",
  "นอนหลับฝันดี 🌙",
  "เชื่อในตัวเองเสมอ",
  "ทุกอย่างจะดีขึ้น",
  "กำลังใจอยู่ตรงนี้ ✨",
  "ยิ้มสวยมากเลย",
  "อย่าลืมพักผ่อนนะ",
  "สู้ ๆ นะ ✌️",
  "เป็นห่วงเสมอ",
  "ขอให้เจอแต่สิ่งดี ๆ",
  "คิดถึงรอยยิ้มของคุณ",
  "ดูแลสุขภาพด้วยน้า",
  "อย่ายอมแพ้เด็ดขาด!",
  "ภูมิใจในตัวคุณนะ",
  "ขอให้ผ่านไปได้ด้วยดี",
  "ขอบคุณที่ยังอยู่ตรงนี้",
  "เป็นคนเก่งเสมอ",
  "ไม่ต้องฝืนมากเกินไปนะ",
  "มีฉันอยู่ข้าง ๆ",
  "เจอเรื่องดี ๆ เยอะ ๆ นะ",
  "พักบ้างก็ดีนะ",
  "คุณทำได้แน่นอน",
  "อย่าลืมยิ้มให้ตัวเอง",
  "มีความสุขมาก ๆ นะ",
  "ขอบคุณที่ทำให้ยิ้มได้",
  "รักตัวเองให้มาก ๆ",
  "เราจะผ่านมันไปด้วยกัน",
  "โลกยังสวยเสมอ 🌍",
  "อย่าหักโหมเกินไป",
  "เชื่อมั่นในความพยายาม",
  "ใจเย็น ๆ ทุกอย่างจะโอเค",
  "สุขสันต์วันดี ๆ",
  "คิดบวกไว้เสมอ",
  "อย่าลืมดื่มน้ำเยอะ ๆ 💧",
  "เธอคือคนสำคัญนะ",
  "ดีใจที่มีคุณอยู่ตรงนี้",
  "สู้ไปด้วยกันนะ",
  "พักใจบ้างก็ได้",
  "มีค่าเสมอ",
  "ขอบคุณที่ไม่ทิ้งกัน",
  "ความสุขอยู่ไม่ไกล",
  "ยิ้มแล้วน่ารักจัง",
  "ทุกเช้าเป็นเริ่มต้นใหม่ 🌅",
  "โชคดีทุก ๆ วัน",
  "เรามาเดินไปด้วยกันนะ",
  "ขอบคุณที่เข้าใจเสมอ",
  "เป็นกำลังใจให้นะ",
  "คุณเก่งที่สุดแล้ว",
  "แค่มีคุณก็พอแล้ว",
  "สุขภาพแข็งแรงนะ",
  "ขอบคุณที่คอยรับฟัง",
  "ไม่เป็นไรนะ ยังไหวอยู่",
  "คุณไม่เคยอยู่คนเดียว",
  "มีคนรออยู่ตรงนี้เสมอ",
  "อดทนไว้นะ",
  "คุณทำดีที่สุดแล้ว",
  "ไม่ต้องกังวลมากไป",
  "มีกำลังใจให้นะ 💪",
  "ยิ้มแล้วสดใสมาก",
  "ขอบคุณที่เป็นคุณ",
  "เชื่อว่าคุณทำได้",
  "เจอแต่เรื่องดี ๆ นะ",
  "ความสุขเล็ก ๆ ก็สำคัญ",
  "เป็นตัวเองให้ดีที่สุด",
  "สบายใจขึ้นได้แน่นอน",
  "คิดถึงทุกเวลา",
  "มีแต่สิ่งดี ๆ รออยู่",
  "เป็นแรงบันดาลใจเสมอ",
  "โชคดีมาก ๆ นะ",
  "วันนี้จะเป็นวันที่ดี",
  "คุณมีคุณค่าเสมอ",
  "หัวใจดวงนี้อยู่กับคุณ ❤️",
  "พักสายตาบ้างนะ",
  "ไม่ต้องแข็งแรงตลอดก็ได้",
  "เจอทางออกแน่นอน",
  "ขอบคุณที่ไม่ยอมแพ้",
  "อย่าลืมว่าเรารักคุณ",
  "โลกยังรอรอยยิ้มคุณอยู่",
  "คุณพิเศษที่สุดแล้ว",
  "มีเรื่องดี ๆ รออยู่แน่นอน",
  "ทุกอย่างจะผ่านไปได้",
  "ยิ้มให้โลกหน่อย 🙂",
  "มีความสุขในแบบของคุณ",
  "ขอบคุณที่ยังยิ้มได้",
  "เดินไปด้วยกันนะ",
  "เรายังอยู่ตรงนี้เสมอ",
  "รักเสมอ ไม่เปลี่ยนแปลง",
  "เชื่อใจในอนาคต",
  "วันนี้ก็เก่งมากแล้ว",
  "หัวใจเราเป็นของคุณ 💕",
  "จะอยู่ข้างคุณเสมอ",
  "กำลังใจไม่เคยหมด",
  "รักมากกว่าเมื่อวาน",
  "เธอคือนิยามของความสุข"
  ];
  rl.close();

  async function sendMessage(index, customUA) {
    let finalMessage;
    if (message === "") {
      // ถ้า message ว่าง ให้สุ่มข้อความจาก randomMessages
      finalMessage = randomMessages[Math.floor(Math.random() * randomMessages.length)];
    } else {
      finalMessage = message;
    }

    const { proxy, type } = workingProxies[index];
    const body = new URLSearchParams({
      username: username,
      question: finalMessage,
      deviceId: Math.random().toString(36).substring(2, 15),
      gameSlug: '',
      referrer: '',
    });

    const randomUA = customUA || userAgents[Math.floor(Math.random() * userAgents.length)];
    const options = {
      method: "POST",
      headers: {
        'Host': 'ngl.link',
        'sec-ch-ua': '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
        'accept': '*/*',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        'sec-ch-ua-mobile': '?0',
        'user-agent': randomUA,
        'sec-ch-ua-platform': '"Windows"',
        'origin': 'https://ngl.link',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'referer': `https://ngl.link/${username}`,
        'accept-language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      body,
    };

    let agent;
    if (type === "http" || type === "https") {
      agent = new HttpsProxyAgent(`http://${proxy}`);
    } else if (type === "socks4" || type === "socks5") {
      agent = new SocksProxyAgent(`${type}://${proxy}`);
    }

    try {
      await fetchFn("https://ngl.link/api/submit", { ...options, agent, timeout: 7000 });
      console.log(`✅ ส่งข้อความสำเร็จ: "${finalMessage}" ผ่าน ${proxy}`);
    } catch (e) {
      console.log(`❌ ส่งข้อความล้มเหลว: "${finalMessage}" ผ่าน ${proxy} (Error: ${e.message})`);
    }
  }

  const CONCURRENCY = workingProxies.length; // ยิงพร้อมกันทุก proxy
  const endTime = Date.now() + durationSec * 1000;
  let sentCount = 0;

  console.log(`\n🚀 เริ่มยิงเร็วสุดๆ ไปยัง ${workingProxies.length} proxy ...`);

  async function fire() {
    while (Date.now() < endTime) {
      const batchUA = userAgents[Math.floor(Math.random() * userAgents.length)];
      const batch = [];
      for (let j = 0; j < CONCURRENCY; j++) {
        const proxyIndex = (sentCount + j) % workingProxies.length;
        batch.push(sendMessage(proxyIndex, batchUA));
      }
      // ยิงทันที ไม่รอรอบเก่าเสร็จ
      Promise.all(batch).catch(() => {});
      sentCount += CONCURRENCY;
    }
    console.log(`\n✅ ส่งข้อความเสร็จสิ้น! รวมทั้งหมด ${sentCount} ข้อความ`);
  }

  fire();
})();