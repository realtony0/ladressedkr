export const STAFF_ACCESS_COOKIE = "ladresse_staff_code";
export const STAFF_ACCESS_COOKIE_VALUE = "ok";
export const STAFF_ACCESS_CODE = (process.env.STAFF_ACCESS_CODE ?? "150803").trim();

export function isValidStaffAccessCode(input: string | null | undefined) {
  return (input?.trim() ?? "") === STAFF_ACCESS_CODE;
}

export function hasValidStaffAccessCookieValue(value: string | null | undefined) {
  return (value ?? "") === STAFF_ACCESS_COOKIE_VALUE;
}

export function hasValidStaffAccessCookieFromStore(
  cookiesStore: Pick<{ get: (name: string) => { value: string } | undefined }, "get">,
) {
  return hasValidStaffAccessCookieValue(cookiesStore.get(STAFF_ACCESS_COOKIE)?.value);
}
