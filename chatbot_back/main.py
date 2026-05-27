import os
import re
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from google import genai
from google.genai import types
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import Client, create_client
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

load_dotenv(override=True) # force reload

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
GOOGLE_CLIENT_ID = "564031025716-h3peufipog1bf83qh2pqciis6ennht7h.apps.googleusercontent.com"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
IS_PRODUCTION = FRONTEND_URL != "http://localhost:5173"

if not all([GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY, JWT_SECRET]):
    raise ValueError(
        "Missing required environment variables: GEMINI_API_KEY, "
        "SUPABASE_URL, SUPABASE_KEY, JWT_SECRET."
    )

MY_DATABASE_SCHEMA = """
CREATE TABLE students (
    student_id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100),
    major VARCHAR(50),
    gpa DECIMAL(3,2)
);

CREATE TABLE enrollments (
    enrollment_id INT PRIMARY KEY,
    student_id VARCHAR(10),
    course_id VARCHAR(10),
    semester VARCHAR(10)
);
"""

BASE_INSTRUCTION = """
You are an expert Data Analyst and Business Intelligence Assistant for ICT Phayao.
You communicate fluently in Thai. You are professional, helpful, and highly detailed.

YOUR GOAL:
You will receive the User's Request and the Real Database Results from the system.
You must analyze the Real Database Results and explain them clearly to the user.

### OUTPUT RULES:
1. Explain the insights thoroughly in Thai. Don't just list numbers; tell a story about what the data means.
2. If the user asks for a chart or graph, output ONLY ONE JSON block wrapped in ```json ... ``` using the EXACT REAL data provided.
3. The JSON MUST match this format:
   ```json
   {
     "type": "chart",
     "chartType": "bar" | "line" | "pie",
     "title": "Chart Title",
     "data": [ {"name": "A", "value": 10}, ... ],
     "xAxisKey": "name",
     "yAxisKey": "value"
   }
   ```
4. If the user explicitly asks for the SQL command, you may output it in a ```sql ... ``` block.
"""

SYSTEM_PROMPT = f"{BASE_INSTRUCTION}\n\n--- Database Schema ---\n{MY_DATABASE_SCHEMA}"

SQL_AGENT_PROMPT = f"""
You are an expert PostgreSQL Database Administrator for ICT Phayao.
Your ONLY job is to write valid PostgreSQL queries based on this schema:
--- Database Schema ---
{MY_DATABASE_SCHEMA}
"""

client = genai.Client(api_key=GEMINI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="ICT Phayao Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(request: Request) -> str:
    token = request.cookies.get("access_token")
    if not token:
        # Fallback to header for testing/swagger (optional, but good practice)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
            
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token does not contain a user id")
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired. Please log in again.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def is_safe_sql(query: str) -> bool:
    q = query.upper().strip()
    if not q.startswith("SELECT"):
        return False
    
    # Block destructive commands
    dangerous_keywords = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "TRUNCATE", "GRANT", "REVOKE", "EXECUTE"]
    for kw in dangerous_keywords:
        if re.search(rf'\b{kw}\b', q):
            return False
            
    # Block access to system/auth tables
    if re.search(r'\bUSERS\b', q) or re.search(r'\bCHAT_HISTORY\b', q):
        return False
        
    return True


# --- Rate Limiting Config ---
RATE_LIMIT_STORE = defaultdict(list)
RATE_LIMIT_MAX_REQUESTS = 5
RATE_LIMIT_WINDOW_SECONDS = 60

def check_rate_limit(request: Request, user_id: str = Depends(get_current_user)) -> str:
    now = time.time()
    # Clean up old timestamps
    RATE_LIMIT_STORE[user_id] = [t for t in RATE_LIMIT_STORE[user_id] if now - t < RATE_LIMIT_WINDOW_SECONDS]
    
    if len(RATE_LIMIT_STORE[user_id]) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait a minute before sending another message.")
        
    RATE_LIMIT_STORE[user_id].append(now)
    return user_id


class AuthRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r".*\S.*")
    password: str = Field(..., min_length=6, max_length=100, pattern=r".*\S.*")


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class PinRequest(BaseModel):
    is_pinned: bool

