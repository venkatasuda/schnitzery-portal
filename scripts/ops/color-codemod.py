# Release F: hard-coded colours → theme tokens. Only text/border uses and named colour
# constants; filled button backgrounds (white text on a strong fill) are left alone.
# rgba(255,255,255,…) borders/backgrounds vanish in light mode → always tokenised.
import re,glob
import time
def save(p,s):
    for i in range(6):
        try:
            with open(p,'w',encoding='utf-8') as f: f.write(s)
            return
        except OSError:
            time.sleep(1.5)  # mounted Windows drive occasionally refuses a write
    raise
HEX={'#d4a847':'var(--gold-ink)','#27ae60':'var(--success)','#2ecc71':'var(--success)','#ec7063':'var(--danger)','#e74c3c':'var(--danger)',
     '#3498db':'var(--info)','#5dade2':'var(--info)','#e67e22':'var(--warn)','#f39c12':'var(--warn)','#9a8f8f':'var(--gray)','#888':'var(--gray)','#999':'var(--gray)'}
total=0
for p in sorted(glob.glob('src/**/*.tsx',recursive=True)):
    if p.endswith('ui.tsx') or '/kiosk/' in p or 'global-error' in p or p.endswith(('QrScanner.tsx','ScanToCount.tsx')): continue  # fixed dark screens/overlays
    s=open(p,encoding='utf-8').read(); o=s
    for h,v in HEX.items():
        hh=re.escape(h)
        s=re.sub(r'((?:color|borderColor|stroke|fill)\s*[:=]\s*(?:[^,}\n]*\|\|\s*)?)"'+hh+r'"',r'\1"'+v+'"',s,flags=re.I)
        s=re.sub(r'(\bconst [A-Z_]+\s*=\s*)"'+hh+r'"',r'\1"'+v+'"',s,flags=re.I)
        s=re.sub(r'(\b[a-z]+:\s*)"'+hh+r'"(?=\s*[,}])',lambda m: m.group(0) if m.group(1).strip().rstrip(':') in ('background','backgroundColor') else m.group(1)+'"'+v+'"',s,flags=re.I)  # status maps {ok: "#27ae60"}
    s=re.sub(r'((?:border|borderTop|borderBottom|borderLeft|borderRight|outline)\s*:\s*"[^"]*?)rgba\((?:255,\s*255,\s*255|128,\s*128,\s*128),\s*0?\.\d+\)',r'\1var(--border)',s)
    s=re.sub(r'(background(?:Color)?\s*:\s*)"rgba\((?:255,\s*255,\s*255|128,\s*128,\s*128),\s*0?\.\d+\)"',r'\1"var(--surface-2)"',s)
    s=re.sub(r'(borderColor\s*:\s*)"rgba\((?:255,\s*255,\s*255|128,\s*128,\s*128),\s*0?\.\d+\)"',r'\1"var(--border)"',s)
    if s!=o:
        n=len(re.findall(r'#[0-9a-fA-F]{3,6}\b|rgba\(',o))-len(re.findall(r'#[0-9a-fA-F]{3,6}\b|rgba\(',s))
        save(p,s); total+=n; print(n,p)
print('total',total)
