#!/usr/bin/env python3
"""Gera public/workbook_fechamento_v1.xlsx a partir do Workbook de fechamento legado.

Uso:
    python3 scripts/workbook/build_fechamento_template.py <Financeiro_workbook_AAAA.xlsx> [saida.xlsx]

O Workbook legado consolidava o fechamento por vínculos externos (72) com os
arquivos mensais. Este script preserva o layout, os estilos, as tabelas e os
gráficos das abas visíveis e troca cada vínculo/valor digitado por fórmulas
que leem a aba oculta BASE, preenchida pelo ERP na geração
(src/lib/workbook/fechamento/). Remove abas ocultas herdadas, vínculos
externos, tabelas dinâmicas, nomes definidos quebrados, comentários e caches.

Layout da BASE (linha 1 = cabeçalho):
  linhas 2..38  -> meses de dez/(ano-3) a dez/(ano); linha = 2 + (off+2)*12 + mês
  A data (1º dia do mês) | B 1 se mês <= competência | C recebido | D pago
  E faturamento | F bloqueado | G estoque materiais | H estoque produtos
  I..S aging CR (a vencer 0-30,31-60,61-90,90+; vencido 0-30,31-60,61-90,91-120,121-180,181-360,360+)
  T..AD aging CP (mesmas faixas) | AE seguidores LinkedIn | AF Instagram
  AG..AJ saldo sócio 1..4 | AK..AN retirada/pró-labore sócio 1..4
  AQ2 competência | AQ3 ano | AQ4 crescimento meta ano | AQ5 crescimento meta ano-1
  AQ6..AQ8 limite faturamento ano-2..ano | AQ9 resultado de caixa anterior à janela
  AP12..AP15 nome dos sócios | AQ12..AQ15 participação (fração)
"""
import re
import sys
import zipfile
from lxml import etree
from openpyxl.formula.translate import Translator
from openpyxl.utils import get_column_letter as L, column_index_from_string as CI

NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PNS = 'http://schemas.openxmlformats.org/package/2006/relationships'
CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
Q = lambda t: f'{{{NS}}}{t}'

KEEP = ['Resultados Financeiros ->', 'Bridge Faturamento', 'Confronto', 'Caixa Livre', 'Receita', 'Despesa',
        'FOPAG', 'Faturamento FY', 'Working Capital ->', 'Estoque - Ativo', 'Aging CR', 'Aging CP',
        'Redes Sociais', 'Lin vs Ins']
ACTIVE = 'Confronto'


def br(off, m):
    """Linha da BASE para o mês m do ano (ano + off); off=-3 só dezembro."""
    return 2 if off == -3 else 2 + (off + 2) * 12 + m


def flag(r):
    return f'BASE!$B${r}'


def base(col, r):
    return f'BASE!${col}${r}'


def w(r, expr):
    return f'IF({flag(r)}=1,{expr},"")'


MCOL = lambda m: L(2 + m)  # C..N


def confronto():
    f = {}
    for h, rr, dr, sr, off in [(1, 2, 3, 4, -2), (6, 7, 8, 9, -1), (11, 12, 13, 14, 0)]:
        for m in range(1, 13):
            c, r = MCOL(m), br(off, m)
            f[f'{c}{h}'] = base('A', r)
            f[f'{c}{rr}'] = w(r, f'{base("C", r)}/1000')
            f[f'{c}{dr}'] = w(r, f'-{base("D", r)}/1000')
            f[f'{c}{sr}'] = w(r, f'SUM({c}{rr},{c}{dr})')
        for row in (rr, dr, sr):
            for i, qc in enumerate('PQRS'):
                f[f'{qc}{row}'] = f'SUM({MCOL(3 * i + 1)}{row}:{MCOL(3 * i + 3)}{row})'
    return f


