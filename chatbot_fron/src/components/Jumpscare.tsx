import { useState, useEffect } from 'react';

export default function Jumpscare() {
  const [isScared, setIsScared] = useState(false);

  useEffect(() => {
    let scareTriggered = false;

    const triggerScare = () => {
      if (scareTriggered) return;
      scareTriggered = true;
      setIsScared(true);
      
      try {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (e) {}

      // Make the console itself terrifying!
      const ghostUrl = window.location.origin + "/ghost.png";
      const ghostCss = `font-size: 400px; background: url('${ghostUrl}') no-repeat center center; background-size: contain; color: transparent;`;
      
      setInterval(() => {
        console.clear();
        console.log("%cGET OUT!", "color: red; font-size: 80px; font-weight: bold; font-family: monospace; text-shadow: 2px 2px 10px black;");
        console.log("%c.", ghostCss);
      }, 200);

      // Add the Hellish Popup Loop
      setTimeout(() => {
        const hellMessages = [
          "หยุดนะ! 🛑",
          "คิดจะแฮกโค้ดของฉันเหรอ?",
          "ระบบตรวจพบการบุกรุกโดยไม่ได้รับอนุญาต!",
          "กำลังเปิดใช้งานกล้องเว็บแคมของคุณ...",
          "แชะ! 📸",
          "บันทึกใบหน้าคนร้ายสำเร็จ!",
          "กำลังส่งข้อมูลไปที่สถานีตำรวจไซเบอร์...",
          "ดาวน์โหลด... 50%",
          "ดาวน์โหลด... 99%",
          "ล้อเล่นจ้า! 🤣",
          "แต่ขอบอกเลยว่า... คุณพลาดแล้วล่ะที่มากด F12!",
          "ลาก่อนนะ แฮกเกอร์! 👋"
        ];
        
        for (const msg of hellMessages) {
          alert(msg);
        }
        
        // Final punishment: The Rickroll
        window.location.href = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      }, 500); // Give them 0.5 seconds to see the ghost before the alerts start
    };

    // Trap 1: Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'J' || e.key === 'U'))
      ) {
        triggerScare();
      }
    };

    // Trap 2: DevTools Resize Detection
    const handleResize = () => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > 160 || heightDiff > 160) {
        triggerScare();
      }
    };

    // Trap 3: Console Object Getter
    const checkConsole = () => {
      const element = new Image();
      Object.defineProperty(element, 'id', {
        get: () => {
          if (!scareTriggered) triggerScare();
          return '';
        }
      });
      console.log(element);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    
    // Check periodically if console is opened (undocked)
    const interval = setInterval(checkConsole, 1000);
    handleResize(); // Initial check

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
    };
  }, []);

  if (!isScared) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center animate-shake overflow-hidden">
      {/* Loud Jumpscare Scream */}
      <audio autoPlay src="https://www.soundjay.com/misc/sounds/scream-01.mp3" />
      
      <img 
        src="/ghost.png" 
        alt="Jumpscare Ghost" 
        className="w-screen h-screen object-cover scale-110"
        style={{ filter: 'contrast(1.5) brightness(0.6)' }}
      />
      <div className="absolute inset-0 bg-red-900/40 mix-blend-multiply animate-pulse"></div>
      <h1 className="absolute text-red-600 font-bold text-8xl md:text-9xl tracking-widest drop-shadow-[0_0_30px_rgba(255,0,0,1)] uppercase text-center" style={{fontFamily: 'monospace', textShadow: '2px 2px 10px black'}}>
        GET OUT!
      </h1>
    </div>
  );
}
