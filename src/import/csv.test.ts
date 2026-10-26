import { describe, expect, it } from "vitest";
import { previewCsv, importLibrary } from "./csv";
import { emptyState } from "../domain/engine";
describe("CSV import", () => {
  it("maps canonical Spotify IDs, reports duplicate/invalid/filtered rows", () => {
    const a = "0123456789012345678901",
      b = "1234567890123456789012";
    const c = "2345678901234567890123";
    const csv = `Track URI,Track Name,Artist Name(s),Album Name,Added At\nspotify:track:${a},One,"A, B",LP,2021-01-01\nhttps://open.spotify.com/track/${a},Dup,C,LP,2022-01-01\nwrong,Bad,C,LP,2021-01-01\nspotify:track:${b},Old,C,LP,2019-01-01\nspotify:track:${c},Bad date,C,LP,2021-02-31`;
    const r = previewCsv(csv, "2020-01-01");
    expect(r.tracks).toHaveLength(1);
    expect(r.duplicates).toEqual([a]);
    expect(r.invalidIds).toEqual(["wrong"]);
    expect(r.filteredRows).toBe(1);
    expect(r.rejectedRows).toBe(2);
    const s = importLibrary(emptyState(), r, "liked.csv", "2020-01-01");
    expect(s.tracks[a].artists).toEqual(["A", "B"]);
    expect(s.events.at(-1)?.type).toBe("library_imported");
    expect(
      importLibrary(emptyState(), r, "liked.csv", "2020-01-01").library
        .fingerprint,
    ).toBe(r.fingerprint);
  });
});