def receita():
    f = {}
    prev = {-2: [], -1: ['Confronto!$C$4:$N$4'], 0: ['Confronto!$C$4:$N$4', 'Confronto!$C$9:$N$9']}
    for h, rr, cx, vr, off, conf_rec, conf_res, prev_cx in [
            (1, 2, 3, 4, -2, 2, 4, None), (6, 7, 8, 9, -1, 7, 9, 3), (11, 12, 13, 14, 0, 12, 14, 8)]:
        for m in range(1, 13):
            c, r = MCOL(m), br(off, m)
            f[f'{c}{h}'] = base('A', r)
            f[f'{c}{rr}'] = f'Confronto!{c}{conf_rec}'
            parts = prev[off] + [f'Confronto!$C${conf_res}:{c}{conf_res}']
            f[f'{c}{cx}'] = w(r, f'BASE!$AQ$9/1000+SUM({",".join(parts)})')
            if m == 1:
                ant = 'BASE!$AQ$9/1000' if prev_cx is None else f'N{prev_cx}'
                f[f'{c}{vr}'] = w(r, f'{c}{cx}-{ant}')
            else:
                f[f'{c}{vr}'] = w(r, f'{c}{cx}-{MCOL(m - 1)}{cx}')
    return f


def despesa():
    f = {}
    for h, ac, dp, vr, off, conf_desp, prev_dp in [(1, 2, 3, 4, -2, 3, None), (6, 7, 8, 9, -1, 8, 3),
                                                     (11, 12, 13, 14, 0, 13, 8)]:
        for m in range(1, 13):
            c, r = MCOL(m), br(off, m)
            f[f'{c}{h}'] = base('A', r)
            f[f'{c}{ac}'] = w(r, f'SUM(Confronto!$C${conf_desp}:{c}{conf_desp})')
            f[f'{c}{dp}'] = w(r, f'{c}{ac}') if m == 1 else w(r, f'{c}{ac}-{MCOL(m - 1)}{ac}')
            if m == 1:
                if prev_dp is not None:
                    f[f'{c}{vr}'] = w(r, f'{c}{dp}-N{prev_dp}')
            else:
                f[f'{c}{vr}'] = w(r, f'{c}{dp}-{MCOL(m - 1)}{dp}')
    return f


def linhas_mensais():
    """Linhas 4..28 das abas Caixa Livre / Faturamento FY / Lin vs Ins: dez/(ano-2) .. dez/ano."""
    return [(r, r + 10) for r in range(4, 29)]


def cabecalho_data(f, r, b):
    f[f'C{r}'] = f'EOMONTH({base("A", b)},0)'
    f[f'F{r}'] = f'EOMONTH({base("A", b)},0)'
    f[f'D{r}'] = f'VLOOKUP(MONTH(C{r}),$AE$16:$AF$27,2,0)'
    f[f'E{r}'] = f'YEAR(C{r})'


def caixa_livre():
    f = {}
    for r, b in linhas_mensais():
        cabecalho_data(f, r, b)
        f[f'H{r}'] = w(b, f'{base("F", b)}/1000')
        if r == 4:
            f['J4'] = 'Receita!N3'
            f['I4'] = 'Receita!M3'
        else:
            f[f'J{r}'] = f'Receita!{MCOL(r - 4)}8' if r <= 16 else f'Receita!{MCOL(r - 16)}13'
            f[f'I{r}'] = w(b, f'J{r - 1}')
        f[f'G{r}'] = w(b, f'J{r}-H{r}')
        f[f'L{r}'] = w(b, f'J{r}-I{r}')
    return f


def faturamento_fy():
    f = {}
    for r, b in linhas_mensais():
        cabecalho_data(f, r, b)
        f[f'G{r}'] = w(b, f'{base("E", b)}/1000')
        if r == 4:
            f['I4'] = 'SUM(BASE!$E$3:$E$14)/1000'
        else:
            ini = 5 if r <= 16 else 17
            f[f'I{r}'] = w(b, f'SUM($G${ini}:G{r})')
        f[f'K{r}'] = w(b, f'G{r}')
    return f


