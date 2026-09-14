#!/usr/bin/env python3
import time, concurrent.futures, json
from common import get_token, raw_api_call, DATA_DIR

tok = get_token("A")

def ping(i):
    return raw_api_call(tok, "GET", "/users/me", log_category=f"q5_stress_{i}")

print("Sending burst of 60 rapid parallel requests...")
t0 = time.time()
with concurrent.futures.ThreadPoolExecutor(max_workers=30) as ex:
    futs = [ex.submit(ping, i) for i in range(60)]
    res = [f.result() for f in concurrent.futures.as_completed(futs)]
t1 = time.time()

codes = [r[0] for r in res]
print(f"60 req in {t1-t0:.2f}s: 200={codes.count(200)}, 429={codes.count(429)}, other={[c for c in codes if c not in (200, 429)]}")

if codes.count(429) > 0:
    for st, hdrs, bdy in res:
        if st == 429:
            print("429 headers:", {k: v for k, v in hdrs.items() if 'retry' in k.lower() or 'rate' in k.lower() or 'cf' in k.lower()})
            print("429 body:", bdy)
            break
else:
    print("No 429 yet. Trying 100 requests...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as ex:
        futs = [ex.submit(ping, i) for i in range(100)]
        res2 = [f.result() for f in concurrent.futures.as_completed(futs)]
    codes2 = [r[0] for r in res2]
    print(f"100 req: 200={codes2.count(200)}, 429={codes2.count(429)}")
    for st, hdrs, bdy in res2:
        if st == 429:
            print("429 headers:", {k: v for k, v in hdrs.items() if 'retry' in k.lower() or 'rate' in k.lower() or 'cf' in k.lower()})
            print("429 body:", bdy)
            break
