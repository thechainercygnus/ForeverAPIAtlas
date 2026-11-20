import copy
import json
import tempfile
import unittest
import sys
from pathlib import Path
from profiles import normalize, import_snapshot

DIST = Path(__file__).resolve().parents[1] / 'dist'
sys.path.insert(0, str(DIST.parents[1] / 'ForeverAPIExplorer' / '.test-deps'))
from jsonschema import Draft202012Validator

class ProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.capture = json.loads((DIST / 'character.json').read_text(encoding='utf-8'))

    def test_real_capture(self):
        profile = normalize(self.capture)
        sections = profile['sections']
        self.assertEqual(sections['identity']['fields']['name']['value'], 'Ett')
        self.assertEqual(sections['stats']['fields']['health']['state'], 'restricted')
        self.assertEqual(len(sections['professions']['entries']), 5)
        self.assertEqual(sections['professions']['entries']['171']['fields']['rank']['value'], 63)
        self.assertEqual(len(sections['spells']['entries']), 28)
        self.assertNotIn('469', sections['reputation']['entries']) # faction header
        self.assertEqual(len(sections['reputation']['entries']), 4)
        for section in sections.values():
            for fields in [section['fields']] + [e['fields'] for e in section['entries'].values()]:
                for field in fields.values():
                    for ref in field['evidence']:
                        q = self.capture['queries'][ref['queryIndex']]
                        self.assertEqual(ref['functionPath'], q['path'])

    def test_published_schema_and_history(self):
        schema = json.loads((DIST / 'profile.schema.json').read_text())
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema)
        history = json.loads((DIST / 'history.json').read_text())
        for entry in history['snapshots']:
            profile = json.loads((DIST / entry['profileFile']).read_text())
            validator.validate(profile)
            evidence = json.loads((DIST / profile['evidenceFile']).read_text())
            self.assertEqual(profile, normalize(evidence))

    def test_missing_failed_false_and_partial(self):
        capture = copy.deepcopy(self.capture)
        capture['queries'] = [q for q in capture['queries'] if q['path'] != '_G.UnitName']
        capture['statistics']['queries'] -= 1
        capture['statistics']['ok'] -= 1
        profile = normalize(capture)
        self.assertEqual(profile['sections']['identity']['fields']['name']['state'], 'notCaptured')
        self.assertIs(profile['sections']['spells']['entries']['116']['fields']['isPassive']['value'], False)

    def test_history_deduplicates_and_retains(self):
        with tempfile.TemporaryDirectory() as output:
            first = import_snapshot(self.capture, output)
            renamed = {**self.capture, 'source': 'copied-again.lua'}
            self.assertEqual(first['snapshotId'], import_snapshot(renamed, output)['snapshotId'])
            second = copy.deepcopy(self.capture)
            second['capturedAt'] += 1
            import_snapshot(second, output)
            history = json.loads((Path(output) / 'history.json').read_text())
            self.assertEqual(len(history['snapshots']), 2)
            self.assertTrue((Path(output) / first['evidenceFile']).exists())

    def test_no_guid_rejected(self):
        capture = copy.deepcopy(self.capture)
        q = next(q for q in capture['queries'] if q['path'] == '_G.UnitGUID')
        q['returns'] = [{'type':'string', 'restricted':True}]
        q['hasRestrictedValues'] = True
        capture['statistics']['restrictedQueries'] += 1
        with self.assertRaises(ValueError): normalize(capture)

    def test_multiple_characters_keep_identity_power_and_professions(self):
        history = json.loads((DIST / 'history.json').read_text())
        latest = {}
        for entry in history['snapshots']:
            profile = json.loads((DIST / entry['profileFile']).read_text())
            latest[profile['sections']['identity']['fields']['name']['value']] = profile
        for name, race, class_name, level, power, profession in [
            ('Ett','Human','Mage',14,'MANA','171'),
            ('Lilalx','Dwarf','Priest',10,'MANA','197'),
            ('Brumboldt','Gnome','Warrior',21,'RAGE','202'),
        ]:
            sections = latest[name]['sections']
            self.assertEqual(sections['identity']['fields']['race']['value'], race)
            self.assertEqual(sections['identity']['fields']['class']['value'], class_name)
            self.assertEqual(sections['identity']['fields']['level']['value'], level)
            self.assertEqual(sections['stats']['fields']['powerType']['value'], power)
            self.assertIn(profession, sections['professions']['entries'])
        self.assertEqual(len({p['characterGUID'] for p in latest.values()}), 3)

if __name__ == '__main__': unittest.main()
