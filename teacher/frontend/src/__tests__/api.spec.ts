/**
 * Unit tests for api() – request behavior, null response, and error handling.
 */

import { api } from "../lib/api";

const mockFetch = jest.fn();
const mockGetSession = jest.fn();

jest.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}));

global.fetch = mockFetch;

describe("api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it("returns null for 204 No Content", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers(),
    });
    const result = await api("/test");
    expect(result).toBeNull();
  });

  it("returns null when content-length is 0", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "0" }),
      json: () => Promise.resolve({}),
    });
    const result = await api("/test");
    expect(result).toBeNull();
  });

  it("returns parsed JSON for 200 with body", async () => {
    const body = { items: [1, 2, 3] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve(body),
    });
    const result = await api<typeof body>("/test");
    expect(result).toEqual(body);
  });

  it("throws with server error message when response has error field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Not found" }),
    });
    await expect(api("/test")).rejects.toThrow("Not found");
  });

  it("throws with HTTP status when response body is not JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("Invalid JSON")),
    });
    await expect(api("/test")).rejects.toThrow("HTTP 500");
  });

  it("uses session token when getSession returns session", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "token123" } },
      error: null,
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({}),
    });
    await api("/test");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token123",
        }),
      })
    );
  });

  it("does not throw when getSession returns data without session (safe destructuring)", async () => {
    mockGetSession.mockResolvedValue({ data: undefined, error: null });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({}),
    });
    await expect(api("/test")).resolves.toEqual({});
  });

  it("throws user-friendly error when response is 200 but response.json() throws (invalid JSON)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "10" }),
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    });
    await expect(api("/test")).rejects.toThrow("Invalid response from server");
  });

  it("propagates error when getSession rejects", async () => {
    mockGetSession.mockRejectedValue(new Error("Session error"));
    await expect(api("/test")).rejects.toThrow("Session error");
  });
});
