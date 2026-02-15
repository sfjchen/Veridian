/**
 * Unit tests for useCorpus – falsy classroomId and null-safe list.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useCorpus } from "../hooks/useCorpus";

const mockApi = jest.fn();

jest.mock("../lib/api", () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

describe("useCorpus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets loading to false and files to [] when classroomId is empty", async () => {
    const { result } = renderHook(() => useCorpus(""));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.files).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("fetches and sets files when classroomId is valid", async () => {
    const files = [
      {
        id: "f1",
        classroom_id: "c1",
        display_name: "Doc.pdf",
        storage_path: "/c1/f1",
        file_type: "application/pdf",
        uploaded_at: "2025-01-01T00:00:00Z",
        download_url: null,
      },
    ];
    mockApi.mockResolvedValue(files);

    const { result } = renderHook(() => useCorpus("c1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.files).toEqual(files);
    expect(mockApi).toHaveBeenCalledWith("/classrooms/c1/corpus");
  });

  it("uses empty array when api returns null (null-safe)", async () => {
    mockApi.mockResolvedValue(null);

    const { result } = renderHook(() => useCorpus("c1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.files).toEqual([]);
  });

  it("sets error when api rejects", async () => {
    mockApi.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useCorpus("c1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe("Network failure");
    expect(result.current.files).toEqual([]);
  });
});
