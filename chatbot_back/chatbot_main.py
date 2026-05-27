import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

def main():
    # 1. โหลด Environment Variables
    load_dotenv()

    # 2. การตั้งค่าคีย์ API
    api_key = os.getenv('GEMINI_API_KEY')

    if not api_key:
        print("Error: API key not found. Please set GEMINI_API_KEY in your .env file.")
        return

    # 3. สร้าง Client
    client = genai.Client(api_key=api_key)

    # 4. กำหนด Configuration (ปรับปรุงให้รองรับ Gemini 3)
    generation_config = types.GenerateContentConfig(
        temperature=0.7,
        max_output_tokens=1024, # เพิ่มจำนวน Token ให้พอสำหรับโค้ด SQL หรือ Python
        top_p=1,
    )

    # 5. รับ Prompt จากผู้ใช้
    prompt = input('input: ')

    print('\nSending request to Gemini...')

    # เลือกใช้รุ่น Flash เพื่อเลี่ยงปัญหา Quota เต็มบ่อยๆ (Error 429)
    # หรือเปลี่ยนเป็น "gemini-3-pro-preview" หากคุณต้องการความฉลาดสูงสุด
    SELECTED_MODEL = "gemini-3-flash-preview" 

    try:
        # 6. เรียกใช้โมเดล
        response = client.models.generate_content(
            model=SELECTED_MODEL, 
            contents=prompt,
            config=generation_config
        )

        if response.text:
            print('\nGemini:', response.text)
        else:
            print('\nGemini: (No response text found)')
        
    except Exception as e:
        # เพิ่มการแจ้งเตือนเรื่อง Quota ถ้าเจอ Error 429
        if "429" in str(e):
            print(f"\nError: Quota exceeded (429). Please wait a minute or switch model.")
        else:
            print(f"\nAn error occurred: {e}")

if __name__ == "__main__":
    main()