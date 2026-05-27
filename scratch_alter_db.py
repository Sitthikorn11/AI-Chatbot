import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    print("Executing ALTER TABLE...")
    # Using the existing exec_sql RPC function
    res = supabase.rpc('exec_sql', {'query': 'ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS sql_query TEXT;'}).execute()
    print("Result:", res)
    print("Success: Column added.")
except Exception as e:
    print(f"Error: {e}")
