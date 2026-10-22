# Release F codemod 4: translate a style object into utility classes when EVERY
# property/value pair has a token-based utility. Anything dynamic or unmapped is left
# alone. DOM tags only; className must be absent or a plain string.
import re,glob,time
def save(p,s):
    for i in range(6):
        try:
            with open(p,'w',encoding='utf-8') as f: f.write(s)
            return
        except OSError: time.sleep(1.5)
    raise
SP={'0':'0','2':'h','3':'h','4':'1','5':'1','6':'2','8':'2','10':'3','12':'3','14':'4','16':'4','18':'5','20':'5','24':'6'}
U={
 ('fontSize','11'):'t-xs',('fontSize','12'):'t-xs',('fontSize','13'):'t-sm',('fontSize','14'):'t-md',('fontSize','15'):'t-lg',('fontSize','16'):'t-lg',('fontSize','18'):'t-xl',('fontSize','20'):'t-xl',('fontSize','22'):'t-2xl',('fontSize','24'):'t-2xl',
 ('fontWeight','400'):'fw-4',('fontWeight','500'):'fw-5',('fontWeight','600'):'fw-6',('fontWeight','700'):'fw-7',
 ('color','"var(--gray)"'):'u-muted',('color','"var(--white)"'):'u-text',('color','"var(--success)"'):'tone-success',('color','"var(--danger)"'):'tone-danger',
 ('color','"var(--warn)"'):'tone-warn',('color','"var(--info)"'):'tone-info',('color','"var(--gold)"'):'tone-action',('color','"var(--gold-ink)"'):'tone-action',('color','"var(--action)"'):'tone-action',
 ('textAlign','"center"'):'u-center',('textAlign','"right"'):'u-right',('textAlign','"left"'):'u-left',
 ('display','"flex"'):'d-flex',('display','"block"'):'d-block',('display','"grid"'):'d-grid',('display','"inline-flex"'):'d-iflex',
 ('flexDirection','"column"'):'f-col',('alignItems','"center"'):'ai-c',('alignItems','"flex-start"'):'ai-s',('alignItems','"flex-end"'):'ai-e',('alignItems','"baseline"'):'ai-b',
 ('justifyContent','"space-between"'):'jc-sb',('justifyContent','"center"'):'jc-c',('justifyContent','"flex-end"'):'jc-e',
 ('flexWrap','"wrap"'):'f-wrap',('flex','1'):'u-flex1',('minWidth','0'):'mw-0',('flexShrink','0'):'fs-0',
 ('whiteSpace','"nowrap"'):'ws-nw',('fontStyle','"italic"'):'fs-i',('lineHeight','1.5'):'lh-15',('lineHeight','1.6'):'lh-16',
 ('textDecoration','"none"'):'td-n',('cursor','"pointer"'):'c-p',('position','"relative"'):'u-relative',
 ('overflow','"hidden"'):'ov-h',('width','"100%"'):'w-full',('borderTop','"1px solid var(--border)"'):'bt-1',('borderBottom','"1px solid var(--border)"'):'bb-1',
}
def prop(k,v):
    if (k,v) in U: return U[(k,v)]
    m={'marginBottom':'mb','marginTop':'mt','gap':'gap','padding':'p','paddingTop':'pt','paddingBottom':'pb','marginLeft':'ml','marginRight':'mr'}.get(k)
    if m and v in SP: return f'{m}-{SP[v]}'
    return None
def parse(body):
    d=[]
    for part in re.split(r',\s*(?=[a-zA-Z]+\s*:)',body.strip().rstrip(',')):
        mm=re.match(r'\s*([a-zA-Z]+)\s*:\s*(.+?)\s*$',part,re.S)
        if not mm: return None
        d.append((mm.group(1),mm.group(2)))
    return d
total=0
for p in sorted(glob.glob('src/**/*.tsx',recursive=True)):
    if p.endswith('ui.tsx') or '/kiosk/' in p or p.endswith(('QrScanner.tsx','ScanToCount.tsx','global-error.tsx')): continue
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
        if not d: continue
        cls=[prop(k,v) for k,v in d]
        if None in cls: continue
        new=tag.replace(sm.group(0),'',1)
        cm=re.search(r'\sclassName="([^"]*)"',new)
        c=' '.join(cls)
        new=new.replace(cm.group(0),f' className="{cm.group(1)} {c}"',1) if cm else new.replace('<'+m.group(1),f'<{m.group(1)} className="{c}"',1)
        out.append(s[last:m.start()]); out.append(new); last=i+1; n+=1
    if n: out.append(s[last:]); save(p,''.join(out)); total+=n
print('total',total)
