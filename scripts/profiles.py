"""Version 1 normalized profiles; raw query evidence stays in immutable sidecars."""
import hashlib
import json
from pathlib import Path
from import_dump import validate_character

STATES = ('value', 'empty', 'restricted', 'unavailable', 'error', 'notCaptured', 'partial')

def public(node):
    if not node or node.get('restricted') or node.get('truncated'): return None
    return node.get('value')

def observation(q=None, qi=None, slot=0, key=None):
    result = {'state': 'notCaptured', 'evidence': []}
    if q is None: return result
    ref = {'queryIndex': qi, 'returnIndex': slot, 'functionPath': q['path'],
           'capturedAt': q['capturedAt']}
    if key is not None: ref['tableField'] = key
    result['evidence'] = [ref]
    if q['status'] != 'ok':
        result['state'] = q['status']
        return result
    nodes = q.get('returns', [])
    node = nodes[slot] if slot < len(nodes) else {'type': 'nil'}
    if key is not None and node.get('type') == 'table' and not node.get('restricted'):
        parent = node
        node = next((e['value'] for e in parent.get('entries', []) if public(e['key']) == key), None)
        if node is None:
            result['state'] = 'partial' if parent.get('truncated') else 'notCaptured'
            return result
    if node.get('restricted'): result['state'] = 'restricted'
    elif node.get('truncated'): result['state'] = 'partial'
    elif node['type'] == 'nil': result['state'] = 'empty'
    elif 'value' in node:
        result.update(state='value', value=node['value'])
    else: result['state'] = 'partial'
    return result

