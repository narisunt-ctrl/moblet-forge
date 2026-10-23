# ศึกษาโครงสร้าง GDevelop → สิ่งที่ Moblet Forge นำมาดัดแปลง

ศึกษาจากซอร์สโค้ดของ [4ian/GDevelop](https://github.com/4ian/GDevelop) (ส่วน Core, GDJS และ Extensions เป็น MIT License)
โดยอ่านโครงสร้างและแนวคิดเท่านั้น **ไม่ได้คัดลอกโค้ดมาใช้** โค้ดของ Moblet Forge เขียนขึ้นใหม่ทั้งหมด
ชื่อและโลโก้ GDevelop เป็นของ Florian Rival จึงไม่ได้นำมาใช้

ผู้ศึกษาและออกแบบการดัดแปลง: **นริสันต์ นาคะเกศ (Narisan Nakakes)**

## 1. ลำดับการทำงานในแต่ละเฟรม

**ที่พบใน GDevelop** (`GDJS/Runtime/runtimescene.ts`, ฟังก์ชัน `renderAndStep`)
งานแบบ async → behaviors ก่อน events → event sheet → behaviors หลัง events → render

**ที่ Moblet Forge ใช้** (`src/engine.js`, `World.step`)
ย่อเหลือ "หนึ่งก้าวเท่ากับหนึ่งเฟรม" เพราะ RL ต้องการโลกที่เดินทีละก้าวแบบแยกจังหวะ:
1. behavior ของช่องก่อนขยับ: โคลนลื่นอาจเปลี่ยนทิศที่เลือก
2. ขยับและชนกำแพง
3. behavior ของช่องหลังขยับ: ลมพัดดันต่ออีกหนึ่งช่อง
4. ตรวจเหตุการณ์ของช่องที่ยืนอยู่
5. ประเมินกฎเหตุการณ์ทั้งหมด แล้วรวมเป็นรางวัล

## 2. Event sheet: เงื่อนไข + การกระทำ

**ที่พบใน GDevelop** (`Core/GDCore/Events/Builtin/StandardEvent.h`)
event มาตรฐานประกอบด้วยรายการเงื่อนไข (กลับค่าได้) รายการ action และ sub-events
มี Else, Repeat, While, ForEach และทั้งหมดถูกแปลงเป็นโค้ด JavaScript โดย `EventsCodeGenerator.cpp`
ก่อนเกมรัน (ไม่ได้แปลความหมายระหว่างรัน)

**ที่ Moblet Forge ดัดแปลง**
กฎของเราเป็นรูปย่อของ event: **เมื่อ** (เหตุการณ์) + **ถ้า** (เงื่อนไขหนึ่งข้อ มีคู่กลับค่าในตัว เช่น "มีกุญแจ" / "ยังไม่มีกุญแจ")
→ **ให้** คะแนน / จบรอบ / นับว่าชนะ
ความแตกต่างสำคัญคือ action หลักไม่ใช่การสั่งตัวละคร แต่เป็น **การให้รางวัล** ผู้สร้างจึงไม่ได้เขียนพฤติกรรม
แต่เขียน "คุณค่า" แล้วให้ RL หาพฤติกรรมเอง

## 3. Behaviors

**ที่พบใน GDevelop** (`GDJS/Runtime/runtimebehavior.ts`)
behavior คือส่วนประกอบที่ติดกับ object และมี hook `doStepPreEvents` / `doStepPostEvents`

**ที่ Moblet Forge ดัดแปลง**
ย้าย behavior จาก object ไปไว้ที่ **ช่องของด่าน** (ลมพัด, โคลนลื่น, ประตูกุญแจ) เพื่อให้ state ยังเป็น Markov
(ตำแหน่ง × กุญแจ × ถ่านไฟที่เก็บแล้ว) และใช้ Q-table แบบตารางได้

## 4. Trigger once

**ที่พบใน GDevelop** (`GDJS/Runtime/oncetriggers.ts`)
แต่ละ trigger จำได้ว่าเฟรมที่แล้วเป็นจริงหรือไม่ และจะเป็นจริงเฉพาะเฟรมแรกที่เงื่อนไขเริ่มเป็นจริง

**ที่ Moblet Forge ดัดแปลง**
ใช้แนวคิด "เกิดครั้งเดียว" ผ่าน state แทนตัวนับ: ถ่านไฟแต่ละก้อนและกุญแจให้เหตุการณ์ได้ครั้งเดียวต่อรอบ
เพราะถูกจำไว้ใน bitmask ของ state วิธีนี้ทำให้รางวัลยังขึ้นกับ state อย่างเดียว ซึ่งจำเป็นต่อ Q-learning

## 5. Gameplay tests

**ที่พบใน GDevelop** (`GDJS/Runtime/gameplay-tests/gameplay-test-runner.ts`)
ระบบรันเกมแบบกำหนดผลได้ (deterministic) ทีละเฟรม จำลอง input และตรวจสถานะเกมเทียบกับเงื่อนไข

**ที่ Moblet Forge ดัดแปลงเป็นโหมดเกมใหม่**
แนวคิด "ทดสอบแบบกำหนดผลได้" กลายเป็นกลไกหลักของ **โหมดครูฝึก** (ดู [GAME_DESIGN.md](GAME_DESIGN.md)):
ระบบฝึกสมองใหม่ด้วย seed คงที่ แล้วรันโมบเล็ตแบบ greedy (เสมอกันเลือกทิศเลขน้อยสุด)
เพื่อตัดสินผลอย่างยุติธรรมและทำซ้ำได้ทุกครั้ง

## สรุปสิ่งที่ไม่ได้นำมา

ระบบ object/sprite/physics, layer, การ render ด้วย PixiJS/Three.js, ตัวแปรแบบ tree, timers และ scene stack
ไม่ได้นำมา เพราะ Moblet Forge เลือกโลกกริดขนาดเล็กเพื่อให้ RL เรียนรู้ได้ภายในไม่กี่วินาทีบนเบราว์เซอร์
