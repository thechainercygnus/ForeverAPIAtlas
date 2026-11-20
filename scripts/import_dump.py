"""Parse the SavedVariables data subset, without executing Lua code."""
import json, re, sys
from pathlib import Path

def parse_variables(text):
    tokens = re.finditer(r'\s+|--[^\n]*|"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[A-Za-z_]\w*|[{}\[\]=,;]', text)
    pos = 0
    stream = []
    for m in tokens:
        if text[pos:m.start()].strip():
            raise ValueError('Unsupported Lua syntax')
        pos = m.end()
        if not m[0].isspace() and not m[0].startswith('--'):
            stream.append(m[0])
    if text[pos:].strip(): raise ValueError('Trailing unsupported syntax')
    i = 0
    def value():
        nonlocal i
        t = stream[i]; i += 1
        if t == '{':
            entries = {}; array = []; keyed = False
            while stream[i] != '}':
                if stream[i] == '[':
                    keyed = True; i += 1; k = value()
                    assert stream[i:i+2] == [']', '=']; i += 2
                    entries[k] = value()
                else: array.append(value())
                if stream[i] in [',', ';']: i += 1
            i += 1
            if keyed:
                entries.update({n+1:v for n,v in enumerate(array)})
                return entries
            return array
        if t.startswith('"'):
            # WoW serializer uses Lua decimal escapes and escaped newlines.
            s = t[1:-1]
            escapes = {'n':'\n','r':'\r','t':'\t','a':'\a','b':'\b','f':'\f','v':'\v'}
            return re.sub(r'\\(\d{1,3}|\r?\n|.)', lambda m: chr(int(m[1])) if m[1].isdigit() else escapes.get(m[1],m[1]), s)
        if t in ('true','false','nil'): return {'true':True,'false':False,'nil':None}[t]
        return float(t) if any(c in t for c in '.eE') else int(t)
    result = {}
    while i < len(stream):
        name = stream[i]
        if name not in ('ForeverAPIExplorerDB', 'ForeverAPIExplorerCharacterDB'):
            raise ValueError('Unexpected SavedVariables name: ' + name)
        if name in result: raise ValueError('Duplicate SavedVariables assignment')
        assert stream[i+1] == '='; i += 2
        result[name] = value()
    return result

def parse(text):
    return parse_variables(text)['ForeverAPIExplorerDB']

def validate_character(data):
    assert data['kind'] == 'character' and data['schemaVersion'] == 1
    counts = {status: 0 for status in ('ok', 'error', 'unavailable')}
    restricted = 0
    for q in data['queries']:
        counts[q['status']] += 1
        assert len(q['arguments']) == q['argumentCount']
        if q['status'] == 'ok': assert len(q['returns']) == q['returnCount']
        restricted += bool(q.get('hasRestrictedValues'))
    assert len(data['queries']) == data['statistics']['queries']
    for status, count in counts.items(): assert data['statistics'][status] == count
    assert restricted == data['statistics'].get('restrictedQueries', 0)

if __name__ == '__main__':
    source = Path(sys.argv[1]); variables = parse_variables(source.read_text(encoding='utf-8-sig'))
    data = variables['ForeverAPIExplorerDB']
    character = variables.get('ForeverAPIExplorerCharacterDB')
    if character: validate_character(character)
    records = []
    for group in ['functions','tables','values','other']:
        rows = data.pop(group)
        assert len(rows) == data['statistics'][group]
        for r in rows:
            r['kind'] = {'functions':'function','tables':'table','values':'value','other':'other'}[group]
            records.append(r)
    data['source'] = source.name
    data['records'] = records
    Path(sys.argv[2]).write_text(json.dumps(data,ensure_ascii=True,separators=(',',':')),encoding='utf-8')
    if character:
        character['source'] = source.name
        target = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(sys.argv[2]).with_name('character.json')
        target.write_text(json.dumps(character,ensure_ascii=True,separators=(',',':')),encoding='utf-8')
        from profiles import import_snapshot
        import_snapshot(character, Path(sys.argv[2]).parent)
        print('Character queries:', len(character['queries']))
    else:
        target = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(sys.argv[2]).with_name('character.json')
        target.write_text('null', encoding='utf-8')
    print(json.dumps({k:v for k,v in data.items() if k != 'records'},indent=2))
