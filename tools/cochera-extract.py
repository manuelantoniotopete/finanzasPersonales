#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extrae la obra "Cochera" desde cochera.xlsx (hoja COCHERA) y genera un snippet
de consola (cochera-import.js) que agrega el proyecto a localStorage["finanzas:data"]
SIN borrar el resto de los datos de la app.

Sin dependencias externas: un .xlsx es un ZIP de XML, se parsea con stdlib.
Uso:  python tools/cochera-extract.py
"""

import sys
import zipfile
import json
import datetime
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "cochera.xlsx"
OUT = ROOT / "cochera-import.js"
SHEET_NAME = "COCHERA"

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

# Columnas (0-based) según fila 3 del Excel:
# A,B vacías | C=Monto | D=Quien? | E=Detalle | F=Método | G=Pagado | H=Categoria | I=Fecha | J=NOTA
COL_MONTO, COL_QUIEN, COL_DETALLE, COL_METODO, COL_CAT, COL_FECHA, COL_NOTA = 2, 3, 4, 5, 7, 8, 9


def col_to_idx(ref):
    c = "".join(ch for ch in ref if ch.isalpha())
    n = 0
    for ch in c:
        n = n * 26 + (ord(ch.upper()) - 64)
    return n - 1


def excel_date(serial):
    try:
        return (datetime.date(1899, 12, 30) + datetime.timedelta(days=int(float(serial)))).isoformat()
    except Exception:
        return ""


def load_shared_strings(z):
    ss = []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    for si in root.findall(M + "si"):
        ss.append("".join(t.text or "" for t in si.iter(M + "t")))
    return ss


def sheet_file_for(z, name):
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rid = None
    for s in wb.find(M + "sheets", ):
        if s.get("name") == name:
            rid = s.get(R + "id")
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    for rel in rels:
        if rel.get("Id") == rid:
            tgt = rel.get("Target")
            return "xl/" + tgt if not tgt.startswith("xl/") else tgt
    raise SystemExit(f"No se encontró la hoja {name!r}")


def read_rows(z, sheetfile, ss):
    root = ET.fromstring(z.read(sheetfile))
    data = root.find(M + "sheetData")
    rows = {}
    for row in data.findall(M + "row"):
        rn = int(row.get("r"))
        cells = {}
        for c in row.findall(M + "c"):
            ci = col_to_idx(c.get("r"))
            t = c.get("t")
            v = c.find(M + "v")
            val = ""
            if v is not None:
                val = ss[int(v.text)] if t == "s" else v.text
            else:
                isn = c.find(M + "is")
                if isn is not None:
                    val = "".join(x.text or "" for x in isn.iter(M + "t"))
            cells[ci] = (val or "").strip()
        rows[rn] = cells
    return rows


def norm(s):
    """Normaliza espacios (deja acentos)."""
    return " ".join((s or "").split())


def map_categoria(raw):
    r = (raw or "").upper().replace(".", "").replace(" ", "")
    if r == "MA":
        return "Material"
    if r == "MO":
        return "Mano de obra"
    return "Otros"


def map_metodo(raw):
    """Devuelve (metodo_app, etiqueta_tarjeta_o_None)."""
    r = norm(raw)
    low = r.lower()
    if low.startswith("transfer"):
        return "Transferencia", None
    if low.startswith("efectivo"):
        return "Efectivo", None
    if low.startswith("tdc") or "tarjeta" in low or "credito" in low or "crédito" in low:
        return "Tarjeta", r  # conserva el nombre exacto de la tarjeta para notas
    if not r:
        return "Efectivo", None
    return "Otro", r


def main():
    if not XLSX.exists():
        raise SystemExit(f"No existe {XLSX}")
    z = zipfile.ZipFile(XLSX)
    ss = load_shared_strings(z)
    sheetfile = sheet_file_for(z, SHEET_NAME)
    rows = read_rows(z, sheetfile, ss)

    movimientos = []
    proveedores_orden = []
    proveedores_set = set()
    total_salidas = 0.0
    fechas = []

    for rn in sorted(rows):
        if rn < 4:  # encabezados
            continue
        cells = rows[rn]
        monto_raw = cells.get(COL_MONTO, "")
        quien = norm(cells.get(COL_QUIEN, ""))
        try:
            monto = float(monto_raw)
        except (TypeError, ValueError):
            continue
        if monto <= 0 or not quien:
            continue  # salta totales y filas vacías

        concepto = norm(cells.get(COL_DETALLE, "").replace("\n", "; ").replace("\r", ""))
        categoria = map_categoria(cells.get(COL_CAT, ""))
        metodo, tarjeta = map_metodo(cells.get(COL_METODO, ""))
        fecha = excel_date(cells.get(COL_FECHA, ""))
        nota = norm(cells.get(COL_NOTA, ""))
        if tarjeta:
            nota = (tarjeta + (" · " + nota if nota else "")).strip()

        if fecha:
            fechas.append(fecha)
        total_salidas += monto

        movimientos.append({
            "tipo": "Salida",
            "categoria": categoria,
            "concepto": concepto or quien,
            "monto": round(monto, 2),
            "fecha": fecha,
            "proveedor": quien,
            "etapa": "",
            "metodo": metodo,
            "recibo": "",
            "notas": nota,
        })

        if quien not in proveedores_set:
            proveedores_set.add(quien)
            proveedores_orden.append(quien)

    total_salidas = round(total_salidas, 2)
    fecha_ini = min(fechas) if fechas else ""
    fecha_fin = max(fechas) if fechas else ""

    # Aportación sintética (Entrada) para que el saldo quede en 0 (obra ya pagada).
    aportacion = {
        "tipo": "Entrada",
        "categoria": "",
        "concepto": "Financiamiento de la obra (pagado)",
        "monto": total_salidas,
        "fecha": fecha_ini,
        "proveedor": "",
        "etapa": "",
        "metodo": "Otro",
        "recibo": "",
        "notas": "Generada al importar para reflejar la obra ya pagada (puedes borrarla).",
    }
    # La entrada va primero para que aparezca al inicio del historial.
    movimientos_final = [aportacion] + movimientos

    proveedores = [{"nombre": n, "oficio": "", "contacto": "", "notas": ""} for n in proveedores_orden]

    proyecto = {
        "nombre": "Cochera",
        "tipo": "Construcción",
        "estado": "Terminado",
        "presupuesto": 0,
        "fechaInicio": fecha_ini,
        "fechaMeta": fecha_fin,
        "ubicacion": "",
        "notas": "Importado de cochera.xlsx. Obra terminada y pagada.",
        "movimientos": movimientos_final,
        "etapas": [],
        "presupuestoCat": {},
        "proveedores": proveedores,
    }

    proyecto_json = json.dumps(proyecto, ensure_ascii=False, indent=2)

    snippet = f"""// ============================================================================