def bridge():
    f = {}
    for m in range(1, 13):
        r = m + 3
        f[f'B{r}'] = f'{base("E", br(-2, m))}/1000'
        f[f'C{r}'] = f'B{r}*(1+BASE!$AQ$5)'
        f[f'E{r}'] = f"'Faturamento FY'!G{m + 4}"
        f[f'F{r}'] = f'E{r}*(1+BASE!$AQ$4)'
        f[f'H{r}'] = f"'Faturamento FY'!G{m + 16}"
        f[f'I{r}'] = f'IF(H{r}="","",IFERROR(H{r}/E{r}-1,""))'
        f[f'J{r}'] = f'IF(H{r}="","",H{r}-E{r})'
        f[f'K{r}'] = 'IF(H4="","",H4-E15)' if m == 1 else f'IF(H{r}="","",H{r}-H{r - 1})'
    f.update({'B16': 'SUM(B3:B15)', 'E16': 'SUM(E4:E15)', 'H16': 'SUM(H4:H15)',
              'B17': 'BASE!$AQ$6/1000', 'E17': 'BASE!$AQ$7/1000', 'H17': 'BASE!$AQ$8/1000',
              'E19': 'E17-E16', 'H19': 'H17-H16', 'J2': 'BASE!$AQ$3-1'})
    return f


def fopag():
    f = {}
    ultimo = lambda rng: f'IFERROR(LOOKUP(2,1/(ISNUMBER({rng})*({rng}<>0)),{rng}),0)'
    for off, saldo, ret, var in [(-1, 3, 11, 19), (0, 26, 34, 42)]:
        for k in range(4):
            for row in (saldo, ret, var):
                f[f'D{row + k}'] = f'BASE!$AP${12 + k}'
            for m in range(1, 13):
                c, r = L(4 + m), br(off, m)
                f[f'{c}{saldo + k}'] = w(r, f'{base(L(CI("AG") + k), r)}/1000')
                f[f'{c}{ret + k}'] = w(r, f'{base(L(CI("AK") + k), r)}/1000')
                if m == 1:
                    f[f'{c}{var + k}'] = (w(r, f'E{saldo + k}') if off == -1
                                          else w(r, f'IF(N(P{3 + k})=0,0,E{saldo + k}-P{3 + k})'))
                else:
                    f[f'{c}{var + k}'] = w(r, f'{c}{saldo + k}-{L(3 + m)}{saldo + k}')
            f[f'Q{saldo + k}'] = ultimo(f'E{saldo + k}:P{saldo + k}')
            f[f'Q{ret + k}'] = f'SUM(E{ret + k}:P{ret + k})'
            f[f'Q{var + k}'] = ultimo(f'E{var + k}:P{var + k}')
        for top in (saldo, ret, var):
            for ci in range(5, 18):
                c = L(ci)
                f[f'{c}{top + 4}'] = f'SUM({c}{top}:{c}{top + 3})'
    return f


def estoque():
    f = {}
    for r in range(3, 28):
        b = r + 11
        f[f'A{r}'] = base('A', b)
        f[f'B{r}'] = w(b, f'{base("G", b)}/1000')
        f[f'C{r}'] = w(b, f'{base("H", b)}/1000')
        f[f'D{r}'] = 'B3' if r == 3 else w(b, f'B{r}-B{r - 1}')
        f[f'E{r}'] = 'C3' if r == 3 else w(b, f'C{r}-C{r - 1}')
        f[f'F{r}'] = w(b, f'SUM(B{r}:C{r})')
        f[f'G{r}'] = '0' if r == 3 else w(b, f'IFERROR(F{r}/F{r - 1}-1,0)')
    return f


AGING_MES = ['N', 'O', 'P', 'R', 'S', 'T', 'V', 'W', 'X', 'Z', 'AA', 'AB']
AGING_TRI = [('Q', 'N', 'P'), ('U', 'R', 'T'), ('Y', 'V', 'X'), ('AC', 'Z', 'AB')]


def aging(col_ini):
    f = {}
    linhas = [5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16]
    for m, c in enumerate(AGING_MES, start=1):
        r = br(0, m)
        f[f'{c}2'] = base('A', r)
        for i, row in enumerate(linhas):
            f[f'{c}{row}'] = w(r, f'{base(L(CI(col_ini) + i), r)}/1000')
        f[f'{c}4'] = w(r, f'SUM({c}5:{c}8)')
        f[f'{c}9'] = w(r, f'SUM({c}10:{c}16)')
        f[f'{c}17'] = w(r, f'SUM({c}4,{c}9)')
    for qc, a, b in AGING_TRI:
        for row in [4] + linhas[:4] + [9] + linhas[4:] + [17]:
            f[f'{qc}{row}'] = f'IFERROR(AVERAGE({a}{row}:{b}{row}),"")'
    return f


