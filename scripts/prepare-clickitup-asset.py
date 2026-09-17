"""Deterministic conversion of the inspected SketchUp DAE; never modifies the source.

Usage: python scripts/prepare-clickitup-asset.py path/to/clickitup.dae
Only the inspected source hash is accepted. Missing junction/door assemblies are
reported, not fabricated. No geometry compression/decoder or benchmark is used.
"""
import hashlib
import json
from pathlib import Path
import struct
import sys
import xml.etree.ElementTree as ET

SOURCE_HASH = '42b900bfe9ddd7d03511d43aadd0bdd9396342bfb3ca2e327af76769752ed8d8'
NS = {'c': 'http://www.collada.org/2005/11/COLLADASchema'}


def convert(source, output):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SOURCE_HASH:
        raise ValueError('Source changed: inspect geometry and update the converter explicitly.')
    doc = ET.fromstring(raw)
    unit = float(doc.find('c:asset/c:unit', NS).get('meter'))
    if doc.findtext('c:asset/c:up_axis', namespaces=NS) != 'Z_UP':
        raise ValueError('Expected Z_UP source')
    materials = {m.get('id'): m.get('name') for m in doc.findall('c:library_materials/c:material', NS)}
    bindings = {}
    for instance in doc.findall('.//c:instance_geometry', NS):
        bindings[instance.get('url')[1:]] = {
            m.get('symbol'): materials[m.get('target')[1:]]
            for m in instance.findall('.//c:instance_material', NS)
        }
    groups = {}
    source_bounds = []
    for geo in doc.findall('c:library_geometries/c:geometry', NS):
        mesh = geo.find('c:mesh', NS)
        sources = {}
        for s in mesh.findall('c:source', NS):
            array = list(map(float, s.findtext('c:float_array', namespaces=NS).split()))
            stride = int(s.find('c:technique_common/c:accessor', NS).get('stride'))
            sources[s.get('id')] = [array[i:i+stride] for i in range(0, len(array), stride)]
        vertices = {v.get('id'): v.find('c:input', NS).get('source')[1:] for v in mesh.findall('c:vertices', NS)}
        for triangles in mesh.findall('c:triangles', NS):
            inputs = triangles.findall('c:input', NS)
            stride = max(int(i.get('offset')) for i in inputs) + 1
            indices = list(map(int, triangles.findtext('c:p', namespaces=NS).split()))
            data = []
            for offset in range(0, len(indices), stride):
                vertex = {}
                for item in inputs:
                    semantic = item.get('semantic')
                    src = item.get('source')[1:]
                    values = sources[vertices.get(src, src)][indices[offset+int(item.get('offset'))]]
                    vertex[semantic] = values
                x, y, z = vertex['VERTEX'][:3]
                # Right-handed rotation about X: (X,Y,Z) -> (X,Z,-Y).
                pos = [x*unit, z*unit, -y*unit]
                source_bounds.append(pos)
                normal = vertex.get('NORMAL', [0, 0, 1])
                data.append((pos, [normal[0], normal[2], -normal[1]], vertex.get('TEXCOORD', [0, 0])[:2]))
            spans = {'ID6': 'upper-glass-span', 'ID14': 'top-rail-span', 'ID22': 'lower-glass-span'}
            name = spans.get(geo.get('id'))
            if not name:
                name = 'source-left-end' if sum(v[0][0] for v in data)/len(data) < .75 else 'source-right-end'
            material = bindings[geo.get('id')][triangles.get('material')]
            groups.setdefault((name, material), []).extend(data)
    low = [min(v[i] for v in source_bounds) for i in range(3)]
    high = [max(v[i] for v in source_bounds) for i in range(3)]
    bounds = [high[i]-low[i] for i in range(3)]
    if any(abs(a-b) > .00001 for a, b in zip(bounds, [1.5, 1.413, .18])):
        raise ValueError(f'Unexpected source bounds: {bounds}')
    center_z = (low[2]+high[2])/2
    gltf = {'asset': {'version': '2.0', 'generator': 'QuoteGenerator inspected DAE converter'},
            'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'clickitup', 'children': []}],
            'meshes': [], 'materials': [], 'accessors': [], 'bufferViews': [], 'buffers': []}
    binary = bytearray()

    def view(data, target=None):
        binary.extend(b'\0' * (-len(binary) % 4))
        obj = {'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data)}
        if target:
            obj['target'] = target
        gltf['bufferViews'].append(obj)
        binary.extend(data)
        return len(gltf['bufferViews'])-1

    def accessor(values, width, component=5126, kind=None):
        flat = [n for row in values for n in row]
        fmt = 'f' if component == 5126 else 'I'
        index = view(struct.pack('<'+fmt*len(flat), *flat), 34963 if component == 5125 else 34962)
        obj = {'bufferView': index, 'componentType': component, 'count': len(values), 'type': kind or f'VEC{width}'}
        if width == 3:
            obj['min'] = [min(v[i] for v in values) for i in range(3)]
            obj['max'] = [max(v[i] for v in values) for i in range(3)]
        gltf['accessors'].append(obj)
        return len(gltf['accessors'])-1

    texture = source.parent / 'clickitup' / 'Metal_Aluminum_Anodized.jpg'
    image_bytes = texture.read_bytes()
    gltf['images'] = [{'bufferView': view(image_bytes), 'mimeType': 'image/jpeg'}]
    gltf['textures'] = [{'source': 0}]
    material_indices = {}
    for name in sorted({key[1] for key in groups}):
        glass = 'Glass' in name
        color = [.58, .84, .91, .3] if glass else [.05, .06, .07, 1] if name == 'Color_009' else [.55, .60, .64, 1]
        m = {'name': name, 'pbrMetallicRoughness': {'baseColorFactor': color, 'metallicFactor': 0 if glass else .65, 'roughnessFactor': .12 if glass else .4}}
        if glass:
            m.update({'alphaMode': 'BLEND', 'doubleSided': True})
        if name == 'Metal_Aluminum_Anodized':
            m['pbrMetallicRoughness']['baseColorTexture'] = {'index': 0}
        material_indices[name] = len(gltf['materials'])
        gltf['materials'].append(m)
    report = {'sourceSha256': SOURCE_HASH, 'units': 'm', 'upAxis': 'y', 'referenceWidthM': 1.5,
              'boundsM': bounds, 'parts': {}, 'unverified': ['straight-shared', 'corner-90', 'verified-door-assembly', 'physical glass/rail clearances at other widths']}
    for name in sorted({key[0] for key in groups}):
        primitives = []
        part_positions = []
        for (part, material), rows in sorted(groups.items()):
            if part != name:
                continue
            unique, indices, lookup = [], [], {}
            for pos, normal, uv in rows:
                pos = [pos[0]-low[0], pos[1], pos[2]-center_z]
                part_positions.append(pos)
                key = tuple(pos+normal+uv)
                if key not in lookup:
                    lookup[key] = len(unique)
                    unique.append((pos, normal, uv))
                indices.append([lookup[key]])
            primitives.append({'attributes': {'POSITION': accessor([v[0] for v in unique], 3),
                                              'NORMAL': accessor([v[1] for v in unique], 3),
                                              'TEXCOORD_0': accessor([v[2] for v in unique], 2)},
                               'indices': accessor(indices, 1, 5125, 'SCALAR'), 'material': material_indices[material]})
        part_min = [min(v[i] for v in part_positions) for i in range(3)]
        part_max = [max(v[i] for v in part_positions) for i in range(3)]
        info = {'min': part_min, 'max': part_max}
        gltf['nodes'][0]['children'].append(len(gltf['nodes']))
        gltf['nodes'].append({'name': name, 'mesh': len(gltf['meshes']), 'extras': info})
        gltf['meshes'].append({'name': name, 'primitives': primitives})
        report['parts'][name] = info
    gltf['buffers'] = [{'byteLength': len(binary)}]
    payload = json.dumps(gltf, separators=(',', ':')).encode()
    payload += b' ' * (-len(payload) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    glb = struct.pack('<4sII', b'glTF', 2, 12+8+len(payload)+8+len(binary))
    glb += struct.pack('<I4s', len(payload), b'JSON')+payload+struct.pack('<I4s', len(binary), b'BIN\0')+binary
    output.mkdir(parents=True, exist_ok=True)
    (output/'clickitup-source.glb').write_bytes(glb)
    report['glbSha256'] = hashlib.sha256(glb).hexdigest()
    (output/'clickitup-source.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({'output': str(output), 'boundsM': bounds, 'parts': list(report['parts']), 'sourceUnchanged': hashlib.sha256(source.read_bytes()).hexdigest() == SOURCE_HASH}))


if __name__ == '__main__':
    convert(Path(sys.argv[1]), Path(__file__).resolve().parents[1]/'public/assets/visualization/v1')