def normalize(capture):
    validate_character(capture)
    queries = capture['queries']
    def find(path, args=None):
        for i, q in enumerate(queries):
            if q['path'] == '_G.' + path and (args is None or [public(n) for n in q['arguments']] == args):
                return q, i
        return None, None
    def get(path, slot=0, args=None):
        q, i = find(path, args)
        return observation(q, i, slot)
    guid = get('UnitGUID')
    if guid['state'] != 'value' or not isinstance(guid['value'], str) or not guid['value']:
        raise ValueError('Cannot index a character snapshot without a public GUID')
    digest = hashlib.sha256(json.dumps({k:v for k,v in capture.items() if k != 'source'},
        sort_keys=True, separators=(',', ':')).encode()).hexdigest()[:16]
    snapshot_id = hashlib.sha256(guid['value'].encode()).hexdigest()[:12] + '-' + str(capture['capturedAt']) + '-' + digest
    sections = {name: {'fields': {}, 'entries': {}, 'coverage': 'observedOnly'} for name in
                ('identity', 'stats', 'equipment', 'professions', 'spells', 'quests', 'reputation')}
    identity = sections['identity']['fields']
    # Count getters describe visible enumeration, not universal completeness.
    for section, paths in {
        'spells': ('C_SpellBook.GetNumSpellBookSkillLines','GetNumSpellTabs'),
        'quests': ('C_QuestLog.GetNumQuestLogEntries','GetNumQuestLogEntries'),
        'reputation': ('C_Reputation.GetNumFactions','GetNumFactions'),
    }.items():
        path = next((p for p in paths if find(p)[0] is not None), paths[0])
        sections[section]['fields']['enumeratedLineCount'] = get(path)
    for name, path, slot in [('guid','UnitGUID',0),('name','UnitName',0),('realm','GetRealmName',0),
                             ('level','UnitLevel',0),('class','UnitClass',0),('classToken','UnitClass',1),
                             ('race','UnitRace',0),('faction','UnitFactionGroup',0),('sex','UnitSex',0)]:
        identity[name] = get(path, slot)
    stats = sections['stats']['fields']
    for name, path, slot in [('health','UnitHealth',0),('maxHealth','UnitHealthMax',0),
                             ('power','UnitPower',0),('maxPower','UnitPowerMax',0),('powerType','UnitPowerType',1),
                             ('xp','UnitXP',0),('maxXP','UnitXPMax',0),('restedXP','GetXPExhaustion',0),
                             ('moneyCopper','GetMoney',0),('armorBase','UnitArmor',0),('armorEffective','UnitArmor',1),
                             ('attackPowerBase','UnitAttackPower',0)]: stats[name] = get(path, slot)
    for index, name in enumerate(('strength','agility','stamina','intellect','spirit'), 1):
        stats[name] = get('UnitStat', args=['player', index])
    for slot in range(1, 20):
        sections['equipment']['entries'][str(slot)] = {'fields': {
            'itemID': get('GetInventoryItemID', args=['player', slot]),
            'link': get('GetInventoryItemLink', args=['player', slot]),
            'quality': get('GetInventoryItemQuality', args=['player', slot]),
            'durability': get('GetInventoryItemDurability', args=[slot]),
            'maxDurability': get('GetInventoryItemDurability', 1, args=[slot])}}
    # Only GetProfessions indices establish membership, never global skill-line metadata.
    membership, membership_index = find('GetProfessions')
    membership_count = observation(membership, membership_index)
    if membership and membership['status'] == 'ok':
        if any(n.get('restricted') or n.get('truncated') for n in membership.get('returns', [])):
            membership_count = {**membership_count, 'state':'partial'}
            membership_count.pop('value', None)
        else:
            membership_count.update(state='value', value=len({public(n) for n in membership.get('returns', []) if public(n) is not None}))
    sections['professions']['fields']['reportedProfessionCount'] = membership_count
    indices = {public(n) for n in membership.get('returns', [])} if membership and membership['status'] == 'ok' else set()
    for i, q in enumerate(queries):
        if q['path'] == '_G.GetProfessionInfo' and public(q['arguments'][0]) in indices and q['status'] == 'ok':
            id_node = observation(q, i, 6)
            if id_node['state'] != 'value': continue
            sections['professions']['entries'][str(id_node['value'])] = {'fields': {
                name: observation(q, i, slot) for name, slot in [('name',0),('rank',2),('maxRank',3),('skillLineID',6)]}}
    mappings = {
        '_G.C_SpellBook.GetSpellBookItemInfo': ('spells','spellID', ('name','spellID','subName','isPassive','iconID')),
        '_G.C_QuestLog.GetInfo': ('quests','questID', ('title','questID','level','difficultyLevel','frequency')),
        '_G.C_Reputation.GetFactionDataByIndex': ('reputation','factionID', ('name','factionID','currentStanding','reaction','currentReactionThreshold','nextReactionThreshold')),
    }
    for i, q in enumerate(queries):
        if q['path'] not in mappings or q['status'] != 'ok': continue
        section, id_key, names = mappings[q['path']]
        id_node = observation(q, i, key=id_key)
        if id_node['state'] != 'value' or not id_node['value']: continue
        if section in ('quests','reputation'):
            header = observation(q, i, key='isHeader')
            if header.get('value') is True: continue
        sections[section]['entries'][str(id_node['value'])] = {'fields': {
            name: observation(q, i, key=name) for name in names}}
    return {'schemaVersion': 1, 'snapshotId': snapshot_id, 'characterGUID': guid['value'],
            'capturedAt': capture['capturedAt'], 'captureStartedAt': capture['captureStartedAt'],
            'addonVersion': capture['addonVersion'], 'client': capture['client'],
            'source': capture.get('source', 'unknown'), 'evidenceFile': 'snapshots/' + snapshot_id + '.evidence.json',
            'sections': sections,
            'limitations': ['Collections are observed subsets; missing entries are never confirmed removals.',
                            'An empty equipment result is an observed empty result, not proof of unequipping.',
                            'Profile mappings cover modern structured collections; unmapped calls remain in raw evidence.',
                            'Spell entries represent spellbook entries including individual ranks.',
                            'Capture is not atomic; unavailable context and cache state may affect results.']}

def import_snapshot(capture, output):
    output = Path(output)
    profile = normalize(capture)
    target = output / 'snapshots'
    target.mkdir(parents=True, exist_ok=True)
    identifier = profile['snapshotId']
    history_path = output / 'history.json'
    history = json.loads(history_path.read_text()) if history_path.exists() else {'schemaVersion':1, 'snapshots':[]}
    if not any(s['snapshotId'] == identifier for s in history['snapshots']):
        (target / (identifier + '.json')).write_text(json.dumps(profile, ensure_ascii=True, indent=2), encoding='utf-8')
        (output / profile['evidenceFile']).write_text(json.dumps(capture, ensure_ascii=True, separators=(',',':')), encoding='utf-8')
        name = profile['sections']['identity']['fields']['name'].get('value', 'Unknown character')
        history['snapshots'].append({k:profile[k] for k in ('snapshotId','characterGUID','capturedAt','addonVersion','source')})
        history['snapshots'][-1].update(name=name, profileFile='snapshots/' + identifier + '.json')
    history['snapshots'].sort(key=lambda s:(s['capturedAt'],s['snapshotId']))
    temp = history_path.with_suffix('.tmp')
    temp.write_text(json.dumps(history, ensure_ascii=True, indent=2), encoding='utf-8')
    temp.replace(history_path)
    return profile
