/**
 * Unit tests for useClassroomStudents – falsy classroomId and null-safe list.
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useClassroomStudents } from "../hooks/useClassroomStudents";

const mockApi = jest.fn();

jest.mock("../lib/api", () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

describe("useClassroomStudents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets loading to false and students to [] when classroomId is empty", async () => {
    const { result } = renderHook(() => useClassroomStudents(""));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.students).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("fetches and sets students when classroomId is valid", async () => {
    const students = [
      { student_id: "s1", display_name: "Alice", joined_at: "2025-01-01T00:00:00Z" },
    ];
    mockApi.mockResolvedValue(students);

    const { result } = renderHook(() => useClassroomStudents("c1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.students).toEqual(students);
    expect(mockApi).toHaveBeenCalledWith("/classrooms/c1/students");
  });

  it("uses empty array when api returns null (null-safe)", async () => {
    mockApi.mockResolvedValue(null);

    const { result } = renderHook(() => useClassroomStudents("c1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.students).toEqual([]);
  });

  it("sets error when api rejects", async () => {
    mockApi.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useClassroomStudents("c1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe("Network failure");
    expect(result.current.students).toEqual([]);
  });
});
