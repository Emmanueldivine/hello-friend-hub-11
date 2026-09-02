import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Unieveryhelp" },
      {
        name: "description",
        content: "Internal Unieveryhelp admin dashboard for orders, students, writers and revenue.",
      },
      { property: "og:title", content: "Admin Dashboard — Unieveryhelp" },
      {
        property: "og:description",
        content: "Internal Unieveryhelp admin dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminApp,
});

function AdminApp() {
  return (
    <iframe
      title="Unieveryhelp admin dashboard"
      src="/admin.html"
      style={{ width: "100%", height: "100vh", border: 0, display: "block" }}
    />
  );
}
