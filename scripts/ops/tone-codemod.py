# Release F codemod 5: status colours computed in JS (color: x ? "var(--danger)" : …)
# become tone classes; the rest of the style must be fully token-mappable.
import re,glob,time,importlib.util
spec=importlib.util.spec_from_file_location('atomic','scripts/ops/atomic-codemod.py')
src=open('scripts/ops/atomic-codemod.py',encoding='utf-8').read().split('total=0')[0]
ns={}; exec(src,ns); prop,parse,save=ns['prop'],ns['parse'],ns['save']
TONE={'"var(--danger)"':'"tone-danger"','"var(--success)"':'"tone-success"','"var(--warn)"':'"tone-warn"','"var(--info)"':'"tone-info"',
      '"var(--gold-ink)"':'"tone-action"','"var(--gold)"':'"tone-action"','"var(--action)"':'"tone-action"','"var(--gray)"':'"u-muted"','"var(--white)"':'"u-text"','"var(--text)"':'"u-text"'}
def tone_expr(v):
    lits=re.findall(r'"[^"]*"',v)
    if not lits or any(l not in TONE for l in lits): return None
    if not re.fullmatch(r'[\w.?:()!=<>&|\s"\-\[\]\'+0-9]+',v): return None
    return re.sub(r'"[^"]*"',lambda m:TONE[m.group(0)],v)
total=0
for p in sorted(glob.glob('src/**/*.tsx',recursive=True)):
    if p.endswith('ui.tsx') or '/kiosk/' in p or p.endswith(('QrScanner.tsx','ScanToCount.tsx')): continue
    s=open(p,encoding='utf-8').read(); out=[]; last=0; n=0
    for m in re.finditer(r'<([a-z]+)\b',s):
        if m.start()<last: continue
        i=m.end();dep=0
        while i<len(s):
            c=s[i]
            if c=='{':dep+=1
            elif c=='}':dep-=1
            elif c=='>' and dep==0:break
            i+=1
        tag=s[m.start():i+1]
        sm=re.search(r'\sstyle=\{\{([^{}]*)\}\}',tag)
        if not sm or re.search(r'\sclassName=\{',tag): continue
        d=parse(sm.group(1))
        if not d or not any(k=='color' and not v.startswith('"') for k,v in d): continue
        static=[];dyn=None;ok=True
        for k,v in d:
            if k=='color' and not v.startswith('"'):
                dyn=tone_expr(v); ok=dyn is not None
            else:
                c=prop(k,v); ok=c is not None; static.append(c)
            if not ok: break
        if not ok: continue
        cm=re.search(r'\sclassName="([^"]*)"',tag)
        base=' '.join(([cm.group(1)] if cm else [])+static)
        new=tag.replace(sm.group(0),'',1)
        if cm: new=new.replace(cm.group(0),'',1)
        new=new.replace('<'+m.group(1),f'<{m.group(1)} className={{`{base} ${{{dyn}}}`.trim()}}',1)
        out.append(s[last:m.start()]); out.append(new); last=i+1; n+=1
    if n: out.append(s[last:]); save(p,''.join(out)); total+=n
print('total',total)
