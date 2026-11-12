import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { StudentShell } from "@/components/student/StudentShell";
import { PageTitle } from "@/components/student/ui";

export const Route = createFileRoute("/student/support")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Help & Support | Unieveryhelp" },
      { name: "description", content: "Answers to common questions and a direct line to support." },
      { property: "og:title", content: "Help & Support | Unieveryhelp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <StudentShell>
      <Support />
    </StudentShell>
  ),
});

const FAQ = [
  { q: "How do I place an assignment?", a: "Tap New Assignment, fill in the details, check the price and pay from your wallet. Fund your wallet first if your balance is short." },
  { q: "What do the statuses mean?", a: "Received means we have your order. In Progress means a writer has started. Under Review means we are checking the work. Completed means your solution is ready to download." },
  { q: "Can I cancel an assignment?", a: "Yes, while it is still Received. Open the assignment, choose Cancel and your money returns to your wallet instantly." },
  { q: "How long do downloads stay available?", a: "Completed files are deleted after 5 days, so save them to your device." },
  { q: "I forgot my password.", a: "On the sign in page choose Forgot password and we will email a 6-digit code to the personal email you registered with." },
];

function Support() {
  return (
    <>
      <PageTitle title="Help & Support" sub="Quick answers, or talk to our team." action={<Link to="/student/messages" className="sp-btn"><MessageSquare size={16} /> Message support</Link>} />
      <div className="grid gap-3">
        {FAQ.map((f) => (
          <details key={f.q} className="sp-card group p-5">
            <summary className="cursor-pointer text-[15px] font-bold">{f.q}</summary>
            <p className="sp-muted mt-3 text-[14px] leading-6">{f.a}</p>
          </details>
        ))}
      </div>
    </>
  );
}