def lin_ins():
    f = {}
    for r, b in linhas_mensais():
        cabecalho_data(f, r, b)
        for dst, ini, src in (('H', 'G', 'AE'), ('J', 'I', 'AF')):
            f[f'{dst}{r}'] = f'IF(AND({flag(b)}=1,ISNUMBER({base(src, b)})),{base(src, b)},"")'
            if r == 4:
                f[f'{ini}4'] = f'IF(ISNUMBER({base(src, 13)}),{base(src, 13)},"")'
            else:
                f[f'{ini}{r}'] = w(b, f'{dst}{r - 1}')
        f[f'L{r}'] = f'IF(AND(ISNUMBER(H{r}),ISNUMBER(G{r})),H{r}-G{r},"")'
        f[f'M{r}'] = f'IF(AND(ISNUMBER(J{r}),ISNUMBER(I{r})),J{r}-I{r},"")'
    return f


RULES = {'Confronto': confronto, 'Receita': receita, 'Despesa': despesa, 'Caixa Livre': caixa_livre,
         'Faturamento FY': faturamento_fy, 'Bridge Faturamento': bridge, 'FOPAG': fopag,
         'Estoque - Ativo': estoque, 'Aging CR': lambda: aging('I'), 'Aging CP': lambda: aging('T'),
         'Lin vs Ins': lin_ins}

REF_RE = re.compile(r'^([A-Z]+)(\d+)$')


def cell_key(ref):
    m = REF_RE.match(ref)
    return int(m.group(2)), CI(m.group(1))


def rewrite_sheet(xml, formulas, limpar_colunas=()):
    root = etree.fromstring(xml)
    sd = root.find(Q('sheetData'))
    # Colunas ocultas com números de exemplo herdados do modelo corporativo.
    for c in sd.iter(Q('c')):
        if REF_RE.match(c.get('r')).group(1) in limpar_colunas and c.find(Q('f')) is None:
            for ch in list(c):
                c.remove(ch)
            c.attrib.pop('t', None)
    # 1) Expande fórmulas compartilhadas para que cada célula tenha a sua.
    masters = {}
    for c in sd.iter(Q('c')):
        fe = c.find(Q('f'))
        if fe is not None and fe.get('t') == 'shared' and fe.text:
            masters[fe.get('si')] = (fe.text, c.get('r'))
    for c in sd.iter(Q('c')):
        fe = c.find(Q('f'))
        if fe is None or fe.get('t') != 'shared':
            continue
        text, origin = masters[fe.get('si')]
        fe.text = text if c.get('r') == origin else Translator('=' + text, origin=origin).translate_formula(c.get('r'))[1:]
        for a in ('t', 'si', 'ref'):
            fe.attrib.pop(a, None)
    # 2) Aplica as fórmulas novas (mantém o estilo da célula).
    rows = {int(r.get('r')): r for r in sd.findall(Q('row'))}
    for ref, formula in formulas.items():
        rn, cn = cell_key(ref)
        row = rows.get(rn)
        if row is None:
            row = etree.SubElement(sd, Q('row'), r=str(rn))
            rows[rn] = row
            for r in sorted(rows.values(), key=lambda e: int(e.get('r'))):
                sd.append(r)
        cell = next((c for c in row.findall(Q('c')) if c.get('r') == ref), None)
        if cell is None:
            cell = etree.Element(Q('c'), r=ref)
            after = [c for c in row.findall(Q('c')) if cell_key(c.get('r'))[1] < cn]
            if after:
                after[-1].addnext(cell)
            else:
                row.insert(0, cell)
        style = cell.get('s')
        for ch in list(cell):
            cell.remove(ch)
        for a in list(cell.attrib):
            if a not in ('r', 's'):
                del cell.attrib[a]
        if style is not None:
            cell.set('s', style)
        if re.fullmatch(r'-?\d+(\.\d+)?', formula):
            etree.SubElement(cell, Q('v')).text = formula
        else:
            etree.SubElement(cell, Q('f')).text = formula
    # 3) Remove valores em cache de todas as fórmulas (o Excel recalcula ao abrir).
    for c in sd.iter(Q('c')):
        if c.find(Q('f')) is not None:
            v = c.find(Q('v'))
            if v is not None:
                c.remove(v)
            if c.get('t') in ('str', 'e', 'b', 'n'):
                del c.attrib['t']
    for row in sd.findall(Q('row')):
        row.attrib.pop('spans', None)
    lg = root.find(Q('legacyDrawing'))
    if lg is not None:
        root.remove(lg)
    for sv in root.iter(Q('sheetView')):
        sv.attrib.pop('topLeftCell', None)
        sv.attrib.pop('tabSelected', None)
        for sel in sv.findall(Q('selection')):
            sv.remove(sel)
    return root


