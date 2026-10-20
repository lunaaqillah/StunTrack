"""Membuat backend/data/clustering_insights.json (profil hierarkis 3 cluster
resmi: tinggi, sedang, rendah) dari data item asli research/dataa.xlsx.

Alur sama dengan notebook: MSI -> standardisasi item -> rata-rata per variabel
-> K-Means (k=3, random_state=42). Cluster sedang dihitung sebagai SATU cluster
utuh (tidak dipecah).

Jalankan dari root proyek:  python research/generate_clustering_insights.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import norm
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / 'research' / 'dataa.xlsx'
VARDB = ROOT / 'backend' / 'data' / 'variable_database.json'
OUT = ROOT / 'backend' / 'data' / 'clustering_insights.json'
K, SEED = 3, 42
VARS = [f'X{i}' for i in range(1, 11)]


def msi(series):
    freq = series.value_counts().reindex(np.arange(1, 6), fill_value=0).astype(float)
    prop = freq / freq.sum()
    cum = prop.cumsum()
    lower = cum.shift(fill_value=0)
    z_lo = np.where(lower == 0, -np.inf, norm.ppf(lower))
    z_up = np.where(cum == 1, np.inf, norm.ppf(cum))
    scale = (norm.pdf(z_lo) - norm.pdf(z_up)) / prop.replace(0, np.nan)
    return series.map((scale - scale.min() + 1).to_dict())


raw = pd.read_excel(XLSX, sheet_name='DATA ASLI', header=None)
df = raw.iloc[2:].copy()
df.columns = [f'{a}_{b}' for a, b in zip(raw.iloc[0], raw.iloc[1])]
df = df.reset_index(drop=True).apply(pd.to_numeric, errors='coerce')
groups = {v: [c for c in df.columns if c.startswith(f'{v}_')] for v in VARS}

msi_df = pd.DataFrame({c: msi(df[c]) for v in VARS for c in groups[v]})
z_items = pd.DataFrame(StandardScaler().fit_transform(msi_df), columns=msi_df.columns)
x_z = pd.DataFrame({v: z_items[groups[v]].mean(axis=1) for v in VARS})

km = KMeans(n_clusters=K, random_state=SEED, n_init=10).fit(x_z)
labels = km.labels_ + 1
centroid_mean = {c: float(km.cluster_centers_[c - 1].mean()) for c in range(1, K + 1)}
order = sorted(centroid_mean, key=centroid_mean.get)
cluster_to_risk = {order[0]: 'rendah', order[-1]: 'tinggi', order[1]: 'sedang'}
label_of = {'tinggi': 'Risiko Tinggi', 'sedang': 'Risiko Sedang', 'rendah': 'Risiko Rendah'}
seg = pd.Series(labels).map(cluster_to_risk)

db = json.loads(VARDB.read_text(encoding='utf-8'))
var_info = {v['id_variabel']: v['keterangan'] for v in db['variables'] if v['id_variabel'].startswith('X')}
ind_info = [x for x in db['indicators'] if x['id_variabel'].startswith('X')]
item_info = [x for x in db['items'] if x['id_variabel'].startswith('X')]


def pct(m):
    return round(float(m) / 5 * 100, 2)  # capaian = rata-rata skor asli / 5 x 100%


def row(code, label, idx, cols):
    z = float(z_items.loc[idx, cols].mean().mean())
    r = float(df.loc[idx, cols].mean().mean())
    return dict(id=code.lower(), code=code, label=label, z_mean=round(z, 6),
                raw_mean=round(r, 4), percentage=pct(r))


def profile(idx, label):
    variables = sorted((row(v, var_info[v], idx, groups[v]) for v in VARS),
                       key=lambda x: x['z_mean'], reverse=True)
    for var in variables[:3]:
        v = var['code']
        inds = sorted(
            (row(i['id_indikator'], i['keterangan'], idx,
                 [c for c in groups[v] if c.split('_', 1)[1].startswith(i['id_indikator'] + '.')])
             for i in ind_info if i['id_variabel'] == v),
            key=lambda x: x['z_mean'], reverse=True)
        top_ind = inds[0]
        items = []
        for it in item_info:
            if it['id_variabel'] != v or it['id_indikator'] != top_ind['code']:
                continue
            col = f"{v}_{it['id_item']}"
            items.append(dict(
                id=it['id_item'].lower(), code=it['id_item'], question=it['pertanyaan'],
                z_mean=round(float(z_items.loc[idx, col].mean()), 6),
                raw_mean=round(float(df.loc[idx, col].mean()), 4),
                percentage=pct(df.loc[idx, col].mean())))
        items.sort(key=lambda x: x['z_mean'], reverse=True)
        top_ind['top_item'] = items[0]
        var['top_indicator'] = top_ind
    return dict(label=label, n=int(len(idx)),
                percentage_of_total=round(len(idx) / len(df) * 100, 2),
                top_variables=variables[:3], all_variables=variables)


profiles = {k: profile(seg.index[seg == k], label_of[k]) for k in ('tinggi', 'sedang', 'rendah')}

OUT.write_text(json.dumps({
    'method': 'K-Means', 'random_state': SEED, 'k': K, 'total_responden': len(df),
    'cluster_to_risk': {str(c): label_of[cluster_to_risk[c]] for c in sorted(cluster_to_risk)},
    'profiles': profiles,
}, ensure_ascii=False, indent=2), encoding='utf-8')
print('Tersimpan:', OUT, {k: v['n'] for k, v in profiles.items()})
