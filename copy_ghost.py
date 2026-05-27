import shutil
import os

source = r"C:\Users\zerve\.gemini\antigravity\brain\52fbe036-3f75-4c7e-a27a-2fc11f3ded82\ghost_jumpscare_1779691724674.png"
dest = r"c:\ChatbotICT\chatbot_fron\public\ghost.png"

try:
    shutil.copy(source, dest)
    print("Successfully copied ghost image!")
except Exception as e:
    print(f"Failed to copy image: {e}")