def main(src, dst):
    zin = zipfile.ZipFile(src)
    names = set(zin.namelist())
    read = lambda n: zin.read(n)
    wb = etree.fromstring(read('xl/workbook.xml'))
    rels = etree.fromstring(read('xl/_rels/workbook.xml.rels'))
    rid_target = {r.get('Id'): r.get('Target') for r in rels}

    out = {}
    sheets_el = wb.find(Q('sheets'))
    kept = []
    for s in list(sheets_el):
        if s.get('name') in KEEP:
            kept.append((s.get('name'), 'xl/' + rid_target[s.get(f'{{{RNS}}}id')]))
        sheets_el.remove(s)
    kept.sort(key=lambda x: KEEP.index(x[0]))
    assert [k[0] for k in kept] == KEEP, kept

    new_rels = etree.Element(f'{{{PNS}}}Relationships', nsmap={None: PNS})
    for r in rels:
        t = r.get('Type').rsplit('/', 1)[-1]
        if t in ('styles', 'theme', 'sharedStrings'):
            new_rels.append(r)

    reachable = set()

    def walk(part):
        if part in reachable or part not in names:
            return
        reachable.add(part)
        d, base_name = part.rsplit('/', 1)
        rp = f'{d}/_rels/{base_name}.rels'
        if rp not in names:
            return
        rr = etree.fromstring(read(rp))
        for r in list(rr):
            kind = r.get('Type').rsplit('/', 1)[-1]
            if kind in ('comments', 'vmlDrawing', 'externalLink', 'pivotTable', 'pivotCacheDefinition'):
                rr.remove(r)
                continue
            if r.get('TargetMode') == 'External':
                continue
            tgt = r.get('Target')
            full = tgt.lstrip('/') if tgt.startswith('/') else _norm(d, tgt)
            walk(full)
        out[rp] = etree.tostring(rr, xml_declaration=True, encoding='UTF-8', standalone=True)

    for i, (name, part) in enumerate(kept, start=1):
        rid = f'rIdS{i}'
        el = etree.SubElement(sheets_el, Q('sheet'), name=name, sheetId=str(i))
        el.set(f'{{{RNS}}}id', rid)
        etree.SubElement(new_rels, f'{{{PNS}}}Relationship', Id=rid,
                         Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
                         Target=part[3:])
        walk(part)
        formulas = RULES.get(name, lambda: {})()
        limpar = [L(i) for i in range(3, 14)] if name.startswith('Aging') else ()
        root = rewrite_sheet(read(part), formulas, limpar)
        if name == ACTIVE:
            root.find(Q('sheetViews')).find(Q('sheetView')).set('tabSelected', '1')
        out[part] = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)

    # Aba BASE (oculta) — preenchida pelo ERP na geração.
    base_part = 'xl/worksheets/sheetBase.xml'
    el = etree.SubElement(sheets_el, Q('sheet'), name='BASE', sheetId=str(len(kept) + 1), state='hidden')
    el.set(f'{{{RNS}}}id', 'rIdBase')
    etree.SubElement(new_rels, f'{{{PNS}}}Relationship', Id='rIdBase',
                     Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
                     Target='worksheets/sheetBase.xml')
    out[base_part] = (f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                      f'<worksheet xmlns="{NS}"><sheetData/></worksheet>').encode()

    for tag in ('externalReferences', 'definedNames', 'pivotCaches'):
        e = wb.find(Q(tag))
        if e is not None:
            wb.remove(e)
    ext = wb.find(Q('extLst'))
    if ext is not None:
        wb.remove(ext)
    calc = wb.find(Q('calcPr'))
    calc.attrib.clear()
    calc.set('calcId', '191029')
    calc.set('fullCalcOnLoad', '1')
    bv = wb.find(Q('bookViews')).find(Q('workbookView'))
    bv.set('firstSheet', '0')
    bv.set('activeTab', str(KEEP.index(ACTIVE)))
    out['xl/workbook.xml'] = etree.tostring(wb, xml_declaration=True, encoding='UTF-8', standalone=True)
    out['xl/_rels/workbook.xml.rels'] = etree.tostring(new_rels, xml_declaration=True, encoding='UTF-8', standalone=True)

    for n in ('xl/styles.xml', 'xl/theme/theme1.xml', 'docProps/core.xml'):
        out[n] = read(n)
    out['xl/sharedStrings.xml'] = _podar_strings(read('xl/sharedStrings.xml'), out, [p for _, p in kept])
    for part in reachable:
        if part not in out:
            data = read(part)
            if part.startswith('xl/charts/chart'):
                data = _strip_chart_cache(data)
            if part.startswith('xl/tables/'):
                data = re.sub(rb'<calculatedColumnFormula>.*?</calculatedColumnFormula>', b'', data, flags=re.S)
            out[part] = data

    root_rels = etree.fromstring(read('_rels/.rels'))
    for r in list(root_rels):
        if not r.get('Target').endswith(('workbook.xml', 'core.xml')):
            root_rels.remove(r)
    out['_rels/.rels'] = etree.tostring(root_rels, xml_declaration=True, encoding='UTF-8', standalone=True)

    ct = etree.fromstring(read('[Content_Types].xml'))
    for o in list(ct):
        if o.tag == f'{{{CT}}}Override' and o.get('PartName').lstrip('/') not in out:
            ct.remove(o)
    etree.SubElement(ct, f'{{{CT}}}Override', PartName='/' + base_part,
                     ContentType='application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml')
    out['[Content_Types].xml'] = etree.tostring(ct, xml_declaration=True, encoding='UTF-8', standalone=True)

    # Nenhuma fórmula pode continuar apontando para arquivo externo ou aba removida.
    for part, data in out.items():
        if part.startswith('xl/worksheets/sheet') and part != base_part:
            for f in re.findall(rb'<f>([^<]*)</f>', data):
                assert b'[' not in f, (part, f)
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', out.pop('[Content_Types].xml'))
        for n in sorted(out):
            z.writestr(n, out[n])
    print(f'ok: {dst} ({len(out) + 1} partes)')


