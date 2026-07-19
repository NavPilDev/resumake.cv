"use client";

import { forwardRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { StreamLanguage, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { useTheme } from "next-themes";

const latexLanguage = StreamLanguage.define(stex);
const latexHighlighting = syntaxHighlighting(defaultHighlightStyle, { fallback: true });

interface LatexEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  className?: string;
}

/** Editable LaTeX source view for the "My Resumes" LaTeX/Form toggle —
 * wraps @uiw/react-codemirror with STeX (LaTeX) syntax highlighting, a line
 * number gutter, and CodeMirror's built-in edit history (wired to the
 * Undo/Redo toolbar buttons in ResumesBuilder via the forwarded ref). */
export const LatexEditor = forwardRef<ReactCodeMirrorRef, LatexEditorProps>(function LatexEditor(
  { value, onChange, readOnly, className },
  ref
) {
  const { resolvedTheme } = useTheme();

  return (
    <CodeMirror
      ref={ref}
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      extensions={[latexLanguage, latexHighlighting]}
      basicSetup={{ lineNumbers: true, highlightActiveLine: true, history: true, foldGutter: false }}
      className={className}
      style={{ fontSize: "0.8rem", height: "100%" }}
      height="100%"
    />
  );
});