//  IMPORTAR OBRA "COCHERA" — pega TODO esto en la consola del navegador (F12)
//  estando ABIERTA la app de Finanzas. Agrega el proyecto SIN borrar tus datos.
//  Generado por tools/cochera-extract.py — {datetime.date.today().isoformat()}
// ============================================================================
(() => {{
  const KEY = "finanzas:data";
  const proyecto = {proyecto_json};
  const d = JSON.parse(localStorage.getItem(KEY) || "{{}}");
  d.proyectos = Array.isArray(d.proyectos) ? d.proyectos : [];
  if (d.proyectos.some((p) => p && p.nombre === proyecto.nombre)) {{
    alert("Ya existe un proyecto llamado 'Cochera'. No se agregó de nuevo.");
    return;
  }}
  d.proyectos.push(proyecto);
  localStorage.setItem(KEY, JSON.stringify(d));
  console.log("✅ Proyecto 'Cochera' agregado:", proyecto.movimientos.length, "movimientos.");
  location.reload();
}})();
"""

    OUT.write_text(snippet, encoding="utf-8")

    # Reporte
    salidas_n = len(movimientos)
    mat = round(sum(m["monto"] for m in movimientos if m["categoria"] == "Material"), 2)
    mo = round(sum(m["monto"] for m in movimientos if m["categoria"] == "Mano de obra"), 2)
    otros = round(sum(m["monto"] for m in movimientos if m["categoria"] == "Otros"), 2)
    print("=== Extracción Cochera ===")
    print(f"Movimientos (salidas): {salidas_n}")
    print(f"+ 1 aportación (entrada): {total_salidas}")
    print(f"Total gastado: {total_salidas}")
    print(f"  · Material:     {mat}")
    print(f"  · Mano de obra: {mo}")
    print(f"  · Otros:        {otros}")
    print(f"Rango fechas: {fecha_ini} - {fecha_fin}")
    print(f"Proveedores únicos: {len(proveedores)}")
    print(f"Archivo generado: {OUT}")


if __name__ == "__main__":
    main()
