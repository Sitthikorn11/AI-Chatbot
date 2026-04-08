import os
import streamlit as st
from dotenv import load_dotenv
from google import genai
from google.genai import types
import pandas as pd
import plotly.express as px
import re

# ******************************************************************
# 1. การตั้งค่าหน้าเว็บ Streamlit
# ******************************************************************
st.set_page_config(page_title="Gemini SQL & Report Generator", layout="wide")

# 2. โหลด Environment Variables
load_dotenv()
api_key = os.getenv('GEMINI_API_KEY')

if not api_key:
    st.error("❌ Error: API key not found. Please set GEMINI_API_KEY in your .env file.")
    st.stop()

# 3. สร้าง Client
@st.cache_resource
def get_gemini_client():
    return genai.Client(api_key=api_key)

client = get_gemini_client()

# เลือกโมเดล
MODEL_NAME = "gemini-3-flash-preview" 

st.title("💾 AI Data Assistant (SQL & Charts)")
st.caption(f"Powered by Google's {MODEL_NAME}")

st.subheader("⚙️ 1. Upload Database Schema")

# ******************************************************************
# 4. System Prompt (แก้ใหม่: บังคับให้สร้าง DF เอง)
# ******************************************************************
BASE_INSTRUCTION = """
You are an expert SQL, Data Visualization, and Business Intelligence assistant.

YOUR GOAL:
Analyze the database schema provided and generate code based on the user request.

### OUTPUT RULES (STRICTLY FOLLOW):

1. **DEFAULT BEHAVIOR (Code Only)**:
   - Output **ONLY THE CODE**. NO explanations.
   - **SQL**: Output raw SQL query.
   - **Python/Chart**: 
     - Output raw Python code using `plotly.express`.
     - **CRITICAL**: You MUST define the `df` (pandas DataFrame) with **mock data** inside the code yourself. 
     - The mock data columns MUST match the columns you use in `px.line`, `px.bar`, etc.
     - Example:
       ```python
       import pandas as pd
       import plotly.express as px
       # Create Mock Data matching the schema logic
       data = {'order_date': ['2024-01', '2024-02'], 'sales': [100, 200]}
       df = pd.DataFrame(data)
       fig = px.line(df, x='order_date', y='sales')
       ```
     - Do NOT use `fig.show()`.

2. **REPORT BEHAVIOR (Only if requested)**:
   - **IF AND ONLY IF** the user asks for "report", "summary", or "insight":
   - First, output the Code.
   - Then, append separator: `---SUMMARY---`
   - Then, provide a [REPORT_SECTION] in **Thai Language**.

--- Database Schema (FROM UPLOADED FILE) ---
"""

uploaded_file = st.file_uploader(
    "Upload Schema file (.txt, .sql, .md)", 
    type=['txt', 'sql', 'csv', 'md']
)

schema_content = ""
if uploaded_file is not None:
    try:
        schema_content = uploaded_file.read().decode("utf-8")
        st.success(f"✅ Loaded: **{uploaded_file.name}**")
        with st.expander("📄 View Schema Context"):
            st.code(schema_content, language='sql')
    except Exception as e:
        st.error(f"Error reading file: {e}")
else:
    st.info("ℹ️ Please upload a file containing your database schema to start.")

final_system_instruction = BASE_INSTRUCTION + "\n" + schema_content

generation_config = types.GenerateContentConfig(
    temperature=0.1, 
    max_output_tokens=4096,
    top_p=0.95,
    system_instruction=final_system_instruction,
)

# ******************************************************************
# 5. ฟังก์ชันจัดการ Code (แก้ใหม่: ตัด Mock Data เก่าทิ้ง)
# ******************************************************************

def clean_code(code_string):
    code_string = re.sub(r'```[a-zA-Z]*', '', code_string) 
    code_string = code_string.replace('```', '')
    return code_string.strip()

def execute_and_render_chart(code_string):
    try:
        code_string = clean_code(code_string)
        
        # 1. ตัดคำสั่ง fig.show() ทิ้ง (ป้องกันเด้ง Tab ใหม่)
        code_string = code_string.replace("fig.show()", "") 
        
        # 2. Smart Filter: แยก Python / SQL
        if "import plotly" in code_string or "px." in code_string or "pd.DataFrame" in code_string:
            # ตัดส่วนที่เป็น SQL ด้านบนทิ้ง (หาจุดเริ่ม Python)
            if "import pandas" in code_string:
                start_index = code_string.find("import pandas")
                code_string = code_string[start_index:]
            elif "import plotly" in code_string:
                start_index = code_string.find("import plotly")
                code_string = code_string[start_index:]
        
        elif "SELECT " in code_string.upper() and "FROM " in code_string.upper():
            st.subheader("🔍 Generated SQL")
            st.code(code_string, language='sql')
            return 

        # 3. รัน Python Code
        # (เราลบ Mock Data แบบ Hardcode ทิ้งแล้ว เพราะ AI จะสร้างมาให้เองใน code_string)
        local_vars = {'pd': pd, 'px': px}
        exec(code_string, {}, local_vars)
        
        # 4. แสดงผลกราฟ
        if 'fig' in local_vars:
            st.subheader("📊 Data Visualization")
            st.plotly_chart(local_vars['fig'], use_container_width=True)
            with st.expander("See Python Code"):
                st.code(code_string, language='python')
        else:
            st.warning("⚠️ Code ran but no 'fig' object found.")
            st.code(code_string, language='python')
            
    except Exception as e:
        st.error(f"🚫 Execution Error: {e}")
        st.error("สาเหตุ: โค้ดที่ AI สร้างอาจมีปัญหา หรือชื่อคอลัมน์ไม่ตรงกับข้อมูลสมมติ")
        st.code(code_string, language='python')

# ******************************************************************
# 6. Chat Logic
# ******************************************************************

st.divider()

if "messages" not in st.session_state:
    st.session_state["messages"] = []

for message in st.session_state["messages"]:
    with st.chat_message(message["role"]):
        content = message["content"]
        if message["role"] == "assistant":
            if "---SUMMARY---" in content:
                parts = content.split("---SUMMARY---")
                raw_code = parts[0]
                summary_part = " ".join(parts[1:]).strip()
            else:
                raw_code = content
                summary_part = ""
            
            if raw_code.strip():
                execute_and_render_chart(raw_code)
            if summary_part:
                st.info(summary_part)
        else:
            st.markdown(content)

if uploaded_file is not None:
    if prompt := st.chat_input("พิมพ์คำสั่งที่นี่..."):
        
        st.session_state["messages"].append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        contents = []
        for message in st.session_state["messages"]:
            role = "model" if message["role"] == "assistant" else "user"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=message["content"])])
            )

        with st.chat_message("assistant"):
            with st.spinner(f"🤖 {MODEL_NAME} กำลังคิด..."):
                try:
                    response = client.models.generate_content(
                        model=MODEL_NAME, 
                        contents=contents,
                        config=generation_config
                    )
                    
                    full_response = response.text.strip()
                    
                    if "---SUMMARY---" in full_response:
                        parts = full_response.split("---SUMMARY---")
                        raw_code_part = parts[0]
                        summary_part = " ".join(parts[1:]).strip() 
                    else:
                        raw_code_part = full_response
                        summary_part = ""

                    if raw_code_part.strip():
                        execute_and_render_chart(raw_code_part)
                    
                    if summary_part:
                        st.markdown("---")
                        st.subheader("📝 Report Summary")
                        st.info(summary_part)
                    
                    st.session_state["messages"].append({"role": "assistant", "content": full_response})

                except Exception as e:
                    st.error(f"Error: {e}")