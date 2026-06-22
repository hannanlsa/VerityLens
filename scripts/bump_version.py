import os

base = r'C:\Users\Administrator\IDEProjects\VerityLens'
skip_dirs = ['.git', 'node_modules', 'dist', 'build', '.arts']
skip_files = ['CHANGELOG.md']
count = 0

for root, dirs, files in os.walk(base):
    dirs[:] = [d for d in dirs if d not in skip_dirs]
    for f in files:
        if f in skip_files:
            continue
        fp = os.path.join(root, f)
        try:
            with open(fp, 'r', encoding='utf-8') as fh:
                content = fh.read()
            if '0.6.0' not in content:
                continue
            new_content = content.replace('0.6.0', '0.6.0')
            with open(fp, 'w', encoding='utf-8') as fh:
                fh.write(new_content)
            count += 1
            rel = os.path.relpath(fp, base)
            print('  ' + rel)
        except Exception:
            pass

print('\nUpdated: %d files' % count)