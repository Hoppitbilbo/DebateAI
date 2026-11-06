import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { draftOf, type AssignmentDraft } from "@/features/teacher/assignmentDraft";
import AssignmentFields from "./AssignmentFields";

// The teacher's vocabulary choices (P2): level and words to practise.

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("@/services/aiClient", () => ({ useAiClient: () => ({}) }));

afterEach(cleanup);

const renderFields = (initial: AssignmentDraft) => {
  const seen: AssignmentDraft[] = [];
  const Harness = () => {
    const [draft, setDraft] = useState(initial);
    return <AssignmentFields draft={draft} onChange={(d) => { seen.push(d); setDraft(d); }} />;
  };
  render(<Harness />);
  return () => seen[seen.length - 1];
};

describe("AssignmentFields vocabulary", () => {
  it("saves the words to practise as a clean list, keeping what is being typed", () => {
    const last = renderFields(draftOf());
    const input = screen.getByLabelText("Parole da far usare") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ingegno, Fecondo, ingegno," } });
    expect(last().config.targetWords).toEqual(["ingegno", "Fecondo"]);
    expect(input.value).toBe("ingegno, Fecondo, ingegno,");
    fireEvent.change(input, { target: { value: " " } });
    expect(last().config.targetWords).toBeUndefined();
  });

  it("shows a list that arrives after the form (the saved assignment loading)", () => {
    const { rerender } = render(<AssignmentFields draft={draftOf()} onChange={vi.fn()} />);
    rerender(<AssignmentFields draft={{ ...draftOf(), config: { targetWords: ["ingegno", "fecondo"] } }} onChange={vi.fn()} />);
    expect((screen.getByLabelText("Parole da far usare") as HTMLInputElement).value).toBe("ingegno, fecondo");
  });

  it("shows the saved level and list", () => {
    renderFields({ ...draftOf(), config: { vocabulary: "advanced", targetWords: ["ingegno", "fecondo"] } });
    expect((screen.getByLabelText("Parole da far usare") as HTMLInputElement).value).toBe("ingegno, fecondo");
    expect(screen.getByLabelText("Livello del vocabolario").textContent).toContain("Ricco");
  });
});
