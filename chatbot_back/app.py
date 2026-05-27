import json
import re

import pandas as pd
import plotly.express as px
import requests
import streamlit as st

API_URL = "http://127.0.0.1:8000"

st.set_page_config(page_title="ICT Assistant", layout="wide", initial_sidebar_state="expanded")

st.markdown(
    """
<style>
    header {visibility: hidden;}
    footer {visibility: hidden;}
    [data-testid="stSidebar"] { background-color: #e5e5e5; }
    [data-testid="stSidebar"] button {
        width: 100%;
        border-radius: 12px;
        background-color: #a3a3a3 !important;
        color: white !important;
        border: none !important;
        padding: 12px 15px;
        font-weight: bold;
        margin-bottom: 5px;
    }
    [data-testid="stSidebar"] button:hover { background-color: #8c8c8c !important; }
    .stMainBlockContainer button {
        height: 120px !important;
        border-radius: 20px !important;
        background-color: #dcdcdc !important;
        color: #333 !important;
        font-size: 18px !important;
        font-weight: bold !important;
        border: none !important;
        transition: all 0.3s ease;
        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        white-space: pre-wrap;
    }
    .stMainBlockContainer button:hover {
        background-color: #c0c0c0 !important;
        transform: translateY(-5px);
        box-shadow: 0 8px 12px rgba(0,0,0,0.1);
    }
    .big-title {
        text-align: center;
        font-size: 3.5rem;
        font-weight: 900;
        color: #1a1a1a;
        margin-top: 10vh;
        margin-bottom: 2rem;
    }
</style>
""",
    unsafe_allow_html=True,
)


def clean_code(code_string: str) -> str:
    code_string = re.sub(r"```[a-zA-Z]*", "", code_string)
    return code_string.replace("```", "").strip()


def extract_json_block(content: str):
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
    candidate = match.group(1) if match else content.strip()
    if not candidate.startswith("{"):
        return None
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        return None
    if parsed.get("type") != "chart":
        return None
    return parsed


def render_chart(chart_config: dict):
    data = chart_config.get("data", [])
    x_key = chart_config.get("xAxisKey", "name")
    y_key = chart_config.get("yAxisKey", "value")
    chart_type = chart_config.get("chartType", "bar")
    title = chart_config.get("title", "")

    df = pd.DataFrame(data)
    if df.empty or x_key not in df.columns or y_key not in df.columns:
        st.warning("Chart data is missing required fields.")
        st.json(chart_config)
        return

    if chart_type == "line":
        fig = px.line(df, x=x_key, y=y_key, title=title)
    elif chart_type == "pie":
        fig = px.pie(df, names=x_key, values=y_key, title=title)
    else:
        fig = px.bar(df, x=x_key, y=y_key, title=title)

    st.subheader("Data Visualization")
    st.plotly_chart(fig, use_container_width=True)


def execute_and_render_chart(code_string: str):
    try:
        code_string = clean_code(code_string).replace("fig.show()", "")

        if "SELECT " in code_string.upper() and "FROM " in code_string.upper():
            st.subheader("Generated SQL")
            st.code(code_string, language="sql")
            return

        import builtins
        safe_builtins = {k: v for k, v in builtins.__dict__.items() if k not in ['__import__', 'eval', 'exec', 'open', 'compile', 'globals', 'locals']}
        
        exec_globals = {"__builtins__": safe_builtins}
        local_vars = {"pd": pd, "px": px}
        exec(code_string, exec_globals, local_vars)

        if "fig" in local_vars:
            st.subheader("Data Visualization")
            st.plotly_chart(local_vars["fig"], use_container_width=True)
            with st.expander("See Python Code"):
                st.code(code_string, language="python")
        else:
            st.warning("Code ran but no 'fig' object found.")
            st.code(code_string, language="python")
    except Exception as exc:
        st.error(f"Execution error: The generated code encountered an issue. (Details hidden for security)")
        st.code(code_string, language="python")


def render_response(content: str):
    raw_part, _, summary_part = content.partition("---SUMMARY---")
    chart_config = extract_json_block(raw_part)

    if chart_config:
        render_chart(chart_config)
    elif raw_part.strip():
        execute_and_render_chart(raw_part)

    if summary_part.strip():
        st.info(summary_part.strip())


