# EAP 對話 API sample(整理自官方範例,token 改讀環境變數)
# 用法:
#   export EAP_TOKEN="你的 project token"
#   export EAP_PROJECT_ID="你的 project id"
#   python chat_api_sample.py "你的問題"
# 重要:把最後的完整 chunk 印出來存成 sample_response.json,
#       確認回應裡有沒有引用來源 / 文件 / graph 資訊欄位!

import os
import sys
import json
import requests

API_BASE_URL = "https://cloud.geminidata.com/api/portal/api10"
PROJECT_ID = os.environ.get("EAP_PROJECT_ID", "69eafdf6e2d327002b0c6557")
PROJECT_TOKEN = os.environ.get("EAP_TOKEN", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMmJiY2U0NDQ0ZjZiMDAyYjU3ZWYxOSIsImlzQVBJIjp0cnVlLCJnX3VpZCI6IjY5ZWI5NDFjZTJkMzI3MDAyYjBjYzJhYiIsImdfYWRtaW4iOmZhbHNlLCJnX2RlbW9hZG1pbiI6ZmFsc2UsImdfYWNjb3VudGFkbWluIjpmYWxzZSwiZ190aWQiOiI2OWVhZmRmNmUyZDMyNzAwMmIwYzY1NTc6cHJvZHVjZXIiLCJnX3RpZF9wZXJtaXNzaW9uIjpbIm1ldGE6dXBkYXRlIiwic291cmNlOnJlYWQiLCJzb3VyY2U6dXBkYXRlIiwic291cmNlOmRlbGV0ZSIsImdyYXBoOnJlYWQiLCJncmFwaDp1cGRhdGUiLCJncmFwaDpkZWxldGUiLCJncmFwaDpleHBsb3JlIiwiZ3JhcGg6ZXhwb3J0IiwiY2FudmFzOmFubm90YXRlIiwiY2FudmFzOnBlcnNvbmFsaXplIiwiZGFzaGJvYXJkOnJlYWQiLCJkYXNoYm9hcmQ6dXBkYXRlIiwiY2FudmFzOnNoYXBlIl0sImdfdGlkX3BhcnNlcl9zb3VyY2UiOiJjc3YiLCJnX3RpZF9mZWF0dXJlX2FkZF9vbnMiOlsiYXNzaXN0YW50Il0sImdfYXZhdGFyIjoiMDIiLCJpc3MiOiJodHRwczovL2Nsb3VkLmdlbWluaWRhdGEuY29tIiwic3ViIjoiNjllYjk0MWNlMmQzMjcwMDJiMGNjMmFiIiwiYXVkIjoiaHR0cHM6Ly9jbG91ZC5nZW1pbmlkYXRhLmNvbSIsImV4cCI6NDg2NjcwNTI4MiwiaWF0IjoxNzgxMjUxMzAxLCJuaWNrbmFtZSI6Im1lbWJlcjE0NkB3b3Jrc2hvcC5jb20iLCJlbWFpbCI6Im1lbWJlcjE0NkB3b3Jrc2hvcC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImxhbmciOiJ6aC1UVyJ9.zVCQpcUAb2FDf976gQ_qqSerf2VdiAS8pZsWmY6lhng")


def get_headers():
    return {
        "Authorization": f"Bearer {PROJECT_TOKEN}",
        "x-application-tenant": PROJECT_ID,
    }


def main():
    headers = get_headers()
    question = sys.argv[1] if len(sys.argv) > 1 else "資訊服務業最常被裁罰的勞基法條文是哪些?"

    # 建一個新對話
    new_chat = requests.post(f"{API_BASE_URL}/assistant/chat/create", headers=headers, json={})
    if new_chat.status_code != 200:
        print(f"建立對話失敗: {new_chat.status_code}\n{new_chat.text}")
        return
    chat_id = new_chat.json().get("data", {}).get("insertedId")
    print(f"CHAT_ID: {chat_id}")

    data = {"q": question, "streaming": True}
    print("REQUEST:", data)

    resp = requests.post(
        f"{API_BASE_URL}/assistant/chat/{chat_id}",
        headers=headers, json=data, stream=True,
    )
    if resp.status_code != 200:
        print(f"Error: {resp.status_code}\n{resp.text}")
        return

    last_parsed = None
    for line in resp.iter_lines():
        if not line:
            continue
        decoded = line.decode("utf-8")
        if decoded.startswith("data: "):
            json_str = decoded[len("data: "):].strip()
            if not json_str:
                continue
            try:
                last_parsed = json.loads(json_str)
            except Exception:
                pass

    if last_parsed:
        print("\n===== 最終 chunk 完整內容(看有哪些欄位!)=====")
        print(json.dumps(last_parsed, ensure_ascii=False, indent=2))
        with open("sample_response.json", "w", encoding="utf-8") as f:
            json.dump(last_parsed, f, ensure_ascii=False, indent=2)
        print("\n已存成 sample_response.json,放進 docs/api/ 給 Claude Code 參考")
    else:
        print("沒有取得任何回應 chunk")


if __name__ == "__main__":
    main()
