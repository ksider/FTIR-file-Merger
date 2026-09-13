#!/usr/bin/env python3
"""
peak_pick.py — автопоиск пиков в FTIR-спектре (только stdlib).

Вход: CSV/TSV, две колонки — волновое число (cm-1) и сигнал.
Сигнал: поглощение (пики вверх) или %T (пики вниз, флаг --transmittance).

Примеры:
  python peak_pick.py spectrum.csv
  python peak_pick.py spectrum.csv --transmittance --thresh 0.03 --top 30
  python peak_pick.py spectrum.csv --min-sep 10 --max-nu 1800

Вывод: таблица пиков (ν, отн. интенсивность, класс s/m/w, ширина FWHM)
и готовая строка «Пики: …» для вставки в чат с ИИ.
"""
import argparse, csv, math, sys


def read_xy(path):
    rows = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        sample = f.read(4096); f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel_tab
        for rec in csv.reader(f, dialect):
            if len(rec) < 2:
                continue
            try:
                x = float(rec[0].replace(",", "."))
                y = float(rec[1].replace(",", "."))
            except ValueError:
                continue  # заголовок / текст
            rows.append((x, y))
    if len(rows) < 5:
        sys.exit("Ошибка: прочитано <5 точек данных.")
    rows.sort(key=lambda p: p[0], reverse=True)  # 4000 -> 400
    return [p[0] for p in rows], [p[1] for p in rows]


def smooth(y, w):
    h, n, out = w // 2, len(y), []
    for i in range(n):
        lo, hi = max(0, i - h), min(n, i + h + 1)
        out.append(sum(y[lo:hi]) / (hi - lo))
    return out


def find_peaks(x, y, k, thresh, min_sep):
    n = len(y)
    cand = []
    for i in range(1, n - 1):
        if y[i] < y[i - 1] or y[i] < y[i + 1]:
            continue
        lo, hi = max(0, i - k), min(n, i + k + 1)
        if y[i] != max(y[lo:hi]):
            continue
        if y[i] - min(y[lo:hi]) >= thresh:
            cand.append((i, y[i] - min(y[lo:hi])))
    cand.sort(key=lambda c: c[1], reverse=True)  # жадный отбор по высоте
    keep = []
    for i, _ in cand:
        if all(abs(x[i] - x[j]) >= min_sep for j in keep):
            keep.append(i)
    keep.sort(key=lambda i: x[i], reverse=True)
    return keep


def fwhm(x, y, i):
    lo, hi = max(0, i - 25), min(len(y), i + 25)
    base = min(y[lo:hi])
    half = base + (y[i] - base) / 2.0
    l = i
    while l > 0 and y[l] > half:
        l -= 1
    r = i
    while r < len(y) - 1 and y[r] > half:
        r += 1
    return abs(x[r] - x[l])


def main():
    ap = argparse.ArgumentParser(description="Поиск пиков в FTIR-спектре")
    ap.add_argument("file")
    ap.add_argument("--transmittance", action="store_true",
                    help="сигнал в %%T (переводится в поглощение)")
    ap.add_argument("--thresh", type=float, default=0.03,
                    help="мин. заметность (поглощение), default 0.03")
    ap.add_argument("--window", type=int, default=7,
                    help="окно сглаживания, точек, default 7")
    ap.add_argument("--min-sep", type=float, default=8.0,
                    help="мин. разнос пиков, cm-1, default 8")
    ap.add_argument("--top", type=int, default=0, help="оставить N сильнейших")
    ap.add_argument("--max-nu", type=float, default=1e9,
                    help="игнорировать пики выше, cm-1 (напр. 1800)")
    args = ap.parse_args()

    x, y = read_xy(args.file)
    if args.transmittance:
        if min(y) <= 0:
            sys.exit("Ошибка: %T должен быть > 0.")
        y = [math.log10(100.0 / v) for v in y]  # A = log10(100/%T)
    ys = smooth(y, max(3, args.window | 1))

    idx = find_peaks(x, ys, max(2, args.window), args.thresh, args.min_sep)
    if args.max_nu < 1e9:
        idx = [i for i in idx if x[i] <= args.max_nu]
    if not idx:
        sys.exit("Пики не найдены; уменьшите --thresh.")

    ymax = max(ys[i] for i in idx)
    results = []
    for i in idx:
        rel = ys[i] / ymax * 100.0
        s = "s" if rel >= 70 else ("m" if rel >= 30 else "w")
        w = fwhm(x, ys, i)
        br = "br" if w >= 60 else ("sharp" if w <= 20 else "")
        results.append((x[i], rel, s, w, br))

    if args.top:
        results.sort(key=lambda r: r[1], reverse=True)
        results = results[:args.top]
        results.sort(key=lambda r: r[0], reverse=True)

    print(f"{'cm-1':>9}  {'отн.%':>6}  {'S/M/W':<5}  {'FWHM':>6}  форма")
    for nu, rel, s, w, br in results:
        print(f"{nu:9.1f}  {rel:6.0f}  {s:<5}  {w:6.0f}  {br}")

    brief = ", ".join(f"{nu:.0f}({br},{s})" if br else f"{nu:.0f}({s})"
                      for nu, _, s, _, br in results)
    print("\nСтрока для ИИ:\nПики (cm-1): " + brief)


if __name__ == "__main__":
    main()

    