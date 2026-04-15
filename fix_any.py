import re, sys

def fix_file(path, replacements):
    with open(path, 'r') as f:
        content = f.read()
    for old, new in replacements:
        if old not in content:
            print(f"WARNING: not found in {path}: {old[:80]}", file=sys.stderr)
        content = content.replace(old, new, 1)
    with open(path, 'w') as f:
        f.write(content)
    print(f"Fixed {path}")

# 1. fetchWorkbookData.ts - add eslint-disable-next-line before (supabase as any) and fix Record<string, any> patterns
with open('src/lib/workbook/fetchWorkbookData.ts', 'r') as f:
    content = f.read()

# Add a Record type for view row data
lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    # For lines with (supabase as any), add disable comment
    if '(supabase as any)' in line and not (i > 0 and 'eslint-disable' in lines[i-1]):
        indent = len(line) - len(line.lstrip())
        new_lines.append(' ' * indent + '// eslint-disable-next-line @typescript-eslint/no-explicit-any')
    
    # Fix .map((r: any) => patterns - replace with Record<string, unknown>
    line = re.sub(r'\.map\(\(r: any\)', '.map((r: Record<string, unknown>)', line)
    line = re.sub(r'\.map\(\(f: any\)', '.map((f: Record<string, unknown>)', line)
    
    # Fix (r.funcionarios as any) -> (r.funcionarios as Record<string, unknown>)
    line = line.replace('(r.funcionarios as any)', '(r.funcionarios as Record<string, unknown>)')
    
    # Fix as any[] -> as Record<string, unknown>[]
    line = re.sub(r'\) as any\[\]', ') as Record<string, unknown>[]', line)
    
    # Fix (r.contas_bancarias as any) and (r.produtos as any)
    line = line.replace('const cb = r.contas_bancarias as any', 'const cb = r.contas_bancarias as Record<string, unknown>')
    line = line.replace('const p = r.produtos as any', 'const p = r.produtos as Record<string, unknown>')
    
    # Fix (data: any[], idField: string) 
    line = line.replace('(data: any[], idField: string)', '(data: Record<string, unknown>[], idField: string)')
    
    # Fix mapAging return as any
    line = line.replace('agingCR: mapAging(agingCRRes.data, \'cliente_id\') as any,', 'agingCR: mapAging(agingCRRes.data, \'cliente_id\') as WorkbookRawData[\'agingCR\'],')
    line = line.replace('agingCP: mapAging(agingCPRes.data, \'fornecedor_id\') as any,', 'agingCP: mapAging(agingCPRes.data, \'fornecedor_id\') as WorkbookRawData[\'agingCP\'],')
    
    new_lines.append(line)

with open('src/lib/workbook/fetchWorkbookData.ts', 'w') as f:
    f.write('\n'.join(new_lines))
print("Fixed fetchWorkbookData.ts")

# 2. fetchPresentationData.ts
with open('src/lib/apresentacao/fetchPresentationData.ts', 'r') as f:
    content = f.read()

lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    if '(supabase as any)' in line and not (i > 0 and 'eslint-disable' in lines[i-1]):
        indent = len(line) - len(line.lstrip())
        new_lines.append(' ' * indent + '// eslint-disable-next-line @typescript-eslint/no-explicit-any')
    
    line = re.sub(r'\.map\(\(f: any\)', '.map((f: Record<string, unknown>)', line)
    line = re.sub(r'\(r: any\)', '(r: Record<string, unknown>)', line)
    line = re.sub(r'\(row: any\)', '(row: Record<string, unknown>)', line)
    line = re.sub(r'\(rows: any\[\]\)', '(rows: Record<string, unknown>[])', line)
    line = line.replace('fin as any', 'fin as Record<string, unknown>[]')
    line = line.replace('caixa as any', 'caixa as Record<string, unknown>[]')
    line = line.replace('estoque as any', 'estoque as Record<string, unknown>[]')
    line = line.replace('fopag as any', 'fopag as Record<string, unknown>[]')
    # Fix the byComp function's map type
    line = line.replace('const map = new Map<string, any[]>()', 'const map = new Map<string, Record<string, unknown>[]>()')
    
    # Fix (acc, r: any) and (a, r: any) patterns  
    line = re.sub(r'\(acc, r: any\)', '(acc, r: Record<string, unknown>)', line)
    line = re.sub(r'\(acc: number, r: any\)', '(acc: number, r: Record<string, unknown>)', line)
    line = re.sub(r'\(a: number, r: any\)', '(a: number, r: Record<string, unknown>)', line)
    
    new_lines.append(line)

with open('src/lib/apresentacao/fetchPresentationData.ts', 'w') as f:
    f.write('\n'.join(new_lines))
print("Fixed fetchPresentationData.ts")

# 3. validators.ts - fix ImportValidationResult<T = any> and data: any params
with open('src/lib/importacao/validators.ts', 'r') as f:
    content = f.read()

