type Verdict = "follow" | "watch" | "avoid";
const map: Record<Verdict, string> = {
  follow: "badge badge-follow",
  watch:  "badge badge-watch",
  avoid:  "badge badge-avoid",
};
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <span className={map[verdict]}>{verdict}</span>;
}