def login(username: str, password: str):
    response = requests.post(
        f"{API_URL}/api/login",
        json={"username": username, "password": password},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def register(username: str, password: str):
    response = requests.post(
        f"{API_URL}/api/register",
        json={"username": username, "password": password},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


if "messages" not in st.session_state:
    st.session_state["messages"] = []
if "auto_prompt" not in st.session_state:
    st.session_state["auto_prompt"] = None
if "token" not in st.session_state:
    st.session_state["token"] = None
if "username" not in st.session_state:
    st.session_state["username"] = None

with st.sidebar:
    st.markdown("### ICT Assistant")

    if st.session_state["token"]:
        st.caption(f"Signed in as {st.session_state['username']}")
        if st.button("New chat"):
            st.session_state["messages"] = []
            st.rerun()
        if st.button("Sign out"):
            st.session_state["token"] = None
            st.session_state["username"] = None
            st.session_state["messages"] = []
            st.rerun()

        st.text_input("search", placeholder="Search...", label_visibility="collapsed")
        st.markdown("<br><b>chat</b>", unsafe_allow_html=True)
        st.button("Chat history 1", key="hist1")
        st.button("Chat history 2", key="hist2")
        st.button("Chat history 3", key="hist3")
    else:
        st.caption("Please sign in to start chatting.")

if not st.session_state["token"]:
    st.title("ICT Assistant")
    auth_tab, register_tab = st.tabs(["Sign in", "Register"])

    with auth_tab:
        with st.form("login_form"):
            username = st.text_input("Username")
            password = st.text_input("Password", type="password")
            submitted = st.form_submit_button("Sign in")
        if submitted:
            try:
                data = login(username, password)
                st.session_state["token"] = data["access_token"]
                st.session_state["username"] = data["username"]
                st.rerun()
            except requests.HTTPError as exc:
                st.error(exc.response.text)
            except requests.RequestException:
                st.error("Could not connect to the FastAPI server.")

    with register_tab:
        with st.form("register_form"):
            new_username = st.text_input("New username")
            new_password = st.text_input("New password", type="password")
            register_submitted = st.form_submit_button("Create account")
        if register_submitted:
            try:
                register(new_username, new_password)
                st.success("Registration successful. Please sign in.")
            except requests.HTTPError as exc:
                st.error(exc.response.text)
            except requests.RequestException:
                st.error("Could not connect to the FastAPI server.")

    st.stop()

if not st.session_state["messages"]:
    st.markdown("<div class='big-title'>Ask me anything...</div>", unsafe_allow_html=True)
    st.markdown("<br><br>", unsafe_allow_html=True)

    col1, col2, col3 = st.columns(3, gap="large")
    with col1:
        if st.button("Show student count\nby major"):
            st.session_state["auto_prompt"] = "Show student count by major as a bar chart"
    with col2:
        if st.button("Show average GPA\nby year"):
            st.session_state["auto_prompt"] = "Show average GPA by year as a line chart"
    with col3:
        if st.button("Summary report\nfor all data"):
            st.session_state["auto_prompt"] = "Create a summary report for all data"
else:
    for message in st.session_state["messages"]:
        with st.chat_message(message["role"]):
            if message["role"] == "assistant":
                render_response(message["content"])
            else:
                st.markdown(message["content"])

user_input = st.chat_input("Type your question here...")
prompt = user_input or st.session_state["auto_prompt"]

if prompt:
    st.session_state["auto_prompt"] = None
    st.session_state["messages"].append({"role": "user", "content": prompt})

    if user_input:
        with st.chat_message("user"):
            st.markdown(prompt)
    else:
        st.rerun()

    with st.chat_message("assistant"):
        with st.spinner("Analyzing..."):
            try:
                response = requests.post(
                    f"{API_URL}/api/chat",
                    json={"message": prompt},
                    headers={"Authorization": f"Bearer {st.session_state['token']}"},
                    timeout=60,
                )
                response.raise_for_status()

                full_response = response.json()["reply"]
                render_response(full_response)
                st.session_state["messages"].append(
                    {"role": "assistant", "content": full_response}
                )
            except requests.exceptions.ConnectionError:
                st.error("Could not connect to the FastAPI server.")
            except requests.HTTPError as exc:
                if exc.response.status_code == 401:
                    st.session_state["token"] = None
                    st.session_state["username"] = None
                    st.error("Session expired. Please sign in again.")
                else:
                    st.error(exc.response.text)
            except Exception as exc:
                st.error(f"API error: {exc}")
