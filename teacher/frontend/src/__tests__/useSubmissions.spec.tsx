/**
 * Unit tests for useSubmissions – falsy assignmentId and null-safe list.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useSubmissions } from "../hooks/useSubmissions";

const mockApi = jest.fn();

jest.mock("../lib/api", () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

describe("useSubmissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets loading to false and submissions to [] when assignmentId is empty", async () => {
    const { result } = renderHook(() => useSubmissions(""));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.submissions).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("uses empty array when api returns null (null-safe)", async () => {
    mockApi.mockResolvedValue(null);

    const { result } = renderHook(() => useSubmissions("a1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.submissions).toEqual([]);
  });
});
