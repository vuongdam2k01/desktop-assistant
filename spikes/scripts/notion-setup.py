#!/usr/bin/env python3
"""Dựng database + seed dữ liệu cho 3 workspace spike. Chạy lại được (báo nếu đã có)."""
import json, sys, pathlib, urllib.request, urllib.error, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENV = dict(l.strip().split('=',1) for l in open(ROOT/'.env.local') if '=' in l and not l.startswith('#'))
FX  = ROOT/'fixtures'/'notion.json'
D   = json.loads(FX.read_text())

def api(tok, method, path, body=None):
    r = urllib.request.Request('https://api.notion.com/v1'+path,
        json.dumps(body).encode() if body is not None else None,
        {'Authorization':'Bearer '+tok,'Notion-Version':'2022-06-28','Content-Type':'application/json'},
        method=method)
    try:
        with urllib.request.urlopen(r, timeout=90) as x: return json.loads(x.read())
    except urllib.error.HTTPError as e:
        d = json.loads(e.read() or b'{}'); d['__err'] = e.code; return d

def die_if(r, what):
    if '__err' in r:
        print(f"   ✗ {what}: HTTP {r['__err']} {r.get('code','')} — {r.get('message','')[:200]}")
        sys.exit(1)
    return r

def mkdb(tok, parent, name, props):
    r = api(tok,'POST','/databases',
            {'parent':{'type':'page_id','page_id':parent},
             'title':[{'type':'text','text':{'content':name}}],
             'properties':props})
    die_if(r, f'tạo database {name}')
    print(f"   ✓ {name}  ({r['id']})")
    return r['id']

def sel(*opts): return {'select':{'options':[{'name':o} for o in opts]}}
TODAY = datetime.date(2026,9,11)
def d(n): return (TODAY + datetime.timedelta(days=n)).isoformat()

STATUS = ('Backlog','Đang làm','Chờ review','Xong')
PRIO   = ('Thấp','Trung bình','Cao','Khẩn')

# ─────────────────────────── A — schema đơn giản
print("\nA · spike-a-simple")
tokA, pA = ENV['NOTION_TOKEN_A'], D['workspaces']['A']['roots'][0]['id']
dbA = mkdb(tokA, pA, 'Tasks', {
    'Name': {'title':{}}, 'Status': sel(*STATUS), 'Due date': {'date':{}}})

SEED_A = [("Viết spec màn hình onboarding",'Đang làm',2),("Fix bug login SSO",'Backlog',0),
          ("Review PR #482",'Chờ review',1),("Chuẩn bị demo cho khách",'Backlog',3),
          ("Cập nhật tài liệu API",'Backlog',7),("Họp sync team FE",'Xong',-1),
          ("Điều tra lỗi timeout staging",'Đang làm',1),("Đổi icon bộ design system",'Backlog',5),
          ("Trả lời email khách hàng Minh",'Backlog',0),("Refactor module payment",'Backlog',10),
          ("Test regression bản 2.3",'Chờ review',2),("Viết changelog",'Backlog',4)]
for n,s,off in SEED_A:
    die_if(api(tokA,'POST','/pages',{'parent':{'database_id':dbA},'properties':{
        'Name':{'title':[{'text':{'content':n}}]},'Status':{'select':{'name':s}},
        'Due date':{'date':{'start':d(off)}}}}), f'seed {n}')
print(f"   ✓ seed {len(SEED_A)} task")

# ─────────────────────────── C — có thứ tự
print("\nC · spike-c-order")
tokC, pC = ENV['NOTION_TOKEN_C'], D['workspaces']['C']['roots'][0]['id']
dbC = mkdb(tokC, pC, 'Tasks', {
    'Name':{'title':{}}, 'Status':sel(*STATUS), 'Due date':{'date':{}},
    'Priority':sel(*PRIO), 'Order':{'number':{'format':'number'}}})

SEED_C = [("Chốt scope sprint 14",'Đang làm','Khẩn',0,1),("Dựng CI cho repo mobile",'Backlog','Cao',3,2),
          ("Phỏng vấn ứng viên BE",'Backlog','Cao',1,3),("Viết test cho module auth",'Backlog','Trung bình',5,4),
          ("Dọn ticket tồn Q2",'Backlog','Thấp',14,5),("Review thiết kế DB mới",'Chờ review','Cao',2,6),
          ("Cập nhật roadmap Q4",'Backlog','Trung bình',8,7),("Fix crash Android 15",'Đang làm','Khẩn',0,8),
          ("Tối ưu query dashboard",'Backlog','Trung bình',6,9),("Viết post-mortem sự cố 09/09",'Backlog','Cao',1,10),
          ("Chuẩn bị slide review tháng",'Backlog','Trung bình',4,11),("Xoá feature flag cũ",'Backlog','Thấp',20,12),
          ("Đàm phán gia hạn license",'Backlog','Cao',9,13)]
for n,s,p,off,o in SEED_C:
    die_if(api(tokC,'POST','/pages',{'parent':{'database_id':dbC},'properties':{
        'Name':{'title':[{'text':{'content':n}}]},'Status':{'select':{'name':s}},
        'Due date':{'date':{'start':d(off)}},'Priority':{'select':{'name':p}},
        'Order':{'number':o}}}), f'seed {n}')
print(f"   ✓ seed {len(SEED_C)} task")

D['workspaces']['A']['databases'] = [{'id':dbA,'title':'Tasks','role':'tasks'}]
D['workspaces']['C']['databases'] = [{'id':dbC,'title':'Tasks','role':'tasks'}]
FX.write_text(json.dumps(D, ensure_ascii=False, indent=2))
print("\nĐã ghi fixtures/notion.json (A, C)")
