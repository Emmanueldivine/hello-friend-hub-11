import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Unieveryhelp — Assignment & Project Help for Students" },
      {
        name: "description",
        content:
          "Unieveryhelp is a student marketplace for assignment, project and academic support — post your work, get matched, and track delivery.",
      },
      { property: "og:title", content: "Unieveryhelp — Assignment & Project Help" },
      {
        property: "og:description",
        content: "Student marketplace for assignment, project and academic support.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentApp,
});

function StudentApp() {
  return (
    <iframe
      title="Unieveryhelp student portal"
      src="/student.html"
      style={{ width: "100%", height: "100vh", border: 0, display: "block" }}
    />
  );
}
