import ExcelJS from "exceljs";

export interface Col<T> { header: string; width?: number; value: (row: T) => string | number | boolean | Date | null | undefined }
export const EXPORT_ROW_CAP = 10_000; // POC-Profile: exports are generated in the request, capped

/** Excel/CSV formula injection: a cell that starts with = + - @ (or tab/CR) would be run as a formula when opened. */
export const safeCell = (v: unknown): unknown => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export async function toXlsx<T>(sheetName: string, cols: Col<T>[], rows: T[], createdAt?: Date): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Moz Discounts"; if (createdAt) wb.created = createdAt;
  const ws = wb.addWorksheet(sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, width: c.width ?? 18 }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows.slice(0, EXPORT_ROW_CAP)) ws.addRow(cols.map((c) => safeCell(c.value(r)) as ExcelJS.CellValue));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