class GoogleAuthRequest(BaseModel):
    token: str


@app.get("/")
def read_root():
    return {"message": "API is running. Go to /docs to test."}


@app.post("/api/register")
async def register(request: AuthRequest):
    try:
        existing_user = (
            supabase.table("users")
            .select("*")
            .eq("username", request.username)
            .execute()
        )
        if existing_user.data:
            raise HTTPException(status_code=400, detail="Username is already in use")

        supabase.table("users").insert(
            {
                "username": request.username,
                "password_hash": get_password_hash(request.password),
                "tokens_balance": 50
            }
        ).execute()
        return {"message": "Registration successful"}
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Error] Registration failed: {exc}")
        raise HTTPException(status_code=400, detail=f"Database connection or table error: {exc}")


@app.post("/api/login")
async def login(request: AuthRequest, response: Response):
    try:
        user_data = (
            supabase.table("users")
            .select("*")
            .eq("username", request.username)
            .execute()
        )
        if not user_data.data:
            raise HTTPException(status_code=400, detail="Username not found")

        user = user_data.data[0]
        if not verify_password(request.password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="Incorrect password")

        access_token = create_access_token(
            data={"sub": str(user["id"]), "username": user["username"]}
        )
        
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            samesite="none" if IS_PRODUCTION else "lax",
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            secure=IS_PRODUCTION
        )
        
        return {
            "message": "Login successful",
            "username": user["username"],
            "tokens_balance": user.get("tokens_balance", 0),
        }
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Error] Login failed: {exc}")
        raise HTTPException(status_code=400, detail=f"Database connection or table error: {exc}")


@app.post("/api/auth/google")
async def google_login(request: GoogleAuthRequest, response: Response):
    try:
        try:
            idinfo = id_token.verify_oauth2_token(
                request.token, 
                google_requests.Request(), 
                GOOGLE_CLIENT_ID
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Google token")

        email = idinfo.get('email')
        if not email:
            raise HTTPException(status_code=400, detail="Google token does not contain an email")

        username = email

        user_data = (
            supabase.table("users")
            .select("*")
            .eq("username", username)
            .execute()
        )

        if not user_data.data:
            import uuid
            new_pw_hash = get_password_hash(str(uuid.uuid4()))
            
            insert_res = supabase.table("users").insert({
                "username": username,
                "password_hash": new_pw_hash,
                "tokens_balance": 50
            }).execute()
            user = insert_res.data[0]
        else:
            user = user_data.data[0]

        access_token = create_access_token(
            data={"sub": str(user["id"]), "username": user["username"]}
        )
        
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            samesite="none" if IS_PRODUCTION else "lax",
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            secure=IS_PRODUCTION
        )
        
        return {
            "message": "Login successful via Google",
            "username": user["username"],
            "tokens_balance": user.get("tokens_balance", 0),
        }
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[Error] Google Login failed: {exc}")
        raise HTTPException(status_code=400, detail=f"Authentication error: {exc}")


