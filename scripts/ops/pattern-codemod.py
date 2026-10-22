# Release F codemod 3: recognise common hand-styled controls by their style *shape*
# (not exact text) and replace them with design-system classes. DOM tags only.
import re,glob,time
def save(p,s):
    for i in range(6):
        try:
            with open(p,'w',encoding='utf-8') as f: f.write(s)
            return
        except OSError: time.sleep(1.5)
    raise
def parse(body):
    d={}
    for part in re.split(r',\s*(?=[a-zA-Z]+\s*:)',body.strip().rstrip(',')):
        m=re.match(r'\s*([a-zA-Z]+)\s*:\s*(.+?)\s*$',part,re.S)
        if not m: return None
        d[m.group(1)]=m.group(2)
    return d
MB={'4':'u-mb-1','6':'u-mb-2','8':'u-mb-2','10':'u-mb-3','12':'u-mb-3','14':'u-mb-4','16':'u-mb-4'}
FIELD_OK={'width','padding','borderRadius','background','color','border','fontSize','marginBottom','boxSizing','fontFamily','resize'}
def classify(tag,d):
    keys=set(d); bg=d.get('background','')
    mb=MB.get(d.get('marginBottom','0').strip('"'),'') if 'marginBottom' in d else ''
    if 'marginBottom' in d and not mb: return None
    if tag in('input','select','textarea') and keys<=FIELD_OK and d.get('width')=='"100%"' and bg in('"var(--dark2)"','"var(--dark3)"','"var(--surface-2)"') and 'border' in d:
        return ('form-input '+mb).strip()
    if tag=='button':
        if keys<={'width','padding','borderRadius','background','color','border','fontSize','fontWeight','cursor','marginBottom','marginTop'} and d.get('width')=='"100%"' and bg in('"var(--gold)"','"var(--action)"') :
            return ('btn-gold ui-block '+mb).strip()
        if keys<={'width','padding','borderRadius','background','color','border','fontSize','fontWeight','cursor','marginBottom'} and d.get('width')=='"100%"' and bg in('"#e74c3c"','"#c0392b"'):
            return ('btn-danger ui-block '+mb).strip()
        if keys<={'fontSize','color','background','border','cursor'} and bg=='"none"' and d.get('border')=='"none"' and d.get('fontSize') in('12','13'):
            return 'ui-link-btn'
        if keys<={'background','border','color','fontSize','cursor'} and bg=='"none"' and d.get('border')=='"none"' and d.get('fontSize') in('14','16','18'):
            return 'ui-icon-btn'
        if keys<={'display','width','textAlign','padding','background','border','borderRadius','color','fontSize','marginBottom','cursor'} and d.get('display')=='"block"' and d.get('textAlign')=='"left"' and d.get('width')=='"100%"':
            return 'ui-pick'
    return None
total=0
for p in sorted(glob.glob('src/**/*.tsx',recursive=True)):
    if p.endswith('ui.tsx') or '/kiosk/' in p or p.endswith(('QrScanner.tsx','ScanToCount.tsx','loginForm.tsx','ChangePasswordForm.tsx')): continue
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
        tagtxt=s[m.start():i+1]
        sm=re.search(r'\sstyle=\{\{([^{}]*)\}\}',tagtxt)
        if not sm or re.search(r'\sclassName=\{',tagtxt): continue
        d=parse(sm.group(1))
        if d is None: continue
        cls=classify(m.group(1),d)
        if not cls: continue
        new=tagtxt.replace(sm.group(0),'',1)
        cm=re.search(r'\sclassName="([^"]*)"',new)
        new=new.replace(cm.group(0),f' className="{cm.group(1)} {cls}"',1) if cm else new.replace('<'+m.group(1),f'<{m.group(1)} className="{cls}"',1)
        out.append(s[last:m.start()]); out.append(new); last=i+1; n+=1
    if n:
        out.append(s[last:]); save(p,''.join(out)); total+=n; print(n,p)
print('total',total)
