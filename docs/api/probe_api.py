# EAP API 偵察腳本 — 跑一次,把所有未知數驗完
# 用法:
#   export EAP_TOKEN="..."
#   export EAP_PROJECT_ID="..."
#   python probe_api.py
# 輸出全部存在 ./probe_output/ 底下,整個資料夾丟給 Claude Code 當串接依據

import os
import json
import requests

BASE = "https://cloud.geminidata.com/api/portal/api10"
TOKEN = os.environ.get("EAP_TOKEN", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMmJiY2U0NDQ0ZjZiMDAyYjU3ZWYxOSIsImlzQVBJIjp0cnVlLCJnX3VpZCI6IjY5ZWI5NDFjZTJkMzI3MDAyYjBjYzJhYiIsImdfYWRtaW4iOmZhbHNlLCJnX2RlbW9hZG1pbiI6ZmFsc2UsImdfYWNjb3VudGFkbWluIjpmYWxzZSwiZ190aWQiOiI2OWVhZmRmNmUyZDMyNzAwMmIwYzY1NTc6cHJvZHVjZXIiLCJnX3RpZF9wZXJtaXNzaW9uIjpbIm1ldGE6dXBkYXRlIiwic291cmNlOnJlYWQiLCJzb3VyY2U6dXBkYXRlIiwic291cmNlOmRlbGV0ZSIsImdyYXBoOnJlYWQiLCJncmFwaDp1cGRhdGUiLCJncmFwaDpkZWxldGUiLCJncmFwaDpleHBsb3JlIiwiZ3JhcGg6ZXhwb3J0IiwiY2FudmFzOmFubm90YXRlIiwiY2FudmFzOnBlcnNvbmFsaXplIiwiZGFzaGJvYXJkOnJlYWQiLCJkYXNoYm9hcmQ6dXBkYXRlIiwiY2FudmFzOnNoYXBlIl0sImdfdGlkX3BhcnNlcl9zb3VyY2UiOiJjc3YiLCJnX3RpZF9mZWF0dXJlX2FkZF9vbnMiOlsiYXNzaXN0YW50Il0sImdfYXZhdGFyIjoiMDIiLCJpc3MiOiJodHRwczovL2Nsb3VkLmdlbWluaWRhdGEuY29tIiwic3ViIjoiNjllYjk0MWNlMmQzMjcwMDJiMGNjMmFiIiwiYXVkIjoiaHR0cHM6Ly9jbG91ZC5nZW1pbmlkYXRhLmNvbSIsImV4cCI6NDg2NjcwNTI4MiwiaWF0IjoxNzgxMjUxMzAxLCJuaWNrbmFtZSI6Im1lbWJlcjE0NkB3b3Jrc2hvcC5jb20iLCJlbWFpbCI6Im1lbWJlcjE0NkB3b3Jrc2hvcC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImxhbmciOiJ6aC1UVyJ9.zVCQpcUAb2FDf976gQ_qqSerf2VdiAS8pZsWmY6lhng")
PROJECT = os.environ.get("EAP_PROJECT_ID", "69eafdf6e2d327002b0c6557")
HEADERS = {"Authorization": f"Bearer {TOKEN}", "x-application-tenant": PROJECT}

OUT = "probe_output"
os.makedirs(OUT, exist_ok=True)


def save(name, data):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        if isinstance(data, (dict, list)):
            json.dump(data, f, ensure_ascii=False, indent=2)
        else:
            f.write(str(data))
    print(f"  ✔ 已存 {path}")


def try_get(label, paths):
    """依序嘗試多個候選路徑,回報哪個能用"""
    for p in paths:
        url = f"{BASE}{p}"
        try:
            r = requests.get(url, headers=HEADERS, timeout=60)
        except Exception as e:
            print(f"  ✘ {p} 連線錯誤: {e}")
            continue
        print(f"  {r.status_code} ← GET {p}")
        if r.status_code == 200:
            try:
                return p, r.json()
            except Exception:
                return p, r.text
    print(f"  ⚠ {label}:所有候選路徑都失敗")
    return None, None


print("=== 1. 建立新對話 ===")
r = requests.post(f"{BASE}/assistant/chat/create", headers=HEADERS, json={})
print(f"  {r.status_code}")
chat_id = r.json().get("data", {}).get("insertedId")
print(f"  CHAT_ID = {chat_id}")

print("\n=== 2. 問一題(streaming),完整記錄所有 chunk ===")
question = "資訊服務業常見的職業災害類型有哪些?過往有無相關裁罰案例?"
all_chunks = []
resp = requests.post(
    f"{BASE}/assistant/chat/{chat_id}",
    headers=HEADERS, json={"q": question, "streaming": True}, stream=True,
)
print(f"  {resp.status_code}")
for line in resp.iter_lines():
    if not line:
        continue
    decoded = line.decode("utf-8")
    if decoded.startswith("data: "):
        s = decoded[len("data: "):].strip()
        if s:
            try:
                all_chunks.append(json.loads(s))
            except Exception:
                pass
save("all_chunks.json", all_chunks)
if all_chunks:
    last = all_chunks[-1]
    save("final_chunk.json", last)
    print(f"  最終 chunk 的欄位: {list(last.keys()) if isinstance(last, dict) else type(last)}")

print("\n=== 3. 取得對話訊息列表(找 message_id)===")
msg_path, messages = try_get("messages", [
    f"/assistant/chat/{chat_id}/messages",
    f"/chat/{chat_id}/messages",
])
if messages:
    save("messages.json", messages)

# 從 messages 或 chunk 裡撈 message id 候選
message_ids = []
def collect_ids(obj, keys=("_id", "messageId", "message_id", "id")):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in keys and isinstance(v, str):
                message_ids.append(v)
            collect_ids(v, keys)
    elif isinstance(obj, list):
        for item in obj:
            collect_ids(item, keys)

collect_ids(messages)
collect_ids(all_chunks[-3:] if len(all_chunks) >= 3 else all_chunks)
message_ids = list(dict.fromkeys(message_ids))  # 去重保序
print(f"  找到的 id 候選: {message_ids[:10]}")

print("\n=== 4. ★ 重點:validation(圖譜 + 文件來源)===")
validation = None
for mid in message_ids[:6]:
    vpath, validation = try_get("validation", [
        f"/assistant/chat/{chat_id}/{mid}/validation",
        f"/chat/{chat_id}/{mid}/validation",
    ])
    if validation:
        print(f"  ★ 成功!message_id={mid}, path={vpath}")
        save("validation.json", validation)
        break
if not validation:
    print("  ⚠ validation 沒打通,把 messages.json 和 all_chunks.json 給 Claude 分析正確的 id/path")

print("\n=== 5. 問題庫(範例問題用)===")
_, qlist = try_get("question list", ["/assistant/chat/question/list", "/chat/question/list"])
if qlist:
    save("question_list.json", qlist)
_, qcat = try_get("question categories", ["/assistant/chat/question/categories", "/chat/question/categories"])
if qcat:
    save("question_categories.json", qcat)

print("\n=== 6. 知識庫文件列表(資料總覽證明素材)===")
_, knowledge = try_get("vector knowledge", ["/import/vector/knowledge", "/assistant/import/vector/knowledge"])
if knowledge:
    save("knowledge_list.json", knowledge)

print("\n完成!把整個 probe_output/ 資料夾放進專案的 docs/api/ 給 Claude Code。")
