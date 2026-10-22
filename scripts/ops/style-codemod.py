# Release F codemod: replace the most repeated inline style objects with design-system
# utility classes (globals.css "utilities"). Only touches tags whose className is absent
# or a plain string. Re-runnable; prints per-file counts.
import re,glob,sys
import time
def save(p,s):
    for i in range(6):
        try:
            with open(p,'w',encoding='utf-8') as f: f.write(s)
            return
        except OSError:
            time.sleep(1.5)  # mounted Windows drive occasionally refuses a write
    raise
MAP={
 '{ fontSize: 12, color: "var(--gray)" }':'ui-muted', '{ color: "var(--gray)", fontSize: 12 }':'ui-muted',
 '{ fontSize: 12, color: "var(--gray)", marginTop: 2 }':'ui-meta', '{ fontSize: 12, color: "var(--gray)", marginTop: 8 }':'ui-note',
 '{ fontSize: 12, color: "var(--gray)", marginBottom: 12 }':'ui-sub', '{ fontSize: 13, color: "var(--gray)" }':'ui-muted-md',
 '{ color: "var(--gray)", fontSize: 13, marginBottom: 16 }':'ui-lede', '{ fontSize: 13, color: "var(--white)" }':'ui-body',
 '{ fontSize: 14, fontWeight: 600, color: "var(--white)" }':'ui-strong', '{ fontSize: 14, fontWeight: 600 }':'ui-strong',
 '{ color: "var(--white)", fontWeight: 600 }':'ui-strong-inline',
 '{ fontSize: 14, fontWeight: 700, marginBottom: 4 }':'ui-title', '{ fontSize: 14, fontWeight: 700, marginBottom: 10 }':'ui-title spaced',
 '{ flex: 1 }':'u-flex1', '{ flex: 1, minWidth: 0 }':'u-grow',
 '{ display: "flex", alignItems: "center", gap: 8 }':'u-row', '{ display: "flex", alignItems: "center", gap: 10 }':'u-row',
 '{ display: "flex", gap: 8 }':'u-hstack', '{ display: "flex", flexDirection: "column", gap: 8 }':'u-stack', '{ display: "flex", flexDirection: "column", gap: 6 }':'u-stack tight',
 '{ display: "flex", justifyContent: "space-between", alignItems: "center" }':'u-between',
 '{ color: "var(--gray)" }':'u-muted', '{ color: "var(--white)" }':'u-text', '{ textAlign: "right" }':'u-right', '{ margin: 0 }':'u-m0',
 '{ textAlign: "center", fontWeight: 600 }':'u-center u-semibold',
 '{ marginBottom: 6 }':'u-mb-2', '{ marginBottom: 8 }':'u-mb-2', '{ marginBottom: 14 }':'u-mb-4', '{ position: "relative" }':'u-relative',
 '{ verticalAlign: "-2px", marginRight: 6 }':'u-icon-inline', '{ verticalAlign: "-2px", marginRight: 5 }':'u-icon-inline',
 '{ textAlign: "center", color: "var(--gray)", padding: 30, maxWidth: 500, margin: "40px auto" }':'ui-denied',
 '{ textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto", padding: 30 }':'ui-denied',
 '{ textAlign: "center", color: "var(--gray)", padding: 24, fontSize: 13 }':'ui-empty-msg', '{ textAlign: "center", color: "var(--gray)", padding: 30 }':'ui-empty-msg',
 '{ ...card, textAlign: "center", color: "var(--gray)", padding: 30 }':'card ui-empty-msg', '{ ...card, marginBottom: 14 }':'card',
 '{ ...card, textAlign: "center", color: "var(--gray)", maxWidth: 500, margin: "40px auto" }':'card ui-denied',
 '{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-body)", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }':'page-title u-row',
 '{ display: "block", textAlign: "center", marginTop: 18, color: "var(--gold)", fontSize: 13, textDecoration: "none" }':'ui-back-link',
}
tag=re.compile(r'<([a-z][\w.]*)((?:[^<>{}]|\{(?:[^{}]|\{[^{}]*\})*\})*?)\sstyle=\{\{([^{}]*)\}\}((?:[^<>{}]|\{(?:[^{}]|\{[^{}]*\})*\})*?)(/?)>')
total=0
for p in sorted(glob.glob('src/**/*.tsx',recursive=True)):
    if p.endswith('ui.tsx'): continue
    s=open(p,encoding='utf-8').read(); n=0
    def sub(m):
        global n
        name,before,body,after,selfclose=m.groups()
        key='{ '+body.strip()+' }'
        cls=MAP.get(key)
        if not cls: return m.group(0)
        attrs=before+after
        cm=re.search(r'\sclassName="([^"]*)"',attrs)
        if re.search(r'\sclassName=\{',attrs): return m.group(0)
        if cm:
            new_attrs=attrs.replace(cm.group(0),f' className="{cm.group(1)} {cls}"',1)
        else:
            new_attrs=f' className="{cls}"'+attrs
        n+=1
        return f'<{name}{new_attrs}{selfclose}>'
    s2=tag.sub(sub,s)
    if n: save(p,s2); total+=n; print(n,p)
print('total',total)
