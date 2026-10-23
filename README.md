# Moblet Forge

**โรงตีเกมบนเว็บ ที่ตัวละครเรียนรู้ทางผ่านด่านได้เอง ด้วย Reinforcement Learning**

สร้างและออกแบบโดย **นริสันต์ นาคะเกศ (Narisan Nakakes)** · [github.com/narisunt-ctrl](https://github.com/narisunt-ctrl)

Moblet Forge เป็นเครื่องมือสร้างเกมแบบไม่ต้องเขียนโค้ด (แนวเดียวกับ GDevelop) แต่มีแนวคิดหลักของตัวเอง:
**กฎเหตุการณ์ที่ผู้สร้างตั้งขึ้น คือฟังก์ชันรางวัลของ AI** ผู้สร้างจึงไม่ต้องเขียนพฤติกรรมของตัวละครเลย
แค่บอกว่าอะไร "ดี" อะไร "ไม่ดี" แล้วกดฝึก ตัวละคร "โมบเล็ต" จะลองผิดลองถูกจนหาทางผ่านด่านได้เอง

> เปิดใช้งานได้ทันที: เปิดไฟล์ `index.html` ในเบราว์เซอร์ หรือเปิด GitHub Pages ของ repo นี้ ไม่ต้องติดตั้งอะไร

## ขั้นตอนสร้างเกม 6 ขั้น

| ขั้น | แท็บ | ทำอะไร |
|---|---|---|
| 01 | ด่าน | วาดด่านบนกริดด้วยช่อง 9 ชนิด: กำแพง พื้น จุดเกิด ตะเกียงเส้นชัย ถ่านไฟ หนาม กุญแจ ประตูกุญแจ และช่องลมพัด |
| 02 | กฎ | ตั้งกฎแบบ "เมื่อ… ถ้า… ให้คะแนน… / จบรอบ / นับว่าชนะ" (event sheet) ซึ่งกลายเป็นรางวัลของ RL |
| 03 | ตัวละคร | ออกแบบโมบเล็ต: ทรงตัว 4 แบบ ดวงตา 4 แบบ ของบนหัว 5 แบบ ลาย 4 แบบ และสีอิสระ วาดสดด้วย canvas ไม่มีไฟล์ภาพ |
| 04 | ฝึก AI | ฝึกด้วย Q-learning หรือ SARSA ปรับ α γ ε ได้ ดูกราฟคะแนนและอัตราชนะแบบสด แล้วกด "ดู AI เล่น" |
| 05 | เล่น | เล่นเองด้วยลูกศร/WASD หรือปุ่มบนจอ แข่งกับเงาของ AI ที่ฝึกแล้ว |
| 06 | แชร์ | ส่งออกเป็นเกม `.html` ไฟล์เดียว (แนบสมอง AI ได้) หรือบันทึก/นำเข้าโปรเจกต์ `.json` |

### เลเยอร์ความคิดของ AI
ใต้กระดานมีปุ่มดูสิ่งที่ AI เรียนรู้:
- **ค่าที่ประเมิน** แผนที่ความร้อนของ V(s) = max Q(s,a) สีน้ำเงินคือที่ที่ AI คิดว่าดี สีแดงเข้มคือที่อันตราย
  แผนที่นี้เปลี่ยนตามสถานะจริง (มีกุญแจหรือยัง เก็บถ่านไฟก้อนไหนแล้ว) จึงเห็นว่า "เป้าหมาย" ของ AI ย้ายไปเรื่อยๆ
- **ทิศที่เลือก** ลูกศรนโยบาย greedy ในแต่ละช่อง
- **ที่เคยไป** ความถี่ที่ AI สำรวจแต่ละช่องระหว่างฝึก

## RL ทำงานอย่างไร

- **สถานะ (state)** = ตำแหน่ง × มีกุญแจหรือไม่ × ถ่านไฟที่เก็บแล้ว (bitmask สูงสุด 8 ก้อน) ทำให้ปัญหาเป็น Markov
- **การกระทำ** = ขึ้น ขวา ลง ซ้าย
- **รางวัล** = ผลรวมคะแนนของทุกกฎที่ตรงกับเหตุการณ์และเงื่อนไขในก้าวนั้น
- **อัลกอริทึม** = Tabular Q-learning (off-policy) หรือ SARSA (on-policy) พร้อม ε-greedy ที่ค่อยๆ ลดการสุ่มลงทุกรอบ
- ใช้ PRNG แบบมี seed ผลการฝึกจึงทำซ้ำได้

ตัวอย่างการทดลอง: ตั้งกฎ "เหยียบหนาม" เป็น +1 แล้วฝึกใหม่ โมบเล็ตจะเปลี่ยนนิสัยไปวนเหยียบหนามทันที
นี่คือ reward hacking ในขนาดที่จับต้องได้

## โครงสร้างโปรเจกต์

```
src/engine.js   โลกกริด กติกาการเดิน ช่องพิเศษ และระบบกฎเหตุการณ์
src/rl.js       Brain: Q-learning / SARSA, rollout, export/import Q-table
src/levels.js   ด่านตัวอย่าง 3 ด่าน
src/art.js      วาดช่องด่านและโมบเล็ตแบบ procedural
src/app.js      editor, trainer, player, export
src/shell.html  markup + CSS
build.mjs       รวมทุกไฟล์เป็น index.html ไฟล์เดียว
test/           ทดสอบว่า AI ฝึกผ่านด่านตัวอย่างได้จริง
```

## พัฒนาต่อ

ต้องมี Node.js 18 ขึ้นไป (ไม่มี dependency)

```bash
npm run build   # สร้าง index.html และ dist/moblet-forge.html
npm test        # ฝึก Q-learning และ SARSA บนทุกด่านตัวอย่าง ต้องผ่านทั้งหมด
```

เปิด GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root

## English summary

Moblet Forge is a no-code, browser-based game maker in the spirit of GDevelop, built around one original idea:
the creator's event rules *are* the reward function. You draw a grid level, write rules such as
"when the Moblet steps on a thorn → −1 and end the episode", design your own procedurally drawn Moblet,
then press Train. A tabular Q-learning (or SARSA) agent learns to clear the level while you watch its value
map, policy arrows and learning curve. You can play the level yourself, race the trained AI, and export the
whole thing as a single self-contained HTML game with the trained brain embedded.

## License

MIT © 2026 Narisan Nakakes (นริสันต์ นาคะเกศ)
