/**
 * Removes // and /* *\/ comments from JS/TS source without corrupting string
 * literals that happen to contain "//" (e.g. "https://api.openai.com"). Only
 * used by tests that scan source for forbidden strings, so a comment
 * explaining why something is avoided doesn't itself trip the scan.
 */
export function stripJsComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  let inString: '"' | "'" | "`" | null = null;

  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];

    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (ch === inString) inString = null;
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "/") {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/** Removes SQL "-- comment" lines without corrupting single-quoted string literals. */
export function stripSqlComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  let inString = false;

  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];

    if (inString) {
      out += ch;
      if (ch === "'") inString = false;
      i += 1;
      continue;
    }

    if (ch === "'") {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === "-" && next === "-") {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}
