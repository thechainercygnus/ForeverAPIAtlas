"""Import history from a folder of SavedVariables dumps, without executing Lua."""
import sys
from pathlib import Path
from import_dump import parse_variables
from profiles import import_snapshot

if __name__ == '__main__':
    source, output = map(Path, sys.argv[1:3])
    captures = []
    for path in sorted(source.glob('*.lua')):
        variables = parse_variables(path.read_text(encoding='utf-8-sig'))
        capture = variables.get('ForeverAPIExplorerCharacterDB')
        if capture:
            capture['source'] = path.name
            captures.append(capture)
    for capture in captures:
        profile = import_snapshot(capture, output)
        print(profile['snapshotId'], profile['source'])