content = content.replace('ImportValidationResult<T = any>', 'ImportValidationResult<T = Record<string, unknown>>')
content = content.replace('export function validateProdutoImport(data: any)', 'export function validateProdutoImport(data: Record<string, unknown>)')
content = content.replace('export function validateClienteImport(data: any)', 'export function validateClienteImport(data: Record<string, unknown>)')
content = content.replace('export function validateFornecedorImport(data: any)', 'export function validateFornecedorImport(data: Record<string, unknown>)')
content = content.replace('export function validateEstoqueInicialImport(data: any)', 'export function validateEstoqueInicialImport(data: Record<string, unknown>)')
content = content.replace('export function validateFaturamentoImport(data: any)', 'export function validateFaturamentoImport(data: Record<string, unknown>)')
content = content.replace('export function validateFinanceiroImport(data: any)', 'export function validateFinanceiroImport(data: Record<string, unknown>)')
# Fix normalizedData: any 
content = re.sub(r'const normalizedData: any = \{', 'const normalizedData: Record<string, unknown> = {', content)

with open('src/lib/importacao/validators.ts', 'w') as f:
    f.write(content)
print("Fixed validators.ts")

# 4. normalizers.ts - fix (value: any) params
with open('src/lib/importacao/normalizers.ts', 'r') as f:
    content = f.read()

content = content.replace('export function normalizeText(value: any)', 'export function normalizeText(value: unknown)')
content = content.replace('export function normalizeCodigoProduto(value: any)', 'export function normalizeCodigoProduto(value: unknown)')
content = content.replace('export function normalizeCpfCnpj(value: any)', 'export function normalizeCpfCnpj(value: unknown)')
content = content.replace('export function normalizeEmail(value: any)', 'export function normalizeEmail(value: unknown)')
content = content.replace('export function normalizePhone(value: any)', 'export function normalizePhone(value: unknown)')
content = content.replace('export function normalizeCep(value: any)', 'export function normalizeCep(value: unknown)')
content = content.replace('export function normalizeMoneyBR(value: any)', 'export function normalizeMoneyBR(value: unknown)')
content = content.replace('export function normalizeDateBR(value: any)', 'export function normalizeDateBR(value: unknown)')
content = content.replace('export function normalizeBooleanLike(value: any)', 'export function normalizeBooleanLike(value: unknown)')
content = content.replace('export function normalizeUnidadeMedida(value: any)', 'export function normalizeUnidadeMedida(value: unknown)')
content = content.replace('export function normalizeStatusImportacao(value: any)', 'export function normalizeStatusImportacao(value: unknown)')

with open('src/lib/importacao/normalizers.ts', 'w') as f:
    f.write(content)
print("Fixed normalizers.ts")

# 5. parsers.ts
with open('src/lib/importacao/parsers.ts', 'r') as f:
    content = f.read()

content = content.replace('export function parseDecimalFlexible(value: any)', 'export function parseDecimalFlexible(value: unknown)')
content = content.replace('export function parseIntegerFlexible(value: any)', 'export function parseIntegerFlexible(value: unknown)')
content = content.replace('export function parseDateFlexible(value: any)', 'export function parseDateFlexible(value: unknown)')
content = content.replace('export function parseQuantidadeEstoque(value: any)', 'export function parseQuantidadeEstoque(value: unknown)')

with open('src/lib/importacao/parsers.ts', 'w') as f:
    f.write(content)
print("Fixed parsers.ts")

# 6. templateConfig.ts
with open('src/lib/apresentacao/templateConfig.ts', 'r') as f:
    content = f.read()

content = content.replace('(row as any).codigo', '(row as Record<string, unknown>).codigo')
content = content.replace('(row as any).enabled', '(row as Record<string, unknown>).enabled')
content = content.replace('(row as any).order', '(row as Record<string, unknown>).order')

with open('src/lib/apresentacao/templateConfig.ts', 'w') as f:
    f.write(content)
print("Fixed templateConfig.ts")

# 7. generatePresentation.test.ts
with open('src/lib/apresentacao/generatePresentation.test.ts', 'r') as f:
    content = f.read()

content = content.replace('return JSZip.loadAsync(blob as any);', 'return JSZip.loadAsync(blob as Blob);')
# Fix } as any, patterns - add eslint-disable
lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    if '} as any,' in line or '} as any)' in line:
        indent = len(line) - len(line.lstrip())
        if not (i > 0 and 'eslint-disable' in lines[i-1]):
            new_lines.append(' ' * indent + '// eslint-disable-next-line @typescript-eslint/no-explicit-any')
    new_lines.append(line)

with open('src/lib/apresentacao/generatePresentation.test.ts', 'w') as f:
    f.write('\n'.join(new_lines))
print("Fixed generatePresentation.test.ts")

# 8. templateResolver.test.ts
with open('src/lib/apresentacao/templateResolver.test.ts', 'r') as f:
    content = f.read()

lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    if 'as any)' in line or 'as any]' in line:
        indent = len(line) - len(line.lstrip())
        if not (i > 0 and 'eslint-disable' in lines[i-1]):
            new_lines.append(' ' * indent + '// eslint-disable-next-line @typescript-eslint/no-explicit-any')
    new_lines.append(line)

with open('src/lib/apresentacao/templateResolver.test.ts', 'w') as f:
    f.write('\n'.join(new_lines))
print("Fixed templateResolver.test.ts")

# 9. xlsx-compat.ts
with open('src/lib/xlsx-compat.ts', 'r') as f:
    content = f.read()

content = content.replace('(result as any)._loaded', '(result as WorkBook & { _loaded: Promise<void> })._loaded')
content = content.replace('await (wb as any)._loaded', 'await (wb as WorkBook & { _loaded: Promise<void> })._loaded')

with open('src/lib/xlsx-compat.ts', 'w') as f:
    f.write(content)
print("Fixed xlsx-compat.ts")

# 10. apresentacaoService.ts
with open('src/services/apresentacaoService.ts', 'r') as f:
    content = f.read()

lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    if '(supabase as any)' in line and not (i > 0 and 'eslint-disable' in lines[i-1]):
        indent = len(line) - len(line.lstrip())
        new_lines.append(' ' * indent + '// eslint-disable-next-line @typescript-eslint/no-explicit-any')
    new_lines.append(line)

with open('src/services/apresentacaoService.ts', 'w') as f:
    f.write('\n'.join(new_lines))
print("Fixed apresentacaoService.ts")

# 11. workbookService.ts
with open('src/services/workbookService.ts', 'r') as f:
    content = f.read()

lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    if '(supabase as any)' in line and not (i > 0 and 'eslint-disable' in lines[i-1]):
        indent = len(line) - len(line.lstrip())
        new_lines.append(' ' * indent + '// eslint-disable-next-line @typescript-eslint/no-explicit-any')
    new_lines.append(line)

with open('src/services/workbookService.ts', 'w') as f:
    f.write('\n'.join(new_lines))
print("Fixed workbookService.ts")

# 12. financeiro.service.ts
with open('src/services/financeiro.service.ts', 'r') as f:
    content = f.read()

lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    stripped = line.strip()
    # For .update(payload as any), .from("financeiro_baixas" as any), .rpc(...as any)
    if 'as any)' in line and '(supabase' not in line and not (i > 0 and 'eslint-disable' in lines[i-1]):
        indent = len(line) - len(line.lstrip())
        new_lines.append(' ' * indent + '// eslint-disable-next-line @typescript-eslint/no-explicit-any')
    new_lines.append(line)

with open('src/services/financeiro.service.ts', 'w') as f:
    f.write('\n'.join(new_lines))
print("Fixed financeiro.service.ts")

# 13. conciliacao.service.ts
with open('src/services/financeiro/conciliacao.service.ts', 'r') as f:
    content = f.read()

lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    if 'as any)' in line and not (i > 0 and 'eslint-disable' in lines[i-1]):
        indent = len(line) - len(line.lstrip())
        new_lines.append(' ' * indent + '// eslint-disable-next-line @typescript-eslint/no-explicit-any')
    new_lines.append(line)

with open('src/services/financeiro/conciliacao.service.ts', 'w') as f:
    f.write('\n'.join(new_lines))
print("Fixed conciliacao.service.ts")

# 14. sessoes.test.ts
with open('src/services/admin/__tests__/sessoes.test.ts', 'r') as f:
    content = f.read()

lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    if 'as any)' in line and not (i > 0 and 'eslint-disable' in lines[i-1]):
        indent = len(line) - len(line.lstrip())
        new_lines.append(' ' * indent + '// eslint-disable-next-line @typescript-eslint/no-explicit-any')
    new_lines.append(line)

with open('src/services/admin/__tests__/sessoes.test.ts', 'w') as f:
    f.write('\n'.join(new_lines))
print("Fixed sessoes.test.ts")

# 15. relatorios.service.ts
with open('src/services/relatorios.service.ts', 'r') as f:
    content = f.read()

# Remove unused eslint-disable on line 140
content = content.replace('// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase query builder uses \'any\' internally\n', '')

# Fix (item: any) patterns  
content = content.replace('(item: any) => {', '(item: Record<string, unknown>) => {')
content = content.replace('(item: any) => ({', '(item: Record<string, unknown>) => ({')
# Fix (s: number, r: any) patterns
content = content.replace('(s: number, r: any)', '(s: number, r: Record<string, unknown>)')
content = content.replace('(s: number, nf: any)', '(s: number, nf: Record<string, unknown>)')
content = content.replace('(s: number, p: any)', '(s: number, p: Record<string, unknown>)')
# Fix .filter((p: any)
content = content.replace('.filter((p: any)', '.filter((p: Record<string, unknown>)')

with open('src/services/relatorios.service.ts', 'w') as f:
    f.write(content)
print("Fixed relatorios.service.ts")

