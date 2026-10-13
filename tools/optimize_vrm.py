"""Shrink a VRM/GLB for the web: downscale embedded textures and re-encode them as WebP
(EXT_texture_webp). Geometry, skinning, spring bones and VRM metadata are left untouched.

usage: python tools/optimize_vrm.py input.vrm output.vrm [max_texture_size] [webp_quality]
"""
import io
import json
import struct
import sys

from PIL import Image


def read_glb(data):
    magic, version, _ = struct.unpack('<4sII', data[:12])
    if magic != b'glTF':
        raise ValueError('not a GLB/VRM file')
    off, chunks = 12, {}
    while off < len(data):
        clen, ctype = struct.unpack('<II', data[off:off + 8])
        chunks[ctype] = data[off + 8:off + 8 + clen]
        off += 8 + clen
    return json.loads(chunks[0x4E4F534A]), chunks.get(0x004E4942, b'')


def write_glb(doc, binary):
    js = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    js += b' ' * (-len(js) % 4)
    binary = bytes(binary) + b'\0' * (-len(binary) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    return (struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js
            + struct.pack('<II', len(binary), 0x004E4942) + binary)


def reencode(blob, max_size, quality):
    im = Image.open(io.BytesIO(blob))
    im.load()
    has_alpha = im.mode in ('RGBA', 'LA', 'P') and 'A' in im.convert('RGBA').getbands()
    im = im.convert('RGBA' if has_alpha else 'RGB')
    if has_alpha and im.getchannel('A').getextrema() == (255, 255):
        im = im.convert('RGB')  # alpha channel present but unused
    if max(im.size) > max_size:
        im.thumbnail((max_size, max_size), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, 'WEBP', quality=quality, method=6)
    return out.getvalue()


def strip_morphs(doc):
    """Drop every morph target (facial expressions) and prune the data nobody references."""
    for mesh in doc.get('meshes', []):
        mesh.pop('weights', None)
        (mesh.get('extras') or {}).pop('targetNames', None)
        for prim in mesh['primitives']:
            prim.pop('targets', None)
            (prim.get('extras') or {}).pop('targetNames', None)
    vrm0 = doc.get('extensions', {}).get('VRM')
    if vrm0:
        for group in vrm0.get('blendShapeMaster', {}).get('blendShapeGroups', []):
            group['binds'] = []
    # accessors still in use
    used_acc = set()
    for mesh in doc.get('meshes', []):
        for prim in mesh['primitives']:
            used_acc.update(prim['attributes'].values())
            if 'indices' in prim:
                used_acc.add(prim['indices'])
    for skin in doc.get('skins', []):
        if 'inverseBindMatrices' in skin:
            used_acc.add(skin['inverseBindMatrices'])
    acc_map = {old: new for new, old in enumerate(sorted(used_acc))}
    accessors = [doc['accessors'][old] for old in sorted(used_acc)]
    used_bv = {a['bufferView'] for a in accessors if 'bufferView' in a}
    used_bv |= {img['bufferView'] for img in doc.get('images', []) if 'bufferView' in img}
    bv_map = {old: new for new, old in enumerate(sorted(used_bv))}
    doc['bufferViews'] = [doc['bufferViews'][old] for old in sorted(used_bv)]
    for a in accessors:
        if 'bufferView' in a:
            a['bufferView'] = bv_map[a['bufferView']]
    doc['accessors'] = accessors
    for img in doc.get('images', []):
        if 'bufferView' in img:
            img['bufferView'] = bv_map[img['bufferView']]
    for mesh in doc.get('meshes', []):
        for prim in mesh['primitives']:
            prim['attributes'] = {k: acc_map[v] for k, v in prim['attributes'].items()}
            if 'indices' in prim:
                prim['indices'] = acc_map[prim['indices']]
    for skin in doc.get('skins', []):
        if 'inverseBindMatrices' in skin:
            skin['inverseBindMatrices'] = acc_map[skin['inverseBindMatrices']]
    return bv_map


def optimize(src, dst, max_size=1024, quality=80, no_morphs=False):
    doc, binary = read_glb(open(src, 'rb').read())
    if no_morphs:
        old_views = list(doc['bufferViews'])
        bv_map = strip_morphs(doc)
        # bufferViews were re-listed; their byteOffsets still point into the original binary
        inv = {new: old for old, new in bv_map.items()}
        doc['bufferViews'] = [dict(old_views[inv[i]]) for i in range(len(doc['bufferViews']))]
    images = doc.get('images', [])
    image_views = {img['bufferView']: i for i, img in enumerate(images) if 'bufferView' in img}
    new_bin = bytearray()
    for i, bv in enumerate(doc['bufferViews']):
        start = bv.get('byteOffset', 0)
        blob = binary[start:start + bv['byteLength']]
        if i in image_views:
            blob = reencode(blob, max_size, quality)
            images[image_views[i]]['mimeType'] = 'image/webp'
        new_bin += b'\0' * (-len(new_bin) % 4)
        bv['byteOffset'] = len(new_bin)
        bv['byteLength'] = len(blob)
        new_bin += blob
    doc['buffers'][0]['byteLength'] = len(new_bin)
    # point every texture at its (now WebP) image through EXT_texture_webp
    for tex in doc.get('textures', []):
        if 'source' in tex:
            tex.setdefault('extensions', {})['EXT_texture_webp'] = {'source': tex['source']}
    used = doc.setdefault('extensionsUsed', [])
    if 'EXT_texture_webp' not in used:
        used.append('EXT_texture_webp')
    open(dst, 'wb').write(write_glb(doc, new_bin))
    return doc


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    size = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
    q = int(sys.argv[4]) if len(sys.argv) > 4 else 80
    optimize(src, dst, size, q, no_morphs='--no-morphs' in sys.argv)
