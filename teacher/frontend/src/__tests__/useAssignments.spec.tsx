/**
 * Unit tests for useAssignments – falsy classroomId and null-safe list.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useAssignments } from "../hooks/useAssignments";

const mockApi = jest.fn();

jest.mock("../lib/api", () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

describe("useAssignments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets loading to false and assignments to [] when classroomId is empty", async () => {
    const { result } = renderHook(() => useAssignments(""));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.assignments).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("sets loading to false and assignments to [] when classroomId is undefined (falsy)", async () => {
    const { result } = renderHook(() => useAssignments(undefined as unknown as string));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.assignments).toEqual([]);
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("fetches and sets assignments when classroomId is valid", async () => {
    const assignments = [{ id: "a1", title: "Assignment 1", due_date: null, classroom_id: "c1" }];
    mockApi.mockResolvedValue(assignments);

    const { result } = renderHook(() => useAssignments("c1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.assignments).toEqual(assignments);
    expect(mockApi).toHaveBeenCalledWith("/classrooms/c1/assignments");
  });

  it("uses empty array when api returns null (null-safe)", async () => {
    mockApi.mockResolvedValue(null);

    const { result } = renderHook(() => useAssignments("c1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.assignments).toEqual([]);
  });

  it("sets error when api rejects", async () => {
    mockApi.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useAssignments("c1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe("Network failure");
    expect(result.current.assignments).toEqual([]);
  });
});
