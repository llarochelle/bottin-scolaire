import axios from "axios";

export const API = "/api";

export const api = axios.create({
  baseURL: API,
  withCredentials: true,  // Security: send cookies with each request
});

// No need to manage tokens manually - cookies are sent automatically

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Une erreur est survenue. Veuillez réessayer.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