def _norm(d, tgt):
    parts = d.split('/')
    for p in tgt.split('/'):
        if p == '..':
            parts.pop()
        elif p != '.':
            parts.append(p)
    return '/'.join(parts)


def _podar_strings(sst_xml, out, partes):
    """Mantém só os textos usados pelas abas preservadas e renumera as referências."""
    sst = etree.fromstring(sst_xml)
    itens = sst.findall(Q('si'))
    usados = []
    for p in partes:
        for m in re.finditer(rb'<c [^>]*t="s"[^>]*>(?:<f>[^<]*</f>)?<v>(\d+)</v>', out[p]):
            usados.append(int(m.group(1)))
    novo_idx = {old: i for i, old in enumerate(sorted(set(usados)))}
    for p in partes:
        out[p] = re.sub(rb'(<c [^>]*t="s"[^>]*>(?:<f>[^<]*</f>)?<v>)(\d+)(</v>)',
                        lambda m: m.group(1) + str(novo_idx[int(m.group(2))]).encode() + m.group(3), out[p])
    for si in itens:
        sst.remove(si)
    for old in sorted(novo_idx):
        sst.append(itens[old])
    sst.set('count', str(len(usados)))
    sst.set('uniqueCount', str(len(novo_idx)))
    return etree.tostring(sst, xml_declaration=True, encoding='UTF-8', standalone=True)


def _strip_chart_cache(data):
    data = re.sub(rb'<c:numCache>.*?</c:numCache>', b'', data, flags=re.S)
    data = re.sub(rb'<c:strCache>.*?</c:strCache>', b'', data, flags=re.S)
    return data


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'public/workbook_fechamento_v1.xlsx')
