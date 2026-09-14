#!/usr/bin/env python3
import json, sys, pathlib, urllib.request, urllib.error, datetime
ROOT = pathlib.Path(__file__).resolve().parent.parent
ENV = dict(l.strip().split('=',1) for l in open(ROOT/'.env.local') if '=' in l and not l.startswith('#'))
FX = ROOT/'fixtures'/'notion.json'; D = json.loads(FX.read_text())
tok = ENV['NOTION_TOKEN_B']; parent = D['workspaces']['B']['roots'][0]['id']

def api(m,p,b=None):
    r=urllib.request.Request('https://api.notion.com/v1'+p, json.dumps(b).encode() if b is not None else None,
        {'Authorization':'Bearer '+tok,'Notion-Version':'2022-06-28','Content-Type':'application/json'}, method=m)
    try:
        with urllib.request.urlopen(r,timeout=90) as x: return json.loads(x.read())
    except urllib.error.HTTPError as e:
        d=json.loads(e.read() or b'{}'); d['__err']=e.code; return d
def ck(r,w):
    if '__err' in r: print(f"   ✗ {w}: HTTP {r['__err']} {r.get('code','')} — {r.get('message','')[:220]}"); sys.exit(1)
    return r
def sel(*o): return {'select':{'options':[{'name':x} for x in o]}}
T=datetime.date(2026,9,11)
def dd(n): return (T+datetime.timedelta(days=n)).isoformat()

# người dùng thật để gán Assignee
users=[u for u in api('GET','/users?page_size=20').get('results',[]) if u.get('type')=='person']
print(f"   người thật trong workspace: {len(users)}")

# 1 · Projects
proj = ck(api('POST','/databases',{'parent':{'type':'page_id','page_id':parent},
    'title':[{'type':'text','text':{'content':'Projects'}}],
    'properties':{'Name':{'title':{}},'Status':sel('Đang chạy','Tạm dừng','Hoàn thành')}}),'tạo Projects')['id']
print(f"   ✓ Projects  ({proj})")

PROJECTS=[('Desktop Assistant','Đang chạy'),('Website công ty','Đang chạy'),
          ('Migrate hạ tầng','Tạm dừng'),('App mobile v2','Đang chạy')]
pids={}
for n,s in PROJECTS:
    r=ck(api('POST','/pages',{'parent':{'database_id':proj},'properties':{
        'Name':{'title':[{'text':{'content':n}}]},'Status':{'select':{'name':s}}}}),f'seed {n}')
    pids[n]=r['id']
print(f"   ✓ seed {len(PROJECTS)} project")

# 2 · Tasks có Relation
tasks = ck(api('POST','/databases',{'parent':{'type':'page_id','page_id':parent},
    'title':[{'type':'text','text':{'content':'Tasks'}}],
    'properties':{
        'Name':{'title':{}},
        'Status':sel('Backlog','Đang làm','Chờ review','Xong'),
        'Due date':{'date':{}},
        'Assignee':{'people':{}},
        'Tags':{'multi_select':{'options':[{'name':x} for x in ('frontend','backend','design','ops','urgent')]}},
        'Project':{'relation':{'database_id':proj,'single_property':{}}}}}),'tạo Tasks')['id']
print(f"   ✓ Tasks  ({tasks})")

# 3 · thêm Rollup + Formula (cần relation đã tồn tại)
r = api('PATCH',f'/databases/{tasks}',{'properties':{
    'Project status':{'rollup':{'relation_property_name':'Project',
                                'rollup_property_name':'Status','function':'show_original'}},
    'Days left':{'formula':{'expression':'dateBetween(prop("Due date"), now(), "days")'}}}})
if '__err' in r:
    print(f"   ✗ rollup/formula: {r.get('code')} — {r.get('message','')[:220]}")
else:
    got=[k for k in r['properties'] if k in ('Project status','Days left')]
    print(f"   ✓ thêm {', '.join(got)}")

SEED=[("Thiết kế state machine cho pet",'Đang làm',2,'Desktop Assistant',['design']),
      ("Dựng connector Notion",'Đang làm',1,'Desktop Assistant',['backend']),
      ("Viết hook phê duyệt",'Backlog',5,'Desktop Assistant',['backend','urgent']),
      ("Landing page bản tiếng Anh",'Chờ review',3,'Website công ty',['frontend']),
      ("Tối ưu SEO trang chủ",'Backlog',12,'Website công ty',['frontend']),
      ("Chuyển DB sang Postgres 17",'Backlog',20,'Migrate hạ tầng',['ops']),
      ("Viết runbook rollback",'Backlog',8,'Migrate hạ tầng',['ops','urgent']),
      ("Màn hình đăng nhập mobile",'Đang làm',0,'App mobile v2',['frontend','design']),
      ("API đồng bộ offline",'Backlog',6,'App mobile v2',['backend']),
      ("Fix crash khi mất mạng",'Chờ review',1,'App mobile v2',['urgent']),
      ("Họp review kiến trúc",'Xong',-2,'Desktop Assistant',[]),
      ("Chuẩn bị môi trường staging",'Backlog',4,'Migrate hạ tầng',['ops']),
      ("Viết test e2e cho checkout",'Backlog',7,'Website công ty',['frontend','backend']),
      ("Đánh giá thư viện animation",'Backlog',9,'Desktop Assistant',['design'])]
for i,(n,s,off,pj,tags) in enumerate(SEED):
    props={'Name':{'title':[{'text':{'content':n}}]},'Status':{'select':{'name':s}},
           'Due date':{'date':{'start':dd(off)}},'Project':{'relation':[{'id':pids[pj]}]},
           'Tags':{'multi_select':[{'name':t} for t in tags]}}
    if users: props['Assignee']={'people':[{'id':users[i%len(users)]['id']}]}
    ck(api('POST','/pages',{'parent':{'database_id':tasks},'properties':props}),f'seed {n}')
print(f"   ✓ seed {len(SEED)} task")

D['workspaces']['B']['databases']=[{'id':proj,'title':'Projects','role':'projects'},
                                   {'id':tasks,'title':'Tasks','role':'tasks'}]
FX.write_text(json.dumps(D,ensure_ascii=False,indent=2))
print("\nĐã ghi fixtures/notion.json (B)")
