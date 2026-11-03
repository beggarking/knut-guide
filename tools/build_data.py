"""엑셀(장소 정리 시트)을 사이트용 data.js로 변환.

사용법: python tools/build_data.py 경로/데이터.xlsx
외부 패키지 없이 표준 라이브러리만 사용.
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
T = '{%s}t' % NS['m']
EMPTY = '확인 안 됨'
OUT = Path(__file__).resolve().parent.parent / 'data.js'


def col_idx(ref):
    n = 0
    for ch in re.match(r'[A-Z]+', ref).group():
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_first_sheet(path):
    z = zipfile.ZipFile(path)
    strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        strings = [''.join(t.text or '' for t in si.iter(T)) for si in root.findall('m:si', NS)]
    root = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    rows = []
    for r in root.iter('{%s}row' % NS['m']):
        cells = {}
        for c in r.findall('m:c', NS):
            v = c.find('m:v', NS)
            if c.get('t') == 's':
                val = strings[int(v.text)]
            elif c.get('t') == 'inlineStr':
                val = ''.join(x.text or '' for x in c.iter(T))
            else:
                val = v.text if v is not None else ''
            cells[col_idx(c.get('r'))] = (val or '').strip()
        if cells:
            rows.append([cells.get(i, '') for i in range(max(cells) + 1)])
    return rows


def clean(v):
    return '' if v == EMPTY else v


def main():
    rows = read_first_sheet(sys.argv[1])
    header, body = rows[0], rows[1:]
    idx = {name: i for i, name in enumerate(header)}
    places = []
    for r in body:
        r = r + [''] * (len(header) - len(r))
        get = lambda k: clean(r[idx[k]])
        if not get('이름'):
            continue
        desc = get('한줄 설명')
        places.append({
            'name': get('이름'),
            'loc': get('위치'),
            'map': get('지도'),
            'cat': get('분류'),
            'date': get('확인한 날'),
            'rec': int(get('추천 수') or 0),
            'menu': get('대표메뉴'),
            'price': get('가격'),
            'hours': get('운영시간'),
            'tips': [t.strip() for t in desc.split(' / ') if t.strip()] if desc else [],
        })
    js = 'window.PLACES = ' + json.dumps(places, ensure_ascii=False, separators=(',', ':')) + ';\n'
    OUT.write_text(js, encoding='utf-8')
    print(f'{len(places)}곳 → {OUT}')


if __name__ == '__main__':
    main()
