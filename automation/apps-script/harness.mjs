/* =========================================================
   Simulador de Apps Script para pruebas locales (node --test).
   Carga LeadAgent.js en un contexto aislado con versiones falsas de
   SpreadsheetApp, MailApp, PropertiesService, LockService, etc.
   Permite inyectar fallas para probar reintentos y alertas.
========================================================= */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = fs.readFileSync(path.join(DIR, "LeadAgent.js"), "utf8");
/* Archivos adicionales del mismo proyecto de Apps Script (mismo ámbito global). */
const EXTRA_FILES = { opportunities: "OpportunityAgent.js" };

class MockRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    Object.assign(this, { sheet, row, col, numRows, numCols });
  }
  setValues(values) {
    if (this.sheet.failSetValues > 0) {
      this.sheet.failSetValues -= 1;
      throw new Error("Service Spreadsheets timed out (simulado)");
    }
    values.forEach((rowValues, i) => {
      const r = this.row - 1 + i;
      while (this.sheet.values.length <= r) this.sheet.values.push([]);
      rowValues.forEach((v, j) => {
        this.sheet.values[r][this.col - 1 + j] = v;
      });
    });
    return this;
  }
  getValues() {
    return this.sheet.values.slice(this.row - 1, this.row - 1 + this.numRows).map((r) => r.slice(this.col - 1, this.col - 1 + this.numCols));
  }
  setFontWeight() { return this; }
  setDataValidation() { return this; }
}

class MockSheet {
  constructor(name, values = []) {
    this.name = name;
    this.values = values.map((r) => [...r]);
    this.failGetValues = 0;
    this.failSetValues = 0;
  }
  getName() { return this.name; }
  getDataRange() {
    return {
      getValues: () => {
        if (this.failGetValues > 0) {
          this.failGetValues -= 1;
          throw new Error("Service Spreadsheets failed (simulado)");
        }
        return this.values.length ? this.values.map((r) => [...r]) : [[""]];
      },
    };
  }
  getLastRow() { return this.values.length; }
  getLastColumn() { return this.values.reduce((m, r) => Math.max(m, r.length), 0); }
  getMaxRows() { return Math.max(1000, this.values.length); }
  getRange(row, col, numRows, numCols) { return new MockRange(this, row, col, numRows, numCols); }
  appendRow(row) { this.values.push([...row]); return this; }
  setFrozenRows() { return this; }
  deleteRows(start, count) { this.values.splice(start - 1, count); return this; }
  clearContents() { this.values = []; return this; }
}

export function toSheetValues(rows) {
  /* Convierte timestamps ISO a Date, como los entrega Google Sheets. */
  return rows.map((row, i) => (i === 0 ? row : row.map((v, j) => (j === 0 && typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : v))));
}

export function createAppsScriptEnv({ sheets = {}, props = {}, lockAvailable = true, openFailures = 0, missingSpreadsheet = false, extra = [], fetch = null } = {}) {
  const sheetMap = new Map(Object.entries(sheets).map(([name, values]) => [name, new MockSheet(name, values)]));
  const properties = { ...props };
  const emails = [];
  const sleeps = [];
  const triggers = [];
  const logs = [];
  let remainingOpenFailures = openFailures;

  const spreadsheet = {
    getSheetByName: (name) => sheetMap.get(name) || null,
    insertSheet: (name) => {
      const s = new MockSheet(name);
      sheetMap.set(name, s);
      return s;
    },
    getUrl: () => "https://docs.google.com/spreadsheets/d/MOCK/edit",
  };

  const validationBuilder = () => {
    const b = { requireValueInList: () => b, setAllowInvalid: () => b, build: () => ({}) };
    return b;
  };

  const triggerBuilder = (handler) => {
    const t = { handler };
    const chain = {
      timeBased: () => chain,
      everyMinutes: (n) => ((t.everyMinutes = n), chain),
      everyDays: (n) => ((t.everyDays = n), chain),
      nearMinute: (n) => ((t.nearMinute = n), chain),
      onWeekDay: (d) => ((t.weekDay = d), chain),
      atHour: (h) => ((t.atHour = h), chain),
      create: () => {
        const trig = { getHandlerFunction: () => handler, ...t };
        triggers.push(trig);
        return trig;
      },
    };
    return chain;
  };

  const fetches = [];
  const sandbox = {
    Date,
    JSON,
    UrlFetchApp: {
      fetch: (url, options) => {
        fetches.push(url);
        const res = fetch ? fetch(url, options) : { code: 404, body: "" };
        if (res instanceof Error) throw res;
        return { getResponseCode: () => res.code, getContentText: () => res.body };
      },
    },
    console: { log: (m) => logs.push(["log", String(m)]), warn: (m) => logs.push(["warn", String(m)]), error: (m) => logs.push(["error", String(m)]) },
    SpreadsheetApp: {
      openById: () => {
        if (missingSpreadsheet) throw new Error("No se encontró la hoja (simulado)");
        if (remainingOpenFailures > 0) {
          remainingOpenFailures -= 1;
          throw new Error("Service unavailable (simulado)");
        }
        return spreadsheet;
      },
      newDataValidation: validationBuilder,
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in properties ? properties[k] : null),
        setProperty: (k, v) => { properties[k] = String(v); },
      }),
    },
    Session: { getEffectiveUser: () => ({ getEmail: () => "owner@example.com" }) },
    LockService: { getScriptLock: () => ({ tryLock: () => lockAvailable, releaseLock: () => {} }) },
    MailApp: { sendEmail: (msg) => emails.push(msg) },
    Utilities: { sleep: (ms) => sleeps.push(ms) },
    ScriptApp: {
      getProjectTriggers: () => [...triggers],
      deleteTrigger: (t) => triggers.splice(triggers.indexOf(t), 1),
      newTrigger: triggerBuilder,
      WeekDay: { MONDAY: "MONDAY" },
    },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(SOURCE, context, { filename: "LeadAgent.js" });
  extra.forEach((name) => {
    const file = EXTRA_FILES[name];
    vm.runInContext(fs.readFileSync(path.join(DIR, file), "utf8"), context, { filename: file });
  });

  return {
    gas: context,
    sheet: (name) => sheetMap.get(name),
    sheets: sheetMap,
    properties,
    emails,
    sleeps,
    triggers,
    logs,
    fetches,
  };
}
