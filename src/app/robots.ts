import type { MetadataRoute } from "next";
// Aplicație cu cont: doar paginile publice pot fi indexate.
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: ["/login", "/signup", "/privacy", "/subprocessors", "/terms"], disallow: ["/api/", "/admin", "/"] }] };
}
