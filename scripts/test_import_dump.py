import unittest
from pathlib import Path
from import_dump import parse, parse_variables, validate_character

ROOT = Path(__file__).resolve().parents[2] / 'ForeverAPIExplorer'
DUMPS = [ROOT / 'data/ForeverAPIExplorer-20261116-202559.lua',
         ROOT / 'data/ForeverAPIExplorer-20261116-160324.lua']

class ImportTests(unittest.TestCase):
    @unittest.skipUnless(all(d.is_file() for d in DUMPS),
                         'needs the private capture dumps in ../ForeverAPIExplorer/data/ (local only)')
    def test_combined_export(self):
        variables = parse_variables(DUMPS[0].read_text(encoding='utf-8-sig'))
        character = variables['ForeverAPIExplorerCharacterDB']
        validate_character(character)
        self.assertEqual(character['statistics']['queries'], 231)
        self.assertEqual(character['statistics']['restrictedQueries'], 2)
        self.assertEqual(sum(q['path'] == '_G.GetProfessionInfo' for q in character['queries']), 5)
        self.assertEqual(sum(q['path'] == '_G.C_SpellBook.GetSpellBookItemInfo' for q in character['queries']), 28)
        original = parse(DUMPS[1].read_text(encoding='utf-8-sig'))
        self.assertEqual(variables['ForeverAPIExplorerDB'], original)

    def test_values_and_rejection(self):
        self.assertEqual(parse('ForeverAPIExplorerDB = {["n"]=1.2e-3,["b"]=false}'), {'n': .0012, 'b': False})
        for source in ['ForeverAPIExplorerDB = os.execute("x")', 'UnknownDB = {}',
                       'ForeverAPIExplorerDB={} ForeverAPIExplorerDB={}']:
            with self.assertRaises((ValueError, AssertionError)):
                parse_variables(source)

if __name__ == '__main__': unittest.main()
