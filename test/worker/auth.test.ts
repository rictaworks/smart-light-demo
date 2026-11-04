import { describe, expect, it } from "vitest";
import { constantTimeEqual } from "../../worker/src/auth";
import { isJsonContentType } from "../../worker/src/validation";

describe("管理トークンの比較", () => {
  it("同じ文字列は一致する", () => {
    expect(constantTimeEqual("secret-token-123", "secret-token-123")).toBe(true);
  });

  it("1文字でも違えば一致しない（先頭・末尾・長さ違い）", () => {
    expect(constantTimeEqual("secret-token-123", "secret-token-124")).toBe(false);
    expect(constantTimeEqual("Xecret-token-123", "secret-token-123")).toBe(false);
    expect(constantTimeEqual("secret-token-12", "secret-token-123")).toBe(false);
    expect(constantTimeEqual("", "secret-token-123")).toBe(false);
  });

  it("マルチバイト文字も UTF-8 のバイト列で比べる", () => {
    expect(constantTimeEqual("トークン", "トークン")).toBe(true);
    expect(constantTimeEqual("トークン", "トークソ")).toBe(false);
  });
});

describe("Content-Type の判定", () => {
  it("application/json（パラメータ付きや大文字も可）を受け付ける", () => {
    expect(isJsonContentType("application/json")).toBe(true);
    expect(isJsonContentType("application/json; charset=utf-8")).toBe(true);
    expect(isJsonContentType("Application/JSON")).toBe(true);
  });

  it("それ以外や未指定は受け付けない", () => {
    expect(isJsonContentType(undefined)).toBe(false);
    expect(isJsonContentType("text/plain")).toBe(false);
    expect(isJsonContentType("application/x-www-form-urlencoded")).toBe(false);
    expect(isJsonContentType("multipart/form-data; boundary=x")).toBe(false);
  });
});
