# 🚀 Proxy NGL Sender

สคริปต์ Node.js สำหรับ  
- โหลด Proxy จากหลายๆ แหล่ง (HTTP, HTTPS, SOCKS4, SOCKS5)  
- ตรวจสอบ proxy ที่ **ออนไลน์** และ **ใช้งานได้จริง**  
- ใช้ proxy เหล่านั้นในการส่งข้อความไปยัง [ngl.link](https://ngl.link) แบบ **เร็วสุดๆ**  

---

## ✨ Features
- ✅ ดึง proxy list อัตโนมัติจาก `apiproxy.json`  
- ✅ ตรวจสอบ proxy ว่า **Alive** หรือ **Working**  
- ✅ สุ่ม User-Agent จากไฟล์ `user-agents.txt`  
- ✅ ส่งข้อความ (สุ่มข้อความหรือกำหนดเองก็ได้)  
- ✅ รองรับ proxy ทุกประเภท (http, https, socks4, socks5)  
- ✅ ยิงข้อความพร้อมกันหลายๆ proxy ได้ (Concurrency = จำนวน proxy ที่ใช้ได้จริง)  

---

## 📦 การติดตั้ง
1. Clone โปรเจกต์นี้  
   ```bash
   git clone https://github.com/zmalachi/NGL-Spam.git
   cd NGL-Spam
   ```
2. ติดตั้ง dependencies  
   ```bash
   npm install
   ```
3. เตรียมไฟล์ `user-agents.txt` และ `apiproxy.json`  
   - `user-agents.txt` : รายการ User-Agent (หนึ่งบรรทัดต่อหนึ่ง UA)
   - `apiproxy.json` : รายการแหล่ง proxy (ดูตัวอย่างในไฟล์)

---

## 🚀 วิธีใช้งาน
```bash
node main.js
```
- กรอก username (ngl.link/xxxx)
- ระบุเวลายิง (วินาที)
- ระบุข้อความ (หรือปล่อยว่างเพื่อสุ่มข้อความ)

---

## 📝 ตัวอย่างไฟล์
**apiproxy.json**
```json
{
  "sources": [
    { "type": "http", "url": "https://example.com/http.txt" },
    { "type": "socks4", "url": "https://example.com/socks4.json" }
  ]
}
```

**user-agents.txt**
```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...
...
```

---

## 📄 License
MIT
์