@app.post("/api/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}


@app.get("/api/me")
async def get_me(user_id: str = Depends(get_current_user)):
    try:
        user_data = supabase.table("users").select("username, tokens_balance").eq("id", user_id).execute()
        if not user_data.data:
            raise HTTPException(status_code=404, detail="User not found")
        user = user_data.data[0]
        return {
            "username": user["username"],
            "tokens_balance": user.get("tokens_balance", 0)
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/sessions")
async def get_sessions(user_id: str = Depends(get_current_user)):
    try:
        res = (
            supabase.table("chat_history")
            .select("session_id, message, created_at, is_pinned")
            .eq("user_id", user_id)
            .order("created_at", desc=False)
            .execute()
        )
        sessions_dict = {}
        for row in res.data:
            sid = row.get("session_id")
            if sid and sid not in sessions_dict:
                title = row["message"][:40] + ("..." if len(row["message"]) > 40 else "")
                sessions_dict[sid] = {
                    "id": sid,
                    "title": title,
                    "created_at": row["created_at"],
                    "is_pinned": bool(row.get("is_pinned"))
                }
        
        # Sort sessions: pinned first, then by created_at DESC
        sorted_sessions = sorted(
            sessions_dict.values(),
            key=lambda x: (x["is_pinned"], x["created_at"]),
            reverse=True
        )
        return {"sessions": sorted_sessions}
    except Exception as exc:
        print(f"[Error] Fetch sessions failed: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, user_id: str = Depends(get_current_user)):
    try:
        supabase.table("chat_history").delete().eq("user_id", user_id).eq("session_id", session_id).execute()
        return {"message": "Session deleted"}
    except Exception as exc:
        print(f"[Error] Delete session failed: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

@app.patch("/api/sessions/{session_id}/pin")
async def toggle_pin_session(session_id: str, request: PinRequest, user_id: str = Depends(get_current_user)):
    try:
        supabase.table("chat_history").update({"is_pinned": request.is_pinned}).eq("user_id", user_id).eq("session_id", session_id).execute()
        return {"message": "Session pin updated"}
    except Exception as exc:
        print(f"[Error] Pin session failed: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

@app.get("/api/history")
async def get_history(session_id: str = None, user_id: str = Depends(get_current_user)):
    if not session_id:
        return {"history": []}
    try:
        history_res = (
            supabase.table("chat_history")
            .select("message, reply, created_at")
            .eq("user_id", user_id)
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        past_messages = history_res.data[::-1] if history_res.data else []
        
        formatted = []
        for msg in past_messages:
            formatted.append({"role": "user", "content": msg["message"]})
            formatted.append({"role": "assistant", "content": msg["reply"]})
            
        return {"history": formatted}
    except Exception as exc:
        print(f"[Error] Fetch history failed: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/chat")
async def chat_with_bot(request: ChatRequest, user_id: str = Depends(check_rate_limit)):
    import uuid
    session_id = request.session_id or str(uuid.uuid4())
    try:
        # --- Check Tokens Quota ---
        user_data = supabase.table("users").select("tokens_balance").eq("id", user_id).execute()
        if not user_data.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        tokens_balance = user_data.data[0].get("tokens_balance", 0)
        if tokens_balance <= 0:
            return {"reply": "⚠️ โควต้า Token ของคุณหมดแล้ว (0 Tokens) กรุณาติดต่อผู้ดูแลระบบเพื่อขอเพิ่มเครดิตครับ", "session_id": session_id}

        try:
            history_res = (
                supabase.table("chat_history")
                .select("message, reply")
                .eq("user_id", user_id)
                .eq("session_id", session_id)
                .order("created_at", desc=True)
                .limit(5)
                .execute()
            )
            past_messages = history_res.data[::-1] if history_res.data else []
        except Exception as db_err:
            print(f"[Warning] Cannot fetch chat history: {db_err}")
            past_messages = []

        formatted_history = []
        for msg in past_messages:
            formatted_history.append(types.Content(role="user", parts=[types.Part.from_text(text=msg["message"])]))
            formatted_history.append(types.Content(role="model", parts=[types.Part.from_text(text=msg["reply"])]))

        normalized_msg = request.message.strip().lower()

        print(f"[INFO] Starting chat with {len(past_messages)} history messages...")
        
        # --- PHASE 1: SQL GENERATION ---
        sql_prompt = f"""
USER REQUEST: {request.message}

You are an expert SQL Agent.
Task: Write a valid PostgreSQL query to answer the user's request based on the schema.
If the user asks for a general summary of a large dataset, use AGGREGATION functions (COUNT, AVG, GROUP BY) instead of SELECT *.
Output ONLY the SQL wrapped in ```sql ... ```. No explanations.
If the request is conversational and does NOT need a database query, output exactly: NO_SQL
"""
        chat_sql = client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(system_instruction=SQL_AGENT_PROMPT),
            history=formatted_history
        )
        sql_res = chat_sql.send_message(sql_prompt)
        
        sql_query = None
        db_data = None
        
        sql_match = re.search(r'```(?:sql|postgresql|postgres)?\n(.*?)\n```', sql_res.text, re.IGNORECASE | re.DOTALL)
        if sql_match:
            sql_query = sql_match.group(1).strip()
            if sql_query.endswith(';'):
                sql_query = sql_query[:-1].strip()
            if is_safe_sql(sql_query):
                try:
                    rpc_res = supabase.rpc('exec_sql', {'query': sql_query}).execute()
                    db_data = rpc_res.data
                except Exception as e:
                    db_data = f"Error executing SQL: {e}"
            else:
                db_data = "Error: Unsafe SQL detected. Only SELECT statements on allowed tables are permitted."
        elif "NO_SQL" not in sql_res.text.upper():
            if "SELECT" in sql_res.text.upper():
                # Strip any markdown backticks robustly
                raw_text = re.sub(r'```[a-zA-Z]*\n', '', sql_res.text)
                sql_query = raw_text.replace('```', '').strip()
                if sql_query.endswith(';'):
                    sql_query = sql_query[:-1].strip()
                if is_safe_sql(sql_query):
                    try:
                        rpc_res = supabase.rpc('exec_sql', {'query': sql_query}).execute()
                        db_data = rpc_res.data
                    except Exception as e:
                        db_data = f"Error executing SQL: {e}"
                else:
                    db_data = "Error: Unsafe SQL detected. Only SELECT statements on allowed tables are permitted."

        # Safely stringify db_data
        if isinstance(db_data, list):
            if len(db_data) > 100:
                data_preview = str(db_data[:100]) + f"\n\n[NOTE: ข้อมูลมีทั้งหมด {len(db_data)} แถว แต่ระบบดึงมาแสดงเป็นตัวอย่างแค่ 100 แถวแรกเพื่อไม่ให้รกเกินไป]"
            else:
                data_preview = str(db_data)
        else:
            data_preview = str(db_data)[:4000]

        # --- PHASE 2: SYNTHESIS ---
        synthesis_prompt = f"""
USER REQUEST: {request.message}

DATABASE RESULT:
SQL Executed: {sql_query if sql_query else "None"}
Data Returned: {data_preview if db_data is not None else "No data"}

Task: Provide the final response to the user following your BASE INSTRUCTIONS.
Explain the findings from the Data Returned in Thai.
If there was an Error executing SQL, apologize and explain what might be wrong.
"""
        chat_synthesis = client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
            history=formatted_history
        )
        final_res = chat_synthesis.send_message(synthesis_prompt)
        bot_reply = final_res.text

        # Embed hidden SQL for Developer Mode
        if sql_query and sql_query.upper() != "NO_SQL":
            bot_reply += f"\n\n```sql_hidden\n{sql_query}\n```"

        try:
            supabase.table("chat_history").insert(
                {
                    "user_id": user_id,
                    "session_id": session_id,
                    "message": request.message,
                    "reply": bot_reply,
                }
            ).execute()
        except Exception as db_err:
            print(f"[Warning] Saving to database failed: {db_err}")
            with open("debug_error.log", "a", encoding="utf-8") as f:
                f.write(f"\n[DB Insert Error]: {str(db_err)}\n")

        # Deduct Token
        try:
            supabase.table("users").update({"tokens_balance": tokens_balance - 1}).eq("id", user_id).execute()
        except Exception as err:
            print(f"[Warning] Failed to deduct token: {err}")

        return {"reply": bot_reply, "session_id": session_id}
    except Exception as exc:
        import traceback
        error_msg = str(exc)
        with open("debug_error.log", "a", encoding="utf-8") as f:
            f.write(f"\n[{datetime.now()}] API Error:\n{traceback.format_exc()}\n")
            
        print(f"[Error] Chat API failed: {exc}")
        
        # Check if it's a quota/billing error from Gemini
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            fallback_reply = "⚠️ ขออภัยค่ะ ตอนนี้ระบบ AI คิวเต็มหรือโควต้าการใช้งานหมด (Resource Exhausted) กรุณาตรวจสอบยอดการใช้งาน API หรือลองใหม่อีกครั้งในภายหลังค่ะ"
            return {"reply": fallback_reply, "session_id": session_id}
            
        raise HTTPException(status_code=500, detail=f"Chat Error: {exc}")
