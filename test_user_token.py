import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

import os
token = os.environ.get("GOOGLE_ACCESS_TOKEN", "YOUR_GOOGLE_ACCESS_TOKEN_HERE")

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

print("Testing token against Google OAuth userinfo endpoint...")
try:
    req = urllib.request.Request('https://www.googleapis.com/oauth2/v3/userinfo', headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req) as response:
        print("Userinfo success:", response.read().decode())
except Exception as e:
    print("Userinfo error:", e)

print("\nTesting token against Google Drive API about endpoint...")
try:
    req = urllib.request.Request('https://www.googleapis.com/drive/v3/about?fields=user', headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req) as response:
        print("Drive About success:", response.read().decode())
except Exception as e:
    print("Drive About error:", e)

print("\nTesting token by saving a .mindflow file to Google Drive...")
try:
    file_meta = {
        'name': 'TestMindmap.mindflow',
        'mimeType': 'application/json'
    }
    content = json.dumps({'version': '1.0', 'name': 'Test MindMap', 'tree': {'id': 'root', 'text': 'Test Central Node'}})
    
    boundary = 'foo_bar_baz_mindflow'
    delimiter = "\r\n--" + boundary + "\r\n"
    close_delim = "\r\n--" + boundary + "--"

    body = (
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        json.dumps(file_meta) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        content +
        close_delim
    ).encode('utf-8')

    req = urllib.request.Request(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        data=body,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': f'multipart/related; boundary={boundary}'
        },
        method='POST'
    )
    with urllib.request.urlopen(req) as response:
        res_data = response.read().decode()
        print("Drive File Save SUCCESS! Response:", res_data)
except Exception as e:
    if hasattr(e, 'read'):
        print("Drive File Save ERROR:", e, e.read().decode())
    else:
        print("Drive File Save ERROR:", e)
