import re

with open('main.py', 'r') as f:
    content = f.read()

lines = content.split('\n')
for i in range(len(lines)):
    if '@limiter.limit' in lines[i]:
        if (i + 1) < len(lines):
            next_line = lines[i + 1]
            if 'def ' in next_line and 'request' not in next_line:
                parts = next_line.split('(', 1)
                if len(parts) == 2:
                    lines[i + 1] = parts[0] + '(request: Request, ' + parts[1]

with open('main.py', 'w') as f:
    f.write('\n'.join(lines))

with open('main.py', 'r') as f:
    final = f.read().split('\n')
count = 0
for i, line in enumerate(final):
    if '@limiter.limit' in line and (i + 1) < len(final):
        next_line = final[i + 1]
        if 'def ' in next_line and 'request' in next_line:
            count += 1

print(f"Fixed {count} rate-limited endpoints!")